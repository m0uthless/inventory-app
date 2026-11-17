/* Gruppi senza drawer (anteprima): il gruppo si apre nella stessa finestra dell'utente (variante D, RecordModal).
   Testata Band con nome, membri e la striscia dei livelli; al centro la matrice dei permessi del gruppo
   (con la colonna «Eccezioni»: chi tra i membri ha di più a mano), permessi speciali e Portal; a lato
   i membri (aggiungi e togli da qui), il nome e le azioni del gruppo. Una barra di salvataggio che dice
   anche su quante persone ricade la modifica. Dati finti modellati su /api/admin-groups/. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

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
  const P = (o) => Object.fromEntries(MODS.map(([k]) => [k, o[k] || 'n']))
  const GROUPS = [
    { id: 1, name: 'Tecnici', perms: P({ crm: 'w', inventory: 'w', issues: 'w', maintenance: 'w', wiki: 'w', drive: 'w', contracts: 'r', purchaseorders: 'r', expenses: 'w', attendance: 'w', servicenow: 'r', feedback: 'w' }), special: ['inventory.view_secrets'], portal: 'n' },
    { id: 2, name: 'Amministrazione', perms: P({ crm: 'r', inventory: 'r', contracts: 'd', purchaseorders: 'd', expenses: 'd', attendance: 'd', feedback: 'w', drive: 'w' }), special: ['contracts.view_contract_value'], portal: 'n' },
    { id: 3, name: 'Coordinatori', perms: P({ crm: 'd', inventory: 'd', issues: 'd', maintenance: 'd', wiki: 'd', drive: 'd', contracts: 'w', purchaseorders: 'w', expenses: 'w', attendance: 'd', servicenow: 'w', feedback: 'd', audit: 'r' }), special: ['inventory.view_secrets', 'crm.view_vpn_secrets'], portal: 'r' },
    { id: 4, name: 'Sola lettura', perms: P({ crm: 'r', inventory: 'r', issues: 'r', maintenance: 'r', wiki: 'r', drive: 'r' }), special: [], portal: 'n' },
  ]
  const SPECIAL = [['inventory.view_secrets', 'Vede le credenziali degli inventari'], ['crm.view_vpn_secrets', 'Vede le credenziali VPN dei clienti'], ['contracts.view_contract_value', 'Vede i valori economici dei contratti'], ['core.manage_users', 'Gestisce utenti e gruppi']]
  let uid = 0
  const U = (name, user, groups, direct = {}) => ({ id: ++uid, name, user, email: `${user}@biotron.it`, groups, direct })
  const USERS = [
    U('Nicole Spazzoli', 'n.spazzoli', [1], { audit: 'r' }),
    U('Luca Della Zazzera', 'l.dellazazzera', [1]),
    U('Leonardo Romano', 'l.romano', [1], { contracts: 'w' }),
    U('Niccolò Nanni', 'n.nanni', [1]),
    U('Sara De Paola', 's.depaola', [2]),
    U('Marco Romanelli', 'm.romanelli', [1]),
    U('Anna Ferri', 'a.ferri', [1, 3]),
    U('Paolo Bini', 'p.bini', [4]),
    U('Giulia Neri', 'g.neri', []),
  ]
  const gname = (id) => GROUPS.find((g) => g.id === id)?.name

  // ── Stato ───────────────────────────────────────────────────────
  let current = Number(new URLSearchParams(location.search).get('gruppo') || 1)
  let draft = null             // copia di lavoro del gruppo aperto
  const root = $('[data-gd]')
  const load = (id) => { const g = GROUPS.find((x) => x.id === id); draft = { name: g.name, perms: { ...g.perms }, special: new Set(g.special), portal: g.portal, members: new Set(USERS.filter((u) => u.groups.includes(id)).map((u) => u.id)) } }
  const orig = () => GROUPS.find((x) => x.id === current)
  const origMembers = () => new Set(USERS.filter((u) => u.groups.includes(current)).map((u) => u.id))
  const changes = () => {
    if (!draft) return []
    const g = orig(); const c = []
    if (draft.name !== g.name) c.push('nome')
    MODS.forEach(([k]) => { if (draft.perms[k] !== g.perms[k]) c.push('perm:' + k) })
    if (draft.special.size !== g.special.length || g.special.some((x) => !draft.special.has(x))) c.push('speciali')
    if (draft.portal !== g.portal) c.push('portal')
    const om = origMembers()
    draft.members.forEach((id) => { if (!om.has(id)) c.push('+' + id) })
    om.forEach((id) => { if (!draft.members.has(id)) c.push('-' + id) })
    return c
  }
  // Persone toccate: i membri se cambiano i permessi, più chi entra o esce
  const impact = () => {
    const c = changes(); const permChg = c.some((x) => !x.startsWith('+') && !x.startsWith('-') && x !== 'nome')
    const s = new Set(permChg ? [...draft.members, ...origMembers()] : [])
    c.filter((x) => x[0] === '+' || x[0] === '-').forEach((x) => s.add(Number(x.slice(1))))
    return s.size
  }

  // ═══ Elenco gruppi (schede, come oggi nell'app) ═════════════════
  const heat = (perms, cls = '') => `<div class="heat ${cls}" aria-hidden="true">${MODS.map(([k, l]) => `<i class="lv-${perms[k]}" title="${l}: ${LV[perms[k]]}"></i>`).join('')}</div>`
  const openCount = (perms) => MODS.filter(([k]) => perms[k] !== 'n').length
  const cards = () => `<div class="grp-grid">${GROUPS.map((g) => { const m = USERS.filter((u) => u.groups.includes(g.id)); return `<button type="button" class="grp${g.id === current ? ' on' : ''}" data-open="${g.id}">
      <header><b>${g.name}</b><span class="mem">${m.slice(0, 4).map((u) => `<span class="uav xs">${ini(u.name)}</span>`).join('')}${m.length > 4 ? `<span class="more">+${m.length - 4}</span>` : ''}</span></header>
      ${heat(g.perms)}<p>${m.length} ${m.length === 1 ? 'utente' : 'utenti'} · ${openCount(g.perms)} moduli</p></button>` }).join('')}</div>
    <div class="heat-legend">${['n', 'r', 'w', 'd'].map((x) => `<span><i class="lv-${x}"></i>${LV[x]}</span>`).join('')}</div>`

  // ═══ Finestra del gruppo ═══════════════════════════════════════
  const head = () => {
    const n = draft.members.size; const i = GROUPS.findIndex((x) => x.id === current)
    return `<header class="rec-head"><div class="rec-id">
      <span class="rec-ava sq" aria-hidden="true">${ic('users')}</span>
      <div class="rec-t">
        <h2>${esc(draft.name || 'Senza nome')}</h2>
        <p>${n} ${n === 1 ? 'utente' : 'utenti'} · ${openCount(draft.perms)} moduli aperti · ${draft.special.size} permessi speciali${draft.portal !== 'n' ? ' · Portal in ' + LV[draft.portal].toLowerCase() : ''}</p>
        ${heat(draft.perms, 'band')}
      </div>
      <div class="rec-act">
        <span class="rec-pos">${i + 1} di ${GROUPS.length}</span>
        <button class="icon-btn on-band" type="button" data-step="-1" aria-label="Gruppo precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Gruppo successivo">${ic('chevR')}</button>
        <button class="btn on-band" type="button">${ic('copy')}Duplica</button>
      </div></div></header>`
  }
  const exceptions = (k) => [...draft.members].map((id) => USERS.find((u) => u.id === id)).filter((u) => u.direct[k] && RANK[u.direct[k]] > RANK[draft.perms[k]])
  const matrix = () => `<table class="pmat"><thead><tr><th scope="col">Modulo</th><th scope="col" class="c-src">Eccezioni</th>${['n', 'r', 'w', 'd'].map((x) => `<th scope="col" class="c-lv">${LV[x]}</th>`).join('')}</tr></thead>
    <tbody>${MODS.map(([k, l]) => { const lv = draft.perms[k]; const ex = exceptions(k); return `<tr class="${lv === 'n' ? 'off' : ''}${lv !== orig().perms[k] ? ' chg' : ''}"><th scope="row">${l}</th>
      <td class="c-src c-exc">${ex.length ? `<span class="exc" title="${ex.map((u) => `${u.name}: ${LV[u.direct[k]]} a mano`).join('\n')}">+${ex.length} a mano</span>` : '—'}</td>
      ${['n', 'r', 'w', 'd'].map((x) => `<td class="c-lv"><button type="button" role="radio" class="dotp${RANK[x] <= RANK[lv] && x !== 'n' ? ' fill' : ''}" aria-checked="${x === lv}" aria-label="${l}: ${LV[x]}" data-lv="${k}:${x}"><i></i></button></td>`).join('')}</tr>` }).join('')}</tbody></table>`

  const members = () => {
    const om = origMembers()
    const list = [...new Set([...om, ...draft.members])].map((id) => USERS.find((u) => u.id === id))
    return `<section class="rcard"><div class="cnt-h"><h3>Membri</h3><span>${draft.members.size}</span></div>
      ${list.length ? `<ul class="mem-list">${list.map((u) => { const gone = !draft.members.has(u.id); const isNew = !om.has(u.id); const other = u.groups.filter((g) => g !== current).map(gname); return `<li class="${gone ? 'gone' : ''}${isNew ? ' new' : ''}">
        <span class="uav">${ini(u.name)}</span>
        <button type="button" class="who" title="Apri ${esc(u.name)}"><b>${u.name}</b><small>${isNew ? 'si aggiunge al salvataggio' : gone ? 'esce al salvataggio' : other.length ? `anche in ${other.join(', ')}` : u.email}</small></button>
        <button type="button" class="icon-btn rm" data-mem="${u.id}" aria-label="${gone ? 'Rimetti' : 'Togli'} ${esc(u.name)}" title="${gone ? 'Rimetti' : 'Togli dal gruppo'}">${ic(gone ? 'restore' : 'x')}</button></li>` }).join('')}</ul>` : '<p class="hint">Nessuno: aggiungi qui sotto le persone che devono avere questi permessi.</p>'}
      <label class="mem-add">${ic('plus')}<input data-memq placeholder="Aggiungi una persona…" aria-label="Aggiungi una persona al gruppo" autocomplete="off"></label>
      <div data-memsug></div></section>`
  }

  const body = () => `<div class="rec-body">
      <div class="rec-main">
        <section class="rec-sec">
          <div class="rec-sh"><h3>Permessi in Archie</h3><p>Valgono per tutti i membri. «Eccezioni»: chi ha già di più a mano.</p></div>
          ${matrix()}
        </section>
        <section class="rec-sec">
          <div class="rec-sh"><h3>Permessi speciali</h3><p>Accessi a dati riservati, oltre al livello del modulo.</p></div>
          <div class="spec">${SPECIAL.map(([c, l]) => `<label class="spec-i"><input type="checkbox" ${draft.special.has(c) ? 'checked' : ''} data-spec="${c}"><span>${l}</span><code>${c}</code></label>`).join('')}</div>
        </section>
        <section class="rec-sec">
          <div class="rec-sh"><h3>Portal clienti</h3></div>
          <div class="portal-row"><span>Accesso al Portal</span><span class="lvseg" role="radiogroup" aria-label="Accesso al Portal">${['n', 'r', 'w', 'd'].map((x) => `<button type="button" role="radio" aria-checked="${x === draft.portal}" data-portal="${x}">${LV[x]}</button>`).join('')}</span></div>
          <p class="hint">I clienti visibili si scelgono sul singolo utente.</p>
        </section>
      </div>
      <aside class="rec-rail" aria-label="Gruppo">
        ${members()}
        <section class="rcard">
          <h3>Gruppo</h3>
          <div class="pf"><span class="pl">Nome</span><input class="gname" value="${esc(draft.name)}" data-gname aria-label="Nome del gruppo"></div>
          <div class="g-acts"><button class="btn" type="button">${ic('copy')}Duplica…</button><button class="btn btn-danger-o" type="button">Elimina…</button></div>
          <p class="hint" data-delhint>${delHint()}</p>
        </section>
      </aside>
    </div>`

  const delHint = () => draft.members.size ? `Eliminandolo, ${draft.members.size} ${draft.members.size === 1 ? 'persona perde' : 'persone perdono'} i permessi che arrivano da qui.` : 'Nessun membro: si può eliminare senza effetti.'

  const saveBar = () => { const n = changes().length; if (!n) return ''; const p = impact(); return `<div class="savebar" role="status"><span class="dot"></span><b>${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare</b>${p ? `<span class="impact">· riguarda ${p} ${p === 1 ? 'persona' : 'persone'}</span>` : ''}<span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save>Salva le modifiche</button></div>` }

  const view = () => `<div class="mt-head"><h1>Utenti e gruppi</h1><span class="seg-top" role="tablist"><button type="button" role="tab" aria-pressed="false">Utenti <span>${USERS.length}</span></button><button type="button" role="tab" aria-pressed="true">Gruppi <span>${GROUPS.length}</span></button></span><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo gruppo</button></div></div>
    ${cards()}
    ${current ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Gruppo ${esc(draft.name)}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>
      <div class="record">${head()}${body()}${saveBar()}</div></div></div>` : ''}`

  const render = () => {
    const sc = $('.ud-scrim', root)?.scrollTop
    root.innerHTML = view()
    if (sc) { const s = $('.ud-scrim', root); if (s) s.scrollTop = sc }
  }
  const refresh = () => {
    const rec = $('.record', root); if (!rec) return
    rec.querySelector('.rec-head').outerHTML = head()
    $('.savebar', rec)?.remove(); rec.insertAdjacentHTML('beforeend', saveBar())
    const dh = $('[data-delhint]', rec); if (dh) dh.textContent = delHint()
  }
  const leave = () => !changes().length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const open = (id) => { current = id; load(id); render() }

  root.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { if (!leave()) return; current = null; draft = null; return render() }
    const card = t.closest('[data-open]'); if (card) return open(Number(card.dataset.open))
    const step = t.closest('[data-step]'); if (step) { if (!leave()) return; const i = GROUPS.findIndex((x) => x.id === current); return open(GROUPS[(i + Number(step.dataset.step) + GROUPS.length) % GROUPS.length].id) }
    const lv = t.closest('[data-lv]'); if (lv) { const [k, x] = lv.dataset.lv.split(':'); draft.perms[k] = x; const tb = $('.pmat', root); tb.outerHTML = matrix(); return refresh() }
    const pt = t.closest('[data-portal]'); if (pt) { draft.portal = pt.dataset.portal; pt.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === pt))); return refresh() }
    const rm = t.closest('[data-mem]'); if (rm) { const id = Number(rm.dataset.mem); if (draft.members.has(id)) draft.members.delete(id); else draft.members.add(id); $('.rec-rail .rcard', root).outerHTML = members(); return refresh() }
    const add = t.closest('[data-add]'); if (add) { draft.members.add(Number(add.dataset.add)); $('.rec-rail .rcard', root).outerHTML = members(); refresh(); return $('[data-memq]', root)?.focus() }
    if (t.closest('[data-discard]')) { load(current); return render() }
    if (t.closest('[data-save]')) { const g = orig(); Object.assign(g, { name: draft.name, perms: { ...draft.perms }, special: [...draft.special], portal: draft.portal }); USERS.forEach((u) => { const inG = draft.members.has(u.id); u.groups = inG ? [...new Set([...u.groups, current])] : u.groups.filter((x) => x !== current) }); load(current); return render() }
  })
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-gname]')) { draft.name = e.target.value; return refresh() }
    if (e.target.matches('[data-memq]')) {
      const q = e.target.value.trim().toLowerCase(); const box = $('[data-memsug]', root)
      const hits = q ? USERS.filter((u) => !draft.members.has(u.id) && (u.name.toLowerCase().includes(q) || u.user.includes(q))).slice(0, 5) : []
      box.innerHTML = hits.length ? `<ul class="mem-sug">${hits.map((u) => `<li><button type="button" data-add="${u.id}"><span class="uav xs">${ini(u.name)}</span>${u.name}<small>${u.groups.map(gname).join(', ') || 'nessun gruppo'}</small></button></li>`).join('')}</ul>` : q ? '<p class="hint">Nessuno da aggiungere con questo nome.</p>' : ''
    }
  })
  root.addEventListener('change', (e) => { const c = e.target.dataset.spec; if (c) { if (e.target.checked) draft.special.add(c); else draft.special.delete(c); refresh() } })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && !$('[data-palette-bg]:not([hidden])')) { if (!leave()) return; current = null; draft = null; render() } })

  if (current) load(current)
  render()
})()
