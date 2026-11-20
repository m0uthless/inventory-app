/* Drive senza drawer (anteprima drv-base, 19/11/2026). Il Drive è un gestore di file: il doppio clic su una
   cartella ci entra, quindi la scheda del file/cartella va pensata a parte. Due varianti:
   A · «Finestra»: come le altre pagine. Clic seleziona, doppio clic su un file apre la finestra larga
       (anteprima grande a sinistra, dettagli a destra); doppio clic su una cartella ci entra.
   B · «Pannello fisso»: a destra dell'elenco un pannello dettagli sempre visibile (come nei gestori di file):
       il clic seleziona e il pannello mostra subito il file o la cartella; doppio clic su un file apre
       l'anteprima a tutto schermo, su una cartella ci entra. Il pannello si può chiudere.
   In tutte e due: anteprima, Scarica / Apri, copia link, clienti collegati, chi può vederlo, note, attività.
   Dati finti modellati su /api/drive-*. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }

  // ═══ Dati ═══════════════════════════════════════════════════════
  const ITEMS = [
    { kind: 'folder', name: 'Contratti firmati', meta: '3 cartelle · 24 file', cust: [], lock: ['Amministrazione'], by: 'Anna Ferri', mod: '12/11/2026', notes: 'Solo PDF firmati dal cliente.' },
    { kind: 'folder', name: 'AUSL Imola', meta: '5 cartelle · 61 file', cust: ['AUSL Imola'], lock: [], by: 'Marco Bassi', mod: '17/11/2026', notes: '' },
    { kind: 'file', ext: 'PDF', name: 'Procedura rinnovo certificati.pdf', size: '214 KB', cust: ['AUSL Imola'], lock: [], by: 'Federico Mutuale', mod: '17/11/2026 16:05', created: '10/11/2026', notes: 'Versione aggiornata dopo l\'incidente di ottobre.', prev: 'pdf' },
    { kind: 'file', ext: 'PNG', name: 'Schema rete radiologia.png', size: '1,2 MB', cust: ['AUSL Imola'], lock: [], by: 'Marco Bassi', mod: '04/11/2026 09:20', created: '04/11/2026', notes: '', prev: 'img' },
    { kind: 'file', ext: 'XLSX', name: 'Inventario monitor 2026.xlsx', size: '58 KB', cust: [], lock: [], by: 'Nicole Spazzoli', mod: '30/10/2026 18:11', created: '30/10/2026', notes: '', prev: 'none' },
    { kind: 'file', ext: 'PDF', name: 'Contratto CT-2024-018.pdf', size: '1,8 MB', cust: ['AUSL Imola'], lock: ['Amministrazione'], by: 'Anna Ferri', mod: '02/01/2024 11:00', created: '02/01/2024', notes: '', prev: 'pdf' },
  ]
  const PATH = ['Drive', 'Clienti', 'AUSL Imola']

  // ── Stato ───────────────────────────────────────────────────────
  let variant = new URLSearchParams(location.search).get('variante') || read('archie-preview-drv-v', 'A')
  let sel = 2; let open = null; let menu = false; let pane = read('archie-preview-drv-pane', '1') === '1'; let full = false
  const root = $('[data-drv]')

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const icoOf = (x) => (x.kind === 'folder' ? `<span class="dico fold">${ic('folder')}${x.lock.length ? `<em>${ic('lock')}</em>` : ''}</span>` : `<span class="dico f-${x.ext.toLowerCase()}">${x.ext}</span>`)
  const preview = (x, big) => x.kind === 'folder'
    ? `<div class="dprev fold${big ? ' big' : ''}">${ic('folder')}<small>${esc(x.meta)}</small></div>`
    : x.prev === 'pdf' ? `<div class="dprev pdf${big ? ' big' : ''}"><div class="pg"><b>${esc(x.name.replace(/\.pdf$/i, '').toUpperCase())}</b><i></i><i></i><i class="s"></i><i></i><i></i><i class="s"></i><i></i></div></div>`
      : x.prev === 'img' ? `<div class="dprev img${big ? ' big' : ''}"><div class="net"><i></i><i></i><i></i><i></i><span></span></div></div>`
        : `<div class="dprev none${big ? ' big' : ''}"><span class="dico f-${x.ext.toLowerCase()} lg">${x.ext}</span><small>Nessuna anteprima per i file .${x.ext.toLowerCase()}: si apre dopo averlo scaricato.</small></div>`
  const kv = (l, v, wide, link) => `<div class="ikv${wide ? ' wide' : ''}"><span>${l}</span><b>${link ? `<button type="button" class="ikv-link">${v}${ic('arrowR')}</button>` : v}</b></div>`
  const info = (x) => `
    <section class="rcard"><div class="hd"><h3>Dettagli</h3></div><div class="ikvs">
      ${kv('Tipo', x.kind === 'folder' ? 'Cartella' : `${x.ext === 'PDF' ? 'Documento PDF' : x.ext === 'PNG' ? 'Immagine' : 'Foglio di calcolo'} <span class="code" style="color:var(--muted)">.${x.ext.toLowerCase()}</span>`)}
      ${kv(x.kind === 'folder' ? 'Contenuto' : 'Dimensione', x.kind === 'folder' ? esc(x.meta) : x.size)}
      ${kv('Percorso', PATH.map((p) => `<button type="button" class="pathb">${p}</button>`).join(' / '), true)}
      ${kv(x.kind === 'folder' ? 'Modificata' : 'Modificato', `${x.mod} · ${esc(x.by)}`, true)}
    </div></section>
    <section class="rcard"><div class="hd"><h3>Clienti <span class="cnt">${x.cust.length}</span></h3><button class="lnk" type="button">+ Collega</button></div>
      ${x.cust.length ? `<div class="chips">${x.cust.map((c) => `<span class="dchip">${ic('building')}${esc(c)}<button type="button" aria-label="Scollega ${esc(c)}">${ic('x')}</button></span>`).join('')}</div><p class="acc-note">Compare anche filtrando il Drive per cliente.</p>` : '<p class="empty-s">Nessun cliente collegato.</p>'}</section>
    <section class="rcard"><div class="hd"><h3>Chi può vederlo</h3></div>
      ${x.lock.length ? `<div class="vis lock">${ic('lock')}<span><b>Solo il gruppo ${x.lock.map((g) => `<span class="grp">${g}</span>`).join(' ')}</b><small>${x.kind === 'folder' ? 'Regola di questa cartella: vale per tutto quello che contiene.' : 'Regola della cartella «Contratti firmati».'}</small></span></div>`
        : `<div class="vis">${ic('users')}<span><b>Tutti gli utenti di Archie</b><small>Nessuna restrizione sulle cartelle che lo contengono.</small></span></div>`}</section>
    <section class="rcard"><div class="hd"><h3>Note</h3><button class="lnk" type="button">${x.notes ? 'Modifica' : 'Aggiungi'}</button></div>${x.notes ? `<p class="notes-ro">${esc(x.notes)}</p>` : '<p class="empty-s">Nessuna nota.</p>'}</section>
    <section class="rcard"><div class="hd"><h3>Attività recente</h3></div><ul class="mini-feed"><li>${ic('upload')}<span><b>${esc(x.by)}</b> ${x.kind === 'folder' ? 'ha creato la cartella' : 'ha caricato il file'}</span><time>${(x.created || x.mod).slice(0, 5)}</time></li><li>${ic('building')}<span><b>Marco Bassi</b> l'ha collegato a AUSL Imola</span><time>12/11</time></li></ul></section>`
  const actions = (x) => x.kind === 'folder' ? `<button class="btn btn-primary" type="button">${ic('folder')}Apri la cartella</button>` : `<button class="btn btn-primary" type="button">${ic('download')}Scarica</button>`
  const moreItems = `<button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia il link</button><button type="button" role="menuitem" data-menu-close>${ic('file')}Rinomina…</button><button type="button" role="menuitem" data-menu-close>${ic('folder')}Sposta in…</button><button type="button" role="menuitem" class="danger" data-menu-close>${ic('trash')}Sposta nel cestino</button>`

  // ═══ Variante A · finestra ══════════════════════════════════════
  const windowA = () => {
    const x = ITEMS[open]; const files = ITEMS.filter((i) => i.kind === 'file'); const fi = files.indexOf(x)
    return `<div class="record"><header class="rec-head light"><div class="rec-id"><div class="rec-t">
        <h2><span class="hico-w">${icoOf(x)}</span>${esc(x.name)}${x.lock.length ? `<span class="ven-b">${ic('lock')} ${x.lock.join(', ')}</span>` : ''}</h2>
        <p>${PATH.join(' / ')} · ${x.size || x.meta} · modificato il ${x.mod.slice(0, 10)} da ${esc(x.by)}</p>
        <div class="rec-tags">${x.cust.map((c) => `<span class="bstat">${esc(c)}</span>`).join('')}${x.notes ? '<span class="bstat">con nota</span>' : ''}</div></div>
        <div class="rec-act"><button class="btn on-band solid" type="button">${ic('download')}Scarica</button><button class="btn on-band" type="button">${ic('copy')}Copia link</button>
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-label="Altre azioni">${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu">${moreItems}</div>` : ''}</span>
          <span class="rec-nav"><span class="rec-pos">${fi + 1} di ${files.length}</span><button class="icon-btn on-band" type="button" data-fstep="-1" aria-label="Precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-fstep="1" aria-label="Successivo">${ic('chevR')}</button></span></div>
      </div></header>
      <div class="rec-body drv-body"><div class="rec-main"><section class="rec-sec prevsec">${preview(x, true)}${x.prev !== 'none' ? `<button type="button" class="lnk openfull">${ic('eye')}Apri a tutto schermo</button>` : ''}</section></div>
      <aside class="rec-rail">${info(x)}</aside></div></div>`
  }

  // ═══ Variante B · pannello fisso ════════════════════════════════
  const paneB = () => {
    if (!pane) return ''
    const x = ITEMS[sel]
    return `<aside class="dpane" aria-label="Dettagli">
      <div class="dp-head">${icoOf(x)}<b>${esc(x.name)}</b><button class="icon-btn" type="button" data-pane-close aria-label="Chiudi il pannello">${ic('x')}</button></div>
      ${preview(x, false)}
      <div class="dp-acts">${actions(x)}<button class="btn" type="button">${ic('copy')}Copia link</button><span class="menu-anchor"><button class="icon-btn" type="button" data-menu aria-label="Altre azioni">${ic('more')}</button>${menu ? `<div class="inv-menu" role="menu">${moreItems}</div>` : ''}</span></div>
      <div class="dp-body">${info(x)}</div></aside>`
  }

  // ═══ Pagina ═════════════════════════════════════════════════════
  const TREE = [['Tutto il Drive', 0, 'cloud'], ['Amministrazione', 1], ['Contratti firmati', 2, 'lock'], ['Clienti', 1, 'open'], ['AUSL Bologna', 2], ['AUSL Imola', 2, 'on'], ['AUSL Romagna', 2], ['Procedure interne', 1], ['Software', 1]]
  const CUST = [['AUSL Bologna', 38], ['AUSL Imola', 61], ['AUSL Romagna', 22], ['IRCCS Rizzoli', 9]]
  const side = () => `<aside class="d3-side" aria-label="Cartelle e clienti">
      <label class="d3-search">${ic('search')}<input placeholder="Cerca in tutto il Drive" aria-label="Cerca nel Drive"></label>
      <div class="d3-h">Cartelle</div>
      <ul class="d3-tree">${TREE.map(([n, d, f]) => `<li style="--d:${d}"${f === 'on' ? ' class="on"' : ''}><span class="tw">${d && (f === 'open' || n === 'Amministrazione') ? ic(f === 'open' ? 'chevD' : 'chevR') : ''}</span>${ic(f === 'cloud' ? 'cloud' : 'folder')}<span>${n}</span>${f === 'lock' ? `<em>${ic('lock')}</em>` : ''}</li>`).join('')}</ul>
      <div class="d3-h">Clienti</div>
      <ul class="d3-cust">${CUST.map(([n, k]) => `<li>${ic('building')}<span>${n}</span><small>${k}</small></li>`).join('')}</ul></aside>`
  const list = () => `<table class="po-table c-list drv-list"><thead><tr>${variant === 'B' ? '<th class="ck"></th>' : ''}<th>Nome</th><th>Cliente</th><th class="num">Dimensione</th><th>Modificato</th></tr></thead><tbody>${ITEMS.map((x, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}">${variant === 'B' ? '<td class="ck"><input type="checkbox" aria-label="Seleziona"></td>' : ''}<td><span class="nm">${icoOf(x)}<b>${esc(x.name)}</b></span></td><td>${x.cust.length ? x.cust.map((c) => `<span class="dchip sm">${esc(c)}</span>`).join('') : '<span style="color:var(--faint)">—</span>'}</td><td class="num">${x.size || x.meta.split(' · ')[1]}</td><td>${x.mod.slice(0, 10)}<br><small style="color:var(--muted)">${esc(x.by)}</small></td></tr>`).join('')}</tbody></table>`
  const crumb = `<nav class="dcrumb" aria-label="Percorso">${PATH.map((p, i) => `${i ? '<span>/</span>' : ''}<button type="button"${i === PATH.length - 1 ? ' aria-current="page"' : ''}>${p}</button>`).join('')}</nav>`
  const view = () => `<div class="mt-head"><h1>Drive</h1><div class="actions"><button class="btn" type="button">${ic('folder')}Nuova cartella</button><button class="btn btn-primary" type="button">${ic('upload')}Carica file</button></div></div>
    <p class="hint" style="margin:0 0 12px">${variant === 'A' ? 'Clic per selezionare, doppio clic: il file si apre nella finestra, la cartella ci entri.' : 'Clic: il pannello a destra mostra file o cartella. Doppio clic o Invio: il file a tutto schermo, nella cartella ci entri. Sotto i 1500 px il pannello si apre sopra l\'elenco.'}</p>
    ${variant === 'B' ? `<section class="d3${pane ? ' has-pane' : ''}">${side()}<div class="d3-main"><div class="d3-bar">${crumb}${!pane ? '<button type="button" class="lnk" data-pane-open>Mostra i dettagli</button>' : ''}</div><div class="table-wrap">${list()}</div></div>${paneB()}</section>`
      : `${crumb}<section class="panel" style="margin-top:10px"><div class="table-wrap">${list()}</div></section>`}
    ${variant === 'A' && open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="${esc(ITEMS[open].name)}"><button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${windowA()}</div></div>` : ''}
    ${full ? `<div class="dfull" data-full-close><div class="dfull-bar"><b>${esc(ITEMS[sel].name)}</b><button class="btn" type="button">${ic('download')}Scarica</button><button class="icon-btn" type="button" data-full-close aria-label="Chiudi">${ic('x')}</button></div>${preview(ITEMS[sel], true)}</div>` : ''}`

  const render = () => {
    root.innerHTML = view()
    document.querySelectorAll('[data-drvv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.drvv === variant)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Drive')))
  }
  root.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { open = null; menu = false; return render() }
    if (t.closest('[data-full-close]') && (t.matches('[data-full-close]') || t.closest('button[data-full-close]'))) { full = false; return render() }
    if (t.closest('[data-menu]')) { menu = !menu; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !t.closest('.inv-menu')) { menu = false; render() }
    if (t.closest('[data-pane-close]')) { pane = false; store('archie-preview-drv-pane', '0'); return render() }
    if (t.closest('[data-pane-open]')) { pane = true; store('archie-preview-drv-pane', '1'); return render() }
    if (t.closest('.openfull')) { full = true; return render() }
    const fs = t.closest('[data-fstep]'); if (fs) { const files = ITEMS.map((x, i) => [x, i]).filter(([x]) => x.kind === 'file'); const k = files.findIndex(([, i]) => i === open); open = files[(k + Number(fs.dataset.fstep) + files.length) % files.length][1]; sel = open; return render() }
    if (t.closest('td.ck')) return
    const row = t.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
  })
  root.addEventListener('dblclick', (e) => {
    const row = e.target.closest('tr[data-row]'); if (!row) return
    const i = Number(row.dataset.row); sel = i
    if (ITEMS[i].kind === 'folder') return render()   // nell'app entra nella cartella
    if (variant === 'A') open = i; else full = true
    render()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (menu) menu = false; else if (full) full = false; else open = null; render() } })
  document.querySelectorAll('[data-drvv]').forEach((b) => b.addEventListener('click', () => { variant = b.dataset.drvv; store('archie-preview-drv-v', variant); open = variant === 'A' ? 2 : null; full = false; menu = false; sel = 2; render() }))
  open = variant === 'A' ? 2 : null
  render()
})()
