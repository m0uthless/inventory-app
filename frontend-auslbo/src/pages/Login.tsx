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

// URL del frontend Archie principale (da variabile Vite, con fallback)
const ARCHIE_URL = (import.meta.env.VITE_ARCHIE_URL as string | undefined) ?? 'http://localhost'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (username: string, password: string, ambito: Ambito) => {
    setError(null)
    setLoading(true)
    try {
      if (ambito === 'archie') {
        // Login standard senza ambito auslbo, poi redirect al frontend principale
        await api.get('/auth/csrf/')
        await api.post('/auth/login/', { username, password })
        window.location.assign(ARCHIE_URL)
      } else {
        // Ambito AUSL BO: login con ambito, rimane su questo frontend
        await login(username, password)
        navigate(from, { replace: true })
      }
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { detail?: string }; status?: number } })?.response
      const detail = resp?.data?.detail
      const status = resp?.status
      if (status === 403) setError(detail || 'Non sei autorizzato ad accedere a questo portale.')
      else if (status === 401) setError('Credenziali non valide.')
      else if (status === 429) setError('Troppi tentativi. Riprova tra qualche minuto.')
      else setError(detail || 'Errore di connessione. Verifica la rete.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginPage
      ambiti={AMBITI}
      defaultAmbito="auslbo"
      onLogin={handleLogin}
      error={error}
      loading={loading}
    />
  )
}
