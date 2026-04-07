/**
 * MobileCardList
 *
 * Sostituisce il DataGrid in mobile (xs/sm) con una lista di card verticali.
 * Ogni riga viene renderizzata tramite la funzione `renderCard` fornita dalla pagina.
 */

import * as React from 'react'
import { Box, Chip, CircularProgress, Popover, Skeleton, Stack, Typography } from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import type { GridPaginationModel, GridValidRowModel } from '@mui/x-data-grid'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'

export type MobileCardRenderFn<R> = (params: {
  row: R
  onOpen: (id: number) => void
  onContextMenu: (row: R, e: React.MouseEvent<HTMLElement>) => void
}) => React.ReactNode

type Props<R extends GridValidRowModel> = {
  rows: R[]
  rowCount: number
  loading?: boolean
  paginationModel: GridPaginationModel
  onPaginationModelChange: (model: GridPaginationModel) => void
  renderCard: MobileCardRenderFn<R>
  onRowClick?: (id: number) => void
  onRowContextMenu?: (row: R, event: React.MouseEvent<HTMLElement>) => void
  getRowId?: (row: R) => number | string
  emptyTitle?: string
  emptySubtitle?: string
  /** Stessa filterConfig usata dal DataGrid — mostra chip filtro sopra le card */
  filterConfig?: Record<string, ColumnFilterConfig>
}

// ─── FilterChipBar ─────────────────────────────────────────────────────────
export function FilterChipBar({ filterConfig }: { filterConfig: Record<string, ColumnFilterConfig> }) {
  const [anchor, setAnchor] = React.useState<{ el: HTMLElement; field: string } | null>(null)
  const entries = Object.entries(filterConfig)
  if (!entries.length) return null

  const open = Boolean(anchor)
  const activeField = anchor?.field
  const activeConfig = activeField ? filterConfig[activeField] : null

  return (
    <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5, flexShrink: 0 }}>
      {entries.map(([field, fc]) => {
        const active = fc.value !== '' && fc.value != null
        return (
          <Chip
            key={field}
            size="small"
            icon={<FilterListIcon sx={{ fontSize: '13px !important' }} />}
            label={active ? (fc.label?.replace('Filtra per ', '') ?? field) : (fc.label?.replace('Filtra per ', '') ?? field)}
            onClick={(e) => setAnchor({ el: e.currentTarget, field })}
            onDelete={active ? () => fc.onReset() : undefined}
            sx={{
              fontSize: '0.72rem',
              height: 30,
              flexShrink: 0,
              bgcolor: active ? 'rgba(15,118,110,0.10)' : 'background.paper',
              color: active ? '#065f46' : 'text.secondary',
              border: '0.5px solid',
              borderColor: active ? 'rgba(15,118,110,0.35)' : 'divider',
              fontWeight: active ? 600 : 400,
              '& .MuiChip-icon': { color: active ? '#0f766e' : 'text.disabled' },
              '& .MuiChip-deleteIcon': { color: active ? '#0f766e' : 'text.disabled', fontSize: 14 },
            }}
          />
        )
      })}

      <Popover
        open={open}
        anchorEl={anchor?.el}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 1.5, minWidth: 220, borderRadius: 1.5, boxShadow: '0 4px 16px rgba(15,23,42,0.12)', border: '0.5px solid', borderColor: 'divider' } }}
      >
        {activeConfig && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.75 }}>
              {activeConfig.label}
            </Typography>
            <Box>{activeConfig.children}</Box>
            {(activeConfig.value !== '' && activeConfig.value != null) && (
              <Box
                onClick={() => { setAnchor(null); activeConfig.onReset() }}
                sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'text.secondary', fontSize: '0.75rem', '&:hover': { color: 'error.main' } }}
              >
                <FilterListIcon sx={{ fontSize: 12 }} />
                Reset filtro
              </Box>
            )}
          </>
        )}
      </Popover>
    </Box>
  )
}

// ─── MobileCardList ─────────────────────────────────────────────────────────
export default function MobileCardList<R extends GridValidRowModel>({
  rows,
  rowCount,
  loading,
  paginationModel,
  onPaginationModelChange,
  renderCard,
  onRowClick,
  onRowContextMenu,
  getRowId,
  emptyTitle = 'Nessun elemento',
  emptySubtitle = 'Nessun risultato trovato.',
}: Props<R>) {
  const { page, pageSize } = paginationModel
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize))
  const from = page * pageSize + 1
  const to   = Math.min((page + 1) * pageSize, rowCount)

  const goPage = (next: number) =>
    onPaginationModelChange({ page: next, pageSize })

  // Skeleton cards during loading
  if (loading && !rows.length) {
    return (
      <Stack spacing={0}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={112} sx={{ borderRadius: 0.75 }} />
        ))}
      </Stack>
    )
  }

  // Empty state
  if (!loading && !rows.length) {
    return (
      <Stack spacing={0}>
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
            {emptyTitle}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {emptySubtitle}
          </Typography>
        </Box>
      </Stack>
    )
  }

  return (
    <Stack spacing={0}>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={18} />
        </Box>
      )}

      <Stack spacing={0.75}>
      {rows.map((row) => {
        const id = getRowId ? getRowId(row) : (row as unknown as { id: number }).id
        return (
          <Box key={id}>
            {renderCard({
              row,
              onOpen: (rowId) => onRowClick?.(rowId),
              onContextMenu: (r, e) => onRowContextMenu?.(r, e),
            })}
          </Box>
        )
      })}
      </Stack>

      {rowCount > pageSize && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5, pb: 0.5 }}>
          <Box
            component="button"
            onClick={() => goPage(page - 1)}
            disabled={page === 0}
            sx={{ fontSize: '0.75rem', fontWeight: 500, color: page === 0 ? 'text.disabled' : 'primary.main', border: '0.5px solid', borderColor: page === 0 ? 'divider' : 'primary.main', borderRadius: 1, px: 1.25, py: 0.5, bgcolor: 'transparent', cursor: page === 0 ? 'default' : 'pointer' }}
          >← Prec</Box>
          <Typography variant="caption" color="text.disabled">
            {rowCount > 0 ? `${from}–${to} di ${rowCount}` : '—'}
          </Typography>
          <Box
            component="button"
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages - 1}
            sx={{ fontSize: '0.75rem', fontWeight: 500, color: page >= totalPages - 1 ? 'text.disabled' : 'primary.main', border: '0.5px solid', borderColor: page >= totalPages - 1 ? 'divider' : 'primary.main', borderRadius: 1, px: 1.25, py: 0.5, bgcolor: 'transparent', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}
          >Succ →</Box>
        </Box>
      )}
    </Stack>
  )
}
