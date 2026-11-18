/* Issue senza drawer (anteprima iss-base, 18/11/2026). Due varianti da confrontare:
   A · «Finestra»: la issue si apre nella finestra dei record, come cliente, sito, contatto e inventario.
   B · «Pagina divisa»: elenco stretto a sinistra e issue aperta a destra nella pagina, senza finestra
       sopra: si passa da una issue all'altra con un clic o con ↑ ↓, l'elenco resta sempre in vista.
   In tutte e due: i dati si leggono come testo e «Modifica» nel ⋯ li trasforma in campi (schema delle
   anagrafiche); stato, priorità e assegnatario però si cambiano al volo con un clic, perché nelle issue
   cambiano di continuo. Prossimo passo e procedura Wiki, descrizione, tempo dall'apertura, dove
   intervenire, attività (commenti e modifiche insieme) con il commento da scrivere in fondo.
   Dati finti modellati su /api/issues/. Oggi: 18/11/2026 10:30. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const STATUS = { open: ['Aperta', 'aperta'], in_progress: ['In lavorazione', 'lav'], waiting: ['In attesa', 'att'], resolved: ['Risolta', 'ok'], closed: ['Chiusa', 'done'] }
  const PRIO = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Bassa' }
  const USERS = ['Federico Mutuale', 'Marco Bassi', 'Nicole Spazzoli', 'Anna Ferri']
  const CATS = ['Software', 'Hardware', 'Rete', 'DICOM', 'Licenze']
  const WAIT = { '': '—', philips: 'Philips', cliente: 'Cliente', elco: 'Elco', exprivia: 'Exprivia', altro: 'Altro' }
  const I = (o) => ({ wiki: null, comments: [], events: [], sn: '', inv: '', invHost: '', cat: 'Software', wait: '', desc: '', ...o })
  const ISS = [
    I({ id: 1041, title: 'Worklist vuota sulla CT 2', st: 'in_progress', pr: 'high', who: 'Federico Mutuale', cust: 'AUSL Imola', site: 'S. Maria della Scaletta', inv: 'CT 2 · Siemens SOMATOM', invHost: 'aimct02', sn: 'INC0412877', cat: 'DICOM',
      opened: '2026-11-16T08:40', due: '2026-11-19', desc: 'Dalle 7:30 la CT 2 non riceve più la worklist dal RIS. Gli esami vengono inseriti a mano dai tecnici. Il ping verso il RIS risponde, la query C-FIND va in timeout.',
      wiki: { title: 'KB-0142 · Worklist DICOM non ricevuta', steps: [['Verificare AE title e porta della modalità', true], ['Provare la C-FIND dal server worklist', true], ['Controllare il servizio Worklist Broker sul RIS', false], ['Riavviare il broker in orario concordato', false]] },
      comments: [['Marco Bassi', '2026-11-16T09:12', 'Confermo: la C-FIND va in timeout dopo 30 secondi. Lato modalità tutto ok.'], ['Federico Mutuale', '2026-11-17T15:40', 'Sentito il CED: il broker è stato aggiornato domenica. Riavvio concordato per domani alle 7.']],
      events: [['Federico Mutuale', '2026-11-16T08:55', 'ha preso in carico la issue'], ['Marco Bassi', '2026-11-16T10:20', 'ha cambiato la priorità da Media ad Alta'], ['Federico Mutuale', '2026-11-17T15:41', 'ha impostato la scadenza al 19/11']] }),
    I({ id: 1038, title: 'Stampante pellicole non risponde', st: 'waiting', pr: 'medium', who: 'Anna Ferri', cust: 'AUSL Bologna', site: 'Ospedale Maggiore', wait: 'philips', cat: 'Hardware', opened: '2026-11-12T11:00', due: '2026-11-25', desc: 'La DryView in sala 4 non accetta lavori. In attesa del ricambio da Philips.', comments: [['Anna Ferri', '2026-11-13T09:00', 'Ordinata la scheda di rete, consegna prevista il 21.']] }),
    I({ id: 1033, title: 'Lentezza apertura studi in refertazione', st: 'open', pr: 'medium', who: '', cust: 'AUSL Bologna', site: 'Ospedale Maggiore', inv: 'Server applicativo RIS', invHost: 'bomris01', cat: 'Software', opened: '2026-11-17T14:20', due: '', desc: 'I radiologi segnalano 20-30 secondi per aprire uno studio TC.' }),
    I({ id: 1029, title: 'Licenze client IntelliSpace esaurite', st: 'open', pr: 'critical', who: 'Marco Bassi', cust: 'Azienda Sanitaria Felsinea', site: 'Presidio San Petronio', cat: 'Licenze', sn: 'INC0412650', opened: '2026-11-18T07:50', due: '2026-11-18', desc: 'Nuove postazioni di refertazione non riescono ad accedere: licenze esaurite.' }),
    I({ id: 1021, title: 'Backup notturno non completato', st: 'in_progress', pr: 'low', who: 'Nicole Spazzoli', cust: 'AUSL Imola', site: 'S. Maria della Scaletta', inv: 'Storage immagini', invHost: 'aimstor01', cat: 'Software', opened: '2026-11-10T08:00', due: '2026-11-30', desc: 'Il job delle 2:00 termina con errore di spazio sul volume di destinazione.' }),
    I({ id: 1012, title: 'Rallentamenti nel recupero degli studi dal VNA', st: 'resolved', pr: 'medium', who: 'Marco Bassi', cust: 'AUSL Imola', site: 'S. Maria della Scaletta', cat: 'Rete', opened: '2026-11-02T10:00', closed: '2026-11-04T16:30', due: '', desc: 'Recupero di studi vecchi molto lento.' }),
  ]
  const NOW = new Date('2026-11-18T10:30').getTime()
  const DAY = 864e5
  const fmt = (s) => { const d = new Date(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
  const fmtT = (s) => { const d = new Date(s); return `${fmt(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
  const dur = (ms) => { const h = Math.round(Math.abs(ms) / 36e5); const g = Math.floor(h / 24); return g >= 1 ? `${g} ${g === 1 ? 'giorno' : 'giorni'}` : `${h} ${h === 1 ? 'ora' : 'ore'}` }
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  let variant = qs.get('variante') || read('archie-preview-iss-v', 'A')
  let open = null; let sel = 0; let editing = false; let menu = false; let pick = null; let feedF = 'all'; let comment = ''
  const drafts = new Map()
  const root = $('[data-iss]')
  const KEYS = ['title', 'cat', 'due', 'sn', 'desc', 'wait']
  const FIELDS = (x) => Object.fromEntries(KEYS.map((k) => [k, x[k] ?? '']))
  const draft = (n) => { if (!drafts.has(n)) drafts.set(n, FIELDS(ISS[n])); return drafts.get(n) }
  const changes = (n) => { const d = draft(n); const o = FIELDS(ISS[n]); return KEYS.filter((f) => d[f] !== o[f]) }
  const dirty = (f) => (draft(open)[f] !== FIELDS(ISS[open])[f] ? ' dirty' : '')
  const cur = () => (editing ? draft(open) : FIELDS(ISS[open]))

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const sec = (id, title, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const none = '<span class="ikv-none">—</span>'
  const kv = (f, label, { wide = false, type = 'text', fmtV = (v) => esc(v), mono = false, area = false } = {}) => {
    const v = cur()[f]
    if (editing) return `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span>${area ? `<textarea data-f="${f}" class="notes${dirty(f)}" rows="4">${esc(v)}</textarea>` : `<input data-f="${f}" type="${type}" value="${esc(v)}" class="${mono ? 'mono' : ''}${dirty(f)}">`}</label>`
    return `<div class="ikv${wide ? ' wide' : ''}"><span>${label}</span><b class="${mono ? 'mono' : ''}">${v ? fmtV(v) : none}</b></div>`
  }
  const kvSel = (f, label, opts) => {
    const v = cur()[f]
    if (editing) return `<label class="ikv"><span>${label}</span><select data-f="${f}" class="${dirty(f)}">${opts.map(([o, l]) => `<option value="${o}"${o === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
    return `<div class="ikv"><span>${label}</span><b>${esc((opts.find(([o]) => o === v) || [, ''])[1]) || none}</b></div>`
  }
  const prioMark = (p) => `<span class="pmark p-${p}" aria-hidden="true"><i></i><i></i><i></i></span>`
  const stTag = (s) => `<span class="st ${STATUS[s][1]}">${STATUS[s][0]}</span>`

  /* Al volo: stato, priorità, assegnatario si cambiano con un clic, senza entrare in «Modifica». */
  const quick = (k, label, valueHtml, opts, after = '') => `<div class="ikv qk${k === 'who' ? ' wide' : ''}"><span>${label}</span><span class="qrow"><span class="menu-anchor"><button type="button" class="qbtn" data-pick="${k}" aria-haspopup="menu" aria-expanded="${pick === k}"${closedNow() ? ' disabled' : ''}>${valueHtml}${closedNow() ? '' : ic('chevD')}</button>${pick === k ? `<div class="inv-menu qmenu" role="menu">${opts.map(([v, l]) => `<button type="button" role="menuitemradio" data-set="${k}:${v}">${l}</button>`).join('')}</div>` : ''}</span>${after}</span></div>`
  const closedNow = () => ISS[open].st === 'closed'
  const props = (x) => `<div class="ikvs">
      ${quick('st', 'Stato', stTag(x.st), Object.keys(STATUS).filter((s) => s !== 'closed').map((s) => [s, stTag(s)]))}
      ${quick('pr', 'Priorità', `<span class="pv">${prioMark(x.pr)}${PRIO[x.pr]}</span>`, Object.keys(PRIO).map((p) => [p, `<span class="pv">${prioMark(p)}${PRIO[p]}</span>`]))}
      ${quick('who', 'Assegnata a', x.who ? `<span class="pv"><span class="uav sm">${ini(x.who)}</span>${esc(x.who)}</span>` : '<span class="pv" style="color:var(--warning)">Non assegnata</span>', [['', 'Nessuno'], ...USERS.map((u) => [u, `<span class="pv"><span class="uav sm">${ini(u)}</span>${u}</span>`])], !x.who && !closedNow() ? '<button type="button" class="lnk me-lnk" data-me>Assegna a me</button>' : '')}
      ${x.st === 'waiting' || editing ? kvSel('wait', 'In attesa di', Object.entries(WAIT)) : ''}
      ${kv('due', 'Scadenza', { type: 'date', fmtV: (v) => v.split('-').reverse().join('/') })}
      ${kvSel('cat', 'Categoria', CATS.map((c) => [c, c]))}
      ${kv('sn', 'ServiceNow', { mono: true, fmtV: (v) => `<button type="button" class="ikv-link">${esc(v)}${ic('arrowR')}</button>` })}
    </div>`
  const timeline = (x) => {
    const op = new Date(x.opened).getTime(); const isClosed = x.st === 'resolved' || x.st === 'closed'
    const end = isClosed && x.closed ? new Date(x.closed).getTime() : NOW
    const due = x.due ? new Date(`${x.due}T18:00`).getTime() : null
    const over = !isClosed && due != null && NOW > due
    const span = Math.max((due && due > end ? due : end + Math.max((end - op) * 0.25, DAY / 2)) - op, 1)
    const pos = (t) => Math.max(0, Math.min(100, ((t - op) / span) * 100))
    const tone = over ? 'err' : due != null && due - NOW < DAY * 1.5 && !isClosed ? 'warn' : ''
    return `<div class="tl"><div class="tl-h"><div><small>${isClosed ? 'Rimasta aperta' : 'Aperta da'}</small><b>${dur(end - op)}</b></div><span class="tl-tag ${tone}">${isClosed ? `Chiusa il ${fmt(x.closed)}` : due == null ? 'Senza scadenza' : over ? `Scaduta da ${dur(NOW - due)}` : `Scade tra ${dur(due - NOW)}`}</span></div>
      <div class="tl-bar"><i class="dash"></i><i class="fill${over ? ' over' : ''}" style="width:${pos(end)}%"></i><i class="dot" style="left:0"></i>${x.events.map(([, t]) => `<i class="dot sm" style="left:${pos(new Date(t).getTime())}%"></i>`).join('')}${!isClosed ? `<i class="now" style="left:${pos(NOW)}%"><em>ORA</em></i>` : ''}${due ? `<i class="due" style="left:${pos(due)}%"></i>` : ''}</div>
      <div class="tl-f"><span>${fmt(x.opened)}</span><span>${x.due ? `Scadenza ${x.due.split('-').reverse().join('/')}` : ''}</span></div></div>`
  }
  const nextStep = (x) => { if (!x.wiki) return ''; const n = x.wiki.steps.find((s) => !s[1]); const done = x.wiki.steps.filter((s) => s[1]).length
    return n ? `<div class="next"><span class="next-ic">${ic('arrowR')}</span><div><small>Prossimo passo · ${done} di ${x.wiki.steps.length}</small><b>${esc(n[0])}</b></div><button type="button" class="btn" data-step-done>Fatto</button></div>` : '' }
  const procedure = (x) => x.wiki ? sec('proc', `Procedura${muted(`${x.wiki.steps.filter((s) => s[1]).length} di ${x.wiki.steps.length}`)}`, `<p class="proc-t">${ic('book')}<a href="#">${esc(x.wiki.title)}</a></p><div class="steps">${x.wiki.steps.map(([t, d], i) => `<label class="wstep${d ? ' done' : ''}"><input type="checkbox" data-wstep="${i}"${d ? ' checked' : ''}${closedNow() ? ' disabled' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`, '<button class="lnk" type="button">+ Collega un articolo</button>')
    : sec('proc', 'Procedura', '<p class="empty-s">Nessun articolo Wiki collegato.</p>', '<button class="lnk" type="button">+ Collega un articolo</button>')
  const where = (x) => `<div class="rows">
      <button type="button" class="row r-doc"><span class="doc-ic">${ic('building')}</span><span class="t"><b>${esc(x.cust)}</b><small>Cliente</small></span><span></span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>
      ${x.site ? `<button type="button" class="row r-doc"><span class="doc-ic">${ic('pin')}</span><span class="t"><b>${esc(x.site)}</b><small>Sito</small></span><span></span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>` : ''}
      ${x.inv ? `<button type="button" class="row r-doc"><span class="doc-ic">${ic('server')}</span><span class="t"><b>${esc(x.inv)}</b><small>Inventario · <span class="code">${esc(x.invHost)}</span></small></span><span></span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>` : '<p class="empty-s">Nessun inventario collegato. <button class="lnk" type="button">Collega un inventario</button></p>'}
    </div>`
  const feed = (x) => {
    const items = [...x.comments.map((c) => ({ k: 'cm', at: c[1], c })), ...x.events.map((e) => ({ k: 'ev', at: e[1], e }))].sort((a, b) => a.at.localeCompare(b.at))
    const shown = items.filter((i) => feedF === 'all' || i.k === feedF)
    const seg = `<div class="typefilter" role="group" aria-label="Filtra attività">${[['all', 'Tutto', items.length], ['cm', 'Commenti', x.comments.length], ['ev', 'Modifiche', x.events.length]].map(([k, l, n]) => `<button type="button" data-feed="${k}" aria-pressed="${feedF === k}">${l} ${n}</button>`).join('')}</div>`
    const list = shown.length ? shown.map((i) => i.k === 'cm'
      ? `<div class="cm"><span class="uav sm">${ini(i.c[0])}</span><div class="cm-b"><div class="cm-h"><b>${esc(i.c[0])}</b><time>${fmtT(i.c[1])}</time></div><p>${esc(i.c[2])}</p></div></div>`
      : `<div class="ev">${ic('history')}<span><b>${esc(i.e[0])}</b> ${esc(i.e[2])}</span><time>${fmtT(i.e[1])}</time></div>`).join('') : '<p class="empty-s">Nessun commento. Scrivi il primo qui sotto.</p>'
    const box = closedNow() ? '<p class="empty-s">Issue chiusa: non si commenta più.</p>' : `<div class="composer"><textarea data-comment placeholder="Scrivi un commento… (Ctrl+Invio per inviare)" aria-label="Scrivi un commento" rows="2">${esc(comment)}</textarea><button class="btn btn-primary" type="button" data-send${comment.trim() ? '' : ' disabled'}>Commenta</button></div>`
    return sec('att', `Attività${muted(items.length)}`, `<div class="feed">${list}</div>${box}`, seg)
  }

  // ═══ La issue (uguale nelle due varianti, cambia solo il contenitore) ═══
  const record = (inPage) => {
    const x = ISS[open]; const d = cur()
    const isClosed = x.st === 'closed'; const resolved = x.st === 'resolved'
    const moreMenu = menu ? `<div class="inv-menu" role="menu">
        <button type="button" role="menuitem" data-edit${isClosed ? ' disabled' : ''}>${ic('columns')}Modifica</button>
        <button type="button" role="menuitem" data-menu-close${isClosed ? ' disabled' : ''}>${ic('server')}${x.inv ? 'Cambia inventario collegato' : 'Collega un inventario'}</button>
        <button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il link</button>
        <button type="button" role="menuitem" class="danger" data-menu-close${isClosed ? ' disabled' : ''}>${ic('trash')}Elimina</button></div>` : ''
    const L = ISS.length
    const due = x.due ? new Date(`${x.due}T18:00`).getTime() : null
    const over = !resolved && !isClosed && due != null && NOW > due
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2><span class="code" style="opacity:.75;font-weight:500">#${x.id}</span> ${esc(d.title)}<span class="ven-b">${STATUS[x.st][0]}</span>${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p><button type="button" class="band-link">${esc(x.cust)}</button>${x.site ? ` · <button type="button" class="band-link">${esc(x.site)}</button>` : ''}${x.inv ? ` · <button type="button" class="band-link">${esc(x.inv)}</button>` : ''}${x.sn ? ` · <span class="code" style="color:inherit">${esc(x.sn)}</span>` : ''}</p>
        <div class="rec-tags"><span class="bstat${x.pr === 'critical' ? ' warn' : ''}">priorità <b>${PRIO[x.pr].toLowerCase()}</b></span><span class="bstat${x.who ? '' : ' warn'}">${x.who ? `assegnata a <b>${esc(x.who)}</b>` : 'non assegnata'}</span>${due != null && !resolved && !isClosed ? `<span class="bstat${over || due - NOW < DAY * 1.5 ? ' warn' : ''}">${over ? 'scaduta' : `scade il <b>${fmt(x.due)}</b>`}</span>` : ''}<button type="button" class="bstat" data-goto="att"><b>${x.comments.length}</b> ${x.comments.length === 1 ? 'commento' : 'commenti'}</button></div></div>
        <div class="rec-act">
          ${editing ? '' : !isClosed && !resolved ? `<button class="btn on-band solid" type="button" data-resolve>${ic('check')}Segna come risolta</button>` : resolved ? `<button class="btn on-band" type="button" data-reopen>Riapri</button>` : ''}
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${moreMenu}</span>
          ${inPage ? '' : `<span class="rec-nav${editing ? ' off' : ''}"><span class="rec-pos">${open + 1} di ${L}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span>`}</div>
      </div></header>`
    const main = `<div class="rec-main">
        ${nextStep(x)}
        ${sec('desc', 'Descrizione', editing ? kv('desc', 'Testo', { area: true, wide: true }) : `<p class="notes-ro">${esc(x.desc) || '<span style="color:var(--faint)">Nessuna descrizione.</span>'}</p>`)}
        ${procedure(x)}
        ${feed(x)}
      </div>`
    const rail = `<aside class="rec-rail" aria-label="Issue">
        ${rcard('Dettagli', `${editing ? `<div style="margin-bottom:12px">${kv('title', 'Titolo', { wide: true })}</div>` : ''}${props(x)}`)}
        ${rcard('Tempo', timeline(x))}
        ${rcard('Dove intervenire', where(x))}
        <p class="meta-f">Creata da Federico Mutuale il ${fmtT(x.opened)} · aggiornata ieri alle 15:41</p>
      </aside>`
    const n = editing ? changes(open).length : 0
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record${editing ? ' is-editing' : ''}">${head}<div class="rec-body">${main}${rail}</div>${bar}</div>`
  }

  // ═══ Pagina ═════════════════════════════════════════════════════
  const dueCell = (x) => { if (!x.due || x.st === 'resolved' || x.st === 'closed') return '—'; const t = new Date(`${x.due}T18:00`).getTime(); return `<span class="${t < NOW ? 'due-over' : t - NOW < DAY * 1.5 ? 'due-soon' : ''}">${fmt(x.due)}</span>` }
  const table = () => `<table class="po-table c-list"><thead><tr><th>#</th><th>Issue</th><th>Priorità</th><th>Stato</th><th>Assegnata a</th><th>Scadenza</th></tr></thead><tbody>${ISS.map((x, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td class="code">#${x.id}</td><td><b>${esc(x.title)}</b><br><small style="color:var(--muted)">${esc(x.cust)} · ${esc(x.site)}</small></td><td><span class="pv">${prioMark(x.pr)}${PRIO[x.pr]}</span></td><td>${stTag(x.st)}</td><td>${x.who ? esc(x.who) : '<span style="color:var(--warning)">Non assegnata</span>'}</td><td>${dueCell(x)}</td></tr>`).join('')}</tbody></table>`
  const listSplit = () => `<div class="sp-list" role="listbox" aria-label="Issue">${ISS.map((x, i) => `<button type="button" role="option" aria-selected="${i === open}" class="sp-item${i === open ? ' on' : ''}" data-open="${i}">
      <span class="sp-top"><span class="code">#${x.id}</span>${prioMark(x.pr)}${stTag(x.st)}<span class="sp-due">${dueCell(x)}</span></span>
      <b>${esc(x.title)}</b><small>${esc(x.cust)} · ${esc(x.site)}</small>
      <span class="sp-who">${x.who ? `<span class="uav sm">${ini(x.who)}</span>${esc(x.who)}` : '<span style="color:var(--warning)">Non assegnata</span>'}${x.comments.length ? `<span class="sp-cm">${ic('chat')}${x.comments.length}</span>` : ''}</span></button>`).join('')}</div>`
  const view = () => {
    const head = `<div class="mt-head"><h1>Issue</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuova issue</button></div></div>`
    if (variant === 'B') {
      return `${head}<div class="split"><aside class="sp-col"><div class="sp-tools"><span class="sp-search">${ic('search')}<span>Cerca nelle issue…</span></span><span class="sp-count">${ISS.length} issue · ↑ ↓ per scorrere</span></div>${listSplit()}</aside>
        <section class="sp-detail" aria-label="Issue aperta">${open != null ? record(true) : '<p class="empty-s">Scegli una issue dall\'elenco.</p>'}</section></div>`
    }
    return `${head}<p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire.</p>
      <section class="panel"><div class="table-wrap">${table()}</div></section>
      ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Issue #${ISS[open].id}">
        <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record(false)}</div></div>` : ''}`
  }

  const render = (keepScroll = true) => {
    const scEl = variant === 'B' ? $('.sp-detail', root) : $('.ud-scrim', root)
    const sc = keepScroll ? scEl?.scrollTop : 0
    const lsc = $('.sp-list', root)?.scrollTop
    root.innerHTML = view()
    const s2 = variant === 'B' ? $('.sp-detail', root) : $('.ud-scrim', root); if (s2) s2.scrollTop = sc || 0
    const l2 = $('.sp-list', root); if (l2 && lsc) l2.scrollTop = lsc
    document.documentElement.classList.toggle('iss-split', variant === 'B')
    document.querySelectorAll('[data-issv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.issv === variant)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Issue')))
  }
  const leave = () => open == null || !editing || !changes(open).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const reset = () => { if (open != null) drafts.delete(open); editing = false; menu = false; pick = null; comment = ''; feedF = 'all' }
  const openRec = (i) => { if (!leave()) return; reset(); open = i; sel = i; render(false) }
  const close = () => { if (!leave()) return; reset(); open = variant === 'B' ? open : null; render() }

  root.addEventListener('click', (e) => {
    const t = e.target; const x = open != null ? ISS[open] : null
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) return close()
    if (t.closest('[data-menu]')) { menu = !menu; pick = null; return render() }
    if (t.closest('[data-edit]') && !closedNow()) { menu = false; editing = true; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    const pk = t.closest('[data-pick]'); if (pk) { pick = pick === pk.dataset.pick ? null : pk.dataset.pick; menu = false; return render() }
    const st = t.closest('[data-set]'); if (st) { const [k, v] = st.dataset.set.split(':'); x[k] = v; if (k === 'st' && v !== 'waiting') x.wait = ''; pick = null; return render() }
    if ((menu || pick) && !t.closest('.inv-menu')) { menu = false; pick = null; render() }
    const row = t.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const op = t.closest('[data-open]'); if (op) return openRec(Number(op.dataset.open))
    const step = t.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + ISS.length) % ISS.length)
    const g = t.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const fd = t.closest('[data-feed]'); if (fd) { feedF = fd.dataset.feed; return render() }
    if (t.closest('[data-me]')) { x.who = 'Federico Mutuale'; return render() }
    if (t.closest('[data-resolve]')) { x.st = 'resolved'; x.closed = '2026-11-18T10:30'; return render() }
    if (t.closest('[data-reopen]')) { x.st = 'in_progress'; x.closed = null; return render() }
    if (t.closest('[data-step-done]')) { const n = x.wiki.steps.find((s) => !s[1]); if (n) n[1] = true; return render() }
    if (t.closest('[data-send]')) { if (comment.trim()) { x.comments.push(['Federico Mutuale', '2026-11-18T10:30', comment.trim()]); comment = '' } return render() }
    if (t.closest('[data-discard]')) { drafts.delete(open); editing = false; return render() }
    if (t.closest('[data-save]')) { Object.assign(x, draft(open)); drafts.delete(open); editing = false; return render() }
  })
  root.addEventListener('change', (e) => {
    const w = e.target.closest('[data-wstep]'); if (w) { ISS[open].wiki.steps[Number(w.dataset.wstep)][1] = w.checked; return render() }
    if (e.target.tagName === 'SELECT') onField(e)
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  const onField = (e) => {
    if (e.target.matches('[data-comment]')) { comment = e.target.value; const b = $('[data-send]', root); if (b) b.disabled = !comment.trim(); return }
    const f = e.target.dataset.f; if (!f || open == null || !editing) return
    draft(open)[f] = e.target.value
    if (e.target.tagName === 'SELECT') return render()
    e.target.classList.toggle('dirty', draft(open)[f] !== FIELDS(ISS[open])[f])
    const rec = $('.record', root); const tmp = document.createElement('div'); tmp.innerHTML = record(variant === 'B')
    $('.rec-head', rec).replaceWith($('.rec-head', tmp)); $('.savebar', rec)?.replaceWith($('.savebar', tmp))
  }
  root.addEventListener('input', onField)
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('tr[data-row]')) { e.preventDefault(); openRec(Number(e.target.dataset.row)) }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('[data-comment]')) { e.preventDefault(); $('[data-send]', root)?.click() }
  })
  document.addEventListener('keydown', (e) => {
    if ($('[data-palette-bg]')?.hidden === false || e.target.matches('input, textarea, select')) return
    if (e.key === 'Escape') { if (menu || pick) { menu = false; pick = null; return render() } if (variant === 'A' && open != null) close() }
    if (variant === 'B' && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && open != null) { e.preventDefault(); openRec(Math.max(0, Math.min(ISS.length - 1, open + (e.key === 'ArrowDown' ? 1 : -1)))); $('.sp-item.on', root)?.scrollIntoView({ block: 'nearest' }) }
  })
  document.querySelectorAll('[data-issv]').forEach((b) => b.addEventListener('click', () => { if (!leave()) return; reset(); variant = b.dataset.issv; store('archie-preview-iss-v', variant); open = 0; sel = 0; render(false) }))

  open = qs.get('chiuso') ? null : 0
  render(false)
})()
