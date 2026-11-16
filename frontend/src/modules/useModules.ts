import * as React from 'react'

import { useAuth } from '../auth/AuthProvider'
import { moduleForPath, type ModuleKey } from './moduleRegistry'

/**
 * Stato dei moduli per l'utente corrente.
 * - `isOff`: il modulo è spento (per tutti).
 * - `isHidden`: va nascosto a questo utente (spento e non superuser).
 */
export function useModules() {
  const { me } = useAuth()
  const off = React.useMemo(() => new Set(me?.disabled_modules ?? []), [me?.disabled_modules])
  const su = Boolean(me?.is_superuser)

  const isOff = React.useCallback((key: ModuleKey | null | undefined) => Boolean(key && off.has(key)), [off])
  const isHidden = React.useCallback((key: ModuleKey | null | undefined) => !su && isOff(key), [su, isOff])
  const isPathHidden = React.useCallback((pathname: string) => isHidden(moduleForPath(pathname)), [isHidden])
  const isPathOff = React.useCallback((pathname: string) => isOff(moduleForPath(pathname)), [isOff])

  return { isOff, isHidden, isPathHidden, isPathOff }
}
