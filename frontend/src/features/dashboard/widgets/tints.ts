import type { Theme } from '@mui/material'
import type { DashTone } from '../../../theme/palettes'

/** Toni della Dashboard "Aurora": verde, salvia, acciaio (colori dell'app) e post-it. */
export const dashTone = (t: Theme, tone: DashTone) => t.palette.archie.dash[tone]

/** Velo del tono medio (pillole, hover, separatori). */
export const tintVeil = (t: Theme, tone: DashTone, amount = 18) =>
  `color-mix(in srgb, ${t.palette.archie.dash[tone].mid} ${amount}%, transparent)`

/** Classe degli elementi animati (coriandoli, palloncini): il pulsante pausa della Dashboard li ferma. */
export const ANIM_CLASS = 'dash-anim'

/** Colori del trattamento scuro (widget Issue): sulla fascia verde della testata delle schede, testo bianco. */
export const DARK_INK = { text: '#ffffff', sub: '#b7d3cb', mid: '#8fd0bf', link: '#cfeee5' }
