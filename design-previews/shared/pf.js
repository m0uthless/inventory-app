/* Piano ferie: tre proposte sullo stile "Campo sterile" (base h).
   Modello reale: attendance.Absence = persona × giorno × fascia (mattina/pomeriggio),
   motivo (ferie, malattia, 104, training, trasferta, altro), stato (proposta, validata,
   rifiutata); festività nazionali e locali per area; il coordinatore valida.
   Colori dei motivi: legenda HR di pianoFerieShared.ts, invariata. Dati finti. Oggi: 06/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Piano ferie');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Legenda HR (stessi valori di pianoFerieShared.ts) ──────────────
  const SW = {
    ferie_p: ['rgba(245,197,24,0.28)', '#8a6d0b', 'Ferie (proposta)'],
    ferie_v: ['rgba(0,176,80,0.20)', '#2f7d32', 'Ferie (validata)'],
    malattia: ['rgba(243,115,115,0.24)', '#b23b3b', 'Malattia/Infortunio'],
    permesso_104: ['rgba(242,184,245,0.34)', '#8e3d92', '104'],
    training: ['rgba(99,102,241,0.18)', '#4338ca', 'Training'],
    trasferta: ['rgba(55,138,221,0.18)', '#185fa5', 'Trasferta'],
    altro: ['rgba(172,185,202,0.30)', '#5f6b7a', 'Altro'],
    rifiutata: ['rgba(120,120,120,0.10)', '#8a8a8a', 'Rifiutata'],
  };
  const swKey = (a) => a.status === 'rifiutata' ? 'rifiutata' : a.reason === 'ferie' ? (a.status === 'validata' ? 'ferie_v' : 'ferie_p') : a.reason;
  const RL = { ferie: 'Ferie', malattia: 'Malattia/Infortunio', permesso_104: '104', training: 'Training', trasferta: 'Trasferta', altro: 'Altro' };
  const STL = { proposta: 'Proposta', validata: 'Validata', rifiutata: 'Rifiutata' };
  const PART = { all: 'giornata intera', mat: 'mattina', pom: 'pomeriggio' };

  // ── Persone, aree, festività ────────────────────────────────────────
  const ME = 'Federico Mutuale';
  const MY_AREA = 'AVEC';
  const PEOPLE = [
    ['Federico Mutuale', 'AVEC'], ['Federica Marchesini', 'AVEC'], ['Nicole Spazzoli', 'AVEC'], ['Leonardo Romano', 'AVEC'], ['Andrea Ferri', 'AVEC'],
    ['Chiara Bassi', 'Romagna'], ['Paolo Righi', 'Romagna'], ['Marco Lodi', 'Romagna'], ['Giulia Neri', 'Romagna'],
  ].map(([name, area], i) => ({ id: i + 1, name, area }));
  const AREAS = [...new Set(PEOPLE.map((p) => p.area))];
  const HOL = { '2026-11-01': 'Ognissanti', '2026-12-08': 'Immacolata Concezione', '2026-12-25': 'Natale', '2026-12-26': 'Santo Stefano' };
  const ini = (n) => n.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  // ── Assenze (intervalli) ────────────────────────────────────────────
  let seq = 100;
  const A = (who, from, to, reason, status, part = 'all', extra = {}) => ({ id: seq++, who: PEOPLE.find((p) => p.name === who), from, to, reason, status, part, req: '02/11/2026', ...extra });
  const ABS = [
    A('Federica Marchesini', '2026-11-16', '2026-11-20', 'ferie', 'validata', 'all', { req: '12/10/2026', note: 'Viaggio programmato' }),
    A('Federica Marchesini', '2026-12-03', '2026-12-04', 'ferie', 'proposta', 'all', { req: '28/10/2026' }),
    A('Nicole Spazzoli', '2026-11-04', '2026-11-06', 'malattia', 'validata', 'all', { req: '04/11/2026', note: 'Certificato inviato all\'amministrazione' }),
    A('Leonardo Romano', '2026-11-10', '2026-11-12', 'trasferta', 'validata', 'all', { req: '20/10/2026', note: 'Installazione PACS a Udine' }),
    A('Leonardo Romano', '2026-11-25', '2026-11-25', 'altro', 'validata', 'pom', { req: '03/11/2026', note: 'Visita medica' }),
    A('Andrea Ferri', '2026-11-18', '2026-11-19', 'training', 'validata', 'all', { req: '15/10/2026', note: 'Corso Philips IntelliSpace' }),
    A('Andrea Ferri', '2026-11-23', '2026-11-27', 'ferie', 'proposta', 'all', { req: '05/11/2026' }),
    A('Federico Mutuale', '2026-11-06', '2026-11-06', 'ferie', 'validata', 'pom', { req: '30/10/2026' }),
    A('Federico Mutuale', '2026-11-30', '2026-11-30', 'ferie', 'proposta', 'all', { req: '06/11/2026' }),
    A('Chiara Bassi', '2026-11-09', '2026-11-09', 'permesso_104', 'validata', 'mat', { req: '02/11/2026' }),
    A('Chiara Bassi', '2026-11-17', '2026-11-20', 'ferie', 'proposta', 'all', { req: '03/11/2026' }),
    A('Paolo Righi', '2026-11-02', '2026-11-06', 'ferie', 'validata', 'all', { req: '01/10/2026' }),
    A('Marco Lodi', '2026-11-17', '2026-11-19', 'ferie', 'validata', 'all', { req: '20/10/2026' }),
    A('Giulia Neri', '2026-11-24', '2026-11-25', 'trasferta', 'validata', 'all', { req: '28/10/2026', note: 'Collaudo a Ravenna' }),
    A('Giulia Neri', '2026-11-13', '2026-11-13', 'ferie', 'rifiutata', 'all', { req: '29/10/2026', note: 'Coincide con il collaudo di Lugo' }),
  ];

  // ── Date ───────────────────────────────────────────────────────────
  const TODAY = '2026-11-06';
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const WD = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
  const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const MSH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const ddmm = (s) => { const d = parse(s); return `${d.getDate()} ${MSH[d.getMonth()]}`; };
  const isOff = (s) => { const d = parse(s).getDay(); return d === 0 || d === 6 || Boolean(HOL[s]); };
  const workdays = (a) => { let n = 0; for (let d = parse(a.from); d <= parse(a.to); d.setDate(d.getDate() + 1)) if (!isOff(iso(d.getFullYear(), d.getMonth(), d.getDate()))) n++; return a.part === 'all' ? n : n / 2; };
  const range = (a) => a.from === a.to ? ddmm(a.from) : `${parse(a.from).getDate()}–${ddmm(a.to)}`;
  const gg = (n) => `${String(n).replace('.', ',')} ${n === 1 ? 'giorno' : 'giorni'}`;

  let year = 2026; let month = 10;
  const monthDays = () => { const n = new Date(year, month + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => iso(year, month, i + 1)); };
  // Cella: persona × giorno → { mat, pom } (assenza o null). Weekend e festività non contano.
  const cell = (p, day) => {
    const out = { mat: null, pom: null };
    if (isOff(day)) return out;
    ABS.forEach((a) => { if (a.who.id === p.id && day >= a.from && day <= a.to) { if (a.part !== 'pom') out.mat = out.mat && out.mat.status !== 'rifiutata' ? out.mat : a; if (a.part !== 'mat') out.pom = out.pom && out.pom.status !== 'rifiutata' ? out.pom : a; } });
    return out;
  };
  const absentOn = (p, day) => { const c = cell(p, day); return [c.mat, c.pom].some((a) => a && a.status !== 'rifiutata'); };
  const absentFull = (p, day) => { const c = cell(p, day); return [c.mat, c.pom].every((a) => a && a.status !== 'rifiutata'); };

  // ── Stato pagina ────────────────────────────────────────────────────
  let role = 'coord'; let area = MY_AREA; let view = 'cal'; let reasonFilter = null; let selDay = TODAY; let selected = null;
  const isCoord = () => role === 'coord';
  const people = () => PEOPLE.filter((p) => area === 'all' || p.area === area);
  const pending = () => ABS.filter((a) => a.status === 'proposta' && (area === 'all' || a.who.area === area));
  const presentCount = (ps, day) => ps.filter((p) => !absentFull(p, day)).length;
  // Copertura sotto il 60% dei presenti dell'area = da guardare (soglia di esempio).
  const covLevel = (pres, tot) => (pres / tot < 0.6 ? 'low' : pres / tot < 0.8 ? 'mid' : 'ok');
  // Conflitto di una richiesta: giorni in cui, accettandola, l'area scenderebbe sotto soglia.
  const conflicts = (a) => {
    const ps = PEOPLE.filter((p) => p.area === a.who.area); const out = [];
    for (let d = parse(a.from); d <= parse(a.to); d.setDate(d.getDate() + 1)) {
      const day = iso(d.getFullYear(), d.getMonth(), d.getDate()); if (isOff(day)) continue;
      const pres = ps.filter((p) => p.id === a.who.id ? false : !ABS.some((b) => b.who.id === p.id && b.status !== 'rifiutata' && day >= b.from && day <= b.to && b.part === 'all')).length;
      if (pres / ps.length < 0.6) out.push([day, pres, ps.length]);
    }
    return out;
  };

  // ── Testata, aree, indicatori ───────────────────────────────────────
  const paintHead = () => {
    $('[data-month-label]').textContent = `${MONTHS[month]} ${year}`;
    $('[data-areas]').innerHTML = [...AREAS.map((a) => [a, a === MY_AREA ? `${a}<small>la tua</small>` : a]), ['all', 'Tutte']]
      .map(([k, l]) => `<button type="button" data-area="${k}" aria-pressed="${k === area}">${l}</button>`).join('');
  };
  const kpiWrap = $('[data-pf-kpis]');
  const renderKpis = () => {
    const ps = people(); const days = monthDays().filter((d) => !isOff(d));
    const offToday = ps.filter((p) => absentOn(p, TODAY));
    const pend = pending(); const pendDays = pend.reduce((n, a) => n + workdays(a), 0);
    const oldest = pend.map((a) => a.req).sort((x, y) => x.split('/').reverse().join('').localeCompare(y.split('/').reverse().join('')))[0];
    const ferieV = ABS.filter((a) => a.reason === 'ferie' && a.status === 'validata' && ps.includes(a.who) && a.from.slice(0, 7) === `${year}-${pad(month + 1)}`).reduce((n, a) => n + workdays(a), 0);
    const worst = days.map((d) => [d, presentCount(ps, d)]).sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0]))[0];
    const byReason = {}; ps.forEach((p) => days.forEach((d) => { const c = cell(p, d); [c.mat, c.pom].forEach((a) => { if (a && a.status !== 'rifiutata') { const k = swKey(a); byReason[k] = (byReason[k] || 0) + 0.5; } }); }));
    const parts = Object.entries(byReason).sort((x, y) => y[1] - x[1]); const tot = parts.reduce((n, x) => n + x[1], 0) || 1;
    kpiWrap.innerHTML = `<div class="kpis" role="group" aria-label="Indicatori piano ferie">
      <button type="button" class="kpi" data-goday="${TODAY}"><span class="kpi-h">Assenti oggi<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${offToday.length}<small>su ${ps.length}</small></span>
        <span class="kpi-s pf-avas">${offToday.map((p) => { const c = cell(p, TODAY); const a = c.mat || c.pom; return `<span class="ava" title="${esc(p.name)} · ${RL[a.reason]}${a.part !== 'all' ? ' · ' + PART[a.part] : ''}" style="background:${SW[swKey(a)][0]};color:${SW[swKey(a)][1]}">${ini(p.name)}</span>`; }).join('') || 'nessuno'}</span></button>
      ${isCoord() ? `<button type="button" class="kpi" data-goview="pend" aria-pressed="${view === 'pend'}"><span class="kpi-h">Da validare<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${pend.length}<small>${gg(pendDays)}</small></span>
        <span class="kpi-s">${pend.length ? `la più vecchia del <b>${oldest.slice(0, 5)}</b>` : 'nessuna richiesta in attesa'}</span></button>`
      : (() => { const my = ABS.filter((a) => a.who.name === ME && a.status === 'proposta'); return `<button type="button" class="kpi" data-goview="mine" aria-pressed="${view === 'mine'}"><span class="kpi-h">Le tue richieste in attesa<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${my.length}<small>${gg(my.reduce((n, a) => n + workdays(a), 0))}</small></span>
        <span class="kpi-s">${my.length ? `prossima: <b>${range(my.sort((x, y) => x.from.localeCompare(y.from))[0])}</b>` : 'nessuna richiesta in attesa'}</span></button>`; })()}
      <div class="kpi"><span class="kpi-h">Ferie validate · ${MONTHS[month].toLowerCase()}</span><span class="kpi-v">${String(ferieV).replace('.', ',')}<small>giorni</small></span>
        <span class="kpi-s"><b>${pend.filter((a) => a.reason === 'ferie').length}</b>&nbsp;richieste di ferie in attesa</span></div>
      <button type="button" class="kpi" data-goday="${worst[0]}"${isCoord() ? '' : ' disabled'}><span class="kpi-h">Giorno più scoperto<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${ddmm(worst[0])}${covLevel(worst[1], ps.length) === 'low' ? ' <span class="kpi-flag warn">▲ copertura bassa</span>' : ''}</span>
        <span class="kpi-s"><b>${worst[1]}</b>&nbsp;presenti su ${ps.length}</span></button>
      <div class="kpi kpi-prio"><span class="kpi-h">Assenze del mese per motivo · ${String(tot).replace('.', ',')} gg</span>
        <div class="bar" aria-hidden="true">${parts.map(([k, n]) => `<span style="flex:${n};background:${SW[k][1]}" data-tip="${SW[k][2]} · <b>${String(n).replace('.', ',')} gg</b>"></span>`).join('')}</div>
        <div class="lg">${parts.slice(0, 4).map(([k, n]) => `<button type="button" data-reason="${k}" aria-pressed="${reasonFilter === k}"><i style="background:${SW[k][1]}"></i>${SW[k][2].replace(' (validata)', '').replace(' (proposta)', ' prop.')} <b>${String(n).replace('.', ',')}</b></button>`).join('')}</div></div>
    </div>`;
  };

  const paintViews = () => {
    const n = pending().length;
    const tabs = [['cal', 'Griglia'], ...(isCoord() ? [['coord', 'Coordinamento'], ['pend', 'Da validare', n]] : []), ['mine', 'Le mie richieste', ABS.filter((a) => a.who.name === ME).length]]
    $('[data-pf-views]').innerHTML = tabs
      .map(([k, l, c]) => `<button type="button" aria-pressed="${view === k}" data-view="${k}">${l}${c !== undefined ? ` <span>${c}</span>` : ''}</button>`).join('');
    const legend = Object.entries(SW).filter(([k]) => k !== 'rifiutata').map(([k, [bg, fg, l]]) => `<button type="button" class="pf-lg${reasonFilter === k ? ' is-on' : ''}${reasonFilter && reasonFilter !== k ? ' is-dim' : ''}" data-reason="${k}" aria-pressed="${reasonFilter === k}"><i class="${k === 'ferie_p' ? 'is-prop' : ''}" style="background:${bg};border-color:${fg}"></i>${l}</button>`).join('');
    $('[data-pf-tools]').innerHTML = view !== 'cal' && view !== 'coord' ? '' : `<div class="pf-legend" role="group" aria-label="Legenda e filtro per motivo">${legend}${reasonFilter ? '<button type="button" class="link-btn" data-reason="">Mostra tutti</button>' : ''}</div>
      ${view === 'cal' ? '<span class="pf-hint">Clic = mezza giornata · trascina = più giorni</span>' : '<span class="pf-hint">Clic su un giorno per vedere chi manca · su una barra per la richiesta</span>'}`;
  };

  // Blocco di una mezza giornata (A) — le proposte sono tratteggiate, le rifiutate barrate.
  const half = (a, extra = '') => {
    if (!a) return `<span class="pf-h${extra}"></span>`;
    const [bg, fg] = SW[swKey(a)]; const dim = reasonFilter && reasonFilter !== swKey(a);
    return `<span class="pf-h is-abs${a.status === 'proposta' ? ' is-prop' : ''}${a.status === 'rifiutata' ? ' is-rej' : ''}${dim ? ' is-dim' : ''}${a.id === selected ? ' is-sel' : ''}${extra}" style="--bg:${bg};--fg:${fg}" data-abs="${a.id}" title="${esc(a.who.name)} · ${RL[a.reason]} · ${STL[a.status]}"></span>`;
  };

  // ── A · Griglia ─────────────────────────────────────────────────────
  const renderA = () => {
    const days = monthDays();
    const head = `<div class="pf-row pf-hd"><span class="pf-name"></span><span></span>${days.map((d) => { const dt = parse(d); return `<span class="pf-day${isOff(d) ? ' is-off' : ''}${d === TODAY ? ' is-today' : ''}" title="${HOL[d] || ''}"><b>${dt.getDate()}</b><small>${WD[dt.getDay()]}</small></span>`; }).join('')}</div>`;
    const groups = (area === 'all' ? AREAS : [area]).map((ar) => {
      const ps = PEOPLE.filter((p) => p.area === ar);
      return `<div class="pf-grp">
        <div class="pf-row pf-covrow"><span class="pf-name"><b>${ar}</b><small>presenti</small></span><span></span>${days.map((d) => { if (isOff(d)) return `<span class="pf-c is-off"></span>`; const n = presentCount(ps, d); const lv = covLevel(n, ps.length); return `<span class="pf-c cov-${lv}${d === TODAY ? ' is-today' : ''}" title="${ddmm(d)} · ${n} presenti su ${ps.length}">${n}</span>`; }).join('')}</div>
        ${ps.map((p) => `<div class="pf-row pf-person${p.name === ME ? ' is-me' : ''}"><span class="pf-name"><span class="ava">${ini(p.name)}</span><span class="nm">${esc(p.name)}</span></span><span class="pf-parts" aria-hidden="true"><i>MAT</i><i>POM</i></span>${days.map((d) => { if (isOff(d)) return `<span class="pf-c is-off"></span>`; const c = cell(p, d); return `<span class="pf-c${d === TODAY ? ' is-today' : ''}" data-day="${d}" data-person="${p.id}">${half(c.mat, ' pf-mat')}${half(c.pom, ' pf-pom')}</span>`; }).join('')}</div>`).join('')}
      </div>`;
    }).join('');
    return `<div class="pf-grid" style="--n:${days.length}">${head}${groups}</div>`;
  };

  // ── C · Coordinamento (solo coordinatori) ──────────────────────────
  // Calendario a settimane: le assenze sono barre che attraversano le caselle dei giorni.
  const WEEKDAY_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const MONTH_FULL = MONTHS.map((m) => m.toLowerCase());
  const shortName = (n) => { const [f, ...r] = n.split(' '); return `${f} ${r.map((x) => x[0] + '.').join(' ')}`; };
  const addDays = (s0, n) => { const d = parse(s0); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
  const renderC = () => {
    const days = monthDays(); const ps = people();
    const firstMon = addDays(days[0], -((parse(days[0]).getDay() + 6) % 7));
    const weeks = []; for (let w = firstMon; w <= days.at(-1); w = addDays(w, 7)) weeks.push(w);
    const list = ABS.filter((a) => a.status !== 'rifiutata' && ps.includes(a.who));
    const weekHtml = weeks.map((mon) => {
      const wd = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
      // Segmenti della settimana, senza weekend/festività ai bordi.
      const segs = [];
      list.forEach((a) => {
        let s0 = a.from > mon ? a.from : mon; let e0 = a.to < wd[6] ? a.to : wd[6];
        if (s0 > e0) return;
        while (s0 <= e0 && isOff(s0)) s0 = addDays(s0, 1);
        while (e0 >= s0 && isOff(e0)) e0 = addDays(e0, -1);
        if (s0 > e0) return;
        segs.push({ a, s: wd.indexOf(s0), e: wd.indexOf(e0), cut: [a.from < s0, a.to > e0] });
      });
      segs.sort((x, y) => x.s - y.s || (y.e - y.s) - (x.e - x.s));
      const lanes = []; segs.forEach((g) => { let l = lanes.findIndex((end) => end < g.s); if (l < 0) { l = lanes.length; lanes.push(-1); } lanes[l] = g.e; g.lane = l; });
      const nl = Math.max(lanes.length, 2);
      const cellsH = wd.map((d, i) => {
        const inMonth = d.slice(0, 7) === days[0].slice(0, 7); const dt = parse(d); const off = isOff(d);
        const pres = presentCount(ps, d); const lv = covLevel(pres, ps.length);
        return `<div class="pf-wd${off ? ' is-off' : ''}${inMonth ? '' : ' is-out'}${d === TODAY ? ' is-today' : ''}${d === selDay ? ' is-sel' : ''}" style="grid-column:${i + 1}" ${!off && inMonth ? `data-selday="${d}" role="button" tabindex="0" aria-label="${dt.getDate()} ${MONTH_FULL[dt.getMonth()]}, ${pres} presenti su ${ps.length}"` : ''}>
          <span class="pf-wd-top"><span class="pf-cal-n">${dt.getDate()}</span>${!off && inMonth ? `<span class="pf-cov cov-${lv}" title="${pres} presenti su ${ps.length}">${pres}/${ps.length}</span>` : HOL[d] && inMonth ? `<small class="pf-hol">${HOL[d]}</small>` : ''}</span>
        </div>`;
      }).join('');
      const bars = segs.map((g) => {
        const k = swKey(g.a); const [bg, fg] = SW[k]; const dim = reasonFilter && reasonFilter !== k;
        return `<button type="button" class="pf-cb${g.a.status === 'proposta' ? ' is-prop' : ''}${g.cut[0] ? ' cut-l' : ''}${g.cut[1] ? ' cut-r' : ''}${dim ? ' is-dim' : ''}${g.a.id === selected ? ' is-sel' : ''}" style="grid-column:${g.s + 1} / ${g.e + 2};grid-row:${g.lane + 2};--bg:${bg};--fg:${fg}" data-abs="${g.a.id}" title="${esc(g.a.who.name)} · ${RL[g.a.reason]} · ${range(g.a)}${g.a.part !== 'all' ? ' · ' + PART[g.a.part] : ''} · ${STL[g.a.status]}">
          ${g.a.status === 'proposta' ? ic('clock') : ''}<span class="nm">${esc(shortName(g.a.who.name))}</span>${g.a.part !== 'all' ? `<em>${g.a.part === 'mat' ? 'MAT' : 'POM'}</em>` : g.e > g.s ? `<em>${RL[g.a.reason]}</em>` : ''}
        </button>`;
      }).join('');
      return `<div class="pf-wk" style="grid-template-rows:30px repeat(${nl}, 24px) 8px">${cellsH}${bars}</div>`;
    }).join('');

    // Giorno scelto
    const sd = selDay; const sdt = parse(sd); const pres = presentCount(ps, sd); const lv = covLevel(pres, ps.length);
    const absentSel = ps.filter((p) => absentOn(p, sd));
    const byArea = (area === 'all' ? AREAS : [area]).map((ar) => {
      const pa = PEOPLE.filter((p) => p.area === ar); const pr = presentCount(pa, sd);
      return `<div class="pf-dayarea"><span>${ar}</span><span class="pf-meter cov-${covLevel(pr, pa.length)}"><i style="width:${pr / pa.length * 100}%"></i></span><b>${pr}/${pa.length}</b></div>`;
    }).join('');
    const dayCard = `<section class="pf-card pf-daycard">
      <div class="pf-card-h"><div><small>${WEEKDAY_FULL[sdt.getDay()]}</small><h3>${sdt.getDate()} ${MONTH_FULL[sdt.getMonth()]}</h3></div><span class="pf-big cov-${lv}"><span><b>${pres}</b>/${ps.length}</span><small>presenti</small></span></div>
      ${byArea}
      ${absentSel.length ? `<ul class="pf-who">${absentSel.map((p) => { const c = cell(p, sd); const a = [c.mat, c.pom].find((x) => x && x.status !== 'rifiutata'); const [bg, fg] = SW[swKey(a)]; return `<li><button type="button" data-abs="${a.id}"><span class="pf-sw" style="background:${bg};border-color:${fg}"></span><span class="r-an"><b>${esc(p.name)}</b><small>${RL[a.reason]} · ${range(a)}${a.part !== 'all' ? ' · ' + PART[a.part] : ''}</small></span>${a.status === 'proposta' ? '<span class="pf-st st-prop">Proposta</span>' : ''}${ic('chevR')}</button></li>`; }).join('')}</ul>` : `<p class="pf-empty">${ic('task')}Tutti presenti.</p>`}
    </section>`;

    return `<div class="pf-coord">
      <div class="pf-cal">
        <div class="pf-cal-wd">${['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="pf-weeks">${weekHtml}</div>
      </div>
      <aside class="pf-side">${dayCard}
        <section class="pf-side-q"><div class="pf-side-h"><h3>Da autorizzare</h3><span class="r-cnt">${pending().length}</span><button type="button" class="link-btn" data-view="pend">Vedi tutte</button></div>${authCards()}</section>
      </aside>
    </div>`;
  };

  // Card di autorizzazione: chi, cosa, quando, effetto sulla copertura, decisione.
  const authCards = () => {
    const list = pending().sort((x, y) => x.from.localeCompare(y.from));
    if (!list.length) return `<p class="pf-empty">${ic('task')}Nessuna richiesta da autorizzare.</p>`;
    return `<ul class="pf-auth">${list.map((a) => {
      const [bg, fg] = SW[swKey(a)]; const cf = conflicts(a); const ps = PEOPLE.filter((p) => p.area === a.who.area);
      const ds = []; for (let d = a.from; d <= a.to; d = addDays(d, 1)) if (!isOff(d)) ds.push(d);
      const strip = ds.slice(0, 7).map((d) => { const pr = ps.filter((p) => p.id === a.who.id ? false : !absentFull(p, d)).length; return `<span class="cov-${covLevel(pr, ps.length)}" title="${ddmm(d)} · ${pr}/${ps.length} presenti"><b>${parse(d).getDate()}</b><em>${pr}/${ps.length}</em></span>`; }).join('');
      return `<li class="pf-ac${cf.length ? ' has-warn' : ''}">
        <button type="button" class="pf-ac-main" data-abs="${a.id}">
          <span class="ava">${ini(a.who.name)}</span>
          <span class="r-an"><b>${esc(a.who.name)}</b><small>${a.who.area} · richiesta il ${a.req.slice(0, 5)}</small></span>
          ${ic('chevR')}
        </button>
        <div class="pf-ac-what"><span class="pf-sw" style="background:${bg};border-color:${fg}"></span><b>${RL[a.reason]}</b><span>${range(a)} · ${gg(workdays(a))}${a.part !== 'all' ? ' · ' + PART[a.part] : ''}</span></div>
        <div class="pf-ac-strip" aria-label="Presenti in ${a.who.area} nei giorni richiesti">${strip}${ds.length > 7 ? `<span class="more">+${ds.length - 7}</span>` : ''}</div>
        ${cf.length ? `<p class="pf-q-warn">${ic('alert')}${a.who.area} resta con ${cf[0][1]} su ${cf[0][2]} il ${cf.map((c) => parse(c[0]).getDate()).join(', ')} ${MSH[parse(cf[0][0]).getMonth()]}</p>` : ''}
        <div class="pf-ac-act"><button type="button" class="btn btn-sm" data-reject="${a.id}">${ic('x')}Rifiuta</button><button type="button" class="btn btn-sm btn-primary" data-validate="${a.id}">${tick}Autorizza</button></div>
      </li>`;
    }).join('')}</ul>`;
  };

  // Coda delle richieste (vista "Da validare" e colonna di C).
  const queue = (compact) => {
    const list = pending();
    if (!list.length) return `<p class="pf-empty">${ic('task')}Nessuna richiesta da validare.</p>`;
    return `<ul class="pf-q${compact ? ' is-compact' : ''}">${list.map((a) => { const cf = conflicts(a); const [bg, fg] = SW[swKey(a)]; return `<li>
      <button type="button" class="pf-q-main" data-abs="${a.id}"><span class="ava" style="background:${bg};color:${fg}">${ini(a.who.name)}</span>
        <span class="r-an"><b>${esc(a.who.name)}</b><small>${RL[a.reason]} · ${range(a)} · ${gg(workdays(a))}${a.part !== 'all' ? ' · ' + PART[a.part] : ''}</small></span>
        ${compact ? '' : `<span class="pf-q-req">richiesta il ${a.req.slice(0, 5)}</span>`}</button>
      ${cf.length ? `<p class="pf-q-warn">${ic('alert')}Con questa richiesta ${a.who.area} resta con ${cf[0][1]} su ${cf[0][2]} il ${cf.map((c) => parse(c[0]).getDate()).join(', ')} ${MSH[parse(cf[0][0]).getMonth()]}</p>` : ''}
      <div class="pf-q-act"><button type="button" class="btn btn-sm" data-reject="${a.id}">Rifiuta</button><button type="button" class="btn btn-sm btn-primary" data-validate="${a.id}">${tick}Valida</button></div>
    </li>`; }).join('')}</ul>`;
  };
  const mine = () => {
    const list = ABS.filter((a) => a.who.name === ME).sort((x, y) => y.from.localeCompare(x.from));
    return `<ul class="pf-q">${list.map((a) => { const [bg, fg] = SW[swKey(a)]; return `<li><button type="button" class="pf-q-main" data-abs="${a.id}"><span class="pf-sw" style="background:${bg};border-color:${fg}"></span>
      <span class="r-an"><b>${RL[a.reason]} · ${range(a)}</b><small>${gg(workdays(a))}${a.part !== 'all' ? ' · ' + PART[a.part] : ''} · richiesta il ${a.req.slice(0, 5)}</small></span>
      <span class="pf-st st-${a.status === 'validata' ? 'ok' : a.status === 'proposta' ? 'prop' : 'rej'}">${STL[a.status]}</span>${ic('chevR')}</button></li>`; }).join('')}</ul>`;
  };

  // ── Pannello della richiesta ────────────────────────────────────────
  const drawer = $('[data-pf-drawer]'); const pbody = $('[data-pbody]'); const shell = $('.shell');
  const stBadge = (s) => `<span class="pf-st st-${s === 'validata' ? 'ok' : s === 'proposta' ? 'prop' : 'rej'}">${STL[s]}</span>`;
  const openAbs = (id) => {
    const a = ABS.find((x) => x.id === id); if (!a) return;
    selected = id; drawer.hidden = false; shell.classList.add('has-drawer');
    const [bg, fg] = SW[swKey(a)]; const cf = a.status === 'proposta' ? conflicts(a) : [];
    $('[data-pd="id"]').textContent = 'Richiesta #' + a.id;
    $('[data-pd="st"]').innerHTML = stBadge(a.status);
    $('[data-pd="title"]').innerHTML = `<span class="pf-ttl"><span class="pf-sw" style="background:${bg};border-color:${fg}"></span>${RL[a.reason]} · ${esc(a.who.name)}</span>`;
    $('[data-pd="sub"]').textContent = `${range(a)} ${parse(a.to).getFullYear()} · ${gg(workdays(a))} lavorativi · ${PART[a.part]}`;
    $('[data-ptabs]').innerHTML = '<button role="tab" aria-selected="true">Dettagli</button><button role="tab" aria-selected="false">Attività <span class="tn">2</span></button>';
    const days = []; for (let d = parse(a.from); d <= parse(a.to); d.setDate(d.getDate() + 1)) days.push(iso(d.getFullYear(), d.getMonth(), d.getDate()));
    const ps = PEOPLE.filter((p) => p.area === a.who.area);
    const coord = isCoord();
    pbody.innerHTML = `<div class="drawer-body int-body">
      ${cf.length ? `<div class="r-alert pf-alert">${ic('alert')}<span>Copertura bassa: ${a.who.area} resterebbe con ${cf[0][1]} su ${cf[0][2]} il ${cf.map((c) => parse(c[0]).getDate()).join(', ')} ${MSH[parse(cf[0][0]).getMonth()]}.</span></div>` : ''}
      <section class="pp is-open" aria-label="Proprietà"><div class="pp-grid">
        <button type="button" class="pp-i"><span class="k">Persona</span><span class="v"><span class="ava">${ini(a.who.name)}</span>${esc(a.who.name)}</span></button>
        <button type="button" class="pp-i"><span class="k">Area</span><span class="v">${a.who.area}</span></button>
        <button type="button" class="pp-i"><span class="k">Motivo</span><span class="v"><span class="pf-sw" style="background:${bg};border-color:${fg}"></span>${RL[a.reason]}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i"><span class="k">Fascia</span><span class="v">${PART[a.part]}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i"><span class="k">Dal</span><span class="v">${a.from.split('-').reverse().join('/')}</span>${ic('calendar')}</button>
        <button type="button" class="pp-i"><span class="k">Al</span><span class="v">${a.to.split('-').reverse().join('/')}</span>${ic('calendar')}</button>
      </div></section>
      <section><h4>Presenti in ${a.who.area} in quei giorni</h4>
        <div class="pf-mini">${days.map((d) => { if (isOff(d)) return `<span class="pf-mini-d is-off"><b>${parse(d).getDate()}</b><small>${WD[parse(d).getDay()]}</small></span>`; const pres = ps.filter((p) => p.id === a.who.id ? false : !absentFull(p, d)).length; return `<span class="pf-mini-d cov-${covLevel(pres, ps.length)}"><b>${parse(d).getDate()}</b><small>${WD[parse(d).getDay()]}</small><em>${pres}/${ps.length}</em></span>`; }).join('')}</div>
        <p class="note-p">Conteggio senza ${esc(a.who.name.split(' ')[0])}, con le altre assenze già registrate.</p></section>
      ${a.note ? `<section><h4>Nota</h4><p class="desc-p">${esc(a.note)}</p></section>` : ''}
      <div class="feed"><div class="ev">${ic('plus')}<span><b>${esc(a.who.name)}</b> ha chiesto ${RL[a.reason].toLowerCase()} dal ${ddmm(a.from)} al ${ddmm(a.to)}</span><time>${a.req.slice(0, 5)}</time></div>
        ${a.status !== 'proposta' ? `<div class="ev">${a.status === 'validata' ? tick : ic('x')}<span><b>Federico Mutuale</b> ha ${a.status === 'validata' ? 'validato' : 'rifiutato'} la richiesta</span><time>${a.req.slice(0, 5)}</time></div>` : ''}</div>
    </div>
    <div class="drawer-foot">${a.status === 'proposta' && coord ? `<button class="btn" type="button" data-reject="${a.id}">${ic('x')}Rifiuta</button><span class="g-spacer"></span><button class="btn btn-primary" type="button" data-validate="${a.id}">${tick}Valida</button>`
      : a.who.name === ME && a.status === 'proposta' ? `<button class="btn" type="button" data-toast="Richiesta ritirata">${ic('trash')}Ritira la richiesta</button><span class="g-spacer"></span><span class="foot-note">In attesa del coordinatore</span>`
      : `<button class="btn" type="button" data-toast="Si apre la modifica">${ic('wrench')}Modifica</button><span class="g-spacer"></span><span class="foot-note">${STL[a.status]}</span>`}</div>`;
    paint();
  };
  const close = () => { drawer.hidden = true; selected = null; shell.classList.remove('has-drawer'); paint(); };
  $('[data-pclose]').addEventListener('click', close);

  // ── Render ──────────────────────────────────────────────────────────
  const body = $('[data-pf-body]');
  const paint = () => {
    paintHead(); renderKpis(); paintViews();
    if (!isCoord() && (view === 'coord' || view === 'pend')) view = 'cal';
    body.className = 'pf-body pf-v-' + view;
    body.innerHTML = view === 'pend' ? `<div class="pf-list">${queue(false)}</div>` : view === 'mine' ? `<div class="pf-list">${mine()}</div>` : view === 'coord' ? renderC() : renderA();
  };

  // ── Interazioni ─────────────────────────────────────────────────────
  const toastEl = $('[data-toast]'); let tt = null; let undo = null;
  const toast = (m, u) => { undo = u; toastEl.innerHTML = `${tick}<span>${esc(m)}</span>${u ? '<button type="button" data-undo>Annulla</button>' : ''}`; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 5000); };
  toastEl.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toastEl.hidden = true; } });
  const setStatus = (id, st) => { const a = ABS.find((x) => x.id === id); const prev = a.status; a.status = st; if (selected === id) openAbs(id); else paint(); toast(`${STL[st]} · ${a.who.name}, ${range(a)}`, () => { a.status = prev; if (selected === id) openAbs(id); else paint(); }); };

  // Nuova richiesta (anche da trascinamento in A).
  const mdl = $('[data-mdl]');
  const askNew = (personId, from, to, part) => {
    const p = PEOPLE.find((x) => x.id === personId) || PEOPLE[0];
    $('.mdl', mdl).innerHTML = `<div class="mdl-h"><h3 id="mdl-t">Nuova richiesta</h3><p>${esc(p.name)} · ${p.area}</p></div>
      <form class="mdl-b" data-mform>
        <div class="grid2"><div class="f"><label for="m-f">Dal</label><input id="m-f" value="${from.split('-').reverse().join('/')}"></div><div class="f"><label for="m-t">Al</label><input id="m-t" value="${to.split('-').reverse().join('/')}"></div></div>
        <div class="f"><span class="lbl">Fascia</span><div class="r-seg pf-seg" role="group">${Object.entries(PART).map(([k, l]) => `<button type="button" aria-pressed="${k === part}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}</div></div>
        <div class="f"><span class="lbl">Motivo</span><div class="pf-reasons">${Object.entries(RL).map(([k, l], i) => { const sk = k === 'ferie' ? 'ferie_p' : k; return `<label class="pf-reason"><input type="radio" name="m-r"${i === 0 ? ' checked' : ''}><span class="pf-sw" style="background:${SW[sk][0]};border-color:${SW[sk][1]}"></span>${l}</label>`; }).join('')}</div></div>
        <div class="f"><label for="m-n">Nota <span class="opt">· facoltativa</span></label><input id="m-n" placeholder="es. viaggio, visita medica"></div>
        <p class="note-p" style="margin:0">${ic('lock')} Weekend e festività dell'area non vengono contati. La richiesta resta <b>proposta</b> finché il coordinatore non la valida.</p>
      </form>
      <div class="mdl-f"><button class="btn btn-ghost" type="button" data-mclose>Annulla</button><button class="btn btn-primary" type="button" data-mok>Invia richiesta</button></div>`;
    mdl.hidden = false;
    $('[data-mclose]', mdl).onclick = () => { mdl.hidden = true; };
    $('[data-mok]', mdl).onclick = () => { mdl.hidden = true; const a = A(p.name, from, to, 'ferie', 'proposta', part, { req: '06/11/2026' }); ABS.push(a); paint(); toast(`Richiesta inviata · ${range(a)}`, () => { ABS.splice(ABS.indexOf(a), 1); paint(); }); };
    mdl.querySelectorAll('.pf-seg button').forEach((b) => b.addEventListener('click', () => mdl.querySelectorAll('.pf-seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))));
  };
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) mdl.hidden = true; });
  $('[data-new]').addEventListener('click', () => askNew(1, '2026-11-09', '2026-11-09', 'all'));

  // Trascinamento sulla griglia (A): dalla prima alla mezza giornata su cui si rilascia.
  let drag = null;
  body.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.pf-c[data-day]'); if (!c || e.target.closest('[data-abs]')) return;
    const part = e.target.closest('.pf-pom') ? 'pom' : 'mat';
    drag = { person: Number(c.dataset.person), from: c.dataset.day, to: c.dataset.day, parts: new Set([part]) };
    c.classList.add('is-drag'); e.preventDefault();
  });
  body.addEventListener('pointerover', (e) => {
    if (!drag) return; const c = e.target.closest('.pf-c[data-day]'); if (!c || Number(c.dataset.person) !== drag.person) return;
    drag.to = c.dataset.day; drag.parts.add(e.target.closest('.pf-pom') ? 'pom' : 'mat');
    const [lo, hi] = [drag.from, drag.to].sort();
    body.querySelectorAll(`.pf-c[data-person="${drag.person}"]`).forEach((x) => x.classList.toggle('is-drag', x.dataset.day >= lo && x.dataset.day <= hi));
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return; const d = drag; drag = null; const [lo, hi] = [d.from, d.to].sort();
    askNew(d.person, lo, hi, d.parts.size === 2 || lo !== hi ? (d.parts.size === 2 ? 'all' : [...d.parts][0]) : [...d.parts][0]);
  });

  document.addEventListener('click', (e) => {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t('[data-validate]'))) { setStatus(Number(el.dataset.validate), 'validata'); return; }
    if ((el = t('[data-reject]'))) { setStatus(Number(el.dataset.reject), 'rifiutata'); return; }
    if ((el = t('[data-toast]'))) { toast(el.dataset.toast); return; }
    if ((el = t('[data-abs]'))) { openAbs(Number(el.dataset.abs)); return; }
    if ((el = t('[data-area]'))) { area = el.dataset.area; paint(); return; }
    if ((el = t('[data-view]'))) { view = el.dataset.view; paint(); return; }
    if ((el = t('[data-goview]'))) { view = el.dataset.goview; paint(); return; }
    if ((el = t('[data-goday]'))) { view = 'coord'; selDay = el.dataset.goday; paint(); return; }
    if ((el = t('[data-reason]'))) { reasonFilter = el.dataset.reason && reasonFilter !== el.dataset.reason ? el.dataset.reason : null; paint(); return; }
    if ((el = t('[data-selday]'))) { selDay = el.dataset.selday; paint(); return; }
    if ((el = t('[data-month]'))) { toast('Nell\'anteprima ci sono solo i dati di novembre'); return; }
    if (t('[data-today]')) { selDay = TODAY; paint(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mdl.hidden) { mdl.hidden = true; return; } if (e.key === 'Escape' && !drawer.hidden) close(); });

  // Ruolo (solo anteprima): Coordinamento e Da validare compaiono solo a chi coordina.
  const rbtns = document.querySelectorAll('[data-role-btn]');
  const syncRole = () => rbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roleBtn === role)));
  rbtns.forEach((b) => b.addEventListener('click', () => { role = b.dataset.roleBtn; if (!drawer.hidden) close(); syncRole(); paint(); }));
  const q = new URLSearchParams(location.search);
  if (q.get('role')) role = q.get('role');
  if (q.get('area')) area = q.get('area');
  if (q.get('tab')) view = q.get('tab');
  if (q.get('day')) selDay = q.get('day');
  syncRole(); paint();
  if (q.get('abs')) openAbs(Number(q.get('abs')));
})();
