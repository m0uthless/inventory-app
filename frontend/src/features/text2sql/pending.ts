/**
 * Domande al generatore SQL in attesa di risposta: finché ce n'è una, la campanella
 * controlla le notifiche ogni 15 secondi invece che ogni 5 minuti.
 *
 * Il segnale sta nel browser (per utente e dispositivo, è solo una comodità): la pagina
 * lo scrive, la campanella lo legge e toglie le domande la cui notifica è arrivata. Scade
 * comunque dopo 20 minuti, nel caso una risposta non arrivi mai.
 */
const KEY = 't2s_pending'
const LEGACY_KEY = 't2s_pending_until'
const PENDING_MS = 20 * 60 * 1000

type Stored = { ids: number[]; until: number }

function read(): Stored {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && typeof v === 'object' && Array.isArray((v as Stored).ids) && typeof (v as Stored).until === 'number') {
      const s = v as Stored
      return s.until > Date.now() ? { ids: s.ids.filter((x) => Number.isInteger(x)), until: s.until } : { ids: [], until: 0 }
    }
  } catch { /* valore rovinato o storage non disponibile */ }
  return { ids: [], until: 0 }
}

export const pendingIds = (): number[] => read().ids
export const hasPending = (): boolean => read().ids.length > 0

/** Sostituisce l'elenco (la pagina lo riallinea a ogni caricamento). */
export function setPendingIds(ids: number[]): void {
  const unique = [...new Set(ids)]
  try {
    localStorage.removeItem(LEGACY_KEY)
    if (unique.length) localStorage.setItem(KEY, JSON.stringify({ ids: unique, until: Date.now() + PENDING_MS }))
    else localStorage.removeItem(KEY)
  } catch { /* solo in memoria: la campanella resta al ritmo normale */ }
}

export const addPending = (id: number) => setPendingIds([...pendingIds(), id])
export const dropPending = (id: number) => { const ids = pendingIds(); if (ids.includes(id)) setPendingIds(ids.filter((x) => x !== id)) }

const APRI_RE = /[?&]apri=(\d+)(?:&|$)/

/** Toglie le domande la cui notifica «Query SQL pronta / non riuscita» è arrivata. */
export function settlePending(notifications: { notification_type: string; link: string }[]): void {
  const ids = pendingIds()
  if (!ids.length) return
  const answered = new Set(
    notifications.filter((n) => n.notification_type === 'text2sql_ready').map((n) => Number(APRI_RE.exec(n.link)?.[1])),
  )
  const left = ids.filter((id) => !answered.has(id))
  if (left.length !== ids.length) setPendingIds(left)
}
