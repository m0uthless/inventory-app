/* Utenti e gruppi senza drawer (anteprima). Tre proposte per aprire e modificare un utente su desktop:
   A · Schede aperte: ogni utente aperto è una linguetta in testa alla pagina, accanto all'Elenco.
   B · Elenco accanto: gli utenti in una colonna stretta, il dettaglio nel resto della pagina.
   C · Pagina della persona: dettaglio a pagina intera, «Utenti e gruppi › Nome» per tornare.
   Il corpo del dettaglio è lo stesso: testata Band, permessi larghi al centro, colonna con anagrafica,
   ruoli, attività e account, una sola barra di salvataggio quando c'è qualcosa da salvare.
   Dati finti modellati su /api/admin-users/. Oggi: 17/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

  // Voce "Utenti e gruppi" nella sidebar (in Sistema), attiva
  const trashLi = [...document.querySelectorAll('.nav-item')].find((a) => a.textContent.trim().startsWith('Cestino'))?.closest('li')
  if (trashLi) {
    const li = trashLi.cloneNode(true); const a = li.querySelector('a'); a.dataset.tip = 'Utenti e gruppi'
    a.innerHTML = a.innerHTML.replace('Cestino', 'Utenti e gruppi').replace(/<svg[\s\S]*?<\/svg>/, ic('users'))
    trashLi.after(li)
  }
  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = (a.dataset.tip || a.textContent.trim()) === 'Utenti e gruppi'
    a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current')
  })

  // ═══ Dati ═══════════════════════════════════════════════════════
  const MODS = [['crm', 'Clienti, siti e contatti'], ['inventory', 'Inventari e monitor'], ['issues', 'Issue'], ['maintenance', 'Manutenzione'], ['wiki', 'Wiki'], ['drive', 'Drive'], ['contracts', 'Contratti'], ['purchaseorders', 'Purchase Order'], ['expenses', 'Rimborso spese'], ['attendance', 'Piano ferie'], ['servicenow', 'ServiceNow'], ['feedback', 'Bug e feature'], ['audit', 'Audit'], ['core', 'Sistema']]
  const LV = { n: 'Nessuno', r: 'Lettura', w: 'Scrittura', d: 'Completo' }
  const RANK = { n: 0, r: 1, w: 2, d: 3 }
  const P = (o) => Object.fromEntries(MODS.map(([k]) => [k, o[k] || o._ || 'n']))
  const GROUPS = [
    { id: 1, name: 'Tecnici', perms: P({ crm: 'w', inventory: 'w', issues: 'w', maintenance: 'w', wiki: 'w', drive: 'w', contracts: 'r', purchaseorders: 'r', expenses: 'w', attendance: 'w', servicenow: 'r', feedback: 'w' }) },
    { id: 2, name: 'Amministrazione', perms: P({ crm: 'r', inventory: 'r', contracts: 'd', purchaseorders: 'd', expenses: 'd', attendance: 'd', feedback: 'w', drive: 'w' }) },
    { id: 3, name: 'Coordinatori', perms: P({ crm: 'd', inventory: 'd', issues: 'd', maintenance: 'd', wiki: 'd', drive: 'd', contracts: 'w', purchaseorders: 'w', expenses: 'w', attendance: 'd', servicenow: 'w', feedback: 'd', audit: 'r' }) },
    { id: 4, name: 'Sola lettura', perms: P({ crm: 'r', inventory: 'r', issues: 'r', maintenance: 'r', wiki: 'r', drive: 'r' }) },
  ]
  const SPECIAL = [['inventory.view_secrets', 'Vede le credenziali degli inventari'], ['crm.view_vpn_secrets', 'Vede le credenziali VPN dei clienti'], ['contracts.view_contract_value', 'Vede i valori economici dei contratti'], ['core.manage_users', 'Gestisce utenti e gruppi']]
  let uid = 0
  const U = (first, last, user, extra = {}) => ({ id: ++uid, first, last, name: `${first} ${last}`, user, email: `${user}@biotron.it`, active: true, groups: [], direct: {}, special: [], roles: [], area: '', born: '', gender: '', since: 'marzo 2024', lastIn: '', ...extra })
  const USERS = [
    U('Nicole', 'Spazzoli', 'n.spazzoli', { groups: [1], roles: ['sn', 'coord'], area: 'Bologna', born: '1991-03-14', gender: 'F', since: 'settembre 2022', lastIn: 'oggi 09:02', direct: { audit: 'r' }, special: ['inventory.view_secrets'] }),
    U('Luca', 'Della Zazzera', 'l.dellazazzera', { gender: 'M', groups: [1], roles: ['sn', 'philips'], area: 'Bologna', lastIn: 'ieri' }),
    U('Leonardo', 'Romano', 'l.romano', { groups: [1], area: 'Romagna', lastIn: 'oggi 07:55' }),
    U('Niccolò', 'Nanni', 'n.nanni', { groups: [1], area: 'Romagna', lastIn: '3 giorni fa' }),
    U('Sara', 'De Paola', 's.depaola', { groups: [2], roles: ['exp'], area: 'Sede', lastIn: 'oggi 08:30', special: ['contracts.view_contract_value'] }),
    U('Marco', 'Romanelli', 'm.romanelli', { groups: [1], area: 'Friuli', lastIn: '2 settimane fa' }),
    U('Anna', 'Ferri', 'a.ferri', { groups: [1, 3], roles: ['coord'], area: 'Friuli', lastIn: 'ieri' }),
    U('Paolo', 'Bini', 'p.bini', { groups: [4], active: false, lastIn: '4 mesi fa' }),
  ]
  const AREA_COL = { Bologna: '#3f8f7b', Romagna: '#4a82c6', Friuli: '#b98a30', Sede: '#7d70cf' }
  const AREA_COORD = { Bologna: 'Nicole Spazzoli', Friuli: 'Anna Ferri', Romagna: 'Anna Ferri' }
  // Compleanno: età che compirà e giorni mancanti (oggi 17/11/2026, dati finti)
  const birthday = (iso) => {
    const [y, m, d] = iso.split('-').map(Number); const today = new Date(2026, 10, 17)
    let next = new Date(2026, m - 1, d); if (next < today) next = new Date(2027, m - 1, d)
    const days = Math.round((next - today) / 86400000); const age = next.getFullYear() - y
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    return days === 0 ? `Compie ${age} anni oggi` : `Compie ${age} anni il ${d} ${mesi[m - 1]}, tra ${days} giorni`
  }
  const ROLES = [['sn', 'Tecnico ServiceNow', 'Si può assegnare ai casi e compare nelle statistiche', 'sky'], ['philips', 'Philips', 'Tecnico Philips: vede solo ServiceNow', 'lilac'], ['coord', 'Coordinatore ferie', 'Approva le richieste della sua area', 'sand'], ['exp', 'Segreteria spese', 'Vede e approva tutti i rimborsi', 'mint'], ['func', 'Account funzionale', 'Usato da integrazioni, non da una persona', 'neutral']]
  const ACT = [['wrench', 'ha registrato un rapportino su', 'PM Rizzoli 2026', 'oggi 09:20'], ['alert', 'ha chiuso la issue', '#1027 Firmware DryView 5950', 'ieri 16:40'], ['book', 'ha modificato la pagina wiki', 'Rizzoli: accesso VPN e jump host', 'ieri 11:02'], ['server', "ha aggiornato l'inventario", 'BO-MAG-WSR03', '3 giorni fa']]
  const groupName = (id) => GROUPS.find((g) => g.id === id)?.name
  const fromGroups = (u, k) => u.groups.reduce((best, g) => { const lv = GROUPS.find((x) => x.id === g).perms[k]; return RANK[lv] > RANK[best[0]] ? [lv, groupName(g)] : best }, ['n', null])
  const effective = (u, k) => { const [g, src] = fromGroups(u, k); const d = u.direct[k]; return d && RANK[d] > RANK[g] ? [d, 'assegnato a mano', g] : [g, src ? `dal gruppo ${src}` : '', g] }
  const roleTags = (u) => u.roles.map((r) => { const R = ROLES.find((x) => x[0] === r); return `<span class="ftag t-${R[3]}">${R[1]}</span>` }).join('')
  const ava = (u, cls = '') => `<span class="uav ${cls}" aria-hidden="true">${ini(u.name)}</span>`

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  let variant = qs.get('variante') || (() => { try { return localStorage.getItem('archie-preview-ud-v') || 'a' } catch { return 'a' } })()
  let tabs = [1, 3]           // A: utenti aperti come linguette
  let current = 1             // utente mostrato (null = elenco in A)
  let showList = qs.get('vista') === 'elenco'
  let dirty = new Set()       // campi toccati (barra di salvataggio)
  const root = $('[data-ud]')

  // ═══ Corpo del dettaglio (uguale nelle tre proposte) ════════════
  const head = (u, { back = false, nav = false } = {}) => `
    <header class="rec-head">
      ${back ? `<nav class="crumbs-rec" aria-label="Percorso"><a href="#" data-back>${ic('chevL')}Utenti e gruppi</a><span>/</span><b>${u.name}</b></nav>` : ''}
      <div class="rec-id">
        <span class="rec-ava" aria-hidden="true">${ini(u.name)}</span>
        <div class="rec-t">
          <h2>${u.name}${u.active ? '' : '<span class="rec-off">Disattivato</span>'}</h2>
          <p><span class="code">@${u.user}</span> · ${u.email} · ultimo accesso ${u.lastIn}</p>
          ${u.roles.length ? `<div class="rec-tags">${u.roles.map((r) => `<span>${ROLES.find((x) => x[0] === r)[1]}</span>`).join('')}</div>` : ''}
        </div>
        <div class="rec-act">
          ${nav ? `<span class="rec-pos">${USERS.findIndex((x) => x.id === u.id) + 1} di ${USERS.length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Utente precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Utente successivo">${ic('chevR')}</button>` : ''}
          <button class="btn on-band" type="button">${ic('key')}Reimposta password</button>
          <button class="icon-btn on-band" type="button" aria-label="Altre azioni">${ic('more')}</button>
        </div>
      </div>
    </header>`

  const levelPick = (k, lv, floor) => `<span class="lvseg" role="radiogroup" aria-label="Livello">${['n', 'r', 'w', 'd'].map((x) => `<button type="button" role="radio" aria-checked="${x === lv}" data-lv="${k}:${x}" ${RANK[x] < RANK[floor] ? 'disabled title="Già dato dal gruppo"' : ''}>${LV[x]}</button>`).join('')}</span>`

  const body = (u) => `
    <div class="rec-body">
      <div class="rec-main">
        <section class="rec-sec">
          <div class="rec-sh"><h3>Gruppi</h3><p>I permessi arrivano dai gruppi; sotto puoi aggiungerne a mano.</p></div>
          <div class="gchips">${u.groups.map((g) => `<span class="gtag big">${groupName(g)}<button type="button" aria-label="Togli" data-touch>${ic('x')}</button></span>`).join('')}<button class="add-chip" type="button" data-touch>${ic('plus')}Aggiungi a un gruppo</button></div>
        </section>
        <section class="rec-sec">
          <div class="rec-sh"><h3>Permessi in Archie</h3><button class="lnk" type="button" data-touch>Riporta a quelli dei gruppi</button></div>
          <table class="pmat"><thead><tr><th scope="col">Modulo</th><th scope="col" class="c-src">Da dove</th>${['n', 'r', 'w', 'd'].map((x) => `<th scope="col" class="c-lv">${LV[x]}</th>`).join('')}</tr></thead>
          <tbody>${MODS.map(([k, l]) => { const [lv, src, floor] = effective(u, k); return `<tr class="${lv === 'n' ? 'off' : ''}"><th scope="row">${l}</th><td class="c-src${src === 'assegnato a mano' ? ' dir' : ''}">${src || '—'}</td>${['n', 'r', 'w', 'd'].map((x) => `<td class="c-lv"><button type="button" role="radio" class="dotp${RANK[x] <= RANK[lv] && x !== 'n' ? ' fill' : ''}" aria-checked="${x === lv}" aria-label="${l}: ${LV[x]}" data-lv="${k}:${x}" ${RANK[x] < RANK[floor] ? 'disabled title="Già dato dal gruppo"' : ''}><i></i></button></td>`).join('')}</tr>` }).join('')}</tbody></table>
        </section>
        <section class="rec-sec">
          <div class="rec-sh"><h3>Permessi speciali</h3><p>Accessi a dati riservati, oltre al livello del modulo.</p></div>
          <div class="spec">${SPECIAL.map(([c, l]) => `<label class="spec-i"><input type="checkbox" ${u.special.includes(c) ? 'checked' : ''} data-touch><span>${l}</span><code>${c}</code></label>`).join('')}</div>
        </section>
        <section class="rec-sec">
          <div class="rec-sh"><h3>Portal clienti</h3></div>
          <div class="portal-row"><span>Accesso al Portal</span>${levelPick('portal', 'n', 'n')}</div>
          <p class="hint">Nessun accesso: per i clienti del Portal si gestiscono da «Accesso Portal».</p>
        </section>
      </div>
      <aside class="rec-rail" aria-label="Persona">
        <section class="rcard person">
          <h3 class="pc-h">Anagrafica</h3>
          <div class="pc-fields">
            <div class="pf"><span class="pl">Nome e cognome</span>
              <div class="pair"><input value="${esc(u.first)}" aria-label="Nome" data-touch><input value="${esc(u.last)}" aria-label="Cognome" data-touch></div></div>
            <div class="pf"><span class="pl">Email</span>
              <div class="withbtn"><input value="${u.email}" aria-label="Email" data-touch><button type="button" class="ib" aria-label="Copia l'email" title="Copia">${ic('copy')}</button></div></div>
            <div class="pf"><span class="pl">Data di nascita</span>
              <div class="withbtn"><input value="${u.born ? u.born.split('-').reverse().join('/') : ''}" placeholder="gg/mm/aaaa" aria-label="Data di nascita" data-touch><span class="ib static">${ic('calendar')}</span></div>
              ${u.born ? `<span class="pc-note">${birthday(u.born)}</span>` : '<span class="pc-note">Serve al widget Compleanni della Dashboard.</span>'}</div>
            <div class="pf"><span class="pl">Genere</span>
              <span class="sexpick" role="radiogroup" aria-label="Genere">${[['M', '♂', 'Maschio'], ['F', '♀', 'Femmina']].map(([k, e, l]) => `<button type="button" role="radio" class="sx sx-${k}" aria-checked="${u.gender === k}" data-gender="${k}" aria-label="${l}" title="${l}">${e}</button>`).join('')}</span></div>
            <div class="pf"><span class="pl">Area del piano ferie</span>
              <button type="button" class="area-pick">${u.area ? `<i class="adot" style="background:${AREA_COL[u.area] || '#7b8a86'}"></i><span><b>${u.area}</b><small>${AREA_COORD[u.area] ? `coordina ${AREA_COORD[u.area]}` : 'nessun coordinatore'}</small></span>` : '<span><b>Nessuna area</b><small>Non compare nel Piano ferie</small></span>'}${ic('chevD')}</button></div>
          </div>
        </section>
        <section class="rcard">
          <h3>Ruoli</h3>
          <div class="roles">${ROLES.map(([k, l, h]) => `<label class="role"><span><b>${l}</b><small>${h}</small></span><button type="button" role="switch" aria-checked="${u.roles.includes(k)}" class="sw3${u.roles.includes(k) ? ' on' : ''}" data-role="${k}" aria-label="${l}"><i></i></button></label>`).join('')}</div>
        </section>
        <section class="rcard">
          <h3>Attività recente</h3>
          <ul class="mini-feed">${ACT.map(([i, t, o, w]) => `<li>${ic(i)}<span>${t} <a href="#">${o}</a></span><time>${w}</time></li>`).join('')}</ul>
          <a class="lnk" href="#">Tutta l'attività nell'Audit</a>
        </section>
        <section class="rcard danger">
          <h3>Account</h3>
          <p class="hint">${u.active ? 'Disattivandolo non potrà più entrare; i suoi dati e la sua storia restano.' : 'Non può accedere. Riattivalo per ridargli l\'accesso.'}</p>
          <div class="acc-btns">${u.active ? '<button class="btn btn-danger-o" type="button">Disattiva</button>' : '<button class="btn btn-primary" type="button">Riattiva</button>'}<button class="btn" type="button">Elimina…</button></div>
        </section>
      </aside>
    </div>`

  const saveBar = () => dirty.size ? `<div class="savebar" role="status"><span class="dot"></span><b>${dirty.size} ${dirty.size === 1 ? 'modifica' : 'modifiche'} da salvare</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save>Salva le modifiche</button></div>` : ''

  const record = (u, opts) => `<div class="record">${head(u, opts)}${body(u)}${saveBar()}</div>`

  // ═══ Elenco (tabella) ═══════════════════════════════════════════
  const table = () => `<section class="panel"><div class="vtabs">${[['Attivi', 7], ['Solo Portal', 1], ['Account funzionali', 1], ['Disattivati', 1], ['Tutti', 8]].map(([l, n], i) => `<button type="button" aria-pressed="${i === 0}">${l} <span>${n}</span></button>`).join('')}</div>
    <div class="table-wrap"><table class="po-table up-table"><thead><tr><th>Utente</th><th>Gruppi</th><th>Ruoli</th><th>Ultimo accesso</th><th>Stato</th></tr></thead><tbody>${USERS.map((u) => `<tr data-open="${u.id}" tabindex="0">
      <td><span class="uob">${ava(u)}<span><b>${u.name}</b><small>${u.email}</small></span></span></td>
      <td>${u.groups.map((g) => `<span class="gtag">${groupName(g)}</span>`).join('')}</td>
      <td>${roleTags(u)}</td><td>${u.lastIn}</td>
      <td>${u.active ? '<span class="nst ok">Attivo</span>' : '<span class="nst np">Disattivato</span>'}</td></tr>`).join('')}</tbody></table></div></section>`

  // ═══ A · Schede aperte ══════════════════════════════════════════
  const viewA = () => {
    const strip = `<div class="doc-tabs" role="tablist" aria-label="Utenti aperti">
      <button type="button" role="tab" class="dt list" aria-selected="${current === null}" data-tab="list">${ic('menu')}Elenco<span class="cnt">${USERS.length}</span></button>
      ${tabs.map((id) => { const u = USERS.find((x) => x.id === id); return `<span class="dt" role="tab" aria-selected="${current === id}" data-tab="${id}" tabindex="0">${ava(u, 'xs')}<span class="nm">${u.name}</span>${current === id && dirty.size ? '<i class="unsaved" title="Modifiche non salvate"></i>' : ''}<button type="button" class="x" data-close="${id}" aria-label="Chiudi ${u.name}">${ic('x')}</button></span>` }).join('')}
    </div>`
    return `<div class="mt-head"><h1>Utenti e gruppi</h1><span class="seg-top" role="tablist"><button type="button" role="tab" aria-pressed="true">Utenti <span>${USERS.length}</span></button><button type="button" role="tab" aria-pressed="false">Gruppi <span>${GROUPS.length}</span></button></span><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo utente</button></div></div>
      ${strip}<div class="doc-page">${current === null ? table() : record(USERS.find((x) => x.id === current))}</div>`
  }

  // ═══ B · Elenco accanto ═════════════════════════════════════════
  const viewB = () => `<div class="split">
      <aside class="split-list" aria-label="Utenti">
        <div class="sl-head"><h1>Utenti e gruppi</h1><button class="icon-btn" type="button" aria-label="Nuovo utente" title="Nuovo utente">${ic('plus')}</button></div>
        <label class="sl-q">${ic('search')}<input placeholder="Cerca utente…"></label>
        <div class="sl-views">${['Attivi', 'Portal', 'Funzionali', 'Disattivati'].map((l, i) => `<button type="button" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
        <ul class="sl-items">${USERS.map((u) => `<li><button type="button" class="sl-u${u.id === current ? ' on' : ''}" data-pick="${u.id}">${ava(u)}<span><b>${u.name}</b><small>${u.groups.map(groupName).join(', ') || 'nessun gruppo'}</small></span><i class="st ${u.active ? 'ok' : 'np'}" title="${u.active ? 'Attivo' : 'Disattivato'}"></i></button></li>`).join('')}</ul>
      </aside>
      <div class="split-detail">${record(USERS.find((x) => x.id === current), { nav: true })}</div>
    </div>`

  // ═══ C · Pagina della persona ═══════════════════════════════════
  const viewC = () => (showList
    ? `<div class="mt-head"><h1>Utenti e gruppi</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo utente</button></div></div>${table()}`
    : record(USERS.find((x) => x.id === current), { back: true, nav: true }))

  // ═══ D · Finestra (modal) ═══════════════════════════════════════
  // L'elenco resta sotto, attenuato; l'utente si apre in una finestra larga e centrata
  // con lo stesso corpo. Esc, la × o un clic fuori la chiudono (con modifiche in sospeso chiede conferma).
  const viewD = () => `<div class="mt-head"><h1>Utenti e gruppi</h1><span class="seg-top" role="tablist"><button type="button" role="tab" aria-pressed="true">Utenti <span>${USERS.length}</span></button><button type="button" role="tab" aria-pressed="false">Gruppi <span>${GROUPS.length}</span></button></span><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo utente</button></div></div>
    ${table()}
    ${current !== null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Utente ${USERS.find((x) => x.id === current).name}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>
      ${record(USERS.find((x) => x.id === current), { nav: true })}</div></div>` : ''}`

  // ── Render ──────────────────────────────────────────────────────
  const render = () => {
    document.documentElement.dataset.udv = variant
    root.innerHTML = variant === 'a' ? viewA() : variant === 'b' ? viewB() : variant === 'd' ? viewD() : viewC()
    document.querySelectorAll('[data-udv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.udv === variant)))
  }
  const open = (id) => { dirty = new Set(); current = id; if (variant === 'a' && !tabs.includes(id)) tabs.push(id); showList = false; render() }
  root.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { if (dirty.size && !window.confirm('Ci sono modifiche non salvate. Chiudere comunque?')) return; current = null; dirty = new Set(); return render() }
    const close = t.closest('[data-close]'); if (close) { e.stopPropagation(); const id = Number(close.dataset.close); tabs = tabs.filter((x) => x !== id); if (current === id) current = tabs.at(-1) ?? null; dirty = new Set(); return render() }
    const tab = t.closest('[data-tab]'); if (tab) { current = tab.dataset.tab === 'list' ? null : Number(tab.dataset.tab); dirty = new Set(); return render() }
    const row = t.closest('[data-open]'); if (row) return open(Number(row.dataset.open))
    const pick = t.closest('[data-pick]'); if (pick) return open(Number(pick.dataset.pick))
    if (t.closest('[data-back]')) { e.preventDefault(); showList = true; return render() }
    const step = t.closest('[data-step]'); if (step) { const i = USERS.findIndex((x) => x.id === current); return open(USERS[(i + Number(step.dataset.step) + USERS.length) % USERS.length].id) }
    const lv = t.closest('[data-lv]'); if (lv && !lv.disabled) {
      const scope = lv.closest('tr') || lv.parentElement; const order = ['n', 'r', 'w', 'd']; const pick = lv.dataset.lv.split(':')[1]
      scope.querySelectorAll('[data-lv]').forEach((b) => { const x = b.dataset.lv.split(':')[1]; b.setAttribute('aria-checked', String(x === pick)); b.classList.toggle('fill', x !== 'n' && order.indexOf(x) <= order.indexOf(pick)) })
      lv.closest('tr')?.classList.toggle('off', pick === 'n')
      dirty.add(lv.dataset.lv.split(':')[0]); return refreshBar()
    }
    const g = t.closest('[data-gender]'); if (g) { g.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === g))); dirty.add('gender'); return refreshBar() }
    const cp = t.closest('.ib:not(.static)'); if (cp) { cp.classList.add('done'); cp.innerHTML = Preview.icon('check'); setTimeout(() => { cp.classList.remove('done'); cp.innerHTML = Preview.icon('copy') }, 1400); return }
    const role = t.closest('[data-role]'); if (role) { const on = role.getAttribute('aria-checked') !== 'true'; role.setAttribute('aria-checked', String(on)); role.classList.toggle('on', on); dirty.add('role-' + role.dataset.role); return refreshBar() }
    if (t.closest('button[data-touch]')) { dirty.add('x' + Math.random()); return refreshBar() }
    if (t.closest('[data-discard]') || t.closest('[data-save]')) { dirty = new Set(); return render() }
  })
  root.addEventListener('input', (e) => { if (e.target.closest('[data-touch]')) { dirty.add(e.target.closest('label')?.textContent || 'f'); refreshBar() } })
  root.addEventListener('change', (e) => { if (e.target.matches('input[type=checkbox]')) { dirty.add(e.target.parentElement.textContent); refreshBar() } })
  const refreshBar = () => {
    const rec = $('.record', root); if (!rec) return
    $('.savebar', rec)?.remove(); rec.insertAdjacentHTML('beforeend', saveBar())
    const dt = $(`.dt[data-tab="${current}"]`, root); if (dt) { $('.unsaved', dt)?.remove(); if (dirty.size) $('.nm', dt).insertAdjacentHTML('afterend', '<i class="unsaved" title="Modifiche non salvate"></i>') }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && variant === 'd' && current !== null) { if (dirty.size && !window.confirm('Ci sono modifiche non salvate. Chiudere comunque?')) return; current = null; dirty = new Set(); render() } })
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open],[data-tab]')) { e.preventDefault(); e.target.click() } })
  document.querySelectorAll('[data-udv]').forEach((b) => b.addEventListener('click', () => { variant = b.dataset.udv; try { localStorage.setItem('archie-preview-ud-v', variant) } catch { /* niente */ } dirty = new Set(); if (variant !== 'a' && current === null) current = 1; showList = false; render() }))
  if (showList && variant === 'a') current = null
  render()
})()
