/* Cestino e Bug e feature (anteprima).
   Cestino reale: 7 tipi (clienti, siti, contatti, inventari, monitor, piani di manutenzione, tecnici),
   deleted_at, bulk_restore / bulk_purge; ripristino bloccato (409 blocked_by) se il padre è nel cestino,
   eliminazione definitiva bloccata se ci sono elementi collegati ancora attivi.
   Bug e feature reale: ReportRequest (kind bug|feature, section, description, screenshot, status open|resolved|rejected,
   resolved_by/at, rejected_by/at + rejection_reason, can_resolve). Dati finti. Oggi: domenica 08/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const NOW = new Date(2026, 10, 8, 10, 30);
  const D = (s) => { const [d, t] = s.split(' '); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = (t || '09:00').split(':').map(Number); return new Date(y, m - 1, dd, h, mi); };
  const days = (d) => Math.round((new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  const ago = (d) => { const n = days(d); return n === 0 ? `oggi ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : n === 1 ? 'ieri' : n < 31 ? `${n} giorni fa` : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); };
  const dShort = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const BUG = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5"/><rect x="7" y="7.5" width="10" height="12" rx="5"/><path d="M12 12v7.5M4 10l3 1.5M20 10l-3 1.5M4 18l3-1.5M20 18l-3-1.5M3.5 14H7M17 14h3.5"/></svg>';
  const IDEA = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/></svg>';

  // Voce "Bug e feature" nella sidebar dell'anteprima (sotto Cestino)
  const trashLi = [...document.querySelectorAll('.nav-item')].find((a) => a.textContent.trim().startsWith('Cestino'))?.closest('li');
  if (trashLi && !document.querySelector('[data-tip="Bug e feature"]')) {
    const li = trashLi.cloneNode(true); const a = li.querySelector('a'); a.dataset.tip = 'Bug e feature';
    a.innerHTML = a.innerHTML.replace('Cestino', 'Bug e feature').replace(/<svg[\s\S]*?<\/svg>/, ic('chat'));
    trashLi.after(li);
  }
  const setNav = (label) => document.querySelectorAll('.nav-item').forEach((a) => { const on = (a.dataset.tip || a.textContent.trim()).startsWith(label); a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });

  // ═══ Cestino ═══════════════════════════════════════════════════════
  const TYPES = { customers: ['Clienti', 'building', 'Cliente'], sites: ['Siti', 'pin', 'Sito'], contacts: ['Contatti', 'users', 'Contatto'], inventory: ['Inventari', 'server', 'Inventario'], monitors: ['Monitor', 'monitor', 'Monitor'], plans: ['Piani', 'wrench', 'Piano'], techs: ['Tecnici', 'user', 'Tecnico'] };
  let tid = 0;
  const T = (type, title, sub, when, who, extra = {}) => ({ id: ++tid, type, title, sub, d: D(when), who, ...extra });
  const TRASH = [
    T('customers', 'AUSL Imola', 'IMOLA · 2 siti e 2 contatti eliminati insieme', '2026-11-08 09:12', 'Federico Mutuale', { batch: 'imola', purgeBlock: '3 inventari ancora attivi' }),
    T('sites', 'S. Maria della Scaletta', 'AUSL Imola · Imola', '2026-11-08 09:12', 'Federico Mutuale', { batch: 'imola', parent: 'AUSL Imola' }),
    T('sites', 'Castel S. Pietro', 'AUSL Imola · Castel San Pietro Terme', '2026-11-08 09:12', 'Federico Mutuale', { batch: 'imola', parent: 'AUSL Imola' }),
    T('contacts', 'Giulia Ferrari', 'AUSL Imola · referente RIS', '2026-11-08 09:12', 'Federico Mutuale', { batch: 'imola', parent: 'AUSL Imola' }),
    T('contacts', 'Paolo Bini', 'AUSL Imola · ingegneria clinica', '2026-11-08 09:12', 'Federico Mutuale', { batch: 'imola', parent: 'AUSL Imola' }),
    T('inventory', 'PACS secondario', 'IM-SCA-PACS02 · S. Maria della Scaletta', '2026-11-07 17:40', 'Nicole Spazzoli', { restoreBlock: 'Il sito S. Maria della Scaletta è nel cestino' }),
    T('contacts', 'Marco Bellini', 'AUSL Romagna · tecnico di sede', '2026-11-07 11:05', 'Luca Della Zazzera'),
    T('inventory', 'WS refertazione RX 3', 'BO-MAG-WSR03 · Ospedale Maggiore', '2026-11-06 15:22', 'Nicole Spazzoli'),
    T('monitors', 'Eizo RadiForce RX660', 'S/N 2389041 · Sala 2 Rizzoli', '2026-11-05 10:10', 'Leonardo Romano'),
    T('plans', 'PM Workstation refertazione 2025', 'AUSL Bologna · ogni anno', '2026-11-02 08:45', 'Federico Mutuale'),
    T('techs', 'Mario Rossi', 'tecnico esterno · Medical Service srl', '2026-10-28 16:30', 'Federico Mutuale'),
    T('sites', 'Poliambulatorio di Lugo', 'Casa di Cura Rocca · Lugo', '2026-10-20 09:00', 'Luca Della Zazzera'),
    T('contacts', 'Anna Ricci', 'Centro Medico Esperia · amministrazione', '2026-09-15 12:00', 'Nicole Spazzoli'),
  ];

  // ═══ Bug e feature ═══════════════════════════════════════════════
  const SECTIONS = { dashboard: 'Dashboard', site_repository: 'Site Repository', customers: 'Clienti', sites: 'Siti', contacts: 'Contatti', inventory: 'Inventari', issues: 'Issue', audit: 'Audit', maintenance: 'Manutenzione', drive: 'Drive', wiki: 'Wiki', search: 'Ricerca', profile: 'Profilo', trash: 'Cestino', other: 'Altro' };
  let bid = 40;
  const B = (kind, section, text, when, who, extra = {}) => ({ id: ++bid, kind, section, text, d: D(when), who, status: 'open', shot: false, ...extra });
  const BUGS = [
    B('bug', 'search', 'La ricerca globale non trova i contatti cercando il numero di telefono.\nProvato con "051 6478" e con il numero completo: nessun risultato, mentre in Contatti il filtro lo trova.', '2026-11-07 16:20', 'Nicole Spazzoli', { shot: true }),
    B('bug', 'maintenance', 'Dopo aver registrato un rapportino il calendario delle Scadenze non si aggiorna finché non ricarico la pagina.', '2026-11-06 11:02', 'Federico Mutuale', { shot: true }),
    B('feature', 'inventory', 'Aggiungere il numero di telefono di riferimento sugli inventari (es. reparto o tecnico di sala).', '2026-11-05 09:40', 'Leonardo Romano'),
    B('bug', 'drive', 'Il caricamento nel Drive fallisce con file oltre 50 MB: la barra arriva al 100% e poi compare "errore di rete".', '2026-11-04 14:15', 'Luca Della Zazzera'),
    B('feature', 'issues', 'Ricevere una email quando mi assegnano una issue, non solo la notifica nella campanella.', '2026-11-02 10:00', 'Niccolò Nanni'),
    B('feature', 'dashboard', 'Widget con le prossime ferie dei colleghi della mia area.', '2026-10-30 17:45', 'Sara De Paola'),
    B('bug', 'sites', 'Il filtro Cliente nella pagina Siti si azzerava cambiando pagina della tabella.', '2026-10-21 09:30', 'Leonardo Romano', { status: 'resolved', by: 'Federico Mutuale', at: D('2026-11-03 12:00') }),
    B('feature', 'customers', 'Viste salvate nelle tabelle, per non rimettere ogni volta gli stessi filtri.', '2026-10-10 08:50', 'Nicole Spazzoli', { status: 'resolved', by: 'Federico Mutuale', at: D('2026-10-29 18:00') }),
    B('bug', 'wiki', 'Le immagini incollate nelle pagine wiki perdevano la didascalia al salvataggio.', '2026-10-05 15:10', 'Luca Della Zazzera', { status: 'resolved', by: 'Federico Mutuale', at: D('2026-10-08 10:00'), shot: true }),
    B('feature', 'profile', 'Tema arancione per l\'interfaccia.', '2026-09-28 13:00', 'Niccolò Nanni', { status: 'rejected', by: 'Federico Mutuale', at: D('2026-09-30 09:00'), reason: 'Abbiamo scelto tre palette sobrie per tutta l\'app; l\'arancione è riservato agli stati "in attesa".' }),
  ];
  const ME = 'Federico Mutuale';
  const KIND = { bug: ['Bug', 'k-bug', BUG], feature: ['Funzionalità', 'k-feat', IDEA] };
  const STB = { open: ['Aperta', 'info'], resolved: ['Risolta', 'ok'], rejected: ['Rifiutata', 'np'] };
  const firstLine = (t) => t.split('\n')[0];
  const ava = (n) => `<span class="cav" aria-hidden="true">${n.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>`;

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  let page = qs.get('pagina') || ls('archie-preview-cb-p', 'trash');
  const variant = { trash: qs.get('variante') || ls('archie-preview-cb-vt', 'a'), bug: ls('archie-preview-cb-vb', 'a') };
  let tView = 'all'; let sel = new Set(); let bView = 'open'; let openBug = null; let dlg = null;
  const root = $('[data-cb]');
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell');

  // ── Cestino: pezzi ──────────────────────────────────────────────
  const tState = (r) => (r.restoreBlock ? `<span class="cst warn" title="${esc(r.restoreBlock)}">${ic('lock')}Prima il padre</span>` : r.purgeBlock ? `<span class="cst info" title="${esc(r.purgeBlock)}">${ic('alert')}Ha collegati attivi</span>` : '<span class="cst ok">Ripristinabile</span>');
  const tKpis = () => {
    const week = TRASH.filter((r) => days(r.d) < 7).length; const blocked = TRASH.filter((r) => r.restoreBlock).length; const oldest = TRASH.reduce((a, r) => (r.d < a.d ? r : a), TRASH[0]);
    const by = Object.keys(TYPES).map((k) => [k, TRASH.filter((r) => r.type === k).length]).filter(([, n]) => n);
    return `<div class="kpi-wrap"><div class="kpis cb-kpis" role="group" aria-label="Indicatori">
      <div class="kpi"><span class="kpi-h">Nel cestino</span><span class="kpi-v">${TRASH.length}<small>elementi</small></span><div class="seg-bar">${by.map(([k, n], i) => `<i style="flex:${n};background:var(--seq-${4 - Math.min(3, i)})" title="${TYPES[k][0]}: ${n}"></i>`).join('')}</div><span class="kpi-s">${by.slice(0, 3).map(([k, n]) => `<b>${n}</b> ${n === 1 ? TYPES[k][2].toLowerCase() : TYPES[k][0].toLowerCase()}`).join(' · ')}</span></div>
      <div class="kpi"><span class="kpi-h">Eliminati · 7 giorni</span><span class="kpi-v">${week}</span><span class="kpi-s">il più recente <b>${ago(TRASH[0].d)}</b></span></div>
      <button type="button" class="kpi${blocked ? ' kpi-warn' : ''}" data-tblock><span class="kpi-h">Da ripristinare con il padre<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${blocked}</span><span class="kpi-s">il padre è anche lui nel cestino</span></button>
      <div class="kpi"><span class="kpi-h">Il più vecchio</span><span class="kpi-v">${days(oldest.d)}<small>giorni</small></span><span class="kpi-s">${esc(oldest.title)} · ${TYPES[oldest.type][2].toLowerCase()}</span></div>
    </div></div>`;
  };
  const tVisible = () => TRASH.filter((r) => tView === 'all' || (tView === 'blocked' ? r.restoreBlock : r.type === tView));
  const tViews = () => `<div class="vtabs" role="group" aria-label="Tipi"><button type="button" aria-pressed="${tView === 'all'}" data-tview="all">Tutto <span>${TRASH.length}</span></button>${Object.keys(TYPES).map((k) => { const n = TRASH.filter((r) => r.type === k).length; return n ? `<button type="button" aria-pressed="${tView === k}" data-tview="${k}">${TYPES[k][0]} <span>${n}</span></button>` : ''; }).join('')}</div>`;
  const tBulk = () => (sel.size ? `<div class="bulk" role="toolbar" aria-label="Selezionati"><b>${sel.size} selezionat${sel.size === 1 ? 'o' : 'i'}</b><button class="btn btn-sm btn-primary" type="button" data-trestore-sel>${ic('restore')}Ripristina</button><button class="btn btn-sm btn-danger-o" type="button" data-tpurge-sel>${ic('trash')}Elimina definitivamente</button><span class="sp"></span><button class="btn btn-ghost btn-sm" type="button" data-tunsel>Annulla selezione</button></div>` : '');
  const tHead = () => `<div class="mt-head"><h1>Cestino</h1><div class="actions"><button class="btn" type="button" data-tpurge-all>${ic('trash')}Svuota il cestino</button></div></div>`;
  const trashA = () => {
    const rows = tVisible(); const allOn = rows.length && rows.every((r) => sel.has(r.id));
    return `${tHead()}<section class="panel" aria-label="Cestino">${tViews()}
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">${tView === 'blocked' ? 'Elementi che si ripristinano solo insieme al loro padre.' : 'Seleziona più elementi per ripristinarli o eliminarli insieme.'}</span></div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      ${tBulk()}
      <div class="table-wrap"><table class="po-table cb-table"><thead><tr><th class="c-sel"><input type="checkbox" data-tall aria-label="Seleziona tutti" ${allOn ? 'checked' : ''}></th><th>Elemento</th><th class="c-type">Tipo</th><th class="c-when">Eliminato</th><th class="c-st">Stato</th><th class="c-act"></th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="${sel.has(r.id) ? 'is-checked' : ''}">
        <td class="c-sel"><input type="checkbox" data-tsel="${r.id}" aria-label="Seleziona ${esc(r.title)}" ${sel.has(r.id) ? 'checked' : ''}></td>
        <td><span class="ob">${ic(TYPES[r.type][1])}<span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span></span></td>
        <td class="c-type">${TYPES[r.type][2]}</td>
        <td class="c-when"><span class="w2"><b>${ago(r.d)}</b><small>da ${r.who}</small></span></td>
        <td class="c-st">${tState(r)}</td>
        <td class="c-act"><button class="btn btn-sm" type="button" data-trestore="${r.id}" ${r.restoreBlock ? 'disabled title="Ripristina prima il padre"' : ''}>${ic('restore')}Ripristina</button><button class="icon-btn sm" type="button" data-tpurge="${r.id}" aria-label="Elimina definitivamente ${esc(r.title)}" title="Elimina definitivamente">${ic('trash')}</button></td></tr>`).join('') || '<tr><td colspan="6" style="height:110px;text-align:center;color:var(--muted)">Il cestino è vuoto.</td></tr>'}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> elementi</span><span class="sp"></span><span>Il ripristino riporta l'elemento dov'era, con i suoi dati.</span></div></section>`;
  };
  const trashB = () => {
    const rows = tVisible(); const groups = [['Oggi', (d) => days(d) === 0], ['Ieri', (d) => days(d) === 1], ['Questa settimana', (d) => days(d) > 1 && days(d) < 7], ['Questo mese', (d) => days(d) >= 7 && days(d) < 31], ['Più vecchi', (d) => days(d) >= 31]];
    const batches = (list) => { const out = []; list.forEach((r) => { if (r.batch) { let b = out.find((x) => x.batch === r.batch); if (!b) { b = { batch: r.batch, items: [] }; out.push(b); } b.items.push(r); } else out.push({ items: [r] }); }); return out; };
    return `${tHead()}<section class="panel" aria-label="Cestino">${tViews()}<div class="cbd">${groups.map(([l, f]) => { const g = rows.filter((r) => f(r.d)); if (!g.length) return ''; return `<div class="cbd-day"><h3>${l}<span>${g.length}</span></h3>${batches(g).map((b) => { const p = b.items[0]; const kids = b.items.slice(1); return `<article class="cbd-card${p.restoreBlock ? ' blocked' : ''}">
        <div class="cbd-main"><span class="cbd-ic">${ic(TYPES[p.type][1])}</span><div class="cbd-t"><b>${esc(p.title)}</b><small>${TYPES[p.type][2]} · ${esc(p.sub)}</small></div>
          <span class="cbd-when">${ago(p.d)}<small>da ${p.who}</small></span>
          <div class="cbd-act"><button class="btn btn-sm${p.restoreBlock ? '' : ' btn-primary'}" type="button" data-trestore="${p.id}" ${p.restoreBlock ? 'disabled' : ''}>${ic('restore')}${kids.length ? 'Ripristina tutto' : 'Ripristina'}</button><button class="icon-btn sm" type="button" data-tpurge="${p.id}" aria-label="Elimina definitivamente">${ic('trash')}</button></div></div>
        ${p.restoreBlock ? `<p class="cbd-note warn">${ic('lock')}${esc(p.restoreBlock)}: ripristina prima quello.</p>` : p.purgeBlock ? `<p class="cbd-note">${ic('alert')}Non si può eliminare definitivamente: ${esc(p.purgeBlock)}.</p>` : ''}
        ${kids.length ? `<ul class="cbd-kids">${kids.map((k) => `<li>${ic(TYPES[k.type][1])}<span><b>${esc(k.title)}</b> · ${TYPES[k.type][2].toLowerCase()}</span></li>`).join('')}</ul>` : ''}
      </article>`; }).join('')}</div>`; }).join('') || '<p class="none" style="padding:40px;text-align:center">Il cestino è vuoto.</p>'}</div></section>`;
  };

  // ── Bug e feature: pezzi ───────────────────────────────────────
  const BVIEWS = [['open', 'Aperte', (b) => b.status === 'open'], ['mine', 'Le mie', (b) => b.who === ME], ['resolved', 'Risolte', (b) => b.status === 'resolved'], ['rejected', 'Rifiutate', (b) => b.status === 'rejected'], ['all', 'Tutte', () => true]];
  const kBadge = (k) => `<span class="kb ${KIND[k][1]}">${KIND[k][2]}${KIND[k][0]}</span>`;
  const sBadge = (s) => `<span class="nst ${STB[s][1]}">${STB[s][0]}</span>`;
  const bHead = () => `<div class="mt-head"><h1>Bug e feature</h1><div class="actions"><button class="btn btn-primary" type="button" data-bnew>${ic('plus')}Segnala</button></div></div>`;
  const bKpis = () => {
    const open = BUGS.filter((b) => b.status === 'open'); const res30 = BUGS.filter((b) => b.status === 'resolved' && days(b.at) <= 30);
    const avg = Math.round(BUGS.filter((b) => b.status === 'resolved').reduce((s, b) => s + (b.at - b.d) / 864e5, 0) / Math.max(1, BUGS.filter((b) => b.status === 'resolved').length));
    const bySec = Object.entries(open.reduce((a, b) => ((a[b.section] = (a[b.section] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    return `<div class="kpi-wrap"><div class="kpis cb-kpis" role="group" aria-label="Indicatori">
      <button type="button" class="kpi${bView === 'open' ? ' is-on' : ''}" data-bview="open"><span class="kpi-h">Aperte<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${open.length}</span><span class="kpi-s"><span class="kb k-bug mini">${BUG}${open.filter((b) => b.kind === 'bug').length} bug</span><span class="kb k-feat mini">${IDEA}${open.filter((b) => b.kind === 'feature').length} funzionalità</span></span></button>
      <button type="button" class="kpi${bView === 'mine' ? ' is-on' : ''}" data-bview="mine"><span class="kpi-h">Le mie segnalazioni<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${BUGS.filter((b) => b.who === ME).length}</span><span class="kpi-s"><b>${BUGS.filter((b) => b.who === ME && b.status === 'open').length}</b> ancora aperte</span></button>
      <div class="kpi"><span class="kpi-h">Risolte · 30 giorni</span><span class="kpi-v">${res30.length}</span><span class="kpi-s">in media in <b>${avg} giorni</b></span></div>
      <div class="kpi"><span class="kpi-h">Sezioni con più aperte</span><div class="kpi-list">${bySec.slice(0, 3).map(([s, n]) => `<button type="button"><span>${SECTIONS[s]}</span><b>${n}</b></button>`).join('')}</div></div>
    </div></div>`;
  };
  const bVisible = () => BUGS.filter(BVIEWS.find((v) => v[0] === bView)[2]);
  const shotThumb = (b, big) => `<span class="shot${big ? ' big' : ''}" aria-hidden="true"><i class="sb"></i><i class="sl"></i><i class="sl s2"></i><i class="sl s3"></i>${b.kind === 'bug' ? '<i class="mark"></i>' : ''}</span>`;
  const bugA = () => {
    const rows = bVisible();
    return `${bHead()}<section class="panel" aria-label="Segnalazioni"><div class="vtabs" role="group" aria-label="Viste">${BVIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === bView}" data-bview="${k}">${l} <span>${BUGS.filter(f).length}</span></button>`).join('')}</div>
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">Nessun filtro. Usa l'imbuto accanto al nome di una colonna.</span></div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      <div class="table-wrap"><table class="po-table cb-table bug-table"><thead><tr><th class="c-k">Tipo</th><th>Segnalazione</th><th class="c-sec">Sezione</th><th class="c-who">Da</th><th class="c-when">Aperta</th><th class="c-st">Stato</th></tr></thead>
      <tbody>${rows.map((b) => `<tr data-bopen="${b.id}" tabindex="0" class="${openBug === b.id ? 'is-selected' : ''}">
        <td class="c-k">${kBadge(b.kind)}</td>
        <td><span class="btx"><b>${esc(firstLine(b.text))}</b>${b.shot ? `<small>${ic('file')}con screenshot</small>` : ''}</span></td>
        <td class="c-sec">${SECTIONS[b.section]}</td>
        <td class="c-who"><span class="whoin">${ava(b.who)}${b.who.split(' ')[0]}</span></td>
        <td class="c-when"><span class="w2"><b>${ago(b.d)}</b><small>${dShort(b.d)}</small></span></td>
        <td class="c-st">${sBadge(b.status)}${b.status !== 'open' ? `<small class="st-by">${ago(b.at)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> segnalazioni</span></div></section>`;
  };
  const bugB = () => {
    const cols = [['Bug aperti', (b) => b.status === 'open' && b.kind === 'bug', 'k-bug', BUG], ['Funzionalità richieste', (b) => b.status === 'open' && b.kind === 'feature', 'k-feat', IDEA], ['Chiuse di recente', (b) => b.status !== 'open', 'k-done', tick]];
    return `${bHead()}<div class="board">${cols.map(([l, f, cls, icon]) => { const items = BUGS.filter(f); return `<section class="bcol ${cls}" aria-label="${l}"><header><span class="bci">${icon}</span><h2>${l}</h2><span class="bcn">${items.length}</span></header>
      <div class="bcards">${items.map((b) => `<button type="button" class="bcard${openBug === b.id ? ' on' : ''}" data-bopen="${b.id}">${b.shot ? shotThumb(b) : ''}<b>${esc(firstLine(b.text))}</b><span class="bmeta"><span class="sec">${SECTIONS[b.section]}</span><span class="whoin">${ava(b.who)}${ago(b.d)}</span></span>${b.status !== 'open' ? `<span class="bdone">${sBadge(b.status)} da ${b.by.split(' ')[0]} · ${ago(b.at)}</span>` : ''}</button>`).join('') || '<p class="none">Niente qui.</p>'}</div></section>`; }).join('')}</div>`;
  };

  // ── Pannello di dettaglio (segnalazione) ────────────────────────
  const renderDrawer = () => {
    const b = BUGS.find((x) => x.id === openBug); if (!b) return;
    $('[data-md="id"]').textContent = `#${b.id}`; $('[data-md="st"]').innerHTML = sBadge(b.status); $('[data-md="title"]').textContent = firstLine(b.text); $('[data-md="sub"]').textContent = `${KIND[b.kind][0]} · ${SECTIONS[b.section]} · ${ago(b.d)}`;
    $('[data-mtabs]').innerHTML = '';
    $('[data-mbody]').innerHTML = `<div class="drawer-body int-body">
      ${b.status === 'rejected' ? `<section class="ct-sec"><div class="callout"><div><b>Rifiutata da ${b.by} · ${ago(b.at)}</b><span>${esc(b.reason)}</span></div></div></section>` : b.status === 'resolved' ? `<section class="ct-sec"><div class="callout ok"><div><b>Risolta da ${b.by} · ${ago(b.at)}</b><span>Chi l'ha segnalata ha ricevuto la notifica.</span></div></div></section>` : ''}
      <section class="ct-sec"><div class="h"><h4>Descrizione</h4>${kBadge(b.kind)}</div><p class="bdesc">${esc(b.text).replace(/\n/g, '<br>')}</p></section>
      ${b.shot ? `<section class="ct-sec"><div class="h"><h4>Screenshot</h4><button class="lnk" type="button">Apri a tutto schermo</button></div>${shotThumb(b, true)}</section>` : (b.who === ME && b.status === 'open' ? `<section class="ct-sec"><div class="h"><h4>Screenshot</h4></div><label class="drop-sm">${ic('upload')}<span><b>Aggiungi uno screenshot</b> · trascinalo qui o incollalo con Ctrl+V</span></label></section>` : '')}
      <section class="ct-sec"><div class="h"><h4>Storia</h4></div><div class="feed"><div class="ev">${ic('plus')}<span><b>${b.who}</b> l'ha aperta</span><time>${dShort(b.d)}</time></div>${b.status !== 'open' ? `<div class="ev">${ic(b.status === 'resolved' ? 'check' : 'x')}<span><b>${b.by}</b> l'ha ${b.status === 'resolved' ? 'risolta' : 'rifiutata'}</span><time>${dShort(b.at)}</time></div>` : ''}</div></section></div>
      <div class="drawer-foot">${b.status === 'open' ? `<button class="btn btn-danger-o" type="button" data-breject="${b.id}">Rifiuta</button><span class="g-spacer"></span><button class="btn btn-primary" type="button" data-bresolve="${b.id}">${ic('check')}Segna come risolta</button>` : '<span class="g-spacer"></span><button class="btn" type="button">Riapri</button>'}</div>`;
  };
  const openD = (id) => { openBug = id; drawer.hidden = false; shell.classList.add('has-drawer'); render(); renderDrawer(); };
  const closeD = () => { openBug = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  $('[data-mclose-d]').addEventListener('click', closeD);

  // ── Dialoghi ────────────────────────────────────────────────────
  const mdl = $('[data-mdl]'); const box = mdl.querySelector('.mdl');
  const paintDlg = () => {
    if (!dlg) { mdl.hidden = true; return; }
    mdl.hidden = false; box.className = `mdl cb-mdl cb-${dlg.kind}`;
    if (dlg.kind === 'purge') {
      const items = TRASH.filter((r) => dlg.ids.includes(r.id)); const ok = items.filter((r) => !r.purgeBlock); const no = items.filter((r) => r.purgeBlock);
      box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">${ok.length === 1 && !no.length ? `Eliminare definitivamente «${esc(ok[0].title)}»?` : `Eliminare definitivamente ${ok.length} elementi?`}</h3><p>Non si può annullare: i dati spariscono da Archie. Nel registro Audit resta la traccia dell'eliminazione.</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="rp-body">${ok.length ? `<ul class="plist">${ok.map((r) => `<li>${ic(TYPES[r.type][1])}<span><b>${esc(r.title)}</b> · ${TYPES[r.type][2].toLowerCase()}</span></li>`).join('')}</ul>` : ''}
        ${no.length ? `<div class="callout warn"><div><b>${no.length === 1 ? 'Questo resta nel cestino' : `${no.length} restano nel cestino`}</b><span>${no.map((r) => `${esc(r.title)}: ${esc(r.purgeBlock)}`).join('<br>')}</span></div></div>` : ''}
        <label class="ack"><input type="checkbox" data-ack ${dlg.ack ? 'checked' : ''}><span>Ho capito che non si possono recuperare</span></label></div>
        <div class="nc-foot"><span class="sp"></span><button class="btn btn-ghost" type="button" data-dclose>Annulla</button><button class="btn btn-danger" type="button" data-dpurge ${dlg.ack && ok.length ? '' : 'disabled'}>Elimina definitivamente${ok.length > 1 ? ` ${ok.length}` : ''}</button></div>`;
    } else if (dlg.kind === 'new') {
      box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Segnala</h3><p>Un problema da correggere o un'idea per migliorare Archie.</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="rp-body"><div class="kcards" role="radiogroup" aria-label="Tipo">${['bug', 'feature'].map((k) => `<button type="button" role="radio" aria-checked="${dlg.k === k}" data-dk="${k}" class="kcard ${KIND[k][1]}"><span class="kci">${KIND[k][2]}</span><b>${k === 'bug' ? 'Qualcosa non funziona' : 'Vorrei una funzionalità'}</b><small>${k === 'bug' ? 'un errore, un dato sbagliato, un blocco' : 'un miglioramento o qualcosa che manca'}</small></button>`).join('')}</div>
        <div class="f"><span class="lbl">Dove</span><div class="chips">${['dashboard', 'issues', 'maintenance', 'customers', 'inventory', 'wiki', 'drive', 'search', 'other'].map((s) => `<button type="button" class="chip" aria-pressed="${dlg.s === s}" data-ds="${s}">${SECTIONS[s]}</button>`).join('')}</div></div>
        <div class="f"><label for="cb-d">${dlg.k === 'bug' ? 'Cosa succede?' : 'Cosa ti servirebbe?'} <span class="req">*</span></label><textarea id="cb-d" data-dtext placeholder="${dlg.k === 'bug' ? 'Cosa stavi facendo, cosa ti aspettavi e cosa è successo invece' : 'Descrivi cosa vorresti fare e perché ti sarebbe utile'}">${esc(dlg.t || '')}</textarea></div>
        <div class="f"><span class="lbl">Screenshot <span class="opt">· facoltativo</span></span><label class="drop-sm">${ic('upload')}<span><b>Trascina qui l'immagine</b>, sfoglia o incollala con Ctrl+V</span><input type="file" accept="image/*" hidden></label></div></div>
        <div class="nc-foot"><span class="hint">Ti avvisiamo quando viene risolta.</span><span class="sp"></span><button class="btn btn-ghost" type="button" data-dclose>Annulla</button><button class="btn btn-primary" type="button" data-dsend ${dlg.t && dlg.t.trim() ? '' : 'disabled'}>${ic('arrowR')}Invia</button></div>`;
    } else if (dlg.kind === 'reject') {
      box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Rifiuta la segnalazione</h3><p>Il motivo arriva a chi l'ha aperta.</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="rp-body"><div class="f"><span class="lbl">Motivi frequenti</span><div class="chips">${['Funziona come previsto.', 'Non riusciamo a riprodurlo: puoi aggiungere uno screenshot?', 'Già segnalato.', 'Non rientra nei piani per ora.'].map((q) => `<button type="button" class="chip" data-dq="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>
        <div class="f"><label for="cb-r">Motivo <span class="req">*</span></label><textarea id="cb-r" data-dreason>${esc(dlg.r || '')}</textarea></div></div>
        <div class="nc-foot"><span class="sp"></span><button class="btn btn-ghost" type="button" data-dclose>Annulla</button><button class="btn btn-danger" type="button" data-dreject ${dlg.r && dlg.r.trim() ? '' : 'disabled'}>Rifiuta</button></div>`;
    }
  };

  // ── Toast ───────────────────────────────────────────────────────
  const toast = $('[data-toast]'); let tt;
  const say = (m) => { toast.innerHTML = `${tick}<span>${m}</span><button type="button">Annulla</button>`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 5000); };

  // ── Render ──────────────────────────────────────────────────────
  const NAMES = { trash: { a: 'Tabella', b: 'Per giorno' }, bug: { a: 'Elenco', b: 'Bacheca' } };
  const render = () => {
    setNav(page === 'trash' ? 'Cestino' : 'Bug e feature');
    root.innerHTML = page === 'trash' ? (variant.trash === 'b' ? trashB() : trashA()) : (variant.bug === 'b' ? bugB() : bugA());
    document.querySelectorAll('[data-cbp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cbp === page)));
    document.querySelectorAll('[data-cbv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cbv === variant[page])));
    $('[data-cbv-name]').textContent = NAMES[page][variant[page]];
    paintDlg();
  };

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.tsel) { const id = Number(t.dataset.tsel); if (t.checked) sel.add(id); else sel.delete(id); render(); }
    if (t.matches('[data-tall]')) { tVisible().forEach((r) => (t.checked ? sel.add(r.id) : sel.delete(r.id))); render(); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-bopen]'); if (!b) return;
    if (b.dataset.tview) { tView = b.dataset.tview; return render(); }
    if (b.matches('[data-tblock]')) { tView = tView === 'blocked' ? 'all' : 'blocked'; return render(); }
    if (b.matches('[data-tunsel]')) { sel.clear(); return render(); }
    if (b.dataset.trestore) { const r = TRASH.find((x) => x.id === Number(b.dataset.trestore)); const n = r.batch ? TRASH.filter((x) => x.batch === r.batch).length : 1; TRASH.splice(0, TRASH.length, ...TRASH.filter((x) => (r.batch ? x.batch !== r.batch : x.id !== r.id))); TRASH.forEach((x) => { if (x.restoreBlock && r.batch === 'imola') delete x.restoreBlock; }); say(n > 1 ? `«${r.title}» ripristinato con ${n - 1} elementi collegati.` : `«${r.title}» ripristinato.`); return render(); }
    if (b.matches('[data-trestore-sel]')) { const n = sel.size; TRASH.splice(0, TRASH.length, ...TRASH.filter((x) => !sel.has(x.id) || x.restoreBlock)); sel.clear(); say(`${n} elementi ripristinati.`); return render(); }
    if (b.dataset.tpurge) { dlg = { kind: 'purge', ids: [Number(b.dataset.tpurge)] }; return paintDlg(); }
    if (b.matches('[data-tpurge-sel]')) { dlg = { kind: 'purge', ids: [...sel] }; return paintDlg(); }
    if (b.matches('[data-tpurge-all]')) { dlg = { kind: 'purge', ids: TRASH.map((r) => r.id) }; return paintDlg(); }
    if (b.dataset.bview) { bView = b.dataset.bview; return render(); }
    if (b.dataset.bopen) return openD(Number(b.dataset.bopen));
    if (b.matches('[data-bnew]')) { dlg = { kind: 'new', k: 'bug', s: 'dashboard', t: '' }; return paintDlg(); }
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-bopen]')) openD(Number(e.target.dataset.bopen)); });
  $('[data-mbody]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bresolve) { const x = BUGS.find((y) => y.id === Number(b.dataset.bresolve)); Object.assign(x, { status: 'resolved', by: ME, at: NOW }); say('Segnalazione risolta: chi l\'ha aperta riceve la notifica.'); render(); renderDrawer(); }
    if (b.dataset.breject) { dlg = { kind: 'reject', id: Number(b.dataset.breject), r: '' }; paintDlg(); }
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-dclose]')) { dlg = null; return paintDlg(); }
    if (b.dataset.dk) { dlg.k = b.dataset.dk; return paintDlg(); }
    if (b.dataset.ds) { dlg.s = b.dataset.ds; return paintDlg(); }
    if (b.dataset.dq) { dlg.r = (dlg.r ? `${dlg.r.trim()} ` : '') + b.dataset.dq; return paintDlg(); }
    if (b.matches('[data-dpurge]')) { const ok = TRASH.filter((r) => dlg.ids.includes(r.id) && !r.purgeBlock).map((r) => r.id); TRASH.splice(0, TRASH.length, ...TRASH.filter((r) => !ok.includes(r.id))); ok.forEach((id) => sel.delete(id)); dlg = null; toast.innerHTML = `${tick}<span>${ok.length === 1 ? 'Elemento eliminato definitivamente.' : `${ok.length} elementi eliminati definitivamente.`}</span>`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 4000); return render(); }
    if (b.matches('[data-dsend]')) { BUGS.unshift(B(dlg.k, dlg.s, dlg.t.trim(), '2026-11-08 10:30', ME)); dlg = null; bView = 'mine'; say('Segnalazione inviata. Ti avvisiamo quando viene gestita.'); return render(); }
    if (b.matches('[data-dreject]')) { const x = BUGS.find((y) => y.id === dlg.id); Object.assign(x, { status: 'rejected', by: ME, at: NOW, reason: dlg.r.trim() }); dlg = null; render(); return renderDrawer(); }
  });
  box.addEventListener('input', (e) => {
    if (e.target.matches('[data-dtext]')) { dlg.t = e.target.value; box.querySelector('[data-dsend]').disabled = !dlg.t.trim(); }
    if (e.target.matches('[data-dreason]')) { dlg.r = e.target.value; box.querySelector('[data-dreject]').disabled = !dlg.r.trim(); }
    if (e.target.matches('[data-ack]')) { dlg.ack = e.target.checked; paintDlg(); }
  });
  box.addEventListener('change', (e) => { if (e.target.matches('[data-ack]')) { dlg.ack = e.target.checked; paintDlg(); } });
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) { dlg = null; paintDlg(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (dlg) { dlg = null; paintDlg(); } else if (openBug) closeD(); } });

  document.querySelectorAll('[data-cbp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.cbp; if (openBug) closeD(); try { localStorage.setItem('archie-preview-cb-p', page); } catch { /* niente */ } render(); }));
  document.querySelectorAll('[data-cbv]').forEach((b) => b.addEventListener('click', () => { variant[page] = b.dataset.cbv; try { localStorage.setItem(page === 'trash' ? 'archie-preview-cb-vt' : 'archie-preview-cb-vb', variant[page]); } catch { /* niente */ } render(); }));
  render();
})();
