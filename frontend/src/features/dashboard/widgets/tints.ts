import type { Theme } from '@mui/material'
import type { TintKey } from '../../../theme/palettes'

/** Fondo del widget: metà tinta e metà carta (la richiesta "colore più leggero" di Fede). */
export const tintedBg = (t: Theme, tone: TintKey, amount = 55) =>
  `color-mix(in srgb, ${t.palette.archie.tints[tone].bg} ${amount}%, ${t.palette.background.paper})`

/** Velo del tono medio (pillole, hover, separatori). */
export const tintVeil = (t: Theme, tone: TintKey, amount = 18) =>
  `color-mix(in srgb, ${t.palette.archie.tints[tone].mid} ${amount}%, transparent)`

/** Tinta di ogni widget della Dashboard (stessa dell'anteprima approvata). */
export const WIDGET_TONE: Record<string, TintKey> = {
  weather: 'sky', 'quick-actions-pair': 'mint', issues: 'sky', 'area-tasks': 'lilac', maintenance: 'rose',
  announcements: 'sand', todo: 'mint', 'sticky-note': 'butter', birthdays: 'peach', contributor: 'lilac', team: 'peach',
}
