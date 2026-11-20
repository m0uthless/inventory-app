/* Generatore SQL (anteprima sql-base). Variante A: elenco a sinistra e risposta a destra.
   Variante B: conversazione con il campo della domanda in fondo. Vista «Revisione» per il superuser. */
(() => {
  const root = document.querySelector('[data-sql]');
  const ic = (n) => Preview.icon(n);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Evidenziazione minima: commenti, stringhe, parole chiave.
  const KW = /\b(SELECT|FROM|WHERE|AND|OR|JOIN|ON|GROUP BY|ORDER BY|COUNT|DISTINCT|SUM|AS|IN|EXISTS|DELETE|UPDATE|SET|INSERT|INTO|VALUES|FETCH FIRST|ROWS ONLY|TRUNC|SYSDATE|LIKE|UPPER|NOT|NULL|IS|BETWEEN|DATE|DESC|ASC|ROUND)\b/g;
  const hl = (sql) => esc(sql).split('\n').map((line) => {
    const c = line.indexOf('--');
    const code = c >= 0 ? line.slice(0, c) : line;
    const com = c >= 0 ? `<span class="sq-cm">${line.slice(c)}</span>` : '';
    return code.replace(/('[^']*')/g, '<span class="sq-str">$1</span>').replace(KW, '<span class="sq-kw">$1</span>') + com;
  }).join('\n');

  const SQL_CT = `-- READ | Studi CT archiviati ieri nel PACS locale
SELECT COUNT(DISTINCT s.study_db_uid) AS studi_ct
FROM medistore.didb_studies s
JOIN medistore.didb_series se ON se.study_db_uid = s.study_db_uid
JOIN medistore.didb_images i ON i.series_db_uid = se.series_db_uid
JOIN medistore.didb_image_locations l ON l.image_db_uid = i.image_db_uid
WHERE s.study_modality LIKE '%\\CT\\%'
  AND s.insert_time >= TRUNC(SYSDATE) - 1
  AND s.insert_time < TRUNC(SYSDATE)
  AND l.source_db_uid = 1;`;
  const SQL_DEL = `-- WRITE | Elimina le location duplicate dello studio (solo PACS locale)
-- 1) Anteprima: righe che verranno cancellate
SELECT l.image_db_uid, l.source_db_uid
FROM medistore.didb_image_locations l
WHERE l.image_db_uid IN (SELECT i.image_db_uid FROM medistore.didb_images i
  JOIN medistore.didb_studies s ON s.study_db_uid = i.study_db_uid
  WHERE s.accession_number = '2026A00123');
-- 2) Cancellazione
DELETE FROM medistore.didb_image_locations l
WHERE l.image_db_uid IN (SELECT i.image_db_uid FROM medistore.didb_images i
  JOIN medistore.didb_studies s ON s.study_db_uid = i.study_db_uid
  WHERE s.accession_number = '2026A00123');
-- COMMIT;`;
  const SQL_DEL_OK = `-- WRITE | Elimina le location duplicate dello studio (solo PACS locale)
-- 1) Anteprima
SELECT l.image_db_uid, l.source_db_uid
FROM medistore.didb_image_locations l
WHERE l.source_db_uid = 1
  AND l.image_db_uid IN (SELECT i.image_db_uid FROM medistore.didb_images i
    WHERE i.study_db_uid = :study_db_uid);
-- 2) Cancellazione
DELETE FROM medistore.didb_image_locations l
WHERE l.source_db_uid = 1
  AND l.image_db_uid IN (SELECT i.image_db_uid FROM medistore.didb_images i
    WHERE i.study_db_uid = :study_db_uid);
-- COMMIT;`;
  const SQL_SPACE = `-- READ | Spazio occupato per modalità nel 2026 (PACS locale, in GB)
SELECT s.study_modality AS modalita,
       ROUND(SUM(i.image_size) / 1024 / 1024 / 1024, 1) AS gb
FROM medistore.didb_studies s
JOIN medistore.didb_images i ON i.study_db_uid = s.study_db_uid
JOIN medistore.didb_image_locations l ON l.image_db_uid = i.image_db_uid
WHERE l.source_db_uid = 1
  AND s.study_date >= DATE '2026-01-01' AND s.study_date < DATE '2027-01-01'
GROUP BY s.study_modality
ORDER BY gb DESC;`;
  const SQL_IMP = `-- IMPOSSIBILE: i referti Carestream non sono nello schema del PACS Vue`;

  let items = [
    { id: 41, q: 'Quanto spazio occupano gli studi per modalità nel 2026?', st: 'queued', when: 'adesso' },
    { id: 40, q: "Chi ha aperto gli studi del paziente Rossi Mario la settimana scorsa?", st: 'running', when: '1 min fa' },
    { id: 39, q: 'Quanti studi CT sono stati archiviati ieri?', st: 'done', when: 'oggi 10:42', sec: 52, kind: 'read', sql: SQL_CT, warn: [], fb: 'ok' },
    { id: 38, q: "Cancella le immagini duplicate dello studio con accession 2026A00123", st: 'done', when: 'oggi 09:15', sec: 71, kind: 'write', sql: SQL_DEL, warn: ["Pacchetto di scrittura: lancia prima l'anteprima e dai il COMMIT a mano.", "ACCESSION_NUMBER non è garantito univoco: verifica che l'anteprima colpisca un solo studio."], fb: 'ko', fix: SQL_DEL_OK, note: "Mancava il filtro source_db_uid = 1: avrebbe cancellato anche le copie del backup. Meglio filtrare per study_db_uid." },
    { id: 37, q: 'Quanti referti ha firmato il dottor Bianchi su Carestream?', st: 'done', when: 'ieri 16:30', sec: 38, kind: 'impossible', sql: SQL_IMP, warn: [], fb: null },
    { id: 36, q: 'Elenco degli AE title che hanno inviato studi oggi', st: 'error', when: 'ieri 11:02', err: 'Il generatore non ha risposto entro 15 minuti. Riprova: la domanda torna in coda.' },
  ];
  const others = [
    { id: 35, who: 'Marco Bassi', when: '18/11 14:20', q: 'Studi MR senza referto del mese scorso', kind: 'read', fb: 'ko', sql: `-- READ | Studi MR del mese scorso senza referto\nSELECT s.accession_number, s.study_date\nFROM medistore.didb_studies s\nWHERE s.study_modality = 'MR'\n  AND s.study_date >= TRUNC(SYSDATE, 'MM') - 30;`, fix: `-- READ | Studi MR del mese scorso senza referto\nSELECT s.accession_number, s.study_date\nFROM medistore.didb_studies s\nWHERE s.study_modality LIKE '%\\MR\\%'\n  AND s.study_date >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)\n  AND s.study_date < TRUNC(SYSDATE, 'MM')\n  AND NOT EXISTS (SELECT 1 FROM medilink.mdb_reports r WHERE r.study_instance_uid = s.study_instance_uid);`, note: "Modalità con = invece di LIKE, e «mese scorso» calcolato male. Non controllava i referti." },
    { id: 33, who: 'Nicole Spazzoli', when: '17/11 09:05', q: 'Quanti studi sono arrivati dal PACS di Lugo questa settimana?', kind: 'read', fb: 'ok', sql: `-- READ | Studi arrivati questa settimana dalla sorgente indicata\nSELECT COUNT(DISTINCT s.study_db_uid) AS studi\nFROM medistore.didb_studies s\nJOIN medistore.didb_images i ON i.study_db_uid = s.study_db_uid\nJOIN medistore.didb_image_locations l ON l.image_db_uid = i.image_db_uid\nWHERE l.source_db_uid = :source_db_uid\n  AND s.insert_time >= TRUNC(SYSDATE, 'IW');` },
  ];

  const st = {
    view: 'mine', variant: 'a', su: true, sel: 39, revFilter: 'ko', reviewed: new Set(),
    draft: '', fbOpen: false,
  };

  const STL = { queued: 'In coda', running: 'In elaborazione…', done: 'Pronta', error: 'Non riuscita' };
  const KIND = { read: 'Lettura', write: 'Scrittura', impossible: 'Impossibile' };
  const status = (x) => `<span class="sq-st ${x.st}">${x.st === 'running' ? '<span class="pulse"></span>' : ''}${STL[x.st]}</span>`;
  const kind = (k) => `<span class="sq-kind ${k}">${KIND[k]}</span>`;
  const code = (sql, cls = '', label = 'Query generata') => `<div class="sq-code ${cls}"><div class="bar">${label}<span class="sp"></span><button class="btn btn-ghost" type="button" data-copy="${esc(sql)}">${ic('copy')}Copia</button></div><pre>${hl(sql)}</pre></div>`;
  const warns = (w) => (w && w.length ? `<ul class="sq-warn">${w.map((t) => `<li>${ic('alert')}<span>${esc(t)}</span></li>`).join('')}</ul>` : '');

  const feedback = (x) => {
    const open = x.fb === 'ko';
    return `<div class="sq-fb" data-fb="${x.id}">
      <div class="row"><span class="q">La query era giusta?</span>
        <button class="opt ok" type="button" data-fbset="ok" aria-pressed="${x.fb === 'ok'}">${ic('check')}Corretta</button>
        <button class="opt ko" type="button" data-fbset="ko" aria-pressed="${x.fb === 'ko'}">${ic('x')}Da correggere</button>
        ${x.fb ? '<span class="done">Grazie: il giudizio aiuta a migliorare gli esempi.</span>' : ''}</div>
      ${open ? `<label><span>Query corretta <em>· quella che hai usato davvero, facoltativa</em></span><textarea class="mono" data-fbfix>${esc(x.fix || '')}</textarea></label>
        <label><span>Cosa non andava <em>· facoltativo</em></span><textarea rows="2" data-fbnote>${esc(x.note || '')}</textarea></label>
        <div class="row"><span class="sp" style="flex:1"></span><button class="btn btn-primary" type="button" data-fbsave>Salva il giudizio</button></div>` : ''}
    </div>`;
  };

  const answerBody = (x) => {
    if (x.st === 'queued') return `<div class="sq-wait"><b>In coda</b><span>Davanti c'è un'altra domanda: la tua parte appena il generatore è libero. Ti arriva una notifica quando è pronta.</span></div>`;
    if (x.st === 'running') return `<div class="sq-wait"><b>Sto scrivendo la query…</b><div class="bar"><i></i></div><span>Di solito ci vuole circa un minuto. Puoi lasciare la pagina: ti arriva una notifica quando è pronta.</span></div>`;
    if (x.st === 'error') return `<div class="sq-err">${esc(x.err)}</div><div><button class="btn" type="button" data-retry="${x.id}">${ic('restore')}Riprova</button></div>`;
    return `${code(x.sql, x.kind === 'write' ? 'write' : '')}${warns(x.warn)}${x.kind === 'impossible' ? '' : feedback(x)}`;
  };

  const ask = (compact) => `<form class="sq-card sq-ask" data-ask>
    <textarea data-q maxlength="2000" placeholder="Chiedi in italiano, es. «quanti studi CT sono stati archiviati ieri?»" aria-label="Domanda">${esc(st.draft)}</textarea>
    <div class="row"><span class="hint">${compact ? '' : 'La query non viene eseguita: la copi e la lanci tu sul PACS. '}<kbd>Ctrl</kbd> + <kbd>Invio</kbd> per inviare</span><span class="sp"></span>
      <span class="count" data-count>${st.draft.length}/2000</span>
      <button class="btn btn-primary" type="submit">${ic('arrowR')}Genera</button></div>
  </form>`;

  const listA = () => `<div class="sq-card sq-list" role="list" aria-label="Le tue domande">
    <div class="lh"><span>Le tue domande</span><span>${items.length}</span></div>
    ${items.map((x) => `<button class="sq-item" type="button" role="listitem" data-sel="${x.id}" aria-current="${x.id === st.sel}">
      <span class="t">${esc(x.q)}</span>
      <span class="m">${status(x)}${x.kind ? kind(x.kind) : ''}<span class="sp"></span>${x.fb ? `<span class="fbm ${x.fb}" title="${x.fb === 'ok' ? 'Giudicata corretta' : 'Da correggere'}">${ic(x.fb === 'ok' ? 'check' : 'x')}</span>` : ''}${esc(x.when)}</span>
    </button>`).join('')}
  </div>`;

  const variantA = () => {
    const x = items.find((i) => i.id === st.sel) || items[0];
    return `${ask(false)}<div class="sq-a">${listA()}
      <section class="sq-card sq-ans" aria-label="Risposta">
        <h2>${esc(x.q)}</h2>
        <div class="sub">${status(x)}${x.kind ? kind(x.kind) : ''}<span>${esc(x.when)}</span>${x.sec ? `<span>· ${x.sec} s</span>` : ''}
          <span style="flex:1"></span><button class="icon-btn" type="button" aria-label="Togli dallo storico" title="Togli dallo storico">${ic('trash')}</button></div>
        ${answerBody(x)}
      </section></div>`;
  };

  const variantB = () => {
    const turns = [...items].reverse();
    return `<div class="sq-b"><div class="sq-thread">
      <span class="sq-day">Ieri</span>
      ${turns.map((x, i) => `${i === 2 ? '<span class="sq-day">Oggi</span>' : ''}<div class="sq-turn">
        <div class="qq">${esc(x.q)}</div><div class="qm">${esc(x.when)}</div>
        <div class="sq-card aa"><div class="sub">${status(x)}${x.kind ? kind(x.kind) : ''}${x.sec ? `<span>${x.sec} s</span>` : ''}</div>${answerBody(x)}</div>
      </div>`).join('')}
    </div>${ask(true)}</div>`;
  };

  const review = () => {
    const all = [...items.filter((x) => x.fb).map((x) => ({ ...x, who: 'Federico Mutuale' })), ...others];
    const pend = all.filter((x) => !st.reviewed.has(x.id));
    const shown = all.filter((x) => (st.revFilter === 'all' ? true : x.fb === st.revFilter));
    const count = (f) => all.filter((x) => x.fb === f && !st.reviewed.has(x.id)).length;
    return `<div class="sq-rev">
      <div class="bar"><div class="sq-seg" role="group" aria-label="Filtra per giudizio">
        <button type="button" data-rev="ko" aria-pressed="${st.revFilter === 'ko'}">Da correggere <span class="n">${count('ko')}</span></button>
        <button type="button" data-rev="ok" aria-pressed="${st.revFilter === 'ok'}">Corrette ${count('ok')}</button>
        <button type="button" data-rev="all" aria-pressed="${st.revFilter === 'all'}">Tutte</button></div>
        <span class="note">${pend.length} da rivedere. «Copia come esempio» prepara il blocco per <code>esempi_query.md</code>.</span></div>
      ${shown.length ? shown.map((x) => {
        const reviewed = st.reviewed.has(x.id);
        const best = x.fix || x.sql;
        return `<article class="sq-card sq-rv${reviewed ? ' is-reviewed' : ''}">
          <div class="top"><h3>${esc(x.q)}</h3>${kind(x.kind)}<span class="sq-st ${x.fb === 'ok' ? 'done' : 'error'}">${x.fb === 'ok' ? 'Corretta' : 'Da correggere'}</span></div>
          <div class="who">${esc(x.who)} · ${esc(x.when)}${reviewed ? ' · rivista' : ''}</div>
          ${x.fix ? `<div class="cols">${code(x.sql, '', 'Generata')}${code(x.fix, 'corrected', 'Corretta dal tecnico')}</div>` : code(x.sql)}
          ${x.note ? `<div class="note"><b>Nota:</b> ${esc(x.note)}</div>` : ''}
          <div class="acts"><button class="btn" type="button" data-example="${esc(`## ${x.q}\n\`\`\`sql\n${best}\n\`\`\``)}">${ic('copy')}Copia come esempio</button>
            <button class="btn ${reviewed ? '' : 'btn-primary'}" type="button" data-reviewed="${x.id}">${ic(reviewed ? 'restore' : 'check')}${reviewed ? 'Rimetti da rivedere' : 'Segna come rivista'}</button></div>
        </article>`;
      }).join('') : '<div class="sq-card sq-empty">Nessuna risposta da rivedere con questo giudizio.</div>'}
    </div>`;
  };

  const toastEl = document.querySelector('[data-toast]'); let tt;
  const say = (m) => { toastEl.innerHTML = `${ic('check')}<span>${m}</span>`; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3500); };

  const setNav = (label) => document.querySelectorAll('.nav-item').forEach((a) => { const on = (a.dataset.tip || a.textContent.trim()).startsWith(label); a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const render = () => {
    setNav('Generatore SQL');
    const pendRev = [...items.filter((x) => x.fb), ...others].filter((x) => !st.reviewed.has(x.id)).length;
    const waiting = items.filter((x) => x.st === 'queued' || x.st === 'running').length;
    root.innerHTML = `<div class="sq">
      <div class="sq-head"><h1>Generatore SQL</h1>
        ${st.su ? `<div class="sq-seg" role="group" aria-label="Vista"><button type="button" data-view="mine" aria-pressed="${st.view === 'mine'}">Le mie domande</button><button type="button" data-view="review" aria-pressed="${st.view === 'review'}">Revisione <span class="n">${pendRev}</span></button></div>` : ''}
        <span class="meta">Query Oracle per il PACS Philips Vue${st.view === 'mine' && waiting ? ` · <b>${waiting}</b> in attesa` : ''}</span></div>
      ${st.view === 'review' && st.su ? review() : st.variant === 'b' ? variantB() : variantA()}
    </div>`;
    if (st.variant === 'b' && st.view === 'mine') window.scrollTo({ top: document.body.scrollHeight });
  };

  // Simulazione: la domanda passa da «in coda» a «in elaborazione» a «pronta».
  const advance = () => {
    const run = items.find((x) => x.st === 'running');
    if (run) {
      const rossi = /rossi/i.test(run.q); const space = /spazio/i.test(run.q);
      Object.assign(run, rossi
        ? { kind: 'read', sec: 63, warn: ["AUDIT_LOG è enorme: la finestra su EVENT_DATE è limitata a 7 giorni."], sql: `-- READ | Accessi agli studi del paziente nella settimana scorsa\nSELECT a.event_date, a.user_name, a.action\nFROM auditing.audit_log a\nWHERE UPPER(a.patient_name) LIKE UPPER('%ROSSI%MARIO%')\n  AND a.event_date >= TRUNC(SYSDATE, 'IW') - 7\n  AND a.event_date < TRUNC(SYSDATE, 'IW')\nORDER BY a.event_date;` }
        : space ? { kind: 'read', sec: 58, warn: [], sql: SQL_SPACE }
          : { kind: 'impossible', sec: 41, warn: [], sql: '-- IMPOSSIBILE: la domanda non indica cosa cercare nello schema del PACS' });
      Object.assign(run, { st: 'done', when: 'adesso', fb: null });
      say(`Query pronta: «${run.q.length > 48 ? `${run.q.slice(0, 48)}…` : run.q}»`);
    }
    const q = items.find((x) => x.st === 'queued');
    if (q) q.st = 'running';
    render();
  };

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.sel) { st.sel = Number(t.dataset.sel); render(); }
    else if (t.dataset.view) { st.view = t.dataset.view; render(); }
    else if (t.dataset.rev) { st.revFilter = t.dataset.rev; render(); }
    else if (t.dataset.copy !== undefined) { navigator.clipboard?.writeText(t.dataset.copy); say('Query copiata'); }
    else if (t.dataset.example !== undefined) { navigator.clipboard?.writeText(t.dataset.example); say('Esempio copiato: incollalo in esempi_query.md'); }
    else if (t.dataset.reviewed) { const id = Number(t.dataset.reviewed); st.reviewed.has(id) ? st.reviewed.delete(id) : st.reviewed.add(id); render(); }
    else if (t.dataset.fbset) { const x = items.find((i) => i.id === Number(t.closest('[data-fb]').dataset.fb)); x.fb = t.dataset.fbset; render(); if (x.fb === 'ok') say('Giudizio salvato'); }
    else if (t.dataset.fbsave !== undefined) { const box = t.closest('[data-fb]'); const x = items.find((i) => i.id === Number(box.dataset.fb)); x.fix = box.querySelector('[data-fbfix]').value; x.note = box.querySelector('[data-fbnote]').value; say('Giudizio salvato'); }
    else if (t.dataset.retry) { const x = items.find((i) => i.id === Number(t.dataset.retry)); x.st = 'queued'; delete x.err; render(); }
  });
  root.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { st.draft = e.target.value; const c = root.querySelector('[data-count]'); if (c) c.textContent = `${st.draft.length}/2000`; } });
  root.addEventListener('keydown', (e) => { if (e.target.matches('[data-q]') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); root.querySelector('[data-ask]').requestSubmit(); } });
  root.addEventListener('submit', (e) => {
    e.preventDefault(); const q = st.draft.trim(); if (!q) return;
    const id = Math.max(...items.map((x) => x.id)) + 1;
    items.unshift({ id, q, st: 'queued', when: 'adesso' }); st.sel = id; st.draft = ''; render();
    say('Domanda in coda: ti arriva una notifica quando la query è pronta');
  });

  document.querySelectorAll('[data-sqlv]').forEach((b) => b.addEventListener('click', () => {
    st.variant = b.dataset.sqlv; st.view = 'mine';
    document.querySelectorAll('[data-sqlv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  const su = document.querySelector('[data-sqlsu]');
  su?.addEventListener('click', () => { st.su = !st.su; if (!st.su) st.view = 'mine'; su.setAttribute('aria-pressed', String(st.su)); render(); });

  const p = new URLSearchParams(location.search);
  if (p.get('v') === 'b') { st.variant = 'b'; document.querySelectorAll('[data-sqlv]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.sqlv === 'b'))); }
  if (p.get('vista') === 'revisione') st.view = 'review';
  render();
  setInterval(advance, 9000);
})();
