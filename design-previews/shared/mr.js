/* 404, Monitor e Ricerca (anteprima). Dati finti modellati sui reali:
   Monitor: produttore, modello, seriale, stato (in_uso|da_installare|guasto|rma), tipo (diagnostico|amministrativo),
   radinet (solo diagnostici), workstation (inventario) con sito e cliente.
   Ricerca: /api/search/ restituisce kind, title, subtitle, path, updated_at per clienti, siti, contatti, inventari,
   piani di manutenzione, pagine wiki, cartelle e file del Drive. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const setNav = (label) => document.querySelectorAll('.nav-item').forEach((a) => { const on = label && (a.dataset.tip || a.textContent.trim()).startsWith(label); a.classList.toggle('is-active', !!on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const SCREEN = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/></svg>';

  // ═══ Monitor ═════════════════════════════════════════════════════
  const ST = { in_uso: ['In uso', 'ok'], da_installare: ['Da installare', 'warn'], guasto: ['Guasto', 'err'], rma: ['RMA', 'np'] };
  const WS = {
    w1: { name: 'BO-MAG-WSR01', where: 'Ospedale Maggiore · Radiologia PS', cli: 'AUSL Bologna' },
    w2: { name: 'BO-MAG-WSR03', where: 'Ospedale Maggiore · Sala refertazione 2', cli: 'AUSL Bologna' },
    w3: { name: 'AUB04WKR201', where: 'Porretta · Radiologia', cli: 'AUSL Bologna' },
    w4: { name: 'IM-SCA-WSR02', where: 'S. Maria della Scaletta · Senologia', cli: 'AUSL Imola' },
    w5: { name: 'RIZ-WS-ORTO1', where: 'Rizzoli · Ortopedia', cli: 'IRCCS Rizzoli' },
  };
  let mid = 0;
  const M = (ws, prod, mod, ser, st, tipo, radinet = false, extra = {}) => ({ id: ++mid, ws, prod, mod, ser, st, tipo, radinet, ...extra });
  const MON = [
    M('w1', 'Eizo', 'RadiForce RX660', '2389041', 'in_uso', 'diagnostico', true),
    M('w1', 'Eizo', 'RadiForce RX660', '2389044', 'in_uso', 'diagnostico', true),
    M('w1', 'Eizo', 'FlexScan EV2485', '8812230', 'in_uso', 'amministrativo'),
    M('w2', 'Eizo', 'RadiForce RX370', '4410276', 'guasto', 'diagnostico', true),
    M('w2', 'Eizo', 'RadiForce RX370', '4410281', 'in_uso', 'diagnostico', true),
    M('w2', 'Dell', 'P2422H', 'CN0F4K2', 'in_uso', 'amministrativo'),
    M('w3', 'Eizo', 'RadiForce RX660', '223345566', 'in_uso', 'diagnostico', true),
    M('w3', 'Eizo', 'RadiForce RX660', '223345571', 'in_uso', 'diagnostico', true),
    M('w4', 'Barco', 'Coronis Uniti MDMC-12133', 'BC61205', 'rma', 'diagnostico'),
    M('w4', 'Barco', 'Coronis Uniti MDMC-12133', 'BC61209', 'in_uso', 'diagnostico', true),
    M('w5', 'Eizo', 'RadiForce MX243W', '7734102', 'in_uso', 'diagnostico'),
    M(null, 'Eizo', 'RadiForce RX660', '2389102', 'da_installare', 'diagnostico'),
    M(null, 'Eizo', 'RadiForce RX660', '2389103', 'da_installare', 'diagnostico'),
    M(null, 'Dell', 'P2422H', 'CN0F4L9', 'da_installare', 'amministrativo'),
  ];
  const MVIEWS = [['all', 'Tutti', () => true], ['in_uso', 'In uso', (m) => m.st === 'in_uso'], ['da_installare', 'Da installare', (m) => m.st === 'da_installare'], ['guasto', 'Guasti', (m) => m.st === 'guasto', true], ['rma', 'In RMA', (m) => m.st === 'rma'], ['free', 'Senza workstation', (m) => !m.ws]];
  const stBadge = (s) => `<span class="nst ${ST[s][1]}">${ST[s][0]}</span>`;
  const tipoCell = (m) => `<span class="mtipo">${m.tipo === 'diagnostico' ? 'Diagnostico' : 'Amministrativo'}${m.radinet ? '<span class="rad" title="Radinet attivo">Radinet</span>' : ''}</span>`;

  // ═══ Ricerca ═════════════════════════════════════════════════════
  const KINDS = { customer: ['Clienti', 'building', 'Cliente'], site: ['Siti', 'pin', 'Sito'], contact: ['Contatti', 'users', 'Contatto'], inventory: ['Inventari', 'server', 'Inventario'], maintenance_plan: ['Manutenzione', 'wrench', 'Piano'], wiki_page: ['Wiki', 'book', 'Pagina wiki'], drive_folder: ['Drive', 'folder', 'Cartella'], drive_file: ['Drive', 'file', 'File'] };
  const R = (kind, title, sub, when, extra = {}) => ({ kind, title, sub, when, ...extra });
  const RESULTS = [
    R('customer', 'IRCCS Istituto Ortopedico Rizzoli', 'RIZ · Bologna · 3 siti', '2 giorni fa', { props: [['Codice', 'RIZ'], ['Città', 'Bologna'], ['Siti', '3'], ['Issue aperte', '1']] }),
    R('site', 'Rizzoli · Sede via Pupilli', 'IRCCS Rizzoli · Bologna', '3 settimane fa', { props: [['Cliente', 'IRCCS Rizzoli'], ['Indirizzo', 'Via G.C. Pupilli 1, Bologna'], ['Inventari', '12']] }),
    R('site', 'Rizzoli · Bentivoglio', 'IRCCS Rizzoli · Bentivoglio', '2 mesi fa', { props: [['Cliente', 'IRCCS Rizzoli'], ['Indirizzo', 'Via dell\'Ospedale 2, Bentivoglio'], ['Inventari', '4']] }),
    R('contact', 'Laura Rizzoli', 'Centro Medico Esperia · amministrazione', '5 mesi fa', { props: [['Email', 'l.rizzoli@esperia.it'], ['Telefono', '0434 123456'], ['Cliente', 'Centro Medico Esperia']] }),
    R('contact', 'Marco Venturi', 'IRCCS Rizzoli · ingegneria clinica', '1 mese fa', { props: [['Email', 'm.venturi@ior.it'], ['Telefono', '051 6366111'], ['Cliente', 'IRCCS Rizzoli']] }),
    R('inventory', 'RIZ-WS-ORTO1', 'Workstation · Rizzoli · Ortopedia', '4 giorni fa', { props: [['Tipo', 'Workstation'], ['IP', '10.12.4.31'], ['Sito', 'Sede via Pupilli'], ['Monitor', '1']] }),
    R('inventory', 'RIZ-PACS-01', 'Server PACS · Rizzoli · Sede via Pupilli', '1 settimana fa', { props: [['Tipo', 'Server'], ['IP', '10.12.1.10'], ['Sito', 'Sede via Pupilli']] }),
    R('maintenance_plan', 'PM Rizzoli 2026', 'IRCCS Rizzoli · ogni 6 mesi', '3 settimane fa', { props: [['Cadenza', 'ogni 6 mesi'], ['Prossima scadenza', '15 dic 2026'], ['Inventari coperti', '9']] }),
    R('wiki_page', 'Rizzoli: accesso VPN e jump host', 'Procedure · aggiornata da Luca Della Zazzera', '2 mesi fa', { props: [['Categoria', 'Procedure'], ['Autore', 'Luca Della Zazzera']], snippet: 'Per entrare nella rete del <mark>Rizzoli</mark> serve la VPN FortiClient con il profilo IOR-Biotron…' }),
    R('drive_folder', 'Rizzoli', 'Drive · Clienti', '1 mese fa', { props: [['Percorso', 'Drive / Clienti / Rizzoli'], ['File', '23']] }),
    R('drive_file', 'Rizzoli_schema_rete_2026.pdf', 'Drive · Clienti / Rizzoli', '1 mese fa', { props: [['Dimensione', '1,2 MB'], ['Caricato da', 'Federico Mutuale']] }),
  ];
  const Q = 'rizzoli';
  const hl = (t) => esc(t).replace(new RegExp(`(${Q})`, 'ig'), '<mark>$1</mark>');
  const groupOf = (k) => (k.startsWith('drive') ? 'drive' : k);
  const RGROUPS = [['customer', 'Clienti', 'building'], ['site', 'Siti', 'pin'], ['contact', 'Contatti', 'users'], ['inventory', 'Inventari', 'server'], ['maintenance_plan', 'Manutenzione', 'wrench'], ['wiki_page', 'Wiki', 'book'], ['drive', 'Drive', 'folder']];

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  let page = qs.get('pagina') || ls('archie-preview-mr-p', 'nf');
  const variant = { nf: ls('archie-preview-mr-vnf', 'a'), mon: ls('archie-preview-mr-vmon', 'a'), search: ls('archie-preview-mr-vsearch', 'a') };
  if (qs.get('variante')) variant[page] = qs.get('variante');
  let mView = 'all'; let openMon = null; let rKind = 'all'; let rSel = 0; let empty = false;
  const root = $('[data-mr]');
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell');

  // ── 404 ─────────────────────────────────────────────────────────
  const nfLinks = `<div class="nf-links"><span>Oppure vai a</span>${[['Dashboard', 'dashboard'], ['Issue', 'alert'], ['Clienti', 'building'], ['Inventari', 'server'], ['Wiki', 'book']].map(([l, i]) => `<a href="#">${ic(i)}${l}</a>`).join('')}</div>`;
  const nfSearch = `<label class="nf-search">${ic('search')}<input placeholder="Cerca in Archie: clienti, siti, inventari, wiki…" aria-label="Cerca in Archie"><kbd>Invio</kbd></label>`;
  const nfA = () => `<div class="nf nf-a"><div class="nf-num" aria-hidden="true"><span>4</span><span class="o">0</span><span>4</span></div>
    <h1>Questa pagina non esiste</h1>
    <p>L'indirizzo <code>/clienti/9999/siti</code> non porta da nessuna parte: forse è stato scritto male o l'elemento è stato eliminato.</p>
    <div class="nf-act"><button class="btn" type="button">${ic('chevL')}Torna indietro</button><button class="btn btn-primary" type="button">${ic('dashboard')}Vai alla Dashboard</button></div>
    ${nfSearch}${nfLinks}</div>`;
  const nfB = () => `<div class="nf nf-b"><div class="nf-folder" aria-hidden="true"><div class="tab">404</div><div class="back"></div><div class="paper p1"></div><div class="paper p2"></div><div class="front"><span>Cartella vuota</span></div></div>
    <h1>Qui non c'è niente</h1>
    <p>Abbiamo cercato <code>/clienti/9999/siti</code> in tutto l'archivio, ma questa pagina non esiste. Se ci sei arrivato da un link, può darsi che l'elemento sia nel Cestino.</p>
    <div class="nf-act"><button class="btn" type="button">${ic('chevL')}Torna indietro</button><button class="btn" type="button">${ic('trash')}Apri il Cestino</button><button class="btn btn-primary" type="button">${ic('dashboard')}Vai alla Dashboard</button></div>
    ${nfSearch}</div>`;

  // ── Monitor ─────────────────────────────────────────────────────
  const mHead = () => `<div class="mt-head"><h1>Monitor</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo monitor</button></div></div>`;
  const mTabs = () => `<div class="vtabs" role="group" aria-label="Viste">${MVIEWS.map(([k, l, f, alert]) => { const n = MON.filter(f).length; return `<button type="button" aria-pressed="${k === mView}" data-mview="${k}">${l} <span${alert && n ? ' class="alert"' : ''}>${n}</span></button>`; }).join('')}</div>`;
  const mVisible = () => MON.filter(MVIEWS.find((v) => v[0] === mView)[2]);
  const monA = () => {
    const rows = mVisible();
    return `${mHead()}<section class="panel" aria-label="Monitor">${mTabs()}
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">Nessun filtro. Usa l'imbuto accanto al nome di una colonna.</span></div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Esporta">${ic('download')}</button><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      <div class="table-wrap"><table class="po-table mon-table"><thead><tr><th>Monitor</th><th class="c-ser">Seriale</th><th class="c-tipo">Tipo</th><th>Workstation</th><th class="c-st">Stato</th></tr></thead>
      <tbody>${rows.map((m) => { const w = WS[m.ws]; return `<tr data-mopen="${m.id}" tabindex="0" class="${openMon === m.id ? 'is-selected' : ''}">
        <td><span class="ob">${SCREEN}<span><b>${m.prod} ${m.mod}</b>${m.note ? `<small class="warn">${esc(m.note)}</small>` : ''}</span></span></td>
        <td class="c-ser"><code>${m.ser}</code></td>
        <td class="c-tipo">${tipoCell(m)}</td>
        <td>${w ? `<span class="ob nob"><span><b>${w.name}</b><small>${w.where}</small></span></span>` : '<span class="none">Non assegnato</span>'}</td>
        <td class="c-st">${stBadge(m.st)}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> monitor</span></div></section>`;
  };
  const monB = () => {
    const rows = mVisible();
    const groups = [...Object.keys(WS).map((k) => [k, rows.filter((m) => m.ws === k)]), [null, rows.filter((m) => !m.ws)]].filter(([, l]) => l.length);
    return `${mHead()}<section class="panel" aria-label="Monitor">${mTabs()}
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">Raggruppati per workstation.</span></div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      <div class="wsg">${groups.map(([k, l]) => { const w = WS[k]; return `<article class="ws${w ? '' : ' free'}"><header>${w ? `${ic('server')}<div><b>${w.name}</b><small>${w.cli} · ${w.where}</small></div><a href="#" class="lnk">Apri inventario</a>` : `${ic('bag')}<div><b>Senza workstation</b><small>a magazzino o da installare</small></div>`}</header>
        <div class="scr">${l.map((m) => `<button type="button" class="sc${openMon === m.id ? ' on' : ''} st-${m.st}" data-mopen="${m.id}"><span class="face" aria-hidden="true"><i></i></span><b>${m.prod} ${m.mod}</b><code>${m.ser}</code><span class="sc-f">${stBadge(m.st)}${m.radinet ? '<span class="rad">Radinet</span>' : m.tipo === 'amministrativo' ? '<span class="adm">Amm.</span>' : ''}</span></button>`).join('')}</div></article>`; }).join('')}</div></section>`;
  };
  const renderDrawer = () => {
    const m = MON.find((x) => x.id === openMon); if (!m) return;
    const w = WS[m.ws];
    $('[data-md="id"]').textContent = `Monitor #${m.id}`; $('[data-md="st"]').innerHTML = stBadge(m.st); $('[data-md="title"]').textContent = `${m.prod} ${m.mod}`; $('[data-md="sub"]').textContent = `${m.tipo === 'diagnostico' ? 'Diagnostico' : 'Amministrativo'} · S/N ${m.ser}`;
    $('[data-mtabs]').innerHTML = '';
    const sib = w ? MON.filter((x) => x.ws === m.ws && x.id !== m.id) : [];
    $('[data-mbody]').innerHTML = `<div class="drawer-body int-body">
      ${m.note ? `<section class="ct-sec"><div class="callout${m.st === 'guasto' ? '' : ' warn'}"><div><b>${ST[m.st][0]}</b><span>${esc(m.note)}</span></div></div></section>` : ''}
      <section class="ct-sec"><div class="h"><h4>Dati</h4></div><dl class="mprops">
        <dt>Produttore</dt><dd>${m.prod}</dd><dt>Modello</dt><dd>${m.mod}</dd><dt>Seriale</dt><dd><code>${m.ser}</code> <button class="icon-btn sm" type="button" aria-label="Copia">${ic('copy')}</button></dd>
        <dt>Tipo</dt><dd>${m.tipo === 'diagnostico' ? 'Diagnostico' : 'Amministrativo'}</dd><dt>Radinet</dt><dd>${m.radinet ? 'Attivo' : m.tipo === 'diagnostico' ? 'Non attivo' : '<span class="none">solo per i diagnostici</span>'}</dd>
        <dt>Stato</dt><dd><span class="st-pick">${Object.keys(ST).map((k) => `<button type="button" aria-pressed="${k === m.st}" class="${ST[k][1]}">${ST[k][0]}</button>`).join('')}</span></dd></dl></section>
      <section class="ct-sec"><div class="h"><h4>Workstation</h4>${w ? '<button class="lnk" type="button">Cambia</button>' : ''}</div>${w ? `<a href="#" class="wscard">${ic('server')}<span><b>${w.name}</b><small>${w.cli} · ${w.where}</small></span>${ic('arrowR')}</a>` : `<button class="drop-sm" type="button">${ic('plus')}<span><b>Assegna a una workstation</b> · cerca per nome o sito</span></button>`}</section>
      ${sib.length ? `<section class="ct-sec"><div class="h"><h4>Sulla stessa workstation</h4></div><div class="sibs">${sib.map((x) => `<button type="button" data-mopen="${x.id}">${SCREEN}<span><b>${x.prod} ${x.mod}</b><small>${x.ser}</small></span>${stBadge(x.st)}</button>`).join('')}</div></section>` : ''}
      <section class="ct-sec"><div class="h"><h4>Storia</h4></div><div class="feed"><div class="ev">${ic('plus')}<span><b>Federico Mutuale</b> l'ha registrato</span><time>12 mar 2026</time></div>${m.st !== 'in_uso' && m.st !== 'da_installare' ? `<div class="ev">${ic('alert')}<span><b>Leonardo Romano</b> ha cambiato lo stato in ${ST[m.st][0]}</span><time>3 nov 2026</time></div>` : ''}</div></section></div>
      <div class="drawer-foot"><button class="btn" type="button">${ic('trash')}Elimina</button><span class="g-spacer"></span><button class="btn btn-primary" type="button">Modifica</button></div>`;
  };
  const openD = (id) => { openMon = id; drawer.hidden = false; shell.classList.add('has-drawer'); render(); renderDrawer(); };
  const closeD = () => { openMon = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  $('[data-mclose-d]').addEventListener('click', closeD);
  $('[data-mbody]').addEventListener('click', (e) => { const b = e.target.closest('[data-mopen]'); if (b) openD(Number(b.dataset.mopen)); });

  // ── Ricerca ─────────────────────────────────────────────────────
  const sBox = () => `<div class="sx-box"><label>${ic('search')}<input value="${empty ? '' : 'Rizzoli'}" placeholder="Cerca clienti, siti, contatti, inventari, wiki, file…" aria-label="Cerca in Archie">${empty ? '' : '<button class="icon-btn sm" type="button" aria-label="Cancella">' + ic('x') + '</button>'}</label></div>`;
  const rVisible = () => RESULTS.filter((r) => rKind === 'all' || groupOf(r.kind) === rKind);
  const emptyState = () => `<div class="sx-empty"><div><h3>Ricerche recenti</h3>${['AUSL Imola', 'RX660', '10.12.4.31', 'backup PACS'].map((t) => `<button type="button" class="rec">${ic('history')}${t}</button>`).join('')}</div>
    <div><h3>Cosa puoi cercare</h3><ul class="tips"><li><b>Clienti e siti</b> per nome, codice, città o partita IVA</li><li><b>Inventari</b> per hostname, K-number, seriale o indirizzo IP</li><li><b>Contatti</b> per nome, email o telefono</li><li><b>Wiki e Drive</b> per titolo e contenuto</li></ul></div></div>`;
  const kindFilter = () => { const counts = Object.fromEntries(RGROUPS.map(([k]) => [k, RESULTS.filter((r) => groupOf(r.kind) === k).length])); return [['all', 'Tutto', 'search', RESULTS.length], ...RGROUPS.map(([k, l, i]) => [k, l, i, counts[k]])].filter((x) => x[3]); };
  const resRow = (r, i, sel) => `<button type="button" class="sx-r${sel ? ' on' : ''}" data-rsel="${i}">${ic(KINDS[r.kind][1])}<span class="t"><b>${hl(r.title)}</b><small>${hl(r.sub)}</small>${r.snippet ? `<em>${r.snippet}</em>` : ''}</span><span class="w">${r.when}</span>${ic('arrowR')}</button>`;
  const searchA = () => {
    if (empty) return `<div class="mt-head"><h1>Ricerca</h1></div>${sBox()}${emptyState()}`;
    const vis = rVisible();
    const groups = RGROUPS.map(([k, l, i]) => [k, l, i, vis.filter((r) => groupOf(r.kind) === k)]).filter((g) => g[3].length);
    return `<div class="mt-head"><h1>Ricerca</h1></div>${sBox()}
      <div class="sx-a"><nav class="sx-kinds" aria-label="Tipo">${kindFilter().map(([k, l, i, n]) => `<button type="button" aria-pressed="${rKind === k}" data-rkind="${k}">${ic(i)}<span>${l}</span><b>${n}</b></button>`).join('')}</nav>
      <div class="sx-groups"><p class="sx-count"><b>${vis.length}</b> risultati per «Rizzoli»</p>${groups.map(([, l, i, items]) => `<section class="sx-g"><h2>${ic(i)}${l}<span>${items.length}</span></h2>${items.map((r) => resRow(r, RESULTS.indexOf(r), false)).join('')}</section>`).join('')}</div></div>`;
  };
  const searchB = () => {
    if (empty) return `<div class="mt-head"><h1>Ricerca</h1></div>${sBox()}${emptyState()}`;
    const vis = rVisible(); const cur = vis[Math.min(rSel, vis.length - 1)];
    return `<div class="mt-head"><h1>Ricerca</h1></div>${sBox()}
      <div class="chips sx-chips" role="group" aria-label="Tipo">${kindFilter().map(([k, l, , n]) => `<button type="button" class="chip" aria-pressed="${rKind === k}" data-rkind="${k}">${l} <b>${n}</b></button>`).join('')}</div>
      <div class="sx-b"><div class="sx-list" role="listbox" aria-label="Risultati">${vis.map((r, i) => resRow(r, i, r === cur)).join('')}<p class="sx-hint"><kbd>↑</kbd> <kbd>↓</kbd> per scorrere · <kbd>Invio</kbd> per aprire</p></div>
      ${cur ? `<aside class="sx-prev" aria-label="Anteprima"><div class="sx-pi">${ic(KINDS[cur.kind][1])}</div><span class="sx-pk">${KINDS[cur.kind][2]}</span><h3>${esc(cur.title)}</h3><p>${esc(cur.sub)}</p>${cur.snippet ? `<blockquote>${cur.snippet}</blockquote>` : ''}<dl class="mprops">${(cur.props || []).map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl><small class="sx-upd">Aggiornato ${cur.when}</small><button class="btn btn-primary" type="button">Apri ${KINDS[cur.kind][2].toLowerCase()}${ic('arrowR')}</button></aside>` : ''}</div>`;
  };

  // ── Render ──────────────────────────────────────────────────────
  const NAMES = { nf: { a: 'Sobria', b: 'Cartella vuota' }, mon: { a: 'Tabella', b: 'Per workstation' }, search: { a: 'Per tipo', b: 'Con anteprima' } };
  const render = () => {
    setNav(page === 'mon' ? 'Monitor' : null);
    root.innerHTML = page === 'nf' ? (variant.nf === 'b' ? nfB() : nfA()) : page === 'mon' ? (variant.mon === 'b' ? monB() : monA()) : (variant.search === 'b' ? searchB() : searchA());
    if (page === 'search') root.insertAdjacentHTML('beforeend', `<p class="pv-note"><button type="button" data-rempty>${empty ? 'Mostra i risultati' : 'Mostra la pagina senza ricerca'}</button></p>`);
    document.querySelectorAll('[data-mrp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mrp === page)));
    document.querySelectorAll('[data-mrv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mrv === variant[page])));
    $('[data-mrv-name]').textContent = NAMES[page][variant[page]];
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-mopen]'); if (!b) return;
    if (b.dataset.mview) { mView = b.dataset.mview; return render(); }
    if (b.dataset.mopen) return openD(Number(b.dataset.mopen));
    if (b.dataset.rkind) { rKind = b.dataset.rkind; rSel = 0; return render(); }
    if (b.dataset.rsel && variant.search === 'b') { rSel = Number(b.dataset.rsel); return render(); }
    if (b.matches('[data-rempty]')) { empty = !empty; return render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openMon) closeD();
    if (page === 'search' && variant.search === 'b' && !empty && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); rSel = Math.max(0, Math.min(rVisible().length - 1, rSel + (e.key === 'ArrowDown' ? 1 : -1))); render(); }
  });
  document.querySelectorAll('[data-mrp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.mrp; if (openMon) closeD(); try { localStorage.setItem('archie-preview-mr-p', page); } catch { /* niente */ } render(); }));
  document.querySelectorAll('[data-mrv]').forEach((b) => b.addEventListener('click', () => { variant[page] = b.dataset.mrv; if (openMon) closeD(); try { localStorage.setItem(`archie-preview-mr-v${page}`, variant[page]); } catch { /* niente */ } render(); }));
  render();
})();
