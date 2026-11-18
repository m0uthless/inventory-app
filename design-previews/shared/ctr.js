/* Contratti senza drawer (anteprima ctr-base, 18/11/2026): il contratto nella finestra dei record, sullo
   schema già approvato (dati come testo, «Modifica» nel ⋯, frecce sempre a destra). Testata con codice,
   titolo, stato di scadenza, cliente cliccabile e «Rinnova». Al centro il periodo con la disdetta e oggi,
   l'importo (al mese, all'anno) e i device collegati; a lato dettagli, il PDF del contratto, note e
   attività. Importo, valore e PDF solo con il permesso sui valori (il PDF riporta il prezzo).
   Dati finti modellati su /api/contracts/. Oggi: 18/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const TYPES = { assistenza: 'Assistenza', noleggio: 'Noleggio', licenza: 'Licenza', altro: 'Altro' }
  const STATI = { bozza: 'Bozza', attivo: 'Attivo', disdetto: 'Disdetto' }
  const BILL = { una_tantum: 'Una tantum', mensile: 'Mensile', trimestrale: 'Trimestrale', annuale: 'Annuale' }
  const EXP = { ok: ['In corso', 'ok'], notice: ['Preavviso', 'warn'], expiring: ['In scadenza', 'warn'], expired: ['Scaduto', 'err'], none: ['—', ''] }
  const SELLERS = ['Luca Ferraresi', 'Giulia Neri', 'Paolo Conti']
  const COMPANIES = ['Biotron', 'Philips', 'Medical Imaging']
  const C = (o) => ({ devices: [], doc: null, notes: '', renew: false, ...o })
  const CTR = [
    C({ code: 'CT-2024-018', title: 'Assistenza PACS e RIS', cust: 'AUSL Imola', type: 'assistenza', st: 'attivo', seller: 'Luca Ferraresi', company: 'Philips', bill: 'trimestrale', start: '2024-01-01', end: '2026-12-31', notice: 60, value: 186000, renew: true,
      devices: [['IntelliSpace PACS 4.4', 'CZ2391A0F'], ['Server applicativo RIS', 'DL380-778120'], ['Storage immagini', 'NTAP-AFF-9921']], doc: 'CT-2024-018 firmato.pdf', notes: 'Rinnovo da discutere con il nuovo direttore dei sistemi informativi.' }),
    C({ code: 'CT-2025-004', title: 'Noleggio workstation di refertazione', cust: 'Azienda Sanitaria Felsinea', type: 'noleggio', st: 'attivo', seller: 'Giulia Neri', company: 'Biotron', bill: 'mensile', start: '2025-03-01', end: '2028-02-29', notice: 90, value: 54000,
      devices: [['Workstation refertazione 1', 'HP-Z4-55120'], ['Workstation refertazione 2', 'HP-Z4-55121']], doc: null }),
    C({ code: 'CT-2023-031', title: 'Licenze riconoscimento vocale', cust: 'Clinica Villa Serena', type: 'licenza', st: 'attivo', seller: 'Paolo Conti', company: 'Medical Imaging', bill: 'annuale', start: '2023-12-01', end: '2026-11-30', notice: 30, value: 12600, doc: 'Licenze speech 2023.pdf' }),
    C({ code: 'CT-2022-012', title: 'Assistenza robot masterizzatore', cust: 'Azienda Ospedaliera Estense', type: 'assistenza', st: 'attivo', seller: 'Luca Ferraresi', company: 'Biotron', bill: 'annuale', start: '2022-11-01', end: '2026-10-31', notice: 60, value: 9800 }),
    C({ code: 'CT-2021-007', title: 'Noleggio stampante pellicole', cust: 'AUSL Bologna', type: 'noleggio', st: 'disdetto', seller: 'Giulia Neri', company: 'Biotron', bill: 'mensile', start: '2021-06-01', end: '2025-05-31', notice: 90, value: 21600 }),
  ]
  const NOW = new Date('2026-11-18T00:00').getTime()
  const DAY = 864e5
  const t = (s) => new Date(`${s}T00:00`).getTime()
  const dIt = (s) => (s ? s.split('-').reverse().join('/') : '')
  const dShort = (s) => new Date(`${s}T00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  const noticeOf = (x) => new Date(t(x.end) - x.notice * DAY).toISOString().slice(0, 10)
  const expiry = (x) => { if (x.st !== 'attivo') return 'none'; const e = t(x.end); if (NOW > e) return 'expired'; if (e - NOW < 30 * DAY) return 'expiring'; if (NOW >= t(noticeOf(x))) return 'notice'; return 'ok' }
  const days = (s) => Math.round((t(s) - NOW) / DAY)
  const rel = (s) => { const n = days(s); if (n === 0) return 'oggi'; if (n > 0) return n > 60 ? `tra ${Math.round(n / 30)} mesi` : `tra ${n} giorni`; return -n > 60 ? `${Math.round(-n / 30)} mesi fa` : `${-n} giorni fa` }
  const euro = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const months = (x) => Math.max(1, Math.round((t(x.end) - t(x.start)) / (30.44 * DAY)))

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  let noValue = read('archie-preview-ctr-nv', '') === '1'
  let open = null; let sel = 0; let editing = false; let menu = false
  const drafts = new Map()
  const root = $('[data-ctr]')
  const KEYS = ['code', 'title', 'type', 'st', 'seller', 'company', 'bill', 'start', 'end', 'notice', 'renew', 'value', 'notes']
  const FIELDS = (x) => Object.fromEntries(KEYS.map((k) => [k, k === 'renew' ? (x.renew ? '1' : '0') : String(x[k] ?? '')]))
  const draft = (n) => { if (!drafts.has(n)) drafts.set(n, FIELDS(CTR[n])); return drafts.get(n) }
  const changes = (n) => { const d = draft(n); const o = FIELDS(CTR[n]); return KEYS.filter((f) => d[f] !== o[f]) }
  const dirty = (f) => (draft(open)[f] !== FIELDS(CTR[open])[f] ? ' dirty' : '')
  const cur = () => (editing ? draft(open) : FIELDS(CTR[open]))

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const sec = (id, title, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const none = '<span class="ikv-none">—</span>'
  const kv = (f, label, { type = 'text', fmtV = (v) => esc(v), wide = false, mono = false } = {}) => {
    const v = cur()[f]
    if (editing) return `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span><input data-f="${f}" type="${type}" value="${esc(v)}" class="${mono ? 'mono' : ''}${dirty(f)}"></label>`
    return `<div class="ikv${wide ? ' wide' : ''}"><span>${label}</span><b class="${mono ? 'mono' : ''}">${v ? fmtV(v) : none}</b></div>`
  }
  const kvSel = (f, label, opts, wide = false) => {
    const v = cur()[f]
    if (editing) return `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span><select data-f="${f}" class="${dirty(f)}">${opts.map(([o, l]) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
    return `<div class="ikv${wide ? ' wide' : ''}"><span>${label}</span><b>${esc((opts.find(([o]) => o === v) || [, ''])[1]) || none}</b></div>`
  }

  /* Periodo: barra dall'inizio alla fine con la disdetta e oggi. */
  const period = (x) => {
    const s = t(x.start); const e = t(x.end); const span = Math.max(1, e - s)
    const pos = (v) => Math.max(0, Math.min(100, ((v - s) / span) * 100))
    const st = expiry(x); const nd = noticeOf(x)
    const tone = st === 'expired' ? 'err' : st === 'expiring' || st === 'notice' ? 'warn' : ''
    const head = x.st !== 'attivo' ? `Contratto ${STATI[x.st].toLowerCase()}` : st === 'expired' ? `Scaduto il ${dShort(x.end)}` : `Finisce ${rel(x.end)}`
    const hint = x.st !== 'attivo' ? 'Non genera più promemoria.'
      : st === 'expired' ? 'Rinnovalo o segnalo come disdetto.'
      : st === 'expiring' ? 'Meno di 30 giorni alla fine: rinnovalo o segnalo come disdetto.'
      : st === 'notice' ? `Siamo nel preavviso: la disdetta andava inviata entro il ${dShort(nd)}.`
      : `La disdetta va inviata entro il ${dShort(nd)} (${x.notice} giorni prima della fine).`
    return `<div class="pb"><i class="pb-track"></i><i class="pb-fill ${tone}" style="width:${pos(Math.min(NOW, e))}%"></i>
        <i class="pb-notice" style="left:${pos(t(nd))}%" title="Disdetta entro il ${dShort(nd)}"><em>disdetta</em></i>
        ${NOW >= s && NOW <= e ? `<i class="pb-now" style="left:${pos(NOW)}%"><em>OGGI</em></i>` : ''}</div>
      <div class="tl-f"><span>${dShort(x.start)}</span><span>${dShort(x.end)}</span></div>
      <div class="pb-box ${tone}"><b>${head}</b><small>${hint}${x.renew ? ' Rinnovo automatico indicato nel contratto.' : ''}</small></div>`
  }
  const amount = (x) => {
    const m = months(x)
    return `<div class="amt"><b>${euro(x.value)}</b><span>su ${m} mesi · fatturazione ${BILL[x.bill].toLowerCase()}</span></div>
      <div class="amt-grid"><div><small>Al mese</small><b>${euro(x.value / m)}</b></div><div><small>All'anno</small><b>${euro((x.value / m) * 12)}</b></div><div><small>Per fattura</small><b>${euro(x.bill === 'mensile' ? x.value / m : x.bill === 'trimestrale' ? (x.value / m) * 3 : x.bill === 'annuale' ? (x.value / m) * 12 : x.value)}</b></div></div>
      <p class="acc-note">${ic('lock')}Importi e PDF solo con il permesso sui valori dei contratti.</p>`
  }
  const devices = (x) => x.devices.length ? `<div class="rows">${x.devices.map(([n, sn]) => `<button type="button" class="row r-doc"><span class="doc-ic">${ic('monitor')}</span><span class="t"><b>${esc(n)}</b><small>S/N <span class="code">${esc(sn)}</span></small></span><span></span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>`).join('')}</div>`
    : '<p class="empty-s">Nessun device collegato.</p>'
  const doc = (x) => x.doc ? `<div class="docf"><span class="ext pdf">PDF</span><span class="t"><b>${esc(x.doc)}</b><small>PDF del contratto</small></span><span class="acts"><button class="icon-btn" type="button" aria-label="Apri il PDF">${ic('eye')}</button><button class="icon-btn" type="button" aria-label="Sostituisci">${ic('upload')}</button><button class="icon-btn" type="button" aria-label="Rimuovi">${ic('trash')}</button></span></div>`
    : `<button type="button" class="upl">${ic('upload')}<span><b>Carica il PDF del contratto</b><small>Un solo file, visibile a chi vede i valori</small></span></button>`
  const feed = () => `<ul class="mini-feed"><li>${ic('wrench')}<span><b>Giulia Neri</b> ha cambiato la fine da 30/11/2026 a 31/12/2026</span><time>12/11</time></li><li>${ic('upload')}<span><b>Luca Ferraresi</b> ha caricato il PDF</span><time>03/01/2024</time></li><li>${ic('plus')}<span><b>Luca Ferraresi</b> ha creato il contratto</span><time>02/01/2024</time></li></ul>`

  // ═══ Finestra ═══════════════════════════════════════════════════
  const record = () => {
    const x = CTR[open]; const d = cur(); const st = expiry(x); const L = CTR.length
    const nd = noticeOf(x)
    const moreMenu = menu ? `<div class="inv-menu" role="menu">
        <button type="button" role="menuitem" data-edit>${ic('columns')}Modifica</button>
        <button type="button" role="menuitem" data-menu-close>${ic('filter')}Tutti i campi (device)…</button>
        ${x.st === 'attivo' ? `<button type="button" role="menuitem" data-cancel>${ic('x')}Segna come disdetto</button>` : ''}
        <button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il codice</button>
        <button type="button" role="menuitem" class="danger" data-menu-close>${ic('trash')}Elimina</button></div>` : ''
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2><span class="code" style="opacity:.75;font-weight:500">${esc(d.code)}</span> ${esc(d.title)}${x.st !== 'attivo' ? `<span class="ven-b">${STATI[x.st]}</span>` : `<span class="ven-b exp-${EXP[st][1]}">${EXP[st][0]}</span>`}${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p><button type="button" class="band-link">${esc(x.cust)}</button> · ${TYPES[x.type]} · ${esc(x.company)} · venditore ${esc(x.seller)}</p>
        <div class="rec-tags">
          ${x.st === 'attivo' ? `<span class="bstat${st === 'expired' || st === 'expiring' ? ' warn' : ''}">${st === 'expired' ? `scaduto il <b>${dIt(x.end)}</b>` : `finisce il <b>${dIt(x.end)}</b>`}</span>
          <span class="bstat${st === 'notice' ? ' warn' : ''}">disdetta entro <b>${dIt(nd)}</b></span>` : `<span class="bstat">finito il <b>${dIt(x.end)}</b></span>`}
          ${x.renew ? '<span class="bstat">rinnovo automatico</span>' : ''}
          ${noValue ? '' : `<span class="bstat"><b>${euro(x.value)}</b></span>`}
          <button type="button" class="bstat" data-goto="dev"><b>${x.devices.length}</b> ${x.devices.length === 1 ? 'device' : 'device'}</button></div></div>
        <div class="rec-act">${editing ? '' : x.st === 'attivo' ? `<button class="btn on-band solid" type="button">${ic('restore')}Rinnova…</button>` : ''}
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${moreMenu}</span>
          <span class="rec-nav${editing ? ' off' : ''}"><span class="rec-pos">${open + 1} di ${L}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span></div>
      </div></header>`
    const main = `<div class="rec-main">
        ${sec('per', 'Periodo', period(x), `<span class="tl-tag ${EXP[st][1]}">${x.st === 'attivo' ? EXP[st][0] : STATI[x.st]}</span>`)}
        ${noValue ? '' : sec('amt', 'Importo', amount(x))}
        ${sec('dev', `Device${muted(x.devices.length)}`, devices(x), '<button class="lnk" type="button">Gestisci da «Tutti i campi»</button>')}
        ${sec('note', 'Note', editing ? `<label class="ikv wide"><span>Testo</span><textarea data-f="notes" class="notes${dirty('notes')}" rows="3">${esc(d.notes)}</textarea></label>` : x.notes ? `<p class="notes-ro">${esc(x.notes)}</p>` : '<p class="empty-s">Nessuna nota.</p>')}
      </div>`
    const rail = `<aside class="rec-rail" aria-label="Contratto">
        ${rcard('Dettagli', `<div class="ikvs">
          ${editing ? kv('code', 'Codice', { mono: true }) + kv('title', 'Titolo', { wide: true }) : ''}
          <div class="ikv wide"><span>Cliente</span><b><button type="button" class="ikv-link">${esc(x.cust)}${ic('arrowR')}</button></b></div>
          ${kvSel('type', 'Tipo', Object.entries(TYPES))}${kvSel('st', 'Stato', Object.entries(STATI))}
          ${kvSel('seller', 'Venditore', [['', 'Nessuno'], ...SELLERS.map((s) => [s, s])])}${kvSel('company', 'Società', COMPANIES.map((c) => [c, c]))}
          ${kv('start', 'Inizio', { type: 'date', fmtV: dIt })}${kv('end', 'Fine', { type: 'date', fmtV: dIt })}
          ${kv('notice', 'Preavviso', { fmtV: (v) => `${v} giorni` })}${kvSel('renew', 'Rinnovo automatico', [['1', 'Sì (solo promemoria)'], ['0', 'No']])}
          ${kvSel('bill', 'Fatturazione', Object.entries(BILL))}${noValue ? '' : kv('value', 'Valore totale', { mono: true, fmtV: (v) => euro(Number(v)) })}
          ${editing ? '' : kv('code', 'Codice', { mono: true })}
        </div>`)}
        ${noValue ? '' : rcard('Documento', doc(x))}
        ${rcard('Attività recente', feed())}
      </aside>`
    const n = editing ? changes(open).length : 0
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record${editing ? ' is-editing' : ''}">${head}<div class="rec-body">${main}${rail}</div>${bar}</div>`
  }

  // ═══ Pagina ═════════════════════════════════════════════════════
  const table = () => `<table class="po-table c-list"><thead><tr><th>Contratto</th><th>Cliente</th><th>Tipo</th><th>Fine</th><th>Scadenza</th>${noValue ? '' : '<th>Valore</th>'}</tr></thead><tbody>${CTR.map((x, i) => { const st = expiry(x); return `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${esc(x.title)}</b><br><small class="code" style="color:var(--muted)">${esc(x.code)}</small></td><td>${esc(x.cust)}</td><td>${TYPES[x.type]}</td><td>${dIt(x.end)}</td><td><span class="st ${x.st !== 'attivo' ? 'done' : EXP[st][1] === 'err' ? 'err' : EXP[st][1]}">${x.st !== 'attivo' ? STATI[x.st] : EXP[st][0]}</span></td>${noValue ? '' : `<td>${euro(x.value)}</td>`}</tr>` }).join('')}</tbody></table>`
  const view = () => `<div class="mt-head"><h1>Contratti</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo contratto</button></div></div>
    <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Contratto ${esc(CTR[open].code)}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  const render = (keepScroll = true) => {
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view()
    const s2 = $('.ud-scrim', root); if (s2) s2.scrollTop = sc || 0
    document.querySelectorAll('[data-ctrnv]').forEach((b) => b.setAttribute('aria-pressed', String(noValue)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Contratti')))
  }
  const leave = () => open == null || !editing || !changes(open).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const reset = () => { if (open != null) drafts.delete(open); editing = false; menu = false }
  const openRec = (i) => { if (!leave()) return; reset(); open = i; sel = i; render(false) }
  const close = () => { if (!leave()) return; reset(); open = null; render() }

  root.addEventListener('click', (e) => {
    const tg = e.target; const x = open != null ? CTR[open] : null
    if (tg.closest('[data-modal-close]') || tg.matches('[data-scrim]')) return close()
    if (tg.closest('[data-menu]')) { menu = !menu; return render() }
    if (tg.closest('[data-edit]')) { menu = false; editing = true; return render() }
    if (tg.closest('[data-cancel]')) { menu = false; x.st = 'disdetto'; return render() }
    if (tg.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !tg.closest('.inv-menu')) { menu = false; render() }
    const row = tg.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = tg.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + CTR.length) % CTR.length)
    const g = tg.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (tg.closest('[data-discard]')) { drafts.delete(open); editing = false; return render() }
    if (tg.closest('[data-save]')) { const d = draft(open); Object.assign(x, { ...d, renew: d.renew === '1', notice: Number(d.notice), value: Number(d.value) }); drafts.delete(open); editing = false; return render() }
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  const onField = (e) => {
    const f = e.target.dataset.f; if (!f || open == null || !editing) return
    draft(open)[f] = e.target.value
    if (e.target.tagName === 'SELECT') return render()
    e.target.classList.toggle('dirty', draft(open)[f] !== FIELDS(CTR[open])[f])
    const rec = $('.record', root); const tmp = document.createElement('div'); tmp.innerHTML = record()
    $('.rec-head', rec).replaceWith($('.rec-head', tmp)); $('.savebar', rec)?.replaceWith($('.savebar', tmp))
  }
  root.addEventListener('input', onField)
  root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') onField(e) })
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-row]')) { e.preventDefault(); openRec(Number(e.target.dataset.row)) } })
  document.addEventListener('keydown', (e) => {
    if ($('[data-palette-bg]')?.hidden === false || e.target.matches('input, textarea, select')) return
    if (e.key === 'Escape') { if (menu) { menu = false; return render() } if (open != null) close() }
  })
  document.querySelectorAll('[data-ctrnv]').forEach((b) => b.addEventListener('click', () => { noValue = !noValue; store('archie-preview-ctr-nv', noValue ? '1' : ''); render() }))

  open = qs.get('chiuso') ? null : 0
  render(false)
})()
