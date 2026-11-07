/* Drive: due proposte sullo stile "Campo sterile".
   Modello reale: drive.DriveFolder (nome, cartella padre, clienti, gruppi ammessi, note) e
   drive.DriveFile (cartella, nome, file, tipo MIME, dimensione, clienti, gruppi, autore, date).
   Caricamento max 25 MB, niente eseguibili; anteprima di immagini e PDF; permessi controllati dal server.
   Le cartelle del Drive non hanno un colore: in B sono tutte color manila. Dati finti. Oggi: 06/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Drive');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Cartelle e file ────────────────────────────────────────────────
  const F = (id, name, parent, extra = {}) => ({ id, name, parent, customers: [], restricted: false, ...extra });
  const FOLDERS = [
    F(1, 'Clienti', null), F(11, 'AUSL Imola', 1, { customers: ['AUSL Imola'] }), F(111, 'Verbali di collaudo', 11, { customers: ['AUSL Imola'] }), F(112, 'Schemi di rete', 11, { customers: ['AUSL Imola'], restricted: true, groups: ['Tecnici senior', 'Rete'] }),
    F(12, 'ASUFC Udine', 1, { customers: ['ASUFC Udine'] }), F(13, 'IRCCS Rizzoli', 1, { customers: ['IRCCS Rizzoli'] }), F(14, 'ASREM Molise', 1, { customers: ['ASREM Molise'] }),
    F(2, 'Manuali e schede tecniche', null), F(21, 'Siemens', 2), F(22, 'Philips', 2), F(23, 'Carestream', 2),
    F(3, 'Progetti', null), F(31, 'Migrazione PACS Imola', 3, { customers: ['AUSL Imola'] }),
    F(4, 'Interni', null, { restricted: true, groups: ['Amministrazione', 'Coordinatori'] }), F(41, 'Modulistica', 4), F(42, 'Formazione', 4),
  ];
  const fo = (id) => FOLDERS.find((f) => f.id === id);
  let seq = 500;
  const D = (name, folder, kb, upd, by, extra = {}) => ({ id: seq++, name, folder, size: kb * 1024, upd, by, customers: fo(folder)?.customers ?? [], ...extra });
  const FILES = [
    D('Verbale collaudo CT 2.pdf', 111, 1240, '2026-11-05', 'L. Romano', { notes: 'Firmato dal coordinatore TSRM. Copia cartacea consegnata al reparto.', renamed: 'verbale_ct2_def.pdf' }), D('Verbale collaudo RM 1.pdf', 111, 1180, '2026-10-22', 'L. Romano'),
    D('Foto rack Radiologia.jpg', 11, 3420, '2026-11-04', 'F. Mutuale', { notes: 'Rack 2, piano terra. Switch in alto a destra da sostituire (issue #1031).' }), D('Elenco nodi DICOM.xlsx', 11, 48, '2026-11-03', 'L. Romano'),
    D('Schema rete Scaletta.pdf', 112, 860, '2026-10-30', 'A. Ferri'), D('Planimetria Radiologia.png', 112, 2210, '2026-09-18', 'A. Ferri'),
    D('Contratto assistenza 2026.pdf', 12, 640, '2026-10-12', 'F. Mutuale'), D('Log gateway RIS.txt', 13, 92, '2026-10-31', 'A. Ferri'),
    D('Foto DryView 5950.jpg', 14, 2890, '2026-10-25', 'M. Romanelli'),
    D('SOMATOM go.Up · manuale di servizio.pdf', 21, 18400, '2026-08-02', 'M. Romanelli'), D('Release notes VB10.pdf', 21, 920, '2026-09-11', 'M. Romanelli'),
    D('IntelliSpace PACS · admin guide.pdf', 22, 22100, '2026-07-21', 'A. Ferri'), D('DryView 5950 · codici errore.pdf', 23, 410, '2026-10-25', 'M. Romanelli'),
    D('Piano di migrazione.docx', 31, 180, '2026-11-06', 'F. Mutuale'), D('Export studi 2019-2024.zip', 31, 24300, '2026-11-02', 'L. Romano', { moved: 'Clienti / AUSL Imola' }), D('Cronoprogramma.xlsx', 31, 36, '2026-10-28', 'F. Mutuale'),
    D('Rapportino vuoto.docx', 41, 54, '2026-06-10', 'F. Mutuale'), D('Nota spese.xlsx', 41, 31, '2026-05-02', 'F. Mutuale'),
    D('Corso DICOM base.pdf', 42, 6800, '2026-04-14', 'L. Romano'),
  ];
  const TYPE = (n) => { const e = n.split('.').pop().toLowerCase(); return ({ pdf: ['PDF', 'pdf'], jpg: ['IMG', 'img'], png: ['IMG', 'img'], zip: ['ZIP', 'zip'], docx: ['DOC', 'doc'], xlsx: ['XLS', 'xls'], txt: ['TXT', 'txt'] })[e] || [e.toUpperCase(), 'txt']; };
  const CUSTOMERS = [...new Set(FOLDERS.flatMap((f) => f.customers))];

  // ── Formati ────────────────────────────────────────────────────────
  const TODAY = '2026-11-06';
  const MSH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const dshort = (s) => { const [, m, d] = s.split('-').map(Number); return `${d} ${MSH[m - 1]}`; };
  const rel = (s) => { const n = Math.round((Date.parse(TODAY) - Date.parse(s)) / 864e5); return n === 0 ? 'oggi' : n === 1 ? 'ieri' : n < 7 ? `${n} giorni fa` : dshort(s); };
  const size = (b) => b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;
  const path = (id) => { const out = []; let f = fo(id); while (f) { out.unshift(f); f = fo(f.parent); } return out; };
  const kids = (id) => FOLDERS.filter((f) => f.parent === id);
  const filesIn = (id) => FILES.filter((x) => x.folder === id);
  const deepFiles = (id) => [...filesIn(id), ...kids(id).flatMap((k) => deepFiles(k.id))];
  const typeTile = (n, big) => fileIcon(n, big ? 40 : 28);

  // ── Icone dei file e delle cartelle (disegnate qui, nello stile delle icone di sistema) ──
  const KIND = { pdf: 'Documento PDF', img: 'Immagine', doc: 'Documento Word', xls: 'Foglio di calcolo', zip: 'Archivio compresso', txt: 'File di testo' };
  const PAGE = '<path d="M5 1.5h16.5l8 8V37a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 37V3A1.5 1.5 0 0 1 5 1.5z" fill="#fff" stroke="#c9d1d8"/><path d="M21.5 1.5V8a1.5 1.5 0 0 0 1.5 1.5h6.5" fill="#e9edf1" stroke="#c9d1d8" stroke-linejoin="round"/>';
  const BAND = (c, t) => `<rect x="1" y="21" width="22" height="11" rx="2" fill="${c}"/><text x="12" y="29.2" text-anchor="middle" font-family="Geist, Segoe UI, sans-serif" font-size="7.2" font-weight="700" fill="#fff" letter-spacing=".2">${t}</text>`;
  const LINES = (c) => `<g stroke="${c}" stroke-width="1.4" stroke-linecap="round"><path d="M8 12h13M8 16h15"/></g>`;
  const GLYPH = {
    pdf: `${LINES('#e2c2bf')}${BAND('#d93a2e', 'PDF')}`,
    doc: `${LINES('#bcd0ef')}<path d="M8 20h15" stroke="#bcd0ef" stroke-width="1.4" stroke-linecap="round"/>${BAND('#2563c9', 'DOC')}`,
    xls: `<g fill="none" stroke="#a9d3b8" stroke-width="1.1"><rect x="8" y="11" width="16" height="11"/><path d="M8 14.7h16M8 18.4h16M13.3 11v11M18.6 11v11"/></g>${BAND('#16824a', 'XLS')}`,
    zip: `<path d="M16 2v26" stroke="#e7a53a" stroke-width="3" stroke-dasharray="2 2"/><rect x="13" y="26" width="6" height="8" rx="1.5" fill="#d9921f"/><rect x="14.6" y="28.5" width="2.8" height="3" rx=".6" fill="#fff"/>`,
    txt: `<g stroke="#b9c3cc" stroke-width="1.4" stroke-linecap="round"><path d="M8 13h15M8 17h15M8 21h12M8 25h15M8 29h9"/></g>`,
    img: `<clipPath id="ci"><rect x="6" y="12" width="20" height="20" rx="2"/></clipPath><g clip-path="url(#ci)"><rect x="6" y="12" width="20" height="20" fill="#7cc6f2"/><circle cx="21" cy="17" r="2.6" fill="#ffd34d"/><path d="M6 32l7-10 5 6 3-3 5 7z" fill="#2f9a5b"/><path d="M6 32l7-10 4 5-5 5z" fill="#3fb36d"/></g>`,
  };
  const fileIcon = (n, px = 28) => { const [, k] = TYPE(n); return `<svg class="d-ficon" width="${Math.round(px * 0.8)}" height="${px}" viewBox="0 0 32 40" aria-hidden="true">${PAGE}${GLYPH[k] || GLYPH.txt}</svg>`; };
  const folderIcon = (px = 22, f = null) => {
    const badge = f?.restricted ? `<circle cx="32" cy="25" r="7" fill="#fff" stroke="#c9d1d8"/><rect x="29" y="24" width="6" height="5" rx="1" fill="#5b6b67"/><path d="M30.2 24v-1.5a1.8 1.8 0 0 1 3.6 0V24" fill="none" stroke="#5b6b67" stroke-width="1.2"/>`
      : f?.customers?.length ? `<circle cx="32" cy="25" r="7" fill="#fff" stroke="#c9d1d8"/><rect x="28.6" y="20.8" width="6.8" height="8.4" rx=".8" fill="#1f6b5c"/><g fill="#fff"><rect x="29.9" y="22.2" width="1.5" height="1.5"/><rect x="32.6" y="22.2" width="1.5" height="1.5"/><rect x="29.9" y="24.8" width="1.5" height="1.5"/><rect x="32.6" y="24.8" width="1.5" height="1.5"/><rect x="31.2" y="27.3" width="1.6" height="1.9"/></g>` : '';
    return `<svg class="d-folder" width="${Math.round(px * 1.25)}" height="${px}" viewBox="0 0 40 32" aria-hidden="true"><path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h10.2l3 3h17.8A2.5 2.5 0 0 1 38 9.5V12H2z" fill="#e0a21b"/><rect x="2" y="9" width="36" height="21" rx="2.5" fill="#fbc531"/><path d="M2 11.5A2.5 2.5 0 0 1 4.5 9h31A2.5 2.5 0 0 1 38 11.5v1H2z" fill="#ffd866"/>${badge}</svg>`;
  };
  const custChips = (cs) => cs.map((c) => `<span class="d-cust">${ic('building')}${esc(c)}</span>`).join('');
  const lock = (f) => f.restricted ? `<span class="d-lock" title="Visibile solo ad alcuni gruppi">${ic('lock')}</span>` : '';

  // ── Stato ──────────────────────────────────────────────────────────
  let v = 'a'; let cur = null; let open = new Set([1, 11, 3]); let q = ''; let cust = null; let sel = new Set(); let dragging = false; let selFile = null; let viewMode = 'list';
  const root = $('[data-w-root]');

  const head = () => `<div class="po-head d-head"><h1>Drive</h1><span class="d-hint">${ic('cloud')}File oltre 25 MB: usa OneDrive</span>
    <div class="actions"><button class="btn" type="button" data-toast="Si apre «Nuova cartella»">${ic('folder')}Nuova cartella</button><button class="btn btn-primary" type="button" data-upload>${ic('upload')}Carica file</button></div></div>`;

  const crumbs = () => `<nav class="d-crumbs" aria-label="Percorso"><button type="button" data-go="">${ic('folder')}Drive</button>${cur ? path(cur).map((f) => `<span>/</span><button type="button" data-go="${f.id}"${f.id === cur ? ' aria-current="page"' : ''}>${esc(f.name)}</button>`).join('') : ''}</nav>`;

  // Elementi da mostrare nella cartella corrente (o nel risultato di ricerca/filtro)
  const listing = () => {
    const term = q.trim().toLowerCase();
    if (term || cust) {
      const fs = FILES.filter((x) => (!term || x.name.toLowerCase().includes(term)) && (!cust || x.customers.includes(cust)));
      const ds = FOLDERS.filter((f) => (!term || f.name.toLowerCase().includes(term)) && (!cust || f.customers.includes(cust)) && (!cust || !fo(f.parent)?.customers.includes(cust)));
      return { folders: ds, files: fs, flat: true };
    }
    return { folders: FOLDERS.filter((f) => f.parent === cur), files: FILES.filter((x) => x.folder === cur), flat: false };
  };
  const recent = () => [...FILES].sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 6);

  // ════════ A · Esplora file ════════
  const tree = (parent, depth = 0) => kids(parent).map((f) => {
    const has = kids(f.id).length; const isOpen = open.has(f.id);
    return `<li><div class="d-tn${f.id === cur ? ' is-on' : ''}" style="--d:${depth}">
        ${has ? `<button type="button" class="d-tw" data-tw="${f.id}" aria-label="${isOpen ? 'Chiudi' : 'Apri'} ${esc(f.name)}" aria-expanded="${isOpen}">${ic(isOpen ? 'chevD' : 'chevR')}</button>` : '<span class="d-tw"></span>'}
        <button type="button" class="dr-tl" data-go="${f.id}"${f.id === cur ? ' aria-current="page"' : ''}>${folderIcon(16)}<span>${esc(f.name)}</span>${lock(f)}<small>${deepFiles(f.id).length}</small></button>
      </div>${has && isOpen ? `<ul>${tree(f.id, depth + 1)}</ul>` : ''}</li>`;
  }).join('');

  const renderA = () => {
    const L = listing();
    const rows = [
      ...L.folders.map((f) => `<tr class="is-folder" tabindex="0" data-go="${f.id}">
        <td class="d-c-sel"></td>
        <td class="d-c-name"><span class="d-nm"><span class="d-fic">${folderIcon(22, f)}</span><span class="d-n"><b>${esc(f.name)}</b>${L.flat ? `<small>${esc(path(f.parent ?? 0).map((x) => x.name).join(' / ') || 'Drive')}</small>` : ''}</span></span></td>
        <td>${custChips(f.customers) || '<span class="none">—</span>'}</td>
        <td class="num">${deepFiles(f.id).length} file</td>
        <td class="d-c-upd"><span class="none">—</span></td><td></td></tr>`),
      ...L.files.map((x) => `<tr tabindex="0" data-file="${x.id}" class="${sel.has(x.id) ? 'is-sel' : ''}${selFile === x.id ? ' is-open' : ''}">
        <td class="d-c-sel"><input type="checkbox" aria-label="Seleziona ${esc(x.name)}" data-sel="${x.id}" ${sel.has(x.id) ? 'checked' : ''}></td>
        <td class="d-c-name"><span class="d-nm">${typeTile(x.name)}<span class="d-n"><b>${esc(x.name)}</b>${L.flat ? `<small>${esc(path(x.folder).map((f) => f.name).join(' / '))}</small>` : ''}</span></span></td>
        <td>${custChips(x.customers) || '<span class="none">—</span>'}</td>
        <td class="num">${size(x.size)}</td>
        <td class="d-c-upd">${rel(x.upd)}<small>${x.by}</small></td>
        <td class="d-c-act"><button type="button" class="icon-btn" data-dl="${x.id}" aria-label="Scarica ${esc(x.name)}" title="Scarica">${ic('download')}</button></td></tr>`),
    ].join('');
    const showRecent = !cur && !q && !cust;
    return `${head()}
      <section class="panel d-a${dragging ? ' is-drop' : ''}" aria-label="Drive" data-drop>
        <aside class="dr-side" aria-label="Cartelle">
          <label class="search d-search">${ic('search')}<input data-q value="${esc(q)}" placeholder="Cerca in tutto il Drive" aria-label="Cerca nel Drive"></label>
          <div class="dr-side-h">Cartelle</div>
          <ul class="d-tree"><li><div class="d-tn${!cur ? ' is-on' : ''}" style="--d:0"><span class="d-tw"></span><button type="button" class="dr-tl" data-go="">${ic('cloud')}<span>Tutto il Drive</span><small>${FILES.length}</small></button></div></li>${tree(null)}</ul>
          <div class="dr-side-h">Clienti</div>
          <ul class="d-custs">${CUSTOMERS.map((c) => `<li><button type="button" data-cust="${esc(c)}" aria-pressed="${cust === c}">${ic('building')}<span>${esc(c)}</span><small>${FILES.filter((x) => x.customers.includes(c)).length}</small></button></li>`).join('')}</ul>
        </aside>
        <div class="d-main">
          <div class="d-bar">${crumbs()}
            ${cust ? `<span class="d-filter">${ic('building')}${esc(cust)}<button type="button" data-cust="" aria-label="Togli il filtro cliente">${ic('x')}</button></span>` : ''}
            <span class="g-spacer"></span>
            <div class="seg" role="group" aria-label="Vista"><button type="button" data-vm="list" aria-pressed="${viewMode === 'list'}" title="Elenco">${ic('menu')}</button><button type="button" data-vm="grid" aria-pressed="${viewMode === 'grid'}" title="Griglia">${ic('dashboard')}</button></div>
          </div>
          ${sel.size ? `<div class="d-bulk" role="toolbar" aria-label="File selezionati"><b>${sel.size} selezionat${sel.size === 1 ? 'o' : 'i'}</b><button class="btn btn-sm" type="button" data-toast="Si scaricano i file in uno zip">${ic('download')}Scarica</button><button class="btn btn-sm" type="button" data-toast="Si apre «Sposta in…»">${ic('folder')}Sposta</button><button class="btn btn-sm" type="button" data-toast="File spostati nel cestino · Annulla">${ic('trash')}Elimina</button><button type="button" class="link-btn" data-clear>Annulla selezione</button></div>` : ''}
          ${showRecent ? `<div class="d-recent"><div class="dr-side-h">Recenti</div><ul>${recent().map((x) => `<li><button type="button" data-file="${x.id}">${typeTile(x.name, true)}<span class="d-n"><b>${esc(x.name)}</b><small>${esc(fo(x.folder).name)} · ${rel(x.upd)}</small></span></button></li>`).join('')}</ul></div>` : ''}
          ${L.flat ? `<div class="d-count">${L.folders.length + L.files.length} risultati${q ? ` per «${esc(q)}»` : ''}${cust ? ` · cliente ${esc(cust)}` : ''}</div>` : ''}
          ${!L.folders.length && !L.files.length ? `<div class="d-empty">${ic('upload')}<div><b>${L.flat ? 'Nessun risultato' : 'Cartella vuota'}</b><p>${L.flat ? 'Prova con un altro nome.' : 'Trascina qui i file o usa «Carica file».'}</p></div></div>`
            : viewMode === 'grid' ? `<ul class="d-grid">${L.folders.map((f) => `<li><button type="button" class="d-gi is-folder" data-go="${f.id}"><span class="d-gthumb">${folderIcon(64, f)}</span><b>${esc(f.name)}</b><small>${deepFiles(f.id).length} file</small></button></li>`).join('')}${L.files.map((x) => `<li><button type="button" class="d-gi" data-file="${x.id}"><span class="d-gthumb">${thumb(x)}</span><b>${esc(x.name)}</b><small>${size(x.size)} · ${rel(x.upd)}</small></button></li>`).join('')}</ul>`
            : `<div class="table-wrap"><table class="d-tbl"><thead><tr><th class="d-c-sel"></th><th>Nome</th><th>Cliente</th><th class="num">Dimensione</th><th aria-sort="descending">Modificato</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`}
          <div class="d-drop" aria-hidden="${!dragging}">${ic('upload')}<b>Rilascia per caricare in ${esc(cur ? fo(cur).name : 'Drive')}</b><small>max 25 MB per file · niente eseguibili</small></div>
        </div>
      </section>`;
  };
  const thumb = (x) => { const [, k] = TYPE(x.name); return k === 'img' ? '<span class="d-photo"></span>' : k === 'pdf' ? '<span class="d-page"><i></i><i></i><i></i><i></i></span>' : typeTile(x.name, true); };

  // ════════ B · Archivio ════════
  const folderB = (f) => {
    const fs = deepFiles(f.id); const top = [...fs].sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 3);
    return `<li><button type="button" class="w-fold-btn" data-go="${f.id}" aria-label="Apri ${esc(f.name)}, ${fs.length} file">
      <span class="w-fold d-manila">
        <span class="w-fold-tab"><span>${fs.length} file${kids(f.id).length ? ` · ${kids(f.id).length} cartelle` : ''}</span></span>
        <span class="w-fold-back"></span>
        <span class="w-fold-sheets" aria-hidden="true">${top.map((x, i) => `<span class="w-sheet s${i}"><b>${esc(x.name)}</b><i></i><i></i></span>`).join('')}</span>
        <span class="w-fold-front"><span class="w-fold-ico">${ic(f.customers.length ? 'building' : 'folder')}</span><span class="w-fold-name">${esc(f.name)}${f.restricted ? ' ' + ic('lock') : ''}</span>
          <span class="w-fold-desc">${f.customers.length ? 'Cliente · ' + esc(f.customers.join(', ')) : kids(f.id).map((k) => k.name).join(' · ')}</span>
          <span class="w-fold-foot">${top[0] ? `ultimo file ${rel(top[0].upd)}` : 'vuota'}</span></span>
      </span></button></li>`;
  };
  const doc = (x, i = 0) => `<li style="--r:${[-0.8, 0.6, -0.3, 0.9, -0.5, 0.3][i % 6]}deg"><button type="button" class="d-doc${selFile === x.id ? ' is-on' : ''}" data-file="${x.id}">
      <span class="d-doc-top">${typeTile(x.name)}<span class="d-doc-size">${size(x.size)}</span></span>
      <span class="d-doc-prev">${thumb(x)}</span>
      <b class="d-doc-t">${esc(x.name)}</b>
      <span class="d-doc-f">${x.customers[0] ? `<span class="d-stamp">${esc(x.customers[0])}</span>` : `<span>${esc(fo(x.folder).name)}</span>`}<span>${rel(x.upd)}</span></span>
    </button></li>`;
  const renderB = () => {
    const L = listing();
    const tools = `<div class="w-d-tools d-b-tools"><label class="search w-search">${ic('search')}<input data-q value="${esc(q)}" placeholder="Cerca in tutto il Drive" aria-label="Cerca nel Drive"></label>
      <div class="w-chips" role="group" aria-label="Cliente">${CUSTOMERS.map((c) => `<button type="button" class="w-chip" data-cust="${esc(c)}" aria-pressed="${cust === c}">${ic('building')}${esc(c)}</button>`).join('')}${cust ? '<button type="button" class="link-btn" data-cust="">Tutti i clienti</button>' : ''}</div></div>`;
    if (L.flat) {
      return `${head()}${tools}<div class="d-count">${L.folders.length + L.files.length} risultati${q ? ` per «${esc(q)}»` : ''}${cust ? ` · cliente ${esc(cust)}` : ''}</div>
        ${L.folders.length ? `<ul class="d-subs">${L.folders.map((f) => `<li><button type="button" class="d-sub" data-go="${f.id}">${ic('folder')}<span>${esc(f.name)}</span><small>${deepFiles(f.id).length}</small></button></li>`).join('')}</ul>` : ''}
        <ul class="d-docs">${L.files.map(doc).join('')}</ul>`;
    }
    if (!cur) {
      return `${head()}${tools}
        <section class="w-e-sec d-b-recent" aria-labelledby="dr"><header><h2 id="dr">Sul tavolo</h2><span>gli ultimi file caricati o modificati</span></header><ul class="d-docs is-row">${recent().map(doc).join('')}</ul></section>
        <section class="w-e-sec" aria-labelledby="df"><header><h2 id="df">Archivio</h2><span>${FOLDERS.filter((f) => !f.parent).length} cartelle · ${FILES.length} file</span></header>
          <ul class="w-folders d-folders">${FOLDERS.filter((f) => !f.parent).map(folderB).join('')}</ul></section>`;
    }
    const f = fo(cur); const sibs = FOLDERS.filter((x) => x.parent === f.parent);
    return `${head()}${tools}${crumbs()}
      <section class="w-open d-open" aria-label="${esc(f.name)}">
        <div class="w-open-tabs" role="tablist" aria-label="Cartelle">${sibs.map((x) => x.id === cur
          ? `<div class="w-open-tab" role="tab" aria-selected="true"><span class="w-fold-ico">${ic(x.customers.length ? 'building' : 'folder')}</span><h2>${esc(x.name)}</h2><small>${deepFiles(x.id).length} file</small></div>`
          : `<button type="button" class="w-side-tab" role="tab" aria-selected="false" data-go="${x.id}">${ic(x.customers.length ? 'building' : 'folder')}<span>${esc(x.name)}</span></button>`).join('')}</div>
        <div class="w-open-in${dragging ? ' is-drop' : ''}" data-drop>
          <div class="d-open-h">${f.customers.length && f.customers.join() !== f.name ? `<span class="d-stamp is-big">${ic('building')}${esc(f.customers.join(', '))}</span>` : f.customers.length ? `<span class="d-lockline">${ic('building')}Cartella del cliente</span>` : ''}${f.restricted ? `<span class="d-lockline">${ic('lock')}Visibile solo ad alcuni gruppi</span>` : ''}<span class="g-spacer"></span><span class="d-drop-hint">${ic('upload')}Trascina qui i file per caricarli in «${esc(f.name)}»</span></div>
          ${kids(cur).length ? `<ul class="d-subs">${kids(cur).map((k) => `<li><button type="button" class="d-sub" data-go="${k.id}">${ic('folder')}<span>${esc(k.name)}</span>${lock(k)}<small>${deepFiles(k.id).length}</small></button></li>`).join('')}</ul>` : ''}
          ${filesIn(cur).length ? `<ul class="d-docs">${filesIn(cur).sort((a, b) => b.upd.localeCompare(a.upd)).map(doc).join('')}</ul>` : (!kids(cur).length ? `<div class="d-empty">${ic('upload')}<div><b>Cartella vuota</b><p>Trascina qui i file o usa «Carica file».</p></div></div>` : '')}
          <div class="d-drop" aria-hidden="${!dragging}">${ic('upload')}<b>Rilascia per caricare in ${esc(f.name)}</b><small>max 25 MB per file · niente eseguibili</small></div>
        </div>
      </section>`;
  };

  // ── Pannello del file (comune) ─────────────────────────────────────
  const drawer = $('[data-w-drawer]'); const shell = $('.shell');
  const ago = (s0, n) => { const d = new Date(Date.parse(s0) - n * 864e5); return d.toISOString().slice(0, 10); };
  const openFile = (id) => {
    const x = FILES.find((y) => y.id === id); if (!x) return;
    selFile = id; const [, k] = TYPE(x.name); const ext = x.name.split('.').pop().toUpperCase();
    const folderPath = path(x.folder); const guard = [...folderPath].reverse().find((f) => f.restricted);
    const created = ago(x.upd, x.id % 3 === 0 ? 4 : 0);
    const events = [
      { ic: 'upload', t: `<b>${x.by}</b> lo ha caricato in «${esc(fo(x.folder).name)}»`, d: created },
      ...(x.customers.length ? [{ ic: 'building', t: `<b>${x.by}</b> lo ha collegato a ${esc(x.customers.join(', '))}`, d: created }] : []),
      ...(x.renamed ? [{ ic: 'copy', t: `<b>L. Romano</b> lo ha rinominato da «${esc(x.renamed)}»`, d: x.upd }] : []),
      ...(x.moved ? [{ ic: 'folder', t: `<b>F. Mutuale</b> lo ha spostato da «${esc(x.moved)}»`, d: x.upd }] : []),
    ].reverse();
    const siblings = FILES.filter((y) => y.folder === x.folder && y.id !== x.id).slice(0, 3);
    $('[data-wd="id"]').innerHTML = '';
    $('[data-wd="title"]').innerHTML = `<span class="d-fd-title">${fileIcon(x.name, 34)}<span>${esc(x.name)}</span></span>`;
    $('[data-wd="sub"]').textContent = '';
    $('[data-wbody]').innerHTML = `<div class="drawer-body d-fd">
        <div class="d-fd-prev t-${k}">
          ${k === 'img' ? '<span class="d-photo is-big"></span>' : k === 'pdf' ? '<span class="d-page is-big"><i></i><i></i><i></i><i></i><i></i><i></i></span>' : `<span class="d-noprev">${fileIcon(x.name, 72)}<small>Nessuna anteprima per i file ${ext}: si apre dopo averlo scaricato</small></span>`}
          ${k === 'img' || k === 'pdf' ? `<button type="button" class="d-fd-open" data-toast="Si apre l'anteprima a tutto schermo">${ic('eye')}Apri anteprima</button>` : ''}
        </div>
        <div class="d-fd-acts">
          <button class="btn btn-primary" type="button" data-dl="${x.id}">${ic('download')}Scarica</button>
          <button class="btn" type="button" data-toast="Link copiato: chi lo apre deve avere accesso alla cartella">${ic('copy')}Copia link</button>
          <button class="icon-btn" type="button" data-toast="Si apre «Rinomina»" title="Rinomina" aria-label="Rinomina">${ic('file')}</button>
          <button class="icon-btn" type="button" data-toast="Si apre «Sposta in…»" title="Sposta" aria-label="Sposta">${ic('folder')}</button>
          <button class="icon-btn d-danger" type="button" data-toast="File spostato nel cestino · Annulla" title="Sposta nel cestino" aria-label="Sposta nel cestino">${ic('trash')}</button>
        </div>
        <section class="d-fd-sec"><h4>Dettagli</h4>
          <dl class="d-props">
            <div><dt>Tipo</dt><dd>${KIND[k] || 'File'} <span class="d-ext">.${ext.toLowerCase()}</span></dd></div>
            <div><dt>Dimensione</dt><dd>${size(x.size)}</dd></div>
            <div><dt>Percorso</dt><dd class="d-path"><button type="button" data-go="">Drive</button>${folderPath.map((f) => `<span>/</span><button type="button" data-go="${f.id}">${esc(f.name)}</button>`).join('')}</dd></div>
            <div><dt>Caricato</dt><dd>${dshort(created)} 2026 · ${x.by}</dd></div>
            <div><dt>Modificato</dt><dd>${dshort(x.upd)} 2026 · ${rel(x.upd)}</dd></div>
          </dl>
        </section>
        <section class="d-fd-sec"><h4>Clienti <span>${x.customers.length}</span></h4>
          <div class="d-fd-chips">${x.customers.map((c) => `<span class="d-cust is-big">${ic('building')}${esc(c)}<button type="button" aria-label="Scollega ${esc(c)}" data-toast="Cliente scollegato · Annulla">${ic('x')}</button></span>`).join('')}<button type="button" class="d-add" data-toast="Si apre la scelta del cliente">${ic('plus')}Collega un cliente</button></div>
          ${x.customers.length ? '<p class="d-fd-note">Il file compare anche nella scheda del cliente.</p>' : ''}
        </section>
        <section class="d-fd-sec"><h4>Chi può vederlo</h4>
          ${guard ? `<div class="d-vis is-locked">${ic('lock')}<div><b>Solo i gruppi ${guard.groups.map((g) => `<span class="d-grp">${esc(g)}</span>`).join(' ')}</b><small>Regola della cartella «${esc(guard.name)}»: vale per tutto quello che contiene.</small></div></div>`
            : `<div class="d-vis">${ic('users')}<div><b>Tutti gli utenti di Archie</b><small>Nessuna restrizione sulle cartelle che lo contengono.</small></div></div>`}
        </section>
        <section class="d-fd-sec"><h4>Note</h4>
          ${x.notes ? `<p class="d-notes">${esc(x.notes)}</p>` : ''}<button type="button" class="d-add" data-toast="Si apre la nota in modifica">${ic(x.notes ? 'file' : 'plus')}${x.notes ? 'Modifica la nota' : 'Aggiungi una nota'}</button>
        </section>
        <section class="d-fd-sec"><h4>Attività</h4>
          <ol class="d-tl2">${events.map((e) => `<li>${ic(e.ic)}<span>${e.t}</span><time>${rel(e.d)}</time></li>`).join('')}</ol>
        </section>
        ${siblings.length ? `<section class="d-fd-sec"><h4>Nella stessa cartella</h4><ul class="d-sibs">${siblings.map((y) => `<li><button type="button" data-file="${y.id}">${fileIcon(y.name, 24)}<span class="d-n"><b>${esc(y.name)}</b><small>${size(y.size)} · ${rel(y.upd)}</small></span></button></li>`).join('')}</ul></section>` : ''}
      </div>`;
    $('[data-wbody]').setAttribute('data-dc', '3');
    drawer.hidden = false; shell.classList.add('has-drawer'); paint();
  };
  const closeDrawer = () => { drawer.hidden = true; shell.classList.remove('has-drawer'); selFile = null; paint(); };
  $('[data-wclose]').addEventListener('click', closeDrawer);

  // ── Render e interazioni ───────────────────────────────────────────
  const paint = (keepFocus) => {
    const pos = keepFocus && document.activeElement?.matches?.('[data-q]') ? document.activeElement.selectionStart : null;
    root.className = `content w-content d-v-${v}`;
    root.innerHTML = v === 'a' ? renderA() : renderB();
    if (pos != null) { const el = $('[data-q]', root); el.focus(); el.setSelectionRange(pos, pos); }
  };
  const toastEl = $('[data-toast]'); let tt = null;
  const toast = (m) => { toastEl.innerHTML = `${tick}<span>${esc(m)}</span>`; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3200); };

  document.addEventListener('click', (e) => {
    const t = (s) => e.target.closest(s); let el;
    if (!root.contains(e.target) && !drawer.contains(e.target)) return;
    if ((el = t('[data-sel]'))) { e.stopPropagation(); const id = Number(el.dataset.sel); sel.has(id) ? sel.delete(id) : sel.add(id); paint(); return; }
    if (t('[data-clear]')) { sel.clear(); paint(); return; }
    if ((el = t('[data-dl]'))) { toast(`Download di ${FILES.find((x) => x.id === Number(el.dataset.dl)).name}`); return; }
    if ((el = t('[data-toast]'))) { toast(el.dataset.toast); return; }
    if (t('[data-upload]')) { dragging = true; paint(); setTimeout(() => { dragging = false; paint(); toast(`2 file caricati in ${cur ? fo(cur).name : 'Drive'}`); }, 1200); return; }
    if ((el = t('[data-tw]'))) { const id = Number(el.dataset.tw); open.has(id) ? open.delete(id) : open.add(id); paint(); return; }
    if ((el = t('[data-go]'))) { const id = el.dataset.go ? Number(el.dataset.go) : null; cur = id; q = ''; cust = null; sel.clear(); path(id ?? 0).forEach((f) => open.add(f.id)); if (drawer.contains(e.target)) { drawer.hidden = true; shell.classList.remove('has-drawer'); selFile = null; } paint(); root.scrollTop = 0; return; }
    if ((el = t('[data-file]'))) { openFile(Number(el.dataset.file)); return; }
    if ((el = t('[data-cust]'))) { cust = el.dataset.cust && cust !== el.dataset.cust ? el.dataset.cust : null; paint(); return; }
    if ((el = t('[data-vm]'))) { viewMode = el.dataset.vm; paint(); }
  });
  root.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { q = e.target.value; paint(true); } });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-go], tr[data-file]')) e.target.click(); });
  // Trascinamento di file dal computer: tutta l'area accetta il rilascio.
  root.addEventListener('dragover', (e) => { if (e.target.closest('[data-drop]')) { e.preventDefault(); if (!dragging) { dragging = true; paint(); } } });
  root.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !root.contains(e.relatedTarget)) { dragging = false; paint(); } });
  root.addEventListener('drop', (e) => { e.preventDefault(); dragging = false; paint(); toast(`${e.dataTransfer?.files?.length || 1} file caricati in ${cur ? fo(cur).name : 'Drive'}`); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

  const vbtns = document.querySelectorAll('[data-var-btn]');
  const setV = (x) => { v = x; vbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.varBtn === v))); try { localStorage.setItem('archie-preview-d-var', v); } catch (err) { /* niente */ } paint(); };
  vbtns.forEach((b) => b.addEventListener('click', () => setV(b.dataset.varBtn)));
  const qs = new URLSearchParams(location.search);
  let saved = null; try { saved = localStorage.getItem('archie-preview-d-var'); } catch (err) { /* niente */ }
  v = qs.get('v') || saved || 'a';
  if (qs.get('f')) { cur = Number(qs.get('f')); path(cur).forEach((f) => open.add(f.id)); }
  if (qs.get('vm')) viewMode = qs.get('vm');
  vbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.varBtn === v)));
  paint();
  if (qs.get('file')) openFile(Number(qs.get('file')));
})();
