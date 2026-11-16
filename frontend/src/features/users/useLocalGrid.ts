import * as React from 'react'
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid'

/** Ricerca, ordinamento e paginazione in locale: /admin-users/ e /admin-groups/ non sono paginati. */
export function useLocalGrid<T extends Record<string, unknown>>(rows: T[], searchableFields: (keyof T)[]) {
  const [q, setQ] = React.useState('')
  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({ page: 0, pageSize: 25 })
  const [sortModel, setSortModel] = React.useState<GridSortModel>([])

  React.useEffect(() => {
    setPaginationModel((p) => ({ ...p, page: 0 }))
  }, [q])

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      searchableFields.some((f) => String(r[f] ?? '').toLowerCase().includes(needle)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q])

  const sorted = React.useMemo(() => {
    const s = sortModel[0]
    if (!s?.field) return filtered
    const dir = s.sort === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      const av = a[s.field]
      const bv = b[s.field]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
    })
  }, [filtered, sortModel])

  const paged = React.useMemo(() => {
    const start = paginationModel.page * paginationModel.pageSize
    return sorted.slice(start, start + paginationModel.pageSize)
  }, [sorted, paginationModel])

  return {
    q, setQ,
    paginationModel, onPaginationModelChange: setPaginationModel,
    sortModel, onSortModelChange: setSortModel,
    rows: paged,
    rowCount: sorted.length,
  }
}
