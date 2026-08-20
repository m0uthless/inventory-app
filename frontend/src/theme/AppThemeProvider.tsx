import * as React from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useAuth } from '../auth/AuthProvider'
import { THEME_REGISTRY, DEFAULT_THEME_KEY, resolveThemeKey } from './themeRegistry'
import { SIDEBAR, KPI_ACCENTS, WIDGET_ACCENTS, GRID_ZEBRA_BASE } from './tokens'
import { STATUS_TOKENS } from './statusTokens'
import { SHARED } from './constants'
import type { SidebarTokens, KpiAccents, WidgetAccents } from './tokens'
import type { DomainStatusTokens } from './statusTokens'
import type { SharedConstants } from './constants'

/**
 * ThemeTokens — punto unico di raccolta di tutti i token "fuori palette
 * MUI standard" per il tema attivo. Nato dall'accorpamento dei precedenti
 * 3 Context separati (Sidebar/Kpi/Widget), estesi con `status` (colori
 * per stato di dominio, es. Purchase Order), `constants` (bianco/nero/
 * overlay condivisi cross-tema) e `gridZebraBase` (colore base zebra
 * striping MuiDataGrid).
 *
 * Aggiungere un nuovo dominio di colori non richiede più un nuovo Context:
 * si estende questo tipo e si valorizza il campo nel ThemeRegistryEntry
 * corrispondente (theme/themeRegistry.ts).
 */
export type ThemeTokens = {
  sidebar: SidebarTokens
  kpi: KpiAccents
  widget: WidgetAccents
  status: DomainStatusTokens
  constants: SharedConstants
  gridZebraBase: string
}

const DEFAULT_TOKENS: ThemeTokens = {
  sidebar: SIDEBAR,
  kpi: KPI_ACCENTS,
  widget: WIDGET_ACCENTS,
  status: STATUS_TOKENS,
  constants: SHARED,
  gridZebraBase: GRID_ZEBRA_BASE,
}

const ThemeTokensContext = React.createContext<ThemeTokens>(DEFAULT_TOKENS)

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeTokens(): ThemeTokens {
  return React.useContext(ThemeTokensContext)
}

// ─── Hook di compatibilità ───────────────────────────────────────────────
// I componenti esistenti importano questi hook puntuali: restano invariati
// nella firma, cambia solo l'implementazione sotto (derivata dal Context
// unico invece che da 3 Context separati).

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarTokens(): SidebarTokens {
  return useThemeTokens().sidebar
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKpiAccents(): KpiAccents {
  return useThemeTokens().kpi
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWidgetAccents(): WidgetAccents {
  return useThemeTokens().widget
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStatusTokens(): DomainStatusTokens {
  return useThemeTokens().status
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeConstants(): SharedConstants {
  return useThemeTokens().constants
}

/**
 * useDataGridZebraSx — le 4 regole di zebra striping per MuiDataGrid
 * (riga pari, hover, selezionata, selezionata+hover), derivate dal colore
 * base del tema attivo. Prima duplicate identiche (colore fisso, non
 * theme-aware) in 14 pagine diverse — vedi `gridZebraBase` sopra.
 * Il chiamante fa lo spread nel proprio `sx` insieme alle regole di
 * densità riga specifiche della pagina (che restano locali, es. altezza
 * riga diversa tra grid compatte e standard).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDataGridZebraSx() {
  const { gridZebraBase } = useThemeTokens()
  return {
    '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: alpha(gridZebraBase, 0.03) },
    '& .MuiDataGrid-row:hover': { backgroundColor: alpha(gridZebraBase, 0.06) },
    '& .MuiDataGrid-row.Mui-selected': { backgroundColor: `${alpha(gridZebraBase, 0.10)} !important` },
    '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: `${alpha(gridZebraBase, 0.14)} !important` },
  } as const
}

/**
 * Sceglie il tema MUI in base a `me.profile.theme` (persistito lato server,
 * quindi cross-device — punto 1 della roadmap). Finché `me` non è ancora
 * caricato (primo mount, schermata di login) usa il tema default: non c'è
 * un utente autenticato da cui leggere la preferenza.
 *
 * Deve stare DENTRO AuthProvider (per poter chiamare useAuth) e FUORI da
 * ToastProvider/App (che possono già assumere un tema MUI disponibile).
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { me } = useAuth()
  const themeKey = resolveThemeKey(me?.profile?.theme ?? DEFAULT_THEME_KEY)
  const entry = THEME_REGISTRY[themeKey]

  const tokens = React.useMemo<ThemeTokens>(() => ({
    sidebar: entry.sidebar,
    kpi: entry.kpiAccents,
    widget: entry.widgetAccents,
    status: entry.status,
    constants: entry.constants,
    gridZebraBase: entry.gridZebraBase,
  }), [entry])

  return (
    <ThemeProvider theme={entry.theme}>
      <CssBaseline />
      <ThemeTokensContext.Provider value={tokens}>
        {children}
      </ThemeTokensContext.Provider>
    </ThemeProvider>
  )
}
