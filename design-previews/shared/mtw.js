/* Manutenzione senza drawer (anteprima mtw-base, 18/11/2026): scadenza, piano e rapportino nella finestra
   dei record, sullo schema approvato (dati come testo, «Modifica» nel ⋯, frecce sempre a destra, clic per
   selezionare e doppio clic per aprire). Tre pagine come nell'app: Scadenze, Piani, Rapportini.
   - Scadenza (piano × inventario): «Registra rapportino» come azione principale; stato della scadenza,
     storico degli interventi dell'inventario; a lato piano e inventario.
   - Piano: «Report PDF»; avanzamento del ciclo, inventari coperti con il loro stato, storico; a lato
     programmazione, note, attività.
   - Rapportino: esito con le note, PDF firmato in anteprima, «Apri issue» se l'esito non è regolare;
     a lato l'intervento.
   Dati finti modellati su /api/maintenance-*. Oggi: 18/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`
  const go = ic('chevR').replace('class="i"', 'class="i go"')

  // ═══ Dati ═══════════════════════════════════════════════════════
  const NOW = new Date('2026-11-18T00:00').getTime(); const DAY = 864e5
  const t = (s) => new Date(`${s}T00:00`).getTime()
  const dIt = (s) => (s ? s.split('-').reverse().join('/') : '—')
  const days = (s) => Math.round((t(s) - NOW) / DAY)
  const rel = (s) => { const n = days(s); if (n === 0) return 'oggi'; if (n > 0) return n > 60 ? `tra ${Math.round(n / 30)} mesi` : `tra ${n} giorni`; return -n > 60 ? `${Math.round(-n / 30)} mesi fa` : `${-n} giorni fa` }
  const RES = { ok: ['Regolare', 'ok'], partial: ['Parziale', 'warn'], ko: ['Problemi', 'err'], not_planned: ['Non prevista', 'done'] }
  const PLANS = [
    { id: 12, title: 'Manutenzione preventiva semestrale PACS', cust: 'AUSL Imola', cadence: 'Ogni 6 mesi', next: '2026-11-30', alert: 30, types: ['PACS', 'Storage'], last: '2026-05-28', active: true, covered: 4, done: 1, over: 1, notes: 'Coordinarsi con la radiologia per il fermo del nodo 1.' },
    { id: 9, title: 'Calibrazione monitor diagnostici', cust: 'Azienda Sanitaria Felsinea', cadence: 'Ogni anno, il 5 dicembre', next: '2026-12-05', alert: 45, types: ['Workstation'], last: '2025-12-05', active: true, covered: 6, done: 0, over: 0, notes: '' },
    { id: 7, title: 'Verifica gruppi di continuità', cust: 'Clinica Villa Serena', cadence: 'Ogni 3 mesi', next: '2026-11-10', alert: 15, types: ['Rete'], last: '2026-08-10', active: true, covered: 2, done: 0, over: 2, notes: '' },
  ]
  const INVS = [
    { id: 1, name: 'PACS · nodo 1', type: 'PACS', host: 'aimpacs01', kn: 'K-104233', site: 'S. Maria della Scaletta', plan: 0, due: '2026-11-30', override: null, st: 'todo' },
    { id: 2, name: 'PACS · nodo 2', type: 'PACS', host: 'aimpacs02', kn: 'K-104234', site: 'S. Maria della Scaletta', plan: 0, due: '2026-11-12', override: '2026-11-12', st: 'over' },
    { id: 3, name: 'Storage immagini', type: 'Storage', host: 'aimstor01', kn: 'K-104240', site: 'S. Maria della Scaletta', plan: 0, due: '2026-11-30', override: null, st: 'done' },
    { id: 4, name: 'Storage di backup', type: 'Storage', host: 'aimstor02', kn: '', site: 'Castel San Pietro', plan: 0, due: '2026-11-30', override: null, st: 'todo' },
    { id: 5, name: 'UPS sala server', type: 'Rete', host: '', kn: '', site: 'Villa Serena', plan: 2, due: '2026-11-10', override: null, st: 'over' },
  ]
  const EVENTS = [
    { id: 301, inv: 2, plan: 0, date: '2026-05-28', res: 'partial', tech: 'Marco Bassi', by: 'mbassi', pdf: true, notes: 'Sostituito un disco della cache. Il secondo alimentatore va cambiato al prossimo passaggio.' },
    { id: 302, inv: 3, plan: 0, date: '2026-11-14', res: 'ok', tech: 'Nicole Spazzoli', by: 'nspazzoli', pdf: true, notes: 'Firmware aggiornato, test di failover superato.' },
    { id: 303, inv: 1, plan: 0, date: '2026-05-27', res: 'ok', tech: 'Marco Bassi', by: 'mbassi', pdf: false, notes: '' },
    { id: 304, inv: 5, plan: 2, date: '2026-08-10', res: 'ko', tech: 'Anna Ferri', by: 'aferri', pdf: false, notes: 'Batterie sotto il 60%: autonomia insufficiente. Serve la sostituzione.' },
    { id: 305, inv: 4, plan: 0, date: '2026-05-28', res: 'not_planned', tech: '', by: 'mbassi', pdf: false, notes: 'Storage spento per trasloco.' },
  ]
  const P = (i) => PLANS[i]; const INV = (id) => INVS.find((x) => x.id === id)

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  let page = qs.get('pagina') || read('archie-preview-mtw-p', 'scadenze')
  let open = null; let sel = 0; let editing = false; let menu = false
  const root = $('[data-mtw]')
  const list = () => (page === 'scadenze' ? INVS.filter((x) => x.st !== 'done') : page === 'piani' ? PLANS : EVENTS)

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const sec = (id, title, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const kv = (label, val, { wide = false, mono = false, link = false } = {}) => `<div class="ikv${wide ? ' wide' : ''}"><span>${label}</span><b class="${mono ? 'mono' : ''}">${link ? `<button type="button" class="ikv-link">${val}${ic('arrowR')}</button>` : val || '<span class="ikv-none">—</span>'}</b></div>`
  const kvIn = (label, val, type = 'text', wide = false) => (editing ? `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span><input type="${type}" value="${esc(val)}"></label>` : kv(label, type === 'date' ? dIt(val) : esc(val), { wide }))
  const resTag = (r) => `<span class="st ${RES[r][1]}">${RES[r][0]}</span>`
  const dueState = (d) => (days(d) < 0 ? 'over' : days(d) <= 30 ? 'soon' : 'ok')
  const nav = () => `<span class="rec-nav${editing ? ' off' : ''}"><span class="rec-pos">${open + 1} di ${list().length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span>`
  const more = (items) => `<span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu">${items}</div>` : ''}</span>`
  const mi = (icon, label, attr = 'data-menu-close', cls = '') => `<button type="button" role="menuitem" ${attr}${cls ? ` class="${cls}"` : ''}>${ic(icon)}${label}</button>`
  const head = ({ title, chips, sub, tags, primary, menuItems }) => `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
      <h2>${title}${chips}${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2><p>${sub}</p><div class="rec-tags">${tags}</div></div>
      <div class="rec-act">${editing ? '' : primary}${more(menuItems)}${nav()}</div></div></header>`
  const bar = () => (editing ? '<div class="savebar" role="status"><span class="dot"></span><b>In modifica · nessun cambiamento</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save disabled>Salva le modifiche</button></div>' : '')
  const evRows = (evs, showInv) => evs.length ? `<div class="rows">${evs.map((e) => `<button type="button" class="row r-ev"><span class="ev-d">${dIt(e.date).slice(0, 5)}<small>${e.date.slice(0, 4)}</small></span><span class="t"><b>${showInv ? esc(INV(e.inv).name) : esc(P(e.plan).title)}</b><small>${e.tech ? esc(e.tech) : 'nessun tecnico'}${e.notes ? ` · ${esc(e.notes)}` : ''}</small></span>${resTag(e.res)}${e.pdf ? `<span class="pdfm">${ic('file')}PDF</span>` : '<span></span>'}${go}</button>`).join('')}</div>` : '<p class="empty-s">Nessun intervento registrato.</p>'

  // ═══ Scadenza ═══════════════════════════════════════════════════
  const dueRec = (x) => {
    const pl = P(x.plan); const st = dueState(x.due)
    const evs = EVENTS.filter((e) => e.inv === x.id).sort((a, b) => b.date.localeCompare(a.date))
    const last = evs[0]
    const after = '2027-05-30'
    return head({
      title: esc(x.name),
      chips: `<span class="ven-b exp-${st === 'over' ? 'err' : st === 'soon' ? 'warn' : 'ok'}">${st === 'over' ? 'Scaduta' : st === 'soon' ? 'In scadenza' : 'In regola'}</span>`,
      sub: `<button type="button" class="band-link">${esc(pl.cust)}</button> · ${esc(x.site)} · ${esc(x.type)}${x.kn ? ` · <span class="code" style="color:inherit">${esc(x.kn)}</span>` : ''}`,
      tags: `<span class="bstat${st !== 'ok' ? ' warn' : ''}">${st === 'over' ? 'scaduta il' : 'entro il'} <b>${dIt(x.due)}</b></span><button type="button" class="bstat">piano <b>${esc(pl.title)}</b></button>${last ? `<span class="bstat${last.res === 'ko' || last.res === 'partial' ? ' warn' : ''}">ultimo: <b>${RES[last.res][0].toLowerCase()}</b> il ${dIt(last.date)}</span>` : '<span class="bstat">mai registrata</span>'}`,
      primary: `<button class="btn on-band solid" type="button">${ic('check')}Registra rapportino</button>`,
      menuItems: mi('columns', 'Modifica la scadenza', 'data-edit') + mi('x', 'Non prevista in questo ciclo') + mi('wrench', 'Apri il piano') + mi('server', "Apri l'inventario"),
    }) + `<div class="rec-body"><div class="rec-main">
        <div class="pb-box ${st === 'over' ? 'err' : st === 'soon' ? 'warn' : ''}"><b>${st === 'over' ? `Scaduta il ${dIt(x.due)} · ${rel(x.due)}` : `Da fare entro il ${dIt(x.due)} · ${rel(x.due)}`}</b><small>${x.override ? `Scadenza modificata per questo inventario: il piano dice ${dIt(pl.next)}.` : `Scadenza del piano «${esc(pl.title)}».`} Avviso ${pl.alert} giorni prima.</small></div>
        ${sec('his', `Interventi su questo inventario${muted(evs.length)}`, evRows(evs, false))}
      </div><aside class="rec-rail">
        ${rcard('Scadenza', `<div class="ikvs">${kvIn('Data per questo inventario', x.due, 'date', true)}${kv('Del piano', dIt(pl.next))}${kv('Dopo questa', dIt(after))}</div>${editing ? '<p class="acc-note">Vale solo per questo inventario; il piano resta com\'è.</p>' : ''}`)}
        ${rcard('Piano', `<div class="ikvs">${kv('Nome', esc(pl.title), { wide: true, link: true })}${kv('Cadenza', esc(pl.cadence), { wide: true })}${kv('Avviso', `${pl.alert} giorni prima`)}${kv('Tipi coperti', pl.types.join(', '))}</div>`)}
        ${rcard('Inventario', `<div class="ikvs">${kv('Nome', esc(x.name), { wide: true, link: true })}${kv('Tipo', esc(x.type))}${kv('Sito', esc(x.site))}${kv('Hostname', esc(x.host), { mono: true })}${kv('K-Number', esc(x.kn), { mono: true })}</div>`)}
      </aside></div>`
  }

  // ═══ Piano ══════════════════════════════════════════════════════
  const planRec = (pl, pi) => {
    const invs = INVS.filter((x) => x.plan === pi)
    const evs = EVENTS.filter((e) => e.plan === pi).sort((a, b) => b.date.localeCompare(a.date))
    const todo = pl.covered - pl.done; const st = pl.over ? 'over' : dueState(pl.next)
    const barH = `<div class="cyc"><i class="c-ok" style="flex:${pl.done}"></i><i class="c-over" style="flex:${pl.over}"></i><i class="c-todo" style="flex:${todo - pl.over}"></i></div>
      <div class="cyc-l"><span><i class="c-ok"></i>eseguite <b>${pl.done}</b></span><span><i class="c-over"></i>scadute <b>${pl.over}</b></span><span><i class="c-todo"></i>da fare <b>${todo - pl.over}</b></span></div>`
    const invRows = invs.length ? `<div class="rows">${invs.map((x) => { const s = x.st; return `<button type="button" class="row r-inv2"><span class="sdot ${s}">${s === 'done' ? ic('check') : s === 'over' ? '!' : ''}</span><span class="t"><b>${esc(x.name)}</b><small>${esc(x.site)}${x.kn ? ` · ${esc(x.kn)}` : ''}</small></span><span class="n ${s === 'over' ? 'err' : ''}">${s === 'done' ? 'fatta' : s === 'over' ? `scaduta ${rel(x.due)}` : `entro ${dIt(x.due)}`}</span>${go}</button>` }).join('')}</div>` : '<p class="empty-s">Nessun inventario attivo di questi tipi per il cliente.</p>'
    return head({
      title: esc(pl.title),
      chips: `<span class="ven-b exp-${st === 'over' ? 'err' : st === 'soon' ? 'warn' : 'ok'}">${pl.active ? (st === 'over' ? 'Scadute' : st === 'soon' ? 'In scadenza' : 'Attivo') : 'Non attivo'}</span>`,
      sub: `<button type="button" class="band-link">${esc(pl.cust)}</button> · ${esc(pl.cadence)} · ${pl.types.join(', ')}`,
      tags: `<span class="bstat${st !== 'ok' ? ' warn' : ''}">prossima <b>${dIt(pl.next)}</b></span><span class="bstat">ciclo <b>${pl.done}/${pl.covered}</b></span>${pl.over ? `<button type="button" class="bstat warn" data-goto="inv"><b>${pl.over}</b> scadute</button>` : ''}`,
      primary: `<button class="btn on-band solid" type="button">${ic('download')}Report PDF</button>`,
      menuItems: mi('columns', 'Modifica', 'data-edit') + mi('filter', 'Tutti i campi (cadenza, tipi)…') + mi('calendar', 'Vedi le scadenze') + mi('trash', 'Sposta nel cestino', 'data-menu-close', 'danger'),
    }) + `<div class="rec-body"><div class="rec-main">
        ${sec('cyc', `Avanzamento del ciclo${muted(`${pl.done} di ${pl.covered}`)}`, barH)}
        ${sec('inv', `Inventari coperti${muted(invs.length)}`, invRows)}
        ${sec('his', `Storico rapportini${muted(evs.length)}`, evRows(evs, true))}
      </div><aside class="rec-rail">
        ${rcard('Programmazione', `<div class="ikvs">${editing ? kvIn('Titolo', pl.title, 'text', true) : ''}${kv('Cliente', esc(pl.cust), { wide: true, link: true })}${kv('Cadenza', esc(pl.cadence), { wide: true })}${kvIn('Prossima scadenza', pl.next, 'date')}${kvIn('Avviso (giorni prima)', String(pl.alert))}${kv('Tipi coperti', pl.types.join(', '))}${kv('Ultima esecuzione', dIt(pl.last))}${editing ? '<label class="ikv"><span>Stato</span><select><option>Attivo</option><option>Non attivo</option></select></label>' : kv('Stato', pl.active ? 'Attivo' : 'Non attivo')}</div>${editing ? '<p class="acc-note">Cadenza e tipi coperti da «Tutti i campi…»: cambiano gli inventari del ciclo.</p>' : ''}`)}
        ${rcard('Note', editing ? `<textarea class="notes" rows="3">${esc(pl.notes)}</textarea>` : pl.notes ? `<p class="notes-ro">${esc(pl.notes)}</p>` : '<p class="empty-s">Nessuna nota.</p>')}
        ${rcard('Attività recente', `<ul class="mini-feed"><li>${ic('wrench')}<span><b>Marco Bassi</b> ha cambiato l'avviso da 15 a 30 giorni</span><time>02/11</time></li><li>${ic('plus')}<span><b>Marco Bassi</b> ha creato il piano</span><time>10/01/2025</time></li></ul>`)}
      </aside></div>`
  }

  // ═══ Rapportino ═════════════════════════════════════════════════
  const evRec = (e) => {
    const x = INV(e.inv); const pl = P(e.plan); const np = e.res === 'not_planned'; const bad = e.res === 'ko' || e.res === 'partial'
    const OUT = { ok: 'Eseguita, tutto regolare', partial: 'Eseguita in parte', ko: 'Problemi da risolvere', not_planned: 'Non prevista in questo ciclo' }
    return head({
      title: esc(x.name),
      chips: `<span class="ven-b exp-${RES[e.res][1] === 'ok' ? 'ok' : RES[e.res][1] === 'warn' ? 'warn' : RES[e.res][1] === 'err' ? 'err' : 'ok'}">${RES[e.res][0]}</span>`,
      sub: `<button type="button" class="band-link">${esc(pl.cust)}</button> · ${esc(x.site)} · <button type="button" class="band-link">${esc(pl.title)}</button>`,
      tags: `<span class="bstat">del <b>${dIt(e.date)}</b></span>${e.tech ? `<span class="bstat">tecnico <b>${esc(e.tech)}</b></span>` : ''}${np ? '' : `<span class="bstat${e.pdf ? '' : ' warn'}">${e.pdf ? 'PDF firmato' : 'PDF mancante'}</span>`}`,
      primary: bad ? `<button class="btn on-band solid" type="button">${ic('alert')}Apri issue</button>` : !np && !e.pdf ? `<button class="btn on-band solid" type="button">${ic('upload')}Carica il PDF</button>` : '',
      menuItems: mi('columns', 'Modifica', 'data-edit') + (np ? '' : mi('x', 'Segna come non prevista')) + mi('server', "Apri l'inventario") + mi('trash', 'Elimina il rapportino', 'data-menu-close', 'danger'),
    }) + `<div class="rec-body"><div class="rec-main">
        <div class="pb-box ${e.res === 'ok' ? 'okb' : RES[e.res][1]}"><b>${OUT[e.res]}</b><small>${editing ? '' : esc(e.notes) || 'Nessuna nota.'}</small>${editing ? `<textarea class="notes" rows="3">${esc(e.notes)}</textarea>` : ''}</div>
        ${np ? '' : sec('pdf', 'Rapportino firmato', e.pdf ? `<div class="pdfv"><div class="pdfv-page"><b>RAPPORTO DI INTERVENTO</b><i></i><i></i><i class="s"></i><i></i><i class="s"></i><span>Firma del tecnico ________</span></div></div><div class="docf" style="margin-top:10px"><span class="ext pdf">PDF</span><span class="t"><b>Rapportino ${dIt(e.date)}.pdf</b><small>caricato da ${esc(e.by)}</small></span><span class="acts"><button class="icon-btn" type="button" aria-label="Apri">${ic('eye')}</button><button class="icon-btn" type="button" aria-label="Sostituisci">${ic('upload')}</button><button class="icon-btn" type="button" aria-label="Rimuovi">${ic('trash')}</button></span></div>` : `<button type="button" class="upl">${ic('upload')}<span><b>Carica il PDF firmato</b><small>Trascinalo qui o sfoglia</small></span></button>`)}
        ${bad ? sec('fol', 'Seguito', `<div class="conv" style="border-color:var(--warning);background:var(--warning-bg)">${ic('alert')}<span><b>Il ripasso va seguito.</b> Apri una issue collegata all'inventario per non perderlo.</span><button class="btn" type="button">Apri issue</button></div>`) : ''}
      </div><aside class="rec-rail">
        ${rcard('Intervento', `<div class="ikvs">${kvIn('Data', e.date, 'date')}${editing ? `<label class="ikv"><span>Esito</span><select>${Object.entries(RES).map(([k, [l]]) => `<option${k === e.res ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : kv('Esito', RES[e.res][0])}${kvIn('Tecnico', e.tech, 'text', true)}${kv('Inventario', esc(x.name), { wide: true, link: true })}${kv('Piano', esc(pl.title), { wide: true, link: true })}${kv('Registrato da', esc(e.by))}</div>`)}
      </aside></div>`
  }

  // ═══ Pagine ═════════════════════════════════════════════════════
  const TITLE = { scadenze: 'Scadenze', piani: 'Piani', rapportini: 'Rapportini' }
  const table = () => {
    if (page === 'scadenze') return `<table class="po-table c-list"><thead><tr><th>Inventario</th><th>Piano</th><th>Cliente · sito</th><th>Scadenza</th></tr></thead><tbody>${list().map((x, i) => { const s = dueState(x.due); return `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${esc(x.name)}</b><br><small style="color:var(--muted)">${esc(x.type)}</small></td><td>${esc(P(x.plan).title)}</td><td>${esc(P(x.plan).cust)}<br><small style="color:var(--muted)">${esc(x.site)}</small></td><td><span class="st ${s === 'over' ? 'err' : s === 'soon' ? 'warn' : 'ok'}">${dIt(x.due)}</span></td></tr>` }).join('')}</tbody></table>`
    if (page === 'piani') return `<table class="po-table c-list"><thead><tr><th>Piano</th><th>Cliente</th><th>Cadenza</th><th>Ciclo</th><th>Prossima</th></tr></thead><tbody>${PLANS.map((pl, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${esc(pl.title)}</b></td><td>${esc(pl.cust)}</td><td>${esc(pl.cadence)}</td><td>${pl.done}/${pl.covered}${pl.over ? ` <span class="st err">${pl.over} scadute</span>` : ''}</td><td>${dIt(pl.next)}</td></tr>`).join('')}</tbody></table>`
    return `<table class="po-table c-list"><thead><tr><th>Data</th><th>Inventario</th><th>Piano</th><th>Esito</th><th>Tecnico</th><th>PDF</th></tr></thead><tbody>${EVENTS.map((e, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td>${dIt(e.date)}</td><td><b>${esc(INV(e.inv).name)}</b></td><td>${esc(P(e.plan).title)}</td><td>${resTag(e.res)}</td><td>${esc(e.tech) || '—'}</td><td>${e.pdf ? 'sì' : e.res === 'not_planned' ? '—' : '<span style="color:var(--warning)">manca</span>'}</td></tr>`).join('')}</tbody></table>`
  }
  const record = () => {
    const L = list(); const r = L[open]
    const body = page === 'scadenze' ? dueRec(r) : page === 'piani' ? planRec(r, open) : evRec(r)
    return `<div class="record${editing ? ' is-editing' : ''}">${body}${bar()}</div>`
  }
  const view = () => `<div class="mt-head"><h1>Manutenzione · ${TITLE[page]}</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}${page === 'piani' ? 'Nuovo piano' : 'Registra rapportino'}</button></div></div>
    <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="${TITLE[page]}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  const render = (keep = true) => {
    const sc = keep ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view()
    const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0
    document.querySelectorAll('[data-mtwp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mtwp === page)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Manutenzione')))
  }
  const openRec = (i) => { editing = false; menu = false; open = i; sel = i; render(false) }
  const close = () => { editing = false; menu = false; open = null; render() }

  root.addEventListener('click', (e) => {
    const tg = e.target
    if (tg.closest('[data-modal-close]') || tg.matches('[data-scrim]')) return close()
    if (tg.closest('[data-menu]')) { menu = !menu; return render() }
    if (tg.closest('[data-edit]')) { menu = false; editing = true; return render() }
    if (tg.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !tg.closest('.inv-menu')) { menu = false; render() }
    const row = tg.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = tg.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + list().length) % list().length)
    const g = tg.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (tg.closest('[data-discard]')) { editing = false; return render() }
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-row]')) { e.preventDefault(); openRec(Number(e.target.dataset.row)) } })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('[data-palette-bg]')?.hidden !== false) { if (menu) { menu = false; return render() } if (open != null) close() } })
  document.querySelectorAll('[data-mtwp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.mtwp; store('archie-preview-mtw-p', page); open = 0; sel = 0; editing = false; menu = false; render(false) }))

  open = qs.get('chiuso') ? null : 0
  render(false)
})()
