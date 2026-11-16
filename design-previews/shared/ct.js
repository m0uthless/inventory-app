/* Pagina Contratti (anteprima della versione in dev) + due varianti del dialogo
   «Nuovo contratto»: A · Scheda unica (modulo + riepilogo vivo), B · Passi.
   Modello reale: Contract (code, title, customer, contract_type, seller, company,
   start_date, end_date, notice_days, auto_renew, total_value, billing_freq, status,
   devices, document, notes). Dati: i 20 contratti demo del dev. Oggi: 07/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const TODAY = new Date(2026, 10, 7);
  const DAY = 864e5;
  const ROWS = [{"id": 19, "code": "DEMO-2026-019", "title": "Assistenza tecnica on-site — AUSL Imola", "cust": "IMOLA", "type": "assistenza", "seller": "Studio Rossi Agenzia", "company": "Philips", "start": "2025-06-30", "end": "2026-06-29", "notice": 90, "renew": false, "value": 117500.0, "bill": "mensile", "st": "disdetto", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 1, "code": "DEMO-2026-001", "title": "Assistenza full-risk — AUSL Bologna", "cust": "AUSL Bologna", "type": "assistenza", "seller": "Davide De Paola", "company": "Philips", "start": "2025-09-13", "end": "2026-09-12", "notice": 90, "renew": false, "value": 7750.0, "bill": "mensile", "st": "attivo", "dev": ["Risonanza — Powercazzi — S/N:dsaddads"], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 2, "code": "DEMO-2026-002", "title": "Noleggio operativo — Policlinico Città di Udine", "cust": "UDINE", "type": "noleggio", "seller": "Andrea Alagia", "company": "Philips", "start": "2024-10-17", "end": "2026-10-17", "notice": 60, "renew": true, "value": 27500.0, "bill": "annuale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 3, "code": "DEMO-2026-003", "title": "Supporto remoto 8x5 — Centro Medico Esperia", "cust": "ESPERIA", "type": "assistenza", "seller": "Studio Rossi Agenzia", "company": "Biotron", "start": "2025-11-02", "end": "2026-11-01", "notice": 30, "renew": true, "value": 9500.0, "bill": "annuale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 4, "code": "DEMO-2026-004", "title": "Licenza software RIS — Olomed Manzano", "cust": "MANZANO", "type": "licenza", "seller": "Marco Bianchi (agente esterno)", "company": "Biotron", "start": "2023-11-15", "end": "2026-11-14", "notice": 90, "renew": false, "value": 57250.0, "bill": "trimestrale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 5, "code": "DEMO-2026-005", "title": "Assistenza full-risk — AUSL Imola", "cust": "IMOLA", "type": "assistenza", "seller": "Davide De Paola", "company": "Philips", "start": "2025-11-25", "end": "2026-11-24", "notice": 60, "renew": false, "value": 145000.0, "bill": "trimestrale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 6, "code": "DEMO-2026-006", "title": "Noleggio con manutenzione — Centro Medico Rocca", "cust": "ROCCA", "type": "noleggio", "seller": "Andrea Alagia", "company": "Medical Imaging", "start": "2025-12-12", "end": "2026-12-11", "notice": 90, "renew": false, "value": 167750.0, "bill": "una_tantum", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 20, "code": "DEMO-2026-020", "title": "Licenza software RIS — Centro Medico Rocca", "cust": "ROCCA", "type": "licenza", "seller": "Marco Bianchi (agente esterno)", "company": "Medical Imaging", "start": "2024-12-26", "end": "2026-12-26", "notice": 60, "renew": false, "value": 96250.0, "bill": "mensile", "st": "disdetto", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 7, "code": "DEMO-2026-007", "title": "Manutenzione ordinaria — Rizzoli", "cust": "Rizzoli", "type": "assistenza", "seller": null, "company": "Biotron", "start": "2025-01-05", "end": "2027-01-05", "notice": 90, "renew": true, "value": 116250.0, "bill": "mensile", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 8, "code": "DEMO-2026-008", "title": "Licenza software RIS — AUSL Bologna", "cust": "AUSL Bologna", "type": "licenza", "seller": "Marco Bianchi (agente esterno)", "company": "Philips", "start": "2026-01-21", "end": "2027-01-20", "notice": 120, "renew": false, "value": 42250.0, "bill": "una_tantum", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 17, "code": "DEMO-2026-017", "title": "Manutenzione ordinaria — Centro Medico Esperia", "cust": "ESPERIA", "type": "assistenza", "seller": "Davide De Paola", "company": "Biotron", "start": "2026-01-26", "end": "2027-01-25", "notice": 90, "renew": false, "value": 75500.0, "bill": "annuale", "st": "bozza", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 9, "code": "DEMO-2026-009", "title": "Noleggio apparecchiature — Policlinico Città di Udine", "cust": "UDINE", "type": "noleggio", "seller": "Davide De Paola", "company": "Philips", "start": "2024-02-25", "end": "2027-02-24", "notice": 180, "renew": false, "value": 72500.0, "bill": "trimestrale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 10, "code": "DEMO-2026-010", "title": "Manutenzione ordinaria — Centro Medico Esperia", "cust": "ESPERIA", "type": "assistenza", "seller": "Andrea Alagia", "company": "Biotron", "start": "2026-03-27", "end": "2027-03-26", "notice": 60, "renew": true, "value": 87500.0, "bill": "annuale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 11, "code": "DEMO-2026-011", "title": "Assistenza full-risk — Olomed Manzano", "cust": "MANZANO", "type": "assistenza", "seller": "Studio Rossi Agenzia", "company": "Biotron", "start": "2025-05-15", "end": "2027-05-15", "notice": 90, "renew": false, "value": 98750.0, "bill": "annuale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 12, "code": "DEMO-2026-012", "title": "Licenza PACS — AUSL Imola", "cust": "IMOLA", "type": "licenza", "seller": "Marco Bianchi (agente esterno)", "company": "Philips", "start": "2026-07-15", "end": "2027-07-14", "notice": 30, "renew": true, "value": 89500.0, "bill": "mensile", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 18, "code": "DEMO-2026-018", "title": "Noleggio operativo — Olomed Manzano", "cust": "MANZANO", "type": "noleggio", "seller": "Andrea Alagia", "company": "Biotron", "start": "2025-08-23", "end": "2027-08-23", "notice": 90, "renew": false, "value": 27250.0, "bill": "una_tantum", "st": "bozza", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 13, "code": "DEMO-2026-013", "title": "Noleggio operativo — Centro Medico Rocca", "cust": "ROCCA", "type": "noleggio", "seller": "Davide De Paola", "company": "Medical Imaging", "start": "2024-09-22", "end": "2027-09-22", "notice": 90, "renew": false, "value": 119000.0, "bill": "annuale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 14, "code": "DEMO-2026-014", "title": "Supporto remoto 8x5 — Rizzoli", "cust": "Rizzoli", "type": "assistenza", "seller": null, "company": "Biotron", "start": "2025-12-01", "end": "2027-12-01", "notice": 90, "renew": false, "value": 21500.0, "bill": "mensile", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 15, "code": "DEMO-2026-015", "title": "Formazione e consulenza — AUSL Bologna", "cust": "AUSL Bologna", "type": "altro", "seller": "Studio Rossi Agenzia", "company": "Philips", "start": "2025-04-20", "end": "2028-04-19", "notice": 60, "renew": false, "value": 149250.0, "bill": "trimestrale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}, {"id": 16, "code": "DEMO-2026-016", "title": "Noleggio con manutenzione — Policlinico Città di Udine", "cust": "UDINE", "type": "noleggio", "seller": "Marco Bianchi (agente esterno)", "company": "Philips", "start": "2024-09-27", "end": "2028-09-26", "notice": 180, "renew": true, "value": 19250.0, "bill": "annuale", "st": "attivo", "dev": [], "notes": "Contratto placeholder per test (DEMO).", "doc": false}];

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Contratti');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Anagrafiche ────────────────────────────────────────────────
  const TYPES = [
    ['assistenza', 'Assistenza', 'wrench', 'Manutenzione e supporto'],
    ['noleggio', 'Noleggio', 'monitor', 'Apparecchiature a canone'],
    ['licenza', 'Licenza', 'key', 'Software RIS, PACS…'],
    ['altro', 'Altro', 'file', 'Formazione, consulenza'],
  ];
  const TYPEL = Object.fromEntries(TYPES.map((t) => [t[0], t[1]]));
  const BILL = [['una_tantum', 'Una tantum'], ['mensile', 'Mensile'], ['trimestrale', 'Trimestrale'], ['annuale', 'Annuale']];
  const BILLL = Object.fromEntries(BILL);
  const STL = { bozza: 'Bozza', attivo: 'Attivo', disdetto: 'Disdetto' };
  const SELLERS = ['Andrea Alagia', 'Davide De Paola', 'Marco Bianchi (agente esterno)', 'Studio Rossi Agenzia'];
  const COMPANIES = ['Biotron', 'Medical Imaging', 'Philips'];
  const CUSTOMERS = ['AUSL Bologna', 'ESPERIA', 'IMOLA', 'MANZANO', 'Rizzoli', 'ROCCA', 'UDINE', 'Casa di Cura Villa Erbosa', 'Ospedale di Cento'];
  const CUST_CO = {}; ROWS.forEach((r) => { CUST_CO[r.cust] ??= r.company; });
  CUST_CO['Casa di Cura Villa Erbosa'] = 'Biotron'; CUST_CO['Ospedale di Cento'] = 'Philips';
  const DEVICES = {
    'AUSL Bologna': ['CT 1 · Siemens SOMATOM go.Top', 'RM 1 · Philips Ingenia 1.5T', 'Mammografo · Hologic 3Dimensions', 'Workstation refertazione 3'],
    IMOLA: ['CT 2 · Siemens SOMATOM', 'Telecomandato · GE Precision 500D', 'Ecografo · Philips EPIQ 7'],
    MANZANO: ['RX 1 · Carestream DRX', 'Ortopantomografo · Planmeca'],
    ROCCA: ['RM · Philips Ingenia 3T', 'CT · Canon Aquilion'],
    ESPERIA: ['Ecografo · Esaote MyLab', 'RX · Fujifilm FDR'],
    UDINE: ['CT 64 · GE Revolution', 'Angiografo · Philips Azurion'],
    Rizzoli: ['RX sala 2 · Siemens Ysio', 'MOC · Hologic Horizon'],
  };
  // Qualche dato in più per mostrare tutti gli stati del pannello.
  const extra = { 'DEMO-2026-004': { dev: DEVICES.MANZANO, doc: 'licenza-ris-manzano-firmato.pdf' }, 'DEMO-2026-001': { dev: DEVICES['AUSL Bologna'].slice(0, 2) }, 'DEMO-2026-006': { doc: 'noleggio-rocca-2023.pdf' } };
  ROWS.forEach((r) => Object.assign(r, extra[r.code] || {}, { doc: (extra[r.code] || {}).doc || null }));

  // ── Date e importi ─────────────────────────────────────────────
  const D = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const daysTo = (s) => Math.round((D(s) - TODAY) / DAY);
  const dShort = (s) => (s ? D(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const daysLabel = (s) => { const n = daysTo(s); if (n === 0) return 'oggi'; if (n === 1) return 'domani'; if (n === -1) return 'ieri'; if (n > 0) return n > 60 ? `tra ${Math.round(n / 30)} mesi` : `tra ${n} giorni`; return -n > 60 ? `${Math.round(-n / 30)} mesi fa` : `${-n} giorni fa`; };
  const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = D(s); d.setMonth(d.getMonth() + n); return iso(d); };
  const noticeOf = (r) => addDays(r.end, -r.notice);
  const monthsOf = (a, b) => Math.max(1, Math.round((D(b) - D(a)) / (30.44 * DAY)));
  const eur = (n) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
  const expiry = (r) => {
    if (r.st !== 'attivo') return 'none';
    const n = daysTo(r.end);
    if (n < 0) return 'expired';
    if (n <= 30) return 'expiring';
    if (daysTo(noticeOf(r)) <= 0) return 'notice';
    return 'ok';
  };
  const EXP = { none: ['—', 'neutral'], ok: ['In corso', 'success'], notice: ['Preavviso', 'warning'], expiring: ['In scadenza', 'warning'], expired: ['Scaduto', 'error'] };
  const MARK = {
    dot: '<circle cx="6" cy="6" r="4" fill="currentColor"/>',
    ring: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 1.6"/>',
    dash: '<path d="M2.5 6h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    half: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor"/>',
    bang: '<path d="M6 1.6 10.8 10H1.2z" fill="currentColor"/><path d="M6 4.6v2.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="8.6" r=".7" fill="#fff"/>',
  };
  const badge = (tone, mark, label, tip = '') => `<span class="cb t-${tone}"${tip ? ` title="${tip}"` : ''}><svg viewBox="0 0 12 12" aria-hidden="true">${MARK[mark]}</svg>${label}</span>`;
  const statusBadge = (st) => badge(st === 'attivo' ? 'success' : 'neutral', { bozza: 'ring', attivo: 'dot', disdetto: 'dash' }[st], STL[st]);
  const hint = (r) => {
    const e = expiry(r); const n = noticeOf(r);
    return { expired: `Finito il ${dShort(r.end)}: rinnovalo o segnalo come disdetto.`, expiring: `Meno di 30 giorni alla fine (${dShort(r.end)}): rinnovalo o segnalo come disdetto.`, notice: `Termine di disdetta passato il ${dShort(n)}: senza disdetta va rinnovato.`, ok: `Disdetta possibile fino al ${dShort(n)} (${daysLabel(n)}).`, none: 'Contratto non attivo: la scadenza non viene seguita.' }[e];
  };
  const stateCell = (r) => { if (r.st !== 'attivo') return statusBadge(r.st); const e = expiry(r); return badge(EXP[e][1], { ok: 'dot', notice: 'half', expiring: 'half', expired: 'bang' }[e], EXP[e][0], hint(r)); };
  const pbar = (start, end, notice, e, big) => {
    const s = D(start), en = D(end); const span = Math.max(1, en - s);
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const today = clamp((TODAY - s) / span); const started = TODAY >= s; const ended = TODAY > en;
    const nt = notice && e !== 'none' ? clamp((D(notice) - s) / span) : null;
    const col = { ok: 'var(--success)', notice: 'var(--warning)', expiring: 'var(--warning)', expired: 'var(--error)', none: 'var(--faint)', draft: 'var(--primary)' }[e];
    return `<div class="pb${big ? ' big' : ''}" aria-hidden="true"><span class="tr"></span>${nt != null ? `<span class="nt" style="left:${nt * 100}%"></span>` : ''}${started ? `<span class="fl" style="width:${today * 100}%;background:${col};opacity:${e === 'none' ? .45 : .9}"></span>` : ''}${nt != null && big ? `<span class="tick" style="left:${nt * 100}%"></span>` : ''}${started && !ended ? `<span class="now" style="left:${today * 100}%;border-color:${col}"></span>` : ''}</div>`;
  };
  const pbarLabels = (start, end, notice, e) => `<div class="pb-l"><span>${dShort(start)}</span>${notice && e !== 'none' ? `<span class="nd">disdetta entro ${dShort(notice)}</span>` : ''}<span>${dShort(end)}</span></div>`;
  const pdfIcon = '<svg class="pdf-ic" viewBox="0 0 32 40" aria-hidden="true"><path d="M5 1.5h16.5l8 8V37a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 37V3A1.5 1.5 0 0 1 5 1.5z" fill="#fff" stroke="#c9d1d8"/><path d="M21.5 1.5V8a1.5 1.5 0 0 0 1.5 1.5h6.5" fill="#e9edf1" stroke="#c9d1d8"/><rect x="1" y="21" width="22" height="11" rx="2" fill="#d93a2e"/><text x="12" y="29.2" text-anchor="middle" font-family="Geist, sans-serif" font-size="7.2" font-weight="700" fill="#fff">PDF</text></svg>';

  // ── Indicatori ─────────────────────────────────────────────────
  const kpiWrap = $('[data-ct-kpis]');
  const renderKpis = () => {
    const act = ROWS.filter((r) => r.st === 'attivo');
    const by = (e) => act.filter((r) => expiry(r) === e).length;
    const att = by('notice') + by('expiring');
    const val = act.filter((r) => expiry(r) !== 'expired').reduce((s, r) => s + r.value, 0);
    const next = act.filter((r) => daysTo(r.end) >= 0).sort((a, b) => D(a.end) - D(b.end)).slice(0, 4);
    const parts = [['ok', 'In corso', by('ok'), 'var(--success)', 'run'], ['att', 'Da gestire', att, 'var(--warning)', 'att'], ['expired', 'Scaduti', by('expired'), 'var(--error)', 'exp']].filter((p) => p[2]);
    kpiWrap.innerHTML = `<div class="kpis ct-kpis" role="group" aria-label="Indicatori contratti">
      <div class="kpi kpi-prio"><span class="kpi-h">Attivi</span><span class="kpi-v">${act.length}<small>di ${ROWS.length}</small></span>
        <div class="bar">${parts.map((p) => `<span style="flex:${p[2]};background:${p[3]}" title="${p[1]} · ${p[2]}"></span>`).join('')}</div>
        <div class="lg">${parts.map((p) => `<button type="button" data-goview="${p[4]}"><i style="background:${p[3]}"></i>${p[1]} <b>${p[2]}</b></button>`).join('')}</div>
        <span class="kpi-s"><b>${eur(val)}</b> di valore in corso</span></div>
      <button type="button" class="kpi" data-goview="att"${view === 'att' ? ' aria-pressed="true"' : ''}><span class="kpi-h">Da gestire<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${att}</span><span class="kpi-s"><b>${by("expiring")}</b> entro 30 giorni · <b>${by("notice")}</b> oltre la disdetta</span></button>
      <button type="button" class="kpi" data-goview="exp"${view === 'exp' ? ' aria-pressed="true"' : ''}><span class="kpi-h">Scaduti<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${by('expired')}</span><span class="kpi-s">${by('expired') ? 'ancora attivi: rinnova o segna disdetto' : 'nessun contratto da sistemare'}</span></button>
      <div class="kpi"><span class="kpi-h">Prossime scadenze</span><div class="ct-next">${next.map((r) => { const w = ['expiring', 'notice'].includes(expiry(r)); return `<button type="button" data-open="${r.id}" title="${r.code} · ${r.title}"><span class="n"><b>${r.cust}</b> · ${r.title}</span><span class="d${w ? ' warn' : ''}">${dShort(r.end)} · ${daysLabel(r.end)}</span></button>`; }).join('') || '<span class="kpi-s">Nessuna scadenza in arrivo.</span>'}</div></div>
    </div>`;
  };

  // ── Viste, colonne, filtri ─────────────────────────────────────
  const VIEWS = [['all', 'Tutti', () => true], ['att', 'Da gestire', (r) => ['notice', 'expiring'].includes(expiry(r))], ['exp', 'Scaduti', (r) => expiry(r) === 'expired'], ['run', 'In corso', (r) => expiry(r) === 'ok'], ['draft', 'Bozze', (r) => r.st === 'bozza'], ['canc', 'Disdetti', (r) => r.st === 'disdetto']];
  let view = 'all';
  const COLS = [
    { k: 'c-code', l: 'Codice', cmp: (a, b) => a.code.localeCompare(b.code) },
    { k: 'c-title', l: 'Contratto', cmp: (a, b) => a.title.localeCompare(b.title) },
    { k: 'c-cust', l: 'Cliente', set: (r) => r.cust, cmp: (a, b) => a.cust.localeCompare(b.cust) },
    { k: 'c-type', l: 'Tipo', set: (r) => TYPEL[r.type], cmp: (a, b) => a.type.localeCompare(b.type) },
    { k: 'c-seller', l: 'Venditore', set: (r) => r.seller || 'Nessuno', cmp: (a, b) => (a.seller || '~').localeCompare(b.seller || '~') },
    { k: 'c-per', l: 'Periodo', set: (r) => { const y = []; for (let i = D(r.start).getFullYear(); i <= D(r.end).getFullYear(); i++) y.push(String(i)); return y; }, cmp: (a, b) => D(a.start) - D(b.start) },
    { k: 'c-end', l: 'Fine', cmp: (a, b) => D(a.end) - D(b.end) },
    { k: 'c-val', l: 'Valore', num: true, cmp: (a, b) => a.value - b.value },
    { k: 'c-st', l: 'Stato', set: (r) => (r.st === 'attivo' ? EXP[expiry(r)][0] : STL[r.st]), cmp: (a, b) => a.st.localeCompare(b.st) },
  ];
  const vals = (c, r) => [].concat(c.set(r));
  const filters = {}; let sort = { k: 'c-end', dir: 1 };
  const headRow = $('[data-ct-head]'); const tbody = $('[data-ct-rows]');
  const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
  const arrow = (d) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d > 0 ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'}"/></svg>`;
  const paintHead = () => {
    headRow.innerHTML = COLS.map((c) => `<th class="${c.k}${c.num ? ' num-r' : ''}"><div class="th-in"><button type="button" class="th-sort${sort.k === c.k ? ' is-on' : ''}" data-sort="${c.k}">${c.l}${sort.k === c.k ? arrow(sort.dir) : ''}</button>${c.set ? `<button type="button" class="th-filter${filters[c.k]?.size ? ' is-on' : ''}" data-filter="${c.k}" aria-label="Filtra ${c.l}">${funnel}</button>` : ''}</div></th>`).join('');
  };
  const visible = () => ROWS.filter(VIEWS.find((v) => v[0] === view)[2]).filter((r) => Object.entries(filters).every(([k, s]) => !s.size || vals(COLS.find((c) => c.k === k), r).some((v) => s.has(v))));
  let selected = null;
  const sorted = () => { const c = COLS.find((x) => x.k === sort.k); return visible().sort((a, b) => sort.dir * c.cmp(a, b) || a.id - b.id); };
  const renderRows = () => {
    const rows = sorted();
    tbody.innerHTML = rows.map((r) => {
      const e = expiry(r); const n = daysTo(r.end);
      return `<tr data-id="${r.id}" tabindex="0" class="${r.id === selected ? 'is-selected' : ''}">
      <td class="c-code">${r.code}</td>
      <td class="c-title"><b>${r.title}</b></td>
      <td class="c-cust">${r.cust}</td>
      <td class="c-type">${TYPEL[r.type]}</td>
      <td class="c-seller">${r.seller || '<span class="none">—</span>'}</td>
      <td class="c-per" title="${dShort(r.start)} → ${dShort(r.end)} · disdetta entro ${dShort(noticeOf(r))}">${pbar(r.start, r.end, noticeOf(r), e)}</td>
      <td class="c-end">${dShort(r.end)}${e !== 'none' ? `<small class="${e === 'expired' ? 'err' : e === 'ok' ? '' : 'warn'}">${daysLabel(r.end)}</small>` : ''}</td>
      <td class="c-val num-r">${eur(r.value)}</td>
      <td class="c-st">${stateCell(r)}</td></tr>`;
    }).join('') || `<tr><td colspan="${COLS.length}" style="height:96px;text-align:center;color:var(--muted)">Nessun contratto con questi filtri.</td></tr>`;
    $('[data-ct-foot]').innerHTML = `<span><b>${rows.length}</b> di ${ROWS.length} contratti</span><span>Valore <b>${eur(rows.reduce((s, r) => s + r.value, 0))}</b></span><span class="sp"></span><span>dati demo del dev</span>`;
    paintTokens(); paintViews();
  };
  const paintViews = () => { $('[data-ct-views]').innerHTML = VIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === view}" data-view="${k}">${l} <span>${ROWS.filter(f).length}</span></button>`).join('') + `<button type="button" class="v-add">${ic('plus')}Salva vista</button>`; };
  const paintTokens = () => {
    const t = Object.entries(filters).filter(([, s]) => s.size).map(([k, s]) => `<span class="token"><span class="tk">${COLS.find((c) => c.k === k).l}</span> <b>${[...s].join(', ')}</b><button type="button" class="tk-x" data-unf="${k}" aria-label="Rimuovi filtro">${ic('x')}</button></span>`);
    $('[data-ct-tokens]').innerHTML = t.length ? t.join('') + '<button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button>' : '<span class="none" style="font-size:12px">Nessun filtro. Usa l\'imbuto accanto al nome di una colonna.</span>';
  };
  $('[data-ct-views]').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { view = b.dataset.view; renderKpis(); renderRows(); } });
  kpiWrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goview]'); if (b) { view = view === b.dataset.goview ? 'all' : b.dataset.goview; renderKpis(); renderRows(); return; }
    const o = e.target.closest('[data-open]'); if (o) open(Number(o.dataset.open));
  });
  $('[data-ct-tokens]').addEventListener('click', (e) => { const b = e.target.closest('[data-unf]'); if (!b) return; if (b.dataset.unf === '*') Object.keys(filters).forEach((k) => delete filters[k]); else delete filters[b.dataset.unf]; paintHead(); renderRows(); });
  const cpop = document.createElement('div'); cpop.className = 'cpop'; cpop.hidden = true; document.body.appendChild(cpop);
  headRow.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sort]');
    if (s) { sort = sort.k === s.dataset.sort ? { k: s.dataset.sort, dir: -sort.dir } : { k: s.dataset.sort, dir: 1 }; paintHead(); renderRows(); return; }
    const f = e.target.closest('[data-filter]'); if (!f) return; e.stopPropagation();
    const c = COLS.find((x) => x.k === f.dataset.filter); const cur = filters[c.k] || new Set();
    const all = [...new Set(ROWS.flatMap((r) => vals(c, r)))].sort((a, b) => a.localeCompare(b, 'it'));
    cpop.innerHTML = `<div class="srt"><button type="button" data-cs="1">Crescente</button><button type="button" data-cs="-1">Decrescente</button></div>
      ${all.map((v) => `<label><input type="checkbox" value="${v}"${cur.has(v) ? ' checked' : ''}>${c.k === 'c-per' ? `Attivi nel ${v}` : v}<small>${ROWS.filter((r) => vals(c, r).includes(v)).length}</small></label>`).join('')}
      <div class="cp-f"><button type="button" class="btn btn-ghost btn-sm" data-cclear>Rimuovi filtro</button><button type="button" class="btn btn-primary btn-sm" data-capply>Applica</button></div>`;
    cpop.dataset.k = c.k; const r = f.getBoundingClientRect();
    cpop.style.left = Math.max(8, Math.min(r.right - 240, innerWidth - 256)) + 'px'; cpop.style.top = (r.bottom + 6) + 'px'; cpop.hidden = false;
  });
  cpop.addEventListener('click', (e) => {
    const k = cpop.dataset.k;
    if (e.target.closest('[data-cs]')) sort = { k, dir: Number(e.target.closest('[data-cs]').dataset.cs) };
    else if (e.target.closest('[data-cclear]')) delete filters[k];
    else if (e.target.closest('[data-capply]')) filters[k] = new Set([...cpop.querySelectorAll('input:checked')].map((i) => i.value));
    else return;
    cpop.hidden = true; paintHead(); renderRows();
  });
  document.addEventListener('click', (e) => { if (!cpop.hidden && !e.target.closest('.cpop')) cpop.hidden = true; });

  // ── Pannello ───────────────────────────────────────────────────
  const drawer = $('[data-ct-drawer]'); const body = $('[data-cbody]'); const shell = $('.shell');
  let tab = 'det'; let ppOpen = false;
  const row = () => ROWS.find((r) => r.id === selected);
  const props = (r) => `<section class="pp${ppOpen ? ' is-open' : ''}" aria-label="Proprietà">
      <button type="button" class="pp-t" data-pp-toggle aria-expanded="${ppOpen}"><span class="pp-pm" aria-hidden="true"></span><span class="pp-tl">Proprietà</span>
        <span class="pp-sum">${ppOpen ? '<span class="pp-hint">clic su un valore per modificarlo · si salva subito</span>' : `<b style="font-weight:500">${TYPEL[r.type]}</b><span style="color:var(--muted)">${[r.seller, r.company].filter(Boolean).join(' · ')}</span>`}</span></button>
      <div class="pp-grid"${ppOpen ? '' : ' hidden'}>
        ${[['Stato', statusBadge(r.st)], ['Tipo', TYPEL[r.type]], ['Cliente', `<b>${r.cust}</b>`], ['Venditore', r.seller || '<span class="none">—</span>'], ['Società', r.company || '—'], ['Fatturazione', BILLL[r.bill]], ['Inizio', dShort(r.start)], ['Fine', dShort(r.end)], ['Preavviso', `${r.notice} giorni`], ['Rinnovo automatico', r.renew ? 'Sì' : 'No'], ['Valore totale', eur(r.value)]]
          .map(([k, v]) => `<button type="button" class="pp-i"><span class="k">${k}</span><span class="v">${v}</span>${ic('chevD')}</button>`).join('')}
        <button type="button" class="pp-i pp-full"><span class="k">Codice</span><span class="v code">${r.code}</span>${ic('wrench')}</button>
      </div></section>`;
  const details = (r) => {
    const e = expiry(r); const m = monthsOf(r.start, r.end);
    const act = ['expired', 'expiring', 'notice'].includes(e);
    return `${props(r)}
      <section class="ct-sec"><div class="h"><h4>Periodo</h4>${r.st === 'attivo' ? stateCell(r) : ''}</div>
        ${pbar(r.start, r.end, noticeOf(r), e, true)}${pbarLabels(r.start, r.end, noticeOf(r), e)}
        <div class="callout${act ? (e === 'expired' ? ' err' : ' warn') : ''}"><div><b>${r.st !== 'attivo' ? `Contratto ${STL[r.st].toLowerCase()}` : e === 'expired' ? `Scaduto il ${dShort(r.end)}` : `Finisce ${daysLabel(r.end)}`}</b><span>${hint(r)}${r.renew ? ' Rinnovo automatico indicato nel contratto.' : ''}</span></div></div></section>
      <section class="amt"><div class="amt-h"><h4>Importo</h4></div>
        <div class="amt-main"><b>${eur(r.value)}</b><span>su ${m} mesi · fatturazione ${BILLL[r.bill].toLowerCase()}</span></div>
        <div class="amt-row two"><div><span>Al mese</span><b>${eur(r.value / m)}</b></div><div><span>All'anno</span><b>${eur(r.value / m * 12)}</b></div></div>
        <p class="note-p" style="margin:0">Ripartizione lineare sul periodo del contratto.</p></section>
      <section class="ct-sec"><div class="h"><h4>Documento</h4></div>
        ${r.doc ? `<div class="doc-row">${pdfIcon}<div class="fn"><b>${r.doc}</b><span>PDF del contratto</span></div><button class="icon-btn" type="button" aria-label="Apri">${ic('eye')}</button><button class="icon-btn" type="button" aria-label="Sostituisci">${ic('upload')}</button><button class="icon-btn" type="button" aria-label="Rimuovi">${ic('trash')}</button></div>`
          : `<button type="button" class="doc-drop">${ic('upload')}<span><b>Carica il PDF del contratto</b><span>Un solo file, visibile a chi vede i valori</span></span></button>`}</section>
      <section class="ct-sec"><div class="h"><h4>Note</h4></div><p class="desc-p">${r.notes || '<span class="none">Nessuna nota.</span>'}</p></section>`;
  };
  const devices = (r) => (r.dev && r.dev.length ? `<ul class="dev-l">${r.dev.map((d, i) => `<li><span class="tl">${ic('monitor')}</span><span><b>${d}</b><small>S/N ${r.code.slice(-3)}${String(100 + i * 37)}</small></span></li>`).join('')}</ul>` : '<p class="note-p">Nessun device collegato: aggiungili da «Modifica tutti i campi».</p>');
  const activity = (r) => `<div class="feed">${[['plus', 'F. Mutuale', 'ha creato il contratto', dShort(r.start)], ...(r.doc ? [['upload', 'F. Mutuale', 'ha caricato il PDF', dShort(r.start)]] : []), ['wrench', 'A. Alagia', 'ha modificato il venditore', '12 ott 2026']].map(([i, w, t, d]) => `<div class="ev">${ic(i)}<span><b>${w}</b> ${t}</span><time>${d}</time></div>`).join('')}</div>`;
  const render = () => {
    const r = row(); if (!r) return;
    $('[data-cd="id"]').textContent = r.code;
    $('[data-cd="st"]').innerHTML = statusBadge(r.st);
    $('[data-cd="title"]').textContent = r.title;
    $('[data-cd="sub"]').textContent = `${r.cust} · ${TYPEL[r.type]} · ${dShort(r.start)} → ${dShort(r.end)}`;
    const vis = sorted().map((x) => x.id); const ix = vis.indexOf(r.id);
    $('[data-cd="pos"]').textContent = ix < 0 ? '' : `${ix + 1} di ${vis.length}`;
    $('[data-ctabs]').innerHTML = [['det', 'Dettagli'], ['dev', `Device <span class="tn">${(r.dev || []).length}</span>`], ['att', 'Attività']].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('');
    const foot = tab === 'det' ? `<div class="drawer-foot"><button class="btn" type="button">${ic('wrench')}Modifica</button><span class="g-spacer"></span>${r.st === 'attivo' ? `<button class="btn btn-primary" type="button" data-renew>${ic('restore')}Rinnova</button>` : ''}</div>` : '';
    body.innerHTML = `<div class="drawer-body int-body">${tab === 'det' ? details(r) : tab === 'dev' ? devices(r) : activity(r)}</div>${foot}`;
  };
  const open = (id) => {
    selected = id; drawer.hidden = false; shell.classList.add('has-drawer'); tab = 'det';
    tbody.querySelectorAll('tr').forEach((t) => t.classList.toggle('is-selected', Number(t.dataset.id) === id));
    render();
  };
  const close = () => { drawer.hidden = true; selected = null; shell.classList.remove('has-drawer'); tbody.querySelectorAll('tr').forEach((t) => t.classList.remove('is-selected')); };
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); });
  tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); } });
  $('[data-cclose]').addEventListener('click', close);
  $('[data-ctabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  const step = (d) => { const vis = sorted().map((x) => x.id); const n = vis[vis.indexOf(selected) + d]; if (n) open(n); };
  drawer.querySelectorAll('[data-cstep]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.cstep))));

  const toast = $('[data-toast]'); let undo = null; let tt = null;
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const showToast = (msg, u) => { undo = u; toast.innerHTML = `${tick}<span>${msg}</span>${u ? '<button type="button" data-undo>Annulla</button>' : ''}`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 6000); };
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toast.hidden = true; } });
  const refresh = () => { renderKpis(); renderRows(); render(); };
  body.addEventListener('click', (e) => {
    const r = row(); if (!r) return;
    if (e.target.closest('[data-pp-toggle]')) { ppOpen = !ppOpen; render(); return; }
    if (e.target.closest('[data-renew]')) {
      const prev = { start: r.start, end: r.end }; const m = monthsOf(r.start, r.end);
      r.start = addDays(r.end, 1); r.end = addDays(addMonths(r.start, m), -1); refresh();
      showToast(`Rinnovato fino al ${dShort(r.end)}`, () => { Object.assign(r, prev); refresh(); });
    }
  });

  // ══ Nuovo contratto ═════════════════════════════════════════════
  const mdl = $('[data-mdl]'); const box = $('.mdl', mdl);
  let variant = 'a'; let f = null; let stepB = 1;
  const nextCode = () => `CTR-2026-${String(Math.max(...ROWS.map((r) => Number(r.code.slice(-3)))) + 1).padStart(3, '0')}`;
  const blank = () => ({ cust: '', type: '', seller: '', company: '', code: nextCode(), title: '', titleTouched: false, start: '2026-12-01', dur: 12, endCustom: '', notice: 90, renew: false, value: '', bill: 'annuale', devices: [], notes: '', pdf: null, errors: {} });
  const endOf = () => (f.dur ? addDays(addMonths(f.start, f.dur), -1) : f.endCustom || f.start);
  const autoTitle = () => (f.type && f.cust ? `${TYPEL[f.type]} — ${f.cust}` : '');
  const num = () => { const n = Number(String(f.value).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const nRates = (m) => ({ una_tantum: 1, mensile: m, trimestrale: Math.ceil(m / 3), annuale: Math.ceil(m / 12) }[f.bill]);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // Pezzi di modulo condivisi
  const custField = (lbl = 'Cliente') => `<div class="f combo${f.errors.cust ? ' has-error' : ''}"><label for="nc-cust">${lbl} <span class="req">*</span></label>
    <input id="nc-cust" data-combo autocomplete="off" placeholder="Cerca il cliente…" value="${esc(f.cust)}" role="combobox" aria-expanded="false" aria-controls="nc-cl">
    <div class="combo-l" id="nc-cl" role="listbox" hidden></div>${f.errors.cust ? '<span class="help">Scegli il cliente.</span>' : ''}</div>`;
  const sellerCompany = () => `<div class="row2">
    <div class="f"><label for="nc-seller">Venditore</label><select id="nc-seller" data-k="seller"><option value="">Nessuno</option>${SELLERS.map((s) => `<option${s === f.seller ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="f"><label for="nc-co">Società</label><select id="nc-co" data-k="company">${COMPANIES.map((s) => `<option${s === (f.company || CUST_CO[f.cust]) ? ' selected' : ''}>${s}</option>`).join('')}</select>${f.cust && !f.company ? `<span class="help">Proposta dal cliente</span>` : ''}</div></div>`;
  const durChips = () => `<div class="f"><span class="lbl">Durata</span><div class="chips">${[12, 24, 36, 60].map((m) => `<button type="button" class="chip" data-dur="${m}" aria-pressed="${f.dur === m}">${m / 12 === 1 ? '1 anno' : `${m / 12} anni`}</button>`).join('')}<button type="button" class="chip" data-dur="0" aria-pressed="${!f.dur}">${ic('calendar')}Fino al…</button></div></div>`;
  const endField = () => (f.dur ? '' : `<div class="f${f.errors.end ? ' has-error' : ''}"><label for="nc-end">Fine</label><input id="nc-end" type="date" data-k="endCustom" value="${f.endCustom}">${f.errors.end ? '<span class="help">La fine non può precedere l\'inizio.</span>' : ''}</div>`);
  const noticeChips = () => `<div class="f"><span class="lbl">Preavviso di disdetta</span><div class="chips">${[30, 60, 90, 180].map((n) => `<button type="button" class="chip" data-notice="${n}" aria-pressed="${f.notice === n}">${n} giorni</button>`).join('')}</div></div>`;
  const renewSw = () => `<label class="sw"><input type="checkbox" data-k="renew"${f.renew ? ' checked' : ''}><span class="tg"></span><span>Rinnovo automatico<small>Solo promemoria: il rinnovo in Archie resta manuale</small></span></label>`;
  const valueBill = () => `<div class="row2" style="grid-template-columns:170px 1fr"><div class="f"><label for="nc-val">Valore totale</label><div class="money"><input id="nc-val" data-k="value" inputmode="decimal" placeholder="0,00" value="${esc(f.value)}"></div><span class="help">Visibile solo a chi vede i valori</span></div>
    <div class="f"><span class="lbl">Fatturazione</span><div class="seg2" role="group">${BILL.map(([k, l]) => `<button type="button" data-bill="${k}" aria-pressed="${f.bill === k}">${l}</button>`).join('')}</div></div></div>`;
  const codeTitle = () => `<div class="row2" style="grid-template-columns:150px 1fr"><div class="f"><label for="nc-code">Codice</label><input id="nc-code" class="mono" data-k="code" value="${esc(f.code)}"><span class="help">Proposto, modificabile</span></div>
    <div class="f${f.errors.title ? ' has-error' : ''}"><label for="nc-title">Titolo <span class="req">*</span></label><input id="nc-title" data-k="title" placeholder="es. Assistenza full-risk — AUSL Bologna" value="${esc(f.titleTouched ? f.title : autoTitle())}">${f.errors.title ? '<span class="help">Serve un titolo.</span>' : !f.titleTouched && autoTitle() ? '<span class="help">Composto da tipo e cliente</span>' : ''}</div></div>`;
  const devPick = () => { const list = DEVICES[f.cust] || []; return `<div class="f"><span class="lbl">Device collegati <span class="opt">· facoltativo</span></span><div class="dpick">${!f.cust ? '<span class="empty">Scegli prima il cliente.</span>' : list.length ? list.map((d) => `<button type="button" class="chip" data-dev="${esc(d)}" aria-pressed="${f.devices.includes(d)}">${f.devices.includes(d) ? ic('check') : ic('monitor')}${d}</button>`).join('') : '<span class="empty">Nessun device registrato per questo cliente.</span>'}</div></div>`; };
  const pdfField = () => `<div class="f"><span class="lbl">PDF del contratto <span class="opt">· facoltativo</span></span><label class="drop-sm${f.pdf ? ' has' : ''}">${f.pdf ? pdfIcon : ic('upload')}<span>${f.pdf ? `<b>${f.pdf}</b> · clic per cambiarlo` : '<b>Trascina qui il PDF</b> o sfoglia'}</span><input type="file" accept="application/pdf" hidden data-pdf></label></div>`;
  const notesField = () => `<div class="f"><label for="nc-notes">Note <span class="opt">· facoltativo</span></label><textarea id="nc-notes" data-k="notes" placeholder="Condizioni particolari, referenti, SLA…">${esc(f.notes)}</textarea></div>`;
  const typeChips = () => `<div class="f${f.errors.type ? ' has-error' : ''}"><span class="lbl">Tipo <span class="req">*</span></span><div class="chips">${TYPES.map(([k, l, i]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${f.type === k}">${ic(i)}${l}</button>`).join('')}</div>${f.errors.type ? '<span class="help">Scegli il tipo.</span>' : ''}</div>`;

  // Riepilogo vivo (A) e linea del periodo (B)
  const periodBox = () => {
    const end = endOf(); const nt = addDays(end, -f.notice); const m = monthsOf(f.start, end); const late = daysTo(nt) < 0;
    return `${pbar(f.start, end, nt, 'draft', true)}${pbarLabels(f.start, end, nt, variant === 'a' ? 'none' : 'ok')}
      <div class="sum-note${late ? ' warn' : ''}">${late ? `Il termine di disdetta (${dShort(nt)}) è già passato: il contratto nascerà in <b>Preavviso</b>.` : `${m} mesi · disdetta possibile fino al <b>${dShort(nt)}</b> (${daysLabel(nt)})${f.renew ? ' · rinnovo automatico' : ''}.`}</div>`;
  };
  const summary = () => {
    const end = endOf(); const m = monthsOf(f.start, end); const v = num(); const n = nRates(m);
    const title = f.titleTouched ? f.title : autoTitle();
    return `<span class="sum-h">Come apparirà</span>
      <div class="sum-card"><div class="t"><span class="code">${esc(f.code)}</span>${statusBadge('attivo')}</div>
        <h5 class="${title ? '' : 'ph'}">${title ? esc(title) : 'Titolo del contratto'}</h5>
        <div class="who">${[f.cust || 'Cliente da scegliere', f.type ? TYPEL[f.type] : null, f.seller || null].filter(Boolean).join(' · ')}</div>
        ${periodBox()}</div>
      <span class="sum-h">Importo</span>
      <div class="sum-card"><span class="sum-big">${v ? eur(v) : '—'}</span>
        <dl class="sum-k"><dt>Al mese</dt><dd>${v ? eur(v / m) : '—'}</dd><dt>All'anno</dt><dd>${v ? eur(v / m * 12) : '—'}</dd><dt>${BILLL[f.bill]}</dt><dd>${n} ${n === 1 ? 'fattura' : 'fatture'}${v ? ` da ${eur(v / n)}` : ''}</dd></dl>
        <div class="rates${n > 12 ? ' many' : ''}" aria-hidden="true">${Array.from({ length: Math.min(n, 60) }, () => '<i></i>').join('')}</div></div>
      ${f.devices.length || f.pdf ? `<div class="sum-note">${[f.devices.length ? `${f.devices.length} device collegati` : '', f.pdf ? 'PDF allegato' : ''].filter(Boolean).join(' · ')}</div>` : ''}`;
  };

  const renderA = () => {
    box.className = 'mdl nc nc-a-box';
    box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Nuovo contratto</h3><p>Compila a sinistra: a destra vedi subito periodo, disdetta e rate.</p></div><button class="icon-btn" type="button" data-mclose aria-label="Chiudi">${ic('x')}</button></div>
      <div class="nc-body"><div class="nc-a">
        <div class="form">
          <div class="grp"><div class="grp-h"><span class="num">1</span>Cliente e contratto</div>${custField()}${typeChips()}${sellerCompany()}${codeTitle()}</div>
          <div class="grp"><div class="grp-h"><span class="num">2</span>Periodo</div><div class="row2"><div class="f"><label for="nc-start">Inizio</label><input id="nc-start" type="date" data-k="start" value="${f.start}"></div>${endField() || '<span></span>'}</div>${durChips()}${noticeChips()}${renewSw()}</div>
          <div class="grp"><div class="grp-h"><span class="num">3</span>Valore</div>${valueBill()}</div>
          <div class="grp"><div class="grp-h"><span class="num">4</span>Collegamenti<small>tutto facoltativo</small></div>${devPick()}${pdfField()}${notesField()}</div>
        </div>
        <aside class="sum" data-sum aria-live="polite">${summary()}</aside>
      </div></div>
      <div class="nc-foot"><span class="hint"><span class="req" style="color:var(--error)">*</span> obbligatori</span><span class="sp"></span><button class="btn btn-ghost" type="button" data-mclose>Annulla</button><button class="btn" type="button" data-create="bozza">Salva come bozza</button><button class="btn btn-primary" type="button" data-create="attivo">${ic('check')}Crea contratto</button></div>`;
  };

  const STEPS = ['Cliente e tipo', 'Periodo', 'Valore e documenti'];
  const renderB = () => {
    box.className = 'mdl nc nc-b';
    const pane = stepB === 1
      ? `${custField()}<div class="f${f.errors.type ? ' has-error' : ''}"><span class="lbl">Che contratto è? <span class="req">*</span></span><div class="types">${TYPES.map(([k, l, i, d]) => `<button type="button" data-type="${k}" aria-pressed="${f.type === k}"><span class="tic">${ic(i)}</span><b>${l}</b><small>${d}</small></button>`).join('')}</div>${f.errors.type ? '<span class="help">Scegli il tipo.</span>' : ''}</div>${sellerCompany()}`
      : stepB === 2
        ? `<div class="row2"><div class="f"><label for="nc-start">Inizio</label><input id="nc-start" type="date" data-k="start" value="${f.start}"></div>${endField() || '<span></span>'}</div>${durChips()}${noticeChips()}
           <div class="tl-box"><div class="big"><b>${dShort(f.start)} → ${dShort(endOf())}</b><span>${monthsOf(f.start, endOf())} mesi</span></div><div data-sum>${periodBox()}</div></div>${renewSw()}`
        : `${codeTitle()}${valueBill()}<div class="sum-note" data-sum>${(() => { const m = monthsOf(f.start, endOf()); const n = nRates(m); const v = num(); return v ? `${n} ${n === 1 ? 'fattura' : 'fatture'} da <b>${eur(v / n)}</b> · ${eur(v / m * 12)} all'anno` : 'Il valore si può lasciare vuoto e aggiungere dopo.'; })()}</div>${devPick()}${pdfField()}${notesField()}`;
    box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Nuovo contratto</h3><p>${STEPS[stepB - 1]} · passo ${stepB} di 3</p></div><button class="icon-btn" type="button" data-mclose aria-label="Chiudi">${ic('x')}</button></div>
      <nav class="stp" aria-label="Passi">${STEPS.map((s, i) => `<button type="button" data-goto="${i + 1}" class="${i + 1 < stepB ? 'done' : i + 1 === stepB ? 'cur' : ''}"${i + 1 > stepB ? ' disabled' : ''}${i + 1 === stepB ? ' aria-current="step"' : ''}><span class="d">${i + 1 < stepB ? ic('check') : i + 1}</span><b>${s}</b></button>`).join('')}</nav>
      <div class="nc-body"><div class="pane">${pane}</div></div>
      <div class="nc-foot">${stepB > 1 ? `<div class="recap"><span><b>${esc(f.cust)}</b></span><span>${TYPEL[f.type] || ''}</span>${stepB > 2 ? `<span>${dShort(f.start)} → ${dShort(endOf())}</span>` : ''}</div>` : '<span class="hint">Il resto si completa nei passi successivi</span>'}<span class="sp"></span>
        ${stepB > 1 ? `<button class="btn btn-ghost" type="button" data-back>${ic('chevL')}Indietro</button>` : '<button class="btn btn-ghost" type="button" data-mclose>Annulla</button>'}
        ${stepB < 3 ? `<button class="btn btn-primary" type="button" data-next>Avanti${ic('chevR')}</button>` : `<button class="btn" type="button" data-create="bozza">Salva come bozza</button><button class="btn btn-primary" type="button" data-create="attivo">${ic('check')}Crea contratto</button>`}</div>`;
  };

  let focusNext = null;
  const paint = () => {
    const keep = focusNext ? null : document.activeElement?.id; const at = document.activeElement?.selectionStart;
    const sc = $('.nc-body', box)?.scrollTop || 0;
    (variant === 'a' ? renderA : renderB)();
    $('.nc-body', box).scrollTop = sc;
    if (keep) { const el = document.getElementById(keep); if (el) { el.focus(); try { if (at != null) el.setSelectionRange(at, at); } catch { /* date */ } } }
    if (focusNext) { box.querySelector(focusNext)?.focus(); focusNext = null; }
  };
  const repaintSum = () => {
    if (variant === 'a') { const s = $('[data-sum]', box); if (s) s.innerHTML = summary(); return; }
    paint();
  };
  const openNew = () => { f = blank(); stepB = 1; mdl.hidden = false; paint(); setTimeout(() => $('#nc-cust', box)?.focus(), 0); };
  const closeNew = () => { mdl.hidden = true; };
  const validate = (upto) => {
    f.errors = {};
    if (!f.cust) f.errors.cust = 1;
    if (!f.type) f.errors.type = 1;
    if (upto >= 2 && D(endOf()) < D(f.start)) f.errors.end = 1;
    if (upto >= 3 && !(f.titleTouched ? f.title.trim() : autoTitle())) f.errors.title = 1;
    return !Object.keys(f.errors).length;
  };
  const create = (st) => {
    if (!validate(3)) { if (variant === 'b') stepB = f.errors.cust || f.errors.type ? 1 : f.errors.end ? 2 : 3; paint(); box.querySelector('.has-error input, .has-error button')?.focus(); return; }
    const id = Math.max(...ROWS.map((r) => r.id)) + 1;
    const r = { id, code: f.code, title: f.titleTouched ? f.title.trim() : autoTitle(), cust: f.cust, type: f.type, seller: f.seller || null, company: f.company || CUST_CO[f.cust], start: f.start, end: endOf(), notice: f.notice, renew: f.renew, value: num(), bill: f.bill, st, dev: f.devices, notes: f.notes, doc: f.pdf };
    ROWS.push(r); closeNew(); view = 'all'; renderKpis(); renderRows(); open(id);
    showToast(`${st === 'bozza' ? 'Bozza salvata' : 'Contratto creato'} · ${r.code}`, () => { ROWS.splice(ROWS.indexOf(r), 1); close(); renderKpis(); renderRows(); });
  };

  // Eventi del dialogo
  box.addEventListener('input', (e) => {
    const t = e.target; const k = t.dataset.k;
    if (t.matches('[data-combo]')) { showCombo(t); return; }
    if (!k || t.type === 'date' || t.type === 'checkbox' || t.tagName === 'SELECT') return;
    if (k === 'title') { f.title = t.value; f.titleTouched = true; } else f[k] = t.value;
    repaintSum();
  });
  box.addEventListener('change', (e) => {
    const t = e.target; const k = t.dataset.k;
    if (t.matches('[data-pdf]')) { f.pdf = t.files[0]?.name || f.pdf; paint(); return; }
    // I campi di testo si aggiornano già con «input»: ridisegnare qui farebbe perdere il clic successivo.
    if (!k || (t.tagName === 'INPUT' && !['date', 'checkbox'].includes(t.type)) || t.tagName === 'TEXTAREA') return;
    if (t.type === 'checkbox') f[k] = t.checked; else f[k] = t.value;
    if (k === 'start' && !f.endCustom) f.endCustom = addDays(addMonths(f.start, 12), -1);
    paint();
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-pick]'); if (!b) return;
    if (b.matches('[data-mclose]')) return closeNew();
    if (b.dataset.pick != null) { f.cust = b.dataset.pick; f.company = ''; f.devices = []; delete f.errors.cust; focusNext = '[data-type]'; paint(); return; }
    if (b.dataset.type) { f.type = b.dataset.type; delete f.errors.type; paint(); return; }
    if (b.dataset.dur != null) { f.dur = Number(b.dataset.dur); if (!f.dur && !f.endCustom) f.endCustom = addDays(addMonths(f.start, 12), -1); paint(); return; }
    if (b.dataset.notice) { f.notice = Number(b.dataset.notice); paint(); return; }
    if (b.dataset.bill) { f.bill = b.dataset.bill; paint(); return; }
    if (b.dataset.dev) { const d = b.dataset.dev; f.devices = f.devices.includes(d) ? f.devices.filter((x) => x !== d) : [...f.devices, d]; paint(); return; }
    if (b.matches('[data-next]')) { if (validate(stepB)) stepB++; paint(); return; }
    if (b.matches('[data-back]')) { stepB--; paint(); return; }
    if (b.dataset.goto) { stepB = Number(b.dataset.goto); paint(); return; }
    if (b.dataset.create) create(b.dataset.create);
  });
  box.addEventListener('dragover', (e) => { if (e.target.closest('.drop-sm')) e.preventDefault(); });
  box.addEventListener('drop', (e) => { if (!e.target.closest('.drop-sm')) return; e.preventDefault(); f.pdf = e.dataTransfer.files[0]?.name || f.pdf; paint(); });
  // Combobox cliente
  const showCombo = (inp) => {
    const l = $('#nc-cl', box); const q = inp.value.trim().toLowerCase();
    const opts = CUSTOMERS.filter((c) => c.toLowerCase().includes(q));
    l.innerHTML = opts.map((c, i) => `<button type="button" role="option" data-pick="${esc(c)}" class="${i === 0 ? 'is-active' : ''}">${ic('building')}${c}<small>${ROWS.filter((r) => r.cust === c).length || 'nessun'} contratt${ROWS.filter((r) => r.cust === c).length === 1 ? 'o' : 'i'}</small></button>`).join('') || '<span class="none" style="padding:8px;display:block;font-size:12px">Nessun cliente</span>';
    l.hidden = false; inp.setAttribute('aria-expanded', 'true');
  };
  box.addEventListener('focusin', (e) => { if (e.target.matches('[data-combo]')) showCombo(e.target); });
  box.addEventListener('keydown', (e) => {
    const inp = e.target.closest('[data-combo]'); if (!inp) return;
    const l = $('#nc-cl', box); const items = [...l.querySelectorAll('[data-pick]')]; const cur = items.findIndex((i) => i.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items.forEach((i) => i.classList.remove('is-active')); items[(cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.classList.add('is-active'); }
    if (e.key === 'Enter') { e.preventDefault(); items[cur]?.click(); }
    if (e.key === 'Escape') { e.stopPropagation(); l.hidden = true; }
  });
  document.addEventListener('mousedown', (e) => { const l = $('#nc-cl', box); if (l && !l.hidden && !e.target.closest('.combo')) l.hidden = true; });
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) closeNew(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mdl.hidden) { closeNew(); return; }
    if (!mdl.hidden || drawer.hidden || e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape') close(); if (e.key === 'j') step(1); if (e.key === 'k') step(-1);
  });
  $('[data-new]').addEventListener('click', openNew);
  const vbtn = document.querySelectorAll('[data-ncv]');
  const setVariant = (v) => { variant = v; vbtn.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ncv === v))); try { localStorage.setItem('archie-preview-ct-nc', v); } catch { /* niente */ } };
  vbtn.forEach((b) => b.addEventListener('click', () => { setVariant(b.dataset.ncv); openNew(); }));
  let savedV = null; try { savedV = localStorage.getItem('archie-preview-ct-nc'); } catch { /* niente */ }
  const q = new URLSearchParams(location.search);
  setVariant(q.get('nuovo') || savedV || 'a');

  renderKpis(); paintHead(); renderRows();
  if (q.get('nuovo')) openNew();
  if (q.get('c')) open(Number(q.get('c')));
})();
