/* Pagina Clienti (anteprima sulla base h / po).
   Modello reale: Customer (code automatico 001, name, display_name, status = vendor
   Philips | Biotron | Medical Imaging, vat_number, tax_code, city, province, tags,
   notes, custom_fields) + contatto primario (Contact.is_primary) + CustomerVpnAccess
   (applicativo, utenza, password cifrata, remote_address, porta). Collegati: siti,
   inventari, device, contratti, Drive, issue, attività (audit).
   Due varianti del pannello: A "Scheda" (come Issue e PO) e B "Fascicolo"
   (dal sito al sistema, con ricerca dentro il cliente). Dati finti. Oggi: 03/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const html = document.documentElement;
  const TODAY = new Date(2026, 10, 3);
  const DAY = 864e5;
  const dt = (s) => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  const inDays = (s) => Math.round((dt(s) - TODAY) / DAY);
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const phone = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
  const mail = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 6.5 12 13l8.5-6.5"/></svg>';
  const phoneB = phone.replace('stroke-width="1.75"', 'stroke-width="2.4"');
  const mailB = mail.replace('stroke-width="1.75"', 'stroke-width="2.4"');
  const clock = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18z M12 7.5V12l3 2"/></svg>';
  const key = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 11a4 4 0 1 1 0 8a4 4 0 0 1 0-8z M10.8 12.2 20 3 M16 7l3 3 M14 9l2 2"/></svg>';

  // Nav: pagina attiva
  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Clienti');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // Vendor (= stato del cliente nell'app): colore di riconoscimento fisso, non semaforico.
  const VEN = { Philips: '#3f7fbf', Biotron: '#2e8b6e', 'Medical Imaging': '#b4673a' };
  const venChip = (v) => `<span class="cmt"><span class="dot" style="background:${VEN[v]}"></span>${v}</span>`;

  // Siti, inventari, contatti e issue: completi per AUSL Imola e AUSL Bologna, sintetici per gli altri.
  const INV = (name, type, host, user, pw, extra = {}) => ({ name, type, host, user, pw, ...extra });
  const SITES = {
    2: [
      { name: 'Ospedale S. Maria della Scaletta', addr: 'Via Montericco 4, Imola', inv: [
        INV('PACS · nodo principale', 'Server', '10.40.12.10', 'pacsadmin', 'Sc4l3tta!2026'),
        INV('RIS · application server', 'Server', '10.40.12.21', 'risadm', 'R1s-Imola#7'),
        INV('CT 2 · Siemens SOMATOM', 'Modalità', '10.40.30.42', 'service', 'Somatom-42'),
        INV('Workstation refertazione 3', 'Workstation', 'WS-RAD-03', 'radiologo', 'Ref3rta!'),
      ], con: [['Laura Gentili', 'Radiologia · coordinatrice tecnica', '0542 662 410'], ['Davide Pirazzoli', 'Sistemi informativi', '0542 662 118']],
        iss: [[1041, 'Worklist vuota sulla modalità CT 2', 'lav'], [1038, 'Lentezza apertura studi dal PACS', 'aperta']] },
      { name: 'Ospedale Vecchio · Poliambulatorio', addr: 'Via Caterina Sforza 3, Imola', inv: [
        INV('Ecografo Philips EPIQ 7', 'Modalità', '10.40.51.12', 'service', 'Epiq7-svc'),
        INV('Workstation ambulatorio 1', 'Workstation', 'WS-AMB-01', 'ambulatorio', 'Amb!2026'),
      ], con: [['Sara Golinelli', 'Poliambulatorio · referente', '0542 604 220']], iss: [] },
      { name: 'Casa della Salute Castel San Pietro', addr: 'Viale Oriani 1, Castel San Pietro Terme', inv: [
        INV('Mammografo Hologic', 'Modalità', '10.41.10.8', 'service', 'Holo-CSP'),
        INV('Router VPN sede', 'Rete', '10.41.0.1', 'admin', 'Vpn-CSP-01'),
      ], con: [['Marco Cavina', 'Radiologia', '051 6955 310']], iss: [] },
      { name: 'Casa della Salute Medicina', addr: 'Via Saffi 1, Medicina', inv: [INV('Telecomandato DR', 'Modalità', '10.42.10.5', 'service', 'Dr-Med-5')], con: [], iss: [] },
      { name: 'Ospedale di Castel San Pietro', addr: 'Viale Oriani 1, Castel San Pietro Terme', inv: [INV('CR Fuji', 'Modalità', '10.41.20.3', 'service', 'Fuji-CR3'), INV('Stampante film Agfa', 'Periferica', '10.41.20.9', '', '')], con: [], iss: [] },
      { name: 'Data center aziendale', addr: 'Via Amendola 8, Imola', inv: [INV('VNA · storage primario', 'Server', '10.40.1.30', 'vnaadmin', 'Vna!Primario'), INV('Backup NAS', 'Server', '10.40.1.31', 'backup', 'Nas-Bkp-31'), INV('Firewall perimetrale', 'Rete', '10.40.0.1', 'fwadmin', 'Fw-Imola!')], con: [['Davide Pirazzoli', 'Sistemi informativi', '0542 662 118']], iss: [] },
    ],
    1: [
      { name: 'Ospedale Maggiore', addr: 'Largo Nigrisoli 2, Bologna', inv: [INV('PACS · nodo 1', 'Server', '10.20.5.10', 'pacsadmin', 'Magg-Pacs1'), INV('RM 1,5 T Philips Ingenia', 'Modalità', '10.20.40.11', 'service', 'Ingenia-15'), INV('Workstation 3D', 'Workstation', 'WS-3D-01', 'radiologo', '3d-Magg!')], con: [['Massimo Romanelli', 'Ingegneria clinica', '051 6584 210']], iss: [[1046, 'Errore DICOM send dalla RM 1,5 T', 'aperta'], [1032, 'Aggiornamento certificati HL7', 'lav']] },
      { name: 'Ospedale Bellaria', addr: 'Via Altura 3, Bologna', inv: [INV('CT Philips Incisive', 'Modalità', '10.21.30.4', 'service', 'Incisive-4'), INV('RIS client sala 2', 'Workstation', 'WS-BEL-02', 'tsrm', 'Bel-Ts2')], con: [['Anna Marchi', 'Neuroradiologia', '051 6225 400']], iss: [[1029, 'Etichette stampa paziente sfalsate', 'aperta']] },
      { name: 'Ospedale di Bentivoglio', addr: 'Via Marconi 35, Bentivoglio', inv: [INV('DR portatile', 'Modalità', '10.22.10.6', 'service', 'Dr-Bent6')], con: [], iss: [] },
    ],
  };
  const autoSites = (c) => Array.from({ length: c.sites }, (_, i) => ({
    name: i === 0 ? `${c.dn.replace(/^(AUSL|ASUFC|IRCCS) /, '')} · sede principale` : `Sede ${i + 1}`,
    addr: i === 0 ? c.addr : c.city,
    inv: Array.from({ length: Math.max(1, Math.round(c.inv / c.sites)) }, (_, j) => INV(['PACS', 'RIS', 'Workstation', 'Modalità CT', 'Router VPN'][j % 5] + (j > 4 ? ' ' + j : ''), ['Server', 'Server', 'Workstation', 'Modalità', 'Rete'][j % 5], `10.${60 + c.id}.${i + 1}.${10 + j}`, 'service', 'Demo-' + c.code + j)),
    con: i === 0 && c.contact ? [[c.contact[0], c.contact[1], c.contact[2]]] : [],
    iss: i === 0 ? Array.from({ length: c.issues }, (_, k) => [1020 - c.id * 3 - k, ['Richiesta reset password worklist', 'Allarme spazio disco archivio', 'Verifica collegamento modalità'][k % 3], 'aperta']) : [],
  }));

  const C = [
    { id: 1, code: '001', dn: 'AUSL Bologna', name: 'Azienda USL di Bologna', ven: 'Philips', city: 'Bologna', prov: 'BO', addr: 'Via Castiglione 29, Bologna', vat: '02406911202', tax: '02406911202', contact: ['Massimo Romanelli', 'Ingegneria clinica', '051 6584 210', 'm.romanelli@ausl.bologna.it'], sites: 8, inv: 20, issues: 3, contracts: [['Manutenzione PACS 2025–2026', '31/12/2026'], ['Assistenza RIS', '30/06/2027']], drive: 7, vpn: { app: 'FortiClient', host: 'vpn.ausl.bologna.it', port: '10443', user: 'biotron.svc' }, tags: ['PACS', 'RIS'], notes: 'Cliente storico. Interventi in sala RM solo con preavviso di 48 ore all\'ingegneria clinica.' },
    { id: 2, code: '002', dn: 'AUSL Imola', name: 'Azienda USL di Imola', ven: 'Philips', city: 'Imola', prov: 'BO', addr: 'Viale Amendola 2, Imola', vat: '00705271203', tax: '90000900374', contact: ['Laura Gentili', 'Radiologia · coordinatrice tecnica', '0542 662 410', 'l.gentili@ausl.imola.bo.it'], sites: 6, inv: 14, issues: 2, contracts: [['Manutenzione full risk PACS/RIS', '15/01/2027']], drive: 4, vpn: { app: 'Cisco AnyConnect', host: 'vpn.ausl.imola.bo.it', port: '443', user: 'ext.biotron' }, tags: ['PACS', 'RIS', 'VNA'], notes: 'Finestra di manutenzione concordata: martedì 20:00–23:00.' },
    { id: 3, code: '003', dn: 'Centro Medico Esperia', name: 'Centro Medico Esperia S.r.l.', ven: 'Biotron', city: 'Pordenone', prov: 'PN', addr: 'Via Montereale 24, Pordenone', vat: '01784560937', tax: '', contact: null, sites: 2, inv: 5, issues: 1, contracts: [['Assistenza VNA', '31/03/2027']], drive: 2, vpn: null, tags: ['VNA'], notes: '' },
    { id: 4, code: '004', dn: 'Casa di Cura Rocca', name: 'Casa di Cura Rocca S.p.A.', ven: 'Medical Imaging', city: 'Piacenza', prov: 'PC', addr: 'Via Emilia Pavese 115, Piacenza', vat: '00163010334', tax: '', contact: ['Paolo Ferri', 'Direzione sanitaria', '0523 712 900', 'p.ferri@casadicurarocca.it'], sites: 1, inv: 4, issues: 0, contracts: [], drive: 1, vpn: null, tags: [], notes: '' },
    { id: 5, code: '005', dn: 'ASUFC Udine', name: 'Azienda Sanitaria Universitaria Friuli Centrale', ven: 'Biotron', city: 'Udine', prov: 'UD', addr: 'Via Pozzuolo 330, Udine', vat: '02985660303', tax: '02985660303', contact: ['Giulia Zanin', 'SC Radiologia', '0432 552 761', 'giulia.zanin@asufc.sanita.fvg.it'], sites: 9, inv: 31, issues: 1, contracts: [['Integrazione dose SR', '30/11/2026'], ['Manutenzione PACS', '31/12/2027']], drive: 9, vpn: { app: 'FortiClient', host: 'sslvpn.asufc.sanita.fvg.it', port: '443', user: 'biotron01' }, tags: ['PACS', 'Dose'], notes: '' },
    { id: 6, code: '006', dn: 'IRCCS Rizzoli', name: 'Istituto Ortopedico Rizzoli', ven: 'Biotron', city: 'Bologna', prov: 'BO', addr: 'Via di Barbiano 1/10, Bologna', vat: '00302030374', tax: '80022410376', contact: ['Marco Neri', 'Servizio informatico', '051 6366 044', 'marco.neri@ior.it'], sites: 3, inv: 12, issues: 0, contracts: [['Teleradiologia notturna', '31/08/2027']], drive: 3, vpn: { app: 'Palo Alto GlobalProtect', host: 'gp.ior.it', port: '443', user: 'biotron.ext' }, tags: ['Teleradiologia'], notes: '' },
    { id: 7, code: '007', dn: 'Poliambulatorio Manzano', name: 'Poliambulatorio Manzano', ven: 'Biotron', city: 'Manzano', prov: 'UD', addr: 'Via Roma 12, Manzano', vat: '', tax: '', contact: null, sites: 1, inv: 2, issues: 0, contracts: [], drive: 0, vpn: null, tags: [], notes: 'Anagrafica da completare: manca la P.IVA.' },
    { id: 8, code: '008', dn: 'AUSL Ferrara', name: 'Azienda USL di Ferrara', ven: 'Philips', city: 'Ferrara', prov: 'FE', addr: 'Via Cassoli 30, Ferrara', vat: '01295960387', tax: '01295960387', contact: ['Elena Mori', 'Ingegneria clinica', '0532 235 671', 'e.mori@ausl.fe.it'], sites: 5, inv: 16, issues: 2, contracts: [['Canone RIS', '20/12/2026']], drive: 5, vpn: { app: 'FortiClient', host: 'vpn.ausl.fe.it', port: '10443', user: 'biotron' }, tags: ['RIS'], notes: '' },
    { id: 9, code: '009', dn: 'Centro Diagnostico Valli', name: 'Centro Diagnostico Valli S.r.l.', ven: 'Medical Imaging', city: 'Sassuolo', prov: 'MO', addr: 'Via Circonvallazione 45, Sassuolo', vat: '03312890365', tax: '', contact: ['Andrea Lodi', 'Amministrazione', '0536 801 233', 'a.lodi@cdvalli.it'], sites: 2, inv: 3, issues: 0, contracts: [], drive: 1, vpn: null, tags: [], notes: '' },
    { id: 10, code: '010', dn: 'AUSL Romagna', name: 'Azienda USL della Romagna', ven: 'Philips', city: 'Ravenna', prov: 'RA', addr: 'Via De Gasperi 8, Ravenna', vat: '02483810392', tax: '02483810392', contact: ['Chiara Bassi', 'UO Radiologia Ravenna', '0544 285 112', 'chiara.bassi@auslromagna.it'], sites: 11, inv: 38, issues: 1, contracts: [['Manutenzione PACS area vasta', '31/12/2028']], drive: 11, vpn: { app: 'FortiClient', host: 'vpn.auslromagna.it', port: '443', user: 'ext_biotron' }, tags: ['PACS', 'RIS', 'VNA'], notes: '' },
  ];
  C.forEach((c) => {
    c.site = SITES[c.id] || autoSites(c);
    c.sites = c.site.length; c.inv = c.site.reduce((s, x) => s + x.inv.length, 0); c.issues = c.site.reduce((s, x) => s + x.iss.length, 0);
  });
  const nextExpiry = (c) => c.contracts.map(([n, d]) => [n, d, inDays(d)]).filter((x) => x[2] >= 0).sort((a, b) => a[2] - b[2])[0];
  const expiring = (c) => { const n = nextExpiry(c); return n && n[2] <= 60; };
  const incomplete = (c) => !c.contact || !c.vat;

  // ── Indicatori ───────────────────────────────────────────────────
  const kpiWrap = $('[data-c-kpis]');
  const renderKpis = () => {
    const withIss = C.filter((c) => c.issues); const exp = C.filter(expiring); const inc = C.filter(incomplete);
    const byV = Object.keys(VEN).map((v) => [v, C.filter((c) => c.ven === v).length]);
    const soon = exp.map(nextExpiry).sort((a, b) => a[2] - b[2])[0];
    kpiWrap.innerHTML = `<div class="kpis c-kpis" role="group" aria-label="Indicatori clienti">
      <div class="kpi"><span class="kpi-h">Clienti</span><span class="kpi-v">${C.length}<small>${C.reduce((s, c) => s + c.sites, 0)} siti</small></span><span class="kpi-s"><b>${C.reduce((s, c) => s + c.inv, 0)}</b>&nbsp;inventari in anagrafica</span></div>
      <button type="button" class="kpi" data-goview="iss" aria-pressed="${view === 'iss'}"><span class="kpi-h">Con issue aperte<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${withIss.length}<small>${withIss.reduce((s, c) => s + c.issues, 0)} issue</small></span><span class="kpi-s">più aperte:&nbsp;<b>${[...withIss].sort((a, b) => b.issues - a.issues)[0].dn}</b></span></button>
      <button type="button" class="kpi" data-goview="exp" aria-pressed="${view === 'exp'}"><span class="kpi-h">Contratti in scadenza<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${exp.length}<small>entro 60 giorni</small></span><span class="kpi-s">${soon ? `<span class="kpi-flag warn">${ic('calendar')}${soon[1]}</span>tra <b>${soon[2]}</b>&nbsp;giorni` : 'nessuno'}</span></button>
      <button type="button" class="kpi" data-goview="inc" aria-pressed="${view === 'inc'}"><span class="kpi-h">Da completare<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${inc.length}</span><span class="kpi-s">senza contatto primario o P.IVA</span></button>
      <div class="kpi kpi-prio"><span class="kpi-h">Per vendor</span>
        <div class="bar" aria-hidden="true">${byV.map(([v, n]) => `<span style="flex:${n};background:${VEN[v]}" data-tip="${v} · <b>${n}</b> clienti"></span>`).join('')}</div>
        <div class="lg">${byV.map(([v, n]) => `<button type="button" data-goven="${v}" title="Filtra per ${v}"><i style="background:${VEN[v]}"></i>${v} <b>${n}</b></button>`).join('')}</div></div>
    </div>`;
  };

  // ── Viste, colonne, filtri, ricerca per colonna ─────────────────
  const VIEWS = [['all', 'Tutti', () => true], ['iss', 'Con issue aperte', (c) => c.issues > 0], ['exp', 'Contratti in scadenza', expiring], ['inc', 'Da completare', incomplete]];
  let view = 'all';
  const COLS = [
    { k: 'c-code', l: 'Codice', cmp: (a, b) => a.code.localeCompare(b.code), q: (c) => c.code, ph: '#' },
    { k: 'c-name', l: 'Cliente', cmp: (a, b) => a.dn.localeCompare(b.dn), q: (c) => c.dn + ' ' + c.name, ph: 'Nome o ragione sociale' },
    { k: 'c-ven', l: 'Vendor', set: (c) => c.ven, cmp: (a, b) => a.ven.localeCompare(b.ven), opts: Object.keys(VEN) },
    { k: 'c-city', l: 'Città · prov.', set: (c) => c.prov, cmp: (a, b) => a.city.localeCompare(b.city), q: (c) => c.city + ' ' + c.prov, ph: 'Città o provincia' },
    { k: 'c-con', l: 'Contatto primario', cmp: (a, b) => (a.contact?.[0] || '~').localeCompare(b.contact?.[0] || '~'), q: (c) => (c.contact || []).join(' '), ph: 'Nome o telefono' },
    { k: 'c-sites', l: 'Siti', num: true, cmp: (a, b) => a.sites - b.sites },
    { k: 'c-inv', l: 'Inventari', num: true, cmp: (a, b) => a.inv - b.inv },
    { k: 'c-iss', l: 'Issue', num: true, cmp: (a, b) => a.issues - b.issues },
    { k: 'c-ctr', l: 'Contratto', cmp: (a, b) => (nextExpiry(a)?.[2] ?? 1e9) - (nextExpiry(b)?.[2] ?? 1e9), set: (c) => !c.contracts.length ? 'Nessun contratto' : expiring(c) ? 'In scadenza' : 'Attivo' },
    { k: 'c-vat', l: 'P.IVA', cmp: (a, b) => (a.vat || '~').localeCompare(b.vat || '~'), q: (c) => c.vat, ph: 'P.IVA' },
  ];
  const filters = {}; const cs = {}; let sort = { k: 'c-name', dir: 1 }; let csOpen = false;
  const headRow = $('[data-c-head]'); const csRow = $('[data-c-search]'); const tbody = $('[data-c-rows]');
  const funnel = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>';
  const arrow = (d) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d > 0 ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'}"/></svg>`;
  const paintHead = () => {
    headRow.innerHTML = COLS.map((c) => `<th class="${c.k}${c.num ? ' num-r' : ''}" data-col="${c.k}"><div class="th-in"><button type="button" class="th-sort${sort.k === c.k ? ' is-on' : ''}" data-sort="${c.k}">${c.l}${sort.k === c.k ? arrow(sort.dir) : ''}</button>${c.set ? `<button type="button" class="th-filter${filters[c.k]?.size ? ' is-on' : ''}" data-filter="${c.k}" aria-label="Filtra ${c.l}" title="Filtra ${c.l}">${funnel}</button>` : ''}</div></th>`).join('');
    csRow.innerHTML = COLS.map((c) => `<th data-col="${c.k}">${c.q ? `<input type="search" data-cs="${c.k}" value="${cs[c.k] || ''}" placeholder="${c.ph}" aria-label="Cerca in ${c.l}" class="${cs[c.k] ? 'is-set' : ''}">` : c.opts ? `<select data-cs="${c.k}" aria-label="Cerca in ${c.l}" class="${cs[c.k] ? 'is-set' : ''}"><option value="">Tutti</option>${c.opts.map((o) => `<option${cs[c.k] === o ? ' selected' : ''}>${o}</option>`).join('')}</select>` : ''}</th>`).join('');
  };
  const visible = () => C.filter(VIEWS.find((v) => v[0] === view)[2])
    .filter((r) => Object.entries(filters).every(([k, s]) => !s.size || s.has(COLS.find((c) => c.k === k).set(r))))
    .filter((r) => Object.entries(cs).every(([k, v]) => { if (!v) return true; const c = COLS.find((x) => x.k === k); return c.q ? c.q(r).toLowerCase().includes(v.toLowerCase()) : c.set(r) === v; }));
  const sorted = () => { const c = COLS.find((x) => x.k === sort.k); return visible().sort((a, b) => sort.dir * c.cmp(a, b) || a.id - b.id); };
  let selected = null;
  const issChip = (n) => n ? `<a class="c-icount" href="h-base.html" title="${n} issue aperte · apri l'elenco">${n}</a>` : '<span class="none">—</span>';
  const ctrCell = (c) => {
    const n = nextExpiry(c);
    if (!c.contracts.length) return '<span class="none">—</span>';
    return n && n[2] <= 60 ? `<span class="c-exp" title="${n[0]} · scade tra ${n[2]} giorni">${clock}${n[1]}</span>` : `<span class="c-ok">${c.contracts.length} ${c.contracts.length === 1 ? 'attivo' : 'attivi'}</span>`;
  };
  const renderRows = () => {
    const rows = sorted();
    tbody.innerHTML = rows.map((c) => `<tr data-id="${c.id}" tabindex="0" class="${c.id === selected ? 'is-selected' : ''}">
      <td class="c-code"><span class="code">${c.code}</span></td>
      <td class="c-name"><b>${c.dn}</b>${c.vpn ? '<span class="vpn" title="Accesso VPN registrato">VPN</span>' : ''}</td>
      <td class="c-ven">${venChip(c.ven)}</td>
      <td class="c-city">${c.city} <span class="pv-p">${c.prov}</span></td>
      <td class="c-con">${c.contact ? c.contact[0] : '<span class="miss">Nessun contatto</span>'}</td>
      <td class="c-sites num-r">${c.sites}</td>
      <td class="c-inv num-r">${c.inv}</td>
      <td class="c-iss num-r">${issChip(c.issues)}</td>
      <td class="c-ctr">${ctrCell(c)}</td>
      <td class="c-vat">${c.vat ? `<span class="code">${c.vat}</span>` : '<span class="miss">Manca</span>'}</td>
    </tr>`).join('') || `<tr><td colspan="${COLS.length}" style="height:96px;text-align:center;color:var(--muted)">Nessun cliente con questi filtri. <button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button></td></tr>`;
    $('[data-c-foot]').innerHTML = `<span><b>${rows.length}</b> di ${C.length} clienti</span><span class="sp"></span><span>dati fittizi</span>`;
    paintTokens(); paintViews();
    $('[data-colsearch]').classList.toggle('has-values', Object.values(cs).some(Boolean));
  };
  const paintViews = () => {
    $('[data-c-views]').innerHTML = VIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === view}" data-view="${k}"${k === 'exp' ? ' class="v-alert"' : ''}>${l} <span>${C.filter(f).length}</span></button>`).join('') + `<button type="button" class="v-add">${ic('plus')}Salva vista</button>`;
  };
  const paintTokens = () => {
    const t = Object.entries(filters).filter(([, s]) => s.size).map(([k, s]) => `<span class="token"><span class="tk">${COLS.find((c) => c.k === k).l}</span> <b>${[...s].join(', ')}</b><button type="button" class="tk-x" data-unf="${k}" aria-label="Rimuovi filtro">${ic('x')}</button></span>`);
    $('[data-c-tokens]').innerHTML = t.length ? t.join('') + '<button type="button" class="btn btn-ghost btn-sm" data-unf="*">Azzera filtri</button>' : '<span class="none" style="font-size:12px">Nessun filtro. Usa l\'imbuto accanto al nome di una colonna.</span>';
  };
  const setView = (v) => { view = v; renderKpis(); renderRows(); };
  $('[data-c-views]').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  kpiWrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goview]'); if (b) { setView(view === b.dataset.goview ? 'all' : b.dataset.goview); return; }
    const v = e.target.closest('[data-goven]'); if (v) { filters['c-ven'] = new Set([v.dataset.goven]); paintHead(); renderRows(); }
  });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-unf]'); if (!b) return; if (b.dataset.unf === '*') { Object.keys(filters).forEach((k) => delete filters[k]); Object.keys(cs).forEach((k) => delete cs[k]); } else delete filters[b.dataset.unf]; paintHead(); renderRows(); });

  // Ricerca per colonna
  const csBtn = $('[data-colsearch]');
  csBtn.addEventListener('click', () => {
    csOpen = !csOpen; csRow.hidden = !csOpen; csBtn.setAttribute('aria-pressed', String(csOpen));
    if (!csOpen) { Object.keys(cs).forEach((k) => delete cs[k]); paintHead(); renderRows(); } else csRow.querySelector('input')?.focus();
  });
  let tq = null;
  csRow.addEventListener('input', (e) => {
    const f = e.target.closest('[data-cs]'); if (!f) return;
    cs[f.dataset.cs] = f.value; f.classList.toggle('is-set', !!f.value);
    clearTimeout(tq); tq = setTimeout(renderRows, f.tagName === 'SELECT' ? 0 : 200);
  });

  // Popover filtro di colonna
  const cpop = document.createElement('div'); cpop.className = 'cpop'; cpop.hidden = true; document.body.appendChild(cpop);
  headRow.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sort]');
    if (s) { sort = sort.k === s.dataset.sort ? { k: s.dataset.sort, dir: -sort.dir } : { k: s.dataset.sort, dir: 1 }; paintHead(); renderRows(); return; }
    const f = e.target.closest('[data-filter]'); if (!f) return; e.stopPropagation();
    const c = COLS.find((x) => x.k === f.dataset.filter); const cur = filters[c.k] || new Set();
    const vals = [...new Set(C.map(c.set))].sort((a, b) => a.localeCompare(b, 'it'));
    cpop.innerHTML = `<div class="srt"><button type="button" data-csort="1">Crescente</button><button type="button" data-csort="-1">Decrescente</button></div>
      ${vals.map((v) => `<label><input type="checkbox" value="${v}"${cur.has(v) ? ' checked' : ''}>${c.k === 'c-ven' ? venChip(v) : v}<small>${C.filter((r) => c.set(r) === v).length}</small></label>`).join('')}
      <div class="cp-f"><button type="button" class="btn btn-ghost btn-sm" data-cclear>Rimuovi filtro</button><button type="button" class="btn btn-primary btn-sm" data-capply>Applica</button></div>`;
    cpop.dataset.k = c.k; const r = f.getBoundingClientRect();
    cpop.style.left = Math.max(8, Math.min(r.right - 240, innerWidth - 256)) + 'px'; cpop.style.top = (r.bottom + 6) + 'px'; cpop.hidden = false;
  });
  cpop.addEventListener('click', (e) => {
    const k = cpop.dataset.k;
    if (e.target.closest('[data-csort]')) sort = { k, dir: Number(e.target.closest('[data-csort]').dataset.csort) };
    else if (e.target.closest('[data-cclear]')) delete filters[k];
    else if (e.target.closest('[data-capply]')) filters[k] = new Set([...cpop.querySelectorAll('input:checked')].map((i) => i.value));
    else return;
    cpop.hidden = true; paintHead(); renderRows();
  });
  document.addEventListener('click', (e) => { if (!cpop.hidden && !e.target.closest('.cpop')) cpop.hidden = true; });

  // ── Pannello di dettaglio: parti comuni ──────────────────────────
  const drawer = $('[data-c-drawer]'); const body = $('[data-cbody]'); const pop = $('[data-cpop]');
  const shell = $('.shell');
  let variant = 'a'; let tab = 'det'; let ppOpen = false; let site = 0; let find = ''; const shown = new Set();
  const cust = () => C.find((c) => c.id === selected);
  const typeIc = { Server: 'server', Modalità: 'monitor', Workstation: 'monitor', Rete: 'cloud', Periferica: 'file' };
  const secret = (id, v, label) => v ? `<span class="sec${shown.has(id) ? ' is-shown' : ''}"><span class="code">${shown.has(id) ? v : '••••••••'}</span><button type="button" class="icon-btn" data-reveal-sec="${id}" aria-pressed="${shown.has(id)}" aria-label="${shown.has(id) ? 'Nascondi' : 'Mostra'} ${label}" title="${shown.has(id) ? 'Nascondi' : 'Mostra'} · resta visibile 30 secondi">${ic('eye')}</button><button type="button" class="icon-btn" data-copy aria-label="Copia ${label}" title="Copia">${ic('copy')}</button></span>` : '<span class="none">—</span>';
  const copyable = (v, label) => `<span class="cpy"><span class="code">${v}</span><button type="button" class="icon-btn" data-copy aria-label="Copia ${label}" title="Copia">${ic('copy')}</button></span>`;

  const secH = (t, right = '') => `<div class="c-sec-h"><h4>${t}</h4>${right}</div>`;
  const others = (c) => { const seen = new Set([c.contact?.[0]]); const out = []; c.site.forEach((x) => x.con.forEach(([n, d, p]) => { if (!seen.has(n)) { seen.add(n); out.push([n, d, p, x.name]); } })); return out; };
  const tel = (p) => p.replace(/\s+/g, '');
  const contactCard = (c) => {
    const o = others(c); const more = o.length - 3;
    const list = o.length ? `<ul class="c-refs" aria-label="Altri referenti">${o.slice(0, 3).map(([n, d, p, site]) => `<li><div class="fn"><b>${n}<span>${d}</span></b><span>${site}</span></div><a class="c-tel" href="tel:${tel(p)}" title="Chiama ${n}">${phoneB}<span class="code">${p}</span></a></li>`).join('')}</ul>${more > 0 ? `<button type="button" class="c-link c-more" data-tab-go="sites">Altri ${more} referenti nei siti</button>` : ''}` : '';
    const primary = c.contact ? `<div class="c-primary">
        <div class="c-person"><b>${c.contact[0]}<span class="c-tag">Primario</span></b><span>${c.contact[1]}</span></div>
        <div class="c-acts">
          <span class="c-act"><a class="ct" href="tel:${tel(c.contact[2])}">${phoneB}<span class="code">${c.contact[2]}</span></a><button type="button" class="icon-btn" data-copy aria-label="Copia il telefono" title="Copia">${ic('copy')}</button></span>
          <span class="c-act"><a class="ct" href="mailto:${c.contact[3]}">${mailB}<span>${c.contact[3]}</span></a><button type="button" class="icon-btn" data-copy aria-label="Copia l'email" title="Copia">${ic('copy')}</button></span>
        </div>
      </div>` : `<button type="button" class="c-empty">${ic('user')}<span><b>Nessun contatto primario</b><span>${o.length ? 'Scegline uno tra i referenti qui sotto' : 'Aggiungi il referente principale del cliente'}</span></span>${ic('plus')}</button>`;
    return `<section class="c-sec" aria-label="Contatti">${secH(`Contatti <span>${(c.contact ? 1 : 0) + o.length}</span>`, '<button type="button" class="c-link">Aggiungi</button>')}${primary}${list}</section>`;
  };

  const vpnBlock = (c) => `<section class="c-sec" aria-label="Accesso remoto">${secH(`${ic('lock')}Accesso remoto`, c.vpn ? `<span class="c-app">${c.vpn.app}</span>` : '')}
    ${c.vpn ? `<div class="c-cred">
      <div class="cr"><span class="k">Indirizzo</span><span class="v code">${c.vpn.host}<span class="port">:${c.vpn.port}</span></span><button type="button" class="icon-btn" data-copy aria-label="Copia l'indirizzo" title="Copia">${ic('copy')}</button></div>
      <div class="cr"><span class="k">Utenza</span><span class="v code">${c.vpn.user}</span><button type="button" class="icon-btn" data-copy aria-label="Copia l'utenza" title="Copia">${ic('copy')}</button></div>
      <div class="cr cr-pw"><span class="k">Password</span>${secret('vpn' + c.id, 'Vpn-' + c.code + '!Sec', 'la password VPN')}</div>
    </div>
    <p class="c-audit">Visibile solo con il permesso Credenziali VPN. Ogni visualizzazione resta nel log di audit.</p>`
    : `<button type="button" class="c-empty">${ic('lock')}<span><b>Nessun accesso remoto</b><span>Registra VPN, utenza e password del cliente</span></span>${ic('plus')}</button>`}</section>`;

  const propsBlock = (c) => `<section class="pp${ppOpen ? ' is-open' : ''}" aria-label="Proprietà">
      <button type="button" class="pp-t" data-pp-toggle aria-expanded="${ppOpen}"><span class="pp-pm" aria-hidden="true"></span><span class="pp-tl">Proprietà</span>
        <span class="pp-sum">${ppOpen ? '<span class="pp-hint">clic su un valore per modificarlo · si salva subito</span>' : `${venChip(c.ven)}<span class="code">${c.vat || 'P.IVA mancante'}</span>`}</span></button>
      <div class="pp-grid"${ppOpen ? '' : ' hidden'}>
        <button type="button" class="pp-i" data-edit="ven"><span class="k">Vendor</span><span class="v">${venChip(c.ven)}</span>${ic('chevD')}</button>
        <div class="pp-i is-ro" title="Assegnato in automatico"><span class="k">Codice</span><span class="v code">${c.code}</span></div>
        <button type="button" class="pp-i pp-full" data-edit="name"><span class="k">Ragione sociale</span><span class="v">${c.name}</span>${ic('wrench')}</button>
        <button type="button" class="pp-i" data-edit="vat"><span class="k">P.IVA</span><span class="v code">${c.vat || '<span class="miss">Manca</span>'}</span>${ic('wrench')}</button>
        <button type="button" class="pp-i" data-edit="tax"><span class="k">Codice fiscale</span><span class="v code">${c.tax || '<span class="none">—</span>'}</span>${ic('wrench')}</button>
        <button type="button" class="pp-i" data-edit="city"><span class="k">Città</span><span class="v">${c.city} <span class="pv-p">${c.prov}</span></span>${ic('wrench')}</button>
        <button type="button" class="pp-i" data-edit="tags"><span class="k">Tag</span><span class="v">${c.tags.length ? c.tags.map((t) => `<span class="tg">${t}</span>`).join('') : '<span class="none">Nessuno</span>'}</span>${ic('chevD')}</button>
      </div></section>`;

  // Mappa segnaposto: nell'app qui va la mappa vera (Leaflet, da includere nel bundle).
  const mapArt = `<svg class="c-map-art" viewBox="0 0 460 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="460" height="170" fill="var(--map-bg)"/>
      <path d="M-10 128 C 70 112 120 150 200 138 S 330 96 470 118" fill="none" stroke="var(--map-water)" stroke-width="18" stroke-linecap="round"/>
      <path d="M300 10 h70 a6 6 0 0 1 6 6 v38 a6 6 0 0 1 -6 6 h-70 a6 6 0 0 1 -6 -6 v-38 a6 6 0 0 1 6 -6z" fill="var(--map-park)"/>
      <g fill="var(--map-block)">
        <rect x="18" y="14" width="74" height="36" rx="4"/><rect x="104" y="14" width="56" height="36" rx="4"/><rect x="18" y="62" width="50" height="34" rx="4"/>
        <rect x="80" y="62" width="80" height="34" rx="4"/><rect x="176" y="14" width="40" height="82" rx="4"/><rect x="246" y="14" width="40" height="40" rx="4"/>
        <rect x="246" y="66" width="104" height="30" rx="4"/><rect x="390" y="14" width="56" height="46" rx="4"/><rect x="364" y="72" width="82" height="24" rx="4"/>
      </g>
      <g fill="none" stroke-linecap="round">
        <path d="M-10 56 H470 M232 -10 V170" stroke="var(--map-road-edge)" stroke-width="12"/>
        <path d="M-10 56 H470 M232 -10 V170" stroke="var(--map-road)" stroke-width="9"/>
        <path d="M98 -10 V112 M168 -10 V108 M-10 104 H470 M380 -10 V104 M292 -10 V104" stroke="var(--map-road)" stroke-width="4"/>
      </g>
      <circle cx="232" cy="56" r="26" fill="var(--primary)" opacity=".1"/><circle cx="232" cy="56" r="12" fill="var(--primary)" opacity=".18"/>
      <path d="M232 64 s-11-10-11-18a11 11 0 0 1 22 0c0 8-11 18-11 18z" fill="var(--primary)" stroke="var(--surface)" stroke-width="2"/><circle cx="232" cy="46" r="4" fill="var(--surface)"/>
    </svg>`;
  const addrBlock = (c) => { const [street, ...rest] = c.addr.split(', '); return `<section class="c-sec">${secH('Sede legale')}
      <div class="c-map">${mapArt}<span class="c-map-ph">Anteprima mappa</span>
        <div class="c-map-bar"><div class="fn"><b>${street}</b><span>${rest.join(', ')} (${c.prov})</span></div><a class="btn btn-sm" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(c.addr)}" target="_blank" rel="noopener">Apri in Mappe${ic('arrowR')}</a></div>
      </div></section>`; };
  const notesBlock = (c) => `<section class="c-sec">${secH('Note')}${c.notes ? `<p class="desc-p">${c.notes}</p>` : '<p class="files-empty">Nessuna nota.</p>'}</section>`;

  const clockDef = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18z M12 7.5V12l3 2"/></svg>';
  const summary = (c) => {
    const n = nextExpiry(c); const soon = n && n[2] <= 60;
    const cell = (go, k, v, extra = '', cls = '', tip = '') => `<button type="button" data-tab-go="${go}" class="${cls}"${tip ? ` title="${tip}"` : ''}><b>${v}${extra}</b><span>${k}</span></button>`;
    return `<section class="c-stats" aria-label="Riepilogo">
      ${cell('sites', 'Siti', c.sites)}${cell('inv', 'Inventari', c.inv)}${cell('sites', 'Issue aperte', c.issues)}
      ${cell('doc', 'Contratti', c.contracts.length, soon ? clock : '', soon ? 'is-warn' : '', soon ? `${n[0]} · scade il ${n[1]}` : n ? `Prossima scadenza ${n[1]}` : '')}
    </section>`;
  };

  const ISS = { aperta: 'Aperta', lav: 'In lavorazione' };
  const issRow = ([id, t, st]) => `<a href="h-base.html" class="c-iss-row"><span class="num">#${id}</span><span class="t">${t}</span><span class="st st-${st === 'lav' ? 'lavorazione' : 'aperta'}">${ISS[st]}</span></a>`;
  const invRow = (c, si, x, j) => { const id = `i${c.id}-${si}-${j}`; return `<li class="c-inv-row"><span class="ti">${ic(typeIc[x.type] || 'server')}</span><div class="fn"><b>${x.name}</b><span>${x.type} · <span class="code">${x.host}</span></span></div>${x.pw ? `<div class="cred"><span class="code u">${x.user}</span>${secret(id, x.pw, 'password ' + x.name)}</div>` : '<span class="none">nessuna credenziale</span>'}</li>`; };
  const conRow = ([n, d, p]) => `<li class="c-con-row"><div class="fn"><b>${n}</b><span>${d}</span></div><a class="btn btn-sm" href="tel:${p.replace(/\s+/g, '')}">${phone}<span class="code">${p}</span></a></li>`;
  const ctrList = (c) => c.contracts.length ? `<ul class="files">${c.contracts.map(([n, d]) => { const k = inDays(d); return `<li class="c-ctr-row"><span class="ft">${ic('file')}</span><div class="fn"><b>${n}</b><span>scadenza ${d}</span></div><span class="due${k <= 60 ? ' due-soon' : ''}">${k <= 60 ? `tra ${k} giorni` : 'attivo'}</span></li>`; }).join('')}</ul>` : '<p class="files-empty">Nessun contratto collegato.</p>';
  const driveList = (c) => c.drive ? `<ul class="files">${['Planimetria radiologia.pdf', 'Schema rete PACS.pdf', 'Verbale collaudo 2025.pdf', 'Contatti reparto.xlsx', 'Procedura accesso VPN.pdf', 'Offerta manutenzione.pdf', 'Certificati HL7.zip', 'Foto rack.jpg', 'Note di installazione.docx', 'Configurazione modalità.pdf', 'Inventario 2024.xlsx'].slice(0, c.drive).map((n, i) => `<li><span class="ft${n.endsWith('.pdf') ? ' ft-pdf' : ''}">${n.split('.').pop().toUpperCase()}</span><div class="fn"><b>${n}</b><span>${String(28 - i * 2).padStart(2, '0')}/10/2026 · F. Mutuale</span></div><span></span><button class="icon-btn" type="button" aria-label="Scarica ${n}">${ic('download')}</button><span></span></li>`).join('')}</ul>` : '<p class="files-empty">Nessun file nel Drive del cliente.</p>';
  const events = (c) => [
    ['wrench', 'F. Mutuale', `ha aggiornato il contatto primario${c.contact ? ` · <b>${c.contact[0]}</b>` : ''}`, '28/10/2026'],
    ['plus', 'L. Romano', `ha aggiunto il sito <b>${c.site[c.site.length - 1].name}</b>`, '14/10/2026'],
    ['lock', 'F. Mutuale', 'ha visualizzato la password VPN', '09/10/2026'],
    ['file', 'Amministrazione', 'ha caricato un contratto', '01/09/2026'],
    ['plus', 'Archie', 'ha creato il cliente', '12/03/2024'],
  ];
  const activity = (c) => `<div class="feed">${events(c).map(([i, w, t, d]) => `<div class="ev">${ic(i)}<span><b>${w}</b> ${t}</span><time>${d}</time></div>`).join('')}</div>`;

  // ── Variante A · Scheda ──────────────────────────────────────────
  const sitesList = (c) => `<ul class="cl-sites">${c.site.map((s, i) => `<li><button type="button" data-open-site="${i}"><span class="ti">${ic('pin')}</span><div class="fn"><b>${s.name}</b><span>${s.addr}</span></div><span class="cnt">${s.inv.length} inv.${s.iss.length ? ` · <span class="w">${s.iss.length} issue</span>` : ''}</span>${ic('chevR')}</button></li>`).join('')}</ul>`;
  const invByStie = (c) => c.site.map((s, si) => `<section class="c-grp"><h4>${s.name} <span>${s.inv.length}</span></h4><ul class="c-invs">${s.inv.map((x, j) => invRow(c, si, x, j)).join('')}</ul></section>`).join('');
  const renderA = (c) => {
    const tabs = [['det', 'Dettagli'], ['sites', 'Siti', c.sites], ['inv', 'Inventari', c.inv], ['doc', 'Documenti', c.contracts.length + c.drive], ['att', 'Attività', 5]];
    if (!tabs.some(([k]) => k === tab)) tab = 'det';
    $('[data-ctabs]').innerHTML = tabs.map(([k, l, n]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}${n !== undefined ? ` <span class="tn">${n}</span>` : ''}</button>`).join('');
    $('[data-cd-find]').innerHTML = '';
    const content = {
      det: () => propsBlock(c) + summary(c) + contactCard(c) + vpnBlock(c) + addrBlock(c) + notesBlock(c),
      sites: () => sitesList(c),
      inv: () => invByStie(c),
      doc: () => `<section class="c-sec">${secH(`Contratti <span>${c.contracts.length}</span>`)}${ctrList(c)}</section><section class="c-sec">${secH(`Drive <span>${c.drive}</span>`, '<button type="button" class="c-link">Apri nel Drive</button>')}${driveList(c)}</section>`,
      att: () => activity(c),
    }[tab]();
    const foot = `<div class="drawer-foot"><a class="btn" href="#">${ic('server')}Site Repository</a><span class="g-spacer"></span><a class="btn btn-primary" href="h-base.html">${ic('plus')}Nuova issue</a></div>`;
    body.innerHTML = `<div class="drawer-body int-body">${content}</div>${foot}`;
  };

  // ── Variante B · Fascicolo ───────────────────────────────────────
  const hits = (c, q) => {
    const t = q.toLowerCase(); const out = [];
    c.site.forEach((s, si) => {
      if (s.name.toLowerCase().includes(t) || s.addr.toLowerCase().includes(t)) out.push(['Siti', `<button type="button" class="hit" data-open-site="${si}"><span class="ti">${ic('pin')}</span><div class="fn"><b>${s.name}</b><span>${s.addr}</span></div>${ic('chevR')}</button>`]);
      s.inv.forEach((x, j) => { if ((x.name + ' ' + x.host + ' ' + x.type + ' ' + x.user).toLowerCase().includes(t)) out.push(['Inventari e credenziali', `<ul class="c-invs">${invRow(c, si, x, j).replace('<div class="fn">', `<div class="fn"><small class="path">${s.name}</small>`)}</ul>`]); });
      s.con.forEach((p) => { if (p.join(' ').toLowerCase().includes(t)) out.push(['Contatti', `<ul class="c-cons">${conRow(p).replace('<div class="fn">', `<div class="fn"><small class="path">${s.name}</small>`)}</ul>`]); });
      s.iss.forEach((i) => { if ((i[0] + ' ' + i[1]).toLowerCase().includes(t)) out.push(['Issue', issRow(i)]); });
    });
    return out;
  };
  const renderB = (c) => {
    const tabs = [['sys', 'Siti e sistemi'], ['ana', 'Anagrafica'], ['doc', 'Contratti e Drive', c.contracts.length + c.drive], ['att', 'Attività', 5]];
    if (!['sys', 'ana', 'doc', 'att'].includes(tab)) tab = 'sys';
    $('[data-ctabs]').innerHTML = tabs.map(([k, l, n]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}${n !== undefined ? ` <span class="tn">${n}</span>` : ''}</button>`).join('');
    const fi = $('[data-cd-find]');
    if (!fi.querySelector('input')) fi.innerHTML = `<label class="fx-in">${ic('search')}<input type="search" data-find placeholder="Cerca in ${c.dn}: sito, sistema, IP, utenza, contatto…" aria-label="Cerca nel cliente"><kbd>/</kbd></label>`;
    fi.querySelector('input').placeholder = `Cerca in ${c.dn}: sito, sistema, IP, utenza, contatto…`;
    let content;
    if (find.trim()) {
      const h = hits(c, find.trim()); const groups = {};
      h.forEach(([g, x]) => { (groups[g] ||= []).push(x); });
      content = `<div class="drawer-body fx-res">${h.length ? Object.entries(groups).map(([g, xs]) => `<section class="c-grp"><h4>${g} <span>${xs.length}</span></h4>${xs.join('')}</section>`).join('') : `<p class="files-empty">Niente per «${find}» in ${c.dn}.</p>`}</div>`;
    } else if (tab === 'sys') {
      const s = c.site[site] || c.site[0];
      content = `<div class="fx-strip">
          <span>${venChip(c.ven)}</span>
          ${c.contact ? `<span class="fx-c">${ic('user')}<b>${c.contact[0]}</b><a href="tel:${c.contact[2].replace(/\s+/g, '')}" class="code">${c.contact[2]}</a></span>` : '<span class="fx-c miss">Nessun contatto primario</span>'}
          <span class="fx-c">${ic('lock')}${c.vpn ? `VPN <span class="code">${c.vpn.host}</span>` : '<span class="none">Nessuna VPN</span>'}</span>
          ${nextExpiry(c) && nextExpiry(c)[2] <= 60 ? `<span class="due due-soon">contratto scade ${nextExpiry(c)[1]}</span>` : ''}
        </div>
        <div class="fx-split">
          <nav class="fx-sites" aria-label="Siti del cliente"><div class="fx-h">Siti <span>${c.sites}</span></div>${c.site.map((x, i) => `<button type="button" data-site="${i}" aria-current="${i === site}"><b>${x.name}</b><span>${x.inv.length} inventari${x.iss.length ? ` · <em>${x.iss.length} issue</em>` : ''}</span></button>`).join('')}</nav>
          <div class="fx-site drawer-body">
            <div class="fx-sh"><div><h3>${s.name}</h3><span>${s.addr}</span></div><a class="btn btn-sm" href="#">Apri sito${ic('arrowR')}</a></div>
            ${s.iss.length ? `<section class="c-grp"><h4>Issue aperte <span>${s.iss.length}</span></h4>${s.iss.map(issRow).join('')}</section>` : ''}
            <section class="c-grp"><h4>Inventari <span>${s.inv.length}</span></h4><ul class="c-invs">${s.inv.map((x, j) => invRow(c, site, x, j)).join('')}</ul></section>
            <section class="c-grp"><h4>Contatti del sito <span>${s.con.length}</span></h4>${s.con.length ? `<ul class="c-cons">${s.con.map(conRow).join('')}</ul>` : '<p class="files-empty">Nessun contatto per questo sito.</p>'}</section>
          </div>
        </div>`;
    } else {
      content = `<div class="drawer-body int-body">${tab === 'ana' ? propsBlock(c) + contactCard(c) + vpnBlock(c) + addrBlock(c) + notesBlock(c) : tab === 'doc' ? `<section><h4>Contratti <span>${c.contracts.length}</span></h4>${ctrList(c)}</section><section><h4>Drive <span>${c.drive}</span></h4>${driveList(c)}</section>` : activity(c)}</div>`;
    }
    const foot = `<div class="drawer-foot"><a class="btn" href="#">${ic('server')}Site Repository</a><span class="g-spacer"></span><a class="btn btn-primary" href="h-base.html">${ic('plus')}Nuova issue</a></div>`;
    body.innerHTML = content + foot;
  };

  const render = () => {
    const c = cust(); if (!c) return;
    drawer.classList.toggle('is-fx', variant === 'b');
    $('[data-cd="code"]').textContent = c.code;
    $('[data-cd="vendor"]').innerHTML = `<span class="hd-ven">${c.ven}</span>`;
    $('[data-cd="title"]').textContent = c.dn;
    $('[data-cd="sub"]').innerHTML = `${c.name !== c.dn ? c.name + ' · ' : ''}${c.city} (${c.prov})`;
    const vis = sorted().map((x) => x.id); const ix = vis.indexOf(c.id);
    $('[data-cd="pos"]').textContent = ix < 0 ? '' : `${ix + 1} di ${vis.length}`;
    if (variant === 'a') renderA(c); else renderB(c);
  };
  const open = (id) => {
    if (selected !== id) { site = 0; find = ''; shown.clear(); const fi = $('[data-cd-find] input'); if (fi) fi.value = ''; }
    selected = id; drawer.hidden = false; shell.classList.add('has-drawer');
    tbody.querySelectorAll('tr').forEach((t) => t.classList.toggle('is-selected', Number(t.dataset.id) === id));
    render();
  };
  const close = () => { drawer.hidden = true; selected = null; shell.classList.remove('has-drawer'); tbody.querySelectorAll('tr').forEach((t) => t.classList.remove('is-selected')); };
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); });
  tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); } });
  $('[data-cclose]').addEventListener('click', close);
  $('[data-ctabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; find = ''; const fi = $('[data-cd-find] input'); if (fi) fi.value = ''; render(); } });
  $('[data-cd-find]').addEventListener('input', (e) => { if (e.target.matches('[data-find]')) { find = e.target.value; render(); } });
  const step = (d) => { const vis = sorted().map((x) => x.id); const n = vis[vis.indexOf(selected) + d]; if (n) { open(n); tbody.querySelector(`tr[data-id="${n}"]`)?.scrollIntoView({ block: 'nearest' }); } };
  drawer.querySelectorAll('[data-cstep]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.cstep))));

  // Clic fuori dal pannello: lo chiude (comportamento globale deciso per l'app).
  document.addEventListener('pointerdown', (e) => {
    if (drawer.hidden) return;
    const t = e.target;
    if (drawer.contains(t) || t.closest('.cpop, .pop, .pv-bar, .toast-int, .mdl-bg, tbody tr[data-id]')) return;
    close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (drawer.hidden) return;
    if (e.key === '/' && variant === 'b' && !e.target.closest('input, textarea, select')) { e.preventDefault(); $('[data-find]')?.focus(); return; }
    if (e.target.closest('input, textarea, select')) { if (e.key === 'Escape' && e.target.matches('[data-find]') && e.target.value) { e.target.value = ''; find = ''; render(); } return; }
    if (e.key === 'Escape') close(); if (e.key === 'j') step(1); if (e.key === 'k') step(-1);
  });

  // Toast
  const toast = $('[data-toast]'); let undo = null; let tt = null;
  const showToast = (msg, u) => { undo = u; toast.innerHTML = `${tick}<span>${msg}</span>${u ? '<button type="button" data-undo>Annulla</button>' : ''}`; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 5000); };
  toast.addEventListener('click', (e) => { if (e.target.closest('[data-undo]') && undo) { undo(); undo = null; toast.hidden = true; } });
  const refresh = () => { renderKpis(); paintHead(); renderRows(); render(); };

  const timers = {};
  body.addEventListener('click', (e) => {
    const c = cust(); if (!c) return;
    if (e.target.closest('[data-pp-toggle]')) { ppOpen = !ppOpen; render(); return; }
    const go = e.target.closest('[data-tab-go]'); if (go) { tab = go.dataset.tabGo; render(); return; }
    const os = e.target.closest('[data-open-site]');
    if (os) { if (variant === 'b') { site = Number(os.dataset.openSite); tab = 'sys'; find = ''; const fi = $('[data-cd-find] input'); if (fi) fi.value = ''; render(); } else showToast(`Si apre la scheda del sito «${c.site[Number(os.dataset.openSite)].name}»`); return; }
    const sb = e.target.closest('[data-site]'); if (sb) { site = Number(sb.dataset.site); render(); $('.fx-site')?.scrollTo(0, 0); return; }
    const rv = e.target.closest('[data-reveal-sec]');
    if (rv) {
      const id = rv.dataset.revealSec;
      if (shown.has(id)) shown.delete(id); else { shown.add(id); clearTimeout(timers[id]); timers[id] = setTimeout(() => { shown.delete(id); render(); }, 30000); }
      render(); if (shown.has(id)) showToast('Password visibile per 30 secondi · registrato nel log di audit'); return;
    }
    if (e.target.closest('[data-copy]')) { showToast('Copiato negli appunti'); return; }
    const ed = e.target.closest('[data-edit="ven"]');
    if (ed) {
      e.stopPropagation(); const dr = drawer.getBoundingClientRect(); const rr = ed.getBoundingClientRect();
      pop.innerHTML = Object.keys(VEN).map((v) => `<button type="button" data-vv="${v}" aria-checked="${c.ven === v}">${venChip(v)}<span class="ok">${tick}</span></button>`).join('');
      pop.style.left = (rr.left - dr.left) + 'px'; pop.style.top = (rr.bottom - dr.top + 4) + 'px'; pop.style.minWidth = rr.width + 'px'; pop.hidden = false; return;
    }
    if (e.target.closest('[data-edit]')) showToast('Modifica sul posto (come nelle Issue): qui solo il vendor è attivo');
  });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vv]'); if (!b) return; const c = cust(); const prev = c.ven;
    c.ven = b.dataset.vv; pop.hidden = true; refresh(); showToast(`Vendor aggiornato · ${c.ven}`, () => { c.ven = prev; refresh(); });
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('[data-cpop]')) pop.hidden = true; });

  // Variante del pannello
  const vbtns = document.querySelectorAll('[data-var-btn]');
  const setVar = (v) => {
    variant = v; tab = v === 'a' ? 'det' : 'sys'; find = '';
    $('[data-cd-find]').innerHTML = '';
    vbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.varBtn === v)));
    try { localStorage.setItem('archie-preview-cli-var', v); } catch (e) { /* niente */ }
    if (selected) render();
  };
  vbtns.forEach((b) => b.addEventListener('click', () => setVar(b.dataset.varBtn)));
  const q = new URLSearchParams(location.search);
  let saved = null; try { saved = localStorage.getItem('archie-preview-cli-var'); } catch (e) { /* niente */ }
  setVar(q.get('var') || saved || 'a');

  renderKpis(); paintHead(); renderRows();
  if (q.get('c')) open(Number(q.get('c')));
})();
