/* Scheda intervento nel pannello di dettaglio (base h).
   Tre schede (Dettagli, Attività, Allegati), timeline dall'apertura alla scadenza,
   valori modificabili sul posto con salvataggio immediato e annulla.
   Oggi, per le anteprime: 03/11/2026 14:20. */
(() => {
  const root = document.querySelector('[data-int]');
  if (!root) return;
  const ic = (n) => Preview.icon(n);
  const drawer = document.querySelector('[data-drawer]');
  const tbody = document.querySelector('[data-rows]');
  const pop = document.querySelector('[data-pop]');
  const toast = document.querySelector('[data-toast]');
  const html = document.documentElement;
  const NOW = new Date(2026, 10, 3, 14, 20);

  const ST = { aperta: 'Aperta', lavorazione: 'In lavorazione', attesa: 'In attesa', risolta: 'Risolta' };
  const PR = { bassa: 'Bassa', media: 'Media', alta: 'Alta', critica: 'Critica' };
  const PEOPLE = ['F. Mutuale', 'L. Romano', 'A. Ferri', 'M. Romanelli'];
  const MARK = {
    aperta: '<circle cx="6" cy="6" r="4" fill="currentColor"/>',
    lavorazione: '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor"/>',
    attesa: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    risolta: '<path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const stBadge = (st) => `<span class="st st-${st}"><svg class="mk" viewBox="0 0 12 12" aria-hidden="true">${MARK[st]}</svg><span>${ST[st]}</span></span>`;
  const prBadge = (pr) => `<span class="pr pr-${pr}"><span class="pr-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${PR[pr]}</span>`;
  const ini = (n) => n.replace(/^(Dr\.ssa|Dr\.)\s*/, '').split(/[\s.]+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const d = (s) => { const [dd, mm, rest] = s.split('/'); const [yy, hm] = (rest || '2026 00:00').split(' '); const [h, m] = (hm || '00:00').split(':'); return new Date(Number(yy) || 2026, Number(mm) - 1, Number(dd), Number(h), Number(m)); };
  const dur = (ms) => { const h = Math.round(Math.abs(ms) / 36e5); const g = Math.floor(h / 24); const r = h % 24; return g ? `${g} g ${r} h` : `${r} h`; };
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // Dati di dettaglio finti per issue. Le altre righe usano un dettaglio generico senza procedura.
  const DET = {
    1041: {
      open: '02/11/2026 08:02', due: '05/11/2026 12:00',
      next: { text: 'Riavviare il servizio MWL sul gateway RIS e verificare la worklist sulla CT 2.', who: 'L. Romano', when: 'oggi 12:30' },
      milestones: [['02/11/2026 08:02', 'Aperta dal portale cliente'], ['02/11/2026 08:40', 'Presa in carico da L. Romano'], ['02/11/2026 16:40', 'Collegato il caso ServiceNow'], ['03/11/2026 09:14', 'Stato: In lavorazione']],
      kb: { title: 'Riavvio servizio MWL', steps: [['Verificare l\'invio degli ordini dal RIS', 1], ['Controllare lo stato del servizio MWL', 1], ['Concordare la finestra di riavvio con il reparto', 0], ['Riavviare il servizio MWL', 0], ['Verificare la worklist sulla modalità', 0]] },
      where: [['pin', 'S. Maria della Scaletta', 'Via Montericco 4, Imola · Radiologia, piano 0'], ['user', 'Dr.ssa G. Valli', 'Referente di reparto · <a href="#">0542 662 111</a>'], ['monitor', 'CT 2 · Somatom go.Top', 'Seriale 108742 · inventario AUSL-IM-2231']],
      lockedLabel: 'Credenziali gateway RIS',
      activity: [
        ['ev', 'plus', 'Portale cliente', 'ha aperto la issue', '02/11, 08:02'],
        ['cm', 'Dr.ssa G. Valli', 'cliente', 'Da stamattina i tecnici di radiologia non vedono gli esami prenotati sulla CT 2. La CT 1 funziona.', '02/11, 08:05'],
        ['ev', 'user', 'L. Romano', 'ha preso in carico la issue', '02/11, 08:40'],
        ['ev', 'file', 'L. Romano', 'ha collegato il caso ServiceNow <span class="code">CS0630988</span>', '02/11, 16:40'],
        ['ev', 'activity', 'L. Romano', 'ha cambiato lo stato da <b>Aperta</b> a <b>In lavorazione</b>', 'oggi, 09:14'],
        ['cm', 'L. Romano', 'interno', 'Il servizio MWL sul gateway è fermo dal riavvio notturno. Lo riavvio in finestra concordata con il reparto alle 12:30.', 'oggi, 09:16'],
      ],
      files: [['log', 'mwl-gateway-0311.log', '184 KB', 'L. Romano', 'oggi, 09:12', 0], ['img', 'worklist-vuota-ct2.png', '412 KB', 'Dr.ssa G. Valli', '02/11, 08:05', 1], ['pdf', 'verbale-intervento-bozza.pdf', '96 KB', 'L. Romano', 'oggi, 09:20', 0]],
    },
    1038: {
      open: '30/10/2026 09:10', due: '07/11/2026 18:00',
      next: { text: 'Raccogliere il trend di occupazione degli ultimi 90 giorni e proporre al cliente la data di espansione.', who: 'F. Mutuale', when: 'domani' },
      milestones: [['30/10/2026 09:10', 'Aperta da monitoraggio storage'], ['30/10/2026 10:02', 'Presa in carico da F. Mutuale'], ['31/10/2026 11:30', 'Collegato il caso INC000214']],
      kb: null,
      manual: [['Verificare l\'occupazione reale sul VNA', 1], ['Calcolare il trend di crescita mensile', 0]],
      similar: [['Espansione storage VNA', 'Stesso cliente · 2025'], ['Politica di pulizia della cache PACS', 'Procedura generale']],
      where: [['pin', 'Pordenone', 'Via Montereale 24 · Sala server, piano −1'], ['user', 'Ing. P. Zanin', 'Responsabile IT · <a href="#">0434 551 200</a>'], ['server', 'Archivio VNA · nodo 2', 'Seriale VN-22981 · inventario CME-0412']],
      lockedLabel: 'Credenziali console VNA',
      activity: [
        ['ev', 'activity', 'Monitoraggio', 'ha aperto la issue: storage al 91%', '30/10, 09:10'],
        ['ev', 'user', 'F. Mutuale', 'ha preso in carico la issue', '30/10, 10:02'],
        ['cm', 'F. Mutuale', 'interno', 'Crescita più rapida del previsto dopo l\'attivazione della tomosintesi. Serve una stima prima di sentire il cliente.', '31/10, 11:20'],
        ['ev', 'file', 'F. Mutuale', 'ha collegato il caso <span class="code">INC000214</span>', '31/10, 11:30'],
      ],
      files: [['xls', 'occupazione-vna-ottobre.xlsx', '58 KB', 'F. Mutuale', '31/10, 11:24', 0]],
    },
  };
  const generic = (r) => ({
    open: r.open + ' 09:00', due: r.due ? `${r.due}/2026 18:00` : null,
    next: null, milestones: [[r.open + ' 09:00', 'Issue aperta']], kb: null, manual: [], similar: [],
    where: [['pin', r.site, r.cli], ['user', 'Referente non indicato', 'Aggiungilo dalla scheda del sito']],
    lockedLabel: 'Credenziali del sito',
    activity: [['ev', 'plus', r.who, 'ha aperto la issue', r.open.slice(0, 5)]], files: [],
  });

  let cur = null; let row = null; let tab = 'det'; let undo = null;
  const state = {}; // valori modificati, per issue

  // ── Timeline: da quanto è aperta ──────────────────────────────────
  const timeline = (D) => {
    const o = d(D.open); const due = D.due ? d(D.due) : null;
    const age = NOW - o;
    const end = due && due > NOW ? due : new Date(NOW.getTime() + Math.max(age * 0.25, 36e5 * 6));
    const span = end - o; const pos = (t) => Math.max(0, Math.min(100, ((t - o) / span) * 100));
    const over = due && NOW > due;
    const left = due ? due - NOW : null;
    return `<section class="tl" aria-label="Tempo dall'apertura">
      <div class="tl-h">
        <div><span class="lbl">Aperta da</span><b>${dur(age)}</b></div>
        <div class="tl-due ${over ? 'is-over' : left !== null && left < 864e5 * 1.5 ? 'is-near' : ''}">${due ? (over ? `Scaduta da ${dur(-left)}` : `Scade tra ${dur(left)}`) : 'Senza scadenza'}</div>
      </div>
      <div class="tl-track">
        <span class="tl-fill${over ? ' is-over' : ''}" style="width:${pos(NOW)}%"></span>
        ${D.milestones.map(([t, l]) => `<button type="button" class="tl-m" style="left:${pos(d(t))}%" data-tip="${l} · ${t.slice(0, 5)} ${t.slice(11)}" aria-label="${l}, ${t}"></button>`).join('')}
        <span class="tl-now${pos(NOW) > 88 ? ' is-end' : pos(NOW) < 8 ? ' is-start' : ''}" style="left:${pos(NOW)}%" data-tip="Ora · 03/11 14:20"><span>ora</span></span>
        ${due ? `<span class="tl-end" style="left:${pos(due)}%"></span>` : ''}
      </div>
      <div class="tl-l"><span>${D.open.slice(0, 5)} ${D.open.slice(11)}</span><span>${due ? 'Scadenza ' + D.due.slice(0, 5) + ' ' + D.due.slice(11) : ''}</span></div>
    </section>`;
  };

  // ── Proprietà modificabili ───────────────────────────────────────
  let ppOpen = false;
  const props = (V) => `<section class="pp${ppOpen ? ' is-open' : ''}" aria-label="Proprietà">
      <button type="button" class="pp-t" data-pp-toggle aria-expanded="${ppOpen}" aria-controls="pp-grid">
        <span class="pp-pm" aria-hidden="true"></span><span class="pp-tl">Proprietà</span>
        <span class="pp-sum">${ppOpen ? '<span class="pp-hint">clic su un valore per modificarlo · si salva subito</span>' : `${prBadge(V.pr)}<span class="pp-who"><span class="ava">${ini(V.who)}</span>${V.who}</span>`}</span>
      </button>
      <div class="pp-grid" id="pp-grid"${ppOpen ? '' : ' hidden'}>
        <button type="button" class="pp-i" data-edit="st"><span class="k">Stato</span><span class="v">${stBadge(V.st)}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i" data-edit="pr"><span class="k">Priorità</span><span class="v">${prBadge(V.pr)}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i" data-edit="who"><span class="k">Assegnata a</span><span class="v"><span class="ava">${ini(V.who)}</span>${V.who}</span>${ic('chevD')}</button>
        <button type="button" class="pp-i" data-edit="due"><span class="k">Scadenza</span><span class="v">${V.due || '<span class="none">Nessuna</span>'}</span>${ic('calendar')}</button>
        <button type="button" class="pp-i" data-edit="sn"><span class="k">ServiceNow</span><span class="v code">${V.sn || '<span class="none">Da collegare</span>'}</span>${ic('wrench')}</button>
        <button type="button" class="pp-i" data-edit="cli"><span class="k">Cliente · sito</span><span class="v">${V.cli} · ${V.site}</span>${ic('chevD')}</button>
      </div>
    </section>`;

  // ── Procedura: con articolo Wiki o senza ─────────────────────────
  const procedure = (D) => {
    if (D.kb) {
      const done = D.kb.steps.filter((x) => x[1]).length;
      return `<section class="ck"><h4>Procedura <span>${done} di ${D.kb.steps.length}</span></h4>
        ${D.kb.steps.map(([t, c]) => `<label><input type="checkbox"${c ? ' checked' : ''}> ${t}</label>`).join('')}
        <a href="#" class="ck-src">${ic('book')}Dalla Wiki: «${D.kb.title}»</a></section>`;
    }
    return `<section class="ck ck-nokb"><h4>Procedura</h4>
      <a href="#" class="ck-src">${ic('search')}Cerca nella Wiki</a></section>`;
  };

  const details = (D, V) => `
    ${props(V)}
    ${D.next ? `<div class="next">
      <div class="nx-h"><span>Prossimo passo</span><span class="nx-who"><span class="ava">${ini(D.next.who)}</span>${D.next.who} · ${D.next.when}</span></div>
      <p>${D.next.text}</p>
      <button class="btn btn-sm" type="button" data-next-done>${tick}Fatto</button>
    </div>` : `<button type="button" class="next next-empty">${ic('plus')}<span><b>Definisci il prossimo passo</b>Chi fa cosa, e quando</span></button>`}
    ${timeline(D)}
    ${procedure(D)}
    <section class="where">
      <h4>Dove intervenire</h4>
      ${D.where.map(([i, b, s]) => `<div class="w-row">${ic(i)}<div><b>${b}</b><span>${s}</span></div></div>`).join('')}
      <div class="w-row locked">${ic('lock')}<div><b>${D.lockedLabel}</b><span>Richiede il permesso «Vedi credenziali»</span></div><button class="btn btn-sm" type="button" disabled>Mostra</button></div>
    </section>`;

  const actItem = (a) => a[0] === 'ev'
    ? `<div class="ev" data-kind="mod">${ic(a[1])}<span><b>${a[2]}</b> ${a[3]}</span><time>${a[4]}</time></div>`
    : `<div class="cm" data-kind="cm"><span class="ava">${ini(a[1])}</span><div class="bub${a[2] === 'cliente' ? ' is-client' : ''}"><div class="bh"><b>${a[1]}</b><span class="${a[2] === 'cliente' ? 'tag-portal' : 'tag-int'}">${a[2] === 'cliente' ? 'Cliente' : 'Interno'}</span><time>${a[4]}</time></div><p>${a[3]}</p></div></div>`;

  const activity = (D) => `
    <div class="act-f" role="group" aria-label="Filtra attività">
      <button type="button" aria-pressed="true" data-af="all">Tutto <span>${D.activity.length}</span></button>
      <button type="button" aria-pressed="false" data-af="cm">Commenti <span>${D.activity.filter((a) => a[0] === 'cm').length}</span></button>
      <button type="button" aria-pressed="false" data-af="mod">Modifiche <span>${D.activity.filter((a) => a[0] === 'ev').length}</span></button>
    </div>
    <div class="feed" data-feed>${D.activity.map(actItem).join('')}</div>`;

  const FT = { log: ['LOG', 'file'], img: ['PNG', 'eye'], pdf: ['PDF', 'file'], xls: ['XLSX', 'file'] };
  const files = (D) => `
    <label class="drop">${ic('download')}<span><b>Trascina qui i file</b> o <u>sfoglia</u><small>Fino a 25 MB · log, immagini, PDF</small></span><input type="file" multiple hidden></label>
    ${D.files.length ? `<ul class="files">${D.files.map(([t, n, sz, who, when, pub]) => `
      <li><span class="ft ft-${t}">${FT[t][0]}</span>
        <div class="fn"><b>${n}</b><span>${sz} · ${who} · ${when}</span></div>
        ${pub ? '<span class="tag-portal">Visibile al cliente</span>' : '<span class="tag-int">Interno</span>'}
        <button class="icon-btn" type="button" aria-label="Scarica ${n}">${ic('download')}</button>
        <button class="icon-btn" type="button" aria-label="Altre azioni su ${n}">${ic('more')}</button></li>`).join('')}</ul>`
      : '<p class="files-empty">Nessun allegato. I file caricati dal cliente nel Portale compaiono qui.</p>'}`;

  const foot = {
    det: '<div class="drawer-foot"><button class="btn" type="button" data-quick="me">' + ic('user') + 'Assegna a me</button><span class="g-spacer"></span><button class="btn btn-primary" type="button">' + ic('wrench') + 'Registra intervento</button></div>',
    att: `<div class="composer"><textarea aria-label="Scrivi un commento" placeholder="Scrivi un commento… usa @ per menzionare un collega"></textarea>
      <div class="cmp-row"><label class="vis"><input type="checkbox"> Visibile al cliente nel Portale</label><span class="g-spacer"></span><button class="btn btn-primary btn-sm" type="button" data-comment>Commenta</button></div></div>`,
    all: '<div class="drawer-foot"><span class="foot-note">I file interni non sono mai visibili nel Portale.</span><span class="g-spacer"></span><button class="btn btn-primary" type="button">' + ic('plus') + 'Carica file</button></div>',
  };

  const render = () => {
    if (!cur) return;
    const D = DET[cur] || generic(row);
    const V = state[cur];
    root.innerHTML = `<div class="drawer-body int-body" data-tabp="${tab}">${tab === 'det' ? details(D, V) : tab === 'att' ? activity(D) : files(D)}</div>${foot[tab]}`;
    const me = root.querySelector('[data-quick="me"]'); if (me && V.who === 'F. Mutuale') { me.disabled = true; me.title = 'Già assegnata a te'; }
    const wt = root.querySelector('[data-quick="attesa"]'); if (wt && V.st === 'attesa') { wt.disabled = true; wt.title = 'Già in attesa'; }
    document.querySelectorAll('.drawer-head .tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const n = document.querySelector('.drawer-head .tabs [data-tab="att"] .tn'); if (n) n.textContent = D.activity.length;
    const f = document.querySelector('.drawer-head .tabs [data-tab="all"] .tn'); if (f) f.textContent = D.files.length;
  };

  // ── Testata: schede con contatore ─────────────────────────────────
  const tabs = document.querySelector('.drawer-head .tabs');
  tabs.innerHTML = '<button role="tab" data-tab="det" aria-selected="true">Dettagli</button><button role="tab" data-tab="att" aria-selected="false">Attività <span class="tn"></span></button><button role="tab" data-tab="all" aria-selected="false">Allegati <span class="tn"></span></button>';
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });

  const load = () => {
    const tr = tbody.querySelector('tr.is-selected'); if (!tr) return;
    const id = Number(tr.dataset.id); if (id === cur) return;
    cur = id; row = Preview.ROWS.find((r) => r.id === id);
    if (!state[id]) state[id] = { st: row.st, pr: row.pr, who: row.who, due: row.due, sn: row.sn, cli: row.cli, site: row.site };
    render();
  };
  new MutationObserver(() => setTimeout(load)).observe(tbody, { subtree: true, attributes: true, attributeFilter: ['class'] });
  load();

  // ── Modifica sul posto: menu, salvataggio immediato, annulla ─────
  const OPTS = {
    st: () => Object.keys(ST).map((k) => [k, stBadge(k)]),
    pr: () => Object.keys(PR).reverse().map((k) => [k, prBadge(k)]),
    who: () => PEOPLE.map((p) => [p, `<span class="ava">${ini(p)}</span>${p}`]),
    cli: () => [[row.cli + '|' + row.site, `${row.cli} · ${row.site}`], ['AUSL Bologna|Osp. Maggiore', 'AUSL Bologna · Osp. Maggiore']],
  };
  const LABEL = { st: 'lo stato', pr: 'la priorità', who: 'l\'assegnatario', due: 'la scadenza', sn: 'il caso ServiceNow', cli: 'cliente e sito' };
  const DONE = { st: 'Stato aggiornato', pr: 'Priorità aggiornata', who: 'Assegnatario aggiornato', due: 'Scadenza aggiornata', sn: 'Caso ServiceNow aggiornato', cli: 'Cliente e sito aggiornati' };
  const fmt = (k, v) => k === 'st' ? ST[v] : k === 'pr' ? PR[v] : v || '—';

  const closePop = () => { pop.hidden = true; pop.innerHTML = ''; };
  const place = (anchor) => {
    const r = anchor.getBoundingClientRect(); const dr = drawer.getBoundingClientRect();
    pop.style.left = (r.left - dr.left) + 'px'; pop.style.top = (r.bottom - dr.top + 4) + 'px'; pop.style.minWidth = r.width + 'px';
  };
  const apply = (k, v) => {
    const V = state[cur]; const prev = k === 'cli' ? `${V.cli}|${V.site}` : V[k];
    if (prev === v) return;
    const set = (val) => { if (k === 'cli') { const [c, s] = val.split('|'); V.cli = c; V.site = s; } else V[k] = val; };
    set(v);
    const D = DET[cur] || (DET[cur] = generic(row));
    D.activity.push(['ev', 'activity', 'F. Mutuale', `ha cambiato ${LABEL[k]} da <b>${fmt(k, k === 'cli' ? prev.replace('|', ' · ') : prev)}</b> a <b>${fmt(k, k === 'cli' ? v.replace('|', ' · ') : v)}</b>`, 'adesso']);
    syncRow(); render(); flash(k);
    undo = () => { set(prev); D.activity.pop(); syncRow(); render(); flash(k); };
    showToast(DONE[k] + ' · salvato');
  };
  const flash = (k) => { const el = root.querySelector(`[data-edit="${k}"]`); if (el) { el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); } };
  const syncRow = () => {
    const V = state[cur]; const tr = tbody.querySelector(`tr[data-id="${cur}"]`); if (!tr) return;
    const st = tr.querySelector('.c-st .st'); if (st) st.outerHTML = stBadge(V.st);
    const pr = tr.querySelector('.c-pr .pr'); if (pr) pr.outerHTML = prBadge(V.pr);
    const who = tr.querySelector('.c-who'); if (who) who.textContent = V.who;
    const dst = document.getElementById('dst'); if (dst) dst.outerHTML = stBadge(V.st).replace('<span class="st', '<span id="dst" class="st');
  };
  let tt = null;
  const showToast = (msg) => {
    toast.innerHTML = `${tick}<span>${msg}</span><button type="button" data-undo>Annulla</button>`;
    toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 6000);
  };
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toast.hidden = true; } });

  root.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const k = ed.dataset.edit; e.stopPropagation();
      if (OPTS[k]) {
        const V = state[cur]; const curV = k === 'cli' ? `${V.cli}|${V.site}` : V[k];
        pop.innerHTML = OPTS[k]().map(([v, h]) => `<button type="button" role="menuitemradio" aria-checked="${v === curV}" data-v="${v}">${h}<span class="ok">${tick}</span></button>`).join('');
        pop.dataset.k = k; place(ed); pop.hidden = false; pop.querySelector('button')?.focus();
      } else {
        const V = state[cur]; const vEl = ed.querySelector('.v');
        vEl.innerHTML = `<input class="inl${k === 'sn' ? ' code' : ''}" value="${V[k] || ''}" placeholder="${k === 'due' ? 'gg/mm' : 'CS0000000'}" aria-label="${LABEL[k]}">`;
        const inp = vEl.querySelector('input'); inp.focus(); inp.select();
        const done = (save) => { if (save) apply(k, inp.value.trim()); else render(); };
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); done(true); } if (ev.key === 'Escape') { ev.stopPropagation(); done(false); } });
        inp.addEventListener('blur', () => done(true), { once: true });
        inp.addEventListener('click', (ev) => ev.stopPropagation());
      }
      return;
    }
    if (e.target.closest('[data-pp-toggle]')) { ppOpen = !ppOpen; render(); root.querySelector('[data-pp-toggle]')?.focus(); return; }
    if (e.target.closest('[data-quick="attesa"]')) { apply('st', 'attesa'); return; }
    if (e.target.closest('[data-quick="me"]')) { apply('who', 'F. Mutuale'); return; }
    const af = e.target.closest('[data-af]');
    if (af) {
      root.querySelectorAll('[data-af]').forEach((b) => b.setAttribute('aria-pressed', String(b === af)));
      root.querySelectorAll('[data-feed] > [data-kind]').forEach((n) => { n.hidden = af.dataset.af !== 'all' && n.dataset.kind !== af.dataset.af; });
      return;
    }
    if (e.target.closest('[data-comment]')) {
      const ta = root.querySelector('.composer textarea'); const t = ta.value.trim(); if (!t) { ta.focus(); return; }
      const pub = root.querySelector('.composer .vis input').checked;
      (DET[cur] || (DET[cur] = generic(row))).activity.push(['cm', 'F. Mutuale', pub ? 'cliente' : 'interno', t.replace(/</g, '&lt;'), 'adesso']);
      render(); const feed = root.querySelector('[data-feed]'); feed?.lastElementChild?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.target.closest('[data-next-done]')) { const n = root.querySelector('.next'); n.classList.add('is-done'); n.querySelector('[data-next-done]').innerHTML = tick + 'Fatto · definisci il prossimo'; }
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-add-step]'); if (!f) return; e.preventDefault();
    const v = f.querySelector('input').value.trim(); if (!v) return;
    const D = DET[cur] || (DET[cur] = generic(row)); (D.manual || (D.manual = [])).push([v, 0]); render();
    root.querySelector('[data-add-step] input')?.focus();
  });
  pop.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { apply(pop.dataset.k, b.dataset.v); closePop(); } });
  pop.addEventListener('keydown', (e) => {
    const items = [...pop.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); closePop(); }
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('[data-pop]')) closePop(); });

  // Tooltip sulla timeline.
  const tip = document.createElement('div'); tip.className = 'kpi-tip'; tip.hidden = true; document.body.appendChild(tip);
  root.addEventListener('pointerover', (e) => { const m = e.target.closest('.tl [data-tip]'); if (!m) return; const r = m.getBoundingClientRect(); tip.textContent = m.dataset.tip; tip.style.left = r.left + r.width / 2 + 'px'; tip.style.top = r.top + 'px'; tip.hidden = false; });
  root.addEventListener('pointerout', (e) => { if (e.target.closest('.tl [data-tip]')) tip.hidden = true; });

  // Menu "altre azioni" nella testata: il modulo completo resta disponibile.
  const more = document.querySelector('[data-dmore]');
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.innerHTML = `<button type="button" data-mod-all>${ic('wrench')}Modifica tutti i campi</button><button type="button">${ic('copy')}Duplica issue</button><button type="button">${ic('file')}Esporta in PDF</button><hr><button type="button" class="danger">${ic('trash')}Sposta nel cestino</button>`;
    pop.dataset.k = ''; const r = more.getBoundingClientRect(); const dr = drawer.getBoundingClientRect();
    pop.style.minWidth = '220px'; pop.style.left = (r.right - dr.left - 220) + 'px'; pop.style.top = (r.bottom - dr.top + 4) + 'px'; pop.hidden = false;
  });
  pop.addEventListener('click', (e) => { if (e.target.closest('[data-mod-all]')) { html.setAttribute('data-dct', '0'); closePop(); } });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { html.setAttribute('data-dct', '3'); if (b.hasAttribute('data-save-all')) showToast('Modifiche salvate'); }));
})();
