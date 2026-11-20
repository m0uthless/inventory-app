/* Inventari senza drawer (anteprima inv-base, seconda versione 18/11/2026): l'inventario nella finestra
   dei record, come Clienti, Siti e Contatti (core-base). Due varianti per decidere dove sta l'accesso:
   A · «Accesso in primo piano» (al centro, in alto) · B · «Accesso a lato» (colonna laterale, in alto).
   Seconda versione, richieste di Fede:
   - issue: le aperte e tutto lo storico delle chiuse;
   - i dati si leggono come testo, senza riquadri; «Modifica» nel ⋯ (solo con il permesso di scrittura)
     trasforma in campi tutti i dati modificabili, credenziali comprese; una sola barra per salvare;
   - le schede con le password hanno a destra lo spazio per il logo dell'applicazione (img/logos/os.png, …);
   - la targa K-Number disegnata in SVG resta dove c'è il K-Number.
   Clic sulla riga seleziona, doppio clic o Invio apre. Dati finti modellati su /api/inventories/. Oggi: 18/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const go = ic('chevR').replace('class="i"', 'class="i go"')
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`
  const dIt = (s) => (s ? s.split('-').reverse().join('/') : '')

  // ═══ Dati ═══════════════════════════════════════════════════════
  const TYPES = ['Server', 'Workstation', 'Modalità', 'Storage', 'Rete', 'PACS']
  const STATI = { 'In uso': 'ok', 'In magazzino': 'aperta', 'Guasto': 'warn', 'Dismesso': '' }
  const SITES = { 1: ['Ospedale Maggiore', 'AUSL Bologna'], 2: ['S. Maria della Scaletta', 'AUSL Imola'], 3: ['Casa della Comunità Navile', 'AUSL Bologna'], 4: ['Ospedale di Castel San Pietro', 'AUSL Imola'] }
  const CLOSED_PACS = [
    [1012, 'Rallentamenti nel recupero degli studi dal VNA', 'Risolta', '04/11/2026', 'Marco Bassi'],
    [987, 'Certificato TLS in scadenza sul nodo 1', 'Chiusa', '22/09/2026', 'Nicole Spazzoli'],
    [954, 'Spazio disco al 92% sul volume cache', 'Chiusa', '30/07/2026', 'Marco Bassi'],
    [921, 'Errore DICOM C-MOVE verso la CT 2', 'Chiusa', '11/06/2026', 'Anna Ferri'],
    [870, 'Aggiornamento IntelliSpace 4.4 SP2', 'Chiusa', '02/04/2026', 'Nicole Spazzoli'],
    [812, 'Backup notturno non completato', 'Chiusa', '19/01/2026', 'Marco Bassi'],
    [765, 'Licenze client esaurite', 'Chiusa', '03/11/2025', 'Anna Ferri'],
  ]
  const INV = [
    { name: 'PACS · nodo 1', type: 'PACS', st: 'In uso', host: 'aimpacs01', ip: '10.20.5.10', srsa: '172.16.40.10', kn: 'K-104233', sn: 'CZ2391A0F', mf: 'Philips', md: 'IntelliSpace PACS 4.4', war: '2027-06-30', loc: 'Sala server, piano −1', tel: '0542 662 900', site: 2,
      osu: 'Administrator', osp: 'Pacs!2026#imola', appu: 'isadmin', appp: 'Isp-4.4-admin', vnc: 'vnc-7731', osn: 'Windows Server 2019', appn: 'IntelliSpace PACS',
      iss: [[1041, 'Worklist vuota sulla CT 2', 'lav', 'alta']], closed: CLOSED_PACS,
      plans: [['Manutenzione preventiva semestrale', '30/11/2026', 12]], events: [['Preventiva', '28/05/2026', 'Sostituito alimentatore ridondante']], mon: [], tags: ['critico', 'cluster'], notes: 'Nodo primario del cluster. Riavvio solo d\'accordo con la radiologia (interno 4410).' },
    { name: 'CT 2 · Siemens SOMATOM', type: 'Modalità', st: 'In uso', host: 'aimct02', ip: '10.20.40.12', srsa: '', kn: 'K-104871', sn: 'SOM-77812', mf: 'Siemens', md: 'SOMATOM go.Up', war: '2028-01-31', loc: 'Radiologia, sala 3', tel: '0542 662 410', site: 2,
      osu: 'service', osp: 'Siem3ns-svc', appu: '', appp: '', vnc: '', osn: 'Windows 10 IoT', appn: '',
      iss: [[1041, 'Worklist vuota sulla CT 2', 'lav', 'alta']], closed: [[930, 'Tavolo bloccato in posizione alta', 'Chiusa', '20/06/2026', 'Anna Ferri']], plans: [], events: [], mon: [], tags: [], notes: '' },
    { name: 'Workstation refertazione 1', type: 'Workstation', st: 'In uso', host: 'aimwkr01', ip: '10.20.12.21', srsa: '', kn: '', sn: 'HP-Z4-55120', mf: 'HP', md: 'Z4 G5', war: '2026-12-15', loc: 'Refertazione, stanza 12', tel: '', site: 2,
      osu: 'radiologo', osp: 'Ref-2026!', appu: 'ref01', appp: 'Isp-ref-01', vnc: 'vnc-ref01', osn: 'Windows 11', appn: 'IntelliSpace client',
      iss: [], closed: [], plans: [['Calibrazione monitor diagnostici', '05/12/2026', 17]], events: [['Calibrazione', '05/06/2026', 'QA superato, report caricato']],
      mon: [['Barco', 'Nio Color 3MP', 'BC-33120', 'Diagnostico', true], ['Barco', 'Nio Color 3MP', 'BC-33121', 'Diagnostico', true]], tags: [], notes: '' },
    { name: 'Storage immagini', type: 'Storage', st: 'In uso', host: 'aimstor01', ip: '10.20.5.30', srsa: '', kn: 'K-104240', sn: 'NTAP-AFF-9921', mf: 'NetApp', md: 'AFF A250', war: '2029-03-31', loc: 'Sala server, piano −1', tel: '', site: 2,
      osu: 'admin', osp: 'N3tapp-Imola', appu: '', appp: '', vnc: '', osn: 'ONTAP', appn: '', iss: [], closed: [], plans: [], events: [], mon: [], tags: [], notes: '' },
    { name: 'Server applicativo RIS', type: 'Server', st: 'Guasto', host: 'bomris01', ip: '10.10.4.20', srsa: '', kn: 'K-099120', sn: 'DL380-778120', mf: 'HPE', md: 'ProLiant DL380 Gen10', war: '2025-10-31', loc: 'CED, rack 7', tel: '051 6478 100', site: 1,
      osu: 'Administrator', osp: 'Ris-Bo-2025', appu: 'risadmin', appp: 'R1s!admin', vnc: '', osn: 'Windows Server 2016', appn: 'RIS',
      iss: [[1033, 'Lentezza apertura studi in refertazione', 'aperta', 'media']], closed: [[1001, 'Disco 3 in errore predittivo', 'Chiusa', '15/10/2026', 'Marco Bassi']], plans: [], events: [], mon: [], tags: [], notes: 'In attesa del disco sostitutivo (RMA 55120).' },
    { name: 'Workstation di scorta', type: 'Workstation', st: 'In magazzino', host: '', ip: '', srsa: '', kn: '', sn: 'HP-Z2-10021', mf: 'HP', md: 'Z2 G9', war: '2027-02-28', loc: 'Magazzino Biotron', tel: '', site: 1,
      osu: '', osp: '', appu: '', appp: '', vnc: '', osn: '', appn: '', iss: [], closed: [], plans: [], events: [], mon: [], tags: [], notes: '' },
  ]
  const ACT = [['server', 'Nicole Spazzoli ha aggiornato la posizione', 'ieri 17:40'], ['key', 'Marco Bassi ha cambiato la password SO', '12/11'], ['plus', 'Sistema ha creato l\'inventario', '30/06/2025']]
  const CLOSED_PREVIEW = 5

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* niente */ } }
  const read = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  let variant = qs.get('variante') || read('archie-preview-inv-v', 'A')
  let locked = read('archie-preview-inv-lock', '') === '1'
  let fromSite = read('archie-preview-inv-site', '') === '1'
  let readOnly = read('archie-preview-inv-ro', '') === '1'
  let open = null; let sel = 0; let shown = {}; let editing = false; let menu = false; let allClosed = false
  const drafts = new Map()
  const root = $('[data-inv]')
  const KEYS = ['name', 'type', 'st', 'site', 'kn', 'sn', 'mf', 'md', 'war', 'loc', 'tel', 'notes', 'host', 'ip', 'srsa', 'osu', 'osp', 'appu', 'appp', 'vnc']
  const FIELDS = (i) => Object.fromEntries(KEYS.map((k) => [k, k === 'site' ? String(i.site) : (i[k] ?? '')]))
  const draft = (n) => { if (!drafts.has(n)) drafts.set(n, FIELDS(INV[n])); return drafts.get(n) }
  const changes = (n) => { const d = draft(n); const o = FIELDS(INV[n]); return KEYS.filter((f) => d[f] !== o[f]) }
  const dirty = (f) => (draft(open)[f] !== FIELDS(INV[open])[f] ? ' dirty' : '')
  const cur = () => (editing ? draft(open) : FIELDS(INV[open]))

  // ═══ Pezzi ══════════════════════════════════════════════════════
  const sec = (id, title, hint, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${hint ? `<p>${hint}</p>` : ''}${end}</div>${body}</section>`
  const rcard = (title, body, end = '') => `<section class="rcard"><div class="hd"><h3>${title}</h3>${end}</div>${body}</section>`
  const copyBtn = (label) => `<button class="icon-btn cp" type="button" aria-label="Copia ${label}">${ic('copy')}</button>`
  const none = '<span class="ikv-none">—</span>'

  /* Un dato: testo senza riquadro; in modifica diventa un campo. */
  const kv = (f, label, { mono = false, fmt = (v) => esc(v), ph = '', type = 'text', wide = false } = {}) => {
    const d = cur(); const v = d[f]
    if (editing) return `<label class="ikv${wide ? ' wide' : ''}"><span>${label}</span><input data-f="${f}" type="${type}" value="${esc(v)}"${ph ? ` placeholder="${ph}"` : ''} class="${mono ? 'mono' : ''}${dirty(f)}"></label>`
    return `<div class="ikv${wide ? ' wide' : ''}"><span>${label}</span><b class="${mono ? 'mono' : ''}">${v ? fmt(v) : none}</b></div>`
  }
  const kvSel = (f, label, opts, show = (v) => esc(v)) => {
    const d = cur(); const v = d[f]
    if (editing) return `<label class="ikv"><span>${label}</span><select data-f="${f}" class="${dirty(f)}">${opts.map(([o, l]) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
    return `<div class="ikv"><span>${label}</span><b>${show(v)}</b></div>`
  }
  const stDot = (v) => `<span class="st-inline"><i class="${STATI[v]}"></i>${esc(v)}</span>`

  /* Targa K-Number: la stessa dell'app (inventoryUi › KNumberPlate), blu Philips fisso. */
  const plate = (kn) => {
    const digits = 9; const padded = kn.replace(/\D/g, '').slice(-digits).padStart(digits, '0')
    const blue = '#1e56ff'; const sw = 6, lp = 22, tp = 18, gap = 10, bw = 74, bh = 74
    const fw = lp * 2 + digits * bw + (digits - 1) * gap; const area = tp + bh + 18; const by = area + 34; const fh = by + 28
    const boxes = [...padded].map((c, i) => { const x = lp + i * (bw + gap); return `<rect x="${x}" y="${tp}" width="${bw}" height="${bh}" fill="white" stroke="black" stroke-width="4"/><text x="${x + bw / 2}" y="${tp + bh / 2 + 18}" text-anchor="middle" font-size="52" font-family="Arial, Helvetica, sans-serif" font-weight="800" fill="black">${c}</text>` }).join('')
    return `<svg class="kplate" viewBox="0 0 ${fw} ${fh}" role="img" aria-label="K-Number ${padded}"><rect x="${sw / 2}" y="${sw / 2}" width="${fw - sw}" height="${area - sw}" rx="6" fill="white" stroke="${blue}" stroke-width="${sw}"/>${boxes}<text x="${lp}" y="${by}" font-size="36" font-family="Arial, Helvetica, sans-serif" font-weight="900" fill="${blue}">PHILIPS</text></svg>`
  }

  /* Rete: tre dati con copia; in modifica tre campi. */
  const net = () => {
    const d = cur()
    const items = [['host', 'Hostname'], ['ip', 'IP locale'], ['srsa', 'IP SRSA']]
    if (editing) return `<div class="net">${items.map(([f, l]) => `<label class="net-t edit"><small>${l}</small><input data-f="${f}" class="mono${dirty(f)}" value="${esc(d[f])}"></label>`).join('')}</div>`
    const shownItems = items.filter(([f]) => d[f])
    return shownItems.length ? `<div class="net">${shownItems.map(([f, l]) => `<div class="net-t"><small>${l}</small><b>${esc(d[f])}</b>${copyBtn(l.toLowerCase())}</div>`).join('')}</div>` : ''
  }
  /* Una scheda di credenziali con lo spazio per il logo a destra (img/logos/<logo>.png). */
  const logo = (name, alt) => `<span class="logo-slot" title="Logo: img/logos/${name}.png"><img src="shared/img/logos/${name}.png" alt="${esc(alt)}" onerror="this.remove()"><em>${name}.png</em></span>`
  const pwRow = (k, f) => {
    const v = cur()[f]
    if (editing && locked) return `<div><span>Password</span><span class="v" style="font-family:inherit;color:var(--muted)">Serve il permesso Credenziali per cambiarla</span><span class="acts"></span></div>`
    if (editing) return `<div><span>Password</span><input data-f="${f}" type="${shown[k] ? 'text' : 'password'}" class="mono${dirty(f)}" value="${esc(v)}" autocomplete="new-password"><span class="acts"><button class="icon-btn" type="button" data-pw="${k}" aria-label="Mostra la password">${ic(shown[k] ? 'eyeOff' : 'eye')}</button></span></div>`
    if (locked) return `<div><span>Password</span><span class="v" style="font-family:inherit;color:var(--muted)">Serve il permesso Credenziali</span><span class="acts"></span></div>`
    return `<div><span>Password</span><span class="v pw${shown[k] ? ' on' : ''}">${shown[k] ? esc(v) : '••••••••'}</span><span class="acts"><button class="icon-btn" type="button" data-pw="${k}" aria-pressed="${Boolean(shown[k])}" aria-label="${shown[k] ? 'Nascondi' : 'Mostra'} la password" title="${shown[k] ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}">${ic(shown[k] ? 'eyeOff' : 'eye')}</button>${copyBtn('la password')}</span></div>`
  }
  const userRow = (f) => editing
    ? `<div><span>Utente</span><input data-f="${f}" class="mono${dirty(f)}" value="${esc(cur()[f])}"><span class="acts"></span></div>`
    : `<div><span>Utente</span><span class="v">${esc(cur()[f])}</span><span class="acts">${copyBtn("l'utente")}</span></div>`
  const credCard = (title, sub, logoName, rows) => `<div class="credg"><h4>${title}${sub ? `<small>${esc(sub)}</small>` : ''}</h4><div class="credbox"><div class="cred">${rows}</div>${logo(logoName, title)}</div></div>`
  const creds = (x) => {
    const d = cur(); const g = []
    if (editing || d.osu || d.osp) g.push(credCard('Sistema operativo', x.osn, 'os', userRow('osu') + pwRow('os', 'osp')))
    if (editing || d.appu || d.appp) g.push(credCard('Applicazione', x.appn, 'app', userRow('appu') + pwRow('app', 'appp')))
    if (editing || d.vnc) g.push(credCard('Accesso remoto VNC', '', 'vnc', pwRow('vnc', 'vnc')))
    return g.length ? g.join('') : '<p class="empty-s">Nessuna credenziale registrata per questo sistema.</p>'
  }
  const access = (x, compact) => `<div class="acc${compact ? ' compact' : ''}">${net()}${creds(x)}<p class="acc-note">${ic('lock')}Le password si vedono solo con il permesso Credenziali e si nascondono da sole dopo 30 secondi.</p></div>`

  /* Issue: le aperte, poi tutto lo storico delle chiuse (le prime cinque, poi «Mostra tutte»). */
  const issues = (x) => {
    const openRows = x.iss.length ? `<div class="rows">${x.iss.map(([n, t, st, pr]) => `<button type="button" class="row r-iss"><span class="iss-n">#${n}</span><span class="t"><b>${esc(t)}</b><small>Priorità ${pr}</small></span><span class="st ${st}">${st === 'lav' ? 'In lavorazione' : 'Aperta'}</span>${go}</button>`).join('')}</div>` : '<p class="empty-s">Nessuna issue aperta.</p>'
    const list = allClosed ? x.closed : x.closed.slice(0, CLOSED_PREVIEW)
    const closedRows = x.closed.length ? `<h4 class="subh">Storico · chiuse${muted(x.closed.length)}</h4><div class="rows closed">${list.map(([n, t, st, d, who]) => `<button type="button" class="row r-iss"><span class="iss-n">#${n}</span><span class="t"><b>${esc(t)}</b><small>${st} il ${d} · ${esc(who)}</small></span><span class="st done">${st}</span>${go}</button>`).join('')}</div>${x.closed.length > CLOSED_PREVIEW ? `<button class="lnk more-row" type="button" data-allclosed>${allClosed ? 'Mostra meno' : `Mostra tutte le ${x.closed.length}`}</button>` : ''}` : '<h4 class="subh">Storico · chiuse</h4><p class="empty-s">Nessuna issue chiusa.</p>'
    return openRows + closedRows
  }
  const maint = (x) => (x.plans.length || x.events.length) ? `<div class="rows">
      ${x.plans.map(([t, d, n]) => `<button type="button" class="row r-doc"><span class="doc-ic">${ic('calendar')}</span><span class="t"><b>${esc(t)}</b><small>Piano · prossima scadenza il ${d}</small></span><span class="st ${n <= 30 ? 'warn' : 'ok'}">${n <= 30 ? `tra ${n} giorni` : 'in regola'}</span>${go}</button>`).join('')}
      ${x.events.map(([t, d, note]) => `<button type="button" class="row r-doc"><span class="doc-ic">${ic('file')}</span><span class="t"><b>${esc(t)} del ${d}</b><small>${esc(note)}</small></span><span></span>${go}</button>`).join('')}
    </div>` : '<p class="empty-s">Nessun piano di manutenzione per questo sistema.</p>'
  const monitors = (x) => `<div class="rows">${x.mon.map(([p, m, s, t, rad]) => `<button type="button" class="row r-doc"><span class="doc-ic">${ic('monitor')}</span><span class="t"><b>${esc(p)} ${esc(m)}</b><small>${t} · <span class="code">${esc(s)}</span></small></span>${rad ? '<span class="st ok">RadiNET</span>' : '<span></span>'}${go}</button>`).join('')}</div>`
  const feed = () => `<section class="rcard"><h3>Attività recente</h3><ul class="mini-feed">${ACT.map(([i, t, w]) => `<li>${ic(i)}<span>${t}</span><time>${w}</time></li>`).join('')}</ul></section>`
  const notes = (x) => {
    const v = cur().notes
    const body = editing ? `<textarea class="notes${dirty('notes')}" data-f="notes" placeholder="Note interne sul sistema" aria-label="Note">${esc(v)}</textarea>`
      : (v ? `<p class="notes-ro">${esc(v)}</p>` : '<p class="empty-s">Nessuna nota.</p>')
    return `<section class="rcard"><h3>Note</h3>${body}${x.tags.length ? `<div class="tagl">${x.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</section>`
  }

  const identity = () => { const d = cur(); return `${d.kn && /\d/.test(d.kn) ? plate(d.kn) : ''}<div class="ikvs">
      ${kv('name', 'Nome', { wide: true })}
      ${kvSel('type', 'Tipo', TYPES.map((t) => [t, t]))}${kvSel('st', 'Stato', Object.keys(STATI).map((s) => [s, s]), stDot)}
      ${kv('kn', 'K-Number', { mono: true, ph: 'K-000000' })}${kv('sn', 'Seriale', { mono: true })}
      ${kv('mf', 'Produttore')}${kv('md', 'Modello')}
      ${kv('war', 'Fine garanzia', { type: 'date', fmt: dIt })}
    </div>` }
  const where = () => { const d = cur(); const s = SITES[d.site]; return `<div class="ikvs">
      <div class="ikv"><span>Cliente</span><button type="button" class="ikv-link">${esc(s[1])}${ic('arrowR')}</button></div>
      ${kvSel('site', 'Sito', Object.entries(SITES).filter(([, v]) => v[1] === s[1]).map(([k, v]) => [k, v[0]]), (v) => `<button type="button" class="ikv-link">${esc(SITES[v][0])}${ic('arrowR')}</button>`)}
      ${kv('loc', 'Posizione', { wide: true, ph: 'es. Sala server, piano 2' })}
      ${kv('tel', 'Telefono', { mono: true, ph: 'Interno o diretto' })}
    </div>` }

  // ═══ Finestra ═══════════════════════════════════════════════════
  const record = () => {
    const x = INV[open]; const d = cur(); const s = SITES[d.site]
    const soon = x.plans.find((p) => p[2] <= 30)
    const warEnd = d.war && d.war < '2026-11-18'
    const crumbs = fromSite ? `<nav class="crumbs-rec" aria-label="Percorso"><button type="button">${ic('chevL')}${esc(s[1])}</button><span>/</span><button type="button">${esc(s[0])}</button></nav>` : ''
    const stats = [
      `<button type="button" class="stat${x.iss.length ? ' warn' : ''}" data-goto="iss"><b>${x.iss.length}</b> ${x.iss.length === 1 ? 'issue aperta' : 'issue aperte'}${x.closed.length ? ` · ${x.closed.length} chiuse` : ''}</button>`,
      x.plans.length ? `<button type="button" class="stat${soon ? ' warn' : ''}" data-goto="man"${soon ? ` title="${esc(soon[0])} il ${soon[1]}"` : ''}>${soon ? `manutenzione tra <b>${soon[2]}</b> giorni` : `<b>${x.plans.length}</b> ${x.plans.length === 1 ? 'piano' : 'piani'} di manutenzione`}</button>` : '',
      x.mon.length ? `<button type="button" class="stat" data-goto="mon"><b>${x.mon.length}</b> monitor</button>` : '',
      warEnd ? `<span class="stat warn" style="cursor:default">garanzia scaduta il ${dIt(d.war)}</span>` : '',
    ].join('')
    const moreMenu = menu ? `<div class="inv-menu" role="menu">
        <button type="button" role="menuitem" data-edit${readOnly ? ' disabled title="Serve il permesso di modifica degli inventari"' : ''}>${ic('columns')}Modifica</button>
        <button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia l'hostname</button>
        <button type="button" role="menuitem" data-menu-close>${ic('copy')}Copia l'IP</button>
        <button type="button" role="menuitem" class="danger" data-menu-close${readOnly ? ' disabled' : ''}>${ic('trash')}Elimina</button></div>` : ''
    const head = `<header class="rec-head light">${crumbs}<div class="rec-id"><div class="rec-t">
        <h2>${esc(d.name)}<span class="ven-b">${esc(d.type)}</span>${d.st !== 'In uso' ? `<span class="ven-b"><i style="background:${d.st === 'Guasto' ? '#e0a43a' : '#9fb3ad'}"></i>${esc(d.st)}</span>` : ''}${editing ? '<span class="ven-b editing">In modifica</span>' : ''}</h2>
        <p>${d.host ? `<span class="code" style="color:inherit">${esc(d.host)}</span> · ` : ''}<button type="button" class="band-link">${esc(s[1])}</button> · <button type="button" class="band-link">${esc(s[0])}</button>${d.kn ? ` · <span class="code" style="color:inherit">${esc(d.kn)}</span>` : ''}</p>
        <div class="rec-tags">${stats}</div></div>
        <div class="rec-act">${fromSite || editing ? '' : `<span class="rec-pos">${open + 1} di ${INV.length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo">${ic('chevR')}</button>`}
          ${editing ? '' : `<button class="btn on-band solid" type="button">${ic('plus')}Nuova issue</button>`}
          <span class="menu-anchor"><button class="icon-btn on-band" type="button" data-menu aria-haspopup="menu" aria-expanded="${menu}" aria-label="Altre azioni">${ic('more')}</button>${moreMenu}</span></div>
      </div></header>`
    const issSec = sec('iss', `Issue${muted(`${x.iss.length} aperte · ${x.closed.length} chiuse`)}`, '', issues(x), '<button class="lnk" type="button">+ Nuova issue</button>')
    const manSec = sec('man', 'Manutenzione', '', maint(x), x.plans.length || x.events.length ? '<button class="lnk" type="button">Apri in Manutenzione</button>' : '')
    const monSec = x.mon.length ? sec('mon', `Monitor${muted(x.mon.length)}`, '', monitors(x)) : ''
    const accTitle = `${ic('lock')}Accesso`
    let body
    if (variant === 'A') {
      body = `<div class="rec-main">
          ${sec('acc', accTitle, '', access(x, false), '<span class="app-tag">credenziali solo qui</span>')}
          ${issSec}${manSec}${monSec}
        </div><aside class="rec-rail" aria-label="Inventario">
          ${rcard('Identità', identity())}${rcard('Dove si trova', where())}${notes(x)}${feed()}
        </aside>`
    } else {
      body = `<div class="rec-main">
          ${issSec}${manSec}${monSec}
          ${sec('det', 'Identità e posizione', '', `<div class="det2"><div>${identity()}</div>${where()}</div>`)}
        </div><aside class="rec-rail" aria-label="Accesso e note">
          ${rcard(accTitle, access(x, true), '<span class="app-tag">solo qui</span>')}${notes(x)}${feed()}
        </aside>`
    }
    const n = editing ? changes(open).length : 0
    const bar = editing ? `<div class="savebar" role="status"><span class="dot"></span><b>${n ? `${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare` : 'In modifica · nessun cambiamento'}</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save${n ? '' : ' disabled'}>Salva le modifiche</button></div>` : ''
    return `<div class="record${editing ? ' is-editing' : ''}">${head}<div class="rec-body">${body}</div>${bar}</div>`
  }

  // ═══ Pagina ═════════════════════════════════════════════════════
  const table = () => `<table class="po-table c-list"><thead><tr><th>Inventario</th><th>Tipo</th><th>Cliente · sito</th><th>Stato</th><th>IP</th><th>Issue</th></tr></thead><tbody>${INV.map((x, i) => `<tr data-row="${i}" tabindex="0" class="${i === sel ? 'is-sel' : ''}"><td><b>${esc(x.name)}</b><br><small class="code" style="color:var(--muted)">${esc(x.host || '—')}</small></td><td><span class="ttag ${x.type}">${x.type}</span></td><td>${SITES[x.site][1]}<br><small style="color:var(--muted)">${SITES[x.site][0]}</small></td><td><span class="st ${STATI[x.st]}">${x.st}</span></td><td class="code">${esc(x.ip || '—')}</td><td>${x.iss.length || '—'}</td></tr>`).join('')}</tbody></table>`
  const view = () => `<div class="mt-head"><h1>Inventari</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo inventario</button></div></div>
    <p class="hint" style="margin:-6px 0 12px">Clic per selezionare la riga, doppio clic o Invio per aprire.</p>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${open != null ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="${esc(INV[open].name)}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  const render = (keepScroll = true) => {
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view()
    const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0
    document.querySelectorAll('[data-invv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.invv === variant)))
    document.querySelectorAll('[data-invlock]').forEach((b) => b.setAttribute('aria-pressed', String(locked)))
    document.querySelectorAll('[data-invsite]').forEach((b) => b.setAttribute('aria-pressed', String(fromSite)))
    document.querySelectorAll('[data-invro]').forEach((b) => b.setAttribute('aria-pressed', String(readOnly)))
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.textContent.trim().startsWith('Inventari')))
  }
  const leave = () => open == null || !editing || !changes(open).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const reset = () => { drafts.delete(open); editing = false; menu = false; shown = {}; allClosed = false }
  const openRec = (i) => { if (open != null) reset(); open = i; sel = i; render(false) }
  const close = () => { if (!leave()) return; reset(); open = null; render() }

  root.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) return close()
    if (t.closest('[data-menu]')) { menu = !menu; return render() }
    if (t.closest('[data-edit]') && !readOnly) { menu = false; editing = true; return render() }
    if (t.closest('[data-menu-close]')) { menu = false; return render() }
    if (menu && !t.closest('.inv-menu')) { menu = false; render() }
    const row = t.closest('tr[data-row]'); if (row) { sel = Number(row.dataset.row); return render() }
    const step = t.closest('[data-step]'); if (step) return openRec((open + Number(step.dataset.step) + INV.length) % INV.length)
    const g = t.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (t.closest('[data-allclosed]')) { allClosed = !allClosed; return render() }
    const p = t.closest('[data-pw]'); if (p) { const k = p.dataset.pw; shown[k] = !shown[k]; render(); if (shown[k] && !editing) setTimeout(() => { shown[k] = false; if (open != null) render() }, 30000); return }
    const cp = t.closest('.cp'); if (cp) { cp.innerHTML = ic('check'); cp.style.color = 'var(--success)'; setTimeout(() => { cp.innerHTML = ic('copy'); cp.style.color = '' }, 1400); return }
    if (t.closest('[data-discard]')) { drafts.delete(open); editing = false; shown = {}; return render() }
    if (t.closest('[data-save]')) { const d = draft(open); Object.assign(INV[open], { ...d, site: Number(d.site) }); drafts.delete(open); editing = false; shown = {}; return render() }
  })
  root.addEventListener('dblclick', (e) => { const row = e.target.closest('tr[data-row]'); if (row) openRec(Number(row.dataset.row)) })
  const onField = (e) => {
    const f = e.target.dataset.f; if (!f || open == null || !editing) return
    draft(open)[f] = e.target.value
    if (e.target.tagName === 'SELECT') return render()
    e.target.classList.toggle('dirty', draft(open)[f] !== FIELDS(INV[open])[f])
    const rec = $('.record', root); const tmp = document.createElement('div'); tmp.innerHTML = record()
    $('.rec-head', rec).replaceWith($('.rec-head', tmp)); $('.savebar', rec)?.replaceWith($('.savebar', tmp))
  }
  root.addEventListener('input', onField)
  root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') onField(e) })
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-row]')) { e.preventDefault(); openRec(Number(e.target.dataset.row)) } })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || open == null || $('[data-palette-bg]')?.hidden === false) return
    if (menu) { menu = false; return render() }
    close()
  })
  const toggle = (sel_, fn) => document.querySelectorAll(sel_).forEach((b) => b.addEventListener('click', () => { fn(); render() }))
  document.querySelectorAll('[data-invv]').forEach((b) => b.addEventListener('click', () => { variant = b.dataset.invv; store('archie-preview-inv-v', variant); render() }))
  toggle('[data-invlock]', () => { locked = !locked; store('archie-preview-inv-lock', locked ? '1' : '') })
  toggle('[data-invsite]', () => { fromSite = !fromSite; store('archie-preview-inv-site', fromSite ? '1' : '') })
  toggle('[data-invro]', () => { readOnly = !readOnly; if (readOnly) { editing = false; if (open != null) drafts.delete(open) } store('archie-preview-inv-ro', readOnly ? '1' : '') })

  if (qs.get('chiuso')) render(); else openRec(0)
})()
