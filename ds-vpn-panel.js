// DiscordShare VPN — injected into Discord's renderer (main world).
// Lives INSIDE Discord Settings as a "DiscordVPN" tab (after Voice & Video). No floating button.
// Layout mirrors native settings pages: centered 696px column, flat sections, dividers.
(function () {
  function init() {
    const api = window.__dsVPN;
    if (!api) { return setTimeout(init, 300); }
    if (window.__dsVpnPanel) return; window.__dsVpnPanel = 1;

    const PROVIDERS = [
      { id: 'proton', name: 'Proton VPN', tag: 'Grátis · gera o config sozinho', url: 'https://account.protonvpn.com/downloads', domain: 'protonvpn.com' },
      { id: 'windscribe', name: 'Windscribe', tag: 'Grátis · 10 GB/mês', url: 'https://windscribe.com/configgenerator', domain: 'windscribe.com' },
      { id: 'mullvad', name: 'Mullvad', tag: 'Pago', url: 'https://mullvad.net/en/account', domain: 'mullvad.net' },
    ];
    const DATA_ID = 'settings-sidebar___dsvpn_panel';
    const ICON = '<path fill="currentColor" d="M12 2 4 4.9v5.8c0 4.9 3.4 8.8 8 11.3 4.6-2.5 8-6.4 8-11.3V4.9L12 2Zm0 2.1 6 2.2v4.4c0 3.8-2.5 7-6 9.1-3.5-2.1-6-5.3-6-9.1V6.3l6-2.2Z"/>';
    const fav = d => 'https://www.google.com/s2/favicons?domain=' + d + '&sz=64';

    // styles copied from native settings pages (24px/500 section title, 16px/500 field label, centered 696 column)
    const css = `
    .dsvpn-scroll{height:100%;overflow-y:auto;overflow-x:hidden}
    .dsvpn-scroll::-webkit-scrollbar{width:8px}
    .dsvpn-scroll::-webkit-scrollbar-thumb{background:var(--scrollbar-thin-thumb,rgba(128,128,128,.35));border-radius:4px}
    .dsvpn-scroll::-webkit-scrollbar-track{background:transparent}
    .dsvpn-root{max-width:728px;margin:0 auto;padding:4px 16px 80px;color:var(--header-primary)}
    .dsvpn-st{font-size:24px;font-weight:600;color:var(--header-primary);margin:30px 0 18px;line-height:1.25}
    .dsvpn-st:first-child{margin-top:0}
    .dsvpn-div{height:1px;background:var(--background-modifier-accent);margin:24px 0}
    .dsvpn-row{display:flex;align-items:center;gap:16px}
    .dsvpn-row .rl{flex:1;min-width:0}
    .dsvpn-rt{font-size:16px;font-weight:500;color:var(--header-primary)}
    .dsvpn-rd{font-size:14px;color:var(--text-muted);margin-top:4px;line-height:1.3}
    .dsvpn-field{margin-top:16px}
    .dsvpn-fl{font-size:16px;font-weight:500;color:var(--header-primary);margin-bottom:8px}
    .dsvpn-pd{font-size:14px;color:var(--text-muted);margin:0 0 12px;line-height:1.35}
    .dsvpn-sw{position:relative;width:48px;height:28px;cursor:pointer;flex:0 0 auto}
    .dsvpn-sw .tr{position:absolute;inset:0;background:var(--background-tertiary);border-radius:14px;transition:.15s}
    .dsvpn-sw .th{position:absolute;top:3px;left:3px;width:22px;height:22px;background:#fff;border-radius:50%;transition:.15s;box-shadow:0 2px 3px rgba(0,0,0,.25)}
    .dsvpn-sw.on .tr{background:#23a55a}
    .dsvpn-sw.on .th{left:23px}
    .dsvpn-sw.disabled{opacity:.4;pointer-events:none}
    .dsvpn-in{width:100%;background:var(--input-background,var(--background-tertiary));color:var(--header-primary);border:1px solid var(--border-subtle,var(--background-modifier-accent));border-radius:8px;padding:10px 12px;font-size:15px}
    .dsvpn-dd-wrap{position:relative}
    .dsvpn-dd{display:flex;align-items:center;gap:8px;background:var(--input-background,var(--background-tertiary));border:1px solid var(--border-subtle,var(--background-modifier-accent));border-radius:8px;padding:10px 12px;font-size:15px;color:var(--header-primary);cursor:pointer;user-select:none}
    .dsvpn-dd .val{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dsvpn-dd .chev{color:var(--interactive-normal,var(--text-muted));transition:transform .15s;flex:0 0 auto}
    .dsvpn-dd.open .chev{transform:rotate(180deg)}
    .dsvpn-dd.disabled{opacity:.5;pointer-events:none}
    .dsvpn-dd-menu{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--background-floating,#111214);border:1px solid var(--border-subtle,rgba(0,0,0,.3));border-radius:8px;box-shadow:var(--elevation-high,0 8px 16px rgba(0,0,0,.24));padding:6px;z-index:1000;max-height:260px;overflow-y:auto}
    .dsvpn-dd-menu.open{display:block}
    .dsvpn-dd-opt{padding:9px 10px;border-radius:4px;font-size:15px;color:var(--text-default,var(--text-normal));cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dsvpn-dd-opt:hover{background:var(--background-modifier-hover,rgba(128,128,128,.12))}
    .dsvpn-dd-opt.sel{background:var(--background-modifier-selected,rgba(128,128,128,.2));color:var(--header-primary)}
    .dsvpn-dd-menu::-webkit-scrollbar{width:8px}.dsvpn-dd-menu::-webkit-scrollbar-thumb{background:var(--scrollbar-thin-thumb,rgba(128,128,128,.35));border-radius:4px}
    .dsvpn-ta{width:100%;min-height:92px;background:var(--input-background,var(--background-tertiary));color:var(--header-primary);border:1px solid var(--border-subtle,var(--background-modifier-accent));border-radius:8px;padding:10px;font:12px/1.45 var(--font-code,ui-monospace,monospace);resize:vertical}
    .dsvpn-prov{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--background-modifier-accent)}
    .dsvpn-prov:first-child{border-top:0;padding-top:4px}
    .dsvpn-prov .lg{width:36px;height:36px;border-radius:9px;overflow:hidden;flex:0 0 auto;background:var(--background-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--text-muted)}
    .dsvpn-prov .lg img{width:36px;height:36px}
    .dsvpn-prov .info{flex:1;min-width:0}
    .dsvpn-prov .nm{font-size:16px;font-weight:500;color:var(--header-primary)}
    .dsvpn-prov .tg{font-size:14px;color:var(--text-muted);margin-top:2px}
    .dsvpn-btn{background:var(--brand-500,#5865f2);color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:500;cursor:pointer;flex:0 0 auto;transition:background .15s}
    .dsvpn-btn:hover{background:var(--brand-560,#4752c4)}
    .dsvpn-btn.pos{background:#248046}.dsvpn-btn.pos:hover{background:#1a6334}
    .dsvpn-btn.danger{background:var(--button-danger-background,#da373c)}.dsvpn-btn.danger:hover{background:#a12828}
    .dsvpn-btn2{background:var(--button-secondary-background,#4e5058);color:var(--text-default,var(--header-primary));border:0;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:500;cursor:pointer}
    .dsvpn-btn2:hover{background:var(--button-secondary-background-hover,#6d6f78)}
    .dsvpn-upd{display:none;align-items:center;gap:14px;background:var(--background-secondary);border:1px solid var(--brand-500,#5865f2);border-radius:8px;padding:14px 16px;margin-top:16px}
    .dsvpn-upd.show{display:flex}
    .dsvpn-upd .txt{flex:1;font-size:15px;color:var(--header-primary)}
    .dsvpn-status{font-size:14px;color:var(--text-muted);min-height:18px;margin-top:14px}
    .dsvpn-status.ok{color:var(--text-positive,#2dc770)}.dsvpn-status.err{color:var(--text-danger,#f23f43)}.dsvpn-status.info{color:var(--text-warning,#f0b24a)}
    .dsvpn-vf{font-size:12px;color:var(--text-muted);margin-top:24px}
    .dsvpn-det summary{cursor:pointer;font-size:14px;color:var(--text-link,#00a8fc);list-style:none;user-select:none;display:inline-flex;align-items:center;gap:6px}
    .dsvpn-det summary::-webkit-details-marker{display:none}
    .dsvpn-det summary::before{content:'▸';font-size:10px}
    .dsvpn-det[open] summary::before{content:'▾'}
    `;
    const style = document.createElement('style'); style.id = 'dsvpn-style'; style.textContent = css; document.documentElement.appendChild(style);

    // ---------- settings-tab integration ----------
    const getLayer = () => [...document.querySelectorAll('[class*="layer_"]')].pop();
    const findVoice = layer => [...layer.querySelectorAll('[data-list-item-id]')].find(e => /voice_and_video/i.test(e.getAttribute('data-list-item-id') || '') || /voz e v|voice *& *v/i.test(e.textContent || ''));
    const getContent = layer => layer.querySelector('[class*="contentBody_"]') || layer.querySelector('[class*="content_"]');

    let contentEl = null, built = false, activeCls = '';

    function injectTab(layer) {
      if (!layer || layer.querySelector('[data-list-item-id="' + DATA_ID + '"]')) return;
      const voz = findVoice(layer); if (!voz) return;
      const vozLi = voz.closest('li'); if (!vozLi || !vozLi.parentElement) return;
      const itemCls = (voz.className.split(' ').find(c => /^item_/.test(c))) || '';
      activeCls = itemCls ? 'active_' + itemCls.split('_')[1] : '';
      const li = vozLi.cloneNode(true);
      const item = li.querySelector('[class*="item_"]') || li.firstElementChild;
      // drop the cloned sub-navigation (Voice/Camera/Streaming… inherited from Voice & Video)
      [...li.children].forEach(c => { if (c !== item && !c.contains(item)) c.remove(); });
      if (activeCls) item.classList.remove(activeCls);
      item.setAttribute('data-list-item-id', DATA_ID);
      const svg = item.querySelector('svg'); if (svg) { svg.setAttribute('viewBox', '0 0 24 24'); svg.innerHTML = ICON; }
      const txt = item.querySelector('[class*="text-"]') || [...item.querySelectorAll('div')].find(d => d.children.length === 0 && d.textContent.trim());
      if (txt) txt.textContent = 'DiscordVPN';
      [...li.querySelectorAll('[class*="badge"]')].forEach(b => b.remove());
      vozLi.after(li);
      item.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); activate(layer, item); });
      [...layer.querySelectorAll('[data-list-item-id]')].forEach(t => {
        if (t.getAttribute('data-list-item-id') !== DATA_ID) t.addEventListener('click', () => setTimeout(() => deactivate(item), 0), true);
      });
    }

    function setHeaderTitle(content) {
      try {
        const col = content.parentElement;
        const hdr = col && col.querySelector('[class*="contentHeader_"]');
        if (!hdr) return;
        const tl = [...hdr.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() && !e.querySelector('svg'));
        if (tl && tl.textContent !== 'DiscordVPN') tl.textContent = 'DiscordVPN';
      } catch (e) {}
    }

    function activate(layer, item) {
      [...layer.querySelectorAll('[data-list-item-id]')].forEach(t => { if (activeCls) t.classList.remove(activeCls); });
      if (activeCls) item.classList.add(activeCls);
      const content = getContent(layer); if (!content) return;
      if (!contentEl || !content.contains(contentEl)) { contentEl = document.createElement('div'); contentEl.className = 'dsvpn-scroll'; built = false; content.appendChild(contentEl); }
      [...content.children].forEach(c => { if (c !== contentEl) c.style.display = 'none'; });
      contentEl.style.display = 'block';
      setHeaderTitle(content);
      if (!built) { buildUI(contentEl); built = true; }
      refresh(); checkForUpdate();
    }
    function deactivate(item) {
      if (activeCls && item) item.classList.remove(activeCls);
      const layer = getLayer(); if (!layer) return;
      const content = getContent(layer); if (!content) return;
      [...content.children].forEach(c => { if (c === contentEl) c.style.display = 'none'; else c.style.display = ''; });
    }

    const obs = new MutationObserver(() => { const l = getLayer(); if (l && findVoice(l)) injectTab(l); });
    obs.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) { e.preventDefault(); openOurTab(); } });
    function openOurTab() {
      const go = () => { const l = getLayer(); if (l && findVoice(l)) { injectTab(l); const t = l.querySelector('[data-list-item-id="' + DATA_ID + '"]'); if (t) t.click(); } };
      const l = getLayer();
      if (l && findVoice(l)) return go();
      const gear = document.querySelector('button[aria-label="User Settings"],button[aria-label*="Configura" i]');
      if (gear) { gear.click(); setTimeout(go, 600); }
    }

    // ---------- UI ----------
    const $ = id => contentEl && contentEl.querySelector('#' + id);
    const setStatus = (k, m) => { const s = $('dsvpn-status'); if (s) { s.className = 'dsvpn-status ' + (k || ''); s.textContent = m || ''; } };
    let engine = {}, configs = [], selectedConfig = null;

    function buildUI(root) {
      root.innerHTML = `<div class="dsvpn-root">
        <div class="dsvpn-upd" id="dsvpn-upd"></div>

        <div class="dsvpn-st">Conexão</div>
        <div class="dsvpn-row">
          <div class="rl"><div class="dsvpn-rt">Túnel VPN</div><div class="dsvpn-rd" id="dsvpn-sub">—</div></div>
          <button class="dsvpn-btn" id="dsvpn-wsinstall" style="display:none">Instalar WireSock</button>
          <div class="dsvpn-sw disabled" id="dsvpn-sw"><div class="tr"></div><div class="th"></div></div>
        </div>
        <div class="dsvpn-field">
          <div class="dsvpn-fl">Servidor</div>
          <div class="dsvpn-dd-wrap">
            <div class="dsvpn-dd" id="dsvpn-dd"><span class="val" id="dsvpn-ddval">—</span><svg class="chev" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M5.3 8.3a1 1 0 0 1 1.4 0L12 13.58l5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.42 0l-6-6a1 1 0 0 1 0-1.42Z"/></svg></div>
            <div class="dsvpn-dd-menu" id="dsvpn-ddmenu"></div>
          </div>
        </div>

        <div class="dsvpn-div"></div>

        <div class="dsvpn-st">Provedores de config</div>
        <div class="dsvpn-pd">Logue num provedor e gere um WireGuard de um servidor fora do Brasil. O Proton gera e captura sozinho.</div>
        <div id="dsvpn-provs"></div>

        <div class="dsvpn-div"></div>

        <div class="dsvpn-st">Config próprio</div>
        <div class="dsvpn-pd">Tem um WireGuard de outro provedor ou servidor próprio? Cole o .conf aqui.</div>
        <button class="dsvpn-btn2" id="dsvpn-pastetoggle">Colar um .conf</button>
        <div id="dsvpn-pastebox" style="display:none">
          <div class="dsvpn-field"><div class="dsvpn-fl">Nome</div><input class="dsvpn-in" id="dsvpn-cname" placeholder="ex.: meu-us"></div>
          <div class="dsvpn-field"><div class="dsvpn-fl">Conteúdo do .conf</div><textarea class="dsvpn-ta" id="dsvpn-ta" placeholder="[Interface]&#10;PrivateKey = ...&#10;Address = ...&#10;&#10;[Peer]&#10;PublicKey = ...&#10;Endpoint = 1.2.3.4:51820"></textarea></div>
          <div style="margin-top:12px"><button class="dsvpn-btn pos" id="dsvpn-save">Salvar config</button></div>
        </div>

        <div class="dsvpn-div"></div>

        <div class="dsvpn-row">
          <div class="rl"><div class="dsvpn-rt">Desinstalar o DiscordVPN</div><div class="dsvpn-rd">Reverte o Discord ao normal e remove o túnel.</div></div>
          <button class="dsvpn-btn danger" id="dsvpn-unins">Desinstalar</button>
        </div>

        <div class="dsvpn-status" id="dsvpn-status"></div>
        <div class="dsvpn-vf" id="dsvpn-verfoot"></div>
      </div>`;

      const pbox = $('dsvpn-provs');
      for (const p of PROVIDERS) {
        const row = document.createElement('div'); row.className = 'dsvpn-prov';
        row.innerHTML = `<div class="lg"><img src="${fav(p.domain)}" onerror="this.style.display='none';this.parentNode.textContent='${p.name[0]}'"></div>
          <div class="info"><div class="nm">${p.name}</div><div class="tg">${p.tag}</div></div>
          <button class="dsvpn-btn" data-url="${p.url}">Abrir login</button>`;
        pbox.appendChild(row);
      }
      pbox.addEventListener('click', async e => {
        const b = e.target.closest('button[data-url]'); if (!b) return;
        const isProton = b.dataset.url.includes('proton');
        setStatus('info', isProton ? 'Faça o login no Proton — eu gero o config sozinho.' : 'Gere um WireGuard de servidor fora do BR.');
        try { const r = await api.openLogin(b.dataset.url); if (r && !r.ok) setStatus('err', r.error || 'falha ao abrir'); } catch (err) { setStatus('err', err.message); }
      });

      const dd = $('dsvpn-dd'), menu = $('dsvpn-ddmenu');
      dd.onclick = e => { e.stopPropagation(); if (dd.classList.contains('disabled')) return; const o = !menu.classList.contains('open'); menu.classList.toggle('open', o); dd.classList.toggle('open', o); };
      if (!window.__dsVpnDocClick) { window.__dsVpnDocClick = 1; document.addEventListener('click', e => { if (!contentEl) return; if (!e.target.closest('.dsvpn-dd-wrap')) { const m = contentEl.querySelector('.dsvpn-dd-menu'), d = contentEl.querySelector('.dsvpn-dd'); if (m) m.classList.remove('open'); if (d) d.classList.remove('open'); } }); }

      const wsi = $('dsvpn-wsinstall');
      if (wsi) wsi.onclick = async () => { wsi.disabled = true; setStatus('info', 'Instalando WireSock… aprove o UAC que vai aparecer.'); const r = await api.installWireSock(); if (r && r.already) { setStatus('ok', 'WireSock já está instalado.'); refresh(); } else if (r && !r.ok) { setStatus('err', r.error); wsi.disabled = false; } };

      const sw = $('dsvpn-sw');
      sw.onclick = async () => {
        if (sw.classList.contains('busy') || sw.classList.contains('disabled')) return;
        const on = engine.running && engine.active; sw.classList.add('busy');
        if (on) { setStatus('info', 'Desligando… o Discord recarrega.'); await api.stopTunnel(); }
        else {
          const cfg = selectedConfig || (configs[0] && configs[0].name);
          if (!cfg) { setStatus('err', 'Pegue um config primeiro.'); sw.classList.remove('busy'); return; }
          setStatus('info', 'Conectando… (admin só na 1ª vez; o Discord recarrega).'); await api.startTunnel(cfg);
        }
        setTimeout(refresh, 3500);
      };

      const pt = $('dsvpn-pastetoggle'), pb = $('dsvpn-pastebox');
      if (pt) pt.onclick = () => { pb.style.display = 'block'; pt.style.display = 'none'; };

      $('dsvpn-save').onclick = async () => {
        const r = await api.saveCustom($('dsvpn-cname').value.trim() || 'custom', $('dsvpn-ta').value);
        if (r && r.ok) { setStatus('ok', 'Config salvo.'); $('dsvpn-ta').value = ''; } else setStatus('err', (r && r.error) || 'falha');
        refresh();
      };

      const un = $('dsvpn-unins'); let armed = false;
      un.onclick = async () => {
        if (!armed) { armed = true; un.textContent = 'Confirmar?'; setTimeout(() => { armed = false; un.textContent = 'Desinstalar'; }, 4000); return; }
        setStatus('info', 'Abrindo o desinstalador…'); const r = await api.uninstall(); if (r && !r.ok) setStatus('err', r.error || 'falha');
      };

      api.onEvent(onEvent);
      api.version().then(v => { const b = $('dsvpn-verfoot'); if (b) b.textContent = 'DiscordVPN v' + v; });
    }

    async function refresh() {
      if (!contentEl) return;
      try { engine = (await api.status()) || {}; } catch (e) { engine = {}; }
      try { configs = (await api.listConfigs()) || []; } catch (e) { configs = []; }
      renderDropdown(); updateHero();
    }
    function renderDropdown() {
      const val = $('dsvpn-ddval'), menu = $('dsvpn-ddmenu'), dd = $('dsvpn-dd'); if (!val || !menu) return;
      if (engine.active && configs.some(c => c.name === engine.active)) selectedConfig = engine.active;
      else if (!selectedConfig || !configs.some(c => c.name === selectedConfig)) selectedConfig = configs[0] ? configs[0].name : null;
      const cur = configs.find(c => c.name === selectedConfig);
      val.textContent = cur ? (cur.name + (cur.endpoint ? '  ·  ' + cur.endpoint : '')) : 'Nenhum config — pegue um abaixo';
      if (dd) dd.classList.toggle('disabled', !configs.length);
      menu.innerHTML = '';
      for (const c of configs) {
        const o = document.createElement('div');
        o.className = 'dsvpn-dd-opt' + (c.name === selectedConfig ? ' sel' : '');
        o.textContent = c.name + (c.endpoint ? '  ·  ' + c.endpoint : '');
        o.onclick = () => pickConfig(c.name);
        menu.appendChild(o);
      }
    }
    async function pickConfig(name) {
      selectedConfig = name;
      const menu = $('dsvpn-ddmenu'), dd = $('dsvpn-dd'); if (menu) menu.classList.remove('open'); if (dd) dd.classList.remove('open');
      renderDropdown();
      if (engine.running && engine.active && name !== engine.active) {
        const s = $('dsvpn-sw'); if (s) s.classList.add('busy');
        setStatus('info', 'Trocando de servidor… o Discord recarrega.');
        await api.startTunnel(name);
        setTimeout(refresh, 3500);
      }
    }
    async function updateHero() {
      const sub = $('dsvpn-sub'), sw = $('dsvpn-sw'), wsi = $('dsvpn-wsinstall'); if (!sw) return;
      const on = engine.running && engine.active;
      sw.classList.remove('busy'); sw.classList.toggle('on', !!on);
      if (wsi) { const missing = !engine.ready; wsi.style.display = missing ? '' : 'none'; sw.style.display = missing ? 'none' : ''; }
      if (on) {
        sw.classList.remove('disabled'); sub.textContent = 'Ligado — verificando saída…';
        try { const j = await (await fetch('https://ipinfo.io/json')).json(); sub.textContent = 'Ligado · saída ' + (j.country || '?') + (j.city ? ' · ' + j.city : '') + ' — só o Discord.'; }
        catch (e) { sub.textContent = 'Ligado — só o Discord sai pelo túnel.'; }
      } else if (!engine.ready) { sw.classList.add('disabled'); sub.textContent = 'WireSock não instalado — rode o instalador.'; }
      else if (!configs.length) { sw.classList.add('disabled'); sub.textContent = 'Pegue um config abaixo pra poder ligar.'; }
      else { sw.classList.remove('disabled'); sub.textContent = 'Desligado — Discord na sua região normal (BR).'; }
    }
    async function checkForUpdate() {
      const b = $('dsvpn-upd'); if (!b) return;
      try {
        const u = await api.checkUpdate();
        if (u && u.ok && u.available) {
          b.classList.add('show');
          b.innerHTML = '<span class="txt">Atualização disponível: <b>v' + u.latest + '</b>' + (u.notes ? ' — ' + u.notes : '') + '</span>';
          const btn = document.createElement('button'); btn.className = 'dsvpn-btn'; btn.textContent = 'Atualizar';
          btn.onclick = async () => { btn.disabled = true; setStatus('info', 'Baixando… o Discord reinicia.'); const r = await api.applyUpdate(); if (r && !r.ok) { setStatus('err', r.error); btn.disabled = false; } };
          b.appendChild(btn);
        } else b.classList.remove('show');
      } catch (e) {}
    }
    function onEvent(m) {
      if (!m || !contentEl) return;
      if (m.type === 'update' && m.state === 'applied') return setStatus('ok', 'Atualizado para v' + m.version + ' — reiniciando…');
      if (m.type === 'wiresock') {
        if (m.state === 'installing') setStatus('info', 'Instalando WireSock…');
        else if (m.state === 'ok') { setStatus('ok', 'WireSock instalado! Já pode ligar.'); refresh(); }
        else if (m.state === 'fail') { setStatus('err', 'Falha ao instalar. Instale manual em wiresock.net e recarregue.'); const w = $('dsvpn-wsinstall'); if (w) w.disabled = false; }
        return;
      }
      if (m.type === 'autogen') {
        if (m.state === 'running') setStatus('info', 'Logado! Gerando o config automaticamente…');
        else if (m.state === 'ok') setStatus('ok', 'Config gerado e capturado automaticamente.');
        else if (m.state === 'manual') setStatus('info', 'Faça o login no Proton; ao logar eu gero o config.');
        return;
      }
      if (m.type === 'downloading') setStatus('info', 'Baixando ' + m.filename + '…');
      else if (m.type === 'captured') { setStatus('ok', 'Config capturado: ' + m.filename); refresh(); }
      else if (m.type === 'error') setStatus('err', m.message);
      else if (m.type === 'configs') { configs = m.files || []; renderDropdown(); updateHero(); }
      else if (m.type === 'tunnel') {
        if (m.state === 'connecting') setStatus('info', 'Conectando…');
        else if (m.state === 'up') setStatus('ok', 'Ligado — recarregando o Discord…');
        else if (m.state === 'down') setStatus('info', 'Desligado — recarregando o Discord…');
        else if (m.state === 'error') setStatus('err', m.message);
        refresh();
      }
    }

    console.log('[ds-vpn] settings tab ready (Ctrl+Shift+V)');
  } // init
  if (document.body) init(); else window.addEventListener('DOMContentLoaded', init);
})();
