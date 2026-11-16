/* Dashboard (anteprima, terza proposta): a widget, d'impatto, con tinte tenui.
   Catalogo reale `DashboardWidget` (griglia 6 colonne, layout per utente): weather, quick-actions-pair,
   issues, area-tasks, maintenance, announcements, todo, sticky-note, birthdays, contributor
   (+ "team" = chi è assente oggi, nuovo, dal Piano ferie). Tre varianti di stile sugli stessi widget:
   A · Tinte, B · Bento, C · Fascia pastello. Dati finti realistici. Oggi: sabato 07/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const WX = '<svg class="wx" viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="22" r="10" class="sun"/><g class="rays" stroke-linecap="round"><path d="M24 6v4M24 34v4M8 22h4M36 22h4M12.7 10.7l2.8 2.8M32.5 30.5l2.8 2.8M12.7 33.3l2.8-2.8M32.5 13.5l2.8-2.8"/></g><path class="cl" d="M48 50H22a10 10 0 1 1 3.4-19.4A12 12 0 0 1 48 34a8 8 0 0 1 0 16z"/></svg>';
  const MEDAL = '<svg class="medal" viewBox="0 0 40 48" aria-hidden="true"><path d="M12 2h7l-4 14h-7zM28 2h-7l4 14h7z" class="rib"/><circle cx="20" cy="30" r="14" class="disc"/><path d="M20 21.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" class="star"/></svg>';

  const TROPHY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4.6 5A5.5 5.5 0 0 1 13 15.9V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.1A5.5 5.5 0 0 1 7.6 13 5 5 0 0 1 3 8V6a1 1 0 0 1 1-1h3V3zm0 4H5v1a3 3 0 0 0 2 2.8V7zm10 0v3.8A3 3 0 0 0 19 8V7h-2z"/></svg>';
  const CAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.9 1.2 1.4 2.1 1.4 2.8a1.4 1.4 0 0 1-2.8 0c0-.7.5-1.6 1.4-2.8zM11 7h2v3h5a2 2 0 0 1 2 2v2.2c-.8.5-1.6.5-2.4 0a2.6 2.6 0 0 0-3 0c-.8.5-1.6.5-2.4 0a2.6 2.6 0 0 0-2.4 0c-.8.5-1.6.5-2.4 0-.6-.4-1.6-.5-2.4 0V12a2 2 0 0 1 2-2h4V7zM4 16.4c1 .4 2 .3 2.9-.2.4-.2.8-.2 1.2 0 1.2.7 2.6.7 3.8 0 .4-.2.8-.2 1.2 0 1.2.7 2.6.7 3.8 0 .4-.2.8-.2 1.2 0 .9.5 1.9.6 2.9.2V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3.6z"/></svg>';
  const BALLOONS = Array.from({ length: 7 }, (_, i) => `<i class="bl b${i % 3}" style="left:${6 + i * 14}%;--d:${(i * 0.9 % 4).toFixed(2)}s;--t:${(6 + (i * 1.3) % 3).toFixed(2)}s;--sw:${i % 2 ? 6 : -6}px"><svg viewBox="0 0 20 34"><ellipse cx="10" cy="10" rx="8" ry="10"/><path d="M10 20l-1.6 2.4h3.2z"/><path class="str" d="M10 22.5c-2 3 2 5 0 11" fill="none"/></svg></i>`).join('');
  const CONF = Array.from({ length: 18 }, (_, i) => `<i class="c${i % 5} s${i % 3}" style="left:${4 + (i * 5.7) % 92}%;--sz:${5 + (i * 3) % 5}px;--d:${((i * 0.31) % 2.4).toFixed(2)}s;--t:${(2.4 + (i * 0.17) % 1.6).toFixed(2)}s;--r:${(i * 47) % 360}deg"></i>`).join('');
  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Dashboard');
    a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Dati ────────────────────────────────────────────────────────
  const ME = { first: 'Federico', area: 'AVEC' };
  const WEATHER = { t: 12, d: 'Nuvoloso', min: 8, max: 14, wind: 9, next: [['Dom', 13], ['Lun', 11], ['Mar', 10], ['Mer', 12]] };
  const ISSUES = [
    { id: 1048, t: 'Monitor diagnostico Sala 3 sfarfalla', c: 'Istituto Ortopedico Rizzoli', p: 'alta', d: 'ieri' },
    { id: 1041, t: 'Worklist vuota sulla modalità CT 2', c: 'AUSL Imola', p: 'alta', d: '12 giorni fa', mine: true },
    { id: 1039, t: 'Referti non firmati digitalmente', c: 'AUSL Bologna', p: 'media', d: '2 settimane fa' },
    { id: 1035, t: 'Lentezza apertura studi RM', c: 'AUSL Romagna', p: 'media', d: '3 settimane fa', mine: true },
    { id: 1029, t: 'Stampante etichette accettazione', c: 'Casa di Cura Rocca', p: 'bassa', d: '1 mese fa' },
  ];
  const TASKS = [
    { t: 'Aggiornare antivirus WS refertazione', due: 'scaduto 2 giorni fa', late: true, who: 'FM' },
    { t: 'Rinnovo certificato SSL portale referti', due: 'mar 10 nov', who: 'NS' },
    { t: 'Verifica backup settimanale VNA', due: 'ven 13 nov', who: null },
    { t: 'Inventario nuove WS Budrio', due: '20 nov', who: 'FM' },
  ];
  const MAINT = { over: 10, soon: 14, days: [3, 0, 2, 1, 0, 4, 0, 0, 2, 1, 3, 0, 0, 2], rows: [
    ['AUSL Bologna', 'Ospedale Maggiore', 3, 'da 6 giorni'], ['AUSL Imola', 'S. Maria della Scaletta', 2, 'da 1 settimana'], ['AUSL Bologna', 'Bellaria', 2, 'da 9 giorni'] ] };
  const NEWS = [
    { tag: 'Manutenzione', t: 'Archie fermo domenica 15 novembre', b: 'Aggiornamento alla 0.10: servizio sospeso dalle 7 alle 9.', d: '5 nov', pin: true },
    { tag: 'News', t: 'Nuovo modulo Rimborso spese', b: 'La nota spese ora si compila in Archie.', d: '2 nov' },
    { tag: 'News', t: 'Cena aziendale 17 dicembre', b: 'Conferma entro il 30 novembre.', d: '28 ott' },
  ];
  const TODO = [{ t: 'Chiamare Rizzoli per accesso VPN', d: 'oggi' }, { t: 'Preparare offerta storage Rocca', d: 'lun' }, { t: 'Inviare nota spese di ottobre', done: true }, { t: 'Controllare licenze Speech AUSL BO' }];
  const BDAY = [{ n: 'Chiara Massa', d: 'oggi' }, { n: 'Leonardo Romano', d: 'mar 10' }, { n: 'Sara De Paola', d: 'sab 21' }];
  const AWAY = [{ n: 'Luca Della Zazzera', r: 'Ferie', u: 'fino a mer 11' }, { n: 'Sara De Paola', r: 'Permesso', u: 'pomeriggio' }];
  let NOTE = 'Password nuova VPN Romagna da girare a Leo.\nOrdine ricambio alimentatore server MWL.';

  // Tinta di ogni widget (pastello, mai piena)
  const TONE = { weather: 'sky', 'quick-actions-pair': 'mint', issues: 'sky', 'area-tasks': 'lilac', maintenance: 'rose', announcements: 'sand', todo: 'mint', 'sticky-note': 'butter', birthdays: 'peach', contributor: 'lilac', team: 'peach' };
  // Varianti D–F: solo i colori dell'app (verde, salvia, acciaio della login); il rosso resta allo stato "scaduto".
  const TONE_G = { 'bday-today': 'gg', weather: 'gv', 'quick-actions-pair': 'gv', issues: 'gv', 'area-tasks': 'gs', maintenance: 'gg', announcements: 'gs', todo: 'gv', 'sticky-note': 'gg', birthdays: 'gg', contributor: 'gv', team: 'gs' };
  const W = { 'bday-today': 'Buon compleanno', weather: 'Benvenuto', 'quick-actions-pair': 'Azioni rapide', issues: 'Issue aperte', 'area-tasks': 'Task di area', maintenance: 'Manutenzioni', announcements: 'Comunicazioni', todo: 'Da fare', 'sticky-note': 'Nota', birthdays: 'Compleanni', contributor: 'Contributor wiki', team: 'Il team oggi' };
  const ICON = { 'bday-today': 'calendar', issues: 'alert', 'area-tasks': 'task', maintenance: 'wrench', announcements: 'chat', todo: 'check', 'sticky-note': 'file', birthdays: 'calendar', contributor: 'book', team: 'users' };
  // Layout per variante: [widget, x, y, w, h] su 6 colonne
  const LAYOUTS = {
    a: [['weather', 0, 0, 4, 2], ['quick-actions-pair', 4, 0, 2, 1], ['birthdays', 4, 1, 2, 1], ['issues', 0, 2, 2, 3], ['maintenance', 2, 2, 2, 3], ['area-tasks', 4, 2, 2, 3], ['announcements', 0, 5, 2, 2], ['todo', 2, 5, 2, 2], ['contributor', 4, 5, 2, 2], ['sticky-note', 0, 7, 4, 2], ['team', 4, 7, 2, 2]],
    b: [['weather', 0, 0, 3, 2], ['maintenance', 3, 0, 3, 2], ['issues', 0, 2, 2, 3], ['quick-actions-pair', 2, 2, 2, 1], ['team', 4, 2, 2, 1], ['area-tasks', 2, 3, 2, 2], ['announcements', 4, 3, 2, 2], ['todo', 0, 5, 2, 2], ['sticky-note', 2, 5, 2, 2], ['birthdays', 4, 5, 1, 2], ['contributor', 5, 5, 1, 2]],
    d: [['weather', 0, 0, 4, 2], ['quick-actions-pair', 4, 0, 2, 1], ['team', 4, 1, 2, 1], ['issues', 0, 2, 2, 3], ['maintenance', 2, 2, 2, 3], ['area-tasks', 4, 2, 2, 3], ['announcements', 0, 5, 2, 2], ['todo', 2, 5, 2, 2], ['contributor', 4, 5, 2, 2], ['sticky-note', 0, 7, 4, 2], ['birthdays', 4, 7, 2, 2]],
    e: [['weather', 0, 0, 4, 2], ['quick-actions-pair', 4, 0, 2, 1], ['team', 4, 1, 2, 1], ['issues', 0, 2, 2, 3], ['maintenance', 2, 2, 2, 3], ['area-tasks', 4, 2, 2, 3], ['announcements', 0, 5, 2, 2], ['todo', 2, 5, 2, 2], ['contributor', 4, 5, 2, 2], ['sticky-note', 0, 7, 4, 2], ['birthdays', 4, 7, 2, 2]],
    f: [['issues', 0, 0, 2, 3], ['maintenance', 2, 0, 2, 3], ['area-tasks', 4, 0, 2, 3], ['announcements', 0, 3, 2, 4], ['sticky-note', 2, 3, 2, 2], ['contributor', 4, 3, 1, 2], ['bday-today', 5, 3, 1, 2], ['todo', 2, 5, 2, 2], ['team', 4, 5, 2, 1], ['birthdays', 4, 6, 2, 1]],
    c: [['issues', 0, 0, 2, 3], ['area-tasks', 2, 0, 2, 3], ['maintenance', 4, 0, 2, 3], ['announcements', 0, 3, 2, 2], ['todo', 2, 3, 2, 2], ['sticky-note', 4, 3, 2, 2], ['team', 0, 5, 2, 1], ['birthdays', 2, 5, 2, 1], ['contributor', 4, 5, 2, 1]],
  };
  const FEATURED = { b: new Set(['weather', 'maintenance', 'issues']) };

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  let variant = qs.get('variante') || (() => { try { return localStorage.getItem('archie-preview-db3-v') || 'a'; } catch { return 'a'; } })();
  let edit = false; const hidden = { a: new Set(), b: new Set(), c: new Set(), d: new Set(), e: new Set(), f: new Set() }; let issueTab = 'all';
  const root = $('[data-db]');
  const ava = (n) => `<span class="dav" aria-hidden="true">${n.length <= 2 ? n : n.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>`;
  const big = (n, unit, cls = '') => `<div class="big ${cls}"><b>${n}</b>${unit ? `<span>${unit}</span>` : ''}</div>`;
  const hd = (k, extra = '', link = '') => head(k, extra, link);
  const head = (k, extra = '', link = '') => `<header class="wh"><span class="wic">${ic(ICON[k])}</span><h2>${W[k]}</h2>${extra}<span class="sp"></span>${link ? `<a href="#" class="wlink">${link}${ic('arrowR')}</a>` : ''}</header>`;

  // ── Widget ──────────────────────────────────────────────────────
  const R = {
    weather: (h) => `${variant === 'd' ? '<div class="sg-slot" aria-hidden="true"></div>' : ''}<div class="wel"><div class="wel-t"><h1>Buongiorno, ${ME.first}</h1><p>Sabato 7 novembre · settimana 45</p>
        <ul class="wel-chips"><li><b>2</b> issue tue</li><li><b>2</b> task tuoi</li><li class="al"><b>10</b> manutenzioni scadute</li></ul></div>
        <div class="wel-w">${WX}<div class="tt"><b>${WEATHER.t}°</b><span>${WEATHER.d}<br>Bologna</span></div>${h >= 2 ? `<ul class="nx">${WEATHER.next.map(([d, t]) => `<li><span>${d}</span><b>${t}°</b></li>`).join('')}</ul>` : ''}</div></div>`,
    'quick-actions-pair': () => `<div class="qa2"><button type="button" class="qb">${ic('plus')}<span><b>Nuova issue</b><small>problema di un cliente</small></span></button><button type="button" class="qb alt">${ic('cloud')}<span><b>Triage</b><small>caso ServiceNow</small></span></button></div>`,
    issues: (h) => { const rows = issueTab === 'mine' ? ISSUES.filter((i) => i.mine) : ISSUES; const by = { alta: 2, media: 2, bassa: 1 };
      return `${head('issues', '', 'Tutte')}<div class="wb"><div class="kpirow">${big(ISSUES.length, 'aperte')}<div class="stack" aria-label="Per priorità">${Object.entries(by).map(([p, n]) => `<i class="p-${p}" style="flex:${n}" title="${p}: ${n}"></i>`).join('')}</div></div>
        <div class="seg"><button type="button" data-itab="all" aria-pressed="${issueTab === 'all'}">Tutte</button><button type="button" data-itab="mine" aria-pressed="${issueTab === 'mine'}">Mie</button></div>
        <ul class="li">${rows.slice(0, h >= 3 ? 4 : 2).map((i) => `<li><span class="dot p-${i.p}"></span><span class="tx"><b>${esc(i.t)}</b><small>#${i.id} · ${i.c}</small></span></li>`).join('')}</ul></div>`; },
    'area-tasks': (h) => `${head('area-tasks', `<span class="pill">${ME.area}</span>`, 'Tutti')}<div class="wb">${big(TASKS.length, 'aperti')}<ul class="li">${TASKS.slice(0, h >= 3 ? 4 : 2).map((t) => `<li><span class="cb"></span><span class="tx"><b>${esc(t.t)}</b><small class="${t.late ? 'late' : ''}">${t.due}</small></span>${t.who ? ava(t.who) : '<span class="free">libero</span>'}</li>`).join('')}</ul></div>`,
    maintenance: (h, w) => { const mx = Math.max(...MAINT.days); return `${hd('maintenance', '', 'Scadenze')}<div class="wb"><div class="kpirow">${big(MAINT.over, 'scadute', 'al')}<div class="sub2"><b>${MAINT.soon}</b> nei prossimi 30 giorni</div></div>
        <div class="days" aria-label="Prossimi 14 giorni">${MAINT.days.map((n, i) => `<i style="--h:${n ? 6 + (n / mx) * 26 : 3}px" class="${n ? '' : 'z'}" title="${n} manutenzioni"></i>`).join('')}</div>
        ${h >= 3 || w >= 3 ? `<ul class="li">${MAINT.rows.slice(0, w >= 3 && h < 3 ? 2 : 3).map(([c, s, n, d]) => `<li><span class="dot late"></span><span class="tx"><b>${c} · ${s}</b><small>${n} manutenzioni · scadute ${d}</small></span></li>`).join('')}</ul>` : ''}</div>`; },
    announcements: (h) => `${hd('announcements', '', 'Tutte')}<div class="wb"><ul class="news">${NEWS.slice(0, h >= 3 ? 3 : 2).map((n, i) => (i === 0 ? `<li${n.pin ? ' class="pin"' : ''}><span class="tag">${n.tag}</span><b>${esc(n.t)}</b><small>${esc(n.b)} · ${n.d}</small></li>` : `<li class="one"><span class="tag">${n.tag}</span><b>${esc(n.t)}</b><small>${n.d}</small></li>`)).join('')}</ul></div>`,
    todo: () => `${head('todo')}<div class="wb"><ul class="todo">${TODO.slice(0, 4).map((t) => `<li class="${t.done ? 'done' : ''}"><span class="cb${t.done ? ' on' : ''}">${t.done ? tick : ''}</span><span>${esc(t.t)}</span></li>`).join('')}</ul></div>`,
    'sticky-note': () => `${head('sticky-note')}<textarea class="note" aria-label="Nota personale" data-note>${esc(NOTE)}</textarea>`,
    birthdays: (h, w) => `${head('birthdays')}<div class="wb"><ul class="ppl${h < 2 && w >= 2 ? ' row' : ''}">${BDAY.slice(0, h >= 2 ? 3 : w >= 2 ? 2 : 1).map((b) => `<li>${ava(b.n)}<span><b>${b.n.split(' ')[0]}</b><small>${b.d === 'oggi' ? '<em>oggi</em>' : b.d}</small></span></li>`).join('')}</ul></div>`,
    contributor: () => `<div class="ctb"><div class="conf" aria-hidden="true">${CONF}</div><span class="trophy-bg" aria-hidden="true">${TROPHY}</span>
        <div class="ctb-in"><p class="ctb-t"><span class="tr-s">${TROPHY}</span>Contributor del mese</p><p class="ctb-m">novembre 2026</p>
        <div class="ctb-av"><span class="ring"></span><span class="av">N</span><span class="badge">${TROPHY}</span></div>
        <b class="ctb-n">Nicole Spazzoli</b><span class="ctb-c">6 pagine create</span></div></div>`,
    // Compleanno di oggi: gemello del Contributor, con palloncini che salgono
    'bday-today': () => { const b = BDAY.find((x) => x.d === 'oggi'); return b ? `<div class="bdt"><div class="balloons" aria-hidden="true">${BALLOONS}</div>
        <div class="bdt-in"><p class="bdt-t">Buon compleanno!</p><div class="bdt-av"><span class="ring"></span><span class="av">${b.n.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span><span class="badge">${CAKE}</span></div>
        <b class="bdt-n">${b.n}</b><span class="bdt-c">compie gli anni oggi</span></div></div>` : ''; },
    team: () => `${head('team', '', 'Piano ferie')}<div class="wb"><ul class="ppl row">${AWAY.map((a) => `<li>${ava(a.n)}<span><b>${a.n.split(' ')[0]}</b><small>${a.r} · ${a.u}</small></span></li>`).join('')}</ul></div>`,
  };

  // ── C · Fascia pastello ─────────────────────────────────────────
  const bandC = () => `<section class="pband" aria-labelledby="pb-t"><div class="pbx-l"><h1 id="pb-t">Buongiorno, ${ME.first}</h1><p>Sabato 7 novembre · ${WEATHER.t}° ${WEATHER.d.toLowerCase()} a Bologna</p>
      <div class="pbx-act"><button class="btn btn-primary" type="button">${ic('plus')}Nuova issue</button><button class="btn" type="button">${ic('cloud')}Triage</button></div></div>
      <div class="pbx-stats">${[['sky', 'alert', 2, 'issue assegnate a te'], ['lilac', 'task', 4, `task di area ${ME.area}`], ['rose', 'wrench', 10, 'manutenzioni scadute'], ['peach', 'users', 2, 'colleghi assenti oggi']].map(([t, i, n, l]) => `<button type="button" class="pst t-${t}"><span class="wic">${ic(i)}</span><b>${n}</b><small>${l}</small></button>`).join('')}</div>
      ${WX}</section>`;

  // ── F · Aurora: lo stesso sfondo animato della login, in testa alla pagina ──
  const bandF = () => `<section class="aur" aria-labelledby="au-t"><div class="sg-slot" aria-hidden="true"></div>
      <div class="au-in"><div class="au-l"><h1 id="au-t">Buongiorno, ${ME.first}</h1><p>Sabato 7 novembre · settimana 45 · ${WEATHER.t}° ${WEATHER.d.toLowerCase()} a Bologna</p>
        <div class="au-act"><button class="btn btn-primary" type="button">${ic('plus')}Nuova issue</button><button class="btn" type="button">${ic('cloud')}Triage</button></div></div>
        <ul class="au-st">${[['alert', 2, 'issue tue'], ['task', 4, `task di area ${ME.area}`], ['wrench', 10, 'manutenzioni scadute', 'al'], ['users', 2, 'colleghi assenti oggi']].map(([i, n, l, c]) => `<li class="${c || ''}">${ic(i)}<b>${n}</b><span>${l}</span></li>`).join('')}</ul></div></section>`;

  // Sfondo animato (ShaderGradient, come la login): un solo nodo, spostato nello slot a ogni render.
  const sgHost = document.createElement('div'); sgHost.className = 'sg-host';
  let sgMod = null; let sgOn = false;
  // Pausa/play di tutte le animazioni (sfondo, coriandoli, palloncini), ricordata nel browser
  let paused = (() => { try { return localStorage.getItem('archie-dash-anim') === 'off'; } catch { return false; } })();
  const PAUSE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/></svg>';
  const PLAY = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
  const animBtn = () => `<button type="button" class="icon-btn anim-btn" data-anim aria-pressed="${paused}" aria-label="${paused ? 'Riprendi le animazioni' : 'Metti in pausa le animazioni'}" title="${paused ? 'Riprendi le animazioni' : 'Metti in pausa le animazioni'}">${paused ? PLAY : PAUSE}</button>`;
  const SG = { light: { color1: '#6fae9b', color2: '#c3e0d6', color3: '#93acc4', brightness: 1.15 }, dark: { color1: '#1f5a4c', color2: '#173f37', color3: '#2b4258', brightness: 0.85 } };
  const paintSG = async () => {
    const slot = root.querySelector('.sg-slot'); if (!slot) return;
    slot.appendChild(sgHost);
    try { sgMod ??= await import('./sg-bundle.js'); } catch { return; }
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const still = paused || matchMedia('(prefers-reduced-motion: reduce)').matches;
    sgMod.paint(sgHost, { control: 'props', type: 'waterPlane', animate: still ? 'off' : 'on', uTime: 2, uSpeed: 0.22, uStrength: 3.2, uDensity: 1.7, uFrequency: 5.5, uAmplitude: 0,
      positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 10, rotationZ: 50, cAzimuthAngle: 180, cPolarAngle: 90, cDistance: 3.6, cameraZoom: 1, lightType: '3d', reflection: 0.1, grain: 'off', ...SG[dark ? 'dark' : 'light'] });
    sgOn = true;
  };
  new MutationObserver(() => { if (sgOn) paintSG(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const render = () => {
    const lay = LAYOUTS[variant].filter(([k]) => !hidden[variant].has(k));
    const hid = LAYOUTS[variant].filter(([k]) => hidden[variant].has(k));
    root.className = `dbv v-${variant}${paused ? ' anim-off' : ''}`;
    root.innerHTML = `<div class="mt-head db-head"><div class="actions">${animBtn()}<button class="btn" type="button" data-edit aria-pressed="${edit}">${ic('columns')}${edit ? 'Fine' : 'Personalizza'}</button></div></div>
      ${variant === 'c' ? bandC() : ''}${variant === 'f' ? bandF() : ''}
      ${edit ? `<div class="edit-bar">${ic('columns')}<span><b>Personalizza</b> · trascina dalla maniglia, ridimensiona dall'angolo, nascondi con l'occhio. Si salva da solo.</span>${hid.map(([k]) => `<button type="button" class="chip-h" data-show="${k}">${ic('eye')}${W[k]}</button>`).join('')}<span class="sp"></span><button class="btn btn-sm" type="button">Ripristina predefinito</button></div>` : ''}
      <div class="grid${edit ? ' editing' : ''}">${lay.map(([k, x, y, w, h]) => {
        const feat = variant === 'a' || variant === 'e' || (variant === 'b' && FEATURED.b.has(k)) || (variant === 'c' && false);
        const tone = 'def'.includes(variant) ? TONE_G[k] : TONE[k];
        return `<div class="cell" style="grid-column:${x + 1} / span ${w};grid-row:${y + 1} / span ${h}"><section class="wg w-${k} t-${tone}${feat ? ' tinted' : ''} s-${w}x${h}" aria-label="${W[k]}">${R[k](h, w)}</section>${edit ? `<div class="eov"><span class="grip">${ic('menu')}</span><span class="sz">${w}×${h}</span><button type="button" class="icon-btn sm" data-hide="${k}" aria-label="Nascondi ${W[k]}">${ic('eyeOff')}</button></div>` : ''}</div>`; }).join('')}</div>`;
    document.querySelector('[data-dbedit]').setAttribute('aria-pressed', String(edit));
    if (variant === 'd' || variant === 'f') paintSG();
  };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.itab) { issueTab = b.dataset.itab; return render(); }
    if (b.dataset.hide) { hidden[variant].add(b.dataset.hide); return render(); }
    if (b.dataset.show) { hidden[variant].delete(b.dataset.show); return render(); }
    if (b.matches('[data-edit]')) { edit = !edit; return render(); }
    if (b.matches('[data-anim]')) { paused = !paused; try { localStorage.setItem('archie-dash-anim', paused ? 'off' : 'on'); } catch { /* niente */ } render(); root.querySelector('[data-anim]')?.focus(); return; }
  });
  root.addEventListener('input', (e) => { if (e.target.matches('[data-note]')) NOTE = e.target.value; });
  const vb = document.querySelectorAll('[data-dbv]');
  const setV = (v) => { variant = v; vb.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.dbv === v))); try { localStorage.setItem('archie-preview-db3-v', v); } catch { /* niente */ } render(); };
  vb.forEach((x) => x.addEventListener('click', () => setV(x.dataset.dbv)));
  document.querySelector('[data-dbedit]').addEventListener('click', () => { edit = !edit; render(); });
  setV(['a', 'b', 'c', 'd', 'e', 'f'].includes(variant) ? variant : 'd');
})();
