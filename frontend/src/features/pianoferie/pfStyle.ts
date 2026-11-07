import type { Theme } from '@mui/material'
import type { CovLevel } from './pfModel'

/** Colori della copertura: testo e sfondo. */
export function covColors(t: Theme, lv: CovLevel) {
  const p = lv === 'low' ? t.palette.error : lv === 'mid' ? t.palette.warning : t.palette.success
  return { fg: p.main, bg: p.light }
}

/** Fondo a righe per weekend e festività. */
export const offStripes = (t: Theme) => `repeating-linear-gradient(135deg, ${t.palette.archie.surface2} 0 4px, transparent 4px 7px)`

/** "Rossi M." */
export const shortName = (n: string) => { const [f, ...r] = n.trim().split(/\s+/); return r.length ? `${f} ${r.map((x) => x[0] + '.').join(' ')}` : f }
