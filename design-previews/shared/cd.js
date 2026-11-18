/* Clienti senza drawer (anteprima): il cliente si apre nella finestra dei record (RecordModal),
   come utente e gruppo. Due impaginazioni del corpo:
   A · Tutto in vista: niente schede; al centro siti, inventari, issue aperte e documenti, a lato
       anagrafica modificabile, referenti, accesso remoto, dove e note, attività.
   B · Sezioni: la colonna a lato resta uguale; al centro Panoramica · Siti · Inventari · Documenti · Attività.
   In entrambe un sito o un inventario si apre nella stessa finestra, con «‹ AUSL Imola» per tornare.
   L'anagrafica si salva con la barra «N modifiche da salvare» (oggi si salva campo per campo).
   Dati finti modellati su /api/customers/. Oggi: 17/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n)
  const $ = (s, r = document) => r.querySelector(s)
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()
  const svg = (d, w = 1.75) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`
  const PHONE = svg('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z')
  const MAIL = svg('M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 6.5 12 13l8.5-6.5')

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Clienti')
    a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current')
  })

  // ═══ Dati ═══════════════════════════════════════════════════════
  const VEN = { Philips: '#3f7fbf', Biotron: '#2e8b6e', 'Medical Imaging': '#b4673a' }
  const INV = (name, type, host, extra = {}) => ({ name, type, host, ...extra })
  const S = (name, addr, inv, con = [], iss = []) => ({ name, addr, inv, con, iss })
  const IMOLA = [
    S('Ospedale S. Maria della Scaletta', 'Via Montericco 4, Imola', [INV('PACS · nodo principale', 'Server', '10.40.12.10'), INV('RIS · application server', 'Server', '10.40.12.21'), INV('CT 2 · Siemens SOMATOM', 'Modalità', '10.40.30.42'), INV('Workstation refertazione 3', 'Workstation', 'WS-RAD-03')],
      [['Laura Gentili', 'Radiologia · coordinatrice tecnica', '0542 662 410']], [[1041, 'Worklist vuota sulla modalità CT 2', 'lav'], [1038, 'Lentezza apertura studi dal PACS', 'aperta']]),
    S('Ospedale Vecchio · Poliambulatorio', 'Via Caterina Sforza 3, Imola', [INV('Ecografo Philips EPIQ 7', 'Modalità', '10.40.51.12'), INV('Workstation ambulatorio 1', 'Workstation', 'WS-AMB-01')], [['Sara Golinelli', 'Poliambulatorio · referente', '0542 604 220']]),
    S('Casa della Salute Castel San Pietro', 'Viale Oriani 1, Castel San Pietro Terme', [INV('Mammografo Hologic', 'Modalità', '10.41.10.8'), INV('Router VPN sede', 'Rete', '10.41.0.1')], [['Marco Cavina', 'Radiologia', '051 6955 310']]),
    S('Casa della Salute Medicina', 'Via Saffi 1, Medicina', [INV('Telecomandato DR', 'Modalità', '10.42.10.5')]),
    S('Ospedale di Castel San Pietro', 'Viale Oriani 1, Castel San Pietro Terme', [INV('CR Fuji', 'Modalità', '10.41.20.3'), INV('Stampante film Agfa', 'Periferica', '10.41.20.9')]),
    S('Data center aziendale', 'Via Amendola 8, Imola', [INV('VNA · storage primario', 'Server', '10.40.1.30'), INV('Backup NAS', 'Server', '10.40.1.31'), INV('Firewall perimetrale', 'Rete', '10.40.0.1')], [['Davide Pirazzoli', 'Sistemi informativi', '0542 662 118']]),
  ]
  const auto = (dn, n, k) => Array.from({ length: n }, (_, i) => S(i ? `Sede ${i + 1}` : `${dn} · sede principale`, '', Array.from({ length: k }, (_, j) => INV(['PACS', 'RIS', 'Workstation', 'Modalità CT', 'Router VPN'][j % 5], ['Server', 'Server', 'Workstation', 'Modalità', 'Rete'][j % 5], `10.6${n}.${i + 1}.${10 + j}`))))
  const C = [
    { id: 1, code: '001', dn: 'AUSL Bologna', name: 'Azienda USL di Bologna', ven: 'Philips', city: 'Bologna', prov: 'BO', addr: 'Via Castiglione 29', vat: '02406911202', tax: '02406911202', site: auto('AUSL Bologna', 4, 3), contracts: [['Manutenzione PACS 2025–2026', '31/12/2026', 44]], drive: 4, vpn: null, notes: '' },
    { id: 2, code: '002', dn: 'AUSL Imola', name: 'Azienda USL di Imola', ven: 'Philips', city: 'Imola', prov: 'BO', addr: 'Viale Amendola 2', vat: '00705271203', tax: '90000900374', site: IMOLA,
      contacts: [['Laura Gentili', 'Radiologia · coordinatrice tecnica', '0542 662 410', 'l.gentili@ausl.imola.bo.it', true], ['Davide Pirazzoli', 'Sistemi informativi · Data center', '0542 662 118', 'd.pirazzoli@ausl.imola.bo.it'], ['Sara Golinelli', 'Poliambulatorio', '0542 604 220', ''], ['Marco Cavina', 'Radiologia · Castel San Pietro', '051 6955 310', '']],
      contracts: [['Manutenzione full risk PACS/RIS', '15/01/2027', 59], ['Assistenza CT 2 Siemens', '30/06/2027', 225]], drive: 3,
      vpn: { app: 'FortiClient', host: 'vpn.ausl.imola.bo.it', port: '10443', user: 'biotron.ext', pw: 'Imola-Vpn!2026' },
      notes: 'Accesso al data center solo accompagnati da Pirazzoli. Finestra di manutenzione concordata: martedì 7–9.' },
    { id: 3, code: '003', dn: 'Centro Medico Esperia', name: 'Centro Medico Esperia S.r.l.', ven: 'Biotron', city: 'Pordenone', prov: 'PN', addr: 'Via Montereale 24', vat: '01784560937', tax: '', site: auto('Esperia', 2, 2), contracts: [['Assistenza VNA', '31/03/2027', 134]], drive: 2, vpn: null, notes: '' },
    { id: 4, code: '004', dn: 'IRCCS Rizzoli', name: 'Istituto Ortopedico Rizzoli', ven: 'Biotron', city: 'Bologna', prov: 'BO', addr: 'Via di Barbiano 1/10', vat: '00302030374', tax: '80022410376', site: auto('Rizzoli', 3, 4), contracts: [['Teleradiologia notturna', '31/08/2027', 287]], drive: 3, vpn: null, notes: '' },
    { id: 5, code: '005', dn: 'Poliambulatorio Manzano', name: 'Poliambulatorio Manzano', ven: 'Biotron', city: 'Manzano', prov: 'UD', addr: 'Via Roma 12', vat: '', tax: '', site: auto('Manzano', 1, 2), contracts: [], drive: 0, vpn: null, notes: 'Anagrafica da completare: manca la P.IVA.' },
    { id: 6, code: '006', dn: 'AUSL Ferrara', name: 'Azienda USL di Ferrara', ven: 'Philips', city: 'Ferrara', prov: 'FE', addr: 'Via Cassoli 30', vat: '01295960387', tax: '01295960387', site: auto('AUSL Ferrara', 5, 3), contracts: [['Canone RIS', '20/12/2026', 33]], drive: 5, vpn: null, notes: '' },
  ]
  C.forEach((c) => { c.contacts = c.contacts || []; c.inv = c.site.flatMap((s, si) => s.inv.map((x) => ({ ...x, si }))); c.iss = c.site.flatMap((s, si) => s.iss.map(([n, t, st]) => ({ n, t, st, si }))) })
  const ACT = [['alert', 'Federico Mutuale ha preso in carico', '#1041 Worklist vuota sulla modalità CT 2', 'oggi 09:12'], ['server', "Nicole Spazzoli ha aggiornato l'inventario", 'CT 2 · Siemens SOMATOM', 'ieri 17:40'], ['lock', 'Anna Ferri ha modificato', "l'accesso remoto", '12/11'], ['file', 'Sara De Paola ha caricato', 'Contratto full risk 2027.pdf', '05/11']]

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search)
  let variant = qs.get('variante') || (() => { try { return localStorage.getItem('archie-preview-cd-v') || 'a' } catch { return 'a' } })()
  let current = Number(qs.get('cliente') || 2)
  let stack = []           // record collegati aperti sopra il cliente: { kind: 'site'|'inv', si, ii }
  let sec = 'ov'           // B: sezione del corpo
  let invType = 'Tutti'
  let showAllInv = false
  let pwShown = false
  let draft = null
  const root = $('[data-cd]')
  const cust = () => C.find((x) => x.id === current)
  const load = () => { const c = cust(); draft = { name: c.name, dn: c.dn, ven: c.ven, vat: c.vat, tax: c.tax, prov: c.prov, notes: c.notes } }
  const changes = () => { if (!draft) return []; const c = cust(); return ['name', 'dn', 'ven', 'vat', 'tax', 'prov', 'notes'].filter((k) => draft[k] !== c[k]) }

  // ═══ Testata ═══════════════════════════════════════════════════
  const stats = (c) => {
    const soon = c.contracts.filter((x) => x[2] <= 60)
    return `<div class="rec-tags">
      <button type="button" class="stat" data-goto="sites"><b>${c.site.length}</b> siti</button>
      <button type="button" class="stat" data-goto="inv"><b>${c.inv.length}</b> inventari</button>
      <button type="button" class="stat" data-goto="iss"><b>${c.iss.length}</b> issue aperte</button>
      <button type="button" class="stat${soon.length ? ' warn' : ''}" data-goto="doc"${soon.length ? ` title="${esc(soon[0][0])} scade il ${soon[0][1]}"` : ''}><b>${c.contracts.length}</b> ${c.contracts.length === 1 ? 'contratto' : 'contratti'}${soon.length ? ` · scade tra ${soon[0][2]} gg` : ''}</button>
    </div>`
  }
  const nav = () => { const i = C.findIndex((x) => x.id === current); return `<span class="rec-pos">${i + 1} di ${C.length}</span><button class="icon-btn on-band" type="button" data-step="-1" aria-label="Cliente precedente">${ic('chevL')}</button><button class="icon-btn on-band" type="button" data-step="1" aria-label="Cliente successivo">${ic('chevR')}</button>` }
  const headCustomer = (c) => `<header class="rec-head"><div class="rec-id">
      <span class="rec-ava tile" aria-hidden="true">${c.code}</span>
      <div class="rec-t">
        <h2>${esc(draft.dn || c.dn)}<span class="ven-b"><i style="background:${VEN[draft.ven]}"></i>${draft.ven}</span></h2>
        <p>${esc(draft.name)} · ${c.city} (${draft.prov || '—'}) · ${draft.vat ? `P.IVA <span class="code" style="color:inherit">${draft.vat}</span>` : 'P.IVA mancante'}</p>
        ${stats(c)}
      </div>
      <div class="rec-act">${nav()}<button class="btn on-band solid" type="button">${ic('plus')}Nuova issue</button><button class="icon-btn on-band" type="button" aria-label="Altre azioni" title="Modifica tutti i campi, copia codice, elimina">${ic('more')}</button></div>
    </div></header>`
  const crumb = (c) => `<nav class="crumbs-rec" aria-label="Percorso"><button type="button" data-back="0">${ic('chevL')}${esc(c.dn)}</button>${stack.slice(0, -1).map((s, i) => `<span>/</span><button type="button" data-back="${i + 1}">${esc(s.kind === 'site' ? c.site[s.si].name : c.inv[s.ii].name)}</button>`).join('')}</nav>`

  // ═══ Blocchi del corpo ═════════════════════════════════════════
  const siteRows = (c, list = c.site.map((s, si) => [s, si])) => `<div class="rows">${list.map(([s, si]) => `<button type="button" class="row r-site" data-site="${si}">
      <span class="t"><b>${esc(s.name)}</b><small>${esc(s.addr || c.city)}${s.con[0] ? ` · ${esc(s.con[0][0])}` : ''}</small></span>
      ${s.iss.length ? `<span class="pill-iss">${s.iss.length} issue</span>` : '<span></span>'}
      <span class="n">${s.inv.length} ${s.inv.length === 1 ? 'inventario' : 'inventari'}</span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>`).join('')}</div>`
  const TYPES = ['Tutti', 'Server', 'Modalità', 'Workstation', 'Rete']
  const invRows = (c, list) => `<div class="rows">${list.map((x) => `<button type="button" class="row r-inv" data-inv="${c.inv.indexOf(x)}">
      <span class="ttag ${x.type}">${x.type}</span><span class="t"><b>${esc(x.name)}</b></span><span class="host">${esc(x.host)}</span><span class="n">${esc(c.site[x.si].name.replace(/^Ospedale /, 'Osp. '))}</span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>`).join('')}</div>`
  const invBlock = (c, limit) => {
    const all = c.inv.filter((x) => invType === 'Tutti' || x.type === invType)
    const list = limit && !showAllInv ? all.slice(0, limit) : all
    return `<section class="rec-sec" id="sec-inv"><div class="rec-sh"><h3>Inventari <span class="n" style="font-weight:400;color:var(--muted);font-size:12px">${c.inv.length}</span></h3>
      <span class="typefilter" role="group" aria-label="Tipo">${TYPES.map((t) => `<button type="button" aria-pressed="${t === invType}" data-type="${t}">${t}</button>`).join('')}</span></div>
      ${list.length ? invRows(c, list) : '<p class="empty-s">Nessun inventario di questo tipo.</p>'}
      ${limit && all.length > limit ? `<div class="more-row"><button class="lnk" type="button" data-allinv>${showAllInv ? 'Mostra meno' : `Mostra tutti i ${all.length}`}</button></div>` : ''}</section>`
  }
  const issRows = (c, list) => list.length ? `<div class="rows">${list.map((x) => `<button type="button" class="row r-iss"><span class="iss-n">#${x.n}</span><span class="t"><b>${esc(x.t)}</b><small>${esc(c.site[x.si].name)}</small></span><span class="st ${x.st}">${x.st === 'lav' ? 'In lavorazione' : 'Aperta'}</span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>`).join('')}</div>` : '<p class="empty-s">Nessuna issue aperta.</p>'
  const docRows = (c) => `<div class="rows">${c.contracts.map(([t, d, n]) => `<button type="button" class="row r-doc"><span class="doc-ic">${ic('receipt')}</span><span class="t"><b>${esc(t)}</b><small>Contratto · scade il ${d}</small></span><span class="st ${n <= 60 ? 'warn' : 'ok'}">${n <= 60 ? `tra ${n} giorni` : 'attivo'}</span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>`).join('')}
      ${c.drive ? `<button type="button" class="row r-doc"><span class="doc-ic">${ic('folder')}</span><span class="t"><b>Cartella nel Drive</b><small>${c.drive} file · ultimo caricato il 05/11</small></span><span></span>${ic('chevR').replace('class="i"', 'class="i go"')}</button>` : ''}</div>
      ${!c.contracts.length && !c.drive ? '<p class="empty-s">Nessun contratto né documento.</p>' : ''}`

  const sec_ = (id, title, hint, body, end = '') => `<section class="rec-sec" id="sec-${id}"><div class="rec-sh"><h3>${title}</h3>${hint ? `<p>${hint}</p>` : ''}${end}</div>${body}</section>`

  // ── Colonna a lato (uguale in A e B) ───────────────────────────
  const dirtyCls = (k) => (draft[k] !== cust()[k] ? ' dirty' : '')
  const rail = (c) => `<aside class="rec-rail" aria-label="Cliente">
      <section class="rcard"><h3>Anagrafica</h3><div class="cka">
        <label class="f"><span>Ragione sociale</span><input data-f="name" value="${esc(draft.name)}" class="${dirtyCls('name')}"></label>
        <label class="f"><span>Nome breve <small style="font-weight:400;color:var(--faint)">come compare negli elenchi</small></span><input data-f="dn" value="${esc(draft.dn)}" class="${dirtyCls('dn')}"></label>
        <div class="two">
          <label class="f"><span>Vendor</span><span class="vsel"><i style="background:${VEN[draft.ven]}"></i><select data-f="ven" class="${dirtyCls('ven')}">${Object.keys(VEN).map((v) => `<option${v === draft.ven ? ' selected' : ''}>${v}</option>`).join('')}</select></span></label>
          <div class="f"><span>Codice</span><span class="ro"><span class="code">${c.code}</span></span></div>
        </div>
        <label class="f"><span>P.IVA${draft.vat ? '' : ' <em>manca</em>'}</span><input data-f="vat" value="${esc(draft.vat)}" placeholder="11 cifre" class="mono${draft.vat ? '' : ' miss'}${dirtyCls('vat')}"></label>
        <label class="f"><span>Codice fiscale</span><input data-f="tax" value="${esc(draft.tax)}" class="mono${dirtyCls('tax')}"></label>
        <div class="two">
          <div class="f"><span>Città</span><span class="ro">${c.city}</span></div>
          <label class="f"><span>Provincia</span><input data-f="prov" value="${esc(draft.prov)}" maxlength="2" class="${dirtyCls('prov')}"></label>
        </div>
      </div></section>
      <section class="rcard"><div class="hd"><h3>Referenti</h3><button class="lnk" type="button">Tutti i contatti</button></div>
        ${c.contacts.length ? `<div class="refs">${c.contacts.map(([n, r, p, m, prim]) => `<div class="ref"><span class="uav">${ini(n)}</span><span class="t"><b>${n}${prim ? '<span class="prim">primario</span>' : ''}</b><small>${r} · ${p}</small></span><span class="acts"><button class="icon-btn" type="button" aria-label="Chiama ${n}" title="${p}">${PHONE}</button>${m ? `<button class="icon-btn" type="button" aria-label="Scrivi a ${n}" title="${m}">${MAIL}</button>` : ''}</span></div>`).join('')}</div>` : '<p class="empty-s">Nessun referente. <button class="lnk" type="button">Aggiungi un contatto</button></p>'}</section>
      <section class="rcard"><div class="hd"><h3>${ic('lock')}Accesso remoto</h3>${c.vpn ? `<span class="app-tag">${c.vpn.app}</span><button class="lnk" type="button">Modifica</button>` : ''}</div>
        ${c.vpn ? `<div class="cred">
          <div><span>Indirizzo</span><span class="v">${c.vpn.host}<span style="color:var(--muted)">:${c.vpn.port}</span></span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia l'indirizzo">${ic('copy')}</button></span></div>
          <div><span>Utenza</span><span class="v">${c.vpn.user}</span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia l'utenza">${ic('copy')}</button></span></div>
          <div><span>Password</span><span class="v pw${pwShown ? ' on' : ''}">${pwShown ? c.vpn.pw : '••••••••'}</span><span class="acts"><button class="icon-btn" type="button" data-pw aria-pressed="${pwShown}" aria-label="${pwShown ? 'Nascondi' : 'Mostra'} la password" title="${pwShown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}">${ic(pwShown ? 'eyeOff' : 'eye')}</button><button class="icon-btn cp" type="button" aria-label="Copia la password">${ic('copy')}</button></span></div>
        </div>` : '<p class="empty-s">Nessun accesso remoto. <button class="lnk" type="button">Registra VPN e credenziali</button></p>'}</section>
      <section class="rcard"><h3>Dove</h3><div class="map" aria-hidden="true"><span class="pin">${ic('pin')}</span></div>
        <p class="addr"><b>${c.addr}</b><small>${c.city} (${c.prov}) · <a href="#">Apri nelle mappe</a></small></p></section>
      <section class="rcard"><h3>Note</h3><textarea class="notes${dirtyCls('notes')}" data-f="notes" placeholder="Note interne sul cliente" aria-label="Note">${esc(draft.notes)}</textarea></section>
      ${variant === 'a' ? `<section class="rcard"><h3>Attività recente</h3><ul class="mini-feed">${ACT.map(([i, t, o, w]) => `<li>${ic(i)}<span>${t} <a href="#">${o}</a></span><time>${w}</time></li>`).join('')}</ul><a class="lnk" href="#">Tutta l'attività nell'Audit</a></section>` : ''}
    </aside>`

  // ── A · Tutto in vista ─────────────────────────────────────────
  const bodyA = (c) => `<div class="rec-body"><div class="rec-main">
      ${sec_('iss', `Issue aperte <span style="font-weight:400;color:var(--muted);font-size:12px">${c.iss.length}</span>`, '', issRows(c, c.iss), '<button class="lnk" type="button">+ Nuova issue</button>')}
      ${sec_('sites', `Siti <span style="font-weight:400;color:var(--muted);font-size:12px">${c.site.length}</span>`, 'Apri un sito per vederne inventari, referenti e issue.', siteRows(c), '<button class="lnk" type="button">+ Nuovo sito</button>')}
      ${invBlock(c, 6)}
      ${sec_('doc', 'Contratti e documenti', '', docRows(c))}
    </div>${rail(c)}</div>`

  // ── B · Sezioni ────────────────────────────────────────────────
  const SECS = (c) => [['ov', 'Panoramica'], ['sites', 'Siti', c.site.length], ['inv', 'Inventari', c.inv.length], ['doc', 'Documenti', c.contracts.length + (c.drive ? 1 : 0)], ['act', 'Attività']]
  const bodyB = (c) => {
    const main = sec === 'ov' ? `
        ${sec_('iss', `Issue aperte <span style="font-weight:400;color:var(--muted);font-size:12px">${c.iss.length}</span>`, '', issRows(c, c.iss), '<button class="lnk" type="button">+ Nuova issue</button>')}
        ${sec_('sites', 'Siti', '', `<div class="site-cards">${c.site.map((s, si) => `<button type="button" class="site-card" data-site="${si}"><b>${esc(s.name)}</b><small>${esc(s.addr || c.city)}</small><span class="ln">${s.inv.length} ${s.inv.length === 1 ? 'inventario' : 'inventari'}${s.iss.length ? ` · <span class="pill-iss">${s.iss.length} issue</span>` : ''}</span></button>`).join('')}</div>`)}
        ${sec_('doc', 'In scadenza', '', docRows({ ...c, drive: 0, contracts: c.contracts.filter((x) => x[2] <= 90) }))}`
      : sec === 'sites' ? sec_('sites', 'Siti', 'Apri un sito per vederne inventari, referenti e issue.', siteRows(c), '<button class="lnk" type="button">+ Nuovo sito</button>')
        : sec === 'inv' ? invBlock(c, 0)
          : sec === 'doc' ? sec_('doc', 'Contratti e documenti', '', docRows(c))
            : sec_('act', 'Attività', '', `<ul class="mini-feed">${ACT.map(([i, t, o, w]) => `<li>${ic(i)}<span>${t} <a href="#">${o}</a></span><time>${w}</time></li>`).join('')}</ul><a class="lnk" href="#">Tutta l'attività nell'Audit</a>`)
    return `<div class="rec-body"><div class="rec-main">
        <div class="seg-body" role="tablist" aria-label="Sezioni del cliente">${SECS(c).map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${k === sec}" data-sec="${k}">${l}${n != null ? `<span>${n}</span>` : ''}</button>`).join('')}</div>
        ${main}
      </div>${rail(c)}</div>`
  }

  // ── Record collegati: sito e inventario nella stessa finestra ──
  const siteRecord = (c, si) => {
    const s = c.site[si]
    return `<header class="rec-head">${crumb(c)}<div class="rec-id">
        <span class="rec-ava tile" aria-hidden="true">${ic('pin')}</span>
        <div class="rec-t"><h2>${esc(s.name)}</h2><p>Sito di ${esc(c.dn)} · ${esc(s.addr || c.city)}</p>
          <div class="rec-tags"><span>${s.inv.length} inventari</span><span>${s.iss.length} ${s.iss.length === 1 ? 'issue aperta' : 'issue aperte'}</span>${s.con.length ? `<span>${s.con.length} ${s.con.length === 1 ? 'referente' : 'referenti'}</span>` : ''}</div></div>
        <div class="rec-act"><button class="btn on-band solid" type="button">${ic('plus')}Nuova issue</button><button class="icon-btn on-band" type="button" aria-label="Altre azioni">${ic('more')}</button></div>
      </div></header>
      <div class="rec-body"><div class="rec-main">
        ${sec_('iss', 'Issue aperte', '', issRows(c, c.iss.filter((x) => x.si === si)))}
        ${sec_('inv', `Inventari <span style="font-weight:400;color:var(--muted);font-size:12px">${s.inv.length}</span>`, '', invRows(c, c.inv.filter((x) => x.si === si)))}
      </div><aside class="rec-rail">
        <section class="rcard"><h3>Referenti del sito</h3>${s.con.length ? `<div class="refs">${s.con.map(([n, r, p]) => `<div class="ref"><span class="uav">${ini(n)}</span><span class="t"><b>${n}</b><small>${r} · ${p}</small></span><span class="acts"><button class="icon-btn" type="button" aria-label="Chiama ${n}">${PHONE}</button></span></div>`).join('')}</div>` : '<p class="empty-s">Nessun referente su questo sito.</p>'}</section>
        <section class="rcard"><h3>Dove</h3><div class="map" aria-hidden="true"><span class="pin">${ic('pin')}</span></div><p class="addr"><b>${esc(s.addr || c.city)}</b><small><a href="#">Apri nelle mappe</a></small></p></section>
      </aside></div>`
  }
  const invRecord = (c, ii) => {
    const x = c.inv[ii]
    return `<header class="rec-head">${crumb(c)}<div class="rec-id">
        <span class="rec-ava tile" aria-hidden="true">${ic('server')}</span>
        <div class="rec-t"><h2>${esc(x.name)}<span class="ven-b">${x.type}</span></h2><p><span class="code" style="color:inherit">${esc(x.host)}</span> · ${esc(c.site[x.si].name)}</p></div>
        <div class="rec-act"><button class="btn on-band solid" type="button">${ic('plus')}Nuova issue</button><button class="icon-btn on-band" type="button" aria-label="Altre azioni">${ic('more')}</button></div>
      </div></header>
      <div class="rec-body"><div class="rec-main">
        ${sec_('cr', `${ic('lock')} Credenziali`, 'Visibili solo con il permesso Credenziali inventari.', `<div class="cred"><div><span>Host</span><span class="v">${esc(x.host)}</span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia">${ic('copy')}</button></span></div><div><span>Utenza</span><span class="v">service</span><span class="acts"><button class="icon-btn cp" type="button" aria-label="Copia">${ic('copy')}</button></span></div><div><span>Password</span><span class="v pw">••••••••</span><span class="acts"><button class="icon-btn" type="button" aria-label="Mostra">${ic('eye')}</button></span></div></div>`)}
        ${sec_('iss', 'Issue', '', issRows(c, c.iss.filter((i) => i.si === x.si).slice(0, 1)))}
      </div><aside class="rec-rail"><section class="rcard"><h3>Dove</h3><p class="addr" style="margin:0"><b>${esc(c.site[x.si].name)}</b><small>${esc(c.site[x.si].addr || c.city)}</small></p></section></aside></div>`
  }
  // L'inventario completo avrà la sua finestra quando migreremo la pagina Inventari: qui si vede il passaggio.

  const saveBar = () => { const n = changes().length; return n && !stack.length ? `<div class="savebar" role="status"><span class="dot"></span><b>${n} ${n === 1 ? 'modifica' : 'modifiche'} da salvare</b><span class="sp"></span><button class="btn" type="button" data-discard>Annulla</button><button class="btn btn-primary" type="button" data-save>Salva le modifiche</button></div>` : '' }

  const record = () => {
    const c = cust(); const top = stack.at(-1)
    const inner = !top ? headCustomer(c) + (variant === 'b' ? bodyB(c) : bodyA(c))
      : top.kind === 'site' ? siteRecord(c, top.si) : invRecord(c, top.ii)
    return `<div class="record">${inner}${saveBar()}</div>`
  }

  // ═══ Elenco clienti (sotto, attenuato) ══════════════════════════
  const table = () => `<section class="panel"><div class="table-wrap"><table class="po-table c-list"><thead><tr><th>Cliente</th><th>Vendor</th><th>Città</th><th>Siti</th><th>Inventari</th><th>Issue aperte</th></tr></thead><tbody>${C.map((c) => `<tr data-open="${c.id}" tabindex="0"><td><b>${c.dn}</b><br><small style="color:var(--muted)">${c.code} · ${c.name}</small></td><td><span class="ven"><i style="background:${VEN[c.ven]}"></i>${c.ven}</span></td><td>${c.city} (${c.prov})</td><td>${c.site.length}</td><td>${c.inv.length}</td><td>${c.iss.length || '—'}</td></tr>`).join('')}</tbody></table></div></section>`
  const view = () => `<div class="mt-head"><h1>Clienti</h1><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}Nuovo cliente</button></div></div>
    ${table()}
    ${current ? `<div class="ud-scrim" data-scrim><div class="ud-modal" role="dialog" aria-modal="true" aria-label="Cliente ${esc(cust().dn)}">
      <button class="icon-btn ud-x" type="button" data-modal-close aria-label="Chiudi">${ic('x')}</button>${record()}</div></div>` : ''}`

  const render = (keepScroll = true) => {
    document.documentElement.dataset.cdv = variant
    const sc = keepScroll ? $('.ud-scrim', root)?.scrollTop : 0
    root.innerHTML = view()
    const s = $('.ud-scrim', root); if (s) s.scrollTop = sc || 0
    document.querySelectorAll('[data-cdv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cdv === variant)))
  }
  const refreshBar = () => { const rec = $('.record', root); if (!rec) return; $('.savebar', rec)?.remove(); rec.insertAdjacentHTML('beforeend', saveBar()); const h = $('.rec-head', rec); if (!stack.length) h.outerHTML = headCustomer(cust()) }
  const leave = () => !changes().length || window.confirm('Ci sono modifiche non salvate. Uscire comunque?')
  const open = (id) => { current = id; stack = []; sec = 'ov'; invType = 'Tutti'; showAllInv = false; pwShown = false; load(); render(false) }
  const push = (r) => { stack.push(r); render(false) }

  root.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-modal-close]') || t.matches('[data-scrim]')) { if (!leave()) return; current = null; stack = []; return render() }
    const row = t.closest('tr[data-open]'); if (row) return open(Number(row.dataset.open))
    const step = t.closest('[data-step]'); if (step) { if (!leave()) return; const i = C.findIndex((x) => x.id === current); return open(C[(i + Number(step.dataset.step) + C.length) % C.length].id) }
    const back = t.closest('[data-back]'); if (back) { stack = stack.slice(0, Number(back.dataset.back)); return render(false) }
    const site = t.closest('[data-site]'); if (site) return push({ kind: 'site', si: Number(site.dataset.site) })
    const inv = t.closest('[data-inv]'); if (inv) return push({ kind: 'inv', ii: Number(inv.dataset.inv) })
    const go = t.closest('[data-goto]'); if (go) {
      const k = go.dataset.goto
      if (variant === 'b') { sec = k === 'iss' ? 'ov' : k; return render() }
      return $(`#sec-${k}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const sb = t.closest('[data-sec]'); if (sb) { sec = sb.dataset.sec; return render() }
    const ty = t.closest('[data-type]'); if (ty) { invType = ty.dataset.type; showAllInv = false; $('#sec-inv', root).outerHTML = invBlock(cust(), variant === 'a' ? 6 : 0); return }
    if (t.closest('[data-allinv]')) { showAllInv = !showAllInv; $('#sec-inv', root).outerHTML = invBlock(cust(), 6); return }
    const pw = t.closest('[data-pw]'); if (pw) { pwShown = !pwShown; render(); if (pwShown) setTimeout(() => { pwShown = false; if (current) render() }, 30000); return }
    const cp = t.closest('.cp'); if (cp) { cp.innerHTML = ic('check'); cp.style.color = 'var(--success)'; setTimeout(() => { cp.innerHTML = ic('copy'); cp.style.color = '' }, 1400); return }
    if (t.closest('[data-discard]')) { load(); return render() }
    if (t.closest('[data-save]')) { Object.assign(cust(), draft); load(); return render() }
  })
  const onField = (e) => { const f = e.target.dataset.f; if (!f) return; draft[f] = e.target.value; e.target.classList.toggle('dirty', draft[f] !== cust()[f]); if (f === 'vat') e.target.classList.toggle('miss', !draft.vat); if (f === 'ven') e.target.previousElementSibling.style.background = VEN[draft.ven]; refreshBar() }
  root.addEventListener('input', onField)
  root.addEventListener('change', onField)
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-open]')) { e.preventDefault(); e.target.click() } })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !current || !$('[data-palette-bg]')?.hidden) return
    if (stack.length) { stack.pop(); return render(false) }   // Esc torna prima al cliente
    if (!leave()) return; current = null; render()
  })
  document.querySelectorAll('[data-cdv]').forEach((b) => b.addEventListener('click', () => { variant = b.dataset.cdv; try { localStorage.setItem('archie-preview-cd-v', variant) } catch { /* niente */ } if (!current) open(2); else render() }))

  if (current) load()
  render()
})()
