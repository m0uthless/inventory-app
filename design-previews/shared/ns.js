/* Nota spese (anteprima). Modello reale: ExpenseReport (dipendente, anno, mese, anticipi, note,
   stato bozza|inviata|validata|rifiutata, motivo rifiuto, validata da/il), ExpenseItem (una per
   ciascuna delle 12 categorie fisse: data, descrizione, importo), ExpenseKmTrip (data, destinazione,
   km → importo del rimborso km = km × tariffa €/km del dipendente), ExpenseReceipt (file + importo
   e data letti dall'OCR come suggerimento). Segreteria = UserProfile.is_expense_secretary.
   Dati finti realistici (in dev ci sono solo note vuote). Oggi: 07/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const TODAY = new Date(2026, 10, 7); const DAY = 864e5;
  const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const daysTo = (s) => Math.round((D(s) - TODAY) / DAY);
  const dShort = (s, y = false) => (s ? D(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) }) : '—');
  const ago = (s) => { const n = -daysTo(s); return n === 0 ? 'oggi' : n === 1 ? 'ieri' : `${n} giorni fa`; };
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const eur = (n, z = true) => (!n && !z ? '' : `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  const parseEur = (s) => { const t = String(s || '').trim().replace(/\s|€/g, ''); if (!t) return 0; const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const MONTHS = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Rimborso');
    a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Categorie (righe fisse del modello Excel) ───────────────────
  const CATS = [
    ['treni', 'Treni, pullman', 'train'], ['taxi_comune', 'Taxi, bus, noleggio nel comune', 'car'], ['taxi_fuori_comune', 'Taxi, bus, noleggio fuori comune', 'car'],
    ['autostrade', 'Autostrade', 'road'], ['rimborso_km', 'Rimborso chilometraggio', 'gauge'], ['varie_automezzi', 'Varie automezzi', 'car', 'lavaggio, parcheggi, piccole manutenzioni fino a 50 €'],
    ['carburanti', 'Carburanti e lubrificanti', 'fuel'], ['pernottamento', 'Pernottamento', 'bed'], ['pasti', 'Pasti', 'cup', 'ristorante o bar'],
    ['rappresentanza', 'Spese di rappresentanza', 'users'], ['telefoniche', 'Spese telefoniche', 'phone'], ['varie', 'Varie', 'more'],
  ].map(([k, l, i, h], n) => ({ k, l, i, h: h || '', n }));
  const CAT = Object.fromEntries(CATS.map((c) => [c.k, c]));
  const SVG = {
    train: 'M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z M4 11h16 M8 15h.01 M16 15h.01 M8 18l-2 3 M16 18l2 3',
    car: 'M5 17h14v-5l-2-5H7l-2 5z M5 12h14 M7 17v2 M17 17v2 M8 14.5h.01 M16 14.5h.01',
    road: 'M5 21 9 3 M19 21 15 3 M12 5v2 M12 11v2 M12 17v2',
    gauge: 'M12 14l4-4 M3.3 18a9 9 0 1 1 17.4 0z',
    fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16 M3 21h12 M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3 M7 8h4',
    bed: 'M3 19V6 M3 15h18v4 M21 15v-3a3 3 0 0 0-3-3h-7v6 M7 11.5a1.5 1.5 0 1 0 0-.01',
    cup: 'M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z M17 9h1.5a2.5 2.5 0 0 1 0 5H17 M8 2v3 M12 2v3',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 1 0 8a4 4 0 0 1 0-8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2',
    more: 'M12 12h.01 M19 12h.01 M5 12h.01',
  };
  const cic = (k) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${SVG[CAT[k].i]}"/></svg>`;

  // ── Persone ─────────────────────────────────────────────────────
  const PEOPLE = [
    { id: 1, n: 'Federico Mutuale', ini: 'FM', rate: 0.42 }, { id: 2, n: 'Luca Romano', ini: 'LR', rate: 0.38 },
    { id: 3, n: 'Andrea Alagia', ini: 'AA', rate: 0.40 }, { id: 4, n: 'Nicola Ferri', ini: 'NF', rate: 0.42 },
    { id: 5, n: 'Giulia Bassi', ini: 'GB', rate: 0.35 },
  ];
  const ME = PEOPLE[0]; const SEC = 'Marta Venturi';
  const P = (id) => PEOPLE.find((p) => p.id === id);

  // ── Note spese ──────────────────────────────────────────────────
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const PLACES = ['AUSL Imola · S. Maria della Scaletta', 'Ospedale Maggiore, Bologna', 'Ospedale Bellaria, Bologna', 'Casa di Cura Rocca, Lugo', 'Ospedale di Ravenna', 'Ospedale di Forlì', 'Istituto Rizzoli, Bologna', 'Poliambulatorio di Cesena'];
  const KM = { 'AUSL Imola · S. Maria della Scaletta': 62, 'Ospedale Maggiore, Bologna': 34, 'Ospedale Bellaria, Bologna': 30, 'Casa di Cura Rocca, Lugo': 88, 'Ospedale di Ravenna': 128, 'Ospedale di Forlì': 142, 'Istituto Rizzoli, Bologna': 32, 'Poliambulatorio di Cesena': 166 };
  const SHOPS = { autostrade: 'Autostrade per l\'Italia', pasti: ['Bar Centrale', 'Trattoria da Bruno', 'Autogrill Secchia'], carburanti: 'Eni Station Budrio', pernottamento: 'Hotel Ravenna Centro', varie_automezzi: 'Parcheggio Ospedale', treni: 'Trenitalia', telefoniche: 'TIM', taxi_comune: 'CO.TA.BO.' };
  let rid = 100; let rcid = 900;
  const mkReceipt = (cat, amount, date, name) => ({ id: ++rcid, name: name || (cat === 'autostrade' ? `telepass-${MONTHS[Number(date.slice(5, 7))]}.pdf` : `IMG_${4000 + (rcid * 37) % 900}.jpg`), shop: Array.isArray(SHOPS[cat]) ? SHOPS[cat][rcid % SHOPS[cat].length] : (SHOPS[cat] || 'Esercizio commerciale'), amount, date });
  const emptyItems = () => Object.fromEntries(CATS.map((c) => [c.k, { amount: 0, desc: '', date: '', receipts: [] }]));
  const mkReport = (pid, y, m, status, opts = {}) => {
    const r = { id: ++rid, user: pid, year: y, month: m, status, advances: 0, note: '', items: emptyItems(), trips: [], sentAt: null, valBy: null, valAt: null, reason: '', updated: opts.updated || iso(y, m, 28) };
    if (opts.blank) return r;
    const last = new Date(y, m, 0).getDate(); const dd = () => iso(y, m, 2 + Math.floor(rnd() * (Math.min(last, 27) - 2)));
    const nTrips = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < nTrips; i++) { const dest = PLACES[Math.floor(rnd() * PLACES.length)]; r.trips.push({ id: ++rcid, date: dd(), dest, km: KM[dest] * 2 }); }
    r.trips.sort((a, b) => a.date.localeCompare(b.date));
    const add = (k, amount, desc, nRec = 1) => { const d = dd(); const it = r.items[k]; it.amount = Math.round(amount * 100) / 100; it.desc = desc; it.date = d; for (let i = 0; i < nRec; i++) it.receipts.push(mkReceipt(k, i === 0 ? it.amount : 0, d)); };
    add('autostrade', 18 + rnd() * 50, 'Pedaggi trasferte', 1);
    add('pasti', 30 + rnd() * 90, 'Pranzi in trasferta', 2 + Math.floor(rnd() * 3));
    if (rnd() > 0.5) add('varie_automezzi', 4 + rnd() * 20, 'Parcheggi ospedale', 1);
    if (rnd() > 0.7) add('pernottamento', 79 + rnd() * 40, 'Hotel per intervento su due giorni', 1);
    if (rnd() > 0.8) add('treni', 12 + rnd() * 30, 'Bologna – Ravenna A/R', 1);
    if (pid !== 1 && rnd() > 0.6) { r.items.varie_automezzi.receipts = []; }
    return r;
  };
  const REPORTS = [];
  for (let m = 1; m <= 9; m++) { const r = mkReport(1, 2026, m, 'validata'); r.sentAt = iso(2026, m + 1, 3); r.valBy = SEC; r.valAt = iso(2026, m + 1, 8); r.updated = r.valAt; REPORTS.push(r); }
  // Ottobre: rifiutata, da correggere
  { const r = mkReport(1, 2026, 10, 'rifiutata'); r.sentAt = '2026-11-03'; r.valBy = SEC; r.valAt = '2026-11-05'; r.updated = '2026-11-05'; r.reason = 'Manca lo scontrino del pernottamento del 14 ottobre a Ravenna. Allegalo e reinvia.'; r.items.pernottamento = { amount: 96, desc: 'Hotel Ravenna, intervento su due giorni', date: '2026-10-14', receipts: [] }; REPORTS.push(r); }
  // Novembre: bozza in corso
  { const r = mkReport(1, 2026, 11, 'bozza', { blank: true }); r.updated = '2026-11-06';
    r.trips = [{ id: ++rcid, date: '2026-11-03', dest: 'AUSL Imola · S. Maria della Scaletta', km: 124 }, { id: ++rcid, date: '2026-11-04', dest: 'Ospedale Maggiore, Bologna', km: 68 }, { id: ++rcid, date: '2026-11-06', dest: 'Casa di Cura Rocca, Lugo', km: 176 }];
    r.items.autostrade = { amount: 38.6, desc: 'Pedaggi Imola e Lugo', date: '2026-11-06', receipts: [mkReceipt('autostrade', 38.6, '2026-11-06', 'telepass-novembre.pdf')] };
    r.items.pasti = { amount: 46.5, desc: 'Pranzi a Imola e Lugo', date: '2026-11-06', receipts: [mkReceipt('pasti', 21, '2026-11-03', 'IMG_4412.jpg'), mkReceipt('pasti', 25.5, '2026-11-06', 'IMG_4430.jpg')] };
    r.items.varie_automezzi = { amount: 7.5, desc: 'Parcheggio Ospedale Maggiore', date: '2026-11-04', receipts: [] };
    REPORTS.push(r); }
  // Colleghi: storico validato + ottobre da validare
  [2, 3, 4, 5].forEach((pid) => {
    for (let m = 1; m <= 9; m++) { const late = pid === 5 && m === 9; const r = mkReport(pid, 2026, m, late ? 'inviata' : 'validata'); r.sentAt = late ? '2026-10-02' : iso(2026, m + 1, 2 + pid); if (!late) { r.valBy = SEC; r.valAt = iso(2026, m + 1, 9); } r.updated = r.valAt || r.sentAt; REPORTS.push(r); }
    const st = pid === 5 ? 'bozza' : 'inviata'; const r = mkReport(pid, 2026, 10, st); if (st === 'inviata') { r.sentAt = iso(2026, 11, pid); r.updated = r.sentAt; } else r.updated = '2026-10-30'; REPORTS.push(r);
  });
  REPORTS.find((r) => r.user === 3 && r.month === 10).advances = 150;
  { const r = REPORTS.find((x) => x.user === 2 && x.month === 10); r.items.pasti.receipts = r.items.pasti.receipts.slice(0, 1); r.items.varie_automezzi = { amount: 12, desc: 'Parcheggio Bellaria', date: '2026-10-09', receipts: [] }; }
  { const r = REPORTS.find((x) => x.user === 4 && x.month === 10); r.items.pernottamento = { amount: 89, desc: 'Hotel Forlì, intervento notturno', date: '2026-10-21', receipts: [] }; }
  const total = (r) => CATS.reduce((s, c) => s + (c.k === 'rimborso_km' ? kmAmount(r) : r.items[c.k].amount), 0);
  const kmTot = (r) => r.trips.reduce((s, t) => s + t.km, 0);
  const kmAmount = (r) => Math.round(kmTot(r) * P(r.user).rate * 100) / 100;
  const due = (r) => total(r) - r.advances;
  const missing = (r) => CATS.filter((c) => c.k !== 'rimborso_km' && r.items[c.k].amount > 0 && !r.items[c.k].receipts.length);
  const filled = (r) => CATS.filter((c) => (c.k === 'rimborso_km' ? r.trips.length : r.items[c.k].amount > 0));
  const editable = (r) => role === 'tech' && r.user === ME.id && (r.status === 'bozza' || r.status === 'rifiutata');
  const num = (r) => `${String(r.month).padStart(2, '0')}/${String(r.year % 100).padStart(2, '0')}`;
  const ST = { bozza: ['Bozza', 'np'], inviata: ['Da validare', 'info'], validata: ['Validata', 'ok'], rifiutata: ['Rifiutata', 'ko'] };
  const ST_ICON = { np: '<path d="M2.5 6h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', info: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor"/>', ok: '<circle cx="6" cy="6" r="4" fill="currentColor"/>', ko: '<path d="M6 1.6 10.8 10H1.2z" fill="currentColor"/>' };
  const stBadge = (r, techView) => { const [l, c] = ST[r.status]; const lab = r.status === 'inviata' && techView ? 'Inviata' : l; return `<span class="nst ${c}"><svg viewBox="0 0 12 12" aria-hidden="true">${ST_ICON[c]}</svg>${lab}</span>`; };

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  let role = qs.get('ruolo') || ls('archie-preview-ns-role', 'tech');
  let nVar = qs.get('variante') || ls('archie-preview-ns-v', 'a');
  let openId = qs.get('nota') ? Number(qs.get('nota')) : null;
  let view = role === 'sec' ? 'inviata' : 'all';
  let personF = null; let expandKm = true; let ocr = null; let lightbox = null;
  const root = $('[data-ns]');

  // ── Elenco ──────────────────────────────────────────────────────
  const mine = () => REPORTS.filter((r) => r.user === ME.id).sort((a, b) => b.year - a.year || b.month - a.month);
  const allR = () => REPORTS.slice().sort((a, b) => b.year - a.year || b.month - a.month || P(a.user).n.localeCompare(P(b.user).n));
  const SVIEWS = [['inviata', 'Da validare', (r) => r.status === 'inviata'], ['rifiutata', 'Rifiutate', (r) => r.status === 'rifiutata'], ['validata', 'Validate', (r) => r.status === 'validata'], ['bozza', 'In compilazione', (r) => r.status === 'bozza'], ['all', 'Tutte', () => true]];
  const TVIEWS = [['all', 'Tutte', () => true], ['open', 'Da completare', (r) => r.status === 'bozza' || r.status === 'rifiutata'], ['sent', 'Inviate', (r) => r.status === 'inviata'], ['validata', 'Validate', (r) => r.status === 'validata']];

  const head = () => `<div class="mt-head"><h1>Rimborso spese</h1>${role === 'sec' ? '<span class="ns-role">Segreteria</span>' : ''}<div class="actions">${role === 'sec' ? `<button class="btn" type="button">${ic('users')}Tariffe km</button>` : ''}<button class="btn btn-primary" type="button" data-new>${ic('plus')}Nuova nota spese</button></div></div>`;

  const bars = (rs) => {
    const by = Array.from({ length: 11 }, (_, i) => rs.find((r) => r.month === i + 1));
    const max = Math.max(...by.map((r) => (r ? total(r) : 0)), 1);
    return `<div class="ns-bars" aria-hidden="true">${by.map((r, i) => `<span title="${cap(MONTHS[i + 1])}: ${r ? eur(total(r)) : '—'}"><i class="${r ? ST[r.status][1] : ''}" style="height:${r ? Math.max(3, (total(r) / max) * 34) : 2}px"></i><small>${MONTHS[i + 1][0].toUpperCase()}</small></span>`).join('')}</div>`;
  };

  const techKpis = () => {
    const rs = mine(); const cur = rs.find((r) => r.month === 11); const rej = rs.find((r) => r.status === 'rifiutata');
    const val = rs.filter((r) => r.status === 'validata'); const valSum = val.reduce((s, r) => s + due(r), 0);
    const km = rs.reduce((s, r) => s + kmTot(r), 0);
    return `<div class="kpi-wrap"><div class="kpis ns-kpis" role="group" aria-label="Indicatori">
      <button type="button" class="kpi" data-open="${cur.id}"><span class="kpi-h">Novembre, in compilazione<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${eur(total(cur))}</span><span class="kpi-s"><b>${filled(cur).length}</b> voci · ${missing(cur).length ? `<span class="warnx">${missing(cur).length} senza scontrino</span>` : 'scontrini ok'}</span></button>
      ${rej ? `<button type="button" class="kpi kpi-alert" data-open="${rej.id}"><span class="kpi-h">${cap(MONTHS[rej.month])}, rifiutata<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${eur(due(rej))}<small>da correggere</small></span><span class="kpi-s" title="${esc(rej.reason)}">${esc(rej.reason)}</span></button>` : '<div class="kpi"><span class="kpi-h">In attesa</span><span class="kpi-v">0</span></div>'}
      <div class="kpi"><span class="kpi-h">Rimborsato nel 2026</span><span class="kpi-v">${eur(valSum)}</span><span class="kpi-s"><b>${val.length}</b> note validate · <b>${km.toLocaleString('it-IT')}</b> km</span></div>
      <div class="kpi"><span class="kpi-h">Spese per mese<span style="margin-left:auto;font-weight:400">${ME.rate.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €/km</span></span>${bars(rs)}</div>
    </div></div>`;
  };
  const secKpis = () => {
    const pend = REPORTS.filter((r) => r.status === 'inviata'); const pSum = pend.reduce((s, r) => s + due(r), 0);
    const oldest = pend.slice().sort((a, b) => a.sentAt.localeCompare(b.sentAt))[0];
    const val10 = REPORTS.filter((r) => r.status === 'validata' && r.valAt && r.valAt.slice(0, 7) === '2026-10'); const v10 = val10.reduce((s, r) => s + due(r), 0);
    const miss = pend.filter((r) => missing(r).length);
    const byP = PEOPLE.map((p) => [p, REPORTS.filter((r) => r.user === p.id && r.status === 'validata').reduce((s, r) => s + due(r), 0)]).sort((a, b) => b[1] - a[1]);
    return `<div class="kpi-wrap"><div class="kpis ns-kpis" role="group" aria-label="Indicatori">
      <button type="button" class="kpi${view === 'inviata' ? ' is-on' : ''}" data-goview="inviata"><span class="kpi-h">Da validare<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${pend.length}<small>${eur(pSum)}</small></span><span class="kpi-s">la più vecchia: <b>${P(oldest.user).n}</b> · ${ago(oldest.sentAt)}</span></button>
      <div class="kpi"><span class="kpi-h">Senza scontrino</span><span class="kpi-v">${miss.length}<small>note da validare</small></span><div class="kpi-list">${miss.slice(0, 3).map((r) => `<button type="button" data-open="${r.id}"><span>${P(r.user).n} · ${MONTHS[r.month]}</span><b>${missing(r).length} ${missing(r).length === 1 ? 'voce' : 'voci'}</b></button>`).join('')}</div></div>
      <div class="kpi"><span class="kpi-h">Validato a ottobre</span><span class="kpi-v">${eur(v10)}</span><span class="kpi-s"><b>${val10.length}</b> note · ${PEOPLE.length} dipendenti</span></div>
      <div class="kpi"><span class="kpi-h">Rimborsato nel 2026 per persona</span><div class="kpi-list">${byP.slice(0, 4).map(([p, v]) => `<button type="button" data-person="${p.id}"><span>${p.n}</span><b>${eur(v)}</b></button>`).join('')}</div></div>
    </div></div>`;
  };

  const rcptCell = (r) => { const f = filled(r).filter((c) => c.k !== 'rimborso_km'); const m = missing(r).length; return f.length ? `<span class="rc${m ? ' miss' : ''}">${ic(m ? 'alert' : 'file')}${m ? `${m} senza scontrino` : `${f.length}/${f.length} voci`}</span>` : '<span class="none">—</span>'; };
  const listPage = () => {
    const sec = role === 'sec'; const VV = sec ? SVIEWS : TVIEWS; const base = sec ? allR() : mine();
    if (!VV.find((v) => v[0] === view)) view = VV[0][0];
    const rows = base.filter(VV.find((v) => v[0] === view)[2]).filter((r) => !personF || r.user === personF);
    const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
    const tokens = personF ? `<span class="token"><span class="tk">Dipendente</span> <b>${P(personF).n}</b><button type="button" class="tk-x" data-unperson aria-label="Rimuovi filtro">${ic('x')}</button></span>` : `<span class="none" style="font-size:12px">${sec ? 'Nessun filtro. Usa l\'imbuto accanto a Dipendente.' : 'Le tue note spese, una per mese.'}</span>`;
    return `${head()}${sec ? secKpis() : techKpis()}
      <section class="panel" aria-label="Note spese">
      <div class="vtabs" role="group" aria-label="Viste">${VV.map(([k, l, f]) => `<button type="button" aria-pressed="${k === view}" data-view="${k}"${k === 'rifiutata' || k === 'open' ? ' class="v-alert"' : ''}>${l} <span>${base.filter(f).length}</span></button>`).join('')}</div>
      <div class="toolbar tb-row"><div class="tokens">${tokens}</div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Esporta">${ic('download')}</button></div>
      <div class="table-wrap"><table class="po-table ns-table"><thead><tr>
        ${sec ? `<th><div class="th-in">Dipendente<button type="button" class="th-filter${personF ? ' is-on' : ''}" data-filter-person aria-label="Filtra dipendente">${funnel}</button></div></th>` : ''}
        <th>Mese</th><th>Stato</th><th class="num-r c-n">Spese</th><th class="num-r c-n c-adv">Anticipi</th><th class="num-r c-n">Da rendere</th><th class="c-km num-r">Km</th><th class="c-rc">Scontrini</th><th class="c-upd">${sec ? 'Inviata' : 'Ultimo passaggio'}</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-open="${r.id}" tabindex="0">
          ${sec ? `<td class="who"><span class="whoin"><span class="av">${P(r.user).ini}</span><b>${P(r.user).n}</b></span></td>` : ''}
          <td class="mon"><b>${cap(MONTHS[r.month])} ${r.year}</b><small>N. ${num(r)}</small></td>
          <td>${stBadge(r, !sec)}</td>
          <td class="num c-n">${eur(total(r))}</td>
          <td class="num c-n c-adv">${r.advances ? `− ${eur(r.advances)}` : '<span class="none">—</span>'}</td>
          <td class="num c-n"><b>${eur(due(r))}</b></td>
          <td class="num c-km">${kmTot(r) ? kmTot(r).toLocaleString('it-IT') : '<span class="none">—</span>'}</td>
          <td class="c-rc">${rcptCell(r)}</td>
          <td class="c-upd">${upd(r, sec)}</td></tr>`).join('') || `<tr><td colspan="9" style="height:110px;text-align:center;color:var(--muted)">${view === 'inviata' ? 'Nessuna nota da validare: tutto in pari.' : 'Nessuna nota spese in questa vista.'}</td></tr>`}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> note · da rendere <b>${eur(rows.reduce((s, r) => s + due(r), 0))}</b></span></div></section>`;
  };
  const upd = (r, sec) => {
    if (sec) return r.sentAt ? `<span class="upd${r.status === 'inviata' && -daysTo(r.sentAt) > 14 ? ' late' : ''}">${dShort(r.sentAt)}<small>${r.status === 'inviata' ? `in attesa da ${-daysTo(r.sentAt)} giorni` : r.valAt ? `${ST[r.status][0].toLowerCase()} il ${dShort(r.valAt)}` : ''}</small></span>` : '<span class="none">non inviata</span>';
    if (r.status === 'validata') return `<span class="upd">${dShort(r.valAt)}<small>validata da ${r.valBy}</small></span>`;
    if (r.status === 'rifiutata') return `<span class="upd late">${dShort(r.valAt)}<small>rifiutata da ${r.valBy}</small></span>`;
    if (r.status === 'inviata') return `<span class="upd">${dShort(r.sentAt)}<small>inviata, in attesa</small></span>`;
    return `<span class="upd">${dShort(r.updated)}<small>modificata ${ago(r.updated)}</small></span>`;
  };

  // ── Nota: parti comuni ──────────────────────────────────────────
  const R = () => REPORTS.find((r) => r.id === openId);
  const noteHead = (r) => {
    const ed = editable(r); const sec = role === 'sec';
    const acts = [`<button class="btn" type="button" data-pdf>${ic('download')}Esporta PDF</button>`];
    if (ed) acts.push(`<button class="btn btn-primary" type="button" data-submit>${ic('arrowR')}${r.status === 'rifiutata' ? 'Reinvia alla segreteria' : 'Invia alla segreteria'}</button>`);
    if (sec && r.status === 'inviata') acts.push(`<button class="btn btn-danger-o" type="button" data-reject>Rifiuta</button><button class="btn btn-primary" type="button" data-validate>${ic('check')}Valida</button>`);
    return `<div class="ns-back"><button type="button" class="lnk" data-back>${ic('chevL')}Rimborso spese</button></div>
      <div class="mt-head ns-nhead"><div class="ttl"><h1>Nota spese di ${MONTHS[r.month]} ${r.year}</h1><span class="meta"><span class="mono">N. ${num(r)}</span> · ${P(r.user).n} · ${P(r.user).rate.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €/km</span></div>${stBadge(r, !sec)}<div class="actions">${acts.join('')}</div></div>
      ${r.status === 'rifiutata' ? `<div class="ns-banner ko">${ic('alert')}<div><b>Rifiutata da ${r.valBy} il ${dShort(r.valAt)}</b><span>${esc(r.reason)}</span></div></div>` : ''}
      ${r.status === 'validata' ? `<div class="ns-banner ok">${tick}<div><b>Validata da ${r.valBy} il ${dShort(r.valAt, true)}</b><span>La nota non è più modificabile.</span></div></div>` : ''}
      ${r.status === 'inviata' && !sec ? `<div class="ns-banner info">${ic('clock')}<div><b>Inviata il ${dShort(r.sentAt)}</b><span>In attesa della segreteria. Finché non viene validata o rifiutata non è modificabile.</span></div></div>` : ''}
      ${r.status === 'inviata' && sec ? `<div class="ns-banner info">${ic('clock')}<div><b>Inviata da ${P(r.user).n} il ${dShort(r.sentAt)} · ${ago(r.sentAt)}</b><span>Controlla le voci e gli scontrini, poi valida o rifiuta con un motivo.</span></div></div>` : ''}`;
  };
  const SEQ = ['var(--seq-0, #1f6b5c)', '#4f8f7f', '#7fb3a5', '#2f5f9e', '#6b8fc6', '#9a5b00', '#c48a2c', '#8a6bb0', '#b07f9a', '#5b6b67', '#3f7d4f', '#a3aea9'];
  const summary = (r) => {
    const ed = editable(r); const tot = total(r); const f = filled(r); const m = missing(r);
    const parts = f.map((c) => [c, c.k === 'rimborso_km' ? kmAmount(r) : r.items[c.k].amount]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const checks = [];
    if (m.length) checks.push(['warn', `${m.length} ${m.length === 1 ? 'voce' : 'voci'} senza scontrino`, m.map((c) => c.l).join(', ')]);
    if (r.trips.length) checks.push(['ok', `${kmTot(r)} km in ${r.trips.length} trasferte`, `${eur(kmAmount(r))} a ${P(r.user).rate.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €/km`]);
    if (!f.length) checks.push(['warn', 'Nessuna spesa inserita', 'Compila almeno una voce prima di inviare']);
    return `<aside class="ns-sum" aria-label="Riepilogo">
      <div class="sum-top"><span class="lbl">Totale spese</span><b class="big">${eur(tot)}</b>
        <div class="sum-bar" aria-hidden="true">${parts.map(([c, v]) => `<i style="flex:${v};background:${SEQ[c.n]}" title="${c.l}: ${eur(v)}"></i>`).join('') || '<i style="flex:1;background:var(--neutral-bg)"></i>'}</div>
        <ul class="sum-list">${parts.map(([c, v]) => `<li><i style="background:${SEQ[c.n]}"></i><span>${c.l}</span><b>${eur(v)}</b></li>`).join('')}</ul></div>
      <dl class="sum-dl"><dt>Anticipi ricevuti</dt><dd>${ed ? `<input class="amt-in" data-adv value="${r.advances ? r.advances.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : ''}" placeholder="0,00" inputmode="decimal" aria-label="Anticipi ricevuti">` : r.advances ? `− ${eur(r.advances)}` : '—'}</dd>
        <dt class="due-l">Da rendere</dt><dd class="due-v">${eur(due(r))}</dd></dl>
      ${checks.length ? `<ul class="sum-checks">${checks.map(([k, t, s]) => `<li class="${k}">${k === 'ok' ? tick : ic('alert')}<span><b>${t}</b><small>${esc(s)}</small></span></li>`).join('')}</ul>` : ''}
      <div class="f"><label for="ns-note">Note per la segreteria</label>${ed ? `<textarea id="ns-note" data-note placeholder="Facoltative">${esc(r.note)}</textarea>` : `<p class="ro-note">${esc(r.note) || '<span class="none">Nessuna nota.</span>'}</p>`}</div>
      ${ed ? `<button class="btn btn-primary wide" type="button" data-submit ${f.length ? '' : 'disabled'}>${ic('arrowR')}${r.status === 'rifiutata' ? 'Reinvia alla segreteria' : 'Invia alla segreteria'}</button><p class="hint">Dopo l'invio la nota non è più modificabile, a meno che la segreteria non la rifiuti.</p>` : ''}
      ${role === 'sec' && r.status === 'inviata' ? `<div class="sec-acts"><button class="btn btn-danger-o" type="button" data-reject>Rifiuta</button><button class="btn btn-primary" type="button" data-validate>${ic('check')}Valida ${eur(due(r))}</button></div>` : ''}
    </aside>`;
  };
  const rChips = (r, k, ed) => `${r.items[k].receipts.map((x) => `<span class="rchip"><button type="button" data-lb="${k}:${x.id}" title="Apri lo scontrino">${ic('file')}<span>${esc(x.name)}</span></button>${ed ? `<button type="button" class="x" data-rmrc="${k}:${x.id}" aria-label="Rimuovi ${esc(x.name)}">${ic('x')}</button>` : ''}</span>`).join('')}`;
  const ocrBox = (k) => (ocr && ocr.k === k ? `<div class="ocr">${ic('eye')}<span>Dallo scontrino: <b>${eur(ocr.amount)}</b> del <b>${dShort(ocr.date)}</b></span><button class="btn btn-sm" type="button" data-ocr-apply>Usa questi valori</button><button class="btn btn-ghost btn-sm" type="button" data-ocr-x>Ignora</button></div>` : '');
  const trips = (r, ed) => `<div class="trips"><table><thead><tr><th>Data</th><th>Destinazione</th><th class="num">Km</th>${ed ? '<th></th>' : ''}</tr></thead><tbody>
      ${r.trips.map((t) => `<tr><td>${dShort(t.date)}</td><td>${esc(t.dest)}</td><td class="num">${t.km}</td>${ed ? `<td class="x"><button type="button" class="icon-btn sm" data-rmtrip="${t.id}" aria-label="Rimuovi trasferta">${ic('trash')}</button></td>` : ''}</tr>`).join('')}
      ${ed ? `<tr class="add"><td><input type="date" data-tdate value="2026-11-07" aria-label="Data"></td><td><input data-tdest list="ns-places" placeholder="Dove sei andato" aria-label="Destinazione"></td><td class="num"><input data-tkm inputmode="numeric" placeholder="km" aria-label="Km"></td><td class="x"><button type="button" class="icon-btn sm" data-addtrip aria-label="Aggiungi trasferta">${ic('plus')}</button></td></tr>` : ''}
      </tbody><tfoot><tr><td colspan="2">${kmTot(r)} km × ${P(r.user).rate.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €/km</td><td class="num"><b>${eur(kmAmount(r))}</b></td>${ed ? '<td></td>' : ''}</tr></tfoot></table>
      <datalist id="ns-places">${PLACES.map((p) => `<option value="${p}">`).join('')}</datalist></div>`;

  // ── Nota A · Foglio ─────────────────────────────────────────────
  const sheetA = (r) => {
    const ed = editable(r);
    return `<section class="panel ns-sheet" aria-label="Voci della nota"><table class="sheet"><thead><tr><th>Categoria</th><th>Descrizione</th><th class="c-date">Data</th><th class="c-rcp">Scontrini</th><th class="num">Importo</th></tr></thead><tbody>
      ${CATS.map((c) => { const it = r.items[c.k]; const km = c.k === 'rimborso_km'; const v = km ? kmAmount(r) : it.amount; const miss = !km && v > 0 && !it.receipts.length;
        return `<tr class="${v ? 'has' : 'zero'}${km ? ' km' : ''}">
        <th scope="row"><span class="cat">${cic(c.k)}<span>${c.l}${c.h ? `<small>${c.h}</small>` : ''}</span></span></th>
        <td>${km ? `<button type="button" class="lnk kmtog" data-kmtog aria-expanded="${expandKm}">${r.trips.length} trasferte · ${kmTot(r)} km${ic(expandKm ? 'chevD' : 'chevR')}</button>` : ed ? `<input class="cell" data-desc="${c.k}" value="${esc(it.desc)}" placeholder="—" aria-label="Descrizione ${c.l}">` : esc(it.desc) || '<span class="none">—</span>'}</td>
        <td class="c-date">${km ? '' : ed && v ? `<input class="cell" type="date" data-date="${c.k}" value="${it.date}" aria-label="Data ${c.l}">` : it.date ? dShort(it.date) : ''}</td>
        <td class="c-rcp">${km ? '<span class="none">non serve</span>' : `<div class="rchips">${rChips(r, c.k, ed)}${miss ? '<span class="miss-tag">manca</span>' : ''}${ed ? `<label class="icon-btn sm up" title="Carica uno scontrino">${ic('upload')}<input type="file" accept="image/*,application/pdf" hidden data-up="${c.k}"></label>` : ''}</div>`}</td>
        <td class="num">${km ? `<b class="calc" title="Calcolato dalle trasferte">${v ? eur(v) : ''}</b>` : ed ? `<input class="cell amt" data-amt="${c.k}" value="${v ? v.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : ''}" placeholder="" inputmode="decimal" aria-label="Importo ${c.l}">` : v ? eur(v) : ''}</td></tr>
        ${km && expandKm ? `<tr class="trips-row"><td colspan="5">${trips(r, ed)}</td></tr>` : ''}
        ${!km && ocr && ocr.k === c.k ? `<tr class="ocr-row"><td colspan="5">${ocrBox(c.k)}</td></tr>` : ''}`; }).join('')}
      </tbody><tfoot><tr><th colspan="4">Totale spese</th><td class="num"><b>${eur(total(r))}</b></td></tr></tfoot></table></section>`;
  };

  // ── Nota B · Voci ───────────────────────────────────────────────
  let addOpen = false;
  const cardsB = (r) => {
    const ed = editable(r); const f = filled(r); const shown = CATS.filter((c) => f.includes(c) || (c.k !== 'rimborso_km' && r.items[c.k]._new));
    const empty = CATS.filter((c) => !shown.includes(c));
    return `${ed ? `<label class="ns-drop" data-dropzone>${ic('upload')}<span><b>Trascina qui gli scontrini</b> o sfoglia: leggo importo e data, tu scegli la categoria.</span><input type="file" accept="image/*,application/pdf" hidden data-upfree multiple></label>` : ''}
      ${ocr && ocr.k === '?' ? `<div class="ocr-free"><div class="o1">${ic('file')}<span><b>${esc(ocr.name)}</b> · ${eur(ocr.amount)} del ${dShort(ocr.date)}</span><button class="icon-btn sm" type="button" data-ocr-x aria-label="Annulla">${ic('x')}</button></div><span class="lbl">A quale voce lo aggiungo?</span><div class="chips">${CATS.filter((c) => c.k !== 'rimborso_km').map((c) => `<button type="button" class="chip${c.k === 'pasti' ? ' sug' : ''}" data-ocr-cat="${c.k}">${cic(c.k)}${c.l}${c.k === 'pasti' ? '<small>suggerita</small>' : ''}</button>`).join('')}</div></div>` : ''}
      <div class="ns-cards">${shown.map((c) => { const it = r.items[c.k]; const km = c.k === 'rimborso_km'; const v = km ? kmAmount(r) : it.amount; const miss = !km && v > 0 && !it.receipts.length;
        return `<article class="ncard${miss ? ' miss' : ''}"><header><span class="ci">${cic(c.k)}</span><div class="t"><b>${c.l}</b>${c.h ? `<small>${c.h}</small>` : ''}</div>
          ${km ? `<b class="amt-ro">${eur(v)}</b>` : ed ? `<input class="amt-in big" data-amt="${c.k}" value="${v ? v.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : ''}" placeholder="0,00" inputmode="decimal" aria-label="Importo ${c.l}">` : `<b class="amt-ro">${eur(v)}</b>`}</header>
          ${km ? trips(r, ed) : `<div class="row">${ed ? `<input class="cell" data-desc="${c.k}" value="${esc(it.desc)}" placeholder="Descrizione" aria-label="Descrizione ${c.l}"><input class="cell d" type="date" data-date="${c.k}" value="${it.date}" aria-label="Data ${c.l}">` : `<span>${esc(it.desc) || '<span class="none">Nessuna descrizione</span>'}</span><span class="d">${it.date ? dShort(it.date) : ''}</span>`}</div>
          <div class="rchips">${rChips(r, c.k, ed)}${miss ? `<span class="miss-tag">${ic('alert')}manca lo scontrino</span>` : ''}${ed ? `<label class="btn btn-ghost btn-sm up">${ic('upload')}Scontrino<input type="file" accept="image/*,application/pdf" hidden data-up="${c.k}"></label>` : ''}</div>${ocrBox(c.k)}`}
          ${ed && !km ? `<button type="button" class="icon-btn sm rm" data-clear="${c.k}" aria-label="Svuota la voce ${c.l}" title="Svuota la voce">${ic('trash')}</button>` : ''}</article>`; }).join('') || '<div class="none" style="padding:24px;text-align:center">Nessuna spesa in questa nota.</div>'}</div>
      ${ed ? `<div class="ns-add"><button type="button" class="btn" data-addtog aria-expanded="${addOpen}">${ic('plus')}Aggiungi una voce</button>${addOpen ? `<div class="chips">${empty.map((c) => `<button type="button" class="chip" data-addcat="${c.k}">${cic(c.k)}${c.l}</button>`).join('')}</div>` : `<span class="none">${empty.length} categorie vuote</span>`}</div>` : ''}`;
  };

  const notePage = () => { const r = R(); return `${noteHead(r)}<div class="ns-layout"><div class="ns-main">${nVar === 'b' ? cardsB(r) : sheetA(r)}</div>${summary(r)}</div>`; };

  // ── Render ──────────────────────────────────────────────────────
  const render = () => {
    const keep = document.activeElement?.matches?.('[data-tdest],[data-tkm]') ? document.activeElement.matches('[data-tdest]') ? 'tdest' : 'tkm' : null;
    root.innerHTML = openId ? notePage() : listPage();
    if (keep) root.querySelector(`[data-${keep}]`)?.focus();
    paintMdl();
  };

  // ── Dialoghi ────────────────────────────────────────────────────
  const mdl = $('[data-mdl]'); const box = mdl.querySelector('.mdl');
  let dlg = null; // { kind: 'new'|'reject'|'lb', ... }
  const paintMdl = () => {
    if (!dlg) { mdl.hidden = true; return; }
    mdl.hidden = false; box.className = `mdl ns-mdl ns-${dlg.kind}`;
    if (dlg.kind === 'new') {
      const have = Object.fromEntries(mine().filter((r) => r.year === dlg.year).map((r) => [r.month, r]));
      box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Nuova nota spese</h3><p>Una nota per mese: parte con le 12 categorie vuote.</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="rp-body"><div class="yr-sw"><button class="icon-btn sm" type="button" data-yr="-1" aria-label="Anno precedente">${ic('chevL')}</button><b>${dlg.year}</b><button class="icon-btn sm" type="button" data-yr="1" aria-label="Anno successivo" ${dlg.year >= 2026 ? 'disabled' : ''}>${ic('chevR')}</button></div>
        <div class="mgrid" role="radiogroup" aria-label="Mese">${MONTHS.slice(1).map((m, i) => { const h = have[i + 1]; const fut = dlg.year === 2026 && i + 1 > 12; return `<button type="button" role="radio" aria-checked="${dlg.month === i + 1}" data-mon="${i + 1}" ${h || fut ? 'disabled' : ''}><b>${cap(m)}</b><small>${h ? ST[h.status][0].toLowerCase() === 'da validare' ? 'inviata' : ST[h.status][0].toLowerCase() : 'libero'}</small></button>`; }).join('')}</div>
        ${dlg.month ? '' : '<p class="hint">Tutti i mesi di quest\'anno hanno già una nota.</p>'}</div>
        <div class="nc-foot"><span class="sp"></span><button class="btn btn-ghost" type="button" data-dclose>Annulla</button><button class="btn btn-primary" type="button" data-create ${dlg.month ? '' : 'disabled'}>${ic('plus')}Crea ${dlg.month ? `${MONTHS[dlg.month]} ${dlg.year}` : ''}</button></div>`;
    } else if (dlg.kind === 'reject') {
      const r = R(); const QUICK = [...missing(r).map((c) => `Manca lo scontrino di «${c.l}».`), 'Importo diverso dallo scontrino.', 'Km da verificare con i rapportini.'];
      box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Rifiuta la nota di ${P(r.user).n}</h3><p>${cap(MONTHS[r.month])} ${r.year} · ${eur(due(r))}. Il motivo arriva al dipendente, che corregge e reinvia.</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="rp-body"><div class="f"><span class="lbl">Motivi frequenti</span><div class="chips">${QUICK.map((q) => `<button type="button" class="chip" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>
        <div class="f"><label for="rj">Motivo <span class="req">*</span></label><textarea id="rj" data-rj placeholder="Cosa deve correggere?">${esc(dlg.reason)}</textarea></div></div>
        <div class="nc-foot"><span class="sp"></span><button class="btn btn-ghost" type="button" data-dclose>Annulla</button><button class="btn btn-danger" type="button" data-rjgo ${dlg.reason.trim() ? '' : 'disabled'}>Rifiuta la nota</button></div>`;
    } else if (dlg.kind === 'lb') {
      const r = R(); const [k, id] = dlg.ref.split(':'); const x = r.items[k].receipts.find((y) => y.id === Number(id)); const it = r.items[k];
      box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">${esc(x.name)}</h3><p>${CAT[k].l} · in nota ${eur(it.amount)}${it.date ? ` del ${dShort(it.date)}` : ''}</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="lb-body">${fakeReceipt(x)}<div class="lb-side"><span class="lbl">Letto dallo scontrino</span><dl><dt>Importo</dt><dd>${x.amount ? eur(x.amount) : '—'}</dd><dt>Data</dt><dd>${dShort(x.date, true)}</dd><dt>Esercizio</dt><dd>${esc(x.shop)}</dd></dl>
        ${x.amount && Math.abs(x.amount - it.amount) > 0.009 && it.receipts.length === 1 ? `<p class="lb-warn">${ic('alert')}L'importo in nota è diverso: ${eur(it.amount)}.</p>` : x.amount ? `<p class="lb-ok">${tick}Coincide con la nota.</p>` : '<p class="hint">Importo non letto: controllalo a vista.</p>'}</div></div>
        <div class="nc-foot"><button class="btn" type="button">${ic('download')}Scarica</button><span class="sp"></span><button class="btn btn-primary" type="button" data-dclose>Chiudi</button></div>`;
    }
  };
  const fakeReceipt = (x) => `<svg class="receipt-img" viewBox="0 0 220 300" role="img" aria-label="Anteprima scontrino"><rect x="10" y="6" width="200" height="288" rx="3" fill="#fbfaf6" stroke="#d8d4c8"/>
    <text x="110" y="34" text-anchor="middle" font-size="12" font-weight="700" fill="#333" font-family="monospace">${esc(x.shop).toUpperCase().slice(0, 24)}</text>
    <text x="110" y="50" text-anchor="middle" font-size="8" fill="#777" font-family="monospace">P.IVA 0${String(x.id * 7919).slice(0, 10)}</text>
    ${[0, 1, 2].map((i) => `<rect x="26" y="${74 + i * 18}" width="${90 - i * 18}" height="6" fill="#ccc"/><rect x="160" y="${74 + i * 18}" width="34" height="6" fill="#ccc"/>`).join('')}
    <line x1="26" y1="138" x2="194" y2="138" stroke="#bbb" stroke-dasharray="3 3"/>
    <text x="26" y="160" font-size="11" font-weight="700" fill="#333" font-family="monospace">TOTALE EURO</text><text x="194" y="160" text-anchor="end" font-size="12" font-weight="700" fill="#333" font-family="monospace">${x.amount ? x.amount.toFixed(2).replace('.', ',') : '--,--'}</text>
    <text x="26" y="186" font-size="9" fill="#666" font-family="monospace">${D(x.date).toLocaleDateString('it-IT')}  12:4${x.id % 10}</text>
    ${Array.from({ length: 22 }, (_, i) => `<rect x="${40 + i * 6.4}" y="232" width="${(i * 7) % 3 + 1.5}" height="34" fill="#444"/>`).join('')}</svg>`;

  // ── Toast ───────────────────────────────────────────────────────
  const toast = $('[data-toast]'); let tt;
  const showToast = (msg) => { toast.innerHTML = `${tick}<span>${msg}</span>`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 4500); };

  // ── Eventi ──────────────────────────────────────────────────────
  const go = (id) => { openId = id; ocr = null; addOpen = false; render(); document.querySelector('.content')?.scrollTo(0, 0); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-open], [data-open]'); if (!b) return;
    if (b.closest('.pv-bar')) return;
    const r = openId ? R() : null;
    if (b.dataset.open && !b.closest('[data-mdl]')) return go(Number(b.dataset.open));
    if (b.matches('[data-back]')) return go(null);
    if (b.matches('[data-view]')) { view = b.dataset.view; return render(); }
    if (b.matches('[data-goview]')) { view = b.dataset.goview; personF = null; return render(); }
    if (b.matches('[data-person]')) { view = 'all'; personF = Number(b.dataset.person); return render(); }
    if (b.matches('[data-unperson]')) { personF = null; return render(); }
    if (b.matches('[data-filter-person]')) { personF = personF ? null : 3; return render(); }
    if (b.matches('[data-new]')) { const have = new Set(mine().filter((x) => x.year === 2026).map((x) => x.month)); const free = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].find((m) => !have.has(m)); dlg = { kind: 'new', year: 2026, month: free || null }; return paintMdl(); }
    if (b.matches('[data-yr]')) { dlg.year += Number(b.dataset.yr); const have = new Set(mine().filter((x) => x.year === dlg.year).map((x) => x.month)); dlg.month = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].find((m) => !have.has(m)) || null; return paintMdl(); }
    if (b.matches('[data-mon]')) { dlg.month = Number(b.dataset.mon); return paintMdl(); }
    if (b.matches('[data-create]')) { const n = mkReport(ME.id, dlg.year, dlg.month, 'bozza', { blank: true }); n.updated = '2026-11-07'; REPORTS.push(n); dlg = null; showToast(`Nota di ${MONTHS[n.month]} ${n.year} creata.`); return go(n.id); }
    if (b.matches('[data-dclose]')) { dlg = null; return paintMdl(); }
    if (b.matches('[data-pdf]')) return showToast('PDF della nota scaricato (anteprima).');
    if (b.matches('[data-submit]')) { r.status = 'inviata'; r.sentAt = '2026-11-07'; r.updated = r.sentAt; showToast(`Nota di ${MONTHS[r.month]} inviata alla segreteria.`); return render(); }
    if (b.matches('[data-validate]')) { r.status = 'validata'; r.valBy = SEC; r.valAt = '2026-11-07'; showToast(`Nota di ${P(r.user).n} validata · ${eur(due(r))}.`); return go(null); }
    if (b.matches('[data-reject]')) { dlg = { kind: 'reject', reason: '' }; return paintMdl(); }
    if (b.matches('[data-quick]')) { dlg.reason = (dlg.reason.trim() ? `${dlg.reason.trim()} ` : '') + b.dataset.quick; return paintMdl(); }
    if (b.matches('[data-rjgo]')) { r.status = 'rifiutata'; r.reason = dlg.reason.trim(); r.valBy = SEC; r.valAt = '2026-11-07'; dlg = null; showToast(`Nota rifiutata: ${P(r.user).n} riceve il motivo.`); return go(null); }
    if (b.matches('[data-lb]')) { dlg = { kind: 'lb', ref: b.dataset.lb }; return paintMdl(); }
    if (b.matches('[data-rmrc]')) { const [k, id] = b.dataset.rmrc.split(':'); r.items[k].receipts = r.items[k].receipts.filter((x) => x.id !== Number(id)); return render(); }
    if (b.matches('[data-kmtog]')) { expandKm = !expandKm; return render(); }
    if (b.matches('[data-rmtrip]')) { r.trips = r.trips.filter((t) => t.id !== Number(b.dataset.rmtrip)); return render(); }
    if (b.matches('[data-addtrip]')) { addTrip(r); return; }
    if (b.matches('[data-ocr-apply]')) { const it = r.items[ocr.k]; it.amount = ocr.amount; it.date = ocr.date; ocr = null; return render(); }
    if (b.matches('[data-ocr-x]')) { ocr = null; return render(); }
    if (b.matches('[data-ocr-cat]')) { const k = b.dataset.ocrCat; const it = r.items[k]; it.receipts.push(mkReceipt(k, ocr.amount, ocr.date, ocr.name)); it.amount = Math.round((it.amount + ocr.amount) * 100) / 100; it.date = it.date || ocr.date; ocr = null; showToast(`Scontrino aggiunto a «${CAT[k].l}», importo aggiornato.`); return render(); }
    if (b.matches('[data-addtog]')) { addOpen = !addOpen; return render(); }
    if (b.matches('[data-addcat]')) { const k = b.dataset.addcat; if (k === 'rimborso_km') { r.trips.push({ id: ++rcid, date: '2026-11-07', dest: 'Ospedale Maggiore, Bologna', km: 68 }); } else r.items[k]._new = true; addOpen = false; render(); root.querySelector(`[data-amt="${k}"]`)?.focus(); return; }
    if (b.matches('[data-clear]')) { const k = b.dataset.clear; r.items[k] = { amount: 0, desc: '', date: '', receipts: [] }; return render(); }
  });
  const addTrip = (r) => {
    const dest = root.querySelector('[data-tdest]').value.trim(); const km = parseInt(root.querySelector('[data-tkm]').value, 10); const date = root.querySelector('[data-tdate]').value;
    if (!dest || !km) { root.querySelector(dest ? '[data-tkm]' : '[data-tdest]').focus(); return; }
    r.trips.push({ id: ++rcid, date, dest, km }); r.trips.sort((a, b) => a.date.localeCompare(b.date)); render(); root.querySelector('[data-tdest]')?.focus();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-tdest],[data-tkm]')) { e.preventDefault(); addTrip(R()); }
    if (e.key === 'Enter' && e.target.matches('tr[data-open]')) go(Number(e.target.dataset.open));
    if (e.key === 'Escape' && dlg) { dlg = null; paintMdl(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-tdest]') && KM[t.value]) { const k = root.querySelector('[data-tkm]'); if (k && !k.value) k.value = KM[t.value] * 2; }
    if (t.matches('[data-rj]')) { dlg.reason = t.value; box.querySelector('[data-rjgo]').disabled = !t.value.trim(); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target; const r = openId ? R() : null; if (!r) return;
    if (t.matches('[data-amt]')) { r.items[t.dataset.amt].amount = parseEur(t.value); return render(); }
    if (t.matches('[data-desc]')) { r.items[t.dataset.desc].desc = t.value; return; }
    if (t.matches('[data-date]')) { r.items[t.dataset.date].date = t.value; return; }
    if (t.matches('[data-adv]')) { r.advances = parseEur(t.value); return render(); }
    if (t.matches('[data-note]')) { r.note = t.value; return; }
    if (t.matches('[data-up]')) { const f = t.files?.[0]; if (!f) return; const k = t.dataset.up; const it = r.items[k]; const amount = it.amount || 18.4; it.receipts.push(mkReceipt(k, amount, it.date || '2026-11-07', f.name)); if (/image/.test(f.type)) ocr = { k, amount: k === 'pasti' ? 23.5 : amount, date: '2026-11-07' }; showToast('Scontrino caricato.'); return render(); }
    if (t.matches('[data-upfree]')) { const f = t.files?.[0]; if (!f) return; ocr = { k: '?', name: f.name, amount: 23.5, date: '2026-11-07' }; return render(); }
  });
  root.addEventListener('dragover', (e) => { if (e.target.closest('[data-dropzone]')) e.preventDefault(); });
  root.addEventListener('drop', (e) => { if (!e.target.closest('[data-dropzone]')) return; e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { ocr = { k: '?', name: f.name, amount: 23.5, date: '2026-11-07' }; render(); } });
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) { dlg = null; paintMdl(); } });

  // ── Barra anteprima ─────────────────────────────────────────────
  const roleB = document.querySelectorAll('[data-nsrole]'); const varB = document.querySelectorAll('[data-nsv]');
  const setRole = (v) => { role = v; roleB.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.nsrole === v))); try { localStorage.setItem('archie-preview-ns-role', v); } catch { /* niente */ } };
  const setVar = (v) => { nVar = v; varB.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.nsv === v))); try { localStorage.setItem('archie-preview-ns-v', v); } catch { /* niente */ } };
  roleB.forEach((b) => b.addEventListener('click', () => { setRole(b.dataset.nsrole); view = role === 'sec' ? 'inviata' : 'all'; personF = null; if (openId && role === 'sec' && R().status === 'bozza') openId = null; render(); }));
  varB.forEach((b) => b.addEventListener('click', () => { setVar(b.dataset.nsv); if (!openId) openId = role === 'sec' ? REPORTS.find((r) => r.status === 'inviata' && r.user === 3).id : mine().find((r) => r.month === 11).id; render(); }));
  setRole(role); setVar(nVar);
  render();
})();
