import * as React from 'react'
import { api } from '@shared/api/client'
import { setUnauthorizedHandler } from '@shared/api/runtime'
import { createAuthBroadcast, type AuthBroadcast } from '@shared/auth/authBroadcast'

// Tipo ritornato da /api/portal/me/
export type PortalCustomerRef = {
  id: number
  name: string
  display_name: string
  code: string
}

export type PortalMe = {
  user: {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
    avatar: string | null
  }
  customer: PortalCustomerRef // cliente ATTIVO (0.9.0: risolto da sessione server-side)
  customers: PortalCustomerRef[] // tutti i clienti assegnati all'utente
  portal: {
    is_active: boolean
    can_edit_devices: boolean
    permissions: string[]
  }
}

type AuthCtx = {
  me: PortalMe | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  switchCustomer: (customerId: number) => Promise<void>
  switchingCustomer: boolean
  /** Non-null quando il profilo esiste ma è bloccato (0.9.0 punto 4: il
   * cliente di default non è più tra quelli assegnati). Diverso da "non
   * autenticato": l'utente ha fatto login correttamente, ma non può
   * operare finché un admin non lo sblocca. */
  blockedMessage: string | null
  locked: boolean
  lock: () => void
  unlock: () => void
}

const AuthContext = React.createContext<AuthCtx | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<PortalMe | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [locked, setLocked] = React.useState(false)
  const [blockedMessage, setBlockedMessage] = React.useState<string | null>(null)
  const [switchingCustomer, setSwitchingCustomer] = React.useState(false)

  // Fix P2 9: sincronizza lock/unlock/logout con le altre schede del
  // portale AUSL BO aperte nello stesso browser.
  const broadcastRef = React.useRef<AuthBroadcast | null>(null)

  React.useEffect(() => {
    const bc = createAuthBroadcast('portal-auth-sync', (msg) => {
      if (msg.type === 'lock') setLocked(true)
      else if (msg.type === 'unlock') setLocked(false)
      else if (msg.type === 'logout') {
        setMe(null)
        window.location.assign('/login')
      }
    })
    broadcastRef.current = bc
    return () => bc.close()
  }, [])

  const lock = React.useCallback(() => {
    setLocked(true)
    broadcastRef.current?.post({ type: 'lock' })
  }, [])
  const unlock = React.useCallback(() => {
    setLocked(false)
    broadcastRef.current?.post({ type: 'unlock' })
  }, [])

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null)
      window.location.assign('/login')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const refreshMe = React.useCallback(async () => {
    try {
      const res = await api.get<PortalMe>('/portal/me/')
      setMe(res.data)
      setBlockedMessage(null)
    } catch (err) {
      const axiosErr = err as { response?: { status?: number; data?: { blocked?: boolean; detail?: string } } }
      if (axiosErr.response?.status === 403 && axiosErr.response.data?.blocked) {
        // Profilo Portal esistente ma bloccato (0.9.0 punto 4): l'utente è
        // autenticato, non lo si manda al login, si mostra il motivo.
        setMe(null)
        setBlockedMessage(axiosErr.response.data.detail || 'Accesso al portale sospeso.')
      } else {
        setMe(null)
        setBlockedMessage(null)
      }
    }
  }, [])

  const switchCustomer = React.useCallback(async (customerId: number) => {
    setSwitchingCustomer(true)
    try {
      await api.post('/portal/switch-customer/', { customer_id: customerId })
      // Nessuna cache dati centralizzata (niente react-query): il modo
      // affidabile per far ripartire ogni pagina con lo scope del nuovo
      // cliente, senza dover verificare le dipendenze di ogni singolo
      // componente, è un reload completo. Il backend ha già aggiornato
      // la sessione, quindi al ricaricamento tutto riparte già scoped
      // correttamente.
      window.location.reload()
    } finally {
      setSwitchingCustomer(false)
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        await api.get('/auth/csrf/')
        await refreshMe()
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshMe])

  const login = React.useCallback(
    async (username: string, password: string) => {
      await api.get('/auth/csrf/')
      await api.post('/auth/login/', { username, password, ambito: 'portal' })
      await refreshMe()
    },
    [refreshMe],
  )

  const logout = React.useCallback(async () => {
    try {
      await api.post('/auth/logout/')
    } finally {
      setMe(null)
      setBlockedMessage(null)
      broadcastRef.current?.post({ type: 'logout' })
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ me, loading, login, logout, refreshMe, switchCustomer, switchingCustomer, blockedMessage, locked, lock, unlock }}
    >
      {children}
    </AuthContext.Provider>
  )
}
