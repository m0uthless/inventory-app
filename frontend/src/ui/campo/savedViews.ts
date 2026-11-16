import * as React from 'react'

export type SavedView<S> = { id: string; name: string; state: S }

/** Viste salvate dall'utente (per pagina e utente, nel browser). */
export function useSavedViews<S>(pageKey: string, username?: string) {
  const key = `archie-views:${username ?? 'anon'}:${pageKey}`
  const [views, setViews] = React.useState<SavedView<S>[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') as SavedView<S>[] } catch { return [] }
  })
  const persist = (next: SavedView<S>[]) => {
    setViews(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* archiviazione non disponibile */ }
  }
  return {
    views,
    add: (name: string, state: S) => { const v = { id: Date.now().toString(36), name, state }; persist([...views, v]); return v },
    remove: (id: string) => persist(views.filter((v) => v.id !== id)),
  }
}
