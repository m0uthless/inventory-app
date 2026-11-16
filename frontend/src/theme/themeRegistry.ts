import { createArchieTheme } from '../theme'
import type { Theme } from '@mui/material/styles'
import type { ColorMode } from './palettes'
import {
  SIDEBAR,
  KPI_ACCENTS,
  WIDGET_ACCENTS,
  GRID_ZEBRA_BASE,
  type SidebarTokens, type KpiAccents, type WidgetAccents,
} from './tokens'
import {
  STATUS_TOKENS,
  type DomainStatusTokens,
} from './statusTokens'
import { SHARED, type SharedConstants } from './constants'

// ─── Registro temi ──────────────────────────────────────────────────────────
// Chiave = valore salvato in UserProfile.theme (backend, core/models.py).
// Restyle "Campo sterile": "default" è il Verde chirurgico. Blu e Indaco sono
// implementate ma non ancora selezionabili dal profilo (`selectable: false`):
// si aprono cambiando il flag, senza altre modifiche.
// La modalità chiaro/scuro è una preferenza separata (UserProfile.color_mode).

export type ThemeKey = 'default' | 'blu' | 'indaco'

export const DEFAULT_THEME_KEY: ThemeKey = 'default'

export type ThemeRegistryEntry = {
  /** Tema chiaro, usato per le anteprime (es. pagina Profilo). */
  theme: Theme
  /** Costruisce il tema per la modalità richiesta. */
  build: (mode: ColorMode) => Theme
  sidebar: SidebarTokens
  kpiAccents: KpiAccents
  widgetAccents: WidgetAccents
  status: DomainStatusTokens
  constants: SharedConstants
  gridZebraBase: string
  label: string
  /** Colore del campione mostrato nella scelta palette. */
  swatch: string
  /** Se false la palette esiste ma non compare nella scelta del profilo. */
  selectable: boolean
}

function entry(key: ThemeKey, label: string, swatch: string, selectable: boolean): ThemeRegistryEntry {
  const cache: Partial<Record<ColorMode, Theme>> = {}
  const build = (mode: ColorMode) => (cache[mode] ??= createArchieTheme(key, mode))
  return {
    theme: build('light'), build,
    sidebar: SIDEBAR, kpiAccents: KPI_ACCENTS, widgetAccents: WIDGET_ACCENTS, status: STATUS_TOKENS,
    constants: SHARED, gridZebraBase: GRID_ZEBRA_BASE, label, swatch, selectable,
  }
}

export const THEME_REGISTRY: Record<ThemeKey, ThemeRegistryEntry> = {
  default: entry('default', 'Verde chirurgico', '#1f6b5c', true),
  blu: entry('blu', 'Blu clinico', '#1f5f99', false),
  indaco: entry('indaco', 'Indaco', '#4a48a6', false),
}

export type ColorModePref = 'light' | 'dark' | 'system'

export function resolveColorModePref(raw: string | null | undefined): ColorModePref {
  return raw === 'dark' || raw === 'system' ? raw : 'light'
}

/** Normalizza un valore arbitrario (es. da API) alla chiave tema più vicina,
 * ricadendo sul default se non riconosciuto (utente non ancora migrato,
 * valore corrotto, ecc.). */
export function resolveThemeKey(raw: string | null | undefined): ThemeKey {
  return raw != null && raw in THEME_REGISTRY ? (raw as ThemeKey) : DEFAULT_THEME_KEY
}
