/* Ultime tre schede senza drawer (anteprima rst-base, 19/11/2026): caso ServiceNow, monitor, richiesta del Piano
   ferie, nella finestra dei record con lo schema approvato (clic seleziona, doppio clic o Invio apre, frecce sempre
   a destra, lettura poi «Modifica» dal ⋯ con una sola barra di salvataggio).
   · ServiceNow: «Apri in ServiceNow» come azione principale; descrizione e screenshot al centro, dati a lato.
   · Monitor: «Apri la workstation»; lo stato si cambia sul posto (come nelle issue); al centro workstation,
     monitor sulla stessa workstation e storia.
   · Piano ferie: «Valida» / «Rifiuta» in testata per il coordinatore; al centro la copertura dell'area giorno
     per giorno; «Modifica» apre il dialogo che c'è già (ha il calendario e le fasce orarie).
   Dati finti. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  const ini = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  // ═══ Dati ═══════════════════════════════════════════════════════
  const SN = [
    { num: 'CS0048213', account: 'AUSL Imola', cat: 'PACS', type: 'Incident', opened: '18/11/2026 08:14', who: 'Marco Bassi', url: true, shot: true, del: false,
      desc: 'Il nodo 2 del PACS non risponde alle query C-FIND dal reparto di Radiologia. Riavviato il servizio alle 8:40, problema ancora presente. Allegato lo screenshot dell\'errore lato RIS.' },
    { num: 'CS0048190', account: 'AUSL Romagna', cat: 'RIS', type: 'Request', opened: '17/11/2026 15:02', who: '', url: true, shot: false, del: false, desc: 'Richiesta di nuova utenza RIS per il dr. Ferri, reparto TC di Forlì.' },
    { num: 'CS0048177', account: 'IRCCS Rizzoli', cat: 'Monitor', type: 'Incident', opened: '17/11/2026 09:30', who: 'Anna Ferri', url: false, shot: false, del: true, desc: 'Monitor diagnostico sinistro con bande verticali.' },
  ]
  const STATI = [['in_uso', 'In uso', 'ok'], ['magazzino', 'In magazzino', 'neutral'], ['guasto', 'Guasto', 'warn'], ['dismesso', 'Dismesso', 'neutral']]
  const MON = [
    { prod: 'Barco', mod: 'Coronis Fusion 6MP', sn: 'BC-62F-118734', tipo: 'Diagnostico', radinet: true, stato: 'in_uso', ws: 'WS-REFERTAZIONE-03', where: 'AUSL Imola · Ospedale Santa Maria della Scaletta · Radiologia', del: false },
    { prod: 'EIZO', mod: 'RadiForce RX370', sn: 'EZ-37-55120', tipo: 'Diagnostico', radinet: false, stato: 'guasto', ws: 'WS-REFERTAZIONE-03', where: 'AUSL Imola · Ospedale Santa Maria della Scaletta · Radiologia', del: false },
    { prod: 'Dell', mod: 'P2423D', sn: 'CN-0V7K9H-72', tipo: 'Clinico', radinet: false, stato: 'magazzino', ws: '', where: '', del: false },
  ]
  const PF = [
    { who: 'Marco Bassi', reason: 'Ferie', sw: '#3f8f6b', st: 'proposta', from: '22/12', to: '02/01', year: '2026', days: 6, part: 'Giornata intera', area: 'Tecnici PACS', note: 'Rientro il 2 gennaio, reperibile il 30 se serve.', mine: false,
      cov: [['22', 'lun', 3], ['23', 'mar', 2], ['24', 'mer', 1], ['25', 'gio', null, 'Natale'], ['26', 'ven', null, 'Santo Stefano'], ['27', 'sab', null], ['28', 'dom', null], ['29', 'lun', 2], ['30', 'mar', 1], ['31', 'mer', 2], ['01', 'gio', null, 'Capodanno'], ['02', 'ven', 3]], created: '12/11' },
    { who: 'Nicole Spazzoli', reason: 'Permesso', sw: '#b58a2e', st: 'proposta', from: '25/11', to: '25/11', year: '2026', days: 0.5, part: 'Mattina', area: 'Tecnici PACS', note: '', mine: true, cov: [['25', 'mar', 3]], created: '18/11' },
    { who: 'Anna Ferri', reason: 'Ferie', sw: '#3f8f6b', st: 'validata', from: '10/11', to: '14/11', year: '2026', days: 5, part: 'Giornata intera', area: 'Amministrazione', note: '', mine: false, by: 'Federico Mutuale', byWhen: '03/11',
      cov: [['10', 'lun', 2], ['11', 'mar', 2], ['12', 'mer', 2], ['13', 'gio', 2], ['14', 'ven', 2]], created: '28/10' },
  ]
  const TOTAL = 4

  // ── Stato ───────────────────────────────────────────────────────
  let page = new URLSearchParams(location.search).get('pagina') || read('archie-preview-rst-p', 'sn')
  let open = 0; let sel = 0; let menu = false; let editing = false; let draft = {}; let qk = false; let role = 'coord'
  const root = $('[data-rst]')
  const list = () => (page === 'sn' ? SN : page === 'mon' ? MON : PF)

  // ═══ Pezzi comuni ════════════════════════════════════════════════
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const sec = (title, body, end = '') => `<section class="rec-sec"><div class="rec-sh"><h3>${title}</h3>${end}</div>${body}</section>`
  const kv = (l, v, o = {}) => `<div class="ikv${o.wide ? ' wide' : ''}"><span>${l}</span><b${o.mono ? ' class="mono"' : ''}>${v === '' || v == null ? '<span class="ikv-none">—</span>' : v}</b></div>`
  const field = (k, l, v, o = {}) => editing
    ? `<label class="ikv${o.wide ? ' wide' : ''}"><span>${l}</span>${o.opts ? `<select data-f="${k}" class="${draft[k] !== undefined ? 'dirty' : ''}">${o.opts.map((x) => `<option${x === cur(k, v) ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<input data-f="${k}" value="${esc(cur(k, v))}" class="${o.mono ? 'mono ' : ''}${draft[k] !== undefined ? 'dirty' : ''}"${o.ph ? ` placeholder="${o.ph}"` : ''}>`}</label>`
    : kv(l, o.show ? o.show(v) : esc(v), o)
  const cur = (k, v) => (draft[k] !== undefined ? draft[k] : v)
  const nav = () => `<span class="rec-nav"><span class="rec-pos">${open + 1} di ${list().length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente"${editing ? ' disabled' : ''}>${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo"${editing ? ' disabled' : ''}>${ic('chevR')}</button></span>`
  const more = (items) => `<span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-label="Altre azioni"${editing ? ' disabled' : ''}>${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu">${items}</div>` : ''}</span>`
  const mi = (icon, label, attr = 'data-menu-close', danger) => `<button type="button" role="menuitem" ${attr}${danger ? ' class="danger"' : ''}>${ic(icon)}${label}</button>`
  const savebar = () => { const n = Object.keys(draft).length; return editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : '' }
  const head = (title, chips, sub, tags, actions) => `<header class="rec-head light"><div class="rec-id"><div class="rec-t">
      <h2>${title}${chips}${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2><p>${sub}</p><div class="rec-tags">${tags}</div></div>
      <div class="rec-act">${actions}${nav()}</div></div></header>`
  const stChip = (s) => { const x = STATI.find((y) => y[0] === s); return `<span class="mst ${x[2]}">${x[1]}</span>` }

  // ═══ ServiceNow ══════════════════════════════════════════════════
  const snRecord = () => {
    const c = SN[open]
    const actions = c.del ? `<button class="btn on-band solid" type="button">${ic('restore')}Ripristina</button>`
      : `${c.url ? `<button class="btn on-band solid" type="button">${ic('arrowR')}Apri in ServiceNow</button>` : ''}${more(mi('columns', 'Modifica', 'data-edit') + mi('copy', 'Copia il numero') + mi('trash', 'Elimina', 'data-menu-close', true))}`
    const h = head(esc(c.account), c.del ? '<span class="ven-b">Nel cestino</span>' : '',
      `<span class="mono" style="font-size:12px">${c.num}</span> · ${c.type} · ${c.cat} · aperto il ${c.opened}`,
      `${c.who ? `<span class="bstat">assegnato a <b>${esc(c.who)}</b></span>` : '<span class="bstat warn"><b>da assegnare</b></span>'}${c.shot ? '<span class="bstat">con screenshot</span>' : ''}`, actions)
    const main = `<div class="rec-main">
      ${sec('Descrizione', editing ? `<textarea class="notes${draft.desc !== undefined ? ' dirty' : ''}" data-f="desc" aria-label="Descrizione">${esc(cur('desc', c.desc))}</textarea>` : `<p class="rst-desc">${esc(c.desc)}</p>`)}
      ${c.shot ? sec('Screenshot', `<button type="button" class="rst-shot" aria-label="Apri lo screenshot a tutto schermo"><span class="win"><i></i><i></i><i></i></span><span class="err">${ic('alert')}<b>Errore C-FIND</b><small>Association rejected by PACS_NODE2 (0x0006)</small></span></button>`, '<button type="button" class="lnk">Apri a tutto schermo</button>') : ''}</div>`
    const rail = `<aside class="rec-rail">${rcard('Dati', `<div class="ikvs">
      ${kv('Numero', c.num, { mono: true })}${field('type', 'Type', c.type, { opts: ['Incident', 'Request', 'Change'] })}
      ${field('account', 'Account', c.account, { wide: true })}${field('cat', 'Categoria', c.cat, { opts: ['PACS', 'RIS', 'Monitor', 'Rete'] })}${kv('Aperto il', c.opened)}
      ${field('who', 'Assegnato a', c.who, { wide: true, ph: 'Da assegnare', show: (v) => (v ? `<span class="who-in"><span class="uav sm">${ini(v)}</span>${esc(v)}</span>` : '<span style="color:var(--warning);font-weight:600">Da assegnare</span>') })}
      ${editing ? field('url', 'Link a ServiceNow', 'https://biotron.service-now.com/…', { wide: true, mono: true }) : ''}</div>`)}</aside>`
    return `<div class="record">${h}<div class="rec-body">${main}${rail}</div>${savebar()}</div>`
  }

  // ═══ Monitor ═════════════════════════════════════════════════════
  const monRecord = () => {
    const m = MON[open]; const st = cur('stato', m.stato)
    const actions = `${m.ws ? `<button class="btn on-band solid" type="button">${ic('server')}Apri la workstation</button>` : ''}${more(mi('columns', 'Modifica', 'data-edit') + mi('copy', 'Copia il seriale') + mi('trash', 'Elimina', 'data-menu-close', true))}`
    const h = head(`${esc(m.prod)} ${esc(m.mod)}`, `<span class="ven-b">${STATI.find((x) => x[0] === st)[1]}</span>`,
      `${m.tipo} · S/N <span class="mono" style="font-size:12px">${m.sn}</span>`,
      `${m.radinet ? '<span class="bstat"><b>Radinet</b> attivo</span>' : ''}${m.ws ? `<span class="bstat">su <b>${m.ws}</b></span>` : '<span class="bstat warn"><b>non assegnato</b></span>'}`, actions)
    const sibs = MON.filter((x, i) => i !== open && x.ws && x.ws === m.ws)
    const main = `<div class="rec-main">
      ${sec('Workstation', m.ws || editing ? (editing ? `<label class="ikv"><span>Workstation</span><input data-f="ws" value="${esc(cur('ws', m.ws))}" placeholder="Cerca la workstation…" class="${draft.ws !== undefined ? 'dirty' : ''}"></label>` : `<button type="button" class="rst-ws">${ic('server')}<span><b>${m.ws}</b><small>${m.where}</small></span>${ic('arrowR')}</button>`) : '<p class="empty-s">Non assegnato a una workstation. <button type="button" class="lnk" data-edit>Assegna</button></p>')}
      ${sibs.length ? sec(`Sulla stessa workstation${muted(sibs.length)}`, `<div class="rst-sibs">${sibs.map((x) => `<button type="button" class="rst-sib">${ic('monitor')}<span><b>${x.prod} ${x.mod}</b><small>${x.sn}</small></span>${stChip(x.stato)}</button>`).join('')}</div>`) : ''}
      ${sec('Storia', `<ul class="mini-feed"><li>${ic('wrench')}<span><b>Marco Bassi</b> ha cambiato lo stato da <i>In magazzino</i> a <i>In uso</i></span><time>04/11</time></li><li>${ic('server')}<span><b>Marco Bassi</b> l'ha assegnato a ${m.ws || 'WS-REFERTAZIONE-03'}</span><time>04/11</time></li><li>${ic('plus')}<span><b>Anna Ferri</b> l'ha registrato</span><time>21/03/2025</time></li></ul>`)}</div>`
    const stato = editing ? field('stato', 'Stato', STATI.find((x) => x[0] === m.stato)[1], { opts: STATI.map((x) => x[1]) })
      : `<div class="ikv qk"><span>Stato</span><span class="menu-anchor"><button type="button" class="qbtn" data-qk>${stChip(st)}${ic('chevD')}</button>${qk ? `<div class="inv-menu" role="menu">${STATI.map(([k, l]) => `<button type="button" role="menuitemradio" aria-checked="${k === st}" data-st="${k}">${stChip(k)}${k === st ? ic('check') : ''}</button>`).join('')}</div>` : ''}</span></div>`
    const rail = `<aside class="rec-rail">${rcard('Dati', `<div class="ikvs">
      ${field('prod', 'Produttore', m.prod)}${field('mod', 'Modello', m.mod)}
      ${editing ? field('sn', 'Seriale', m.sn, { wide: true, mono: true }) : `<div class="ikv wide"><span>Seriale</span><b class="mono rst-sn">${m.sn}<button type="button" class="icon-btn xs" aria-label="Copia il seriale">${ic('copy')}</button></b></div>`}
      ${field('tipo', 'Tipo', m.tipo, { opts: ['Diagnostico', 'Clinico', 'Ufficio'] })}${field('radinet', 'Radinet', m.radinet ? 'Attivo' : m.tipo === 'Diagnostico' ? 'Non attivo' : 'solo per i diagnostici', { opts: ['Attivo', 'Non attivo'] })}
      ${stato}</div>`)}</aside>`
    return `<div class="record">${h}<div class="rec-body">${main}${rail}</div>${savebar()}</div>`
  }

  // ═══ Piano ferie ═════════════════════════════════════════════════
  const ST = { proposta: ['Da validare', 'warn'], validata: ['Validata', 'ok'], rifiutata: ['Rifiutata', 'neutral'] }
  const pfRecord = () => {
    const r = PF[open]; const coord = role === 'coord'
    const low = r.st === 'proposta' ? r.cov.filter((c) => c[2] != null && c[2] <= 1) : []
    const actions = r.st === 'proposta' && coord && !r.mine
      ? `<button class="btn on-band solid" type="button">${ic('check')}Valida</button><button class="btn on-band" type="button">${ic('x')}Rifiuta</button>${more(mi('columns', 'Modifica…') + mi('trash', 'Elimina', 'data-menu-close', true))}`
      : r.mine && r.st === 'proposta' ? `<button class="btn on-band" type="button">${ic('trash')}Ritira la richiesta</button>${more(mi('columns', 'Modifica…'))}`
        : coord ? more(mi('columns', 'Modifica…') + mi('trash', 'Elimina', 'data-menu-close', true)) : ''
    const toY = r.from.endsWith('/12') && r.to.endsWith('/01') ? String(Number(r.year) + 1) : r.year
    const range = r.from === r.to ? `${r.from}/${r.year}` : `${r.from}${toY !== r.year ? `/${r.year}` : ''} → ${r.to}/${toY}`
    const h = head(`<i class="pf-sw" style="background:${r.sw}"></i>${r.reason} · ${esc(r.who)}`, `<span class="ven-b">${ST[r.st][0]}</span>`,
      `${range} · ${String(r.days).replace('.', ',')} ${r.days === 1 ? 'giorno lavorativo' : 'giorni lavorativi'} · ${r.part}`,
      `<span class="bstat">${r.area}</span>${low.length ? `<span class="bstat warn">copertura bassa · <b>${low.length} ${low.length === 1 ? 'giorno' : 'giorni'}</b></span>` : ''}${r.mine && r.st === 'proposta' ? '<span class="bstat">in attesa del coordinatore</span>' : ''}`, actions)
    const main = `<div class="rec-main">
      ${low.length ? `<div class="pb-box warn"><b>Copertura bassa in ${r.area}</b><small>Resterebbe ${low[0][2]} su ${TOTAL} il ${low.map((c) => c[0]).join(', ')} ${r.to.split('/')[1] === '01' ? 'dicembre' : 'novembre'}. Il conteggio esclude ${r.who.split(' ')[0]} e tiene conto delle altre assenze già registrate.</small></div>` : ''}
      ${sec(`Presenti in ${r.area} in quei giorni`, `<div class="pf-cov">${r.cov.map(([d, wd, n, hol]) => `<span class="${n == null ? 'off' : n <= 1 ? 'low' : n === 2 ? 'mid' : 'ok'}" title="${hol || (n == null ? 'Non lavorativo' : `${n}/${TOTAL} presenti`)}"><small>${wd}</small><b>${d}</b>${n == null ? `<em class="h">${hol ? hol.split(' ')[0] : '—'}</em>` : `<em>${n}/${TOTAL}</em>`}</span>`).join('')}</div><p class="acc-note">Su ${TOTAL} persone dell'area, senza contare ${r.who.split(' ')[0]}.</p>`)}
      ${r.note ? sec('Nota', `<p class="rst-desc">${esc(r.note)}</p>`) : ''}</div>`
    const rail = `<aside class="rec-rail">${rcard('Richiesta', `<div class="ikvs">
      <div class="ikv wide"><span>Persona</span><b><span class="who-in"><span class="uav sm">${ini(r.who)}</span>${esc(r.who)}</span></b></div>
      ${kv('Area', r.area)}${kv('Motivo', `<i class="pf-sw sm" style="background:${r.sw}"></i>${r.reason}`)}${kv('Dal', `${r.from}/${r.year}`)}${kv('Al', `${r.to}/${r.to.endsWith('01') ? '2027' : r.year}`)}${kv('Fascia', r.part, { wide: true })}</div>`)}
      ${rcard('Attività', `<ul class="mini-feed"><li>${ic('plus')}<span><b>${esc(r.who)}</b> ha chiesto ${r.reason.toLowerCase()} ${r.from === r.to ? `il ${r.from}` : `dal ${r.from} al ${r.to}`}</span><time>${r.created}</time></li>${r.by ? `<li>${ic('check')}<span><b>${r.by}</b> ha validato la richiesta</span><time>${r.byWhen}</time></li>` : ''}</ul>`)}</aside>`
    return `<div class="record">${h}<div class="rec-body">${main}${rail}</div></div>`
  }

  // ═══ Pagine ══════════════════════════════════════════════════════
  const tables = {
    sn: () => `<table class="po-table c-list"><thead><tr><th>Numero</th><th>Account</th><th>Categoria</th><th>Assegnato a</th><th>Aperto</th></tr></thead><tbody>${SN.map((c, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"${c.del ? ' style="opacity:.6"' : ''}><td class="mono">${c.num}</td><td><b>${c.account}</b></td><td>${c.cat}</td><td>${c.who || '<span style="color:var(--warning);font-weight:600">Da assegnare</span>'}</td><td>${c.opened}</td></tr>`).join('')}</tbody></table>`,
    mon: () => `<table class="po-table c-list"><thead><tr><th>Monitor</th><th>Seriale</th><th>Tipo</th><th>Workstation</th><th>Stato</th></tr></thead><tbody>${MON.map((m, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${m.prod} ${m.mod}</b></td><td class="mono">${m.sn}</td><td>${m.tipo}</td><td>${m.ws || '—'}</td><td>${stChip(m.stato)}</td></tr>`).join('')}</tbody></table>`,
    pf: () => `<table class="po-table c-list"><thead><tr><th>Persona</th><th>Motivo</th><th>Quando</th><th>Area</th><th>Stato</th></tr></thead><tbody>${PF.map((r, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${r.who}</b></td><td><i class="pf-sw sm" style="background:${r.sw}"></i>${r.reason}</td><td>${r.from === r.to ? r.from : `${r.from} → ${r.to}`}</td><td>${r.area}</td><td><span class="mst ${ST[r.st][1]}">${ST[r.st][0]}</span></td></tr>`).join('')}</tbody></table>`,
  }
  const TITLE = { sn: 'ServiceNow', mon: 'Monitor', pf: 'Piano ferie' }
  const view = () => `<div class="mt-head"><h1>${TITLE[page]}</h1>${page === 'pf' ? `<div class="actions"><span class="seg-mini" role="group" aria-label="Chi guarda"><button type="button" data-role="coord" aria-pressed="${role === 'coord'}">Coordinatore</button><button type="button" data-role="me" aria-pressed="${role === 'me'}">Tecnico</button></span></div>` : ''}</div>
    <p class="hint" style="margin:-6px 0 12px">${page === 'pf' ? 'Nell\'app la richiesta si apre dal calendario (clic sulla barra) o dall\'elenco «Da validare»; qui un elenco per comodità.' : 'Clic per selezionare la riga, doppio clic o Invio per aprire.'}</p>
    <section class="panel"><div class="table-wrap">${tables[page]()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Dettaglio"><button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${page === 'sn' ? snRecord() : page === 'mon' ? monRecord() : pfRecord()}</div></div>` : ''}`

  const render = (keep = true) => {
    const sc = keep ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view(); const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0
    document.querySelectorAll('[data-rstp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rstp === page)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith(TITLE[page])))
  }
  const openRec = (i) => { menu = false; qk = false; editing = false; draft = {}; open = i; sel = i; render(false) }

  root.addEventListener('click', (ev) => {
    const t = ev.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { if (editing) return; open = null; menu = false; return render() }
    if (t.closest('[data-edit]')) { menu = false; editing = true; draft = {}; return render() }
    if (t.closest('[data-discard]')) { editing = false; draft = {}; return render() }
    if (t.closest('[data-save]')) { const L = list()[open]; Object.assign(L, Object.fromEntries(Object.entries(draft).filter(([k]) => k in L))); editing = false; draft = {}; return render() }
    if (t.closest('[data-menu]')) { menu = !menu; qk = false; return render() }
    if (t.closest('[data-qk]')) { qk = !qk; menu = false; return render() }
    const st = t.closest('[data-st]'); if (st) { MON[open].stato = st.dataset.st; qk = false; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    if ((menu || qk) && !t.closest('.inv-menu')) { menu = false; qk = false; render() }
    const rl = t.closest('[data-role]'); if (rl) { role = rl.dataset.role; return render() }
    const row = t.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = t.closest('[data-step]'); if (step && !editing) return openRec((open + Number(step.dataset.step) + list().length) % list().length)
  })
  root.addEventListener('input', (ev) => {
    const f = ev.target.dataset?.f; if (!f) return
    draft[f] = ev.target.value
    ev.target.classList.add('dirty')
    const n = Object.keys(draft).length; const b = $('.savebar b', root); if (b) b.textContent = `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare`
    $('[data-save]', root)?.removeAttribute('disabled')
  })
  root.addEventListener('change', (ev) => { if (ev.target.matches('select[data-f]')) ev.target.dispatchEvent(new Event('input', { bubbles: true })) })
  root.addEventListener('dblclick', (ev) => { const row = ev.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('tr[data-row]')) { ev.preventDefault(); openRec(Number(ev.target.dataset.row)) } })
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && open != null) { if (menu || qk) { menu = false; qk = false; return render() } if (editing) { editing = false; draft = {}; return render() } open = null; render() } })
  document.querySelectorAll('[data-rstp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.rstp; store('archie-preview-rst-p', page); sel = 0; openRec(0) }))
  open = new URLSearchParams(location.search).get('chiuso') ? null : 0
  render(false)
})()
