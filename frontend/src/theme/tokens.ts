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

import { SHARED } from './constants'
import { alpha } from '@mui/material/styles'

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
 * SidebarTokens — forma dei token di colore per la sidebar. Tipizzato a
 * `string` (non `as const` sui valori) apposta, per restare aperto a
 * eventuali temi futuri senza cristallizzare i valori letterali del teal.
 */
export type SidebarTokens = {
  bgGradient: string
  textMuted: string
  textDefault: string
  textStrong: string
  textBright: string
  accent: string
  accentLight: string
  accentBright: string
  /** Tripla "r,g,b" di `accent`, per comporre overlay rgba() ad-hoc (es. `rgba(${accentRgb},0.22)`)
   *  senza dover aggiungere un nuovo campo dedicato per ogni alpha usata in AppLayout. */
  accentRgb: string
  /** Colore icona per lo stato "selezionato forte" (nested Mui-selected) — leggermente
   *  più chiaro/acceso di accentLight, usato solo lì. */
  accentIconStrong: string
  selectedBg: string
  selectedBgHover: string
  selectedBgStrong: string
  selectedBgStronger: string
  activeBorder: string
  hoverBg: string
  divider: string
  chipBg: string
  chipBorder: string
  chipBgOpen: string
  chipBorderOpen: string
}

/**
 * SIDEBAR — token di colore per la sidebar scura di AppLayout.
 *
 * Centralizzati qui per evitare valori hardcoded sparsi nel componente
 * e per facilitare futuri aggiornamenti del brand color.
 *
 * Palette: sfondo deep teal scuro (#1e3a3a/#162f2c) con accenti teal-300 (#5eead4).
 */
export const SIDEBAR: SidebarTokens = {
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
  accentRgb:    '94,234,212',
  accentIconStrong: '#99f6e4',

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

/**
 * KpiAccents — accenti "categorici" usati nelle card KPI (PurchaseOrderKpis,
 * Issues, WikiStats, ServiceNowStats, MonitorDrawer) per distinguere
 * visivamente metriche che NON rappresentano uno stato semantico. Stati
 * semantici veri (es. "Critiche aperte" in Issues.tsx) vanno letti
 * direttamente da theme.palette.error/warning/success — non da qui.
 *
 * Consolidamento colori 0.9.x: solo 2 famiglie di colore (teal = primary,
 * violet = secondary), ciascuna con 3 sfumature (1 = main, 2 = dark/strong,
 * 3 = variante chiara) per le pagine che vogliono più accenti nella stessa
 * famiglia invece di introdurre un'altra hue. Numerati (non "Strong"/"Light")
 * apposta per essere comunicabili a voce tra pagine ("usa violet3 qui").
 */
export type KpiAccents = {
  /** = theme.palette.primary.main */
  teal1: string
  /** = theme.palette.primary.dark */
  teal2: string
  /** = theme.palette.primary.light */
  teal3: string
  /** = theme.palette.secondary.main */
  violet1: string
  /** = theme.palette.secondary.dark */
  violet2: string
  /**
   * Variante chiara "sibling" di teal3. NON deriva da
   * theme.palette.secondary.light (#ede9fe): quel valore è pensato per tinte
   * di sfondo, troppo pallido per una barra accento/icona leggibile. Violet-400
   * scelto come equivalente percettivo di primary.light.
   */
  violet3: string
}

/**
 * GRID_ZEBRA_BASE — colore base (senza alpha) per lo zebra striping delle
 * MuiDataGrid, duplicato identico (rgb(69,127,121) fisso) in 14 pagine
 * diverse. Centralizzato qui e composto con `alpha()` nel punto di consumo
 * (vedi theme/dataGridZebraSx.ts). Valore storico esatto (#457f79 =
 * rgb(69,127,121)), nessun cambio visivo.
 */
export const GRID_ZEBRA_BASE = '#457f79'

export const KPI_ACCENTS: KpiAccents = {
  teal1:   '#0f766e', // = theme.palette.primary.main
  teal2:   '#0a524d', // = theme.palette.primary.dark
  teal3:   '#45a59d', // = theme.palette.primary.light
  violet1: '#8b5cf6', // = theme.palette.secondary.main
  violet2: SHARED.categorical.violet.text, // = theme.palette.secondary.dark
  violet3: '#a78bfa', // violet-400, vedi nota nel tipo sopra
} as const

/**
 * WidgetAccents — colori "fuori tema" trovati in chip/badge/widget vari
 * (AuditActionChip, badge assenza "training", status viola in Sites/
 * Customers, badge "new", sfondi teal-50, confetti ContributorCard,
 * categorie Wiki). Non sono semantici (non sono success/warning/error/info)
 * né gestiti dal sistema KpiAccents — servono a distinguere elementi
 * categorici o decorativi.
 */
export type WidgetAccents = {
  /** Chip/badge viola: sfondo, testo, bordo (AuditActionChip usa un bordo
   *  leggermente diverso da quello degli status-map Sites/Customers). */
  violetBg: string
  violetText: string
  violetBorderChip: string
  violetBorderStatus: string
  /** Badge assenza "training" (absenceShared) */
  trainingBadgeBg: string
  trainingBadgeText: string
  /** Accent mint/teal brillante riusato fuori dalla sidebar (badge "new",
   *  gradiente AppLayout, WikiRevisionsTab, RichEditor code block) — deriva
   *  da SIDEBAR.accent/accentLight, non più ridichiarato come hex separato
   *  (era duplicato letterale — stesso trattamento del viola). */
  mintAccent: string
  mintAccentLight: string
  mintAccentBright: string
  newBadgeBg: string
  newBadgeBorder: string
  /** Sfondo teal-50 molto chiaro (hover card Drive/WikiPage/FolderCard) */
  softTealBg: string
  /** Confetti ContributorCard — 7 colori */
  confetti: string[]
  /** Categorie Wiki (fallback quando la pagina non ha un colore custom) — 8 colori */
  categoryAccents: string[]
}

export const WIDGET_ACCENTS: WidgetAccents = {
  violetBg: SHARED.categorical.violet.bg,
  violetText: SHARED.categorical.violet.text,
  violetBorderChip: SHARED.categorical.violet.borderChip,
  violetBorderStatus: SHARED.categorical.violet.borderStatus,
  trainingBadgeBg: 'rgba(124,58,237,0.14)',
  trainingBadgeText: SHARED.categorical.violet.text,
  mintAccent: SIDEBAR.accent,
  mintAccentLight: SIDEBAR.accentLight,
  mintAccentBright: SIDEBAR.accentBright,
  newBadgeBg: alpha(SIDEBAR.accent, 0.18),
  newBadgeBorder: alpha(SIDEBAR.accentLight, 0.3),
  softTealBg: '#f0fdf9',
  confetti: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'],
  categoryAccents: ['#0f766e', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#10b981', '#f97316'],
} as const
