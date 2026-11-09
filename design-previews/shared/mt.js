/* Manutenzione (anteprima). Modello reale: MaintenancePlan (cliente, tipi di inventario,
   intervallo o data fissa, next_due_date, alert_days_before), MaintenancePlanInventory
   (due_date_override), MaintenanceEvent (performed_at, result ok|ko|partial|not_planned,
   tech, pdf, notes), Tech. Scadenze = /maintenance-plans/todo/ (piano × inventario da fare).
   Dati finti realistici (in dev c'è un solo piano). Oggi: 07/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const TODAY = new Date(2026, 10, 7); const DAY = 864e5;
  const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const TODAY_ISO = iso(TODAY);
  const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = D(s); d.setMonth(d.getMonth() + n); return iso(d); };
  const daysTo = (s) => Math.round((D(s) - TODAY) / DAY);
  const dShort = (s, y = true) => (s ? D(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) }) : '—');
  const daysLabel = (s) => { const n = daysTo(s); if (n === 0) return 'oggi'; if (n === 1) return 'domani'; if (n === -1) return 'ieri'; if (n > 0) return n > 60 ? `tra ${Math.round(n / 30)} mesi` : `tra ${n} giorni`; return -n > 60 ? `${Math.round(-n / 30)} mesi fa` : `${-n} giorni fa`; };
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Manutenzione');
    a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Dati ─────────────────────────────────────────────────────────
  const TECHS = ['Federico Mutuale', 'Luca Romano', 'Andrea Alagia'];
  const CUSTS = {
    bo: { n: 'AUSL Bologna', area: 'avec', sites: ['Ospedale Maggiore', 'Bellaria', 'Budrio'] },
    im: { n: 'AUSL Imola', area: 'avec', sites: ['S. Maria della Scaletta', 'Castel S. Pietro'] },
    ri: { n: 'Istituto Ortopedico Rizzoli', area: 'avec', sites: ['Sede di Bologna'] },
    rm: { n: 'AUSL Romagna', area: 'rom', sites: ['Ospedale di Ravenna', 'Ospedale di Forlì', 'Ospedale di Rimini'] },
    es: { n: 'Centro Medico Esperia', area: 'rom', sites: ['Poliambulatorio di Cesena'] },
    ro: { n: 'Casa di Cura Rocca', area: 'rom', sites: ['Sede di Lugo'] },
    ud: { n: 'ASUFC Udine', area: null, sites: ['S. Maria della Misericordia'] },
  };
  const PLANS = [
    { id: 1, title: 'PM Workstation refertazione', c: 'bo', every: [1, 'anno'], due: '2026-12-31', types: ['Workstation'], alert: 30 },
    { id: 2, title: 'Verifica sicurezza elettrica', c: 'bo', every: [6, 'mesi'], due: '2026-11-20', types: ['TC', 'RM', 'Mammografo'], alert: 14 },
    { id: 3, title: 'PM Server PACS', c: 'im', every: [6, 'mesi'], due: '2026-10-31', types: ['Server'], alert: 14 },
    { id: 9, title: 'Aggiornamento firmware TC', c: 'im', fixed: [30, 11], due: '2026-11-30', types: ['TC'], alert: 21 },
    { id: 4, title: 'Manutenzione preventiva RIS', c: 'ud', fixed: [15, 3], due: '2027-03-15', types: ['Server', 'Workstation'], alert: 30 },
    { id: 5, title: 'Controllo qualità monitor diagnostici', c: 'ri', every: [3, 'mesi'], due: '2026-11-12', types: ['Monitor'], alert: 7 },
    { id: 6, title: 'PM modalità diagnostiche', c: 'es', every: [1, 'anno'], due: '2026-11-28', types: ['Ecografo', 'RX'], alert: 14 },
    { id: 7, title: 'Backup e verifica storage', c: 'ro', every: [1, 'mese'], due: '2026-11-05', types: ['Storage'], alert: 3 },
    { id: 10, title: 'Verifica sicurezza elettrica', c: 'rm', every: [1, 'anno'], due: '2026-11-25', types: ['TC', 'RM'], alert: 21 },
    { id: 11, title: 'PM Server RIS-PACS', c: 'rm', every: [6, 'mesi'], due: '2026-11-03', types: ['Server'], alert: 14 },
    { id: 8, title: 'PM Workstation refertazione 2025', c: 'bo', every: [1, 'anno'], due: '2025-12-31', types: ['Workstation'], alert: 30, archived: true },
  ];
  // [piano, sito (indice), nome, hostname, knumber, tipo, stato] — stato: 'todo' | ['ovr', data] | ['done', data, esito, tecnico, pdf]
  const LINKS = [
    [1, 0, 'WS refertazione RX 1', 'BO-MAG-WSR01', 'K-10421', 'Workstation', ['done', '2026-10-14', 'ok', 0, 1]],
    [1, 0, 'WS refertazione RX 2', 'BO-MAG-WSR02', 'K-10422', 'Workstation', ['done', '2026-10-14', 'ok', 0, 1]],
    [1, 0, 'WS refertazione TC', 'BO-MAG-WSR05', 'K-10425', 'Workstation', 'todo'],
    [1, 1, 'WS refertazione RM', 'BO-BEL-WSR01', 'K-10512', 'Workstation', 'todo'],
    [1, 1, 'WS senologia', 'BO-BEL-WSS01', 'K-10518', 'Workstation', ['done', '2026-09-30', 'partial', 1, 1]],
    [1, 2, 'WS refertazione Budrio', 'BO-BUD-WSR01', 'K-10602', 'Workstation', 'todo'],
    [1, 2, 'WS accettazione Budrio', 'BO-BUD-WSA01', 'K-10605', 'Workstation', ['ovr', '2026-12-10']],
    [2, 0, 'TC Siemens SOMATOM go.Top', 'BO-MAG-CT01', 'K-20110', 'TC', 'todo'],
    [2, 0, 'RM Philips Ingenia 1.5T', 'BO-MAG-MR01', 'K-20131', 'RM', ['done', '2026-11-03', 'ok', 1, 0]],
    [2, 1, 'Mammografo Hologic 3Dimensions', 'BO-BEL-MG01', 'K-20208', 'Mammografo', 'todo'],
    [2, 1, 'TC Canon Aquilion', 'BO-BEL-CT01', 'K-20212', 'TC', ['ovr', '2026-11-14']],
    [2, 2, 'RM Budrio Esaote', 'BO-BUD-MR01', 'K-20301', 'RM', 'todo'],
    [3, 0, 'PACS primario', 'IM-SCA-PACS01', 'K-30010', 'Server', 'todo'],
    [3, 0, 'PACS secondario', 'IM-SCA-PACS02', 'K-30011', 'Server', 'todo'],
    [3, 1, 'Server MWL', 'IM-CSP-MWL01', 'K-30102', 'Server', ['done', '2026-10-28', 'ko', 2, 1]],
    [9, 0, 'TC Siemens SOMATOM Scaletta', 'IM-SCA-CT01', 'K-30201', 'TC', ['done', '2026-10-20', 'ok', 1, 1]],
    [9, 1, 'TC GE Revolution Castel S. Pietro', 'IM-CSP-CT01', 'K-30214', 'TC', ['done', '2026-10-21', 'ok', 1, 1]],
    [4, 0, 'Server RIS', 'UD-SMM-RIS01', 'K-40001', 'Server', 'todo'],
    [4, 0, 'WS accettazione 1', 'UD-SMM-WSA01', 'K-40011', 'Workstation', 'todo'],
    [4, 0, 'WS accettazione 2', 'UD-SMM-WSA02', 'K-40012', 'Workstation', 'todo'],
    [5, 0, 'Monitor diagnostico Sala 1', 'RI-MON-S1', 'K-50101', 'Monitor', ['done', '2026-11-04', 'ok', 0, 1]],
    [5, 0, 'Monitor diagnostico Sala 2', 'RI-MON-S2', 'K-50102', 'Monitor', ['done', '2026-11-04', 'ok', 0, 1]],
    [5, 0, 'Monitor diagnostico Sala 3', 'RI-MON-S3', 'K-50103', 'Monitor', 'todo'],
    [5, 0, 'Monitor refertazione TC', 'RI-MON-CT', 'K-50110', 'Monitor', 'todo'],
    [5, 0, 'Monitor refertazione RM', 'RI-MON-RM', 'K-50111', 'Monitor', 'todo'],
    [6, 0, 'Ecografo Esaote MyLab', 'ES-ECO01', 'K-60001', 'Ecografo', 'todo'],
    [6, 0, 'RX Fujifilm FDR', 'ES-RX01', 'K-60005', 'RX', ['ovr', '2026-12-03']],
    [10, 0, 'TC Philips Incisive Ravenna', 'RM-RAV-CT01', 'K-80101', 'TC', 'todo'],
    [10, 0, 'RM Siemens Magnetom Ravenna', 'RM-RAV-MR01', 'K-80105', 'RM', ['done', '2026-10-29', 'ok', 2, 1]],
    [10, 1, 'TC GE Revolution Forlì', 'RM-FOR-CT01', 'K-80201', 'TC', 'todo'],
    [10, 2, 'TC Canon Aquilion Rimini', 'RM-RIM-CT01', 'K-80301', 'TC', ['ovr', '2026-12-12']],
    [10, 2, 'RM Philips Ingenia Rimini', 'RM-RIM-MR01', 'K-80305', 'RM', 'todo'],
    [11, 0, 'PACS Romagna primario', 'RM-RAV-PACS01', 'K-80010', 'Server', 'todo'],
    [11, 1, 'RIS Romagna', 'RM-FOR-RIS01', 'K-80020', 'Server', 'todo'],
    [7, 0, 'NAS backup', 'RO-NAS01', 'K-70001', 'Storage', 'todo'],
    [7, 0, 'Storage VNA', 'RO-VNA01', 'K-70002', 'Storage', ['done', '2026-11-06', 'ok', 2, 0]],
  ];
  let seq = 0;
  const ITEMS = LINKS.map(([pid, si, name, host, kn, type, st]) => {
    const p = PLANS.find((x) => x.id === pid);
    return { id: ++seq, plan: p, cust: p.c, site: CUSTS[p.c].sites[si], name, host, kn, type, ovr: Array.isArray(st) && st[0] === 'ovr' ? st[1] : null, done: Array.isArray(st) && st[0] === 'done' ? st : null };
  });
  const dueOf = (it) => it.ovr || it.plan.due;
  // Storico: eventi del ciclo corrente + cicli precedenti
  const EVENTS = []; let eid = 300;
  const NOTES = { ko: 'Alimentatore guasto, ordinato il ricambio: da ripassare.', partial: 'Calibrazione completata, aggiornamento firmware rimandato per fermo macchina.' };
  ITEMS.forEach((it) => {
    if (it.done) { const [, d, r, t, pdf] = it.done; EVENTS.push({ id: ++eid, item: it, date: d, res: r, tech: TECHS[t], pdf: Boolean(pdf), notes: NOTES[r] || '' }); }
    const back = it.plan.every ? (it.plan.every[1].startsWith('ann') ? 12 : it.plan.every[0] * (it.plan.every[1] === 'mese' ? 1 : 1)) : 12;
    const prev = addDays(addMonths(it.plan.due, -back), -(it.id % 9));
    if (D(prev) < TODAY && it.plan.id !== 8) EVENTS.push({ id: ++eid, item: it, date: prev, res: it.id % 11 === 0 ? 'partial' : it.id % 13 === 0 ? 'not_planned' : 'ok', tech: TECHS[it.id % 3], pdf: it.id % 4 !== 0 && it.id % 13 !== 0, notes: '' });
  });
  // Piano archiviato 2025: tutto eseguito
  ITEMS.filter((i) => i.plan.id === 1).forEach((it, k) => EVENTS.push({ id: ++eid, item: { ...it, plan: PLANS.find((p) => p.id === 8) }, date: addDays('2025-11-10', k * 3), res: 'ok', tech: TECHS[k % 3], pdf: true, notes: '' }));
  EVENTS.sort((a, b) => D(b.date) - D(a.date));

  const AREAS = { avec: 'AVEC', rom: 'Romagna' };
  const MY_AREA = 'avec';
  const AREAS_ON = false; // divisione per aree rimandata
  let areaF = AREAS_ON ? (new URLSearchParams(location.search).get('area') || MY_AREA) : 'all';
  const inArea = (c) => areaF === 'all' || (areaF === 'none' ? !CUSTS[c].area : CUSTS[c].area === areaF);
  const areaName = (c) => (CUSTS[c].area ? AREAS[CUSTS[c].area] : 'Senza area');
  const ITEMSA = () => ITEMS.filter((i) => inArea(i.cust));
  const EVA = () => EVENTS.filter((e) => inArea(e.item.cust));
  const PLA = () => PLANS.filter((p) => inArea(p.c));
  const todo = () => ITEMSA().filter((i) => !i.done && !i.plan.archived);
  const todoAll = () => ITEMS.filter((i) => !i.done && !i.plan.archived);
  const stateOf = (it) => { const n = daysTo(dueOf(it)); return n < 0 ? 'over' : n <= 30 ? 'soon' : 'later'; };
  const lastEvent = (it) => EVENTS.find((e) => e.item.id === it.id || (e.item.kn === it.kn && e.item.plan.id === it.plan.id));
  const schedText = (p) => (p.fixed ? `Ogni anno il ${p.fixed[0]} ${new Date(2026, p.fixed[1] - 1, 1).toLocaleDateString('it-IT', { month: 'long' })}` : p.every[0] === 1 ? `Ogni ${p.every[1]}` : `Ogni ${p.every[0]} ${p.every[1]}`);
  const nextAfter = (p, from) => (p.fixed ? `${D(from).getFullYear() + 1}-${String(p.fixed[1]).padStart(2, '0')}-${String(p.fixed[0]).padStart(2, '0')}` : addMonths(p.due, p.every[1].startsWith('ann') ? 12 * p.every[0] : p.every[0]));

  const RES = { ok: ['OK', '<circle cx="6" cy="6" r="4" fill="currentColor"/>'], partial: ['Parziale', '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor"/>'], ko: ['KO', '<path d="M6 1.6 10.8 10H1.2z" fill="currentColor"/>'], not_planned: ['Non prevista', '<path d="M2.5 6h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'] };
  const resBadge = (r) => `<span class="res ${r}"><svg viewBox="0 0 12 12" aria-hidden="true">${RES[r][1]}</svg>${RES[r][0]}</span>`;
  const ovrTip = (it) => `Scadenza modificata per questo inventario · il piano dice ${dShort(it.plan.due)}`;
  const dueCell = (it, icon) => { const s = stateOf(it); const d = dueOf(it); return `<span class="due ${s}"><span class="dl">${dShort(d)}${icon && it.ovr ? `<span class="ovr-i" title="${ovrTip(it)}" aria-label="${ovrTip(it)}">${ic('calendar')}</span>` : ''}</span><small>${daysLabel(d)}</small></span>`; };
  const planCell = (it) => `<span class="pc"><span>${it.plan.title}</span>${it.ovr ? `<small class="ovr" title="${ovrTip(it)}">${ic('calendar')}scadenza modificata · il piano dice ${dShort(it.plan.due, false)}</small>` : ''}</span>`;
  const stBadge = (it) => { const s = stateOf(it); return `<span class="res ${s === 'over' ? 'ko' : s === 'soon' ? 'partial' : 'not_planned'}"><svg viewBox="0 0 12 12" aria-hidden="true">${s === 'over' ? RES.ko[1] : s === 'soon' ? RES.partial[1] : '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>'}</svg>${s === 'over' ? 'Scaduta' : s === 'soon' ? 'In scadenza' : 'Programmata'}</span>`; };

  // ── Stato ────────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  let page = qs.get('pagina') || 'due';
  let dueVar = qs.get('variante') || (() => { try { return localStorage.getItem('archie-preview-mt-v') || 'a'; } catch { return 'a'; } })();
  let rpVar = qs.get('rapportino') || (() => { try { return localStorage.getItem('archie-preview-mt-rp') || 'a'; } catch { return 'a'; } })();
  let view = 'all'; let checked = new Set(); let planFilter = null;
  let calMonth = new Date(2026, 10, 1); let calDay = null; let openCust = new Set(['bo']);
  let evView = 'all';
  const root = $('[data-mt]');

  // ── Testata ──────────────────────────────────────────────────────
  const head = () => {
    const counts = { due: todo().length, plans: PLA().filter((p) => !p.archived).length, events: EVA().length };
    const act = page === 'plans' ? `<button class="btn" type="button">${ic('download')}Report PDF</button><button class="btn btn-primary" type="button">${ic('plus')}Nuovo piano</button>`
      : `<button class="btn btn-primary" type="button" data-rp-free>${ic('plus')}Registra rapportino</button>`;
    return `<div class="mt-head"><h1>Manutenzione</h1>
      <nav class="mt-sub" aria-label="Sezioni">${[['due', 'Scadenze'], ['plans', 'Piani'], ['events', 'Rapportini']].map(([k, l]) => `<button type="button" data-page="${k}" aria-pressed="${page === k}">${l} <span>${counts[k]}</span></button>`).join('')}</nav>
      ${AREAS_ON ? '' : '<!--'}<div class="area-sw" role="group" aria-label="Area"><span class="lbl">${ic('pin')}Area</span>${[['avec', 'AVEC'], ['rom', 'Romagna'], ['none', 'Senza area'], ['all', 'Tutte']].map(([k, l]) => { const o = k === 'all' ? todoAll().filter((i) => stateOf(i) === 'over').length : todoAll().filter((i) => (k === 'none' ? !CUSTS[i.cust].area : CUSTS[i.cust].area === k) && stateOf(i) === 'over').length; return `<button type="button" data-area="${k}" aria-pressed="${areaF === k}">${l}${k === MY_AREA ? '<small>la mia</small>' : ''}${o ? `<span class="ao">${o}</span>` : ''}</button>`; }).join('')}</div>${AREAS_ON ? '' : '-->'}
      <div class="actions">${act}</div></div>`;
  };

  // ── Scadenze: indicatori ─────────────────────────────────────────
  const dueKpis = () => {
    const t = todo(); const over = t.filter((i) => stateOf(i) === 'over'); const soon = t.filter((i) => stateOf(i) === 'soon');
    const yearAll = ITEMSA().filter((i) => !i.plan.archived); const done = yearAll.filter((i) => i.done).length; const pct = Math.round(done / yearAll.length * 100);
    const byCust = Object.entries(over.reduce((a, i) => ((a[i.cust] = (a[i.cust] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    const monthEv = EVA().filter((e) => D(e.date).getMonth() === 10 && D(e.date).getFullYear() === 2026);
    const issues = EVA().filter((e) => ['ko', 'partial'].includes(e.res) && daysTo(e.date) > -60);
    return `<div class="kpi-wrap"><div class="kpis mt-kpis" role="group" aria-label="Indicatori manutenzione">
      <div class="kpi${view === 'over' ? ' is-on' : ''}"><span class="kpi-h">Scadute<button type="button" class="lnk" style="margin-left:auto" data-goview="over">${view === 'over' ? 'tutte' : 'vedi'}</button></span><span class="kpi-v">${over.length}<small>da recuperare</small></span>
        <div class="kpi-list">${byCust.slice(0, 3).map(([c, n]) => `<button type="button" data-cust="${c}"><span>${CUSTS[c].n}</span><b>${n}</b></button>`).join('')}</div></div>
      <button type="button" class="kpi" data-goview="soon"${view === 'soon' ? ' aria-pressed="true"' : ''}><span class="kpi-h">Prossimi 30 giorni<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${soon.length}</span><span class="kpi-s">la prima <b>${dShort(soon.map(dueOf).sort()[0], false)}</b> · ${new Set(soon.map((i) => i.cust)).size} clienti</span></button>
      <div class="kpi"><span class="kpi-h">Copertura dei piani attivi</span><span class="kpi-v">${pct}%<small>${done} di ${yearAll.length}</small></span><div class="meter"><span style="width:${pct}%"></span></div><span class="kpi-s"><b>${monthEv.length}</b> rapportini a novembre · <b>${issues.length}</b> KO o parziali</span></div>
      <div class="kpi"><span class="kpi-h">Prossime uscite</span><div class="kpi-list">${groupNext().slice(0, 4).map((g) => `<button type="button" data-cust="${g.c}"><span><b>${CUSTS[g.c].n}</b> · ${g.site} · ${g.n} ${g.n === 1 ? 'intervento' : 'interventi'}</span><b class="${daysTo(g.d) < 0 ? 'err' : ''}" style="color:${daysTo(g.d) < 0 ? 'var(--error)' : daysTo(g.d) <= 14 ? 'var(--warning)' : 'var(--text)'}">${dShort(g.d, false)}</b></button>`).join('')}</div></div>
    </div></div>`;
  };
  const groupNext = () => {
    const m = {}; todo().forEach((i) => { const k = `${i.cust}|${i.site}`; (m[k] ||= { c: i.cust, site: i.site, n: 0, d: dueOf(i) }); m[k].n++; if (dueOf(i) < m[k].d) m[k].d = dueOf(i); });
    return Object.values(m).sort((a, b) => D(a.d) - D(b.d));
  };

  // ── Scadenze A · Elenco ──────────────────────────────────────────
  const VIEWS = [['all', 'Tutte', () => true], ['over', 'Scadute', (i) => stateOf(i) === 'over'], ['soon', 'Prossimi 30 giorni', (i) => stateOf(i) === 'soon'], ['later', 'Più avanti', (i) => stateOf(i) === 'later'], ['ovr', 'Scadenza modificata', (i) => Boolean(i.ovr)]];
  let custFilter = null;
  const visible = () => todo().filter(VIEWS.find((v) => v[0] === view)[2]).filter((i) => (!custFilter || i.cust === custFilter) && (!planFilter || i.plan.id === planFilter)).sort((a, b) => D(dueOf(a)) - D(dueOf(b)) || a.id - b.id);
  const tokens = () => {
    const t = [custFilter ? ['cust', 'Cliente', CUSTS[custFilter].n] : null, planFilter ? ['plan', 'Piano', PLANS.find((p) => p.id === planFilter).title] : null].filter(Boolean);
    return t.length ? t.map(([k, l, v]) => `<span class="token"><span class="tk">${l}</span> <b>${v}</b><button type="button" class="tk-x" data-unf="${k}" aria-label="Rimuovi filtro">${ic('x')}</button></span>`).join('') + '<button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button>' : '<span class="none" style="font-size:12px">Nessun filtro. Usa l\'imbuto accanto al nome di una colonna.</span>';
  };
  const bulkBar = () => (checked.size ? `<div class="bulk" role="toolbar" aria-label="Selezionate"><b>${checked.size} selezionat${checked.size === 1 ? 'a' : 'e'}</b><button class="btn btn-sm btn-primary" type="button" data-rp-checked>${ic('check')}Registra rapportino</button><button class="btn btn-sm" type="button" data-np-checked>Non prevista</button><span class="sp"></span><button class="btn btn-ghost btn-sm" type="button" data-uncheck>Annulla selezione</button></div>` : '');
  const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
  const dueA = () => {
    const rows = visible(); const allOn = rows.length && rows.every((r) => checked.has(r.id));
    const sm = checked.size > 0; // la colonna delle caselle compare solo con una selezione in corso
    return `<section class="panel${sm ? ' sel-on' : ''}" aria-label="Scadenze">
      <div class="vtabs" role="group" aria-label="Viste">${VIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === view}" data-view="${k}"${k === 'over' ? ' class="v-alert"' : ''}>${l} <span>${todo().filter(f).length}</span></button>`).join('')}<button type="button" class="v-add">${ic('plus')}Salva vista</button></div>
      <div class="toolbar tb-row"><div class="tokens">${tokens()}</div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Esporta">${ic('download')}</button><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      ${bulkBar()}
      <div class="table-wrap"><table class="po-table mt-table"><thead><tr>
        ${sm ? `<th class="c-sel"><input type="checkbox" data-check-all aria-label="Seleziona tutte" ${allOn ? 'checked' : ''}></th>` : ''}
        <th>Scadenza</th><th><div class="th-in">Cliente · sito<button type="button" class="th-filter${custFilter ? ' is-on' : ''}" data-filter="cust" aria-label="Filtra cliente">${funnel}</button></div></th>
        <th>Inventario</th><th class="c-type">Tipo</th><th class="c-plan"><div class="th-in">Piano<button type="button" class="th-filter${planFilter ? ' is-on' : ''}" data-filter="plan" aria-label="Filtra piano">${funnel}</button></div></th><th class="c-last">Ultima esecuzione</th><th class="c-act"></th></tr></thead>
        <tbody>${rows.map((it) => { const le = lastEvent(it); return `<tr data-item="${it.id}" tabindex="0" class="${checked.has(it.id) ? 'is-checked' : ''}${sel?.kind === 'item' && sel.id === it.id ? ' is-selected' : ''}">
          ${sm ? `<td class="c-sel"><input type="checkbox" data-check="${it.id}" aria-label="Seleziona ${esc(it.name)}" ${checked.has(it.id) ? 'checked' : ''}></td>` : ''}
          <td>${dueCell(it)}</td>
          <td class="cs"><b>${CUSTS[it.cust].n}</b><small>${it.site}${AREAS_ON && areaF === 'all' ? ` · ${areaName(it.cust)}` : ''}</small></td>
          <td class="inv"><b>${it.name}</b><small>${it.kn} · ${it.host}</small></td>
          <td class="c-type"><span class="tchips"><span>${it.type}</span></span></td>
          <td class="c-plan">${planCell(it)}</td>
          <td class="c-last">${le ? `<span class="lastx">${resBadge(le.res)}${dShort(le.date)}</span>` : '<span class="none">—</span>'}</td>
          <td class="c-act"><button class="btn btn-sm" type="button" data-rp-one="${it.id}">${ic('check')}Registra</button></td></tr>`; }).join('') || `<tr><td colspan="${sm ? 8 : 7}" style="height:110px;text-align:center;color:var(--muted)">${view === 'over' ? 'Nessuna manutenzione scaduta: tutto in regola.' : 'Nessuna manutenzione con questi filtri.'}</td></tr>`}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> di ${todo().length} manutenzioni da fare</span><span class="sp"></span><span>${sm ? 'Esc o «Annulla selezione» per uscire' : 'Tasto destro su una riga → <b>Seleziona</b> per registrarne più di una insieme'}</span></div></section>`;
  };

  // ── Scadenze B · Calendario ──────────────────────────────────────
  const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, 10 + i, 1));
  const dueB = () => {
    const t = todo(); const y = calMonth.getFullYear(); const m = calMonth.getMonth();
    const first = new Date(y, m, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    const onDay = (d) => t.filter((i) => dueOf(i) === iso(d));
    const over = t.filter((i) => stateOf(i) === 'over');
    const maxM = Math.max(...MONTHS.map((mm) => t.filter((i) => D(dueOf(i)).getMonth() === mm.getMonth() && D(dueOf(i)).getFullYear() === mm.getFullYear()).length + (mm.getMonth() === 10 ? over.length : 0)), 1);
    const yearStrip = MONTHS.map((mm) => {
      const its = t.filter((i) => D(dueOf(i)).getMonth() === mm.getMonth() && D(dueOf(i)).getFullYear() === mm.getFullYear());
      const o = its.filter((i) => stateOf(i) === 'over').length + (mm.getMonth() === 10 && mm.getFullYear() === 2026 ? over.filter((i) => D(dueOf(i)).getMonth() !== 10).length : 0);
      const s = its.filter((i) => stateOf(i) === 'soon').length; const l = its.length - its.filter((i) => stateOf(i) !== 'later').length;
      const h = (n) => `${(n / maxM) * 26}px`;
      const tot = o + s + l; const lv = o ? 'o' : s ? 's' : tot ? `l${Math.min(4, tot)}` : 'z';
      return `<button type="button" class="yl-${lv}" data-month="${iso(mm)}" aria-pressed="${mm.getMonth() === m && mm.getFullYear() === y}"><span class="m">${mm.toLocaleDateString('it-IT', { month: 'short' })}${mm.getMonth() === 0 ? ` ${String(mm.getFullYear()).slice(2)}` : ''}</span><span class="bar">${o ? `<span style="height:${h(o)};background:var(--error)"></span>` : ''}${s ? `<span style="height:${h(s)};background:var(--warning)"></span>` : ''}${l ? `<span style="height:${h(l)};background:var(--seq-2)"></span>` : ''}</span><span class="n">${o + s + l || '—'}</span></button>`;
    }).join('');
    const cell = (d) => {
      const its = onDay(d); const out = d.getMonth() !== m; const we = [0, 6].includes(d.getDay());
      const byC = {}; its.forEach((i) => { (byC[i.cust] ||= []).push(i); });
      const evs = Object.entries(byC).map(([c, a]) => { const s = stateOf(a[0]); return `<span class="ev ${s}" title="${CUSTS[c].n}: ${a.length} manutenzioni"><span>${CUSTS[c].n}</span><b>${a.length}</b></span>`; });
      const worst = its.some((i) => stateOf(i) === 'over') ? ' has-over' : its.some((i) => stateOf(i) === 'soon') ? ' has-soon' : its.length ? ' has-later' : '';
      return `<button type="button" class="day${out ? ' out' : ''}${we ? ' we' : ''}${d < TODAY ? ' past' : ''}${worst}${iso(d) === TODAY_ISO ? ' today' : ''}" data-day="${iso(d)}" aria-pressed="${calDay === iso(d)}" aria-label="${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}, ${its.length} manutenzioni"><span class="dn"><b>${d.getDate()}</b></span>${evs.slice(0, 2).join('')}${evs.length > 2 ? `<span class="more">+${evs.length - 2} altri</span>` : ''}</button>`;
    };
    const sideItems = calDay ? onDay(D(calDay)) : over;
    const sideTitle = calDay ? D(calDay).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Da recuperare';
    const sideSub = calDay ? `${sideItems.length} manutenzioni in scadenza` : `${over.length} manutenzioni scadute prima di oggi: pianificale per prime`;
    const groups = {}; sideItems.forEach((i) => { (groups[`${CUSTS[i.cust].n} · ${i.site}`] ||= []).push(i); });
    return `<section class="panel" aria-label="Calendario delle scadenze"><div class="cal-wrap">
      <div class="cal-main">
        <div class="yr" role="group" aria-label="Carico dei prossimi 12 mesi">${yearStrip}</div>
        <div class="cal-top"><button class="icon-btn" type="button" data-cal="-1" aria-label="Mese precedente">${ic('chevL')}</button><h3>${calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h3><button class="icon-btn" type="button" data-cal="1" aria-label="Mese successivo">${ic('chevR')}</button><button class="btn btn-sm" type="button" data-cal="0">Oggi</button><span class="sp"></span>
          <div class="cal-legend"><span><i style="background:var(--error)"></i>scadute</span><span><i style="background:var(--warning)"></i>entro 30 giorni</span><span><i style="background:var(--seq-2)"></i>più avanti</span></div></div>
        <div class="cal">${['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].map((d) => `<div class="dow">${d}</div>`).join('')}${days.map(cell).join('')}</div>
      </div>
      <aside class="cal-side" aria-label="Manutenzioni del giorno"><div class="sh${calDay ? '' : ' is-over'}"><h4 style="text-transform:capitalize">${sideTitle}</h4><p>${sideSub}${calDay ? ' · <button type="button" class="lnk" data-day-clear>torna alle scadute</button>' : ''}</p></div>
        <div class="sb">${Object.entries(groups).map(([g, its]) => `<div class="grp-t"><span>${g}</span><button type="button" class="lnk" data-check-group="${its.map((i) => i.id).join(',')}">seleziona</button></div>${its.map((it) => `<label class="cal-day-l"><input type="checkbox" data-check="${it.id}" ${checked.has(it.id) ? 'checked' : ''} aria-label="Seleziona ${esc(it.name)}"><span><b>${it.name}</b><small>${it.plan.title} · ${it.kn}</small></span>${calDay ? stBadge(it) : `<span class="due over"><small>${daysLabel(dueOf(it))}</small></span>`}</label>`).join('')}`).join('') || '<p class="note-p" style="padding:8px">Nessuna manutenzione in questo giorno.</p>'}</div>
        <div class="sf"><span>${checked.size ? `<b style="color:var(--text)">${checked.size}</b> selezionate` : 'Seleziona per registrare insieme'}</span><button class="btn btn-sm btn-primary" type="button" data-rp-checked ${checked.size ? '' : 'disabled'}>${ic('check')}Registra</button></div>
      </aside></div></section>`;
  };

  // ── Scadenze C · Per cliente ─────────────────────────────────────
  // C · Tabellone: clienti (e siti) × mesi, caselle colorate per carico e urgenza
  let boardCell = null; // { c, site|null, k: 'over' | 'YYYY-MM' }
  const BMONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, 10 + i, 1));
  const mkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const inCell = (its, k) => its.filter((i) => (k === 'over' ? stateOf(i) === 'over' : stateOf(i) !== 'over' && dueOf(i).slice(0, 7) === k));
  const cellHtml = (its, c, site, k) => {
    const list = inCell(its, k); const n = list.length;
    const on = boardCell && boardCell.c === c && boardCell.site === site && boardCell.k === k;
    if (!n) return `<td class="bc empty${k === 'over' ? ' ov' : ''}"><span>·</span></td>`;
    const worst = list.some((i) => stateOf(i) === 'over') ? 'over' : list.some((i) => stateOf(i) === 'soon') ? 'soon' : 'later';
    const lvl = worst === 'later' ? Math.min(4, n) : 0;
    return `<td class="bc"><button type="button" class="bcell ${worst} l${lvl}${on ? ' is-on' : ''}" data-bcell="${c}|${site ?? ''}|${k}" aria-pressed="${on}" title="${n} manutenzioni">${n}</button></td>`;
  };
  const dueC = () => {
    const t = todo();
    const custs = Object.keys(CUSTS).map((c) => {
      const its = t.filter((i) => i.cust === c); const all = ITEMS.filter((i) => i.cust === c && !i.plan.archived);
      return { c, its, all, over: its.filter((i) => stateOf(i) === 'over').length, next: its.map(dueOf).sort()[0] };
    }).filter((g) => g.its.length).sort((a, b) => b.over - a.over || D(a.next) - D(b.next));
    const colTot = (k) => inCell(t, k).length;
    let detail = '';
    if (boardCell) {
      const base = t.filter((i) => i.cust === boardCell.c && (!boardCell.site || i.site === boardCell.site));
      const list = inCell(base, boardCell.k).sort((a, b) => D(dueOf(a)) - D(dueOf(b)));
      const label = boardCell.k === 'over' ? 'scadute' : D(`${boardCell.k}-01`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      detail = `<div class="bdet"><div class="bdet-h"><b>${CUSTS[boardCell.c].n}${boardCell.site ? ` · ${boardCell.site}` : ''}</b><span>${list.length} manutenzioni ${boardCell.k === 'over' ? 'scadute' : `a ${label}`}</span><span class="sp"></span><button type="button" class="btn btn-sm" data-check-group="${list.map((i) => i.id).join(',')}">Seleziona tutte</button><button type="button" class="btn btn-sm btn-primary" data-rp-group="${list.map((i) => i.id).join(',')}">${ic('check')}Registra il giro</button><button type="button" class="icon-btn" data-bclose aria-label="Chiudi">${ic('x')}</button></div>
        <div class="bdet-l">${list.map((it) => `<label class="cal-day-l"><input type="checkbox" data-check="${it.id}" ${checked.has(it.id) ? 'checked' : ''} aria-label="Seleziona ${esc(it.name)}"><span><b>${it.name}</b><small>${it.site} · ${it.plan.title} · ${it.kn}</small></span>${stBadge(it)}</label>`).join('')}</div></div>`;
    }
    const AORDER = ['avec', 'rom', null];
    if (AREAS_ON) custs.sort((a, b) => AORDER.indexOf(CUSTS[a.c].area) - AORDER.indexOf(CUSTS[b.c].area));
    let lastArea;
    const rowsHtml = custs.map((g) => {
      let ahead = '';
      if (AREAS_ON && areaF === 'all' && CUSTS[g.c].area !== lastArea) {
        lastArea = CUSTS[g.c].area;
        const ait = t.filter((i) => CUSTS[i.cust].area === lastArea);
        const tot = (k) => inCell(ait, k).length;
        ahead = `<tr class="barea"><th scope="rowgroup"><span>${areaName(g.c)}</span><small>${ait.length} da fare</small></th><td class="btot ov">${tot('over') || ''}</td>${BMONTHS.map((m) => `<td class="btot">${tot(mkey(m)) || ''}</td>`).join('')}<td class="btot">${ait.length}</td></tr>`;
      }
      const open = openCust.has(g.c); const done = g.all.filter((i) => i.done).length;
      const sites = [...new Set(g.its.map((i) => i.site))];
      const main = `<tr class="br${open ? ' is-open' : ''}"><th scope="row"><button type="button" class="bname" data-cg="${g.c}" aria-expanded="${open}"><span class="chev">${ic('chevR')}</span><span><b>${CUSTS[g.c].n}</b><small>${sites.length} ${sites.length === 1 ? 'sito' : 'siti'} · fatte ${done}/${g.all.length}</small></span></button></th>
        ${cellHtml(g.its, g.c, null, 'over')}${BMONTHS.map((m) => cellHtml(g.its, g.c, null, mkey(m))).join('')}<td class="btot">${g.its.length}</td></tr>`;
      const subs = open ? sites.map((s) => { const its = g.its.filter((i) => i.site === s); return `<tr class="bs"><th scope="row"><span class="bsite">${ic('pin')}${s}</span></th>${cellHtml(its, g.c, s, 'over')}${BMONTHS.map((m) => cellHtml(its, g.c, s, mkey(m))).join('')}<td class="btot">${its.length}</td></tr>`; }).join('') : '';
      return ahead + main + subs;
    }).join('');
    return `<section class="panel board-panel" aria-label="Tabellone clienti per mese">
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">Un riquadro = le manutenzioni di quel cliente nel mese. Più è scuro, più sono. Rosso: scadute · arancio: entro 30 giorni.</span></div><span class="spacer"></span><button class="btn btn-ghost btn-sm" type="button" data-expand>${openCust.size ? 'Chiudi i siti' : 'Mostra i siti'}</button></div>
      ${bulkBar()}
      <div class="board-wrap"><table class="board"><thead><tr><th class="bmh-c">Cliente</th><th class="bmh ov">Scadute</th>${BMONTHS.map((m) => `<th class="bmh${m.getMonth() === 10 && m.getFullYear() === 2026 ? ' now' : ''}">${m.toLocaleDateString('it-IT', { month: 'short' })}${m.getMonth() === 0 ? `<small>${m.getFullYear()}</small>` : ''}</th>`).join('')}<th class="bmh">Tot.</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><th>Totale</th><td class="btot ov">${colTot('over')}</td>${BMONTHS.map((m) => `<td class="btot">${colTot(mkey(m)) || ''}</td>`).join('')}<td class="btot">${t.length}</td></tr></tfoot></table></div>
      ${detail}</section>`;
  };

  // ── Piani ────────────────────────────────────────────────────────
  const planStats = (p) => { const its = ITEMS.filter((i) => i.plan.id === p.id || (p.archived && i.plan.id === 1)); const done = p.archived ? its.length : its.filter((i) => i.done).length; const over = p.archived ? 0 : its.filter((i) => !i.done && stateOf(i) === 'over').length; return { its, done, over, total: its.length }; };
  const planState = (p, s) => (p.archived ? 'arch' : s.done >= s.total ? 'done' : 'run');
  const PST = { run: ['In corso', '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor"/>'], done: ['Completato', '<circle cx="6" cy="6" r="4" fill="currentColor"/>'], arch: ['Archiviato', '<path d="M2.5 6h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'] };
  const plansPage = () => {
    const act = PLA().filter((p) => !p.archived); const st = act.map(planStats);
    const totalDone = st.reduce((a, s) => a + s.done, 0); const total = st.reduce((a, s) => a + s.total, 0);
    return `<div class="kpi-wrap"><div class="kpis mt-kpis"><div class="kpi"><span class="kpi-h">Piani attivi</span><span class="kpi-v">${act.length}<small>${new Set(act.map((p) => p.c)).size} clienti</small></span><span class="kpi-s"><b>${total}</b> inventari coperti</span></div>
      <div class="kpi"><span class="kpi-h">Completati nel ciclo</span><span class="kpi-v">${act.filter((p, i) => planState(p, st[i]) === 'done').length}<small>di ${act.length}</small></span><span class="kpi-s"><b>${totalDone}</b> manutenzioni eseguite su ${total}</span></div>
      <div class="kpi"><span class="kpi-h">Con scadute</span><span class="kpi-v">${st.filter((s) => s.over).length}</span><span class="kpi-s">piani con almeno un inventario in ritardo</span></div>
      <div class="kpi"><span class="kpi-h">Copertura complessiva</span><span class="kpi-v">${Math.round(totalDone / total * 100)}%</span><div class="meter"><span style="width:${totalDone / total * 100}%"></span></div><span class="kpi-s">eseguite sul totale del ciclo corrente</span></div></div></div>
      <section class="panel"><div class="vtabs"><button type="button" aria-pressed="true">Attivi <span>${act.length}</span></button><button type="button" aria-pressed="false">Con scadute <span>${st.filter((s) => s.over).length}</span></button><button type="button" aria-pressed="false">Completati <span>${act.filter((p, i) => planState(p, st[i]) === 'done').length}</span></button><button type="button" aria-pressed="false">Archiviati <span>${PLA().filter((p) => p.archived).length}</span></button></div>
      <div class="table-wrap"><table class="po-table mt-table"><thead><tr><th>Piano</th><th>Cliente</th><th class="c-type">Tipi</th><th>Cadenza</th><th>Copertura</th><th>Prossima scadenza</th><th>Stato</th></tr></thead><tbody>
      ${PLA().map((p) => { const s = planStats(p); const k = planState(p, s); const pct = Math.round(s.done / s.total * 100); return `<tr data-plan="${p.id}" tabindex="0" class="${sel?.kind === 'plan' && sel.id === p.id ? 'is-selected' : ''}"><td><b style="font-weight:550">${p.title}</b></td><td>${CUSTS[p.c].n}</td><td class="c-type"><span class="tchips">${p.types.map((t) => `<span>${t}</span>`).join('')}</span></td><td><span class="sched">${ic(p.fixed ? 'calendar' : 'restore')}${schedText(p)}</span></td>
        <td><span class="covc"><span class="tr"><span style="width:${pct}%;background:${pct === 100 ? 'var(--success)' : s.over ? 'var(--error)' : 'var(--seq-3)'}"></span></span><span>${s.done}/${s.total}${s.over ? ` · <b style="color:var(--error)">${s.over} scadute</b>` : ''}</span></span></td>
        <td>${p.archived ? '<span class="none">—</span>' : `<span class="due ${daysTo(p.due) < 0 ? 'over' : daysTo(p.due) <= 30 ? 'soon' : ''}">${dShort(p.due)}<small>${daysLabel(p.due)}</small></span>`}</td>
        <td><span class="ps-b ${k}"><svg viewBox="0 0 12 12" aria-hidden="true">${PST[k][1]}</svg>${PST[k][0]}</span></td></tr>`; }).join('')}</tbody></table></div>
      <div class="po-foot"><span><b>${PLA().length}</b> piani</span><span class="sp"></span><span>Clic su un piano per vedere gli inventari e lo storico</span></div></section>`;
  };

  // ── Rapportini ───────────────────────────────────────────────────
  const EVIEWS = [['all', 'Tutti', () => true], ['follow', 'KO e parziali', (e) => ['ko', 'partial'].includes(e.res)], ['nopdf', 'Senza PDF', (e) => !e.pdf && e.res !== 'not_planned'], ['np', 'Non previste', (e) => e.res === 'not_planned']];
  const eventsPage = () => {
    const nov = EVA().filter((e) => e.date >= '2026-11-01'); const follow = EVA().filter(EVIEWS[1][2]); const nopdf = EVA().filter(EVIEWS[2][2]);
    const byTech = TECHS.map((t) => [t, EVA().filter((e) => e.tech === t && e.date >= '2026-08-01').length]);
    const maxT = Math.max(...byTech.map((x) => x[1]));
    const rows = EVA().filter(EVIEWS.find((v) => v[0] === evView)[2]);
    return `<div class="kpi-wrap"><div class="kpis mt-kpis">
      <div class="kpi"><span class="kpi-h">Rapportini a novembre</span><span class="kpi-v">${nov.length}</span><span class="kpi-s"><b>${nov.filter((e) => e.res === 'ok').length}</b> OK · <b>${nov.filter((e) => e.res !== 'ok').length}</b> con esito diverso</span></div>
      <button type="button" class="kpi" data-evview="follow"><span class="kpi-h">KO e parziali<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${follow.length}</span><span class="kpi-s">interventi da completare o ripassare</span></button>
      <button type="button" class="kpi" data-evview="nopdf"><span class="kpi-h">Senza PDF<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${nopdf.length}</span><span class="kpi-s">rapportino firmato da allegare</span></button>
      <div class="kpi"><span class="kpi-h">Per tecnico · ultimi 3 mesi</span><div style="display:grid;gap:4px;margin-top:4px">${byTech.map(([t, n]) => `<div style="display:grid;grid-template-columns:120px 1fr 24px;gap:8px;align-items:center;font-size:12px;color:var(--muted)"><span>${t}</span><span style="height:6px;border-radius:3px;background:var(--neutral-bg)"><span style="display:block;height:100%;width:${n / maxT * 100}%;border-radius:3px;background:var(--seq-3)"></span></span><b style="color:var(--text);text-align:right">${n}</b></div>`).join('')}</div></div></div></div>
      <section class="panel"><div class="vtabs">${EVIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === evView}" data-evview="${k}">${l} <span>${EVA().filter(f).length}</span></button>`).join('')}</div>
      <div class="table-wrap"><table class="po-table mt-table"><thead><tr><th>Data</th><th>Esito</th><th>Cliente · sito</th><th>Inventario</th><th class="c-plan">Piano</th><th>Tecnico</th><th>PDF</th></tr></thead><tbody>
      ${rows.map((e) => `<tr data-event="${e.id}" tabindex="0" class="${sel?.kind === 'event' && sel.id === e.id ? 'is-selected' : ''}"><td><span class="due">${dShort(e.date)}<small>${daysLabel(e.date)}</small></span></td><td>${resBadge(e.res)}</td><td class="cs"><b>${CUSTS[e.item.cust].n}</b><small>${e.item.site}</small></td><td class="inv"><b>${e.item.name}</b><small>${e.item.kn}</small></td><td class="c-plan" style="font-size:12.5px">${e.item.plan.title}</td><td>${e.res === 'not_planned' ? '<span class="none">—</span>' : e.tech}</td><td>${e.pdf ? '<span class="pdfb">PDF</span>' : e.res === 'not_planned' ? '' : '<span class="pdfb none">manca</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> rapportini</span></div></section>`;
  };

  // ── Pagina ───────────────────────────────────────────────────────
  let sel = null;
  const render = () => {
    const body = page === 'due' ? dueKpis() + (dueVar === 'b' ? dueB() : dueVar === 'c' ? dueC() : dueA()) : page === 'plans' ? plansPage() : eventsPage();
    root.innerHTML = head() + body;
    document.querySelectorAll('[data-mtv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mtv === dueVar)));
    document.querySelectorAll('[data-mtv]').forEach((b) => { b.disabled = page !== 'due'; });
  };

  // ── Pannello di dettaglio ────────────────────────────────────────
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell'); let dtab = 'det';
  const openDrawer = (kind, id) => { sel = { kind, id }; dtab = 'det'; drawer.hidden = false; shell.classList.add('has-drawer'); render(); renderDrawer(); };
  const closeDrawer = () => { sel = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  const renderDrawer = () => {
    if (!sel) return;
    let id = '', st = '', title = '', sub = '', tabs = [], body = '', foot = '';
    if (sel.kind === 'item') {
      const it = ITEMS.find((x) => x.id === sel.id); const hist = EVENTS.filter((e) => e.item.kn === it.kn); const s = stateOf(it); const d = dueOf(it); const p = it.plan;
      id = it.kn; st = stBadge(it); title = it.name; sub = `${CUSTS[it.cust].n} · ${it.site} · ${it.type}`;
      tabs = [['det', 'Dettagli'], ['his', `Storico <span class="tn">${hist.length}</span>`]];
      body = dtab === 'det' ? `<section class="ct-sec"><div class="callout${s === 'over' ? ' err' : s === 'soon' ? ' warn' : ''}"><div><b>${s === 'over' ? `Scaduta il ${dShort(d)}` : `Da fare entro il ${dShort(d)}`} · ${daysLabel(d)}</b><span>${it.ovr ? `Scadenza modificata per questo inventario: il piano dice ${dShort(p.due)}.` : `Scadenza del piano «${p.title}».`} Avviso ${p.alert} giorni prima.</span></div></div></section>
        <section class="ct-sec"><div class="h"><h4>Piano</h4><button type="button" class="lnk" data-open-plan="${p.id}">Apri il piano</button></div><dl class="sum-k" style="font-size:13px"><dt>Nome</dt><dd>${p.title}</dd><dt>Cadenza</dt><dd>${schedText(p)}</dd><dt>Tipi coperti</dt><dd>${p.types.join(', ')}</dd><dt>Dopo questa</dt><dd>${dShort(nextAfter(p, d))}</dd></dl></section>
        <section class="ct-sec"><div class="h"><h4>Inventario</h4></div><dl class="sum-k" style="font-size:13px"><dt>Hostname</dt><dd class="code">${it.host}</dd><dt>KNumber</dt><dd class="code">${it.kn}</dd><dt>Sito</dt><dd>${it.site}</dd></dl></section>
        <section class="ct-sec"><div class="h"><h4>Ultimo intervento</h4></div>${hist[0] ? `<div class="doc-row"><span>${resBadge(hist[0].res)}</span><div class="fn"><b>${dShort(hist[0].date)} · ${hist[0].tech}</b><span>${hist[0].notes || 'Nessuna nota'}</span></div>${hist[0].pdf && hist[0].res !== 'not_planned' ? '<span class="pdfb">PDF</span>' : ''}</div>` : '<p class="note-p">Mai registrato.</p>'}</section>`
        : `<div class="feed">${hist.map((e) => `<div class="ev">${ic(e.res === 'ok' ? 'check' : e.res === 'not_planned' ? 'x' : 'alert')}<span><b>${e.tech}</b> ${resBadge(e.res)} ${e.item.plan.title}${e.notes ? ` — ${e.notes}` : ''}</span><time>${dShort(e.date)}</time></div>`).join('') || '<p class="note-p">Nessun rapportino.</p>'}</div>`;
      foot = `<div class="drawer-foot"><button class="btn" type="button">${ic('calendar')}Modifica scadenza</button><button class="btn btn-ghost" type="button" data-np-one="${it.id}">Non prevista</button><span class="g-spacer"></span><button class="btn btn-primary" type="button" data-rp-one="${it.id}">${ic('check')}Registra rapportino</button></div>`;
    } else if (sel.kind === 'plan') {
      const p = PLANS.find((x) => x.id === sel.id); const s = planStats(p); const k = planState(p, s);
      const its = s.its; const todoN = s.total - s.done - s.over;
      id = `Piano #${p.id}`; st = `<span class="ps-b ${k}"><svg viewBox="0 0 12 12" aria-hidden="true">${PST[k][1]}</svg>${PST[k][0]}</span>`; title = p.title; sub = `${CUSTS[p.c].n} · ${schedText(p)}`;
      tabs = [['det', 'Dettagli'], ['inv', `Inventari <span class="tn">${s.total}</span>`], ['his', 'Storico']];
      body = dtab === 'det' ? `<section class="ct-sec"><div class="h"><h4>Avanzamento del ciclo</h4><b style="font-size:13px">${s.done}/${s.total}</b></div><div class="cov-big"><div class="tr"><span style="flex:${s.done};background:var(--success)"></span><span style="flex:${s.over};background:var(--error)"></span><span style="flex:${todoN};background:var(--seq-1)"></span></div><div class="lg"><span><i style="background:var(--success)"></i>eseguite <b>${s.done}</b></span><span><i style="background:var(--error)"></i>scadute <b>${s.over}</b></span><span><i style="background:var(--seq-1)"></i>da fare <b>${todoN}</b></span></div></div></section>
        <section class="ct-sec"><div class="h"><h4>Programmazione</h4></div><dl class="sum-k" style="font-size:13px"><dt>Cadenza</dt><dd>${schedText(p)}</dd><dt>Prossima scadenza</dt><dd>${p.archived ? '—' : `${dShort(p.due)} · ${daysLabel(p.due)}`}</dd><dt>Avviso</dt><dd>${p.alert} giorni prima</dd><dt>Tipi coperti</dt><dd>${p.types.join(', ')}</dd></dl></section>`
        : dtab === 'inv' ? `<ul class="inv-rows">${its.map((it) => { const done = p.archived || it.done; const o = !done && stateOf(it) === 'over'; return `<li><span class="st ${done ? 'done' : o ? 'over' : 'todo'}">${done ? tick : ''}</span><span><b>${it.name}</b><small>${it.site} · ${it.kn}</small></span><span class="r">${done ? `fatta ${dShort(it.done ? it.done[1] : '2025-11-12', false)}` : `${o ? '<b style="color:var(--error)">scaduta</b>' : 'entro'} ${dShort(dueOf(it), false)}`}</span></li>`; }).join('')}</ul>`
        : `<div class="feed">${EVENTS.filter((e) => e.item.plan.id === p.id).slice(0, 12).map((e) => `<div class="ev">${ic('check')}<span><b>${e.tech}</b> ${resBadge(e.res)} ${e.item.name}</span><time>${dShort(e.date)}</time></div>`).join('') || '<p class="note-p">Nessun rapportino.</p>'}</div>`;
      foot = `<div class="drawer-foot"><button class="btn" type="button">${ic('download')}Report PDF</button><button class="btn" type="button" data-plan-todo="${p.id}">Vedi da fare</button><span class="g-spacer"></span><button class="btn btn-primary" type="button">${ic('wrench')}Modifica</button></div>`;
    } else {
      const e = EVENTS.find((x) => x.id === sel.id);
      id = dShort(e.date); st = resBadge(e.res); title = e.item.name; sub = `${CUSTS[e.item.cust].n} · ${e.item.site} · ${e.item.plan.title}`;
      tabs = [['det', 'Dettagli']];
      body = `<section class="ct-sec"><div class="callout${e.res === 'ko' ? ' err' : e.res === 'partial' ? ' warn' : ''}"><div><b>${{ ok: 'Eseguita, tutto regolare', partial: 'Eseguita in parte', ko: 'Problemi da risolvere', not_planned: 'Non prevista in questo ciclo' }[e.res]}</b><span>${e.notes || 'Nessuna nota.'}</span></div></div></section>
        <section class="ct-sec"><dl class="sum-k" style="font-size:13px"><dt>Data</dt><dd>${dShort(e.date)}</dd><dt>Tecnico</dt><dd>${e.res === 'not_planned' ? '—' : e.tech}</dd><dt>Inventario</dt><dd>${e.item.kn}</dd></dl></section>
        ${e.res === 'not_planned' ? '' : `<section class="ct-sec"><div class="h"><h4>Rapportino firmato</h4></div>${e.pdf ? `<div class="pdf-prev"><div class="sheet"><i class="h"></i><i></i><i></i><i style="width:70%"></i><i></i><i style="width:50%"></i><i></i><i style="width:80%"></i></div><button class="btn btn-sm" type="button">${ic('eye')}Apri il PDF</button></div>` : `<button type="button" class="doc-drop">${ic('upload')}<span><b>Carica il PDF firmato</b><span>Trascinalo qui o sfoglia</span></span></button>`}</section>`}
        ${['ko', 'partial'].includes(e.res) ? `<section class="ct-sec"><div class="h"><h4>Seguito</h4></div><div class="doc-row">${ic('alert')}<div class="fn"><b>Nessuna issue collegata</b><span>Apri una issue per non perdere il ripasso.</span></div><button class="btn btn-sm" type="button">${ic('plus')}Apri issue</button></div></section>` : ''}`;
      foot = `<div class="drawer-foot"><button class="btn" type="button">${ic('wrench')}Modifica</button><span class="g-spacer"></span><button class="btn btn-ghost" type="button">${ic('trash')}Elimina</button></div>`;
    }
    $('[data-md="id"]').textContent = id; $('[data-md="st"]').innerHTML = st; $('[data-md="title"]').textContent = title; $('[data-md="sub"]').textContent = sub;
    $('[data-mtabs]').innerHTML = tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${dtab === k}">${l}</button>`).join('');
    $('[data-mbody]').innerHTML = `<div class="drawer-body int-body">${body}</div>${foot}`;
  };
  $('[data-mclose-d]').addEventListener('click', closeDrawer);
  $('[data-mtabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { dtab = b.dataset.tab; renderDrawer(); } });
  $('[data-mbody]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.openPlan) openDrawer('plan', Number(b.dataset.openPlan));
    if (b.dataset.planTodo) { page = 'due'; dueVar = 'a'; view = 'all'; planFilter = Number(b.dataset.planTodo); closeDrawer(); }
    if (b.dataset.rpOne) openRp([Number(b.dataset.rpOne)]);
    if (b.dataset.npOne) markNP([Number(b.dataset.npOne)]);
  });

  // ── Toast ────────────────────────────────────────────────────────
  const toast = $('[data-toast]'); let undo = null; let tt = null;
  const showToast = (msg, u) => { undo = u; toast.innerHTML = `${tick}<span>${msg}</span>${u ? '<button type="button" data-undo>Annulla</button>' : ''}`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 6000); };
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toast.hidden = true; } });

  // ── Registrazione ────────────────────────────────────────────────
  const register = (entries, date, tech, pdf) => {
    const added = entries.map(({ id, res, note }) => { const it = ITEMS.find((x) => x.id === id); it.done = ['done', date, res, 0, pdf ? 1 : 0]; const ev = { id: ++eid, item: it, date, res, tech: res === 'not_planned' ? '' : tech, pdf: Boolean(pdf), notes: note || '' }; EVENTS.unshift(ev); return { it, ev }; });
    checked = new Set(); render(); if (sel) renderDrawer();
    const n = added.length; const ko = added.filter((a) => a.ev.res !== 'ok' && a.ev.res !== 'not_planned').length;
    showToast(`${n} ${n === 1 ? 'rapportino registrato' : 'rapportini registrati'}${ko ? ` · ${ko} da seguire` : ''}`, () => { added.forEach(({ it, ev }) => { it.done = null; EVENTS.splice(EVENTS.indexOf(ev), 1); }); render(); if (sel) renderDrawer(); });
    if (sel?.kind === 'item' && added.some((a) => a.it.id === sel.id)) closeDrawer();
  };
  const markNP = (ids) => register(ids.map((id) => ({ id, res: 'not_planned' })), TODAY_ISO, '', null);

  // ── Dialogo Rapportino ───────────────────────────────────────────
  const mdl = $('[data-mdl]'); const box = $('.mdl', mdl);
  let rp = null;
  const OUT = [['ok', 'OK', 'Eseguita, tutto regolare', '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'], ['partial', 'Parziale', 'Eseguita in parte', '<path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>'], ['ko', 'KO', 'Problemi da risolvere', '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'], ['not_planned', 'Non prevista', 'Salta questo ciclo', '<path d="M6 12h12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>']];
  const openRp = (ids) => { rp = { ids: [...ids], res: 'ok', per: Object.fromEntries(ids.map((i) => [i, { res: 'ok', note: '' }])), date: TODAY_ISO, tech: TECHS[0], note: '', pdf: null, issue: true, freeCust: '' }; mdl.hidden = false; paintRp(); };
  const items = () => rp.ids.map((i) => ITEMS.find((x) => x.id === i));
  const dateChips = () => `<div class="row2" style="grid-template-columns:auto 1fr;align-items:end"><div class="f"><span class="lbl">Data dell'intervento</span><div class="chips">${[[TODAY_ISO, 'Oggi'], [addDays(TODAY_ISO, -1), 'Ieri']].map(([d, l]) => `<button type="button" class="chip" data-rpdate="${d}" aria-pressed="${rp.date === d}">${l}</button>`).join('')}</div></div><div class="f"><label for="rp-d" class="lbl" style="visibility:hidden">Data</label><input id="rp-d" type="date" value="${rp.date}" data-rpk="date"></div></div>`;
  const techSel = () => `<div class="f"><label for="rp-t">Tecnico</label><select id="rp-t" data-rpk="tech">${TECHS.map((t) => `<option${t === rp.tech ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const pdfDrop = (lbl = 'PDF del rapportino firmato', opt = 'facoltativo, si può allegare dopo') => `<div class="f"><span class="lbl">${lbl} <span class="opt">· ${opt}</span></span><label class="drop-sm${rp.pdf ? ' has' : ''}">${ic(rp.pdf ? 'file' : 'upload')}<span>${rp.pdf ? `<b>${rp.pdf}</b> · clic per cambiarlo` : '<b>Trascina qui il PDF</b> o sfoglia'}</span><input type="file" accept="application/pdf" hidden data-rppdf></label></div>`;
  const freePick = () => {
    const custs = Object.keys(CUSTS).filter((c) => todo().some((i) => i.cust === c));
    const list = rp.freeCust ? todo().filter((i) => i.cust === rp.freeCust) : [];
    return `<div class="f"><label for="rp-c">Cliente</label><select id="rp-c" data-rpk="freeCust"><option value="">Scegli il cliente…</option>${custs.map((c) => `<option value="${c}"${c === rp.freeCust ? ' selected' : ''}>${CUSTS[c].n}</option>`).join('')}</select></div>
      ${rp.freeCust ? `<div class="f"><span class="lbl">Manutenzioni da registrare</span><div class="dpick">${list.map((i) => `<button type="button" class="chip" data-rppick="${i.id}" aria-pressed="${rp.ids.includes(i.id)}">${rp.ids.includes(i.id) ? ic('check') : ''}${i.name}</button>`).join('')}</div></div>` : ''}`;
  };
  const targetsBox = () => {
    const its = items(); const over = its.filter((i) => stateOf(i) === 'over').length; const custs = [...new Set(its.map((i) => CUSTS[i.cust].n))];
    if (!its.length) return '';
    return `<div class="targets"><div class="t1"><b>${its.length === 1 ? its[0].name : `${its.length} manutenzioni`}</b><span class="sp"></span>${over ? `<span class="pill err"><b>${over}</b> scadut${over === 1 ? 'a' : 'e'}</span>` : ''}</div><span style="color:var(--muted)">${custs.join(', ')} · ${[...new Set(its.map((i) => i.plan.title))].join(', ')}</span>${its.length > 1 ? `<ul>${its.map((i) => `<li>${i.name}</li>`).join('')}</ul>` : ''}</div>`;
  };
  const nextDueNote = () => {
    const its = items(); if (!its.length) return '';
    const plans = [...new Map(its.map((i) => [i.plan.id, i])).values()];
    if (rpVar === 'a' && rp.res === 'not_planned') return `<div class="next-due warn">Non prevista: la manutenzione esce dalle scadenze di questo ciclo. Prossima: <b>${dShort(nextAfter(plans[0].plan, dueOf(plans[0])))}</b>.</div>`;
    if (plans.length === 1) return `<div class="next-due">Dopo la registrazione la prossima scadenza sarà il <b>${dShort(nextAfter(plans[0].plan, dueOf(plans[0])))}</b> (${schedText(plans[0].plan).toLowerCase()}).</div>`;
    return `<div class="next-due">Le prossime scadenze si ricalcolano per piano: ${plans.map((i) => `${i.plan.title} → <b>${dShort(nextAfter(i.plan, dueOf(i)))}</b>`).join(' · ')}.</div>`;
  };
  const paintRpA = () => {
    const its = items(); const r = rp.res; const needNote = ['ko', 'partial'].includes(r);
    box.className = 'mdl rp';
    box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Registra rapportino</h3><p>${its.length > 1 ? 'Stesso esito, data e tecnico per tutte le manutenzioni selezionate.' : 'Esito dell\'intervento e rapportino firmato.'}</p></div><button class="icon-btn" type="button" data-rpclose aria-label="Chiudi">${ic('x')}</button></div>
      <div class="rp-body">${its.length ? targetsBox() : ''}${rp.free ? freePick() : ''}
        <div class="f"><span class="lbl">Esito</span><div class="outcome" role="radiogroup" aria-label="Esito">${OUT.map(([k, l, d, svg]) => `<button type="button" class="${k}" role="radio" aria-pressed="${r === k}" data-rpres="${k}"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg></span><b>${l}</b><small>${d}</small></button>`).join('')}</div></div>
        ${r === 'not_planned' ? '' : `${dateChips()}${techSel()}`}
        <div class="f"><label for="rp-n">Note${needNote ? ' <span class="req">*</span>' : ' <span class="opt">· facoltativo</span>'}</label><textarea id="rp-n" data-rpk="note" placeholder="${needNote ? 'Cosa resta da fare? Ricambi ordinati, prossimo passaggio…' : 'Osservazioni sull\'intervento'}">${esc(rp.note)}</textarea></div>
        ${r === 'ko' ? `<label class="sw"><input type="checkbox" data-rpk="issue" ${rp.issue ? 'checked' : ''}><span class="tg"></span><span>Apri una issue per il problema<small>Collegata ${its.length > 1 ? 'agli inventari' : 'all\'inventario'}, così il ripasso non si perde</small></span></label>` : ''}
        ${r === 'not_planned' ? '' : pdfDrop()}
        ${nextDueNote()}</div>
      <div class="nc-foot"><span class="hint">${its.length > 1 ? `${its.length} rapportini` : ''}</span><span class="sp"></span><button class="btn btn-ghost" type="button" data-rpclose>Annulla</button><button class="btn btn-primary" type="button" data-rpsave ${its.length ? '' : 'disabled'}>${ic('check')}${r === 'not_planned' ? 'Segna non prevista' : its.length > 1 ? `Registra ${its.length} rapportini` : 'Registra'}</button></div>`;
  };
  const paintRpB = () => {
    const its = items(); const cnt = { ok: 0, partial: 0, ko: 0, not_planned: 0 }; its.forEach((i) => cnt[rp.per[i.id].res]++);
    box.className = 'mdl rp rp-b';
    box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Registra rapportini</h3><p>Lista di controllo: un esito per ogni inventario, data, tecnico e PDF in comune.</p></div><button class="icon-btn" type="button" data-rpclose aria-label="Chiudi">${ic('x')}</button></div>
      <div class="rp-body">${rp.free ? freePick() : ''}
        <div class="row3" style="display:grid;grid-template-columns:1.3fr 1fr 1.3fr;gap:12px;align-items:end">${dateChips().replace('class="row2" style="grid-template-columns:auto 1fr;align-items:end"', 'style="display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:end"')}${techSel()}${pdfDrop('PDF unico per il giro', 'facoltativo')}</div>
        ${its.length ? `<div class="chk-sum"><span>${its.length} inventari</span>·${OUT.filter(([k]) => cnt[k]).map(([k]) => resBadge(k).replace(RES[k][0], `${cnt[k]} ${RES[k][0]}`)).join('')}<span class="sp" style="flex:1"></span><button type="button" class="lnk" data-allok>Tutti OK</button></div>
        <table class="chk-table"><thead><tr><th>Inventario</th><th>Scadenza</th><th>Esito</th><th style="width:34%">Nota</th></tr></thead><tbody>
        ${its.map((i) => { const p = rp.per[i.id]; return `<tr class="${p.res === 'ko' ? 'is-ko' : ''}"><td class="inv"><b>${i.name}</b><small>${i.kn} · ${i.site}</small></td><td>${dueCell(i, true)}</td><td><span class="oseg" role="radiogroup" aria-label="Esito ${esc(i.name)}">${OUT.map(([k]) => `<button type="button" class="${k}" role="radio" aria-pressed="${p.res === k}" data-rowres="${i.id}:${k}" title="${RES[k][0]}">${{ ok: 'OK', partial: 'Parz.', ko: 'KO', not_planned: 'NP' }[k]}</button>`).join('')}</span></td><td><input class="note-in" data-rownote="${i.id}" value="${esc(p.note)}" placeholder="${['ko', 'partial'].includes(p.res) ? 'Cosa resta da fare? *' : 'facoltativa'}" aria-label="Nota per ${esc(i.name)}"></td></tr>`; }).join('')}</tbody></table>` : ''}
        ${cnt.ko ? `<label class="sw"><input type="checkbox" data-rpk="issue" ${rp.issue ? 'checked' : ''}><span class="tg"></span><span>Apri una issue per ogni KO<small>${cnt.ko} issue collegate agli inventari</small></span></label>` : ''}
        ${nextDueNote()}</div>
      <div class="nc-foot"><span class="hint">${its.length} rapportini · ${cnt.ok} OK${cnt.ko + cnt.partial ? ` · ${cnt.ko + cnt.partial} da seguire` : ''}</span><span class="sp"></span><button class="btn btn-ghost" type="button" data-rpclose>Annulla</button><button class="btn btn-primary" type="button" data-rpsave ${its.length ? '' : 'disabled'}>${ic('check')}Registra ${its.length > 1 ? its.length : ''}</button></div>`;
  };
  const paintRp = () => { const keep = document.activeElement?.dataset?.rownote; (rpVar === 'b' ? paintRpB : paintRpA)(); if (keep) { const el = box.querySelector(`[data-rownote="${keep}"]`); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); } };
  const closeRp = () => { mdl.hidden = true; rp = null; };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-rpclose]')) return closeRp();
    if (b.dataset.rpres) { rp.res = b.dataset.rpres; paintRp(); return; }
    if (b.dataset.rpdate) { rp.date = b.dataset.rpdate; paintRp(); return; }
    if (b.dataset.rowres) { const [id, r] = b.dataset.rowres.split(':'); rp.per[id].res = r; paintRp(); return; }
    if (b.matches('[data-allok]')) { Object.values(rp.per).forEach((p) => { p.res = 'ok'; }); paintRp(); return; }
    if (b.dataset.rppick) { const id = Number(b.dataset.rppick); rp.ids = rp.ids.includes(id) ? rp.ids.filter((x) => x !== id) : [...rp.ids, id]; rp.per[id] ||= { res: 'ok', note: '' }; paintRp(); return; }
    if (b.matches('[data-rpsave]')) {
      if (rpVar === 'a' && ['ko', 'partial'].includes(rp.res) && !rp.note.trim()) { const n = $('#rp-n', box); n.closest('.f').classList.add('has-error'); n.focus(); return; }
      if (rpVar === 'b') { const miss = items().find((i) => ['ko', 'partial'].includes(rp.per[i.id].res) && !rp.per[i.id].note.trim()); if (miss) { const n = box.querySelector(`[data-rownote="${miss.id}"]`); n.style.borderColor = 'var(--error)'; n.focus(); return; } }
      const entries = items().map((i) => ({ id: i.id, res: rpVar === 'a' ? rp.res : rp.per[i.id].res, note: rpVar === 'a' ? rp.note : rp.per[i.id].note }));
      const { date, tech, pdf } = rp; closeRp(); register(entries, date, tech, pdf);
    }
  });
  box.addEventListener('input', (e) => { const t = e.target; if (t.dataset.rownote) { rp.per[t.dataset.rownote].note = t.value; t.style.borderColor = ''; } if (t.dataset.rpk === 'note') { rp.note = t.value; t.closest('.f').classList.remove('has-error'); } });
  box.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-rppdf]')) { rp.pdf = t.files[0]?.name || rp.pdf; paintRp(); return; }
    const k = t.dataset.rpk; if (!k || k === 'note') return;
    rp[k] = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'freeCust') { rp.ids = []; }
    paintRp();
  });
  box.addEventListener('dragover', (e) => { if (e.target.closest('.drop-sm')) e.preventDefault(); });
  box.addEventListener('drop', (e) => { if (!e.target.closest('.drop-sm')) return; e.preventDefault(); rp.pdf = e.dataTransfer.files[0]?.name || rp.pdf; paintRp(); });
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) closeRp(); });

  // ── Eventi della pagina ──────────────────────────────────────────
  const cpop = document.createElement('div'); cpop.className = 'cpop'; cpop.hidden = true; document.body.appendChild(cpop);
  root.addEventListener('click', (e) => {
    const t = e.target;
    const b = t.closest('button, input, [data-item], [data-plan], [data-event]'); if (!b) return;
    if (b.dataset.area) { areaF = b.dataset.area; checked = new Set(); custFilter = null; planFilter = null; boardCell = null; calDay = null; if (sel) { sel = null; drawer.hidden = true; shell.classList.remove('has-drawer'); } render(); return; }
    if (b.dataset.page) { page = b.dataset.page; sel = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); return; }
    if (b.matches('[data-rp-free]')) { openRp(checked.size ? [...checked] : []); if (!checked.size) { rp.free = true; paintRp(); } return; }
    if (b.dataset.goview) { view = view === b.dataset.goview ? 'all' : b.dataset.goview; dueVar = 'a'; render(); return; }
    if (b.dataset.cust) { e.stopPropagation(); custFilter = b.dataset.cust; view = 'all'; if (dueVar === 'c') { openCust = new Set([b.dataset.cust]); } else dueVar = 'a'; render(); return; }
    if (b.dataset.view) { view = b.dataset.view; render(); return; }
    if (b.dataset.unf) { if (b.dataset.unf === '*' || b.dataset.unf === 'cust') custFilter = null; if (b.dataset.unf === '*' || b.dataset.unf === 'plan') planFilter = null; render(); return; }
    if (b.dataset.filter) {
      e.stopPropagation(); const k = b.dataset.filter;
      const opts = k === 'cust' ? Object.entries(CUSTS).filter(([c]) => inArea(c)).map(([c, v]) => [c, v.n, todo().filter((i) => i.cust === c).length]) : PLANS.filter((p) => !p.archived).map((p) => [String(p.id), p.title, todo().filter((i) => i.plan.id === p.id).length]);
      cpop.innerHTML = opts.filter((o) => o[2]).map(([v, l, n]) => `<label><input type="radio" name="f" value="${v}" ${(k === 'cust' ? custFilter : String(planFilter)) === v ? 'checked' : ''}>${l}<small>${n}</small></label>`).join('') + '<div class="cp-f"><button type="button" class="btn btn-ghost btn-sm" data-cclear>Rimuovi filtro</button><button type="button" class="btn btn-primary btn-sm" data-capply>Applica</button></div>';
      cpop.dataset.k = k; const r = b.getBoundingClientRect(); cpop.style.left = Math.max(8, Math.min(r.right - 240, innerWidth - 256)) + 'px'; cpop.style.top = `${r.bottom + 6}px`; cpop.hidden = false; return;
    }
    if (b.dataset.checkAll != null) { const rows = visible(); const on = b.checked; rows.forEach((r) => (on ? checked.add(r.id) : checked.delete(r.id))); render(); return; }
    if (b.dataset.check) { e.stopPropagation(); const id = Number(b.dataset.check); if (b.checked) checked.add(id); else checked.delete(id); render(); return; }
    if (b.dataset.checkGroup) { e.stopPropagation(); const ids = b.dataset.checkGroup.split(',').map(Number); const all = ids.every((i) => checked.has(i)); ids.forEach((i) => (all ? checked.delete(i) : checked.add(i))); render(); return; }
    if (b.matches('[data-uncheck]')) { checked = new Set(); render(); return; }
    if (b.matches('[data-rp-checked]')) { openRp([...checked]); return; }
    if (b.matches('[data-np-checked]')) { markNP([...checked]); return; }
    if (b.dataset.rpOne) { e.stopPropagation(); openRp([Number(b.dataset.rpOne)]); return; }
    if (b.dataset.rpGroup) { e.stopPropagation(); openRp(b.dataset.rpGroup.split(',').map(Number)); return; }
    if (b.dataset.month) { calMonth = D(b.dataset.month); calDay = null; render(); return; }
    if (b.dataset.cal != null) { const n = Number(b.dataset.cal); calMonth = n ? new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1) : new Date(2026, 10, 1); calDay = null; render(); return; }
    if (b.dataset.day) { calDay = calDay === b.dataset.day ? null : b.dataset.day; render(); return; }
    if (b.matches('[data-day-clear]')) { calDay = null; render(); return; }
    if (b.dataset.bcell) { const [c, site, k] = b.dataset.bcell.split('|'); const same = boardCell && boardCell.c === c && boardCell.site === (site || null) && boardCell.k === k; boardCell = same ? null : { c, site: site || null, k }; render(); if (boardCell) $('.bdet')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (b.matches('[data-bclose]')) { boardCell = null; render(); return; }
    if (b.dataset.cg) { const c = b.dataset.cg; if (openCust.has(c)) openCust.delete(c); else openCust.add(c); render(); return; }
    if (b.matches('[data-expand]')) { openCust = openCust.size ? new Set() : new Set(Object.keys(CUSTS)); render(); return; }
    if (b.dataset.evview) { evView = evView === b.dataset.evview && b.classList.contains('kpi') ? 'all' : b.dataset.evview; render(); return; }
    if (b.dataset.item && !t.closest('input, button')) { openDrawer('item', Number(b.dataset.item)); return; }
    if (b.dataset.plan) { openDrawer('plan', Number(b.dataset.plan)); return; }
    if (b.dataset.event) { openDrawer('event', Number(b.dataset.event)); return; }
  });
  // ── Menu del tasto destro sulle righe delle Scadenze ──
  const ctxm = document.createElement('div'); ctxm.className = 'ctxm'; ctxm.setAttribute('role', 'menu'); ctxm.hidden = true; document.body.appendChild(ctxm);
  const openCtx = (id, x, y) => {
    const it = todo().find((i) => i.id === id); if (!it) return;
    const on = checked.has(id); const many = on && checked.size > 1;
    const item = (act, icon, label, extra = '') => `<button type="button" role="menuitem" data-ctx="${act}" class="${extra}">${ic(icon)}<span>${label}</span></button>`;
    ctxm.innerHTML = `<div class="ctxm-h">${esc(it.name)}<small>${CUSTS[it.cust].n}</small></div>
      ${item(on ? 'unselect' : 'select', 'check', on ? 'Togli dalla selezione' : (checked.size ? 'Aggiungi alla selezione' : 'Seleziona'))}
      ${checked.size ? '' : item('selectall', 'task', 'Seleziona tutte le visibili')}
      <hr>
      ${many ? item('rp-many', 'check', `Registra rapportino per le ${checked.size} selezionate`, 'strong') : item('rp', 'check', 'Registra rapportino')}
      ${many ? item('np-many', 'x', `Non prevista per le ${checked.size} selezionate`) : item('np', 'x', 'Non prevista')}
      <hr>
      ${item('open', 'eye', 'Apri')}
      ${item('plan', 'wrench', 'Apri il piano')}`;
    ctxm.dataset.id = id; ctxm.hidden = false;
    const r = ctxm.getBoundingClientRect();
    ctxm.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`; ctxm.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
    ctxm.querySelector('button')?.focus();
  };
  const closeCtx = () => { ctxm.hidden = true; };
  root.addEventListener('contextmenu', (e) => {
    const tr = e.target.closest('tr[data-item]'); if (!tr) return;
    e.preventDefault(); openCtx(Number(tr.dataset.item), e.clientX + 2, e.clientY - 4);
  });
  root.addEventListener('keydown', (e) => {
    if (!(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) return;
    const tr = e.target.closest('tr[data-item]'); if (!tr) return;
    e.preventDefault(); const r = tr.getBoundingClientRect(); openCtx(Number(tr.dataset.item), r.left + 40, r.bottom - 6);
  });
  ctxm.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ctx]'); if (!b) return;
    const id = Number(ctxm.dataset.id); const it = todo().find((i) => i.id === id); closeCtx();
    const a = b.dataset.ctx;
    if (a === 'select') checked.add(id);
    else if (a === 'unselect') checked.delete(id);
    else if (a === 'selectall') visible().forEach((r) => checked.add(r.id));
    else if (a === 'rp') return openRp([id]);
    else if (a === 'rp-many') return openRp([...checked]);
    else if (a === 'np') return markNP([id]);
    else if (a === 'np-many') return markNP([...checked]);
    else if (a === 'open') return openDrawer('item', id);
    else if (a === 'plan') return openDrawer('plan', it.plan.id);
    render();
  });
  ctxm.addEventListener('keydown', (e) => {
    const items = [...ctxm.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); closeCtx(); }
  });
  document.addEventListener('mousedown', (e) => { if (!ctxm.hidden && !e.target.closest('.ctxm')) closeCtx(); });
  addEventListener('scroll', closeCtx, true); addEventListener('resize', closeCtx);

  root.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; const r = e.target.closest('[data-item], [data-plan], [data-event]'); if (r && e.target === r) r.click(); });
  cpop.addEventListener('click', (e) => {
    const k = cpop.dataset.k; const v = cpop.querySelector('input:checked')?.value;
    if (e.target.closest('[data-cclear]')) { if (k === 'cust') custFilter = null; else planFilter = null; }
    else if (e.target.closest('[data-capply]')) { if (k === 'cust') custFilter = v || null; else planFilter = v ? Number(v) : null; }
    else return;
    cpop.hidden = true; render();
  });
  document.addEventListener('click', (e) => { if (!cpop.hidden && !e.target.closest('.cpop')) cpop.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!ctxm.hidden) closeCtx(); else if (!mdl.hidden) closeRp(); else if (!drawer.hidden) closeDrawer(); else if (checked.size && page === 'due') { checked = new Set(); render(); } });

  // Barra anteprima: variante Scadenze e variante Rapportino
  document.querySelectorAll('[data-mtv]').forEach((b) => b.addEventListener('click', () => { dueVar = b.dataset.mtv; page = 'due'; try { localStorage.setItem('archie-preview-mt-v', dueVar); } catch { /* niente */ } render(); }));
  const rpb = document.querySelectorAll('[data-rpv]');
  const setRpv = (v) => { rpVar = v; rpb.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rpv === v))); try { localStorage.setItem('archie-preview-mt-rp', v); } catch { /* niente */ } };
  rpb.forEach((b) => b.addEventListener('click', () => { setRpv(b.dataset.rpv); const ids = todo().slice().sort((a, b) => a.cust.localeCompare(b.cust) || a.site.localeCompare(b.site)).map((i) => i.id).slice(0, 5); openRp(ids); }));
  setRpv(rpVar);
  render();
  if (qs.get('rp')) { const ids = todo().filter((i) => i.cust === 'bo').map((i) => i.id).slice(0, Number(qs.get('rp')) || 1); openRp(ids); }
})();
