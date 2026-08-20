import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LoginPage, type AmbitoConfig, type Ambito } from '@shared/ui/LoginPage'
import { useAuth } from '../auth/AuthProvider'
import { api } from '@shared/api/client'
import { useTheme, alpha } from '@mui/material/styles'

// AMBITI era un const a livello di modulo con `theme.palette.primary.X` da
// import statico — bug noto, ma di fatto innocuo qui: prima del login
// AppThemeProvider non ha un utente da cui leggere la preferenza tema e
// ricade sempre sul tema default (vedi AppThemeProvider.tsx), quindi
// useTheme() risolverebbe comunque allo stesso valore. Sistemato per
// coerenza e per non lasciare un pattern-bug nel codice.
// 'portal' (Portale Clienti) ha colori brand propri e distinti, non legati
// al tema Archie — eccezione intenzionale (prodotto diverso).

// URL del portale Portal (da variabile Vite, con fallback)
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) ?? 'http://localhost:8081'

export default function Login() {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const AMBITI: AmbitoConfig[] = React.useMemo(() => [
    {
      value: 'archie',
      label: 'ARCHIE',
      color: theme.palette.primary.main,
      colorHover: theme.palette.primary.dark,
      colorLight: alpha(theme.palette.primary.main, 0.12),
    },
    {
      value: 'portal',
      label: 'Portale Clienti',
      color: '#1A6BB5',
      colorHover: '#155C9E',
      colorLight: 'rgba(26,107,181,0.12)',
    },
  ], [theme])

  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (username: string, password: string, ambito: Ambito) => {
    setError(null)
    setLoading(true)
    try {
      await api.get('/auth/csrf/')
      await api.post('/auth/login/', {
        username,
        password,
        // Informa il backend dell'ambito scelto (usato per validazioni futura)
        ...(ambito === 'portal' ? { ambito: 'portal' } : {}),
      })

      if (ambito === 'portal') {
        // Redirect al portale Portal — la sessione è già attiva sul backend
        window.location.assign(PORTAL_URL)
      } else {
        // Ambito Archie: rimane su questo frontend
        await refreshMe()
        navigate(from, { replace: true })
      }
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { detail?: string }; status?: number } })?.response
      const detail = resp?.data?.detail
      const status = resp?.status
      if (status === 401) setError('Credenziali non valide.')
      else if (status === 403) setError(detail || 'Accesso non autorizzato.')
      else if (status === 429) setError('Troppi tentativi. Riprova tra qualche minuto.')
      else setError(detail || 'Errore di connessione. Verifica la rete.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginPage
      ambiti={AMBITI}
      defaultAmbito="archie"
      onLogin={handleLogin}
      error={error}
      loading={loading}
    />
  )
}
