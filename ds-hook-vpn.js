// DiscordShare VPN — main-process hook (injected via discord_desktop_core/index.js).
// Makes Discord's native video/Go Live work from a region-blocked network by routing
// ONLY Discord through a non-BR WireGuard tunnel (WireSock per-app). Internet stays local.
//  - injects our preload (in-Discord VPN panel) + strips CSP so the panel renders
//  - captures WireGuard .conf downloads from the in-Discord Proton login window
//  - drives a WireSock per-app tunnel via a scheduled task (admin only on the first connect)
// Relocatable: all paths derive from __dirname.
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile, execSync, spawn } = require('child_process');

// Self-update: the overlay checks GitHub for a newer version, downloads the files, restarts Discord.
const VERSION = '1.0.1';
const UPDATE_RAW_BASE = 'https://raw.githubusercontent.com/papaipits/discordshare-vpn/main';
const UPDATE_FILES = ['ds-hook-vpn.js', 'ds-preload-vpn.js', 'ds-vpn-panel.js'];

const BASE = __dirname.replace(/\\/g, '/'); // relocatable: files live next to this hook
const CONFIG_DIR = BASE + '/vpn-configs';
const LOG = BASE + '/ds-vpn.log';
const DS_PRELOAD = BASE + '/ds-preload-vpn.js';
const VPN_PARTITION = 'persist:ds-vpn';

try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch (e) {}
const log = (...a) => { try { fs.appendFileSync(LOG, '[' + new Date().toISOString() + '] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n'); } catch (e) {} };
try { fs.writeFileSync(LOG, ''); } catch (e) {}
log('ds-hook-vpn loaded; process.type=', process.type || 'main');

let dsProxy = null;
let elec = null;            // the real electron module
let captureWired = false;
let loginWin = null;        // transient provider-login child window

// --- WireSock per-app tunnel: only Discord is tunneled; rest of the machine stays local. ---
const TASK_NAME = 'DiscordShareVPN';
const WS_RUN_PS1 = BASE + '/ds-ws-run.ps1';
const WS_TASKINSTALL_BAT = BASE + '/ds-ws-taskinstall.bat';
const WS_LOG = BASE + '/ds-ws.log';
const STATE_FILE = BASE + '/ds-tunnel-active.txt';
const TASK_USER = (process.env.USERDOMAIN || process.env.COMPUTERNAME || '.') + '\\' + (process.env.USERNAME || '');
let activeTunnel = null;
const bksl = p => String(p).replace(/\//g, '\\');

function safeName(s) { return String(s || 'config').replace(/[^\w.\-]/g, '_'); }

function listConfigs() {
  let files = [];
  try {
    files = fs.readdirSync(CONFIG_DIR).filter(f => f.toLowerCase().endsWith('.conf')).map(f => {
      const p = path.join(CONFIG_DIR, f); let endpoint = '?';
      try { const t = fs.readFileSync(p, 'utf8'); const m = t.match(/Endpoint\s*=\s*([^\s]+)/i); if (m) endpoint = m[1]; } catch (e) {}
      return { name: f, path: p, endpoint };
    });
  } catch (e) {}
  return files;
}

function broadcast(msg) {
  try { elec && elec.webContents && elec.webContents.getAllWebContents().forEach(wc => { try { wc.send('ds-vpn-event', msg); } catch (e) {} }); } catch (e) {}
}

// Reload the Discord renderer so its gateway/voice reconnect THROUGH the freshly-started
// tunnel (existing connections stay on the old route). The tunnel is a separate process,
// so the reload does not drop it.
function reloadDiscord() {
  try {
    if (!elec || !elec.webContents) return;
    elec.webContents.getAllWebContents().forEach(wc => {
      try { if (/discord\.com\/(channels|app)/.test(wc.getURL() || '')) { log('reloading discord renderer'); wc.reload(); } } catch (e) {}
    });
  } catch (e) { log('reloadDiscord err', e.message); }
}

function wireCapture() {
  if (captureWired || !elec) return;
  try {
    const ses = elec.session.fromPartition(VPN_PARTITION);
    ses.on('will-download', (event, item) => {
      const fn = item.getFilename() || 'wireguard.conf';
      const dest = path.join(CONFIG_DIR, safeName(fn.replace(/\.conf$/i, '')) + '.conf');
      try { item.setSavePath(dest); } catch (e) {}
      log('will-download', fn, '->', dest);
      broadcast({ type: 'downloading', filename: fn });
      item.once('done', (e, state) => {
        if (state === 'completed') {
          log('captured', dest); broadcast({ type: 'captured', filename: path.basename(dest), path: dest });
          try { if (loginWin && !loginWin.isDestroyed()) loginWin.close(); } catch (er) {}
        }
        else { log('download', state); broadcast({ type: 'error', message: 'download ' + state }); }
        broadcast({ type: 'configs', files: listConfigs() });
      });
    });
    captureWired = true;
    log('download capture wired on', VPN_PARTITION);
  } catch (e) { log('wireCapture err', e.message); }
}

// --- WireSock per-app tunnel control (safe: ONLY Discord routed; never system-wide) ---
function findWireSock() {
  const c = [
    'C:/Program Files/WireSock Secure Connect/sdk/wiresock-client.exe',
    'C:/Program Files/WireSock Secure Connect/wiresock-client.exe',
    'C:/Program Files/WireSock VPN Client/wiresock-client.exe',
  ];
  for (const p of c) if (fs.existsSync(p)) return p;
  return null;
}

// Convert a plain WireGuard .conf into a WireSock per-app config (AllowedApps=Discord).
function genWireSockConfig(confPath) {
  const t = fs.readFileSync(confPath, 'utf8');
  const g = re => { const m = t.match(re); return m ? m[1].trim() : null; };
  const pk = g(/PrivateKey\s*=\s*(\S+)/i), pub = g(/PublicKey\s*=\s*(\S+)/i);
  const ep = g(/Endpoint\s*=\s*([^\s]+)/i);
  const addr = (g(/Address\s*=\s*([^\r\n]+)/i) || '10.2.0.2/32').trim();
  const dns = (g(/DNS\s*=\s*([^\r\n]+)/i) || '').trim();
  const out = confPath.replace(/\.conf$/i, '') + '.wsconf';
  let cfg = `[Interface]\nPrivateKey = ${pk}\nAddress = ${addr}\n`;
  if (dns) cfg += `DNS = ${dns}\n`;
  cfg += `\n[Peer]\nPublicKey = ${pub}\nEndpoint = ${ep}\nAllowedIPs = 0.0.0.0/0, ::/0\nAllowedApps = Discord\nPersistentKeepalive = 25\n`;
  fs.writeFileSync(out, cfg);
  return out;
}

function taskExists() {
  try { execSync('schtasks /query /tn ' + TASK_NAME, { stdio: 'ignore', windowsHide: true }); return true; }
  catch (e) { return false; }
}
function isWireSockRunning() {
  try { return /wiresock-client\.exe/i.test(execSync('tasklist /fi "imagename eq wiresock-client.exe" /nh', { encoding: 'utf8', windowsHide: true })); }
  catch (e) { return false; }
}

// Create the elevated scheduled task ONCE (single UAC). Task runs WS_RUN_BAT with highest
// privileges, so later start/stop (schtasks /run, /end) need NO further UAC.
function ensureTask(cb) {
  if (taskExists()) { cb(true); return; }
  try {
    fs.writeFileSync(WS_TASKINSTALL_BAT,
      '@echo off\r\nschtasks /create /tn "' + TASK_NAME + '" /tr "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"' + bksl(WS_RUN_PS1) + '\\"" /sc ONCE /st 00:00 /rl HIGHEST /f\r\n');
    const ps = "Start-Process -FilePath '" + bksl(WS_TASKINSTALL_BAT) + "' -Verb RunAs -WindowStyle Hidden -Wait";
    const p = spawn('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore', windowsHide: true });
    p.on('exit', () => setTimeout(() => cb(taskExists()), 600));
    p.on('error', (e) => { log('ensureTask spawn err', e.message); cb(false); });
  } catch (e) { log('ensureTask err', e.message); cb(false); }
}

function startTunnel(confName) {
  const conf = path.join(CONFIG_DIR, confName);
  if (!fs.existsSync(conf)) return { ok: false, error: 'config não encontrado: ' + confName };
  const ws = findWireSock();
  if (!ws) return { ok: false, error: 'WireSock não instalado (o instalador cuida disso).' };
  try {
    const wsconf = genWireSockConfig(conf);
    // Hidden launcher: powershell (-WindowStyle Hidden) runs wiresock in the foreground and
    // stays as the task's root process (wiresock is its in-job child), so `schtasks /end`
    // tears the whole tree down. No visible window.
    fs.writeFileSync(WS_RUN_PS1,
      "& '" + bksl(ws) + "' run -config '" + bksl(wsconf) + "' -log-level info -network-lock off *> '" + bksl(WS_LOG) + "'\r\n");
    fs.writeFileSync(STATE_FILE, confName);
    broadcast({ type: 'tunnel', state: 'connecting' });
    ensureTask((ok) => {
      if (!ok) { broadcast({ type: 'tunnel', state: 'error', message: 'não consegui criar a tarefa elevada (admin negado?)' }); return; }
      execFile('schtasks', ['/run', '/tn', TASK_NAME], { windowsHide: true }, (err) => {
        if (err) { log('task run err', err.message); broadcast({ type: 'tunnel', state: 'error', message: err.message }); }
        else { activeTunnel = confName; log('tunnel started', confName); setTimeout(() => { broadcast({ type: 'tunnel', state: 'up', name: confName }); reloadDiscord(); }, 2800); }
      });
    });
    return { ok: true, pending: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

function stopTunnel() {
  try { execFile('schtasks', ['/end', '/tn', TASK_NAME], { windowsHide: true }, () => {}); } catch (e) {}
  try { execFile('taskkill', ['/f', '/im', 'wiresock-client.exe'], { windowsHide: true }, () => {}); } catch (e) {}
  try { if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE); } catch (e) {}
  activeTunnel = null;
  broadcast({ type: 'tunnel', state: 'down' });
  setTimeout(reloadDiscord, 1800); // reconnect Discord on the normal (BR) route
  return { ok: true };
}

function tunnelStatus() {
  const active = (fs.existsSync(STATE_FILE) ? (fs.readFileSync(STATE_FILE, 'utf8').trim() || null) : null);
  return { ready: !!findWireSock(), active, running: isWireSockRunning(), taskReady: taskExists() };
}

// Auto-start the tunnel on Discord launch if a config was marked active (no UAC once the task exists).
function autoStartTunnel() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const confName = fs.readFileSync(STATE_FILE, 'utf8').trim();
    if (!confName || !fs.existsSync(path.join(CONFIG_DIR, confName))) return;
    if (isWireSockRunning()) { activeTunnel = confName; log('tunnel already running', confName); return; }
    log('auto-starting tunnel', confName);
    startTunnel(confName);
  } catch (e) { log('autoStartTunnel err', e.message); }
}

// --- Self-repatch: keep the newest Discord version patched across auto-updates ---
// Discord updates create a fresh (unpatched) app-* folder and relaunch into it. While THIS
// hook is alive, we watch for the new version and patch its index.js before the relaunch,
// so the tool survives updates with no manual re-install.
const cmpVer = (a, b) => {
  const pa = a.replace(/^app-/, '').split('.').map(Number), pb = b.replace(/^app-/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
};
function patchIndex(idx) {
  try {
    const c = fs.readFileSync(idx, 'utf8');
    if (c.indexOf('ds-hook-vpn') >= 0) return;
    const bak = idx + '.dsbak';
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, c);
    fs.writeFileSync(idx, "try { require('" + BASE + "/ds-hook-vpn.js'); } catch (e) {}\n" + c);
    log('self-repatched new Discord version', idx);
  } catch (e) { log('patchIndex err', e.message); }
}
function ensureAllPatched() {
  for (const app of ['Discord', 'DiscordPTB']) {
    try {
      const root = path.join(process.env.LOCALAPPDATA || '', app);
      if (!fs.existsSync(root)) continue;
      const vers = fs.readdirSync(root).filter(d => /^app-/.test(d)).sort(cmpVer);
      const latest = vers[vers.length - 1];
      if (!latest) continue;
      const idx = path.join(root, latest, 'modules', 'discord_desktop_core-1', 'discord_desktop_core', 'index.js');
      if (fs.existsSync(idx)) patchIndex(idx);
    } catch (e) {}
  }
}

// --- Self-update from GitHub ---------------------------------------------------
function httpsGet(url, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'DiscordShareVPN', 'Cache-Control': 'no-cache' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume(); httpsGet(res.headers.location, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}
function cmpSemver(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
async function checkUpdate() {
  try {
    const j = JSON.parse(await httpsGet(UPDATE_RAW_BASE + '/version.json?t=' + Date.now()));
    return { ok: true, current: VERSION, latest: j.version, available: cmpSemver(j.version, VERSION) > 0, notes: j.notes || '' };
  } catch (e) { return { ok: false, error: e.message, current: VERSION }; }
}
async function applyUpdate() {
  try {
    const j = JSON.parse(await httpsGet(UPDATE_RAW_BASE + '/version.json?t=' + Date.now()));
    if (cmpSemver(j.version, VERSION) <= 0) return { ok: false, error: 'já está na versão mais nova (' + VERSION + ')' };
    const files = j.files || UPDATE_FILES;
    const tmp = {};
    for (const f of files) { const c = await httpsGet(UPDATE_RAW_BASE + '/' + f + '?t=' + Date.now()); if (!c || c.length < 20) throw new Error('download vazio: ' + f); tmp[f] = c; }
    for (const f of files) fs.writeFileSync(path.join(BASE, f), tmp[f]); // write after all fetched (atomic-ish)
    log('self-update applied ->', j.version);
    broadcast({ type: 'update', state: 'applied', version: j.version });
    setTimeout(() => { try { const { app } = elec || require('electron'); app.relaunch(); app.exit(0); } catch (e) { log('relaunch err', e.message); } }, 1800);
    return { ok: true, version: j.version };
  } catch (e) { return { ok: false, error: e.message }; }
}

// --- electron hook ------------------------------------------------------------
function installIpc(m) {
  if (!m.ipcMain || m.ipcMain.__dsVpn) return;
  m.ipcMain.__dsVpn = true;
  m.ipcMain.handle('ds-vpn-list', () => listConfigs());
  m.ipcMain.handle('ds-vpn-partition', () => VPN_PARTITION);
  m.ipcMain.handle('ds-vpn-status', () => tunnelStatus());
  m.ipcMain.handle('ds-vpn-version', () => VERSION);
  m.ipcMain.handle('ds-vpn-check-update', () => checkUpdate());
  m.ipcMain.handle('ds-vpn-apply-update', () => applyUpdate());
  m.ipcMain.handle('ds-vpn-save-custom', (ev, { name, content }) => {
    try {
      if (!content || !/\[Interface\]/i.test(content) || !/PrivateKey/i.test(content)) return { ok: false, error: 'Não parece um config WireGuard ([Interface]/PrivateKey ausentes).' };
      const dest = path.join(CONFIG_DIR, safeName(name || 'custom') + '.conf');
      fs.writeFileSync(dest, content, 'utf8');
      broadcast({ type: 'captured', filename: path.basename(dest), path: dest });
      broadcast({ type: 'configs', files: listConfigs() });
      return { ok: true, path: dest };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  m.ipcMain.handle('ds-vpn-start', (ev, { name }) => startTunnel(name));
  m.ipcMain.handle('ds-vpn-stop', () => stopTunnel());
  m.ipcMain.handle('ds-vpn-open-login', (ev, { url }) => {
    try {
      const parent = m.BrowserWindow.fromWebContents(ev.sender);
      if (loginWin && !loginWin.isDestroyed()) { try { loginWin.close(); } catch (e) {} loginWin = null; }
      // Child of the Discord window (not a standalone app), own isolated session = capture partition.
      loginWin = new m.BrowserWindow({
        width: 1120, height: 840, parent, title: 'Login VPN — gere um WireGuard de servidor FORA do BR',
        autoHideMenuBar: true, backgroundColor: '#1e1f22',
        webPreferences: { partition: VPN_PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      loginWin.loadURL(url);
      loginWin.on('closed', () => { loginWin = null; });
      log('login window opened', url);
      return { ok: true };
    } catch (e) { log('open-login err', e.message); return { ok: false, error: e.message }; }
  });
  log('ipcMain handlers installed');
}

function setupApp(m) {
  const go = () => {
    try {
      // strip CSP so our injected panel + inline bits render
      const ses = m.session && m.session.defaultSession;
      if (ses && ses.webRequest) {
        ses.webRequest.onHeadersReceived((details, cb) => {
          try { const h = details.responseHeaders || {}; for (const k of Object.keys(h)) if (/content-security-policy/i.test(k)) delete h[k]; cb({ responseHeaders: h }); }
          catch (e) { cb({}); }
        });
        log('CSP stripper installed');
      }
      wireCapture();
      autoStartTunnel();
    } catch (e) { log('setupApp err', e.message); }
  };
  try { if (m.app.isReady && m.app.isReady()) go(); else m.app.whenReady().then(go); } catch (e) { log('app ready err', e.message); }
}

try {
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request) {
    const m = origLoad.apply(this, arguments);
    try {
      if (request === 'electron' && m && m.BrowserWindow) {
        if (!dsProxy) {
          elec = m;
          const OrigBW = m.BrowserWindow;
          function DSBrowserWindow(options) {
            try {
              options = options || {};
              options.webPreferences = options.webPreferences || {};
              const origPre = options.webPreferences.preload || null;
              options.webPreferences.preload = DS_PRELOAD;
              options.webPreferences.sandbox = false;
              options.webPreferences.webviewTag = true; // enable embedded provider login
              options.webPreferences.additionalArguments = (options.webPreferences.additionalArguments || []).concat(['--ds-orig-preload=' + origPre]);
              log('BrowserWindow(): preload injected, webviewTag on; origPreload=', origPre);
            } catch (e) { log('bw opts err', e.message); }
            return Reflect.construct(OrigBW, [options], new.target || DSBrowserWindow);
          }
          DSBrowserWindow.prototype = OrigBW.prototype;
          Object.setPrototypeOf(DSBrowserWindow, OrigBW);
          dsProxy = new Proxy(m, { get(t, p) { return p === 'BrowserWindow' ? DSBrowserWindow : t[p]; } });
          log('electron proxy created');
          installIpc(m);
          setupApp(m);
          // allow <webview> with our partition to attach
          try {
            m.app.on('web-contents-created', (e, wc) => {
              wc.on('will-attach-webview', (ev, wp, params) => {
                try { wp.nodeIntegration = false; wp.contextIsolation = true; log('webview attach', params && params.src); } catch (er) {}
              });
            });
          } catch (er) { log('wcc err', er.message); }
        }
        return dsProxy;
      }
    } catch (e) { log('electron hook err', e.message); }
    return m;
  };
  log('Module._load patched');
} catch (e) { log('module patch err', e.message); }

// keep the newest Discord/PTB version patched (now + every 30s) so auto-updates stay seamless
try { ensureAllPatched(); setInterval(ensureAllPatched, 30000); } catch (e) { log('selfpatch init err', e.message); }

module.exports = {};
