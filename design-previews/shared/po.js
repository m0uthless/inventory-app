/* Pagina Purchase Order (anteprima sulla base h).
   Modello reale: PurchaseOrderEntry (offer_date, description, client_name = Committente,
   customer / customer_placeholder = Cliente collegato, kind ordinario|extra, status
   inserito → inviato → ricevuto → fatturato, purchase_order, invoice_number,
   amount_mode fisso|giornate, days, daily_rate, amount, costs_incurred, notes) e
   PurchaseOrderDocument (kind offer|po|invoice, più PDF per tipo).
   Descrizione e importo sono bloccati fuori da "inserito". Dati finti. Oggi: 03/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const html = document.documentElement;
  const TODAY = new Date(2026, 10, 3);
  const DAY = 864e5;
  const eur = (n, d = 0) => '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const eur2 = (n) => eur(n, 2);
  const dt = (s) => { if (!s) return null; const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  const ago = (s) => Math.round((TODAY - dt(s)) / DAY);
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // Nav: pagina attiva
  document.querySelectorAll('.nav-item').forEach((a) => {
    const t = a.textContent.trim();
    a.classList.toggle('is-active', t.startsWith('Purchase Order'));
    if (t.startsWith('Purchase Order')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  const ST = ['inserito', 'inviato', 'ricevuto', 'fatturato'];
  const STL = { inserito: 'Inserito', inviato: 'Inviato', ricevuto: 'Ricevuto', fatturato: 'Fatturato' };
  const KL = { ordinario: 'Ordinario', extra: 'Extra' };
  // Committenti: colore di riconoscimento fisso per nome (come committenteColor nell'app)
  const CMT = { 'MedSys Italia': '#3f7fbf', 'Radiologia Integrata': '#b4673a', 'AUSL Bologna': '#2e8b6e', 'DiagnoTech': '#8a5bb8', 'Gruppo Sanitas': '#b0435e' };

  const ROWS = [
    { id: 231, offer: '28/10/2026', cmt: 'MedSys Italia', desc: 'Migrazione worklist RIS → nuovo gateway MWL', cust: 'AUSL Imola', kind: 'extra', st: 'inserito', po: '', inv: '', mode: 'giornate', days: 4, rate: 650, cost: null, sent: '', rec: '', fat: '', docs: { offer: [['offerta-231-v1.pdf', '28/10/2026']], po: [], invoice: [] }, notes: 'Da confermare la finestra con il reparto prima dell\'invio.' },
    { id: 229, offer: '24/10/2026', cmt: 'Radiologia Integrata', desc: 'Installazione stazione di refertazione aggiuntiva', ph: 'Centro Diagnostico Valli', kind: 'extra', st: 'inserito', po: '', inv: '', mode: 'fisso', amount: 3200, cost: 1450, sent: '', rec: '', fat: '', docs: { offer: [], po: [], invoice: [] }, notes: '' },
    { id: 227, offer: '20/10/2026', cmt: 'AUSL Bologna', desc: 'Formazione tecnici di radiologia su nuovo PACS', cust: 'AUSL Bologna', kind: 'ordinario', st: 'inserito', po: '', inv: '', mode: 'giornate', days: 3, rate: 600, cost: null, sent: '', rec: '', fat: '', docs: { offer: [['offerta-formazione.pdf', '20/10/2026']], po: [], invoice: [] }, notes: '' },
    { id: 224, offer: '14/10/2026', cmt: 'MedSys Italia', desc: 'Upgrade storage VNA nodo 2 (+40 TB)', cust: 'Centro Medico Esperia', kind: 'extra', st: 'inviato', po: '', inv: '', mode: 'fisso', amount: 12400, cost: 8900, sent: '15/10/2026', rec: '', fat: '', docs: { offer: [['offerta-vna-40tb.pdf', '14/10/2026']], po: [], invoice: [] }, notes: 'Il cliente chiede consegna entro fine novembre.' },
    { id: 219, offer: '02/10/2026', cmt: 'DiagnoTech', desc: 'Integrazione DICOM SR dose con sistema di registro', cust: 'ASUFC Udine', kind: 'extra', st: 'inviato', po: '', inv: '', mode: 'giornate', days: 6, rate: 650, cost: null, sent: '03/10/2026', rec: '', fat: '', docs: { offer: [['offerta-dose-sr.pdf', '02/10/2026']], po: [], invoice: [] }, notes: '' },
    { id: 215, offer: '22/09/2026', cmt: 'Gruppo Sanitas', desc: 'Assistenza straordinaria cambio sede archivio', cust: 'Casa di Cura Rocca', kind: 'extra', st: 'ricevuto', po: 'PO-GS-26/0418', inv: '', mode: 'fisso', amount: 5800, cost: 640, sent: '23/09/2026', rec: '08/10/2026', fat: '', docs: { offer: [['offerta-cambio-sede.pdf', '22/09/2026']], po: [['PO-GS-26-0418.pdf', '08/10/2026']], invoice: [] }, notes: '' },
    { id: 212, offer: '15/09/2026', cmt: 'AUSL Bologna', desc: 'Canone manutenzione PACS · secondo semestre', cust: 'AUSL Bologna', kind: 'ordinario', st: 'ricevuto', po: '4500213377', inv: '', mode: 'fisso', amount: 8800, cost: null, sent: '15/09/2026', rec: '30/09/2026', fat: '', docs: { offer: [['offerta-canone-s2.pdf', '15/09/2026']], po: [['ordine-4500213377.pdf', '30/09/2026']], invoice: [] }, notes: '' },
    { id: 208, offer: '01/09/2026', cmt: 'Radiologia Integrata', desc: 'Configurazione VPN per teleradiologia notturna', cust: 'IRCCS Rizzoli', kind: 'extra', st: 'fatturato', po: 'RI-2026-117', inv: 'FT 2026/0912', mode: 'giornate', days: 2, rate: 650, cost: 120, sent: '02/09/2026', rec: '10/09/2026', fat: '30/09/2026', docs: { offer: [['offerta-vpn.pdf', '01/09/2026']], po: [['RI-2026-117.pdf', '10/09/2026']], invoice: [['FT-2026-0912.pdf', '30/09/2026']] }, notes: '' },
    { id: 203, offer: '18/07/2026', cmt: 'MedSys Italia', desc: 'Sostituzione switch rack radiologia', cust: 'ASUFC Udine', kind: 'extra', st: 'fatturato', po: 'MS-PO-8812', inv: 'FT 2026/0731', mode: 'fisso', amount: 4300, cost: 2950, sent: '20/07/2026', rec: '27/07/2026', fat: '31/07/2026', docs: { offer: [['offerta-switch.pdf', '18/07/2026']], po: [['MS-PO-8812.pdf', '27/07/2026']], invoice: [['FT-2026-0731.pdf', '31/07/2026']] }, notes: '' },
    { id: 198, offer: '10/06/2026', cmt: 'AUSL Bologna', desc: 'Canone manutenzione PACS · primo semestre', cust: 'AUSL Bologna', kind: 'ordinario', st: 'fatturato', po: '4500198021', inv: 'FT 2026/0630', mode: 'fisso', amount: 8800, cost: null, sent: '10/06/2026', rec: '18/06/2026', fat: '30/06/2026', docs: { offer: [['offerta-canone-s1.pdf', '10/06/2026']], po: [['ordine-4500198021.pdf', '18/06/2026']], invoice: [['FT-2026-0630.pdf', '30/06/2026']] }, notes: '' },
    { id: 191, offer: '12/05/2026', cmt: 'DiagnoTech', desc: 'Collaudo modalità MR nuova installazione', cust: 'AUSL Imola', kind: 'extra', st: 'fatturato', po: 'DT/26/0077', inv: 'FT 2026/0529', mode: 'giornate', days: 3, rate: 650, cost: 310, sent: '13/05/2026', rec: '19/05/2026', fat: '29/05/2026', docs: { offer: [['offerta-collaudo-mr.pdf', '12/05/2026']], po: [], invoice: [['FT-2026-0529.pdf', '29/05/2026']] }, notes: 'PDF del PO mai ricevuto: conferma via email del 19/05.' },
    { id: 184, offer: '03/03/2026', cmt: 'Gruppo Sanitas', desc: 'Aggiornamento licenze workstation refertazione', cust: 'Casa di Cura Rocca', kind: 'ordinario', st: 'fatturato', po: 'PO-GS-26/0102', inv: 'FT 2026/0331', mode: 'fisso', amount: 6900, cost: 5200, sent: '04/03/2026', rec: '12/03/2026', fat: '31/03/2026', docs: { offer: [['offerta-licenze.pdf', '03/03/2026']], po: [['PO-GS-26-0102.pdf', '12/03/2026']], invoice: [['FT-2026-0331.pdf', '31/03/2026']] }, notes: '' },
  ];
  const amt = (r) => r.mode === 'giornate' ? r.days * r.rate : r.amount;
  const PREV_YEAR = 54200; // totale 2025, per la variazione annua
  const custLabel = (r) => r.cust ? r.cust : `<span class="ph">${r.ph}<small>non in anagrafica</small></span>`;
  const psBadge = (st) => `<span class="ps ps-${st}"><span class="steps4" aria-hidden="true">${ST.map((s, i) => `<i class="${i <= ST.indexOf(st) ? 'on' : ''}"></i>`).join('')}</span>${STL[st]}</span>`;
  const kindChip = (k) => `<span class="kind kind-${k}">${KL[k]}</span>`;
  const cmtChip = (c) => `<span class="cmt"><span class="dot" style="background:${CMT[c] || 'var(--muted)'}"></span>${c}</span>`;
  const sinceStep = (r) => { const d = r.st === 'inserito' ? r.offer : r.st === 'inviato' ? r.sent : r.st === 'ricevuto' ? r.rec : r.fat; return ago(d); };

  // ── Indicatori ───────────────────────────────────────────────────
  const kpiWrap = $('[data-po-kpis]');
  const renderKpis = () => {
    const tot = ROWS.reduce((s, r) => s + amt(r), 0);
    const byS = (st) => ROWS.filter((r) => st.includes(r.st));
    const sum = (a) => a.reduce((s, r) => s + amt(r), 0);
    const toSend = byS(['inserito']); const wait = byS(['inviato', 'ricevuto']); const toInv = byS(['ricevuto']); const done = byS(['fatturato']);
    const delta = (tot - PREV_YEAR) / PREV_YEAR * 100;
    const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov'];
    const cum = months.map((_, m) => ROWS.filter((r) => dt(r.offer).getMonth() <= m).reduce((s, r) => s + amt(r), 0));
    const W = 84, H = 30, mx = Math.max(...cum);
    const pts = cum.map((v, i) => `${(i / (cum.length - 1) * W).toFixed(1)},${(H - v / mx * (H - 2)).toFixed(1)}`);
    const pipe = ST.map((s) => [s, sum(byS([s]))]);
    const ptot = pipe.reduce((a, b) => a + b[1], 0);
    const seq = { inserito: 'var(--seq-1)', inviato: 'var(--seq-2)', ricevuto: 'var(--seq-3)', fatturato: 'var(--seq-4)' };
    kpiWrap.innerHTML = `<div class="kpis" role="group" aria-label="Indicatori Purchase Order">
      <div class="kpi"><span class="kpi-h">Totale 2026</span><span class="kpi-v">${eur(tot)}</span>
        <span class="kpi-s"><span class="up">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</span>vs ${eur(PREV_YEAR)} nel 2025</span>
        <svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="area" d="M0,${H} L${pts.join(' L')} L${W},${H}Z"/><path class="line" d="M${pts.join(' L')}"/><circle class="end" cx="${W}" cy="${pts.at(-1).split(',')[1]}" r="3"/></svg></div>
      <button type="button" class="kpi" data-goview="send"><span class="kpi-h">Da inviare<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${toSend.length}<small>${eur(sum(toSend))}</small></span><span class="kpi-s">offerte in stato Inserito</span></button>
      <button type="button" class="kpi" data-goview="wait"><span class="kpi-h">In attesa del PO<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${byS(['inviato']).length}<small>${eur(sum(byS(['inviato'])))}</small></span><span class="kpi-s">${(() => { const o = byS(['inviato']).sort((a, b) => dt(a.sent) - dt(b.sent))[0]; return o ? `la più vecchia da <b>${ago(o.sent)} giorni</b>` : 'nessuna'; })()}</span></button>
      <button type="button" class="kpi" data-goview="inv"><span class="kpi-h">Da fatturare<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${toInv.length}<small>${eur(sum(toInv))}</small></span><span class="kpi-s">PO ricevuto, fattura da emettere</span></button>
      <div class="kpi kpi-prio"><span class="kpi-h">Avanzamento 2026 · ${eur(ptot)}</span>
        <div class="bar" aria-hidden="true">${pipe.map(([s, v]) => `<span style="flex:${v};background:${seq[s]}" data-tip="${STL[s]} · <b>${eur(v)}</b>"></span>`).join('')}</div>
        <div class="lg">${pipe.map(([s, v]) => `<button type="button" data-goview="${s === 'inserito' ? 'send' : s === 'inviato' ? 'wait' : s === 'ricevuto' ? 'inv' : 'done'}"><i style="background:${seq[s]}"></i>${STL[s]} <b>${Math.round(v / ptot * 100)}%</b></button>`).join('')}</div></div>
    </div>`;
  };

  // ── Viste, colonne, filtri ───────────────────────────────────────
  const VIEWS = [['all', 'Tutti', () => true], ['send', 'Da inviare', (r) => r.st === 'inserito'], ['wait', 'In attesa del PO', (r) => r.st === 'inviato'], ['inv', 'Da fatturare', (r) => r.st === 'ricevuto'], ['done', 'Fatturati', (r) => r.st === 'fatturato']];
  let view = 'all';
  const COLS = [
    { k: 'c-date', l: 'Data offerta', cmp: (a, b) => dt(a.offer) - dt(b.offer) },
    { k: 'c-cmt', l: 'Committente · cliente', set: (r) => r.cmt, cmp: (a, b) => a.cmt.localeCompare(b.cmt) },
    { k: 'c-desc', l: 'Descrizione', cmp: (a, b) => a.desc.localeCompare(b.desc) },
    { k: 'c-kind', l: 'Tipo', set: (r) => KL[r.kind], cmp: (a, b) => a.kind.localeCompare(b.kind) },
    { k: 'c-st', l: 'Stato', set: (r) => STL[r.st], cmp: (a, b) => ST.indexOf(a.st) - ST.indexOf(b.st) },
    { k: 'c-ref', l: 'PO · fattura', set: (r) => r.inv ? 'Fattura emessa' : r.po ? 'Solo PO' : 'Senza PO', cmp: (a, b) => (a.po || '~').localeCompare(b.po || '~') },
    { k: 'c-amt', l: 'Importo', num: true, cmp: (a, b) => amt(a) - amt(b) },
  ];
  const filters = {}; let sort = { k: 'c-date', dir: -1 };
  const headRow = $('[data-po-head]'); const tbody = $('[data-po-rows]');
  const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
  const arrow = (d) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d > 0 ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'}"/></svg>`;
  const paintHead = () => {
    headRow.innerHTML = COLS.map((c) => `<th class="${c.k}${c.num ? ' num-r' : ''}" data-col="${c.k}"><div class="th-in"><button type="button" class="th-sort${sort.k === c.k ? ' is-on' : ''}" data-sort="${c.k}">${c.l}${sort.k === c.k ? arrow(sort.dir) : ''}</button>${c.set ? `<button type="button" class="th-filter${filters[c.k]?.size ? ' is-on' : ''}" data-filter="${c.k}" aria-label="Filtra ${c.l}" title="Filtra ${c.l}">${funnel}</button>` : ''}</div></th>`).join('');
  };
  const visible = () => ROWS.filter(VIEWS.find((v) => v[0] === view)[2]).filter((r) => Object.entries(filters).every(([k, s]) => !s.size || s.has(COLS.find((c) => c.k === k).set(r))));
  let selected = null;
  const renderRows = () => {
    const c = COLS.find((x) => x.k === sort.k);
    const rows = visible().sort((a, b) => sort.dir * c.cmp(a, b) || b.id - a.id);
    tbody.innerHTML = rows.map((r) => `<tr data-id="${r.id}" tabindex="0" class="${r.id === selected ? 'is-selected' : ''}">
      <td class="c-date">${r.offer}</td>
      <td class="c-cmt">${cmtChip(r.cmt)}<span class="cust2">${ic('arrowR')}${custLabel(r)}</span></td>
      <td class="c-desc"><b>${r.desc}</b></td>
      <td class="c-kind">${kindChip(r.kind)}</td>
      <td class="c-st">${psBadge(r.st)}</td>
      <td class="c-ref">${r.po ? `<span class="code">${r.po}</span>` : '<span class="none">PO —</span>'}${r.inv ? `<span class="code ft2">${r.inv}</span>` : r.po ? '<span class="inv-no ft2">fattura da emettere</span>' : ''}</td>
      <td class="c-amt num-r"><b>${eur2(amt(r))}</b>${r.mode === 'giornate' ? `<small>${r.days} gg × ${eur(r.rate)}</small>` : ''}</td>
    </tr>`).join('') || `<tr><td colspan="${COLS.length}" style="height:96px;text-align:center;color:var(--muted)">Nessun Purchase Order con questi filtri.</td></tr>`;
    const s = rows.reduce((a, r) => a + amt(r), 0); const cst = rows.reduce((a, r) => a + (r.cost || 0), 0);
    $('[data-po-foot]').innerHTML = `<span><b>${rows.length}</b> di ${ROWS.length} PO</span><span>Totale <b>${eur2(s)}</b></span><span>Costi sostenuti <b>${eur2(cst)}</b></span><span class="sp"></span><span>dati fittizi</span>`;
    paintTokens(); paintViews();
  };
  const paintViews = () => {
    $('[data-po-views]').innerHTML = VIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === view}" data-view="${k}">${l} <span>${ROWS.filter(f).length}</span></button>`).join('');
  };
  const paintTokens = () => {
    const t = Object.entries(filters).filter(([, s]) => s.size).map(([k, s]) => `<span class="token"><span class="tk">${COLS.find((c) => c.k === k).l}</span> <b>${[...s].join(', ')}</b><button type="button" class="tk-x" data-unf="${k}" aria-label="Rimuovi filtro">${ic('x')}</button></span>`);
    $('[data-po-tokens]').innerHTML = t.length ? t.join('') + '<button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button>' : '<span class="none" style="font-size:12px">Filtra e ordina dalle intestazioni di colonna</span>';
  };
  $('[data-po-views]').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { view = b.dataset.view; renderRows(); } });
  kpiWrap.addEventListener('click', (e) => { const b = e.target.closest('[data-goview]'); if (b) { view = b.dataset.goview; renderRows(); } });
  $('[data-po-tokens]').addEventListener('click', (e) => { const b = e.target.closest('[data-unf]'); if (!b) return; if (b.dataset.unf === '*') Object.keys(filters).forEach((k) => delete filters[k]); else delete filters[b.dataset.unf]; paintHead(); renderRows(); });

  // Popover filtro di colonna
  const cpop = document.createElement('div'); cpop.className = 'cpop'; cpop.hidden = true; document.body.appendChild(cpop);
  headRow.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sort]');
    if (s) { sort = sort.k === s.dataset.sort ? { k: s.dataset.sort, dir: -sort.dir } : { k: s.dataset.sort, dir: 1 }; paintHead(); renderRows(); return; }
    const f = e.target.closest('[data-filter]'); if (!f) return; e.stopPropagation();
    const c = COLS.find((x) => x.k === f.dataset.filter); const cur = filters[c.k] || new Set();
    const vals = [...new Set(ROWS.map(c.set))].sort((a, b) => a.localeCompare(b, 'it'));
    cpop.innerHTML = `<div class="srt"><button type="button" data-cs="1">Crescente</button><button type="button" data-cs="-1">Decrescente</button></div>
      ${vals.map((v) => `<label><input type="checkbox" value="${v}"${cur.has(v) ? ' checked' : ''}>${v}<small>${ROWS.filter((r) => c.set(r) === v).length}</small></label>`).join('')}
      <div class="cp-f"><button type="button" class="btn btn-ghost btn-sm" data-cclear>Rimuovi filtro</button><button type="button" class="btn btn-primary btn-sm" data-capply>Applica</button></div>`;
    cpop.dataset.k = c.k; const r = f.getBoundingClientRect();
    cpop.style.left = Math.min(r.right - 240, innerWidth - 256) + 'px'; cpop.style.top = (r.bottom + 6) + 'px'; cpop.hidden = false;
  });
  cpop.addEventListener('click', (e) => {
    const k = cpop.dataset.k;
    if (e.target.closest('[data-cs]')) { sort = { k, dir: Number(e.target.closest('[data-cs]').dataset.cs) }; }
    else if (e.target.closest('[data-cclear]')) delete filters[k];
    else if (e.target.closest('[data-capply]')) filters[k] = new Set([...cpop.querySelectorAll('input:checked')].map((i) => i.value));
    else return;
    cpop.hidden = true; paintHead(); renderRows();
  });
  document.addEventListener('click', (e) => { if (!cpop.hidden && !e.target.closest('.cpop')) cpop.hidden = true; });

  // ── Pannello di dettaglio ────────────────────────────────────────
  const drawer = $('[data-po-drawer]'); const body = $('[data-pbody]'); const pop = $('[data-ppop]');
  const shell = $('.shell'); let tab = 'det'; let ppOpen = false;
  const row = () => ROWS.find((r) => r.id === selected);
  const docCount = (r) => r.docs.offer.length + r.docs.po.length + r.docs.invoice.length;
  const events = (r) => {
    const ev = [['plus', 'F. Mutuale', `ha creato il PO (${KL[r.kind].toLowerCase()})`, r.offer]];
    if (r.sent) ev.push(['arrowR', 'F. Mutuale', 'ha segnato l\'offerta come <b>Inviata</b>', r.sent]);
    if (r.rec) ev.push(['download', 'L. Romano', `ha registrato il PO <span class="code">${r.po}</span>`, r.rec]);
    if (r.fat) ev.push(['receipt', 'Amministrazione', `ha registrato la fattura <span class="code">${r.inv}</span>`, r.fat]);
    (r.extra || []).forEach((x) => ev.push(x));
    return ev;
  };
  const NEXT = { inserito: ['inviato', 'Segna come inviato', 'arrowR'], inviato: ['ricevuto', 'Registra PO ricevuto', 'download'], ricevuto: ['fatturato', 'Registra fattura', 'receipt'] };
  const DOCK = { offer: 'Offerta', po: 'Purchase Order', invoice: 'Fattura' };

  const workflow = (r) => {
    const i = ST.indexOf(r.st);
    const days = r.st === 'fatturato' ? Math.round((dt(r.fat) - dt(r.offer)) / DAY) : sinceStep(r);
    const waitL = { inserito: 'Offerta da inviare da', inviato: 'In attesa del PO da', ricevuto: 'Fattura da emettere da', fatturato: 'Ciclo completato in' }[r.st];
    const warn = (r.st === 'inviato' && days > 21) || (r.st === 'ricevuto' && days > 14) || (r.st === 'inserito' && days > 7);
    const steps = [
      ['inserito', 'Offerta inserita', r.offer, 'offer'], ['inviato', 'Offerta inviata', r.sent, 'offer'],
      ['ricevuto', 'PO ricevuto', r.rec, 'po'], ['fatturato', 'Fatturato', r.fat, 'invoice'],
    ];
    return `<section class="wf" aria-label="Flusso">
      <div class="wf-wait"><div><span class="lbl">${waitL}</span><b>${days} ${days === 1 ? 'giorno' : 'giorni'}</b></div>${r.st !== 'fatturato' ? `<span class="flag${warn ? ' is-warn' : ''}">${warn ? 'Da sollecitare' : 'Nei tempi'}</span>` : ''}</div>
      ${steps.map(([s, l, d, dk], j) => {
        const done = j <= i; const cur = j === i + 1;
        const n = r.docs[dk].length; const showDoc = s !== 'inviato';
        const sub = j <= i ? `${d}${s === 'ricevuto' && r.po ? ` · <span class="code">${r.po}</span>` : ''}${s === 'fatturato' && r.inv ? ` · <span class="code">${r.inv}</span>` : ''}` : cur ? '<b class="nx">prossimo passo</b>' : 'da fare';
        return `<div class="wf-step${done ? ' done' : ''}${cur ? ' cur' : ''}"><span class="wf-dot">${done ? tick : j + 1}</span><div class="wf-t"><b>${l}</b><span>${sub}</span></div>${showDoc && j <= i ? `<button type="button" class="wf-doc ${n ? 'has' : 'miss'}" data-goto-docs>${ic('file')}${n ? `${DOCK[dk]} ${n > 1 ? '· ' + n : ''}` : `${DOCK[dk]} mancante`}</button>` : '<span></span>'}</div>`;
      }).join('')}
    </section>`;
  };

  const props = (r) => `<section class="pp${ppOpen ? ' is-open' : ''}" aria-label="Proprietà">
      <button type="button" class="pp-t" data-pp-toggle aria-expanded="${ppOpen}"><span class="pp-pm" aria-hidden="true"></span><span class="pp-tl">Proprietà</span>
        <span class="pp-sum">${ppOpen ? '<span class="pp-hint">clic su un valore per modificarlo · si salva subito</span>' : `${kindChip(r.kind)}${cmtChip(r.cmt)}`}</span></button>
      <div class="pp-grid"${ppOpen ? '' : ' hidden'}>
        <button type="button" class="pp-i" data-edit="kind"><span class="k">Tipo</span><span class="v">${kindChip(r.kind)}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i" data-edit="offer"><span class="k">Data offerta</span><span class="v">${r.offer}</span>${ic('calendar')}</button>
        <button type="button" class="pp-i" data-edit="cmt"><span class="k">Committente</span><span class="v">${cmtChip(r.cmt)}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i" data-edit="po"><span class="k">PO</span><span class="v code">${r.po || '<span class="none">—</span>'}</span>${ic('wrench')}</button>
        <button type="button" class="pp-i" data-edit="cust"><span class="k">Cliente</span><span class="v">${custLabel(r)}</span>${ic('chevD')}</button>
      </div></section>`;

  const amount = (r) => {
    const a = amt(r); const lock = r.st !== 'inserito';
    const marg = r.cost != null ? a - r.cost : null;
    return `<section class="amt"><div class="amt-h"><h4>Importo</h4>${lock ? `<span class="lock" title="Per modificarlo riporta il PO a Inserito">${ic('lock')}Bloccato dopo l'invio</span>` : `<button type="button" class="btn btn-sm" data-edit-amt>${ic('wrench')}Modifica</button>`}</div>
      <div class="amt-main"><b>${eur2(a)}</b><span>${r.mode === 'giornate' ? `${r.days} giornate × ${eur(r.rate)}` : 'valore fisso'}</span></div>
      <div class="amt-row"><div><span>Costi sostenuti</span><b>${r.cost != null ? eur2(r.cost) : '—'}</b></div><div><span>Margine</span><b class="${marg == null ? '' : marg >= 0 ? 'pos' : 'neg'}">${marg != null ? eur2(marg) : '—'}</b></div><div><span>Margine %</span><b>${marg != null ? Math.round(marg / a * 100) + '%' : '—'}</b></div></div>
    </section>
    <section><h4>Descrizione</h4><p class="desc-p">${r.desc}</p>${r.notes ? `<p class="note-p">${r.notes}</p>` : ''}</section>`;
  };

  const docs = (r) => `<label class="drop">${ic('download')}<span><b>Trascina qui i PDF</b> o <u>sfoglia</u><small>Scegli il tipo dopo il caricamento · più PDF per tipo</small></span><input type="file" multiple hidden accept="application/pdf"></label>
    ${['offer', 'po', 'invoice'].map((k) => `<div class="dg"><div class="dg-h"><h4>${DOCK[k]} <span>${r.docs[k].length}</span></h4><button type="button" class="btn btn-sm">${ic('plus')}Aggiungi</button></div>
      ${r.docs[k].length ? `<ul class="files">${r.docs[k].map(([n, d]) => `<li><span class="ft ft-pdf">PDF</span><div class="fn"><b>${n}</b><span>${d} · F. Mutuale</span></div><span></span><button class="icon-btn" type="button" aria-label="Scarica ${n}">${ic('download')}</button><button class="icon-btn" type="button" aria-label="Elimina ${n}">${ic('trash')}</button></li>`).join('')}</ul>` : `<div class="dg-empty">Nessun PDF${k === 'po' && r.st !== 'inserito' && r.st !== 'inviato' ? ' · il PO è registrato ma il documento non è stato caricato' : ''}</div>`}</div>`).join('')}`;

  const activity = (r) => `<div class="feed">${events(r).map(([i, w, t, d]) => `<div class="ev">${ic(i)}<span><b>${w}</b> ${t}</span><time>${d}</time></div>`).join('')}</div>`;

  const render = () => {
    const r = row(); if (!r) return;
    $('[data-pd="id"]').textContent = '#' + r.id;
    $('[data-pd="st"]').innerHTML = psBadge(r.st);
    $('[data-pd="title"]').textContent = r.desc;
    $('[data-pd="sub"]').innerHTML = `${r.cmt} ${ic('arrowR')} ${r.cust || r.ph}`;
    const vis = visible().map((x) => x.id); const ix = vis.indexOf(r.id);
    $('[data-pd="pos"]').textContent = ix < 0 ? '' : `${ix + 1} di ${vis.length}`;
    $('[data-ptabs]').innerHTML = `<button role="tab" data-tab="det" aria-selected="${tab === 'det'}">Dettagli</button><button role="tab" data-tab="doc" aria-selected="${tab === 'doc'}">Documenti <span class="tn">${docCount(r)}</span></button><button role="tab" data-tab="att" aria-selected="${tab === 'att'}">Attività <span class="tn">${events(r).length}</span></button>`;
    const nx = NEXT[r.st];
    const foot = tab === 'det'
      ? `<div class="drawer-foot">${r.st !== 'inserito' ? `<button class="btn" type="button" data-revert>${ic('chevL')}Torna a ${STL[ST[ST.indexOf(r.st) - 1]]}</button>` : ''}<span class="g-spacer"></span>${nx ? `<button class="btn btn-primary" type="button" data-advance>${ic(nx[2])}${nx[1]}</button>` : `<span class="foot-note">${tick} Completato il ${r.fat}</span>`}</div>`
      : tab === 'doc' ? '<div class="drawer-foot"><span class="foot-note">I PDF si possono caricare anche dopo il cambio di stato.</span><span class="g-spacer"></span><button class="btn btn-primary" type="button">' + ic('plus') + 'Carica PDF</button></div>' : '';
    body.innerHTML = `<div class="drawer-body int-body">${tab === 'det' ? props(r) + workflow(r) + amount(r) : tab === 'doc' ? docs(r) : activity(r)}</div>${foot}`;
  };
  const open = (id) => {
    selected = id; drawer.hidden = false; shell.classList.add('has-drawer');
    tbody.querySelectorAll('tr').forEach((t) => t.classList.toggle('is-selected', Number(t.dataset.id) === id));
    render();
  };
  const close = () => { drawer.hidden = true; selected = null; shell.classList.remove('has-drawer'); tbody.querySelectorAll('tr').forEach((t) => t.classList.remove('is-selected')); };
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); });
  tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); } });
  $('[data-pclose]').addEventListener('click', close);
  $('[data-ptabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  const step = (d) => { const vis = visible().sort((a, b) => sort.dir * COLS.find((x) => x.k === sort.k).cmp(a, b) || b.id - a.id).map((x) => x.id); const n = vis[vis.indexOf(selected) + d]; if (n) { open(n); tbody.querySelector(`tr[data-id="${n}"]`)?.scrollIntoView({ block: 'nearest' }); } };
  drawer.querySelectorAll('[data-pstep]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.pstep))));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('[data-mdl]').hidden) { $('[data-mdl]').hidden = true; return; }
    if (drawer.hidden || e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape') close(); if (e.key === 'j') step(1); if (e.key === 'k') step(-1);
  });

  // Toast con annulla
  const toast = $('[data-toast]'); let undo = null; let tt = null;
  const showToast = (msg, u) => { undo = u; toast.innerHTML = `${tick}<span>${msg}</span>${u ? '<button type="button" data-undo>Annulla</button>' : ''}`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 6000); };
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toast.hidden = true; } });
  const refresh = () => { renderKpis(); renderRows(); render(); };

  // Avanzamento con dialogo: chiede solo ciò che serve a quel passo (PDF sempre facoltativo)
  const mdl = $('[data-mdl]');
  const askAdvance = (r) => {
    const [to, label] = NEXT[r.st];
    const f = {
      inviato: `<div class="f"><label for="m-d">Data invio offerta</label><input id="m-d" value="03/11/2026"></div><div class="f"><label for="m-f">PDF dell'offerta <span class="opt">· facoltativo</span></label><input id="m-f" type="file" accept="application/pdf"></div>`,
      ricevuto: `<div class="f"><label for="m-n">Numero Purchase Order <span class="req">*</span></label><input id="m-n" class="mono" value="${r.po}" placeholder="es. 4500213377"></div><div class="f"><label for="m-d">Data ricezione</label><input id="m-d" value="03/11/2026"></div><div class="f"><label for="m-f">PDF del PO <span class="opt">· facoltativo</span></label><input id="m-f" type="file" accept="application/pdf"></div>`,
      fatturato: `<div class="f"><label for="m-n">Numero fattura <span class="req">*</span></label><input id="m-n" class="mono" value="${r.inv}" placeholder="es. FT 2026/1103"></div><div class="f"><label for="m-d">Data fattura</label><input id="m-d" value="03/11/2026"></div><div class="f"><label for="m-f">PDF della fattura <span class="opt">· facoltativo</span></label><input id="m-f" type="file" accept="application/pdf"></div>`,
    }[to];
    $('.mdl', mdl).innerHTML = `<div class="mdl-h"><h3 id="mdl-t">${label}</h3><p>#${r.id} · ${r.desc}</p></div><form class="mdl-b" data-mform>${f}${to === 'inviato' ? `<p class="note-p" style="margin:0">${ic('lock')} Dopo l'invio descrizione e importo non sono più modificabili.</p>` : ''}</form>
      <div class="mdl-f"><button class="btn btn-ghost" type="button" data-mclose>Annulla</button><button class="btn btn-primary" type="button" data-mok>${label}</button></div>`;
    mdl.hidden = false; $('#m-n', mdl)?.focus();
    $('[data-mclose]', mdl).onclick = () => { mdl.hidden = true; };
    $('[data-mok]', mdl).onclick = () => {
      const n = $('#m-n', mdl); if (n && !n.value.trim()) { n.closest('.f').classList.add('has-error'); n.focus(); return; }
      const prev = JSON.parse(JSON.stringify(r)); const d = $('#m-d', mdl).value;
      r.st = to; if (to === 'inviato') r.sent = d; if (to === 'ricevuto') { r.rec = d; r.po = n.value.trim(); } if (to === 'fatturato') { r.fat = d; r.inv = n.value.trim(); }
      mdl.hidden = true; refresh();
      showToast(`${STL[to]} · salvato`, () => { Object.assign(r, prev); refresh(); });
    };
  };
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) mdl.hidden = true; });

  body.addEventListener('click', (e) => {
    const r = row(); if (!r) return;
    if (e.target.closest('[data-pp-toggle]')) { ppOpen = !ppOpen; render(); return; }
    if (e.target.closest('[data-advance]')) { askAdvance(r); return; }
    if (e.target.closest('[data-revert]')) {
      const prev = JSON.parse(JSON.stringify(r)); const i = ST.indexOf(r.st); const to = ST[i - 1];
      if (r.st === 'fatturato') { r.fat = ''; } if (r.st === 'ricevuto') { r.rec = ''; } if (r.st === 'inviato') { r.sent = ''; }
      r.st = to; refresh();
      showToast(`Riportato a ${STL[to]}${to === 'inserito' ? ' · descrizione e importo di nuovo modificabili' : ''}`, () => { Object.assign(r, prev); refresh(); });
      return;
    }
    if (e.target.closest('[data-goto-docs]')) { tab = 'doc'; render(); return; }
    const ed = e.target.closest('[data-edit="kind"]');
    if (ed) {
      e.stopPropagation(); const dr = drawer.getBoundingClientRect(); const rr = ed.getBoundingClientRect();
      pop.innerHTML = Object.keys(KL).map((k) => `<button type="button" data-kv="${k}" aria-checked="${r.kind === k}">${kindChip(k)}<span class="ok">${tick}</span></button>`).join('');
      pop.style.left = (rr.left - dr.left) + 'px'; pop.style.top = (rr.bottom - dr.top + 4) + 'px'; pop.style.minWidth = rr.width + 'px'; pop.hidden = false;
    }
  });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-kv]'); if (!b) return; const r = row(); const prev = r.kind;
    r.kind = b.dataset.kv; pop.hidden = true; refresh(); showToast('Tipo aggiornato · salvato', () => { r.kind = prev; refresh(); });
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('[data-ppop]')) pop.hidden = true; });

  // Anno (solo visivo nell'anteprima)
  let year = 2026;
  document.querySelectorAll('[data-year]').forEach((b) => b.addEventListener('click', () => { year += Number(b.dataset.year); $('[data-year-label]').textContent = year; }));

  renderKpis(); paintHead(); renderRows(); Preview.icon && document.querySelectorAll('[data-i]').length;
  const q = new URLSearchParams(location.search);
  if (q.get('po')) open(Number(q.get('po')));
})();
