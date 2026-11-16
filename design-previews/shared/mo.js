/* Moduli (anteprima): interruttori per accendere e spegnere i moduli di Archie, solo per i superuser.
   Un modulo spento sparisce per tutti (menu, pagine, API, ricerca, widget, email e job del cron);
   il superuser continua a vederlo con l'etichetta «Spento» per provarlo prima del rilascio.
   "Modulo" = funzionalità, non app Django: ciò che serve ad altri moduli resta acceso. Oggi: 16/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // ═══ Moduli ═════════════════════════════════════════════════════
  // off: spento · who/when: ultima modifica · goes: cosa si spegne · stays: cosa resta acceso per altri moduli
  const MODS = [
    { k: 'issue', g: 'Operatività', l: 'Issue', i: 'alert', d: 'Issue dei clienti, procedure Wiki collegate, chiusura automatica.', goes: ['Pagina Issue e voce nel menu', 'Widget «Issue aperte» in Dashboard', 'Email di nuova issue e assegnazione', 'Chiusura automatica delle risolte (cron)', 'Risultati nella ricerca'], stays: ['Conversione dei Task di area in issue: il pulsante sparisce, i task restano'], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'task', g: 'Operatività', l: 'Task di area', i: 'task', d: 'Attività interne per area, commenti e allegati.', goes: ['Pagina Task di area e voce nel menu', 'Notifiche dei task'], stays: ['Aree degli utenti: servono anche al Piano ferie'], who: 'F. Mutuale', when: '11/10/2026' },
    { k: 'man', g: 'Operatività', l: 'Manutenzione', i: 'wrench', d: 'Piani, scadenze e rapportini.', goes: ['Pagina Manutenzione e voce nel menu', 'Widget delle scadenze in Dashboard', 'Notifiche di scadenza (cron)'], stays: [], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'mon', g: 'Operatività', l: 'Monitor', i: 'activity', d: 'Monitor dei sistemi dei clienti.', goes: ['Pagina Monitor e voce nel menu'], stays: [], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'wiki', g: 'Conoscenza', l: 'Wiki', i: 'book', d: 'Pagine, query e allegati.', goes: ['Pagina Wiki e voce nel menu', 'Allegati della Wiki', 'Risultati nella ricerca'], stays: ['Le procedure già collegate alle issue restano come testo'], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'drive', g: 'Conoscenza', l: 'Drive', i: 'folder', d: 'File e cartelle con permessi.', goes: ['Pagina Drive e voce nel menu', 'Scaricamento dei file'], stays: [], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'ctr', g: 'Amministrazione', l: 'Contratti', i: 'file', d: 'Contratti dei clienti e scadenze.', goes: ['Pagina Contratti e voce nel menu', 'Scheda Contratti nel cliente'], stays: [], who: 'F. Mutuale', when: '07/11/2026' },
    { k: 'po', g: 'Amministrazione', l: 'Purchase Order', i: 'bag', d: 'Ordini, importi e documenti.', goes: ['Pagina Purchase Order e voce nel menu'], stays: [], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'rs', g: 'Amministrazione', l: 'Rimborso spese', i: 'receipt', d: 'Note spese, trasferte e scontrini.', goes: ['Pagina Rimborso spese e voce nel menu', 'Email alla segreteria'], stays: [], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'pf', g: 'Amministrazione', l: 'Piano ferie', i: 'calendar', d: 'Richieste di ferie, approvazioni e griglia per area.', off: true, why: 'In attesa del rilascio', goes: ['Pagina Piano ferie e voce nel menu', 'Richieste e approvazioni di ferie', 'Email al coordinatore e al richiedente', 'Area ferie nel Profilo'], stays: ['Assenze dei tecnici ServiceNow (Dashboard casi, Triage)', 'Aree degli utenti, usate dai Task di area'], who: 'F. Mutuale', when: '16/11/2026 10:24' },
    { k: 'sn', g: 'Amministrazione', l: 'ServiceNow', i: 'cloud', d: 'Casi, Triage, Dashboard casi e assenze dei tecnici.', goes: ['Pagine Casi e Dashboard casi', 'Sincronizzazione dei casi (cron)', 'Assenze dei tecnici'], stays: ['Il numero di caso già scritto nelle issue'], who: 'F. Mutuale', when: '02/09/2026' },
    { k: 'bug', g: 'Sistema', l: 'Bug e feature', i: 'chat', d: 'Segnalazioni e richieste degli utenti.', goes: ['Pagina Bug e feature e voce nel menu'], stays: [], who: 'F. Mutuale', when: '02/09/2026' },
  ];
  const FIXED = [['dashboard', 'Dashboard'], ['building', 'Clienti, siti e contatti'], ['server', 'Inventari'], ['monitor', 'Device'], ['history', 'Audit'], ['trash', 'Cestino'], ['users', 'Utenti e gruppi'], ['key', 'Accesso Portal']];
  const GROUPS = ['Operatività', 'Conoscenza', 'Amministrazione', 'Sistema'];
  const NAVLABEL = { issue: 'Issue', task: 'Task di area', man: 'Manutenzione', mon: 'Monitor', wiki: 'Wiki', drive: 'Drive', ctr: 'Contratti', po: 'Purchase Order', rs: 'Rimborso spese', pf: 'Piano ferie', sn: 'ServiceNow' };
  const LOG = [['16/11/2026 10:24', 'F. Mutuale', 'ha spento', 'Piano ferie', 'In attesa del rilascio'], ['07/11/2026 18:02', 'F. Mutuale', 'ha acceso', 'Contratti', ''], ['07/11/2026 09:15', 'F. Mutuale', 'ha spento', 'Contratti', 'Fase 1 in prova'], ['11/10/2026 12:40', 'F. Mutuale', 'ha acceso', 'Task di area', '']];

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* niente */ } };
  let page = qs.get('pagina') || 'mod';
  let variant = qs.get('variante') || ls('archie-preview-mo-v', 'a');
  let who = qs.get('vista') || 'su';
  let sel = null;
  const root = $('[data-mo]');
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell');
  const mdlBg = $('[data-mdl]'); const mdl = $('.mdl', mdlBg);
  const toast = $('[data-toast]');

  // ── Sidebar: voce Moduli in Sistema, moduli spenti ──────────────
  const navItems = () => [...document.querySelectorAll('.nav-item')];
  const trashLi = navItems().find((a) => a.textContent.trim().startsWith('Cestino'))?.closest('li');
  if (trashLi) {
    const li = trashLi.cloneNode(true); const a = li.querySelector('a'); a.dataset.tip = 'Moduli'; a.dataset.su = '1';
    a.innerHTML = a.innerHTML.replace('Cestino', 'Moduli').replace(/<svg[\s\S]*?<\/svg>/, ic('columns'));
    trashLi.after(li);
  }
  const syncNav = () => {
    navItems().forEach((a) => {
      const label = a.dataset.tip || a.textContent.trim();
      const m = MODS.find((x) => NAVLABEL[x.k] === label);
      const li = a.closest('li');
      const on = (page === 'mod' && label === 'Moduli') || (page === 'pf' && label === 'Piano ferie');
      a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      a.querySelector('.nav-off')?.remove();
      a.classList.toggle('is-off', !!m?.off);
      if (a.dataset.su) li.hidden = who !== 'su';
      else if (m) {
        li.hidden = !!m.off && who !== 'su';
        if (m.off && who === 'su') a.insertAdjacentHTML('beforeend', '<span class="nav-off">spento</span>');
      }
    });
    document.querySelectorAll('.nav-group').forEach((g) => { g.hidden = ![...g.querySelectorAll('li')].some((li) => !li.hidden); });
  };

  // ── Pezzi ───────────────────────────────────────────────────────
  const sw = (m) => `<button type="button" class="mo-sw${m.off ? '' : ' on'}" role="switch" aria-checked="${!m.off}" aria-label="${m.off ? 'Accendi' : 'Spegni'} ${esc(m.l)}" data-toggle="${m.k}"><i></i></button>`;
  const state = (m) => (m.off ? '<span class="mo-st off"><i></i>Spento</span>' : '<span class="mo-st on"><i></i>Attivo</span>');
  const offCount = () => MODS.filter((m) => m.off).length;
  const head = () => `<div class="mt-head"><h1>Moduli</h1><span class="mo-sub">${offCount() ? `<b>${offCount()}</b> ${offCount() === 1 ? 'modulo spento' : 'moduli spenti'} su ${MODS.length}` : `Tutti i ${MODS.length} moduli sono accesi`}</span></div>
    <div class="mo-intro">${ic('lock')}<p>Un modulo spento sparisce per tutti gli utenti: menu, pagine, ricerca, widget, email e job automatici. Restano i dati, che tornano visibili quando lo riaccendi. Tu, come superuser, continui a vederlo con l'etichetta <span class="mo-st off sm"><i></i>Spento</span> per provarlo prima del rilascio.</p></div>`;
  const fixed = () => `<section class="mo-fixed"><h3>Sempre accesi</h3><p>Il cuore di Archie: gli altri moduli dipendono da questi e non si possono spegnere.</p><div class="mo-fx">${FIXED.map(([i, l]) => `<span>${ic(i)}${l}</span>`).join('')}</div></section>`;

  const listA = () => `${head()}${GROUPS.map((g) => { const rows = MODS.filter((m) => m.g === g); return `<section class="panel mo-grp"><h3 class="mo-gh">${g}<span>${rows.length}</span></h3><table class="po-table mo-table"><tbody>${rows.map((m) => `
      <tr data-open="${m.k}" tabindex="0" class="${m.off ? 'is-off' : ''}${sel === m.k ? ' is-selected' : ''}">
        <td class="c-mod"><span class="mo-mod"><span class="mo-ico">${ic(m.i)}</span><span><b>${m.l}</b><small>${m.d}</small></span></span></td>
        <td class="c-note">${m.off ? `<span class="mo-why">${ic('clock')}${esc(m.why)} · dal ${m.when.split(' ')[0]}</span>` : ''}</td>
        <td class="c-st">${state(m)}</td>
        <td class="c-sw">${sw(m)}</td></tr>`).join('')}</tbody></table></section>`; }).join('')}${fixed()}`;

  const cardsB = () => `${head()}${GROUPS.map((g) => { const rows = MODS.filter((m) => m.g === g); return `<h3 class="mo-bh">${g}</h3><div class="mo-cards">${rows.map((m) => `
      <article class="mo-card${m.off ? ' is-off' : ''}" data-open="${m.k}" tabindex="0">
        <header><span class="mo-ico">${ic(m.i)}</span><b>${m.l}</b>${sw(m)}</header>
        <p>${m.d}</p>
        <footer>${m.off ? `<span class="mo-st off"><i></i>Spento</span><span class="mo-why">${esc(m.why)}</span>` : `<span class="mo-st on"><i></i>Attivo</span>`}</footer>
      </article>`).join('')}</div>`; }).join('')}${fixed()}`;

  const logSec = () => `<section class="ct-sec"><div class="h"><h4>Storico</h4></div><ul class="feed2">${LOG.filter((x) => x[3] === MODS.find((m) => m.k === sel)?.l).map(([w, u, a, , why]) => `<li>${ic(a === 'ha spento' ? 'eyeOff' : 'eye')}<span>${u} ${a} il modulo${why ? ` · <i>${esc(why)}</i>` : ''}</span><time>${w}</time></li>`).join('') || '<li><span class="none">Sempre acceso dal rilascio.</span></li>'}</ul></section>`;
  const renderDrawer = () => {
    const m = MODS.find((x) => x.k === sel); if (!m) return;
    $('[data-md="id"]').textContent = 'Modulo'; $('[data-md="st"]').innerHTML = state(m);
    $('[data-md="title"]').textContent = m.l; $('[data-md="sub"]').textContent = m.d;
    $('[data-mtabs]').innerHTML = '';
    $('[data-mbody]').innerHTML = `<div class="drawer-body int-body">
      ${m.off ? `<section class="ct-sec"><div class="callout warn"><div><b>Spento dal ${m.when}</b><span>${esc(m.who)} · ${esc(m.why)}. Gli utenti non lo vedono; tu sì.</span></div></div></section>` : ''}
      <section class="ct-sec"><div class="h"><h4>${m.off ? 'Cosa è spento' : 'Se lo spegni, sparisce'}</h4></div><ul class="mo-li off">${m.goes.map((x) => `<li>${ic('eyeOff')}${esc(x)}</li>`).join('')}</ul></section>
      ${m.stays.length ? `<section class="ct-sec"><div class="h"><h4>Resta acceso per gli altri moduli</h4></div><ul class="mo-li on">${m.stays.map((x) => `<li>${ic('check')}${esc(x)}</li>`).join('')}</ul></section>` : ''}
      <section class="ct-sec"><div class="h"><h4>I dati</h4></div><p class="mo-p">Nessun dato viene cancellato: richieste, allegati e storico restano nel database e tornano visibili quando il modulo si riaccende.</p></section>
      ${logSec()}</div>
      <div class="drawer-foot"><span class="g-spacer"></span>${m.off ? `<button class="btn btn-primary" type="button" data-toggle="${m.k}">${ic('eye')}Accendi per tutti</button>` : `<button class="btn btn-danger-o" type="button" data-toggle="${m.k}">${ic('eyeOff')}Spegni</button>`}</div>`;
  };

  // ── Pagina di un modulo spento ──────────────────────────────────
  const pfPage = () => {
    if (who !== 'su') return `<div class="mo-nf"><span class="mo-nf-code">404</span><h1>Pagina non trovata</h1><p>L'indirizzo <span class="code">/piano-ferie</span> non esiste o non è disponibile.</p><div class="mo-nf-a"><a class="btn btn-primary" href="#">${ic('dashboard')}Torna alla Dashboard</a></div></div>`;
    const days = Array.from({ length: 14 }, (_, i) => i + 16);
    const ppl = [['Nicole Spazzoli', [18, 19, 20]], ['Luca Della Zazzera', [23, 24, 25, 26, 27]], ['Leonardo Romano', []], ['Niccolò Nanni', [16, 17]], ['Federico Mutuale', [27, 28, 29]]];
    return `<div class="mo-banner" role="status">${ic('eyeOff')}<div><b>Piano ferie è spento</b><span>Lo vedi solo tu perché sei superuser: gli altri utenti non hanno la voce nel menu e trovano la pagina 404. Spento il 16/11/2026 · In attesa del rilascio.</span></div><a class="btn" href="#" data-goto="mod">Gestisci i moduli</a><button class="btn btn-primary" type="button" data-toggle="pf">Accendi per tutti</button></div>
      <div class="mt-head"><h1>Piano ferie</h1><span class="mo-sub">Area Bologna · novembre 2026</span></div>
      <section class="panel mo-pf"><table><thead><tr><th></th>${days.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${ppl.map(([n, off]) => `<tr><th>${n}</th>${days.map((d) => `<td>${off.includes(d) ? '<i></i>' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
  };

  // ── Dialogo di conferma ─────────────────────────────────────────
  let pending = null;
  const ask = (m) => {
    pending = m;
    mdl.innerHTML = m.off
      ? `<div class="mdl-h"><h3 id="mdl-t">Accendere ${esc(m.l)}?</h3><p>Da subito tutti gli utenti con i permessi del modulo lo vedono nel menu e ricevono di nuovo le email.</p></div>
        <div class="mdl-f"><button class="btn" type="button" data-mclose>Annulla</button><button class="btn btn-primary" type="button" data-mok>Accendi per tutti</button></div>`
      : `<div class="mdl-h"><h3 id="mdl-t">Spegnere ${esc(m.l)}?</h3><p>Sparisce per tutti tranne i superuser. Nessun dato viene cancellato.</p></div>
        <div class="mdl-b"><span class="mo-lh">Sparisce</span><ul class="mo-li off">${m.goes.map((x) => `<li>${ic('eyeOff')}${esc(x)}</li>`).join('')}</ul>${m.stays.length ? `<span class="mo-lh">Resta acceso</span><ul class="mo-li on">${m.stays.map((x) => `<li>${ic('check')}${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="f"><label for="mo-why">Motivo <span class="opt">facoltativo</span></label><input id="mo-why" placeholder="Es. in attesa del rilascio"></div></div>
        <div class="mdl-f"><button class="btn" type="button" data-mclose>Annulla</button><button class="btn btn-danger" type="button" data-mok>Spegni</button></div>`;
    mdlBg.hidden = false; $('[data-mok]', mdl).focus();
  };
  const closeMdl = () => { mdlBg.hidden = true; pending = null; };
  mdlBg.addEventListener('click', (e) => {
    if (e.target === mdlBg || e.target.closest('[data-mclose]')) return closeMdl();
    if (!e.target.closest('[data-mok]') || !pending) return;
    const m = pending; const why = $('#mo-why', mdl)?.value.trim();
    m.off = !m.off; m.when = '16/11/2026 ' + new Date().toTimeString().slice(0, 5); m.who = 'F. Mutuale';
    if (m.off) m.why = why || 'Nessun motivo indicato';
    LOG.unshift([m.when, 'F. Mutuale', m.off ? 'ha spento' : 'ha acceso', m.l, m.off ? why : '']);
    closeMdl();
    toast.innerHTML = `${ic('check')}<span>${m.l} ${m.off ? 'spento' : 'acceso per tutti'}</span><button type="button" data-undo="${m.k}">Annulla</button>`;
    toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { toast.hidden = true; }, 5000);
    render();
  });
  toast.addEventListener('click', (e) => { const b = e.target.closest('[data-undo]'); if (!b) return; const m = MODS.find((x) => x.k === b.dataset.undo); m.off = !m.off; LOG.shift(); toast.hidden = true; render(); });

  // ── Render ──────────────────────────────────────────────────────
  const openD = () => { drawer.hidden = false; shell.classList.add('has-drawer'); render(); };
  const closeD = () => { sel = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  $('[data-mclose-d]').addEventListener('click', closeD);
  const NAMES = { a: 'Elenco', b: 'Schede' };
  const render = () => {
    if (page === 'mod' && who !== 'su') {
      root.innerHTML = `<div class="mo-nf"><span class="mo-nf-code">404</span><h1>Pagina non trovata</h1><p>La pagina Moduli esiste solo per i superuser: un utente qualunque non ha la voce nel menu e trova la 404, come per un modulo spento.</p></div>`;
    } else root.innerHTML = page === 'pf' ? pfPage() : variant === 'b' ? cardsB() : listA();
    if (!drawer.hidden && sel && page === 'mod' && who === 'su') renderDrawer(); else if (!drawer.hidden) { drawer.hidden = true; shell.classList.remove('has-drawer'); }
    syncNav();
    document.querySelectorAll('[data-mop]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mop === page)));
    document.querySelectorAll('[data-mov]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mov === variant)));
    document.querySelectorAll('[data-mow]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mow === who)));
    $('[data-mov-name]').textContent = NAMES[variant];
  };
  const onAct = (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) { e.stopPropagation(); return ask(MODS.find((m) => m.k === t.dataset.toggle)); }
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); page = g.dataset.goto; return render(); }
    const o = e.target.closest('[data-open]');
    if (o) { sel = o.dataset.open; openD(); }
  };
  root.addEventListener('click', onAct);
  drawer.addEventListener('click', (e) => { if (e.target.closest('[data-toggle]')) onAct(e); });
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open]')) { e.preventDefault(); sel = e.target.dataset.open; openD(); } });
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!mdlBg.hidden) closeMdl(); else if (!drawer.hidden) closeD(); });
  document.querySelector('.nav').addEventListener('click', (e) => {
    const a = e.target.closest('.nav-item'); if (!a) return; e.preventDefault();
    const l = a.dataset.tip; if (l === 'Moduli') page = 'mod'; else if (l === 'Piano ferie') page = 'pf'; else return;
    render();
  });
  document.querySelectorAll('[data-mop]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.mop; render(); }));
  document.querySelectorAll('[data-mov]').forEach((b) => b.addEventListener('click', () => { variant = b.dataset.mov; save('archie-preview-mo-v', variant); render(); }));
  document.querySelectorAll('[data-mow]').forEach((b) => b.addEventListener('click', () => { who = b.dataset.mow; render(); }));
  render();
})();
