import * as React from 'react'
import {
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material'

import type { GridColDef } from '@mui/x-data-grid'

import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useDrfList } from '@shared/hooks/useDrfList'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import { getInventoryTypeIcon } from '@shared/ui/inventoryTypeIcon'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'

import AuslBoInventoryDrawer from '../ui/AuslBoInventoryDrawer'

// ─── Types ───────────────────────────────────────────────────────────────────

type InventoryRow = {
  id: number
  name: string
  hostname: string | null
  knumber: string | null
  serial_number: string | null
  local_ip: string | null
  srsa_ip: string | null
  customer_name: string | null
  site_name: string | null
  site_display_name: string | null
  status_label: string | null
  status_key: string | null
  type_label: string | null
  type_key: string | null
  deleted_at: string | null
}

// ─── Status colours (identical to frontend) ──────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  in_use:      { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', border: 'rgba(16,185,129,0.28)' },
  maintenance: { bg: 'rgba(245,158,11,0.10)',  fg: '#92400e', border: 'rgba(245,158,11,0.28)' },
  repair:      { bg: 'rgba(239,68,68,0.10)',   fg: '#991b1b', border: 'rgba(239,68,68,0.28)'  },
  spare:       { bg: 'rgba(99,102,241,0.10)',  fg: '#3730a3', border: 'rgba(99,102,241,0.28)' },
  retired:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
  storage:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
}

// ─── Columns (aligned to frontend) ───────────────────────────────────────────

const cols: GridColDef<InventoryRow>[] = [
  {
    field: 'type_label',
    headerName: 'Tipo',
    width: 180,
    renderCell: (p) => {
      const label = p.value == null ? '—' : String(p.value)
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, height: '100%' }}>
          {label && label !== '—' ? (
            <Chip
              size="small"
              label={label}
              sx={{
                height: 22, fontSize: '0.72rem', fontWeight: 600,
                bgcolor: 'rgba(26,107,181,0.08)', color: 'text.primary',
                border: '1px solid rgba(26,107,181,0.18)',
                '& .MuiChip-label': { px: 0.75 }, maxWidth: '100%',
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
          )}
        </Box>
      )
    },
  },
  { field: 'name', headerName: 'Nome', width: 200 },
  { field: 'hostname', headerName: 'Hostname', flex: 1, minWidth: 180 },
  { field: 'knumber', headerName: 'K#', width: 140 },
  {
    field: 'site_display_name',
    headerName: 'Sede',
    width: 180,
    valueGetter: (_v, row) => row.site_display_name || row.site_name || '—',
  },
  {
    field: 'status_label',
    headerName: 'Stato',
    width: 140,
    renderCell: (p) => {
      const label = p.value as string | null
      const key   = p.row?.status_key ?? ''
      if (!label) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
      const c = STATUS_COLOR[key] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip size="small" label={label}
            sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600,
              bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`,
              '& .MuiChip-label': { px: 0.75 } }} />
        </Box>
      )
    },
  },
  { field: 'local_ip', headerName: 'IP locale', width: 160 },
]

// ─── Mobile card renderer (aligned to frontend) ───────────────────────────────

const renderInventoryCard: MobileCardRenderFn<InventoryRow> = ({ row, onOpen }) => {
  const TypeIcon = getInventoryTypeIcon(row.type_key)
  const sc = STATUS_COLOR[row.status_key ?? ''] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }

  const meta: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: 'Sede',     value: row.site_display_name || row.site_name },
    { label: 'IP',       value: row.local_ip, mono: true },
    { label: 'K-Number', value: row.knumber },
    { label: 'IP SRSA',  value: row.srsa_ip, mono: true },
  ]

  return (
    <Box onClick={() => onOpen(row.id)} sx={{
      bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider',
      borderRadius: 1, p: 1.25, cursor: 'pointer', display: 'flex',
      flexDirection: 'column', gap: 0.75, '&:active': { bgcolor: 'action.hover' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </Typography>
          {row.type_label && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <TypeIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">{row.type_label}</Typography>
            </Box>
          )}
        </Box>
        {row.status_label && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2,
            borderRadius: 20, bgcolor: sc.bg, color: sc.fg, border: `0.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
            {row.status_label}
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value, mono }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled',
              fontStyle: value ? 'normal' : 'italic', fontFamily: mono && value ? 'monospace' : 'inherit', lineHeight: 1.3 }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
      {(row.site_display_name || row.site_name) && (
        <Box sx={{ borderTop: '0.5px solid', borderColor: 'divider', pt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.5, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{row.site_display_name || row.site_name}</Typography>
        </Box>
      )}
    </Box>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// prettier-ignore
export default function Inventory() {
  const toast = useToast()

  const grid = useServerGrid({
    defaultOrdering: 'hostname',
    allowedOrderingFields: ['hostname', 'knumber', 'type_label', 'status_label', 'local_ip', 'site_display_name'],
    defaultPageSize: 25,
  })

  const listParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { type_label: 'type__label', status_label: 'status__label', site_display_name: 'site__name' },
      page0: grid.paginationModel.page,
      pageSize: grid.paginationModel.pageSize,
    }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize],
  )

  const { rows, rowCount, loading } = useDrfList<InventoryRow>(
    '/inventories/', listParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // Drawer
  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  const openDrawer = React.useCallback((id: number) => {
    setSelectedId(id)
    grid.setOpenId(id)
  }, [grid])

  const closeDrawer = React.useCallback(() => {
    setSelectedId(null)
    grid.setOpenId(null)
  }, [grid])

  // open from URL ?open=ID
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
  }, [grid.openId])

  const columns = React.useMemo(() => cols, [])

  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) return { title: 'Nessuna apparecchiatura', subtitle: 'Non ci sono apparecchiature associate al tuo ente.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.search])

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        mobileCard={renderInventoryCard}
        toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ }}
        grid={{
          pageKey: 'auslbo-inventory',
          emptyState,
          rows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          sx: {
            '--DataGrid-rowHeight': '36px',
            '--DataGrid-headerHeight': '35px',
            '& .MuiDataGrid-cell': { py: 0.25 },
            '& .MuiDataGrid-columnHeader': { py: 0.75 },
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(26,107,181,0.02)' },
            '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(26,107,181,0.06)' },
            '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(26,107,181,0.10) !important' },
            '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(26,107,181,0.14) !important' },
          },
        }}
      />

      <AuslBoInventoryDrawer id={selectedId} onClose={closeDrawer} />
    </Stack>
  )
}
