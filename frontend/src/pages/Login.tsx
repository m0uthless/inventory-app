import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LoginPage, type AmbitoConfig, type Ambito } from '@shared/ui/LoginPage'
import { useAuth } from '../auth/AuthProvider'
import { api } from '@shared/api/client'

const AMBITI: AmbitoConfig[] = [
  {
    value: 'archie',
    label: 'ARCHIE',
    color: '#0f766e',
    colorHover: '#0a524d',
    colorLight: 'rgba(15,118,110,0.12)',
  },
  {
    value: 'auslbo',
    label: 'AUSL Bologna',
    color: '#1A6BB5',
    colorHover: '#155C9E',
    colorLight: 'rgba(26,107,181,0.12)',
  },
]

// URL del portal AUSL BO (da variabile Vite, con fallback)
const AUSLBO_URL = (import.meta.env.VITE_AUSLBO_URL as string | undefined) ?? 'http://localhost:8081'

export default function Login() {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
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
        ...(ambito === 'auslbo' ? { ambito: 'auslbo' } : {}),
      })

      if (ambito === 'auslbo') {
        // Redirect al portal AUSL BO — la sessione è già attiva sul backend
        window.location.assign(AUSLBO_URL)
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
