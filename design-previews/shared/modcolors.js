/* Colore per modulo (anteprima): assegna --mc alle voci della sidebar e gestisce i due interruttori. */
(() => {
  const TONE = {
    Dashboard: 'mint', Issue: 'sky', 'Task di area': 'lilac', Manutenzione: 'rose', Monitor: 'mint',
    Clienti: 'sand', Siti: 'peach', Contatti: 'lilac', Inventari: 'sky', Device: 'mint',
    Wiki: 'sand', Drive: 'sky', Contratti: 'lilac', 'Purchase Order': 'sand', 'Rimborso spese': 'mint',
    'Piano ferie': 'peach', ServiceNow: 'sky', Audit: 'muted', Cestino: 'muted', 'Bug e feature': 'rose',
  };
  const paint = () => document.querySelectorAll('.nav-item').forEach((a) => {
    const label = a.dataset.tip || a.textContent.trim();
    const k = Object.keys(TONE).find((t) => label.startsWith(t));
    if (k) a.style.setProperty('--mc', `var(--mc-${TONE[k]})`);
  });
  paint(); setTimeout(paint, 50);
  const html = document.documentElement;
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* niente */ } };
  html.setAttribute('data-mc', new URLSearchParams(location.search).get('colori') || ls('archie-preview-mc', 'on'));
  html.setAttribute('data-mc-active', ls('archie-preview-mc-active', 'green'));
  const sync = () => {
    document.querySelectorAll('[data-mc-btn]').forEach((b) => b.setAttribute('aria-pressed', String(html.getAttribute('data-mc') === b.dataset.mcBtn)));
    document.querySelectorAll('[data-mca-btn]').forEach((b) => { b.setAttribute('aria-pressed', String(html.getAttribute('data-mc-active') === b.dataset.mcaBtn)); b.disabled = html.getAttribute('data-mc') !== 'on'; });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mc-btn], [data-mca-btn]'); if (!b) return;
    if (b.dataset.mcBtn) { html.setAttribute('data-mc', b.dataset.mcBtn); set('archie-preview-mc', b.dataset.mcBtn); }
    if (b.dataset.mcaBtn) { html.setAttribute('data-mc-active', b.dataset.mcaBtn); set('archie-preview-mc-active', b.dataset.mcaBtn); }
    sync();
  });
  sync();
  window.ModColors = { paint, TONE };
})();
