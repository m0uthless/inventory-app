/* Anagrafiche senza drawer (anteprima core-base): Clienti, Siti e Contatti nella finestra dei record
   (RecordModal), variante A «Tutto in vista» scelta per il Cliente il 17/11/2026.
   Schema comune: testata Band (riquadro, titolo, sottotitolo, conteggi che portano alla sezione,
   posizione con frecce, azione principale, ⋯), al centro i record collegati, a lato anagrafica
   modificabile + blocchi di contesto, una sola barra «N modifiche da salvare».
   I record collegati si aprono nella stessa finestra con il percorso «‹ AUSL Imola / …» per tornare.
   Dati finti modellati su /api/customers/, /api/sites/, /api/contacts/. Oggi: 17/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()
  const svg = (d) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`
  const PHONE = svg('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z')
  const MAIL = svg('M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 6.5 12 13l8.5-6.5')
  const go = ic('chevR').replace('class="i"', 'class="i go"')
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const muted = (n) => ` <span style="font-weight:400;color:var(--muted);font-size:12px">${n}</span>`

  // ═══ Dati ═══════════════════════════════════════════════════════
  const VEN = { Philips: '#3f7fbf', Biotron: '#2e8b6e', 'Medical Imaging': '#b4673a' }
  const SITE_ST = { Attivo: 'ok', 'Da attivare': 'aperta', 'In dismissione': 'warn' }
  const INV = (name, type, host) => ({ name, type, host })
  const SITE = (name, dn, street, city, cap, prov, inv, iss = [], extra = {}) => ({ name, dn, street, city, cap, prov, inv, iss, st: 'Attivo', notes: '', ...extra })
  const CUST = [
    { code: '001', dn: 'AUSL Bologna', name: 'Azienda USL di Bologna', ven: 'Philips', city: 'Bologna', prov: 'BO', addr: 'Via Castiglione 29', vat: '02406911202', tax: '02406911202', notes: '',
      sites: [SITE('Ospedale Maggiore', 'Maggiore', 'Largo Nigrisoli 2', 'Bologna', '40133', 'BO', [INV('PACS · nodo 1', 'Server', '10.20.5.10'), INV('RM 1,5 T Philips Ingenia', 'Modalità', '10.20.40.11'), INV('Workstation 3D', 'Workstation', 'WS-3D-01')], [[1046, 'Errore invio DICOM SR dose', 'aperta']]),
        SITE('Ospedale Bellaria', 'Bellaria', 'Via Altura 3', 'Bologna', '40139', 'BO', [INV('CT Philips Incisive', 'Modalità', '10.21.30.4'), INV('RIS client sala 2', 'Workstation', 'WS-BEL-02')], [[1029, 'Etichette stampa paziente sfalsate', 'aperta']]),
        SITE('Ospedale di Bentivoglio', 'Bentivoglio', 'Via Marconi 35', 'Bentivoglio', '40010', 'BO', [INV('DR portatile', 'Modalità', '10.22.10.6')], [], { st: 'In dismissione', notes: 'Radiologia in chiusura entro marzo 2027: non rinnovare i contratti del DR.' })],
      contacts: [['Massimo Romanelli', 'Ingegneria clinica', '051 6584 210', 'm.romanelli@ausl.bologna.it', true, 0], ['Anna Marchi', 'Neuroradiologia', '051 6225 400', 'anna.marchi@ausl.bologna.it', false, 1]],
      contracts: [['Manutenzione PACS 2025–2026', '31/12/2026', 44]], drive: 4, vpn: null },
    { code: '002', dn: 'AUSL Imola', name: 'Azienda USL di Imola', ven: 'Philips', city: 'Imola', prov: 'BO', addr: 'Viale Amendola 2', vat: '00705271203', tax: '90000900374',
      notes: 'Accesso al data center solo accompagnati da Pirazzoli. Finestra di manutenzione concordata: martedì 7–9.',
      sites: [
        SITE('Ospedale S. Maria della Scaletta', 'S. Maria della Scaletta', 'Via Montericco 4', 'Imola', '40026', 'BO', [INV('PACS · nodo principale', 'Server', '10.40.12.10'), INV('RIS · application server', 'Server', '10.40.12.21'), INV('CT 2 · Siemens SOMATOM', 'Modalità', '10.40.30.42'), INV('Workstation refertazione 3', 'Workstation', 'WS-RAD-03')],
          [[1041, 'Worklist vuota sulla modalità CT 2', 'lav'], [1038, 'Lentezza apertura studi dal PACS', 'aperta']], { notes: 'Sala server al piano -1, badge dalla portineria centrale.' }),
        SITE('Ospedale Vecchio · Poliambulatorio', 'Poliambulatorio', 'Via Caterina Sforza 3', 'Imola', '40026', 'BO', [INV('Ecografo Philips EPIQ 7', 'Modalità', '10.40.51.12'), INV('Workstation ambulatorio 1', 'Workstation', 'WS-AMB-01')]),
        SITE('Casa della Salute Castel San Pietro', 'CdS Castel San Pietro', 'Viale Oriani 1', 'Castel San Pietro Terme', '40024', 'BO', [INV('Mammografo Hologic', 'Modalità', '10.41.10.8'), INV('Router VPN sede', 'Rete', '10.41.0.1')]),
        SITE('Casa della Salute Medicina', 'CdS Medicina', 'Via Saffi 1', 'Medicina', '40059', 'BO', [INV('Telecomandato DR', 'Modalità', '10.42.10.5')], [], { st: 'Da attivare' }),
        SITE('Data center aziendale', 'Data center', 'Via Amendola 8', 'Imola', '40026', 'BO', [INV('VNA · storage primario', 'Server', '10.40.1.30'), INV('Backup NAS', 'Server', '10.40.1.31'), INV('Firewall perimetrale', 'Rete', '10.40.0.1')]),
      ],
      contacts: [['Laura Gentili', 'Radiologia · coordinatrice tecnica', '0542 662 410', 'l.gentili@ausl.imola.bo.it', true, 0], ['Davide Pirazzoli', 'Sistemi informativi', '0542 662 118', 'd.pirazzoli@ausl.imola.bo.it', false, 4], ['Paolo Rinaldi', 'Radiologia · TSRM', '0542 662 455', '', false, 0], ['Sara Golinelli', 'Poliambulatorio · referente', '0542 604 220', 's.golinelli@ausl.imola.bo.it', false, 1], ['Marco Cavina', 'Radiologia', '051 6955 310', '', false, 2], ['Elisa Montanari', 'Ufficio acquisti', '0542 604 900', 'acquisti@ausl.imola.bo.it', false, null]],
      contracts: [['Manutenzione full risk PACS/RIS', '15/01/2027', 59], ['Assistenza CT 2 Siemens', '30/06/2027', 225]], drive: 3,
      vpn: { app: 'FortiClient', host: 'vpn.ausl.imola.bo.it', port: '10443', user: 'biotron.ext', pw: 'Imola-Vpn!2026' } },
    { code: '003', dn: 'Centro Medico Esperia', name: 'Centro Medico Esperia S.r.l.', ven: 'Biotron', city: 'Pordenone', prov: 'PN', addr: 'Via Montereale 24', vat: '01784560937', tax: '', notes: '',
      sites: [SITE('Centro Medico Esperia · sede', 'Sede', 'Via Montereale 24', 'Pordenone', '33170', 'PN', [INV('VNA', 'Server', '10.70.1.10'), INV('Workstation 1', 'Workstation', 'WS-ESP-01')], [[1022, 'Allarme spazio disco archivio', 'aperta']])],
      contacts: [['Giorgio Pase', 'Direzione tecnica', '0434 551 200', 'g.pase@esperia.it', true, 0]], contracts: [['Assistenza VNA', '31/03/2027', 134]], drive: 2, vpn: null },
    { code: '005', dn: 'Poliambulatorio Manzano', name: 'Poliambulatorio Manzano', ven: 'Biotron', city: 'Manzano', prov: 'UD', addr: 'Via Roma 12', vat: '', tax: '', notes: 'Anagrafica da completare: manca la P.IVA.',
      sites: [SITE('Poliambulatorio Manzano', '', 'Via Roma 12', 'Manzano', '', 'UD', [INV('Ecografo', 'Modalità', '10.80.1.5')])], contacts: [], contracts: [], drive: 0, vpn: null },
  ]
  CUST.forEach((c, ci) => { c.id = ci; c.inv = c.sites.flatMap((s, si) => s.inv.map((x, k) => ({ ...x, si, k }))); c.iss = c.sites.flatMap((s, si) => s.iss.map(([n, t, st]) => ({ n, t, st, si }))) })
  const SITES = CUST.flatMap((c) => c.sites.map((s, si) => ({ ci: c.id, si })))
  const CONTACTS = CUST.flatMap((c) => c.contacts.map((_, ki) => ({ ci: c.id, ki })))
  const ACT = {
    customer: [['alert', 'Federico Mutuale ha preso in carico', '#1041 Worklist vuota sulla modalità CT 2', 'oggi 09:12'], ['server', "Nicole Spazzoli ha aggiornato l'inventario", 'CT 2 · Siemens SOMATOM', 'ieri 17:40'], ['lock', 'Anna Ferri ha modificato', "l'accesso remoto", '12/11']],
    site: [['server', "Nicole Spazzoli ha aggiornato l'inventario", 'CT 2 · Siemens SOMATOM', 'ieri 17:40'], ['users', 'Anna Ferri ha aggiunto il contatto', 'Paolo Rinaldi', '10/11']],
    contact: [['users', 'Anna Ferri ha modificato il telefono di', 'questo contatto', '10/11'], ['plus', 'Federico Mutuale ha creato', 'il contatto', '02/03/2024']],
  }

  // ── Accessori ───────────────────────────────────────────────────
  const C = (ci) => CUST[ci]
  const siteOf = (r) => C(r.ci).sites[r.si]
  const contactOf = (r) => { const [name, dep, phone, email, prim, si] = C(r.ci).contacts[r.ki]; return { name, dep, phone, email, prim, si } }
  const contactsAt = (ci, si) => C(ci).contacts.map((_, ki) => ({ ci, ki })).filter((r) => contactOf(r).si === si)
  const siteName = (ci, si) => (si == null ? 'Sede del cliente' : C(ci).sites[si].name)

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  let page = qs.get('pagina') || (() => { try { return localStorage.getItem('archie-preview-core-p') || 'clienti' } catch { return 'clienti' } })()
  let stack = []        // record aperti: [{ kind: 'customer'|'site'|'contact'|'inv', ci, si?, ki?, ii? }]
  let invType = 'Tutti'; let showAllInv = false; let pwShown = false
  const drafts = new Map()   // modifiche locali per record
  const root = $('[data-core]')
  const key = (r) => `${r.kind}:${r.ci}:${r.si ?? ''}:${r.ki ?? ''}`
  const FIELDS = {
    customer: (r) => { const c = C(r.ci); return { name: c.name, dn: c.dn, ven: c.ven, vat: c.vat, tax: c.tax, prov: c.prov, notes: c.notes } },
    site: (r) => { const s = siteOf(r); return { name: s.name, dn: s.dn, st: s.st, street: s.street, cap: s.cap, city: s.city, prov: s.prov, notes: s.notes } },
    contact: (r) => { const k = contactOf(r); return { name: k.name, dep: k.dep, phone: k.phone, email: k.email, prim: k.prim ? '1' : '', si: k.si == null ? '' : String(k.si), notes: '' } },
  }
  const draft = (r) => { if (!FIELDS[r.kind]) return null; const k = key(r); if (!drafts.has(k)) drafts.set(k, FIELDS[r.kind](r)); return drafts.get(k) }
  const changes = (r) => { const d = r && draft(r); if (!d) return []; const o = FIELDS[r.kind](r); return Object.keys(o).filter((f) => d[f] !== o[f]) }
  const top = () => stack.at(-1)
  const dirty = (f) => { const r = top(); return draft(r)[f] !== FIELDS[r.kind](r)[f] ? ' dirty' : '' }
  const saveRecord = (r) => {
    const d = draft(r)
    if (r.kind === 'customer') Object.assign(C(r.ci), d)
    if (r.kind === 'site') Object.assign(siteOf(r), d)
    if (r.kind === 'contact') C(r.ci).contacts[r.ki] = [d.name, d.dep, d.phone, d.email, Boolean(d.prim), d.si === '' ? null : Number(d.si)]
    drafts.delete(key(r))
  }

  // ═══ Pezzi comuni ═══════════════════════════════════════════════
  const sec = (id, title, hint, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${hint ? `<p>${hint}</p>` : ''}${end}</div>${body}</section>`
  const crumb = () => stack.length > 1 ? `<nav class="crumbs-rec" aria-label="Percorso">${stack.slice(0, -1).map((r, i) => `${i ? '<span>/</span>' : ''}<button type="button" data-back="${i + 1}">${i ? '' : ic('chevL')}${esc(label(r))}</button>`).join('')}</nav>` : ''
  const label = (r) => r.kind === 'customer' ? C(r.ci).dn : r.kind === 'site' ? (siteOf(r).dn || siteOf(r).name) : r.kind === 'contact' ? contactOf(r).name : C(r.ci).inv[r.ii].name
  const list = () => (page === 'clienti' ? CUST.map((c) => ({ kind: 'customer', ci: c.id })) : page === 'siti' ? SITES.map((s) => ({ kind: 'site', ...s })) : CONTACTS.map((k) => ({ kind: 'contact', ...k })))
  const nav = () => {
    if (stack.length > 1) return ''
    const L = list(); const i = L.findIndex((r) => key(r) === key(stack[0]))
    return `<span class="rec-pos">${i + 1} di ${L.length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Successivo">${ic('chevR')}</button>`
  }
  const head = ({ tile, title, chip = '', sub, stats = '', actions }) => `<header class="rec-head light">${crumb()}<div class="rec-id">
      ${tile.includes('tile') ? '' : tile}<div class="rec-t"><h2>${title}${chip}</h2><p>${sub}</p>${stats ? `<div class="rec-tags">${stats}</div>` : ''}</div>
      <div class="rec-act">${nav()}${actions}<button class="icon-btn on-band" type="button" aria-label="Altre azioni" title="Modifica tutti i campi, copia, elimina">${ic('more')}</button></div>
    </div></header>`
  const stat = (k, n, txt, warn = '') => `<button type="button" class="stat${warn ? ' warn' : ''}" data-goto="${k}"${warn ? ` title="${esc(warn)}"` : ''}><b>${n}</b> ${txt}</button>`
  const solid = (icon, txt) => `<button class="btn on-band solid" type="button">${icon}${txt}</button>`
  const outlineB = (icon, txt, title = '') => `<button class="btn on-band" type="button"${title ? ` title="${esc(title)}"` : ''}>${icon}${txt}</button>`

  const siteRows = (ci, sis) => `<div class="rows">${sis.map((si) => { const s = C(ci).sites[si]; const ref = contactsAt(ci, si)[0]; return `<button type="button" class="row r-site" data-open-site="${ci}:${si}">
      <span class="t"><b>${esc(s.name)}</b><small>${esc(s.street)}, ${esc(s.city)}${ref ? ` · ${esc(contactOf(ref).name)}` : ''}</small></span>
      ${s.iss.length ? `<span class="pill-iss">${pl(s.iss.length, 'issue', 'issue')}</span>` : s.st !== 'Attivo' ? `<span class="st ${SITE_ST[s.st]}">${s.st}</span>` : '<span></span>'}
      <span class="n">${pl(s.inv.length, 'inventario', 'inventari')}</span>${go}</button>` }).join('')}</div>`
  const TYPES = ['Tutti', 'Server', 'Modalità', 'Workstation', 'Rete']
  const invBlock = (ci, si = null) => {
    const base = C(ci).inv.filter((x) => si == null || x.si === si)
    const all = base.filter((x) => invType === 'Tutti' || x.type === invType)
    const shown = showAllInv ? all : all.slice(0, 6)
    return `<section class="rec-sec" id="sec-inv"><div class="rec-sh"><h3>Inventari${muted(base.length)}</h3>
      ${base.length > 3 ? `<span class="typefilter" role="group" aria-label="Tipo">${TYPES.map((t) => `<button type="button" aria-pressed="${t === invType}" data-type="${t}">${t}</button>`).join('')}</span>` : '<button class="lnk" type="button" style="margin-left:auto">+ Nuovo inventario</button>'}</div>
      ${shown.length ? `<div class="rows">${shown.map((x) => `<button type="button" class="row r-inv" data-open-inv="${ci}:${C(ci).inv.indexOf(x)}"><span class="ttag ${x.type}">${x.type}</span><span class="t"><b>${esc(x.name)}</b></span><span class="host">${esc(x.host)}</span><span class="n">${si == null ? esc(C(ci).sites[x.si].dn || C(ci).sites[x.si].name) : ''}</span>${go}</button>`).join('')}</div>` : '<p class="empty-s">Nessun inventario.</p>'}
      ${all.length > 6 ? `<div class="more-row"><button class="lnk" type="button" data-allinv>${showAllInv ? 'Mostra meno' : `Mostra tutti i ${all.length}`}</button></div>` : ''}</section>`
  }
  const issRows = (ci, items) => items.length ? `<div class="rows">${items.map((x) => `<button type="button" class="row r-iss"><span class="iss-n">#${x.n}</span><span class="t"><b>${esc(x.t)}</b><small>${esc(C(ci).sites[x.si].name)}</small></span><span class="st ${x.st}">${x.st === 'lav' ? 'In lavorazione' : 'Aperta'}</span>${go}</button>`).join('')}</div>` : '<p class="empty-s">Nessuna issue aperta.</p>'
  const contactRows = (refs, { showSite = true, compact = false } = {}) => refs.length ? `<div class="${compact ? 'refs' : 'rows'}">${refs.map((r) => { const k = contactOf(r); return compact
      ? `<div class="ref"><span class="uav">${ini(k.name)}</span><button type="button" class="t lnk-t" data-open-contact="${r.ci}:${r.ki}"><b>${esc(k.name)}${k.prim ? '<span class="prim">primario</span>' : ''}</b><small>${esc(k.dep)}${showSite ? ` · ${esc(siteName(r.ci, k.si))}` : ''}</small></button><span class="acts"><button class="icon-btn" type="button" aria-label="Chiama ${esc(k.name)}" title="${esc(k.phone)}">${PHONE}</button>${k.email ? `<button class="icon-btn" type="button" aria-label="Scrivi a ${esc(k.name)}" title="${esc(k.email)}">${MAIL}</button>` : ''}</span></div>`
      : `<button type="button" class="row r-con" data-open-contact="${r.ci}:${r.ki}"><span class="uav">${ini(k.name)}</span><span class="t"><b>${esc(k.name)}${k.prim ? ' <span class="prim">primario</span>' : ''}</b><small>${esc(k.dep)}${showSite ? ` · ${esc(siteName(r.ci, k.si))}` : ''}</small></span><span class="n">${esc(k.phone)}</span>${go}</button>` }).join('')}</div>` : '<p class="empty-s">Nessun contatto.</p>'
  const docRows = (c) => `<div class="rows">${c.contracts.map(([t, d, n]) => `<button type="button" class="row r-doc"><span class="doc-ic">${ic('receipt')}</span><span class="t"><b>${esc(t)}</b><small>Contratto · scade il ${d}</small></span><span class="st ${n <= 60 ? 'warn' : 'ok'}">${n <= 60 ? `tra ${n} giorni` : 'attivo'}</span>${go}</button>`).join('')}
      ${c.drive ? `<button type="button" class="row r-doc"><span class="doc-ic">${ic('folder')}</span><span class="t"><b>Cartella nel Drive</b><small>${pl(c.drive, 'file', 'file')} · ultimo caricato il 05/11</small></span><span></span>${go}</button>` : ''}</div>
      ${!c.contracts.length && !c.drive ? '<p class="empty-s">Nessun contratto né documento.</p>' : ''}`
  const feed = (kind) => `<section class="rcard"><h3>Attività recente</h3><ul class="mini-feed">${ACT[kind].map(([i, t, o, w]) => `<li>${ic(i)}<span>${t} <a href="#">${o}</a></span><time>${w}</time></li>`).join('')}</ul><a class="lnk" href="#">Tutta l'attività nell'Audit</a></section>`
  const mapCard = (street, place) => `<section class="rcard"><h3>Dove</h3><div class="map" aria-hidden="true"><span class="pin">${ic('pin')}</span></div><p class="addr"><b>${esc(street)}</b><small>${esc(place)} · <a href="#">Apri nelle mappe</a></small></p></section>`
  const notesCard = (d) => `<section class="rcard"><h3>Note</h3><textarea class="notes${dirty('notes')}" data-f="notes" placeholder="Note interne" aria-label="Note">${esc(d.notes)}</textarea></section>`
  const inp = (f, labelTxt, d, { mono = false, ph = '', miss = false, max = '' } = {}) => `<label class="f"><span>${labelTxt}${miss && !d[f] ? ' <em>manca</em>' : ''}</span><input data-f="${f}" value="${esc(d[f])}"${ph ? ` placeholder="${ph}"` : ''}${max ? ` maxlength="${max}"` : ''} class="${mono ? 'mono' : ''}${miss && !d[f] ? ' miss' : ''}${dirty(f)}"></label>`
  const ro = (labelTxt, val, link = '') => `<div class="f"><span>${labelTxt}</span>${link ? `<button type="button" class="ro ro-link" ${link}>${val}${ic('arrowR')}</button>` : `<span class="ro">${val}</span>`}</div>`

  // ═══ Cliente ═══════════════════════════════════════════════════
  const customerRec = (r) => {
    const c = C(r.ci); const d = draft(r); const soon = c.contracts.filter((x) => x[2] <= 60)
    const allContacts = c.contacts.map((_, ki) => ({ ci: c.id, ki }))
    return head({
      tile: `<span class="rec-ava tile" aria-hidden="true">${c.code}</span>`,
      title: esc(d.dn), chip: `<span class="ven-b"><i style="background:${VEN[d.ven]}"></i>${d.ven}</span>`,
      sub: `<span class="code" style="color:inherit">${c.code}</span> · ${esc(d.name)} · ${c.city} (${d.prov || '—'}) · ${d.vat ? `P.IVA <span class="code" style="color:inherit">${d.vat}</span>` : 'P.IVA mancante'}`,
      stats: stat('sites', c.sites.length, c.sites.length === 1 ? 'sito' : 'siti') + stat('inv', c.inv.length, c.inv.length === 1 ? 'inventario' : 'inventari') + stat('iss', c.iss.length, c.iss.length === 1 ? 'issue aperta' : 'issue aperte') + stat('doc', c.contracts.length, c.contracts.length === 1 ? 'contratto' : 'contratti', soon.length ? `${soon[0][0]} scade il ${soon[0][1]}` : '') .replace(/<\/button>$/, soon.length ? ` · scade tra ${soon[0][2]} gg</button>` : '</button>'),
      actions: solid(ic('plus'), 'Nuova issue'),
    }) + `<div class="rec-body"><div class="rec-main">
        ${sec('iss', `Issue aperte${muted(c.iss.length)}`, '', issRows(c.id, c.iss), '<button class="lnk" type="button">+ Nuova issue</button>')}
        ${sec('sites', `Siti${muted(c.sites.length)}`, '', siteRows(c.id, c.sites.map((_, i) => i)), '<button class="lnk" type="button">+ Nuovo sito</button>')}
        ${invBlock(c.id)}
        ${sec('doc', 'Contratti e documenti', '', docRows(c))}
      </div><aside class="rec-rail" aria-label="Cliente">
        <section class="rcard"><h3>Anagrafica</h3><div class="cka">
          ${inp('name', 'Ragione sociale', d)}${inp('dn', 'Nome breve <small style="font-weight:400;color:var(--faint)">come compare negli elenchi</small>', d)}
          <div class="two"><label class="f"><span>Vendor</span><span class="vsel"><i style="background:${VEN[d.ven]}"></i><select data-f="ven" class="${dirty('ven')}">${Object.keys(VEN).map((v) => `<option${v === d.ven ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label>${ro('Codice', `<span class="code">${c.code}</span>`)}</div>
          ${inp('vat', 'P.IVA', d, { mono: true, ph: '11 cifre', miss: true })}${inp('tax', 'Codice fiscale', d, { mono: true })}
          <div class="two">${ro('Città', c.city)}${inp('prov', 'Provincia', d, { max: 2 })}</div>
        </div></section>
        <section class="rcard"><div class="hd"><h3>Referenti${muted(allContacts.length)}</h3><button class="lnk" type="button">+ Contatto</button></div>${contactRows(allContacts, { compact: true })}</section>
        <section class="rcard"><div class="hd"><h3>${ic('lock')}Accesso remoto</h3>${c.vpn ? `<span class="app-tag">${c.vpn.app}</span><button class="lnk" type="button">Modifica</button>` : ''}</div>
          ${c.vpn ? `<div class="cred">
            <div><span>Indirizzo</span><span class="v">${c.vpn.host}<span style="color:var(--muted)">:${c.vpn.port}</span></span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia l'indirizzo">${ic('copy')}</button></span></div>
            <div><span>Utenza</span><span class="v">${c.vpn.user}</span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia l'utenza">${ic('copy')}</button></span></div>
            <div><span>Password</span><span class="v pw${pwShown ? ' on' : ''}">${pwShown ? c.vpn.pw : '••••••••'}</span><span class="acts"><button class="icon-btn" type="button" data-pw aria-pressed="${pwShown}" aria-label="${pwShown ? 'Nascondi' : 'Mostra'} la password" title="${pwShown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}">${ic(pwShown ? 'eyeOff' : 'eye')}</button><button class="icon-btn cp" type="button" aria-label="Copia la password">${ic('copy')}</button></span></div>
          </div>` : '<p class="empty-s">Nessun accesso remoto. <button class="lnk" type="button">Registra VPN e credenziali</button></p>'}</section>
        ${mapCard(c.addr, `${c.city} (${c.prov})`)}${notesCard(d)}${feed('customer')}
      </aside></div>`
  }

  // ═══ Sito ═════════════════════════════════════════════════════
  const siteRec = (r) => {
    const c = C(r.ci); const s = siteOf(r); const d = draft(r); const cons = contactsAt(r.ci, r.si); const iss = c.iss.filter((x) => x.si === r.si)
    return head({
      tile: `<span class="rec-ava tile" aria-hidden="true">${ic('pin')}</span>`,
      title: esc(d.name), chip: d.st !== 'Attivo' ? `<span class="ven-b">${d.st}</span>` : '',
      sub: `Sito di <button type="button" class="band-link" data-open-customer="${r.ci}">${esc(c.dn)}</button> · ${esc(d.street)}, ${esc(d.city)}${d.prov ? ` (${esc(d.prov)})` : ''}`,
      stats: stat('inv', s.inv.length, s.inv.length === 1 ? 'inventario' : 'inventari') + stat('iss', iss.length, iss.length === 1 ? 'issue aperta' : 'issue aperte') + stat('con', cons.length, cons.length === 1 ? 'contatto' : 'contatti'),
      actions: solid(ic('plus'), 'Nuova issue'),
    }) + `<div class="rec-body"><div class="rec-main">
        ${sec('iss', `Issue aperte${muted(iss.length)}`, '', issRows(r.ci, iss), '<button class="lnk" type="button">+ Nuova issue</button>')}
        ${invBlock(r.ci, r.si)}
        ${sec('con', `Contatti del sito${muted(cons.length)}`, '', contactRows(cons, { showSite: false }), '<button class="lnk" type="button">+ Contatto</button>')}
      </div><aside class="rec-rail" aria-label="Sito">
        <section class="rcard"><h3>Anagrafica</h3><div class="cka">
          ${inp('name', 'Nome', d)}${inp('dn', 'Nome breve <small style="font-weight:400;color:var(--faint)">come compare negli elenchi</small>', d, { ph: d.name })}
          <div class="two">${ro('Cliente', esc(c.dn), `data-open-customer="${r.ci}"`)}<label class="f"><span>Stato</span><span class="vsel"><i class="st-dot ${SITE_ST[d.st]}"></i><select data-f="st" class="${dirty('st')}">${Object.keys(SITE_ST).map((v) => `<option${v === d.st ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label></div>
          ${inp('street', 'Indirizzo', d)}
          <div class="three">${inp('cap', 'CAP', d, { mono: true, max: 5 })}${inp('city', 'Città', d)}${inp('prov', 'Prov.', d, { max: 2 })}</div>
        </div></section>
        ${mapCard(`${d.street}`, `${d.cap} ${d.city} (${d.prov})`)}${notesCard(d)}${feed('site')}
      </aside></div>`
  }

  // ═══ Contatto ═════════════════════════════════════════════════
  const contactRec = (r) => {
    const c = C(r.ci); const k = contactOf(r); const d = draft(r)
    const si = d.si === '' ? null : Number(d.si)
    const mates = (si == null ? c.contacts.map((_, ki) => ({ ci: r.ci, ki })).filter((x) => contactOf(x).si == null) : contactsAt(r.ci, si)).filter((x) => x.ki !== r.ki)
    return head({
      tile: `<span class="rec-ava" aria-hidden="true">${ini(d.name)}</span>`,
      title: esc(d.name), chip: d.prim ? '<span class="ven-b">Contatto primario</span>' : '',
      sub: `${esc(d.dep || 'Reparto non indicato')} · <button type="button" class="band-link" data-open-customer="${r.ci}">${esc(c.dn)}</button>${si != null ? ` · <button type="button" class="band-link" data-open-site="${r.ci}:${si}">${esc(C(r.ci).sites[si].dn || C(r.ci).sites[si].name)}</button>` : ''}`,
      actions: solid(PHONE, 'Chiama') + (d.email ? outlineB(MAIL, 'Scrivi', d.email) : ''),
    }) + `<div class="rec-body"><div class="rec-main">
        ${sec('rec', 'Recapiti', '', `<div class="reach">
          <div class="rc"><span class="rc-ic">${PHONE}</span><span class="t"><small>Telefono</small><b class="code">${esc(d.phone) || '—'}</b></span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia il telefono">${ic('copy')}</button></span></div>
          <div class="rc"><span class="rc-ic">${MAIL}</span><span class="t"><small>Email</small><b>${esc(d.email) || '<span style="color:var(--muted);font-weight:400">non indicata</span>'}</b></span><span class="acts">${d.email ? `<button class="icon-btn cp" type="button" aria-label="Copia l'email">${ic('copy')}</button>` : ''}</span></div>
        </div>`)}
        ${sec('dove', 'Dove lavora', '', `<div class="rows">
          <button type="button" class="row r-doc" data-open-customer="${r.ci}"><span class="doc-ic">${ic('building')}</span><span class="t"><b>${esc(c.dn)}</b><small>Cliente · ${esc(c.name)}</small></span><span></span>${go}</button>
          ${si != null ? `<button type="button" class="row r-doc" data-open-site="${r.ci}:${si}"><span class="doc-ic">${ic('pin')}</span><span class="t"><b>${esc(C(r.ci).sites[si].name)}</b><small>Sito · ${esc(C(r.ci).sites[si].street)}, ${esc(C(r.ci).sites[si].city)}</small></span><span class="n">${pl(C(r.ci).sites[si].inv.length, 'inventario', 'inventari')}</span>${go}</button>` : '<p class="empty-s">Lavora nella sede del cliente, non su un sito.</p>'}
        </div>`)}
        ${sec('mates', `${si == null ? 'Altri contatti della sede' : 'Altri contatti dello stesso sito'}${muted(mates.length)}`, '', contactRows(mates, { showSite: false }))}
      </div><aside class="rec-rail" aria-label="Contatto">
        <section class="rcard"><h3>Anagrafica</h3><div class="cka">
          ${inp('name', 'Nome e cognome', d)}${inp('dep', 'Reparto e ruolo', d, { ph: 'es. Radiologia · TSRM' })}
          ${inp('phone', 'Telefono', d, { mono: true })}${inp('email', 'Email', d)}
          <div class="two">${ro('Cliente', esc(c.dn), `data-open-customer="${r.ci}"`)}<label class="f"><span>Sito</span><span class="vsel plain"><select data-f="si" class="${dirty('si')}"><option value="">Sede del cliente</option>${c.sites.map((s, i) => `<option value="${i}"${String(i) === d.si ? ' selected' : ''}>${esc(s.dn || s.name)}</option>`).join('')}</select></span></label></div>
          <label class="tg"><span><b>Contatto primario</b><small>Compare per primo nel cliente e nelle email</small></span><button type="button" role="switch" aria-checked="${Boolean(d.prim)}" class="sw3${d.prim ? ' on' : ''}" data-prim aria-label="Contatto primario"><i></i></button></label>
        </div></section>
        ${notesCard(d)}${feed('contact')}
      </aside></div>`
  }

  // ═══ Inventario (abbozzo: la finestra vera arriva con la pagina Inventari) ═══
  const invRec = (r) => {
    const c = C(r.ci); const x = c.inv[r.ii]; const s = c.sites[x.si]
    return head({
      tile: `<span class="rec-ava tile" aria-hidden="true">${ic('server')}</span>`,
      title: esc(x.name), chip: `<span class="ven-b">${x.type}</span>`,
      sub: `<span class="code" style="color:inherit">${esc(x.host)}</span> · <button type="button" class="band-link" data-open-site="${r.ci}:${x.si}">${esc(s.name)}</button>`,
      actions: solid(ic('plus'), 'Nuova issue'),
    }) + `<div class="rec-body"><div class="rec-main">${sec('cr', `Credenziali`, 'Visibili solo con il permesso Credenziali inventari.', `<div class="cred"><div><span>Host</span><span class="v">${esc(x.host)}</span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia">${ic('copy')}</button></span></div><div><span>Utenza</span><span class="v">service</span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia">${ic('copy')}</button></span></div><div><span>Password</span><span class="v pw">••••••••</span><span class="acts"><button class="icon-btn" type="button" aria-label="Mostra">${ic('eye')}</button></span></div></div>`)}
      <p class="hint" style="margin:0 4px">La finestra completa dell'inventario arriverà con la pagina Inventari: qui si vede solo il passaggio.</p></div>
      <aside class="rec-rail">${mapCard(s.street, `${s.city} (${s.prov})`)}</aside></div>`
  }

  // ═══ Finestra e pagine ═════════════════════════════════════════
  const saveBar = () => { const n = changes(top()).length; return n ? `<div class="savebar" role="status"><span class="dot"></span><b>${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save>Salva le modifiche</button></div>` : '' }
  const recordHtml = () => { const r = top(); return `<div class="record">${r.kind === 'customer' ? customerRec(r) : r.kind === 'site' ? siteRec(r) : r.kind === 'contact' ? contactRec(r) : invRec(r)}${saveBar()}</div>` }

  const TITLE = { clienti: ['Clienti', 'Nuovo cliente'], siti: ['Siti', 'Nuovo sito'], contatti: ['Contatti', 'Nuovo contatto'] }
  const table = () => {
    if (page === 'clienti') return `<table class="po-table c-list"><thead><tr><th>Cliente</th><th>Vendor</th><th>Città</th><th>Siti</th><th>Inventari</th><th>Issue aperte</th></tr></thead><tbody>${CUST.map((c) => `<tr data-row="customer:${c.id}" tabindex="0"><td><b>${c.dn}</b><br><small style="color:var(--muted)">${c.code} · ${c.name}</small></td><td><span class="ven"><i style="background:${VEN[c.ven]}"></i>${c.ven}</span></td><td>${c.city} (${c.prov})</td><td>${c.sites.length}</td><td>${c.inv.length}</td><td>${c.iss.length || '—'}</td></tr>`).join('')}</tbody></table>`
    if (page === 'siti') return `<table class="po-table c-list"><thead><tr><th>Sito</th><th>Cliente</th><th>Città</th><th>Stato</th><th>Inventari</th><th>Issue aperte</th></tr></thead><tbody>${SITES.map(({ ci, si }) => { const s = C(ci).sites[si]; return `<tr data-row="site:${ci}:${si}" tabindex="0"><td><b>${esc(s.name)}</b><br><small style="color:var(--muted)">${esc(s.street)}</small></td><td>${C(ci).dn}</td><td>${s.city} (${s.prov})</td><td><span class="st ${SITE_ST[s.st]}">${s.st}</span></td><td>${s.inv.length}</td><td>${s.iss.length || '—'}</td></tr>` }).join('')}</tbody></table>`
    return `<table class="po-table c-list"><thead><tr><th>Nome</th><th>Reparto</th><th>Cliente</th><th>Sito</th><th>Telefono</th></tr></thead><tbody>${CONTACTS.map((r) => { const k = contactOf(r); return `<tr data-row="contact:${r.ci}:${r.ki}" tabindex="0"><td><b>${esc(k.name)}</b>${k.prim ? ' <span class="prim">primario</span>' : ''}<br><small style="color:var(--muted)">${esc(k.email || '—')}</small></td><td>${esc(k.dep)}</td><td>${C(r.ci).dn}</td><td>${esc(siteName(r.ci, k.si))}</td><td class="code">${esc(k.phone)}</td></tr>` }).join('')}</tbody></table>`
  }
  const view = () => `<div class="mt-head"><h1>${TITLE[page][0]}</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}${TITLE[page][1]}</button></div></div>
    <section class="panel"><div class="table-wrap">${table()}</div></section>
    ${stack.length ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="${esc(label(top()))}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${recordHtml()}</div></div>` : ''}`

  const setNav = () => {
    const name = TITLE[page][0]
    document.querySelectorAll('.nav-item').forEach((a) => { const on = a.textContent.trim().startsWith(name); a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') })
    document.querySelectorAll('[data-corep]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.corep === page)))
  }
  const render = (keepScroll = true) => {
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view(); setNav()
    const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0
  }
  const refresh = () => { const rec = $('.record', root); if (!rec) return; $('.savebar', rec)?.remove(); rec.insertAdjacentHTML('beforeend', saveBar()); const h = $('.rec-head', rec); const tmp = document.createElement('div'); tmp.innerHTML = recordHtml(); h.replaceWith($('.rec-head', tmp)) }
  const leave = () => !top() || !changes(top()).length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const resetView = () => { invType = 'Tutti'; showAllInv = false; pwShown = false }
  const discardTop = () => { if (top()) drafts.delete(key(top())) }
  const openRoot = (r) => { discardTop(); stack = [r]; resetView(); render(false) }
  const push = (r) => { if (!leave()) return; discardTop(); if (key(r) === key(stack[0] || {})) { stack = [r] } else { const i = stack.findIndex((x) => key(x) === key(r)); stack = i >= 0 ? stack.slice(0, i + 1) : [...stack, r] } resetView(); render(false) }
  // Si apre su AUSL Imola, sul suo ospedale principale o su Laura Gentili
  const first = () => (page === 'clienti' ? { kind: 'customer', ci: 1 } : page === 'siti' ? { kind: 'site', ci: 1, si: 0 } : { kind: 'contact', ci: 1, ki: 0 })
  const parse = (v) => v.split(':').map(Number)

  root.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { if (!leave()) return; discardTop(); stack = []; return render() }
    const row = t.closest('tr[data-row]'); if (row) { const [kind, ...n] = row.dataset.row.split(':'); const [ci, a, b] = n.map(Number); return openRoot(kind === 'customer' ? { kind, ci } : kind === 'site' ? { kind, ci, si: a } : { kind, ci, ki: a ?? b }) }
    const step = t.closest('[data-step]'); if (step) { if (!leave()) return; const L = list(); const i = L.findIndex((r) => key(r) === key(stack[0])); return openRoot(L[(i + Number(step.dataset.step) + L.length) % L.length]) }
    const back = t.closest('[data-back]'); if (back) { if (!leave()) return; discardTop(); stack = stack.slice(0, Number(back.dataset.back)); resetView(); return render(false) }
    const oc = t.closest('[data-open-customer]'); if (oc) return push({ kind: 'customer', ci: Number(oc.dataset.openCustomer) })
    const os = t.closest('[data-open-site]'); if (os) { const [ci, si] = parse(os.dataset.openSite); return push({ kind: 'site', ci, si }) }
    const ok = t.closest('[data-open-contact]'); if (ok) { const [ci, ki] = parse(ok.dataset.openContact); return push({ kind: 'contact', ci, ki }) }
    const oi = t.closest('[data-open-inv]'); if (oi) { const [ci, ii] = parse(oi.dataset.openInv); return push({ kind: 'inv', ci, ii }) }
    const g = t.closest('[data-goto]'); if (g) return $(`#sec-${g.dataset.goto}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const ty = t.closest('[data-type]'); if (ty) { invType = ty.dataset.type; showAllInv = false; const r = top(); $('#sec-inv', root).outerHTML = invBlock(r.ci, r.kind === 'site' ? r.si : null); return }
    if (t.closest('[data-allinv]')) { showAllInv = !showAllInv; const r = top(); $('#sec-inv', root).outerHTML = invBlock(r.ci, r.kind === 'site' ? r.si : null); return }
    if (t.closest('[data-pw]')) { pwShown = !pwShown; render(); if (pwShown) setTimeout(() => { pwShown = false; if (stack.length) render() }, 30000); return }
    if (t.closest('[data-prim]')) { const d = draft(top()); d.prim = d.prim ? '' : '1'; return render() }
    const cp = t.closest('.cp'); if (cp) { cp.innerHTML = ic('check'); cp.style.color = 'var(--success)'; setTimeout(() => { cp.innerHTML = ic('copy'); cp.style.color = '' }, 1400); return }
    if (t.closest('[data-discard]')) { discardTop(); return render() }
    if (t.closest('[data-save]')) { saveRecord(top()); return render() }
  })
  const onField = (e) => {
    const f = e.target.dataset.f; if (!f || !top()) return
    const d = draft(top()); d[f] = e.target.value
    e.target.classList.toggle('dirty', d[f] !== FIELDS[top().kind](top())[f])
    if (e.target.tagName === 'SELECT') return render()
    refresh()
  }
  root.addEventListener('input', onField)
  root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') onField(e) })
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-row]')) { e.preventDefault(); e.target.click() } })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !stack.length || !$('[data-palette-bg]')?.hidden) return
    if (!leave()) return
    discardTop(); stack.pop(); resetView(); render(false)   // Esc torna al record precedente, poi chiude
  })
  document.querySelectorAll('[data-corep]').forEach((b) => b.addEventListener('click', () => {
    if (!leave()) return
    page = b.dataset.corep; try { localStorage.setItem('archie-preview-core-p', page) } catch { /* niente */ }
    openRoot(first())
  }))

  if (qs.get('chiuso')) render(); else openRoot(first())
})()
