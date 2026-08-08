import { theme as defaultTheme } from '../theme'
import { navyTheme } from '../theme.navy'
import { SIDEBAR, SIDEBAR_NAVY, type SidebarTokens } from './tokens'

// ─── Registro temi ──────────────────────────────────────────────────────────
// Chiave = valore salvato in UserProfile.theme (backend, core/models.py).
// Estendere qui quando si aggiungono nuovi temi dal punto 1 della roadmap.

export type ThemeKey = 'default' | 'navy'

export const DEFAULT_THEME_KEY: ThemeKey = 'default'

export const THEME_REGISTRY: Record<
  ThemeKey,
  { theme: typeof defaultTheme; sidebar: SidebarTokens; label: string }
> = {
  default: { theme: defaultTheme, sidebar: SIDEBAR, label: 'Predefinito (teal)' },
  navy:    { theme: navyTheme,    sidebar: SIDEBAR_NAVY, label: 'Navy' },
}

/** Normalizza un valore arbitrario (es. da API) alla chiave tema più vicina,
 * ricadendo sul default se non riconosciuto (utente non ancora migrato,
 * valore corrotto, ecc.). */
export function resolveThemeKey(raw: string | null | undefined): ThemeKey {
  return raw != null && raw in THEME_REGISTRY ? (raw as ThemeKey) : DEFAULT_THEME_KEY
}
