export type ToastLevel = 'success' | 'error' | 'warning' | 'info'

type ToastFn = (level: ToastLevel, message: string) => void
type UnauthorizedFn = () => void

export type IdleLockUserInfo = {
  username: string
  first_name?: string
  last_name?: string
  avatar?: string | null
}

type IdleLockFn = (userInfo?: IdleLockUserInfo) => void

let toastFn: ToastFn | null = null
let unauthorizedFn: UnauthorizedFn | null = null
let idleLockFn: IdleLockFn | null = null

export function setApiToast(fn: ToastFn | null) {
  toastFn = fn
}

export function setUnauthorizedHandler(fn: UnauthorizedFn | null) {
  unauthorizedFn = fn
}

/**
 * 0.9.0: handler separato per il 401 "idle_lock" (SessionIdleTimeoutMiddleware,
 * backend/core/middleware.py). A differenza di un 401 generico, la sessione
 * NON è invalidata: va mostrata la LockScreen (richiesta password), non un
 * redirect a /login con perdita dello stato applicativo.
 */
export function setIdleLockHandler(fn: IdleLockFn | null) {
  idleLockFn = fn
}

export function apiToast(level: ToastLevel, message: string) {
  try {
    toastFn?.(level, message)
  } catch {
    // fallback: non bloccare mai le API per un toast
    console.warn('[toast]', level, message)
  }
}

export function handleUnauthorized() {
  try {
    unauthorizedFn?.()
  } catch {
    // fallback
    window.location.assign('/login')
  }
}

export function handleIdleLock(userInfo?: IdleLockUserInfo) {
  try {
    if (idleLockFn) {
      idleLockFn(userInfo)
      return
    }
  } catch {
    // fallback sotto
  }
  // Nessun handler registrato (o ha lanciato): meglio un logout esplicito
  // che lasciare l'app in uno stato "bloccato" senza overlay di sblocco.
  handleUnauthorized()
}
