/* Contratti fase 2 (anteprima ctr2-base, 20/11/2026). Parte dalla finestra approvata in ctr-base e applica
   le decisioni di Fede:
   - niente disdetta: il campo «preavviso» diventa «Avviso di rinnovo: N giorni prima della fine»;
   - dalla data dell'avviso parte un promemoria e poi uno ogni 10 giorni finché il contratto non viene
     rinnovato (fine spostata in avanti) o chiuso, fino alla scadenza;
   - lo stato «Disdetto» diventa «Chiuso»;
   - destinatari: il venditore (utente Archie o nominativo inserito a mano) e gli indirizzi dell'ufficio
     impostati nel pannello Impostazioni di Archie;
   - ogni promemoria è un'email a sé, una per contratto.
   Tre viste: finestra del contratto, Impostazioni, email del promemoria. Oggi: 20/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const mailIc = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const TYPES = { assistenza: 'Assistenza', noleggio: 'Noleggio', licenza: 'Licenza', altro: 'Altro' }
  const STATI = { bozza: 'Bozza', attivo: 'Attivo', chiuso: 'Chiuso' }
  const BILL = { una_tantum: 'Una tantum', mensile: 'Mensile', trimestrale: 'Trimestrale', annuale: 'Annuale' }
  // Stati di scadenza: senza disdetta restano tre.
  const EXP = { ok: ['In corso', 'ok'], renew: ['Da rinnovare', 'warn'], expired: ['Scaduto', 'err'], none: ['—', ''] }
  const SELLERS = {
    'Luca Ferraresi': { email: 'luca.ferraresi@biotron.it', user: true },
    'Giulia Neri': { email: 'giulia.neri@studioneri.it', user: false },
    'Paolo Conti': { email: 'paolo.conti@biotron.it', user: true },
  }
  const COMPANIES = ['Biotron', 'Philips', 'Medical Imaging']
  const SETTINGS = { office: 'contratti@biotron.it; amministrazione@biotron.it', lead: 90, every: 10 }
  const C = (o) => ({ devices: [], doc: null, notes: '', renew: false, ...o })
  const CTR = [
    C({ code: 'CT-2024-018', title: 'Assistenza PACS e RIS', cust: 'AUSL Imola', type: 'assistenza', st: 'attivo', seller: 'Luca Ferraresi', company: 'Philips', bill: 'trimestrale', start: '2024-01-01', end: '2026-12-31', lead: 60, value: 186000,
      devices: [['IntelliSpace PACS 4.4', 'CZ2391A0F'], ['Server applicativo RIS', 'DL380-778120'], ['Storage immagini', 'NTAP-AFF-9921']], doc: 'CT-2024-018 firmato.pdf', notes: 'Proposta da preparare con il nuovo direttore dei sistemi informativi.' }),
    C({ code: 'CT-2023-031', title: 'Licenze riconoscimento vocale', cust: 'Clinica Villa Serena', type: 'licenza', st: 'attivo', seller: 'Giulia Neri', company: 'Medical Imaging', bill: 'annuale', start: '2023-12-01', end: '2026-11-30', lead: 30, value: 12600, doc: 'Licenze speech 2023.pdf' }),
    C({ code: 'CT-2025-004', title: 'Noleggio workstation di refertazione', cust: 'Azienda Sanitaria Felsinea', type: 'noleggio', st: 'attivo', seller: 'Paolo Conti', company: 'Biotron', bill: 'mensile', start: '2025-03-01', end: '2028-02-29', lead: 90, value: 54000,
      devices: [['Workstation refertazione 1', 'HP-Z4-55120'], ['Workstation refertazione 2', 'HP-Z4-55121']] }),
    C({ code: 'CT-2022-012', title: 'Assistenza robot masterizzatore', cust: 'Azienda Ospedaliera Estense', type: 'assistenza', st: 'attivo', seller: '', company: 'Biotron', bill: 'annuale', start: '2022-11-01', end: '2026-10-31', lead: 60, value: 9800 }),
    C({ code: 'CT-2021-007', title: 'Noleggio stampante pellicole', cust: 'AUSL Bologna', type: 'noleggio', st: 'chiuso', seller: 'Giulia Neri', company: 'Biotron', bill: 'mensile', start: '2021-06-01', end: '2025-05-31', lead: 90, value: 21600 }),
  ]
  const NOW = new Date('2026-11-20T00:00').getTime()
  const DAY = 864e5
  const t = (s) => new Date(`${s}T00:00`).getTime()
  const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const dIt = (s) => (s ? s.split('-').reverse().join('/') : '')
  const dShort = (s) => new Date(`${s}T00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  const alertOf = (x) => iso(t(x.end) - x.lead * DAY)
  /* Promemoria: dalla data dell'avviso, uno ogni N giorni, fino alla fine compresa. */
  const reminders = (x) => { const out = []; for (let d = t(alertOf(x)); d <= t(x.end); d += SETTINGS.every * DAY) out.push(iso(d)); return out }
  const expiry = (x) => { if (x.st !== 'attivo') return 'none'; if (NOW > t(x.end)) return 'expired'; if (NOW >= t(alertOf(x))) return 'renew'; return 'ok' }
  const days = (s) => Math.round((t(s) - NOW) / DAY)
  const rel = (s) => { const n = days(s); if (n === 0) return 'oggi'; if (n === 1) return 'domani'; if (n > 0) return n > 60 ? `tra ${Math.round(n / 30)} mesi` : `tra ${n} giorni`; return -n > 60 ? `${Math.round(-n / 30)} mesi fa` : `${-n} giorni fa` }
  const euro = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const months = (x) => Math.max(1, Math.round((t(x.end) - t(x.start)) / (30.44 * DAY)))
  const officeList = (raw) => raw.split(';').map((s) => s.trim()).filter(Boolean)
  const okEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  let noValue = read('archie-preview-ctr-nv', '') === '1'
  let view = qs.get('v') || read('archie-preview-ctr2-v', 'ctr')
  let open = null; let sel = 0; let editing = false; let menu = false
  let setDraft = { ...SETTINGS }
  const drafts = new Map()
  const root = $('[data-ctr]')
  const KEYS = ['code', 'title', 'type', 'st', 'seller', 'company', 'bill', 'start', 'end', 'lead', 'renew', 'value', 'notes']
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
  const LEADS = [30, 60, 90, 180]

  /* Periodo: barra dall'inizio alla fine con l'avviso di rinnovo, i promemoria e oggi. */
  const period = (x) => {
    const s = t(x.start); const e = t(x.end); const span = Math.max(1, e - s)
    const pos = (v) => Math.max(0, Math.min(100, ((v - s) / span) * 100))
    const st = expiry(x); const al = alertOf(x)
    const tone = st === 'expired' ? 'err' : st === 'renew' ? 'warn' : ''
    const next = reminders(x).find((d) => t(d) >= NOW)
    const head = x.st !== 'attivo' ? `Contratto ${STATI[x.st].toLowerCase()}` : st === 'expired' ? `Scaduto il ${dShort(x.end)}` : `Finisce ${rel(x.end)}`
    const hint = x.st !== 'attivo' ? 'Non manda più promemoria.'
      : st === 'expired' ? 'I promemoria sono finiti alla scadenza: rinnovalo o segnalo come chiuso.'
      : st === 'renew' ? `È il momento di preparare il nuovo contratto. ${next ? `Prossimo promemoria ${rel(next)} (${dShort(next)}).` : ''}`
      : `L'avviso di rinnovo parte il ${dShort(al)}, ${x.lead} giorni prima della fine.`
    return `<div class="pb"><i class="pb-track"></i><i class="pb-fill ${tone}" style="width:${pos(Math.min(NOW, e))}%"></i>
        <i class="pb-zone" style="left:${pos(t(al))}%;width:${100 - pos(t(al))}%" title="Promemoria di rinnovo"></i>
        <i class="pb-notice" style="left:${pos(t(al))}%" title="Avviso di rinnovo dal ${dShort(al)}"><em>avviso</em></i>
        ${NOW >= s && NOW <= e ? `<i class="pb-now" style="left:${pos(NOW)}%"><em>OGGI</em></i>` : ''}</div>
      <div class="tl-f"><span>${dShort(x.start)}</span><span>${dShort(x.end)}</span></div>
      <div class="pb-box ${tone}"><b>${head}</b><small>${hint}${x.renew ? ' Rinnovo automatico indicato nel contratto.' : ''}</small></div>`
  }

  /* Promemoria di rinnovo: a chi vanno e quando. */
  const sellerInfo = (name) => (name ? SELLERS[name] : null)
  const recips = (x) => {
    const sv = sellerInfo(x.seller)
    const office = officeList(SETTINGS.office)
    return `<div class="rm-to">
        <div class="rm-who">${ic('user')}<span>${sv ? `<b>${esc(x.seller)}</b> · ${esc(sv.email)}<small>${sv.user ? 'Venditore, utente Archie: email e campanella' : 'Venditore inserito a mano: solo email'}</small>`
          : '<b>Nessun venditore</b><small>Il promemoria va solo all\'ufficio</small>'}</span></div>
        <div class="rm-who">${ic('users')}<span><b>Ufficio</b> · ${office.map(esc).join(', ')}<small>Dalle Impostazioni di Archie</small></span></div>
      </div>`
  }
  const schedule = (x) => {
    if (x.st !== 'attivo') return `<p class="empty-s">Contratto ${STATI[x.st].toLowerCase()}: nessun promemoria.</p>`
    const list = reminders(x)
    const nextI = list.findIndex((d) => t(d) >= NOW)
    const rows = list.map((d, i) => {
      const sent = t(d) < NOW || (t(d) === NOW)
      const isNext = i === nextI && !sent
      return `<li class="${sent ? 'sent' : isNext ? 'next' : ''}"><span class="dot"></span><span class="rm-d">${dShort(d)}</span>
        <span class="rm-s">${sent ? `${ic('check')}Inviato` : isNext ? `Prossimo · ${rel(d)}` : 'Previsto'}${i === 0 ? ' · avviso' : ''}${d === x.end ? ' · scadenza' : ''}</span></li>`
    })
    const folded = list.length > 6 && nextI > 2 ? [...rows.slice(0, 1), `<li class="gap"><span class="dot"></span><span class="rm-d">… ${nextI - 2} inviati</span><span></span></li>`, ...rows.slice(nextI - 1)] : rows
    return `${recips(x)}<ol class="rm-list">${folded.join('')}</ol>
      <p class="acc-note">${ic('clock')}Uno ogni ${SETTINGS.every} giorni dalla data dell'avviso. Si fermano quando sposti in avanti la fine (Rinnova…) o segni il contratto come chiuso.</p>`
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
  const feed = (x) => `<ul class="mini-feed">${x.st === 'attivo' && expiry(x) === 'renew' ? `<li>${mailIc}<span>Promemoria di rinnovo inviato a <b>${esc(x.seller || 'ufficio')}</b>${x.seller ? ' e all\'ufficio' : ''}</span><time>${dIt(reminders(x).filter((d) => t(d) <= NOW).at(-1))}</time></li>` : ''}<li>${ic('wrench')}<span><b>Giulia Neri</b> ha cambiato la fine da 30/11/2026 a 31/12/2026</span><time>12/11</time></li><li>${ic('plus')}<span><b>Luca Ferraresi</b> ha creato il contratto</span><time>02/01/2024</time></li></ul>`

  // ═══ Finestra ═══════════════════════════════════════════════════
  const record = () => {
    const x = CTR[open]; const d = cur(); const st = expiry(x); const L = CTR.length
    const al = alertOf(x); const next = x.st === 'attivo' ? reminders(x).find((r) => t(r) >= NOW) : null
    const moreMenu = menu ? `<div class="inv-menu" role="menu">
        <button type="button" role="menuitem" data-edit>${ic('columns')}Modifica</button>
        <button type="button" role="menuitem" data-menu-close>${ic('filter')}Tutti i campi (device)…</button>
        ${x.st === 'attivo' ? `<button type="button" role="menuitem" data-close-ctr>${ic('x')}Segna come chiuso</button>` : ''}
        <button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il codice</button>
        <button type="button" role="menuitem" class="danger" data-menu-close>${ic('trash')}Elimina</button></div>` : ''
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2><span class="code" style="opacity:.75;font-weight:500">${esc(d.code)}</span> ${esc(d.title)}${x.st !== 'attivo' ? `<span class="ven-b">${STATI[x.st]}</span>` : `<span class="ven-b exp-${EXP[st][1]}">${EXP[st][0]}</span>`}${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p><button type="button" class="band-link">${esc(x.cust)}</button> · ${TYPES[x.type]} · ${esc(x.company)}${x.seller ? ` · venditore ${esc(x.seller)}` : ''}</p>
        <div class="rec-tags">
          ${x.st === 'attivo' ? `<span class="bstat${st === 'expired' ? ' warn' : ''}">${st === 'expired' ? `scaduto il <b>${dIt(x.end)}</b>` : `finisce il <b>${dIt(x.end)}</b>`}</span>
          <span class="bstat${st === 'renew' ? ' warn' : ''}">avviso di rinnovo ${NOW >= t(al) ? 'dal' : 'il'} <b>${dIt(al)}</b></span>
          ${next ? `<button type="button" class="bstat" data-goto="rem">prossimo promemoria <b>${dIt(next)}</b></button>` : ''}` : `<span class="bstat">finito il <b>${dIt(x.end)}</b></span>`}
          ${x.renew ? '<span class="bstat">rinnovo automatico</span>' : ''}
          ${noValue ? '' : `<span class="bstat"><b>${euro(x.value)}</b></span>`}
          <button type="button" class="bstat" data-goto="dev"><b>${x.devices.length}</b> device</button></div></div>
        <div class="rec-act">${editing ? '' : x.st === 'attivo' ? `<button class="btn on-band solid" type="button">${ic('restore')}Rinnova…</button>` : ''}
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${moreMenu}</span>
          <span class="rec-nav${editing ? ' off' : ''}"><span class="rec-pos">${open + 1} di ${L}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span></div>
      </div></header>`
    const main = `<div class="rec-main">
        ${sec('per', 'Periodo', period(x), `<span class="tl-tag ${EXP[st][1]}">${x.st === 'attivo' ? EXP[st][0] : STATI[x.st]}</span>`)}
        ${sec('rem', 'Promemoria di rinnovo', schedule(x))}
        ${noValue ? '' : sec('amt', 'Importo', amount(x))}
        ${sec('dev', `Device${muted(x.devices.length)}`, devices(x), '<button class="lnk" type="button">Gestisci da «Tutti i campi»</button>')}
        ${sec('note', 'Note', editing ? `<label class="ikv wide"><span>Testo</span><textarea data-f="notes" class="notes${dirty('notes')}" rows="3">${esc(d.notes)}</textarea></label>` : x.notes ? `<p class="notes-ro">${esc(x.notes)}</p>` : '<p class="empty-s">Nessuna nota.</p>')}
      </div>`
    const leadKv = editing
      ? `<label class="ikv wide"><span>Avviso di rinnovo</span><span class="chips">${LEADS.map((n) => `<button type="button" class="chip${String(n) === d.lead ? ' on' : ''}" data-lead="${n}">${n} giorni</button>`).join('')}<input data-f="lead" type="number" min="1" max="365" value="${esc(d.lead)}" class="chip-in${dirty('lead')}" aria-label="Giorni prima della fine"></span><small class="ikv-h">prima della fine · avviso il ${dIt(iso(t(d.end || x.end) - Number(d.lead || 0) * DAY))}</small></label>`
      : `<div class="ikv"><span>Avviso di rinnovo</span><b>${x.lead} giorni prima</b></div>`
    const rail = `<aside class="rec-rail" aria-label="Contratto">
        ${rcard('Dettagli', `<div class="ikvs">
          ${editing ? kv('code', 'Codice', { mono: true }) + kv('title', 'Titolo', { wide: true }) : ''}
          <div class="ikv wide"><span>Cliente</span><b><button type="button" class="ikv-link">${esc(x.cust)}${ic('arrowR')}</button></b></div>
          ${kvSel('type', 'Tipo', Object.entries(TYPES))}${kvSel('st', 'Stato', Object.entries(STATI))}
          ${kvSel('seller', 'Venditore', [['', 'Nessuno'], ...Object.keys(SELLERS).map((s) => [s, s])])}${kvSel('company', 'Società', COMPANIES.map((c) => [c, c]))}
          ${kv('start', 'Inizio', { type: 'date', fmtV: dIt })}${kv('end', 'Fine', { type: 'date', fmtV: dIt })}
          ${leadKv}${kvSel('renew', 'Rinnovo automatico', [['1', 'Sì (solo informativo)'], ['0', 'No']])}
          ${kvSel('bill', 'Fatturazione', Object.entries(BILL))}${noValue ? '' : kv('value', 'Valore totale', { mono: true, fmtV: (v) => euro(Number(v)) })}
          ${editing ? '' : kv('code', 'Codice', { mono: true })}
        </div>`)}
        ${noValue ? '' : rcard('Documento', doc(x))}
        ${rcard('Attività recente', feed(x))}
      </aside>`
    const n = editing ? changes(open).length : 0
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record${editing ? ' is-editing' : ''}">${head}<div class="rec-body">${main}${rail}</div>${bar}</div>`
  }

  // ═══ Vista: contratti ═══════════════════════════════════════════
  const table = () => `<table class="po-table c-list"><thead><tr><th>Contratto</th><th>Cliente</th><th>Venditore</th><th>Fine</th><th>Scadenza</th>${noValue ? '' : '<th>Valore</th>'}</tr></thead><tbody>${CTR.map((x, i) => { const st = expiry(x); return `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${esc(x.title)}</b><br><small class="code" style="color:var(--muted)">${esc(x.code)}</small></td><td>${esc(x.cust)}</td><td>${esc(x.seller) || '<span style="color:var(--muted)">—</span>'}</td><td>${dIt(x.end)}</td><td><span class="st ${x.st !== 'attivo' ? 'done' : EXP[st][1] === 'err' ? 'err' : EXP[st][1]}">${x.st !== 'attivo' ? STATI[x.st] : EXP[st][0]}</span></td>${noValue ? '' : `<td>${euro(x.value)}</td>`}</tr>` }).join('')}</tbody></table>`
  const vCtr = () => `<div class="mt-head"><h1>Contratti</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo contratto</button></div></div>
    <p class="hint" style="margin:-6px 0 12px">Viste: Tutti · <b>Da rinnovare</b> (al posto di «Da gestire») · Scaduti · In corso · Bozze · <b>Chiusi</b>. Doppio clic o Invio per aprire.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Contratto ${esc(CTR[open].code)}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  // ═══ Vista: Impostazioni di Archie ══════════════════════════════
  const vSet = () => {
    const list = officeList(setDraft.office)
    const changed = ['office', 'lead', 'every'].filter((k) => String(setDraft[k]) !== String(SETTINGS[k])).length
    const bad = list.filter((e) => !okEmail(e))
    return `<div class="mt-head"><h1>Impostazioni di Archie</h1></div>
    <p class="hint" style="margin:-6px 0 14px">${ic('lock')} Dal menu utente, come «Moduli». Le vede il superuser e chi ha il permesso <b>«Gestisce le impostazioni di Archie»</b>. Ogni modifica finisce nell'Audit.</p>
    <div class="set-wrap">
      <nav class="set-nav" aria-label="Sezioni"><button type="button" class="on" aria-current="true">${ic('file')}Contratti</button><p>Le prossime impostazioni dell'applicazione si aggiungeranno qui, una sezione per argomento.</p></nav>
      <section class="set-card">
        <h2>Promemoria di rinnovo</h2>
        <p class="set-lead">Per ogni contratto attivo, dalla data dell'avviso parte un'email per contratto al venditore e agli indirizzi qui sotto, poi una ogni ${esc(setDraft.every)} giorni finché il contratto non viene rinnovato o chiuso.</p>
        <label class="set-f"><span class="set-l">Indirizzi dell'ufficio</span>
          <textarea data-s="office" rows="2" class="${String(setDraft.office) !== SETTINGS.office ? 'dirty' : ''}" aria-describedby="h-office">${esc(setDraft.office)}</textarea>
          <small id="h-office">Uno o più indirizzi separati da «;». Ricevono ogni promemoria, anche dei contratti senza venditore.</small>
          <span class="set-chips">${list.map((e) => `<span class="em-chip${okEmail(e) ? '' : ' bad'}">${mailIc}${esc(e)}</span>`).join('')}</span>
          ${bad.length ? `<small class="set-err">${bad.length === 1 ? 'Questo indirizzo non è valido' : 'Questi indirizzi non sono validi'}: ${bad.map(esc).join(', ')}</small>` : ''}
        </label>
        <div class="set-f"><span class="set-l">Avviso predefinito per i nuovi contratti</span>
          <span class="chips">${LEADS.map((n) => `<button type="button" class="chip${String(n) === String(setDraft.lead) ? ' on' : ''}" data-slead="${n}">${n} giorni</button>`).join('')}</span>
          <small>Proposto nel modulo «Nuovo contratto»; ogni contratto lo può cambiare.</small></div>
        <label class="set-f"><span class="set-l">Ripeti il promemoria ogni</span>
          <span class="set-inl"><input data-s="every" type="number" min="1" max="60" value="${esc(setDraft.every)}" class="${String(setDraft.every) !== String(SETTINGS.every) ? 'dirty' : ''}"> giorni</span>
          <small>Fino alla data di fine del contratto compresa.</small></label>
        <div class="set-foot"><button type="button" class="btn" data-test-mail ${bad.length || !list.length ? 'disabled' : ''}>${mailIc}Manda un'email di prova all'ufficio</button></div>
      </section>
    </div>
    ${changed ? `<div class="savebar set-bar" role="status"><span class="dot"></span><b>${changed} ${changed === 1 ? 'modifica' : 'modifiche'} da salvare</b><span class="sp"></span><button class="btn" type="button" data-s-discard>Annulla</button><button class="btn btn-primary" type="button" data-s-save${bad.length ? ' disabled' : ''}>Salva</button></div>` : ''}`
  }

  // ═══ Vista: email del promemoria ════════════════════════════════
  const vMail = () => {
    const x = CTR[0]; const sv = SELLERS[x.seller]; const list = reminders(x)
    const sentI = list.filter((d) => t(d) <= NOW).length; const next = list[sentI]
    const sentOn = list[sentI - 1]; const left = Math.round((t(x.end) - t(sentOn)) / DAY)
    const longDate = new Date(`${sentOn}T00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return `<div class="mt-head"><h1>Email del promemoria</h1></div>
    <p class="hint" style="margin:-6px 0 14px">Template a sé (non il riepilogo delle 8): un'email per contratto. Stile «Bollettino» come le altre email di Archie. Senza importi: va anche a indirizzi esterni.</p>
    <div class="ml-env">
      <div class="ml-meta"><span>Da</span><b>Archie &lt;noreply@biotron.it&gt;</b><span>A</span><b>${esc(sv.email)}</b><span>Cc</span><b>${officeList(SETTINGS.office).map(esc).join(', ')}</b><span>Oggetto</span><b>Rinnovo contratto ${esc(x.code)} · ${esc(x.cust)} · scade il ${dIt(x.end)}</b></div>
      <article class="ml">
        <header class="ml-h"><span class="ml-logo">archie</span><span class="ml-date">${longDate}</span></header>
        <div class="ml-tab">Contratti · promemoria ${sentI} di ${list.length}</div>
        <div class="ml-b">
          <h2>Il contratto ${esc(x.code)} scade il ${dShort(x.end)}</h2>
          <p>Ciao ${esc(x.seller.split(' ')[0])}, mancano <b>${left} giorni</b> alla fine del contratto con <b>${esc(x.cust)}</b>: è il momento di preparare e proporre il rinnovo.</p>
          <table class="ml-t"><tr><th>Contratto</th><td>${esc(x.title)}<br><small>${esc(x.code)} · ${TYPES[x.type]} · ${esc(x.company)}</small></td></tr>
            <tr><th>Cliente</th><td>${esc(x.cust)}</td></tr>
            <tr><th>Periodo</th><td>${dIt(x.start)} → <b>${dIt(x.end)}</b></td></tr>
            <tr><th>Venditore</th><td>${esc(x.seller)}</td></tr>
            <tr><th>Device</th><td>${x.devices.length} collegati</td></tr></table>
          <a class="ml-btn" href="#" onclick="return false">Apri il contratto in Archie</a>
          <p class="ml-small">${next ? `Se il contratto non viene rinnovato, il prossimo promemoria arriva il ${dShort(next)}.` : 'È l\'ultimo promemoria.'} I promemoria si fermano quando in Archie si sposta in avanti la data di fine o si segna il contratto come chiuso.</p>
        </div>
        <footer class="ml-f">Ricevi questa email perché sei il venditore del contratto o un indirizzo dell'ufficio impostato in Archie.</footer>
      </article>
    </div>`
  }

  // ═══ Render ═════════════════════════════════════════════════════
  const render = (keepScroll = true) => {
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view === 'set' ? vSet() : view === 'mail' ? vMail() : vCtr()
    const s2 = $('.ud-scrim', root); if (s2) s2.scrollTop = sc || 0
    document.querySelectorAll('[data-ctrnv]').forEach((b) => b.setAttribute('aria-pressed', String(noValue)))
    document.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === view)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', view === 'ctr' && a.textContent.trim().startsWith('Contratti')))
  }
  const leave = () => open == null || !editing || !changes(open).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const reset = () => { if (open != null) drafts.delete(open); editing = false; menu = false }
  const openRec = (i) => { if (!leave()) return; reset(); open = i; sel = i; render(false) }
  const close = () => { if (!leave()) return; reset(); open = null; render() }
  const toast = (msg) => { const el = $('[data-toast]'); if (!el) return; el.textContent = msg; el.hidden = false; setTimeout(() => { el.hidden = true }, 2600) }

  root.addEventListener('click', (e) => {
    const tg = e.target; const x = open != null ? CTR[open] : null
    // Impostazioni
    const sl = tg.closest('[data-slead]'); if (sl) { setDraft.lead = Number(sl.dataset.slead); return render() }
    if (tg.closest('[data-s-discard]')) { setDraft = { ...SETTINGS }; return render() }
    if (tg.closest('[data-s-save]')) { Object.assign(SETTINGS, { ...setDraft, every: Number(setDraft.every) || 10 }); setDraft = { ...SETTINGS }; render(); return toast('Impostazioni salvate') }
    if (tg.closest('[data-test-mail]')) return toast(`Email di prova inviata a ${officeList(SETTINGS.office).length} indirizzi`)
    // Contratto
    if (tg.closest('[data-modal-close]') || tg.matches('[data-scrim]')) return close()
    if (tg.closest('[data-menu]')) { menu = !menu; return render() }
    if (tg.closest('[data-edit]')) { menu = false; editing = true; return render() }
    if (tg.closest('[data-close-ctr]')) { menu = false; x.st = 'chiuso'; return render() }
    if (tg.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !tg.closest('.inv-menu')) { menu = false; render() }
    const ld = tg.closest('[data-lead]'); if (ld && editing) { draft(open).lead = ld.dataset.lead; return render() }
    const row = tg.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = tg.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + CTR.length) % CTR.length)
    const g = tg.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (tg.closest('[data-discard]')) { drafts.delete(open); editing = false; return render() }
    if (tg.closest('[data-save]')) { const d = draft(open); Object.assign(x, { ...d, renew: d.renew === '1', lead: Number(d.lead), value: Number(d.value) }); drafts.delete(open); editing = false; return render() }
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  const onField = (e) => {
    const s = e.target.dataset.s
    if (s) { setDraft[s] = e.target.value; const pos = e.target.selectionStart; render(); const el = $(`[data-s="${s}"]`, root); el?.focus(); try { el?.setSelectionRange(pos, pos) } catch { /* number */ } return }
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
  document.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; store('archie-preview-ctr2-v', view); render(false) }))

  open = view === 'ctr' && !qs.get('chiuso') ? 0 : null
  render(false)
})()
