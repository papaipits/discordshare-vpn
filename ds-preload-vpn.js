// DiscordShare VPN — clean preload. Chains Discord's original preload, exposes a
// minimal bridge to the main process, and injects the in-Discord panel. No relay,
// no UDP video bridge, no voice hooks — nothing that touches audio/camera.
const fs = require('fs');
try {
  const arg = (process.argv || []).find(a => a.startsWith('--ds-orig-preload='));
  const orig = arg ? arg.slice('--ds-orig-preload='.length) : null;
  if (orig && orig !== 'null' && orig !== 'undefined' && fs.existsSync(orig)) require(orig);
} catch (e) { try { console.error('[ds-preload-vpn] orig preload error', e); } catch (_) {} }

try {
  const { contextBridge, ipcRenderer } = require('electron');
  const api = {
    listConfigs: () => ipcRenderer.invoke('ds-vpn-list'),
    partition: () => ipcRenderer.invoke('ds-vpn-partition'),
    status: () => ipcRenderer.invoke('ds-vpn-status'),
    saveCustom: (name, content) => ipcRenderer.invoke('ds-vpn-save-custom', { name, content }),
    startTunnel: (name) => ipcRenderer.invoke('ds-vpn-start', { name }),
    stopTunnel: () => ipcRenderer.invoke('ds-vpn-stop'),
    openLogin: (url) => ipcRenderer.invoke('ds-vpn-open-login', { url }),
    version: () => ipcRenderer.invoke('ds-vpn-version'),
    checkUpdate: () => ipcRenderer.invoke('ds-vpn-check-update'),
    applyUpdate: () => ipcRenderer.invoke('ds-vpn-apply-update'),
    onEvent: (cb) => ipcRenderer.on('ds-vpn-event', (e, m) => { try { cb(m); } catch (_) {} }),
  };
  try { contextBridge.exposeInMainWorld('__dsVPN', api); }
  catch (e) { try { window.__dsVPN = api; } catch (_) {} }
} catch (e) { try { console.error('[ds-preload-vpn] bridge error', e); } catch (_) {} }

try {
  const { webFrame } = require('electron');
  const code = fs.readFileSync(__dirname.replace(/\\/g, '/') + '/ds-vpn-panel.js', 'utf8');
  webFrame.executeJavaScript(code);
} catch (e) { try { console.error('[ds-preload-vpn] inject error', e); } catch (_) {} }
