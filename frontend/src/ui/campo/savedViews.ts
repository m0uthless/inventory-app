import * as React from 'react'
import { api } from '@shared/api/client'

export type SavedView<S> = { id: string; name: string; state: S }

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback } catch { return fallback }
}
const readRaw = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* archiviazione non disponibile */ } }
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Viste salvate dall'utente per una pagina, sul server (`/api/saved-views/`): si ritrovano su ogni
 * dispositivo. Il browser ne tiene una copia per mostrarle subito; al primo avvio le viste che
 * c'erano solo nel browser vengono caricate sul server, poi conta solo il server.
 */
export function useSavedViews<S>(pageKey: string, username?: string) {
  const localKey = `archie-views:${username ?? 'anon'}:${pageKey}`
  const syncedKey = `archie-views-synced:${username ?? 'anon'}:${pageKey}`
  const [views, setViews] = React.useState<SavedView<S>[]>(() => read<SavedView<S>[]>(localKey, []))
  const viewsRef = React.useRef(views)

  const commit = React.useCallback((next: SavedView<S>[]) => {
    viewsRef.current = next
    setViews(next)
    write(localKey, JSON.stringify(next))
  }, [localKey])

  React.useEffect(() => {
    const local = read<SavedView<S>[]>(localKey, [])
    viewsRef.current = local
    setViews(local)
    if (!username) return
    let alive = true
    api.get<(SavedView<S> & { page: string })[]>('/saved-views/', { params: { page: pageKey } })
      .then(async (r) => {
        const server = r.data.map(({ id, name, state }) => ({ id, name, state }))
        let merged = server
        if (readRaw(syncedKey) !== '1') {
          const onServer = new Set(server.map((v) => v.id))
          const onlyLocal = local.filter((v) => !onServer.has(v.id))
          const uploaded: SavedView<S>[] = []
          for (const v of onlyLocal) {
            try { await api.post('/saved-views/', { id: v.id, page: pageKey, name: v.name, state: v.state }); uploaded.push(v) } catch { /* riprova al prossimo avvio */ }
          }
          merged = [...server, ...uploaded]
          if (uploaded.length === onlyLocal.length) write(syncedKey, '1')
        }
        if (alive) commit(merged)
      })
      .catch(() => { /* server non raggiungibile: restano quelle del browser */ })
    return () => { alive = false }
  }, [localKey, syncedKey, pageKey, username, commit])

  return {
    views,
    add: (name: string, state: S) => {
      const v: SavedView<S> = { id: newId(), name, state }
      commit([...viewsRef.current, v])
      if (username) void api.post('/saved-views/', { id: v.id, page: pageKey, name, state }).catch(() => { /* resta nel browser */ })
      return v
    },
    remove: (id: string) => {
      commit(viewsRef.current.filter((v) => v.id !== id))
      if (username) void api.delete(`/saved-views/${id}/`, { params: { page: pageKey } }).catch(() => { /* già tolta */ })
    },
  }
}
