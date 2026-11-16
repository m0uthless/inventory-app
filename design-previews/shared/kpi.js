/* Fascia indicatori sopra la tabella issue (anteprime g1–g3).
   Dati finti coerenti con Preview.ROWS: oggi = 03/11/2026. */
(() => {
  const wrap = document.querySelector('[data-kpis]');
  if (!wrap) return;
  const ic = (n) => Preview.icon(n);
  const fmt = (n, d = 0) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

  // Attive a fine giornata, 21/10 → 03/11.
  const days = ['21/10', '22/10', '23/10', '24/10', '25/10', '26/10', '27/10', '28/10', '29/10', '30/10', '31/10', '01/11', '02/11', '03/11'];
  const active = [6, 6, 7, 7, 8, 7, 7, 8, 8, 7, 7, 8, 9, 9];
  // Tempo mediano di risoluzione per settimana (giorni).
  const weeks = ['15/09', '22/09', '29/09', '06/10', '13/10', '20/10', '27/10', '03/11'];
  const ttr = [3.6, 3.4, 3.9, 3.2, 3.3, 3.0, 3.2, 2.8];

  const PRIO = [
    { k: 'Critica', n: 2, c: 'var(--seq-4)' },
    { k: 'Alta', n: 3, c: 'var(--seq-3)' },
    { k: 'Media', n: 3, c: 'var(--seq-2)' },
    { k: 'Bassa', n: 1, c: 'var(--seq-1)' },
  ];
  const tot = PRIO.reduce((s, p) => s + p.n, 0);

  const flagX = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5 11 10.5H1z" fill="currentColor"/></svg>';
  const flagC = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 3.5V6l1.6 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const arrowDown = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  const arrowUp = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';

  const spark = (id, vals, labels, unit) => {
    const W = 84, H = 30, min = Math.min(...vals) - .5, max = Math.max(...vals) + .5;
    const x = (i) => (i / (vals.length - 1)) * W;
    const y = (v) => H - ((v - min) / (max - min)) * H;
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const step = W / (vals.length - 1);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" data-spark="${id}" aria-hidden="true">
      <path class="area" d="M0,${H} L${pts.join(' L')} L${W},${H}Z"/>
      <path class="line" d="M${pts.join(' L')}"/>
      <line class="cross" x1="0" x2="0" y1="0" y2="${H}" visibility="hidden"/>
      <circle class="dot" r="3.5" visibility="hidden"/>
      <circle class="end" cx="${x(vals.length - 1)}" cy="${y(vals.at(-1))}" r="3"/>
      ${vals.map((v, i) => `<rect class="hit" x="${(x(i) - step / 2).toFixed(1)}" y="-6" width="${step.toFixed(1)}" height="${H + 12}" data-i="${i}" data-x="${x(i).toFixed(1)}" data-y="${y(v).toFixed(1)}" data-tip="${labels[i]} · <b>${unit(v)}</b>"/>`).join('')}
    </svg>`;
  };

  wrap.innerHTML = `
  <div class="kpis" role="group" aria-label="Indicatori issue">
    <button type="button" class="kpi" data-view="Attive" aria-pressed="true">
      <span class="kpi-h">Attive<span class="go">${ic('arrowR')}</span></span>
      <span class="kpi-v">9</span>
      <span class="kpi-s"><span class="up">${arrowUp}2</span>negli ultimi 7 giorni</span>
      ${spark('act', active, days, (v) => v + ' attive')}
    </button>
    <button type="button" class="kpi" data-view="Scadute" aria-pressed="false">
      <span class="kpi-h">Scadute<span class="go">${ic('arrowR')}</span></span>
      <span class="kpi-v">1 <span class="kpi-flag err">${flagX}SLA superato</span></span>
      <span class="kpi-s"><span class="kpi-flag warn">${flagC}1 oggi</span><b>2</b>&nbsp;entro 7 giorni</span>
    </button>
    <div class="kpi">
      <span class="kpi-h">Tempo di risoluzione</span>
      <span class="kpi-v">${fmt(2.8, 1)}<small>giorni</small></span>
      <span class="kpi-s"><span class="down good">${arrowDown}${fmt(0.4, 1)} g</span>sulla sett. prima</span>
      ${spark('ttr', ttr, weeks.map((w) => 'Sett. ' + w), (v) => fmt(v, 1) + ' g')}
    </div>
    <div class="kpi">
      <span class="kpi-h">Entro SLA · ottobre</span>
      <span class="kpi-v">92%<small>obiettivo 95%</small></span>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="92" aria-label="Issue risolte entro SLA" data-tip="23 di 25 risolte entro SLA · obiettivo <b>95%</b>"><span style="width:92%"></span><i style="left:calc(95% - 1px)"></i></div>
      <span class="kpi-s"><b>23</b>&nbsp;di 25 risolte in tempo</span>
    </div>
    <div class="kpi kpi-prio">
      <span class="kpi-h">Attive per priorità</span>
      <div class="bar" aria-hidden="true">${PRIO.map((p) => `<span data-p="${p.k}" style="flex:${p.n};background:${p.c}" data-tip="${p.k} · <b>${p.n}</b> di ${tot}"></span>`).join('')}</div>
      <div class="lg">${PRIO.map((p) => `<button type="button" data-p="${p.k}" title="Filtra per ${p.k.toLowerCase()}"><i style="background:${p.c}"></i>${p.k} <b>${p.n}</b></button>`).join('')}</div>
    </div>
  </div>`;

  // Tooltip condiviso.
  const tip = document.createElement('div');
  tip.className = 'kpi-tip'; tip.hidden = true; document.body.appendChild(tip);
  const showTip = (html, x, y) => { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false; };
  wrap.addEventListener('pointerover', (e) => {
    const h = e.target.closest('[data-tip]'); if (!h) return;
    const svg = h.closest('svg.spark');
    if (svg) {
      const dot = svg.querySelector('.dot'), cross = svg.querySelector('.cross');
      dot.setAttribute('cx', h.dataset.x); dot.setAttribute('cy', h.dataset.y); dot.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', h.dataset.x); cross.setAttribute('x2', h.dataset.x); cross.setAttribute('visibility', 'visible');
      const r = svg.getBoundingClientRect(); const sx = r.left + (Number(h.dataset.x) / 84) * r.width;
      showTip(h.dataset.tip, sx, r.top);
    } else {
      const r = h.getBoundingClientRect(); showTip(h.dataset.tip, r.left + r.width / 2, r.top);
    }
  });
  wrap.addEventListener('pointerout', (e) => {
    const h = e.target.closest('[data-tip]'); if (!h || h.contains(e.relatedTarget)) return;
    tip.hidden = true;
    h.closest('svg.spark')?.querySelectorAll('.dot,.cross').forEach((n) => n.setAttribute('visibility', 'hidden'));
  });

  // Le card Attive / Scadute selezionano la vista corrispondente.
  const tabs = [...document.querySelectorAll('.vtabs button:not(.v-add)')];
  const syncCards = () => {
    const cur = tabs.find((b) => b.getAttribute('aria-pressed') === 'true');
    const name = cur ? cur.firstChild.textContent.trim() : '';
    wrap.querySelectorAll('[data-view]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.view === name)));
  };
  wrap.addEventListener('click', (e) => {
    const card = e.target.closest('[data-view]');
    if (card) { tabs.find((b) => b.firstChild.textContent.trim() === card.dataset.view)?.click(); syncCards(); return; }
    const p = e.target.closest('.lg button[data-p]');
    if (p && window.IssueFilters) {
      const cur = window.IssueFilters.get('c-pr');
      const only = cur && cur.size === 1 && cur.has(p.dataset.p);
      window.IssueFilters.set('c-pr', only ? [] : [p.dataset.p]);
    }
  });
  document.querySelector('.vtabs')?.addEventListener('click', () => setTimeout(syncCards));

  // La barra priorità riflette il filtro Priorità attivo sulla tabella.
  const paintPrio = () => {
    const f = window.IssueFilters?.get('c-pr');
    wrap.querySelectorAll('.kpi-prio [data-p]').forEach((n) => n.classList.toggle('is-dim', !!(f && f.size && !f.has(n.dataset.p))));
  };
  document.addEventListener('issuefilters', paintPrio);
  paintPrio();

  // Mostra / nascondi la fascia (ricordato per anteprima).
  const q = new URLSearchParams(location.search);
  const meta = document.querySelector('.meta');
  const set = (on) => {
    wrap.hidden = !on; if (meta) meta.hidden = on;
    document.querySelectorAll('[data-kpi-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    try { localStorage.setItem('archie-preview-kpi', on ? '1' : '0'); } catch (e) { /* niente */ }
  };
  let saved = null; try { saved = localStorage.getItem('archie-preview-kpi'); } catch (e) { /* niente */ }
  set(q.has('kpi') ? q.get('kpi') !== '0' : saved !== '0');
  document.querySelectorAll('[data-kpi-toggle]').forEach((b) => b.addEventListener('click', () => set(wrap.hidden)));
})();
