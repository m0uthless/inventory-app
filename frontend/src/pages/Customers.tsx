import * as React from 'react'
import { useDataGridZebraSx } from '../theme/AppThemeProvider'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Button,
  ButtonBase,
  Chip,
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
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { Can } from '../auth/Can'
import type { GridColDef } from '@mui/x-data-grid'

import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useAuth } from '../auth/AuthProvider'
import { api } from '@shared/api/client'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useCustomerKpis } from '../hooks/useCustomerKpis'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { buildQuery } from '@shared/utils/nav'
import { isRecord } from '@shared/utils/guards'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import AuditEventsTab from '../ui/AuditEventsTab'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useThemeTokens } from '../theme/AppThemeProvider'
import { useUrlStringParam } from '@shared/hooks/useUrlParam'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import VpnModal from '../features/customers/VpnModal'
import CustomerDialog from '../features/customers/CustomerDialog'
import CustomerDrawer from '../features/customers/CustomerDrawer'
import CustomerDevicesTab from '../features/devices/CustomerDevicesTab'
import CustomerContractsTab from '../features/contracts/CustomerContractsTab'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'
import { RelatedListHeader, RelatedListBody } from '../features/entityRelations/RelatedListSection'
import { stripOpenParam } from '../features/entityRelations/relatedListUtils'

type LookupItem = { id: number; label: string; key?: string }

type CustomerRow = {
  id: number
  code: string
  name: string
  display_name: string

  // Convenience/computed fields from API
  city?: string | null
  province?: string | null
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
  province: string
  custom_fields: Record<string, unknown>
  notes: string
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
  const { gridZebraBase } = useThemeTokens()

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
      <RelatedListHeader
        title="Siti"
        count={rowCount}
        buttonLabel="Apri lista"
        onOpenList={() =>
          navigate(
            `/sites${buildQuery({ customer: customerId, ...viewQuery(includeDeleted, onlyDeleted), return: loc.pathname + stripOpenParam(loc.search) })}`,
          )
        }
      />

      <RelatedListBody loading={loading} isEmpty={rows.length === 0}>
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
                sx={{ bgcolor: idx % 2 === 1 ? alpha(gridZebraBase, 0.03) : 'transparent' }}
              >
                <ListItemButton
                  onClick={() => navigate(`/sites${buildQuery({ ...q, return: loc.pathname + stripOpenParam(loc.search) })}`)}
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
      </RelatedListBody>
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
  const { gridZebraBase } = useThemeTokens()

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
      <RelatedListHeader
        title="Inventari"
        count={rowCount}
        buttonLabel="Apri lista"
        onOpenList={() =>
          navigate(
            `/inventory${buildQuery({ customer: customerId, ...viewQuery(includeDeleted, onlyDeleted), return: loc.pathname + stripOpenParam(loc.search) })}`,
          )
        }
      />

      <RelatedListBody loading={loading} isEmpty={rows.length === 0}>
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
                sx={{ bgcolor: idx % 2 === 1 ? alpha(gridZebraBase, 0.03) : 'transparent' }}
              >
                <ListItemButton
                  onClick={() => navigate(`/inventory${buildQuery({ ...q, return: loc.pathname + stripOpenParam(loc.search) })}`)}
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
      </RelatedListBody>
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
  const { gridZebraBase } = useThemeTokens()
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

  function fileIcon(mime?: string) {
    if (!mime) return <FolderOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
    if (mime.startsWith('image/'))
      return <ImageOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
    if (mime === 'application/pdf')
      return <PictureAsPdfOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
    return <DescriptionOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
  }

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <RelatedListHeader
        title="File Drive"
        count={total}
        buttonLabel="Apri Drive"
        onOpenList={() => navigate('/drive')}
      />

      <RelatedListBody loading={loading} isEmpty={items.length === 0} emptyText="Nessun file collegato.">
        <List
          dense
          disablePadding
          sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
          {items.map((item, idx) => (
            <ListItem
              key={`${item.kind}-${item.id}`}
              disablePadding
              sx={{ bgcolor: idx % 2 === 1 ? alpha(gridZebraBase, 0.03) : 'transparent' }}
            >
              <ListItemText
                sx={{ px: 1.5, py: 0.75 }}
                primary={
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    {item.kind === 'folder' ? (
                      <FolderOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    ) : (
                      fileIcon(item.mime_type)
                    )}
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
      </RelatedListBody>
    </Stack>
  )
}

/** Testo leggibile solo dagli screen reader. */
const srOnlySx = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden',
  padding: 0, position: 'absolute', whiteSpace: 'nowrap', width: '1px',
} as const

/** Pillola VPN: vero pulsante (tastiera + screen reader), apre le credenziali VPN. */
function VpnPill({ row, onClick, size = 'grid' }: { row: CustomerRow; onClick: (row: CustomerRow) => void; size?: 'grid' | 'touch' }) {
  const name = row.display_name || row.name
  return (
    <ButtonBase
      aria-label={`Apri VPN di ${name}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick(row)
      }}
      onKeyDown={(e) => e.stopPropagation()}
      sx={{
        flexShrink: 0,
        gap: 0.5,
        fontSize: size === 'touch' ? '0.75rem' : '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        px: size === 'touch' ? 1.5 : 0.6,
        py: size === 'touch' ? 0 : 0.15,
        minHeight: size === 'touch' ? 44 : undefined,
        borderRadius: size === 'touch' ? 1 : 0.75,
        bgcolor: 'success.50',
        color: 'success.800',
        border: '0.5px solid',
        borderColor: 'success.200',
        lineHeight: 1.6,
        '&:hover': { bgcolor: 'success.100' },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
      }}
    >
      VPN
    </ButtonBase>
  )
}

function buildColumns(onVpnClick: (row: CustomerRow) => void): GridColDef<CustomerRow>[] {
  return [
  {
    field: 'id',
    headerName: 'ID',
    width: 80,
    align: 'right',
    headerAlign: 'right',
  },
  {
    field: 'display_name',
    headerName: 'Cliente',
    flex: 1,
    minWidth: 260,
    renderCell: (p) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.value as string}
        </Box>
        {p.row.has_vpn && <VpnPill row={p.row} onClick={onVpnClick} />}
      </Box>
    ),
  },
  {
    // Il lookup "stato" del cliente contiene il vendor (Philips, Biotron, …):
    // testo neutro, il colore resta riservato a stati veri.
    field: 'status_label',
    headerName: 'Vendor',
    width: 170,
    renderCell: (p) => (
      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
        {typeof p.value === 'string' && p.value ? p.value : '—'}
      </Box>
    ),
  },
  { field: 'city', headerName: 'Città', width: 170 },
  { field: 'province', headerName: 'Provincia', width: 120 },
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
          <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            Nessun contatto
          </Box>
        )
      }

      const label = name || email || phone
      return tooltip ? (
        <Tooltip title={tooltip} arrow>
          <span>
            {label}
            {/* Email/telefono anche per chi naviga con screen reader (il tooltip è solo hover). */}
            {name ? <Box component="span" sx={srOnlySx}>{`, ${tooltip}`}</Box> : null}
          </span>
        </Tooltip>
      ) : (
        <span>{label}</span>
      )
    },
  },
  { field: 'vat_number', headerName: 'P.IVA', width: 160 },
  { field: 'tax_code', headerName: 'Codice fiscale', width: 170 },
  ]
}


// ─── Mobile card renderer ────────────────────────────────────────────────────

const touchLinkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  minHeight: 44,
  px: 1.25,
  borderRadius: 1,
  border: '0.5px solid',
  borderColor: 'divider',
  color: 'primary.main',
  fontSize: '0.8rem',
  fontWeight: 600,
  textDecoration: 'none',
  minWidth: 0,
  '&:active': { bgcolor: 'action.selected' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
} as const

function makeRenderCustomerCard(onVpnClick: (row: CustomerRow) => void): MobileCardRenderFn<CustomerRow> {
  return ({ row, onOpen }) => {
  const place = [row.city, row.province ? `(${row.province})` : null].filter(Boolean).join(' ')
  const phone = row.primary_contact_phone?.trim() || ''
  const email = row.primary_contact_email?.trim() || ''
  const contactName = row.primary_contact_name?.trim() || ''
  const hasActions = Boolean(phone || email || row.has_vpn)

  return (
    <Box
      onClick={() => onOpen(row.id)}
      sx={{
        bgcolor: 'background.paper',
        border: '0.5px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        '&:active': { bgcolor: 'action.hover' },
      }}
    >
      {/* Nome + vendor, poi luogo */}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {row.display_name || row.name}
          </Typography>
          {row.status_label ? (
            <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.secondary', fontWeight: 500 }}>
              {row.status_label}
            </Typography>
          ) : null}
        </Box>
        {place || contactName ? (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[place, contactName].filter(Boolean).join(' · ')}
          </Typography>
        ) : null}
        {!contactName && !phone && !email ? (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
            Nessun contatto
          </Typography>
        ) : null}
      </Box>

      {/* Azioni dirette: chiama, scrivi, VPN. Il tap non apre il drawer. */}
      {hasActions ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} onClick={(e) => e.stopPropagation()}>
          {phone ? (
            <Box component="a" href={`tel:${phone.replace(/\s+/g, '')}`} aria-label={`Chiama ${phone}`} sx={{ ...touchLinkSx, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              <PhoneOutlinedIcon sx={{ fontSize: 18 }} />
              {phone}
            </Box>
          ) : null}
          {email ? (
            <Box component="a" href={`mailto:${email}`} aria-label={`Scrivi a ${email}`} sx={{ ...touchLinkSx, flex: '1 1 auto', maxWidth: '100%' }}>
              <MailOutlineIcon sx={{ fontSize: 18, flexShrink: 0 }} />
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</Box>
            </Box>
          ) : null}
          {row.has_vpn ? <VpnPill row={row} onClick={onVpnClick} size="touch" /> : null}
        </Box>
      ) : null}
    </Box>
  )
  }
}


// prettier-ignore
export default function Customers() {
  const zebraSx = useDataGridZebraSx()
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const canChange = hasPerm(PERMS.crm.customer.change)
  const canDelete = hasPerm(PERMS.crm.customer.delete)

  const grid = useServerGrid({
    defaultOrdering: 'display_name',
    allowedOrderingFields: [
      'id',
      'display_name',
      'status_label',
      'city',
      'province',
      'primary_contact_name',
      'vat_number',
      'tax_code',
    ],
    defaultPageSize: 25,
  })

  // Filtri URL (stesso pattern di Siti): imbuto sulle colonne, chip su mobile.
  const [statusFilter, setStatusFilter] = useUrlStringParam('status')
  const [provinceFilter, setProvinceFilter] = useUrlStringParam('province')
  const [vpnFilter, setVpnFilter] = useUrlStringParam('has_vpn')
  const [contactFilter, setContactFilter] = useUrlStringParam('has_contact')
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const hasActiveFilters = Boolean(statusFilter || provinceFilter || vpnFilter || contactFilter)
  const resetFilters = React.useCallback(() => {
    setStatusFilter('', { patch: { page: 1, province: '', has_vpn: '', has_contact: '' }, keepOpen: true })
  }, [setStatusFilter])

  const { setQ: setGridQ } = grid
  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim())
    if (grid.view === 'deleted' && !searching && !hasActiveFilters) {
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono clienti eliminati.' }
    }
    if (searching || hasActiveFilters) {
      const what = searching && hasActiveFilters ? 'la ricerca o i filtri' : searching ? 'la ricerca' : 'i filtri'
      return {
        title: 'Nessun risultato',
        subtitle: `Nessun cliente corrisponde: prova a modificare ${what}.`,
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {searching ? (
              <Button variant="outlined" onClick={() => setGridQ('')}>
                Cancella ricerca
              </Button>
            ) : null}
            {hasActiveFilters ? (
              <Button variant="outlined" onClick={resetFilters}>
                Azzera filtri
              </Button>
            ) : null}
          </Stack>
        ),
      }
    }
    return {
        title: 'Nessun cliente',
        subtitle: 'Non ci sono ancora clienti.',
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
  }, [grid.view, grid.search, setGridQ, hasActiveFilters, resetFilters, loc.pathname, loc.search, navigate])

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
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(provinceFilter.trim() ? { province: provinceFilter.trim() } : {}),
          ...(vpnFilter ? { has_vpn: vpnFilter } : {}),
          ...(contactFilter ? { has_contact: contactFilter } : {}),
        },
      }),
    [
      statusFilter,
      provinceFilter,
      vpnFilter,
      contactFilter,
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
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
    devicesCount,
    contractsCount,
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
    province: '',
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
        toast.success('Cliente ripristinato')
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
        label: 'VPN',
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

  const renderCustomerCard = React.useMemo(() => makeRenderCustomerCard(openVpnModal), [openVpnModal])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => {
    const yesNoSelect = (label: string, value: string, onChange: (v: string) => void, yes: string, no: string) => (
      <FormControl size="small" fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={value} onChange={(e) => onChange(String(e.target.value))}>
          <MenuItem value="">Tutti</MenuItem>
          <MenuItem value="true">{yes}</MenuItem>
          <MenuItem value="false">{no}</MenuItem>
        </Select>
      </FormControl>
    )
    return {
      status_label: {
        value: statusFilter,
        label: 'Filtra per vendor',
        onSet: (v) => setStatusFilter(String(v), filterOpts),
        onReset: () => setStatusFilter('', filterOpts),
        children: (
          <FormControl size="small" fullWidth>
            <InputLabel>Vendor</InputLabel>
            <Select label="Vendor" value={statusFilter} onChange={(e) => setStatusFilter(String(e.target.value), filterOpts)}>
              <MenuItem value="">Tutti</MenuItem>
              {statuses.map((st) => <MenuItem key={st.id} value={String(st.id)}>{st.label}</MenuItem>)}
            </Select>
          </FormControl>
        ),
      },
      province: {
        value: provinceFilter,
        label: 'Filtra per provincia',
        onSet: (v) => setProvinceFilter(String(v), filterOpts),
        onReset: () => setProvinceFilter('', filterOpts),
        children: (
          <TextField
            size="small"
            fullWidth
            autoFocus
            label="Provincia"
            placeholder="Es. BO"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value.toUpperCase(), filterOpts)}
          />
        ),
      },
      display_name: {
        value: vpnFilter,
        label: 'Filtra per VPN',
        onSet: (v) => setVpnFilter(String(v), filterOpts),
        onReset: () => setVpnFilter('', filterOpts),
        children: yesNoSelect('VPN', vpnFilter, (v) => setVpnFilter(v, filterOpts), 'Con VPN', 'Senza VPN'),
      },
      primary_contact_name: {
        value: contactFilter,
        label: 'Filtra per contatto',
        onSet: (v) => setContactFilter(String(v), filterOpts),
        onReset: () => setContactFilter('', filterOpts),
        children: yesNoSelect('Contatto primario', contactFilter, (v) => setContactFilter(v, filterOpts), 'Con contatto', 'Senza contatto'),
      },
    }
  }, [statusFilter, provinceFilter, vpnFilter, contactFilter, statuses, filterOpts, setStatusFilter, setProvinceFilter, setVpnFilter, setContactFilter])

  // Configurazione filtri URL per il kebab menu delle colonne
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
      province: '',
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
      province: detail.province ?? '',
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
    if (form.status === '') clientErrors.status = 'Seleziona un vendor.'
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
      province: (form.province || '').trim() || null,
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
        toast.success('Cliente creato')
      } else {
        if (!dlgId) return
        const res = await api.patch<CustomerDetail>(`/customers/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Cliente aggiornato')
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
      toast.success('Cliente eliminato')

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

  const doRestore = async () => {
    if (!detail) return
    setRestoreBusy(true)
    try {
      await api.post(`/customers/${detail.id}/restore/`)
      toast.success('Cliente ripristinato')
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
          searchLabel: 'Cerca clienti, siti, hostname…',
          onReset: hasActiveFilters ? resetFilters : undefined,
          resetLabel: 'Azzera filtri',
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
            ...zebraSx,
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
        devicesCount={devicesCount}
        contractsCount={contractsCount}
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
        onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
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
        devicesTabContent={detail ? <CustomerDevicesTab customerId={detail.id} /> : null}
        contractsTabContent={detail ? <CustomerContractsTab customerId={detail.id} /> : null}
        activityTabContent={detail ? (
          <AuditEventsTab appLabel="crm" model="customer" objectId={detail.id} />
        ) : null}
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
