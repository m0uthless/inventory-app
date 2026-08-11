import * as React from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'
import { THEME_REGISTRY, DEFAULT_THEME_KEY, resolveThemeKey } from './themeRegistry'
import { SIDEBAR } from './tokens'

// ─── Context token sidebar ──────────────────────────────────────────────────
// I componenti della sidebar (AppLayout, NavGroupFlyout, GlobalSearch, ecc.)
// leggevano finora SIDEBAR come import statico da tokens.ts. Con più temi
// possibili serve un valore che cambi a runtime in base al tema attivo:
// da qui il context, con SIDEBAR (teal) come default per evitare che un
// eventuale consumer fuori da AppThemeProvider prenda `undefined`.
const SidebarTokensContext = React.createContext(SIDEBAR)

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarTokens() {
  return React.useContext(SidebarTokensContext)
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

  return (
    <ThemeProvider theme={entry.theme}>
      <CssBaseline />
      <SidebarTokensContext.Provider value={entry.sidebar}>
        {children}
      </SidebarTokensContext.Provider>
    </ThemeProvider>
  )
}
