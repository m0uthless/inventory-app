/* Audit senza drawer (anteprima aud-base, 18/11/2026): l'evento del registro nella finestra dei record, sullo
   schema approvato (frecce sempre a destra, clic per selezionare e doppio clic per aprire). È in sola lettura:
   niente «Modifica». Testata con l'oggetto, l'azione e chi l'ha fatta; azione principale «Apri l'oggetto»
   (o «Apri il Cestino» per un'eliminazione). Al centro gli avvisi (accessi falliti, eliminazione), la tabella
   «Cosa è cambiato» e lo storico dell'oggetto: cliccando un altro evento si apre nella stessa finestra.
   A lato chi e da dove, e i dettagli tecnici richiudibili. Dati finti modellati su /api/audit-events/. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  const ACT = { update: ['Modificato', 'lav'], create: ['Creato', 'ok'], delete: ['Eliminato', 'err'], login_failed: ['Accesso fallito', 'err'], login: ['Accesso', 'done'] }
  const E = [
    { id: 90412, act: 'update', who: 'Marco Bassi', user: 'mbassi', when: '18/11/2026 09:42', ago: 'oggi alle 9:42', type: 'Cliente', obj: 'AUSL Imola', open: 'il cliente', ip: '10.20.1.44', internal: true, browser: 'Firefox 133 su Windows', req: 'PATCH /api/customers/2/', objId: 2,
      changes: [['P.IVA', '—', '00705271203'], ['Note', 'Martedì 7–9', 'Accesso solo il martedì dalle 7 alle 9, chiedere a Laura Gentili'], ['Provincia', 'bo', 'BO']], hist: [[90412, 'update', 'Marco Bassi', 'P.IVA, Note, Provincia', 'oggi'], [88120, 'update', 'Nicole Spazzoli', 'Nome breve', '12/11'], [70011, 'create', 'Federico Mutuale', '', '10/01/2025']] },
    { id: 90398, act: 'login_failed', who: 'admin', user: null, when: '18/11/2026 03:12', ago: 'oggi alle 3:12', type: 'Accesso', obj: 'Accesso non riuscito', ip: '185.220.101.7', internal: false, browser: 'curl 8.4', req: 'POST /api/auth/login/', failed: 14, changes: [], hist: [] },
    { id: 90377, act: 'delete', who: 'Anna Ferri', user: 'aferri', when: '17/11/2026 16:05', ago: 'ieri alle 16:05', type: 'Inventario', obj: 'Workstation di scorta', open: "l'inventario", ip: '10.20.1.31', internal: true, browser: 'Chrome 131 su macOS', req: 'DELETE /api/inventories/88/', objId: 88,
      changes: [], hist: [[90377, 'delete', 'Anna Ferri', '', 'ieri'], [61002, 'update', 'Marco Bassi', 'Stato', '04/09'], [50110, 'create', 'Marco Bassi', '', '12/03/2025']] },
    { id: 90350, act: 'update', who: 'Federico Mutuale', user: 'fmutuale', when: '17/11/2026 11:20', ago: 'ieri alle 11:20', type: 'Inventario', obj: 'PACS · nodo 1', open: "l'inventario", ip: '10.20.1.12', internal: true, browser: 'Firefox 133 su Linux', req: 'PATCH /api/inventories/7/', objId: 7,
      changes: [['Password SO', '••', '••', true], ['Posizione', 'Sala server', 'Sala server, piano −1']], hist: [[90350, 'update', 'Federico Mutuale', 'Password SO, Posizione', 'ieri'], [81100, 'update', 'Marco Bassi', 'Note', '02/11']] },
  ]

  let open = null; let sel = 0; let menu = false; let techOpen = false
  const root = $('[data-aud]')
  const sec = (id, title, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const rcard = (title, body) => `<section class="rcard"><div class="hd"><h3>${title}</h3></div>${body}</section>`
  const tag = (a) => `<span class="st ${ACT[a][1]}">${ACT[a][0]}</span>`
  const ini = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const record = () => {
    const e = E[open]; const failed = e.act === 'login_failed'; const del = e.act === 'delete'
    const primary = del ? `<button class="btn on-band solid" type="button">${ic('restore')}Apri il Cestino</button>` : e.open ? `<button class="btn on-band solid" type="button">${ic('arrowR')}Apri ${e.open}</button>` : ''
    const items = `${e.objId ? `<button type="button" role="menuitem" data-menu-close>${ic('filter')}Solo questo oggetto</button>` : ''}${failed ? `<button type="button" role="menuitem" data-menu-close>${ic('filter')}Tutti gli accessi falliti</button><button type="button" role="menuitem" data-menu-close>${ic('filter')}Tutti da questo IP</button>` : ''}<button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il link dell'evento</button>`
    const head = `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2>${esc(e.obj)}<span class="ven-b exp-${failed || del ? 'err' : 'ok'}">${ACT[e.act][0]}</span></h2>
        <p>${esc(e.type)} · ${esc(e.ago)} · ${failed ? `nome utente tentato <b style="font-weight:600">«${esc(e.who)}»</b>` : `da <b style="font-weight:600">${esc(e.who)}</b>`}</p>
        <div class="rec-tags">${e.changes.length ? `<span class="bstat"><b>${e.changes.length}</b> ${e.changes.length === 1 ? 'campo cambiato' : 'campi cambiati'}</span>` : ''}<span class="bstat${e.internal ? '' : ' warn'}">${e.internal ? 'rete interna' : 'IP esterno'} · <b>${esc(e.ip)}</b></span>${failed ? `<span class="bstat warn"><b>${e.failed}</b> tentativi in 24 ore</span>` : ''}${e.hist.length ? `<button type="button" class="bstat" data-goto="his"><b>${e.hist.length}</b> eventi sull'oggetto</button>` : ''}</div></div>
        <div class="rec-act">${primary}<span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-label="Altre azioni">${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu">${items}</div>` : ''}</span>
          <span class="rec-nav"><span class="rec-pos">${open + 1} di ${E.length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo">${ic('chevR')}</button></span></div>
      </div></header>`
    const callout = failed ? `<div class="pb-box err"><b>${e.failed} tentativi falliti da ${esc(e.ip)} in 24 ore</b><small>Nome utente usato: «${esc(e.who)}». Indirizzo esterno alla rete aziendale.</small></div>`
      : del ? `<div class="pb-box warn"><b>Eliminato ${esc(e.ago)}</b><small>Se l'oggetto va nel cestino, da lì si può ripristinare finché non viene svuotato.</small></div>` : ''
    const table = e.changes.length ? sec('chg', `${e.act === 'create' ? 'Valori iniziali' : 'Cosa è cambiato'}${muted(`${e.changes.length} ${e.changes.length === 1 ? 'campo' : 'campi'}`)}`, `<table class="chg"><thead><tr><th>Campo</th><th>Prima</th><th>Dopo</th></tr></thead><tbody>${e.changes.map(([f, a, b, secret]) => `<tr><th scope="row">${esc(f)}</th><td class="${secret || a === '—' ? '' : 'was'}">${secret ? '<i>nascosto</i>' : esc(a)}</td><td class="now">${secret ? '<i>nascosto</i>' : esc(b)}</td></tr>`).join('')}</tbody></table>${e.changes.some((c) => c[3]) ? '<p class="acc-note">' + ic('lock') + 'Le password non vengono mai scritte nel registro: risulta solo che sono cambiate.</p>' : ''}`) : ''
    const hist = e.hist.length ? sec('his', `Storico dell'oggetto${muted(e.hist.length)}`, `<div class="rows">${e.hist.map(([id, a, who, f, when]) => `<button type="button" class="row r-hist${id === e.id ? ' cur' : ''}">${tag(a)}<span class="t"><b>${esc(who)}</b><small>${f ? esc(f) : a === 'create' ? 'creazione' : a === 'delete' ? 'eliminazione' : ''}${id === e.id ? ' · questo evento' : ''}</small></span><span class="n">${when}</span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>`).join('')}</div>`) : ''
    const main = `<div class="rec-main">${callout}${table}${hist}${!table && !hist && !callout ? '<p class="empty-s">Nessun dettaglio in più.</p>' : ''}</div>`
    const rail = `<aside class="rec-rail">
        ${rcard('Chi e da dove', `<div class="who"><span class="uav">${failed ? '?' : ini(e.who)}</span><span class="t"><b>${esc(e.who)}</b><small>${e.user ? `@${esc(e.user)}` : 'nome utente tentato'}</small></span></div>
          <div class="ikvs">${`<div class="ikv wide"><span>Quando</span><b>${esc(e.when)}</b></div>`}<div class="ikv"><span>Indirizzo IP</span><b class="mono">${esc(e.ip)}</b></div><div class="ikv"><span>Rete</span><b style="color:${e.internal ? 'inherit' : 'var(--warning)'}">${e.internal ? 'interna' : 'esterna'}</b></div><div class="ikv wide"><span>Browser</span><b>${esc(e.browser)}</b></div></div>`)}
        ${rcard('Dettagli tecnici', `<button type="button" class="lnk" data-tech>${techOpen ? 'Nascondi' : 'Mostra'}</button>${techOpen ? `<div class="ikvs" style="margin-top:10px"><div class="ikv wide"><span>Richiesta</span><b class="mono">${esc(e.req)}</b></div><div class="ikv"><span>Evento</span><b class="mono">${e.id}</b></div>${e.objId ? `<div class="ikv"><span>ID oggetto</span><b class="mono">${e.objId}</b></div>` : ''}</div>` : ''}`)}
      </aside>`
    return `<div class="record">${head}<div class="rec-body">${main}${rail}</div></div>`
  }
  const table = () => `<table class="po-table c-list"><thead><tr><th>Quando</th><th>Chi</th><th>Azione</th><th>Oggetto</th><th>IP</th></tr></thead><tbody>${E.map((e, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td>${esc(e.ago)}</td><td><b>${esc(e.who)}</b></td><td>${tag(e.act)}</td><td>${esc(e.obj)}<br><small style="color:var(--muted)">${esc(e.type)}</small></td><td class="code">${esc(e.ip)}</td></tr>`).join('')}</tbody></table>`
  const view = () => `<div class="mt-head"><h1>Audit</h1></div>
    <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Evento ${E[open].id}"><button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`
  const render = (keep = true) => { const sc = keep ? $('.ud-scrim', root)?.scrollTop : 0; root.innerHTML = view(); const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0; document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Audit'))) }
  const openRec = (i) => { menu = false; techOpen = false; open = i; sel = i; render(false) }

  root.addEventListener('click', (ev) => {
    const t = ev.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { open = null; menu = false; return render() }
    if (t.closest('[data-menu]')) { menu = !menu; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !t.closest('.inv-menu')) { menu = false; render() }
    if (t.closest('[data-tech]')) { techOpen = !techOpen; return render() }
    const row = t.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = t.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + E.length) % E.length)
    const g = t.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  root.addEventListener('dblclick', (ev) => { const row = ev.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('tr[data-row]')) { ev.preventDefault(); openRec(Number(ev.target.dataset.row)) } })
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && open != null) { if (menu) { menu = false; return render() } open = null; render() } })
  open = new URLSearchParams(location.search).get('chiuso') ? null : 0
  render(false)
})()
