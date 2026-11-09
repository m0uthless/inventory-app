/* ServiceNow (anteprima): Casi, Statistiche, Assenze tecnici. Dati finti modellati sui reali:
   caso = numero (CS…), account, priorità 1–4, data e ora apertura, descrizione breve, screenshot, categoria (oggi visibile
   solo Biotron), type (L1, PRIVATI, CDD), stato interno (aperto, in lavorazione, chiuso), assegnatario, link esterno.
   Triage = casi aperti oggi per tecnico, con chi è assente adesso. Assenze = giornata, mattina/pomeriggio o permesso orario,
   motivo (ferie, malattia, 104, training, trasferta, altro). Oggi: lunedì 09/11/2026, ore 10:30. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const BARS = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/></svg>';
  const GRID = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>';
  const EXT = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  document.querySelectorAll('.nav-item').forEach((a) => { const on = a.textContent.trim().startsWith('ServiceNow'); a.classList.toggle('is-active', on); });

  // ═══ Dati ════════════════════════════════════════════════════════
  const TECHS = [
    { id: 1, name: 'Federica Marchesini', short: 'Federica' },
    { id: 2, name: 'Nicole Spazzoli', short: 'Nicole' },
    { id: 3, name: 'Niccolò Nanni', short: 'Niccolò', absent: 'Ferie', absLong: 'in ferie fino a mercoledì' },
    { id: 4, name: 'Luca Della Zazzera', short: 'Luca' },
    { id: 5, name: 'Leonardo Romano', short: 'Leonardo', absent: 'Permesso', absLong: 'permesso 09:00–11:00' },
    { id: 6, name: 'Federico Mutuale', short: 'Federico' },
  ];
  const TYPES = { L1: 't1', PRIVATI: 't2', CDD: 't3' };
  const PR = { 1: ['Critica', 'p1'], 2: ['Alta', 'p2'], 3: ['Media', 'p3'], 4: ['Bassa', 'p4'] };
  const ST = { open: ['Aperto', 'info'], in_progress: ['In lavorazione', 'warn'], closed: ['Chiuso', 'np'] };
  let cid = 0;
  const C = (num, acc, type, pr, when, desc, who, st = 'open', extra = {}) => ({ id: ++cid, num, acc, type, pr, when, desc, who, st, ...extra });
  const CASES = [
    C('CS0631240', 'AZIENDA USL DI BOLOGNA', 'L1', 2, 'oggi 10:12', 'Worklist vuota sulla TC 2 dell\'Ospedale Maggiore', null, 'open', { today: true, shot: true }),
    C('CS0631238', 'IRCCS ISTITUTO ORTOPEDICO RIZZOLI', 'L1', 3, 'oggi 09:47', 'Referti non visibili dal reparto di Ortopedia', 2, 'in_progress', { today: true }),
    C('CS0631231', 'CENTRO MEDICO ESPERIA', 'PRIVATI', 3, 'oggi 09:20', 'Richiesta reinstallazione viewer su nuova workstation', 4, 'open', { today: true }),
    C('CS0631229', 'AUSL ROMAGNA', 'L1', 1, 'oggi 08:58', 'PACS non raggiungibile dalla Radiologia di Ravenna', 1, 'in_progress', { today: true, shot: true }),
    C('CS0631226', 'CASA DI CURA VILLA ERBOSA', 'CDD', 4, 'oggi 08:31', 'Masterizzazione CD paziente non parte', 6, 'open', { today: true }),
    C('CS0631225', 'AUSL DI IMOLA', 'L1', 3, 'oggi 08:15', 'Utente bloccato su console di refertazione', 2, 'closed', { today: true }),
    C('CS0631212', 'AZIENDA OSPEDALIERA DI PARMA', 'L1', 3, 'ven 17:40', 'Dose SR non ricevuti dal RIS', 4, 'in_progress'),
    C('CS0631198', 'POLIAMBULATORIO SAN LUCA', 'PRIVATI', 4, 'ven 14:02', 'Stampante DryView in errore 14', 1, 'open'),
    C('CS0631187', 'AUSL DI FERRARA', 'L1', 2, 'ven 11:25', 'Lentezza apertura studi pesanti di mammografia', 6, 'in_progress', { shot: true }),
    C('CS0631170', 'CASA DI CURA VILLA ERBOSA', 'CDD', 3, 'gio 16:10', 'Etichette CD con data errata', 4, 'closed'),
    C('CS0631152', 'AZIENDA USL DI BOLOGNA', 'L1', 3, 'gio 09:05', 'Cambio password utenze tecnici di radiologia', 2, 'closed'),
  ];
  const techName = (id) => TECHS.find((t) => t.id === id)?.name ?? '';
  const techShort = (id) => TECHS.find((t) => t.id === id)?.short ?? '';
  const ava = (name, cls = '') => `<span class="sav ${cls}" aria-hidden="true">${ini(name)}</span>`;
  const typeTag = (t) => `<span class="ttag ${TYPES[t]}">${t}</span>`;
  const prDot = (p) => `<span class="prd ${PR[p][1]}" title="Priorità ${PR[p][0]}"><i></i>${PR[p][0]}</span>`;
  const stBadge = (s) => `<span class="nst ${ST[s][1]}">${ST[s][0]}</span>`;

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  let page = qs.get('pagina') || ls('archie-preview-sn-p', 'cases');
  const variant = { cases: ls('archie-preview-sn-vcases', 'a'), stats: ls('archie-preview-sn-vstats', 'a'), abs: ls('archie-preview-sn-vabs', 'a') };
  if (qs.get('variante')) variant[page] = qs.get('variante');
  let cView = 'open'; let openCase = null; let gran = 'month'; let dlg = null;
  const root = $('[data-sn]');
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell');

  // ═══ Casi ═══════════════════════════════════════════════════════
  const triage = () => {
    const today = CASES.filter((c) => c.today);
    const un = today.filter((c) => !c.who).length;
    const max = Math.max(...TECHS.map((t) => today.filter((c) => c.who === t.id).length), 1);
    return `<section class="tri" aria-label="Triage di oggi"><header><h2>Oggi</h2><span class="tri-d">lunedì 9 novembre · ${today.length} casi aperti</span>${un ? `<button type="button" class="tri-un">${ic('alert')}<b>${un}</b> da assegnare</button>` : ''}<span class="sp"></span><button class="lnk" type="button">Gestisci le assenze</button></header>
      <div class="tri-list">${TECHS.map((t) => { const n = today.filter((c) => c.who === t.id).length; return `<div class="tri-t${t.absent ? ' away' : ''}">${ava(t.name)}<span class="tri-n"><b>${t.short}</b><small>${t.absent ? t.absLong : n ? `${n} ${n === 1 ? 'caso' : 'casi'} oggi` : 'nessun caso oggi'}</small></span><span class="tri-bar"><i style="width:${(n / max) * 100}%"></i></span><span class="tri-c">${n}</span></div>`; }).join('')}</div></section>`;
  };
  const CVIEWS = [['open', 'Da gestire', (c) => c.st !== 'closed'], ['mine', 'Miei', (c) => c.who === 6 && c.st !== 'closed'], ['unassigned', 'Da assegnare', (c) => !c.who && c.st !== 'closed', true], ['closed', 'Chiusi', (c) => c.st === 'closed'], ['all', 'Tutti', () => true]];
  const head = (title, actions) => `<div class="mt-head"><h1>${title}</h1><div class="actions">${actions || ''}</div></div>`;
  const casesHead = () => head('ServiceNow', `<button class="btn" type="button" data-sstat="chart">${BARS}Andamento</button><button class="btn" type="button" data-sstat="heat">${GRID}Per tecnico</button><button class="icon-btn" type="button" aria-label="Importa lo storico da CSV" title="Importa lo storico da CSV">${ic('upload')}</button><button class="btn btn-primary" type="button" data-cnew>${ic('plus')}Nuovo caso</button>`);
  const casesA = () => { const rows = CASES.filter(CVIEWS.find((v) => v[0] === cView)[2]);
    return `${casesHead()}${triage()}<section class="panel" aria-label="Casi"><div class="vtabs">${CVIEWS.map(([k, l, f, alert]) => { const n = CASES.filter(f).length; return `<button type="button" aria-pressed="${k === cView}" data-cview="${k}">${l} <span${alert && n ? ' class="alert"' : ''}>${n}</span></button>`; }).join('')}</div>
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">Nessun filtro. Usa l'imbuto accanto al nome di una colonna.</span></div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Esporta">${ic('download')}</button><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      <div class="table-wrap"><table class="po-table sn-table"><thead><tr><th class="c-num">Numero</th><th>Account e descrizione</th><th class="c-type">Type</th><th class="c-pr">Priorità</th><th class="c-when">Aperto</th><th class="c-who">Assegnato a</th><th class="c-st">Stato</th></tr></thead><tbody>${rows.map((c) => `<tr data-copen="${c.id}" tabindex="0" class="${openCase === c.id ? 'is-selected' : ''}">
        <td class="c-num"><span class="cnum"><code>${c.num}</code><a href="#" aria-label="Apri in ServiceNow" title="Apri in ServiceNow" onclick="event.stopPropagation()">${EXT}</a></span></td>
        <td><span class="cacc"><b>${esc(c.acc)}</b><small>${esc(c.desc)}</small></span></td>
        <td class="c-type">${typeTag(c.type)}</td><td class="c-pr">${prDot(c.pr)}</td><td class="c-when">${c.when}</td>
        <td class="c-who">${c.who ? `<span class="whoin">${ava(techName(c.who))}${techShort(c.who)}</span>` : '<span class="unas">Da assegnare</span>'}</td><td class="c-st">${stBadge(c.st)}</td></tr>`).join('')}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> casi</span></div></section>`; };
  const casesB = () => { const today = CASES.filter((c) => c.st !== 'closed');
    const col = (title, sub, items, cls, t) => `<section class="bcol2 ${cls}" aria-label="${esc(title)}"><header>${t ? ava(t.name) : `<span class="bci2">${ic('alert')}</span>`}<div><b>${title}</b><small>${sub}</small></div><span class="bcn">${items.length}</span></header><div class="bcards2">${items.map((c) => `<button type="button" class="ccard${openCase === c.id ? ' on' : ''}" data-copen="${c.id}"><span class="ccard-h"><code>${c.num}</code>${typeTag(c.type)}${prDot(c.pr)}</span><b>${esc(c.acc)}</b><small>${esc(c.desc)}</small><span class="ccard-f">${c.when}${c.st === 'in_progress' ? ' · in lavorazione' : ''}</span></button>`).join('') || `<p class="none">${t?.absent ? 'Assente: meglio non assegnare.' : 'Libero.'}</p>`}</div></section>`;
    return `${casesHead()}<p class="sn-hint">Casi aperti, uno per colonna per tecnico. Trascina una scheda su un tecnico per assegnarla.</p><div class="board2">${col('Da assegnare', 'arrivati senza tecnico', today.filter((c) => !c.who), 'un')}${TECHS.map((t) => col(t.short, t.absent ? t.absLong : `${today.filter((c) => c.who === t.id && c.today).length} oggi`, today.filter((c) => c.who === t.id), t.absent ? 'away' : '', t)).join('')}</div>`; };

  const renderDrawer = () => {
    const c = CASES.find((x) => x.id === openCase); if (!c) return;
    $('[data-md="id"]').innerHTML = `<code>${c.num}</code>`; $('[data-md="st"]').innerHTML = stBadge(c.st); $('[data-md="title"]').textContent = c.acc; $('[data-md="sub"]').textContent = `${c.type} · priorità ${PR[c.pr][0].toLowerCase()} · aperto ${c.when}`;
    $('[data-mtabs]').innerHTML = '';
    $('[data-mbody]').innerHTML = `<div class="drawer-body int-body">
      <section class="ct-sec"><div class="h"><h4>Descrizione</h4><a class="lnk" href="#">${EXT}Apri in ServiceNow</a></div><p class="cdesc">${esc(c.desc)}</p></section>
      ${c.shot ? `<section class="ct-sec"><div class="h"><h4>Screenshot</h4><button class="lnk" type="button">Apri a tutto schermo</button></div><span class="shot2"><i class="sb"></i><i class="sl"></i><i class="sl s2"></i><i class="sl s3"></i></span></section>` : ''}
      <section class="ct-sec"><div class="h"><h4>Stato</h4></div><span class="st-pick">${Object.keys(ST).map((k) => `<button type="button" aria-pressed="${k === c.st}" class="${ST[k][1] === 'info' ? 'ok' : ST[k][1]}">${ST[k][0]}</button>`).join('')}</span></section>
      <section class="ct-sec"><div class="h"><h4>Assegnato a</h4></div><div class="assign">${TECHS.map((t) => `<button type="button" aria-pressed="${t.id === c.who}" class="${t.absent ? 'away' : ''}" title="${t.absent ? esc(t.absLong) : ''}">${ava(t.name, 'xs')}<span>${t.short}</span>${t.absent ? `<small>${t.absent}</small>` : ''}</button>`).join('')}</div></section>
      <section class="ct-sec"><div class="h"><h4>Dati</h4></div><dl class="mprops"><dt>Account</dt><dd>${esc(c.acc)}</dd><dt>Type</dt><dd>${typeTag(c.type)}</dd><dt>Priorità</dt><dd>${prDot(c.pr)}</dd><dt>Aperto</dt><dd>${c.when}</dd></dl></section>
      <section class="ct-sec"><div class="h"><h4>Storia</h4></div><div class="feed"><div class="ev">${ic('plus')}<span><b>Federico Mutuale</b> l'ha registrato da screenshot</span><time>${c.when}</time></div>${c.who ? `<div class="ev">${ic('user')}<span>assegnato a <b>${techName(c.who)}</b></span><time>${c.when}</time></div>` : ''}</div></section></div>
      <div class="drawer-foot"><button class="btn" type="button">${ic('trash')}Elimina</button><span class="g-spacer"></span><button class="btn btn-primary" type="button">Modifica</button></div>`;
  };
  const openD = (id) => { openCase = id; drawer.hidden = false; shell.classList.add('has-drawer'); render(); renderDrawer(); };
  const closeD = () => { openCase = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  $('[data-mclose-d]').addEventListener('click', closeD);

  // Nuovo caso: dallo screenshot si leggono numero, account, priorità e descrizione
  const mdl = $('[data-mdl]'); const box = mdl.querySelector('.mdl');
  const paintDlg = () => {
    if (!dlg) { mdl.hidden = true; return; }
    if (dlg.kind === 'stats') { mdl.hidden = false; box.className = 'mdl cb-mdl sn-stats'; box.innerHTML = statsModal(); return; }
    mdl.hidden = false; box.className = 'mdl cb-mdl sn-mdl';
    box.innerHTML = `<div class="mdl-h"><div><h3 id="mdl-t">Nuovo caso</h3><p>${dlg.read ? 'Ho letto lo screenshot: controlla e completa.' : 'Incolla lo screenshot del caso: numero, account, priorità e descrizione si compilano da soli.'}</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
      <div class="rp-body">${dlg.read ? `<div class="shot-row"><span class="shot2 sm"><i class="sb"></i><i class="sl"></i><i class="sl s2"></i></span><span class="okread">${ic('check')}<b>4 campi letti</b> dallo screenshot</span><button class="lnk" type="button" data-dreset>Cambia</button></div>
        <div class="pf-grid2"><div class="f"><label>Numero</label><input value="CS0631244" class="mono read"></div><div class="f"><label>Priorità</label><div class="seg-pr">${[1, 2, 3, 4].map((p) => `<button type="button" aria-pressed="${p === 3}" class="${PR[p][1]}">${PR[p][0]}</button>`).join('')}</div></div>
        <div class="f wide"><label>Account</label><input value="AUSL ROMAGNA" class="read"></div><div class="f wide"><label>Descrizione breve</label><input value="Modalità ecografo non invia le immagini al PACS" class="read"></div>
        <div class="f"><label>Type</label><div class="seg-pr">${Object.keys(TYPES).map((t) => `<button type="button" aria-pressed="${t === 'L1'}">${t}</button>`).join('')}</div></div><div class="f"><label>Aperto il</label><input value="09/11/2026 10:28"></div>
        <div class="f wide"><label>Assegna a</label><div class="assign">${TECHS.map((t) => `<button type="button" aria-pressed="${t.id === 4}" class="${t.absent ? 'away' : ''}">${ava(t.name, 'xs')}<span>${t.short}</span>${t.absent ? `<small>${t.absent}</small>` : ''}</button>`).join('')}</div><span class="help">Suggerito: Luca, oggi ha meno casi.</span></div></div>`
        : `<button type="button" class="drop-big" data-dread>${ic('upload')}<b>Incolla lo screenshot</b><span>Ctrl+V, trascinalo qui o sfoglia</span></button><button class="lnk" type="button" data-dread style="justify-self:start">Oppure compila a mano</button>`}</div>
      <div class="nc-foot"><span class="sp"></span><button class="btn btn-ghost" type="button" data-dclose>Annulla</button><button class="btn btn-primary" type="button" ${dlg.read ? '' : 'disabled'} data-dclose>Crea caso</button></div>`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.stab) { dlg.tab = b.dataset.stab; return paintDlg(); } if (b.dataset.gran) { gran = b.dataset.gran; return paintDlg(); } if (b.matches('[data-dclose]')) { dlg = null; paintDlg(); } if (b.matches('[data-dread]')) { dlg.read = true; paintDlg(); } if (b.matches('[data-dreset]')) { dlg.read = false; paintDlg(); } });
  mdl.addEventListener('mousedown', (e) => { if (e.target === mdl) { dlg = null; paintDlg(); } });

  // ═══ Statistiche ════════════════════════════════════════════════
  const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov'];
  const seed = (i, j) => Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
  const MATRIX = TECHS.map((t, i) => MONTHS.map((m, j) => (j === 10 ? Math.round(4 + seed(i, j) * 8) : Math.round(14 + seed(i, j) * 26 - (t.id === 6 ? 8 : 0)))));
  const TYPE_SHARE = [0.68, 0.22, 0.10];
  const byMonth = MONTHS.map((m, j) => MATRIX.reduce((s, r) => s + r[j], 0));
  const total = byMonth.reduce((a, b) => a + b, 0);
  const statsFilters = () => `<div class="sx-filters"><span class="seg-g">${[['month', 'Mesi'], ['week', 'Settimane'], ['day', 'Giorni']].map(([k, l]) => `<button type="button" aria-pressed="${gran === k}" data-gran="${k}">${l}</button>`).join('')}</span>
    <button type="button" class="fchip">${ic('calendar')}2026${ic('chevD')}</button><button type="button" class="fchip">${ic('users')}Tutti i tecnici${ic('chevD')}</button><button type="button" class="fchip">Tutti i type${ic('chevD')}</button><span class="sp"></span><button class="btn" type="button">${ic('download')}Esporta PDF</button></div>`;
  const barsChart = () => { const max = Math.max(...byMonth); const H = 180;
    return `<figure class="chart" aria-label="Casi per mese, per type"><figcaption><b>Casi gestiti per mese</b><span class="legend">${Object.keys(TYPES).map((t, i) => `<span><i class="sw ${TYPES[t]}"></i>${t}</span>`).join('')}</span></figcaption>
      <div class="bars" style="--h:${H}px">${MONTHS.map((m, j) => { const v = byMonth[j]; const seg = TYPE_SHARE.map((s) => Math.round(v * s)); return `<div class="bcolm${j === 10 ? ' partial' : ''}" tabindex="0" title="${m}: ${v} casi — L1 ${seg[0]}, PRIVATI ${seg[1]}, CDD ${seg[2]}"><span class="bv">${j === 10 || v === max ? v : ''}</span><div class="stack" style="height:${(v / max) * H}px">${seg.map((s, k) => `<i class="${['t1', 't2', 't3'][k]}" style="flex:${s}"></i>`).reverse().join('')}</div><span class="bl">${m}</span></div>`; }).join('')}</div>
      <p class="chart-note">Novembre è in corso.</p></figure>`; };
  const heat = () => { const max = Math.max(...MATRIX.flat());
    return `<figure class="chart" aria-label="Casi per tecnico e mese"><figcaption><b>Per tecnico</b><span class="legend seq"><span>meno</span>${[0.15, 0.35, 0.55, 0.75, 0.95].map((a) => `<i style="--a:${a}"></i>`).join('')}<span>più</span></span></figcaption>
      <div class="hm-wrap"><table class="hm"><thead><tr><th></th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}<th class="tot">Totale</th></tr></thead><tbody>${TECHS.map((t, i) => `<tr><th><span class="whoin">${ava(t.name, 'xs')}${t.short}</span></th>${MATRIX[i].map((v, j) => `<td style="--a:${(0.08 + (v / max) * 0.92).toFixed(2)}" class="${v / max > 0.7 ? 'dk' : ''}" title="${t.short}, ${MONTHS[j]}: ${v} casi">${v}</td>`).join('')}<td class="tot">${MATRIX[i].reduce((a, b) => a + b, 0)}</td></tr>`).join('')}
      <tr class="sum"><th>Totale</th>${byMonth.map((v) => `<td>${v}</td>`).join('')}<td class="tot">${total}</td></tr></tbody></table></div></figure>`; };
  const tiles = () => { const per = TECHS.map((t, i) => [t, MATRIX[i].reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1]);
    return `<div class="st-tiles"><div class="st-t"><span>Casi nel 2026</span><b>${total.toLocaleString('it-IT')}</b><small>${Math.round(total / 10.3)} al mese in media</small></div>
      <div class="st-t"><span>Per type</span><div class="typebar">${Object.keys(TYPES).map((t, k) => `<i class="${TYPES[t]}" style="flex:${TYPE_SHARE[k]}"></i>`).join('')}</div><small>${Object.keys(TYPES).map((t, k) => `${t} <b>${Math.round(TYPE_SHARE[k] * 100)}%</b>`).join(' · ')}</small></div>
      <div class="st-t"><span>Chi ne ha gestiti di più</span><b class="sm">${per[0][0].short}</b><small>${per[0][1]} casi · poi ${per[1][0].short} (${per[1][1]})</small></div></div>`; };
  const donut = () => { const r = 52; const C = 2 * Math.PI * r; let off = 0; const gap = 2;
    const segs = TYPE_SHARE.map((v, k) => { const len = v * C - gap; const el = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="var(--t${k + 1})" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${Object.keys(TYPES)[k]}: ${Math.round(v * total)} casi</title></circle>`; off += v * C; return el; }).join('');
    return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Casi per type">${segs}<text x="70" y="68" text-anchor="middle" font-size="22" font-weight="750" fill="var(--text)">${total.toLocaleString('it-IT')}</text><text x="70" y="86" text-anchor="middle" font-size="11" fill="var(--muted)">casi</text></svg>
      <div class="dl">${Object.keys(TYPES).map((t, k) => `<span><i class="t${k + 1}"></i>${t}<b>${Math.round(TYPE_SHARE[k] * 100)}%</b></span>`).join('')}</div></div>`; };
  const barsSm = (H = 110) => { const max = Math.max(...byMonth);
    return `<div class="bars sm" style="--h:${H}px">${MONTHS.map((m, j) => { const v = byMonth[j]; const seg = TYPE_SHARE.map((x) => Math.round(v * x)); return `<div class="bcolm${j === 10 ? ' partial' : ''}" tabindex="0" title="${m}: ${v} casi — L1 ${seg[0]}, PRIVATI ${seg[1]}, CDD ${seg[2]}"><span class="bv">${j === 10 || v === max ? v : ''}</span><div class="stack" style="height:${(v / max) * H}px">${seg.map((x, k) => `<i class="t${k + 1}" style="flex:${x}"></i>`).reverse().join('')}</div><span class="bl">${m}</span></div>`; }).join('')}</div><p class="chart-note">Novembre è in corso.</p>`; };
  const heatSm = () => { const max = Math.max(...MATRIX.flat());
    return `<div class="hm-wrap"><table class="hm sm"><thead><tr><th></th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}<th class="tot">Tot.</th></tr></thead><tbody>${TECHS.map((t, i) => `<tr><th>${t.short}</th>${MATRIX[i].map((v, j) => `<td style="--a:${(0.08 + (v / max) * 0.92).toFixed(2)}" class="${v / max > 0.7 ? 'dk' : ''}" title="${t.short}, ${MONTHS[j]}: ${v} casi">${v}</td>`).join('')}<td class="tot">${MATRIX[i].reduce((a, b) => a + b, 0)}</td></tr>`).join('')}</tbody></table></div>
      <div class="legend seq" style="margin-top:8px"><span>meno</span>${[0.15, 0.35, 0.55, 0.75, 0.95].map((a) => `<i style="--a:${a}"></i>`).join('')}<span>più</span></div>`; };
  const sumLine = () => { const per = TECHS.map((t, i) => [t, MATRIX[i].reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1]);
    return `<div class="st-sum"><span><b>${total.toLocaleString('it-IT')}</b>casi nel 2026</span><span><b>${Math.round(total / 10.3)}</b>al mese</span><span>più casi: <b style="font-size:13px">${per[0][0].short}</b>(${per[0][1]})</span></div>`; };
  const stBar = () => `<div class="st-bar"><span class="seg-g">${[['month', 'Mesi'], ['week', 'Settimane'], ['day', 'Giorni']].map(([k, l]) => `<button type="button" aria-pressed="${gran === k}" data-gran="${k}">${l}</button>`).join('')}</span><button type="button" class="fchip">2026${ic('chevD')}</button><button type="button" class="fchip">Tutti i tecnici${ic('chevD')}</button><span class="sp"></span><button class="icon-btn" type="button" aria-label="Esporta PDF" title="Esporta PDF">${ic('download')}</button></div>`;
  const statsModal = () => `<div class="mdl-h"><div><h3 id="mdl-t">Statistiche</h3><p>Casi Biotron gestiti nel 2026.</p></div><button class="icon-btn" type="button" data-dclose aria-label="Chiudi">${ic('x')}</button></div>
    <div class="st-tabs" role="tablist">${[['chart', 'Andamento'], ['heat', 'Per tecnico']].map(([k, l]) => `<button type="button" role="tab" aria-pressed="${dlg.tab === k}" data-stab="${k}">${l}</button>`).join('')}</div>
    <div class="rp-body">${stBar()}${sumLine()}${dlg.tab === 'heat' ? heatSm() : `<div class="st-pair">${donut()}<div>${barsSm()}</div></div>`}</div>`;
  const absTable = (sm) => `<table class="wkg${sm ? ' sm' : ''}"><thead><tr><th>${sm ? '' : 'Tecnico'}</th>${DAYS.map((d, i) => `<th class="${i === 0 ? 'today' : ''}">${d}${i === 0 && !sm ? '<small>oggi</small>' : ''}</th>`).join('')}</tr></thead><tbody>${TECHS.map((t) => `<tr><th>${sm ? t.short : `<span class="whoin">${ava(t.name, 'xs')}${t.name}</span>`}</th>${DAYS.map((d, i) => { const v = ABS[t.id]?.[i]; return `<td class="${i === 0 ? 'today' : ''}"><button type="button" class="day" aria-label="${t.short}, ${d}">${v ? half(v[0]) + half(v[1]) : '<span class="hf"></span><span class="hf"></span><span class="add">' + ic('plus') + '</span>'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  const dashboard = () => `${head('Dashboard casi', `<span class="st-bar">${stBar().replace('<div class="st-bar">', '').replace(/<\/div>$/, '')}</span>`)}
    <div class="dash"><div class="dash-col">
      <section class="dcard"><header><h2>Andamento</h2></header>${sumLine()}<div class="st-pair" style="margin-top:12px">${donut()}<div>${barsSm(120)}</div></div></section>
      <section class="dcard"><header><h2>Per tecnico</h2></header>${heatSm()}</section></div>
    <div class="dash-col">
      <section class="dcard"><header><h2>Oggi</h2><span class="tri-d">${CASES.filter((c) => c.today).length} casi aperti</span><button class="tri-un" type="button">${ic('alert')}<b>1</b> da assegnare</button></header>${triage()}</section>
      <section class="dcard"><header><h2>Assenze della settimana</h2><span class="wk"><button class="icon-btn sm" type="button" aria-label="Settimana precedente">${ic('chevL')}</button><b style="min-width:110px;font-size:12.5px">9 – 13 nov</b><button class="icon-btn sm" type="button" aria-label="Settimana successiva">${ic('chevR')}</button></span><button class="btn btn-sm" type="button">${ic('plus')}Assenza</button></header>${absTable(true)}${legend().replace('class="rleg"', 'class="rleg sm"')}</section>
    </div></div>`;
  const statsA = () => `${head('Statistiche ServiceNow')}${statsFilters()}${tiles()}${barsChart()}${heat()}`;
  const statsB = () => { const max = Math.max(...MATRIX.flat());
    return `${head('Statistiche ServiceNow')}${statsFilters()}${tiles()}<div class="mults">${TECHS.map((t, i) => { const s = MATRIX[i].reduce((a, b) => a + b, 0); return `<article class="mult"><header>${ava(t.name)}<div><b>${t.name}</b><small>${s} casi nel 2026${t.absent ? ` · oggi ${t.absent.toLowerCase()}` : ''}</small></div></header>
      <div class="mbars">${MATRIX[i].map((v, j) => `<i style="height:${(v / max) * 100}%" class="${j === 10 ? 'partial' : ''}" title="${MONTHS[j]}: ${v}"></i>`).join('')}</div><div class="mlab"><span>Gen</span><span>Nov</span></div>
      <div class="typebar thin">${Object.keys(TYPES).map((tt, k) => `<i class="${TYPES[tt]}" style="flex:${TYPE_SHARE[k] + (seed(i, k) - 0.5) * 0.1}"></i>`).join('')}</div></article>`; }).join('')}</div>`; };

  // ═══ Assenze ═══════════════════════════════════════════════════
  const REASONS = { ferie: ['Ferie', 'mint'], malattia: ['Malattia', 'rose'], p104: ['104', 'lilac'], training: ['Training', 'sky'], trasferta: ['Trasferta', 'sand'], altro: ['Altro', 'neutral'], ora: ['Permesso orario', 'peach'] };
  const DAYS = ['Lun 9', 'Mar 10', 'Mer 11', 'Gio 12', 'Ven 13'];
  const ABS = { 3: { 0: ['ferie', 'ferie'], 1: ['ferie', 'ferie'], 2: ['ferie', 'ferie'] }, 5: { 0: [['ora', '9–11'], null] }, 1: { 3: ['training', 'training'] }, 4: { 4: [null, 'p104'] }, 2: { 2: [['ora', '15–17'], null] } };
  const half = (v) => { if (!v) return '<span class="hf"></span>'; const [k, t] = Array.isArray(v) ? v : [v]; return `<span class="hf r-${REASONS[k][1]}" title="${REASONS[k][0]}${t ? ` ${t}` : ''}">${t || REASONS[k][0].slice(0, 3)}</span>`; };
  const legend = () => `<div class="rleg">${Object.values(REASONS).map(([l, c]) => `<span><i class="r-${c}"></i>${l}</span>`).join('')}<span class="none">Ogni giorno: mattina a sinistra, pomeriggio a destra</span></div>`;
  const absA = () => `${head('Assenze tecnici', `<span class="wk"><button class="icon-btn" type="button" aria-label="Settimana precedente">${ic('chevL')}</button><b>9 – 13 novembre 2026</b><button class="icon-btn" type="button" aria-label="Settimana successiva">${ic('chevR')}</button><button class="btn btn-sm" type="button">Oggi</button></span><button class="btn btn-primary" type="button">${ic('plus')}Nuova assenza</button>`)}
    <section class="panel">${absTable(false)}</section>${legend()}`;
  const absB = () => { const days = Array.from({ length: 30 }, (_, i) => i + 1); const wd = (d) => (d + 6) % 7;
    const mk = (tid, d) => { if (tid === 3 && d >= 9 && d <= 11) return 'mint'; if (tid === 1 && d === 12) return 'sky'; if (tid === 4 && (d === 13 || d === 27)) return 'lilac'; if (tid === 6 && d >= 23 && d <= 25) return 'sand'; if (tid === 2 && d === 4) return 'rose'; if ((tid === 5 && d === 9) || (tid === 2 && d === 11)) return 'peach'; return ''; };
    return `${head('Assenze tecnici', `<span class="wk"><button class="icon-btn" type="button" aria-label="Mese precedente">${ic('chevL')}</button><b>Novembre 2026</b><button class="icon-btn" type="button" aria-label="Mese successivo">${ic('chevR')}</button></span><button class="btn btn-primary" type="button">${ic('plus')}Nuova assenza</button>`)}
    <section class="panel mon-wrap"><table class="mong"><thead><tr><th>Tecnico</th>${days.map((d) => `<th class="${wd(d) >= 5 ? 'we' : ''}${d === 9 ? ' today' : ''}">${d}</th>`).join('')}<th>Giorni</th></tr></thead><tbody>${TECHS.map((t) => { let n = 0; return `<tr><th><span class="whoin">${ava(t.name, 'xs')}${t.short}</span></th>${days.map((d) => { const c = wd(d) >= 5 ? '' : mk(t.id, d); if (c && c !== 'peach') n++; return `<td class="${wd(d) >= 5 ? 'we' : ''}${d === 9 ? ' today' : ''}"><i class="${c ? `r-${c}` : ''}"></i></td>`; }).join('')}<td class="cnt">${n || ''}</td></tr>`; }).join('')}</tbody></table></section>${legend()}`; };

  // ── Render ──────────────────────────────────────────────────────
  const NAMES = { cases: { a: 'Tabella e Oggi', b: 'Smistamento' }, stats: { a: 'Finestra nei Casi', b: 'Dashboard casi' }, abs: { a: 'Settimana', b: 'Mese' } };
  const render = () => {
    root.innerHTML = page === 'cases' ? (variant.cases === 'b' ? casesB() : casesA()) : page === 'stats' ? (variant.stats === 'b' ? dashboard() : casesA()) : (variant.abs === 'b' ? absB() : absA());
    document.querySelectorAll('[data-snp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.snp === page)));
    document.querySelectorAll('[data-snv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.snv === variant[page])));
    $('[data-snv-name]').textContent = NAMES[page][variant[page]];
    if (page === 'stats' && variant.stats === 'a' && !dlg && !statsShown) { statsShown = true; dlg = { kind: 'stats', tab: 'chart' }; paintDlg(); }
    if (!(page === 'stats' && variant.stats === 'a')) statsShown = false;
  };
  let statsShown = false;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-copen]'); if (!b) return;
    if (b.dataset.cview) { cView = b.dataset.cview; return render(); }
    if (b.dataset.copen) return openD(Number(b.dataset.copen));
    if (b.dataset.gran) { gran = b.dataset.gran; return render(); }
    if (b.matches('[data-cnew]')) { dlg = { read: false }; return paintDlg(); }
    if (b.dataset.sstat) { dlg = { kind: 'stats', tab: b.dataset.sstat }; return paintDlg(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (dlg) { dlg = null; paintDlg(); } else if (openCase) closeD(); } });
  document.querySelectorAll('[data-snp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.snp; if (openCase) closeD(); try { localStorage.setItem('archie-preview-sn-p', page); } catch { /* niente */ } render(); }));
  document.querySelectorAll('[data-snv]').forEach((b) => b.addEventListener('click', () => { variant[page] = b.dataset.snv; if (openCase) closeD(); try { localStorage.setItem(`archie-preview-sn-v${page}`, variant[page]); } catch { /* niente */ } render(); }));
  render();
})();
