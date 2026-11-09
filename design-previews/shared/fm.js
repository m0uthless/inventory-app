/* Inserimento dati (anteprima): tre impostazioni per "Nuova issue", da cui ricavare la linea comune
   per tutti gli inserimenti di Archie. Campi reali della issue: titolo, cliente (o non in anagrafica),
   sito, inventario, priorità, assegnata a, categoria, data apertura, scadenza, caso ServiceNow, descrizione.
   A · Scheda: una scheda di dettaglio vuota (testata scura), come quando si apre una issue.
   B · Modulo: dialogo a sezioni con etichette sopra i campi e scelte visibili.
   C · Rapido: titolo e descrizione, il resto in pillole che aprono un selettore. */
(() => {
  const ic = (n) => Preview.icon(n);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const $ = (s, r = document) => r.querySelector(s);

  // ── Dati finti realistici ─────────────────────────────────────────
  const CUSTS = [
    { id: 1, n: 'AUSL Imola', sites: ['S. Maria della Scaletta', 'Ospedale di Castel S. Pietro'] },
    { id: 2, n: 'AUSL Bologna', sites: ['Ospedale Maggiore', 'Bellaria', 'Bazzano', 'Vergato'] },
    { id: 3, n: 'AUSL Romagna', sites: ['Ospedale di Ravenna', 'Ospedale di Forlì'] },
    { id: 4, n: 'Istituto Ortopedico Rizzoli', sites: ['Sede di Bologna'] },
    { id: 5, n: 'Casa di Cura Rocca', sites: ['Sede di Lugo'] },
  ];
  const RECENT = [2, 1, 4];
  const INV = { 'S. Maria della Scaletta': [['CT 2 · Somatom go.Top', 'K-30022'], ['PACS primario', 'K-30010']], 'Ospedale Maggiore': [['RIS Maggiore', 'K-10011'], ['Monitor refertazione 4', 'K-10204']], Bellaria: [['RM 1.5T', 'K-11003']] };
  const USERS = ['Federico Mutuale', 'Leonardo Romano', 'Nicole Spazzoli', 'Sara De Paola', 'Luca Della Zazzera'];
  const CATS = ['PACS', 'RIS', 'Modalità', 'Rete', 'Postazioni', 'Licenze'];
  const PR = [['critica', 'Critica'], ['alta', 'Alta'], ['media', 'Media'], ['bassa', 'Bassa']];
  const TODAY = new Date(2026, 10, 9);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plus = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return iso(d); };
  const dFmt = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
  const ini = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
  const prMark = (k) => `<span class="pr pr-${k}"><span class="pr-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${PR.find((p) => p[0] === k)[1]}</span>`;

  // ── Stato ─────────────────────────────────────────────────────────
  const fresh = () => ({ title: '', cust: null, free: '', site: '', inv: '', pr: 'media', who: null, cat: null, opened: iso(TODAY), due: '', sn: '', desc: '', more: false });
  let v = fresh(); let variant = new URLSearchParams(location.search).get('fm') || 'a'; let open = false; let tried = false; let another = false;
  const custOf = () => CUSTS.find((c) => c.id === v.cust);
  const custLabel = () => (custOf()?.n || (v.free ? `${v.free} (non in anagrafica)` : ''));
  const missing = () => ({ title: !v.title.trim(), cust: !v.cust && !v.free.trim() });

  const host = document.createElement('div'); host.className = 'fm-host'; document.body.appendChild(host);
  const pop = document.createElement('div'); pop.className = 'fpop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); document.body.appendChild(pop);
  const toast = document.createElement('div'); toast.className = 'fm-toast'; toast.hidden = true; toast.setAttribute('role', 'status'); document.body.appendChild(toast);

  // ── Selettore (popover con ricerca e tastiera) ────────────────────
  let popPick = null;
  const openPicker = (anchor, { title, items, search = true, onPick, foot = '' }) => {
    popPick = { items, onPick, active: 0, q: '' };
    const paint = () => {
      const q = popPick.q.toLowerCase(); const list = items.filter((i) => !q || (i.label + ' ' + (i.sub || '')).toLowerCase().includes(q));
      popPick.list = list; popPick.active = Math.min(popPick.active, Math.max(0, list.length - 1));
      $('.fp-list', pop).innerHTML = list.map((i, n) => `<button type="button" role="option" class="fp-i${n === popPick.active ? ' on' : ''}${i.sel ? ' sel' : ''}" data-fp="${n}">${i.html || `<span>${esc(i.label)}</span>`}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}${i.sel ? ic('check') : ''}</button>`).join('') || '<p class="fp-none">Nessun risultato</p>';
    };
    pop.innerHTML = `<div class="fp-h">${title}</div>${search ? `<input class="fp-q" placeholder="Cerca…" aria-label="Cerca">` : ''}<div class="fp-list" role="listbox"></div>${foot}`;
    paint(); pop.hidden = false;
    const r = anchor.getBoundingClientRect(); const w = 280;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
    const top = r.bottom + 6; pop.style.top = `${Math.min(top, innerHeight - 340)}px`;
    const q = $('.fp-q', pop); (q || $('.fp-i', pop))?.focus();
    q?.addEventListener('input', () => { popPick.q = q.value; popPick.active = 0; paint(); });
    pop.onkeydown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); popPick.active = (popPick.active + (e.key === 'ArrowDown' ? 1 : -1) + popPick.list.length) % Math.max(1, popPick.list.length); paint(); }
      if (e.key === 'Enter' && popPick.list[popPick.active]) { e.preventDefault(); const it = popPick.list[popPick.active]; closePop(); onPick(it.v); }
      if (e.key === 'Escape') { e.stopPropagation(); closePop(); anchor.focus(); }
    };
    pop.onclick = (e) => { const b = e.target.closest('[data-fp]'); if (b) { const it = popPick.list[Number(b.dataset.fp)]; closePop(); onPick(it.v); } };
  };
  const closePop = () => { pop.hidden = true; popPick = null; };
  document.addEventListener('mousedown', (e) => { if (!pop.hidden && !e.target.closest('.fpop')) closePop(); });

  const pickers = {
    cust: (a) => openPicker(a, { title: 'Cliente', items: [...RECENT.map((id) => CUSTS.find((c) => c.id === id)).map((c) => ({ v: c.id, label: c.n, sub: 'recente', sel: v.cust === c.id })), ...CUSTS.filter((c) => !RECENT.includes(c.id)).map((c) => ({ v: c.id, label: c.n, sub: `${c.sites.length} siti`, sel: v.cust === c.id }))],
      foot: '<button type="button" class="fp-foot" data-free>Non è in anagrafica? Scrivi il nome</button>', onPick: (id) => { v.cust = id; v.free = ''; v.site = custOf().sites.length === 1 ? custOf().sites[0] : ''; v.inv = ''; render(); } }),
    site: (a) => { if (!custOf()) return pickers.cust(a); openPicker(a, { title: `Sito · ${custOf().n}`, items: custOf().sites.map((s) => ({ v: s, label: s, sel: v.site === s })), search: custOf().sites.length > 5, onPick: (s) => { v.site = s; v.inv = ''; render(); } }); },
    inv: (a) => { const list = INV[v.site] || []; openPicker(a, { title: v.site ? `Inventario · ${v.site}` : 'Inventario', items: list.length ? list.map(([n, k]) => ({ v: n, label: n, sub: k, sel: v.inv === n })) : [{ v: '', label: v.site ? 'Nessun inventario in questo sito' : 'Scegli prima il sito' }], onPick: (n) => { v.inv = n; render(); } }); },
    who: (a) => openPicker(a, { title: 'Assegnata a', items: [{ v: null, label: 'Nessuno', sel: !v.who }, ...USERS.map((u) => ({ v: u, label: u, html: `<span class="ava">${ini(u)}</span><span>${u}</span>`, sel: v.who === u }))], onPick: (u) => { v.who = u; render(); } }),
    pr: (a) => openPicker(a, { title: 'Priorità', search: false, items: PR.map(([k]) => ({ v: k, label: k, html: prMark(k), sel: v.pr === k })), onPick: (k) => { v.pr = k; render(); } }),
    cat: (a) => openPicker(a, { title: 'Categoria', items: [{ v: null, label: 'Nessuna', sel: !v.cat }, ...CATS.map((c) => ({ v: c, label: c, sel: v.cat === c }))], onPick: (c) => { v.cat = c; render(); } }),
    due: (a) => openPicker(a, { title: 'Scadenza', search: false, items: [['', 'Nessuna'], [plus(1), 'Domani'], [plus(7), 'Tra una settimana'], [plus(30), 'Tra un mese']].map(([d, l]) => ({ v: d, label: l, sub: dFmt(d), sel: v.due === d })),
      foot: `<label class="fp-date">Altra data <input type="date" value="${v.due}" data-due-any></label>`, onPick: (d) => { v.due = d; render(); } }),
  };
  pop.addEventListener('click', (e) => { if (e.target.closest('[data-free]')) { closePop(); const n = prompt('Nome del cliente non in anagrafica'); if (n) { v.free = n; v.cust = null; v.site = ''; v.inv = ''; render(); } } });
  pop.addEventListener('change', (e) => { if (e.target.matches('[data-due-any]')) { v.due = e.target.value; closePop(); render(); } });

  // ── Pezzi comuni ──────────────────────────────────────────────────
  const req = (k) => (tried && missing()[k] ? ' is-err' : '');
  const errMsg = (k, t) => (tried && missing()[k] ? `<span class="f-err">${ic('alert')}${t}</span>` : '');
  const val = (txt, empty) => (txt ? `<span class="v">${txt}</span>` : `<span class="v none">${empty}</span>`);
  const whoHtml = () => (v.who ? `<span class="ava">${ini(v.who)}</span>${v.who}` : '');

  // ── A · Scheda ────────────────────────────────────────────────────
  const A = () => `<div class="fa" role="dialog" aria-modal="true" aria-labelledby="fa-t">
      <header class="fa-band">
        <div class="fa-top"><span class="fa-id">Nuova issue</span><span class="fa-draft">Bozza</span><span class="sp"></span><button type="button" class="ib-w" data-fm-close aria-label="Chiudi">${ic('x')}</button></div>
        <textarea id="fa-t" class="fa-title${req('title')}" rows="1" placeholder="Di cosa si tratta?" data-v="title" aria-label="Titolo">${esc(v.title)}</textarea>
        <button type="button" class="fa-cust${req('cust')}" data-pick="cust">${ic('building')}${custLabel() ? esc(custLabel()) : 'Scegli il cliente'}${v.site ? ` · ${esc(v.site)}` : ''}${ic('chevD')}</button>
      </header>
      <div class="fa-body">
        ${errMsg('title', 'Scrivi un titolo.')}${errMsg('cust', 'Scegli il cliente, o scrivi il nome se non è in anagrafica.')}
        <section class="fa-sec"><h3>Proprietà</h3><div class="fa-props">
          <button type="button" data-pick="pr"><span class="k">Priorità</span>${val(prMark(v.pr))}${ic('chevD')}</button>
          <button type="button" data-pick="who"><span class="k">Assegnata a</span>${val(whoHtml(), 'Nessuno')}${ic('chevD')}</button>
          <button type="button" data-pick="cat"><span class="k">Categoria</span>${val(v.cat, 'Nessuna')}${ic('chevD')}</button>
          <button type="button" data-pick="due"><span class="k">Scadenza</span>${val(dFmt(v.due), 'Nessuna')}${ic('calendar')}</button>
          <label class="fa-in"><span class="k">Apertura</span><input type="date" value="${v.opened}" data-v="opened"></label>
          <label class="fa-in"><span class="k">ServiceNow</span><input class="mono" placeholder="CS0000000" value="${esc(v.sn)}" data-v="sn"></label>
        </div></section>
        <section class="fa-sec"><h3>Dove intervenire</h3><div class="fa-where">
          <button type="button" data-pick="cust"><span class="wi">${ic('building')}</span><span><b>${custLabel() ? esc(custLabel()) : 'Cliente'}</b><small>${custLabel() ? 'Cliente' : 'obbligatorio'}</small></span>${ic('chevR')}</button>
          <button type="button" data-pick="site"><span class="wi">${ic('pin')}</span><span><b>${v.site ? esc(v.site) : 'Sito'}</b><small>${v.site ? 'Sito' : 'facoltativo'}</small></span>${ic('chevR')}</button>
          <button type="button" data-pick="inv"><span class="wi">${ic('server')}</span><span><b>${v.inv ? esc(v.inv) : 'Inventario'}</b><small>${v.inv ? 'Inventario collegato' : 'facoltativo'}</small></span>${ic('chevR')}</button>
        </div></section>
        <section class="fa-sec"><h3>Descrizione</h3><textarea class="fa-desc" rows="5" placeholder="Cosa succede, da quando, cosa è già stato provato…" data-v="desc">${esc(v.desc)}</textarea></section>
      </div>
      <footer class="fa-foot"><button type="button" class="btn btn-ghost" data-fm-close>Annulla</button><span class="sp"></span>
        <label class="fm-another"><input type="checkbox" data-another ${another ? 'checked' : ''}>Creane un'altra</label>
        <button type="button" class="btn btn-primary" data-fm-save>${ic('check')}Crea issue</button></footer>
    </div>`;

  // ── B · Modulo ────────────────────────────────────────────────────
  const B = () => `<div class="fb" role="dialog" aria-modal="true" aria-labelledby="fb-t">
      <header class="fb-h"><div><h2 id="fb-t">Nuova issue</h2><p>Il problema, dove si trova e chi se ne occupa.</p></div><button type="button" class="icon-btn" data-fm-close aria-label="Chiudi">${ic('x')}</button></header>
      <div class="fb-body">
        <section class="fb-sec"><h3>Il problema</h3>
          <label class="f${req('title')}"><span class="lbl">Titolo <em>*</em></span><input placeholder="Es. Worklist vuota sulla modalità CT 2" value="${esc(v.title)}" data-v="title">${errMsg('title', 'Scrivi un titolo.')}</label>
          <label class="f"><span class="lbl">Descrizione</span><textarea rows="4" placeholder="Cosa succede, da quando, cosa è già stato provato…" data-v="desc">${esc(v.desc)}</textarea></label>
        </section>
        <section class="fb-sec"><h3>Dove</h3>
          <div class="f${req('cust')}"><span class="lbl">Cliente <em>*</em></span>
            <button type="button" class="sel" data-pick="cust">${custLabel() ? esc(custLabel()) : '<span class="ph">Cerca il cliente…</span>'}${ic('chevD')}</button>
            ${!v.cust && !v.free ? `<div class="chips"><span class="chips-l">Recenti</span>${RECENT.map((id) => `<button type="button" class="chip" data-cust="${id}">${CUSTS.find((c) => c.id === id).n}</button>`).join('')}</div>` : ''}
            ${errMsg('cust', 'Scegli il cliente, o scrivi il nome se non è in anagrafica.')}</div>
          <div class="g2">
            <div class="f"><span class="lbl">Sito</span><button type="button" class="sel" data-pick="site"${custOf() ? '' : ' disabled'}>${v.site ? esc(v.site) : `<span class="ph">${custOf() ? 'Facoltativo' : 'Prima il cliente'}</span>`}${ic('chevD')}</button></div>
            <div class="f"><span class="lbl">Inventario</span><button type="button" class="sel" data-pick="inv"${v.site ? '' : ' disabled'}>${v.inv ? esc(v.inv) : `<span class="ph">${v.site ? 'Facoltativo' : 'Prima il sito'}</span>`}${ic('chevD')}</button></div>
          </div>
        </section>
        <section class="fb-sec"><h3>Gestione</h3>
          <div class="f"><span class="lbl">Priorità</span><div class="seg4" role="radiogroup" aria-label="Priorità">${PR.slice().reverse().map(([k]) => `<button type="button" role="radio" aria-checked="${v.pr === k}" data-pr="${k}">${prMark(k)}</button>`).join('')}</div></div>
          <div class="f"><span class="lbl">Assegnata a</span><div class="people">${[null, ...USERS].map((u) => `<button type="button" class="pchip${v.who === u ? ' on' : ''}" data-who="${u ?? ''}">${u ? `<span class="ava">${ini(u)}</span>${u.split(' ')[0]}` : 'Nessuno'}</button>`).join('')}</div></div>
          <div class="g2">
            <div class="f"><span class="lbl">Scadenza</span><div class="datef"><input type="date" value="${v.due}" data-v="due" aria-label="Scadenza"><span class="qd">${[[7, '+7 gg'], [30, '+30 gg']].map(([n, l]) => `<button type="button" class="chip sm${v.due === plus(n) ? ' on' : ''}" data-due="${plus(n)}">${l}</button>`).join('')}</span></div></div>
            <div class="f"><span class="lbl">Categoria</span><button type="button" class="sel" data-pick="cat">${v.cat ? esc(v.cat) : '<span class="ph">Nessuna</span>'}${ic('chevD')}</button></div>
          </div>
          <button type="button" class="more" data-more aria-expanded="${v.more}">${ic(v.more ? 'chevD' : 'chevR')}Altri campi <small>data di apertura, caso ServiceNow</small></button>
          ${v.more ? `<div class="g2"><label class="f"><span class="lbl">Aperta il</span><input type="date" value="${v.opened}" data-v="opened"></label><label class="f"><span class="lbl">Caso ServiceNow</span><input class="mono" placeholder="CS0000000" value="${esc(v.sn)}" data-v="sn"></label></div>` : ''}
        </section>
      </div>
      <footer class="fb-foot"><span class="hint"><em>*</em> obbligatori · <kbd>Ctrl</kbd> <kbd>Invio</kbd> crea</span><span class="sp"></span>
        <label class="fm-another"><input type="checkbox" data-another ${another ? 'checked' : ''}>Creane un'altra</label>
        <button type="button" class="btn btn-ghost" data-fm-close>Annulla</button><button type="button" class="btn btn-primary" data-fm-save>Crea issue</button></footer>
    </div>`;

  // ── C · Rapido ────────────────────────────────────────────────────
  const pill = (k, icon, txt, empty, cls = '') => `<button type="button" class="pill${txt ? ' set' : ''}${cls}" data-pick="${k}">${icon ? ic(icon) : ''}${txt || empty}</button>`;
  const C = () => `<div class="fc" role="dialog" aria-modal="true" aria-label="Nuova issue">
      <div class="fc-crumb"><span>${ic('alert')}Issue</span>${ic('chevR')}<b>Nuova</b><span class="sp"></span><button type="button" class="icon-btn" data-fm-close aria-label="Chiudi">${ic('x')}</button></div>
      <input class="fc-title${req('title')}" placeholder="Titolo della issue" value="${esc(v.title)}" data-v="title" aria-label="Titolo">
      <textarea class="fc-desc" rows="4" placeholder="Aggiungi una descrizione…" data-v="desc" aria-label="Descrizione">${esc(v.desc)}</textarea>
      <div class="fc-pills">
        ${pill('cust', 'building', custLabel() && esc(custLabel()), 'Cliente', req('cust'))}
        ${custOf() ? pill('site', 'pin', v.site && esc(v.site), 'Sito') : ''}
        ${v.site ? pill('inv', 'server', v.inv && esc(v.inv), 'Inventario') : ''}
        <button type="button" class="pill set" data-pick="pr">${prMark(v.pr)}</button>
        ${pill('who', '', v.who && whoHtml(), `${ic('user')}Assegna`)}
        ${pill('due', 'calendar', v.due && dFmt(v.due), 'Scadenza')}
        ${pill('cat', 'folder', v.cat, 'Categoria')}
        <label class="pill pill-in${v.sn ? ' set' : ''}">${ic('cloud')}<input class="mono" placeholder="ServiceNow" value="${esc(v.sn)}" data-v="sn" size="10" aria-label="Caso ServiceNow"></label>
      </div>
      ${tried && (missing().title || missing().cust) ? `<p class="fc-err">${ic('alert')}${missing().title && missing().cust ? 'Mancano il titolo e il cliente.' : missing().title ? 'Manca il titolo.' : 'Manca il cliente.'}</p>` : ''}
      <footer class="fc-foot"><label class="fm-another"><input type="checkbox" data-another ${another ? 'checked' : ''}>Creane un'altra</label><span class="sp"></span><span class="hint"><kbd>Ctrl</kbd> <kbd>Invio</kbd></span><button type="button" class="btn btn-primary" data-fm-save>Crea issue</button></footer>
    </div>`;

  // ── Render ────────────────────────────────────────────────────────
  const render = () => {
    if (!open) { host.innerHTML = ''; return; }
    const focusKey = document.activeElement?.dataset?.v; const caret = document.activeElement?.selectionStart;
    host.innerHTML = `<div class="fm-bg fm-${variant}" data-fm-bg>${variant === 'a' ? A() : variant === 'b' ? B() : C()}</div>`;
    if (focusKey) { const el = host.querySelector(`[data-v="${focusKey}"]`); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* date */ } } }
    autosize();
  };
  const autosize = () => host.querySelectorAll('.fa-title').forEach((t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; });
  const openForm = () => { open = true; tried = false; v = fresh(); render(); host.querySelector('[data-v="title"]')?.focus(); };
  const closeForm = () => { open = false; closePop(); render(); };
  const save = () => {
    tried = true; const m = missing();
    if (m.title || m.cust) { render(); host.querySelector('.is-err [data-v], .is-err[data-v], .is-err')?.focus?.(); return; }
    const n = 1049 + Math.floor(Math.random() * 5);
    toast.innerHTML = `${ic('check')}Issue <b>#${n}</b> creata · ${esc(v.title)}<button type="button" class="tl">Apri</button>`; toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { toast.hidden = true; }, 4200);
    if (another) { const keep = { cust: v.cust, free: v.free, site: v.site }; v = { ...fresh(), ...keep }; tried = false; render(); host.querySelector('[data-v="title"]')?.focus(); } else closeForm();
  };

  host.addEventListener('input', (e) => { const k = e.target.dataset.v; if (k) { v[k] = e.target.value; if (k === 'title') autosize(); if (tried && (k === 'title')) render(); } });
  host.addEventListener('change', (e) => { const k = e.target.dataset.v; if (k && e.target.type === 'date') { v[k] = e.target.value; render(); } if (e.target.matches('[data-another]')) another = e.target.checked; });
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-fm-close]')) return closeForm();
    if (b.matches('[data-fm-save]')) return save();
    if (b.dataset.pick) return pickers[b.dataset.pick](b);
    if (b.dataset.cust) { v.cust = Number(b.dataset.cust); v.free = ''; v.site = custOf().sites.length === 1 ? custOf().sites[0] : ''; return render(); }
    if (b.dataset.pr) { v.pr = b.dataset.pr; return render(); }
    if (b.dataset.who != null) { v.who = b.dataset.who || null; return render(); }
    if (b.dataset.due) { v.due = v.due === b.dataset.due ? '' : b.dataset.due; return render(); }
    if (b.matches('[data-more]')) { v.more = !v.more; return render(); }
  });
  host.addEventListener('mousedown', (e) => { if (e.target.matches('[data-fm-bg]')) closeForm(); });
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape' && pop.hidden) { e.stopImmediatePropagation(); closeForm(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  }, true);
  document.querySelectorAll('[data-fm-open]').forEach((b) => b.addEventListener('click', openForm));
  const vb = document.querySelectorAll('[data-fmv]');
  const setV = (x) => { variant = x; vb.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fmv === x))); if (open) { closePop(); render(); } };
  vb.forEach((b) => b.addEventListener('click', () => { setV(b.dataset.fmv); if (!open) openForm(); }));
  setV(['a', 'b', 'c'].includes(variant) ? variant : 'a');
  if (new URLSearchParams(location.search).get('apri')) openForm();
})();
