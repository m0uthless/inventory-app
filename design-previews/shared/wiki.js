/* Wiki: tre proposte sullo stile "Campo sterile" (base h).
   Modello reale: wiki.WikiPage (codice KB, titolo, categoria, pagina padre, riepilogo, tag,
   contenuto, pubblicata, letture, voto medio, allegati, revisioni a ogni salvataggio) e WikiLink
   verso cliente/sito/inventario. Le credenziali NON stanno nella Wiki: restano nell'inventario.
   Dati finti. Oggi: 06/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tick = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const clip = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';
  const star = (on) => `<svg class="i star${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.textContent.trim().startsWith('Wiki');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ── Categorie (il colore è un dato della categoria: solo come quadratino) ──
  const CATS = [
    { id: 'proc', name: 'Procedure', color: '#3b7a57', desc: 'Come fare una cosa, passo per passo.' },
    { id: 'acc', name: 'Accessi e VPN', color: '#2f5f9e', desc: 'Come raggiungere i sistemi dei clienti. Le credenziali restano nell\'inventario.' },
    { id: 'sys', name: 'Sistemi PACS e RIS', color: '#6a4c93', desc: 'Funzionamento, errori noti e configurazioni dei sistemi.' },
    { id: 'chk', name: 'Checklist e collaudi', color: '#9a6a00', desc: 'Controlli da spuntare con il reparto.' },
    { id: 'cli', name: 'Schede cliente', color: '#8a4f3d', desc: 'Nodi, finestre di manutenzione e particolarità di ogni cliente.' },
    { id: 'int', name: 'Interne', color: '#5b6b67', desc: 'Regole e strumenti di Biotron.' },
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

  // ── Pagine ─────────────────────────────────────────────────────────
  const P = (id, title, cat, body, upd, by, views, rating, votes, att, extra = {}) => ({
    id, kb: 'KB0000' + id, title, cat, body, upd, by, views, rating, votes, att, tags: [], links: [], summary: '', rev: 3, draft: false, parent: null, author: by, ...extra,
  });
  const PAGES = [
    P(864, 'Reset della worklist sulla modalità CT', 'proc', 'proc', '2026-11-04', 'L. Romano', 214, 4.6, 12, 2, { summary: 'La modalità non mostra gli esami pianificati: svuotare la coda del broker, riavviarlo e verificare con C-ECHO.', tags: ['worklist', 'MWL', 'CT'], links: [['cliente', 'AUSL Imola'], ['inventario', 'CT 2 · S. Maria della Scaletta']], rev: 6, author: 'F. Mutuale' }),
    P(871, 'Accesso VPN AUSL Imola con FortiClient', 'acc', 'proc', '2026-10-28', 'F. Mutuale', 168, 4.4, 9, 1, { summary: 'Profilo FortiClient, rinnovo ogni 90 giorni e cosa fare quando il token non arriva.', tags: ['VPN', 'FortiClient'], links: [['cliente', 'AUSL Imola']] }),
    P(887, 'Regole firewall per il traffico DICOM fra sedi', 'sys', 'proc', '2026-10-19', 'A. Ferri', 97, 4.1, 5, 0, { summary: 'Porte da aprire fra modalità, PACS e RIS e come verificarle prima di chiamare la rete del cliente.', tags: ['DICOM', 'firewall'] }),
    P(902, 'Collaudo della modalità prima della consegna', 'chk', 'check', '2026-11-02', 'M. Romanelli', 131, 4.8, 7, 3, { summary: 'I controlli da firmare con il reparto: rete, worklist, invio al PACS, stampa, dose SR.', tags: ['collaudo', 'consegna'] }),
    P(910, 'AUSL Imola · nodi DICOM e sistemi', 'cli', 'ref', '2026-11-05', 'L. Romano', 189, 4.5, 6, 1, { summary: 'Host, AE title e porte di PACS, RIS e modalità; finestre di manutenzione e particolarità.', tags: ['AUSL Imola', 'nodi'], links: [['cliente', 'AUSL Imola'], ['sito', 'S. Maria della Scaletta']], rev: 9 }),
    P(911, 'ASUFC Udine · nodi DICOM e sistemi', 'cli', 'ref', '2026-10-12', 'A. Ferri', 88, 4.3, 3, 0, { summary: 'Nodi del PACS regionale e delle modalità di S. Maria della Misericordia e San Daniele.', tags: ['ASUFC', 'nodi'], links: [['cliente', 'ASUFC Udine']] }),
    P(915, 'IRCCS Rizzoli · nodi DICOM e sistemi', 'cli', 'ref', '2026-09-30', 'A. Ferri', 54, 0, 0, 0, { summary: 'Nodi e gateway RIS della sede di via Pupilli.', links: [['cliente', 'IRCCS Rizzoli']] }),
    P(920, 'Riavvio ordinato del PACS', 'proc', 'proc', '2026-10-21', 'F. Mutuale', 142, 4.7, 10, 1, { summary: "L'ordine dei servizi da fermare e riavviare per non perdere studi in arrivo.", tags: ['PACS', 'riavvio'] }),
    P(925, 'Rinnovo del certificato TLS del gateway RIS', 'proc', 'proc', '2026-10-31', 'A. Ferri', 61, 4.0, 2, 1, { summary: 'Generare la richiesta, installare il certificato e riavviare il gateway senza fermare gli ORM.', tags: ['TLS', 'RIS'], links: [['cliente', 'IRCCS Rizzoli']] }),
    P(930, 'Esportare immagini su CD per il paziente', 'proc', 'proc', '2026-08-14', 'M. Romanelli', 77, 3.9, 4, 0, { summary: 'Masterizzazione con viewer incluso e cosa rispondere quando il CD non parte.' }),
    P(933, 'Stampante DryView 5950: errori frequenti', 'sys', 'proc', '2026-10-25', 'M. Romanelli', 102, 4.2, 6, 2, { summary: 'Codici di errore più comuni, cosa significano e quando chiamare il fornitore.', tags: ['stampante', 'DryView'], links: [['cliente', 'ASREM Molise']] }),
    P(940, 'Configurare un nuovo nodo DICOM sul PACS', 'proc', 'proc', '2026-10-08', 'L. Romano', 119, 4.5, 8, 0, { summary: 'Aggiungere AE title, porta e permessi; poi verificare con C-ECHO e C-STORE.', tags: ['DICOM', 'PACS'] }),
    P(941, 'Verifica con C-ECHO e C-STORE', 'proc', 'proc', '2026-10-08', 'L. Romano', 66, 4.4, 3, 0, { parent: 940, summary: 'I due test da fare dopo ogni nuovo nodo e come leggerne l\'esito.', tags: ['DICOM'] }),
    P(945, 'Dose SR: inoltro al registro dose', 'sys', 'proc', '2026-10-30', 'A. Ferri', 58, 4.0, 2, 0, { summary: 'Regole di instradamento dei DICOM SR di dose e controlli quando non arrivano.', tags: ['dose', 'SR'] }),
    P(950, 'Checklist di fine intervento', 'chk', 'check', '2026-10-17', 'F. Mutuale', 156, 4.6, 11, 0, { summary: 'Prima di lasciare il reparto: rapportino, foto, test con il TSRM, issue aggiornata.' }),
    P(955, 'Onboarding di un nuovo tecnico', 'int', 'check', '2026-09-22', 'F. Mutuale', 41, 5.0, 2, 1, { summary: 'Accessi da chiedere, strumenti, prime giornate in affiancamento.' }),
    P(960, 'Rapportini: come compilarli', 'int', 'proc', '2026-09-10', 'L. Romano', 73, 4.1, 5, 0, { summary: 'Campi obbligatori, firma del reparto e invio in amministrazione.' }),
    P(962, 'Rimborso spese: regole e massimali', 'int', 'proc', '2026-09-03', 'F. Mutuale', 95, 4.3, 7, 1, { summary: 'Cosa si rimborsa, con quali ricevute e entro quando.' }),
    P(970, 'Backup notturno: controlli del lunedì', 'proc', 'proc', '2026-11-06', 'F. Mutuale', 3, 0, 0, 0, { draft: true, summary: 'Bozza: verifica dei job di backup del fine settimana sui PACS in assistenza.' }),
    P(975, 'ASREM Molise · nodi DICOM e sistemi', 'cli', 'ref', '2026-10-02', 'M. Romanelli', 47, 4.0, 1, 0, { summary: 'Nodi dell\'Ospedale Cardarelli e stampanti in rete.', links: [['cliente', 'ASREM Molise']] }),
    P(980, 'Accesso VPN ASUFC Udine con GlobalProtect', 'acc', 'proc', '2026-10-14', 'A. Ferri', 83, 4.2, 4, 0, { summary: 'Portale, gruppo da chiedere al cliente e problemi noti con il secondo fattore.', tags: ['VPN', 'GlobalProtect'], links: [['cliente', 'ASUFC Udine']] }),
    P(985, 'Utenze di servizio: quando e come', 'acc', 'proc', '2026-11-03', 'L. Romano', 12, 0, 0, 0, { draft: true, summary: 'Bozza: quando creare un\'utenza di servizio sul sistema del cliente e dove registrarla.' }),
  ];
  const page = (id) => PAGES.find((p) => p.id === id);
  const ME = 'F. Mutuale';
  const TODAY = '2026-11-06';

  // ── Contenuti (tre tipi: procedura, scheda di riferimento, checklist) ──
  const code = (txt) => `<div class="w-code"><pre><code>${esc(txt)}</code></pre><button type="button" class="icon-btn w-copy" data-copy="${esc(txt)}" aria-label="Copia il comando" title="Copia">${ic('copy')}</button></div>`;
  const kbl = (id, label) => `<a href="#" class="w-kb" data-open="${id}">${label ?? esc(page(id).title)}</a>`;
  const BODY = {
    proc: () => `
      <h2 id="s-quando">Quando serve</h2>
      <p>La modalità non mostra gli esami pianificati anche se nel RIS risultano accettati. Succede di solito dopo un riavvio del broker di worklist o dopo un cambio di AE title sulla modalità.</p>
      <div class="w-note is-warn">${ic('alert')}<p>Avvisa il coordinatore TSRM prima di iniziare: per circa 5 minuti la modalità non riceve nuovi esami.</p></div>
      <h2 id="s-prima">Prima di iniziare</h2>
      <ul>
        <li>Accesso VPN al cliente: ${kbl(871)}.</li>
        <li>Credenziali del broker: dall'<a href="#" class="w-ent">${ic('server')}inventario del cliente</a>, non da questa pagina.</li>
        <li>AE title e porta della modalità: ${kbl(910, 'AUSL Imola · nodi DICOM')}.</li>
      </ul>
      <h2 id="s-proc">Procedura</h2>
      <ol class="w-steps" data-steps>
        <li><p>Dalla console della modalità apri <b>Service › Network › DICOM nodes</b> e annota AE title e porta del worklist provider.</p></li>
        <li><p>Sul broker svuota la coda dei messaggi rimasti per quella modalità:</p>${code('mwl-cli queue --purge --ae CT2_SCALETTA')}</li>
        <li><p>Riavvia il servizio del broker:</p>${code('sudo systemctl restart mwl-broker')}</li>
        <li><p>Dalla modalità esegui <b>Verify</b> (C-ECHO) verso il broker: deve rispondere <i>Success</i>.</p></li>
        <li><p>Aggiorna la worklist e controlla che compaiano gli esami di oggi.</p></li>
      </ol>
      <h2 id="s-verifica">Verifica</h2>
      <div class="w-table"><table><thead><tr><th>Controllo</th><th>Esito atteso</th></tr></thead><tbody>
        <tr><td>C-ECHO dalla modalità</td><td>Success</td></tr>
        <tr><td>Query della worklist</td><td>Almeno un esame del giorno</td></tr>
        <tr><td>Log del broker</td><td>Nessun <code>Association rejected</code></td></tr>
      </tbody></table></div>
      <h2 id="s-ko">Se non funziona</h2>
      <p>Se il C-ECHO fallisce controlla le regole del firewall (${kbl(887)}). Se gli esami restano assenti, apri una issue con priorità Alta e allega il log del broker.</p>`,
    ref: () => `
      <div class="w-note is-info">${ic('lock')}<p>Le credenziali stanno nell'inventario del cliente e si leggono con il permesso dedicato. Qui solo nodi e riferimenti.</p></div>
      <h2 id="s-nodi">Nodi DICOM</h2>
      <div class="w-table"><table><thead><tr><th>Sistema</th><th>Host</th><th>AE title</th><th class="num">Porta</th></tr></thead><tbody>
        ${[['PACS · archivio', 'pacs-arc.ausl.imola.local', 'IMO_ARC', 104], ['RIS · worklist', 'ris-mwl.ausl.imola.local', 'IMO_MWL', 3320], ['CT 2', '10.40.12.31', 'CT2_SCALETTA', 104], ['RM 1', '10.40.12.44', 'RM1_SCALETTA', 104], ['Stampante DryView', '10.40.12.60', 'DRY_SCALETTA', 5040]]
          .map(([s, h, ae, p]) => `<tr><td>${s}</td><td><span class="w-mono" data-copy="${h}" title="Copia">${h}</span></td><td><span class="w-mono" data-copy="${ae}" title="Copia">${ae}</span></td><td class="num">${p}</td></tr>`).join('')}
      </tbody></table></div>
      <h2 id="s-man">Manutenzione e finestre</h2>
      <ul>
        <li>Finestra concordata: <b>martedì 13–15</b>; fuori finestra solo con l'ok del coordinatore TSRM.</li>
        <li>La VPN scade ogni 90 giorni: ${kbl(871, 'rinnovo FortiClient')}.</li>
        <li>Il piano di manutenzione del PACS è in <a href="#" class="w-ent">${ic('wrench')}Manutenzione · AUSL Imola</a>.</li>
      </ul>
      <h2 id="s-part">Particolarità</h2>
      <p>Il RIS invia gli ORM alla worklist solo se il medico refertante è già assegnato. Se un esame manca in modalità, controllalo prima nel RIS: spesso è questo.</p>
      <p>La CT 2 ha un AE title diverso dal nome a schermo: cerca <code>CT2_SCALETTA</code>, non <code>CT-02</code>.</p>`,
    check: () => `
      <h2 id="s-uso">Come usarla</h2>
      <p>Spunta i controlli mentre li fai con il reparto. Le spunte restano solo su questo dispositivo: il verbale firmato va allegato al rapportino.</p>
      <h2 id="s-rete">Rete e worklist</h2>
      <ol class="w-steps" data-steps>
        <li><p>C-ECHO dalla modalità verso PACS e worklist: entrambi <i>Success</i>.</p></li>
        <li><p>Worklist: compaiono gli esami del giorno con nome, ID e accession number corretti.</p></li>
        <li><p>Invio di uno studio di prova al PACS e verifica che arrivi completo.</p></li>
      </ol>
      <h2 id="s-uscite">Stampa e dose</h2>
      <ol class="w-steps" data-steps>
        <li><p>Stampa di prova sulla DryView con il layout del reparto.</p></li>
        <li><p>Dose SR inoltrato al registro (${kbl(945)}).</p></li>
      </ol>
      <h2 id="s-firma">Consegna</h2>
      <ol class="w-steps" data-steps>
        <li><p>Verbale firmato dal coordinatore TSRM e allegato al rapportino.</p></li>
        <li><p>Inventario aggiornato con seriale e versione software.</p></li>
      </ol>`,
  };
  const TOC = {
    proc: [['s-quando', 'Quando serve'], ['s-prima', 'Prima di iniziare'], ['s-proc', 'Procedura'], ['s-verifica', 'Verifica'], ['s-ko', 'Se non funziona']],
    ref: [['s-nodi', 'Nodi DICOM'], ['s-man', 'Manutenzione e finestre'], ['s-part', 'Particolarità']],
    check: [['s-uso', 'Come usarla'], ['s-rete', 'Rete e worklist'], ['s-uscite', 'Stampa e dose'], ['s-firma', 'Consegna']],
  };
  const TEXT = { proc: 'worklist broker coda C-ECHO modalità firewall riavvio servizio issue log AE title porta', ref: 'nodi DICOM host AE title porta PACS RIS worklist manutenzione VPN refertante', check: 'C-ECHO worklist studio PACS stampa DryView dose SR verbale inventario seriale' };

  // ── Date e formati ─────────────────────────────────────────────────
  const MSH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const dshort = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MSH[m - 1]}${y !== 2026 ? ' ' + y : ''}`; };
  const daysAgo = (s) => Math.round((Date.parse(TODAY) - Date.parse(s)) / 864e5);
  const rel = (s) => { const n = daysAgo(s); return n === 0 ? 'oggi' : n === 1 ? 'ieri' : n < 7 ? `${n} giorni fa` : dshort(s); };
  const num = (n) => String(n).replace('.', ',');
  const r1 = (n) => n.toFixed(1).replace('.', ',');
  const sw = (c) => `<span class="w-sw" style="--c:${CAT[c].color}" aria-hidden="true"></span>`;
  const catLabel = (c) => `<span class="w-cat">${sw(c)}${CAT[c].name}</span>`;
  const rating = (p) => p.votes ? `<span class="w-rate" title="${r1(p.rating)} su 5 · ${p.votes} voti">${star(true)}${r1(p.rating)}<small>${p.votes}</small></span>` : '<span class="none">—</span>';
  const draftBadge = '<span class="w-draft">Bozza</span>';

  // ── Stato ──────────────────────────────────────────────────────────
  let v = 'a'; let screen = 'index'; let cur = 864; let tab = 'all'; let q = ''; let cats = new Set(); let libQ = ''; let libOpen = new Set(['proc', 'cli']);
  const done = new Map(); const myVote = new Map([[910, 5]]);
  const root = $('[data-w-root]');

  // ── Testata ────────────────────────────────────────────────────────
  let wSec = 'pages'; let eView = 'folders';
  const SECS = [['pages', 'Pagine', 'book'], ['queries', 'Query', 'columns'], ['stats', 'Statistiche', 'activity']];
  const head = (sub = '') => v === 'e'
    ? `<div class="po-head w-head w-head-e"><h1>Wiki</h1><nav class="w-secs" aria-label="Sezioni della Wiki">${SECS.map(([k, l, i]) => `<button type="button" data-wsec="${k}" aria-current="${wSec === k ? 'page' : 'false'}">${ic(i)}${l}</button>`).join('')}</nav>${sub}<div class="actions">${wSec === 'queries' ? `<button class="btn btn-primary" type="button" data-toast="Si apre il modulo della nuova query">${ic('plus')}Nuova query</button>` : wSec === 'stats' ? '' : `<button class="btn btn-primary" type="button" data-new>${ic('plus')}Nuova pagina</button>`}</div></div>`
    : `<div class="po-head w-head"><h1>Wiki</h1>${sub}<div class="actions"><button class="btn" type="button" data-toast="Si apre la libreria delle query">${ic('book')}Query</button><button class="btn btn-primary" type="button" data-new>${ic('plus')}Nuova pagina</button></div></div>`;

  // ── Ricerca (titolo, riepilogo, testo, tag, collegamenti) ──────────
  const norm = (t) => t.toLowerCase();
  // Il testo finto è condiviso per tipo: si cerca nel corpo solo delle tre pagine che lo hanno davvero.
  const FULL = new Set([864, 910, 902]);
  const hay = (p) => norm([p.title, p.summary, p.tags.join(' '), p.links.map((l) => l[1]).join(' '), FULL.has(p.id) ? TEXT[p.body] : '', p.kb].join(' '));
  const matches = (p, term) => norm(term).split(/\s+/).filter(Boolean).every((w) => hay(p).includes(w));
  const mark = (txt, term) => {
    let out = esc(txt);
    norm(term).split(/\s+/).filter((w) => w.length > 1).forEach((w) => { out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); });
    return out;
  };
  // Passaggio del testo che contiene il termine (per la ricerca C e B).
  const SNIP = {
    proc: ['La modalità non mostra gli esami pianificati anche se nel RIS risultano accettati.', 'Sul broker svuota la coda dei messaggi rimasti per quella modalità.', 'Dalla modalità esegui Verify (C-ECHO) verso il broker: deve rispondere Success.', 'Se il C-ECHO fallisce controlla le regole del firewall.'],
    ref: ['Host, AE title e porte di PACS, RIS e modalità.', 'Il RIS invia gli ORM alla worklist solo se il medico refertante è già assegnato.', 'Finestra concordata: martedì 13–15.'],
    check: ['C-ECHO dalla modalità verso PACS e worklist: entrambi Success.', 'Stampa di prova sulla DryView con il layout del reparto.', 'Verbale firmato dal coordinatore TSRM e allegato al rapportino.'],
  };
  const snippet = (p, term) => {
    const ws = norm(term).split(/\s+/).filter(Boolean);
    const linkHit = p.links.find((l) => ws.some((w) => norm(l[1]).includes(w)));
    const s = [p.summary, ...(FULL.has(p.id) ? SNIP[p.body] : [])].find((x) => ws.some((w) => norm(x).includes(w))) || p.summary;
    return { text: mark(s, term), link: linkHit };
  };

  // ════════ A · Tabella ════════
  const VIEWS = [['all', 'Tutte'], ['recent', 'Aggiornate di recente'], ['top', 'Più lette'], ['mine', 'Mie'], ['draft', 'Bozze']];
  const listFor = (k) => {
    let l = PAGES.filter((p) => (k === 'draft' ? p.draft : !p.draft || p.author === ME));
    if (k === 'recent') l = l.filter((p) => daysAgo(p.upd) <= 30).sort((a, b) => b.upd.localeCompare(a.upd));
    else if (k === 'top') l = l.filter((p) => !p.draft).sort((a, b) => b.views - a.views);
    else if (k === 'mine') l = l.filter((p) => p.author === ME || p.by === ME).sort((a, b) => b.upd.localeCompare(a.upd));
    else if (k === 'all') l = l.sort((a, b) => b.upd.localeCompare(a.upd));
    return l;
  };
  const renderA = () => {
    const pub = PAGES.filter((p) => !p.draft);
    const upd30 = pub.filter((p) => daysAgo(p.upd) <= 30);
    const top = [...pub].sort((a, b) => b.views - a.views)[0];
    const voted = pub.filter((p) => p.votes); const votes = voted.reduce((n, p) => n + p.votes, 0);
    const avg = voted.reduce((n, p) => n + p.rating * p.votes, 0) / votes;
    const byCat = CATS.map((c) => [c, pub.filter((p) => p.cat === c.id).length]);
    let rows = listFor(tab).filter((p) => (!cats.size || cats.has(p.cat)) && (!q || matches(p, q)));
    return `${head()}
      <div class="kpi-wrap"><div class="kpis" role="group" aria-label="Indicatori Wiki">
        <button type="button" class="kpi" data-tab="all" aria-pressed="${tab === 'all'}"><span class="kpi-h">Pagine pubblicate<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${pub.length}</span><span class="kpi-s"><b>${PAGES.length - pub.length}</b>&nbsp;bozze</span></button>
        <button type="button" class="kpi" data-tab="recent" aria-pressed="${tab === 'recent'}"><span class="kpi-h">Aggiornate · 30 giorni<span class="go">${ic('arrowR')}</span></span><span class="kpi-v">${upd30.length}</span><span class="kpi-s">${(() => { const l = [...upd30].sort((a, b) => b.upd.localeCompare(a.upd))[0]; return `ultima&nbsp;<b>${rel(l.upd)}</b>&nbsp;da ${l.by}`; })()}</span></button>
        <button type="button" class="kpi" data-open="${top.id}"><span class="kpi-h">La più letta<span class="go">${ic('arrowR')}</span></span><span class="kpi-v w-kpi-t">${esc(top.title)}</span><span class="kpi-s"><b>${top.views}</b>&nbsp;letture</span></button>
        <div class="kpi"><span class="kpi-h">Valutazione media</span><span class="kpi-v">${num(avg.toFixed(1))}<small>su 5</small></span><span class="kpi-s"><b>${votes}</b>&nbsp;voti su ${voted.length} pagine</span></div>
        <div class="kpi kpi-prio"><span class="kpi-h">Pagine per categoria</span>
          <div class="bar" aria-hidden="true">${byCat.map(([c, n]) => `<span style="flex:${n};background:${c.color}" data-tip="${c.name} · <b>${n}</b>"></span>`).join('')}</div>
          <div class="lg">${byCat.slice(0, 4).map(([c, n]) => `<button type="button" data-cat="${c.id}" aria-pressed="${cats.has(c.id)}"><i style="background:${c.color}"></i>${c.name.split(' ')[0]} <b>${n}</b></button>`).join('')}</div></div>
      </div></div>
      <section class="panel" aria-label="Pagine">
        <div class="vtabs" role="group" aria-label="Viste">${VIEWS.map(([k, l]) => `<button type="button" aria-pressed="${tab === k}" data-tab="${k}">${l} <span>${listFor(k).length}</span></button>`).join('')}</div>
        <div class="w-tools">
          <label class="search w-search">${ic('search')}<input data-q value="${esc(q)}" placeholder="Cerca titolo, testo, tag, cliente collegato…" aria-label="Cerca nella Wiki"></label>
          <div class="w-chips" role="group" aria-label="Categoria">${CATS.map((c) => `<button type="button" class="w-chip" data-cat="${c.id}" aria-pressed="${cats.has(c.id)}">${sw(c.id)}${c.name}</button>`).join('')}${cats.size ? '<button type="button" class="link-btn" data-cat="">Tutte</button>' : ''}</div>
        </div>
        <div class="table-wrap"><table class="w-tbl">
          <thead><tr><th class="c-kb">Codice</th><th>Titolo</th><th>Categoria</th><th aria-sort="descending"><span class="sort">Aggiornata${ic('chevD')}</span></th><th class="num">Letture</th><th>Voto</th><th class="num" aria-label="Allegati">${clip}</th></tr></thead>
          <tbody>${rows.length ? rows.map((p) => `<tr tabindex="0" data-open="${p.id}">
            <td class="c-kb">${p.kb}</td>
            <td class="c-wt"><span class="t">${q ? mark(p.title, q) : esc(p.title)}${p.draft ? draftBadge : ''}</span><span class="s">${q ? snippet(p, q).text : esc(p.summary)}</span></td>
            <td>${catLabel(p.cat)}</td>
            <td><span class="w-upd">${rel(p.upd)}</span><span class="w-by">${p.by}</span></td>
            <td class="num">${p.views}</td>
            <td>${rating(p)}</td>
            <td class="num">${p.att ? p.att : '<span class="none">—</span>'}</td></tr>`).join('') : `<tr class="w-empty"><td colspan="7">${ic('search')}Nessuna pagina per «${esc(q)}». <button type="button" class="link-btn" data-new>Crea «${esc(q)}»</button></td></tr>`}</tbody>
        </table></div>
        <div class="w-foot">${rows.length} di ${PAGES.length} pagine</div>
      </section>`;
  };

  // ════════ B · Biblioteca ════════
  const renderB = () => {
    const term = libQ.trim();
    const hits = term ? PAGES.filter((p) => matches(p, term)) : null;
    const item = (p, depth = 0) => `<li><button type="button" class="w-li${p.id === cur ? ' is-on' : ''}" style="--d:${depth}" data-pick="${p.id}"${p.id === cur ? ' aria-current="page"' : ''}>
        <span class="w-li-t">${term ? mark(p.title, term) : esc(p.title)}</span>${p.draft ? draftBadge : ''}
        ${term ? `<span class="w-li-s">${snippet(p, term).text}</span>` : ''}</button></li>`;
    const tree = hits
      ? (hits.length ? `<div class="w-lib-h">${hits.length} risultati</div><ul class="w-tree">${hits.map((p) => item(p)).join('')}</ul>` : `<p class="w-lib-empty">Nessuna pagina per «${esc(term)}».<br><button type="button" class="link-btn" data-new>Crea la pagina</button></p>`)
      : `<div class="w-lib-h">Aggiornate di recente</div><ul class="w-tree">${[...PAGES].sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 3).map((p) => item(p)).join('')}</ul>
        <div class="w-lib-h">Categorie</div>
        ${CATS.map((c) => {
          const ps = PAGES.filter((p) => p.cat === c.id && !p.parent); const open = libOpen.has(c.id);
          return `<div class="w-grp"><button type="button" class="w-grp-h" data-grp="${c.id}" aria-expanded="${open}">${ic(open ? 'chevD' : 'chevR')}${sw(c.id)}<span>${c.name}</span><small>${PAGES.filter((p) => p.cat === c.id).length}</small></button>
            ${open ? `<ul class="w-tree">${ps.map((p) => item(p) + PAGES.filter((x) => x.parent === p.id).map((x) => item(x, 1)).join('')).join('')}</ul>` : ''}</div>`;
        }).join('')}`;
    return `${head()}
      <section class="panel w-lib" aria-label="Biblioteca">
        <aside class="w-lib-nav" aria-label="Pagine">
          <label class="search w-search">${ic('search')}<input data-libq value="${esc(libQ)}" placeholder="Cerca nella Wiki" aria-label="Cerca nella Wiki"></label>
          <div class="w-lib-scroll">${tree}</div>
        </aside>
        <div class="w-lib-read" data-scroll>${article(page(cur), true)}</div>
      </section>`;
  };

  // ════════ C · Cerca prima ════════
  let cSel = 0;
  const SUGG = ['worklist', 'VPN Imola', 'C-ECHO', 'DryView'];
  const renderC = () => {
    const term = q.trim();
    const pool = PAGES.filter((p) => !cats.size || cats.has(p.cat));
    const hits = term ? pool.filter((p) => matches(p, term)) : [];
    const chips = `<div class="w-chips w-c-chips" role="group" aria-label="Categoria">${CATS.map((c) => `<button type="button" class="w-chip" data-cat="${c.id}" aria-pressed="${cats.has(c.id)}">${sw(c.id)}${c.name}<small>${PAGES.filter((p) => p.cat === c.id).length}</small></button>`).join('')}</div>`;
    const res = (p, i) => { const sn = snippet(p, term); return `<li><button type="button" class="w-res${i === cSel ? ' is-on' : ''}" data-open="${p.id}">
        <span class="w-res-t">${mark(p.title, term)}${p.draft ? draftBadge : ''}</span>
        <span class="w-res-s">${sn.text}</span>
        <span class="w-res-m"><span class="w-mono-s">${p.kb}</span>${catLabel(p.cat)}<span>aggiornata ${rel(p.upd)}</span>${sn.link ? `<span class="w-res-l">${ic(sn.link[0] === 'cliente' ? 'building' : sn.link[0] === 'sito' ? 'pin' : 'server')}collegata a ${mark(sn.link[1], term)}</span>` : ''}</span></button></li>`; };
    let i = 0;
    const grouped = CATS.map((c) => [c, hits.filter((p) => p.cat === c.id)]).filter(([, l]) => l.length);
    const results = term ? (hits.length
      ? `<div class="w-c-count">${hits.length} ${hits.length === 1 ? 'pagina' : 'pagine'} per «${esc(term)}»</div>${grouped.map(([c, l]) => `<section class="w-c-grp"><h2>${sw(c.id)}${c.name}<small>${l.length}</small></h2><ul>${l.map((p) => res(p, i++)).join('')}</ul></section>`).join('')}`
      : `<div class="w-c-none">${ic('search')}<div><b>Nessuna pagina per «${esc(term)}»</b><p>Prova con un AE title, il nome del cliente o del sistema. Oppure <button type="button" class="link-btn" data-new>crea la pagina</button>.</p></div></div>`)
      : (() => {
        const col = (t, l, meta) => `<section class="w-c-col"><h2>${t}</h2><ul>${l.map((p) => `<li><button type="button" class="w-c-li" data-open="${p.id}"><span class="w-c-li-t">${esc(p.title)}</span><span class="w-c-li-m">${meta(p)}</span></button></li>`).join('')}</ul></section>`;
        return `<div class="w-c-home">
          ${col('Aggiornate di recente', [...pool].filter((p) => !p.draft).sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 6), (p) => `${catLabel(p.cat)}<span>${rel(p.upd)} · ${p.by}</span>`)}
          ${col('Le più lette', [...pool].filter((p) => !p.draft).sort((a, b) => b.views - a.views).slice(0, 6), (p) => `${catLabel(p.cat)}<span>${p.views} letture</span>`)}
          ${col('Schede cliente', pool.filter((p) => p.cat === 'cli'), (p) => `<span>${p.links[0] ? p.links[0][1] : ''}</span><span>${rel(p.upd)}</span>`)}
          ${PAGES.some((p) => p.draft && p.author === ME) ? `<section class="w-c-col w-c-drafts"><h2>Le tue bozze</h2><ul>${PAGES.filter((p) => p.draft && p.author === ME).map((p) => `<li><button type="button" class="w-c-li" data-open="${p.id}"><span class="w-c-li-t">${esc(p.title)}</span><span class="w-c-li-m"><span>modificata ${rel(p.upd)}</span></span></button></li>`).join('')}</ul></section>` : ''}
        </div>`;
      })();
    return `${head()}
      <div class="w-c">
        <div class="w-c-search">
          <label class="w-c-box">${ic('search')}<input data-q value="${esc(q)}" placeholder="Cosa ti serve? Procedura, sistema, AE title, cliente…" aria-label="Cerca nella Wiki" autocomplete="off"><kbd>/</kbd></label>
          <div class="w-c-sugg">${term ? `<span><kbd>↑</kbd> <kbd>↓</kbd> per scegliere · <kbd>Invio</kbd> per aprire · <kbd>Esc</kbd> per azzerare</span>` : `<span>Prova:</span>${SUGG.map((s) => `<button type="button" class="link-btn" data-sugg="${s}">${s}</button>`).join('')}`}</div>
          ${chips}
        </div>
        <div class="w-c-body">${results}</div>
      </div>`;
  };


  // ════════ D · Schede (vicina alla Wiki attuale) ════════
  let dSort = 'upd'; let dGroup = true; const dAll = new Set();
  const D_SORT = [['upd', 'Aggiornate'], ['views', 'Più lette'], ['title', 'A–Z']];
  const sortFn = { upd: (a, b) => b.upd.localeCompare(a.upd), views: (a, b) => b.views - a.views, title: (a, b) => a.title.localeCompare(b.title, 'it') };
  const card = (p, term) => {
    const cli = p.links.find((l) => l[0] === 'cliente');
    return `<li><a href="#" class="w-card" data-open="${p.id}">
      <span class="w-card-top"><span class="w-mono-s">${p.kb}</span>${dGroup && !term && v !== 'e' ? '' : catLabel(p.cat)}${p.draft ? draftBadge : ''}</span>
      <span class="w-card-t">${term ? mark(p.title, term) : esc(p.title)}</span>
      <span class="w-card-s">${term ? snippet(p, term).text : esc(p.summary)}</span>
      ${cli || p.tags.length ? `<span class="w-card-x">${cli ? `<span class="w-card-cli">${ic('building')}${esc(cli[1])}</span>` : ''}${p.tags.filter((t) => !cli || t !== cli[1]).slice(0, cli ? 1 : 3).map((t) => `<span class="w-tag">${esc(t)}</span>`).join('')}</span>` : ''}
      <span class="w-card-f"><span>${rel(p.upd)} · ${p.by}</span><span class="w-card-n"><span title="Letture">${ic('eye')}${p.views}</span>${p.votes ? `<span title="${r1(p.rating)} su 5 · ${p.votes} voti">${star(true)}${r1(p.rating)}</span>` : ''}${p.att ? `<span title="Allegati">${clip}${p.att}</span>` : ''}</span></span>
    </a></li>`;
  };
  const renderD = (o = {}) => {
    const flat = Boolean(o.flat);
    const term = q.trim();
    const pool = PAGES.filter((p) => (!p.draft || p.author === ME) && (!cats.size || cats.has(p.cat)) && (!term || matches(p, term))).sort(sortFn[dSort]);
    const tools = `<div class="w-d-tools">${o.lead || ''}
      <label class="search w-search">${ic('search')}<input data-q value="${esc(q)}" placeholder="Cerca titolo, testo, tag, cliente…" aria-label="Cerca nella Wiki"></label>
      <div class="seg" role="group" aria-label="Ordina">${D_SORT.map(([k, l]) => `<button type="button" data-dsort="${k}" aria-pressed="${dSort === k}">${l}</button>`).join('')}</div>
      ${flat ? '' : `<div class="seg" role="group" aria-label="Disposizione"><button type="button" data-dgroup="1" aria-pressed="${dGroup}">Per categoria</button><button type="button" data-dgroup="0" aria-pressed="${!dGroup}">Tutte insieme</button></div>`}
    </div>
    <div class="w-chips w-d-chips" role="group" aria-label="Categoria">${CATS.map((c) => `<button type="button" class="w-chip" data-cat="${c.id}" aria-pressed="${cats.has(c.id)}">${sw(c.id)}${c.name}<small>${PAGES.filter((p) => p.cat === c.id && (!p.draft || p.author === ME)).length}</small></button>`).join('')}${cats.size ? '<button type="button" class="link-btn" data-cat="">Tutte</button>' : ''}</div>`;
    let body;
    if (!pool.length) body = `<div class="w-d-none">${ic('search')}<div><b>Nessuna pagina${term ? ` per «${esc(term)}»` : ''}</b><p>Prova con un AE title, il nome del cliente o del sistema, oppure <button type="button" class="link-btn" data-new>crea la pagina</button>.</p></div></div>`;
    else if (term || !dGroup || flat) body = `${term ? `<div class="w-d-count">${pool.length} ${pool.length === 1 ? 'pagina' : 'pagine'} per «${esc(term)}»</div>` : ''}<ul class="w-cards">${pool.map((p) => card(p, term)).join('')}</ul>`;
    else body = CATS.map((c) => {
      const l = pool.filter((p) => p.cat === c.id); if (!l.length) return '';
      const open = dAll.has(c.id); const shown = open ? l : l.slice(0, 4);
      return `<section class="w-shelf" aria-labelledby="sh-${c.id}">
        <header class="w-shelf-h"><h2 id="sh-${c.id}">${sw(c.id)}${c.name}<small>${l.length}</small></h2><p>${c.desc}</p>
          ${l.length > 4 ? `<button type="button" class="link-btn" data-dall="${c.id}">${open ? 'Mostra meno' : `Mostra tutte · ${l.length}`}</button>` : ''}</header>
        <ul class="w-cards">${shown.map((p) => card(p)).join('')}</ul>
      </section>`;
    }).join('');
    return `${head()}${tools}<div class="w-d-body">${body}</div>`;
  };


  // ════════ E · Home (categorie colorate + sezioni) ════════
  // Preferiti: NON esistono nel backend (servirebbe un modello utente↔pagina). Qui vivono solo nell'anteprima.
  const FAV = new Set([864, 910, 871, 902]);
  const CICON = { proc: 'task', acc: 'key', sys: 'server', chk: 'check', cli: 'building', int: 'users' };
  const CREATED = { 970: '2026-11-06', 985: '2026-11-03', 910: '2026-10-29', 925: '2026-10-27', 945: '2026-10-22', 902: '2026-10-20', 933: '2026-10-15', 980: '2026-10-09' };
  const created = (p) => CREATED[p.id] || '2026-0' + (1 + (p.id % 8)) + '-1' + (p.id % 9);
  let eCat = null;
  const visible = (p) => !p.draft || p.author === ME;
  const eRow = (p, meta) => `<li><a href="#" class="w-e-row" data-open="${p.id}">${sw(p.cat)}<span class="w-e-row-t">${esc(p.title)}${p.draft ? draftBadge : ''}</span><span class="w-e-row-m">${meta}</span></a></li>`;
  const MSF = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  // Cartellina: linguetta + retro scuro + fogli che spuntano + davanti colorato.
  const folder = (c, ps, big = false) => {
    const top = [...ps].filter((p) => !p.draft).sort(sortFn.views).slice(0, 3);
    const last = [...ps].sort(sortFn.upd)[0];
    return `<span class="w-fold${big ? ' is-big' : ''}" style="--c:${c.color}" aria-hidden="${big}">
      <span class="w-fold-tab"><span>${ps.length} ${ps.length === 1 ? 'pagina' : 'pagine'}</span></span>
      <span class="w-fold-back"></span>
      <span class="w-fold-sheets">${top.map((p, i) => `<span class="w-sheet s${i}"><b>${esc(p.title)}</b><i></i><i></i></span>`).join('')}</span>
      <span class="w-fold-front">
        <span class="w-fold-ico">${ic(CICON[c.id])}</span>
        <span class="w-fold-name">${c.name}</span>
        <span class="w-fold-desc">${c.desc}</span>
        <span class="w-fold-foot">aggiornata ${rel(last.upd)}</span>
      </span>
    </span>`;
  };
  // Linguette delle cartelle, sempre nello stesso ordine. mode: 'nav' (pagina della cartella), 'art' (articolo), 'edit' (sposta la pagina).
  let edCat = null;
  const tabsStrip = (activeId, mode) => `<div class="w-open-tabs" role="${mode === 'edit' ? 'radiogroup' : 'tablist'}" aria-label="${mode === 'edit' ? 'Cartella della pagina' : 'Cartelle'}">
    ${CATS.map((x) => {
      const n = PAGES.filter((p) => p.cat === x.id && visible(p)).length;
      if (x.id === activeId) {
        const sub = mode === 'edit' ? 'cartella della pagina' : `${n} pagine`;
        const inner = `<span class="w-fold-ico">${ic(CICON[x.id])}</span><h2>${x.name}</h2><small>${sub}</small>`;
        return mode === 'art' ? `<button type="button" class="w-open-tab" role="tab" aria-selected="true" data-ecat="${x.id}" title="Torna alla cartella ${x.name}">${inner}</button>`
          : `<div class="w-open-tab" role="${mode === 'edit' ? 'radio' : 'tab'}" aria-${mode === 'edit' ? 'checked' : 'selected'}="true">${inner}</div>`;
      }
      return mode === 'edit'
        ? `<button type="button" role="radio" aria-checked="false" class="w-side-tab" style="--c:${x.color}" data-edcat="${x.id}" title="Sposta la pagina in ${x.name}">${ic(CICON[x.id])}<span>${x.name}</span></button>`
        : `<button type="button" role="tab" aria-selected="false" class="w-side-tab" style="--c:${x.color}" data-ecat="${x.id}" title="${x.name} · ${n} pagine">${ic(CICON[x.id])}<span>${x.name}</span></button>`;
    }).join('')}
  </div>`;
  const renderE = () => {
    const term = q.trim();
    const eSwitch = `<div class="seg w-e-view" role="group" aria-label="Vista"><button type="button" data-eview="folders" aria-pressed="${eView === 'folders'}">${ic('folder')}Cartelle</button><button type="button" data-eview="all" aria-pressed="${eView === 'all'}">${ic('columns')}Tutte le pagine</button></div>`;
    if (!eCat && eView === 'all') return renderD({ flat: true, lead: eSwitch });

    const search = `<label class="search w-search w-e-search">${ic('search')}<input data-q value="${esc(q)}" placeholder="${eCat ? `Cerca in ${CAT[eCat].name}…` : 'Cerca in tutta la Wiki: titolo, testo, tag, cliente…'}" aria-label="Cerca nella Wiki"></label>`;
    if (eCat) {
      const c = CAT[eCat];
      const all = PAGES.filter((p) => p.cat === c.id && visible(p));
      const l = all.filter((p) => !term || matches(p, term)).sort(sortFn[dSort]);
      return `${head()}
        <nav class="w-crumbs" aria-label="Percorso"><a href="#" data-ecat="">${ic('chevL')}Archivio</a></nav>
        <section class="w-open" style="--c:${c.color}" aria-label="${c.name}">
          ${tabsStrip(c.id, 'nav')}
          <div class="w-open-in">
            <div class="w-open-h"><p>${c.desc}</p>
              <div class="w-open-tools">${search}<div class="seg" role="group" aria-label="Ordina">${D_SORT.map(([k, lb]) => `<button type="button" data-dsort="${k}" aria-pressed="${dSort === k}">${lb}</button>`).join('')}</div></div></div>
            ${l.length ? `<ul class="w-papers">${l.map((p, i) => `<li style="--r:${[-0.6, 0.4, -0.2, 0.7, -0.5, 0.2][i % 6]}deg"><a href="#" class="w-paper" data-open="${p.id}">
                <span class="w-paper-top"><span class="w-mono-s">${p.kb}</span>${p.draft ? draftBadge : ''}${FAV.has(p.id) ? `<span class="w-paper-fav" title="Nei preferiti">${star(true)}</span>` : ''}</span>
                <span class="w-paper-t">${term ? mark(p.title, term) : esc(p.title)}</span>
                <span class="w-paper-s">${term ? snippet(p, term).text : esc(p.summary)}</span>
                <span class="w-paper-f"><span>${rel(p.upd)} · ${p.by}</span><span>${ic('eye')}${p.views}${p.votes ? ` ${star(true)}${r1(p.rating)}` : ''}</span></span>
              </a></li>`).join('')}</ul>`
              : `<div class="w-d-none">${ic('search')}<div><b>Nessuna pagina${term ? ` per «${esc(term)}»` : ''}</b><p><button type="button" class="link-btn" data-new>Crea una pagina in ${c.name}</button></p></div></div>`}
          </div>
        </section>`;
    }
    if (term) {
      const l = PAGES.filter((p) => visible(p) && matches(p, term)).sort(sortFn.upd);
      return `${head()}<div class="w-d-tools">${eSwitch}${search}</div><div class="w-d-count">${l.length} ${l.length === 1 ? 'pagina' : 'pagine'} per «${esc(term)}»</div>${l.length ? `<ul class="w-cards">${l.map((p) => card(p, term)).join('')}</ul>` : ''}`;
    }
    const folders = CATS.map((c) => {
      const ps = PAGES.filter((p) => p.cat === c.id && visible(p));
      return `<li><button type="button" class="w-fold-btn" data-ecat="${c.id}" aria-label="Apri la cartella ${c.name}, ${ps.length} pagine">${folder(c, ps)}</button></li>`;
    }).join('');
    const newest = PAGES.filter((p) => !p.draft).sort((a, b) => created(b).localeCompare(created(a))).slice(0, 6);
    const favs = PAGES.filter((p) => FAV.has(p.id));
    const recent = PAGES.filter((p) => !p.draft).sort(sortFn.upd).slice(0, 6);
    const drafts = PAGES.filter((p) => p.draft && p.author === ME);
    const H = [236, 250, 228, 244, 232, 240];
    return `${head()}
      <div class="w-d-tools">${eSwitch}${search}</div>
      <ul class="w-folders" aria-label="Cartelle">${folders}</ul>

      <section class="w-e-sec w-sec-new" aria-labelledby="h-new">
        <header><h2 id="h-new">Ultime create</h2><span>le schede appena entrate in archivio</span></header>
        <ul class="w-idx">${newest.map((p, i) => `<li style="--c:${CAT[p.cat].color};--r:${[-1.2, 0.8, -0.4, 1.1, -0.9, 0.5][i]}deg"><a href="#" class="w-idx-card" data-open="${p.id}">
          <span class="w-idx-tab">${CAT[p.cat].name}</span>
          <span class="w-idx-kb">${p.kb}</span>
          <span class="w-idx-t">${esc(p.title)}</span>
          <span class="w-idx-f"><span class="w-stamp">${dshort(created(p))}</span>${p.author}</span>
        </a></li>`).join('')}</ul>
      </section>

      <div class="w-e-grid">
        <section class="w-e-sec w-sec-shelf" aria-labelledby="h-fav">
          <header><h2 id="h-fav">${star(true)}I tuoi preferiti</h2><span>${favs.length} sullo scaffale</span></header>
          <div class="w-shelf-wood">
            <ul class="w-books">${favs.map((p, i) => `<li><a href="#" class="w-book" data-open="${p.id}" style="--c:${CAT[p.cat].color};--h:${H[i % H.length]}px" title="${esc(p.title)}">
              <span class="w-book-band"></span><span class="w-book-t">${esc(p.title)}</span><span class="w-book-kb">${p.kb.slice(-3)}</span></a></li>`).join('')}
              <li><span class="w-book is-ghost" style="--h:170px"><span class="w-book-t">Stella in un articolo per metterlo qui</span></span></li></ul>
          </div>
        </section>

        <section class="w-e-sec w-sec-ledger" aria-labelledby="h-rec">
          <header><h2 id="h-rec">Registro delle modifiche</h2><span>aggiornate di recente</span></header>
          <ol class="w-ledger">${recent.map((p) => { const [y, m, d] = p.upd.split('-').map(Number); return `<li><span class="w-led-d"><b>${d}</b><small>${MSF[m - 1].slice(0, 3)}</small></span><a href="#" data-open="${p.id}" class="w-led-e"><span class="w-led-t">${esc(p.title)}</span><span class="w-led-m">${sw(p.cat)}${CAT[p.cat].name} · ${p.by} · rev. ${p.rev}</span></a></li>`; }).join('')}</ol>
        </section>

        <section class="w-e-sec w-sec-notes" aria-labelledby="h-dr">
          <header><h2 id="h-dr">Le tue bozze</h2><span>${drafts.length ? 'da finire e pubblicare' : ''}</span></header>
          ${drafts.length ? `<ul class="w-notes">${drafts.map((p, i) => `<li style="--r:${i % 2 ? 1.6 : -1.8}deg"><a href="#" class="w-note-p" data-open="${p.id}"><span class="w-tape"></span><b>${esc(p.title)}</b><small>modificata ${rel(p.upd)}</small></a></li>`).join('')}
            <li style="--r:.8deg"><button type="button" class="w-note-p is-new" data-new>${ic('plus')}<b>Nuova bozza</b></button></li></ul>` : '<p class="w-rail-none">Nessuna bozza.</p>'}
        </section>
      </div>`;
  };

  // ════════ E · Query: schedario ════════
  // Modello reale: WikiQuery (titolo, linguaggio con colore e colore del testo, testo, descrizione, tag,
  // use_count che sale a ogni "Copia", autore, aggiornamento). Linguaggi: WikiQueryLanguage (colore dato).
  const LANGS = [
    { k: 'ora', label: 'SQL Oracle', color: '#b5432f' },
    { k: 'mss', label: 'SQL Server', color: '#2f5f9e' },
    { k: 'ps', label: 'PowerShell', color: '#3b4a8f' },
    { k: 'sh', label: 'Bash', color: '#3b7a57' },
    { k: 'py', label: 'Python', color: '#9a6a00' },
  ];
  const LANG = Object.fromEntries(LANGS.map((l) => [l.k, l]));
  const QQ = [
    { id: 1, t: 'Studi senza referto da più di 48 ore', l: 'ora', uses: 41, by: 'L. Romano', upd: '2026-11-02', tags: ['RIS', 'referti'], d: 'Elenco degli studi completati in modalità che non hanno ancora un referto firmato. Utile per il report mensile.',
      b: "-- Studi completati senza referto firmato da più di 48 ore\nSELECT s.accession_number,\n       s.modality,\n       s.study_date,\n       p.patient_id\n  FROM studies s\n  JOIN patients p ON p.id = s.patient_id\n  LEFT JOIN reports r ON r.study_id = s.id AND r.status = 'SIGNED'\n WHERE s.status = 'COMPLETED'\n   AND r.id IS NULL\n   AND s.study_date < SYSDATE - 2\n ORDER BY s.study_date;" },
    { id: 2, t: 'Coda della worklist per AE title', l: 'mss', uses: 33, by: 'F. Mutuale', upd: '2026-11-04', tags: ['MWL', 'worklist'], d: 'Quanti ordini ci sono in coda per ogni modalità. Se una modalità ha la coda ferma, vedi KB0000864.',
      b: "-- Ordini in attesa per modalità\nSELECT scheduled_ae_title AS ae_title,\n       COUNT(*)            AS in_coda,\n       MIN(created_at)     AS dal\n  FROM mwl_queue\n WHERE state = 'PENDING'\n GROUP BY scheduled_ae_title\n ORDER BY in_coda DESC;" },
    { id: 3, t: 'Spazio libero sui volumi dell\'archivio', l: 'ps', uses: 27, by: 'A. Ferri', upd: '2026-10-28', tags: ['storage'], d: 'Percentuale libera dei dischi del server PACS. Sotto il 15% apri una issue.',
      b: "# Spazio libero sui volumi dell'archivio\nGet-Volume |\n  Where-Object { $_.DriveLetter -and $_.Size -gt 0 } |\n  Select-Object DriveLetter, FileSystemLabel,\n    @{ n = 'Libero %'; e = { [math]::Round($_.SizeRemaining / $_.Size * 100, 1) } } |\n  Sort-Object 'Libero %'" },
    { id: 4, t: 'Ultimi errori del broker di worklist', l: 'sh', uses: 24, by: 'L. Romano', upd: '2026-11-04', tags: ['log', 'MWL'], d: 'Le ultime 50 righe di errore del servizio, con data e ora.',
      b: "# Ultimi 50 errori del broker\njournalctl -u mwl-broker --since \"-2 days\" -p err --no-pager | tail -n 50" },
    { id: 5, t: 'Test C-ECHO verso un nodo DICOM', l: 'sh', uses: 52, by: 'M. Romanelli', upd: '2026-10-19', tags: ['DICOM', 'C-ECHO'], d: 'Verifica di base della connessione DICOM. Sostituisci AE title, host e porta del nodo.',
      b: "# C-ECHO dal nostro AE title verso il nodo\nechoscu -v -aet BIOTRON -aec IMO_ARC pacs-arc.ausl.imola.local 104" },
    { id: 6, t: 'Utenze del RIS con accesso scaduto', l: 'ora', uses: 9, by: 'A. Ferri', upd: '2026-09-30', tags: ['utenze'], d: 'Utenti attivi con password scaduta da più di 90 giorni.',
      b: "SELECT username, last_login, password_changed_at\n  FROM ris_users\n WHERE active = 1\n   AND password_changed_at < SYSDATE - 90\n ORDER BY password_changed_at;" },
    { id: 7, t: 'Volume di studi per modalità nel mese', l: 'mss', uses: 14, by: 'F. Mutuale', upd: '2026-10-05', tags: ['report'], d: 'Numero di studi e spazio occupato per modalità nel mese corrente.',
      b: "SELECT modality,\n       COUNT(*)                     AS studi,\n       SUM(size_bytes) / 1073741824 AS gb\n  FROM studies\n WHERE study_date >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)\n GROUP BY modality\n ORDER BY studi DESC;" },
    { id: 8, t: 'Riavvio ordinato dei servizi PACS', l: 'ps', uses: 19, by: 'F. Mutuale', upd: '2026-10-21', tags: ['PACS', 'riavvio'], d: 'Stessa sequenza di KB0000920, in un solo comando. Da lanciare solo nella finestra concordata.',
      b: "# Ferma in ordine inverso, riavvia in ordine\n$svc = 'PacsArchive', 'PacsDicomGateway', 'PacsWeb'\n$svc[($svc.Length - 1)..0] | ForEach-Object { Stop-Service $_ -Verbose }\n$svc | ForEach-Object { Start-Service $_ -Verbose }" },
    { id: 9, t: 'Esporta i nodi DICOM in CSV', l: 'py', uses: 6, by: 'L. Romano', upd: '2026-09-12', tags: ['nodi', 'export'], d: 'Legge la configurazione dei nodi e scrive un CSV da allegare alla scheda cliente.',
      b: "import csv, json\n\nnodes = json.load(open('dicom_nodes.json'))\nwith open('nodi.csv', 'w', newline='') as f:\n    w = csv.writer(f, delimiter=';')\n    w.writerow(['Nome', 'Host', 'AE title', 'Porta'])\n    for n in nodes:\n        w.writerow([n['name'], n['host'], n['ae'], n['port']])" },
  ];
  let qLang = 'all'; let qSel = 2; let qq = ''; let qSort = 'uses';
  const Q_SORT = [['uses', 'Più usate'], ['upd', 'Aggiornate'], ['title', 'A–Z']];
  const KW = /\b(SELECT|FROM|JOIN|LEFT|ON|AND|OR|WHERE|GROUP|BY|ORDER|AS|IS|NULL|NOT|COUNT|MIN|SUM|DESC|ASC|import|with|for|in|open|def|return)\b/g;
  const hl = (line) => {
    const c = line.match(/^(\s*)(--|#)/);
    if (c) return `<span class="w-cm">${esc(line)}</span>`;
    return esc(line).replace(/('[^']*'|&quot;[^&]*&quot;)/g, '<span class="w-str">$1</span>').replace(KW, '<b>$1</b>');
  };
  const renderQueries = () => {
    const term = qq.trim().toLowerCase();
    const list = QQ.filter((x) => (qLang === 'all' || x.l === qLang) && (!term || [x.t, x.d, x.b, x.tags.join(' ')].join(' ').toLowerCase().includes(term)))
      .sort(qSort === 'uses' ? (a, b) => b.uses - a.uses : qSort === 'upd' ? (a, b) => b.upd.localeCompare(a.upd) : (a, b) => a.t.localeCompare(b.t, 'it'));
    if (!list.some((x) => x.id === qSel) && list.length) qSel = list[0].id;
    const sel = QQ.find((x) => x.id === qSel);
    const c = qLang === 'all' ? '#5b6b67' : LANG[qLang].color;
    const tabs = `<div class="w-open-tabs" role="tablist" aria-label="Linguaggi">${[{ k: 'all', label: 'Tutte', color: '#5b6b67' }, ...LANGS].map((l) => {
      const n = l.k === 'all' ? QQ.length : QQ.filter((x) => x.l === l.k).length;
      return l.k === qLang ? `<div class="w-open-tab" role="tab" aria-selected="true"><span class="w-fold-ico">${ic(l.k === 'all' ? 'folder' : 'columns')}</span><h2>${l.label}</h2><small>${n} query</small></div>`
        : `<button type="button" role="tab" aria-selected="false" class="w-side-tab" style="--c:${l.color}" data-qlang="${l.k}"><span>${l.label}</span><small class="w-tab-n">${n}</small></button>`;
    }).join('')}</div>`;
    const cards = list.length ? `<ul class="w-qlist">${list.map((x, i) => `<li style="--c:${LANG[x.l].color};--r:${[-0.5, 0.4, -0.2, 0.6][i % 4]}deg"><button type="button" class="w-qcard${x.id === qSel ? ' is-on' : ''}" data-qsel="${x.id}" aria-pressed="${x.id === qSel}">
        <span class="w-qcard-tab">${LANG[x.l].label}</span>
        <span class="w-qcard-t">${esc(x.t)}</span>
        <span class="w-qcard-d">${esc(x.d)}</span>
        <span class="w-qcard-f"><span class="w-uses" title="Volte che è stata copiata">${ic('copy')}${x.uses}</span>${x.tags.map((t) => `<span class="w-tag">${esc(t)}</span>`).join('')}</span>
      </button></li>`).join('')}</ul>` : `<div class="w-d-none">${ic('search')}<div><b>Nessuna query${term ? ` per «${esc(qq)}»` : ''}</b><p><button type="button" class="link-btn" data-toast="Si apre il modulo della nuova query">Aggiungine una</button></p></div></div>`;
    const lines = sel ? sel.b.split('\n') : [];
    const detail = sel ? `<article class="w-qdoc" style="--c:${LANG[sel.l].color}" aria-label="${esc(sel.t)}">
        <header class="w-qdoc-h">
          <span class="w-lang">${LANG[sel.l].label}</span>
          <h2>${esc(sel.t)}</h2>
          <p>${esc(sel.d)}</p>
          <div class="w-qdoc-m"><span>${sel.by} · aggiornata ${rel(sel.upd)}</span><span class="w-uses-big"><b>${sel.uses}</b> volte copiata</span></div>
        </header>
        <div class="w-qcode">
          <div class="w-qcode-bar"><span>${lines.length} righe</span><button type="button" class="btn btn-primary btn-sm" data-qcopy="${sel.id}">${ic('copy')}Copia la query</button></div>
          <pre><code>${lines.map((ln, i) => `<span class="w-ln"><i>${i + 1}</i>${hl(ln) || ' '}</span>`).join('')}</code></pre>
        </div>
        <footer class="w-qdoc-f">${sel.tags.map((t) => `<span class="w-tag">${esc(t)}</span>`).join('')}<span class="g-spacer"></span>
          <button class="btn btn-ghost btn-sm" type="button" data-toast="Query eliminata · Annulla">${ic('trash')}Elimina</button>
          <button class="btn btn-sm" type="button" data-toast="Si apre la modifica della query">${ic('wrench')}Modifica</button></footer>
      </article>` : '';
    return `${head()}
      <section class="w-open w-qfold" style="--c:${c}" aria-label="Schedario delle query">
        ${tabs}
        <div class="w-open-in">
          <div class="w-open-tools"><label class="search w-search">${ic('search')}<input data-qq value="${esc(qq)}" placeholder="Cerca titolo, descrizione, testo della query…" aria-label="Cerca nelle query"></label>
            <div class="seg" role="group" aria-label="Ordina">${Q_SORT.map(([k, l]) => `<button type="button" data-qsort="${k}" aria-pressed="${qSort === k}">${l}</button>`).join('')}</div></div>
          <div class="w-q">${cards}${detail}</div>
        </div>
      </section>`;
  };

  // ════════ E · Statistiche: registro dell'archivio ════════
  // Dati reali da /wiki-stats/: totali, per categoria, più lette, distribuzione dei voti,
  // autori (revisioni salvate), collaboratore del mese, pagine con voto basso o senza voto, query più usate.
  const renderStats = () => {
    const pub = PAGES.filter((p) => !p.draft);
    const views = pub.reduce((n, p) => n + p.views, 0);
    const voted = pub.filter((p) => p.votes); const votes = voted.reduce((n, p) => n + p.votes, 0);
    const avg = voted.reduce((n, p) => n + p.rating * p.votes, 0) / votes;
    const byCat = CATS.map((c) => ({ c, n: PAGES.filter((p) => p.cat === c.id).length }));
    const maxCat = Math.max(...byCat.map((x) => x.n));
    const top = [...pub].sort((a, b) => b.views - a.views).slice(0, 6); const maxV = top[0].views;
    const dist = [[5, 58], [4, 31], [3, 12], [2, 4], [1, 2]]; const maxD = Math.max(...dist.map((d) => d[1]));
    const authors = [['L. Romano', 38], ['F. Mutuale', 31], ['A. Ferri', 24], ['M. Romanelli', 17]]; const maxA = authors[0][1];
    const review = [...pub.filter((p) => p.votes && p.rating < 4.1).sort((a, b) => a.rating - b.rating).slice(0, 3), ...pub.filter((p) => !p.votes)];
    const qtop = [...QQ].sort((a, b) => b.uses - a.uses).slice(0, 5); const maxQ = qtop[0].uses;
    const bar = (v, max, label) => `<span class="w-bar" role="img" aria-label="${label}"><i style="width:${Math.max(3, (v / max) * 100)}%"></i></span>`;
    return `${head()}
      <div class="w-st">
        <ul class="w-st-tags" aria-label="Riepilogo">
          <li><span class="w-st-k">Pagine pubblicate</span><b>${pub.length}</b><small>${PAGES.length - pub.length} bozze</small></li>
          <li><span class="w-st-k">Letture totali</span><b>${views.toLocaleString('it-IT')}</b><small>in media ${Math.round(views / pub.length)} per pagina</small></li>
          <li><span class="w-st-k">Voto medio</span><b>${r1(avg)}</b><small>${votes} voti su ${voted.length} pagine</small></li>
          <li class="w-st-month"><span class="w-st-k">Collaboratore del mese</span><b>L. Romano</b><small>3 pagine create a novembre</small><span class="w-rosette" aria-hidden="true">${star(true)}</span></li>
        </ul>

        <section class="w-st-card w-st-cats" aria-labelledby="st-cat">
          <header><h2 id="st-cat">Pagine per cartella</h2><span>${PAGES.length} pagine in ${CATS.length} cartelle</span></header>
          <div class="w-cab">${byCat.map(({ c, n }) => `<button type="button" class="w-cab-f" style="--c:${c.color};--h:${Math.round(40 + (n / maxCat) * 140)}px" data-wsec="pages" data-ecat="${c.id}" title="${c.name}: ${n} pagine">
              <b>${n}</b><span class="w-cab-body"><span class="w-cab-tab"></span></span><span class="w-cab-l">${c.name}</span></button>`).join('')}</div>
        </section>

        <section class="w-st-card" aria-labelledby="st-top">
          <header><h2 id="st-top">Le più lette</h2><span>letture da sempre</span></header>
          <ol class="w-rank">${top.map((p, i) => `<li><span class="w-rank-n">${i + 1}</span><a href="#" data-wsec="pages" data-open="${p.id}"><span class="w-rank-t">${esc(p.title)}</span><span class="w-rank-c">${sw(p.cat)}${CAT[p.cat].name}</span></a>${bar(p.views, maxV, `${p.views} letture`)}<b class="w-num">${p.views}</b></li>`).join('')}</ol>
        </section>

        <section class="w-st-card" aria-labelledby="st-votes">
          <header><h2 id="st-votes">Come vengono votate</h2><span>${dist.reduce((n, d) => n + d[1], 0)} voti</span></header>
          <ul class="w-dist">${dist.map(([st, n]) => `<li><span class="w-dist-s" aria-label="${st} stelle">${[1, 2, 3, 4, 5].map((k) => star(k <= st)).join('')}</span>${bar(n, maxD, `${n} voti da ${st} stelle`)}<b class="w-num">${n}</b></li>`).join('')}</ul>
        </section>

        <section class="w-st-card" aria-labelledby="st-auth">
          <header><h2 id="st-auth">Chi scrive</h2><span>revisioni salvate</span></header>
          <ul class="w-sign">${authors.map(([n, e]) => `<li><span class="w-sign-n">${n}</span>${bar(e, maxA, `${e} revisioni`)}<b class="w-num">${e}</b></li>`).join('')}</ul>
        </section>


        <section class="w-st-card" aria-labelledby="st-q">
          <header><h2 id="st-q">Query più copiate</h2><button type="button" class="link-btn" data-wsec="queries">Apri lo schedario ${ic('arrowR')}</button></header>
          <ul class="w-sign">${qtop.map((x) => `<li><span class="w-sign-n"><span class="w-lang-s" style="--c:${LANG[x.l].color}">${LANG[x.l].label}</span>${esc(x.t)}</span>${bar(x.uses, maxQ, `${x.uses} copie`)}<b class="w-num">${x.uses}</b></li>`).join('')}</ul>
        </section>

        <section class="w-st-card w-st-review" aria-labelledby="st-rev">
          <header><h2 id="st-rev">Da rivedere</h2><span>voto sotto 4 o ancora nessun voto</span></header>
          <ul class="w-notes w-notes-sm">${review.map((p, i) => `<li style="--r:${[-1.4, 1, -0.6, 1.3, -1][i % 5]}deg"><a href="#" class="w-note-p" data-wsec="pages" data-open="${p.id}"><span class="w-tape"></span><b>${esc(p.title)}</b><small>${p.votes ? `${star(true)} ${r1(p.rating)} · ${p.votes} voti` : 'Nessun voto'} · ${p.views} letture</small></a></li>`).join('')}</ul>
        </section>
      </div>`;
  };

  // ════════ Articolo (comune) ════════
  const linkIcon = (t) => ic(t === 'cliente' ? 'building' : t === 'sito' ? 'pin' : 'server');
  function article(p, embedded = false, inFolder = false) {
    const myv = myVote.get(p.id);
    const children = PAGES.filter((x) => x.parent === p.id);
    const parent = p.parent ? page(p.parent) : null;
    return `<article class="w-art${embedded ? ' is-embedded' : ''}${inFolder ? ' is-sheet' : ''}" data-art="${p.id}">
      <header class="w-art-h">
        ${embedded || inFolder ? '' : `<nav class="w-crumbs" aria-label="Percorso"><a href="#" data-home>${ic('chevL')}Wiki</a><span>/</span><a href="#" data-home-cat="${p.cat}">${CAT[p.cat].name}</a>${parent ? `<span>/</span><a href="#" data-open="${parent.id}">${esc(parent.title)}</a>` : ''}</nav>`}
        <div class="w-art-top">
          <div class="w-art-tt">
            ${embedded ? `<div class="w-art-path">${catLabel(p.cat)}${parent ? `<span>/</span><a href="#" data-pick="${parent.id}">${esc(parent.title)}</a>` : ''}</div>` : ''}
            <h1>${esc(p.title)}${p.draft ? draftBadge : ''}</h1>
            <div class="w-meta">
              <button type="button" class="w-kbcode" data-copy="${p.kb}" title="Copia il codice">${p.kb}${ic('copy')}</button>
              ${embedded || inFolder ? '' : catLabel(p.cat)}
              <span>Aggiornata ${rel(p.upd)} da <b>${p.by}</b></span>
              <span>${p.views} letture</span>
              ${p.votes ? `<span class="w-rate">${star(true)}${r1(p.rating)}<small>${p.votes} voti</small></span>` : ''}
            </div>
          </div>
          <div class="w-art-act">
            <button class="icon-btn" type="button" data-toast="Si scarica il PDF" aria-label="Esporta PDF" title="Esporta PDF">${ic('download')}</button>
            <button class="icon-btn" type="button" data-menu aria-label="Altre azioni" title="Altre azioni">${ic('more')}</button>
            <button class="icon-btn w-fav${FAV.has(p.id) ? ' is-on' : ''}" type="button" data-fav="${p.id}" aria-pressed="${FAV.has(p.id)}" aria-label="${FAV.has(p.id) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}" title="${FAV.has(p.id) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${star(FAV.has(p.id))}</button>
            <button class="btn" type="button" data-edit="${p.id}">${ic('wrench')}Modifica</button>
          </div>
        </div>
        ${p.summary ? `<p class="w-lead">${esc(p.summary)}</p>` : ''}
      </header>
      <div class="w-art-b">
        <div class="w-prose" data-prose>${BODY[p.body]()}
          ${children.length ? `<h2>Pagine collegate</h2><ul class="w-sub">${children.map((c) => `<li>${kbl(c.id)}<span>${esc(c.summary)}</span></li>`).join('')}</ul>` : ''}
          <div class="w-useful">
            <span>${myv ? `Hai dato ${myv} ${myv === 1 ? 'stella' : 'stelle'} a questa pagina.` : 'Ti è stata utile?'}</span>
            <span class="w-stars" role="radiogroup" aria-label="Voto">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${myv === n}" aria-label="${n} su 5" data-vote="${n}" ${myv ? 'disabled' : ''}>${star(Boolean(myv && n <= myv))}</button>`).join('')}</span>
            ${myv ? '<small>Si vota una sola volta.</small>' : ''}
          </div>
        </div>
        <aside class="w-rail" aria-label="Informazioni sulla pagina">
          <section class="w-rail-s w-toc"><h4>In questa pagina</h4><ol>${TOC[p.body].map(([id, l], i) => `<li><a href="#${id}" data-toc="${id}"${i === 0 ? ' class="is-on"' : ''}>${l}</a></li>`).join('')}</ol></section>
          <section class="w-rail-s"><h4>Collegata a <span>${p.links.length}</span></h4>${p.links.length ? `<ul class="w-links">${p.links.map(([t, l]) => `<li><a href="#" class="w-ent">${linkIcon(t)}<span>${esc(l)}</span><small>${t}</small></a></li>`).join('')}</ul>` : '<p class="w-rail-none">Nessun collegamento.</p>'}<button type="button" class="link-btn" data-toast="Si apre la scelta di cliente, sito o inventario">${ic('plus')}Collega</button></section>
          <section class="w-rail-s"><h4>Allegati <span>${p.att}</span></h4>${p.att ? `<ul class="w-files">${['Log broker 03-11.txt', 'Schermata DICOM nodes.png', 'Verbale collaudo.pdf'].slice(0, p.att).map((f) => `<li><a href="#" data-toast="Si apre l'anteprima">${ic('file')}<span>${f}</span></a></li>`).join('')}</ul>` : '<p class="w-rail-none">Nessun allegato.</p>'}</section>
          <section class="w-rail-s"><h4>Revisioni <span>${p.rev}</span></h4><p class="w-rail-none">Ultima ${rel(p.upd)} da ${p.by}${p.author !== p.by ? `; creata da ${p.author}` : ''}.</p><button type="button" class="link-btn" data-revs="${p.id}">${ic('history')}Cronologia</button></section>
        </aside>
      </div>
    </article>`;
  }

  // ════════ Modifica (comune) ════════
  const renderEdit = (p) => {
    const isNew = !p;
    const pp = p || { id: 0, kb: '', title: '', cat: 'proc', summary: '', tags: [], links: [], draft: true, body: null, rev: 0, parent: null };
    return `<div class="w-ed">
      <div class="w-ed-head">
        <nav class="w-crumbs" aria-label="Percorso"><a href="#" data-cancel>${ic('chevL')}${isNew ? (v === 'e' ? 'Archivio' : 'Wiki') : esc(pp.title)}</a></nav>
        <span class="w-ed-st">${isNew ? 'Nuova pagina' : `Modifica · <span class="w-mono-s">${pp.kb}</span>`}</span>
        <div class="actions"><button class="btn btn-ghost" type="button" data-cancel>Annulla</button><button class="btn btn-primary" type="button" data-save>${tick}${isNew ? 'Crea pagina' : 'Salva'}</button></div>
      </div>
      ${v === 'e' ? `<section class="w-open w-ed-fold" style="--c:${CAT[edCat || pp.cat].color}" data-edfold>${tabsStrip(edCat || pp.cat, 'edit')}<div class="w-open-in">` : ''}
      <div class="w-ed-b">
        <div class="w-ed-main">
          <textarea class="w-ed-title" rows="1" placeholder="Titolo della pagina" aria-label="Titolo">${esc(pp.title)}</textarea>
          <textarea class="w-ed-lead" rows="2" placeholder="Riepilogo in una o due frasi: compare nell'elenco e nella ricerca" aria-label="Riepilogo">${esc(pp.summary)}</textarea>
          <div class="w-ed-bar" role="toolbar" aria-label="Formattazione">
            <span class="w-ed-g"><button type="button" aria-label="Titolo di sezione" title="Titolo di sezione">H2</button><button type="button" aria-label="Sottotitolo" title="Sottotitolo">H3</button></span>
            <span class="w-ed-g"><button type="button" aria-label="Grassetto" title="Grassetto (Ctrl B)"><b>B</b></button><button type="button" aria-label="Corsivo" title="Corsivo (Ctrl I)"><i>I</i></button><button type="button" aria-label="Codice in linea" title="Codice in linea"><span class="w-mono-s">&lt;/&gt;</span></button></span>
            <span class="w-ed-g"><button type="button" title="Elenco puntato" aria-label="Elenco puntato">${ic('menu')}</button><button type="button" title="Passi numerati" aria-label="Passi numerati">1·2·3</button><button type="button" title="Blocco di comandi" aria-label="Blocco di comandi">{ }</button></span>
            <span class="w-ed-g"><button type="button" title="Avviso" aria-label="Avviso">${ic('alert')}</button><button type="button" title="Tabella" aria-label="Tabella">${ic('columns')}</button><button type="button" title="Collegamento a una pagina della Wiki" aria-label="Collegamento a una pagina">${ic('book')}</button><button type="button" title="Immagine" aria-label="Immagine">${ic('upload')}</button></span>
            <span class="w-ed-hint"><kbd>/</kbd> inserisce un blocco</span>
          </div>
          <div class="w-prose w-ed-area" contenteditable="true" spellcheck="true" aria-label="Contenuto">${pp.body ? BODY[pp.body]() : '<h2>Quando serve</h2><p><br></p><h2>Procedura</h2><ol class="w-steps"><li><p><br></p></li></ol>'}</div>
        </div>
        <aside class="w-ed-side" aria-label="Proprietà della pagina">
          <section class="w-rail-s"><h4>Pubblicazione</h4>
            <label class="w-switch"><input type="checkbox" ${pp.draft ? '' : 'checked'}><span></span>Visibile a tutti</label>
            <p class="w-rail-none">${pp.draft ? 'Bozza: la vedi solo tu finché non la pubblichi.' : 'Pubblicata: compare nell\'elenco e nella ricerca.'}</p></section>
          <section class="w-rail-s"><h4>Posizione</h4><div class="f"><label for="w-cat">Cartella</label><select id="w-cat" data-edsel>${CATS.map((c) => `<option value="${c.id}" ${c.id === (edCat || pp.cat) ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
            <div class="f"><label for="w-par">Sotto la pagina <span class="opt">· facoltativa</span></label><select id="w-par"><option>Nessuna</option>${PAGES.filter((x) => x.cat === pp.cat && x.id !== pp.id && !x.parent).map((x) => `<option ${x.id === pp.parent ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div></section>
          <section class="w-rail-s"><h4>Tag</h4><div class="w-tags">${pp.tags.map((t) => `<span class="w-tag">${esc(t)}<button type="button" aria-label="Togli ${esc(t)}">${ic('x')}</button></span>`).join('')}<input placeholder="Aggiungi…" aria-label="Aggiungi tag"></div></section>
          <section class="w-rail-s"><h4>Collegata a <span>${pp.links.length}</span></h4>${pp.links.length ? `<ul class="w-links">${pp.links.map(([t, l]) => `<li><span class="w-ent">${linkIcon(t)}<span>${esc(l)}</span><small>${t}</small></span></li>`).join('')}</ul>` : ''}<button type="button" class="link-btn" data-toast="Si apre la scelta di cliente, sito o inventario">${ic('plus')}Collega cliente, sito o inventario</button></section>
          <section class="w-rail-s"><h4>Allegati</h4><div class="w-drop">${ic('upload')}<span>Trascina qui i file o <button type="button" class="link-btn">sfoglia</button></span></div></section>
          <p class="w-ed-note">${isNew ? 'Il codice KB viene assegnato alla creazione.' : `Salvando si crea la revisione ${pp.rev + 1}: la versione attuale resta nella cronologia.`}</p>
        </aside>
      </div>
      ${v === 'e' ? '</div></section>' : ''}
    </div>`;
  };

  // ── Pannello revisioni ─────────────────────────────────────────────
  const drawer = $('[data-w-drawer]'); const shell = $('.shell');
  const openRevs = (id) => {
    const p = page(id); const who = [p.by, 'F. Mutuale', 'A. Ferri', p.author];
    $('[data-wd="id"]').textContent = p.kb;
    $('[data-wd="title"]').textContent = 'Cronologia';
    $('[data-wd="sub"]').textContent = `${p.rev} revisioni · ${p.title}`;
    $('[data-wbody]').innerHTML = `<div class="drawer-body"><ol class="w-revs">${Array.from({ length: p.rev }, (_, i) => p.rev - i).map((n, i) => {
      const d = new Date(Date.parse(p.upd) - i * 9 * 864e5).toISOString().slice(0, 10);
      return `<li${i === 0 ? ' class="is-cur"' : ''}><span class="w-rev-n">${n}</span><span class="w-rev-t"><b>${who[i % who.length]}</b><small>${dshort(d)}${i === 0 ? ' · versione attuale' : ''}</small></span>
        ${i === 0 ? '' : `<span class="w-rev-a"><button class="btn btn-sm btn-ghost" type="button" data-toast="Si apre il confronto con la versione attuale">Confronta</button><button class="btn btn-sm" type="button" data-toast="Revisione ${n} ripristinata · creata la revisione ${p.rev + 1}">Ripristina</button></span>`}</li>`;
    }).join('')}</ol></div>`;
    drawer.hidden = false; shell.classList.add('has-drawer');
  };
  const closeDrawer = () => { drawer.hidden = true; shell.classList.remove('has-drawer'); };
  $('[data-wclose]').addEventListener('click', closeDrawer);

  // ── Render ─────────────────────────────────────────────────────────
  const paint = (keepFocus) => {
    const active = keepFocus ? document.activeElement : null;
    const sel = active && 'selectionStart' in active ? [active.getAttribute('data-q') !== null ? '[data-q]' : active.getAttribute('data-qq') !== null ? '[data-qq]' : '[data-libq]', active.selectionStart] : null;
    root.className = `content w-content w-v-${v} w-s-${screen}`;
    if (screen === 'edit') root.innerHTML = renderEdit(cur ? page(cur) : null);
    else if (screen === 'article' && v === 'e') { const p = page(cur); const par = p.parent ? page(p.parent) : null; root.innerHTML = `<div class="w-page w-page-e"><nav class="w-crumbs" aria-label="Percorso"><a href="#" data-home>${ic('chevL')}Archivio</a><span>/</span><a href="#" data-ecat="${p.cat}">${CAT[p.cat].name}</a>${par ? `<span>/</span><a href="#" data-open="${par.id}">${esc(par.title)}</a>` : ''}</nav><section class="w-open" style="--c:${CAT[p.cat].color}">${tabsStrip(p.cat, 'art')}<div class="w-open-in">${article(p, false, true)}</div></section></div>`; }
    else if (screen === 'article' && v !== 'b') root.innerHTML = `<div class="w-page">${article(page(cur))}</div>`;
    else if (v === 'e' && wSec === 'queries') root.innerHTML = renderQueries();
    else if (v === 'e' && wSec === 'stats') root.innerHTML = renderStats();
    else root.innerHTML = v === 'a' ? renderA() : v === 'b' ? renderB() : v === 'd' ? renderD() : v === 'e' ? renderE() : renderC();
    paintSteps();
    if (sel) { const el = $(sel[0], root); if (el) { el.focus(); el.setSelectionRange(sel[1], sel[1]); } }
    spy();
  };
  const paintSteps = () => {
    root.querySelectorAll('[data-art]').forEach((art) => {
      const id = Number(art.dataset.art); const st = done.get(id) || new Set(); let k = 0;
      art.querySelectorAll('[data-steps]').forEach((ol) => {
        const lis = [...ol.children];
        lis.forEach((li) => {
          const n = k++; const on = st.has(n);
          li.classList.toggle('is-done', on);
          if (!li.querySelector('.w-step')) li.insertAdjacentHTML('afterbegin', `<button type="button" class="w-step" data-step="${n}" aria-pressed="${on}" aria-label="Passo ${lis.indexOf(li) + 1}${on ? ', fatto' : ''}" title="Segna come fatto (solo su questo dispositivo)"><span>${lis.indexOf(li) + 1}</span>${tick}</button>`);
        });
        if (!ol.previousElementSibling?.classList.contains('w-prog')) {
          const tot = art.querySelectorAll('[data-steps] > li').length;
          const h = ol.previousElementSibling;
          if (h && h.tagName === 'H2' && ol === art.querySelector('[data-steps]')) h.insertAdjacentHTML('beforeend', `<span class="w-prog-h">${st.size ? `${st.size} di ${tot} fatti · <button type="button" class="link-btn" data-reset="${id}">Azzera</button>` : `${tot} passi`}</span>`);
        }
      });
    });
  };

  // Indice "In questa pagina" che segue lo scorrimento.
  const spy = () => {
    const sc = screen === 'article' && v !== 'b' ? root : root.querySelector('[data-scroll]');
    if (!sc) return;
    sc.onscroll = () => {
      const hs = [...sc.querySelectorAll('[data-prose] h2[id]')]; const top = sc.getBoundingClientRect().top + 90;
      let curId = hs[0]?.id; hs.forEach((h) => { if (h.getBoundingClientRect().top < top) curId = h.id; });
      sc.querySelectorAll('[data-toc]').forEach((a) => a.classList.toggle('is-on', a.dataset.toc === curId));
    };
  };

  // ── Messaggi ───────────────────────────────────────────────────────
  const toastEl = $('[data-toast]'); let tt = null;
  const toast = (m) => { toastEl.innerHTML = `${tick}<span>${esc(m)}</span>`; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3500); };

  // ── Interazioni ────────────────────────────────────────────────────
  const go = (s, id) => { screen = s; if (s !== 'index') wSec = 'pages'; if (id !== undefined) cur = id; if (s === 'edit') edCat = cur && page(cur) ? page(cur).cat : (eCat || 'proc'); closeDrawer(); paint(); root.scrollTop = 0; };
  document.addEventListener('click', (e) => {
    const t = (s) => e.target.closest(s); let el;
    if (!root.contains(e.target) && !drawer.contains(e.target) && !e.target.closest('[data-var-btn]')) return;
    if ((el = t('[data-copy]'))) { navigator.clipboard?.writeText(el.dataset.copy).catch(() => {}); toast(`Copiato · ${el.dataset.copy.length > 40 ? 'comando' : el.dataset.copy}`); return; }
    if ((el = t('[data-toast]'))) { e.preventDefault(); toast(el.dataset.toast); return; }
    if ((el = t('[data-step]'))) { const id = Number(el.closest('[data-art]').dataset.art); const st = done.get(id) || new Set(); const n = Number(el.dataset.step); st.has(n) ? st.delete(n) : st.add(n); done.set(id, st); paint(); return; }
    if ((el = t('[data-reset]'))) { done.delete(Number(el.dataset.reset)); paint(); return; }
    if ((el = t('[data-vote]'))) { myVote.set(Number(el.closest('[data-art]').dataset.art), Number(el.dataset.vote)); paint(); toast('Grazie: voto registrato'); return; }
    if ((el = t('[data-revs]'))) { openRevs(Number(el.dataset.revs)); return; }
    if ((el = t('[data-toc]'))) { e.preventDefault(); const h = root.querySelector('#' + el.dataset.toc); h?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); return; }
    if ((el = t('[data-edit]'))) { go('edit', Number(el.dataset.edit)); return; }
    if (t('[data-new]')) { cur = 0; go('edit'); return; }
    if (t('[data-save]')) { const was = cur; if (!was) { cur = 970; } go(v === 'b' ? 'index' : 'article'); toast(was ? `Salvata · revisione ${page(cur).rev + 1}` : 'Pagina creata · KB0000986'); return; }
    if (t('[data-cancel]')) { e.preventDefault(); if (!cur) cur = 864; go(v === 'b' || !page(cur) ? 'index' : 'article'); return; }
    if ((el = t('[data-pick]'))) { e.preventDefault(); cur = Number(el.dataset.pick); paint(); root.querySelector('[data-scroll]')?.scrollTo(0, 0); return; }
    if ((el = t('[data-open]'))) { e.preventDefault(); const id = Number(el.dataset.open); if (v === 'b') { cur = id; screen = 'index'; paint(); root.querySelector('[data-scroll]')?.scrollTo(0, 0); } else go('article', id); return; }
    if (t('[data-home]')) { e.preventDefault(); eCat = null; wSec = 'pages'; go('index'); return; }
    if ((el = t('[data-home-cat]'))) { e.preventDefault(); if (v === 'e') eCat = el.dataset.homeCat; else cats = new Set([el.dataset.homeCat]); go('index'); return; }
    if ((el = t('[data-tab]'))) { tab = el.dataset.tab; paint(); return; }
    if ((el = t('[data-cat]'))) { const c = el.dataset.cat; if (!c) cats.clear(); else if (cats.has(c)) cats.delete(c); else cats.add(c); cSel = 0; paint(); return; }
    if ((el = t('[data-grp]'))) { const g = el.dataset.grp; libOpen.has(g) ? libOpen.delete(g) : libOpen.add(g); paint(); return; }
    if ((el = t('[data-wsec]'))) { e.preventDefault(); wSec = el.dataset.wsec; if (el.dataset.ecat) { eCat = el.dataset.ecat; } if (el.dataset.open) { go('article', Number(el.dataset.open)); return; } screen = 'index'; closeDrawer(); paint(); root.scrollTop = 0; return; }
    if ((el = t('[data-eview]'))) { eView = el.dataset.eview; paint(); return; }
    if ((el = t('[data-qlang]'))) { qLang = el.dataset.qlang; paint(); return; }
    if ((el = t('[data-qsel]'))) { qSel = Number(el.dataset.qsel); paint(); return; }
    if ((el = t('[data-qsort]'))) { qSort = el.dataset.qsort; paint(); return; }
    if ((el = t('[data-qcopy]'))) { const x = QQ.find((y) => y.id === Number(el.dataset.qcopy)); navigator.clipboard?.writeText(x.b).catch(() => {}); x.uses += 1; paint(); toast(`Query copiata · usata ${x.uses} volte`); return; }
    if ((el = t('[data-edcat]'))) { moveTo(el.dataset.edcat); return; }
    if ((el = t('[data-ecat]'))) { e.preventDefault(); eCat = el.dataset.ecat || null; q = ''; screen = 'index'; closeDrawer(); paint(); root.scrollTop = 0; return; }
    if ((el = t('[data-fav]'))) { const id = Number(el.dataset.fav); const on = !FAV.has(id); on ? FAV.add(id) : FAV.delete(id); paint(); toast(on ? 'Aggiunta ai preferiti' : 'Tolta dai preferiti'); return; }
    if ((el = t('[data-dsort]'))) { dSort = el.dataset.dsort; paint(); return; }
    if ((el = t('[data-dgroup]'))) { dGroup = el.dataset.dgroup === '1'; paint(); return; }
    if ((el = t('[data-dall]'))) { const c = el.dataset.dall; dAll.has(c) ? dAll.delete(c) : dAll.add(c); paint(); return; }
    if ((el = t('[data-sugg]'))) { q = el.dataset.sugg; cSel = 0; paint(); $('[data-q]', root)?.focus(); return; }
    if (t('[data-menu]')) { toast('Menu: Sposta, Duplica, Elimina'); }
  });
  const moveTo = (cat) => {
    edCat = cat;
    const f = root.querySelector('[data-edfold]');
    if (f) { f.style.setProperty('--c', CAT[cat].color); f.querySelector('.w-open-tabs').outerHTML = tabsStrip(cat, 'edit'); }
    const sel = root.querySelector('[data-edsel]'); if (sel) sel.value = cat;
    toast(`Al salvataggio la pagina va in ${CAT[cat].name}`);
  };
  root.addEventListener('change', (e) => { if (e.target.matches('[data-edsel]')) moveTo(e.target.value); });
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) { q = e.target.value; cSel = 0; paint(true); }
    if (e.target.matches('[data-libq]')) { libQ = e.target.value; paint(true); }
    if (e.target.matches('[data-qq]')) { qq = e.target.value; paint(true); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('tr[data-open]') && e.key === 'Enter') { go('article', Number(e.target.dataset.open)); return; }
    if (v === 'c' && e.target.matches('[data-q]')) {
      const n = root.querySelectorAll('.w-res').length; if (!n) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cSel = (cSel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; root.querySelectorAll('.w-res').forEach((b, i) => b.classList.toggle('is-on', i === cSel)); root.querySelectorAll('.w-res')[cSel].scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); root.querySelectorAll('.w-res')[cSel]?.click(); }
      if (e.key === 'Escape') { q = ''; paint(true); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input, textarea, [contenteditable="true"]')) { const s = $('[data-q], [data-libq]', root); if (s) { e.preventDefault(); s.focus(); } }
    if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
  });

  // Proposta (barra dell'anteprima).
  const vbtns = document.querySelectorAll('[data-var-btn]');
  const setV = (x) => { v = x; screen = 'index'; eCat = null; wSec = 'pages'; q = ''; cats = new Set(); vbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.varBtn === v))); try { localStorage.setItem('archie-preview-w-var', v); } catch (err) { /* niente */ } closeDrawer(); paint(); };
  vbtns.forEach((b) => b.addEventListener('click', () => setV(b.dataset.varBtn)));
  const qs = new URLSearchParams(location.search);
  let saved = null; try { saved = localStorage.getItem('archie-preview-w-var'); } catch (err) { /* niente */ }
  v = qs.get('v') || saved || 'a';
  if (v === 'c') v = 'd'; // C scartata
  vbtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.varBtn === v)));
  if (qs.get('q')) q = qs.get('q');
  if (qs.get('cat')) eCat = qs.get('cat');
  if (qs.get('sec')) wSec = qs.get('sec');
  if (qs.get('eview')) eView = qs.get('eview');
  if (qs.get('page')) { cur = Number(qs.get('page')); screen = v === 'b' ? 'index' : 'article'; }
  if (qs.get('edit')) { cur = Number(qs.get('edit')); screen = 'edit'; }
  paint();
})();
