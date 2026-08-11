import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from '@shared/ui/toast'
import { AuthProvider } from './auth/AuthProvider'
import { AppThemeProvider } from './theme/AppThemeProvider'
import { ErrorBoundary } from '@shared/ui/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AppThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
