import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid'

export type ListViewMode = 'active' | 'all' | 'deleted'

type SyncUrlOptions = {
  /** Replace history entry (default: true) */
  replace?: boolean
  /** Keep the `open` param (default: true). If false, clears it. */
  keepOpen?: boolean
}

type UseServerGridArgs = {
  /** Default ordering when URL param is missing or invalid */
  defaultOrdering: string
  /** Allowed fields for ordering (without '-') */
  allowedOrderingFields: readonly string[]
  /** Maps grid column field names to backend ordering field names when they differ */
  columnOrderingMap?: Record<string, string>
  /** Default page size (default: 25) */
  defaultPageSize?: number
  /** Debounce in ms for search (default: 350) */
  debounceMs?: number
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

type UrlValue = string | number | boolean | null | undefined

function setOrDelete(sp: URLSearchParams, key: string, value: UrlValue) {
  if (value === '' || value === null || value === undefined) {
    sp.delete(key)
    return
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    sp.delete(key)
    return
  }
  sp.set(key, String(value))
}

function parseIntSafe(raw: string | null, fallback: number) {
  const n = parseInt(raw || '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function sanitizeOrdering(orderingRaw: string | null, args: UseServerGridArgs) {
  const def = args.defaultOrdering
  const allowed = new Set(args.allowedOrderingFields)
  const raw = (orderingRaw || def).toString() || def
  const desc = raw.startsWith('-')
  const field = desc ? raw.slice(1) : raw
  const safeField = allowed.has(field) ? field : def.replace(/^-/g, '')
  return desc ? `-${safeField}` : safeField
}

function orderingToSortModel(ordering: string, args: UseServerGridArgs): GridSortModel {
  const safe = sanitizeOrdering(ordering, args)
  const desc = safe.startsWith('-')
  const backendField = desc ? safe.slice(1) : safe
  // Reverse-map backend field name to grid column field name
  const reverseMap = args.columnOrderingMap
    ? Object.fromEntries(Object.entries(args.columnOrderingMap).map(([k, v]) => [v, k]))
    : {}
  const gridField = reverseMap[backendField] ?? backendField
  return [{ field: gridField, sort: desc ? 'desc' : 'asc' }]
}

function sortModelToOrdering(model: GridSortModel, args: UseServerGridArgs) {
  const m = model?.[0]
  if (!m?.field || !m?.sort) return args.defaultOrdering
  const allowed = new Set(args.allowedOrderingFields)
  // Map grid field name to backend ordering field if a mapping exists
  const backendField = args.columnOrderingMap?.[m.field] ?? m.field
  const safeField = allowed.has(backendField) ? backendField : args.defaultOrdering.replace(/^-/g, '')
  return m.sort === 'desc' ? `-${safeField}` : safeField
}

/**
 * Shared state for server-side DataGrid pages.
 *
 * Responsibilities:
 * - URL param source of truth for page/page_size/ordering/view/search
 * - debounced search input (updates URL)
 * - helper to keep/clear `open` param
 */
export function useServerGrid(args: UseServerGridArgs) {
  const [sp, setSp] = useSearchParams()

  const defaultPageSize = args.defaultPageSize ?? 25
  const debounceMs = args.debounceMs ?? 350

  // --- URL derived state ---
  // Canonical query param is `search`.
  const urlSearch = sp.get('search') ?? ''
  const pageParam = Math.max(1, parseIntSafe(sp.get('page'), 1))
  const pageSizeParam = Math.max(10, parseIntSafe(sp.get('page_size'), defaultPageSize))

  const viewRaw = (sp.get('view') || '').toLowerCase()
  const includeDeleted0 = TRUTHY.has((sp.get('include_deleted') || '').toLowerCase())
  const onlyDeleted0 = TRUTHY.has((sp.get('only_deleted') || '').toLowerCase())

  const view: ListViewMode =
    viewRaw === 'deleted' || viewRaw === 'all' || viewRaw === 'active'
      ? (viewRaw as ListViewMode)
      : onlyDeleted0
        ? 'deleted'
        : includeDeleted0
          ? 'all'
          : 'active'
  const includeDeleted = view !== 'active'
  const onlyDeleted = view === 'deleted'

  const effectiveDefaultOrdering = React.useMemo(() => {
    // In "Cestino" view, default to newest deleted first (if supported).
    if (view === 'deleted' && args.allowedOrderingFields.includes('deleted_at'))
      return '-deleted_at'
    return args.defaultOrdering
  }, [view, args.defaultOrdering, args.allowedOrderingFields])

  const ordering = React.useMemo(() => {
    const def = effectiveDefaultOrdering
    const allowed = new Set(args.allowedOrderingFields)
    const raw = (sp.get('ordering') || def).toString() || def
    const desc = raw.startsWith('-')
    const field = desc ? raw.slice(1) : raw
    const safeField = allowed.has(field) ? field : def.replace(/^-/, '')
    return desc ? `-${safeField}` : safeField
  }, [sp, args.allowedOrderingFields, effectiveDefaultOrdering])
  const sortModel = React.useMemo(() => orderingToSortModel(ordering, args), [ordering, args])

  const paginationModel: GridPaginationModel = React.useMemo(
    () => ({ page: pageParam - 1, pageSize: pageSizeParam }),
    [pageParam, pageSizeParam],
  )

  // --- URL helpers ---
  const syncUrl = React.useCallback(
    (patch: Record<string, UrlValue>, opts?: SyncUrlOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev)
          // Normalize legacy keys:
          // - `include_deleted`/`only_deleted` => `view`
          for (const [k, v] of Object.entries(patch)) setOrDelete(next, k, v)

          if ('search' in patch) next.delete('q')
          if ('view' in patch) {
            // keep URL clean
            if (patch.view === 'active') next.delete('view')
            next.delete('include_deleted')
            next.delete('only_deleted')
          }
          if (opts?.keepOpen === false) next.delete('open')
          return next
        },
        { replace: opts?.replace ?? true },
      )
    },
    [setSp],
  )

  // --- search input (debounced into URL) ---
  const [qState, setQState] = React.useState(urlSearch)
  const qRef = React.useRef(qState)
  const setQ = React.useCallback((value: string) => {
    qRef.current = value
    setQState(value)
  }, [])

  const searchDebounceRef = React.useRef<number | null>(null)
  const skipNextSearchEffectRef = React.useRef(false)

  React.useEffect(() => {
    // keep input in sync with URL (back/forward / external filter changes)
    if (qRef.current === urlSearch) return
    qRef.current = urlSearch
    skipNextSearchEffectRef.current = true
    setQState(urlSearch)
  }, [urlSearch])

  const didMountSearchRef = React.useRef(false)
  React.useEffect(() => {
    if (!didMountSearchRef.current) {
      didMountSearchRef.current = true
      return
    }

    // Ignore state writes caused by URL sync. Without this, pagination / sort
    // updates can re-trigger the debounced search commit and force page=1.
    if (skipNextSearchEffectRef.current) {
      skipNextSearchEffectRef.current = false
      return
    }

    // Do not reschedule a search write when the input already matches the URL.
    // This prevents page resets triggered by mount/StrictMode or unrelated URL changes.
    if (qState === urlSearch) return

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }

    searchDebounceRef.current = window.setTimeout(() => {
      searchDebounceRef.current = null
      // Search change closes the detail drawer by default
      syncUrl({ search: qRef.current, page: 1 }, { keepOpen: false })
    }, debounceMs)

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [qState, urlSearch, debounceMs, syncUrl])

  const setViewMode = React.useCallback(
    (nextView: ListViewMode, opts?: SyncUrlOptions) => {
      syncUrl(
        {
          view: nextView,
          page: 1,
        },
        { keepOpen: opts?.keepOpen ?? true, replace: opts?.replace },
      )
    },
    [syncUrl],
  )

  const onPaginationModelChange = React.useCallback(
    (m: GridPaginationModel) => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }

      const nextPage = Math.max(0, Number(m.page) || 0)
      const nextPageSize = Math.max(1, Number(m.pageSize) || defaultPageSize)

      // Ignore duplicate/internal grid sync events.
      if (nextPage === paginationModel.page && nextPageSize === paginationModel.pageSize) return

      syncUrl(
        { page: nextPage + 1, page_size: nextPageSize },
        { keepOpen: true, replace: false },
      )
    },
    [syncUrl, paginationModel.page, paginationModel.pageSize, defaultPageSize],
  )

  const onSortModelChange = React.useCallback(
    (model: GridSortModel) => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
      const ord = sortModelToOrdering(model, args)
      if (ord === ordering) return
      syncUrl({ ordering: ord, page: 1 }, { keepOpen: true, replace: false })
    },
    [syncUrl, args, ordering],
  )

  const reset = React.useCallback(
    (extraClearKeys: string[] = []) => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
      const patch: Record<string, UrlValue> = {
        search: '',
        page: 1,
        page_size: defaultPageSize,
        ordering: args.defaultOrdering,
        view: '',
        include_deleted: '', // legacy
        only_deleted: '', // legacy
        open: '',
      }
      for (const k of extraClearKeys) patch[k] = ''
      syncUrl(patch, { keepOpen: false })
    },
    [syncUrl, defaultPageSize, args.defaultOrdering],
  )

  const openId = React.useMemo(() => {
    const raw = sp.get('open')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, [sp])

  const setOpenId = React.useCallback(
    (id: number | null, opts?: { replace?: boolean }) => {
      syncUrl({ open: id ?? '' }, { keepOpen: true, replace: opts?.replace ?? true })
    },
    [syncUrl],
  )

  const commitSearchNow = React.useCallback(
    (opts?: SyncUrlOptions) => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
      syncUrl(
        { search: qRef.current, page: 1 },
        { keepOpen: opts?.keepOpen ?? true, replace: opts?.replace },
      )
    },
    [syncUrl],
  )

  return {
    sp,
    syncUrl,
    // search
    q: qState,
    setQ,
    search: urlSearch,
    commitSearchNow,
    // view
    view,
    setViewMode,
    includeDeleted,
    onlyDeleted,
    // sorting
    ordering,
    sortModel,
    onSortModelChange,
    // pagination
    paginationModel,
    onPaginationModelChange,
    // drawer open
    openId,
    setOpenId,
    // reset
    reset,
  } as const
}
