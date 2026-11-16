/* Profilo e Utenti e gruppi (anteprima). Dati finti modellati sui reali:
   /me: username, email, nome, cognome, avatar, cliente preferito, area ferie, tema e modalità, gruppi, permessi.
   /admin-users/: is_active, is_staff, is_superuser, gruppi, permessi da gruppo e diretti per modulo (lettura/scrittura/eliminazione),
   accesso Portal, profilo (Philips, tecnico ServiceNow, account funzionale, coordinatore ferie, area ferie, segreteria spese).
   /admin-groups/: nome, utenti, permessi per modulo. Oggi: 08/11/2026. */
(() => {
  const ic = (n) => Preview.icon(n);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  // Voce "Utenti e gruppi" nella sidebar dell'anteprima (in Sistema)
  const trashLi = [...document.querySelectorAll('.nav-item')].find((a) => a.textContent.trim().startsWith('Cestino'))?.closest('li');
  if (trashLi && !document.querySelector('[data-tip="Utenti e gruppi"]')) {
    const li = trashLi.cloneNode(true); const a = li.querySelector('a'); a.dataset.tip = 'Utenti e gruppi';
    a.innerHTML = a.innerHTML.replace('Cestino', 'Utenti e gruppi').replace(/<svg[\s\S]*?<\/svg>/, ic('users'));
    trashLi.after(li);
  }
  const setNav = (label) => document.querySelectorAll('.nav-item').forEach((a) => { const on = label && (a.dataset.tip || a.textContent.trim()).startsWith(label); a.classList.toggle('is-active', !!on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });

  // ═══ Moduli e permessi ═══════════════════════════════════════════
  const MODS = [['crm', 'Clienti, siti e contatti'], ['inventory', 'Inventari e monitor'], ['issues', 'Issue'], ['maintenance', 'Manutenzione'], ['wiki', 'Wiki'], ['drive', 'Drive'], ['contracts', 'Contratti'], ['purchaseorders', 'Purchase Order'], ['expenses', 'Rimborso spese'], ['attendance', 'Piano ferie'], ['servicenow', 'ServiceNow'], ['feedback', 'Bug e feature'], ['audit', 'Audit'], ['core', 'Sistema']];
  const PMODS = [['portal', 'Accesso al Portal'], ['device', 'Device'], ['vlan', 'VLAN e rete']];
  const LV = { n: ['Nessuno', 0], r: ['Lettura', 1], w: ['Scrittura', 2], d: ['Completo', 3] };
  const P = (o) => Object.fromEntries(MODS.map(([k]) => [k, o[k] || o._ || 'n']));
  const GROUPS = [
    { id: 1, name: 'Tecnici', desc: 'Lavoro quotidiano su clienti, inventari, issue e manutenzione', perms: P({ crm: 'w', inventory: 'w', issues: 'w', maintenance: 'w', wiki: 'w', drive: 'w', contracts: 'r', purchaseorders: 'r', expenses: 'w', attendance: 'w', servicenow: 'r', feedback: 'w', _: 'n' }) },
    { id: 2, name: 'Amministrazione', desc: 'Contratti, ordini, rimborsi e ferie', perms: P({ crm: 'r', inventory: 'r', contracts: 'd', purchaseorders: 'd', expenses: 'd', attendance: 'd', feedback: 'w', drive: 'w', _: 'n' }) },
    { id: 3, name: 'Coordinatori', desc: 'Tecnici con gestione di piani, contratti e audit', perms: P({ crm: 'd', inventory: 'd', issues: 'd', maintenance: 'd', wiki: 'd', drive: 'd', contracts: 'w', purchaseorders: 'w', expenses: 'w', attendance: 'd', servicenow: 'w', feedback: 'd', audit: 'r', _: 'n' }) },
    { id: 4, name: 'Sola lettura', desc: 'Consultazione senza modifiche', perms: P({ crm: 'r', inventory: 'r', issues: 'r', maintenance: 'r', wiki: 'r', drive: 'r', _: 'n' }) },
  ];
  let uid = 0;
  const U = (first, last, user, extra = {}) => ({ id: ++uid, first, last, name: `${first} ${last}`.trim(), user, email: `${user}@biotron.it`, active: true, groups: [], flags: [], last: 'oggi', ...extra });
  const USERS = [
    U('Federico', 'Mutuale', 'f.mutuale', { groups: [3], su: true, flags: ['coord'], area: 'Bologna', lastIn: 'oggi 08:41' }),
    U('Nicole', 'Spazzoli', 'n.spazzoli', { groups: [1], flags: ['sn'], area: 'Bologna', lastIn: 'oggi 09:02' }),
    U('Luca', 'Della Zazzera', 'l.dellazazzera', { groups: [1], flags: ['sn', 'philips'], area: 'Bologna', lastIn: 'ieri' }),
    U('Leonardo', 'Romano', 'l.romano', { groups: [1], direct: { audit: 'r' }, area: 'Romagna', lastIn: 'oggi 07:55' }),
    U('Niccolò', 'Nanni', 'n.nanni', { groups: [1], area: 'Romagna', lastIn: '3 giorni fa' }),
    U('Sara', 'De Paola', 's.depaola', { groups: [2], flags: ['exp'], area: 'Sede', lastIn: 'oggi 08:30' }),
    U('Marco', 'Romanelli', 'm.romanelli', { groups: [1], area: 'Friuli', lastIn: '2 settimane fa' }),
    U('Anna', 'Ferri', 'a.ferri', { groups: [1, 3], area: 'Friuli', lastIn: 'ieri' }),
    U('Giulia', 'Ferrari', 'g.ferrari', { groups: [], portal: 'AUSL Imola', lastIn: '5 giorni fa', ext: true }),
    U('ServiceNow', 'Sync', 'servicenow-bot', { groups: [], flags: ['func'], direct: { servicenow: 'd', issues: 'w' }, lastIn: 'oggi 10:15' }),
    U('Paolo', 'Bini', 'p.bini', { groups: [4], active: false, lastIn: '4 mesi fa' }),
  ];
  const FLAGS = { coord: ['Coordinatore ferie', 'sand'], sn: ['Tecnico ServiceNow', 'sky'], philips: ['Philips', 'lilac'], exp: ['Segreteria spese', 'mint'], func: ['Account funzionale', 'neutral'] };
  const effective = (u) => { const out = {}; MODS.forEach(([k]) => { let best = 'n'; let from = null; u.groups.forEach((g) => { const lv = GROUPS.find((x) => x.id === g).perms[k]; if (LV[lv][1] > LV[best][1]) { best = lv; from = GROUPS.find((x) => x.id === g).name; } }); const d = u.direct?.[k]; if (d && LV[d][1] > LV[best][1]) { best = d; from = 'diretto'; } out[k] = [u.su ? 'd' : best, u.su ? 'superuser' : from]; }); return out; };
  const role = (u) => (u.su ? '<span class="rl su">Superuser</span>' : u.ext ? '<span class="rl ext">Solo Portal</span>' : '');
  const ava = (u, cls = '') => `<span class="uav ${cls}" aria-hidden="true">${ini(u.name)}</span>`;
  const flagTags = (u) => u.flags.map((f) => `<span class="ftag t-${FLAGS[f][1]}">${FLAGS[f][0]}</span>`).join('');
  const lvDots = (lv) => `<span class="lvd lv-${lv}" title="${LV[lv][0]}"><i></i><i></i><i></i></span>`;

  // ── Stato ───────────────────────────────────────────────────────
  const qs = new URLSearchParams(location.search);
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  let page = qs.get('pagina') || ls('archie-preview-up-p', 'pro');
  const variant = { pro: ls('archie-preview-up-vpro', 'a'), usr: ls('archie-preview-up-vusr', 'a') };
  if (qs.get('variante')) variant[page] = qs.get('variante');
  let proTab = 'dati'; let uTab = 'users'; let uView = 'active'; let sel = null; let dTab = 'perm'; let selB = 2; let gSel = 1;
  const root = $('[data-up]');
  const drawer = $('[data-mt-drawer]'); const shell = $('.shell');
  const ME = USERS[0];

  // ═══ Profilo ════════════════════════════════════════════════════
  const idCard = (compact) => `<section class="idc${compact ? ' compact' : ''}"><div class="idc-ava"><span>${ini(ME.name)}</span><button class="icon-btn sm" type="button" aria-label="Cambia foto">${ic('upload')}</button></div>
    <div class="idc-t"><h2>${ME.name}</h2><p>@${ME.user} · ${ME.email}</p><div class="idc-tags"><span class="rl su">Superuser</span>${ME.groups.map((g) => `<span class="gtag">${GROUPS.find((x) => x.id === g).name}</span>`).join('')}${flagTags(ME)}</div></div>
    ${compact ? '' : `<dl class="idc-facts"><div><dt>Ultimo accesso</dt><dd>oggi 08:41</dd></div><div><dt>Area ferie</dt><dd>Bologna</dd></div><div><dt>In Archie dal</dt><dd>marzo 2024</dd></div></dl>`}</section>`;
  const secDati = () => `<div class="pf-grid"><div class="f"><label>Nome</label><input value="Federico"></div><div class="f"><label>Cognome</label><input value="Mutuale"></div>
    <div class="f wide"><label>Email</label><input value="f.mutuale@biotron.it"></div>
    <div class="f wide"><label>Nome utente</label><input value="f.mutuale" disabled><span class="help">Il nome utente non si può cambiare.</span></div>
    <div class="f wide"><label>Cliente preferito</label><div class="fake-sel">${ic('building')}<span>AUSL Bologna</span>${ic('chevD')}</div><span class="help">Viene proposto per primo quando crei issue, inventari e rapportini.</span></div></div>
    <div class="pf-foot"><span class="sp"></span><button class="btn btn-primary" type="button">Salva</button></div>`;
  const secAspetto = () => `<div class="pf-blk"><h4>Modalità</h4><div class="seg3">${[['sun', 'Chiaro', true], ['moon', 'Scuro'], ['monitor', 'Come il sistema']].map(([i, l, on]) => `<button type="button" aria-pressed="${!!on}">${ic(i)}${l}</button>`).join('')}</div></div>
    <div class="pf-blk"><h4>Palette</h4><div class="pals">${[['Verde sterile', '#1f6a5a', '#e3efea', true], ['Blu clinico', '#1f5f99', '#e1ebf6'], ['Indaco', '#4a48a6', '#e8e8f7']].map(([n, a, b, on]) => `<button type="button" class="pal${on ? ' on' : ''}"><span class="pals-sw"><i style="background:${a}"></i><i style="background:${b}"></i></span><b>${n}</b>${on ? `<span class="ck">${ic('check')}</span>` : ''}</button>`).join('')}</div></div>`;
  const secSicurezza = () => `<div class="pf-blk"><h4>Cambia password</h4><div class="pf-grid one"><div class="f"><label>Password attuale</label><input type="password" value="xxxxxxxxxx"></div><div class="f"><label>Nuova password</label><input type="password" value="xxxxxxxxxxxxxx"><div class="pw-meter"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div><span class="help">Buona. Almeno 12 caratteri, meglio una frase.</span></div><div class="f"><label>Ripeti la nuova password</label><input type="password"></div></div>
    <div class="pf-foot"><span class="sp"></span><button class="btn btn-primary" type="button">Cambia password</button></div></div>
    <div class="pf-blk"><h4>Accessi recenti</h4><ul class="acc">${[['oggi 08:41', 'Chrome su Windows', '10.20.1.34'], ['ieri 17:58', 'Chrome su Windows', '10.20.1.34'], ['ieri 07:12', 'Safari su iPhone', '93.41.200.17']].map(([w, b, ip]) => `<li>${ic('key')}<span><b>${b}</b><small>${ip}</small></span><time>${w}</time></li>`).join('')}</ul><p class="help">La sessione si chiude da sola dopo un periodo di inattività.</p></div>`;
  const fromTxt = (from, me) => (from ? (from === 'diretto' ? `<span class="dir">${me ? 'assegnato a te' : 'assegnato a mano'}</span>` : from === 'superuser' ? 'superuser' : `gruppo ${from}`) : '—');
  const permTable = (u, editable) => { const e = effective(u);
    if (editable) return `<table class="pmx"><tbody>${MODS.map(([k, l]) => { const [lv, from] = e[k]; return `<tr class="${lv === 'n' ? 'off' : ''}"><td><span class="mname">${l}</span><small class="from">${fromTxt(from, false)}</small></td><td class="c-lv"><span class="lvpick">${['n', 'r', 'w', 'd'].map((x) => `<button type="button" aria-pressed="${x === lv}" class="lv-${x}">${LV[x][0]}</button>`).join('')}</span></td></tr>`; }).join('')}</tbody></table>`;
    return `<table class="pmx"><thead><tr><th>Modulo</th><th>Accesso</th><th>Da dove</th></tr></thead><tbody>${MODS.map(([k, l]) => { const [lv, from] = e[k]; return `<tr class="${lv === 'n' ? 'off' : ''}"><td>${l}</td><td>${lvDots(lv)}<span class="lvl">${LV[lv][0]}</span></td><td class="from">${fromTxt(from, true)}</td></tr>`; }).join('')}</tbody></table>`; };
  const secPermessi = () => `<p class="pf-intro">Cosa puoi fare in Archie. I permessi arrivano dai gruppi; per cambiarli chiedi a chi gestisce gli utenti.</p>${permTable(ME, false)}`;
  const ACT = [['wrench', 'ha registrato un rapportino su', 'PM Rizzoli 2026', 'oggi 09:20'], ['alert', 'ha chiuso la issue', '#1027 Firmware DryView 5950', 'ieri 16:40'], ['book', 'ha modificato la pagina wiki', 'Rizzoli: accesso VPN e jump host', 'ieri 11:02'], ['server', 'ha aggiornato l\'inventario', 'BO-MAG-WSR03', '3 giorni fa'], ['restore', 'ha ripristinato il contatto', 'Marco Bellini', '4 giorni fa'], ['plus', 'ha creato il cliente', 'Centro Medico Esperia', '1 settimana fa']];
  const secAttivita = () => `<ul class="feed2">${ACT.map(([i, t, o, w]) => `<li>${ic(i)}<span>${t} <a href="#">${o}</a></span><time>${w}</time></li>`).join('')}</ul><a class="lnk" href="#">Tutta la mia attività nell'Audit</a>`;
  const PSECS = [['dati', 'Dati personali', secDati], ['aspetto', 'Aspetto', secAspetto], ['sicurezza', 'Sicurezza', secSicurezza], ['permessi', 'Permessi', secPermessi], ['attivita', 'Attività', secAttivita]];
  const proA = () => `<div class="mt-head"><h1>Profilo</h1></div>${idCard(false)}
    <section class="panel"><div class="vtabs" role="tablist">${PSECS.map(([k, l]) => `<button type="button" role="tab" aria-pressed="${k === proTab}" data-ptab="${k}">${l}</button>`).join('')}</div><div class="pf-body">${PSECS.find((s) => s[0] === proTab)[2]()}</div></section>`;
  const proB = () => `<div class="mt-head"><h1>Profilo</h1></div><div class="pfb"><aside class="pfb-side">${idCard(true)}<nav>${PSECS.map(([k, l], i) => `<a href="#pf-${k}" class="${i === 0 ? 'on' : ''}">${l}</a>`).join('')}</nav></aside>
    <div class="pfb-main">${PSECS.map(([k, l, f]) => `<section class="pf-card" id="pf-${k}"><h2>${l}</h2>${f()}</section>`).join('')}</div></div>`;

  // ═══ Utenti e gruppi ═══════════════════════════════════════════
  const UVIEWS = [['active', 'Attivi', (u) => u.active && !u.ext && !u.flags.includes('func')], ['portal', 'Solo Portal', (u) => u.ext], ['func', 'Account funzionali', (u) => u.flags.includes('func')], ['off', 'Disattivati', (u) => !u.active], ['all', 'Tutti', () => true]];
  const uHead = () => `<div class="mt-head"><h1>Utenti e gruppi</h1><span class="seg-top" role="tablist">${[['users', 'Utenti', USERS.length], ['groups', 'Gruppi', GROUPS.length]].map(([k, l, n]) => `<button type="button" role="tab" aria-pressed="${uTab === k}" data-utab="${k}">${l} <span>${n}</span></button>`).join('')}</span><div class="actions"><button class="btn btn-primary" type="button">${ic('plus')}${uTab === 'users' ? 'Nuovo utente' : 'Nuovo gruppo'}</button></div></div>`;
  const usersA = () => { const rows = USERS.filter(UVIEWS.find((v) => v[0] === uView)[2]);
    return `<section class="panel"><div class="vtabs">${UVIEWS.map(([k, l, f]) => `<button type="button" aria-pressed="${k === uView}" data-uview="${k}">${l} <span>${USERS.filter(f).length}</span></button>`).join('')}</div>
      <div class="toolbar tb-row"><div class="tokens"><span class="none" style="font-size:12px">Nessun filtro. Usa l'imbuto accanto al nome di una colonna.</span></div><span class="spacer"></span><button class="icon-btn" type="button" aria-label="Cerca">${ic('search')}</button></div>
      <div class="table-wrap"><table class="po-table up-table"><thead><tr><th>Utente</th><th>Gruppi</th><th class="c-ruo">Ruoli</th><th class="c-last">Ultimo accesso</th><th class="c-st">Stato</th></tr></thead><tbody>${rows.map((u) => `<tr data-uopen="${u.id}" tabindex="0" class="${sel === u.id ? 'is-selected' : ''}">
        <td><span class="uob">${ava(u)}<span><b>${u.name}</b><small>${u.email}</small></span></span></td>
        <td>${u.groups.length ? u.groups.map((g) => `<span class="gtag">${GROUPS.find((x) => x.id === g).name}</span>`).join('') : u.portal ? `<span class="ptag">${ic('building')}Portal · ${u.portal}</span>` : '<span class="none">—</span>'}</td>
        <td class="c-ruo">${role(u)}${flagTags(u)}</td><td class="c-last">${u.lastIn}</td>
        <td class="c-st">${u.active ? '<span class="nst ok">Attivo</span>' : '<span class="nst np">Disattivato</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="po-foot"><span><b>${rows.length}</b> utenti</span></div></section>`; };
  const groupsA = () => `<div class="grp-grid">${GROUPS.map((g) => { const mem = USERS.filter((u) => u.groups.includes(g.id)); return `<button type="button" class="grp${gSel === g.id && drawer && !drawer.hidden ? ' on' : ''}" data-gopen="${g.id}"><header><b>${g.name}</b><span class="mem">${mem.slice(0, 4).map((u) => ava(u, 'xs')).join('')}${mem.length > 4 ? `<span class="more">+${mem.length - 4}</span>` : ''}</span></header><p>${g.desc}</p>
    <div class="heat" aria-label="Permessi per modulo">${MODS.map(([k, l]) => `<i class="lv-${g.perms[k]}" title="${l}: ${LV[g.perms[k]][0]}"></i>`).join('')}</div><span class="gfoot">${mem.length} ${mem.length === 1 ? 'utente' : 'utenti'} · ${MODS.filter(([k]) => g.perms[k] !== 'n').length} moduli</span></button>`; }).join('')}</div>
    <p class="heat-legend"><span><i class="lv-n"></i>Nessuno</span><span><i class="lv-r"></i>Lettura</span><span><i class="lv-w"></i>Scrittura</span><span><i class="lv-d"></i>Completo</span></p>`;
  const userDetail = (u, inline) => `${inline ? '' : ''}<div class="drawer-body int-body">
    ${!u.active ? '<section class="ct-sec"><div class="callout"><div><b>Utente disattivato</b><span>Non può accedere. I suoi dati e la sua storia restano.</span></div></div></section>' : ''}
    ${dTab === 'ana' ? `<section class="ct-sec"><div class="pf-grid"><div class="f"><label>Nome</label><input value="${esc(u.first)}"></div><div class="f"><label>Cognome</label><input value="${esc(u.last)}"></div><div class="f wide"><label>Email</label><input value="${u.email}"></div><div class="f"><label>Area ferie</label><div class="fake-sel"><span>${u.area || 'Nessuna'}</span>${ic('chevD')}</div></div><div class="f"><label>Data di nascita</label><input value="12/05/1988"></div></div></section>
      <section class="ct-sec"><div class="h"><h4>Ruoli</h4></div><div class="tgl">${[['Superuser', 'accesso completo, anche agli utenti', u.su], ['Tecnico ServiceNow', 'compare nei casi e nelle statistiche', u.flags.includes('sn')], ['Philips', 'tecnico in carico a Philips', u.flags.includes('philips')], ['Coordinatore ferie', 'approva le richieste della sua area', u.flags.includes('coord')], ['Segreteria spese', 'vede e approva tutti i rimborsi', u.flags.includes('exp')], ['Account funzionale', 'usato da integrazioni, non da una persona', u.flags.includes('func')]].map(([l, h, on]) => `<label><span><b>${l}</b><small>${h}</small></span><span class="sw2${on ? ' on' : ''}"><i></i></span></label>`).join('')}</div></section>`
    : dTab === 'perm' ? `<section class="ct-sec"><div class="h"><h4>Gruppi</h4><button class="lnk" type="button">Aggiungi</button></div><div class="gchips">${u.groups.map((g) => `<span class="gtag big">${GROUPS.find((x) => x.id === g).name}<button type="button" aria-label="Togli">${ic('x')}</button></span>`).join('') || '<span class="none">Nessun gruppo</span>'}</div></section>
      <section class="ct-sec"><div class="h"><h4>Permessi effettivi</h4>${u.direct ? '<button class="lnk" type="button">Riporta a quelli dei gruppi</button>' : ''}</div>${permTable(u, true)}</section>
      <section class="ct-sec"><div class="h"><h4>Portal</h4></div>${u.portal ? `<div class="wscard">${ic('building')}<span><b>${u.portal}</b><small>accesso in lettura e scrittura</small></span></div>` : '<span class="none">Nessun accesso al Portal.</span> <button class="lnk" type="button">Concedi</button>'}</section>`
    : `<section class="ct-sec"><ul class="feed2">${ACT.slice(0, 4).map(([i, t, o, w]) => `<li>${ic(i)}<span>${t} <a href="#">${o}</a></span><time>${w}</time></li>`).join('')}</ul></section>`}
    </div>`;
  const userFoot = (u) => `<div class="drawer-foot"><button class="btn" type="button">${ic('key')}Reimposta password</button><span class="g-spacer"></span>${u.active ? '<button class="btn btn-danger-o" type="button">Disattiva</button>' : '<button class="btn btn-primary" type="button">Riattiva</button>'}</div>`;
  const usersB = () => { const rows = USERS; const u = USERS.find((x) => x.id === selB);
    return `<div class="ub"><aside class="ub-list"><label class="ub-q">${ic('search')}<input placeholder="Cerca utente…"></label>${UVIEWS.slice(0, 4).map(([k, l, f]) => { const g = rows.filter(f); return g.length ? `<h3>${l}<span>${g.length}</span></h3>${g.map((x) => `<button type="button" class="ub-u${x.id === selB ? ' on' : ''}" data-ubsel="${x.id}">${ava(x)}<span><b>${x.name}</b><small>${x.groups.map((gg) => GROUPS.find((y) => y.id === gg).name).join(', ') || (x.portal ? `Portal · ${x.portal}` : 'nessun gruppo')}</small></span>${x.su ? '<span class="rl su xs">SU</span>' : ''}</button>`).join('')}` : ''; }).join('')}</aside>
      <section class="ub-main"><header class="ub-h">${ava(u, 'lg')}<div><h2>${u.name}</h2><p>@${u.user} · ${u.email} · ultimo accesso ${u.lastIn}</p><div class="idc-tags">${role(u)}${flagTags(u)}</div></div><div class="ub-act"><button class="btn" type="button">${ic('key')}Reimposta password</button><button class="icon-btn" type="button" aria-label="Altro">${ic('more')}</button></div></header>
        <div class="vtabs">${[['perm', 'Permessi'], ['ana', 'Anagrafica e ruoli'], ['act', 'Attività']].map(([k, l]) => `<button type="button" aria-pressed="${dTab === k}" data-dtab="${k}">${l}</button>`).join('')}</div>${userDetail(u, true)}</section></div>`; };

  const renderDrawer = () => {
    if (uTab === 'groups') {
      const g = GROUPS.find((x) => x.id === gSel); const mem = USERS.filter((u) => u.groups.includes(g.id));
      $('[data-md="id"]').textContent = 'Gruppo'; $('[data-md="st"]').innerHTML = ''; $('[data-md="title"]').textContent = g.name; $('[data-md="sub"]').textContent = `${mem.length} utenti · ${g.desc}`;
      $('[data-mtabs]').innerHTML = '';
      $('[data-mbody]').innerHTML = `<div class="drawer-body int-body"><section class="ct-sec"><div class="h"><h4>Permessi del gruppo</h4></div><table class="pmx"><tbody>${MODS.map(([k, l]) => `<tr><td>${l}</td><td><span class="lvpick">${['n', 'r', 'w', 'd'].map((x) => `<button type="button" aria-pressed="${x === g.perms[k]}" class="lv-${x}">${LV[x][0]}</button>`).join('')}</span></td></tr>`).join('')}</tbody></table></section>
        <section class="ct-sec"><div class="h"><h4>Portal</h4></div><table class="pmx"><tbody>${PMODS.map(([, l]) => `<tr><td>${l}</td><td><span class="lvpick">${['n', 'r', 'w', 'd'].map((x) => `<button type="button" aria-pressed="${x === 'n'}" class="lv-${x}">${LV[x][0]}</button>`).join('')}</span></td></tr>`).join('')}</tbody></table></section>
        <section class="ct-sec"><div class="h"><h4>Utenti</h4><button class="lnk" type="button">Aggiungi</button></div><div class="sibs">${mem.map((u) => `<button type="button">${ava(u, 'xs')}<span><b>${u.name}</b><small>${u.email}</small></span></button>`).join('') || '<span class="none">Nessuno</span>'}</div></section></div>
        <div class="drawer-foot"><button class="btn btn-danger-o" type="button">Elimina gruppo</button><span class="g-spacer"></span><button class="btn btn-primary" type="button">Salva</button></div>`;
      return;
    }
    const u = USERS.find((x) => x.id === sel); if (!u) return;
    $('[data-md="id"]').textContent = `@${u.user}`; $('[data-md="st"]').innerHTML = u.active ? '' : '<span class="nst np">Disattivato</span>'; $('[data-md="title"]').textContent = u.name; $('[data-md="sub"]').textContent = `${u.email} · ultimo accesso ${u.lastIn}`;
    $('[data-mtabs]').innerHTML = [['perm', 'Permessi'], ['ana', 'Anagrafica e ruoli'], ['act', 'Attività']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${dTab === k}" data-dtab="${k}">${l}</button>`).join('');
    $('[data-mbody]').innerHTML = userDetail(u, false) + userFoot(u);
  };
  const openD = () => { drawer.hidden = false; shell.classList.add('has-drawer'); render(); renderDrawer(); };
  const closeD = () => { sel = null; drawer.hidden = true; shell.classList.remove('has-drawer'); render(); };
  $('[data-mclose-d]').addEventListener('click', closeD);
  $('[data-mtabs]').addEventListener('click', (e) => { const b = e.target.closest('[data-dtab]'); if (b) { dTab = b.dataset.dtab; renderDrawer(); } });

  // ── Render ──────────────────────────────────────────────────────
  const NAMES = { pro: { a: 'Schede', b: 'Pagina unica' }, usr: { a: 'Tabella', b: 'Elenco e scheda' } };
  const render = () => {
    setNav(page === 'usr' ? 'Utenti e gruppi' : null);
    root.innerHTML = page === 'pro' ? (variant.pro === 'b' ? proB() : proA()) : `${uHead()}${uTab === 'groups' ? groupsA() : variant.usr === 'b' ? usersB() : usersA()}`;
    document.querySelectorAll('[data-upp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.upp === page)));
    document.querySelectorAll('[data-upv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.upv === variant[page])));
    $('[data-upv-name]').textContent = NAMES[page][variant[page]];
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-uopen], a[href^="#pf-"]'); if (!b) return;
    if (b.dataset.ptab) { proTab = b.dataset.ptab; return render(); }
    if (b.dataset.utab) { uTab = b.dataset.utab; if (!drawer.hidden) closeD(); return render(); }
    if (b.dataset.uview) { uView = b.dataset.uview; return render(); }
    if (b.dataset.uopen) { sel = Number(b.dataset.uopen); return openD(); }
    if (b.dataset.gopen) { gSel = Number(b.dataset.gopen); return openD(); }
    if (b.dataset.ubsel) { selB = Number(b.dataset.ubsel); return render(); }
    if (b.dataset.dtab) { dTab = b.dataset.dtab; return render(); }
    if (b.matches('a[href^="#pf-"]')) { root.querySelectorAll('.pfb-side nav a').forEach((a) => a.classList.toggle('on', a === b)); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeD(); });
  document.querySelectorAll('[data-upp]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.upp; if (!drawer.hidden) closeD(); try { localStorage.setItem('archie-preview-up-p', page); } catch { /* niente */ } render(); }));
  document.querySelectorAll('[data-upv]').forEach((b) => b.addEventListener('click', () => { variant[page] = b.dataset.upv; if (!drawer.hidden) closeD(); try { localStorage.setItem(`archie-preview-up-v${page}`, variant[page]); } catch { /* niente */ } render(); }));
  render();
})();
