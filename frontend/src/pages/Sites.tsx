import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  Tabs,
  Tab,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import CloseIcon from '@mui/icons-material/Close'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '../hooks/useServerGrid'
import { useUrlNumberParam } from '../hooks/useUrlParam'
import { api } from '../api/client'
import { buildDrfListParams, includeDeletedParams } from '../api/drf'
import type { ApiPage } from '../api/drf'
import { useDrfList } from '../hooks/useDrfList'
import { useDrawerKpis } from '../hooks/useDrawerKpis'
import SiteDialog from '../features/sites/SiteDialog'
import type { KpiSpec } from '../hooks/useDrawerKpis'
import { useToast } from '../ui/toast'
import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { apiErrorToFormFeedback, apiErrorToMessage } from '../api/error'
import { buildQuery } from '../utils/nav'
import { emptySelectionModel, selectionSize, selectionToNumberIds } from '../utils/gridSelection'
import { isRecord } from '../utils/guards'
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog'
import ConfirmActionDialog from '../ui/ConfirmActionDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '../ui/EntityListCard'
import StatusChip from '../ui/StatusChip'
import FilterChip from '../ui/FilterChip'
import { compactCreateButtonSx, compactExportButtonSx, compactResetButtonSx } from '../ui/toolbarStyles'
import { useExportCsv } from '../ui/useExportCsv'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import LeafletMap from '../ui/LeafletMap'
import RowContextMenu, { type RowContextMenuItem } from '../ui/RowContextMenu'

type LookupItem = { id: number; label: string; key?: string }

type CustomerItem = {
  id: number
  code?: string
  name?: string
  display_name?: string | null
}

type SiteRow = {
  id: number
  name: string
  display_name?: string | null

  customer?: number | null
  customer_code?: string | null
  customer_name?: string | null
  customer_display_name?: string | null

  status?: number | null
  status_label?: string | null

  city?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  postal_code?: string | null
  address_line1?: string | null

  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

type SiteDetail = SiteRow & {
  province?: string | null
  country?: string | null
  custom_fields?: Record<string, unknown> | null
  deleted_at?: string | null
}

type SiteForm = {
  customer: number | ''
  status: number | ''
  name: string
  display_name: string
  address_line1: string
  city: string
  postal_code: string
  province: string
  country: string
  custom_fields: Record<string, unknown>
  notes: string
}

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

async function copyToClipboard(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

type ContactMini = {
  id: number
  customer?: number
  site?: number | null
  name?: string | null
  email?: string | null
  phone?: string | null
  department?: string | null
  is_primary?: boolean | null
  deleted_at?: string | null
}

type InventoryMini = {
  id: number
  customer: number
  site?: number | null
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  type_label?: string | null
  status_label?: string | null
  deleted_at?: string | null
}

function viewQuery(includeDeleted: boolean, onlyDeleted: boolean) {
  if (onlyDeleted) return { view: 'deleted' }
  if (includeDeleted) return { view: 'all' }
  return {}
}

function SiteContactsTab(props: {
  customerId: number
  siteId: number
  includeDeleted: boolean
  onlyDeleted: boolean
  onCount?: (n: number) => void
}) {
  const { customerId, siteId, includeDeleted, onlyDeleted, onCount } = props
  const toast = useToast()
  const navigate = useNavigate()

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: '-is_primary,name',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId, site: siteId },
      }),
    [customerId, siteId, includeDeleted, onlyDeleted],
  )

  const { rows, rowCount, loading } = useDrfList<ContactMini>('/contacts/', params, (e: unknown) =>
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
            Contatti
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            navigate(
              `/contacts${buildQuery({ customer: customerId, site: siteId, ...viewQuery(includeDeleted, onlyDeleted) })}`,
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
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
        >
          {rows.map((c, idx) => {
            const label = c.name || c.email || c.phone || `Contatto #${c.id}`
            const secParts = [c.email || '', c.phone || '', c.department || ''].filter(Boolean)
            const secondary = secParts.length ? secParts.join(' • ') : undefined
            const q = {
              open: c.id,
              customer: customerId,
              site: siteId,
              ...(c.deleted_at ? { view: 'all' } : viewQuery(includeDeleted, onlyDeleted)),
            }
            return (
              <ListItem key={c.id} disablePadding divider={idx < rows.length - 1}>
                <ListItemButton
                  onClick={() => navigate(`/contacts${buildQuery(q)}`)}
                  sx={{
                    py: 1,
                    ...(c.deleted_at
                      ? { opacity: 0.65, textDecoration: 'line-through' as const }
                      : null),
                  }}
                >
                  <ListItemText
                    primary={
                      <span>
                        {label}
                        {c.is_primary ? '  ★' : ''}
                      </span>
                    }
                    secondary={secondary}
                    primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                  {c.deleted_at ? <Chip size="small" color="error" label="Eliminato" /> : null}
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

function SiteInventoriesTab(props: {
  customerId: number
  siteId: number
  includeDeleted: boolean
  onlyDeleted: boolean
  onCount?: (n: number) => void
}) {
  const { customerId, siteId, includeDeleted, onlyDeleted, onCount } = props
  const toast = useToast()
  const navigate = useNavigate()

  const params = React.useMemo(
    () =>
      buildDrfListParams({
        page0: 0,
        pageSize: 25,
        ordering: 'hostname',
        includeDeleted,
        onlyDeleted,
        extra: { customer: customerId, site: siteId },
      }),
    [customerId, siteId, includeDeleted, onlyDeleted],
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
          variant="outlined"
          onClick={() =>
            navigate(
              `/inventory${buildQuery({ customer: customerId, site: siteId, ...viewQuery(includeDeleted, onlyDeleted) })}`,
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
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
        >
          {rows.map((inv, idx) => {
            const primary =
              inv.hostname || inv.knumber || inv.serial_number || `Inventario #${inv.id}`
            const secParts = [inv.type_label || '', inv.status_label || ''].filter(Boolean)
            const secondary = secParts.length ? secParts.join(' • ') : undefined
            const q = {
              open: inv.id,
              customer: customerId,
              site: siteId,
              ...(inv.deleted_at ? { view: 'all' } : viewQuery(includeDeleted, onlyDeleted)),
            }
            return (
              <ListItem key={inv.id} disablePadding divider={idx < rows.length - 1}>
                <ListItemButton
                  onClick={() => navigate(`/inventory${buildQuery(q)}`)}
                  sx={{
                    py: 1,
                    ...(inv.deleted_at
                      ? { opacity: 0.65, textDecoration: 'line-through' as const }
                      : null),
                  }}
                >
                  <ListItemText
                    primary={primary}
                    secondary={secondary}
                    primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 600 } }}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                  {inv.deleted_at ? <Chip size="small" color="error" label="Eliminato" /> : null}
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

const cols: GridColDef<SiteRow>[] = [
  {
    field: 'display_name',
    headerName: 'Sito',
    flex: 1,
    minWidth: 280,
    valueGetter: (v, row) => {
      void v
      return row.display_name || row.name || '—'
    },
  },
  {
    field: 'customer_display_name',
    headerName: 'Cliente',
    width: 220,
    valueGetter: (v, row) => {
      void v
      return row.customer_display_name || row.customer_name || row.customer_code || '—'
    },
  },
  { field: 'city', headerName: 'Città', width: 160 },
  { field: 'postal_code', headerName: 'CAP', width: 120 },
  {
    field: 'primary_contact_name',
    headerName: 'Contatto',
    width: 230,
    sortable: false,
    renderCell: ({ row }) => {
      const name = row.primary_contact_name || ''
      const email = row.primary_contact_email || ''
      const phone = row.primary_contact_phone || ''
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
]


const SITE_KPI_SPECS: KpiSpec[] = [
  { key: 'inv',     path: '/inventories/', filterParam: 'site' },
  { key: 'contact', path: '/contacts/',    filterParam: 'site' },
]

export default function Sites() {
  const { me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const { exporting, exportCsv } = useExportCsv()
  const grid = useServerGrid({
    defaultOrdering: 'display_name',
    allowedOrderingFields: [
      'display_name',
      'customer_display_name',
      'city',
      'postal_code',
      'status_label',
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
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono siti eliminati.' }
    }
    if (!grid.search.trim()) {
      return {
        title: 'Nessun sito',
        subtitle: 'Crea un nuovo sito o cambia i filtri.',
        action: (
          <Can perm={PERMS.crm.site.add}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}
            >
              Crea sito
            </Button>
          </Can>
        ),
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
  }, [grid.view, grid.search, loc.pathname, loc.search, navigate])

  // filters (URL)
  const [customerId, setCustomerId] = useUrlNumberParam('customer')

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: {
          display_name: 'name',
          customer_display_name: 'customer__name',
          status_label: 'status__label',
        },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== '' ? { customer: customerId } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
      customerId,
    ],
  )

  const {
    rows,
    rowCount,
    loading,
    reload: reloadList,
  } = useDrfList<SiteRow>('/sites/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([])
  const [statuses, setStatuses] = React.useState<LookupItem[]>([])

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<SiteDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [drawerTab, setDrawerTab] = React.useState(0)
  const { inv: invCount, contact: contactCount, reset: resetKpis } = useDrawerKpis(
    detail?.id ?? null,
    SITE_KPI_SPECS,
  )

  // Address for map
  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

  // delete/restore
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // dialog CRUD
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [dlgErrors, setDlgErrors] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<SiteForm>({
    customer: '',
    status: '',
    name: '',
    display_name: '',
    address_line1: '',
    city: '',
    postal_code: '',
    province: '',
    country: 'IT',
    custom_fields: {},
    notes: '',
  })

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>('/customers/', {
        params: { page_size: 500, ordering: 'name' },
      })
      setCustomers(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  const loadStatuses = React.useCallback(async () => {
    try {
      const res = await api.get<LookupItem[]>('/site-statuses/')
      setStatuses((res.data ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted
        const incParams = includeDeletedParams(inc)
        const res = await api.get<SiteDetail>(
          `/sites/${id}/`,
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

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => {
    return new URLSearchParams(loc.search).get('return')
  }, [loc.search])

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    resetKpis()
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }, [grid, returnTo, navigate, resetKpis])

  const doDelete = React.useCallback(async () => {
    if (!selectedId) return
    setDeleteBusy(true)
    try {
      await api.delete(`/sites/${selectedId}/`)
      toast.success('Sito eliminato ✅')
      setDeleteDlgOpen(false)
      closeDrawer()
      grid.setViewMode('all', { keepOpen: true })
      // list will refresh automatically via URL change
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }, [selectedId, toast, closeDrawer, grid, reloadList])

  const doBulkRestore = async (): Promise<boolean> => {
    const ids = selectedIds.filter((n) => Number.isFinite(n))
    if (!ids.length) return false
    setRestoreBusy(true)
    try {
      await api.post(`/sites/bulk_restore/`, { ids })
      toast.success(`Ripristinati ${ids.length} elementi ✅`)
      setSelectionModel(emptySelectionModel())
      reloadList()
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      return false
    } finally {
      setRestoreBusy(false)
    }
    return false
  }

  const doRestore = React.useCallback(async () => {
    if (!selectedId) return
    setRestoreBusy(true)
    try {
      await api.post(`/sites/${selectedId}/restore/`)
      toast.success('Sito ripristinato ✅')
      await loadDetail(selectedId)
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [selectedId, toast, loadDetail, reloadList])

  React.useEffect(() => {
    loadCustomers()
    loadStatuses()
  }, [loadCustomers, loadStatuses])

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
      loadDetail(id)
      grid.setOpenId(id)
    },
    [grid, loadDetail],
  )

  // ── Azioni riga / menu contestuale ──────────────────────────────────────────
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{
    row: SiteRow
    mouseX: number
    mouseY: number
  } | null>(null)

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
        await api.post(`/sites/${id}/restore/`)
        toast.success('Sito ripristinato ✅')
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setRestoreBusy(false)
      }
    },
    [toast, reloadList],
  )

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
    (row: SiteRow, event: React.MouseEvent<HTMLElement>) => {
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
        key: 'delete',
        label: 'Elimina',
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: () => openDeleteFromRow(row.id),
        disabled: deleteBusy,
        tone: 'danger',
      },
    ]
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, restoreBusy, restoreFromRow])

  const columns = React.useMemo<GridColDef<SiteRow>[]>(() => {
    return cols
  }, [])

  const openCreateOnceRef = React.useRef(false)

  const openCreate = React.useCallback(() => {
    setDlgMode('create')
    setDlgId(null)
    setDlgErrors({})
    setForm({
      customer: customerId !== '' ? customerId : '',
      status: '',
      name: '',
      display_name: '',
      address_line1: '',
      city: '',
      postal_code: '',
      province: '',
      country: 'IT',
      custom_fields: {},
      notes: '',
    })
    setDlgOpen(true)
  }, [customerId])

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
    setDlgErrors({})
    setForm({
      customer: detail.customer ?? '',
      status: detail.status ?? '',
      name: detail.name ?? '',
      display_name: detail.display_name ?? '',
      address_line1: detail.address_line1 ?? '',
      city: detail.city ?? '',
      postal_code: detail.postal_code ?? '',
      province: detail.province ?? '',
      country: detail.country ?? 'IT',
      custom_fields: detail.custom_fields ?? {},
      notes: detail.notes ?? '',
    })
    setDlgOpen(true)
  }, [detail])

  openEditRef.current = openEdit

  const save = async () => {
    const clientErrors: Record<string, string> = {}
    if (form.customer === '') clientErrors.customer = 'Seleziona un cliente.'
    if (form.status === '')   clientErrors.status   = 'Seleziona uno stato.'
    if (!String(form.name).trim()) clientErrors.name = 'Il nome è obbligatorio.'
    if (Object.keys(clientErrors).length) {
      setDlgErrors(clientErrors)
      return
    }
    setDlgErrors({})

    const payload: Record<string, unknown> = {
      customer: Number(form.customer),
      status: Number(form.status),
      name: form.name.trim(),
      display_name: (form.display_name || '').trim() || form.name.trim(),
      address_line1: (form.address_line1 || '').trim() || null,
      city: (form.city || '').trim() || null,
      postal_code: (form.postal_code || '').trim() || null,
      province: (form.province || '').trim() || null,
      country: (form.country || '').trim() || 'IT',
      custom_fields:
        form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: (form.notes || '').trim() || null,
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<SiteDetail>('/sites/', payload)
        id = res.data.id
        toast.success('Sito creato ✅')
      } else {
        if (!dlgId) return
        const res = await api.patch<SiteDetail>(`/sites/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Sito aggiornato ✅')
      }

      setDlgOpen(false)
      reloadList()
      openDrawer(id)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) {
        setDlgErrors(feedback.fieldErrors)
        toast.warning(feedback.message)
      } else {
        toast.error(feedback.message)
      }
    } finally {
      setDlgSaving(false)
    }
  }

  const customerLabel = (s: SiteDetail | null) =>
    s?.customer_display_name || s?.customer_name || s?.customer_code || ''

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          rightActions: (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FilterChip
                        compact
                        activeCount={customerId !== '' ? 1 : 0}
                        onReset={() => {
                          setCustomerId('', { patch: { search: grid.q, page: 1 }, keepOpen: true })
                        }}
                      >
                        <FormControl size="small" fullWidth>
                          <InputLabel>Cliente</InputLabel>
                          <Select
                            label="Cliente"
                            value={customerId}
                            onChange={(e) => {
                              const v = asId(e.target.value)
                              setCustomerId(v, { patch: { search: grid.q, page: 1 }, keepOpen: true })
                            }}
                          >
                            <MenuItem value="">Tutti</MenuItem>
                            {customers.map((c) => (
                              <MenuItem key={c.id} value={c.id}>
                                {c.display_name || c.name || c.code || `Cliente #${c.id}`}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </FilterChip>

              <Tooltip title="Reimposta" arrow>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => grid.reset(['customer'])}
                    sx={compactResetButtonSx}
                  >
                    <RestartAltIcon />
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={exporting ? 'Esportazione…' : 'Esporta CSV'} arrow>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={exporting}
                    onClick={() =>
                      exportCsv({
                        url: '/sites/',
                        params: {
                          search: grid.q,
                          ordering: grid.ordering,
                          ...(grid.includeDeleted ? { include_deleted: '1' } : {}),
                        },
                        filename: 'siti',
                        columns: [
                          { label: 'Nome', getValue: (r: SiteRow) => r.display_name || r.name },
                          { label: 'Cliente', getValue: (r: SiteRow) => r.customer_name },
                          { label: 'Città', getValue: (r: SiteRow) => r.city },
                          { label: 'Indirizzo', getValue: (r: SiteRow) => r.address_line1 },
                          { label: 'CAP', getValue: (r: SiteRow) => r.postal_code },
                          { label: 'Stato', getValue: (r: SiteRow) => r.status_label },
                          { label: 'Note', getValue: (r: SiteRow) => r.notes },
                        ],
                      })
                    }
                    sx={compactExportButtonSx}
                  >
                    <FileDownloadOutlinedIcon />
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ),
        }}
        grid={{
          pageKey: 'sites',
          username: me?.username,

          emptyState,
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
          slotProps: { toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } },
          sx: {
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

        <Can perm={PERMS.crm.site.add}>
          <Tooltip title="Nuovo" arrow>
            <span>
              <Button size="small" variant="contained" onClick={openCreate} sx={compactCreateButtonSx}>
                <AddIcon />
              </Button>
            </span>
          </Tooltip>
        </Can>
      </EntityListCard>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 368 } } }}
      >
        <Stack sx={{ height: '100%', overflow: 'hidden' }}>
          {/* ── HERO BANNER ── */}
          <Box
            sx={{
              background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
              px: 2.5,
              pt: 2.25,
              pb: 2.25,
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -44,
                right: -44,
                width: 130,
                height: 130,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.06)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -26,
                left: 52,
                width: 90,
                height: 90,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.04)',
                pointerEvents: 'none',
              }}
            />

            {/* row 1: status + actions */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}
            >
              <Chip
                size="small"
                label={`● ${detail?.status_label ?? '—'}`}
                sx={{
                  bgcolor: 'rgba(20,255,180,0.18)',
                  color: '#a7f3d0',
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.07em',
                  border: '1px solid rgba(167,243,208,0.3)',
                  height: 22,
                }}
              />
              <Stack direction="row" spacing={0.75}>
                <Can perm={PERMS.crm.site.change}>
                  {detail?.deleted_at ? (
                    <Tooltip title="Ripristina">
                      <span>
                        <IconButton
                          aria-label="Ripristina"
                          size="small"
                          onClick={doRestore}
                          disabled={!detail || restoreBusy}
                          sx={{
                            color: 'rgba(255,255,255,0.85)',
                            bgcolor: 'rgba(255,255,255,0.12)',
                            borderRadius: 1.5,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                          }}
                        >
                          <RestoreFromTrashIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Modifica">
                      <span>
                        <IconButton
                          aria-label="Modifica"
                          size="small"
                          onClick={openEdit}
                          disabled={!detail}
                          sx={{
                            color: 'rgba(255,255,255,0.85)',
                            bgcolor: 'rgba(255,255,255,0.12)',
                            borderRadius: 1.5,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Can>
                <Can perm={PERMS.crm.site.delete}>
                  {!detail?.deleted_at && (
                    <Tooltip title="Elimina">
                      <span>
                        <IconButton
                          aria-label="Elimina"
                          size="small"
                          onClick={() => setDeleteDlgOpen(true)}
                          disabled={!detail || deleteBusy}
                          sx={{
                            color: 'rgba(255,255,255,0.85)',
                            bgcolor: 'rgba(255,255,255,0.12)',
                            borderRadius: 1.5,
                            '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Can>
                <Tooltip title="Chiudi">
                  <IconButton
                    aria-label="Chiudi"
                    size="small"
                    onClick={closeDrawer}
                    sx={{
                      color: 'rgba(255,255,255,0.85)',
                      bgcolor: 'rgba(255,255,255,0.12)',
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* row 2: name + city */}
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {detail?.deleted_at && (
                <Chip
                  size="small"
                  color="error"
                  label="Eliminato"
                  sx={{ mb: 0.75, height: 20, fontSize: 10 }}
                />
              )}
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  mb: 0.5,
                }}
              >
                {detail?.display_name ||
                  detail?.name ||
                  (selectedId ? `Sito #${selectedId}` : 'Sito')}
              </Typography>
              {detail?.city && (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                  📍 {detail.city}
                  {detail.postal_code ? ` ${detail.postal_code}` : ''}
                </Typography>
              )}
            </Box>
          </Box>

          {/* ── TABS ── */}
          {detailLoading ? <LinearProgress sx={{ height: 2 }} /> : null}
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2.5 }}>
            <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)}>
              <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
              <Tab
                label={contactCount != null ? `Contatti (${contactCount})` : 'Contatti'}
                sx={{ fontSize: 13, minWidth: 0, px: 1.5 }}
              />
              <Tab
                label={invCount != null ? `Inventari (${invCount})` : 'Inventari'}
                sx={{ fontSize: 13, minWidth: 0, px: 1.5 }}
              />
            </Tabs>
          </Box>

          {/* ── SCROLLABLE CONTENT ── */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2.5,
              py: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {detailLoading ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Caricamento…
                </Typography>
              </Stack>
            ) : detail ? (
              <>
                {/* TAB 0 — Dettagli */}
                {drawerTab === 0 && (
                  <>
                    {/* Contact card */}
                    <Box
                      sx={{
                        bgcolor: '#f8fafc',
                        border: '1px solid',
                        borderColor: 'grey.200',
                        borderRadius: 1,
                        p: 1.75,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: 'text.disabled',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          mb: 1,
                        }}
                      >
                        <BusinessOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        Identificazione
                      </Typography>
                      <Stack spacing={0.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            Nome
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {detail.name || '—'}
                            </Typography>
                            {detail.name && (
                              <Tooltip title="Copia">
                                <IconButton
                                  aria-label="Copia"
                                  size="small"
                                  onClick={async () => {
                                    await copyToClipboard(detail.name)
                                    toast.success('Copiato ✅')
                                  }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </Stack>
                        {detail.display_name && detail.display_name !== detail.name && (
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              Nome visualizzato
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {detail.display_name}
                            </Typography>
                          </Stack>
                        )}
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            Cliente
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {customerLabel(detail) || '—'}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>

                    {/* Indirizzo + mappa */}
                    {siteAddress && (
                      <Box
                        sx={{
                          bgcolor: '#fff',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.200',
                          overflow: 'hidden',
                        }}
                      >
                        <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              color: 'text.disabled',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              mb: 0.5,
                            }}
                          >
                            <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            Indirizzo
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: 'text.primary' }}
                          >
                            {siteAddress}
                          </Typography>
                        </Box>
                        <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                          <LeafletMap address={siteAddress} height={320} zoom={15} />
                        </Box>
                      </Box>
                    )}

                    {/* Note */}
                    {detail.notes && (
                      <Box
                        sx={{
                          bgcolor: '#fafafa',
                          border: '1px solid',
                          borderColor: 'grey.100',
                          borderRadius: 1,
                          p: 1.75,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: 'text.disabled',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            mb: 0.75,
                          }}
                        >
                          <NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                          Note
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                        >
                          {detail.notes}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {/* TAB 1 — Contatti */}
                {drawerTab === 1 && (
                  <SiteContactsTab
                    customerId={detail.customer ?? 0}
                    siteId={detail.id}
                    includeDeleted={grid.includeDeleted}
                    onlyDeleted={grid.onlyDeleted}
                  />
                )}

                {/* TAB 2 — Inventari */}
                {drawerTab === 2 && (
                  <SiteInventoriesTab
                    customerId={detail.customer ?? 0}
                    siteId={detail.id}
                    includeDeleted={grid.includeDeleted}
                    onlyDeleted={grid.onlyDeleted}
                  />
                )}
              </>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Nessun dettaglio disponibile.
              </Typography>
            )}
          </Box>
        </Stack>
      </Drawer>

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title="Ripristinare i siti selezionati?"
        description={`Verranno ripristinati ${selectedCount} siti dal cestino.`}
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
        description="Il sito verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      <SiteDialog
        open={dlgOpen}
        mode={dlgMode}
        saving={dlgSaving}
        errors={dlgErrors}
        form={form}
        setForm={setForm}
        customers={customers}
        statuses={statuses}
        onClose={() => setDlgOpen(false)}
        onSave={save}
      />
    </Stack>
  )
}
