import * as React from 'react'
import { Box, LinearProgress } from '@mui/material'
import { ActionIconButton } from './ActionIconButton'
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  type DataGridProps,
  type GridColDef,
  type GridColumnOrderChangeParams,
  type GridColumnResizeParams,
  type GridColumnVisibilityModel,
  type GridPaginationModel,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridValidRowModel,
  type GridRowId,
} from '@mui/x-data-grid'
import type { ReactNode } from 'react'
import { alpha, type SxProps, type Theme } from '@mui/material/styles'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useColumnPrefs, applyColumnOrder, applyColumnWidths, type UseColumnPrefsReturn } from '../hooks/useColumnPrefs'
import { isRecord } from '../utils/guards'
import GridPaginationFooter from './GridPaginationFooter'
import EmptyStatePanel from './EmptyStatePanel'

export type GridEmptyState = {
  title: string
  subtitle?: string
  action?: ReactNode
}

type Props<R extends GridValidRowModel> = {
  rows: R[]
  columns: GridColDef<R>[]
  loading?: boolean
  rowCount: number
  paginationModel: GridPaginationModel
  onPaginationModelChange: (model: GridPaginationModel) => void
  sortModel: GridSortModel
  onSortModelChange: (model: GridSortModel) => void
  onRowClick?: (id: number) => void
  onRowContextMenu?: (row: R, event: React.MouseEvent<HTMLElement>) => void
  height?: number | string
  pageSizeOptions?: number[]
  deletedField?: keyof R | string
  getRowId?: DataGridProps<R>['getRowId']
  sx?: SxProps<Theme>
  showGridToolbar?: boolean
  slots?: DataGridProps<R>['slots']
  slotProps?: DataGridProps<R>['slotProps']
  density?: DataGridProps<R>['density']
  zebra?: boolean
  checkboxSelection?: boolean
  rowSelectionModel?: GridRowSelectionModel
  onRowSelectionModelChange?: (model: GridRowSelectionModel) => void
  columnVisibilityModel?: GridColumnVisibilityModel
  emptyState?: GridEmptyState
  pageKey?: string
  username?: string
  footerLabel?: string
  /**
   * Ref che riceve l'istanza di useColumnPrefs, usato da EntityListCard
   * per gestire il pannello colonne nella toolbar esterna.
   */
  colPrefsRef?: React.MutableRefObject<UseColumnPrefsReturn | null>
}

export type ServerDataGridProps<R extends GridValidRowModel> = Props<R>

export default function ServerDataGrid<R extends GridValidRowModel>(props: Props<R>) {
  const {
    rows,
    columns,
    loading,
    rowCount,
    paginationModel,
    onPaginationModelChange,
    sortModel,
    onSortModelChange,
    onRowClick,
    onRowContextMenu,
    height = '100%',
    deletedField = 'deleted_at',
    getRowId,
    sx,
    showGridToolbar = true,
    slots,
    slotProps,
    density,
    zebra = false,
    checkboxSelection,
    rowSelectionModel,
    onRowSelectionModelChange,
    columnVisibilityModel: externalVisibility,
    emptyState,
    pageKey,
    username,
    footerLabel,
    colPrefsRef,
  } = props

  const persistEnabled = Boolean(pageKey)
  const colPrefs = useColumnPrefs(pageKey ?? '__none__', username)

  // Espone colPrefs verso EntityListCard tramite ref
  React.useEffect(() => {
    if (colPrefsRef) colPrefsRef.current = colPrefs
  })

  // Merge: preferenze utente + override esterno (es. cestino forzato)
  const mergedVisibility: GridColumnVisibilityModel = {
    ...colPrefs.columnVisibilityModel,
    ...externalVisibility,
  }

  // Applica ordine e larghezze salvati
  const orderedColumns = persistEnabled ? applyColumnOrder(columns, colPrefs.columnOrder) : columns
  const sizedColumns = persistEnabled
    ? applyColumnWidths(orderedColumns, colPrefs.columnWidths ?? {})
    : orderedColumns

  // Ref per tracciare l'ordine corrente senza re-render
  const currentOrderRef = React.useRef<string[]>([])
  React.useEffect(() => {
    currentOrderRef.current = sizedColumns.map((c) => c.field)
  })

  const handleColumnOrderChange = React.useCallback(
    (params: GridColumnOrderChangeParams) => {
      if (!persistEnabled) return
      const next = [...currentOrderRef.current]
      const from = next.indexOf(params.column.field)
      if (from === -1) return
      next.splice(from, 1)
      next.splice(params.targetIndex, 0, params.column.field)
      colPrefs.saveOrder(next)
    },
    [persistEnabled, colPrefs],
  )

  const handleColumnWidthChange = React.useCallback(
    (params: GridColumnResizeParams) => {
      if (!persistEnabled) return
      colPrefs.saveWidth(params.colDef.field, params.width)
    },
    [persistEnabled, colPrefs],
  )

  // Toolbar interna (solo filtri, densità, export — "Colonne" è in EntityListCard)
  const CustomToolbar = React.useCallback(
    function ToolbarImpl() {
      return (
        <GridToolbarContainer sx={{ gap: 0.5, px: 1, py: 0.5 }}>
          <GridToolbarFilterButton />
          <GridToolbarDensitySelector />
          <GridToolbarExport />
          {persistEnabled && colPrefs.hasPrefs && (
            <ActionIconButton
              label="Ripristina layout colonne predefinito"
              icon={<RestartAltIcon fontSize="small" />}
              size="small"
              onClick={colPrefs.resetPrefs}
              sx={{ ml: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            />
          )}
        </GridToolbarContainer>
      )
    },
    [persistEnabled, colPrefs.hasPrefs, colPrefs.resetPrefs],
  )

  const LoadingOverlay = () => (
    <Box sx={{ width: '100%', position: 'absolute', top: 0, left: 0 }}>
      <LinearProgress />
    </Box>
  )

  const NoRowsOverlay = emptyState
    ? () => (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <EmptyStatePanel
            title={emptyState.title}
            subtitle={emptyState.subtitle}
            action={emptyState.action}
            compact
          />
        </Box>
      )
    : undefined

  const inferredFooterLabel = React.useMemo(() => {
    if (footerLabel?.trim()) return footerLabel.trim()

    const labels: Record<string, string> = {
      customers: 'Clienti',
      sites: 'Siti',
      contacts: 'Contatti',
      inventories: 'Inventari',
      inventory: 'Inventari',
      issues: 'Issue',
      audit: 'Eventi',
      trash: 'Elementi',
    }

    return pageKey ? labels[pageKey] || 'Risultati' : 'Risultati'
  }, [footerLabel, pageKey])

  const resolvedSlots: DataGridProps<R>['slots'] = {
    toolbar: showGridToolbar ? CustomToolbar : undefined,
    loadingOverlay: slots?.loadingOverlay ?? LoadingOverlay,
    ...(slots || {}),
    ...(NoRowsOverlay ? { noRowsOverlay: NoRowsOverlay } : {}),
  }

  const baseSx: SxProps<Theme> = {
    '& .MuiTablePagination-selectLabel': { display: 'none' },
    '& .MuiTablePagination-select': { display: 'none' },
    '& .MuiTablePagination-input': { display: 'none' },
    '& .MuiTablePagination-spacer': { display: 'none' },
    height: '100%',
    border: 'none',
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: 'rgba(15,23,42,0.022)',
      borderBottom: '1px solid rgba(15,23,42,0.08)',
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    '& .MuiDataGrid-cell': {
      display: 'flex',
      alignItems: 'center',
      py: 0.25,
    },
    '& .MuiDataGrid-main': { display: 'flex', flexDirection: 'column', minHeight: 0 },
    '& .MuiDataGrid-virtualScroller': { flex: 1, minHeight: 0 },
    '& .MuiDataGrid-virtualScrollerContent': { pb: 0.75 },
    '& .MuiDataGrid-footerContainer': {
      mt: 'auto',
      minHeight: 56,
      px: 1,
      borderTop: '1px solid',
      borderColor: 'divider',
      backgroundColor: 'rgba(15,23,42,0.012)',
    },
    '& .row-deleted': { opacity: 0.55 },
    '& .row-deleted .MuiDataGrid-cell': { textDecoration: 'line-through' },
    // Rimuove outline/bordo sulla cella quando la riga viene cliccata
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
      outline: 'none !important',
    },
    '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
      outline: 'none !important',
    },
    ...(zebra
      ? {
          '& .row-odd': {
            backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.03),
          },
        }
      : {}),
    '& .MuiDataGrid-row:hover': {
      backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.06),
    },
  }

  const mergedSx: SxProps<Theme> = sx
    ? Array.isArray(sx)
      ? [baseSx, ...sx]
      : [baseSx, sx]
    : baseSx

  const rowMap = React.useMemo(() => {
    const map = new Map<string, R>()
    const resolveRowId = (row: R): GridRowId => {
      if (getRowId) return getRowId(row)
      return (row as { id?: GridRowId }).id as GridRowId
    }
    for (const row of rows) {
      const rowId = resolveRowId(row)
      if (rowId !== undefined && rowId !== null) map.set(String(rowId), row)
    }
    return map
  }, [rows, getRowId])

  const touchTimerRef = React.useRef<number | null>(null)
  const suppressNextRowClickRef = React.useRef(false)
  const touchStartRef = React.useRef<{ x: number; y: number; rowId: string } | null>(null)
  const LONG_PRESS_MS = 450
  const MOVE_TOLERANCE_PX = 10

  const clearTouchTimer = React.useCallback(() => {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  const resolveRowFromTarget = React.useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null
      const rowEl = target.closest('[role="row"][data-id]') as HTMLElement | null
      const rowId = rowEl?.getAttribute('data-id')
      if (!rowId) return null
      const row = rowMap.get(rowId)
      if (!row) return null
      return { row, rowId }
    },
    [rowMap],
  )

  const handleGridContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onRowContextMenu) return
      event.preventDefault()
      event.stopPropagation()
      const resolved = resolveRowFromTarget(event.target)
      if (!resolved) return
      onRowContextMenu(resolved.row, event as React.MouseEvent<HTMLElement>)
    },
    [onRowContextMenu, resolveRowFromTarget],
  )

  const handleTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!onRowContextMenu) return
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      const resolved = resolveRowFromTarget(event.target)
      if (!resolved) return

      suppressNextRowClickRef.current = false
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, rowId: resolved.rowId }
      clearTouchTimer()
      touchTimerRef.current = window.setTimeout(() => {
        const current = touchStartRef.current
        if (!current) return
        const row = rowMap.get(current.rowId)
        if (!row) return
        suppressNextRowClickRef.current = true
        window.setTimeout(() => {
          suppressNextRowClickRef.current = false
        }, 700)
        onRowContextMenu(
          row,
          { clientX: current.x, clientY: current.y } as unknown as React.MouseEvent<HTMLElement>,
        )
      }, LONG_PRESS_MS)
    },
    [onRowContextMenu, resolveRowFromTarget, clearTouchTimer, rowMap],
  )

  const handleTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current
      if (!start || event.touches.length !== 1) return
      const touch = event.touches[0]
      const movedX = Math.abs(touch.clientX - start.x)
      const movedY = Math.abs(touch.clientY - start.y)
      if (movedX > MOVE_TOLERANCE_PX || movedY > MOVE_TOLERANCE_PX) {
        clearTouchTimer()
        touchStartRef.current = null
      }
    },
    [clearTouchTimer],
  )

  const handleTouchEnd = React.useCallback(() => {
    clearTouchTimer()
    touchStartRef.current = null
  }, [clearTouchTimer])

  React.useEffect(() => () => clearTouchTimer(), [clearTouchTimer])

  return (
    <Box
      sx={{ height, minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 }}
      onContextMenu={onRowContextMenu ? handleGridContextMenu : undefined}
      onTouchStart={onRowContextMenu ? handleTouchStart : undefined}
      onTouchMove={onRowContextMenu ? handleTouchMove : undefined}
      onTouchEnd={onRowContextMenu ? handleTouchEnd : undefined}
      onTouchCancel={onRowContextMenu ? handleTouchEnd : undefined}
    >
      <DataGrid hideFooter
        rows={rows}
        columns={sizedColumns}
        loading={loading}
        density={density}
        columnHeaderHeight={44}
        disableColumnMenu
        disableRowSelectionOnClick={!checkboxSelection}
        checkboxSelection={!!checkboxSelection}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={onRowSelectionModelChange}
        slots={resolvedSlots}
        slotProps={slotProps}
        rowCount={rowCount}
        paginationMode="server"
        paginationModel={paginationModel}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={[25]}
        columnVisibilityModel={mergedVisibility}
        onColumnVisibilityModelChange={
          persistEnabled ? colPrefs.onColumnVisibilityModelChange : undefined
        }
        onColumnOrderChange={persistEnabled ? handleColumnOrderChange : undefined}
        onColumnWidthChange={persistEnabled ? handleColumnWidthChange : undefined}
        getRowId={getRowId}
        getRowClassName={(p) => {
          const cls: string[] = []
          const rowU = p.row as unknown
          if (isRecord(rowU)) {
            const delVal = rowU[String(deletedField)]
            if (delVal) cls.push('row-deleted')
          }
          if (zebra) cls.push(p.indexRelativeToCurrentPage % 2 === 0 ? 'row-even' : 'row-odd')
          return cls.join(' ')
        }}
        sx={mergedSx}
        onRowClick={(params) => {
          if (suppressNextRowClickRef.current) {
            suppressNextRowClickRef.current = false
            return
          }
          if (!onRowClick) return
          const n = Number(params.id)
          if (!Number.isNaN(n)) onRowClick(n)
        }}
      />
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <GridPaginationFooter
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          label={inferredFooterLabel}
        />
      </Box>
    </Box>
  )
}
