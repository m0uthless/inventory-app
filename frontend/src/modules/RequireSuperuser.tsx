import * as React from 'react'

import { useAuth } from '../auth/AuthProvider'
import NotFound from '../pages/NotFound'

/** Pagine solo per i superuser: per gli altri non esistono (404). */
export function RequireSuperuser({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth()
  if (loading) return null
  if (!me?.is_superuser) return <NotFound />
  return <>{children}</>
}
