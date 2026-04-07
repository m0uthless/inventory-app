import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { theme } from './theme'
import App from './App'
import { ToastProvider } from '@shared/ui/toast'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from '@shared/ui/ErrorBoundary'
import { api } from '@shared/api/client'

// Inietta l'header X-Auslbo-Portal su ogni richiesta axios del portal.
// Il backend usa questo header nel AuslBoScopedMixin per applicare il filtro
// customer — indipendentemente dal fatto che l'utente sia staff o meno.
// Il frontend Archie principale non registra questo interceptor, quindi
// le sue richieste non portano l'header e non vengono filtrate.
api.interceptors.request.use((config) => {
  config.headers['X-Auslbo-Portal'] = '1'
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
