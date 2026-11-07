/* Audit (anteprima). Modello reale: AuditEvent (created_at, actor, action create|update|delete|restore|
   login|login_failed|logout|rate, content_type, object_id, object_repr, subject, changes {campo: {from,to}},
   metadata, path, method, ip_address, user_agent) + entity_path dal serializer. Dati finti sul modello di
   quelli in dev (ServiceNow importati dal sistema, assenze, rapportini, utenti). Oggi: 07/11/2026 19:10. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const NOW = new Date(2026, 10, 7, 19, 10);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daysAgo = (d) => Math.round((new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  const dayLabel = (d) => { const n = daysAgo(d); return n === 0 ? 'Oggi' : n === 1 ? 'Ieri' : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()); };
  const when = (d) => { const n = daysAgo(d); return n === 0 ? `oggi ${hm(d)}` : n === 1 ? `ieri ${hm(d)}` : `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${hm(d)}`; };
  const full = (d) => d.toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Audit');
    a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Persone e tipi ──────────────────────────────────────────────
  const PEOPLE = {
    fm: { n: 'Federico Mutuale', u: 'fede', ip: '172.26.216.40', ua: 'Edge su Windows' },
    ns: { n: 'Nicole Spazzoli', u: 'nichi', ip: '172.26.216.12', ua: 'Chrome su Windows' },
    ld: { n: 'Luca Della Zazzera', u: 'luca', ip: '172.26.216.31', ua: 'Firefox su Linux' },
    nn: { n: 'Niccolò Nanni', u: 'nix', ip: '10.8.0.14', ua: 'Safari su iPhone' },
    lr: { n: 'Leonardo Romano', u: 'leo', ip: '172.26.216.22', ua: 'Chrome su macOS' },
    sys: { n: 'Sistema', u: null, ip: null, ua: 'Sincronizzazione ServiceNow' },
  };
  const TYPES = {
    issue: ['Issue', 'alert'], customer: ['Clienti', 'building'], site: ['Siti', 'pin'], contact: ['Contatti', 'users'], inventory: ['Inventari', 'server'],
    contract: ['Contratti', 'file'], mevent: ['Rapportini', 'wrench'], mplan: ['Piani di manutenzione', 'wrench'], absence: ['Piano ferie', 'calendar'],
    snow: ['Casi ServiceNow', 'cloud'], expense: ['Note spese', 'receipt'], wiki: ['Pagine wiki', 'book'], drive: ['File drive', 'folder'], user: ['Utenti', 'user'], auth: ['Accessi', 'key'],
  };
  // [un/una …, plurale, apri il/la …]
  const NOUN = { issue: ['una issue', 'issue', 'la issue'], customer: ['un cliente', 'clienti', 'il cliente'], site: ['un sito', 'siti', 'il sito'], contact: ['un contatto', 'contatti', 'il contatto'], inventory: ['un inventario', 'inventari', "l'inventario"],
    contract: ['un contratto', 'contratti', 'il contratto'], mevent: ['un rapportino', 'rapportini', 'il rapportino'], mplan: ['un piano', 'piani', 'il piano'], absence: ["un'assenza", 'assenze', "l'assenza"], snow: ['un caso ServiceNow', 'casi ServiceNow', 'il caso'],
    expense: ['una nota spese', 'note spese', 'la nota spese'], wiki: ['una pagina wiki', 'pagine wiki', 'la pagina'], drive: ['un file', 'file', 'il file'], user: ['un utente', 'utenti', "l'utente"], auth: ['', '', ''] };
  const LABELS = { status: 'Stato', priority: 'Priorità', assignee: 'Assegnata a', title: 'Titolo', notice_days: 'Preavviso (giorni)', billing_freq: 'Fatturazione', amount: 'Importo', end_date: 'Fine', result: 'Esito', pdf_file: 'PDF', notes: 'Note', date_from: 'Dal', date_to: 'Al', reason: 'Motivo', vpn_password: 'Password VPN', hostname: 'Hostname', ip: 'IP', email: 'Email', phone: 'Telefono', is_active: 'Attivo', groups: 'Gruppi', name: 'Nome', site: 'Sito', due_date_override: 'Scadenza modificata', description: 'Descrizione' };

  // [minuti fa, chi, azione, tipo, id, oggetto, cambi|null, extra]
  let seq = 5200; const E = [];
  const add = (min, who, action, type, oid, repr, changes = null, extra = {}) => { const d = new Date(NOW.getTime() - min * 60000); E.push({ id: ++seq, d, who, action, type, oid, repr, changes, ...extra }); };
  // Oggi
  add(4, 'fm', 'update', 'issue', 1041, '#1041 Worklist vuota sulla modalità CT 2', { status: ['In lavorazione', 'Risolta'], notes: ['', 'Riavviato il servizio MWL sul PACS secondario.'] });
  add(6, 'fm', 'update', 'issue', 1041, '#1041 Worklist vuota sulla modalità CT 2', { assignee: ['Nicole Spazzoli', 'Federico Mutuale'] });
  add(18, 'ns', 'create', 'mevent', 312, 'PM Server PACS · PACS primario · 7 nov', { result: [null, 'OK'], pdf_file: [null, 'rapportino-pacs-0711.pdf'] });
  add(19, 'ns', 'create', 'mevent', 313, 'PM Server PACS · PACS secondario · 7 nov', { result: [null, 'Parziale'], notes: [null, 'Aggiornamento firmware rimandato'] });
  add(22, 'sys', 'create', 'snow', 'CS0098812', 'CS0098812 · Stampante referti non risponde');
  add(23, 'sys', 'create', 'snow', 'CS0098813', 'CS0098813 · Lentezza visualizzatore');
  add(23, 'sys', 'create', 'snow', 'CS0098814', 'CS0098814 · Esame non in worklist');
  add(41, 'xx', 'login_failed', 'auth', null, 'Accesso non riuscito per «root»', null, { uname: 'root', ip: '172.26.216.7' });
  add(42, 'xx', 'login_failed', 'auth', null, 'Accesso non riuscito per «root»', null, { uname: 'root', ip: '172.26.216.7' });
  add(44, 'xx', 'login_failed', 'auth', null, 'Accesso non riuscito per «root»', null, { uname: 'root', ip: '172.26.216.7' });
  add(55, 'lr', 'login', 'auth', null, 'Accesso di Leonardo Romano');
  add(57, 'lr', 'update', 'contract', 21, 'CT-2026-021 · Assistenza RIS-PACS AUSL Imola', { notice_days: [90, 120], billing_freq: ['Trimestrale', 'Mensile'] });
  add(70, 'ld', 'delete', 'contact', 88, 'Marco Bellini · AUSL Romagna');
  add(96, 'nn', 'update', 'inventory', 30011, 'PACS secondario · IM-SCA-PACS02', { hostname: ['IM-SCA-PACS2', 'IM-SCA-PACS02'], ip: ['10.20.1.12', '10.20.1.22'] });
  add(120, 'fm', 'update', 'customer', 12, 'AUSL Imola', { vpn_password: ['••••••', '••••••'] });
  add(150, 'ns', 'create', 'absence', 410, 'Ferie · Nicole Spazzoli · 22–24 dic', { date_from: [null, '22/12/2026'], date_to: [null, '24/12/2026'], reason: [null, 'Ferie'] });
  add(185, 'fm', 'login', 'auth', null, 'Accesso di Federico Mutuale');
  add(250, 'sys', 'update', 'snow', 'CS0098700', 'CS0098700 · Errore invio referti', { status: ['Aperto', 'Chiuso'] });
  add(255, 'sys', 'update', 'snow', 'CS0098701', 'CS0098701 · Utente bloccato', { status: ['Aperto', 'Chiuso'] });
  // Ieri
  add(60 * 24 + 30, 'ld', 'logout', 'auth', null, 'Uscita di Luca Della Zazzera');
  add(60 * 24 + 45, 'ld', 'restore', 'site', 14, 'Poliambulatorio di Cesena');
  add(60 * 24 + 90, 'fm', 'create', 'contract', 22, 'CT-2026-022 · Manutenzione storage Casa di Cura Rocca', { amount: [null, '18.000,00 €'], end_date: [null, '31/12/2027'], status: [null, 'Bozza'] });
  add(60 * 24 + 92, 'fm', 'update', 'contract', 22, 'CT-2026-022 · Manutenzione storage Casa di Cura Rocca', { pdf_file: [null, 'contratto-rocca-2026.pdf'] });
  add(60 * 24 + 180, 'ns', 'update', 'mplan', 12, 'PM Server PACS · AUSL Imola', { due_date_override: [null, '14/11/2026'] });
  add(60 * 24 + 240, 'nn', 'create', 'issue', 1048, '#1048 Monitor diagnostico Sala 3 sfarfalla', { priority: [null, 'Alta'], status: [null, 'Aperta'] });
  add(60 * 24 + 300, 'xx', 'login_failed', 'auth', null, 'Accesso non riuscito per «fede»', null, { uname: 'fede', ip: '172.26.216.40' });
  add(60 * 24 + 301, 'fm', 'login', 'auth', null, 'Accesso di Federico Mutuale');
  add(60 * 24 + 360, 'lr', 'create', 'expense', 20, 'Nota spese ottobre 2026 · Leonardo Romano');
  add(60 * 24 + 420, 'fm', 'update', 'user', 5, 'Nicole Spazzoli (nichi)', { groups: ['Tecnici', 'Tecnici, Coordinatori'] });
  // Giorni precedenti
  const extra = [
    ['ns', 'update', 'issue', 1033, '#1033 Referti non firmati digitalmente', { status: ['Aperta', 'In lavorazione'] }],
    ['ld', 'create', 'wiki', 77, 'Procedura riavvio MWL Siemens', { title: [null, 'Procedura riavvio MWL Siemens'] }],
    ['fm', 'delete', 'drive', 340, 'vecchio-listino-2024.pdf', null],
    ['nn', 'update', 'site', 9, 'Ospedale di Ravenna', { phone: ['0544 285111', '0544 285112'] }],
    ['lr', 'create', 'absence', 402, 'Permesso · Leonardo Romano · 12 nov', { date_from: [null, '12/11/2026'], reason: [null, 'Permesso'] }],
    ['fm', 'delete', 'issue', 1012, '#1012 Duplicata di #1011', null],
    ['ns', 'update', 'mevent', 300, 'PM Workstation refertazione · WS senologia', { result: ['OK', 'Parziale'], notes: ['', 'Calibrazione da ripetere'] }],
    ['sys', 'create', 'snow', 'CS0098600', 'CS0098600 · Richiesta nuova utenza RIS', null],
    ['ld', 'update', 'inventory', 20212, 'TC Canon Aquilion · BO-BEL-CT01', { site: ['Ospedale Maggiore', 'Bellaria'] }],
    ['fm', 'update', 'customer', 3, 'Istituto Ortopedico Rizzoli', { email: ['it@rizzoli.it', 'sistemi@ior.it'] }],
    ['nn', 'delete', 'contact', 71, 'Paola Neri · ASUFC Udine', null],
    ['ns', 'create', 'expense', 19, 'Nota spese ottobre 2026 · Nicole Spazzoli', null],
  ];
  extra.forEach((x, i) => add(60 * 24 * (2 + Math.floor(i / 2)) + 60 * (2 + (i % 5)), ...x));
  for (let k = 0; k < 9; k++) add(60 * 24 * (2 + k) + 30, ['fm', 'ns', 'ld', 'nn', 'lr'][k % 5], 'login', 'auth', null, `Accesso di ${PEOPLE[['fm', 'ns', 'ld', 'nn', 'lr'][k % 5]].n}`);
  for (let k = 0; k < 14; k++) add(60 * 24 * (1 + (k % 9)) + 400 + k, 'sys', 'create', 'snow', `CS00985${pad(k)}`, `CS00985${pad(k)} · Caso importato da ServiceNow`);
  add(60 * 24 * 4 + 10, 'xx', 'login_failed', 'auth', null, 'Accesso non riuscito per «admin»', null, { uname: 'admin', ip: '185.220.101.4' });
  add(60 * 24 * 4 + 11, 'xx', 'login_failed', 'auth', null, 'Accesso non riuscito per «admin»', null, { uname: 'admin', ip: '185.220.101.4' });
  E.sort((a, b) => b.d - a.d);
  // Storico per oggetto (eventi più vecchi dello stesso oggetto)
  add(60 * 24 * 12, 'nn', 'create', 'issue', 1041, '#1041 Worklist vuota sulla modalità CT 2', { status: [null, 'Aperta'], priority: [null, 'Alta'], assignee: [null, 'Nicole Spazzoli'] });
  add(60 * 24 * 11, 'ns', 'update', 'issue', 1041, '#1041 Worklist vuota sulla modalità CT 2', { status: ['Aperta', 'In lavorazione'] });
  add(60 * 24 * 40, 'fm', 'create', 'contract', 21, 'CT-2026-021 · Assistenza RIS-PACS AUSL Imola', { notice_days: [null, 90] });
  E.sort((a, b) => b.d - a.d);

  const KIND = { create: ['Creato', 'ok', 'plus'], update: ['Modificato', 'info', 'wrench'], delete: ['Eliminato', 'ko', 'trash'], restore: ['Ripristinato', 'ok', 'restore'], login: ['Accesso', 'np', 'key'], logout: ['Uscita', 'np', 'key'], login_failed: ['Accesso fallito', 'ko', 'lock'], rate: ['Valutato', 'np', 'check'] };
  const VERB = { create: 'ha creato', update: 'ha modificato', delete: 'ha eliminato', restore: 'ha ripristinato', login: 'è entrato', logout: 'è uscito', login_failed: 'accesso non riuscito', rate: 'ha valutato' };
  const actBadge = (a) => `<span class="aact ${KIND[a][1]}">${KIND[a][0]}</span>`;
  const who = (e) => (e.who === 'xx' ? { n: e.uname ? `«${e.uname}»` : 'Sconosciuto', u: e.uname, ip: e.ip, ua: 'Chrome su Windows', anon: true } : PEOPLE[e.who]);
  const av = (e, sm) => { const p = who(e); const ini = e.who === 'sys' ? '⟳' : e.who === 'xx' ? '?' : p.n.split(' ').map((x) => x[0]).join('').slice(0, 2); return `<span class="aav${sm ? ' sm' : ''}${e.who === 'sys' ? ' sys' : e.who === 'xx' ? ' anon' : ''}" aria-hidden="true">${ini}</span>`; };
  const fmtVal = (v) => (v == null || v === '' ? '<span class="none">vuoto</span>' : esc(v));
  const changeLine = (e) => { if (!e.changes) return ''; const ks = Object.keys(e.changes); const k = ks[0]; const [a, b] = e.changes[k]; const lab = LABELS[k] || k; const secret = /password/.test(k); return `<span class="chg"><b>${lab}</b>${secret ? ' <span class="none">cambiata</span>' : e.action === 'create' ? ` ${fmtVal(b)}` : ` ${fmtVal(a)} <span class="arr">→</span> ${fmtVal(b)}`}${ks.length > 1 ? ` <span class="more">+${ks.length - 1}</span>` : ''}</span>`; };

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  let variant = qs.get('variante') || (() => { try { return localStorage.getItem('archie-preview-au-v') || 'a'; } catch { return 'a'; } })();
  let view = 'all'; let period = '7'; let F = { who: null, type: null, action: null, obj: null }; let sel = null; let dtab = 'det'; let pop = null; let page = 1;
  const root = $('[data-au]');
  const VIEWS = [['all', 'Tutto', () => true], ['changes', 'Modifiche', (e) => ['create', 'update', 'delete', 'restore'].includes(e.action)], ['delete', 'Eliminazioni', (e) => e.action === 'delete'], ['access', 'Accessi', (e) => ['login', 'logout', 'login_failed'].includes(e.action)], ['failed', 'Accessi falliti', (e) => e.action === 'login_failed']];
  const inPeriod = (e) => period === 'all' || (period === '0' ? daysAgo(e.d) === 0 : daysAgo(e.d) < Number(period));
  const filtered = (v = view) => E.filter(inPeriod).filter(VIEWS.find((x) => x[0] === v)[2]).filter((e) => (!F.who || e.who === F.who) && (!F.type || e.type === F.type) && (!F.action || e.action === F.action) && (!F.obj || `${e.type}:${e.oid}` === F.obj));

  // ── Indicatori ──────────────────────────────────────────────────
  const spark = () => { const v = Array.from({ length: 14 }, (_, i) => E.filter((e) => daysAgo(e.d) === 13 - i).length); const mx = Math.max(...v, 1); const W = 84, H = 30; const pts = v.map((x, i) => `${(i / 13) * W},${H - 2 - (x / mx) * (H - 4)}`); return `<svg class="aspark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M0,${H} L${pts.join(' L')} L${W},${H}Z" class="ar"/><path d="M${pts.join(' L')}" class="ln"/></svg>`; };
  const kpis = () => {
    const today = E.filter((e) => daysAgo(e.d) === 0); const ch = today.filter((e) => ['create', 'update', 'delete', 'restore'].includes(e.action)).length;
    const fail = E.filter((e) => e.action === 'login_failed' && daysAgo(e.d) <= 1); const byKey = {}; fail.forEach((e) => { const k = `${e.uname}|${e.ip}`; byKey[k] = (byKey[k] || 0) + 1; }); const top = Object.entries(byKey).sort((a, b) => b[1] - a[1])[0];
    const del = E.filter((e) => e.action === 'delete' && daysAgo(e.d) < 7);
    const people = {}; E.filter((e) => daysAgo(e.d) < 7 && ['create', 'update', 'delete', 'restore'].includes(e.action) && e.who !== 'sys').forEach((e) => { people[e.who] = (people[e.who] || 0) + 1; });
    const tp = Object.entries(people).sort((a, b) => b[1] - a[1]); const mx = tp[0]?.[1] || 1;
    const sysN = E.filter((e) => e.who === 'sys' && daysAgo(e.d) < 7).length;
    return `<div class="kpi-wrap"><div class="kpis au-kpis" role="group" aria-label="Indicatori">
      <div class="kpi"><span class="kpi-h">Eventi oggi</span><span class="kpi-v">${today.length}</span>${spark()}<span class="kpi-s"><b>${ch}</b> modifiche · <b>${today.length - ch}</b> accessi e sistema</span></div>
      <button type="button" class="kpi${view === 'failed' ? ' is-on' : ''}${fail.length ? ' kpi-alert' : ''}" data-goview="failed"><span class="kpi-h">Accessi falliti · 24 ore<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${fail.length}${fail.length >= 3 ? '<span class="kpi-flag err">da guardare</span>' : ''}</span><span class="kpi-s">${top ? `<b>${top[1]}</b> per «${top[0].split('|')[0]}» da ${top[0].split('|')[1]}` : 'Nessun tentativo fallito'}</span></button>
      <button type="button" class="kpi${view === 'delete' ? ' is-on' : ''}" data-goview="delete"><span class="kpi-h">Eliminazioni · 7 giorni<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${del.length}</span><span class="kpi-s">si ripristinano dal <b>Cestino</b></span></button>
      <div class="kpi"><span class="kpi-h">Chi ha modificato di più · 7 giorni</span><div class="atop">${tp.slice(0, 3).map(([k, n]) => `<button type="button" data-who="${k}"><span>${PEOPLE[k].n}</span><i><i style="width:${(n / mx) * 100}%"></i></i><b>${n}</b></button>`).join('')}</div><span class="kpi-s">più <b>${sysN}</b> eventi del sistema</span></div>
    </div></div>`;
  };

  // ── Barra filtri ────────────────────────────────────────────────
  const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
  const PERIODS = [['0', 'Oggi'], ['7', '7 giorni'], ['30', '30 giorni'], ['all', 'Sempre']];
  const tokens = () => {
    const t = [F.who ? ['who', 'Utente', who({ who: F.who }).n] : null, F.type ? ['type', 'Tipo', TYPES[F.type][0]] : null, F.action ? ['action', 'Azione', KIND[F.action][0]] : null, F.obj ? ['obj', 'Oggetto', E.find((e) => `${e.type}:${e.oid}` === F.obj).repr] : null].filter(Boolean);
    return t.length ? t.map(([k, l, v]) => `<span class="token"><span class="tk">${l}</span> <b>${esc(v)}</b><button type="button" class="tk-x" data-unf="${k}" aria-label="Rimuovi filtro">${ic('x')}</button></span>`).join('') + '<button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button>' : '<span class="none" style="font-size:12px">Nessun filtro. Usa l\'imbuto accanto al nome di una colonna.</span>';
  };
  const bar = () => `<div class="vtabs" role="group" aria-label="Viste">${VIEWS.map(([k, l]) => `<button type="button" aria-pressed="${k === view}" data-view="${k}"${k === 'failed' ? ' class="v-alert"' : ''}>${l} <span>${filtered(k).length}</span></button>`).join('')}</div>
    <div class="toolbar tb-row"><div class="tokens">${tokens()}</div><span class="spacer"></span>
      <div class="aper" role="group" aria-label="Periodo">${PERIODS.map(([k, l]) => `<button type="button" aria-pressed="${period === k}" data-period="${k}">${l}</button>`).join('')}</div>
      <button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button><button class="icon-btn" type="button" aria-label="Esporta">${ic('download')}</button></div>`;
  const th = (k, l) => `<div class="th-in">${l}<button type="button" class="th-filter${F[k] ? ' is-on' : ''}" data-filter="${k}" aria-label="Filtra ${l}">${funnel}</button></div>`;
  const popHtml = () => {
    if (!pop) return '';
    const base = E.filter(inPeriod).filter(VIEWS.find((x) => x[0] === view)[2]);
    const opts = pop === 'who' ? Object.keys(PEOPLE).map((k) => [k, PEOPLE[k].n, base.filter((e) => e.who === k).length]).concat([['xx', 'Non riconosciuto', base.filter((e) => e.who === 'xx').length]])
      : pop === 'type' ? Object.keys(TYPES).map((k) => [k, TYPES[k][0], base.filter((e) => e.type === k).length]) : Object.keys(KIND).map((k) => [k, KIND[k][0], base.filter((e) => e.action === k).length]);
    return `<div class="apop" role="dialog" aria-label="Filtra">${opts.filter((o) => o[2]).sort((a, b) => b[2] - a[2]).map(([k, l, n]) => `<button type="button" data-pick="${pop}:${k}" aria-pressed="${F[pop] === k}"><span>${l}</span><b>${n}</b></button>`).join('')}</div>`;
  };

  // ── A · Registro ────────────────────────────────────────────────
  const PER_PAGE = 25;
  const listA = () => {
    const rows = filtered(); const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE)); page = Math.min(page, pages); const vis = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    return `<section class="panel" aria-label="Registro">${bar()}
      <div class="table-wrap"><table class="po-table au-table"><thead><tr>
        <th class="c-when">Quando</th><th class="c-who">${th('who', 'Utente')}</th><th class="c-act">${th('action', 'Azione')}</th><th>${th('type', 'Oggetto')}</th><th class="c-chg">Cosa è cambiato</th></tr></thead>
        <tbody>${vis.map((e) => `<tr data-ev="${e.id}" tabindex="0" class="${sel === e.id ? 'is-selected' : ''}${e.action === 'login_failed' ? ' fail' : ''}">
          <td class="c-when"><span class="w2"><b>${hm(e.d)}</b><small>${daysAgo(e.d) === 0 ? 'oggi' : daysAgo(e.d) === 1 ? 'ieri' : e.d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</small></span></td>
          <td class="c-who"><span class="whoin">${av(e, true)}<span>${esc(who(e).n)}</span></span></td>
          <td class="c-act">${actBadge(e.action)}</td>
          <td class="c-obj"><span class="ob">${ic(TYPES[e.type][1])}<span><b>${esc(e.repr)}</b><small>${TYPES[e.type][0]}${e.ip && e.action === 'login_failed' ? ` · da ${e.ip}` : ''}</small></span></span></td>
          <td class="c-chg">${changeLine(e) || '<span class="none">—</span>'}</td></tr>`).join('') || '<tr><td colspan="5" style="height:110px;text-align:center;color:var(--muted)">Nessun evento con questi filtri.</td></tr>'}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> eventi</span><span class="sp"></span><span class="pager"><button class="icon-btn" type="button" data-page="-1" ${page <= 1 ? 'disabled' : ''} aria-label="Pagina precedente">${ic('chevL')}</button><span>${page} di ${pages}</span><button class="icon-btn" type="button" data-page="1" ${page >= pages ? 'disabled' : ''} aria-label="Pagina successiva">${ic('chevR')}</button></span></div></section>`;
  };

  // ── B · Cronologia ──────────────────────────────────────────────
  const listB = () => {
    const rows = filtered(); const groups = []; // giorno → blocchi (stessa persona + stesso tipo di oggetto entro 15 minuti)
    rows.forEach((e) => {
      const dk = dayKey(e.d); let g = groups[groups.length - 1]; if (!g || g.k !== dk) { g = { k: dk, d: e.d, blocks: [] }; groups.push(g); }
      const b = g.blocks[g.blocks.length - 1];
      if (b && b.who === e.who && b.type === e.type && b.action === e.action && (b.last - e.d) < 15 * 60000 && e.action !== 'update') { b.items.push(e); b.last = e.d; } else g.blocks.push({ who: e.who, type: e.type, action: e.action, items: [e], last: e.d });
    });
    return `<section class="panel" aria-label="Cronologia">${bar()}<div class="acr">${groups.map((g) => `<div class="acr-day"><h3><span>${dayLabel(g.d)}</span><small>${g.blocks.reduce((s, b) => s + b.items.length, 0)} eventi</small></h3><ol>${g.blocks.map((b) => { const e = b.items[0]; const many = b.items.length > 1; return `<li class="acr-it ${KIND[e.action][1]}${b.items.some((x) => x.id === sel) ? ' is-selected' : ''}">
        <span class="acr-dot">${ic(KIND[e.action][2])}</span>
        <div class="acr-b"><div class="acr-h">${av(e, true)}<span class="tx"><b>${esc(who(e).n)}</b> ${e.action === 'login_failed' ? `<span class="err">${many ? `${b.items.length} accessi non riusciti` : 'accesso non riuscito'}</span>${e.ip ? ` da ${e.ip}` : ''}` : `${VERB[e.action]}${['login', 'logout'].includes(e.action) ? '' : many ? ` <b>${b.items.length} ${NOUN[e.type][1]}</b>` : ` ${NOUN[e.type][0]}`}`}</span><time>${many ? `${hm(b.last)}–${hm(e.d)}` : hm(e.d)}</time></div>
          ${['login', 'logout', 'login_failed'].includes(e.action) && !many ? '' : `<div class="acr-objs">${b.items.slice(0, 4).map((x) => `<button type="button" data-ev="${x.id}" class="acr-o${sel === x.id ? ' on' : ''}"><span class="t">${esc(x.repr)}</span>${x.changes ? `<span class="acr-c">${Object.entries(x.changes).slice(0, 2).map(([k, [a, bb]]) => `<span><b>${LABELS[k] || k}</b> ${/password/.test(k) ? '<span class="none">cambiata</span>' : x.action === 'create' ? fmtVal(bb) : `${fmtVal(a)} <span class="arr">→</span> ${fmtVal(bb)}`}</span>`).join('')}${Object.keys(x.changes).length > 2 ? `<span class="more">+${Object.keys(x.changes).length - 2} campi</span>` : ''}</span>` : ''}</button>`).join('')}${b.items.length > 4 ? `<span class="acr-more">e altri ${b.items.length - 4}</span>` : ''}</div>`}
        </div></li>`; }).join('')}</ol></div>`).join('') || '<p class="none" style="padding:40px;text-align:center">Nessun evento con questi filtri.</p>'}</div></section>`;
  };

  const head = () => `<div class="mt-head"><h1>Audit</h1><span class="au-meta">registro di modifiche e accessi · si conserva per 365 giorni</span><div class="actions"><button class="btn" type="button">${ic('download')}Esporta CSV</button></div></div>`;
  const render = () => { root.innerHTML = head() + kpis() + (variant === 'b' ? listB() : listA()) + (pop ? '' : ''); if (pop) { const t = root.querySelector(`[data-filter="${pop}"]`); if (t) { const r = t.getBoundingClientRect(); const c = root.getBoundingClientRect(); root.insertAdjacentHTML('beforeend', popHtml()); const p = root.querySelector('.apop'); p.style.left = `${r.left - c.left - 8}px`; p.style.top = `${r.bottom - c.top + 6}px`; } } };

  // ── Pannello ────────────────────────────────────────────────────
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell');
  const objHistory = (e) => (e.oid == null ? [] : E.filter((x) => x.type === e.type && x.oid === e.oid));
  const diff = (e) => {
    if (!e.changes) return '';
    const rows = Object.entries(e.changes).map(([k, [a, b]]) => { const secret = /password/.test(k); return `<tr><th scope="row">${LABELS[k] || k}</th>${e.action === 'create' ? '' : `<td class="was">${secret ? '<span class="mask">nascosto</span>' : fmtVal(a)}</td>`}<td class="now">${secret ? '<span class="mask">nascosto</span>' : fmtVal(b)}</td></tr>`; }).join('');
    return `<section class="ct-sec"><div class="h"><h4>${e.action === 'create' ? 'Valori iniziali' : 'Cosa è cambiato'}</h4><span class="none" style="font-size:12px">${Object.keys(e.changes).length} ${Object.keys(e.changes).length === 1 ? 'campo' : 'campi'}</span></div>
      <table class="adiff"><thead><tr><th>Campo</th>${e.action === 'create' ? '' : '<th>Prima</th>'}<th>${e.action === 'create' ? 'Valore' : 'Dopo'}</th></tr></thead><tbody>${rows}</tbody></table>
      ${Object.keys(e.changes).some((k) => /password/.test(k)) ? '<p class="note-p" style="margin-top:6px">Le password non vengono mai scritte nel registro: risulta solo che sono cambiate.</p>' : ''}</section>`;
  };
  const renderDrawer = () => {
    const e = E.find((x) => x.id === sel); if (!e) return; const p = who(e); const hist = objHistory(e);
    const failSame = e.action === 'login_failed' ? E.filter((x) => x.action === 'login_failed' && x.ip === e.ip && Math.abs(x.d - e.d) < 864e5) : [];
    $('[data-md="id"]').textContent = `Evento #${e.id}`; $('[data-md="st"]').innerHTML = actBadge(e.action); $('[data-md="title"]').textContent = e.repr; $('[data-md="sub"]').textContent = `${TYPES[e.type][0]} · ${when(e.d)}`;
    const tabs = [['det', 'Dettagli']].concat(hist.length > 1 ? [['his', `Storico dell'oggetto <span class="tn">${hist.length}</span>`]] : []); if (!tabs.find((t) => t[0] === dtab)) dtab = 'det';
    $('[data-mtabs]').innerHTML = tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${dtab === k}">${l}</button>`).join('');
    const body = dtab === 'his' ? `<div class="feed">${hist.map((x) => `<button type="button" class="ev hev${x.id === e.id ? ' on' : ''}" data-ev="${x.id}">${ic(KIND[x.action][2])}<span><b>${esc(who(x).n)}</b> ${KIND[x.action][0].toLowerCase()}${x.changes && x.action === 'update' ? ` · ${Object.keys(x.changes).map((k) => LABELS[k] || k).join(', ')}` : ''}</span><time>${when(x.d)}</time></button>`).join('')}</div>`
      : `${e.action === 'delete' ? `<section class="ct-sec"><div class="callout warn"><div><b>Eliminato ${when(e.d)}</b><span>È nel Cestino: da lì si può ripristinare finché non viene svuotato.</span></div></div></section>` : ''}
        ${e.action === 'login_failed' ? `<section class="ct-sec"><div class="callout err"><div><b>${failSame.length} ${failSame.length === 1 ? 'tentativo fallito' : 'tentativi falliti'} da ${e.ip} in 24 ore</b><span>Nome utente usato: «${esc(e.uname)}». ${/^(10|172|192)\./.test(e.ip) ? 'Indirizzo della rete interna.' : 'Indirizzo esterno alla rete aziendale.'}</span></div></div></section>` : ''}
        ${diff(e)}
        <section class="ct-sec"><div class="h"><h4>Chi e da dove</h4></div><div class="awho">${av(e)}<div><b>${esc(p.n)}</b><small>${p.u ? `@${p.u}` : e.who === 'sys' ? 'operazione automatica' : 'utente non riconosciuto'}</small></div></div>
          <dl class="sum-k" style="font-size:13px;margin-top:10px"><dt>Quando</dt><dd>${full(e.d)}</dd>${e.who !== 'sys' ? `<dt>Indirizzo IP</dt><dd class="code">${e.ip || p.ip || '—'}</dd><dt>Browser</dt><dd>${p.ua}</dd>` : `<dt>Origine</dt><dd>${p.ua}</dd>`}</dl>
          <details class="tech"><summary>Dettagli tecnici</summary><dl class="sum-k"><dt>Richiesta</dt><dd class="code">${e.action === 'create' ? 'POST' : e.action === 'delete' ? 'DELETE' : e.action === 'update' ? 'PATCH' : 'POST'} /api/${e.type === 'auth' ? 'auth/login' : `${e.type}s/${e.oid ?? ''}`}</dd><dt>ID oggetto</dt><dd class="code">${e.oid ?? '—'}</dd><dt>Evento</dt><dd class="code">${e.id}</dd></dl></details></section>`;
    const canOpen = e.oid != null && e.action !== 'delete';
    $('[data-mbody]').innerHTML = `<div class="drawer-body int-body">${body}</div><div class="drawer-foot">${e.oid != null ? `<button class="btn" type="button" data-objf="${e.type}:${e.oid}">${ic('filter')}Solo questo oggetto</button>` : e.action === 'login_failed' ? `<button class="btn" type="button" data-actf="login_failed">${ic('filter')}Tutti gli accessi falliti</button>` : ''}<span class="g-spacer"></span>${e.action === 'delete' ? `<button class="btn btn-primary" type="button">${ic('restore')}Apri il Cestino</button>` : canOpen ? `<button class="btn btn-primary" type="button">${ic('arrowR')}Apri ${NOUN[e.type][2]}</button>` : ''}</div>`;
  };
  const openD = (id) => { sel = id; dtab = 'det'; drawer.hidden = false; shell.classList.add('has-drawer'); render(); renderDrawer(); };
  const closeD = () => { sel = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  $('[data-mclose-d]').addEventListener('click', closeD);
  $('[data-mtabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { dtab = b.dataset.tab; renderDrawer(); } });
  $('[data-mbody]').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ev) { sel = Number(b.dataset.ev); render(); renderDrawer(); }
    if (b.dataset.objf) { F = { who: null, type: null, action: null, obj: b.dataset.objf }; view = 'all'; period = 'all'; page = 1; render(); }
    if (b.dataset.actf) { F = { who: null, type: null, action: null, obj: null }; view = 'failed'; period = '30'; page = 1; render(); }
  });

  // ── Eventi ──────────────────────────────────────────────────────
  root.addEventListener('click', (ev) => {
    const t = ev.target;
    const pick = t.closest('[data-pick]'); if (pick) { const [k, v] = pick.dataset.pick.split(':'); F[k] = F[k] === v ? null : v; pop = null; page = 1; return render(); }
    const f = t.closest('[data-filter]'); if (f) { ev.stopPropagation(); pop = pop === f.dataset.filter ? null : f.dataset.filter; return render(); }
    if (pop && !t.closest('.apop')) { pop = null; render(); }
    const b = t.closest('[data-ev], [data-view], [data-goview], [data-period], [data-unf], [data-who], [data-page]'); if (!b) return;
    if (b.dataset.ev) return openD(Number(b.dataset.ev));
    if (b.dataset.view) { view = b.dataset.view; page = 1; return render(); }
    if (b.dataset.goview) { view = view === b.dataset.goview ? 'all' : b.dataset.goview; if (view === 'failed' && period === '0') period = '7'; page = 1; return render(); }
    if (b.dataset.period) { period = b.dataset.period; page = 1; return render(); }
    if (b.dataset.unf) { if (b.dataset.unf === '*') F = { who: null, type: null, action: null, obj: null }; else F[b.dataset.unf] = null; page = 1; return render(); }
    if (b.dataset.who) { F.who = b.dataset.who; view = 'changes'; page = 1; return render(); }
    if (b.dataset.page) { page += Number(b.dataset.page); return render(); }
  });
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('tr[data-ev]')) openD(Number(ev.target.dataset.ev)); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { if (pop) { pop = null; render(); } else if (sel) closeD(); } });

  const vb = document.querySelectorAll('[data-auv]');
  const setV = (v) => { variant = v; vb.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.auv === v))); try { localStorage.setItem('archie-preview-au-v', v); } catch { /* niente */ } render(); };
  vb.forEach((b) => b.addEventListener('click', () => setV(b.dataset.auv)));
  setV(variant);
})();
