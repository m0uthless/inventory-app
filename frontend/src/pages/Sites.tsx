import * as React from 'react'
import { Box, Button, ButtonBase, Stack, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import type { GridColDef } from '@mui/x-data-grid'
import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import { api } from '@shared/api/client'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import SiteDialog from '../features/sites/SiteDialog'
import SiteDetailModal from '../features/sites/SiteDetailModal'
import SiteKpis, { useSiteSummary } from '../features/sites/SiteKpis'
import { SiteStatusBadge } from '../features/sites/siteUi'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { buildQuery } from '@shared/utils/nav'
import { isRecord } from '@shared/utils/guards'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { PageHead, ViewTabs, FilterOptionList, TableBar, CampoIcon, useSavedViews, SaveViewDialog, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import { useExportCsv } from '@shared/ui/useExportCsv'

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

  status_key?: string | null
  city?: string | null
  province?: string | null
  assets_count?: number
  open_issues_count?: number
  contacts_count?: number
  primary_contact_id?: number | null
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


const numCell = (v?: number | null) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{v ?? 0}</Box>
const missing = (t: string) => <Box component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'warning.main' }}>{t}</Box>
const placeOf = (r: SiteRow) => [[r.postal_code, r.city].filter(Boolean).join(' '), r.province].filter(Boolean).join(' · ')

function buildColumns(onIssues: (row: SiteRow) => void): GridColDef<SiteRow>[] {
  return [
    { field: 'id', headerName: 'ID', width: 70, align: 'right', headerAlign: 'right' },
    {
      field: 'display_name', headerName: 'Sito', flex: 1, minWidth: 180,
      renderCell: (p) => <Box component="span" sx={{ fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.display_name || p.row.name}</Box>,
    },
    {
      field: 'customer_display_name', headerName: 'Cliente', width: 150,
      renderCell: (p) => <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.customer_display_name || p.row.customer_name || '—'}</Box>,
    },
    {
      field: 'status_label', headerName: 'Stato', width: 176,
      renderCell: (p) => <SiteStatusBadge statusKey={p.row.status_key} label={p.row.status_label} />,
    },
    {
      field: 'city', headerName: 'Indirizzo', width: 200,
      renderCell: (p) => {
        const r = p.row
        const place = placeOf(r)
        if (!r.address_line1 && !place) return missing('Nessun indirizzo')
        return (
          <Box sx={{ minWidth: 0, lineHeight: 1.25 }}>
            {r.address_line1 ? <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address_line1}</Box> : missing('Nessun indirizzo')}
            {place ? <Box sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place}</Box> : null}
          </Box>
        )
      },
    },
    {
      field: 'primary_contact_name', headerName: 'Referente', width: 148,
      renderCell: (p) => {
        const r = p.row
        if (!r.primary_contact_name) return missing('Nessun referente')
        const tip = [r.primary_contact_phone, r.primary_contact_email].filter(Boolean).join(' · ')
        return tip ? <Tooltip title={tip}><span>{r.primary_contact_name}</span></Tooltip> : <span>{r.primary_contact_name}</span>
      },
    },
    { field: 'assets_count', headerName: 'Inventari', width: 78, align: 'right', headerAlign: 'right', renderCell: (p) => numCell(p.row.assets_count) },
    {
      field: 'open_issues_count', headerName: 'Issue', width: 70, align: 'right', headerAlign: 'right',
      renderCell: (p) => p.row.open_issues_count ? (
        <Tooltip title={`${p.row.open_issues_count} issue aperte · apri l'elenco`}>
          <ButtonBase onClick={(e) => { e.stopPropagation(); onIssues(p.row) }} sx={{
            minWidth: 24, height: 22, px: '7px', borderRadius: '5px', bgcolor: 'archie.neutralBg', color: 'text.primary', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
            '&:hover': { bgcolor: 'archie.field', color: 'primary.main' },
          }}>{p.row.open_issues_count}</ButtonBase>
        </Tooltip>
      ) : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>,
    },
    { field: 'postal_code', headerName: 'CAP', width: 80 },
  ]
}

function renderSiteCard(): MobileCardRenderFn<SiteRow> {
  return ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, cursor: 'pointer', display: 'grid', gap: 0.75, '&:active': { bgcolor: 'action.hover' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{row.display_name || row.name}</Typography>
        {row.open_issues_count ? <Box component="span" sx={{ fontSize: 12, fontWeight: 600, px: '7px', borderRadius: '5px', bgcolor: 'archie.neutralBg' }}>{row.open_issues_count}</Box> : null}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, fontSize: 13, minWidth: 0 }}>
        <Box component="span" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customer_display_name || row.customer_name}</Box>
        <SiteStatusBadge statusKey={row.status_key} label={row.status_label} />
      </Box>
      {row.address_line1 || row.city ? <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{[row.address_line1, row.city].filter(Boolean).join(', ')}</Typography> : null}
      {row.primary_contact_phone ? (
        <Box component="a" href={`tel:${row.primary_contact_phone.replace(/\s+/g, '')}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 44, px: 1.25, mt: 0.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider', color: 'text.primary', fontSize: 13, fontWeight: 550, textDecoration: 'none', justifySelf: 'start', '& svg': { color: 'primary.main' } }}>
          <CampoIcon name="phone" size={16} bold />{row.primary_contact_name ? `${row.primary_contact_name} · ` : ''}<Box component="span" sx={{ fontFamily: '"Geist Mono", monospace' }}>{row.primary_contact_phone}</Box>
        </Box>
      ) : null}
    </Box>
  )
}

type SiteView = 'all' | 'iss' | 'noinv' | 'inc'
type ColQ = { name: string; customer: string; status: string; city: string; contact: string }
const EMPTY_COLQ: ColQ = { name: '', customer: '', status: '', city: '', contact: '' }
type ViewState = { view: SiteView; customer: number | ''; status: string }

export default function Sites() {
  const { me, hasPerm } = useAuth()
  const canChange = hasPerm(PERMS.crm.site.change)
  const canDelete = hasPerm(PERMS.crm.site.delete)
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const grid = useServerGrid({
    defaultOrdering: 'display_name',
    allowedOrderingFields: ['id', 'display_name', 'customer_display_name', 'city', 'postal_code', 'status_label', 'primary_contact_name', 'assets_count', 'open_issues_count'],
    defaultPageSize: 25,
  })

  // Vista, filtri da intestazione (URL) e ricerca per colonna
  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: SiteView = (['all', 'iss', 'noinv', 'inc'] as const).includes(viewRaw as SiteView) ? (viewRaw as SiteView) : 'all'
  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [statusFilter, setStatusFilter] = useUrlStringParam('status')
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const [colSearchOpen, setColSearchOpen] = React.useState(false)
  const [colQ, setColQ] = React.useState<ColQ>(EMPTY_COLQ)
  const colQActive = Object.values(colQ).some(Boolean)
  const setCol = (k: keyof ColQ) => (v: string) => { setColQ((c) => ({ ...c, [k]: v })); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }
  const hasActiveFilters = customerId !== '' || Boolean(statusFilter)
  const resetFilters = React.useCallback(() => { setCustomerId('', { patch: { page: 1, status: '' }, keepOpen: true }) }, [setCustomerId])

  const saved = useSavedViews<ViewState>('sites', me?.username)
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const setView = (v: string) => { setSavedId(null); setViewRaw(v === 'all' ? '' : v, filterOpts) }
  const applySaved = (id: string) => {
    const v = saved.views.find((x) => x.id === id); if (!v) return
    setSavedId(id)
    setViewRaw(v.state.view === 'all' ? '' : v.state.view, { patch: { page: 1, customer: v.state.customer === '' ? '' : String(v.state.customer), status: v.state.status }, keepOpen: true })
  }

  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim()) || colQActive
    if (grid.view === 'deleted' && !searching && !hasActiveFilters) return { title: 'Cestino vuoto', subtitle: 'Non ci sono siti eliminati.' }
    if (searching || hasActiveFilters || view !== 'all') {
      return {
        title: 'Nessun risultato', subtitle: 'Nessun sito corrisponde: prova a modificare la ricerca, la vista o i filtri.',
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {searching ? <Button variant="outlined" onClick={() => { grid.setQ(''); setColQ(EMPTY_COLQ) }}>Cancella ricerca</Button> : null}
            {hasActiveFilters ? <Button variant="outlined" onClick={resetFilters}>Azzera filtri</Button> : null}
          </Stack>
        ),
      }
    }
    return {
      title: 'Nessun sito', subtitle: 'Non ci sono ancora siti.',
      action: <Can perm={PERMS.crm.site.add}><Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}>Crea sito</Button></Can>,
    }
  }, [grid, colQActive, hasActiveFilters, view, resetFilters, loc.pathname, loc.search, navigate])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { display_name: 'name', customer_display_name: 'customer__name', status_label: 'status__label' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== '' ? { customer: customerId } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(view === 'iss' ? { has_open_issues: 'true' } : view === 'noinv' ? { has_inventories: 'false' } : view === 'inc' ? { incomplete: 'true' } : {}),
          ...(colQ.name ? { name_q: colQ.name } : {}),
          ...(colQ.customer ? { customer_q: colQ.customer } : {}),
          ...(colQ.status ? { status: colQ.status } : {}),
          ...(colQ.city ? { city_q: colQ.city } : {}),
          ...(colQ.contact ? { contact_q: colQ.contact } : {}),
        },
      }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted, customerId, statusFilter, view, colQ],
  )

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<SiteRow>('/sites/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))
  const [kpiReload, setKpiReload] = React.useState(0)
  const summary = useSiteSummary(kpiReload)
  const reloadAll = React.useCallback(() => { reloadList(); setKpiReload((n) => n + 1) }, [reloadList])

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([])
  const [statuses, setStatuses] = React.useState<LookupItem[]>([])

  // pannello
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<SiteDetail | null>(null)

  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // dialog CRUD
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [dlgErrors, setDlgErrors] = React.useState<Record<string, string>>({})
  const emptyForm = (): SiteForm => ({ customer: customerId !== '' ? customerId : '', status: '', name: '', display_name: '', address_line1: '', city: '', postal_code: '', province: '', country: 'IT', custom_fields: {}, notes: '' })
  const [form, setForm] = React.useState<SiteForm>(emptyForm)

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>('/customers/', { params: { page_size: 500, ordering: 'name' } })
      setCustomers(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadStatuses = React.useCallback(async () => {
    try {
      const res = await api.get<LookupItem[] | ApiPage<LookupItem>>('/site-statuses/')
      const d = res.data
      setStatuses((Array.isArray(d) ? d : d.results ?? []).slice().sort((a, b) => a.id - b.id))
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean, keep?: boolean) => {
    if (!keep) setDetail(null)
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted
      const incParams = includeDeletedParams(inc)
      const res = await api.get<SiteDetail>(`/sites/${id}/`, incParams ? { params: incParams } : undefined)
      setDetail(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast, grid.includeDeleted])

  React.useEffect(() => { loadCustomers(); loadStatuses() }, [loadCustomers, loadStatuses])

  const returnTo = React.useMemo(() => new URLSearchParams(loc.search).get('return'), [loc.search])
  const lastOpenRef = React.useRef<number | null>(null)
  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    lastOpenRef.current = null
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }, [grid, returnTo, navigate])

  // open drawer from URL (?open=ID)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id)
  }, [grid.openId, loadDetail])

  // `keep`: passando al precedente/successivo la finestra resta quella di prima finché arriva il nuovo sito.
  const openDrawer = React.useCallback((id: number, keep?: boolean) => {
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id, undefined, keep)
    grid.setOpenId(id)
  }, [grid, loadDetail])

  const doDelete = React.useCallback(async () => {
    if (!selectedId) return
    setDeleteBusy(true)
    try {
      await api.delete(`/sites/${selectedId}/`)
      toast.success('Sito eliminato')
      setDeleteDlgOpen(false)
      closeDrawer()
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }, [selectedId, toast, closeDrawer, reloadAll])

  const doRestore = React.useCallback(async () => {
    if (!selectedId) return
    setRestoreBusy(true)
    try {
      await api.post(`/sites/${selectedId}/restore/`)
      toast.success('Sito ripristinato')
      await loadDetail(selectedId)
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [selectedId, toast, loadDetail, reloadAll])

  // ── Azioni riga / menu contestuale ──────────────────────────────────────────
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{ row: SiteRow; mouseX: number; mouseY: number } | null>(null)

  const openEditFromRow = React.useCallback((id: number) => { pendingEditIdRef.current = id; openDrawer(id) }, [openDrawer])
  const openDeleteFromRow = React.useCallback((id: number) => { pendingDeleteIdRef.current = id; openDrawer(id) }, [openDrawer])
  const restoreFromRow = React.useCallback(async (id: number) => {
    setRestoreBusy(true)
    try {
      await api.post(`/sites/${id}/restore/`)
      toast.success('Sito ripristinato')
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [toast, reloadAll])

  React.useEffect(() => {
    if (!detail) return
    if (pendingEditIdRef.current === detail.id) { pendingEditIdRef.current = null; openEditRef.current?.() }
    if (pendingDeleteIdRef.current === detail.id) { pendingDeleteIdRef.current = null; setDeleteDlgOpen(true) }
  }, [detail])

  const handleRowContextMenu = React.useCallback((row: SiteRow, event: React.MouseEvent<HTMLElement>) => {
    setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
  }, [])
  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  const newIssueFor = React.useCallback((r: { id: number; customer?: number | null; customer_display_name?: string | null; customer_name?: string | null }) => {
    if (!r.customer) return
    navigate('/issues', { state: { createForCustomer: { customerId: r.customer, customerName: r.customer_display_name || r.customer_name || '', siteId: r.id } } })
  }, [navigate])

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
      { key: 'issue', label: 'Nuova issue', icon: <AddIcon fontSize="small" />, onClick: () => newIssueFor(row) },
      { key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => openDeleteFromRow(row.id), disabled: deleteBusy, tone: 'danger' },
    ]
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, restoreBusy, restoreFromRow, newIssueFor])

  const openIssues = React.useCallback((row: SiteRow) => { navigate(`/issues${buildQuery({ cliente: row.name })}`) }, [navigate])
  const columns = React.useMemo<GridColDef<SiteRow>[]>(() => buildColumns(openIssues), [openIssues])
  const siteCard = React.useMemo(() => renderSiteCard(), [])

  const customerLabel = (id: number | '') => { const c = customers.find((x) => x.id === id); return c ? c.display_name || c.name || `#${c.id}` : String(id) }
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_display_name: {
      value: customerId === '' ? '' : String(customerId),
      label: 'Filtra cliente',
      onSet: (v) => setCustomerId(v === '' ? '' : Number(v), filterOpts),
      onReset: () => setCustomerId('', filterOpts),
      children: <FilterOptionList label="Cliente" single searchable options={customers.map((c) => ({ value: String(c.id), label: c.display_name || c.name || `#${c.id}` }))}
        selected={customerId === '' ? [] : [String(customerId)]} onChange={(vals) => setCustomerId(vals[0] ? Number(vals[0]) : '', filterOpts)} />,
    },
    status_label: {
      value: statusFilter,
      label: 'Filtra stato',
      onSet: (v) => setStatusFilter(String(v), filterOpts),
      onReset: () => setStatusFilter('', filterOpts),
      children: <FilterOptionList label="Stato" single options={statuses.map((s) => ({ value: String(s.id), label: s.label }))}
        selected={statusFilter ? [statusFilter] : []} onChange={(vals) => setStatusFilter(vals[0] ?? '', filterOpts)} />,
    },
  }), [customerId, setCustomerId, customers, statusFilter, setStatusFilter, statuses, filterOpts])

  const activeFilters: ActiveFilter[] = [
    customerId !== '' ? { key: 'customer', label: 'Cliente', values: customerLabel(customerId) } : null,
    statusFilter ? { key: 'status', label: 'Stato', values: statuses.find((s) => String(s.id) === statusFilter)?.label ?? statusFilter } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'customer') setCustomerId('', filterOpts)
    if (key === 'status') setStatusFilter('', filterOpts)
  }

  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<SiteRow>({
      url: '/sites/', params, filename: 'siti',
      columns: [
        { label: 'Sito', getValue: (r) => r.display_name || r.name },
        { label: 'Cliente', getValue: (r) => r.customer_display_name || r.customer_name || '' },
        { label: 'Stato', getValue: (r) => r.status_label ?? '' },
        { label: 'Indirizzo', getValue: (r) => r.address_line1 ?? '' },
        { label: 'CAP', getValue: (r) => r.postal_code ?? '' },
        { label: 'Città', getValue: (r) => r.city ?? '' },
        { label: 'Provincia', getValue: (r) => r.province ?? '' },
        { label: 'Referente', getValue: (r) => r.primary_contact_name ?? '' },
        { label: 'Telefono', getValue: (r) => r.primary_contact_phone ?? '' },
        { label: 'Inventari', getValue: (r) => String(r.assets_count ?? 0) },
        { label: 'Issue aperte', getValue: (r) => String(r.open_issues_count ?? 0) },
      ],
    })
  }

  const openCreateOnceRef = React.useRef(false)
  const openCreate = React.useCallback(() => {
    setDlgMode('create')
    setDlgId(null)
    setDlgErrors({})
    setForm(emptyForm())
    setDlgOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  React.useEffect(() => {
    const stU = loc.state as unknown
    if (!isRecord(stU) || stU['openCreate'] !== true) { openCreateOnceRef.current = false; return }
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
      customer: detail.customer ?? '', status: detail.status ?? '', name: detail.name ?? '', display_name: detail.display_name ?? '',
      address_line1: detail.address_line1 ?? '', city: detail.city ?? '', postal_code: detail.postal_code ?? '', province: detail.province ?? '',
      country: detail.country ?? 'IT', custom_fields: detail.custom_fields ?? {}, notes: detail.notes ?? '',
    })
    setDlgOpen(true)
  }, [detail])
  openEditRef.current = openEdit

  const save = async () => {
    const clientErrors: Record<string, string> = {}
    if (form.customer === '') clientErrors.customer = 'Seleziona un cliente.'
    if (form.status === '') clientErrors.status = 'Seleziona uno stato.'
    if (!String(form.name).trim()) clientErrors.name = 'Il nome è obbligatorio.'
    if (Object.keys(clientErrors).length) { setDlgErrors(clientErrors); return }
    setDlgErrors({})

    const payload: Record<string, unknown> = {
      customer: Number(form.customer), status: Number(form.status), name: form.name.trim(),
      display_name: (form.display_name || '').trim() || form.name.trim(),
      address_line1: (form.address_line1 || '').trim() || null, city: (form.city || '').trim() || null,
      postal_code: (form.postal_code || '').trim() || null, province: (form.province || '').trim() || null,
      country: (form.country || '').trim() || 'IT',
      custom_fields: form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
      notes: (form.notes || '').trim() || null,
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<SiteDetail>('/sites/', payload)
        id = res.data.id
        toast.success('Sito creato')
      } else {
        if (!dlgId) return
        const res = await api.patch<SiteDetail>(`/sites/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Sito aggiornato')
      }
      setDlgOpen(false)
      reloadAll()
      openDrawer(id)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) { setDlgErrors(feedback.fieldErrors); toast.warning(feedback.message) } else toast.error(feedback.message)
    } finally {
      setDlgSaving(false)
    }
  }

  const drawerIndex = selectedId != null ? rows.findIndex((r) => r.id === selectedId) : -1
  const openColumnsRef = React.useRef<((el: HTMLElement) => void) | null>(null)

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Siti"
        actions={<Can perm={PERMS.crm.site.add}><Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>Nuovo sito</Button></Can>}
      />
      <SiteKpis summary={summary} view={view} onView={setView}
        onCustomer={(id) => setCustomerId(customerId === id ? '' : id, filterOpts)} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={savedId ? `saved:${savedId}` : view}
          onChange={(k) => { if (k.startsWith('saved:')) { applySaved(k.slice(6)); return } setView(k) }}
          tabs={[
            { key: 'all', label: 'Tutti', count: summary?.total },
            { key: 'iss', label: 'Con issue aperte', count: summary?.with_open_issues },
            { key: 'noinv', label: 'Senza inventari', count: summary?.without_inventories },
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
          onSave={(name) => { const v = saved.add(name, { view, customer: customerId, status: statusFilter }); setSavedId(v.id) }} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={siteCard}
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca sito, indirizzo, città, CAP…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
              columnSearch={{ open: colSearchOpen, active: colQActive, onToggle: () => { if (colSearchOpen) setColQ(EMPTY_COLQ); setColSearchOpen((v) => !v) } }}
            />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca siti…' }}
          grid={{
            pageKey: 'sites',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            defaultHiddenColumns: ['id', 'postal_code'],
            columnSearch: {
              open: colSearchOpen,
              fields: {
                display_name: { value: colQ.name, onChange: setCol('name'), placeholder: 'Nome del sito' },
                customer_display_name: { value: colQ.customer, onChange: setCol('customer'), placeholder: 'Cliente' },
                status_label: { value: colQ.status, onChange: setCol('status'), options: statuses.map((s) => ({ value: String(s.id), label: s.label })) },
                city: { value: colQ.city, onChange: setCol('city'), placeholder: 'Via, città, CAP o provincia' },
                primary_contact_name: { value: colQ.contact, onChange: setCol('contact'), placeholder: 'Nome o telefono' },
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
            // Clic: seleziona la riga; doppio clic o Invio: apre la finestra.
            onRowClick: setSelectedId,
            onRowOpen: openDrawer,
            onRowContextMenu: handleRowContextMenu,
            getRowClassName: (row) => (selectedId === row.id ? 'Mui-selected' : undefined),
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

      {/* La finestra si apre solo con il sito già caricato: niente passaggio da una finestra di attesa. */}
      {drawerOpen && detail ? (
        <SiteDetailModal
          detail={detail}
          statuses={statuses}
          canChange={canChange}
          canDelete={canDelete}
          position={drawerIndex >= 0 ? `${drawerIndex + 1} di ${rows.length}` : undefined}
          onPrev={drawerIndex > 0 ? () => openDrawer(rows[drawerIndex - 1].id, true) : undefined}
          onNext={drawerIndex >= 0 && drawerIndex < rows.length - 1 ? () => openDrawer(rows[drawerIndex + 1].id, true) : undefined}
          onClose={closeDrawer}
          onSaved={() => { void loadDetail(detail.id, undefined, true); reloadAll() }}
          onEdit={openEdit}
          onDelete={() => setDeleteDlgOpen(true)}
          onRestore={() => void doRestore()}
          onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
          onNewIssue={() => newIssueFor(detail)}
        />
      ) : null}

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
