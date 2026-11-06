/* Task di area (anteprima sulla base h, struttura del PO).
   Modello reale: AreaTask (area = LeaveArea, title, description, status da_fare → in_corso →
   in_attesa → completato, priority low…critical, due_date, assigned_to, drive_files M2M,
   created_by, completed_at, converted_to_issue) + AreaTaskComment. Chi è nell'area modifica,
   le altre aree sono in sola lettura; i completati spariscono dalle liste dopo 3 giorni.
   Dati finti. Oggi: 06/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TODAY = new Date(2026, 10, 6);
  const DAY = 864e5;
  const dt = (s) => { if (!s) return null; const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  const days = (s) => Math.round((dt(s) - TODAY) / DAY);
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Task di area');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Dati ──────────────────────────────────────────────────────────
  const ME = 'F. Mutuale';
  const MY_AREA = 'AVEC';
  const AREAS = { AVEC: ['F. Mutuale', 'L. Romano', 'A. Ferri', 'G. Neri'], Romagna: ['C. Bassi', 'P. Righi', 'M. Lodi'] };
  const ST = { da_fare: 'Da fare', in_corso: 'In corso', in_attesa: 'In attesa', completato: 'Completato' };
  const ST_ORDER = ['da_fare', 'in_corso', 'in_attesa', 'completato'];
  // Stessi segni di forma delle Issue: pieno = da fare, metà = in corso, anello = fermo, spunta = fatto.
  const ST_CLS = { da_fare: 'aperta', in_corso: 'lavorazione', in_attesa: 'attesa', completato: 'risolta' };
  const MARK = {
    aperta: '<circle cx="6" cy="6" r="4" fill="currentColor"/>',
    lavorazione: '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor"/>',
    attesa: '<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    risolta: '<path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const PR = { critica: 'Critica', alta: 'Alta', media: 'Media', bassa: 'Bassa' };
  const PR_RANK = { critica: 0, alta: 1, media: 2, bassa: 3 };

  const ROWS = [
    { id: 41, area: 'AVEC', title: 'Rinnovare i certificati TLS dei gateway HL7', desc: 'I certificati dei gateway HL7 di Imola e Bologna scadono a fine mese. Generare le CSR, farle firmare e installarle in finestra concordata.', st: 'in_corso', pr: 'alta', who: 'F. Mutuale', due: '07/11/2026', created: '27/10/2026', by: 'L. Romano',
      cm: [['L. Romano', 'Ho già chiesto la firma per Imola, Bologna la mando lunedì.', '28/10, 10:12'], ['F. Mutuale', 'Ok, installo Imola giovedì sera dopo le 20.', '04/11, 17:40']],
      files: [['csr-gw-imola.pem', '2 KB', 'Certificati / 2026', 'L. Romano', '28/10'], ['procedura-rinnovo-tls.pdf', '214 KB', 'Procedure / Integrazioni', 'F. Mutuale', '29/10']] },
    { id: 40, area: 'AVEC', title: 'Inventario monitor di refertazione Osp. Maggiore', desc: 'Censire seriali e date di calibrazione dei monitor di refertazione e caricarli in Archie.', st: 'da_fare', pr: 'media', who: 'A. Ferri', due: '14/11/2026', created: '30/10/2026', by: 'F. Mutuale', cm: [], files: [] },
    { id: 39, area: 'AVEC', title: 'Preparare il piano ferie di dicembre', desc: 'Raccogliere le richieste e verificare la copertura reperibilità tra Natale e Capodanno.', st: 'da_fare', pr: 'bassa', who: '', due: '20/11/2026', created: '02/11/2026', by: 'G. Neri', cm: [['G. Neri', 'Chi lo prende? Servono le date entro il 20.', '02/11, 09:30']], files: [] },
    { id: 38, area: 'AVEC', title: 'Aggiornare la procedura di backup VNA in Wiki', desc: 'La procedura cita ancora il vecchio storage. Allineare screenshot e percorsi al nodo 2.', st: 'in_attesa', pr: 'media', who: 'L. Romano', due: '04/11/2026', created: '21/10/2026', by: 'L. Romano', waiting: 'in attesa delle credenziali del nuovo storage',
      cm: [['L. Romano', 'Bloccato: mi servono le credenziali della console del nodo 2.', '31/10, 15:02']], files: [['schema-backup-vna.png', '380 KB', 'Wiki / Immagini', 'L. Romano', '22/10']] },
    { id: 37, area: 'AVEC', title: 'Verificare spazio disco dei server di management', desc: 'Tre server sopra l\'85%. Pulire i log vecchi e valutare l\'espansione.', st: 'in_corso', pr: 'critica', who: 'F. Mutuale', due: '06/11/2026', created: '03/11/2026', by: 'A. Ferri', cm: [['A. Ferri', 'Management 2 di Bazzano è al 94%.', '03/11, 08:55']], files: [] },
    { id: 36, area: 'AVEC', title: 'Formazione nuovi tecnici su Archie', desc: 'Due sessioni da un\'ora: anagrafiche, issue e Site Repository.', st: 'da_fare', pr: 'bassa', who: 'G. Neri', due: '', created: '25/10/2026', by: 'F. Mutuale', cm: [], files: [['slide-archie-base.pdf', '2,1 MB', 'Formazione', 'G. Neri', '26/10']] },
    { id: 35, area: 'AVEC', title: 'Sostituire switch rack radiologia Imola', desc: 'Lo switch in sala server della radiologia perde pacchetti. Ordinare il ricambio e pianificare la sostituzione.', st: 'completato', pr: 'alta', who: 'A. Ferri', due: '05/11/2026', created: '22/10/2026', by: 'F. Mutuale', done: '04/11/2026', issue: 1047, cm: [['A. Ferri', 'Serve l\'intervento in sede con il cliente: lo trasformo in issue.', '04/11, 11:20']], files: [] },
    { id: 34, area: 'AVEC', title: 'Chiudere le issue risolte da più di 30 giorni', desc: '', st: 'completato', pr: 'bassa', who: 'L. Romano', due: '', created: '28/10/2026', by: 'L. Romano', done: '05/11/2026', cm: [], files: [] },
    { id: 33, area: 'AVEC', title: 'Rivedere le regole di notifica email', desc: 'Troppe email sui commenti interni. Proporre un filtro per ruolo.', st: 'in_attesa', pr: 'media', who: 'F. Mutuale', due: '12/11/2026', created: '19/10/2026', by: 'G. Neri', waiting: 'in attesa del parere del responsabile', cm: [], files: [] },
    { id: 32, area: 'Romagna', title: 'Collaudo nuova CR Fuji Ospedale del Delta', desc: 'Verificare invio al PACS e dose SR dopo l\'installazione.', st: 'in_corso', pr: 'alta', who: 'C. Bassi', due: '10/11/2026', created: '29/10/2026', by: 'P. Righi', cm: [['P. Righi', 'Il fornitore arriva martedì alle 9.', '30/10, 12:00']], files: [] },
    { id: 31, area: 'Romagna', title: 'Aggiornare le VLAN del Portale per Lugo', desc: '', st: 'da_fare', pr: 'media', who: 'M. Lodi', due: '03/11/2026', created: '20/10/2026', by: 'C. Bassi', cm: [], files: [] },
    { id: 30, area: 'Romagna', title: 'Stampare le etichette K-Number per Faenza', desc: '', st: 'da_fare', pr: 'bassa', who: '', due: '', created: '01/11/2026', by: 'M. Lodi', cm: [], files: [] },
  ];
  ROWS.forEach((r) => { r.ev = [['plus', r.by, 'ha creato il task', r.created.slice(0, 5)]]; if (r.who) r.ev.push(['user', r.by, `ha assegnato il task a <b>${r.who}</b>`, r.created.slice(0, 5)]); if (r.st !== 'da_fare') r.ev.push(['activity', r.who || r.by, `ha cambiato lo stato in <b>${ST[r.st]}</b>`, r.done ? r.done.slice(0, 5) : '03/11']); if (r.issue) r.ev.push(['alert', r.who, `ha trasformato il task nella issue <b>#${r.issue}</b>`, r.done.slice(0, 5)]); });

  // ── Elementi ─────────────────────────────────────────────────────
  const ini = (n) => n.split(/[\s.]+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const stBadge = (st) => `<span class="st st-${ST_CLS[st]}"><svg class="mk" viewBox="0 0 12 12" aria-hidden="true">${MARK[ST_CLS[st]]}</svg><span>${ST[st]}</span></span>`;
  const prBadge = (p) => `<span class="pr pr-${p}"><span class="pr-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${PR[p]}</span>`;
  const whoCell = (w) => w ? `<span class="t-who"><span class="ava">${ini(w)}</span>${esc(w)}</span>` : '<span class="t-nobody">Da assegnare</span>';
  const isOpen = (r) => r.st !== 'completato';
  const isLate = (r) => isOpen(r) && r.due && days(r.due) < 0;
  const dueCell = (r) => {
    if (!r.due) return '<span class="none">—</span>';
    if (!isOpen(r)) return `<span class="t-due-d">${r.due.slice(0, 5)}</span>`;
    const n = days(r.due);
    const tag = n < 0 ? `<small class="late">scaduto da ${-n} ${-n === 1 ? 'giorno' : 'giorni'}</small>` : n === 0 ? '<small class="today">oggi</small>' : n <= 3 ? `<small class="soon">tra ${n} ${n === 1 ? 'giorno' : 'giorni'}</small>` : '';
    return `<span class="t-due-d">${r.due.slice(0, 5)}</span>${tag}`;
  };
  const writable = (r) => r.area === MY_AREA;

  // ── Stato pagina ──────────────────────────────────────────────────
  let area = MY_AREA; let view = 'open';
  const inArea = () => ROWS.filter((r) => area === 'all' || r.area === area);
  const VIEWS = [
    ['open', 'Aperti', isOpen],
    ['mine', 'I miei', (r) => isOpen(r) && r.who === ME],
    ['late', 'Scaduti', isLate, 'v-alert'],
    ['nobody', 'Da assegnare', (r) => isOpen(r) && !r.who],
    ['done', 'Completati', (r) => !isOpen(r)],
    ['all', 'Tutti', () => true],
  ];

  // Testata: area e conteggi
  const paintHead = () => {
    $('[data-areas]').innerHTML = [[MY_AREA, `${MY_AREA}<small>la tua</small>`], ...Object.keys(AREAS).filter((a) => a !== MY_AREA).map((a) => [a, a]), ['all', 'Tutte']]
      .map(([k, l]) => `<button type="button" data-area="${k}" aria-pressed="${k === area}">${l}</button>`).join('');
    const rs = inArea(); const open = rs.filter(isOpen);
    $('[data-t-meta]').innerHTML = `<b>${open.length}</b> aperti · <b class="${rs.filter(isLate).length ? 'm-err' : ''}">${rs.filter(isLate).length}</b> scaduti · <b>${open.filter((r) => r.who === ME).length}</b> assegnati a te`;
    const nb = $('[data-new]'); const can = area === MY_AREA || area === 'all';
    nb.disabled = !can; nb.title = can ? `Nuovo task nell'area ${MY_AREA}` : `Puoi creare task solo nell'area ${MY_AREA}`;
    const ro = $('[data-t-ro]');
    ro.hidden = area === MY_AREA;
    ro.innerHTML = area === 'all'
      ? `${ic('lock')}<span>Stai vedendo tutte le aree: i task di <b>${Object.keys(AREAS).filter((a) => a !== MY_AREA).join(', ')}</b> sono in sola lettura.</span>`
      : `${ic('lock')}<span>Area <b>${area}</b> · sola lettura. Puoi leggere task, commenti e allegati; li modifica chi fa parte dell'area.</span>`;
  };

  // ── Indicatori ───────────────────────────────────────────────────
  const kpiWrap = $('[data-t-kpis]');
  const spark = (vals, labels, unit) => {
    const W = 84, H = 30, min = Math.min(...vals) - .5, max = Math.max(...vals) + .5;
    const x = (i) => (i / (vals.length - 1)) * W; const y = (v) => H - ((v - min) / (max - min)) * H;
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="area" d="M0,${H} L${pts.join(' L')} L${W},${H}Z"/><path class="line" d="M${pts.join(' L')}"/><circle class="end" cx="${W}" cy="${y(vals.at(-1))}" r="3"/></svg>`;
  };
  const flagX = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5 11 10.5H1z" fill="currentColor"/></svg>';
  const flagC = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 3.5V6l1.6 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const renderKpis = () => {
    const rs = inArea(); const open = rs.filter(isOpen); const late = rs.filter(isLate);
    const today = open.filter((r) => r.due && days(r.due) === 0).length;
    const week = open.filter((r) => r.due && days(r.due) > 0 && days(r.due) <= 7).length;
    const mine = open.filter((r) => r.who === ME);
    const trend = [5, 5, 6, 6, 7, 6, 6, 7, 7, 8, 7, 7, 6, 7].map((v) => Math.max(0, v - 7 + open.length));
    const by = ['da_fare', 'in_corso', 'in_attesa'].map((s) => [s, open.filter((r) => r.st === s).length]);
    const tot = by.reduce((a, b) => a + b[1], 0) || 1;
    const seq = { da_fare: 'var(--seq-2)', in_corso: 'var(--seq-3)', in_attesa: 'var(--seq-1)' };
    kpiWrap.innerHTML = `<div class="kpis" role="group" aria-label="Indicatori task di area">
      <button type="button" class="kpi" data-goview="open" aria-pressed="${view === 'open'}"><span class="kpi-h">Aperti<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${open.length}</span>
        <span class="kpi-s"><b>${open.filter((r) => days(r.created) >= -7).length}</b>&nbsp;creati negli ultimi 7 giorni</span>${spark(trend, [], String)}</button>
      <button type="button" class="kpi" data-goview="late" aria-pressed="${view === 'late'}"><span class="kpi-h">Scaduti<span class="go">${ic('arrowR')}</span></span>
        <span class="kpi-v">${late.length}${late.length ? ` <span class="kpi-flag err">${flagX}oltre la scadenza</span>` : ''}</span>
        <span class="kpi-s">${today ? `<span class="kpi-flag warn">${flagC}${today} oggi</span>` : ''}<b>${week}</b>&nbsp;entro 7 giorni</span></button>
      <button type="button" class="kpi" data-goview="mine" aria-pressed="${view === 'mine'}"><span class="kpi-h">Assegnati a te<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${mine.length}</span>
        <span class="kpi-s"><b>${mine.filter((r) => r.st === 'in_corso').length}</b>&nbsp;in corso · <b>${mine.filter((r) => r.st === 'in_attesa').length}</b>&nbsp;in attesa</span></button>
      <button type="button" class="kpi" data-goview="nobody" aria-pressed="${view === 'nobody'}"><span class="kpi-h">Da assegnare<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${open.filter((r) => !r.who).length}</span>
        <span class="kpi-s">${rs.filter((r) => !isOpen(r)).length} completati negli ultimi 3 giorni</span></button>
      <div class="kpi kpi-prio"><span class="kpi-h">Aperti per stato</span>
        <div class="bar" aria-hidden="true">${by.map(([s, n]) => `<span style="flex:${n};background:${seq[s]}" data-tip="${ST[s]} · <b>${n}</b>"></span>`).join('')}</div>
        <div class="lg">${by.map(([s, n]) => `<button type="button" data-stfilter="${s}"><i style="background:${seq[s]}"></i>${ST[s]} <b>${Math.round(n / tot * 100)}%</b></button>`).join('')}</div></div>
    </div>`;
  };

  // ── Tabella ──────────────────────────────────────────────────────
  const dueBucket = (r) => { if (!r.due) return 'Senza scadenza'; if (!isOpen(r)) return 'Completati'; const n = days(r.due); return n < 0 ? 'Scaduti' : n === 0 ? 'Oggi' : n <= 7 ? 'Entro 7 giorni' : 'Oltre 7 giorni'; };
  const COLS = [
    { k: 'c-pr', l: 'Priorità', set: (r) => PR[r.pr], cmp: (a, b) => PR_RANK[a.pr] - PR_RANK[b.pr] },
    { k: 'c-st', l: 'Stato', set: (r) => ST[r.st], cmp: (a, b) => ST_ORDER.indexOf(a.st) - ST_ORDER.indexOf(b.st) },
    { k: 'c-title', l: 'Titolo', cmp: (a, b) => a.title.localeCompare(b.title, 'it') },
    { k: 'c-who', l: 'Assegnato a', set: (r) => r.who || 'Da assegnare', cmp: (a, b) => (a.who || '~').localeCompare(b.who || '~', 'it') },
    { k: 'c-due', l: 'Scadenza', set: dueBucket, cmp: (a, b) => (dt(a.due) ?? 9e15) - (dt(b.due) ?? 9e15) },
    { k: 'c-area', l: 'Area', set: (r) => r.area, cmp: (a, b) => a.area.localeCompare(b.area), onlyAll: true },
    { k: 'c-open', l: 'Creato', cmp: (a, b) => dt(a.created) - dt(b.created) },
  ];
  const cols = () => COLS.filter((c) => !c.onlyAll || area === 'all');
  const filters = {}; let sort = { k: 'c-due', dir: 1 };
  const headRow = $('[data-t-head]'); const tbody = $('[data-t-rows]');
  const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
  const arrow = (d) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d > 0 ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'}"/></svg>`;
  const paintTableHead = () => {
    headRow.innerHTML = cols().map((c) => `<th class="${c.k}" data-col="${c.k}"><div class="th-in"><button type="button" class="th-sort${sort.k === c.k ? ' is-on' : ''}" data-sort="${c.k}">${c.l}${sort.k === c.k ? arrow(sort.dir) : ''}</button>${c.set ? `<button type="button" class="th-filter${filters[c.k]?.size ? ' is-on' : ''}" data-filter="${c.k}" aria-label="Filtra ${c.l}" title="Filtra ${c.l}">${funnel}</button>` : ''}</div></th>`).join('');
  };
  const visible = () => {
    const c = COLS.find((x) => x.k === sort.k);
    return inArea().filter(VIEWS.find((v) => v[0] === view)[2])
      .filter((r) => Object.entries(filters).every(([k, s]) => !s.size || s.has(COLS.find((x) => x.k === k).set(r))))
      .sort((a, b) => sort.dir * c.cmp(a, b) || PR_RANK[a.pr] - PR_RANK[b.pr] || b.id - a.id);
  };
  let selected = null;
  const renderRows = () => {
    const rows = visible(); const show = cols().map((c) => c.k);
    tbody.innerHTML = rows.map((r) => `<tr data-id="${r.id}" tabindex="0" class="${r.id === selected ? 'is-selected' : ''}${isOpen(r) ? '' : ' is-done'}">
      <td class="c-pr">${prBadge(r.pr)}</td>
      <td class="c-st">${stBadge(r.st)}${r.st === 'in_attesa' && r.waiting ? `<span class="wait">${esc(r.waiting)}</span>` : ''}</td>
      <td class="c-title"><span class="t">${esc(r.title)}</span><span class="t-meta2">
        ${r.cm.length ? `<span title="${r.cm.length} commenti">${ic('chat')}${r.cm.length}</span>` : ''}
        ${r.files.length ? `<span title="${r.files.length} allegati da Drive">${ic('folder')}${r.files.length}</span>` : ''}
        ${r.issue ? `<span class="t-iss">${ic('arrowR')}Issue #${r.issue}</span>` : ''}
        ${!writable(r) && area === 'all' ? `<span class="t-lock" title="Sola lettura">${ic('lock')}</span>` : ''}</span></td>
      <td class="c-who">${whoCell(r.who)}</td>
      <td class="c-due num">${dueCell(r)}</td>
      ${show.includes('c-area') ? `<td class="c-area"><span class="t-areatag${r.area === MY_AREA ? ' is-mine' : ''}">${r.area}</span></td>` : ''}
      <td class="c-open"><span class="t-due-d">${r.created.slice(0, 5)}</span><small>${esc(r.by)}</small></td>
    </tr>`).join('') || `<tr><td colspan="${show.length}" class="t-empty">${view === 'late' ? 'Nessun task scaduto. ' : 'Nessun task con questi filtri.'}</td></tr>`;
    $('[data-t-foot]').innerHTML = `<span><b>${rows.length}</b> di ${inArea().length} task</span>${view === 'done' || view === 'all' ? '<span>I completati restano in elenco per 3 giorni dalla chiusura.</span>' : ''}<span class="sp"></span><span>dati fittizi</span>`;
    paintTokens(); paintViews();
  };
  const paintViews = () => {
    $('[data-t-views]').innerHTML = VIEWS.map(([k, l, f, cls]) => { const n = inArea().filter(f).length; return `<button type="button" aria-pressed="${k === view}" data-view="${k}"${cls && n ? ` class="${cls}"` : ''}>${l} <span>${n}</span></button>`; }).join('') + `<button class="v-add" type="button" aria-pressed="false">${ic('plus')}Salva vista</button>`;
  };
  const paintTokens = () => {
    const t = Object.entries(filters).filter(([, s]) => s.size).map(([k, s]) => `<span class="token"><span class="tk">${COLS.find((c) => c.k === k).l}</span> <b>${[...s].join(', ')}</b><button type="button" class="tk-x" data-unf="${k}" aria-label="Rimuovi filtro">${ic('x')}</button></span>`);
    $('[data-t-tokens]').innerHTML = t.length ? t.join('') + '<button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button>' : '<span class="none" style="font-size:12px">Filtra e ordina dalle intestazioni di colonna</span>';
  };
  const refresh = () => { paintHead(); renderKpis(); paintTableHead(); renderRows(); if (selected) render(); };

  $('[data-areas]').addEventListener('click', (e) => { const b = e.target.closest('[data-area]'); if (!b) return; area = b.dataset.area; delete filters['c-area']; if (selected && !inArea().some((r) => r.id === selected)) close(); refresh(); });
  $('[data-t-views]').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { view = b.dataset.view; refresh(); } });
  kpiWrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goview]'); if (b) { view = b.dataset.goview; refresh(); return; }
    const s = e.target.closest('[data-stfilter]'); if (s) { view = 'open'; filters['c-st'] = new Set([ST[s.dataset.stfilter]]); refresh(); }
  });
  $('[data-t-tokens]').addEventListener('click', (e) => { const b = e.target.closest('[data-unf]'); if (!b) return; if (b.dataset.unf === '*') Object.keys(filters).forEach((k) => delete filters[k]); else delete filters[b.dataset.unf]; refresh(); });

  const cpop = document.createElement('div'); cpop.className = 'cpop'; cpop.hidden = true; document.body.appendChild(cpop);
  headRow.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sort]');
    if (s) { sort = sort.k === s.dataset.sort ? { k: s.dataset.sort, dir: -sort.dir } : { k: s.dataset.sort, dir: 1 }; refresh(); return; }
    const f = e.target.closest('[data-filter]'); if (!f) return; e.stopPropagation();
    const c = COLS.find((x) => x.k === f.dataset.filter); const cur = filters[c.k] || new Set();
    const vals = [...new Set(inArea().map(c.set))].sort((a, b) => a.localeCompare(b, 'it'));
    cpop.innerHTML = `<div class="srt"><button type="button" data-cs="1">Crescente</button><button type="button" data-cs="-1">Decrescente</button></div>
      ${vals.map((v) => `<label><input type="checkbox" value="${v}"${cur.has(v) ? ' checked' : ''}>${v}<small>${inArea().filter((r) => c.set(r) === v).length}</small></label>`).join('')}
      <div class="cp-f"><button type="button" class="btn btn-ghost btn-sm" data-cclear>Rimuovi filtro</button><button type="button" class="btn btn-primary btn-sm" data-capply>Applica</button></div>`;
    cpop.dataset.k = c.k; const r = f.getBoundingClientRect();
    cpop.style.left = Math.min(r.right - 240, innerWidth - 256) + 'px'; cpop.style.top = (r.bottom + 6) + 'px'; cpop.hidden = false;
  });
  cpop.addEventListener('click', (e) => {
    const k = cpop.dataset.k;
    if (e.target.closest('[data-cs]')) sort = { k, dir: Number(e.target.closest('[data-cs]').dataset.cs) };
    else if (e.target.closest('[data-cclear]')) delete filters[k];
    else if (e.target.closest('[data-capply]')) filters[k] = new Set([...cpop.querySelectorAll('input:checked')].map((i) => i.value));
    else return;
    cpop.hidden = true; refresh();
  });
  document.addEventListener('click', (e) => { if (!cpop.hidden && !e.target.closest('.cpop')) cpop.hidden = true; });

  // ── Pannello di dettaglio ────────────────────────────────────────
  const drawer = $('[data-t-drawer]'); const body = $('[data-tbody]'); const pop = $('[data-tpop]'); const shell = $('.shell');
  let tab = 'det'; let ppOpen = false;
  const row = () => ROWS.find((r) => r.id === selected);
  const NEXT = { da_fare: ['in_corso', 'Inizia', 'activity'], in_corso: ['completato', 'Completa', 'task'], in_attesa: ['in_corso', 'Riprendi', 'activity'] };

  const props = (r, w) => `<section class="pp${ppOpen ? ' is-open' : ''}" aria-label="Proprietà">
      <button type="button" class="pp-t" data-pp-toggle aria-expanded="${ppOpen}"><span class="pp-pm" aria-hidden="true"></span><span class="pp-tl">Proprietà</span>
        <span class="pp-sum">${ppOpen ? `<span class="pp-hint">${w ? 'clic su un valore per modificarlo · si salva subito' : 'sola lettura'}</span>` : `${prBadge(r.pr)}${r.who ? `<span class="pp-who"><span class="ava">${ini(r.who)}</span>${esc(r.who)}</span>` : '<span class="t-nobody">Da assegnare</span>'}`}</span></button>
      <div class="pp-grid"${ppOpen ? '' : ' hidden'}>
        ${[['st', 'Stato', stBadge(r.st), 'chevD'], ['pr', 'Priorità', prBadge(r.pr), 'chevD'], ['who', 'Assegnato a', r.who ? `<span class="ava">${ini(r.who)}</span>${esc(r.who)}` : '<span class="t-nobody">Da assegnare</span>', 'chevD'], ['due', 'Scadenza', r.due || '<span class="none">Nessuna</span>', 'calendar']]
          .map(([k, l, v, i]) => `<button type="button" class="pp-i" data-edit="${k}"${w ? '' : ' disabled'}><span class="k">${l}</span><span class="v">${v}</span>${w ? ic(i) : ''}</button>`).join('')}
        <div class="pp-i is-ro"><span class="k">Area</span><span class="v">${r.area}</span>${ic('lock')}</div>
        <div class="pp-i is-ro pp-full"><span class="k">Creato</span><span class="v">${r.created} · ${esc(r.by)}</span></div>
      </div></section>`;

  const timeline = (r) => {
    const o = dt(r.created); const due = r.due ? dt(r.due) : null; const done = r.done ? dt(r.done) : null;
    const now = done || TODAY; const age = Math.round((now - o) / DAY);
    const end = due && due > now ? due : new Date(now.getTime() + Math.max((now - o) * 0.25, DAY));
    const pos = (t) => Math.max(0, Math.min(100, ((t - o) / (end - o)) * 100));
    const left = due ? Math.round((due - TODAY) / DAY) : null;
    const over = isOpen(r) && due && left < 0;
    const badge = !isOpen(r) ? `Completato il ${r.done.slice(0, 5)}` : !due ? 'Senza scadenza' : over ? `Scaduto da ${-left} ${-left === 1 ? 'giorno' : 'giorni'}` : left === 0 ? 'Scade oggi' : `Scade tra ${left} ${left === 1 ? 'giorno' : 'giorni'}`;
    return `<section class="tl" aria-label="Tempo dalla creazione">
      <div class="tl-h"><div><span class="lbl">${isOpen(r) ? 'Aperto da' : 'Chiuso in'}</span><b>${age} ${age === 1 ? 'giorno' : 'giorni'}</b></div>
        <div class="tl-due ${over ? 'is-over' : isOpen(r) && due && left <= 1 ? 'is-near' : ''}">${badge}</div></div>
      <div class="tl-track"><span class="tl-fill${over ? ' is-over' : ''}" style="width:${pos(now)}%"></span>
        <span class="tl-now${pos(now) > 88 ? ' is-end' : pos(now) < 8 ? ' is-start' : ''}" style="left:${pos(now)}%"><span>${done ? 'chiuso' : 'oggi'}</span></span>
        ${due ? `<span class="tl-end" style="left:${pos(due)}%"></span>` : ''}</div>
      <div class="tl-l"><span>Creato ${r.created.slice(0, 5)}</span><span>${due ? 'Scadenza ' + r.due.slice(0, 5) : ''}</span></div>
    </section>`;
  };

  const bubble = ([who, text, when]) => `<div class="cm"><span class="ava">${ini(who)}</span><div class="bub"><div class="bh"><b>${esc(who)}</b><time>${when}</time></div><p>${esc(text)}</p></div></div>`;
  const details = (r, w) => `
    ${r.issue ? `<div class="t-conv">${ic('alert')}<span>Trasformato nella <b>issue #${r.issue}</b> il ${r.done.slice(0, 5)}: il lavoro continua lì.</span><button type="button" class="c-link" data-toast="Si apre la issue #${r.issue}">Apri</button></div>` : ''}
    ${props(r, w)}
    ${timeline(r)}
    <section class="t-desc"><div class="t-sec-h"><h4>Descrizione</h4>${w ? `<button type="button" class="c-link" data-edit-desc>Modifica</button>` : ''}</div>
      ${r.desc ? `<p class="desc-p">${esc(r.desc)}</p>` : `<p class="none t-nodesc">Nessuna descrizione.${w ? ' Aggiungi il contesto per chi prende il task.' : ''}</p>`}
      ${r.st === 'in_attesa' && r.waiting ? `<p class="t-wait">${ic('clock')}In attesa: ${esc(r.waiting)}</p>` : ''}</section>
    <section><div class="t-sec-h"><h4>Ultimo commento</h4>${r.cm.length ? `<button type="button" class="c-link" data-tab="cm">Tutti i commenti (${r.cm.length})</button>` : ''}</div>
      ${r.cm.length ? `<div class="feed t-last">${bubble(r.cm.at(-1))}</div>` : `<button type="button" class="t-firstcm" data-tab="cm"${w ? '' : ' disabled'}>${ic('chat')}<span>${w ? 'Scrivi il primo commento' : 'Nessun commento'}</span></button>`}</section>`;

  const comments = (r) => `<div class="feed">${r.cm.length ? r.cm.map(bubble).join('') : '<p class="files-empty">Nessun commento. Chi è assegnato al task riceve un\'email a ogni nuovo commento.</p>'}</div>`;
  const FT = { pdf: 'PDF', png: 'PNG', pem: 'PEM' };
  const files = (r, w) => `${w ? `<div class="t-drive">${ic('folder')}<span><b>Allegati da Drive</b>I file restano nella loro cartella di Drive: il task ne tiene solo il collegamento.</span></div>` : ''}
    ${r.files.length ? `<ul class="files">${r.files.map(([n, sz, path, who, when]) => { const ext = n.split('.').pop(); return `<li><span class="ft ft-${ext === 'pdf' ? 'pdf' : ext === 'png' ? 'img' : 'log'}">${FT[ext] || ext.toUpperCase()}</span>
      <div class="fn"><b>${esc(n)}</b><span>${sz} · ${ic('folder')}${esc(path)} · ${esc(who)}, ${when}</span></div><span></span>
      <button class="icon-btn" type="button" aria-label="Scarica ${esc(n)}">${ic('download')}</button>
      ${w ? `<button class="icon-btn" type="button" aria-label="Scollega ${esc(n)}" title="Scollega dal task (il file resta in Drive)">${ic('x')}</button>` : '<span></span>'}</li>`; }).join('')}</ul>`
      : '<p class="files-empty">Nessun file collegato.</p>'}`;
  const activity = (r) => `<div class="feed">${r.ev.map(([i, w, t, d]) => `<div class="ev">${ic(i)}<span><b>${esc(w)}</b> ${t}</span><time>${d}</time></div>`).join('')}</div>`;

  const footer = (r, w) => {
    if (!w) return `<div class="drawer-foot"><span class="foot-note t-ro-note">${ic('lock')}Sola lettura · area ${r.area}</span></div>`;
    if (tab === 'det') {
      const nx = NEXT[r.st];
      return `<div class="drawer-foot">${r.who !== ME && isOpen(r) ? `<button class="btn" type="button" data-me>${ic('user')}Assegna a me</button>` : ''}${r.st === 'in_corso' ? `<button class="btn" type="button" data-wait>${ic('clock')}Metti in attesa</button>` : ''}
        <span class="g-spacer"></span>${nx ? `<button class="btn btn-primary" type="button" data-advance>${ic(nx[2])}${nx[1]}</button>` : r.issue ? `<span class="foot-note">${tick}Chiuso il ${r.done.slice(0, 5)}</span>` : `<button class="btn" type="button" data-reopen>${ic('restore')}Riapri</button>`}</div>`;
    }
    if (tab === 'cm') return `<div class="composer"><textarea aria-label="Scrivi un commento" placeholder="Scrivi un commento… usa @ per menzionare un collega dell'area"></textarea>
      <div class="cmp-row"><span class="t-cmhint">${r.who && r.who !== ME ? `${esc(r.who)} riceverà un'email` : 'Nessuna email: il task è tuo o non è assegnato'}</span><span class="g-spacer"></span><button class="btn btn-primary btn-sm" type="button" data-comment>Commenta</button></div></div>`;
    if (tab === 'all') return `<div class="drawer-foot"><span class="foot-note">Solo file già presenti in Drive.</span><span class="g-spacer"></span><button class="btn btn-primary" type="button" data-toast="Si apre la scelta dei file di Drive">${ic('folder')}Collega da Drive</button></div>`;
    return '';
  };

  const render = () => {
    const r = row(); if (!r) return;
    const w = writable(r);
    $('[data-td="id"]').textContent = 'Task #' + r.id;
    $('[data-td="st"]').innerHTML = stBadge(r.st);
    $('[data-td="title"]').textContent = r.title;
    $('[data-td="sub"]').innerHTML = `<span class="t-areatag on-dark">${r.area}</span>creato da ${esc(r.by)} il ${r.created}${w ? '' : ` · ${ic('lock')}sola lettura`}`;
    const vis = visible().map((x) => x.id); const ix = vis.indexOf(r.id);
    $('[data-td="pos"]').textContent = ix < 0 ? '' : `${ix + 1} di ${vis.length}`;
    $('[data-ttabs]').innerHTML = [['det', 'Dettagli'], ['cm', 'Commenti', r.cm.length], ['all', 'Allegati', r.files.length], ['att', 'Attività', r.ev.length]]
      .map(([k, l, n]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}${n !== undefined ? ` <span class="tn">${n}</span>` : ''}</button>`).join('');
    body.innerHTML = `<div class="drawer-body int-body">${tab === 'det' ? details(r, w) : tab === 'cm' ? comments(r) : tab === 'all' ? files(r, w) : activity(r)}</div>${footer(r, w)}`;
  };
  const open = (id) => {
    if (id !== selected) tab = 'det';
    selected = id; drawer.hidden = false; shell.classList.add('has-drawer');
    tbody.querySelectorAll('tr').forEach((t) => t.classList.toggle('is-selected', Number(t.dataset.id) === id));
    render();
  };
  const close = () => { drawer.hidden = true; selected = null; shell.classList.remove('has-drawer'); tbody.querySelectorAll('tr').forEach((t) => t.classList.remove('is-selected')); };
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); });
  tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); } });
  $('[data-tclose]').addEventListener('click', close);
  $('[data-ttabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  const step = (d) => { const vis = visible().map((x) => x.id); const n = vis[vis.indexOf(selected) + d]; if (n) { open(n); tbody.querySelector(`tr[data-id="${n}"]`)?.scrollIntoView({ block: 'nearest' }); } };
  drawer.querySelectorAll('[data-tstep]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.tstep))));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('[data-mdl]').hidden) { $('[data-mdl]').hidden = true; return; }
    if (drawer.hidden || e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape') close(); if (e.key === 'j') step(1); if (e.key === 'k') step(-1);
  });
  document.addEventListener('pointerdown', (e) => {
    if (drawer.hidden || drawer.contains(e.target) || e.target.closest('tr[data-id], .pv-bar, .toast-int, .mdl-bg, .cpop, [data-tpop]')) return;
    close();
  }, true);

  // ── Modifiche con annulla ─────────────────────────────────────────
  const toast = $('[data-toast]'); let undo = null; let tt = null;
  const showToast = (msg, u) => { undo = u; toast.innerHTML = `${tick}<span>${msg}</span>${u ? '<button type="button" data-undo>Annulla</button>' : ''}`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 6000); };
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toast.hidden = true; } });
  const LABEL = { st: 'lo stato', pr: 'la priorità', who: "l'assegnatario", due: 'la scadenza' };
  const DONE = { st: 'Stato aggiornato', pr: 'Priorità aggiornata', who: 'Assegnatario aggiornato', due: 'Scadenza aggiornata' };
  const fmt = (k, v) => k === 'st' ? ST[v] : k === 'pr' ? PR[v] : v || 'nessuno';
  const change = (r, k, v, msg) => {
    const prev = { st: r.st, pr: r.pr, who: r.who, due: r.due, done: r.done }; if (r[k] === v) return;
    r.ev.push(['activity', ME, `ha cambiato ${LABEL[k]} da <b>${fmt(k, r[k])}</b> a <b>${fmt(k, v)}</b>`, 'adesso']);
    r[k] = v; if (k === 'st') r.done = v === 'completato' ? '06/11/2026' : '';
    refresh();
    showToast(msg || `${DONE[k]} · salvato`, () => { Object.assign(r, prev); r.ev.pop(); refresh(); });
  };
  const OPTS = {
    st: () => ST_ORDER.map((k) => [k, stBadge(k)]),
    pr: () => Object.keys(PR).map((k) => [k, prBadge(k)]),
    who: (r) => [['', '<span class="t-nobody">Da assegnare</span>'], ...AREAS[r.area].map((p) => [p, `<span class="ava">${ini(p)}</span>${p}`])],
  };
  const tick2 = `<span class="ok">${tick}</span>`;
  const placePop = (anchor, minW) => { const dr = drawer.getBoundingClientRect(); const rr = anchor.getBoundingClientRect(); pop.style.left = (rr.left - dr.left) + 'px'; pop.style.top = (rr.bottom - dr.top + 4) + 'px'; pop.style.minWidth = (minW || rr.width) + 'px'; pop.hidden = false; };

  body.addEventListener('click', (e) => {
    const r = row(); if (!r) return; const w = writable(r);
    const tb = e.target.closest('[data-tab]'); if (tb && !tb.disabled) { tab = tb.dataset.tab; render(); if (tab === 'cm') body.querySelector('.composer textarea')?.focus(); return; }
    if (e.target.closest('[data-pp-toggle]')) { ppOpen = !ppOpen; render(); return; }
    const tt2 = e.target.closest('[data-toast]'); if (tt2) { showToast(tt2.dataset.toast); return; }
    if (!w) return;
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      e.stopPropagation(); const k = ed.dataset.edit;
      if (OPTS[k]) { pop.innerHTML = OPTS[k](r).map(([v, h]) => `<button type="button" role="menuitemradio" aria-checked="${v === r[k]}" data-v="${v}">${h}${tick2}</button>`).join(''); pop.dataset.k = k; placePop(ed); return; }
      const vEl = ed.querySelector('.v'); vEl.innerHTML = `<input class="inl" value="${r.due}" placeholder="gg/mm/aaaa" aria-label="Scadenza">`;
      const inp = vEl.querySelector('input'); inp.focus(); inp.select();
      const done = (save) => { if (save && /^\d{2}\/\d{2}\/\d{4}$|^$/.test(inp.value.trim())) change(r, 'due', inp.value.trim()); else render(); };
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); done(true); } if (ev.key === 'Escape') { ev.stopPropagation(); done(false); } });
      inp.addEventListener('blur', () => done(true), { once: true }); inp.addEventListener('click', (ev) => ev.stopPropagation());
      return;
    }
    if (e.target.closest('[data-advance]')) { const [to, l] = NEXT[r.st]; change(r, 'st', to, `${l === 'Completa' ? 'Task completato' : 'Stato: ' + ST[to]} · salvato`); return; }
    if (e.target.closest('[data-reopen]')) { change(r, 'st', 'in_corso', 'Task riaperto · salvato'); return; }
    if (e.target.closest('[data-wait]')) { change(r, 'st', 'in_attesa'); return; }
    if (e.target.closest('[data-me]')) { change(r, 'who', ME, 'Assegnato a te · salvato'); return; }
    if (e.target.closest('[data-edit-desc]')) {
      const sec = body.querySelector('.t-desc'); sec.querySelector('.desc-p, .t-nodesc').outerHTML = `<textarea class="t-desc-in" rows="4" aria-label="Descrizione">${esc(r.desc)}</textarea><div class="t-desc-a"><button class="btn btn-ghost btn-sm" type="button" data-desc-cancel>Annulla</button><button class="btn btn-primary btn-sm" type="button" data-desc-save>Salva</button></div>`;
      sec.querySelector('textarea').focus(); return;
    }
    if (e.target.closest('[data-desc-cancel]')) { render(); return; }
    if (e.target.closest('[data-desc-save]')) { const prev = r.desc; r.desc = body.querySelector('.t-desc-in').value.trim(); render(); showToast('Descrizione aggiornata · salvato', () => { r.desc = prev; render(); }); return; }
    if (e.target.closest('[data-comment]')) {
      const ta = body.querySelector('.composer textarea'); const t = ta.value.trim(); if (!t) { ta.focus(); return; }
      r.cm.push([ME, t, 'adesso']); refresh(); body.querySelector('.feed')?.lastElementChild?.scrollIntoView({ block: 'nearest' });
      showToast(r.who && r.who !== ME ? `Commento pubblicato · email a ${r.who}` : 'Commento pubblicato'); return;
    }
  });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); const r = row();
    if (b && r) { change(r, pop.dataset.k, b.dataset.v); pop.hidden = true; return; }
    const m = e.target.closest('[data-menu]'); if (!m || !r) return; pop.hidden = true;
    if (m.dataset.menu === 'convert') askConvert(r);
    else if (m.dataset.menu === 'delete') { r.deleted = true; const i = ROWS.indexOf(r); ROWS.splice(i, 1); close(); refresh(); showToast('Task spostato nel cestino', () => { ROWS.splice(i, 0, r); refresh(); open(r.id); }); }
    else showToast(m.textContent.trim());
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('[data-tpop]') && !e.target.closest('[data-tmore]')) pop.hidden = true; });

  // Menu "altre azioni"
  const more = $('[data-tmore]');
  more.addEventListener('click', (e) => {
    e.stopPropagation(); const r = row(); if (!r) return; const w = writable(r);
    pop.innerHTML = w
      ? `<button type="button" data-menu="edit">${ic('wrench')}Modifica tutti i campi</button>${r.issue ? '' : `<button type="button" data-menu="convert">${ic('alert')}Trasforma in issue</button>`}<button type="button" data-menu="link">${ic('copy')}Copia il link</button><hr><button type="button" class="danger" data-menu="delete">${ic('trash')}Sposta nel cestino</button>`
      : `<button type="button" data-menu="link">${ic('copy')}Copia il link</button>`;
    pop.dataset.k = ''; const rr = more.getBoundingClientRect(); const dr = drawer.getBoundingClientRect();
    pop.style.minWidth = '220px'; pop.style.left = (rr.right - dr.left - 220) + 'px'; pop.style.top = (rr.bottom - dr.top + 4) + 'px'; pop.hidden = false;
  });

  // Trasforma in issue: il task si chiude e resta collegato alla issue.
  const mdl = $('[data-mdl]');
  const askConvert = (r) => {
    $('.mdl', mdl).innerHTML = `<div class="mdl-h"><h3 id="mdl-t">Trasforma in issue</h3><p>Task #${r.id} · ${esc(r.title)}</p></div>
      <form class="mdl-b" data-mform>
        <div class="f"><label for="m-c">Cliente <span class="req">*</span></label><select id="m-c"><option value="">Scegli il cliente</option><option>AUSL Bologna</option><option>AUSL Imola</option><option>AUSL Ferrara</option></select></div>
        <div class="f"><label for="m-s">Sito</label><select id="m-s"><option>—</option><option>Ospedale Maggiore</option><option>Ospedale Bellaria</option></select></div>
        <div class="f"><label for="m-t">Titolo della issue</label><input id="m-t" value="${esc(r.title)}"></div>
        <p class="note-p" style="margin:0">${ic('lock')} Priorità, assegnatario e descrizione passano alla issue; il task viene completato e resta collegato.</p>
      </form>
      <div class="mdl-f"><button class="btn btn-ghost" type="button" data-mclose>Annulla</button><button class="btn btn-primary" type="button" data-mok>Crea la issue</button></div>`;
    mdl.hidden = false; $('#m-c', mdl).focus();
    $('[data-mclose]', mdl).onclick = () => { mdl.hidden = true; };
    $('[data-mok]', mdl).onclick = () => {
      const c = $('#m-c', mdl); if (!c.value) { c.closest('.f').classList.add('has-error'); c.focus(); return; }
      const prev = { st: r.st, done: r.done, issue: r.issue }; mdl.hidden = true;
      r.st = 'completato'; r.done = '06/11/2026'; r.issue = 1052; r.ev.push(['alert', ME, 'ha trasformato il task nella issue <b>#1052</b>', 'adesso']);
      refresh(); showToast('Issue #1052 creata · task completato', () => { Object.assign(r, prev); r.ev.pop(); refresh(); });
    };
  };
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) mdl.hidden = true; });

  $('[data-new]').addEventListener('click', () => showToast(`Nuovo task nell'area ${MY_AREA}: si apre il modulo`));

  refresh();
  const q = new URLSearchParams(location.search);
  if (q.get('area')) { area = q.get('area'); refresh(); }
  if (q.get('task')) open(Number(q.get('task')));
  if (q.get('tab')) { tab = q.get('tab'); render(); }
})();
