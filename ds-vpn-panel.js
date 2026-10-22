// DiscordShare VPN panel — injected into Discord's renderer (main world).
// A toggle button + compact overlay. Single ON/OFF switch controls the tunnel;
// provider login opens in a child window; configs captured automatically.
(function () {
  const api = window.__dsVPN;
  if (!api) { console.warn('[ds-vpn] bridge __dsVPN missing'); return; }
  function init() {
    if (window.__dsVpnPanel) return; window.__dsVpnPanel = 1;

    const PROVIDERS = [
      { id: 'proton', name: 'Proton VPN', tag: 'grátis', url: 'https://account.protonvpn.com/downloads',
        hint: 'Conta Free (sem cartão) → Downloads → WireGuard → servidor fora do BR (US) → Create.' },
      { id: 'windscribe', name: 'Windscribe', tag: 'grátis · 10GB', url: 'https://windscribe.com/configgenerator',
        hint: 'Logue e gere: WireGuard → país fora do BR → Download.' },
      { id: 'mullvad', name: 'Mullvad', tag: 'pago', url: 'https://mullvad.net/en/account',
        hint: 'WireGuard configuration → servidor fora do BR → baixe o .conf.' },
    ];

    const css = `
    #dsvpn-fab{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:44px;height:44px;border-radius:50%;
      background:#5865f2;color:#fff;border:0;cursor:pointer;font-size:18px;box-shadow:0 4px 14px rgba(0,0,0,.45)}
    #dsvpn-fab:hover{filter:brightness(1.1)}
    #dsvpn-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center}
    #dsvpn-overlay.on{display:flex}
    #dsvpn-modal{width:560px;max-width:94vw;max-height:90vh;background:#2b2d31;color:#e7e8ea;border:1px solid #1e1f22;border-radius:14px;
      display:flex;flex-direction:column;overflow:hidden;font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)}
    #dsvpn-modal header{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#232428;border-bottom:1px solid #1e1f22}
    #dsvpn-modal header b{font-size:15px;flex:0 0 auto}
    #dsvpn-badge{font-size:11px;padding:3px 9px;border-radius:20px;background:#1e1f22;color:#9a9ca1;flex:1;text-align:center}
    #dsvpn-x{background:#36373d;border:0;color:#e7e8ea;border-radius:7px;padding:6px 12px;cursor:pointer}
    #dsvpn-x:hover{background:#40414a}
    #dsvpn-body{padding:14px 16px;overflow:auto}
    .dsvpn-sec{margin-bottom:16px}
    .dsvpn-sec h4{margin:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#9a9ca1;font-weight:700}
    #dsvpn-hero{background:#1e1f22;border:1px solid #34353a;border-radius:10px;padding:14px}
    .dsvpn-herorow{display:flex;align-items:center;gap:12px}
    .dsvpn-herorow .meta{flex:1;min-width:0}
    .dsvpn-herorow .state{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:700}
    #dsvpn-dot{width:10px;height:10px;border-radius:50%;background:#72767d;flex:0 0 auto}
    #dsvpn-herosub{color:#9a9ca1;font-size:12px;margin-top:3px}
    .dsvpn-switch{position:relative;width:54px;height:30px;flex:0 0 auto;cursor:pointer}
    .dsvpn-switch .track{position:absolute;inset:0;background:#4e5058;border-radius:20px;transition:.18s}
    .dsvpn-switch .thumb{position:absolute;top:3px;left:3px;width:24px;height:24px;background:#fff;border-radius:50%;transition:.18s;box-shadow:0 1px 3px rgba(0,0,0,.4)}
    .dsvpn-switch.on .track{background:#248046}
    .dsvpn-switch.on .thumb{left:27px}
    .dsvpn-switch.busy{opacity:.55;pointer-events:none}
    .dsvpn-switch.disabled{opacity:.4;pointer-events:none}
    .dsvpn-sel{width:100%;margin-top:12px;background:#111216;color:#e7e8ea;border:1px solid #34353a;border-radius:7px;padding:7px 9px;font-size:12px}
    .dsvpn-prov{display:flex;align-items:center;gap:10px;background:#1e1f22;border:1px solid #34353a;border-radius:8px;padding:9px 11px;margin-top:8px}
    .dsvpn-prov .info{flex:1;min-width:0}
    .dsvpn-prov .ttl{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px}
    .dsvpn-prov .hint{color:#9a9ca1;font-size:11px;margin-top:2px}
    .dsvpn-tag{font-size:10px;padding:1px 7px;border-radius:20px;background:#2f3136;color:#9a9ca1;font-weight:600}
    .dsvpn-btn{background:#5865f2;border:0;color:#fff;border-radius:7px;padding:7px 13px;cursor:pointer;font-weight:600;font-size:12px;flex:0 0 auto}
    .dsvpn-btn:hover{filter:brightness(1.08)}
    .dsvpn-btn.ok{background:#248046}
    details.dsvpn-paste summary{cursor:pointer;color:#9a9ca1;font-size:12px;user-select:none;list-style:none}
    details.dsvpn-paste summary::-webkit-details-marker{display:none}
    details.dsvpn-paste summary:before{content:'▸ ';color:#72767d}
    details.dsvpn-paste[open] summary:before{content:'▾ '}
    #dsvpn-paste{width:100%;min-height:92px;margin-top:8px;background:#111216;color:#e7e8ea;border:1px solid #34353a;border-radius:7px;padding:9px;font:11px/1.45 ui-monospace,Consolas,monospace;resize:vertical}
    input.dsvpn-name{background:#111216;color:#e7e8ea;border:1px solid #34353a;border-radius:7px;padding:7px 9px;font-size:12px;width:100%;margin-top:8px}
    #dsvpn-status{padding:10px 16px;border-top:1px solid #1e1f22;background:#232428;min-height:20px;font-size:12px}
    #dsvpn-status.ok{color:#57d98a} #dsvpn-status.err{color:#ed6a5e} #dsvpn-status.info{color:#f0b24a}
    #dsvpn-updbanner{background:#3a2f14;border:1px solid #6b5420;color:#f0b24a;border-radius:9px;padding:10px 12px;margin-bottom:14px;display:none;align-items:center;gap:10px;font-size:12px}
    #dsvpn-updbanner.show{display:flex}
    #dsvpn-updbanner .txt{flex:1}
    #dsvpn-ver{font-size:10px;color:#72767d;margin-left:auto;padding-right:6px}
    `;
    const style = document.createElement('style'); style.textContent = css; document.documentElement.appendChild(style);

    const fab = document.createElement('button'); fab.id = 'dsvpn-fab'; fab.title = 'DiscordShare VPN (Ctrl+Shift+V)'; fab.textContent = '🛡';
    document.body.appendChild(fab);

    const overlay = document.createElement('div'); overlay.id = 'dsvpn-overlay';
    overlay.innerHTML = `
      <div id="dsvpn-modal">
        <header>
          <b>🛡 DiscordShare VPN</b>
          <span id="dsvpn-badge">—</span>
          <button id="dsvpn-x">Fechar</button>
        </header>
        <div id="dsvpn-body">
          <div id="dsvpn-updbanner"></div>
          <div class="dsvpn-sec">
            <h4>VPN</h4>
            <div id="dsvpn-hero">
              <div class="dsvpn-herorow">
                <div class="meta">
                  <div class="state"><span id="dsvpn-dot"></span><span id="dsvpn-state">—</span></div>
                  <div id="dsvpn-herosub">—</div>
                </div>
                <div class="dsvpn-switch disabled" id="dsvpn-toggle"><div class="track"></div><div class="thumb"></div></div>
              </div>
              <select id="dsvpn-cfgsel" class="dsvpn-sel" style="display:none"></select>
            </div>
          </div>
          <div class="dsvpn-sec">
            <h4>Pegar um config grátis</h4>
            <div id="dsvpn-herohint" style="color:#9a9ca1;font-size:12px;margin-bottom:2px">Logue no provedor e gere um WireGuard de servidor <b>fora do Brasil</b>. Eu capturo o <code>.conf</code> sozinho e a janela fecha.</div>
            <div id="dsvpn-providers"></div>
          </div>
          <div class="dsvpn-sec">
            <details class="dsvpn-paste">
              <summary>Já tenho um .conf (self-host / outro provedor) — colar</summary>
              <input class="dsvpn-name" id="dsvpn-cname" placeholder="nome (ex.: meu-us)" />
              <textarea id="dsvpn-paste" placeholder="[Interface]&#10;PrivateKey = ...&#10;&#10;[Peer]&#10;Endpoint = 1.2.3.4:51820"></textarea>
              <div style="margin-top:8px"><button class="dsvpn-btn ok" id="dsvpn-savecustom">Salvar config</button></div>
            </details>
          </div>
        </div>
        <div id="dsvpn-status"></div>
      </div>`;
    document.body.appendChild(overlay);

    const $ = (id) => document.getElementById(id);
    const setStatus = (kind, msg) => { const s = $('dsvpn-status'); s.className = kind; s.textContent = msg; };
    const open = () => { overlay.classList.add('on'); refresh(); checkForUpdate(); };
    const close = () => overlay.classList.remove('on');
    fab.onclick = open;
    $('dsvpn-x').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    window.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) { e.preventDefault(); overlay.classList.contains('on') ? close() : open(); } });

    // providers
    const provBox = $('dsvpn-providers');
    for (const p of PROVIDERS) {
      const c = document.createElement('div'); c.className = 'dsvpn-prov';
      c.innerHTML = `<div class="info">
          <div class="ttl">${p.name} <span class="dsvpn-tag">${p.tag}</span></div>
          <div class="hint">${p.hint}</div>
        </div>
        <button class="dsvpn-btn" data-url="${p.url}">Abrir login</button>`;
      provBox.appendChild(c);
    }
    provBox.addEventListener('click', async e => {
      const b = e.target.closest('button[data-url]'); if (!b) return;
      setStatus('info', 'Abrindo login (janela presa à Discord)… gere o WireGuard de um servidor FORA do BR.');
      try { const r = await api.openLogin(b.dataset.url); if (r && !r.ok) setStatus('err', '✗ ' + (r.error || 'falha ao abrir login')); }
      catch (err) { setStatus('err', '✗ ' + err.message); }
    });

    $('dsvpn-savecustom').onclick = async () => {
      const name = $('dsvpn-cname').value.trim() || 'custom';
      const content = $('dsvpn-paste').value;
      const r = await api.saveCustom(name, content);
      if (r && r.ok) { setStatus('ok', '✓ Config salvo: ' + name + '.conf'); $('dsvpn-paste').value = ''; }
      else setStatus('err', '✗ ' + ((r && r.error) || 'falha ao salvar'));
      refresh();
    };

    // the single ON/OFF toggle
    const toggle = $('dsvpn-toggle');
    toggle.onclick = async () => {
      if (toggle.classList.contains('busy') || toggle.classList.contains('disabled')) return;
      const on = engine.running && engine.active;
      toggle.classList.add('busy');
      if (on) { setStatus('info', 'Desligando o túnel… (o Discord recarrega e volta pro BR)'); await api.stopTunnel(); }
      else {
        if (!engine.ready) { setStatus('err', 'WireSock não instalado — rode o instalador.'); toggle.classList.remove('busy'); return; }
        const cfg = $('dsvpn-cfgsel').value || (configs[0] && configs[0].name);
        if (!cfg) { setStatus('err', 'Pegue um config primeiro.'); toggle.classList.remove('busy'); return; }
        setStatus('info', 'Conectando… (só na 1ª vez pede admin; o Discord recarrega ao aplicar)'); await api.startTunnel(cfg);
      }
      setTimeout(refresh, 3500);
    };

    let engine = {}, configs = [];
    async function refresh() {
      try { engine = (await api.status()) || {}; } catch (e) { engine = {}; }
      try { configs = (await api.listConfigs()) || []; } catch (e) { configs = []; }
      renderConfigSelect();
      updateHero();
      updateBadge();
    }

    function renderConfigSelect() {
      const sel = $('dsvpn-cfgsel');
      const prev = sel.value;
      sel.innerHTML = '';
      for (const c of configs) { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name + (c.endpoint ? '  (' + c.endpoint + ')' : ''); sel.appendChild(o); }
      // keep active config selected
      if (engine.active && configs.some(c => c.name === engine.active)) sel.value = engine.active;
      else if (prev && configs.some(c => c.name === prev)) sel.value = prev;
      sel.style.display = configs.length > 1 ? 'block' : 'none';
      sel.disabled = engine.running; // don't switch config while connected
    }

    function updateHero() {
      const dot = $('dsvpn-dot'), st = $('dsvpn-state'), sub = $('dsvpn-herosub');
      toggle.classList.remove('busy');
      const on = engine.running && engine.active;
      toggle.classList.toggle('on', !!on);
      if (on) {
        dot.style.background = '#57d98a'; st.textContent = 'Ligado';
        sub.textContent = engine.active + ' — só o Discord sai pelo túnel.';
        toggle.classList.remove('disabled');
      } else if (!engine.ready) {
        dot.style.background = '#ed6a5e'; st.textContent = 'WireSock não instalado';
        sub.textContent = 'Rode o instalador do DiscordShare.';
        toggle.classList.add('disabled');
      } else if (!configs.length) {
        dot.style.background = '#72767d'; st.textContent = 'Desligado';
        sub.textContent = 'Pegue um config abaixo pra poder ligar.';
        toggle.classList.add('disabled');
      } else {
        dot.style.background = '#72767d'; st.textContent = 'Desligado';
        sub.textContent = 'Discord está na sua região normal (BR).';
        toggle.classList.remove('disabled');
      }
    }

    async function updateBadge() {
      const badge = $('dsvpn-badge'); if (!badge) return;
      if (engine.running && engine.active) {
        badge.textContent = '● verificando saída…'; badge.style.color = '#f0b24a';
        try {
          const j = await (await fetch('https://ipinfo.io/json')).json();
          const us = j.country && j.country !== 'BR';
          badge.textContent = (us ? '🟢 ' : '🔴 ') + 'saída ' + (j.country || '?') + (j.city ? ' · ' + j.city : '');
          badge.style.color = us ? '#57d98a' : '#ed6a5e';
        } catch (e) { badge.textContent = '● túnel ligado'; badge.style.color = '#57d98a'; }
      } else { badge.textContent = '○ desligado (BR)'; badge.style.color = '#9a9ca1'; }
    }

    async function checkForUpdate() {
      const b = $('dsvpn-updbanner'); if (!b) return;
      try {
        const u = await api.checkUpdate();
        if (u && u.ok && u.available) {
          b.className = 'show';
          b.innerHTML = '<span class="txt">⬆ Atualização disponível: <b>v' + u.latest + '</b> (você tem v' + u.current + ')' + (u.notes ? ' — ' + u.notes : '') + '</span>';
          const btn = document.createElement('button'); btn.className = 'dsvpn-btn ok'; btn.textContent = 'Atualizar';
          btn.onclick = async () => {
            btn.disabled = true; setStatus('info', 'Baixando atualização… o Discord vai reiniciar.');
            const r = await api.applyUpdate();
            if (r && !r.ok) { setStatus('err', '✗ ' + r.error); btn.disabled = false; }
          };
          b.appendChild(btn);
        } else { b.className = ''; b.innerHTML = ''; }
      } catch (e) {}
    }

    api.onEvent(m => {
      if (!m) return;
      if (m.type === 'update' && m.state === 'applied') { setStatus('ok', '✓ Atualizado para v' + m.version + ' — reiniciando o Discord…'); return; }
      if (m.type === 'downloading') setStatus('info', 'Baixando ' + m.filename + '…');
      else if (m.type === 'captured') { setStatus('ok', '✓ Config capturado: ' + m.filename); refresh(); }
      else if (m.type === 'error') setStatus('err', '✗ ' + m.message);
      else if (m.type === 'configs') { configs = m.files || []; renderConfigSelect(); updateHero(); }
      else if (m.type === 'tunnel') {
        if (m.state === 'connecting') setStatus('info', 'Conectando o túnel…');
        else if (m.state === 'up') setStatus('ok', '✓ Ligado: ' + m.name + ' — recarregando o Discord pra aplicar…');
        else if (m.state === 'down') setStatus('info', 'Desligado — recarregando o Discord (volta pro BR)…');
        else if (m.state === 'error') setStatus('err', '✗ Túnel: ' + m.message);
        refresh();
      }
    });

    console.log('[ds-vpn] panel ready (Ctrl+Shift+V)');
  } // init
  if (document.body) init(); else window.addEventListener('DOMContentLoaded', init);
})();
