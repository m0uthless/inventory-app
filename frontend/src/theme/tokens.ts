/**
 * Design tokens — spacing
 *
 * Il tema MUI usa una base di 8px (default, non sovrascritto).
 * I token `mui` corrispondono alle unità usate in `sx={{ p: ... }}`.
 * I token `px` sono valori CSS espliciti per i casi in cui si usa
 * `style={{ padding: ... }}` o stringhe dirette nel tema.
 *
 * Uso consigliato nei nuovi componenti:
 *   import { spacing } from '../theme/tokens'
 *
 *   // In sx prop:
 *   sx={{ p: spacing.md.mui, gap: spacing.sm.mui }}
 *
 *   // In style/theme overrides:
 *   padding: spacing.md.px
 *
 * Riferimento visivo:
 *   xs  =  4px  — gap icona/testo, padding interno chip
 *   sm  =  8px  — padding card compact, margini chip
 *   md  = 16px  — padding card standard, gap elementi form
 *   lg  = 24px  — padding drawer header, spaziatura sezioni
 *   xl  = 32px  — padding pagina desktop, gap sezioni maggiori
 */

type SpacingToken = {
  /** Valore in unità MUI (base 8px) — usare in `sx={{ p: ... }}` */
  mui: number
  /** Valore CSS stringa — usare in style/theme overrides */
  px: string
  /** Valore numerico in pixel */
  value: number
}

function token(px: number): SpacingToken {
  return { mui: px / 8, px: `${px}px`, value: px }
}

export const spacing = {
  xs: token(4),
  sm: token(8),
  md: token(16),
  lg: token(24),
  xl: token(32),
} as const

export type SpacingKey = keyof typeof spacing

/**
 * SIDEBAR — token di colore per la sidebar scura di AppLayout.
 *
 * Centralizzati qui per evitare valori hardcoded sparsi nel componente
 * e per facilitare futuri aggiornamenti del brand color.
 *
 * Palette: sfondo deep teal scuro (#1e3a3a/#162f2c) con accenti teal-300 (#5eead4).
 */
export const SIDEBAR = {
  /** Sfondo del drawer (gradiente verticale) */
  bgGradient: 'linear-gradient(180deg, #1e3a3a 0%, #162f2c 100%)',

  /** Colore base del testo nelle voci di navigazione */
  textMuted:    'rgba(255,255,255,0.55)',
  textDefault:  'rgba(255,255,255,0.78)',
  textStrong:   'rgba(255,255,255,0.95)',
  textBright:   '#ffffff',

  /** Accento teal: usato per selected state, icone attive, bordi */
  accent:       '#5eead4',   // teal-300
  accentLight:  '#a7f3d0',   // teal-200
  accentBright: '#d9fffa',   // teal-100

  /** Sfondi per voci selezionate */
  selectedBg:         'rgba(94,234,212,0.09)',
  selectedBgHover:    'rgba(94,234,212,0.14)',
  selectedBgStrong:   'rgba(94,234,212,0.20)',
  selectedBgStronger: 'rgba(94,234,212,0.28)',

  /** Bordo sinistro per la voce attiva */
  activeBorder: '2px solid #5eead4',

  /** Sfondo hover sulle voci non selezionate */
  hoverBg: 'rgba(255,255,255,0.08)',

  /** Divisori */
  divider: 'rgba(255,255,255,0.08)',

  /** Chip / badge nella sidebar */
  chipBg:    'rgba(255,255,255,0.10)',
  chipBorder:'rgba(255,255,255,0.14)',
  chipBgOpen:'rgba(94,234,212,0.14)',
  chipBorderOpen:'rgba(94,234,212,0.24)',
} as const
