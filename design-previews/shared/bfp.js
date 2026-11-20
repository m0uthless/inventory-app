/* Bug e feature e Profilo senza drawer (anteprima bfp-base, 19/11/2026), nella finestra dei record.
   · Bug e feature: la segnalazione si apre dalla bacheca (clic seleziona la scheda, doppio clic o Invio apre;
     ‹ › scorrono la colonna). «Segna come risolta» / «Rifiuta» in testata per chi può chiuderla, «Riapri» se è
     chiusa. Al centro esito, descrizione e screenshot; a lato i dati e la storia.
   · Profilo: una pagina sola al posto delle cinque schede. A lato i dati personali (lettura, poi «Modifica i dati»
     in testata: una sola barra di salvataggio) e i gruppi; al centro aspetto, sicurezza (password e accessi),
     permessi per modulo e attività recente. Niente frecce: è uno solo.
   Dati finti. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  const ini = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const sec = (title, body, end = '') => `<section class="rec-sec"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const kv = (l, v, o = {}) => `<div class="ikv${o.wide ? ' wide' : ''}"><span>${l}</span><b${o.mono ? ' class="mono"' : ''}>${v === '' || v == null ? '<span class="ikv-none">—</span>' : v}</b></div>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const R = [
    { id: 41, kind: 'bug', st: 'open', col: 'bug', title: 'Il filtro cliente del Drive si azzera dopo il caricamento', sec: 'Drive', who: 'Marco Bassi', ago: '2 giorni fa', when: '17/11/2026',
      desc: 'Il filtro cliente del Drive si azzera dopo il caricamento di un file.\nSuccede solo se carico trascinando il file nella cartella, non con il pulsante «Carica file».', shot: true },
    { id: 39, kind: 'bug', st: 'open', col: 'bug', title: 'Doppio clic sul monitor apre due finestre', sec: 'Monitor', who: 'Anna Ferri', ago: '3 giorni fa', when: '16/11/2026', desc: 'Doppio clic sul monitor apre due finestre una sopra l\'altra.', shot: false },
    { id: 37, kind: 'feature', st: 'open', col: 'feat', title: 'Esportare i rapportini del mese in un solo PDF', sec: 'Manutenzione', who: 'Nicole Spazzoli', ago: '5 giorni fa', when: '14/11/2026', desc: 'Esportare i rapportini del mese in un solo PDF, per mandarli al cliente in un colpo.', shot: false },
    { id: 33, kind: 'bug', st: 'rejected', col: 'done', title: 'La dashboard è lenta', sec: 'Dashboard', who: 'Marco Bassi', ago: '10 giorni fa', when: '09/11/2026', desc: 'La dashboard è lenta al mattino.', shot: false, by: 'Federico Mutuale', byWhen: '11/11/2026', reason: 'Non riproducibile: la lentezza era dovuta al backup notturno che finiva tardi, ora spostato alle 2.' },
    { id: 30, kind: 'feature', st: 'resolved', col: 'done', title: 'Seguito da sui Purchase Order', sec: 'Purchase Order', who: 'Anna Ferri', ago: '2 settimane fa', when: '05/11/2026', desc: 'Poter indicare chi segue un PO.', shot: false, by: 'Federico Mutuale', byWhen: '18/11/2026' },
  ]
  const COLS = [['bug', 'Bug aperti'], ['feat', 'Funzionalità richieste'], ['done', 'Chiuse di recente']]
  const ME = { first: 'Federico', last: 'Mutuale', email: 'federico.mutuale@biotron.it', user: 'fmutuale', cust: 'AUSL Imola', groups: ['Tecnici PACS', 'Coordinatori'], role: 'Superuser' }

  // ── Stato ───────────────────────────────────────────────────────
  let page = new URLSearchParams(location.search).get('pagina') || read('archie-preview-bfp-p', 'bf')
  let open = 0; let sel = 0; let menu = false; let editing = false; let draft = {}; let mode = 'auto'; let pal = 'Campo sterile'; let pw = false; let canClose = true
  const root = $('[data-bfp]')
  const ST = { open: ['Aperta', 'warn'], resolved: ['Risolta', 'ok'], rejected: ['Rifiutata', 'neutral'] }
  const KIND = { bug: 'Bug', feature: 'Funzionalità' }
  const kindChip = (k) => `<span class="bf-kind ${k}">${ic(k === 'bug' ? 'alert' : 'plus')}${KIND[k]}</span>`

  // ═══ Bug e feature ═══════════════════════════════════════════════
  const colOf = (i) => R.filter((x) => x.col === R[i].col)
  const bfRecord = () => {
    const r = R[open]; const col = colOf(open); const k = col.indexOf(r)
    const actions = canClose ? (r.st === 'open' ? `<button class="btn on-band solid" type="button">${ic('check')}Segna come risolta</button><button class="btn on-band" type="button">${ic('x')}Rifiuta</button>` : `<button class="btn on-band" type="button">${ic('restore')}Riapri</button>`) : ''
    const more = `<span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-label="Altre azioni">${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu"><button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il link</button></div>` : ''}</span>`
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2>${esc(r.title)}<span class="ven-b">${ST[r.st][0]}</span></h2>
        <p><span class="mono" style="font-size:12px">#${r.id}</span> · ${KIND[r.kind]} · ${esc(r.sec)} · aperta ${r.ago} da ${esc(r.who)}</p>
        <div class="rec-tags">${r.shot ? '<span class="bstat">con screenshot</span>' : ''}${r.st === 'open' ? `<span class="bstat">${r.kind === 'bug' ? 'da sistemare' : 'da valutare'}</span>` : ''}</div></div>
        <div class="rec-act">${actions}${more}<span class="rec-nav"><span class="rec-pos">${k + 1} di ${col.length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo">${ic('chevR')}</button></span></div>
      </div></header>`
    const callout = r.st === 'rejected' ? `<div class="pb-box neutral"><b>Rifiutata da ${r.by} il ${r.byWhen}</b><small>${esc(r.reason)}</small></div>`
      : r.st === 'resolved' ? `<div class="pb-box ok"><b>Risolta da ${r.by} il ${r.byWhen}</b><small>Chi l'ha segnalata ha ricevuto la notifica.</small></div>` : ''
    const main = `<div class="rec-main">${callout}
      ${sec('Descrizione', `<p class="rst-desc">${esc(r.desc)}</p>`)}
      ${r.shot ? sec('Screenshot', '<button type="button" class="rst-shot bf-shot" aria-label="Apri lo screenshot a tutto schermo"><span class="win"><i></i><i></i><i></i></span><span class="bf-ui"><i></i><i></i><i></i><i></i><b>Cliente: tutti</b></span></button>', '<button type="button" class="lnk">Apri a tutto schermo</button>')
        : r.st === 'open' ? sec('Screenshot', `<div class="bf-drop">${ic('upload')}<span><b>Aggiungi uno screenshot</b><small>Trascinalo qui o incollalo con Ctrl+V</small></span></div>`) : ''}</div>`
    const rail = `<aside class="rec-rail">${rcard('Dati', `<div class="ikvs">${kv('Tipo', kindChip(r.kind))}${kv('Stato', `<span class="mst ${ST[r.st][1]}">${ST[r.st][0]}</span>`)}${kv('Sezione', esc(r.sec))}${kv('Numero', `#${r.id}`, { mono: true })}
      <div class="ikv wide"><span>Aperta da</span><b><span class="who-in"><span class="uav sm">${ini(r.who)}</span>${esc(r.who)}</span></b></div></div>`)}
      ${rcard('Storia', `<ul class="mini-feed"><li>${ic('plus')}<span><b>${esc(r.who)}</b> l'ha aperta</span><time>${r.when.slice(0, 5)}</time></li>${r.by ? `<li>${ic(r.st === 'resolved' ? 'check' : 'x')}<span><b>${r.by}</b> l'ha ${r.st === 'resolved' ? 'risolta' : 'rifiutata'}</span><time>${r.byWhen.slice(0, 5)}</time></li>` : ''}</ul>`)}</aside>`
    return `<div class="record">${head}<div class="rec-body">${main}${rail}</div></div>`
  }
  const board = () => `<div class="bf-board">${COLS.map(([c, t]) => `<section class="bf-col"><h3>${t}${muted(R.filter((x) => x.col === c).length)}</h3>${R.map((x, i) => x.col !== c ? '' : `<button type="button" class="bf-card${i === sel ? ' is-sel' : ''}" data-card="${i}"><span class="top">${kindChip(x.kind)}<small>#${x.id}</small></span><b>${esc(x.title)}</b><small>${esc(x.sec)} · ${x.ago}${x.st !== 'open' ? ` · ${ST[x.st][0].toLowerCase()}` : ''}</small></button>`).join('')}</section>`).join('')}</div>`

  // ═══ Profilo ═════════════════════════════════════════════════════
  const cur = (k) => (draft[k] !== undefined ? draft[k] : ME[k])
  const pf = (k, l, o = {}) => editing ? `<label class="ikv${o.wide ? ' wide' : ''}"><span>${l}</span><input data-f="${k}" value="${esc(cur(k))}" class="${draft[k] !== undefined ? 'dirty' : ''}"${o.type ? ` type="${o.type}"` : ''}></label>` : kv(l, esc(ME[k]), o)
  const pfRecord = () => {
    const n = Object.keys(draft).length
    const head = `<header class="rec-head light"><div class="rec-id"><span class="pf-av">${ini(`${ME.first} ${ME.last}`)}<button type="button" class="pf-av-edit" aria-label="Cambia la foto">${ic('upload')}</button></span><div class="rec-t">
        <h2>${ME.first} ${ME.last}<span class="ven-b">${ME.role}</span>${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p><span class="mono" style="font-size:12px">@${ME.user}</span> · ${ME.email}</p>
        <div class="rec-tags">${ME.groups.map((g) => `<span class="bstat">${g}</span>`).join('')}<span class="bstat">ultimo accesso <b>oggi alle 8:12</b></span></div></div>
        <div class="rec-act">${editing ? '' : `<button class="btn on-band solid" type="button" data-edit>${ic('columns')}Modifica i dati</button>`}<span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-label="Altre azioni"${editing ? ' disabled' : ''}>${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu"><button type="button" role="menuitem" data-menu-close>${ic('history')}Tutta la mia attività nell'Audit</button><button type="button" role="menuitem" data-menu-close>${ic('logout')}Esci</button></div>` : ''}</span></div>
      </div></header>`
    const modes = [['auto', 'Come il sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']]
    const pals = [['Campo sterile', '#1f5c4d', '#e9f3f0'], ['Navy', '#22385c', '#e8eef7'], ['Temperata', '#7a4b2a', '#f6ece3']]
    const perms = [['Clienti, siti, contatti', 1, 1, 1], ['Inventari', 1, 1, 0], ['Issue', 1, 1, 1], ['Manutenzione', 1, 1, 0], ['Drive', 1, 1, 1], ['Contratti', 1, 0, 0], ['Audit', 1, 0, 0]]
    const pill = (on, l) => `<span class="pf-pill${on ? ' on' : ''}">${l}</span>`
    const main = `<div class="rec-main">
      ${sec('Aspetto', `<div class="pf-row"><span class="pf-lbl">Modalità</span><span class="seg-mini" role="radiogroup">${modes.map(([k, l]) => `<button type="button" data-mode="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</span></div>
        <div class="pf-row"><span class="pf-lbl">Palette</span><span class="pf-pals">${pals.map(([l, a, b]) => `<button type="button" class="pf-pal${pal === l ? ' on' : ''}" data-pal="${l}"><span style="background:linear-gradient(135deg, ${a} 50%, ${b} 50%)"></span>${l}</button>`).join('')}</span></div>
        <p class="acc-note">Si applica subito, su tutti i tuoi dispositivi.</p>`)}
      ${sec('Sicurezza', `${pw ? `<div class="pf-pw"><label class="ikv"><span>Password attuale</span><input type="password" value="••••••••"></label><label class="ikv"><span>Nuova password</span><input type="password"></label><label class="ikv"><span>Ripeti la nuova password</span><input type="password"></label><div class="pf-pw-a"><button class="btn" type="button" data-pw>Annulla</button><button class="btn btn-primary" type="button">Cambia la password</button></div></div>`
        : `<div class="pf-row"><span class="pf-lbl">Password</span><span>cambiata il 02/09/2026</span><button type="button" class="lnk" data-pw>Cambia la password</button></div>`}
        <h4 class="pf-h4">Accessi recenti</h4><div class="pf-logins">${[['Firefox su Linux', '10.20.1.12', 'oggi alle 8:12'], ['Chrome su Android', '10.20.4.88', 'ieri alle 18:40'], ['Firefox su Linux', '10.20.1.12', '17/11 alle 8:05']].map(([d, ip, w]) => `<div>${ic('key')}<span><b>${d}</b><small class="mono">${ip}</small></span><time>${w}</time></div>`).join('')}</div>
        <p class="acc-note">La sessione si chiude da sola dopo un periodo di inattività.</p>`)}
      ${sec('Cosa puoi fare', `<p class="acc-note" style="margin:0 0 8px">I permessi arrivano dai gruppi: per cambiarli chiedi a chi gestisce gli utenti.</p><div class="pf-perms">${perms.map(([l, r, w, d]) => `<div><span>${l}</span>${pill(r, 'Lettura')}${pill(w, 'Scrittura')}${pill(d, 'Eliminazione')}</div>`).join('')}</div>`)}
      ${sec('Attività recente', `<ul class="mini-feed"><li>${ic('wrench')}<span>Modificato · Inventario <b>PACS · nodo 1</b></span><time>ieri</time></li><li>${ic('check')}<span>Chiusa · Issue <b>#1041 Worklist vuota</b></span><time>17/11</time></li><li>${ic('plus')}<span>Creato · Contratto <b>CT-2026-044</b></span><time>16/11</time></li></ul><button type="button" class="lnk" style="margin-top:8px">Tutta la mia attività nell'Audit →</button>`)}</div>`
    const rail = `<aside class="rec-rail">${rcard('Dati personali', `<div class="ikvs">${pf('first', 'Nome')}${pf('last', 'Cognome')}${pf('email', 'Email', { wide: true, type: 'email' })}${kv('Nome utente', `@${ME.user}`, { wide: true, mono: true })}${pf('cust', 'Cliente preferito', { wide: true })}</div>
      ${editing ? '<p class="acc-note">Il nome utente non si può cambiare.</p>' : '<p class="acc-note">Il cliente preferito è proposto per primo quando crei issue, inventari e rapportini.</p>'}`)}
      ${rcard('Gruppi', `<div class="chips">${ME.groups.map((g) => `<span class="grp-chip">${g}</span>`).join('')}<span class="grp-chip su">Superuser · accesso completo</span></div>`)}</aside>`
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record">${head}<div class="rec-body">${main}${rail}</div>${bar}</div>`
  }

  // ═══ Pagina ══════════════════════════════════════════════════════
  const view = () => page === 'bf'
    ? `<div class="mt-head"><h1>Bug e feature</h1><div class="actions"><span class="seg-mini" role="group" aria-label="Chi guarda"><button type="button" data-cc="1" aria-pressed="${canClose}">Chi le chiude</button><button type="button" data-cc="0" aria-pressed="${!canClose}">Chi segnala</button></span><button class="btn btn-primary" type="button">${ic('plus')}Segnala</button></div></div>
      <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la scheda, doppio clic o Invio per aprirla.</p>${board()}
      ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Segnalazione"><button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${bfRecord()}</div></div>` : ''}`
    : `<div class="mt-head"><h1>Dashboard</h1></div><p class="hint" style="margin:-6px 0 12px">Il profilo si apre dal menu dell'avatar in alto a destra, sopra la pagina in cui sei.</p><section class="panel" style="height:420px"></section>
      ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Profilo"><button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${pfRecord()}</div></div>` : ''}`

  const render = (keep = true) => {
    const sc = keep ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view(); const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0
    document.querySelectorAll('[data-bfpp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bfpp === page)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', page === 'bf' ? a.textContent.trim().startsWith('Bug') : a.textContent.trim().startsWith('Dashboard')))
  }
  const openRec = (i) => { menu = false; editing = false; draft = {}; pw = false; open = i; sel = i; render(false) }

  root.addEventListener('click', (ev) => {
    const t = ev.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { if (editing) return; open = null; menu = false; return render() }
    if (t.closest('[data-edit]')) { menu = false; editing = true; draft = {}; return render() }
    if (t.closest('[data-discard]')) { editing = false; draft = {}; return render() }
    if (t.closest('[data-save]')) { Object.assign(ME, draft); editing = false; draft = {}; return render() }
    if (t.closest('[data-menu]')) { menu = !menu; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !t.closest('.inv-menu')) { menu = false; render() }
    const m = t.closest('[data-mode]'); if (m) { mode = m.dataset.mode; return render() }
    const p = t.closest('[data-pal]'); if (p) { pal = p.dataset.pal; return render() }
    if (t.closest('[data-pw]')) { pw = !pw; return render() }
    const cc = t.closest('[data-cc]'); if (cc) { canClose = cc.dataset.cc === '1'; return render() }
    const card = t.closest('[data-card]'); if (card) { sel = Number(card.dataset.card); return render() }
    const step = t.closest('[data-step]'); if (step) { const col = colOf(open); const k = col.indexOf(R[open]); return openRec(R.indexOf(col[(k + Number(step.dataset.step) + col.length) % col.length])) }
  })
  root.addEventListener('input', (ev) => {
    const f = ev.target.dataset?.f; if (!f) return
    if (ev.target.value === ME[f]) delete draft[f]; else draft[f] = ev.target.value
    ev.target.classList.toggle('dirty', draft[f] !== undefined)
    const n = Object.keys(draft).length; const b = $('.savebar b', root); if (b) b.textContent = n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'
    const s = $('[data-save]', root); if (s) s.disabled = !n
  })
  root.addEventListener('dblclick', (ev) => { const c = ev.target.closest('[data-card]'); if (c) openRec(Number(c.dataset.card)) })
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('[data-card]')) { ev.preventDefault(); openRec(Number(ev.target.dataset.card)) } })
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && open != null) { if (menu) { menu = false; return render() } if (editing) { editing = false; draft = {}; return render() } open = null; render() } })
  document.querySelectorAll('[data-bfpp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.bfpp; store('archie-preview-bfp-p', page); sel = 0; openRec(0) }))
  open = new URLSearchParams(location.search).get('chiuso') ? null : 0
  render(false)
})()
