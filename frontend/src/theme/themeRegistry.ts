import { theme as defaultTheme } from '../theme'
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
// I temi "navy" e "temp" (anteprima) sono stati rimossi nel consolidamento
// 0.9.0: resta solo il tema di default (teal). Estendere qui se in futuro
// si reintroducono varianti tema.

export type ThemeKey = 'default'

export const DEFAULT_THEME_KEY: ThemeKey = 'default'

export type ThemeRegistryEntry = {
  theme: typeof defaultTheme
  sidebar: SidebarTokens
  kpiAccents: KpiAccents
  widgetAccents: WidgetAccents
  status: DomainStatusTokens
  constants: SharedConstants
  gridZebraBase: string
  label: string
}

export const THEME_REGISTRY: Record<ThemeKey, ThemeRegistryEntry> = {
  default: { theme: defaultTheme, sidebar: SIDEBAR, kpiAccents: KPI_ACCENTS, widgetAccents: WIDGET_ACCENTS, status: STATUS_TOKENS, constants: SHARED, gridZebraBase: GRID_ZEBRA_BASE, label: 'Predefinito (teal)' },
}

/** Normalizza un valore arbitrario (es. da API) alla chiave tema più vicina,
 * ricadendo sul default se non riconosciuto (utente non ancora migrato,
 * valore corrotto, ecc.). */
export function resolveThemeKey(raw: string | null | undefined): ThemeKey {
  return raw != null && raw in THEME_REGISTRY ? (raw as ThemeKey) : DEFAULT_THEME_KEY
}
