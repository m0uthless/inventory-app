import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { Can } from '../auth/Can'
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import { useAuth } from '../auth/AuthProvider'
import { api } from '@shared/api/client'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useCustomerKpis } from '../hooks/useCustomerKpis'
import type { SelectChangeEvent } from '@mui/material/Select'
import { useToast } from '@shared/ui/toast'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { buildQuery } from '@shared/utils/nav'
import { emptySelectionModel, selectionSize, selectionToNumberIds } from '@shared/utils/gridSelection'
import { isRecord } from '@shared/utils/guards'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import ConfirmActionDialog from '@shared/ui/ConfirmActionDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import StatusChip from '@shared/ui/StatusChip'
import AuditEventsTab from '../ui/AuditEventsTab'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import VpnModal from '../features/customers/VpnModal'
import CustomerDialog from '../features/customers/CustomerDialog'
import CustomerDrawer from '../features/customers/CustomerDrawer'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'

type LookupItem = { id: number; label: string; key?: string }

type CustomerRow = {
  id: number
  code: string
  name: string
  display_name: string

  // Convenience/computed fields from API
  city?: string | null
  primary_contact_id?: number | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  vat_number?: string | null
  tax_code?: string | null

  status?: number | null
  status_label?: string | null

  notes?: string | null
  has_vpn?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

type CustomerDetail = CustomerRow & {
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
  deleted_at?: string | null
}

type CustomerForm = {
  status: number | ''
  name: string
  display_name: string
  vat_number: string
  tax_code: string
  custom_fields: Record<string, unknown>
  notes: string
}

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

type SiteMini = {
  id: number
  name?: string | null
  display_name?: string | null
  city?: string | null
  status?: number | null
  status_label?: string | null
  deleted_at?: string | null
}

type InventoryMini = {
  id: number
  customer: number
  site?: number | null
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  site_name?: string | null
  site_display_name?: string | null
  type_label?: string | null
  status_label?: string | null
  deleted_at?: string | null
}

function viewQuery(includeDeleted: boolean, onlyDeleted: boolean) {
  if (onlyDeleted) return { view: 'deleted' }
  if (includeDeleted) return { view: 'all' }
  return {}
}

function CustomerSitesTab(props: {
  customerId: number
  includeDeleted: boolean
  onlyDeleted: boolean
  onCount?: (n: number) => void
}) {
  const { customerId, includeDeleted, onlyDeleted, onCount } = props
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: 'name',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId },
      }),
    [customerId, includeDeleted, onlyDeleted],
  )

  const { rows, rowCount, loading } = useDrfList<SiteMini>('/sites/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  React.useEffect(() => {
    onCount?.(rowCount)
  }, [rowCount, onCount])

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Siti
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button
          size="small"
          variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() =>
            navigate(
              `/sites${buildQuery({ customer: customerId, ...viewQuery(includeDeleted, onlyDeleted), return: loc.pathname + ((() => { const sp = new URLSearchParams(loc.search); sp.delete('open'); const s = sp.toString(); return s ? '?' + s : '' })()) })}`,
            )
          }
        >
          Apri lista
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento…
          </Typography>
        </Stack>
      ) : rows.length ? (
        <List
          dense
          disablePadding
          sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
          {rows.map((s, idx) => {
            const label = s.display_name || s.name || `Sito #${s.id}`
            const q = {
              open: s.id,
              customer: customerId,
              ...(s.deleted_at ? { view: 'all' } : viewQuery(includeDeleted, onlyDeleted)),
            }
            return (
              <ListItem
                key={s.id}
                disablePadding
                sx={{ bgcolor: idx % 2 === 1 ? 'rgba(15,118,110,0.03)' : 'transparent' }}
              >
                <ListItemButton
                  onClick={() => navigate(`/sites${buildQuery({ ...q, return: loc.pathname + ((() => { const sp = new URLSearchParams(loc.search); sp.delete('open'); const s = sp.toString(); return s ? '?' + s : '' })()) })}`)}
                  sx={{
                    py: 0.75,
                    opacity: s.deleted_at ? 0.55 : 1,
                    textDecoration: s.deleted_at ? 'line-through' : 'none',
                  }}
                >
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                      noWrap: true,
                      variant: 'body2',
                      sx: { fontWeight: 600 },
                    }}
                  />
                  {s.deleted_at ? (
                    <Chip size="small" color="error" label="Eliminato" sx={{ ml: 1 }} />
                  ) : null}
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          —
        </Typography>
      )}
    </Stack>
  )
}

function CustomerInventoriesTab(props: {
  customerId: number
  includeDeleted: boolean
  onlyDeleted: boolean
  onCount?: (n: number) => void
}) {
  const { customerId, includeDeleted, onlyDeleted, onCount } = props
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: 'hostname',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId },
      }),
    [customerId, includeDeleted, onlyDeleted],
  )

  const { rows, rowCount, loading } = useDrfList<InventoryMini>(
    '/inventories/',
    params,
    (e: unknown) => toast.error(apiErrorToMessage(e)),
  )

  React.useEffect(() => {
    onCount?.(rowCount)
  }, [rowCount, onCount])

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Inventari
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button
          size="small"
          variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() =>
            navigate(
              `/inventory${buildQuery({ customer: customerId, ...viewQuery(includeDeleted, onlyDeleted), return: loc.pathname + ((() => { const sp = new URLSearchParams(loc.search); sp.delete('open'); const s = sp.toString(); return s ? '?' + s : '' })()) })}`,
            )
          }
        >
          Apri lista
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento…
          </Typography>
        </Stack>
      ) : rows.length ? (
        <List
          dense
          disablePadding
          sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
          {rows.map((inv, idx) => {
            const name = inv.hostname || inv.knumber || inv.serial_number || `#${inv.id}`
            const label = [inv.type_label, name].filter(Boolean).join(' · ')
            const q = {
              open: inv.id,
              customer: customerId,
              site: inv.site ?? '',
              ...(inv.deleted_at ? { view: 'all' } : viewQuery(includeDeleted, onlyDeleted)),
            }
            return (
              <ListItem
                key={inv.id}
                disablePadding
                sx={{ bgcolor: idx % 2 === 1 ? 'rgba(15,118,110,0.03)' : 'transparent' }}
              >
                <ListItemButton
                  onClick={() => navigate(`/inventory${buildQuery({ ...q, return: loc.pathname + ((() => { const sp = new URLSearchParams(loc.search); sp.delete('open'); const s = sp.toString(); return s ? '?' + s : '' })()) })}`)}
                  sx={{
                    py: 0.75,
                    opacity: inv.deleted_at ? 0.55 : 1,
                    textDecoration: inv.deleted_at ? 'line-through' : 'none',
                  }}
                >
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                      noWrap: true,
                      variant: 'body2',
                      sx: { fontWeight: 600 },
                    }}
                  />
                  {inv.deleted_at ? (
                    <Chip size="small" color="error" label="Eliminato" sx={{ ml: 1 }} />
                  ) : null}
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          —
        </Typography>
      )}
    </Stack>
  )
}

// ─── CustomerDriveTab ─────────────────────────────────────────────────────────

type DriveMini = {
  id: number
  name: string
  mime_type?: string
  size_human?: string
  updated_at: string
  kind: 'file' | 'folder'
}

function CustomerDriveTab({ customerId }: { customerId: number }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [items, setItems] = React.useState<DriveMini[]>([])
  const [loading, setLoading] = React.useState(false)
  const [total, setTotal] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const coerce = (v: unknown, kind: DriveMini['kind']): DriveMini | null => {
      if (!isRecord(v)) return null
      const id = Number(v['id'])
      if (!Number.isFinite(id)) return null
      const name = typeof v['name'] === 'string' ? v['name'] : `#${id}`
      const updated_at = typeof v['updated_at'] === 'string' ? v['updated_at'] : ''
      const mime_type = typeof v['mime_type'] === 'string' ? v['mime_type'] : undefined
      const size_human = typeof v['size_human'] === 'string' ? v['size_human'] : undefined
      return { id, name, updated_at, mime_type, size_human, kind }
    }

    Promise.allSettled([
      api.get('/drive-folders/', {
        params: { customer: customerId, page_size: 15, ordering: 'name' },
      }),
      api.get('/drive-files/', {
        params: { customer: customerId, page_size: 15, ordering: 'name' },
      }),
    ])
      .then(([fSettled, fiSettled]) => {
        if (cancelled) return

        const foldersU: unknown =
          fSettled.status === 'fulfilled' ? (fSettled.value as { data: unknown }).data : null
        const filesU: unknown =
          fiSettled.status === 'fulfilled' ? (fiSettled.value as { data: unknown }).data : null

        const folderList: unknown[] =
          isRecord(foldersU) && Array.isArray(foldersU['results'])
            ? (foldersU['results'] as unknown[])
            : Array.isArray(foldersU)
              ? foldersU
              : []
        const fileList: unknown[] =
          isRecord(filesU) && Array.isArray(filesU['results'])
            ? (filesU['results'] as unknown[])
            : Array.isArray(filesU)
              ? filesU
              : []

        const folders: DriveMini[] = folderList
          .map((f: unknown) => coerce(f, 'folder'))
          .filter((x): x is DriveMini => Boolean(x))
        const files: DriveMini[] = fileList
          .map((f: unknown) => coerce(f, 'file'))
          .filter((x): x is DriveMini => Boolean(x))

        const folderCount = isRecord(foldersU) ? Number(foldersU['count'] ?? 0) : 0
        const fileCount = isRecord(filesU) ? Number(filesU['count'] ?? 0) : 0

        setItems([...folders, ...files])
        setTotal(folderCount + fileCount)

        // Se almeno una delle due chiamate è fallita, mostra un toast
        const errors = [fSettled, fiSettled].filter((r) => r.status === 'rejected')
        if (errors.length) {
          const first = (errors[0] as PromiseRejectedResult).reason
          toast.error(apiErrorToMessage(first))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId, toast])

  function fileEmoji(mime?: string) {
    if (!mime) return '📁'
    if (mime.startsWith('image/')) return '🖼️'
    if (mime === 'application/pdf') return '📄'
    return '📝'
  }

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            File Drive
          </Typography>
          <Chip size="small" label={total} />
        </Stack>
        <Button
          size="small"
          variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() => navigate('/drive')}
        >
          Apri Drive
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Caricamento…
          </Typography>
        </Stack>
      ) : items.length ? (
        <List
          dense
          disablePadding
          sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
          {items.map((item, idx) => (
            <ListItem
              key={`${item.kind}-${item.id}`}
              disablePadding
              sx={{ bgcolor: idx % 2 === 1 ? 'rgba(15,118,110,0.03)' : 'transparent' }}
            >
              <ListItemText
                sx={{ px: 1.5, py: 0.75 }}
                primary={
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <span style={{ fontSize: 14 }}>
                      {item.kind === 'folder' ? '📁' : fileEmoji(item.mime_type)}
                    </span>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, flex: 1 }}>
                      {item.name}
                    </Typography>
                    {item.size_human && (
                      <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                        {item.size_human}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
          {total > items.length && (
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate('/drive')}
                sx={{ py: 0.75, justifyContent: 'center' }}
              >
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  + altri {total - items.length} elementi
                </Typography>
              </ListItemButton>
            </ListItem>
          )}
        </List>
      ) : (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Nessun file collegato.
        </Typography>
      )}
    </Stack>
  )
}

function buildColumns(onVpnClick: (row: CustomerRow) => void): GridColDef<CustomerRow>[] {
  return [
  {
    field: 'display_name',
    headerName: 'Cliente',
    flex: 1,
    minWidth: 260,
    renderCell: (p) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.value as string}
        </span>
        {p.row.has_vpn && (
          <Box
            component="span"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onVpnClick(p.row)
            }}
            sx={{
              flexShrink: 0,
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              px: 0.6,
              py: 0.15,
              borderRadius: 0.75,
              bgcolor: 'success.50',
              color: 'success.800',
              border: '0.5px solid',
              borderColor: 'success.200',
              lineHeight: 1.6,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'success.100' },
            }}
          >
            VPN
          </Box>
        )}
      </Box>
    ),
  },
  {
    field: 'status_label',
    headerName: 'Stato',
    width: 170,
    renderCell: (p) => (
      <StatusChip
        statusId={p.row.status ?? null}
        label={typeof p.value === 'string' ? p.value : '—'}
      />
    ),
  },
  { field: 'city', headerName: 'Città', width: 170 },
  {
    field: 'primary_contact_name',
    headerName: 'Contatto primario',
    width: 230,
    renderCell: (p) => {
      const r = p.row
      const name = r.primary_contact_name || ''
      const email = r.primary_contact_email || ''
      const phone = r.primary_contact_phone || ''
      const tooltip = [email, phone].filter(Boolean).join(' · ')

      if (!name && !email && !phone) {
        return (
          <Chip
            size="small"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: '0.95rem !important' }} />}
            label="Nessun contatto"
            sx={{
              bgcolor: 'rgba(245, 158, 11, 0.12)',
              color: '#9a6700',
              border: '1px solid rgba(245, 158, 11, 0.18)',
              fontWeight: 600,
              '& .MuiChip-icon': { color: '#d97706' },
            }}
          />
        )
      }

      const label = name || email || phone
      return tooltip ? (
        <Tooltip title={tooltip} arrow>
          <span>{label}</span>
        </Tooltip>
      ) : (
        <span>{label}</span>
      )
    },
  },
  { field: 'vat_number', headerName: 'P.IVA', width: 160 },
  { field: 'tax_code', headerName: 'Codice fiscale', width: 170 },
  // { field: "updated_at", headerName: "Aggiornato", width: 180 },
  ]
}


// ─── Mobile card renderer ────────────────────────────────────────────────────

const renderCustomerCard: MobileCardRenderFn<CustomerRow> = ({ row, onOpen }) => {
  const sc = row.status != null ? ({
    1: { bg: '#E0F2FE', fg: '#0369A1', border: '#BAE6FD' },
    2: { bg: '#DCFCE7', fg: '#166534', border: '#BBF7D0' },
    3: { bg: '#FEF9C3', fg: '#854D0E', border: '#FDE68A' },
    4: { bg: '#FEE2E2', fg: '#991B1B', border: '#FECACA' },
    5: { bg: '#EDE9FE', fg: '#5B21B6', border: '#DDD6FE' },
    6: { bg: '#FFEDD5', fg: '#9A3412', border: '#FED7AA' },
  } as Record<number, { bg: string; fg: string; border: string }>)[row.status] ?? null : null

  const meta: { label: string; value: string | null | undefined }[] = [
    { label: 'Contatto',  value: row.primary_contact_name },
    { label: 'Telefono',  value: row.primary_contact_phone },
    { label: 'Email',     value: row.primary_contact_email },
    { label: '',          value: null },
  ]

  return (
    <Box
      onClick={() => onOpen(row.id)}
      sx={{
        bgcolor: 'background.paper',
        border: '0.5px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.25,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        '&:active': { bgcolor: 'action.hover' },
      }}
    >
      {/* Header: nome + badge stato */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {row.display_name || row.name}
        </Typography>
        {sc && row.status_label && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20, bgcolor: sc.bg, color: sc.fg, border: `0.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
            {row.status_label}
          </Box>
        )}
      </Box>

      {/* Grid 2×2 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {label && <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>}
            {label && (
              <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value || '—'}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Footer: VPN (solo se presente) */}
      {row.has_vpn && (
        <Box sx={{ borderTop: '0.5px solid', borderColor: 'divider', pt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.5, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">VPN</Typography>
        </Box>
      )}
    </Box>
  )
}


// prettier-ignore
export default function Customers() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const canChange = hasPerm(PERMS.crm.customer.change)
  const canDelete = hasPerm(PERMS.crm.customer.delete)

  const grid = useServerGrid({
    defaultOrdering: 'display_name',
    allowedOrderingFields: [
      'display_name',
      'status_label',
      'city',
      'primary_contact_name',
      'vat_number',
      'tax_code',
    ],
    defaultPageSize: 25,
  })

  const [selectionModel, setSelectionModel] =
    React.useState<GridRowSelectionModel>(emptySelectionModel())
  const [bulkRestoreDlgOpen, setBulkRestoreDlgOpen] = React.useState(false)
  const selectedIds = React.useMemo(() => selectionToNumberIds(selectionModel), [selectionModel])
  const selectedCount = React.useMemo(() => selectionSize(selectionModel), [selectionModel])

  React.useEffect(() => {
    setSelectionModel(emptySelectionModel())
  }, [grid.view])

  const emptyState = React.useMemo(() => {
    if (grid.view === 'deleted' && !grid.search.trim()) {
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono clienti eliminati.' }
    }
    if (!grid.search.trim()) {
      return {
        title: 'Nessun cliente',
        subtitle: 'Crea un nuovo cliente o cambia i filtri.',
        action: (
          <Can perm={PERMS.crm.customer.add}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}
            >
              Crea cliente
            </Button>
          </Can>
        ),
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
  }, [grid.view, grid.search, loc.pathname, loc.search, navigate])

  const [statusId, setStatusId] = useUrlNumberParam('status')
  const [city, setCity] = useUrlStringParam('city')
  const [statuses, setStatuses] = React.useState<LookupItem[]>([])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { display_name: 'name', status_label: 'status__label' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(statusId !== '' ? { status: statusId } : {}),
          ...(city.trim() ? { city: city.trim() } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
      statusId,
      city,
    ],
  )

  const {
    rows,
    rowCount,
    loading,
    reload: reloadList,
  } = useDrfList<CustomerRow>('/customers/', listParams, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [drawerTab, setDrawerTab] = React.useState(0)
  const {
    sitesCount,
    invCount,
    driveCount,
    reset: resetKpis,
  } = useCustomerKpis(detail?.id ?? null)

  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // CRUD dialog
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [form, setForm] = React.useState<CustomerForm>({
    status: '',
    name: '',
    display_name: '',
    vat_number: '',
    tax_code: '',
    custom_fields: {},
    notes: '',
  })
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  const address = React.useMemo(() => {
    const cf = detail?.custom_fields ?? null
    if (!isRecord(cf)) return null
    const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === 'indirizzo')
    if (!key) return null
    const v = cf[key]
    if (typeof v !== 'string' || !v.trim()) return null
    // Append city to improve Nominatim geocoding accuracy
    const parts = [v.trim(), detail?.city?.trim()].filter(Boolean)
    return parts.join(', ')
  }, [detail])

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted
        const incParams = includeDeletedParams(inc)
        const res = await api.get<CustomerDetail>(
          `/customers/${id}/`,
          incParams ? { params: incParams } : undefined,
        )
        setDetail(res.data)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setDetailLoading(false)
      }
    },
    [toast, grid.includeDeleted],
  )

  const loadStatuses = React.useCallback(async () => {
    try {
      const res = await api.get('/customer-statuses/')
      const data = res.data

      // supporta sia array che paginato { results: [...] }
      const items = Array.isArray(data) ? data : (data.results ?? [])
      setStatuses(items)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  React.useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  // list loading is handled by useDrfList

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    setDrawerTab(0)
    loadDetail(id)
  }, [grid.openId, loadDetail])

  const openDrawer = React.useCallback(
    (id: number) => {
      setSelectedId(id)
      setDrawerOpen(true)
      setDrawerTab(0)
      resetKpis()
      loadDetail(id)
      grid.setOpenId(id)
    },
    [grid, loadDetail, resetKpis],
  )

  // Azioni riga / menu contestuale
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{
    row: CustomerRow
    mouseX: number
    mouseY: number
  } | null>(null)

  // VPN modal
  const [vpnModalOpen, setVpnModalOpen] = React.useState(false)
  const [vpnModalRow, setVpnModalRow] = React.useState<CustomerRow | null>(null)

  const openVpnModal = React.useCallback((row: CustomerRow) => {
    setVpnModalRow(row)
    setVpnModalOpen(true)
  }, [])

  const openEditFromRow = React.useCallback(
    (id: number) => {
      pendingEditIdRef.current = id
      openDrawer(id)
    },
    [openDrawer],
  )

  const openDeleteFromRow = React.useCallback(
    (id: number) => {
      pendingDeleteIdRef.current = id
      openDrawer(id)
    },
    [openDrawer],
  )

  const restoreFromRow = React.useCallback(
    async (id: number) => {
      setRestoreBusy(true)
      try {
        await api.post(`/customers/${id}/restore/`)
        toast.success('Cliente ripristinato ✅')
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setRestoreBusy(false)
      }
    },
    [toast, reloadList],
  )

  // Quando il detail viene caricato a seguito di un click su un'azione di riga,
  // apre il dialog di modifica o eliminazione appropriato.
  React.useEffect(() => {
    if (!detail) return

    if (pendingEditIdRef.current === detail.id) {
      pendingEditIdRef.current = null
      openEditRef.current?.()
    }

    if (pendingDeleteIdRef.current === detail.id) {
      pendingDeleteIdRef.current = null
      setDeleteDlgOpen(true)
    }
  }, [detail])

  const handleRowContextMenu = React.useCallback(
    (row: CustomerRow, event: React.MouseEvent<HTMLElement>) => {
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    },
    [],
  )

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null)
  }, [])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []

    if (row.deleted_at) {
      return [
        {
          key: 'open',
          label: 'Apri',
          icon: <VisibilityOutlinedIcon fontSize="small" />,
          onClick: () => openDrawer(row.id),
        },
        {
          key: 'restore',
          label: 'Ripristina',
          icon: <RestoreFromTrashIcon fontSize="small" />,
          onClick: () => void restoreFromRow(row.id),
          disabled: restoreBusy,
        },
      ]
    }

    return [
      {
        key: 'open',
        label: 'Apri',
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => openDrawer(row.id),
      },
      {
        key: 'edit',
        label: 'Modifica',
        icon: <EditIcon fontSize="small" />,
        onClick: () => openEditFromRow(row.id),
      },
      {
        key: 'vpn',
        label: row.has_vpn ? 'VPN' : 'VPN',
        icon: <LanOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />,
        onClick: () => openVpnModal(row),
        badge: row.has_vpn ? 'configurata' : 'non configurata',
        badgeTone: row.has_vpn ? 'success' : 'neutral',
      },
      {
        key: 'delete',
        label: 'Elimina',
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: () => openDeleteFromRow(row.id),
        disabled: deleteBusy,
        tone: 'danger',
      },
    ]
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, openVpnModal, restoreBusy, restoreFromRow])

  const columns = React.useMemo<GridColDef<CustomerRow>[]>(() => {
    return buildColumns(openVpnModal)
  }, [openVpnModal])

  // Configurazione filtri URL per il kebab menu delle colonne
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    status_label: {
      value: statusId,
      label: 'Filtra per stato',
      onSet: (v) => setStatusId(v as number | '', { patch: { search: grid.q, page: 1 }, keepOpen: true }),
      onReset: () => setStatusId('', { patch: { search: grid.q, page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
          <InputLabel>Stato</InputLabel>
          <Select
            label="Stato"
            value={statusId === '' ? '' : String(statusId)}
            onChange={(e: SelectChangeEvent) => {
              const v = asId(e.target.value)
              setStatusId(v, { patch: { search: grid.q, page: 1 }, keepOpen: true })
            }}
          >
            <MenuItem value="">Tutti</MenuItem>
            {statuses.map((s) => (
              <MenuItem key={s.id} value={String(s.id)}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    },
    city: {
      value: city,
      label: 'Filtra per città',
      onSet: (v) => setCity(String(v), { patch: { search: grid.q, page: 1 }, keepOpen: true }),
      onReset: () => setCity('', { patch: { search: grid.q, page: 1 }, keepOpen: true }),
      children: (
        <TextField
          size="small"
          label="Città"
          value={city}
          onChange={(e) => setCity(e.target.value, { patch: { search: grid.q, page: 1 }, keepOpen: true })}
          fullWidth
          sx={{ mt: 0.5 }}
        />
      ),
    },
  }), [statusId, city, setStatusId, setCity, statuses, grid.q])

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => {
    return new URLSearchParams(loc.search).get('return')
  }, [loc.search])

  const closeDrawer = () => {
    setDrawerOpen(false)
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }


  const openCreateOnceRef = React.useRef(false)

  const openCreate = React.useCallback(() => {
    setDlgMode('create')
    setDlgId(null)
    setForm({
      status: '',
      name: '',
      display_name: '',
      vat_number: '',
      tax_code: '',
      custom_fields: {},
      notes: '',
    })
    setDlgOpen(true)
    setFieldErrors({})
  }, [])

  React.useEffect(() => {
    const stU = loc.state as unknown
    if (!isRecord(stU) || stU['openCreate'] !== true) {
      openCreateOnceRef.current = false
      return
    }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc.pathname, loc.search, loc.state, navigate, openCreate])

  const openEdit = React.useCallback(() => {
    if (!detail) return
    setDlgMode('edit')
    setDlgId(detail.id)
    setForm({
      status: detail.status ?? '',
      name: detail.name ?? '',
      display_name: detail.display_name ?? '',
      vat_number: detail.vat_number ?? '',
      tax_code: detail.tax_code ?? '',
      custom_fields: detail.custom_fields ?? {},
      notes: detail.notes ?? '',
    })
    setDlgOpen(true)
    setFieldErrors({})
  }, [detail])

  openEditRef.current = openEdit

  const save = async () => {
    // Validazione client-side: popola fieldErrors invece del toast generico
    // così i campi si colorano di rosso esattamente come fanno gli errori backend.
    const clientErrors: Record<string, string> = {}
    if (form.status === '') clientErrors.status = 'Seleziona uno stato.'
    if (!String(form.name).trim()) clientErrors.name = 'Il nome è obbligatorio.'
    if (Object.keys(clientErrors).length) {
      setFieldErrors(clientErrors)
      return
    }

    const payload: Record<string, unknown> = {
      status: Number(form.status),
      name: form.name.trim(),
      display_name: (form.display_name || '').trim() || form.name.trim(),
      vat_number: (form.vat_number || '').trim() || null,
      tax_code: (form.tax_code || '').trim() || null,
      custom_fields:
        form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: (form.notes || '').trim() || null,
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<CustomerDetail>('/customers/', payload)
        id = res.data.id
        toast.success('Cliente creato ✅')
      } else {
        if (!dlgId) return
        const res = await api.patch<CustomerDetail>(`/customers/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Cliente aggiornato ✅')
      }

      setDlgOpen(false)
      reloadList()
      openDrawer(id)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) {
        setFieldErrors(feedback.fieldErrors)
      }
      toast.error(feedback.message)
    } finally {
      setDlgSaving(false)
    }
  }
  const doDelete = async () => {
    if (!detail) return
    setDeleteBusy(true)
    try {
      await api.delete(`/customers/${detail.id}/`)
      toast.success('Cliente eliminato ✅')

      // per poterlo vedere subito nel drawer dopo il delete:
      grid.setViewMode('all', { keepOpen: true })
      await loadDetail(detail.id, true)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
      setDeleteDlgOpen(false)
    }
  }

  const doBulkRestore = async (): Promise<boolean> => {
    const ids = selectedIds.filter((n) => Number.isFinite(n))
    if (!ids.length) return false
    setRestoreBusy(true)
    try {
      await api.post(`/customers/bulk_restore/`, { ids })
      toast.success(`Ripristinati ${ids.length} elementi ✅`)
      setSelectionModel(emptySelectionModel())
      reloadList()
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
    return false
  }

  const doRestore = async () => {
    if (!detail) return
    setRestoreBusy(true)
    try {
      await api.post(`/customers/${detail.id}/restore/`)
      toast.success('Cliente ripristinato ✅')
      reloadList()
      await loadDetail(detail.id)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        mobileCard={renderCustomerCard}
        toolbar={{
          q: grid.q,
          onQChange: grid.setQ,
          compact: true,
        }}
        grid={{
          pageKey: 'customers',
          username: me?.username,
          filterConfig,

          emptyState,
          columnVisibilityModel: {},

          rows,
          columns: columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          onRowContextMenu: handleRowContextMenu,

          sx: {
            // compact-ish density + zebra soft (no prop changes needed)
            '--DataGrid-rowHeight': '24px',
            '--DataGrid-headerHeight': '35px',
            '& .MuiDataGrid-cell': { py: 0.25 },
            '& .MuiDataGrid-columnHeader': { py: 0.75 },
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
            '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
            '& .MuiDataGrid-row.Mui-selected': {
              backgroundColor: 'rgba(69,127,121,0.10) !important',
            },
            '& .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: 'rgba(69,127,121,0.14) !important',
            },
          },
        }}
      >

      </EntityListCard>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {vpnModalRow && (
        <VpnModal
          open={vpnModalOpen}
          onClose={() => {
            setVpnModalOpen(false)
            reloadList()
          }}
          customerId={vpnModalRow.id}
          customerName={vpnModalRow.display_name || vpnModalRow.name}
        />
      )}

      <CustomerDrawer
        open={drawerOpen}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
        drawerTab={drawerTab}
        sitesCount={sitesCount}
        inventoriesCount={invCount}
        driveCount={driveCount}
        address={address}
        canChange={canChange}
        canDelete={canDelete}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        onClose={closeDrawer}
        onEdit={openEdit}
        onDelete={() => setDeleteDlgOpen(true)}
        onRestore={doRestore}
        onTabChange={setDrawerTab}
        sitesTabContent={detail ? (
          <CustomerSitesTab
            customerId={detail.id}
            includeDeleted={grid.includeDeleted}
            onlyDeleted={grid.onlyDeleted}
          />
        ) : null}
        inventoriesTabContent={detail ? (
          <CustomerInventoriesTab
            customerId={detail.id}
            includeDeleted={grid.includeDeleted}
            onlyDeleted={grid.onlyDeleted}
          />
        ) : null}
        driveTabContent={detail ? <CustomerDriveTab customerId={detail.id} /> : null}
        activityTabContent={detail ? (
          <AuditEventsTab appLabel="crm" model="customer" objectId={detail.id} />
        ) : null}
      />

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title="Ripristinare i clienti selezionati?"
        description={`Verranno ripristinati ${selectedCount} clienti dal cestino.`}
        confirmText="Ripristina"
        confirmColor="success"
        onClose={() => setBulkRestoreDlgOpen(false)}
        onConfirm={async () => {
          const ok = await doBulkRestore()
          if (ok) setBulkRestoreDlgOpen(false)
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Confermi eliminazione?"
        description={
          detail?.code
            ? `Il cliente verrà spostato nel cestino e potrà essere ripristinato.\n\n${detail.code} • ${detail.display_name}`
            : 'Il cliente verrà spostato nel cestino e potrà essere ripristinato.'
        }
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      <CustomerDialog
        open={dlgOpen}
        mode={dlgMode}
        saving={dlgSaving}
        errors={fieldErrors}
        statuses={statuses}
        form={form}
        onClose={() => setDlgOpen(false)}
        onSave={save}
        onFormChange={setForm}
        onFieldErrorsChange={setFieldErrors}
      />
    </Stack>
  )
}
