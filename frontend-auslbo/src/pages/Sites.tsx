import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import type { GridColDef } from '@mui/x-data-grid'

import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useDrfList } from '@shared/hooks/useDrfList'
import { buildDrfListParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import StatusChip from '@shared/ui/StatusChip'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { buildQuery } from '@shared/utils/nav'
import { useNavigate } from 'react-router-dom'
import AuslBoSiteDrawer from '../ui/AuslBoSiteDrawer'

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteRow = {
  id: number
  name: string
  display_name: string | null
  customer: number | null
  customer_name: string | null
  customer_display_name: string | null
  status: number | null
  status_label: string | null
  city: string | null
  postal_code: string | null
  address_line1: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  deleted_at: string | null
}

type SiteDetail = SiteRow & {
  province: string | null
  country: string | null
  notes: string | null
  custom_fields: Record<string, unknown> | null
}

type ContactMini = {
  id: number
  name: string | null
  email: string | null
  phone: string | null
  department: string | null
  is_primary: boolean
}

type InventoryMini = {
  id: number
  name: string | null
  hostname: string | null
  knumber: string | null
  type_label: string | null
  status_label: string | null
}

// ─── Columns (identical to frontend) ─────────────────────────────────────────

const cols: GridColDef<SiteRow>[] = [
  {
    field: 'display_name',
    headerName: 'Sede',
    flex: 1,
    minWidth: 280,
    valueGetter: (_v, row) => row.display_name || row.name || '—',
  },
  {
    field: 'customer_display_name',
    headerName: 'Cliente',
    width: 220,
    valueGetter: (_v, row) => row.customer_display_name || row.customer_name || '—',
  },
  { field: 'city', headerName: 'Città', width: 160 },
  { field: 'postal_code', headerName: 'CAP', width: 120 },
  {
    field: 'primary_contact_name',
    headerName: 'Contatto',
    width: 230,
    sortable: false,
    renderCell: ({ row }) => {
      const name  = row.primary_contact_name || ''
      const email = row.primary_contact_email || ''
      const phone = row.primary_contact_phone || ''
      if (!name && !email && !phone) {
        return (
          <Chip size="small"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: '0.95rem !important' }} />}
            label="Nessun contatto"
            sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#9a6700', border: '1px solid rgba(245,158,11,0.18)', fontWeight: 600, '& .MuiChip-icon': { color: '#d97706' } }}
          />
        )
      }
      const label = name || email || phone
      const tooltip = [email, phone].filter(Boolean).join(' · ')
      return tooltip ? <Tooltip title={tooltip} arrow><span>{label}</span></Tooltip> : <span>{label}</span>
    },
  },
  {
    field: 'status_label',
    headerName: 'Stato',
    width: 170,
    renderCell: (p) => (
      <StatusChip statusId={p.row.status ?? null} label={typeof p.value === 'string' ? p.value : '—'} />
    ),
  },
]

// ─── Mobile card renderer (identical to frontend) ─────────────────────────────

const renderSiteCard: MobileCardRenderFn<SiteRow> = ({ row, onOpen }) => {
  const sc = row.status != null ? ({
    1: { bg: '#E0F2FE', fg: '#0369A1', border: '#BAE6FD' },
    2: { bg: '#DCFCE7', fg: '#166534', border: '#BBF7D0' },
    3: { bg: '#FEF9C3', fg: '#854D0E', border: '#FDE68A' },
    4: { bg: '#FEE2E2', fg: '#991B1B', border: '#FECACA' },
    5: { bg: '#EDE9FE', fg: '#5B21B6', border: '#DDD6FE' },
    6: { bg: '#FFEDD5', fg: '#9A3412', border: '#FED7AA' },
  } as Record<number, { bg: string; fg: string; border: string }>)[row.status] ?? null : null

  const meta: { label: string; value: string | null | undefined }[] = [
    { label: 'Cliente',   value: row.customer_display_name || row.customer_name },
    { label: 'Città',     value: row.city },
    { label: 'Contatto',  value: row.primary_contact_name },
    { label: 'Telefono',  value: row.primary_contact_phone },
  ]

  return (
    <Box onClick={() => onOpen(row.id)} sx={{
      bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider',
      borderRadius: 1, p: 1.25, cursor: 'pointer', display: 'flex',
      flexDirection: 'column', gap: 0.75, '&:active': { bgcolor: 'action.hover' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {row.display_name || row.name}
        </Typography>
        {sc && row.status_label && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2,
            borderRadius: 20, bgcolor: sc.bg, color: sc.fg, border: `0.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
            {row.status_label}
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled',
              fontStyle: value ? 'normal' : 'italic', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Drawer sub-tabs ──────────────────────────────────────────────────────────

function ContactsTab({ siteId }: { siteId: number }) {
  const toast = useToast()
  const navigate = useNavigate()
  const params = React.useMemo(
    () => buildDrfListParams({ page0: 0, pageSize: 25, ordering: '-is_primary,name', extra: { site: siteId } }),
    [siteId],
  )
  const { rows, rowCount, loading } = useDrfList<ContactMini>('/contacts/', params, (e) => toast.error(apiErrorToMessage(e)))

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>Contatti</Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button size="small" variant="outlined" onClick={() => navigate(`/contacts${buildQuery({ site: siteId })}`)}>
          Apri lista
        </Button>
      </Stack>
      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
        </Stack>
      ) : rows.length ? (
        <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {rows.map((c, idx) => (
            <ListItem key={c.id} disablePadding divider={idx < rows.length - 1}>
              <ListItemButton onClick={() => navigate(`/contacts${buildQuery({ open: c.id, site: siteId })}`)} sx={{ py: 1 }}>
                <ListItemText
                  primary={<span>{c.name || c.email || `Contatto #${c.id}`}{c.is_primary ? '  ★' : ''}</span>}
                  secondary={[c.email, c.phone, c.department].filter(Boolean).join(' • ') || undefined}
                  primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>
      )}
    </Stack>
  )
}

function InventoriesTab({ siteId }: { siteId: number }) {
  const toast = useToast()
  const navigate = useNavigate()
  const params = React.useMemo(
    () => buildDrfListParams({ page0: 0, pageSize: 25, ordering: 'hostname', extra: { site: siteId } }),
    [siteId],
  )
  const { rows, rowCount, loading } = useDrfList<InventoryMini>('/inventories/', params, (e) => toast.error(apiErrorToMessage(e)))

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>Inventari</Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button size="small" variant="outlined" onClick={() => navigate(`/inventory${buildQuery({ site: siteId })}`)}>
          Apri lista
        </Button>
      </Stack>
      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
        </Stack>
      ) : rows.length ? (
        <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {rows.map((inv, idx) => (
            <ListItem key={inv.id} disablePadding divider={idx < rows.length - 1}>
              <ListItemButton onClick={() => navigate(`/inventory${buildQuery({ open: inv.id, site: siteId })}`)} sx={{ py: 1 }}>
                <ListItemText
                  primary={inv.hostname || inv.knumber || inv.name || `Inventario #${inv.id}`}
                  secondary={[inv.type_label, inv.status_label].filter(Boolean).join(' · ') || undefined}
                  primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>
      )}
    </Stack>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// prettier-ignore
export default function Sites() {
  const toast    = useToast()

  const grid = useServerGrid({
    defaultOrdering: 'display_name',
    allowedOrderingFields: ['display_name', 'customer_display_name', 'city', 'postal_code', 'status_label'],
    defaultPageSize: 25,
  })

  const listParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { display_name: 'name', customer_display_name: 'customer__name', status_label: 'status__label' },
      page0: grid.paginationModel.page,
      pageSize: grid.paginationModel.pageSize,
    }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize],
  )

  const { rows, rowCount, loading } = useDrfList<SiteRow>(
    '/sites/', listParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // Drawer
  const [drawerOpen, setDrawerOpen]       = React.useState(false)
  const [drawerTab, setDrawerTab]         = React.useState(0)
  const [selectedId, setSelectedId]       = React.useState<number | null>(null)
  const [detail, setDetail]               = React.useState<SiteDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const openDrawer = React.useCallback(async (id: number) => {
    setSelectedId(id)
    setDrawerOpen(true)
    setDrawerTab(0)
    setDetail(null)
    setDetailLoading(true)
    grid.setOpenId(id)
    try {
      const res = await api.get<SiteDetail>(`/sites/${id}/`)
      setDetail(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }, [grid, toast])

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    setSelectedId(null)
    setDetail(null)
    grid.setOpenId(null)
  }, [grid])

  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    void openDrawer(id)
  }, [grid.openId, openDrawer])

  const columns = React.useMemo(() => cols, [])

  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) return { title: 'Nessuna sede', subtitle: 'Non ci sono sedi associate al tuo ente.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.search])

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        mobileCard={renderSiteCard}
        toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ }}
        grid={{
          pageKey: 'auslbo-sites',
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

      <AuslBoSiteDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        detail={detail}
        selectedId={selectedId}
        detailLoading={detailLoading}
        drawerTab={drawerTab}
        onTabChange={setDrawerTab}
        contactsTabContent={detail ? <ContactsTab siteId={detail.id} /> : null}
        inventoriesTabContent={detail ? <InventoriesTab siteId={detail.id} /> : null}
      />

    </Stack>
  )
}

// Needed for useDrfList type inference
type _ApiPage<T> = ApiPage<T>
void (null as unknown as _ApiPage<never>)
