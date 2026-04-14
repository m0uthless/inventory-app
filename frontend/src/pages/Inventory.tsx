import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  Stack,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'

import { Can } from '../auth/Can'
import { useAuth } from '../auth/AuthProvider'

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam } from '@shared/hooks/useUrlParam'
import { api } from '@shared/api/client'
import { collectionActionPath, itemActionPath, itemPath, type CollectionPath } from '@shared/api/apiPaths'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import InventoryDialog from '../features/inventory/InventoryDialog'
import InventoryDrawer from '../features/inventory/InventoryDrawer'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'

import { emptySelectionModel, selectionSize, selectionToNumberIds } from '@shared/utils/gridSelection'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import ConfirmActionDialog from '@shared/ui/ConfirmActionDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { getInventoryTypeIcon, INVENTORY_TYPE_ICON_COLOR } from '@shared/ui/inventoryTypeIcon'
import { isRecord } from '@shared/utils/guards'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'

type LookupItem = { id: number; label: string; key?: string }

const ISSUE_PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#64748b',
}

function ActiveIssueWarningIcon({ priority }: { priority?: string | null }) {
  const color = ISSUE_PRIORITY_COLOR[priority ?? ''] ?? ISSUE_PRIORITY_COLOR.medium
  const label = priority === 'critical' ? 'Issue critica aperta'
    : priority === 'high' ? 'Issue alta priorità aperta'
    : priority === 'low' ? 'Issue a bassa priorità aperta'
    : "C'è almeno una issue collegata aperta o in lavorazione."
  return (
    <Tooltip title={label}>
      <WarningAmberRoundedIcon sx={{ color, fontSize: 18, flexShrink: 0 }} />
    </Tooltip>
  )
}

const INVENTORIES_PATH = '/inventories/' as const satisfies CollectionPath

type CustomerItem = { id: number; code: string; name: string }
type SiteItem = { id: number; name: string; display_name?: string | null }

type InventoryRow = {
  id: number
  customer: number
  customer_code?: string
  customer_name?: string
  site?: number | null
  site_name?: string
  site_display_name?: string | null
  name: string
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  type_key?: string | null
  type_label?: string | null
  status_key?: string | null
  status_label?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  notes?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
}

type InventoryDetail = {
  id: number

  customer: number
  customer_code?: string
  customer_name?: string

  site?: number | null
  site_name?: string
  site_display_name?: string | null

  name: string

  knumber?: string | null
  serial_number?: string | null

  hostname?: string | null
  local_ip?: string | null
  srsa_ip?: string | null

  type?: number | null
  type_key?: string | null
  type_label?: string | null

  status: number
  status_label?: string | null

  os_user?: string | null
  os_pwd?: string | null
  app_usr?: string | null
  app_pwd?: string | null
  vnc_pwd?: string | null

  manufacturer?: string | null
  model?: string | null
  warranty_end_date?: string | null

  notes?: string | null
  tags?: string[] | null

  custom_fields?: Record<string, unknown> | null

  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
}

type InventoryForm = {
  customer: number | ''
  site: number | ''
  status: number | ''
  type: number | ''

  name: string
  knumber: string
  serial_number: string

  hostname: string
  local_ip: string
  srsa_ip: string

  os_user: string
  os_pwd: string
  app_usr: string
  app_pwd: string
  vnc_pwd: string

  manufacturer: string
  model: string
  warranty_end_date: string

  custom_fields: Record<string, unknown>
  notes: string
  tags: string[]
}

// ── REGOLE CAMPI PER TIPO INVENTARIO ─────────────────────────────────────────
// Per ogni tipo, elenca i campi DISABILITATI nel form di creazione/modifica.
// Campo non elencato = sempre abilitato.
// Aggiungi nuovi tipi o modifica i profili senza toccare il codice del form.
// ─────────────────────────────────────────────────────────────────────────────

type InventoryFieldName =
  | 'hostname'
  | 'local_ip'
  | 'srsa_ip' // rete
  | 'os_user'
  | 'os_pwd' // credenziali OS
  | 'app_usr'
  | 'app_pwd' // credenziali app
  | 'vnc_pwd' // VNC
  | 'manufacturer'
  | 'model'
  | 'warranty_end_date' // hardware

// ── Profili riusabili ─────────────────────────────────────────────────────────
const PROFILE_MANAGEMENT: InventoryFieldName[] = ['vnc_pwd', 'app_usr', 'app_pwd']
const PROFILE_LOAD_BALANCER: InventoryFieldName[] = [
  'vnc_pwd',
  'os_user',
  'os_pwd',
  'app_usr',
  'app_pwd',
]
const PROFILE_STORAGE: InventoryFieldName[] = ['vnc_pwd', 'os_user', 'os_pwd']

// ── Mappa tipo → campi disabilitati ──────────────────────────────────────────
const TYPE_DISABLED_FIELDS: Partial<Record<string, InventoryFieldName[]>> = {
  management: PROFILE_MANAGEMENT,
  management1: PROFILE_MANAGEMENT,
  management2: PROFILE_MANAGEMENT,
  management3: PROFILE_MANAGEMENT,
  management4: PROFILE_MANAGEMENT,
  load_balancer1: PROFILE_LOAD_BALANCER,
  load_balancer2: PROFILE_LOAD_BALANCER,
  storage: PROFILE_STORAGE,
  // Aggiungi altri tipi qui, es:
  // robot:       ["vnc_pwd", "app_usr", "app_pwd"],
}






const cols: GridColDef<InventoryRow>[] = [
  {
    field: 'type_label',
    headerName: 'Tipo',
    width: 180,
    sortable: true,
    renderCell: (p) => {
      const Icon = getInventoryTypeIcon(p.row?.type_key)
      const label = p.value == null ? '—' : typeof p.value === 'string' ? p.value : String(p.value)
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, height: '100%' }}>
          {label && label !== '—' ? (
            <Chip
              size="small"
              icon={<Icon sx={{ color: `${INVENTORY_TYPE_ICON_COLOR} !important`, fontSize: '14px !important' }} />}
              label={label}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                fontWeight: 600,
                bgcolor: 'rgba(15,118,110,0.08)',
                color: 'text.primary',
                border: '1px solid rgba(15,118,110,0.18)',
                '& .MuiChip-label': { px: 0.75 },
                maxWidth: '100%',
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
          )}
          {p.row?.has_active_issue ? <ActiveIssueWarningIcon priority={p.row.active_issue_priority} /> : null}
        </Box>
      )
    },
  },
  { field: 'name', headerName: 'Nome', width: 200 },
  { field: 'customer_name', headerName: 'Cliente', width: 220 },
  { field: 'site_name', headerName: 'Sito', width: 180 },

  { field: 'hostname', headerName: 'Hostname', flex: 1, minWidth: 180 },
  { field: 'knumber', headerName: 'K#', width: 140 },
  { field: 'serial_number', headerName: 'Seriale', width: 180 },

  {
    field: 'status_label',
    headerName: 'Stato',
    width: 140,
    renderCell: (p) => {
      const label  = p.value as string | null
      const key    = p.row?.status_key ?? ''
      if (!label) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
      // Mappa key → colore chip
      const COLOR: Record<string, { bg: string; fg: string; border: string }> = {
        in_use:      { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', border: 'rgba(16,185,129,0.28)' },
        maintenance: { bg: 'rgba(245,158,11,0.10)',  fg: '#92400e', border: 'rgba(245,158,11,0.28)' },
        repair:      { bg: 'rgba(239,68,68,0.10)',   fg: '#991b1b', border: 'rgba(239,68,68,0.28)'  },
        spare:       { bg: 'rgba(99,102,241,0.10)',  fg: '#3730a3', border: 'rgba(99,102,241,0.28)' },
        retired:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
        storage:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
      }
      const c = COLOR[key] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            size="small"
            label={label}
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 600,
              bgcolor: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
      )
    },
  },
  { field: 'local_ip', headerName: 'IP locale', width: 160 },
  { field: 'srsa_ip', headerName: 'IP SRSA', width: 160 },
]


// ─── Mobile card renderer ────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  in_use:      { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', border: 'rgba(16,185,129,0.28)' },
  maintenance: { bg: 'rgba(245,158,11,0.10)',  fg: '#92400e', border: 'rgba(245,158,11,0.28)' },
  repair:      { bg: 'rgba(239,68,68,0.10)',   fg: '#991b1b', border: 'rgba(239,68,68,0.28)'  },
  spare:       { bg: 'rgba(99,102,241,0.10)',  fg: '#3730a3', border: 'rgba(99,102,241,0.28)' },
  retired:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
  storage:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
}

const renderInventoryCard: MobileCardRenderFn<InventoryRow> = ({ row, onOpen }) => {
  const TypeIcon = getInventoryTypeIcon(row.type_key)
  const sc = STATUS_COLOR[row.status_key ?? ''] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }

  const meta: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: 'Cliente',  value: row.customer_name },
    { label: 'IP',       value: row.local_ip,  mono: true },
    { label: 'K-Number', value: row.knumber },
    { label: 'IP SRSA',  value: row.srsa_ip,   mono: true },
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
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </Typography>
          {row.type_label && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              {TypeIcon && <TypeIcon sx={{ fontSize: 11, color: 'text.disabled' }} />}
              <Typography variant="caption" color="text.secondary">{row.type_label}</Typography>
            </Box>
          )}
        </Box>
        {row.status_label && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20, bgcolor: sc.bg, color: sc.fg, border: `0.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
            {row.status_label}
          </Box>
        )}
      </Box>

      {/* Grid 2×2 campi */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value, mono }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled', fontStyle: value ? 'normal' : 'italic', fontFamily: mono && value ? 'monospace' : 'inherit', lineHeight: 1.3 }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Footer: sito */}
      {row.site_display_name && (
        <Box sx={{ borderTop: '0.5px solid', borderColor: 'divider', pt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.5, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{row.site_display_name}</Typography>
        </Box>
      )}
    </Box>
  )
}


// prettier-ignore
export default function Inventory() {
  const toast = useToast()
  const { hasPerm, me } = useAuth()
  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets)
  const canChange = hasPerm(PERMS.inventory.inventory.change)
  const canDelete = hasPerm(PERMS.inventory.inventory.delete)

  const navigate = useNavigate()
  const loc = useLocation()
  const defaultPageSizeRef = React.useRef(25)

  const grid = useServerGrid({
    defaultOrdering: 'hostname',
    allowedOrderingFields: [
      'customer_name',
      'site_name',
      'hostname',
      'knumber',
      'serial_number',
      'type_label',
      'status_label',
      'local_ip',
      'srsa_ip',
    ],
    defaultPageSize: defaultPageSizeRef.current,
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
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono inventari eliminati.' }
    }
    if (!grid.search.trim()) {
      return {
        title: 'Nessun inventario',
        subtitle: 'Crea un nuovo inventario o cambia i filtri.',
        action: (
          <Can perm={PERMS.inventory.inventory.add}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}
            >
              Crea inventario
            </Button>
          </Can>
        ),
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
  }, [grid.view, grid.search, loc.pathname, loc.search, navigate])

  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [siteId, setSiteId] = useUrlNumberParam('site')
  const [typeId, setTypeId] = useUrlNumberParam('type')

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: {
          customer_name: 'customer__name',
          site_name: 'site__name',
          type_label: 'type__label',
          status_label: 'status__label',
        },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== '' ? { customer: customerId } : {}),
          ...(siteId !== '' ? { site: siteId } : {}),
          ...(typeId !== '' ? { type: typeId } : {}),
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
      siteId,
      typeId,
    ],
  )

  const {
    rows,
    rowCount,
    loading,
    reload: reloadList,
  } = useDrfList<InventoryRow>(INVENTORIES_PATH, listParams, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  const [customers, setCustomers] = React.useState<CustomerItem[]>([])
  const [filterSites, setFilterSites] = React.useState<SiteItem[]>([])
  const [statuses, setStatuses] = React.useState<LookupItem[]>([])
  const [types, setTypes] = React.useState<LookupItem[]>([])

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [drawerTab, setDrawerTab] = React.useState(0)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<InventoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // delete/restore
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // CRUD dialog
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [dlgSites, setDlgSites] = React.useState<SiteItem[]>([])
  const [form, setForm] = React.useState<InventoryForm>({
    customer: '',
    site: '',
    status: '',
    type: '',
    name: '',
    knumber: '',
    serial_number: '',
    hostname: '',
    local_ip: '',
    srsa_ip: '',
    os_user: '',
    os_pwd: '',
    app_usr: '',
    app_pwd: '',
    vnc_pwd: '',
    manufacturer: '',
    model: '',
    warranty_end_date: '',
    custom_fields: {},
    notes: '',
    tags: [],
  })

  const [formErrors, setFormErrors] = React.useState<Record<string, string | undefined>>({})
  const [tagInput, setTagInput] = React.useState('')

  // Campi disabilitati in base al tipo selezionato
  const selectedTypeKey = React.useMemo(
    () => (form.type !== '' ? (types.find((t) => t.id === form.type)?.key ?? null) : null),
    [form.type, types],
  )
  const disabledFields = React.useMemo((): Set<InventoryFieldName> => {
    const fields = TYPE_DISABLED_FIELDS[selectedTypeKey ?? ''] ?? []
    return new Set(fields)
  }, [selectedTypeKey])
  const df = (f: InventoryFieldName) => disabledFields.has(f)
  const dfHelp = (f: InventoryFieldName) => (df(f) ? 'Non applicabile per questo tipo' : undefined)

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>('/customers/', {
        params: { ordering: 'name', page_size: 500 },
      })
      setCustomers(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  const loadLookups = React.useCallback(async () => {
    try {
      const [st, ty] = await Promise.all([
        api.get<LookupItem[]>('/inventory-statuses/'),
        api.get<LookupItem[]>('/inventory-types/'),
      ])
      setStatuses(st.data ?? [])
      setTypes(ty.data ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  const loadFilterSites = React.useCallback(async () => {
    try {
      const params: Record<string, unknown> = { ordering: 'name', page_size: 500 }
      if (customerId !== '') params.customer = customerId
      const res = await api.get<ApiPage<SiteItem>>('/sites/', { params })
      setFilterSites(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [customerId, toast])

  const loadSitesForDialogCustomer = React.useCallback(
    async (cust: number | '') => {
      try {
        if (cust === '') {
          setDlgSites([])
          return
        }
        const res = await api.get<ApiPage<SiteItem>>('/sites/', {
          params: { ordering: 'name', page_size: 500, customer: cust },
        })
        setDlgSites(res.data.results ?? [])
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      }
    },
    [toast],
  )

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted
        const incParams = includeDeletedParams(inc)
        const res = await api.get<InventoryDetail>(
          itemPath(INVENTORIES_PATH, id),
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

  React.useEffect(() => {
    loadCustomers()
    loadLookups()
  }, [loadCustomers, loadLookups])

  // Keep siteId when initial URL has both customer+site; reset only when customer changes later
  const prevCustomerRef = React.useRef(customerId)
  React.useEffect(() => {
    loadFilterSites()
    if (prevCustomerRef.current !== customerId) {
      setSiteId('', { patch: { page: 1 }, keepOpen: true })
      prevCustomerRef.current = customerId
    }
  }, [customerId, loadFilterSites, setSiteId])

  // list loading is handled by useDrfList

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) {
      lastOpenRef.current = null
      return
    }
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id

    setSelectedId(id)
    setDrawerOpen(true)
    setDrawerTab(0)
    void loadDetail(id)
  }, [grid.openId, loadDetail])

  const openDrawer = React.useCallback(
    (id: number) => {
      lastOpenRef.current = id
      setSelectedId(id)
      setDrawerOpen(true)
      setDrawerTab(0)
      void loadDetail(id)
      grid.setOpenId(id)
    },
    [grid, loadDetail],
  )

  // ── Azioni riga / menu contestuale ──────────────────────────────────────────
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{
    row: InventoryRow
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
        await api.post(itemActionPath(INVENTORIES_PATH, id, 'restore'))
        toast.success('Inventario ripristinato ✅')
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setRestoreBusy(false)
      }
    },
    [toast, reloadList],
  )

  const openIssueFromRow = React.useCallback(
    (row: InventoryRow) => {
      navigate('/issues', {
        state: {
          createFromInventory: {
            inventoryId: row.id,
            inventoryName: row.name || row.hostname || row.knumber || `Inventory #${row.id}`,
            inventoryKnumber: row.knumber ?? null,
            inventorySerialNumber: row.serial_number ?? null,
            inventoryHostname: row.hostname ?? null,
            customerId: row.customer,
            customerName: row.customer_name || row.customer_code || `Customer #${row.customer}`,
            siteId: row.site ?? null,
          },
        },
      })
    },
    [navigate],
  )

  React.useEffect(() => {
    if (!detail) return
    if (pendingEditIdRef.current === detail.id) {
      pendingEditIdRef.current = null
      openEdit()
    }
    if (pendingDeleteIdRef.current === detail.id) {
      pendingDeleteIdRef.current = null
      setDeleteDlgOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

  const handleRowContextMenu = React.useCallback(
    (row: InventoryRow, event: React.MouseEvent<HTMLElement>) => {
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
      {
        key: 'open-issue',
        label: 'Apri issue',
        icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
        onClick: () => openIssueFromRow(row),
      },
    ]
  }, [
    contextMenu,
    deleteBusy,
    openDeleteFromRow,
    openDrawer,
    openEditFromRow,
    openIssueFromRow,
    restoreBusy,
    restoreFromRow,
  ])

  const columns = React.useMemo<GridColDef<InventoryRow>[]>(() => {
    return cols
  }, [])

  // Configurazione filtri URL per il kebab/imbuto delle colonne
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_display_name: {
      value: customerId,
      label: 'Filtra per cliente',
      onSet: (v) => setCustomerId(v as number | '', { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setCustomerId('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Cliente</InputLabel>
          <Select
            label="Cliente"
            value={customerId === '' ? '' : String(customerId)}
            onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value), { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
      ),
    },
    site_display_name: {
      value: siteId,
      label: 'Filtra per sito',
      onSet: (v) => setSiteId(v as number | '', { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setSiteId('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Sito</InputLabel>
          <Select
            label="Sito"
            value={siteId === '' ? '' : String(siteId)}
            onChange={(e) => setSiteId(e.target.value === '' ? '' : Number(e.target.value), { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            {filterSites.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.display_name || s.name}</MenuItem>)}
          </Select>
        </FormControl>
      ),
    },
    type_label: {
      value: typeId,
      label: 'Filtra per tipo',
      onSet: (v) => setTypeId(v as number | '', { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setTypeId('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Tipo</InputLabel>
          <Select
            label="Tipo"
            value={typeId === '' ? '' : String(typeId)}
            onChange={(e) => setTypeId(e.target.value === '' ? '' : Number(e.target.value), { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            {types.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>
      ),
    },
  }), [customerId, siteId, typeId, setCustomerId, setSiteId, setTypeId, customers, filterSites, types])

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => {
    return new URLSearchParams(loc.search).get('return')
  }, [loc.search])

  const closeDrawer = () => {
    lastOpenRef.current = null
    setDrawerOpen(false)
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }

  const openCreateOnceRef = React.useRef(false)

  const openCreate = React.useCallback(async () => {
    const preCustomer = customerId !== '' ? customerId : ''
    setDlgMode('create')
    setDlgId(null)
    setForm({
      customer: preCustomer,
      site: '',
      status: '',
      type: '',
      name: '',
      knumber: '',
      serial_number: '',
      hostname: '',
      local_ip: '',
      srsa_ip: '',
      os_user: '',
      os_pwd: '',
      app_usr: '',
      app_pwd: '',
      vnc_pwd: '',
      manufacturer: '',
      model: '',
      warranty_end_date: '',
      custom_fields: {},
      notes: '',
      tags: [],
    })
    setDlgOpen(true)
    await loadSitesForDialogCustomer(preCustomer)
  }, [customerId, loadSitesForDialogCustomer])

  React.useEffect(() => {
    const stU = loc.state as unknown
    if (!isRecord(stU) || stU['openCreate'] !== true) {
      openCreateOnceRef.current = false
      return
    }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    void openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc, navigate, openCreate])

  const openEdit = async () => {
    if (!detail) return
    setDlgMode('edit')
    setDlgId(detail.id)

    const cust = detail.customer
    setForm({
      customer: cust,
      site: detail.site ?? '',
      status: detail.status ?? '',
      type: detail.type ?? '',
      name: detail.name ?? '',
      knumber: detail.knumber ?? '',
      serial_number: detail.serial_number ?? '',
      hostname: detail.hostname ?? '',
      local_ip: detail.local_ip ?? '',
      srsa_ip: detail.srsa_ip ?? '',
      os_user: detail.os_user ?? '',
      os_pwd: detail.os_pwd ?? '',
      app_usr: detail.app_usr ?? '',
      app_pwd: detail.app_pwd ?? '',
      vnc_pwd: detail.vnc_pwd ?? '',
      manufacturer: detail.manufacturer ?? '',
      model: detail.model ?? '',
      warranty_end_date: detail.warranty_end_date ?? '',
      custom_fields: detail.custom_fields ?? {},
      notes: detail.notes ?? '',
      tags: detail.tags ?? [],
    })

    setDlgOpen(true)
    setFormErrors({})
    await loadSitesForDialogCustomer(cust)
  }

  const save = async () => {
    const errs: { customer?: string; status?: string; name?: string } = {}
    if (form.customer === '') errs.customer = 'Obbligatorio'
    if (form.status === '') errs.status = 'Obbligatorio'
    if (!String(form.name).trim()) errs.name = 'Obbligatorio'
    setFormErrors(errs)
    if (Object.keys(errs).length) return

    const payload: Record<string, unknown> = {
      customer: Number(form.customer),
      site: form.site === '' ? null : Number(form.site),
      status: Number(form.status),
      type: form.type === '' ? null : Number(form.type),

      name: form.name.trim(),
      knumber: (form.knumber || '').trim() || null,
      serial_number: (form.serial_number || '').trim() || null,

      hostname: (form.hostname || '').trim() || null,
      local_ip: (form.local_ip || '').trim() || null,
      srsa_ip: (form.srsa_ip || '').trim() || null,

      os_user: (form.os_user || '').trim() || null,
      os_pwd: (form.os_pwd || '').trim() || null,
      app_usr: (form.app_usr || '').trim() || null,
      app_pwd: (form.app_pwd || '').trim() || null,
      vnc_pwd: (form.vnc_pwd || '').trim() || null,

      manufacturer: (form.manufacturer || '').trim() || null,
      model: (form.model || '').trim() || null,
      warranty_end_date: (form.warranty_end_date || '').trim() || null,

      custom_fields:
        form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: (form.notes || '').trim() || null,
      tags: form.tags.length ? form.tags : null,
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<InventoryDetail>(INVENTORIES_PATH, payload)
        id = res.data.id
        toast.success('Inventario creato ✅')
      } else {
        if (!dlgId) return
        const res = await api.patch<InventoryDetail>(itemPath(INVENTORIES_PATH, dlgId), payload)
        id = res.data.id
        toast.success('Inventario aggiornato ✅')
      }

      setDlgOpen(false)
      reloadList()
      openDrawer(id)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) {
        setFormErrors((prev) => ({ ...prev, ...feedback.fieldErrors }))
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
      await api.delete(itemPath(INVENTORIES_PATH, detail.id))
      toast.success('Inventario eliminato ✅')

      // per poterlo vedere subito nel drawer dopo il delete:
      grid.setViewMode('all', { keepOpen: true })
      reloadList()
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
      await api.post(collectionActionPath(INVENTORIES_PATH, 'bulk_restore'), { ids })
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

  const doRestore = async () => {
    if (!detail) return
    setRestoreBusy(true)
    try {
      await api.post(itemActionPath(INVENTORIES_PATH, detail.id, 'restore'))
      toast.success('Inventario ripristinato ✅')
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
        mobileCard={renderInventoryCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
        }}
        grid={{
          pageKey: 'inventory',
          username: me?.username,
          filterConfig,

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
      </EntityListCard>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      <InventoryDrawer
        open={drawerOpen}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
        canViewSecrets={canViewSecrets}
        canChange={canChange}
        canDelete={canDelete}
        drawerTab={drawerTab}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        onClose={closeDrawer}
        onTabChange={setDrawerTab}
        onEdit={openEdit}
        onDelete={() => setDeleteDlgOpen(true)}
        onRestore={doRestore}
      />

      <InventoryDialog
        open={dlgOpen}
        mode={dlgMode}
        saving={dlgSaving}
        canViewSecrets={canViewSecrets}
        errors={formErrors}
        customers={customers}
        sites={dlgSites}
        statuses={statuses}
        types={types}
        form={form}
        tagInput={tagInput}
        onClose={() => setDlgOpen(false)}
        onSave={save}
        onTagInputChange={setTagInput}
        onFormChange={setForm}
        onErrorsChange={setFormErrors}
        onCustomerChange={loadSitesForDialogCustomer}
        isFieldDisabled={df}
        fieldHelpText={dfHelp}
      />

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title="Ripristinare gli inventari selezionati?"
        description={`Verranno ripristinati ${selectedCount} inventari dal cestino.`}
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
        description="L’inventario verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />
    </Stack>
  )
}
