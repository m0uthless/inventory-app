import * as React from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { Can } from '../auth/Can'
import { useAuth } from '../auth/AuthProvider'
import type { GridColDef } from '@mui/x-data-grid'
import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import { api } from '@shared/api/client'
import { itemActionPath, itemPath, type CollectionPath } from '@shared/api/apiPaths'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import InventoryDialog from '../features/inventory/InventoryDialog'
import InventoryDetailCard, { type InventoryPatch, type InventoryTab } from '../features/inventory/InventoryDetailCard'
import InventoryKpis, { useInventorySummary } from '../features/inventory/InventoryKpis'
import { disabledFieldsFor, InventoryStatusBadge, invTypeIcon, OpenIssueMark, type InventoryFieldName } from '../features/inventory/inventoryUi'
import { AuditFeedPanel } from '../features/customers/CustomerTabs'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { buildQuery } from '@shared/utils/nav'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { isRecord } from '@shared/utils/guards'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { PageHead, ViewTabs, FilterOptionList, TableBar, CampoIcon, useSavedViews, SaveViewDialog, headerFilterGridSx, useUndoToast, type ActiveFilter } from '../ui/campo'
import { useExportCsv } from '@shared/ui/useExportCsv'

type LookupItem = { id: number; label: string; key?: string }

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
  location?: string | null
  telefono?: string | null
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
  location?: string | null
  telefono?: string | null

  type?: number | null
  type_key?: string | null
  type_label?: string | null

  status: number
  status_key?: string | null
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
  monitors?: { id: number; produttore?: string | null; modello?: string | null; seriale?: string | null; tipo_label?: string | null; stato_label?: string | null }[]
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
  location: string
  telefono: string

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


const mono = { fontFamily: '"Geist Mono", monospace' }
const dash = <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
const missing = (t: string) => <Box component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'warning.main' }}>{t}</Box>
const monoCell = (v?: string | null) => (v ? <Box component="span" sx={{ ...mono, fontSize: 12 }}>{v}</Box> : dash)

function buildColumns(): GridColDef<InventoryRow>[] {
  return [
    { field: 'id', headerName: 'ID', width: 70, align: 'right', headerAlign: 'right' },
    {
      field: 'name', headerName: 'Nome', flex: 1, minWidth: 190,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1, flex: 'none' }}><CampoIcon name={invTypeIcon(p.row.type_key)} size={15} /></Box>
          <Box component="span" sx={{ fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.name}</Box>
          {p.row.has_active_issue ? <OpenIssueMark priority={p.row.active_issue_priority} /> : null}
        </Box>
      ),
    },
    { field: 'type_label', headerName: 'Tipo', width: 120, renderCell: (p) => p.row.type_label || dash },
    { field: 'hostname', headerName: 'Hostname', width: 140, renderCell: (p) => monoCell(p.row.hostname) },
    {
      field: 'customer_name', headerName: 'Cliente', width: 140,
      renderCell: (p) => <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.customer_name || '—'}</Box>,
    },
    {
      field: 'site_name', headerName: 'Sito', width: 140,
      renderCell: (p) => p.row.site ? <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.site_display_name || p.row.site_name}</Box> : missing('Nessun sito'),
    },
    { field: 'status_label', headerName: 'Stato', width: 150, renderCell: (p) => <InventoryStatusBadge statusKey={p.row.status_key} label={p.row.status_label} /> },
    { field: 'local_ip', headerName: 'IP locale', width: 120, renderCell: (p) => (p.row.local_ip ? monoCell(p.row.local_ip) : missing('Manca')) },
    { field: 'knumber', headerName: 'K-Number', width: 120, renderCell: (p) => monoCell(p.row.knumber) },
    { field: 'serial_number', headerName: 'Seriale', width: 140, renderCell: (p) => monoCell(p.row.serial_number) },
    { field: 'srsa_ip', headerName: 'IP SRSA', width: 120, renderCell: (p) => monoCell(p.row.srsa_ip) },
    { field: 'location', headerName: 'Posizione', width: 140 },
  ]
}

const renderInventoryCard: MobileCardRenderFn<InventoryRow> = ({ row, onOpen }) => (
  <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, cursor: 'pointer', display: 'grid', gap: 0.75, '&:active': { bgcolor: 'action.hover' } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 1 }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CampoIcon name={invTypeIcon(row.type_key)} size={16} /></Box>
      <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, minWidth: 0, flex: 1 }}>{row.name}</Typography>
      {row.has_active_issue ? <OpenIssueMark priority={row.active_issue_priority} /> : null}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', minWidth: 0 }}>{[row.type_label, row.customer_name, row.site_display_name || row.site_name].filter(Boolean).join(' · ')}</Typography>
      <InventoryStatusBadge statusKey={row.status_key} label={row.status_label} />
    </Box>
    {row.hostname || row.local_ip ? <Typography noWrap sx={{ fontSize: 12, ...mono }}>{[row.hostname, row.local_ip].filter(Boolean).join(' · ')}</Typography> : null}
  </Box>
)

type InvView = 'all' | 'iss' | 'nop' | 'inc'
type ColQ = { name: string; hostname: string; customer: string; site: string; status: string; type: string; ip: string; code: string }
const EMPTY_COLQ: ColQ = { name: '', hostname: '', customer: '', site: '', status: '', type: '', ip: '', code: '' }
type ViewState = { view: InvView; customer: number | ''; site: number | ''; type: number | '' }

const emptyForm = (customer: number | '' = ''): InventoryForm => ({
  customer, site: '', status: '', type: '', name: '', knumber: '', serial_number: '', hostname: '', local_ip: '', srsa_ip: '',
  location: '', telefono: '', os_user: '', os_pwd: '', app_usr: '', app_pwd: '', vnc_pwd: '', manufacturer: '', model: '',
  warranty_end_date: '', custom_fields: {}, notes: '', tags: [],
})

export default function Inventory() {
  const toast = useToast()
  const undoToast = useUndoToast()
  const { hasPerm, me } = useAuth()
  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets)
  const canChange = hasPerm(PERMS.inventory.inventory.change)
  const canDelete = hasPerm(PERMS.inventory.inventory.delete)
  const navigate = useNavigate()
  const loc = useLocation()

  const grid = useServerGrid({
    defaultOrdering: 'name',
    allowedOrderingFields: ['id', 'name', 'customer_name', 'site_name', 'hostname', 'knumber', 'serial_number', 'type_label', 'status_label', 'local_ip', 'srsa_ip'],
    defaultPageSize: 25,
  })

  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: InvView = (['all', 'iss', 'nop', 'inc'] as const).includes(viewRaw as InvView) ? (viewRaw as InvView) : 'all'
  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [siteId, setSiteId] = useUrlNumberParam('site')
  const [typeId, setTypeId] = useUrlNumberParam('type')
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const [colSearchOpen, setColSearchOpen] = React.useState(false)
  const [colQ, setColQ] = React.useState<ColQ>(EMPTY_COLQ)
  const colQActive = Object.values(colQ).some(Boolean)
  const setCol = (k: keyof ColQ) => (v: string) => { setColQ((c) => ({ ...c, [k]: v })); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }
  const hasActiveFilters = customerId !== '' || siteId !== '' || typeId !== ''
  const resetFilters = React.useCallback(() => { setCustomerId('', { patch: { page: 1, site: '', type: '' }, keepOpen: true }) }, [setCustomerId])

  const saved = useSavedViews<ViewState>('inventory', me?.username)
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const setView = (v: string) => { setSavedId(null); setViewRaw(v === 'all' ? '' : v, filterOpts) }
  const applySaved = (id: string) => {
    const v = saved.views.find((x) => x.id === id); if (!v) return
    setSavedId(id)
    const str = (n: number | '') => (n === '' ? '' : String(n))
    setViewRaw(v.state.view === 'all' ? '' : v.state.view, { patch: { page: 1, customer: str(v.state.customer), site: str(v.state.site), type: str(v.state.type) }, keepOpen: true })
  }

  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim()) || colQActive
    if (grid.view === 'deleted' && !searching && !hasActiveFilters) return { title: 'Cestino vuoto', subtitle: 'Non ci sono inventari eliminati.' }
    if (searching || hasActiveFilters || view !== 'all') {
      return {
        title: 'Nessun risultato', subtitle: 'Nessun inventario corrisponde: prova a modificare la ricerca, la vista o i filtri.',
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {searching ? <Button variant="outlined" onClick={() => { grid.setQ(''); setColQ(EMPTY_COLQ) }}>Cancella ricerca</Button> : null}
            {hasActiveFilters ? <Button variant="outlined" onClick={resetFilters}>Azzera filtri</Button> : null}
          </Stack>
        ),
      }
    }
    return {
      title: 'Nessun inventario', subtitle: 'Non ci sono ancora inventari.',
      action: <Can perm={PERMS.inventory.inventory.add}><Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}>Crea inventario</Button></Can>,
    }
  }, [grid, colQActive, hasActiveFilters, view, resetFilters, loc.pathname, loc.search, navigate])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { customer_name: 'customer__name', site_name: 'site__name', type_label: 'type__label', status_label: 'status__label' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== '' ? { customer: customerId } : {}),
          ...(siteId !== '' ? { site: siteId } : {}),
          ...(typeId !== '' ? { type: typeId } : {}),
          ...(view === 'iss' ? { has_active_issue: 'true' } : view === 'nop' ? { not_operational: 'true' } : view === 'inc' ? { incomplete: 'true' } : {}),
          ...(colQ.name ? { name_q: colQ.name } : {}),
          ...(colQ.hostname ? { hostname_q: colQ.hostname } : {}),
          ...(colQ.customer ? { customer_q: colQ.customer } : {}),
          ...(colQ.site ? { site_q: colQ.site } : {}),
          ...(colQ.status ? { status: colQ.status } : {}),
          ...(colQ.type ? { type: colQ.type } : {}),
          ...(colQ.ip ? { ip_q: colQ.ip } : {}),
          ...(colQ.code ? { code_q: colQ.code } : {}),
        },
      }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted, customerId, siteId, typeId, view, colQ],
  )

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<InventoryRow>(INVENTORIES_PATH, listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))
  const [kpiReload, setKpiReload] = React.useState(0)
  const summary = useInventorySummary(kpiReload)
  const reloadAll = React.useCallback(() => { reloadList(); setKpiReload((n) => n + 1) }, [reloadList])

  const [customers, setCustomers] = React.useState<CustomerItem[]>([])
  const [filterSites, setFilterSites] = React.useState<SiteItem[]>([])
  const [statuses, setStatuses] = React.useState<LookupItem[]>([])
  const [types, setTypes] = React.useState<LookupItem[]>([])

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [drawerTab, setDrawerTab] = React.useState<InventoryTab>('det')
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<InventoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // dialog CRUD
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [dlgSites, setDlgSites] = React.useState<SiteItem[]>([])
  const [form, setForm] = React.useState<InventoryForm>(emptyForm())
  const [formErrors, setFormErrors] = React.useState<Record<string, string | undefined>>({})
  const [tagInput, setTagInput] = React.useState('')

  // Campi non applicabili al tipo scelto nel modulo
  const selectedTypeKey = React.useMemo(() => (form.type !== '' ? (types.find((t) => t.id === form.type)?.key ?? null) : null), [form.type, types])
  const disabledFields = React.useMemo(() => disabledFieldsFor(selectedTypeKey), [selectedTypeKey])
  const df = (f: InventoryFieldName) => disabledFields.has(f)
  const dfHelp = (f: InventoryFieldName) => (df(f) ? 'Non applicabile per questo tipo' : undefined)

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>('/customers/', { params: { ordering: 'name', page_size: 500 } })
      setCustomers(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadLookups = React.useCallback(async () => {
    try {
      const [st, ty] = await Promise.all([api.get<LookupItem[]>('/inventory-statuses/'), api.get<LookupItem[]>('/inventory-types/')])
      setStatuses(st.data ?? [])
      setTypes(ty.data ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadFilterSites = React.useCallback(async () => {
    try {
      if (customerId === '') { setFilterSites([]); return }
      const res = await api.get<ApiPage<SiteItem>>('/sites/', { params: { ordering: 'name', page_size: 500, customer: customerId } })
      setFilterSites(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [customerId, toast])

  const loadSitesForDialogCustomer = React.useCallback(async (cust: number | '') => {
    try {
      if (cust === '') { setDlgSites([]); return }
      const res = await api.get<ApiPage<SiteItem>>('/sites/', { params: { ordering: 'name', page_size: 500, customer: cust } })
      setDlgSites(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean, keep?: boolean) => {
    setDetailLoading(true)
    if (!keep) setDetail(null)
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted
      const incParams = includeDeletedParams(inc)
      const res = await api.get<InventoryDetail>(itemPath(INVENTORIES_PATH, id), incParams ? { params: incParams } : undefined)
      setDetail(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }, [toast, grid.includeDeleted])

  React.useEffect(() => { loadCustomers(); loadLookups() }, [loadCustomers, loadLookups])
  React.useEffect(() => { loadFilterSites() }, [loadFilterSites])

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) { lastOpenRef.current = null; return }
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    setDrawerTab('det')
    void loadDetail(id)
  }, [grid.openId, loadDetail])

  const openDrawer = React.useCallback((id: number) => {
    lastOpenRef.current = id
    setDrawerTab((t) => (selectedId === id ? t : 'det'))
    setSelectedId(id)
    setDrawerOpen(true)
    void loadDetail(id)
    grid.setOpenId(id)
  }, [grid, loadDetail, selectedId])

  // ── Azioni riga / menu contestuale ──────────────────────────────────────────
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void | Promise<void>) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{ row: InventoryRow; mouseX: number; mouseY: number } | null>(null)

  const openEditFromRow = React.useCallback((id: number) => { pendingEditIdRef.current = id; openDrawer(id) }, [openDrawer])
  const openDeleteFromRow = React.useCallback((id: number) => { pendingDeleteIdRef.current = id; openDrawer(id) }, [openDrawer])
  const restoreFromRow = React.useCallback(async (id: number) => {
    setRestoreBusy(true)
    try {
      await api.post(itemActionPath(INVENTORIES_PATH, id, 'restore'))
      toast.success('Inventario ripristinato')
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [toast, reloadAll])

  const openIssueFor = React.useCallback((row: { id: number; name: string; hostname?: string | null; knumber?: string | null; serial_number?: string | null; customer: number; customer_name?: string; customer_code?: string; site?: number | null }) => {
    navigate('/issues', {
      state: {
        createFromInventory: {
          inventoryId: row.id,
          inventoryName: row.name || row.hostname || row.knumber || `Inventario #${row.id}`,
          inventoryKnumber: row.knumber ?? null,
          inventorySerialNumber: row.serial_number ?? null,
          inventoryHostname: row.hostname ?? null,
          customerId: row.customer,
          customerName: row.customer_name || row.customer_code || `Cliente #${row.customer}`,
          siteId: row.site ?? null,
        },
      },
    })
  }, [navigate])

  React.useEffect(() => {
    if (!detail) return
    if (pendingEditIdRef.current === detail.id) { pendingEditIdRef.current = null; const fn = openEditRef.current; if (fn) void fn() }
    if (pendingDeleteIdRef.current === detail.id) { pendingDeleteIdRef.current = null; setDeleteDlgOpen(true) }
  }, [detail])

  const handleRowContextMenu = React.useCallback((row: InventoryRow, event: React.MouseEvent<HTMLElement>) => {
    setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
  }, [])
  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    if (row.deleted_at) {
      return [
        { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDrawer(row.id) },
        { key: 'restore', label: 'Ripristina', icon: <RestoreFromTrashIcon fontSize="small" />, onClick: () => void restoreFromRow(row.id), disabled: restoreBusy },
      ]
    }
    return [
      { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDrawer(row.id) },
      { key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => openEditFromRow(row.id) },
      { key: 'issue', label: 'Nuova issue', icon: <AddIcon fontSize="small" />, onClick: () => openIssueFor(row) },
      ...(row.hostname ? [{ key: 'host', label: "Copia l'hostname", icon: <CampoIcon name="copy" />, onClick: async () => { await copyToClipboard(row.hostname!); toast.success('Copiato') } }] : []),
      ...(row.local_ip ? [{ key: 'ip', label: "Copia l'IP locale", icon: <CampoIcon name="copy" />, onClick: async () => { await copyToClipboard(row.local_ip!); toast.success('Copiato') } }] : []),
      { key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => openDeleteFromRow(row.id), disabled: deleteBusy, tone: 'danger' as const },
    ]
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, openIssueFor, restoreBusy, restoreFromRow, toast])

  const columns = React.useMemo<GridColDef<InventoryRow>[]>(() => buildColumns(), [])

  const customerLabel = (id: number | '') => { const c = customers.find((x) => x.id === id); return c ? c.name : String(id) }
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_name: {
      value: customerId === '' ? '' : String(customerId),
      label: 'Filtra cliente',
      onSet: (v) => setCustomerId(v === '' ? '' : Number(v), { patch: { page: 1, site: '' }, keepOpen: true }),
      onReset: () => setCustomerId('', { patch: { page: 1, site: '' }, keepOpen: true }),
      children: <FilterOptionList label="Cliente" single searchable options={customers.map((c) => ({ value: String(c.id), label: c.name }))}
        selected={customerId === '' ? [] : [String(customerId)]} onChange={(vals) => setCustomerId(vals[0] ? Number(vals[0]) : '', { patch: { page: 1, site: '' }, keepOpen: true })} />,
    },
    ...(customerId !== '' ? {
      site_name: {
        value: siteId === '' ? '' : String(siteId),
        label: 'Filtra sito',
        onSet: (v: string | number | '') => setSiteId(v === '' ? '' : Number(v), filterOpts),
        onReset: () => setSiteId('', filterOpts),
        children: <FilterOptionList label="Sito" single options={filterSites.map((st) => ({ value: String(st.id), label: st.display_name || st.name }))}
          selected={siteId === '' ? [] : [String(siteId)]} onChange={(vals) => setSiteId(vals[0] ? Number(vals[0]) : '', filterOpts)} />,
      },
    } : {}),
    type_label: {
      value: typeId === '' ? '' : String(typeId),
      label: 'Filtra tipo',
      onSet: (v) => setTypeId(v === '' ? '' : Number(v), filterOpts),
      onReset: () => setTypeId('', filterOpts),
      children: <FilterOptionList label="Tipo" single searchable options={types.map((t) => ({ value: String(t.id), label: t.label }))}
        selected={typeId === '' ? [] : [String(typeId)]} onChange={(vals) => setTypeId(vals[0] ? Number(vals[0]) : '', filterOpts)} />,
    },
  }), [customerId, siteId, typeId, setCustomerId, setSiteId, setTypeId, customers, filterSites, types, filterOpts])

  const activeFilters: ActiveFilter[] = [
    customerId !== '' ? { key: 'customer', label: 'Cliente', values: customerLabel(customerId) } : null,
    siteId !== '' ? { key: 'site', label: 'Sito', values: (() => { const st = filterSites.find((x) => x.id === siteId); return st ? st.display_name || st.name : String(siteId) })() } : null,
    typeId !== '' ? { key: 'type', label: 'Tipo', values: types.find((t) => t.id === typeId)?.label ?? String(typeId) } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'customer') setCustomerId('', { patch: { page: 1, site: '' }, keepOpen: true })
    if (key === 'site') setSiteId('', filterOpts)
    if (key === 'type') setTypeId('', filterOpts)
  }

  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<InventoryRow>({
      url: INVENTORIES_PATH, params, filename: 'inventari',
      columns: [
        { label: 'Nome', getValue: (r) => r.name },
        { label: 'Tipo', getValue: (r) => r.type_label ?? '' },
        { label: 'Stato', getValue: (r) => r.status_label ?? '' },
        { label: 'Cliente', getValue: (r) => r.customer_name ?? '' },
        { label: 'Sito', getValue: (r) => r.site_display_name || r.site_name || '' },
        { label: 'Hostname', getValue: (r) => r.hostname ?? '' },
        { label: 'IP locale', getValue: (r) => r.local_ip ?? '' },
        { label: 'IP SRSA', getValue: (r) => r.srsa_ip ?? '' },
        { label: 'K-Number', getValue: (r) => r.knumber ?? '' },
        { label: 'Seriale', getValue: (r) => r.serial_number ?? '' },
        { label: 'Posizione', getValue: (r) => r.location ?? '' },
      ],
    })
  }

  const returnTo = React.useMemo(() => new URLSearchParams(loc.search).get('return'), [loc.search])
  const closeDrawer = () => {
    lastOpenRef.current = null
    setDrawerOpen(false)
    setSelectedId(null)
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }

  const openCreateOnceRef = React.useRef(false)
  const openCreate = React.useCallback(async () => {
    const preCustomer = customerId !== '' ? customerId : ''
    setDlgMode('create')
    setDlgId(null)
    setForm({ ...emptyForm(preCustomer), site: siteId !== '' ? siteId : '' })
    setFormErrors({})
    setDlgOpen(true)
    await loadSitesForDialogCustomer(preCustomer)
  }, [customerId, siteId, loadSitesForDialogCustomer])

  React.useEffect(() => {
    const stU = loc.state as unknown
    if (!isRecord(stU) || stU['openCreate'] !== true) { openCreateOnceRef.current = false; return }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    void openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc, navigate, openCreate])

  const openEdit = React.useCallback(async () => {
    if (!detail) return
    setDlgMode('edit')
    setDlgId(detail.id)
    const cust = detail.customer
    setForm({
      customer: cust, site: detail.site ?? '', status: detail.status ?? '', type: detail.type ?? '', name: detail.name ?? '',
      knumber: detail.knumber ?? '', serial_number: detail.serial_number ?? '', hostname: detail.hostname ?? '', local_ip: detail.local_ip ?? '',
      srsa_ip: detail.srsa_ip ?? '', location: detail.location ?? '', telefono: detail.telefono ?? '', os_user: detail.os_user ?? '',
      os_pwd: detail.os_pwd ?? '', app_usr: detail.app_usr ?? '', app_pwd: detail.app_pwd ?? '', vnc_pwd: detail.vnc_pwd ?? '',
      manufacturer: detail.manufacturer ?? '', model: detail.model ?? '', warranty_end_date: detail.warranty_end_date ?? '',
      custom_fields: detail.custom_fields ?? {}, notes: detail.notes ?? '', tags: detail.tags ?? [],
    })
    setDlgOpen(true)
    setFormErrors({})
    await loadSitesForDialogCustomer(cust)
  }, [detail, loadSitesForDialogCustomer])
  openEditRef.current = openEdit

  const save = async () => {
    const errs: { customer?: string; status?: string; name?: string } = {}
    if (form.customer === '') errs.customer = 'Obbligatorio'
    if (form.status === '') errs.status = 'Obbligatorio'
    if (!String(form.name).trim()) errs.name = 'Obbligatorio'
    setFormErrors(errs)
    if (Object.keys(errs).length) return

    const t = (v: string) => (v || '').trim() || null
    const payload: Record<string, unknown> = {
      customer: Number(form.customer), site: form.site === '' ? null : Number(form.site), status: Number(form.status), type: form.type === '' ? null : Number(form.type),
      name: form.name.trim(), knumber: t(form.knumber), serial_number: t(form.serial_number),
      hostname: t(form.hostname), local_ip: t(form.local_ip), srsa_ip: t(form.srsa_ip), location: t(form.location), telefono: t(form.telefono),
      manufacturer: t(form.manufacturer), model: t(form.model), warranty_end_date: t(form.warranty_end_date),
      custom_fields: form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: t(form.notes), tags: form.tags.length ? form.tags : null,
      // Le credenziali si inviano solo con il permesso (il backend le rifiuta altrimenti).
      ...(canViewSecrets ? { os_user: t(form.os_user), os_pwd: t(form.os_pwd), app_usr: t(form.app_usr), app_pwd: t(form.app_pwd), vnc_pwd: t(form.vnc_pwd) } : { os_user: t(form.os_user), app_usr: t(form.app_usr) }),
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<InventoryDetail>(INVENTORIES_PATH, payload)
        id = res.data.id
        toast.success('Inventario creato')
      } else {
        if (!dlgId) return
        const res = await api.patch<InventoryDetail>(itemPath(INVENTORIES_PATH, dlgId), payload)
        id = res.data.id
        toast.success('Inventario aggiornato')
      }
      setDlgOpen(false)
      reloadAll()
      openDrawer(id)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) setFormErrors((prev) => ({ ...prev, ...feedback.fieldErrors }))
      toast.error(feedback.message)
    } finally {
      setDlgSaving(false)
    }
  }

  // Modifica sul posto dalle Proprietà, con annulla.
  const patchInventory = React.useCallback(async (patch: InventoryPatch, label: string) => {
    if (!detail) return
    const id = detail.id
    const prev: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) prev[k] = (detail as Record<string, unknown>)[k] ?? null
    try {
      await api.patch(itemPath(INVENTORIES_PATH, id), patch)
      await loadDetail(id, undefined, true)
      reloadAll()
      undoToast.show(`${label} · salvato`, async () => {
        try {
          await api.patch(itemPath(INVENTORIES_PATH, id), prev)
          await loadDetail(id, undefined, true)
          reloadAll()
        } catch (e) { toast.error(apiErrorToMessage(e)) }
      })
    } catch (e) {
      toast.error(apiErrorToFormFeedback(e).message)
    }
  }, [detail, loadDetail, reloadAll, undoToast, toast])

  const doDelete = async () => {
    if (!detail) return
    setDeleteBusy(true)
    try {
      await api.delete(itemPath(INVENTORIES_PATH, detail.id))
      toast.success('Inventario eliminato')
      grid.setViewMode('all', { keepOpen: true })
      reloadAll()
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
      await api.post(itemActionPath(INVENTORIES_PATH, detail.id, 'restore'))
      toast.success('Inventario ripristinato')
      reloadAll()
      await loadDetail(detail.id)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }

  const drawerIndex = selectedId != null ? rows.findIndex((r) => r.id === selectedId) : -1
  const openColumnsRef = React.useRef<((el: HTMLElement) => void) | null>(null)

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Inventari"
        actions={<Can perm={PERMS.inventory.inventory.add}><Button startIcon={<AddIcon />} variant="contained" onClick={() => void openCreate()}>Nuovo inventario</Button></Can>}
      />
      <InventoryKpis summary={summary} view={view} onView={setView} onType={(id) => setTypeId(typeId === id ? '' : id, filterOpts)} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={savedId ? `saved:${savedId}` : view}
          onChange={(k) => { if (k.startsWith('saved:')) { applySaved(k.slice(6)); return } setView(k) }}
          tabs={[
            { key: 'all', label: 'Tutti', count: summary?.total },
            { key: 'iss', label: 'Con issue aperte', count: summary?.with_issue },
            { key: 'nop', label: 'Non operativi', count: summary?.not_operational, tone: 'alert' },
            { key: 'inc', label: 'Da completare', count: summary?.incomplete },
            ...saved.views.map((v) => ({ key: `saved:${v.id}`, label: v.name, onRemove: () => { saved.remove(v.id); setSavedId(null) } })),
          ]}
          end={
            <Button size="small" onClick={() => setSaveOpen(true)} startIcon={<CampoIcon name="plus" size={14} />}
              sx={{ color: 'primary.main', fontWeight: 550, display: { xs: 'none', sm: 'inline-flex' } }}>
              Salva vista
            </Button>
          }
        />
        <SaveViewDialog open={saveOpen} onClose={() => setSaveOpen(false)}
          onSave={(name) => { const v = saved.add(name, { view, customer: customerId, site: siteId, type: typeId }); setSavedId(v.id) }} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={renderInventoryCard}
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca nome, hostname, IP, K-Number, seriale…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
              columnSearch={{ open: colSearchOpen, active: colQActive, onToggle: () => { if (colSearchOpen) setColQ(EMPTY_COLQ); setColSearchOpen((v) => !v) } }}
            />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca inventari…' }}
          grid={{
            pageKey: 'inventory',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            defaultHiddenColumns: ['id', 'knumber', 'serial_number', 'srsa_ip', 'location'],
            columnSearch: {
              open: colSearchOpen,
              fields: {
                name: { value: colQ.name, onChange: setCol('name'), placeholder: 'Nome' },
                type_label: { value: colQ.type, onChange: setCol('type'), options: types.map((t) => ({ value: String(t.id), label: t.label })) },
                hostname: { value: colQ.hostname, onChange: setCol('hostname'), placeholder: 'Hostname' },
                customer_name: { value: colQ.customer, onChange: setCol('customer'), placeholder: 'Cliente' },
                site_name: { value: colQ.site, onChange: setCol('site'), placeholder: 'Sito o posizione' },
                status_label: { value: colQ.status, onChange: setCol('status'), options: statuses.map((s) => ({ value: String(s.id), label: s.label })) },
                local_ip: { value: colQ.ip, onChange: setCol('ip'), placeholder: 'IP' },
                knumber: { value: colQ.code, onChange: setCol('code'), placeholder: 'K# o seriale' },
                serial_number: { value: colQ.code, onChange: setCol('code'), placeholder: 'K# o seriale' },
                srsa_ip: { value: colQ.ip, onChange: setCol('ip'), placeholder: 'IP' },
              },
            },
            rows,
            columns,
            loading,
            rowCount,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: openDrawer,
            onRowContextMenu: handleRowContextMenu,
            getRowClassName: (row) => (drawerOpen && selectedId === row.id ? 'Mui-selected' : undefined),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {drawerOpen ? (
        <InventoryDetailCard
          detail={detail}
          loading={detailLoading}
          statuses={statuses}
          types={types}
          canChange={canChange}
          canDelete={canDelete}
          canViewSecrets={canViewSecrets}
          canViewMaintenance={hasPerm(PERMS.maintenance.event.view)}
          canUploadReports={hasPerm(PERMS.maintenance.event.change)}
          tab={drawerTab}
          onTab={setDrawerTab}
          position={drawerIndex >= 0 ? `${drawerIndex + 1} di ${rows.length}` : undefined}
          onPrev={drawerIndex > 0 ? () => openDrawer(rows[drawerIndex - 1].id) : undefined}
          onNext={drawerIndex >= 0 && drawerIndex < rows.length - 1 ? () => openDrawer(rows[drawerIndex + 1].id) : undefined}
          onClose={closeDrawer}
          onEdit={() => void openEdit()}
          onDelete={() => setDeleteDlgOpen(true)}
          onRestore={() => void doRestore()}
          onPatch={(patch, label) => void patchInventory(patch, label)}
          onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
          onNewIssue={() => { if (detail) openIssueFor(detail) }}
          onOpenCustomer={() => { if (detail) navigate(`/customers${buildQuery({ open: detail.customer })}`) }}
          onOpenSite={() => { if (detail?.site) navigate(`/sites${buildQuery({ open: detail.site })}`) }}
          activityTab={detail ? <AuditFeedPanel appLabel="inventory" model="inventory" objectId={detail.id} noun="l'inventario"
            fields={{ name: 'il nome', hostname: "l'hostname", local_ip: "l'IP locale", srsa_ip: "l'IP SRSA", knumber: 'il K-Number', serial_number: 'il seriale', status: 'lo stato', type: 'il tipo', site: 'il sito', location: 'la posizione', telefono: 'il telefono', manufacturer: 'il produttore', model: 'il modello', warranty_end_date: 'la fine garanzia', notes: 'le note', os_user: "l'utente OS", app_usr: "l'utente app", os_pwd: 'la password OS', app_pwd: 'la password app', vnc_pwd: 'la password VNC', tags: 'i tag', custom_fields: 'i campi personalizzati' }} /> : null}
        />
      ) : null}

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
