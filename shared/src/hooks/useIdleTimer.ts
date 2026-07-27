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
 *
 * Fix P2 (audit 2026-07, punto 9 "Sessione"): `onLock`/`onLogout` vengono
 * spesso passate come funzioni inline dal componente chiamante (es.
 * `AppLayout`), quindi cambiano identità ad ogni render. Prima erano nelle
 * dipendenze di `reset`/dell'effect principale: un semplice re-render del
 * genitore (non legato all'attività dell'utente) poteva ricreare l'effect,
 * rimuovere e riaggiungere tutti i listener, e riavviare i timer da capo,
 * allungando artificialmente il tempo di inattività reale prima del
 * lock/logout. Con il pattern "latest ref" le callback più recenti sono
 * sempre disponibili senza far dipendere l'effect dalla loro identità.
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

  // "Latest ref": sempre aggiornate ad ogni render, ma la loro identità non
  // fa parte delle dipendenze di reset/effect qui sotto.
  const onLockRef   = React.useRef(onLock)
  const onLogoutRef = React.useRef(onLogout)
  React.useEffect(() => { onLockRef.current = onLock }, [onLock])
  React.useEffect(() => { onLogoutRef.current = onLogout }, [onLogout])

  const clear = React.useCallback(() => {
    if (lockTimerRef.current)   clearTimeout(lockTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
  }, [])

  const reset = React.useCallback(() => {
    if (!enabled) return
    clear()

    lockTimerRef.current = setTimeout(() => {
      lockedRef.current = true
      onLockRef.current()
    }, lockAfterMs)

    logoutTimerRef.current = setTimeout(() => {
      onLogoutRef.current()
    }, logoutAfterMs)
  }, [enabled, clear, lockAfterMs, logoutAfterMs])

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
