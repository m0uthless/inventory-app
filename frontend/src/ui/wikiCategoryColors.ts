/**
 * PRESET_COLORS — palette fissa per le swatch colore categoria Wiki
 * (scelte dall'utente in WikiCategoryManager, riusate come fallback in
 * WikiStats). Estratta in un modulo dedicato — invece di essere esportata
 * da WikiCategoryManager.tsx — per non introdurre un export non-componente
 * in un file di componente (react-refresh/only-export-components).
 *
 * Eccezione intenzionale rispetto al color refactor 0.9.x: sono colori
 * "scelti" dall'utente e persistiti, devono restare stabili a prescindere
 * dal tema attivo, non theme-aware.
 */
export const PRESET_COLORS = [
  '#0f766e', // teal
  '#0284c7', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#dc2626', // red
  '#ea580c', // orange
  '#ca8a04', // yellow
  '#16a34a', // green
  '#0891b2', // cyan
  '#64748b', // slate
]
