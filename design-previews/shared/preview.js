/* Anteprime direzioni ARCHIE — dati fittizi e comportamento condiviso.
   Nessuna dipendenza: ogni pagina definisce il proprio CSS e chiama Preview.init(opts). */
(function () {
  const P = {
    dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
    building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16 M16 9h2a2 2 0 0 1 2 2v10 M3 21h18 M8 7h4 M8 11h4 M8 15h4',
    pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 7.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 1 0 8a4 4 0 0 1 0-8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    server: 'M4 3h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M4 14h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z M6 6.5h.01 M6 17.5h.01',
    monitor: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8 20h8 M12 16v4',
    alert: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18z M12 8v5 M12 16h.01',
    task: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8.5 12l2.5 2.5 4.5-5',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    book: 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z',
    folder: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
    receipt: 'M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z M9 8h6 M9 12h6 M9 16h4',
    bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
    calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18',
    cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z',
    history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2',
    trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6',
    search: 'M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14z M21 21l-4.3-4.3',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
    plus: 'M12 5v14 M5 12h14',
    filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
    chevL: 'M15 18l-6-6 6-6',
    chevR: 'M9 18l6-6-6-6',
    chevD: 'M6 9l6 6 6-6',
    sort: 'M8 15l4 4 4-4 M8 9l4-4 4 4',
    sun: 'M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41',
    moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
    x: 'M18 6 6 18 M6 6l12 12',
    more: 'M12 12h.01 M19 12h.01 M5 12h.01',
    panel: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 3v18',
    arrowR: 'M5 12h14 M12 5l7 7-7 7',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5',
    clock: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18z M12 7.5V12l3 2',
    key: 'M15.5 7.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0z M12 11v10 M12 15h3 M12 18h2',
    eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2 M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2 M9.9 9.9a3 3 0 0 0 4.2 4.2',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    check: 'M20 6L9 17l-5-5',
    lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V7a4 4 0 0 1 8 0v4',
    user: 'M12 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8z M4 21a8 8 0 0 1 16 0',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6z',
    columns: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 3v18 M15 3v18',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    copy: 'M10 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    restore: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  };
  const icon = (n, cls = 'i') =>
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n] || ''}"/></svg>`;

  /* Raggruppamento proposto: per lavoro, non per storia del codice. */
  const NAV = [
    { id: 'op', label: 'Operatività', items: [
      { id: 'dash', label: 'Dashboard', icon: 'dashboard' },
      { id: 'issue', label: 'Issue', icon: 'alert', count: 9, active: true },
      { id: 'task', label: 'Task di area', icon: 'task', count: 3 },
      { id: 'man', label: 'Manutenzione', icon: 'wrench' },
      { id: 'mon', label: 'Monitor', icon: 'activity' },
    ] },
    { id: 'ana', label: 'Anagrafiche', items: [
      { id: 'cli', label: 'Clienti', icon: 'building' },
      { id: 'siti', label: 'Siti', icon: 'pin' },
      { id: 'con', label: 'Contatti', icon: 'users' },
      { id: 'inv', label: 'Inventari', icon: 'server' },
      { id: 'dev', label: 'Device', icon: 'monitor' },
    ] },
    { id: 'kno', label: 'Conoscenza', items: [
      { id: 'wiki', label: 'Wiki', icon: 'book' },
      { id: 'drive', label: 'Drive', icon: 'folder' },
    ] },
    { id: 'adm', label: 'Amministrazione', items: [
      { id: 'ctr', label: 'Contratti', icon: 'file' },
      { id: 'po', label: 'Purchase Order', icon: 'bag' },
      { id: 'rs', label: 'Rimborso spese', icon: 'receipt' },
      { id: 'pf', label: 'Piano ferie', icon: 'calendar' },
      { id: 'sn', label: 'ServiceNow', icon: 'cloud' },
    ] },
    { id: 'sys', label: 'Sistema', items: [
      { id: 'audit', label: 'Audit', icon: 'history' },
      { id: 'trash', label: 'Cestino', icon: 'trash' },
    ] },
  ];

  /* Dati fittizi: nomi di strutture sanitarie usati solo come esempio. */
  const ROWS = [
    { id: 1042, open: '03/11/2026', pr: 'critica', st: 'aperta', title: 'PACS non raggiungibile dalla Radiologia PS', cli: 'AUSL Bologna', site: 'Osp. Maggiore', sn: 'CS0631207', who: 'F. Mutuale', due: '03/11', dueState: 'oggi' },
    { id: 1041, open: '02/11/2026', pr: 'alta', st: 'lavorazione', title: 'Worklist vuota sulla modalità CT 2', cli: 'AUSL Imola', site: 'S. Maria della Scaletta', sn: 'CS0630988', who: 'L. Romano', due: '05/11' },
    { id: 1040, open: '01/11/2026', pr: 'critica', st: 'lavorazione', title: 'DICOM SR di dose non ricevuti dal RIS', cli: 'ASUFC Udine', site: 'S. Maria della Misericordia', sn: 'CS0628771', who: 'A. Ferri', due: '04/11' },
    { id: 1039, open: '31/10/2026', pr: 'media', st: 'attesa', waiting: 'Cliente', title: 'Rinnovo certificato TLS del gateway RIS', cli: 'IRCCS Rizzoli', site: 'Sede via Pupilli', sn: '', who: 'A. Ferri', due: '15/11' },
    { id: 1038, open: '30/10/2026', pr: 'alta', st: 'aperta', title: 'Storage archivio al 91%: pianificare espansione', cli: 'Centro Medico Esperia', site: 'Pordenone', sn: 'INC000214', who: 'F. Mutuale', due: '07/11' },
    { id: 1035, open: '28/10/2026', pr: 'media', st: 'lavorazione', title: 'Utenze VPN da rinnovare per 3 tecnici', cli: 'AUSL Bologna', site: 'Osp. Bellaria', sn: '', who: 'L. Romano', due: '10/11' },
    { id: 1033, open: '27/10/2026', pr: 'media', st: 'aperta', title: 'Migrazione procedure di backup nella Wiki', cli: 'Biotron', site: 'Sede Bologna', sn: '', who: 'F. Mutuale', due: '20/11' },
    { id: 1031, open: '24/10/2026', pr: 'alta', st: 'attesa', waiting: 'Fornitore', title: 'Sostituzione switch nel rack di Radiologia', cli: 'ASUFC Udine', site: 'Osp. di San Daniele', sn: 'CS0627302', who: 'M. Romanelli', due: '31/10', dueState: 'scaduta' },
    { id: 1029, open: '22/10/2026', pr: 'bassa', st: 'aperta', title: 'Credenziali console ecografo da aggiornare', cli: 'Casa di Cura Rocca', site: 'Piacenza', sn: '', who: 'M. Romanelli', due: '28/11' },
    { id: 1027, open: '21/10/2026', pr: 'bassa', st: 'risolta', title: 'Aggiornare firmware stampante DryView 5950', cli: 'ASREM Molise', site: 'Osp. Cardarelli', sn: 'CS0629410', who: 'M. Romanelli', due: '' },
    { id: 1024, open: '17/10/2026', pr: 'media', st: 'risolta', title: 'Report mensile disponibilità sistemi', cli: 'AUSL Imola', site: 'S. Maria della Scaletta', sn: '', who: 'L. Romano', due: '' },
    { id: 1019, open: '13/10/2026', pr: 'bassa', st: 'chiusa', title: 'Test notifica email (duplicato)', cli: 'AUSL Bologna', site: 'Osp. Maggiore', sn: '', who: 'F. Mutuale', due: '', deleted: true },
  ];

  const ST = {
    aperta: 'Aperta', lavorazione: 'In lavorazione', attesa: 'In attesa', risolta: 'Risolta', chiusa: 'Chiusa',
  };
  const PR = { critica: 'Critica', alta: 'Alta', media: 'Media', bassa: 'Bassa' };

  /* Il segno di stato porta la forma, non solo il colore:
     pieno = attivo, metà = in corso, anello = fermo, spunta = risolto, trattino = chiuso. */
  const MARK = {
    aperta: '<circle cx="6" cy="6" r="4" fill="currentColor"/>',
    lavorazione: '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor"/>',
    attesa: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    risolta: '<path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    chiusa: '<path d="M2.5 6h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const mark = (st) => `<svg class="mk" viewBox="0 0 12 12" aria-hidden="true">${MARK[st]}</svg>`;
  const status = (st) => `<span class="st st-${st}">${mark(st)}<span>${ST[st]}</span></span>`;
  const prio = (p) => `<span class="pr pr-${p}"><span class="pr-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${PR[p]}</span>`;

  function renderNav(el, opts) {
    const o = Object.assign({ groupLabels: true }, opts);
    el.innerHTML = NAV.map((g) => `
      <div class="nav-group" data-group="${g.id}">
        ${o.groupLabels ? `<div class="nav-label">${g.label}</div>` : ''}
        <ul>${g.items.map((it) => `
          <li><a href="#" class="nav-item${it.active ? ' is-active' : ''}" ${it.active ? 'aria-current="page"' : ''} data-tip="${it.label}">
            ${icon(it.icon)}<span class="nav-text">${it.label}</span>${it.count ? `<span class="nav-count">${it.count}</span>` : ''}
          </a></li>`).join('')}
        </ul>
      </div>`).join('');
  }

  function renderRows(tbody, opts) {
    const o = Object.assign({ showDeleted: false, selected: 1041 }, opts);
    tbody.innerHTML = ROWS.filter((r) => o.showDeleted || !r.deleted).map((r) => `
      <tr data-id="${r.id}" class="${r.id === o.selected ? 'is-selected' : ''}${r.deleted ? ' is-deleted' : ''}" tabindex="0">
        <td class="c-id num">#${r.id}</td>
        <td class="c-pr">${prio(r.pr)}</td>
        <td class="c-st">${r.deleted ? '<span class="st st-void">Annullata</span>' : status(r.st)}${r.waiting ? `<span class="wait">${r.waiting}</span>` : ''}</td>
        <td class="c-title"><span class="t">${r.title}</span></td>
        <td class="c-cli"><span class="cli">${r.cli}</span><span class="site">${r.site}</span></td>
        <td class="c-sn">${r.sn ? `<span class="code">${r.sn}</span>` : '<span class="none">—</span>'}</td>
        <td class="c-who">${r.who}</td>
        <td class="c-due num">${r.due ? `<span class="due${r.dueState ? ' due-' + r.dueState : ''}">${r.due}${r.dueState ? ` · ${r.dueState}` : ''}</span>` : '<span class="none">—</span>'}</td>
        <td class="c-open num">${r.open}</td>
      </tr>`).join('');
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-i]').forEach((n) => {
      n.outerHTML = icon(n.getAttribute('data-i'), n.getAttribute('class') ? 'i ' + n.getAttribute('class') : 'i');
    });
  }

  function init(opts = {}) {
    const html = document.documentElement;
    const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
    const key = 'archie-preview-' + (opts.id || 'x');

    const nav = document.querySelector('[data-nav]');
    if (nav) renderNav(nav, opts.nav);
    const tbody = document.querySelector('[data-rows]');
    let showDeleted = !!opts.showDeleted;
    const draw = () => tbody && renderRows(tbody, { showDeleted, selected: selected });
    let selected = 1041;
    draw();
    hydrateIcons();

    // Tema: chiaro/scuro, ricordato per pagina.
    const savedTheme = store(key + '-theme');
    if (savedTheme) html.setAttribute('data-theme', savedTheme);
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
      const cur = html.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      store(key + '-theme', next);
    }));

    // Vista: applicazione / login.
    const setView = (v) => {
      document.body.setAttribute('data-view', v);
      document.querySelectorAll('[data-view-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === v)));
      store(key + '-view', v);
    };
    document.querySelectorAll('[data-view-btn]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.viewBtn)));
    const q = new URLSearchParams(location.search);
    setView(q.get('view') || store(key + '-view') || 'app');
    if (q.get('theme')) html.setAttribute('data-theme', q.get('theme'));

    // Sidebar comprimibile.
    document.querySelectorAll('[data-collapse]').forEach((b) => b.addEventListener('click', () => {
      const shell = document.querySelector('.shell');
      const c = shell.classList.toggle('is-collapsed');
      b.setAttribute('aria-expanded', String(!c));
    }));
    if (q.get('collapsed')) document.querySelector('.shell')?.classList.add('is-collapsed');
    // Mobile: sidebar come pannello.
    document.querySelectorAll('[data-mobile-nav]').forEach((b) => b.addEventListener('click', () => {
      document.querySelector('.shell').classList.toggle('nav-open');
    }));

    // Selezione riga → pannello di dettaglio.
    const drawer = document.querySelector('[data-drawer]');
    const openDrawer = (id) => {
      selected = id;
      tbody.querySelectorAll('tr').forEach((tr) => tr.classList.toggle('is-selected', Number(tr.dataset.id) === id));
      const r = ROWS.find((x) => x.id === id);
      if (drawer && r) {
        drawer.hidden = false;
        document.querySelector('.shell')?.classList.add('has-drawer');
        drawer.querySelectorAll('[data-f]').forEach((f) => {
          const k = f.dataset.f;
          const v = k === 'idlabel' ? '#' + r.id : k === 'st' ? ST[r.st] : k === 'pr' ? PR[r.pr] : r[k] || '';
          if ('value' in f && f.tagName !== 'SPAN' && f.tagName !== 'DIV') f.value = v; else f.textContent = v;
        });
        drawer.querySelectorAll('[data-prio]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.prio === r.pr)));
      }
    };
    if (tbody) {
      tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) openDrawer(Number(tr.dataset.id)); });
      tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr'); if (tr) openDrawer(Number(tr.dataset.id)); } });
    }
    document.querySelectorAll('[data-close-drawer]').forEach((b) => b.addEventListener('click', () => {
      drawer.hidden = true; selected = null;
      document.querySelector('.shell')?.classList.remove('has-drawer');
      tbody.querySelectorAll('tr').forEach((tr) => tr.classList.remove('is-selected'));
    }));
    document.querySelectorAll('[data-prio]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('[data-prio]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    const startOpen = q.get('drawer') ? q.get('drawer') !== '0' : opts.drawerOpen !== false;
    if (drawer && startOpen) openDrawer(1041);
    else if (drawer) {
      drawer.hidden = true; selected = null;
      document.querySelector('.shell')?.classList.remove('has-drawer');
      tbody?.querySelectorAll('tr').forEach((tr) => tr.classList.remove('is-selected'));
    }
    if (opts.escCloses) document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer && !drawer.hidden) drawer.querySelector('[data-close-drawer]')?.click();
    });

    // Filtri a segmenti (solo visivi) e mostra/nascondi cestinati.
    document.querySelectorAll('[data-seg]').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    document.querySelectorAll('[data-toggle-deleted]').forEach((b) => {
      b.setAttribute('aria-pressed', String(showDeleted));
      b.addEventListener('click', () => { showDeleted = !showDeleted; b.setAttribute('aria-pressed', String(showDeleted)); draw(); hydrateIcons(tbody); });
    });

    // Login: ambito e mostra password.
    document.querySelectorAll('[data-ambito]').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('[role="radio"]'); if (!b) return;
      g.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    }));
    document.querySelectorAll('[data-reveal]').forEach((b) => b.addEventListener('click', () => {
      const inp = document.getElementById(b.dataset.reveal);
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Nascondi password' : 'Mostra password');
    }));
    document.querySelectorAll('form[data-demo]').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
  }

  window.Preview = { init, icon, NAV, ROWS };
})();
