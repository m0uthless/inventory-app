import type { GridRowId, GridRowSelectionModel } from '@mui/x-data-grid'

import { isRecord } from './guards'

/**
 * MUI X DataGrid selection model shape changed across major versions.
 * This helper provides a tiny compatibility layer.
 */

export function emptySelectionModel(): GridRowSelectionModel {
  // v8 uses an object { type, ids: Set<GridRowId> }
  return { type: 'include', ids: new Set<GridRowId>() } as unknown as GridRowSelectionModel
}

type SelectionV8 = {
  type?: 'include' | 'exclude'
  ids: Set<GridRowId>
}

function isSelectionV8(v: unknown): v is SelectionV8 {
  if (!isRecord(v)) return false
  const ids = v['ids']
  return ids instanceof Set
}

export function selectionToIds(model: GridRowSelectionModel): GridRowId[] {
  const m = model as unknown

  // Newer versions: { type: "include" | "exclude", ids: Set<GridRowId> }
  if (isSelectionV8(m)) {
    if (m.type && m.type !== 'include') return []
    return Array.from(m.ids.values())
  }

  // Older versions: GridRowId[]
  if (Array.isArray(m)) return m as GridRowId[]

  return []
}

export function selectionSize(model: GridRowSelectionModel): number {
  const m = model as unknown

  if (isSelectionV8(m)) {
    if (m.type && m.type !== 'include') return 0
    return m.ids.size || 0
  }

  if (Array.isArray(m)) return m.length

  return 0
}

export function selectionToNumberIds(model: GridRowSelectionModel): number[] {
  return selectionToIds(model)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n))
}
