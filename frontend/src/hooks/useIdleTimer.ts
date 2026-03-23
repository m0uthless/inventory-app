import * as React from 'react'

const EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'click',
]

type UseIdleTimerOptions = {
  /** Millisecondi di inattività dopo cui scatta onLock (default: 15 min) */
  lockAfterMs?: number
  /** Millisecondi di inattività dopo cui scatta onLogout (default: 60 min) */
  logoutAfterMs?: number
  onLock: () => void
  onLogout: () => void
  /** Se false, il timer non parte (es. utente non autenticato) */
  enabled: boolean
}

/**
 * Traccia l'inattività dell'utente e chiama:
 * - onLock dopo `lockAfterMs` ms di inattività
 * - onLogout dopo `logoutAfterMs` ms di inattività
 *
 * Ogni interazione dell'utente resetta entrambi i timer.
 */
export function useIdleTimer({
  lockAfterMs   = 15 * 60 * 1000, // 15 minuti
  logoutAfterMs = 60 * 60 * 1000, // 60 minuti
  onLock,
  onLogout,
  enabled,
}: UseIdleTimerOptions) {
  const lockTimerRef   = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockedRef      = React.useRef(false)

  const clear = React.useCallback(() => {
    if (lockTimerRef.current)   clearTimeout(lockTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
  }, [])

  const reset = React.useCallback(() => {
    if (!enabled) return
    clear()

    lockTimerRef.current = setTimeout(() => {
      lockedRef.current = true
      onLock()
    }, lockAfterMs)

    logoutTimerRef.current = setTimeout(() => {
      onLogout()
    }, logoutAfterMs)
  }, [enabled, clear, onLock, onLogout, lockAfterMs, logoutAfterMs])

  // Chiamato dall'esterno quando l'utente sblocca — resetta i timer
  const resetAfterUnlock = React.useCallback(() => {
    lockedRef.current = false
    reset()
  }, [reset])

  React.useEffect(() => {
    if (!enabled) {
      clear()
      return
    }

    reset()

    // Quando l'utente interagisce, resetta solo se non è già locked
    const handleActivity = () => {
      if (!lockedRef.current) reset()
    }

    EVENTS.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }))

    return () => {
      clear()
      EVENTS.forEach(ev => window.removeEventListener(ev, handleActivity))
    }
  }, [enabled, reset, clear])

  return { resetAfterUnlock }
}
