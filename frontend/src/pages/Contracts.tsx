import * as React from 'react'
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import type { GridColDef } from '@mui/x-data-grid'
import { useLocation, useNavigate } from 'react-router-dom'

import { api } from '@shared/api/client'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { useExportCsv } from '@shared/ui/useExportCsv'
import { copyToClipboard } from '@shared/utils/clipboard'
import { buildQuery } from '@shared/utils/nav'

import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { PERMS } from '../auth/perms'
import { CampoIcon, FilterOptionList, PageHead, SaveViewDialog, TableBar, ViewTabs, headerFilterGridSx, useSavedViews, useUndoToast, type ActiveFilter } from '../ui/campo'
import ContractDialog from '../features/contracts/ContractDialog'
import ContractDetailCard, { type ContractPatch } from '../features/contracts/ContractDetailCard'
import ContractKpis, { useContractStats } from '../features/contracts/ContractKpis'
import ContractRenewDialog from '../features/contracts/ContractRenewDialog'
import SellersDialog from '../features/contracts/SellersDialog'
import { EndCell, PeriodBar, StateCell } from '../features/contracts/contractUi'
import { dShort } from '../features/contracts/contractModel'
import {
  CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS,
  type CompanyOption, type ContractDetail, type ContractListItem, type CustomerOption, type Seller,
} from '../features/contracts/types'
import { formatEuro } from '../features/purchaseorders/types'
import { CONTRACT_VIEWS, VIEWS, VIEW_PARAMS, type ContractView } from '../features/contracts/contractViews'

type OpenCreateState = { openCreate?: boolean }
type ViewState = { view: ContractView; customer: number | ''; company: number | ''; seller: number | ''; type: string; year: number | '' }

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR + 3 - i)
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
const dash = <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>

function buildColumns(canViewValue: boolean): GridColDef<ContractListItem>[] {
  return [
    { field: 'code', headerName: 'Codice', width: 128, renderCell: (p) => <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}>{p.row.code}</Box> },
    {
      field: 'title', headerName: 'Contratto', flex: 1, minWidth: 200,
      renderCell: (p) => <Box component="span" sx={{ fontWeight: 550, ...ellipsis }}>{p.row.title}</Box>,
    },
    { field: 'customer_name', headerName: 'Cliente', width: 150, renderCell: (p) => <Box component="span" sx={ellipsis}>{p.row.customer_name}</Box> },
    { field: 'contract_type', headerName: 'Tipo', width: 104, sortable: false, renderCell: (p) => p.row.contract_type_label },
    { field: 'seller_name', headerName: 'Venditore', width: 140, renderCell: (p) => (p.row.seller_name ? <Box component="span" sx={ellipsis}>{p.row.seller_name}</Box> : dash) },
    { field: 'company_label', headerName: 'Società', width: 132, renderCell: (p) => p.row.company_label || dash },
    {
      field: 'start_date', headerName: 'Periodo', width: 112,
      renderCell: (p) => (
        <Tooltip title={`${dShort(p.row.start_date)} → ${dShort(p.row.end_date)}${p.row.reminder_date ? ` · avviso di rinnovo ${dShort(p.row.reminder_date)}` : ''}`}>
          <Box sx={{ width: '100%' }}><PeriodBar compact start={p.row.start_date} end={p.row.end_date} reminder={p.row.reminder_date} state={p.row.expiry_state} /></Box>
        </Tooltip>
      ),
    },
    { field: 'end_date', headerName: 'Fine', width: 124, renderCell: (p) => <EndCell end={p.row.end_date} state={p.row.expiry_state} /> },
    ...(canViewValue ? [{
      field: 'total_value', headerName: 'Valore', width: 120, align: 'right', headerAlign: 'right',
      renderCell: (p) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{p.row.total_value !== undefined ? formatEuro(p.row.total_value) : '—'}</Box>,
    } satisfies GridColDef<ContractListItem>] : []),
    {
      field: 'status', headerName: 'Stato', width: 126, sortable: false,
      renderCell: (p) => <StateCell status={p.row.status} label={p.row.status_label} state={p.row.expiry_state} end={p.row.end_date} reminder={p.row.reminder_date} />,
    },
  ]
}

function renderContractCard(): MobileCardRenderFn<ContractListItem> {
  return ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, cursor: 'pointer', display: 'grid', gap: 0.75, '&:active': { bgcolor: 'action.hover' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{row.title}</Typography>
        <StateCell status={row.status} label={row.status_label} state={row.expiry_state} end={row.end_date} reminder={row.reminder_date} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: 13, color: 'text.secondary', minWidth: 0 }}>
        <Box component="span" sx={ellipsis}>{row.customer_name} · {row.contract_type_label}</Box>
        <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, flex: 'none' }}>{row.code}</Box>
      </Box>
      <PeriodBar start={row.start_date} end={row.end_date} reminder={row.reminder_date} state={row.expiry_state} />
    </Box>
  )
}

export default function Contracts() {
  const { me, hasPerm } = useAuth()
  const canChange = hasPerm(PERMS.contracts.contract.change)
  const canDelete = hasPerm(PERMS.contracts.contract.delete)
  const canViewValue = hasPerm(PERMS.contracts.contract.viewValue)
  const canViewSellers = hasPerm('contracts.view_seller')
  const toast = useToast()
  const undoToast = useUndoToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const grid = useServerGrid({
    defaultOrdering: 'end_date',
    allowedOrderingFields: ['code', 'title', 'customer_name', 'seller_name', 'company_label', 'start_date', 'end_date', 'updated_at', ...(canViewValue ? ['total_value'] : [])],
    defaultPageSize: 25,
  })

  // Vista e filtri (URL): `customer` arriva anche dalla scheda Contratti del cliente.
  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: ContractView = VIEWS.includes(viewRaw as ContractView) ? (viewRaw as ContractView) : 'all'
  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [year, setYear] = useUrlNumberParam('year')
  const [statusFilter, setStatusFilter] = useUrlStringParam('status')
  const [typeFilter, setTypeFilter] = useUrlStringParam('type')
  const [companyId, setCompanyId] = useUrlNumberParam('company')
  const [sellerId, setSellerId] = useUrlNumberParam('seller')
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const hasActiveFilters = customerId !== '' || year !== '' || Boolean(statusFilter) || Boolean(typeFilter) || companyId !== '' || sellerId !== ''
  const resetFilters = React.useCallback(() => {
    setCustomerId('', { patch: { page: 1, year: '', status: '', type: '', company: '', seller: '' }, keepOpen: true })
  }, [setCustomerId])

  const saved = useSavedViews<ViewState>('contracts', me?.username)
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const setView = (v: string) => { setSavedId(null); setViewRaw(v === 'all' ? '' : v, filterOpts) }
  const applySaved = (id: string) => {
    const v = saved.views.find((x) => x.id === id); if (!v) return
    const s = v.state
    setSavedId(id)
    setViewRaw(s.view === 'all' ? '' : s.view, {
      patch: { page: 1, customer: s.customer === '' ? '' : String(s.customer), company: s.company === '' ? '' : String(s.company), seller: s.seller === '' ? '' : String(s.seller), type: s.type, year: s.year === '' ? '' : String(s.year), status: '' },
      keepOpen: true,
    })
  }

  const scopeParams = React.useMemo(() => ({
    ...(customerId !== '' ? { customer: customerId } : {}),
    ...(companyId !== '' ? { company: companyId } : {}),
    ...(sellerId !== '' ? { seller: sellerId } : {}),
  }), [customerId, companyId, sellerId])

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search,
    ordering: grid.ordering,
    orderingMap: { customer_name: 'customer__display_name', seller_name: 'seller__name', company_label: 'company__label' },
    page0: grid.paginationModel.page,
    pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted,
    onlyDeleted: grid.onlyDeleted,
    extra: {
      ...scopeParams,
      ...(year !== '' ? { year } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { contract_type: typeFilter } : {}),
      ...VIEW_PARAMS[view],
    },
  }), [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted, scopeParams, year, statusFilter, typeFilter, view])

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<ContractListItem>('/contracts/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))
  const [kpiReload, setKpiReload] = React.useState(0)
  const stats = useContractStats(kpiReload, scopeParams)
  const reloadAll = React.useCallback(() => { reloadList(); setKpiReload((n) => n + 1) }, [reloadList])

  // ── Anagrafiche per filtri e dialoghi ──
  const [customers, setCustomers] = React.useState<CustomerOption[]>([])
  const [sellers, setSellers] = React.useState<Seller[]>([])
  const [companies, setCompanies] = React.useState<CompanyOption[]>([])
  const loadSellers = React.useCallback(async () => {
    if (!canViewSellers) return
    try {
      const res = await api.get<ApiPage<Seller>>('/sellers/', { params: { ordering: 'name', page_size: 500 } })
      setSellers(res.data.results ?? [])
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast, canViewSellers])
  React.useEffect(() => {
    api.get<ApiPage<CustomerOption>>('/customers/', { params: { ordering: 'name', page_size: 500 } })
      .then((r) => setCustomers(r.data.results ?? [])).catch((e) => toast.error(apiErrorToMessage(e)))
    api.get<ApiPage<CompanyOption> | CompanyOption[]>('/customer-statuses/')
      .then((r) => setCompanies(Array.isArray(r.data) ? r.data : (r.data.results ?? []))).catch((e) => toast.error(apiErrorToMessage(e)))
    void loadSellers()
  }, [toast, loadSellers])

  // ── Scheda del contratto ──
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<ContractDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean, keep?: boolean) => {
    setDetailLoading(true)
    if (!keep) setDetail(null)
    try {
      const incParams = includeDeletedParams(forceIncludeDeleted ?? grid.includeDeleted)
      const res = await api.get<ContractDetail>(`/contracts/${id}/`, incParams ? { params: incParams } : undefined)
      setDetail(res.data)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDetailLoading(false) }
  }, [toast, grid.includeDeleted])

  // `keep`: passando al precedente/successivo la finestra resta quella di prima finché arriva il nuovo contratto.
  const openDrawer = React.useCallback((id: number, keep?: boolean) => {
    setSelectedId(id)
    setDrawerOpen(true)
    void loadDetail(id, undefined, keep)
    grid.setOpenId(id)
  }, [grid, loadDetail])

  // Apertura dal link `?open=<id>` (es. scheda Contratti del cliente).
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    void loadDetail(id)
  }, [grid.openId, loadDetail])

  const returnTo = React.useMemo(() => new URLSearchParams(loc.search).get('return'), [loc.search])
  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    lastOpenRef.current = null
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }, [grid, returnTo, navigate])

  // ── Crea / modifica ──
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgContract, setDlgContract] = React.useState<ContractDetail | null>(null)
  const openCreate = React.useCallback(() => { setDlgContract(null); setDlgOpen(true) }, [])
  const openEdit = React.useCallback(() => { if (detail) { setDlgContract(detail); setDlgOpen(true) } }, [detail])

  const openCreateOnceRef = React.useRef(false)
  React.useEffect(() => {
    const st = (loc.state as OpenCreateState | null | undefined) ?? null
    if (!st?.openCreate) { openCreateOnceRef.current = false; return }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc.state, loc.pathname, loc.search, navigate, openCreate])

  const onSaved = React.useCallback((c: ContractDetail) => { setDlgOpen(false); reloadAll(); openDrawer(c.id) }, [reloadAll, openDrawer])

  // Modifica sul posto dalle Proprietà, con annulla.
  const patchContract = React.useCallback(async (patch: ContractPatch, label: string) => {
    if (!detail) return
    const id = detail.id
    const prev: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) prev[k] = (detail as Record<string, unknown>)[k] ?? null
    try {
      await api.patch(`/contracts/${id}/`, patch)
      await loadDetail(id, undefined, true)
      reloadAll()
      undoToast.show(`${label} · salvato`, async () => {
        try {
          await api.patch(`/contracts/${id}/`, prev)
          await loadDetail(id, undefined, true)
          reloadAll()
        } catch (e) { toast.error(apiErrorToMessage(e)) }
      })
    } catch (e) { toast.error(apiErrorToFormFeedback(e).message) }
  }, [detail, loadDetail, reloadAll, undoToast, toast])

  // ── Rinnovo manuale ──
  const [renewOpen, setRenewOpen] = React.useState(false)
  const onRenewed = React.useCallback((c: ContractDetail) => { setRenewOpen(false); setDetail(c); reloadAll() }, [reloadAll])

  // ── Elimina / ripristina ──
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const doDelete = React.useCallback(async () => {
    const cid = detail?.id; if (!cid) return
    setDeleteBusy(true)
    try {
      await api.delete(`/contracts/${cid}/`)
      toast.success('Contratto spostato nel cestino.')
      setDeleteDlgOpen(false); closeDrawer(); reloadAll()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDeleteBusy(false) }
  }, [detail?.id, toast, closeDrawer, reloadAll])

  const doRestore = React.useCallback(async () => {
    const cid = detail?.id; if (!cid) return
    try {
      await api.post(`/contracts/${cid}/restore/`)
      toast.success('Contratto ripristinato.')
      await loadDetail(cid, true)
      reloadAll()
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [detail?.id, toast, loadDetail, reloadAll])

  // ── Documento PDF ──
  const [documentBusy, setDocumentBusy] = React.useState(false)
  const uploadDocument = React.useCallback(async (file: File) => {
    const cid = detail?.id; if (!cid) return
    setDocumentBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<ContractDetail>(`/contracts/${cid}/document/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDetail(res.data)
      toast.success('Documento caricato')
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDocumentBusy(false) }
  }, [detail?.id, toast])

  // La rimozione del PDF è definitiva (niente cestino): sempre con conferma.
  const [deleteDocDlgOpen, setDeleteDocDlgOpen] = React.useState(false)
  const deleteDocument = React.useCallback(async () => {
    const cid = detail?.id; if (!cid) return
    setDocumentBusy(true)
    try {
      await api.delete(`/contracts/${cid}/document/`)
      toast.success('Documento rimosso')
      setDeleteDocDlgOpen(false)
      await loadDetail(cid, undefined, true)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDocumentBusy(false) }
  }, [detail?.id, toast, loadDetail])

  const [sellersOpen, setSellersOpen] = React.useState(false)

  // ── Tasto destro sulla riga ──
  const [ctx, setCtx] = React.useState<{ row: ContractListItem; x: number; y: number } | null>(null)
  // Modifica / rinnovo / eliminazione dal menu: apre la finestra e, a contratto caricato, il dialogo.
  const pendingRef = React.useRef<{ id: number; action: 'edit' | 'renew' | 'delete' } | null>(null)
  const runFromRow = React.useCallback((id: number, action: 'edit' | 'renew' | 'delete') => { pendingRef.current = { id, action }; openDrawer(id) }, [openDrawer])
  React.useEffect(() => {
    const p = pendingRef.current
    if (!detail || !p || p.id !== detail.id) return
    pendingRef.current = null
    if (p.action === 'edit') { setDlgContract(detail); setDlgOpen(true) }
    else if (p.action === 'renew') setRenewOpen(true)
    else setDeleteDlgOpen(true)
  }, [detail])
  const restoreFromRow = React.useCallback(async (id: number) => {
    try {
      await api.post(`/contracts/${id}/restore/`)
      toast.success('Contratto ripristinato.')
      reloadAll()
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast, reloadAll])
  const ctxItems: RowContextMenuItem[] = (() => {
    const r = ctx?.row
    if (!r) return []
    if (r.deleted_at) {
      return [
        { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDrawer(r.id) },
        { key: 'restore', label: 'Ripristina', icon: <RestoreFromTrashIcon fontSize="small" />, hidden: !canChange, onClick: () => void restoreFromRow(r.id) },
      ]
    }
    return [
      { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDrawer(r.id) },
      { key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, hidden: !canChange, onClick: () => runFromRow(r.id, 'edit') },
      { key: 'renew', label: 'Rinnova…', icon: <AutorenewIcon fontSize="small" />, hidden: !canChange || r.status !== 'attivo', onClick: () => runFromRow(r.id, 'renew') },
      { key: 'customer', label: 'Apri il cliente', icon: <BusinessOutlinedIcon fontSize="small" />, dividerBefore: true, onClick: () => navigate(`/customers${buildQuery({ open: r.customer })}`) },
      { key: 'copy', label: 'Copia il codice', icon: <ContentCopyIcon fontSize="small" />, hidden: !r.code, onClick: async () => { await copyToClipboard(r.code); toast.success('Copiato') } },
      { key: 'delete', label: 'Sposta nel cestino', icon: <DeleteOutlineIcon fontSize="small" />, hidden: !canDelete, dividerBefore: true, tone: 'danger', onClick: () => runFromRow(r.id, 'delete') },
    ]
  })()

  // ── Griglia, filtri da intestazione, esportazione ──
  const columns = React.useMemo(() => buildColumns(canViewValue), [canViewValue])
  const contractCard = React.useMemo(() => renderContractCard(), [])
  const customerLabel = (id: number | '') => { const c = customers.find((x) => x.id === id); return c ? c.display_name || c.name || `#${c.id}` : `#${id}` }
  const single = (set: (v: number | '', o: typeof filterOpts) => void) => (vals: string[]) => set(vals[0] ? Number(vals[0]) : '', filterOpts)

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_name: {
      value: customerId === '' ? '' : String(customerId), label: 'Filtra cliente',
      onSet: (v) => setCustomerId(v === '' ? '' : Number(v), filterOpts), onReset: () => setCustomerId('', filterOpts),
      children: <FilterOptionList label="Cliente" single searchable options={customers.map((c) => ({ value: String(c.id), label: c.display_name || c.name || `#${c.id}` }))}
        selected={customerId === '' ? [] : [String(customerId)]} onChange={single(setCustomerId)} />,
    },
    contract_type: {
      value: typeFilter, label: 'Filtra tipo',
      onSet: (v) => setTypeFilter(String(v), filterOpts), onReset: () => setTypeFilter('', filterOpts),
      children: <FilterOptionList label="Tipo" single options={CONTRACT_TYPE_OPTIONS} selected={typeFilter ? [typeFilter] : []} onChange={(vals) => setTypeFilter(vals[0] ?? '', filterOpts)} />,
    },
    ...(canViewSellers ? {
      seller_name: {
        value: sellerId === '' ? '' : String(sellerId), label: 'Filtra venditore',
        onSet: (v: string | number | '') => setSellerId(v === '' ? '' : Number(v), filterOpts), onReset: () => setSellerId('', filterOpts),
        children: <FilterOptionList label="Venditore" single searchable options={sellers.map((s) => ({ value: String(s.id), label: s.is_active ? s.name : `${s.name} (non attivo)` }))}
          selected={sellerId === '' ? [] : [String(sellerId)]} onChange={single(setSellerId)} />,
      },
    } : {}),
    company_label: {
      value: companyId === '' ? '' : String(companyId), label: 'Filtra società',
      onSet: (v) => setCompanyId(v === '' ? '' : Number(v), filterOpts), onReset: () => setCompanyId('', filterOpts),
      children: <FilterOptionList label="Società" single options={companies.map((c) => ({ value: String(c.id), label: c.label }))}
        selected={companyId === '' ? [] : [String(companyId)]} onChange={single(setCompanyId)} />,
    },
    start_date: {
      value: year === '' ? '' : String(year), label: 'Attivi in un anno',
      onSet: (v) => setYear(v === '' ? '' : Number(v), filterOpts), onReset: () => setYear('', filterOpts),
      children: <FilterOptionList label="Attivi nell'anno" single options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))}
        selected={year === '' ? [] : [String(year)]} onChange={single(setYear)} />,
    },
    status: {
      value: statusFilter, label: 'Filtra stato',
      onSet: (v) => setStatusFilter(String(v), filterOpts), onReset: () => setStatusFilter('', filterOpts),
      children: <FilterOptionList label="Stato" single options={CONTRACT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        selected={statusFilter ? [statusFilter] : []} onChange={(vals) => setStatusFilter(vals[0] ?? '', filterOpts)} />,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [customerId, customers, typeFilter, canViewSellers, sellerId, sellers, companyId, companies, year, statusFilter, filterOpts])

  const activeFilters: ActiveFilter[] = [
    customerId !== '' ? { key: 'customer', label: 'Cliente', values: customerLabel(customerId) } : null,
    typeFilter ? { key: 'type', label: 'Tipo', values: CONTRACT_TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label ?? typeFilter } : null,
    sellerId !== '' ? { key: 'seller', label: 'Venditore', values: sellers.find((s) => s.id === sellerId)?.name ?? `#${sellerId}` } : null,
    companyId !== '' ? { key: 'company', label: 'Società', values: companies.find((c) => c.id === companyId)?.label ?? `#${companyId}` } : null,
    year !== '' ? { key: 'year', label: 'Attivi nel', values: String(year) } : null,
    statusFilter ? { key: 'status', label: 'Stato', values: CONTRACT_STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'customer') setCustomerId('', filterOpts)
    if (key === 'type') setTypeFilter('', filterOpts)
    if (key === 'seller') setSellerId('', filterOpts)
    if (key === 'company') setCompanyId('', filterOpts)
    if (key === 'year') setYear('', filterOpts)
    if (key === 'status') setStatusFilter('', filterOpts)
  }

  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<ContractListItem>({
      url: '/contracts/', params, filename: 'contratti',
      columns: [
        { label: 'Codice', getValue: (r) => r.code },
        { label: 'Titolo', getValue: (r) => r.title },
        { label: 'Cliente', getValue: (r) => r.customer_name },
        { label: 'Tipo', getValue: (r) => r.contract_type_label },
        { label: 'Venditore', getValue: (r) => r.seller_name ?? '' },
        { label: 'Società', getValue: (r) => r.company_label ?? '' },
        { label: 'Inizio', getValue: (r) => r.start_date },
        { label: 'Fine', getValue: (r) => r.end_date },
        { label: 'Avviso di rinnovo', getValue: (r) => r.reminder_date ?? '' },
        { label: 'Fatturazione', getValue: (r) => r.billing_freq_label },
        ...(canViewValue ? [{ label: 'Valore', getValue: (r: ContractListItem) => r.total_value ?? '' }] : []),
        { label: 'Stato', getValue: (r) => r.status_label },
      ],
    })
  }

  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim())
    if (grid.view === 'deleted' && !searching && !hasActiveFilters) return { title: 'Cestino vuoto', subtitle: 'Non ci sono contratti eliminati.' }
    if (searching || hasActiveFilters || view !== 'all') {
      return {
        title: 'Nessun contratto', subtitle: view === 'att' ? 'Nessun contratto da rinnovare: nessuno ha raggiunto la data dell\'avviso.' : view === 'exp' ? 'Nessun contratto scaduto da sistemare.' : 'Nessun contratto corrisponde: prova a modificare la ricerca, la vista o i filtri.',
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {searching ? <Button variant="outlined" onClick={() => grid.setQ('')}>Cancella ricerca</Button> : null}
            {hasActiveFilters ? <Button variant="outlined" onClick={resetFilters}>Azzera filtri</Button> : null}
          </Stack>
        ),
      }
    }
    return {
      title: 'Nessun contratto', subtitle: 'Non ci sono ancora contratti.',
      action: <Can perm={PERMS.contracts.contract.add}><Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>Nuovo contratto</Button></Can>,
    }
  }, [grid, hasActiveFilters, view, resetFilters, openCreate])

  const drawerIndex = selectedId != null ? rows.findIndex((r) => r.id === selectedId) : -1
  const openColumnsRef = React.useRef<((el: HTMLElement) => void) | null>(null)

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Contratti"
        actions={
          <>
            {canViewSellers ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="users" size={16} />} onClick={() => setSellersOpen(true)}>Venditori</Button> : null}
            <Can perm={PERMS.contracts.contract.add}><Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>Nuovo contratto</Button></Can>
          </>
        }
      />
      <ContractKpis stats={stats} view={view} onView={setView} onOpen={openDrawer} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={savedId ? `saved:${savedId}` : view}
          onChange={(k) => { if (k.startsWith('saved:')) { applySaved(k.slice(6)); return } setView(k) }}
          tabs={[
            ...CONTRACT_VIEWS.map((v) => ({ key: v.key, label: v.label, count: stats ? ({
              all: stats.by_status.bozza + stats.by_status.attivo + stats.by_status.chiuso, att: stats.by_expiry.renew, exp: stats.by_expiry.expired,
              run: stats.by_expiry.ok, draft: stats.by_status.bozza, canc: stats.by_status.chiuso,
            } as Record<ContractView, number>)[v.key] : undefined })),
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
          onSave={(name) => { const v = saved.add(name, { view, customer: customerId, company: companyId, seller: sellerId, type: typeFilter, year }); setSavedId(v.id) }} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={contractCard}
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca codice, titolo, cliente, venditore…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
            />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca contratti…' }}
          grid={{
            pageKey: 'contracts',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            defaultHiddenColumns: ['company_label'],
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
            onRowContextMenu: (row, e) => { setSelectedId(row.id); setCtx({ row, x: e.clientX + 2, y: e.clientY - 6 }) },
            getRowClassName: (row) => (selectedId === row.id ? 'Mui-selected' : undefined),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>

      {/* La finestra si apre solo con il contratto già caricato: niente passaggio da una finestra di attesa. */}
      {drawerOpen && detail ? (
        <ContractDetailCard
          detail={detail}
          loading={detailLoading}
          sellers={sellers}
          companies={companies}
          canChange={canChange}
          canDelete={canDelete}
          canViewValue={canViewValue}
          documentBusy={documentBusy}
          position={drawerIndex >= 0 ? `${drawerIndex + 1} di ${rows.length}` : undefined}
          onPrev={drawerIndex > 0 ? () => openDrawer(rows[drawerIndex - 1].id, true) : undefined}
          onNext={drawerIndex >= 0 && drawerIndex < rows.length - 1 ? () => openDrawer(rows[drawerIndex + 1].id, true) : undefined}
          onClose={closeDrawer}
          onEdit={openEdit}
          onDelete={() => setDeleteDlgOpen(true)}
          onRestore={() => void doRestore()}
          onRenew={() => setRenewOpen(true)}
          onPatch={(patch, label) => patchContract(patch, label)}
          onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
          onOpenCustomer={() => { if (detail) navigate(`/customers${buildQuery({ open: detail.customer })}`) }}
          onUploadDocument={(f) => void uploadDocument(f)}
          onDeleteDocument={() => setDeleteDocDlgOpen(true)}
        />
      ) : null}

      <RowContextMenu open={Boolean(ctx)} anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined} onClose={() => setCtx(null)} items={ctxItems} />
      <ContractDialog
        open={dlgOpen}
        contract={dlgContract}
        initialCustomer={customerId === '' ? null : customerId}
        customers={customers}
        sellers={sellers}
        companies={companies}
        canViewValue={canViewValue}
        onClose={() => setDlgOpen(false)}
        onSaved={onSaved}
      />
      <ContractRenewDialog open={renewOpen} contract={detail} onClose={() => setRenewOpen(false)} onRenewed={onRenewed} />
      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Spostare il contratto nel cestino?"
        description="Il contratto verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />
      <ConfirmDeleteDialog
        open={deleteDocDlgOpen}
        busy={documentBusy}
        title="Rimuovere il documento?"
        description={`Il PDF${detail?.document_filename ? ` «${detail.document_filename}»` : ''} verrà eliminato definitivamente e non potrà essere ripristinato.`}
        confirmText="Rimuovi"
        onClose={() => setDeleteDocDlgOpen(false)}
        onConfirm={() => void deleteDocument()}
      />
      {canViewSellers ? <SellersDialog open={sellersOpen} onClose={() => { setSellersOpen(false); void loadSellers() }} /> : null}
    </Stack>
  )
}
