/**
 * authBroadcast — sincronizza lock/unlock/logout tra le schede dello stesso
 * browser sulla stessa origine.
 *
 * Fix P2 (audit 2026-07, punto 9 "Sessione"): prima non esisteva alcuna
 * sincronizzazione. Bloccando/facendo logout in una scheda, le altre schede
 * aperte sulla stessa app restavano sbloccate e operative — un problema di
 * sicurezza se il logout automatico per inattività o il lock manuale erano
 * pensati per proteggere una postazione condivisa.
 *
 * Usa BroadcastChannel dove disponibile (praticamente ovunque tranne Safari
 * < 15.4), con fallback sull'evento `storage` di localStorage altrimenti.
 * Condiviso tra frontend Archie e frontend AUSL BO: ciascuna app lo istanzia
 * con un proprio channel name, quindi le due app non si influenzano a
 * vicenda anche se aperte nello stesso browser.
 */

export type AuthBroadcastMessage =
  | { type: 'lock' }
  | { type: 'unlock' }
  | { type: 'logout' }

export type AuthBroadcast = {
  post: (msg: AuthBroadcastMessage) => void
  close: () => void
}

export function createAuthBroadcast(
  channelName: string,
  onMessage: (msg: AuthBroadcastMessage) => void,
): AuthBroadcast {
  if (typeof window === 'undefined') {
    return { post: () => {}, close: () => {} }
  }

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(channelName)
    channel.onmessage = (e: MessageEvent<AuthBroadcastMessage>) => onMessage(e.data)
    return {
      post: (msg) => channel.postMessage(msg),
      close: () => channel.close(),
    }
  }

  // Fallback: storage event. Non scatta nella scheda che scrive, solo nelle
  // altre — è esattamente il comportamento che serve qui.
  const storageKey = `__${channelName}__`
  const handler = (e: StorageEvent) => {
    if (e.key !== storageKey || !e.newValue) return
    try {
      const parsed = JSON.parse(e.newValue) as AuthBroadcastMessage
      onMessage(parsed)
    } catch {
      /* payload non valido, ignora */
    }
  }
  window.addEventListener('storage', handler)
  return {
    post: (msg) => {
      // Il timestamp garantisce che scritture identiche consecutive (es.
      // due "lock" di fila) generino comunque un nuovo evento storage.
      localStorage.setItem(storageKey, JSON.stringify({ ...msg, _t: Date.now() }))
    },
    close: () => window.removeEventListener('storage', handler),
  }
}
