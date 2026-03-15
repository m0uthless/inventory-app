/**
 * useColumnPrefs
 *
 * Persiste visibilità, ordine e larghezza delle colonne del DataGrid
 * in localStorage, separatamente per ogni utente e per ogni pagina.
 *
 * Chiave: col_prefs:{username}:{pageKey}
 */

import * as React from 'react'
import type { GridColumnVisibilityModel } from '@mui/x-data-grid'

type ColPrefs = {
  visibility: GridColumnVisibilityModel
  order: string[]
  widths: Record<string, number>
}

function storageKey(username: string | undefined, pageKey: string) {
  return `col_prefs:${username ?? 'anon'}:${pageKey}`
}

function loadPrefs(username: string | undefined, pageKey: string): ColPrefs | null {
  try {
    const raw = localStorage.getItem(storageKey(username, pageKey))
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return null
    return {
      visibility: p.visibility ?? {},
      order: Array.isArray(p.order) ? p.order : [],
      widths: p.widths && typeof p.widths === 'object' ? p.widths : {},
    }
  } catch {
    return null
  }
}

function save(username: string | undefined, pageKey: string, prefs: ColPrefs) {
  try {
    localStorage.setItem(storageKey(username, pageKey), JSON.stringify(prefs))
  } catch {
    // noop
  }
}

export function applyColumnOrder<T extends { field: string }>(
  columns: T[],
  savedOrder: string[],
): T[] {
  if (!savedOrder.length) return columns
  const byField = new Map(columns.map((c) => [c.field, c]))
  const result: T[] = []
  const seen = new Set<string>()
  for (const field of savedOrder) {
    const col = byField.get(field)
    if (col) { result.push(col); seen.add(field) }
  }
  for (const col of columns) {
    if (!seen.has(col.field)) result.push(col)
  }
  return result
}

export function applyColumnWidths<T extends { field: string; width?: number }>(
  columns: T[],
  savedWidths: Record<string, number>,
): T[] {
  if (!Object.keys(savedWidths).length) return columns
  return columns.map((col) =>
    savedWidths[col.field] !== undefined ? { ...col, width: savedWidths[col.field] } : col,
  )
}

export type UseColumnPrefsReturn = {
  columnVisibilityModel: GridColumnVisibilityModel
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void
  columnOrder: string[]
  columnWidths: Record<string, number>
  saveOrder: (order: string[]) => void
  saveWidth: (field: string, width: number) => void
  hasPrefs: boolean
  resetPrefs: () => void
}

export function useColumnPrefs(
  pageKey: string,
  username: string | undefined,
): UseColumnPrefsReturn {
  const [prefs, setPrefs] = React.useState<ColPrefs>(() => {
    return loadPrefs(username, pageKey) ?? { visibility: {}, order: [], widths: {} }
  })

  React.useEffect(() => {
    setPrefs(loadPrefs(username, pageKey) ?? { visibility: {}, order: [], widths: {} })
  }, [username, pageKey])

  const hasPrefs =
    Object.keys(prefs.visibility).length > 0 ||
    prefs.order.length > 0 ||
    Object.keys(prefs.widths).length > 0

  const onColumnVisibilityModelChange = React.useCallback(
    (visibility: GridColumnVisibilityModel) => {
      const next = { ...prefs, visibility }
      setPrefs(next)
      save(username, pageKey, next)
    },
    [prefs, username, pageKey],
  )

  const saveOrder = React.useCallback(
    (order: string[]) => {
      const next = { ...prefs, order }
      setPrefs(next)
      save(username, pageKey, next)
    },
    [prefs, username, pageKey],
  )

  const saveWidth = React.useCallback(
    (field: string, width: number) => {
      const next = { ...prefs, widths: { ...prefs.widths, [field]: width } }
      setPrefs(next)
      save(username, pageKey, next)
    },
    [prefs, username, pageKey],
  )

  const resetPrefs = React.useCallback(() => {
    try { localStorage.removeItem(storageKey(username, pageKey)) } catch { /* noop */ }
    setPrefs({ visibility: {}, order: [], widths: {} })
  }, [username, pageKey])

  return {
    columnVisibilityModel: prefs.visibility,
    onColumnVisibilityModelChange,
    columnOrder: prefs.order,
    columnWidths: prefs.widths,
    saveOrder,
    saveWidth,
    hasPrefs,
    resetPrefs,
  }
}
