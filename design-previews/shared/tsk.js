/* Task di area senza drawer (anteprima tsk-base, 18/11/2026): il task nella finestra dei record, sullo
   schema della issue approvata (iss-base A). Testata con stato, area e azione principale che segue il
   ciclo (Inizia → Completa, Riprendi, Riapri); posizione e frecce sempre a destra. Al centro descrizione,
   allegati da Drive e attività con il commento in fondo; a lato dettagli (stato, priorità, assegnatario al
   volo; «Assegna a me» accanto), tempo e «Trasforma in issue». I dati si leggono come testo, «Modifica» nel
   ⋯ li rende campi. Chi non è dell'area vede il task in sola lettura. Oggi: 18/11/2026 10:30. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const STATUS = { da_fare: ['Da fare', 'aperta'], in_corso: ['In corso', 'lav'], in_attesa: ['In attesa', 'att'], completato: ['Completato', 'ok'] }
  const PRIO = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Bassa' }
  const USERS = ['Federico Mutuale', 'Marco Bassi', 'Nicole Spazzoli', 'Anna Ferri']
  const T = (o) => ({ comments: [], events: [], files: [], who: '', due: '', issue: null, edit: true, ...o })
  const TASKS = [
    T({ id: 214, title: 'Rinnovare i certificati TLS dei nodi PACS', st: 'in_corso', pr: 'high', who: 'Federico Mutuale', area: 'Sistemi', by: 'Marco Bassi', created: '2026-11-10T09:00', due: '2026-11-21',
      desc: 'I certificati dei nodi 1 e 2 scadono il 30/11. Generare le CSR, farle firmare dalla CA interna e installarle in una finestra concordata con la radiologia.',
      files: [['Procedura rinnovo certificati.pdf', '214 KB', 'PDF'], ['CSR nodo1.txt', '2 KB', 'TXT']],
      comments: [['Marco Bassi', '2026-11-12T11:20', 'La CA interna risponde in 2 giorni lavorativi, conviene mandare le CSR entro venerdì.'], ['Federico Mutuale', '2026-11-17T16:05', 'CSR inviate. Finestra concordata per giovedì alle 7.']],
      events: [['Marco Bassi', '2026-11-10T09:00', 'ha creato il task'], ['Federico Mutuale', '2026-11-11T08:30', 'ha cambiato lo stato da Da fare a In corso']] }),
    T({ id: 209, title: 'Aggiornare l\'inventario dei monitor diagnostici', st: 'da_fare', pr: 'medium', who: '', area: 'Sistemi', by: 'Nicole Spazzoli', created: '2026-11-14T15:00', due: '2026-11-28', desc: 'Censire i monitor delle sale refertazione con seriale e data dell\'ultima calibrazione.' }),
    T({ id: 205, title: 'Preparare il piano ferie di dicembre', st: 'in_attesa', pr: 'low', who: 'Anna Ferri', area: 'Amministrazione', by: 'Anna Ferri', created: '2026-11-05T10:00', due: '2026-11-30', edit: false, desc: 'Raccogliere le richieste e verificare la copertura reperibilità.' }),
    T({ id: 198, title: 'Verificare spazio libero sugli storage', st: 'completato', pr: 'medium', who: 'Nicole Spazzoli', area: 'Sistemi', by: 'Marco Bassi', created: '2026-11-03T08:00', due: '2026-11-07', desc: 'Controllo mensile.', comments: [['Nicole Spazzoli', '2026-11-06T17:00', 'Tutti sotto l\'80%, nessuna azione.']] }),
    T({ id: 191, title: 'Errore di stampa sulla DryView di Imola', st: 'completato', pr: 'high', who: 'Marco Bassi', area: 'Sistemi', by: 'Marco Bassi', created: '2026-10-28T09:00', due: '', issue: [1038, 'Stampante pellicole non risponde'], desc: 'Segnalato dal tecnico di radiologia.' }),
  ]
  const NOW = new Date('2026-11-18T10:30').getTime()
  const DAY = 864e5
  const fmt = (s) => { const d = new Date(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
  const fmtT = (s) => { const d = new Date(s); return `${fmt(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
  const dur = (ms) => { const h = Math.round(Math.abs(ms) / 36e5); const g = Math.floor(h / 24); return g >= 1 ? `${g} ${g === 1 ? 'giorno' : 'giorni'}` : `${h} ${h === 1 ? 'ora' : 'ore'}` }
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  let open = null; let sel = 0; let editing = false; let menu = false; let pick = null; let comment = ''; let feedF = 'all'
  const drafts = new Map()
  const root = $('[data-tsk]')
  const KEYS = ['title', 'desc', 'due']
  const FIELDS = (x) => Object.fromEntries(KEYS.map((k) => [k, x[k] ?? '']))
  const draft = (n) => { if (!drafts.has(n)) drafts.set(n, FIELDS(TASKS[n])); return drafts.get(n) }
  const changes = (n) => { const d = draft(n); const o = FIELDS(TASKS[n]); return KEYS.filter((f) => d[f] !== o[f]) }
  const dirty = (f) => (draft(open)[f] !== FIELDS(TASKS[open])[f] ? ' dirty' : '')
  const cur = () => (editing ? draft(open) : FIELDS(TASKS[open]))
  const x_ = () => TASKS[open]
  const canEdit = () => x_().edit && !x_().issue

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const sec = (id, title, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const none = '<span class="ikv-none">—</span>'
  const prioMark = (p) => `<span class="pmark p-${p}" aria-hidden="true"><i></i><i></i><i></i></span>`
  const stTag = (s) => `<span class="st ${STATUS[s][1]}">${STATUS[s][0]}</span>`
  const quick = (k, label, valueHtml, opts, after = '') => `<div class="ikv qk${k === 'who' ? ' wide' : ''}"><span>${label}</span><span class="qrow"><span class="menu-anchor"><button type="button" class="qbtn" data-pick="${k}" aria-haspopup="menu"${canEdit() ? '' : ' disabled'}>${valueHtml}${canEdit() ? ic('chevD') : ''}</button>${pick === k ? `<div class="inv-menu qmenu" role="menu">${opts.map(([v, l]) => `<button type="button" role="menuitemradio" data-set="${k}:${v}">${l}</button>`).join('')}</div>` : ''}</span>${after}</span></div>`
  const kv = (f, label, { type = 'text', fmtV = (v) => esc(v), wide = false } = {}) => {
    const v = cur()[f]
    if (editing) return `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span><input data-f="${f}" type="${type}" value="${esc(v)}" class="${dirty(f)}"></label>`
    return `<div class="ikv${wide ? ' wide' : ''}"><span>${label}</span><b>${v ? fmtV(v) : none}</b></div>`
  }

  const props = (x) => `<div class="ikvs">
      ${editing ? kv('title', 'Titolo', { wide: true }) : ''}
      ${quick('st', 'Stato', stTag(x.st), Object.keys(STATUS).map((s) => [s, stTag(s)]))}
      ${quick('pr', 'Priorità', `<span class="pv">${prioMark(x.pr)}${PRIO[x.pr]}</span>`, Object.keys(PRIO).map((p) => [p, `<span class="pv">${prioMark(p)}${PRIO[p]}</span>`]))}
      ${quick('who', 'Assegnato a', x.who ? `<span class="pv"><span class="uav sm">${ini(x.who)}</span>${esc(x.who)}</span>` : '<span class="pv" style="color:var(--warning)">Da assegnare</span>', [['', 'Nessuno'], ...USERS.map((u) => [u, `<span class="pv"><span class="uav sm">${ini(u)}</span>${u}</span>`])], !x.who && canEdit() ? '<button type="button" class="lnk me-lnk" data-me>Assegna a me</button>' : '')}
      ${kv('due', 'Scadenza', { type: 'date', fmtV: (v) => v.split('-').reverse().join('/') })}
      <div class="ikv"><span>Area</span><b>${esc(x.area)}</b></div>
      <div class="ikv wide"><span>Creato</span><b>${fmt(x.created)}/2026 · ${esc(x.by)}</b></div>
    </div>`
  const timeline = (x) => {
    const op = new Date(x.created).getTime(); const done = x.st === 'completato'
    const end = NOW; const due = x.due ? new Date(`${x.due}T18:00`).getTime() : null
    const over = !done && due != null && NOW > due
    const span = Math.max((due && due > end ? due : end + Math.max((end - op) * 0.25, DAY / 2)) - op, 1)
    const pos = (t) => Math.max(0, Math.min(100, ((t - op) / span) * 100))
    const tone = over ? 'err' : due != null && due - NOW < DAY * 1.5 && !done ? 'warn' : ''
    return `<div class="tl"><div class="tl-h"><div><small>${done ? 'Completato' : 'Aperto da'}</small><b>${dur(end - op)}</b></div><span class="tl-tag ${tone}">${done ? 'Completato' : due == null ? 'Senza scadenza' : over ? `Scaduto da ${dur(NOW - due)}` : `Scade tra ${dur(due - NOW)}`}</span></div>
      <div class="tl-bar"><i class="dash"></i><i class="fill${over ? ' over' : ''}" style="width:${pos(end)}%"></i><i class="dot" style="left:0"></i>${!done ? `<i class="now" style="left:${pos(NOW)}%"><em>ORA</em></i>` : ''}${due ? `<i class="due" style="left:${pos(due)}%"></i>` : ''}</div>
      <div class="tl-f"><span>${fmt(x.created)}</span><span>${x.due ? `Scadenza ${x.due.split('-').reverse().join('/')}` : ''}</span></div></div>`
  }
  const files = (x) => `${x.files.length ? `<div class="rows">${x.files.map(([n, sz, ext], i) => `<div class="row r-file"><span class="ext${ext === 'PDF' ? ' pdf' : ''}">${ext}</span><span class="t"><b>${esc(n)}</b><small>${sz} · in Drive</small></span><span class="acts"><button class="icon-btn" type="button" aria-label="Scarica ${esc(n)}">${ic('download')}</button>${canEdit() ? `<button class="icon-btn" type="button" data-unlink="${i}" aria-label="Scollega ${esc(n)}" title="Scollega dal task (il file resta in Drive)">${ic('x')}</button>` : ''}</span></div>`).join('')}</div>` : '<p class="empty-s">Nessun file collegato.</p>'}
    <p class="acc-note">${ic('folder')}I file restano nella loro cartella di Drive: il task ne tiene solo il collegamento.</p>`
  const feed = (x) => {
    const items = [...x.comments.map((c) => ({ k: 'cm', at: c[1], c })), ...x.events.map((e) => ({ k: 'ev', at: e[1], e }))].sort((a, b) => a.at.localeCompare(b.at))
    const shown = items.filter((i) => feedF === 'all' || i.k === feedF)
    const seg = `<div class="typefilter" role="group" aria-label="Filtra attività">${[['all', 'Tutto', items.length], ['cm', 'Commenti', x.comments.length], ['ev', 'Modifiche', x.events.length]].map(([k, l, n]) => `<button type="button" data-feed="${k}" aria-pressed="${feedF === k}">${l} ${n}</button>`).join('')}</div>`
    const list = shown.length ? shown.map((i) => i.k === 'cm'
      ? `<div class="cm"><span class="uav sm">${ini(i.c[0])}</span><div class="cm-b"><div class="cm-h"><b>${esc(i.c[0])}</b><time>${fmtT(i.c[1])}</time></div><p>${esc(i.c[2])}</p></div></div>`
      : `<div class="ev">${ic('history')}<span><b>${esc(i.e[0])}</b> ${esc(i.e[2])}</span><time>${fmtT(i.e[1])}</time></div>`).join('') : '<p class="empty-s">Nessun commento.</p>'
    const box = !canEdit() ? '' : `<div class="composer"><textarea data-comment placeholder="Scrivi un commento… (Ctrl+Invio per inviare)" aria-label="Scrivi un commento" rows="2">${esc(comment)}</textarea><button class="btn btn-primary" type="button" data-send${comment.trim() ? '' : ' disabled'}>Commenta</button></div>`
    return sec('att', `Attività${muted(items.length)}`, `<div class="feed">${list}</div>${box}`, seg)
  }

  // ═══ Finestra ═══════════════════════════════════════════════════
  const primary = (x) => {
    if (!canEdit() || editing) return ''
    if (x.st === 'da_fare') return `<button class="btn on-band solid" type="button" data-to="in_corso">${ic('arrowR')}Inizia</button>`
    if (x.st === 'in_corso') return `<button class="btn on-band solid" type="button" data-to="completato">${ic('check')}Completa</button>`
    if (x.st === 'in_attesa') return `<button class="btn on-band solid" type="button" data-to="in_corso">${ic('arrowR')}Riprendi</button>`
    return `<button class="btn on-band" type="button" data-to="in_corso">Riapri</button>`
  }
  const record = () => {
    const x = x_(); const d = cur(); const L = TASKS.length
    const due = x.due ? new Date(`${x.due}T18:00`).getTime() : null
    const done = x.st === 'completato'
    const over = !done && due != null && NOW > due
    const moreMenu = menu ? `<div class="inv-menu" role="menu">
        <button type="button" role="menuitem" data-edit${canEdit() ? '' : ' disabled'}>${ic('columns')}Modifica</button>
        ${x.st === 'in_corso' && canEdit() ? `<button type="button" role="menuitem" data-to="in_attesa">${ic('clock')}Metti in attesa</button>` : ''}
        <button type="button" role="menuitem" data-menu-close${canEdit() ? '' : ' disabled'}>${ic('folder')}Collega file da Drive</button>
        ${!done && canEdit() ? `<button type="button" role="menuitem" data-menu-close>${ic('alert')}Trasforma in issue…</button>` : ''}
        <button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il link</button>
        <button type="button" role="menuitem" class="danger" data-menu-close${canEdit() ? '' : ' disabled'}>${ic('trash')}Elimina</button></div>` : ''
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2><span class="code" style="opacity:.75;font-weight:500">T-${x.id}</span> ${esc(d.title)}<span class="ven-b">${STATUS[x.st][0]}</span>${!x.edit ? `<span class="ven-b">${ic('lock')} Sola lettura</span>` : ''}${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p>Area <b style="font-weight:600">${esc(x.area)}</b> · creato da ${esc(x.by)} il ${fmt(x.created)}</p>
        <div class="rec-tags"><span class="bstat${x.pr === 'critical' ? ' warn' : ''}">priorità <b>${PRIO[x.pr].toLowerCase()}</b></span><span class="bstat${x.who || done ? '' : ' warn'}">${x.who ? `assegnato a <b>${esc(x.who)}</b>` : 'da assegnare'}</span>${due != null && !done ? `<span class="bstat${over || due - NOW < DAY * 1.5 ? ' warn' : ''}">${over ? 'scaduto' : `scade il <b>${fmt(x.due)}</b>`}</span>` : ''}<button type="button" class="bstat" data-goto="att"><b>${x.comments.length}</b> ${x.comments.length === 1 ? 'commento' : 'commenti'}</button><button type="button" class="bstat" data-goto="file"><b>${x.files.length}</b> ${x.files.length === 1 ? 'allegato' : 'allegati'}</button></div></div>
        <div class="rec-act">${primary(x)}
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${moreMenu}</span>
          <span class="rec-nav${editing ? ' off' : ''}"><span class="rec-pos">${open + 1} di ${L}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span></div>
      </div></header>`
    const banner = x.issue ? `<div class="conv">${ic('alert')}<span>Trasformato nella <b>issue #${x.issue[0]}</b> · ${esc(x.issue[1])}: il lavoro continua lì.</span><button class="btn" type="button">Apri la issue</button></div>` : ''
    const main = `<div class="rec-main">${banner}
        ${sec('desc', 'Descrizione', editing ? `<label class="ikv wide"><span>Testo</span><textarea data-f="desc" class="notes${dirty('desc')}" rows="4">${esc(d.desc)}</textarea></label>` : `<p class="notes-ro">${esc(x.desc) || '<span style="color:var(--faint)">Nessuna descrizione.</span>'}</p>`)}
        ${sec('file', `Allegati${muted(x.files.length)}`, files(x), canEdit() ? '<button class="lnk" type="button">+ Collega da Drive</button>' : '')}
        ${feed(x)}
      </div>`
    const convert = !done && canEdit() && !x.issue ? `<button type="button" class="conv-card">${ic('alert')}<span><b>Serve un intervento su un cliente?</b><small>Trasforma il task in issue: eredita titolo, priorità e commenti, il task si chiude.</small></span></button>` : ''
    const rail = `<aside class="rec-rail" aria-label="Task">${rcard('Dettagli', props(x))}${rcard('Tempo', timeline(x))}${convert}</aside>`
    const n = editing ? changes(open).length : 0
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record${editing ? ' is-editing' : ''}">${head}<div class="rec-body">${main}${rail}</div>${bar}</div>`
  }

  // ═══ Pagina ═════════════════════════════════════════════════════
  const dueCell = (x) => { if (!x.due || x.st === 'completato') return '—'; const t = new Date(`${x.due}T18:00`).getTime(); return `<span class="${t < NOW ? 'due-over' : t - NOW < DAY * 1.5 ? 'due-soon' : ''}">${fmt(x.due)}</span>` }
  const table = () => `<table class="po-table c-list"><thead><tr><th>Task</th><th>Area</th><th>Priorità</th><th>Stato</th><th>Assegnato a</th><th>Scadenza</th></tr></thead><tbody>${TASKS.map((x, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${esc(x.title)}</b><br><small style="color:var(--muted)">T-${x.id}${x.comments.length ? ` · ${x.comments.length} commenti` : ''}</small></td><td>${esc(x.area)}</td><td><span class="pv">${prioMark(x.pr)}${PRIO[x.pr]}</span></td><td>${stTag(x.st)}</td><td>${x.who ? esc(x.who) : '<span style="color:var(--warning)">Da assegnare</span>'}</td><td>${dueCell(x)}</td></tr>`).join('')}</tbody></table>`
  const view = () => `<div class="mt-head"><h1>Task di area</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo task</button></div></div>
    <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire. Il task 205 è di un'altra area: si apre in sola lettura.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Task ${x_().id}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  const render = (keepScroll = true) => {
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view()
    const s2 = $('.ud-scrim', root); if (s2) s2.scrollTop = sc || 0
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Task')))
  }
  const leave = () => open == null || !editing || !changes(open).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const reset = () => { if (open != null) drafts.delete(open); editing = false; menu = false; pick = null; comment = ''; feedF = 'all' }
  const openRec = (i) => { if (!leave()) return; reset(); open = i; sel = i; render(false) }
  const close = () => { if (!leave()) return; reset(); open = null; render() }

  root.addEventListener('click', (e) => {
    const t = e.target; const x = open != null ? x_() : null
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) return close()
    if (t.closest('[data-menu]')) { menu = !menu; pick = null; return render() }
    if (t.closest('[data-edit]') && canEdit()) { menu = false; editing = true; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    const pk = t.closest('[data-pick]'); if (pk) { pick = pick === pk.dataset.pick ? null : pk.dataset.pick; menu = false; return render() }
    const st = t.closest('[data-set]'); if (st) { const [k, v] = st.dataset.set.split(':'); x[k] = v; pick = null; return render() }
    const to = t.closest('[data-to]'); if (to) { x.st = to.dataset.to; menu = false; x.events.push(['Federico Mutuale', '2026-11-18T10:30', `ha cambiato lo stato in ${STATUS[x.st][0]}`]); return render() }
    if ((menu || pick) && !t.closest('.inv-menu')) { menu = false; pick = null; render() }
    const row = t.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = t.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + TASKS.length) % TASKS.length)
    const g = t.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const fd = t.closest('[data-feed]'); if (fd) { feedF = fd.dataset.feed; return render() }
    const ul = t.closest('[data-unlink]'); if (ul) { x.files.splice(Number(ul.dataset.unlink), 1); return render() }
    if (t.closest('[data-me]')) { x.who = 'Federico Mutuale'; return render() }
    if (t.closest('[data-send]')) { if (comment.trim()) { x.comments.push(['Federico Mutuale', '2026-11-18T10:30', comment.trim()]); comment = '' } return render() }
    if (t.closest('[data-discard]')) { drafts.delete(open); editing = false; return render() }
    if (t.closest('[data-save]')) { Object.assign(x, draft(open)); drafts.delete(open); editing = false; return render() }
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-comment]')) { comment = e.target.value; const b = $('[data-send]', root); if (b) b.disabled = !comment.trim(); return }
    const f = e.target.dataset.f; if (!f || open == null || !editing) return
    draft(open)[f] = e.target.value
    e.target.classList.toggle('dirty', draft(open)[f] !== FIELDS(x_())[f])
    const rec = $('.record', root); const tmp = document.createElement('div'); tmp.innerHTML = record()
    $('.rec-head', rec).replaceWith($('.rec-head', tmp)); $('.savebar', rec)?.replaceWith($('.savebar', tmp))
  })
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('tr[data-row]')) { e.preventDefault(); openRec(Number(e.target.dataset.row)) }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('[data-comment]')) { e.preventDefault(); $('[data-send]', root)?.click() }
  })
  document.addEventListener('keydown', (e) => {
    if ($('[data-palette-bg]')?.hidden === false || e.target.matches('input, textarea, select')) return
    if (e.key === 'Escape') { if (menu || pick) { menu = false; pick = null; return render() } if (open != null) close() }
  })

  open = qs.get('chiuso') ? null : 0
  render(false)
})()
