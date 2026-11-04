/**
 * Palette del restyle "Campo sterile" (frontend/DESIGN.md).
 *
 * Una tinta per palette, neutri tinti verso quella tinta, colori di stato
 * uguali in tutte le palette. Ogni palette ha una versione chiara e una scura
 * costruite dagli stessi ruoli (non un'inversione automatica).
 *
 * Chiavi = valori di UserProfile.theme (backend core/models.py). "default" è
 * il Verde chirurgico; Blu e Indaco sono implementate ma per ora non
 * selezionabili (vedi `selectable` in themeRegistry.ts).
 */

export type PaletteKey = 'default' | 'blu' | 'indaco'
export type ColorMode = 'light' | 'dark'

/** Ruoli di colore oltre a quelli standard MUI, esposti come `theme.palette.archie`. */
export type ArchieTokens = {
  /** Sidebar e topbar: la cornice che contiene il foglio di lavoro. */
  frame: string
  /** Superficie secondaria: intestazioni tabella, hover, piè dei pannelli. */
  surface2: string
  /** Bordo forte: input, hover dei controlli. */
  borderStrong: string
  /** Testo terziario (≥ 4.5:1 su paper). */
  textFaint: string
  /** "Campo sterile": selezione (riga, voce di menu attiva, filtro attivo). */
  field: string
  /** Bordo della selezione. */
  fieldLine: string
  /** Fondo neutro per badge e contatori. */
  neutralBg: string
  /** Fascia di marca scura (testata del pannello di dettaglio) e suo secondo tono. */
  band: string
  band2: string
  /** Scala sequenziale a una tinta per dati ordinali (1 = meno, 4 = più). */
  seq: [string, string, string, string]
  /** Ombra degli elementi che galleggiano (pannello, menu, dialoghi). */
  shadowFloat: string
  /** Anello di focus. */
  focusRing: string
}

export type PaletteSpec = {
  mode: ColorMode
  primary: { main: string; hover: string; contrastText: string }
  background: { default: string; paper: string }
  text: { primary: string; secondary: string }
  divider: string
  success: { main: string; bg: string }
  warning: { main: string; bg: string }
  error: { main: string; bg: string }
  info: { main: string; bg: string }
  archie: ArchieTokens
}

// Colori di stato: identici in ogni palette (cambia solo chiaro/scuro).
const STATUS_LIGHT = {
  success: { main: '#2e7d4f', bg: '#e3f3e9' },
  warning: { main: '#9a5b00', bg: '#fbefd9' },
  error: { main: '#c2362b', bg: '#fbe5e2' },
  info: { main: '#2f5f9e', bg: '#e5edf8' },
}
const STATUS_DARK = {
  success: { main: '#5cc48a', bg: '#173327' },
  warning: { main: '#e0a43a', bg: '#3a2c12' },
  error: { main: '#f07466', bg: '#3c1d1a' },
  info: { main: '#7fa8e0', bg: '#1b2a40' },
}
const SHADOW_DARK = '0 16px 40px -12px rgb(0 0 0 / .6)'

export const PALETTES: Record<PaletteKey, Record<ColorMode, PaletteSpec>> = {
  default: {
    light: {
      mode: 'light',
      primary: { main: '#1f6b5c', hover: '#18584c', contrastText: '#ffffff' },
      background: { default: '#eef2f1', paper: '#ffffff' },
      text: { primary: '#15201e', secondary: '#5b6b67' },
      divider: '#d5dedb',
      ...STATUS_LIGHT,
      archie: {
        frame: '#e3eae8', surface2: '#f5f8f7', borderStrong: '#b9c7c3', textFaint: '#66766f',
        field: '#e2f0eb', fieldLine: '#1f6b5c', neutralBg: '#edf1f0',
        band: '#17463c', band2: '#1f5a4d',
        seq: ['#b5d4cb', '#6aa898', '#2f7f6d', '#164d42'],
        shadowFloat: '0 12px 32px -12px rgb(16 40 34 / .22), 0 2px 6px rgb(16 40 34 / .06)',
        focusRing: '0 0 0 3px rgb(31 107 92 / .28)',
      },
    },
    dark: {
      mode: 'dark',
      primary: { main: '#5fb8a3', hover: '#7ccab7', contrastText: '#0b1513' },
      background: { default: '#0f1615', paper: '#151e1c' },
      text: { primary: '#e4ecea', secondary: '#93a4a0' },
      divider: '#2a3734',
      ...STATUS_DARK,
      archie: {
        frame: '#121a19', surface2: '#1a2523', borderStrong: '#3b4c48', textFaint: '#849591',
        field: '#183a33', fieldLine: '#5fb8a3', neutralBg: '#1e2928',
        band: '#123a32', band2: '#1a5045',
        seq: ['#2b5a4f', '#3f8676', '#5fb8a3', '#a6e3d3'],
        shadowFloat: SHADOW_DARK,
        focusRing: '0 0 0 3px rgb(95 184 163 / .35)',
      },
    },
  },
  blu: {
    light: {
      mode: 'light',
      primary: { main: '#1f5f99', hover: '#194f80', contrastText: '#ffffff' },
      background: { default: '#eef1f5', paper: '#ffffff' },
      text: { primary: '#151c26', secondary: '#5a6676' },
      divider: '#d4dbe4',
      ...STATUS_LIGHT,
      // In Blu clinico "info" passa al verde acqua per non confondersi col primario.
      info: { main: '#1d6f86', bg: '#e0f1f5' },
      archie: {
        frame: '#e3e8ef', surface2: '#f5f7fa', borderStrong: '#b8c3d1', textFaint: '#657182',
        field: '#e1ebf6', fieldLine: '#1f5f99', neutralBg: '#edf0f4',
        band: '#153e66', band2: '#1c4f80',
        seq: ['#bcd3ea', '#74a2d0', '#2f6fa8', '#143f68'],
        shadowFloat: '0 12px 32px -12px rgb(16 30 50 / .22), 0 2px 6px rgb(16 30 50 / .06)',
        focusRing: '0 0 0 3px rgb(31 95 153 / .28)',
      },
    },
    dark: {
      mode: 'dark',
      primary: { main: '#6fa8e0', hover: '#8dbbe8', contrastText: '#0b1320' },
      background: { default: '#0f141b', paper: '#151b24' },
      text: { primary: '#e3e9f1', secondary: '#94a1b2' },
      divider: '#29323f',
      ...STATUS_DARK,
      info: { main: '#6cc0d4', bg: '#14303a' },
      archie: {
        frame: '#121821', surface2: '#1a212c', borderStrong: '#3a4555', textFaint: '#8592a3',
        field: '#18304a', fieldLine: '#6fa8e0', neutralBg: '#1e2530',
        band: '#132f4e', band2: '#1b4168',
        seq: ['#263f5c', '#3b6a9a', '#6fa8e0', '#b5d4f3'],
        shadowFloat: SHADOW_DARK,
        focusRing: '0 0 0 3px rgb(111 168 224 / .35)',
      },
    },
  },
  indaco: {
    light: {
      mode: 'light',
      primary: { main: '#4a48a6', hover: '#3d3b8c', contrastText: '#ffffff' },
      background: { default: '#f0f0f5', paper: '#ffffff' },
      text: { primary: '#18182a', secondary: '#5e5e74' },
      divider: '#d9d9e4',
      ...STATUS_LIGHT,
      archie: {
        frame: '#e6e6ef', surface2: '#f7f7fa', borderStrong: '#bfbfd0', textFaint: '#69697f',
        field: '#e8e8f7', fieldLine: '#4a48a6', neutralBg: '#efeff4',
        band: '#2b2a6b', band2: '#383788',
        seq: ['#cfcfee', '#9291d6', '#5856b3', '#2c2a73'],
        shadowFloat: '0 12px 32px -12px rgb(28 26 60 / .22), 0 2px 6px rgb(28 26 60 / .06)',
        focusRing: '0 0 0 3px rgb(74 72 166 / .28)',
      },
    },
    dark: {
      mode: 'dark',
      primary: { main: '#9d9cec', hover: '#b4b3f1', contrastText: '#12111f' },
      background: { default: '#121219', paper: '#18181f' },
      text: { primary: '#e7e7f0', secondary: '#9c9cb0' },
      divider: '#2d2d3a',
      ...STATUS_DARK,
      archie: {
        frame: '#15151c', surface2: '#1d1d26', borderStrong: '#3f3f50', textFaint: '#8d8da1',
        field: '#2a2952', fieldLine: '#9d9cec', neutralBg: '#23232d',
        band: '#232254', band2: '#302f70',
        seq: ['#34335e', '#5554a0', '#9d9cec', '#d2d1f7'],
        shadowFloat: SHADOW_DARK,
        focusRing: '0 0 0 3px rgb(157 156 236 / .35)',
      },
    },
  },
}
