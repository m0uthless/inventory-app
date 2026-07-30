import * as React from 'react'
import { api } from '@shared/api/client'
import { setUnauthorizedHandler } from '@shared/api/runtime'
import { createAuthBroadcast, type AuthBroadcast } from '@shared/auth/authBroadcast'

export type Me = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_superuser: boolean
  groups: string[]
  permissions: string[]
  profile?: {
    avatar: string | null
    preferred_customer: number | null
    preferred_customer_name?: string | null
    leave_area?: number | null
    leave_area_label?: string | null
  }
}

type AuthCtx = {
  me: Me | null
  loading: boolean
  refreshMe: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPerm: (perm: string) => boolean
  inGroup: (group: string) => boolean
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
  const [me, setMe] = React.useState<Me | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [locked, setLocked] = React.useState(false)

  // Fix P2 9: sincronizza lock/unlock/logout con le altre schede della
  // stessa app aperte nello stesso browser (vedi shared/src/auth/authBroadcast.ts).
  const broadcastRef = React.useRef<AuthBroadcast | null>(null)

  React.useEffect(() => {
    const bc = createAuthBroadcast('archie-auth-sync', (msg) => {
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
      const res = await api.get<Me>('/me/')
      setMe(res.data)
    } catch {
      setMe(null)
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        // Set csrftoken cookie
        await api.get('/auth/csrf/')
        await refreshMe()
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshMe])

  const login = React.useCallback(
    async (username: string, password: string) => {
      // Assicura csrftoken prima del POST
      await api.get('/auth/csrf/')
      await api.post('/auth/login/', { username, password, ambito: 'site-repo' })
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

  const hasPerm = React.useCallback(
    (perm: string) => Boolean(me?.is_superuser || (me?.permissions || []).includes(perm)),
    [me],
  )

  const inGroup = React.useCallback(
    (group: string) => Boolean(me?.is_superuser || (me?.groups || []).includes(group)),
    [me],
  )

  return (
    <AuthContext.Provider value={{ me, loading, refreshMe, login, logout, hasPerm, inGroup, locked, lock, unlock }}>
      {children}
    </AuthContext.Provider>
  )
}
