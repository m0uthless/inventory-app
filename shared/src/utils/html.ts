/**
 * Escaping HTML per contenuti interpolati in template stringa destinati a
 * document.write()/innerHTML (es. report stampabili aperti in popup).
 *
 * 0.9.1 (WP-04, archie-maintenancexss — audit 2026-08-19, SEC-008):
 * MaintenancePlans.tsx costruiva l'HTML del report di stampa concatenando
 * campi utente (nome inventario, sito, tecnico, note libere) direttamente
 * in un template literal, poi scritto con `w.document.write(html)` in una
 * finestra popup same-origin — un campo "note" contenente `<script>` o un
 * `<img onerror=...>` veniva eseguito con pieno accesso a cookie/sessione.
 *
 * Riusa lo stesso escaping già presente localmente in WikiPage.tsx
 * (rimasto lì invariato, non è il bug: lì il testo passa comunque da
 * questa stessa logica prima di finire in <pre>), centralizzato qui così
 * ogni nuovo template HTML costruito a mano nel progetto ha un helper
 * pronto invece di reinventarlo (o dimenticarlo).
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  // 0.9.1 (fix post-consegna): usa .replace() con regex globale invece di
  // .replaceAll() — shared/src è compilato da ENTRAMBI i frontend, e
  // frontend-portal/tsconfig.app.json ha target/lib "ES2020", che precede
  // ES2021 (quando String.prototype.replaceAll è stato introdotto).
  // frontend (target ES2022) non aveva il problema, da qui l'errore visto
  // solo ribuildando frontend-portal. .replace(regex-globale) è
  // equivalente e supportato ovunque.
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
