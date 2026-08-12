import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { theme } from './theme'
import App from './App'
import { ToastProvider } from '@shared/ui/toast'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from '@shared/ui/ErrorBoundary'
import { api } from '@shared/api/client'

// Inietta l'header X-Portal-Customer su ogni richiesta axios del portal.
// Il backend usa questo header nel PortalScopedMixin per applicare il filtro
// customer — indipendentemente dal fatto che l'utente sia staff o meno.
// Il frontend Archie principale non registra questo interceptor, quindi
// le sue richieste non portano l'header e non vengono filtrate.
//
// Questo è ora l'UNICO punto in cui l'header viene impostato. Prima il portale
// aveva anche un proprio src/api/client.ts (istanza axios separata, con
// l'header nei defaults): il ramo VLAN passava da quella, tutto il resto da
// questa. Le due istanze divergevano — in particolare la locale non aveva
// `paramsSerializer: { indexes: null }`, quindi qualunque filtro multi-valore
// aggiunto alle pagine VLAN sarebbe stato serializzato come `key[]=v` e
// ignorato da DRF, in silenzio. Il client locale è stato rimosso.
api.interceptors.request.use((config) => {
  config.headers['X-Portal-Customer'] = '1'
  return config
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
