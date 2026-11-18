/* Purchase Order senza drawer (anteprima pof-base, 18/11/2026): il PO nella finestra dei record, sullo schema
   approvato (dati come testo, «Modifica» nel ⋯, frecce sempre a destra). Testata con stato e azione principale
   che fa avanzare il flusso (Segna come inviato → ricevuto → fatturato). Al centro il flusso a quattro passi
   con date, numeri e il PDF di ogni passo, l'importo con costi e margine, i documenti per tipo e le note;
   a lato dettagli, da quanto aspetta e attività. Descrizione e importo si modificano solo in «Inserito».
   Dati finti modellati su /api/purchase-orders/. Oggi: 18/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const ORDER = ['inserito', 'inviato', 'ricevuto', 'fatturato']
  const LABEL = { inserito: 'Inserito', inviato: 'Inviato', ricevuto: 'Ricevuto', fatturato: 'Fatturato' }
  const NEXT = { inviato: 'Segna come inviato', ricevuto: 'Segna come ricevuto', fatturato: 'Segna come fatturato' }
  const SLOT = { offer: 'Offerta', po: 'Purchase Order', invoice: 'Fattura' }
  const P = (o) => ({ docs: [], notes: '', po: '', inv: '', sent: null, recv: null, invd: null, costs: null, mode: 'fisso', days: null, rate: null, ...o })
  const POS = [
    P({ id: 142, desc: 'Migrazione storage immagini su nuovo NAS', client: 'Philips', cust: 'AUSL Imola', kind: 'Extra', st: 'inviato', offer: '2026-10-20', sent: '2026-10-24', amount: 18400, costs: 9800, mode: 'giornate', days: 23, rate: 800,
      docs: [['offer', 'Offerta 142 migrazione NAS.pdf', '24/10']], notes: 'In attesa dell\'ordine dall\'ufficio acquisti AUSL.' }),
    P({ id: 139, desc: 'Aggiornamento IntelliSpace 4.4 SP2', client: 'Philips', cust: 'Azienda Sanitaria Felsinea', kind: 'Ordinario', st: 'ricevuto', offer: '2026-09-15', sent: '2026-09-18', recv: '2026-10-02', po: 'PO-2026-00871', amount: 7200, costs: 2100,
      docs: [['offer', 'Offerta 139.pdf', '18/09'], ['po', 'PO-2026-00871.pdf', '02/10']] }),
    P({ id: 151, desc: 'Installazione workstation refertazione', client: 'Biotron', cust: 'Clinica Villa Serena', kind: 'Extra', st: 'inserito', offer: '2026-11-15', amount: 3600, mode: 'giornate', days: 6, rate: 600 }),
    P({ id: 128, desc: 'Configurazione VPN di assistenza', client: 'Medical Imaging', cust: 'Ospedale Trebbia', kind: 'Extra', st: 'fatturato', offer: '2026-07-01', sent: '2026-07-03', recv: '2026-07-20', invd: '2026-08-05', po: 'OA-4471', inv: 'FT 2026/0412', amount: 2400, costs: 600,
      docs: [['offer', 'Offerta 128.pdf', '03/07'], ['po', 'OA-4471.pdf', '20/07'], ['invoice', 'FT 2026-0412.pdf', '05/08']] }),
    P({ id: 133, desc: 'Corso di formazione tecnici di radiologia', client: 'Philips', cust: 'AUSL Bologna', kind: 'Extra', st: 'inviato', offer: '2026-09-01', sent: '2026-09-05', amount: 4800, costs: 1200, docs: [] }),
  ]
  const NOW = new Date('2026-11-18T00:00').getTime()
  const DAY = 864e5
  const dIt = (s) => (s ? s.split('-').reverse().join('/') : '—')
  const since = (s) => (s ? Math.round((NOW - new Date(`${s}T00:00`).getTime()) / DAY) : null)
  const euro = (n) => `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  let open = null; let sel = 0; let editing = false; let menu = false
  const drafts = new Map()
  const root = $('[data-pof]')
  const KEYS = ['desc', 'kind', 'offer', 'po', 'inv', 'amount', 'costs', 'notes']
  const FIELDS = (x) => Object.fromEntries(KEYS.map((k) => [k, x[k] == null ? '' : String(x[k])]))
  const draft = (n) => { if (!drafts.has(n)) drafts.set(n, FIELDS(POS[n])); return drafts.get(n) }
  const changes = (n) => { const d = draft(n); const o = FIELDS(POS[n]); return KEYS.filter((f) => d[f] !== o[f]) }
  const dirty = (f) => (draft(open)[f] !== FIELDS(POS[open])[f] ? ' dirty' : '')
  const cur = () => (editing ? draft(open) : FIELDS(POS[open]))
  const locked = (x) => x.st !== 'inserito'

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const sec = (id, title, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const none = '<span class="ikv-none">—</span>'
  const kv = (f, label, { type = 'text', fmtV = (v) => esc(v), wide = false, mono = false, lock = false } = {}) => {
    const v = cur()[f]
    if (editing && !lock) return `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span><input data-f="${f}" type="${type}" value="${esc(v)}" class="${mono ? 'mono' : ''}${dirty(f)}"></label>`
    return `<div class="ikv${wide ? ' wide' : ''}"><span>${label}${editing && lock ? ` ${ic('lock')}` : ''}</span><b class="${mono ? 'mono' : ''}">${v ? fmtV(v) : none}</b></div>`
  }
  const docsOf = (x, slot) => x.docs.filter((d) => d[0] === slot)

  /* Flusso: quattro passi con data, numero e il PDF del passo. */
  const flow = (x) => {
    const idx = ORDER.indexOf(x.st)
    const steps = [['inserito', 'Offerta inserita', x.offer, 'offer', ''], ['inviato', 'Offerta inviata', x.sent, null, ''], ['ricevuto', 'PO ricevuto', x.recv, 'po', x.po], ['fatturato', 'Fatturato', x.invd, 'invoice', x.inv]]
    return `<ol class="pflow">${steps.map(([s, label, date, slot, code], j) => {
      const done = j <= idx; const nx = j === idx + 1
      const docs = slot ? docsOf(x, slot) : []
      const pill = slot && done ? (docs.length ? `<button type="button" class="dpill on" data-goto="doc">${ic('file')}${SLOT[slot]}${docs.length > 1 ? ` · ${docs.length}` : ''}</button>` : `<button type="button" class="dpill" data-goto="doc">${ic('upload')}${SLOT[slot]} mancante</button>`) : ''
      return `<li class="${done ? 'pf-done' : nx ? 'pf-next' : ''}"><span class="pf-dot">${done ? ic('check') : j + 1}</span><span class="pf-t"><b>${label}</b><small>${done ? `${dIt(date)}${code ? ` · <span class="code">${esc(code)}</span>` : ''}` : nx ? 'prossimo passo' : 'da fare'}</small></span>${pill}</li>`
    }).join('')}</ol>`
  }
  const amount = (x) => {
    const m = x.costs != null ? x.amount - x.costs : null
    return `<div class="amt"><b>${euro(x.amount)}</b><span>${x.mode === 'giornate' ? `${x.days} giornate × ${euro(x.rate)}` : 'valore fisso'}</span></div>
      <div class="amt-grid"><div><small>Costi sostenuti</small><b>${x.costs != null ? euro(x.costs) : '—'}</b></div><div><small>Margine</small><b style="color:${m == null ? 'inherit' : m >= 0 ? 'var(--success)' : 'var(--error)'}">${m != null ? euro(m) : '—'}</b></div><div><small>Margine %</small><b>${m != null ? `${Math.round((m / x.amount) * 100)}%` : '—'}</b></div></div>`
  }
  const documents = (x) => Object.keys(SLOT).map((slot) => {
    const docs = docsOf(x, slot)
    return `<div class="dslot"><h4>${SLOT[slot]}${muted(docs.length)}</h4>${docs.length ? `<div class="rows">${docs.map(([, n, when]) => `<div class="row r-file"><span class="ext pdf">PDF</span><span class="t"><b>${esc(n)}</b><small>caricato il ${when}</small></span><span class="acts"><button class="icon-btn" type="button" aria-label="Apri ${esc(n)}">${ic('eye')}</button><button class="icon-btn" type="button" aria-label="Elimina ${esc(n)}">${ic('trash')}</button></span></div>`).join('')}</div>` : ''}<button type="button" class="upl sm">${ic('upload')}<span><b>Carica ${SLOT[slot] === 'Purchase Order' ? 'il PO' : `l'${SLOT[slot].toLowerCase()}`.replace("l'fattura", 'la fattura')}</b></span></button></div>`
  }).join('')
  const waiting = (x) => {
    const ref = x.st === 'inserito' ? x.offer : x.st === 'inviato' ? x.sent : x.st === 'ricevuto' ? x.recv : null
    const n = since(ref)
    const late = (x.st === 'inviato' && n > 30) || (x.st === 'ricevuto' && n > 30)
    const lbl = x.st === 'inserito' ? 'Da inviare da' : x.st === 'inviato' ? 'Aspetta il PO da' : x.st === 'ricevuto' ? 'Da fatturare da' : 'Ciclo completo in'
    const val = x.st === 'fatturato' ? Math.round((new Date(`${x.invd}T00:00`) - new Date(`${x.offer}T00:00`)) / DAY) : n
    return `<div class="tl-h"><div><small>${lbl}</small><b>${val} ${val === 1 ? 'giorno' : 'giorni'}</b></div>${x.st !== 'fatturato' ? `<span class="tl-tag ${late ? 'warn' : ''}">${late ? 'Da sollecitare' : 'Nei tempi'}</span>` : '<span class="tl-tag ok">Completato</span>'}</div>`
  }
  const feed = () => `<ul class="mini-feed"><li>${ic('wrench')}<span><b>Marco Bassi</b> ha cambiato lo stato da Inserito a Inviato</span><time>24/10</time></li><li>${ic('upload')}<span><b>Marco Bassi</b> ha caricato l'offerta</span><time>24/10</time></li><li>${ic('plus')}<span><b>Marco Bassi</b> ha creato il PO</span><time>20/10</time></li></ul>`

  // ═══ Finestra ═══════════════════════════════════════════════════
  const record = () => {
    const x = POS[open]; const d = cur(); const L = POS.length
    const idx = ORDER.indexOf(x.st); const nx = ORDER[idx + 1]; const pv = ORDER[idx - 1]
    const ref = x.st === 'inviato' ? x.sent : x.st === 'ricevuto' ? x.recv : null
    const late = ref && since(ref) > 30
    const moreMenu = menu ? `<div class="inv-menu" role="menu">
        <button type="button" role="menuitem" data-edit>${ic('columns')}Modifica</button>
        ${pv ? `<button type="button" role="menuitem" data-back>${ic('chevL')}Torna a ${LABEL[pv]}</button>` : ''}
        <button type="button" role="menuitem" data-menu-close>${ic('filter')}Tutti i campi (cliente, giornate)…</button>
        ${x.po ? `<button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il numero PO</button>` : ''}
        <button type="button" role="menuitem" class="danger" data-menu-close>${ic('trash')}Elimina</button></div>` : ''
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2><span class="code" style="opacity:.75;font-weight:500">#${x.id}</span> ${esc(d.desc)}<span class="ven-b">${LABEL[x.st]}</span>${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p>${esc(x.client)} → <button type="button" class="band-link">${esc(x.cust)}</button> · ${esc(x.kind)}${x.po ? ` · PO <span class="code" style="color:inherit">${esc(x.po)}</span>` : ''}${x.inv ? ` · fattura <span class="code" style="color:inherit">${esc(x.inv)}</span>` : ''}</p>
        <div class="rec-tags"><span class="bstat"><b>${euro(x.amount)}</b></span>${x.costs != null ? `<span class="bstat">margine <b>${Math.round(((x.amount - x.costs) / x.amount) * 100)}%</b></span>` : ''}${late ? `<span class="bstat warn">da sollecitare · <b>${since(ref)}</b> giorni</span>` : ''}<button type="button" class="bstat" data-goto="doc"><b>${x.docs.length}</b> ${x.docs.length === 1 ? 'documento' : 'documenti'}</button></div></div>
        <div class="rec-act">${editing ? '' : nx ? `<button class="btn on-band solid" type="button" data-adv>${ic('arrowR')}${NEXT[nx]}</button>` : ''}
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${moreMenu}</span>
          <span class="rec-nav${editing ? ' off' : ''}"><span class="rec-pos">${open + 1} di ${L}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span></div>
      </div></header>`
    const main = `<div class="rec-main">
        ${sec('flow', 'Flusso', flow(x), x.st === 'fatturato' ? `<span class="tl-tag ok">Completato il ${dIt(x.invd)}</span>` : '')}
        ${sec('amt', 'Importo', amount(x), locked(x) ? `<span class="app-tag" title="Descrizione e importo si modificano solo in stato Inserito: riporta il PO indietro per cambiarli.">${ic('lock')} Bloccato dopo l'invio</span>` : '')}
        ${sec('doc', `Documenti${muted(x.docs.length)}`, `<div class="dslots">${documents(x)}</div><p class="acc-note">${ic('file')}I PDF si possono caricare anche dopo il cambio di stato.</p>`)}
        ${sec('note', 'Note', editing ? `<label class="ikv wide"><span>Testo</span><textarea data-f="notes" class="notes${dirty('notes')}" rows="3">${esc(d.notes)}</textarea></label>` : x.notes ? `<p class="notes-ro">${esc(x.notes)}</p>` : '<p class="empty-s">Nessuna nota.</p>')}
      </div>`
    const rail = `<aside class="rec-rail" aria-label="Purchase Order">
        ${rcard('Dettagli', `<div class="ikvs">
          ${editing ? kv('desc', 'Descrizione', { wide: true, lock: locked(x) }) : ''}
          <div class="ikv"><span>Committente</span><b>${esc(x.client)}</b></div>
          <div class="ikv"><span>Cliente</span><b><button type="button" class="ikv-link">${esc(x.cust)}${ic('arrowR')}</button></b></div>
          ${editing ? `<label class="ikv"><span>Tipo</span><select data-f="kind" class="${dirty('kind')}">${['Ordinario', 'Extra'].map((k) => `<option${k === d.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></label>` : `<div class="ikv"><span>Tipo</span><b>${esc(x.kind)}</b></div>`}
          ${kv('offer', 'Data offerta', { type: 'date', fmtV: dIt })}
          ${kv('po', 'Numero PO', { mono: true })}${kv('inv', 'Numero fattura', { mono: true })}
          ${kv('amount', 'Importo', { mono: true, lock: locked(x), fmtV: (v) => euro(v) })}${kv('costs', 'Costi sostenuti', { mono: true, fmtV: (v) => euro(v) })}
        </div>${editing && locked(x) ? '<p class="acc-note">Descrizione e importo si modificano solo in «Inserito»: riporta il PO indietro dal ⋯.</p>' : ''}`)}
        ${rcard('Tempo', waiting(x))}
        ${rcard('Attività recente', feed())}
      </aside>`
    const n = editing ? changes(open).length : 0
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record${editing ? ' is-editing' : ''}">${head}<div class="rec-body">${main}${rail}</div>${bar}</div>`
  }

  // ═══ Pagina ═════════════════════════════════════════════════════
  const table = () => `<table class="po-table c-list"><thead><tr><th>#</th><th>Descrizione</th><th>Committente → cliente</th><th>Stato</th><th>Importo</th></tr></thead><tbody>${POS.map((x, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td class="code">#${x.id}</td><td><b>${esc(x.desc)}</b><br><small style="color:var(--muted)">${esc(x.kind)} · offerta del ${dIt(x.offer)}</small></td><td>${esc(x.client)} → ${esc(x.cust)}</td><td><span class="st ${x.st === 'fatturato' ? 'ok' : x.st === 'inserito' ? 'aperta' : 'lav'}">${LABEL[x.st]}</span></td><td>${euro(x.amount)}</td></tr>`).join('')}</tbody></table>`
  const view = () => `<div class="mt-head"><h1>Purchase Order</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo PO</button></div></div>
    <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Purchase Order ${POS[open].id}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  const render = (keepScroll = true) => {
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view()
    const s2 = $('.ud-scrim', root); if (s2) s2.scrollTop = sc || 0
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Purchase')))
  }
  const leave = () => open == null || !editing || !changes(open).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const reset = () => { if (open != null) drafts.delete(open); editing = false; menu = false }
  const openRec = (i) => { if (!leave()) return; reset(); open = i; sel = i; render(false) }
  const close = () => { if (!leave()) return; reset(); open = null; render() }

  root.addEventListener('click', (e) => {
    const tg = e.target; const x = open != null ? POS[open] : null
    if (tg.closest('[data-modal-close]') || tg.matches('[data-scrim]')) return close()
    if (tg.closest('[data-menu]')) { menu = !menu; return render() }
    if (tg.closest('[data-edit]')) { menu = false; editing = true; return render() }
    if (tg.closest('[data-back]')) { menu = false; x.st = ORDER[ORDER.indexOf(x.st) - 1]; return render() }
    if (tg.closest('[data-adv]')) { const nx = ORDER[ORDER.indexOf(x.st) + 1]; x.st = nx; if (nx === 'inviato') x.sent = '2026-11-18'; if (nx === 'ricevuto') { x.recv = '2026-11-18'; x.po = x.po || 'PO-2026-01102' } if (nx === 'fatturato') { x.invd = '2026-11-18'; x.inv = x.inv || 'FT 2026/0588' } return render() }
    if (tg.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !tg.closest('.inv-menu')) { menu = false; render() }
    const row = tg.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = tg.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + POS.length) % POS.length)
    const g = tg.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (tg.closest('[data-discard]')) { drafts.delete(open); editing = false; return render() }
    if (tg.closest('[data-save]')) { const d = draft(open); Object.assign(x, { ...d, amount: Number(d.amount), costs: d.costs === '' ? null : Number(d.costs) }); drafts.delete(open); editing = false; return render() }
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  const onField = (e) => {
    const f = e.target.dataset.f; if (!f || open == null || !editing) return
    draft(open)[f] = e.target.value
    if (e.target.tagName === 'SELECT') return render()
    e.target.classList.toggle('dirty', draft(open)[f] !== FIELDS(POS[open])[f])
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

  open = qs.get('chiuso') ? null : 0
  render(false)
})()
