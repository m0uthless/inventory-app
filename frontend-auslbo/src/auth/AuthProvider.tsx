import * as React from 'react'
import { api } from '@shared/api/client'
import { setUnauthorizedHandler } from '@shared/api/runtime'
import { createAuthBroadcast, type AuthBroadcast } from '@shared/auth/authBroadcast'

// Tipo ritornato da /api/auslbo/me/
export type AuslBoMe = {
  user: {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
    avatar: string | null
  }
  customer: {
    id: number
    name: string
    display_name: string
    code: string
  }
  auslbo: {
    is_active: boolean
    can_edit_devices: boolean
    permissions: string[]
  }
}

type AuthCtx = {
  me: AuslBoMe | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
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
  const [me, setMe] = React.useState<AuslBoMe | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [locked, setLocked] = React.useState(false)

  // Fix P2 9: sincronizza lock/unlock/logout con le altre schede del
  // portale AUSL BO aperte nello stesso browser.
  const broadcastRef = React.useRef<AuthBroadcast | null>(null)

  React.useEffect(() => {
    const bc = createAuthBroadcast('auslbo-auth-sync', (msg) => {
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
      const res = await api.get<AuslBoMe>('/auslbo/me/')
      setMe(res.data)
    } catch {
      setMe(null)
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
      await api.post('/auth/login/', { username, password, ambito: 'auslbo' })
      await refreshMe()
    },
    [refreshMe],
  )

  const logout = React.useCallback(async () => {
    try {
      await api.post('/auth/logout/')
    } finally {
      setMe(null)
      broadcastRef.current?.post({ type: 'logout' })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ me, loading, login, logout, refreshMe, locked, lock, unlock }}>
      {children}
    </AuthContext.Provider>
  )
}
