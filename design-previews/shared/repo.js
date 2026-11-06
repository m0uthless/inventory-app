/* Site Repository: tre proposte (A · Albero, B · Mappa, C · Colonne) sullo stile
   "Campo sterile". Territorio come asse principale, ricerca puntuale con
   risultati e percorso, credenziali solo nel pannello dell'inventario.
   Dati fittizi. Oggi: 05/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G = window.ITALY;

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Site Repository') || a.textContent.trim().startsWith('Repository');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Dati ──────────────────────────────────────────────────────────
  const VEN = { Philips: '#3f7fbf', Biotron: '#2e8b6e', 'Medical Imaging': '#b4673a' };
  // Categorie di asset con un colore di riconoscimento (tinte calme: il rosso resta per guasti e criticità).
  const TYPES = {
    pacs: ['PACS', 'server', '#3f7fbf'], ris: ['RIS', 'file', '#7a5bb8'], vna: ['VNA', 'layers', '#2e8b8b'], ws: ['Workstation', 'monitor', '#5b6f86'],
    mod: ['Modalità', 'activity', '#b4673a'], mgmt: ['Management', 'wrench', '#4a58a6'], net: ['Router VPN', 'cloud', '#2f8fa8'], vue: ['Vue Motion', 'eye', '#6f8a3a'],
  };
  const typeTile = (t) => `<span class="r-ti r-tc" style="--tc:${TYPES[t][2]}" title="${TYPES[t][0]}">${ic(TYPES[t][1])}</span>`;
  const typeDots = (as) => { const ks = [...new Set(as.map((a) => a.t))]; return `<span class="r-tdots" aria-label="Categorie: ${ks.map((k) => TYPES[k][0]).join(', ')}">${ks.map((k) => `<i style="--tc:${TYPES[k][2]}" title="${TYPES[k][0]}"></i>`).join('')}</span>`; };
  const ST = { in_use: 'In uso', to_install: 'Da installare', maintenance: 'In manutenzione', repair: 'Guasto', retired: 'Dismesso' };
  // [nome, provincia, città, vendor, contatto, telefono, VPN, siti: [nome, indirizzo, stato, asset: [tipo, nome, host, ip, stato, issuePrio]]]
  const RAW = [
    ['AUSL Bologna', 'BO', 'Bologna', 'Philips', 'Massimo Romanelli', '051 6584 210', true, [
      ['Ospedale Maggiore', 'Largo Nigrisoli 2', 'active', [['pacs', 'PACS nodo 1', 'aubmpacs01', '10.20.5.10', 'in_use', 'high'], ['pacs', 'PACS nodo 2', 'aubmpacs02', '10.20.5.11', 'in_use'], ['ris', 'RIS application', 'aubmris01', '10.20.5.21', 'in_use'], ['mod', 'RM 1,5 T Ingenia', 'ingenia15', '10.20.40.11', 'in_use'], ['ws', 'Workstation 3D', 'aubmws3d', '10.20.60.7', 'in_use'], ['ws', 'Refertazione 4', 'aubmwkr204', '10.20.60.14', 'maintenance']]],
      ['Ospedale Bellaria', 'Via Altura 3', 'active', [['mod', 'CT Incisive', 'belct01', '10.21.30.4', 'in_use', 'medium'], ['ws', 'RIS client sala 2', 'belws02', '10.21.60.2', 'in_use'], ['ws', 'Refertazione neuro', 'belwkr01', '10.21.60.9', 'in_use']]],
      ['Bazzano', 'Via Cilea 16', 'closed', [['mgmt', 'Management 2', 'bazmgmt', '10.22.1.2', 'in_use'], ['ws', 'Sala refertazione', 'bazws1', '10.0.0.1', 'in_use'], ['vue', 'Vue Motion', 'bazvue', '', 'to_install']]],
      ['Porretta', 'Via dai Coglioni 12', 'active', [['ws', 'AUB04WKR201', 'aub04wkr201', '', 'in_use'], ['ws', 'AUB04WKR202', 'aub04wkr202', '', 'in_use'], ['ws', 'AUB04WKRMAN', 'aub04wkrman', '', 'retired']]],
    ]],
    ['IRCCS Rizzoli', 'BO', 'Bologna', 'Biotron', 'Marco Neri', '051 6366 044', true, [
      ['Rizzoli sede', 'Via di Barbiano 1/10', 'active', [['pacs', 'PACS ortopedia', 'iorpacs', '10.30.2.10', 'in_use'], ['net', 'Router teleradiologia', 'iorvpn', '10.30.0.1', 'in_use'], ['ws', 'Refertazione notturna', 'iorws07', '10.30.6.7', 'in_use']]],
    ]],
    ['AUSL Ferrara', 'FE', 'Ferrara', 'Philips', 'Elena Mori', '0532 235 671', true, [
      ['Ospedale di Cona', 'Via A. Moro 8', 'active', [['pacs', 'PACS Cona', 'conapacs', '10.50.2.10', 'in_use'], ['ris', 'RIS Ferrara', 'feris01', '10.50.2.21', 'in_use', 'critical'], ['ws', 'Refertazione 1', 'conaws01', '10.50.6.1', 'repair']]],
      ['Ospedale del Delta', 'Via Valle Oppio 2, Lagosanto', 'active', [['mod', 'CR Fuji', 'deltacr', '10.51.20.3', 'in_use']]],
    ]],
    ['AUSL Romagna', 'RA', 'Ravenna', 'Philips', 'Chiara Bassi', '0544 285 112', true, [
      ['Ospedale di Ravenna', 'Viale Randi 5', 'active', [['vna', 'VNA area vasta', 'romvna01', '10.70.1.30', 'in_use'], ['pacs', 'PACS Ravenna', 'rapacs', '10.70.2.10', 'in_use'], ['ws', 'Refertazione 2', 'raws02', '10.70.6.2', 'in_use']]],
      ['Ospedale di Lugo', 'Viale Masi 20', 'active', [['mod', 'Mammografo', 'lugomam', '10.71.10.8', 'in_use']]],
      ['Ospedale di Faenza', 'Viale Stradone 9', 'active', [['ws', 'Refertazione Faenza', 'faews1', '', 'in_use'], ['mod', 'DR telecomandato', 'faedr', '10.72.10.5', 'in_use']]],
    ]],
    ['Casa di Cura Rocca', 'PC', 'Piacenza', 'Medical Imaging', 'Paolo Ferri', '0523 712 900', false, [
      ['Sede', 'Via Emilia Pavese 115', 'active', [['pacs', 'Mini PACS', 'roccapacs', '192.168.10.5', 'in_use'], ['ws', 'Refertazione', 'roccaws', '192.168.10.20', 'in_use']]],
    ]],
    ['Centro Diagnostico Valli', 'MO', 'Sassuolo', 'Medical Imaging', 'Andrea Lodi', '0536 801 233', false, [
      ['Sassuolo', 'Via Circonvallazione 45', 'active', [['mod', 'TC multistrato', 'vallitc', '192.168.1.40', 'in_use']]],
    ]],
    ['ASUFC Udine', 'UD', 'Udine', 'Biotron', 'Giulia Zanin', '0432 552 761', true, [
      ['S. Maria della Misericordia', 'Piazzale S. M. della Misericordia 15', 'active', [['pacs', 'PACS Udine', 'udpacs01', '10.80.2.10', 'in_use'], ['ris', 'RIS Udine', 'udris01', '10.80.2.21', 'in_use', 'low'], ['vna', 'VNA Friuli', 'udvna', '10.80.1.30', 'in_use'], ['ws', 'Dose SR gateway', 'uddose', '10.80.3.4', 'to_install']]],
      ['Ospedale di Palmanova', 'Via Natisone', 'active', [['ws', 'Refertazione Palmanova', 'palmws1', '10.81.6.1', 'in_use']]],
    ]],
    ['Poliambulatorio Manzano', 'UD', 'Manzano', 'Biotron', '', '', false, [
      ['Manzano', 'Via Roma 12', 'active', [['ws', 'Workstation', 'manzws', '', 'in_use']]],
    ]],
    ['Centro Medico Esperia', 'PN', 'Pordenone', 'Biotron', 'Laura Marasti', '0434 551 220', false, [
      ['Esperia', 'Via Montereale 24', 'active', [['vna', 'VNA Esperia', 'espvna', '10.90.1.30', 'in_use'], ['ws', 'Refertazione', 'espws1', '10.90.6.1', 'in_use']]],
    ]],
    ['AOUI Verona', 'VR', 'Verona', 'Philips', 'Stefano Righetti', '045 812 1111', true, [
      ['Borgo Trento', 'Piazzale Stefani 1', 'active', [['pacs', 'PACS Borgo Trento', 'vrpacs', '10.60.2.10', 'in_use'], ['ris', 'RIS Verona', 'vrris', '10.60.2.21', 'in_use']]],
    ]],
    ['Studio Radiologico Centro', '', '', 'Medical Imaging', '', '', false, [
      ['Studio', '', 'active', [['ws', 'Workstation', 'srcws', '', 'in_use']]],
    ]],
  ];
  let invId = 1000; let siteId = 1;
  const CUST = RAW.map(([name, prov, city, ven, contact, phone, vpn, sites], i) => ({
    id: i + 1, name, prov, city, ven, contact, phone, vpn, code: 'C-' + String(i + 17).padStart(6, '0'),
    sites: sites.map(([sname, addr, st, assets]) => ({
      id: siteId++, name: sname, addr, st,
      assets: assets.map(([t, n, host, ip, s, prio]) => ({ id: invId++, t, name: n, host, ip, st: s, prio: prio || null, kn: 'K' + (100000 + invId * 37).toString().slice(-6), srsa: ip && ['pacs', 'ris', 'vna', 'mgmt', 'net'].includes(t) ? ip.replace(/^(10|192)\.\d+/, '172.16') : '' })),
    })),
  }));
  CUST.forEach((c) => c.sites.forEach((s) => { s.c = c; s.assets.forEach((a) => { a.s = s; a.c = c; }); }));
  const ALL_SITES = CUST.flatMap((c) => c.sites);
  const ALL_ASSETS = ALL_SITES.flatMap((s) => s.assets);
  const assetsOf = (c) => c.sites.reduce((n, s) => n + s.assets.length, 0);
  const issuesOf = (list) => list.filter((a) => a.prio).length;
  const provName = (p) => (p ? `${G.provinceNames[p] ?? p}` : 'Senza provincia');
  const regionOf = (p) => G.provinceToRegion[p] || null;
  const regionName = (id) => G.regions.find((r) => r.id === id)?.name ?? '';

  // ── Stato pagina ──────────────────────────────────────────────────
  let variant = 'a'; let group = 'prov'; let q = ''; let selected = null;
  const openProv = new Set(['BO']); const openCust = new Set([1]); const openSite = new Set([1]);
  let bProv = null; let bRegion = null; const bOpen = new Set(); const bCust = new Set(); const bSite = new Set(); // B: all'apertura Italia + tutte le province
  let cProv = 'BO'; let cCust = 1; let cSite = 1;

  // ── Elementi comuni ──────────────────────────────────────────────
  const venDot = (v) => `<span class="cmt"><span class="dot" style="background:${VEN[v]}"></span>${esc(v)}</span>`;
  const MARK = {
    in_use: '<circle cx="6" cy="6" r="4" fill="currentColor"/>',
    to_install: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    maintenance: '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor"/>',
    repair: '<path d="M6 1.6 10.6 10H1.4z" fill="currentColor"/>',
    retired: '<path d="M2.5 6h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const stBadge = (s) => `<span class="r-st r-st-${s}"><svg viewBox="0 0 12 12" aria-hidden="true">${MARK[s]}</svg>${ST[s]}</span>`;
  const siteSt = (s) => s === 'closed' ? '<span class="r-st r-st-to_install"><svg viewBox="0 0 12 12" aria-hidden="true">' + MARK.to_install + '</svg>Chiuso temp.</span>' : '';
  const BARS = { low: 1, medium: 2, high: 3, critical: 4 };
  const PRL = { low: 'bassa', medium: 'media', high: 'alta', critical: 'critica' };
  const prio = (p) => p ? `<span class="r-prio${p === 'critical' ? ' is-crit' : ''}" title="Issue aperta · priorità ${PRL[p]}">${[1, 2, 3, 4].map((i) => `<i style="height:${3 + i * 2.25}px" class="${i <= BARS[p] ? 'on' : ''}"></i>`).join('')}</span>` : '';
  const hl = (t) => { if (!q) return esc(t); const i = String(t).toLowerCase().indexOf(q.toLowerCase()); if (i < 0) return esc(t); return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
  const assetRow = (a, opts = {}) => `<button type="button" class="r-asset${a.id === selected ? ' is-sel' : ''}" data-open="${a.id}">
      ${typeTile(a.t)}
      <span class="r-an"><b>${hl(a.name)}${prio(a.prio)}</b><small>${TYPES[a.t][0]}${opts.path ? ` · ${esc(a.c.name)} › ${esc(a.s.name)}` : ''}</small></span>
      <span class="r-mono">${a.host ? hl(a.host) : '<span class="none">—</span>'}</span>
      <span class="r-mono">${a.ip ? hl(a.ip) : '<span class="miss">Nessun IP</span>'}</span>
      <span class="r-mono">${a.srsa ? hl(a.srsa) : '<span class="none">—</span>'}</span>
      <span class="r-mono">${a.kn ? hl(a.kn) : '<span class="none">—</span>'}</span>
      <span>${stBadge(a.st)}</span>
    </button>`;
  const assetHead = '<div class="r-ahead"><span></span><span>Sistema</span><span>Hostname</span><span>IP</span><span>IP SRSA</span><span>K-Number</span><span>Stato</span></div>';
  const custActions = (c) => `<span class="r-cacts">
      ${c.vpn ? `<button type="button" class="r-ib" data-toast="Si apre l'accesso VPN di ${esc(c.name)}" title="Accesso VPN"><span class="r-vpn">VPN</span></button>` : ''}
      ${c.phone ? `<a class="r-ib" href="tel:${c.phone.replace(/\s+/g, '')}" title="Chiama ${esc(c.contact)}">${phoneI}</a>` : ''}
      <button type="button" class="r-ib" data-toast="Si apre la scheda di ${esc(c.name)}" title="Scheda cliente">${ic('building')}</button>
      <button type="button" class="r-ib" data-toast="Esportazione Excel di ${esc(c.name)}" title="Esporta Excel">${ic('download')}</button>
    </span>`;
  const phoneI = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
  const chev = (open) => `<span class="r-chev${open ? ' is-open' : ''}">${ic('chevR')}</span>`;

  // Raggruppamento territoriale
  const groups = () => {
    const key = (c) => group === 'prov' ? (c.prov || '') : (c.city || '');
    const m = new Map();
    CUST.forEach((c) => { const k = key(c); if (!m.has(k)) m.set(k, []); m.get(k).push(c); });
    return [...m.entries()].map(([k, cs]) => ({ k, label: group === 'prov' ? (k ? `${provName(k)} <span class="r-sig">${k}</span>` : '<i>Senza provincia</i>') : (k || '<i>Senza città</i>'), region: group === 'prov' ? regionName(regionOf(k)) : '', cs }))
      .sort((a, b) => (a.k ? 0 : 1) - (b.k ? 0 : 1) || a.k.localeCompare(b.k));
  };

  // ── Risultati di ricerca (comuni alle tre proposte) ──────────────
  const searchResults = () => {
    const t = q.toLowerCase();
    const as = ALL_ASSETS.filter((a) => [a.name, a.host, a.ip, a.srsa, a.kn].some((v) => v && v.toLowerCase().includes(t)));
    const ss = ALL_SITES.filter((s) => [s.name, s.addr].some((v) => v && v.toLowerCase().includes(t)));
    const cs = CUST.filter((c) => [c.name, c.city, c.code].some((v) => v && v.toLowerCase().includes(t)));
    const path = (c, s) => `<span class="r-path">${c.prov ? `<span>${provName(c.prov)}</span>${ic('chevR')}` : ''}<span>${esc(c.name)}</span>${s ? `${ic('chevR')}<span>${esc(s.name)}</span>` : ''}</span>`;
    return `<section class="panel r-res">
      <div class="r-res-h"><b>${as.length + ss.length + cs.length}</b> risultati per «${esc(q)}» <button type="button" class="btn btn-ghost btn-sm" data-clear>Cancella ricerca</button></div>
      ${as.length ? `<div class="r-gh">Sistemi <span>${as.length}</span></div>${assetHead}${as.map((a) => `<div class="r-hit">${path(a.c, a.s)}${assetRow(a)}</div>`).join('')}` : ''}
      ${ss.length ? `<div class="r-gh">Siti <span>${ss.length}</span></div>${ss.map((s) => `<button type="button" class="r-row" data-goto-site="${s.id}"><span class="r-ti r-brand">${ic('pin')}</span><span class="r-an"><b>${hl(s.name)}</b><small>${esc(s.addr)}</small></span>${path(s.c)}<span class="r-n">${s.assets.length} asset</span>${ic('chevR')}</button>`).join('')}` : ''}
      ${cs.length ? `<div class="r-gh">Clienti <span>${cs.length}</span></div>${cs.map((c) => `<button type="button" class="r-row" data-goto-cust="${c.id}"><span class="r-ti r-brand">${ic('building')}</span><span class="r-an"><b>${hl(c.name)}</b><small>${venDot(c.ven)}</small></span><span class="r-path">${c.prov ? provName(c.prov) : 'Senza provincia'}</span><span class="r-n">${c.sites.length} siti · ${assetsOf(c)} asset</span>${ic('chevR')}</button>`).join('')}` : ''}
      ${!as.length && !ss.length && !cs.length ? `<p class="r-empty">Nessun sistema, sito o cliente corrisponde a «${esc(q)}». Prova con parte dell'hostname o dell'IP.</p>` : ''}
    </section>`;
  };

  // ── A · Albero ───────────────────────────────────────────────────
  const renderA = () => {
    const gs = groups();
    return gs.map((g) => {
      const open = openProv.has(g.k); const na = g.cs.reduce((n, c) => n + assetsOf(c), 0); const ni = g.cs.reduce((n, c) => n + issuesOf(c.sites.flatMap((s) => s.assets)), 0);
      return `<section class="panel r-prov${open ? ' is-open' : ''}">
        <button type="button" class="r-prov-h" data-tog-prov="${esc(g.k)}" aria-expanded="${open}">${chev(open)}<span class="r-prov-n">${g.label}</span>${g.region ? `<span class="r-reg">${g.region}</span>` : ''}
          <span class="r-sp"></span><span class="r-n"><b>${g.cs.length}</b> ${g.cs.length === 1 ? 'cliente' : 'clienti'} · <b>${na}</b> asset${ni ? ` · <span class="w">${ni} con issue</span>` : ''}</span></button>
        ${open ? `<div class="r-custs">${g.cs.map((c) => {
          const oc = openCust.has(c.id);
          return `<div class="r-cust${oc ? ' is-open' : ''}">
            <div class="r-cust-h"><button type="button" class="r-cust-t" data-tog-cust="${c.id}" aria-expanded="${oc}">${chev(oc)}<span class="r-an"><b>${esc(c.name)}</b><small>${venDot(c.ven)}${c.contact ? ` · ${esc(c.contact)}` : ' · <span class="miss">Nessun contatto</span>'}</small></span></button>
              <span class="r-n">${c.sites.length} siti · ${assetsOf(c)} asset</span>${custActions(c)}</div>
            ${oc ? `<div class="r-sites">${c.sites.map((s) => {
              const os = openSite.has(s.id);
              return `<div class="r-site${os ? ' is-open' : ''}">
                <button type="button" class="r-site-h" data-tog-site="${s.id}" aria-expanded="${os}">${chev(os)}<span class="r-ti r-brand">${ic('pin')}</span><span class="r-an"><b>${esc(s.name)}</b><small>${esc(s.addr || 'Nessun indirizzo')}</small></span>${typeDots(s.assets)}${siteSt(s.st)}<span class="r-n">${s.assets.length} asset${issuesOf(s.assets) ? ` · <span class="w">${issuesOf(s.assets)} issue</span>` : ''}</span></button>
                ${os ? `<div class="r-assets">${assetHead}${s.assets.map((a) => assetRow(a)).join('')}</div>` : ''}
              </div>`;
            }).join('')}</div>` : ''}
          </div>`;
        }).join('')}</div>` : ''}
      </section>`;
    }).join('');
  };

  // ── Cartina (B e C) ──────────────────────────────────────────────
  const provCounts = () => { const m = {}; CUST.forEach((c) => { if (c.prov) m[c.prov] = (m[c.prov] || 0) + assetsOf(c); }); return m; };
  const mapSvg = (region, sel, small) => {
    const pc = provCounts();
    if (!region || !G.provinceGeo[region]) {
      const rc = {}; Object.entries(pc).forEach(([p, n]) => { const r = regionOf(p); if (r) rc[r] = (rc[r] || 0) + n; });
      const max = Math.max(1, ...Object.values(rc));
      return `<svg viewBox="${G.viewBox}" class="r-map${small ? ' is-small' : ''}" role="img" aria-label="Cartina d'Italia">${G.regions.map((r) => `<path d="${r.path}" class="r-reg-s${rc[r.id] ? ' has' : ''}${r.id === sel ? ' is-sel' : ''}" style="${rc[r.id] ? `--k:${(0.25 + 0.75 * rc[r.id] / max).toFixed(2)}` : ''}" ${rc[r.id] ? `data-region="${r.id}" tabindex="0"` : ''}><title>${r.name}${rc[r.id] ? ` · ${rc[r.id]} asset` : ''}</title></path>`).join('')}</svg>`;
    }
    const geo = G.provinceGeo[region]; const max = Math.max(1, ...geo.provinces.map((p) => pc[p.sigla] || 0));
    return `<svg viewBox="${geo.viewBox}" class="r-map${small ? ' is-small' : ''}" role="img" aria-label="Province di ${regionName(region)}">${geo.provinces.map((p) => `<path d="${p.path}" class="r-reg-s${pc[p.sigla] ? ' has' : ''}${p.sigla === sel ? ' is-sel' : ''}" style="${pc[p.sigla] ? `--k:${(0.25 + 0.75 * pc[p.sigla] / max).toFixed(2)}` : ''}" ${pc[p.sigla] ? `data-prov="${p.sigla}" tabindex="0"` : ''}><title>${provName(p.sigla)}${pc[p.sigla] ? ` · ${pc[p.sigla]} asset` : ''}</title></path>`).join('')}${geo.provinces.filter((p) => pc[p.sigla]).map((p) => `<text x="${p.cx}" y="${p.cy}" class="r-map-l">${p.sigla}</text>`).join('')}</svg>`;
  };

  // ── B · Mappa + elenco ───────────────────────────────────────────
  // Sinistra: cartina + regioni per numero di clienti. Destra: province in
  // ordine alfabetico (solo quelle della regione scelta); clic su una
  // provincia → il suo contenuto, con ritorno all'elenco.
  const provStats = (p) => {
    const cs = CUST.filter((c) => (p === '' ? !c.prov : c.prov === p));
    const as = cs.flatMap((c) => c.sites.flatMap((s) => s.assets));
    return { cs, sites: cs.reduce((n, c) => n + c.sites.length, 0), assets: as.length, issues: issuesOf(as) }
  };
  const renderB = () => {
    const provs = [...new Set(CUST.map((c) => c.prov).filter(Boolean))];
    const regs = {}; provs.forEach((p) => { const r = regionOf(p); (regs[r] ||= { id: r, cust: 0, provs: 0 }); regs[r].cust += CUST.filter((c) => c.prov === p).length; regs[r].provs += 1; });
    const regList = Object.values(regs).sort((a, b) => b.cust - a.cust || regionName(a.id).localeCompare(regionName(b.id)));
    const noProv = CUST.filter((c) => !c.prov).length;
    const PO = { critical: 4, high: 3, medium: 2, low: 1 };
    const hot = ALL_ASSETS.filter((a) => a.prio && (!bRegion || regionOf(a.c.prov) === bRegion)).sort((x, y) => PO[y.prio] - PO[x.prio] || x.name.localeCompare(y.name));
    const left = `<aside class="panel r-mapcard">
        <div class="r-map-h">${bRegion ? `<button type="button" class="r-back" data-region-back>${ic('chevL')}Italia</button><b>${regionName(bRegion)}</b>` : '<b>Italia</b><span>scegli una regione</span>'}</div>
        <div class="r-map-w">${mapSvg(bRegion, bRegion ? bProv : null)}</div>
        <div class="r-legend" aria-hidden="true"><span>meno asset</span><i></i><span>più asset</span></div>
        <div class="r-cats">${Object.entries(TYPES).map(([k, [l, , c]]) => `<span><i style="--tc:${c}"></i>${l} <b>${ALL_ASSETS.filter((a) => a.t === k && (!bRegion || regionOf(a.c.prov) === bRegion)).length}</b></span>`).join('')}</div>
        <div class="r-hot">
          <div class="r-pl-g">Sistemi con issue aperte${bRegion ? ` · ${regionName(bRegion)}` : ' · Italia'} <span class="r-cnt">${hot.length}</span></div>
          ${hot.length ? hot.map((a) => `<button type="button" class="r-hot-i" data-open="${a.id}">${typeTile(a.t)}<span class="r-an"><b>${esc(a.name)}${prio(a.prio)}</b><small>${esc(a.c.name)} › ${esc(a.s.name)}</small></span><span class="r-sig">${a.c.prov}</span></button>`).join('') : '<p class="r-hot-e">Nessuna issue aperta sui sistemi di questo territorio.</p>'}
        </div>
      </aside>`;
    // Destra: province in ordine alfabetico; clic → si espandono sul posto con i clienti.
    const list = provs.filter((p) => !bRegion || regionOf(p) === bRegion).sort((a, b) => provName(a).localeCompare(provName(b), 'it'));
    if (noProv && !bRegion) list.push('')
    const custBlock = (c) => { const oc = bCust.has(c.id); return `<div class="r-pcust${oc ? ' is-open' : ''}">
        <div class="r-cust-h"><button type="button" class="r-cust-t" data-bcust="${c.id}" aria-expanded="${oc}">${chev(oc)}<span class="r-ti r-brand">${ic('building')}</span><span class="r-an"><b>${esc(c.name)}</b><small>${venDot(c.ven)}${c.contact ? ` · ${esc(c.contact)}` : ' · <span class="miss">Nessun contatto</span>'}</small></span></button><span class="r-n">${c.sites.length} siti · ${assetsOf(c)} asset</span>${custActions(c)}</div>
        ${oc ? `<div class="r-psites">${c.sites.map((s) => { const os = bSite.has(s.id); return `<div class="r-site${os ? ' is-open' : ''}">
          <button type="button" class="r-site-h" data-bsite="${s.id}" aria-expanded="${os}">${chev(os)}<span class="r-ti">${ic('pin')}</span><span class="r-an"><b>${esc(s.name)}</b><small>${esc(s.addr || 'Nessun indirizzo')}</small></span>${typeDots(s.assets)}${siteSt(s.st)}<span class="r-n">${s.assets.length} asset${issuesOf(s.assets) ? ` · <span class="w">${issuesOf(s.assets)} issue</span>` : ''}</span></button>
          ${os ? `<div class="r-assets">${assetHead}${s.assets.map((a) => assetRow(a)).join('')}</div>` : ''}</div>`; }).join('')}</div>` : ''}
      </div>`; };
    const right = `<div class="r-pane">
        <div class="r-pane-h"><div><h2>${bRegion ? `Province · ${regionName(bRegion)}` : 'Tutte le province'}</h2><span>${list.filter(Boolean).length} province con clienti, in ordine alfabetico · clic per vedere i clienti</span></div>
          <div class="r-pane-a">${bOpen.size ? `<button type="button" class="btn btn-ghost btn-sm" data-pclose-all>Chiudi tutte</button>` : ''}${bRegion ? `<button type="button" class="btn btn-ghost btn-sm" data-region-back>Mostra tutte</button>` : ''}</div></div>
        <section class="panel r-ptable">
          <div class="r-prow r-prow-h"><span></span><span>Provincia</span><span>Clienti</span><span>Siti</span><span>Asset</span><span>Con issue</span></div>
          ${list.map((p) => { const st = provStats(p); const open = bOpen.has(p); return `<div class="r-pgroup${open ? ' is-open' : ''}" data-pgroup="${p}">
            <button type="button" class="r-prow" data-ptoggle="${p}" aria-expanded="${open}">${chev(open)}
              <span class="r-an"><b>${p ? `${provName(p)} <span class="r-sig">${p}</span>` : '<i>Senza provincia</i>'}</b><small>${p ? regionName(regionOf(p)) : 'clienti senza provincia in anagrafica'}</small></span>
              <span class="r-num">${st.cs.length}</span><span class="r-num">${st.sites}</span><span class="r-num">${st.assets}</span>
              <span class="r-num">${st.issues ? `<span class="w">${st.issues}</span>` : '<span class="none">—</span>'}</span></button>
            ${open ? `<div class="r-pexp">${st.cs.map(custBlock).join('')}</div>` : ''}
          </div>`; }).join('')}
        </section></div>`;
    return `<div class="r-split">${left}${right}</div>`;
  };

  // ── C · Colonne ──────────────────────────────────────────────────
  const renderC = () => {
    const provs = [...new Set(CUST.map((c) => c.prov))].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b));
    const cs = CUST.filter((c) => c.prov === cProv);
    const cust = CUST.find((c) => c.id === cCust && c.prov === cProv) || cs[0];
    const site = cust?.sites.find((s) => s.id === cSite) || cust?.sites[0];
    const crumbs = [cProv ? provName(cProv) : 'Senza provincia', cust?.name, site?.name].filter(Boolean);
    const col = (title, n, body, extra = '') => `<div class="r-col"><div class="r-col-h"><b>${title}</b><span>${n}</span>${extra}</div><div class="r-col-b">${body}</div></div>`;
    return `<div class="r-crumbs">${crumbs.map((c, i) => `<span${i === crumbs.length - 1 ? ' class="is-last"' : ''}>${esc(c)}</span>`).join(ic('chevR'))}</div>
      <section class="panel r-cols">
        ${col('Provincia', provs.length, `<div class="r-minimap">${mapSvg(null, cProv ? regionOf(cProv) : null, true)}</div>${provs.map((p) => { const n = CUST.filter((c) => c.prov === p); return `<button type="button" class="r-ci${p === cProv ? ' is-sel' : ''}" data-cprov="${p}"><span class="r-an"><b>${p ? provName(p) : '<i>Senza provincia</i>'}</b><small>${p ? regionName(regionOf(p)) : ''}</small></span><span class="r-n">${n.length}</span>${ic('chevR')}</button>`; }).join('')}`)}
        ${col('Cliente', cs.length, cs.map((c) => `<button type="button" class="r-ci${c === cust ? ' is-sel' : ''}" data-ccust="${c.id}"><span class="r-an"><b>${esc(c.name)}</b><small>${venDot(c.ven)}</small></span><span class="r-n">${c.sites.length}</span>${ic('chevR')}</button>`).join(''))}
        ${col('Sito', cust ? cust.sites.length : 0, cust ? cust.sites.map((s) => `<button type="button" class="r-ci${s === site ? ' is-sel' : ''}" data-csite="${s.id}"><span class="r-an"><b>${esc(s.name)}</b><small>${esc(s.addr || 'Nessun indirizzo')}</small></span><span class="r-n">${s.assets.length}${issuesOf(s.assets) ? '<i class="r-dot"></i>' : ''}</span>${ic('chevR')}</button>`).join('') : '')}
        <div class="r-col r-col-wide"><div class="r-col-h"><b>Asset</b><span>${site ? site.assets.length : 0}</span>${cust ? `<span class="r-sp"></span>${custActions(cust)}` : ''}</div>
          <div class="r-col-b">${cust ? `<div class="r-ccust"><b>${esc(cust.name)}</b>${cust.contact ? `<span>${esc(cust.contact)} · <a href="tel:${cust.phone.replace(/\s+/g, '')}" class="r-mono">${esc(cust.phone)}</a></span>` : '<span class="miss">Nessun contatto primario</span>'}</div>` : ''}
            ${site ? site.assets.map((a) => `<button type="button" class="r-asset r-asset-c${a.id === selected ? ' is-sel' : ''}" data-open="${a.id}">${typeTile(a.t)}<span class="r-an"><b>${esc(a.name)}${prio(a.prio)}</b><small><span class="r-mono">${esc(a.host || '—')}</span> · <span class="r-mono">${esc(a.ip || 'nessun IP')}</span></small></span><span>${stBadge(a.st)}</span></button>`).join('') : '<p class="r-empty">Nessun sito.</p>'}</div></div>
      </section>`;
  };

  // ── Render ──────────────────────────────────────────────────────
  const body = $('[data-r-body]');
  const render = () => {
    const na = ALL_ASSETS.length; const provs = new Set(CUST.map((c) => c.prov).filter(Boolean)).size;
    $('[data-r-meta]').innerHTML = `<b>${CUST.length}</b> clienti · <b>${ALL_SITES.length}</b> siti · <b>${na}</b> asset in <b>${provs}</b> province`;
    $('[data-r-bar]').hidden = variant !== 'a' || Boolean(q);
    $('[data-r-tools]').innerHTML = variant === 'a' && !q ? `<button type="button" class="btn btn-ghost btn-sm" data-all="close">Comprimi tutto</button><button type="button" class="btn btn-ghost btn-sm" data-all="open">Espandi tutto</button>` : '';
    body.className = 'r-body r-v' + variant;
    body.innerHTML = q ? searchResults() : variant === 'a' ? renderA() : variant === 'b' ? renderB() : renderC();
    markSel();
  };

  // ── Pannello dell'inventario (credenziali solo qui) ───────────────
  const drawer = $('[data-r-drawer]'); const rbody = $('[data-rbody]'); const shell = $('.shell');
  const credRow = (l, v, secret) => `<div class="cr"><span class="k">${l}</span>${secret ? `<span class="sec"><span class="code">••••••••</span><button type="button" class="icon-btn" data-reveal="${esc(v)}" aria-label="Mostra ${l}" title="Mostra · si nasconde dopo 30 secondi">${ic('eye')}</button></span>` : `<span class="v code">${esc(v)}</span>`}<button type="button" class="icon-btn" data-copy aria-label="Copia ${l}" title="Copia">${ic('copy')}</button></div>`;
  const openAsset = (id) => {
    const a = ALL_ASSETS.find((x) => x.id === id); if (!a) return;
    selected = id; drawer.hidden = false; shell.classList.add('has-drawer');
    $('[data-rd="kn"]').textContent = a.kn;
    $('[data-rd="st"]').innerHTML = stBadge(a.st);
    $('[data-rd="title"]').innerHTML = `<span class="r-ttl">${typeTile(a.t)}${esc(a.name)}</span>`;
    $('[data-rd="sub"]').textContent = [TYPES[a.t][0], a.host, a.c.name, a.s.name].filter(Boolean).join(' · ');
    rbody.innerHTML = `<div class="drawer-body int-body">
      ${a.prio ? `<div class="r-alert">${prio(a.prio)}<span>Issue aperta su questo sistema · priorità ${PRL[a.prio]}</span><button type="button" class="c-link">Vedi</button></div>` : ''}
      <section class="c-sec"><div class="c-sec-h"><h4>${ic('lock')}Accesso</h4><span class="c-app">credenziali solo qui</span></div>
        <div class="c-cred">${credRow('Hostname', a.host || '—')}${credRow('IP locale', a.ip || '—')}${a.t !== 'mod' ? credRow('Utente OS', 'administrator') + credRow('Password OS', 'Arch!e-' + a.id, true) : ''}${a.t === 'pacs' || a.t === 'ris' ? credRow('Utente app', 'pacsadmin') + credRow('Password app', 'Pacs#' + a.id, true) : ''}</div>
        <p class="c-audit">Le password si vedono solo con il permesso Credenziali.</p></section>
      <section class="c-sec"><div class="c-sec-h"><h4>Dove si trova</h4></div>
        <ul class="cl-sites"><li><button type="button"><span class="ti">${ic('building')}</span><div class="fn"><b>${esc(a.c.name)}</b><span>Cliente · ${provName(a.c.prov)}</span></div><span></span>${ic('chevR')}</button></li>
        <li><button type="button"><span class="ti">${ic('pin')}</span><div class="fn"><b>${esc(a.s.name)}</b><span>${esc(a.s.addr || 'Nessun indirizzo')}</span></div><span></span>${ic('chevR')}</button></li></ul></section>
    </div><div class="drawer-foot"><button class="btn" type="button">${ic('wrench')}Modifica</button><span class="g-spacer"></span><button class="btn btn-primary" type="button">${ic('plus')}Nuova issue</button></div>`;
    markSel()
  };
  const close = () => { drawer.hidden = true; selected = null; shell.classList.remove('has-drawer'); markSel(); };
  // Asset selezionato: evidenzia la riga e, risalendo, il sito e il cliente che lo contengono.
  function markSel() {
    document.querySelectorAll('.has-sel').forEach((e) => e.classList.remove('has-sel'));
    document.querySelectorAll('[data-open]').forEach((b) => {
      const on = Number(b.dataset.open) === selected;
      b.classList.toggle('is-sel', on);
      if (on) { b.closest('.r-site')?.classList.add('has-sel'); b.closest('.r-pcust, .r-cust')?.classList.add('has-sel'); b.closest('.r-pgroup, .r-prov')?.classList.add('has-sel'); }
    });
  }
  $('[data-rclose]').addEventListener('click', close);
  rbody.addEventListener('click', (e) => {
    const rv = e.target.closest('[data-reveal]');
    if (rv) { const c = rv.previousElementSibling; const shown = c.textContent !== '••••••••'; c.textContent = shown ? '••••••••' : rv.dataset.reveal; rv.closest('.sec').classList.toggle('is-shown', !shown); }
    if (e.target.closest('[data-copy]')) toast('Copiato negli appunti');
  });
  document.addEventListener('pointerdown', (e) => { if (drawer.hidden) return; if (drawer.contains(e.target) || e.target.closest('[data-open], .pv-bar, .toast-int')) return; close(); }, true);

  const toastEl = $('[data-toast]'); let tt = null;
  const toast = (m) => { toastEl.innerHTML = `<span>${esc(m)}</span>`; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 2600); };

  // ── Interazioni ────────────────────────────────────────────────────
  body.addEventListener('click', (e) => {
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t('[data-open]'))) { openAsset(Number(el.dataset.open)); return; }
    if ((el = t('[data-toast]'))) { toast(el.dataset.toast); return; }
    if ((el = t('[data-tog-prov]'))) { const k = el.dataset.togProv; openProv.has(k) ? openProv.delete(k) : openProv.add(k); render(); return; }
    if ((el = t('[data-tog-cust]'))) { const k = Number(el.dataset.togCust); openCust.has(k) ? openCust.delete(k) : openCust.add(k); render(); return; }
    if ((el = t('[data-tog-site]'))) { const k = Number(el.dataset.togSite); openSite.has(k) ? openSite.delete(k) : openSite.add(k); render(); return; }
    if ((el = t('[data-region-back]'))) { bRegion = null; bProv = null; render(); return; }
    if ((el = t('[data-ptoggle]'))) { const k = el.dataset.ptoggle; if (bOpen.has(k)) bOpen.delete(k); else { bOpen.add(k); bProv = k; } render(); return; }
    if ((el = t('[data-pclose-all]'))) { bOpen.clear(); bCust.clear(); bSite.clear(); render(); return; }
    if ((el = t('[data-bcust]'))) { const k = Number(el.dataset.bcust); bCust.has(k) ? bCust.delete(k) : bCust.add(k); render(); return; }
    if ((el = t('[data-bsite]'))) { const k = Number(el.dataset.bsite); bSite.has(k) ? bSite.delete(k) : bSite.add(k); render(); return; }
    if ((el = t('[data-region]'))) { bRegion = el.dataset.region; bProv = null; if (variant === 'c') { const p = CUST.find((c) => regionOf(c.prov) === bRegion)?.prov; if (p) { cProv = p; cCust = CUST.find((c) => c.prov === p).id; cSite = null; } } render(); return; }
    if ((el = t('[data-prov]'))) {
      bProv = el.dataset.prov; if (bProv) bRegion = regionOf(bProv) || bRegion; bOpen.add(bProv); render();
      document.querySelector(`[data-pgroup="${bProv}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
    }
    if ((el = t('[data-cprov]'))) { cProv = el.dataset.cprov; cCust = null; cSite = null; render(); return; }
    if ((el = t('[data-ccust]'))) { cCust = Number(el.dataset.ccust); cSite = null; render(); return; }
    if ((el = t('[data-csite]'))) { cSite = Number(el.dataset.csite); render(); return; }
    if ((el = t('[data-clear]'))) { q = ''; $('[data-r-q]').value = ''; render(); return; }
    if ((el = t('[data-goto-site]')) || (el = t('[data-goto-cust]'))) {
      const s = el.dataset.gotoSite ? ALL_SITES.find((x) => x.id === Number(el.dataset.gotoSite)) : null;
      const c = s ? s.c : CUST.find((x) => x.id === Number(el.dataset.gotoCust));
      q = ''; $('[data-r-q]').value = '';
      openProv.add(c.prov); openCust.add(c.id); if (s) openSite.add(s.id);
      bProv = c.prov; bRegion = regionOf(c.prov); cProv = c.prov; cCust = c.id; cSite = s ? s.id : null;
      render(); return;
    }
  });
  $('[data-r-tools]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-all]'); if (!b) return;
    if (b.dataset.all === 'close') { openProv.clear(); openCust.clear(); openSite.clear(); }
    else { groups().forEach((g) => openProv.add(g.k)); CUST.forEach((c) => openCust.add(c.id)); }
    render();
  });
  $('[data-r-group]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return; group = b.dataset.g;
    $('[data-r-group]').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    openProv.clear(); groups().slice(0, 1).forEach((g) => openProv.add(g.k)); render();
  });
  let tq = null;
  $('[data-r-q]').addEventListener('input', (e) => { clearTimeout(tq); tq = setTimeout(() => { q = e.target.value.trim(); render(); }, 120); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); $('[data-r-q]').focus(); }
    if (e.key === 'Escape') { if (!drawer.hidden) close(); else if (document.activeElement === $('[data-r-q]') && q) { q = ''; $('[data-r-q]').value = ''; render(); } }
  });

  const vbtns = document.querySelectorAll('[data-var-btn]');
  const setVar = (v) => {
    variant = v; vbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.varBtn === v)));
    try { localStorage.setItem('archie-preview-repo-var', v); } catch (e) { /* niente */ }
    render();
  };
  vbtns.forEach((b) => b.addEventListener('click', () => setVar(b.dataset.varBtn)));
  const qs = new URLSearchParams(location.search);
  let saved = null; try { saved = localStorage.getItem('archie-preview-repo-var'); } catch (e) { /* niente */ }
  if (qs.get('q')) { q = qs.get('q'); $('[data-r-q]').value = q; }
  setVar(qs.get('var') || saved || 'a');
  if (qs.get('inv')) openAsset(Number(qs.get('inv')));
})();
