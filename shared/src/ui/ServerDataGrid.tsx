import * as React from 'react'
import { Box, Divider, IconButton, LinearProgress, ListItemIcon, ListItemText, MenuItem, Popover, Tooltip } from '@mui/material'
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridColumnHeaderParams,
  type GridColumnMenuProps,
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
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import FilterListIcon from '@mui/icons-material/FilterList'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useColumnPrefs, applyColumnOrder, applyColumnWidths, type UseColumnPrefsReturn } from '@shared/hooks/useColumnPrefs'
import { useColumnDragReorder } from '@shared/hooks/useColumnDragReorder'
import { isRecord } from '@shared/utils/guards'
import GridPaginationFooter from '@shared/ui/GridPaginationFooter'
import EmptyStatePanel from '@shared/ui/EmptyStatePanel'

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
  /** Callback per aprire il ColumnCustomizerPanel dall'header colonna. */
  onOpenColumnPanel?: (anchorEl: HTMLElement) => void
  /** Mappa field → configurazione filtro URL per il kebab menu. */
  filterConfig?: Record<string, ColumnFilterConfig>

}



// ─── ColumnFilterConfig ──────────────────────────────────────────────────────
// Configurazione del filtro URL per una singola colonna.
// Passata da ogni pagina tramite filterConfig in ServerDataGridProps.

export type ColumnFilterConfig = {
  /** Valore attivo del filtro (stringa, numero, o '' per nessun filtro) */
  value: string | number | ''
  /** Etichetta mostrata nel menu (es. "Filtra per stato") */
  label?: string
  /** Callback per impostare il valore del filtro */
  onSet: (value: string | number | '') => void
  /** Callback per resettare il filtro */
  onReset: () => void
  /** Contenuto del popover filtro (es. <Select>, <TextField>) — se omesso mostra solo Reset */
  children?: React.ReactNode
}

// ─── CustomColumnMenu ─────────────────────────────────────────────────────────
// Sostituisce il menu nativo di MUI con voci personalizzate:
//   • Ordina A → Z / Z → A
//   • Nascondi colonna
//   • Gestisci colonne (apre ColumnCustomizerPanel)
// Viene registrato nel DataGrid tramite slots.columnMenu — il drag nativo
// delle colonne rimane completamente intatto.

type CustomColumnMenuExtraProps = {
  onOpenColumnPanel?: (anchor: HTMLElement) => void
  filterConfig?: Record<string, ColumnFilterConfig>
  onSortModelChange: (model: import('@mui/x-data-grid').GridSortModel) => void
  sortModel: import('@mui/x-data-grid').GridSortModel
  onColumnVisibilityModelChange: (model: import('@mui/x-data-grid').GridColumnVisibilityModel) => void
  columnVisibilityModel: import('@mui/x-data-grid').GridColumnVisibilityModel
}

function CustomColumnMenu(props: GridColumnMenuProps & CustomColumnMenuExtraProps) {
  const {
    hideMenu,
    colDef,
    onOpenColumnPanel,
    onSortModelChange,
    sortModel,
    onColumnVisibilityModelChange,
    columnVisibilityModel,
    filterConfig,
    open,
    id,
    labelledby,
    ...rest
  } = props

  if (!open) return null

  const currentSort = sortModel[0]?.field === colDef.field ? sortModel[0]?.sort : null

  const handleSort = (dir: 'asc' | 'desc') => {
    hideMenu?.({} as React.MouseEvent)
    onSortModelChange([{ field: colDef.field, sort: dir }])
  }

  const handleHide = () => {
    hideMenu?.({} as React.MouseEvent)
    onColumnVisibilityModelChange({ ...columnVisibilityModel, [colDef.field]: false })
  }

  const handleOpenPanel = (e: React.MouseEvent<HTMLElement>) => {
    hideMenu?.({} as React.MouseEvent)
    onOpenColumnPanel?.(e.currentTarget)
  }

  return (
    <Box id={id} role="menu" aria-labelledby={labelledby} {...(rest as object)}>
      {colDef.sortable !== false && <>
        <MenuItem dense onClick={() => handleSort('asc')} selected={currentSort === 'asc'}
          role="menuitem">
          <ListItemIcon><ArrowUpwardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ordina A → Z</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={() => handleSort('desc')} selected={currentSort === 'desc'}
          role="menuitem">
          <ListItemIcon><ArrowDownwardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ordina Z → A</ListItemText>
        </MenuItem>
        <Divider />
      </>}
      <MenuItem dense onClick={handleHide} role="menuitem">
        <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Nascondi colonna</ListItemText>
      </MenuItem>

      {onOpenColumnPanel && <>
        <Divider />
        <MenuItem dense onClick={handleOpenPanel} role="menuitem">
          <ListItemIcon><ViewColumnIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Gestisci colonne</ListItemText>
        </MenuItem>
      </>}

    </Box>
  )
}


// ─── ColumnHeader ─────────────────────────────────────────────────────────────
// Layout unificato per ogni colonna:
//   [label + freccia sort inline]  [spazio]  [imbuto?]  [gap]  [kebab tramite menu]
//
// pointer-events: none sul testo → il drag nativo MUI funziona.
// L'imbuto appare solo se la colonna ha un filterConfig.
// La freccia sort (▲▼) appare inline accanto al label se la colonna è ordinata.

function ColumnHeader({
  params,
  fc,
  sortDir,
}: {
  params: GridColumnHeaderParams
  fc?: ColumnFilterConfig
  sortDir?: 'asc' | 'desc' | null
}) {
  const [filterAnchor, setFilterAnchor] = React.useState<HTMLElement | null>(null)
  const filterActive = Boolean(fc && fc.value !== '' && fc.value != null)

  // Numero di icone destra: imbuto (se fc) + sempre spazio per il kebab MUI
  const rightIcons = fc ? 2 : 1      // 1 = solo kebab-gap, 2 = imbuto + kebab-gap
  const rightPad = rightIcons * 20   // 20px per icona

  return (
    <>
      {/* Label + freccia sort — pointer-events: none per non bloccare il drag */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0,
        paddingRight: rightPad,
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {params.colDef.headerName ?? params.field}
        {sortDir === 'asc'  && <ArrowUpwardIcon   sx={{ fontSize: 11, flexShrink: 0, opacity: 0.7 }} />}
        {sortDir === 'desc' && <ArrowDownwardIcon sx={{ fontSize: 11, flexShrink: 0, opacity: 0.7 }} />}
      </span>

      {/* Imbuto filtro — posizionato a destra, prima del gap kebab */}
      {fc && (
        <>
          <Tooltip title={filterActive ? `${fc.label ?? 'Filtro'}: attivo` : (fc.label ?? 'Filtra')} arrow>
            <IconButton
              size="small"
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); setFilterAnchor(e.currentTarget) }}
              sx={{
                position: 'absolute',
                right: 22,        // 2px margine + 18px spazio kebab MUI
                top: '50%',
                transform: 'translateY(-50%)',
                p: 0.25,
                color: filterActive ? '#b45309' : 'text.disabled',
                fontWeight: filterActive ? 700 : 400,
                opacity: filterActive ? 1 : 0,
                zIndex: 1,
                pointerEvents: 'auto',
                '.MuiDataGrid-columnHeader:hover &': { opacity: 1 },
                '&:hover': { color: 'primary.main', opacity: '1 !important' },
              }}
              aria-label={fc.label ?? 'Filtro'}
            >
              <FilterListIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>

          <Popover
            open={Boolean(filterAnchor)}
            anchorEl={filterAnchor}
            onClose={() => setFilterAnchor(null)}
            onClick={(e) => e.stopPropagation()}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { p: 1.5, minWidth: 200, borderRadius: 1.5, boxShadow: '0 4px 16px rgba(15,23,42,0.12)', border: '1px solid', borderColor: 'divider' } }}
          >
            <Box sx={{ mb: 0.5 }}>{fc.children}</Box>
            {filterActive && (
              <Box
                onClick={() => { setFilterAnchor(null); fc.onReset() }}
                sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'text.secondary', fontSize: '0.75rem', '&:hover': { color: 'error.main' } }}
              >
                <FilterListIcon sx={{ fontSize: 12 }} />
                Reset filtro
              </Box>
            )}
          </Popover>
        </>
      )}
    </>
  )
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
    onOpenColumnPanel,
    filterConfig,
  } = props

  const persistEnabled = Boolean(pageKey)
  const colPrefs = useColumnPrefs(pageKey ?? '__none__', username)
  const gridRef = React.useRef<HTMLDivElement | null>(null)

  // Espone colPrefs verso EntityListCard tramite ref
  React.useEffect(() => {
    if (colPrefsRef) colPrefsRef.current = colPrefs
  }, [colPrefsRef, colPrefs])

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

  // Drag & drop manuale delle colonne (HTML5 API — compatibile con MUI X Community)
  useColumnDragReorder({
    gridRef,
    columns: sizedColumns,
    onReorder: colPrefs.saveOrder,
    enabled: persistEnabled,
  })

  // Inietta ColumnHeader su ogni colonna: label+freccia sort inline, imbuto se filterConfig
  const columnsWithHeader = React.useMemo(() => {
    if (!persistEnabled) return sizedColumns
    const sortField = sortModel[0]?.field
    const sortDir   = sortModel[0]?.sort ?? null
    return sizedColumns.map((col) => {
      const fc = filterConfig?.[col.field]
      const colSortDir = col.field === sortField ? sortDir : null
      return {
        ...col,
        renderHeader: col.renderHeader ?? ((params: GridColumnHeaderParams) => (
          <ColumnHeader params={params} fc={fc} sortDir={colSortDir} />
        )),
      } as typeof col
    })
  }, [sizedColumns, persistEnabled, filterConfig, sortModel])

  // Ref per tracciare l'ordine corrente senza re-render
  const currentOrderRef = React.useRef<string[]>([])
  React.useEffect(() => {
    currentOrderRef.current = columnsWithHeader.map((c) => c.field)
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
    loadingOverlay: slots?.loadingOverlay ?? LoadingOverlay,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(persistEnabled ? { columnMenu: CustomColumnMenu as any } : {}),
    ...(slots || {}),
    ...(NoRowsOverlay ? { noRowsOverlay: NoRowsOverlay } : {}),
  }

  const columnMenuSlotProps = persistEnabled ? {
    columnMenu: {
      onOpenColumnPanel,
      onSortModelChange,
      sortModel,
      onColumnVisibilityModelChange: colPrefs.onColumnVisibilityModelChange,
      columnVisibilityModel: colPrefs.columnVisibilityModel,
      filterConfig,
    } as CustomColumnMenuExtraProps,
  } : {}

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
    '& .MuiDataGrid-columnHeader.col-drag-over': {
      backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.12),
      outline: (theme: Theme) => `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
      outlineOffset: '-2px',
    },
    // Necessario per il posizionamento assoluto dell'imbuto filtro
    '& .MuiDataGrid-columnHeader': { position: 'relative' },
    // Nasconde la freccia sort nativa — la mostriamo inline nel renderHeader
    '& .MuiDataGrid-sortIcon': { display: 'none' },
    '& .MuiDataGrid-columnHeaderSortIcon': { display: 'none' },
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
      ref={gridRef}
      sx={{ height, minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 }}
      onContextMenu={onRowContextMenu ? handleGridContextMenu : undefined}
      onTouchStart={onRowContextMenu ? handleTouchStart : undefined}
      onTouchMove={onRowContextMenu ? handleTouchMove : undefined}
      onTouchEnd={onRowContextMenu ? handleTouchEnd : undefined}
      onTouchCancel={onRowContextMenu ? handleTouchEnd : undefined}
    >
      <DataGrid hideFooter
        rows={rows}
        columns={columnsWithHeader}
        loading={loading}
        density={density}
        columnHeaderHeight={32}
        rowHeight={36}
        disableRowSelectionOnClick={!checkboxSelection}
        checkboxSelection={!!checkboxSelection}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={onRowSelectionModelChange}
        slots={resolvedSlots}
        slotProps={{ ...columnMenuSlotProps, ...slotProps } as DataGridProps<R>['slotProps']}
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
