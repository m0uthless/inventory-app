import * as React from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
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
import ContactDialog from '../features/contacts/ContactDialog'
import ContactDetailModal from '../features/contacts/ContactDetailModal'
import ContactKpis, { useContactSummary } from '../features/contacts/ContactKpis'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { buildQuery } from '@shared/utils/nav'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { PageHead, ViewTabs, FilterOptionList, TableBar, CampoIcon, useSavedViews, SaveViewDialog, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import { useExportCsv } from '@shared/ui/useExportCsv'

type CustomerItem = { id: number; code?: string; name?: string; display_name?: string | null }

type SiteItem = { id: number; name: string; display_name?: string | null }

type ContactRow = {
  id: number

  customer?: number | null
  customer_code?: string | null
  customer_name?: string | null
  customer_display_name?: string | null

  site?: number | null
  site_name?: string | null
  site_display_name?: string | null

  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  is_primary: boolean

  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

type ContactDetail = ContactRow & { deleted_at?: string | null }

type ContactForm = {
  customer: number | ''
  site: number | ''
  name: string
  email: string
  phone: string
  department: string
  is_primary: boolean
  notes: string
}

type OpenCreateState = { openCreate?: boolean }

const mono = { fontFamily: '"Geist Mono", monospace' }
const missing = (t: string) => <Box component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'warning.main' }}>{t}</Box>
const tel = (p: string) => p.replace(/\s+/g, '')
const primaryTag = <Box component="span" sx={{ ml: 1, display: 'inline-flex', alignItems: 'center', alignSelf: 'center', height: 18, fontSize: 10, fontWeight: 650, letterSpacing: '.02em', color: 'primary.main', bgcolor: 'archie.field', borderRadius: '4px', px: 0.75, flex: 'none' }}>Primario</Box>
const linkCellSx = { display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0, color: 'text.primary', textDecoration: 'none', '& svg': { color: 'primary.main', flex: 'none' }, '&:hover': { color: 'primary.main', '& .tx': { textDecoration: 'underline', textUnderlineOffset: '3px' } } }

function buildColumns(): GridColDef<ContactRow>[] {
  return [
    { field: 'id', headerName: 'ID', width: 70, align: 'right', headerAlign: 'right' },
    {
      field: 'name', headerName: 'Nome', flex: 1, minWidth: 180,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <Box component="span" sx={{ fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.name}</Box>
          {p.row.is_primary ? primaryTag : null}
        </Box>
      ),
    },
    { field: 'department', headerName: 'Reparto', width: 140, renderCell: (p) => p.row.department || <Box component="span" sx={{ color: 'text.disabled' }}>—</Box> },
    {
      field: 'customer_display_name', headerName: 'Cliente', width: 150,
      renderCell: (p) => <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.customer_display_name || p.row.customer_name || '—'}</Box>,
    },
    {
      field: 'site_display_name', headerName: 'Sito', width: 150,
      renderCell: (p) => p.row.site ? <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.site_display_name || p.row.site_name}</Box>
        : <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>Sede del cliente</Box>,
    },
    {
      field: 'phone', headerName: 'Telefono', width: 150,
      renderCell: (p) => p.row.phone ? (
        <Box component="a" href={`tel:${tel(p.row.phone)}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={linkCellSx}>
          <CampoIcon name="phone" size={14} bold /><Box component="span" className="tx" sx={{ ...mono, fontSize: 12 }}>{p.row.phone}</Box>
        </Box>
      ) : missing('Manca'),
    },
    {
      field: 'email', headerName: 'Email', width: 210,
      renderCell: (p) => p.row.email ? (
        <Box component="a" href={`mailto:${p.row.email}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={linkCellSx}>
          <CampoIcon name="mail" size={14} bold /><Box component="span" className="tx" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.email}</Box>
        </Box>
      ) : missing('Manca'),
    },
  ]
}

const renderContactCard: MobileCardRenderFn<ContactRow> = ({ row, onOpen }) => (
  <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, cursor: 'pointer', display: 'grid', gap: 0.75, '&:active': { bgcolor: 'action.hover' } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, minWidth: 0 }}>{row.name}</Typography>
      {row.is_primary ? primaryTag : null}
    </Box>
    <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
      {[row.department, row.customer_display_name || row.customer_name, row.site_display_name || row.site_name].filter(Boolean).join(' · ')}
    </Typography>
    {row.phone || row.email ? (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }} onClick={(e) => e.stopPropagation()}>
        {row.phone ? <Box component="a" href={`tel:${tel(row.phone)}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 44, px: 1.25, borderRadius: '8px', border: '1px solid', borderColor: 'divider', color: 'text.primary', fontSize: 13, fontWeight: 550, textDecoration: 'none', '& svg': { color: 'primary.main' } }}><CampoIcon name="phone" size={16} bold /><Box component="span" sx={mono}>{row.phone}</Box></Box> : null}
        {row.email ? <Box component="a" href={`mailto:${row.email}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 44, px: 1.25, borderRadius: '8px', border: '1px solid', borderColor: 'divider', color: 'text.primary', fontSize: 13, fontWeight: 550, textDecoration: 'none', minWidth: 0, maxWidth: '100%', '& svg': { color: 'primary.main', flex: 'none' } }}><CampoIcon name="mail" size={16} bold /><Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.email}</Box></Box> : null}
      </Box>
    ) : null}
  </Box>
)

type ContactView = 'all' | 'pri' | 'unr' | 'nosite'
type ColQ = { name: string; department: string; customer: string; site: string; phone: string; email: string }
const EMPTY_COLQ: ColQ = { name: '', department: '', customer: '', site: '', phone: '', email: '' }
type ViewState = { view: ContactView; customer: number | ''; site: number | '' }

export default function Contacts() {
  const { me, hasPerm } = useAuth()
  const canChange = hasPerm(PERMS.crm.contact.change)
  const canDelete = hasPerm(PERMS.crm.contact.delete)
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const grid = useServerGrid({
    defaultOrdering: 'name',
    allowedOrderingFields: ['id', 'name', 'email', 'phone', 'department', 'customer_display_name', 'site_display_name', 'is_primary'],
    defaultPageSize: 25,
  })

  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: ContactView = (['all', 'pri', 'unr', 'nosite'] as const).includes(viewRaw as ContactView) ? (viewRaw as ContactView) : 'all'
  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [siteId, setSiteId] = useUrlNumberParam('site')
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const [colSearchOpen, setColSearchOpen] = React.useState(false)
  const [colQ, setColQ] = React.useState<ColQ>(EMPTY_COLQ)
  const colQActive = Object.values(colQ).some(Boolean)
  const setCol = (k: keyof ColQ) => (v: string) => { setColQ((c) => ({ ...c, [k]: v })); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }
  const hasActiveFilters = customerId !== '' || siteId !== ''
  const resetFilters = React.useCallback(() => { setCustomerId('', { patch: { page: 1, site: '' }, keepOpen: true }) }, [setCustomerId])

  const saved = useSavedViews<ViewState>('contacts', me?.username)
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const setView = (v: string) => { setSavedId(null); setViewRaw(v === 'all' ? '' : v, filterOpts) }
  const applySaved = (id: string) => {
    const v = saved.views.find((x) => x.id === id); if (!v) return
    setSavedId(id)
    setViewRaw(v.state.view === 'all' ? '' : v.state.view, { patch: { page: 1, customer: v.state.customer === '' ? '' : String(v.state.customer), site: v.state.site === '' ? '' : String(v.state.site) }, keepOpen: true })
  }

  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim()) || colQActive
    if (grid.view === 'deleted' && !searching && !hasActiveFilters) return { title: 'Cestino vuoto', subtitle: 'Non ci sono contatti eliminati.' }
    if (searching || hasActiveFilters || view !== 'all') {
      return {
        title: 'Nessun risultato', subtitle: 'Nessun contatto corrisponde: prova a modificare la ricerca, la vista o i filtri.',
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {searching ? <Button variant="outlined" onClick={() => { grid.setQ(''); setColQ(EMPTY_COLQ) }}>Cancella ricerca</Button> : null}
            {hasActiveFilters ? <Button variant="outlined" onClick={resetFilters}>Azzera filtri</Button> : null}
          </Stack>
        ),
      }
    }
    return {
      title: 'Nessun contatto', subtitle: 'Non ci sono ancora contatti.',
      action: <Can perm={PERMS.crm.contact.add}><Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}>Crea contatto</Button></Can>,
    }
  }, [grid, colQActive, hasActiveFilters, view, resetFilters, loc.pathname, loc.search, navigate])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: { customer_display_name: 'customer__name', site_display_name: 'site__name' },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== '' ? { customer: customerId } : {}),
          ...(siteId !== '' ? { site: siteId } : {}),
          ...(view === 'pri' ? { is_primary: 'true' } : view === 'unr' ? { unreachable: 'true' } : view === 'nosite' ? { has_site: 'false' } : {}),
          ...(colQ.name ? { name_q: colQ.name } : {}),
          ...(colQ.department ? { department_q: colQ.department } : {}),
          ...(colQ.customer ? { customer_q: colQ.customer } : {}),
          ...(colQ.site ? { site_q: colQ.site } : {}),
          ...(colQ.phone ? { phone_q: colQ.phone } : {}),
          ...(colQ.email ? { email_q: colQ.email } : {}),
        },
      }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted, customerId, siteId, view, colQ],
  )

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<ContactRow>('/contacts/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))
  const [kpiReload, setKpiReload] = React.useState(0)
  const summary = useContactSummary(kpiReload)
  const reloadAll = React.useCallback(() => { reloadList(); setKpiReload((n) => n + 1) }, [reloadList])

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([])
  const [sites, setSites] = React.useState<SiteItem[]>([]) // siti del cliente scelto (filtro + dialogo)

  // pannello
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<ContactDetail | null>(null)

  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // dialog CRUD
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [dlgErrors, setDlgErrors] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<ContactForm>({ customer: '', site: '', name: '', email: '', phone: '', department: '', is_primary: false, notes: '' })

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerItem>>('/customers/', { params: { ordering: 'name', page_size: 500 } })
      setCustomers(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadSitesForCustomer = React.useCallback(async (cust: number | '') => {
    try {
      if (cust === '') { setSites([]); return }
      const res = await api.get<ApiPage<SiteItem>>('/sites/', { params: { customer: cust, ordering: 'name', page_size: 500 } })
      setSites(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean, keep?: boolean) => {
    if (!keep) setDetail(null)
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted
      const incParams = includeDeletedParams(inc)
      const res = await api.get<ContactDetail>(`/contacts/${id}/`, incParams ? { params: incParams } : undefined)
      setDetail(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast, grid.includeDeleted])

  const returnTo = React.useMemo(() => new URLSearchParams(loc.search).get('return'), [loc.search])
  const lastOpenRef = React.useRef<number | null>(null)
  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    lastOpenRef.current = null
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }, [grid, returnTo, navigate])

  // `keep`: passando a un altro contatto la finestra resta quella di prima finché arriva il nuovo.
  const openDrawer = React.useCallback((id: number, keep?: boolean) => {
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id, undefined, keep)
    grid.setOpenId(id)
  }, [grid, loadDetail])

  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id)
  }, [grid.openId, loadDetail])

  // ── Azioni riga / menu contestuale ──────────────────────────────────────────
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void | Promise<void>) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{ row: ContactRow; mouseX: number; mouseY: number } | null>(null)

  const openEditFromRow = React.useCallback((id: number) => { pendingEditIdRef.current = id; openDrawer(id) }, [openDrawer])
  const openDeleteFromRow = React.useCallback((id: number) => { pendingDeleteIdRef.current = id; openDrawer(id) }, [openDrawer])
  const restoreFromRow = React.useCallback(async (id: number) => {
    setRestoreBusy(true)
    try {
      await api.post(`/contacts/${id}/restore/`)
      toast.success('Contatto ripristinato')
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [reloadAll, toast])

  React.useEffect(() => {
    if (!detail) return
    if (pendingEditIdRef.current === detail.id) { pendingEditIdRef.current = null; const fn = openEditRef.current; if (fn) void fn() }
    if (pendingDeleteIdRef.current === detail.id) { pendingDeleteIdRef.current = null; setDeleteDlgOpen(true) }
  }, [detail])

  const handleRowContextMenu = React.useCallback((row: ContactRow, event: React.MouseEvent<HTMLElement>) => {
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
      ...(row.phone ? [{ key: 'tel', label: 'Copia il telefono', icon: <CampoIcon name="copy" />, onClick: async () => { await copyToClipboard(row.phone!); toast.success('Copiato') } }] : []),
      ...(row.email ? [{ key: 'mail', label: "Copia l'email", icon: <CampoIcon name="copy" />, onClick: async () => { await copyToClipboard(row.email!); toast.success('Copiato') } }] : []),
      { key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => openDeleteFromRow(row.id), disabled: deleteBusy, tone: 'danger' as const },
    ]
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, restoreBusy, restoreFromRow, toast])

  const columns = React.useMemo<GridColDef<ContactRow>[]>(() => buildColumns(), [])

  const customerLabel = (id: number | '') => { const c = customers.find((x) => x.id === id); return c ? c.display_name || c.name || `#${c.id}` : String(id) }
  const siteLabel = (id: number | '') => { const st = sites.find((x) => x.id === id); return st ? st.display_name || st.name : String(id) }
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_display_name: {
      value: customerId === '' ? '' : String(customerId),
      label: 'Filtra cliente',
      onSet: (v) => setCustomerId(v === '' ? '' : Number(v), filterOpts),
      onReset: () => setCustomerId('', filterOpts),
      children: <FilterOptionList label="Cliente" single searchable options={customers.map((c) => ({ value: String(c.id), label: c.display_name || c.name || `#${c.id}` }))}
        selected={customerId === '' ? [] : [String(customerId)]} onChange={(vals) => setCustomerId(vals[0] ? Number(vals[0]) : '', { patch: { page: 1, site: '' }, keepOpen: true })} />,
    },
    ...(customerId !== '' ? {
      site_display_name: {
        value: siteId === '' ? '' : String(siteId),
        label: 'Filtra sito',
        onSet: (v: string | number | '') => setSiteId(v === '' ? '' : Number(v), filterOpts),
        onReset: () => setSiteId('', filterOpts),
        children: <FilterOptionList label="Sito" single options={sites.map((st) => ({ value: String(st.id), label: st.display_name || st.name }))}
          selected={siteId === '' ? [] : [String(siteId)]} onChange={(vals) => setSiteId(vals[0] ? Number(vals[0]) : '', filterOpts)} />,
      },
    } : {}),
  }), [customerId, siteId, setCustomerId, setSiteId, customers, sites, filterOpts])

  const activeFilters: ActiveFilter[] = [
    customerId !== '' ? { key: 'customer', label: 'Cliente', values: customerLabel(customerId) } : null,
    siteId !== '' ? { key: 'site', label: 'Sito', values: siteLabel(siteId) } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'customer') setCustomerId('', { patch: { page: 1, site: '' }, keepOpen: true })
    if (key === 'site') setSiteId('', filterOpts)
  }

  React.useEffect(() => { loadCustomers() }, [loadCustomers])
  React.useEffect(() => { loadSitesForCustomer(customerId) }, [customerId, loadSitesForCustomer])

  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<ContactRow>({
      url: '/contacts/', params, filename: 'contatti',
      columns: [
        { label: 'Nome', getValue: (r) => r.name },
        { label: 'Primario', getValue: (r) => (r.is_primary ? 'Sì' : 'No') },
        { label: 'Reparto', getValue: (r) => r.department ?? '' },
        { label: 'Cliente', getValue: (r) => r.customer_display_name || r.customer_name || '' },
        { label: 'Sito', getValue: (r) => r.site_display_name || r.site_name || '' },
        { label: 'Telefono', getValue: (r) => r.phone ?? '' },
        { label: 'Email', getValue: (r) => r.email ?? '' },
      ],
    })
  }

  const doDelete = React.useCallback(async () => {
    if (!selectedId) return
    setDeleteBusy(true)
    try {
      await api.delete(`/contacts/${selectedId}/`)
      toast.success('Contatto eliminato')
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
      await api.post(`/contacts/${selectedId}/restore/`)
      toast.success('Contatto ripristinato')
      await loadDetail(selectedId)
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [selectedId, toast, loadDetail, reloadAll])

  const openCreateOnceRef = React.useRef(false)
  const openCreate = React.useCallback(async () => {
    const preCustomer = customerId !== '' ? customerId : ''
    setDlgMode('create')
    setDlgId(null)
    setDlgErrors({})
    setForm({ customer: preCustomer, site: siteId !== '' ? siteId : '', name: '', email: '', phone: '', department: '', is_primary: false, notes: '' })
    setDlgOpen(true)
    await loadSitesForCustomer(preCustomer)
  }, [customerId, siteId, loadSitesForCustomer])

  React.useEffect(() => {
    const st = (loc.state as OpenCreateState | null | undefined) ?? null
    if (!st?.openCreate) { openCreateOnceRef.current = false; return }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    void openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc.state, loc.pathname, loc.search, navigate, openCreate])

  const openEdit = React.useCallback(async () => {
    if (!detail) return
    setDlgMode('edit')
    setDlgId(detail.id)
    setDlgErrors({})
    const cust = detail.customer ?? ''
    setForm({ customer: cust, site: detail.site ?? '', name: detail.name ?? '', email: detail.email ?? '', phone: detail.phone ?? '', department: detail.department ?? '', is_primary: Boolean(detail.is_primary), notes: detail.notes ?? '' })
    setDlgOpen(true)
    await loadSitesForCustomer(cust)
  }, [detail, loadSitesForCustomer])
  openEditRef.current = openEdit

  const save = async () => {
    const clientErrors: Record<string, string> = {}
    if (form.customer === '') clientErrors.customer = 'Seleziona un cliente.'
    if (!String(form.name).trim()) clientErrors.name = 'Il nome è obbligatorio.'
    if (Object.keys(clientErrors).length) { setDlgErrors(clientErrors); return }
    setDlgErrors({})
    const payload: Record<string, unknown> = {
      customer: Number(form.customer), site: form.site === '' ? null : Number(form.site), name: form.name.trim(),
      email: (form.email || '').trim() || null, phone: (form.phone || '').trim() || null, department: (form.department || '').trim() || null,
      is_primary: Boolean(form.is_primary), notes: (form.notes || '').trim() || null,
    }
    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<ContactDetail>('/contacts/', payload)
        id = res.data.id
        toast.success('Contatto creato')
      } else {
        if (!dlgId) return
        const res = await api.patch<ContactDetail>(`/contacts/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Contatto aggiornato')
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
        title="Contatti"
        actions={<Can perm={PERMS.crm.contact.add}><Button startIcon={<AddIcon />} variant="contained" onClick={() => void openCreate()}>Nuovo contatto</Button></Can>}
      />
      <ContactKpis summary={summary} view={view} onView={setView}
        onCustomer={(id) => setCustomerId(customerId === id ? '' : id, { patch: { page: 1, site: '' }, keepOpen: true })}
        onCustomersWithoutPrimary={() => navigate(`/customers${buildQuery({ has_contact: 'false' })}`)} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={savedId ? `saved:${savedId}` : view}
          onChange={(k) => { if (k.startsWith('saved:')) { applySaved(k.slice(6)); return } setView(k) }}
          tabs={[
            { key: 'all', label: 'Tutti', count: summary?.total },
            { key: 'pri', label: 'Primari', count: summary?.primaries },
            { key: 'unr', label: 'Senza recapiti', count: summary?.unreachable },
            { key: 'nosite', label: 'Senza sito', count: summary?.without_site },
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
          onSave={(name) => { const v = saved.add(name, { view, customer: customerId, site: siteId }); setSavedId(v.id) }} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={renderContactCard}
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca nome, reparto, telefono, email…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
              columnSearch={{ open: colSearchOpen, active: colQActive, onToggle: () => { if (colSearchOpen) setColQ(EMPTY_COLQ); setColSearchOpen((v) => !v) } }}
            />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca contatti…' }}
          grid={{
            pageKey: 'contacts',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            defaultHiddenColumns: ['id'],
            columnSearch: {
              open: colSearchOpen,
              fields: {
                name: { value: colQ.name, onChange: setCol('name'), placeholder: 'Nome' },
                department: { value: colQ.department, onChange: setCol('department'), placeholder: 'Reparto' },
                customer_display_name: { value: colQ.customer, onChange: setCol('customer'), placeholder: 'Cliente' },
                site_display_name: { value: colQ.site, onChange: setCol('site'), placeholder: 'Sito o città' },
                phone: { value: colQ.phone, onChange: setCol('phone'), placeholder: 'Telefono' },
                email: { value: colQ.email, onChange: setCol('email'), placeholder: 'Email' },
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

      {/* La finestra si apre solo con il contatto già caricato: niente passaggio da una finestra di attesa. */}
      {drawerOpen && detail ? (
        <ContactDetailModal
          detail={detail}
          canChange={canChange}
          canDelete={canDelete}
          position={drawerIndex >= 0 ? `${drawerIndex + 1} di ${rows.length}` : undefined}
          onPrev={drawerIndex > 0 ? () => openDrawer(rows[drawerIndex - 1].id, true) : undefined}
          onNext={drawerIndex >= 0 && drawerIndex < rows.length - 1 ? () => openDrawer(rows[drawerIndex + 1].id, true) : undefined}
          onClose={closeDrawer}
          onSaved={() => { void loadDetail(detail.id, undefined, true); reloadAll() }}
          onEdit={() => void openEdit()}
          onDelete={() => setDeleteDlgOpen(true)}
          onRestore={() => void doRestore()}
          onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
          onOpenContact={(id) => openDrawer(id, true)}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Confermi eliminazione contatto?"
        description="Il contatto verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      <ContactDialog
        open={dlgOpen}
        mode={dlgMode}
        saving={dlgSaving}
        errors={dlgErrors}
        customers={customers}
        sites={sites}
        form={form}
        onClose={() => setDlgOpen(false)}
        onSave={save}
        onFormChange={setForm}
        onCustomerChange={loadSitesForCustomer}
      />
    </Stack>
  )
}
