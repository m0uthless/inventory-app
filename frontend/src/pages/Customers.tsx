import * as React from 'react'
import {
  Box,
  Button,
  ButtonBase,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'

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
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useUrlStringParam } from '@shared/hooks/useUrlParam'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import VpnModal from '../features/customers/VpnModal'
import CustomerDialog from '../features/customers/CustomerDialog'
import CustomerDetailCard, { type CustomerPatch, type CustomerTab } from '../features/customers/CustomerDetailCard'
import CustomerKpis, { useCustomerSummary } from '../features/customers/CustomerKpis'
import { CustomerActivityPanel, CustomerDocumentsPanel, CustomerInventoriesPanel, CustomerSitesPanel } from '../features/customers/CustomerTabs'
import { daysTo, dIt, EXPIRING_DAYS, ExpiryMark, VendorMark, vendorColorOf } from '../features/customers/customerUi'
import { PageHead, ViewTabs, FilterOptionList, TableBar, CampoIcon, useSavedViews, SaveViewDialog, headerFilterGridSx, useUndoToast, type ActiveFilter } from '../ui/campo'
import { useStatusTokens } from '../theme/AppThemeProvider'
import { useExportCsv } from '@shared/ui/useExportCsv'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'

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
  sites_count?: number
  assets_count?: number
  open_issues_count?: number
  active_contracts_count?: number
  next_contract_end?: string | null
  next_contract_title?: string | null
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



const srOnlySx = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden',
  padding: 0, position: 'absolute', whiteSpace: 'nowrap', width: '1px',
} as const

/** Etichetta VPN: vero pulsante (tastiera + screen reader), apre le credenziali VPN. */
function VpnPill({ row, onClick, size = 'grid' }: { row: CustomerRow; onClick: (row: CustomerRow) => void; size?: 'grid' | 'touch' }) {
  const name = row.display_name || row.name
  return (
    <ButtonBase
      aria-label={`Apri VPN di ${name}`}
      onClick={(e) => { e.stopPropagation(); onClick(row) }}
      onKeyDown={(e) => e.stopPropagation()}
      sx={{
        flexShrink: 0, fontFamily: '"Geist Mono", monospace', fontSize: size === 'touch' ? 12 : 10, fontWeight: 650, letterSpacing: '0.04em',
        px: size === 'touch' ? 1.5 : '5px', minHeight: size === 'touch' ? 44 : 18, lineHeight: '16px', borderRadius: size === 'touch' ? '8px' : '4px',
        border: '1px solid', borderColor: 'archie.borderStrong', color: 'text.secondary',
        '&:hover': { borderColor: 'archie.fieldLine', bgcolor: 'archie.field', color: 'primary.main' },
        '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
      }}
    >
      VPN
    </ButtonBase>
  )
}

const numCell = (v?: number | null) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{v ?? 0}</Box>
const missing = (t: string) => <Box component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'warning.main' }}>{t}</Box>

function buildColumns(onVpnClick: (row: CustomerRow) => void, vendorColor: (l: string) => string, onIssues: (row: CustomerRow) => void): GridColDef<CustomerRow>[] {
  return [
    { field: 'id', headerName: 'ID', width: 70, align: 'right', headerAlign: 'right' },
    {
      field: 'code', headerName: 'Codice', width: 78,
      renderCell: (p) => <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'text.secondary' }}>{p.value as string}</Box>,
    },
    {
      field: 'display_name', headerName: 'Cliente', flex: 1, minWidth: 180,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box component="span" sx={{ fontWeight: 550, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.value as string}</Box>
          {p.row.has_vpn && <VpnPill row={p.row} onClick={onVpnClick} />}
        </Box>
      ),
    },
    {
      // Il lookup "stato" del cliente contiene il vendor (Philips, Biotron, …):
      // colore di riconoscimento, mai semaforico.
      field: 'status_label', headerName: 'Vendor', width: 136,
      renderCell: (p) => <VendorMark label={p.value as string} color={vendorColor((p.value as string) || '')} />,
    },
    {
      field: 'city', headerName: 'Città · prov.', width: 132,
      renderCell: (p) => p.row.city || p.row.province ? (
        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{p.row.city}{p.row.province ? <Box component="span" sx={{ ml: 0.5, fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>{p.row.province}</Box> : null}</Box>
      ) : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>,
    },
    {
      field: 'primary_contact_name', headerName: 'Contatto primario', width: 160,
      renderCell: (p) => {
        const r = p.row
        if (!r.primary_contact_name) return missing('Nessun contatto')
        const tip = [r.primary_contact_phone, r.primary_contact_email].filter(Boolean).join(' · ')
        return tip ? <Tooltip title={tip}><span>{r.primary_contact_name}<Box component="span" sx={srOnlySx}>{`, ${tip}`}</Box></span></Tooltip> : <span>{r.primary_contact_name}</span>
      },
    },
    { field: 'sites_count', headerName: 'Siti', width: 64, align: 'right', headerAlign: 'right', renderCell: (p) => numCell(p.row.sites_count) },
    { field: 'assets_count', headerName: 'Inventari', width: 80, align: 'right', headerAlign: 'right', renderCell: (p) => numCell(p.row.assets_count) },
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
    {
      field: 'next_contract_end', headerName: 'Contratto', width: 112,
      renderCell: (p) => {
        const r = p.row
        if (!r.active_contracts_count || !r.next_contract_end) return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
        return daysTo(r.next_contract_end) <= EXPIRING_DAYS
          ? <ExpiryMark date={r.next_contract_end} title={r.next_contract_title} />
          : <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{r.active_contracts_count} {r.active_contracts_count === 1 ? 'attivo' : 'attivi'}</Box>
      },
    },
    {
      field: 'vat_number', headerName: 'P.IVA', width: 122,
      renderCell: (p) => p.value ? <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12 }}>{p.value as string}</Box> : missing('Manca'),
    },
    { field: 'tax_code', headerName: 'Codice fiscale', width: 160 },
  ]
}

// ─── Mobile card renderer ────────────────────────────────────────────────────

const touchLinkSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 44, px: 1.25, borderRadius: '8px', border: '1px solid', borderColor: 'divider',
  color: 'text.primary', fontSize: 13, fontWeight: 550, textDecoration: 'none', minWidth: 0,
  '& svg': { color: 'primary.main' }, '&:active': { bgcolor: 'action.selected' },
} as const

function makeRenderCustomerCard(onVpnClick: (row: CustomerRow) => void, vendorColor: (l: string) => string): MobileCardRenderFn<CustomerRow> {
  return ({ row, onOpen }) => {
    const phone = row.primary_contact_phone?.trim() || ''
    const email = row.primary_contact_email?.trim() || ''
    return (
      <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, cursor: 'pointer', display: 'grid', gap: 0.75, '&:active': { bgcolor: 'action.hover' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{row.display_name || row.name}</Typography>
          {row.open_issues_count ? <Box component="span" sx={{ fontSize: 12, fontWeight: 600, px: '7px', borderRadius: '5px', bgcolor: 'archie.neutralBg' }}>{row.open_issues_count}</Box> : null}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, fontSize: 13 }}>
          <VendorMark label={row.status_label} color={vendorColor(row.status_label || '')} />
          <Box component="span" sx={{ color: 'text.secondary' }}>{row.city}{row.province ? ` ${row.province}` : ''}</Box>
        </Box>
        {phone || email || row.has_vpn ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }} onClick={(e) => e.stopPropagation()}>
            {phone ? <Box component="a" href={`tel:${phone.replace(/\s+/g, '')}`} aria-label={`Chiama ${phone}`} sx={touchLinkSx}><CampoIcon name="phone" size={16} bold /><Box component="span" sx={{ fontFamily: '"Geist Mono", monospace' }}>{phone}</Box></Box> : null}
            {email ? <Box component="a" href={`mailto:${email}`} aria-label={`Scrivi a ${email}`} sx={{ ...touchLinkSx, flex: '1 1 auto', maxWidth: '100%' }}><CampoIcon name="mail" size={16} bold /><Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</Box></Box> : null}
            {row.has_vpn ? <VpnPill row={row} onClick={onVpnClick} size="touch" /> : null}
          </Box>
        ) : null}
      </Box>
    )
  }
}

type CustView = 'all' | 'iss' | 'exp' | 'inc'
type ColQ = { code: string; name: string; vendor: string; city: string; contact: string; vat: string }
const EMPTY_COLQ: ColQ = { code: '', name: '', vendor: '', city: '', contact: '', vat: '' }
type ViewState = { view: CustView; status: string; vpn: string; contact: string }

// prettier-ignore
export default function Customers() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const undoToast = useUndoToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const tokens = useStatusTokens()
  
  const canChange = hasPerm(PERMS.crm.customer.change)
  const canDelete = hasPerm(PERMS.crm.customer.delete)
  const canEditVpn = hasPerm(PERMS.crm.vpn.change) || hasPerm(PERMS.crm.vpn.add)
  const showDevices = hasPerm(PERMS.device.device.view)

  const grid = useServerGrid({
    defaultOrdering: 'display_name',
    allowedOrderingFields: ['id', 'code', 'display_name', 'status_label', 'city', 'province', 'primary_contact_name', 'vat_number', 'tax_code', 'sites_count', 'assets_count', 'open_issues_count', 'next_contract_end'],
    defaultPageSize: 25,
  })

  // Vista (schede) e filtri da intestazione, nell'URL.
  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: CustView = (['all', 'iss', 'exp', 'inc'] as const).includes(viewRaw as CustView) ? (viewRaw as CustView) : 'all'
  const [statusFilter, setStatusFilter] = useUrlStringParam('status')
  const [vpnFilter, setVpnFilter] = useUrlStringParam('has_vpn')
  const [contactFilter, setContactFilter] = useUrlStringParam('has_contact')
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const setView = (v: string) => { setSavedId(null); setViewRaw(v === 'all' ? '' : v, filterOpts) }
  const hasActiveFilters = Boolean(statusFilter || vpnFilter || contactFilter)
  const resetFilters = React.useCallback(() => {
    setStatusFilter('', { patch: { page: 1, has_vpn: '', has_contact: '' }, keepOpen: true })
  }, [setStatusFilter])

  // Ricerca per colonna (lente)
  const [colSearchOpen, setColSearchOpen] = React.useState(false)
  const [colQ, setColQ] = React.useState<ColQ>(EMPTY_COLQ)
  const colQActive = Object.values(colQ).some(Boolean)
  const setCol = (k: keyof ColQ) => (v: string) => { setColQ((c) => ({ ...c, [k]: v })); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }

  // Viste salvate
  const saved = useSavedViews<ViewState>('customers', me?.username)
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const applySaved = (id: string) => {
    const v = saved.views.find((x) => x.id === id); if (!v) return
    setSavedId(id)
    setViewRaw(v.state.view === 'all' ? '' : v.state.view, { patch: { page: 1, status: v.state.status, has_vpn: v.state.vpn, has_contact: v.state.contact }, keepOpen: true })
  }

  const { setQ: setGridQ } = grid
  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim()) || colQActive
    if (grid.view === 'deleted' && !searching && !hasActiveFilters) return { title: 'Cestino vuoto', subtitle: 'Non ci sono clienti eliminati.' }
    if (searching || hasActiveFilters || view !== 'all') {
      return {
        title: 'Nessun risultato',
        subtitle: 'Nessun cliente corrisponde: prova a modificare la ricerca, la vista o i filtri.',
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {grid.search.trim() || colQActive ? <Button variant="outlined" onClick={() => { setGridQ(''); setColQ(EMPTY_COLQ) }}>Cancella ricerca</Button> : null}
            {hasActiveFilters ? <Button variant="outlined" onClick={resetFilters}>Azzera filtri</Button> : null}
          </Stack>
        ),
      }
    }
    return {
      title: 'Nessun cliente', subtitle: 'Non ci sono ancora clienti.',
      action: <Can perm={PERMS.crm.customer.add}><Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}>Crea cliente</Button></Can>,
    }
  }, [grid.view, grid.search, colQActive, view, setGridQ, hasActiveFilters, resetFilters, loc.pathname, loc.search, navigate])

  const [statuses, setStatuses] = React.useState<LookupItem[]>([])
  const vendorOrder = React.useMemo(() => [...statuses].sort((a, b) => a.id - b.id).map((x) => x.label), [statuses])
  const vendorColor = React.useCallback((l: string) => vendorColorOf(l, tokens.clientChipPalette, vendorOrder), [tokens.clientChipPalette, vendorOrder])

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
          ...(vpnFilter ? { has_vpn: vpnFilter } : {}),
          ...(contactFilter ? { has_contact: contactFilter } : {}),
          ...(view === 'iss' ? { has_open_issues: 'true' } : view === 'exp' ? { contract_expiring: 'true' } : view === 'inc' ? { incomplete: 'true' } : {}),
          ...(colQ.code ? { code_q: colQ.code } : {}),
          ...(colQ.name ? { name_q: colQ.name } : {}),
          ...(colQ.vendor ? { status: colQ.vendor } : {}),
          ...(colQ.city ? { city_q: colQ.city } : {}),
          ...(colQ.contact ? { contact_q: colQ.contact } : {}),
          ...(colQ.vat ? { vat_q: colQ.vat } : {}),
        },
      }),
    [statusFilter, vpnFilter, contactFilter, view, colQ, grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted],
  )

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<CustomerRow>('/customers/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))

  // Indicatori e conteggi delle viste (globali, non filtrati)
  const [kpiReload, setKpiReload] = React.useState(0)
  const summary = useCustomerSummary(kpiReload)
  const reloadAll = React.useCallback(() => { reloadList(); setKpiReload((n) => n + 1) }, [reloadList])

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [drawerTab, setDrawerTab] = React.useState<CustomerTab>('det')
  const [vpnReload, setVpnReload] = React.useState(0)
  const { sitesCount, invCount, driveCount, devicesCount, contractsCount, reset: resetKpis } = useCustomerKpis(detail?.id ?? null)

  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  // CRUD dialog
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgSaving, setDlgSaving] = React.useState(false)
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [form, setForm] = React.useState<CustomerForm>({ status: '', name: '', display_name: '', vat_number: '', tax_code: '', province: '', custom_fields: {}, notes: '' })
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  const address = React.useMemo(() => {
    const cf = detail?.custom_fields ?? null
    if (!isRecord(cf)) return null
    const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === 'indirizzo')
    if (!key) return null
    const v = cf[key]
    if (typeof v !== 'string' || !v.trim()) return null
    // La città migliora la geolocalizzazione (Nominatim)
    return [v.trim(), detail?.city?.trim()].filter(Boolean).join(', ')
  }, [detail])

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean, keep?: boolean) => {
      setDetailLoading(true)
      if (!keep) setDetail(null)
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted
        const incParams = includeDeletedParams(inc)
        const res = await api.get<CustomerDetail>(`/customers/${id}/`, incParams ? { params: incParams } : undefined)
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
      setStatuses(Array.isArray(data) ? data : (data.results ?? []))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  React.useEffect(() => { loadStatuses() }, [loadStatuses])

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    setDrawerTab('det')
    loadDetail(id)
  }, [grid.openId, loadDetail])

  const openDrawer = React.useCallback(
    (id: number) => {
      lastOpenRef.current = id
      setSelectedId(id)
      setDrawerOpen(true)
      setDrawerTab((t) => (selectedId === id ? t : 'det'))
      if (selectedId !== id) resetKpis()
      loadDetail(id)
      grid.setOpenId(id)
    },
    [grid, loadDetail, resetKpis, selectedId],
  )

  // Azioni riga / menu contestuale
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{ row: CustomerRow; mouseX: number; mouseY: number } | null>(null)

  // VPN modal
  const [vpnModalOpen, setVpnModalOpen] = React.useState(false)
  const [vpnModalRow, setVpnModalRow] = React.useState<{ id: number; display_name: string; name: string } | null>(null)
  const openVpnModal = React.useCallback((row: { id: number; display_name: string; name: string }) => { setVpnModalRow(row); setVpnModalOpen(true) }, [])

  const openEditFromRow = React.useCallback((id: number) => { pendingEditIdRef.current = id; openDrawer(id) }, [openDrawer])
  const openDeleteFromRow = React.useCallback((id: number) => { pendingDeleteIdRef.current = id; openDrawer(id) }, [openDrawer])

  const restoreFromRow = React.useCallback(
    async (id: number) => {
      setRestoreBusy(true)
      try {
        await api.post(`/customers/${id}/restore/`)
        toast.success('Cliente ripristinato')
        reloadAll()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setRestoreBusy(false)
      }
    },
    [toast, reloadAll],
  )

  // Dopo un'azione di riga, quando il dettaglio è caricato apre modifica o eliminazione.
  React.useEffect(() => {
    if (!detail) return
    if (pendingEditIdRef.current === detail.id) { pendingEditIdRef.current = null; openEditRef.current?.() }
    if (pendingDeleteIdRef.current === detail.id) { pendingDeleteIdRef.current = null; setDeleteDlgOpen(true) }
  }, [detail])

  const handleRowContextMenu = React.useCallback((row: CustomerRow, event: React.MouseEvent<HTMLElement>) => {
    setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
  }, [])
  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  const newIssueFor = React.useCallback((c: { id: number; display_name: string; name: string }) => {
    navigate('/issues', { state: { createForCustomer: { customerId: c.id, customerName: c.display_name || c.name } } })
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
      { key: 'vpn', label: 'VPN', icon: <LanOutlinedIcon fontSize="small" />, onClick: () => openVpnModal(row), badge: row.has_vpn ? 'configurata' : 'non configurata', badgeTone: row.has_vpn ? 'success' : 'neutral' },
      { key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => openDeleteFromRow(row.id), disabled: deleteBusy, tone: 'danger' },
    ]
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, openVpnModal, restoreBusy, restoreFromRow, newIssueFor])

  const openIssues = React.useCallback((row: CustomerRow) => {
    navigate(`/issues${buildQuery({ cliente: row.display_name || row.name })}`)
  }, [navigate])

  const columns = React.useMemo<GridColDef<CustomerRow>[]>(() => buildColumns(openVpnModal, vendorColor, openIssues), [openVpnModal, vendorColor, openIssues])
  const renderCustomerCard = React.useMemo(() => makeRenderCustomerCard(openVpnModal, vendorColor), [openVpnModal, vendorColor])

  const yesNo = (v: string, yes: string, no: string) => (v === 'true' ? yes : v === 'false' ? no : v)
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => {
    const make = (label: string, value: string, set: (v: string) => void, options: { value: string; label: string }[]) => ({
      value,
      label: `Filtra ${label.toLowerCase()}`,
      onSet: (v: string | number | '') => set(String(v)),
      onReset: () => set(''),
      children: <FilterOptionList label={label} options={options} selected={value ? [value] : []} onChange={(vals) => set(vals[0] ?? '')} single />,
    })
    return {
      status_label: make('Vendor', statusFilter, (v) => setStatusFilter(v, filterOpts), statuses.map((st) => ({ value: String(st.id), label: st.label }))),
      display_name: make('VPN', vpnFilter, (v) => setVpnFilter(v, filterOpts), [{ value: 'true', label: 'Con VPN' }, { value: 'false', label: 'Senza VPN' }]),
      primary_contact_name: make('Contatto primario', contactFilter, (v) => setContactFilter(v, filterOpts), [{ value: 'true', label: 'Con contatto' }, { value: 'false', label: 'Senza contatto' }]),
    }
  }, [statusFilter, vpnFilter, contactFilter, statuses, filterOpts, setStatusFilter, setVpnFilter, setContactFilter])

  const activeFilters: ActiveFilter[] = [
    statusFilter ? { key: 'status', label: 'Vendor', values: statuses.find((s) => String(s.id) === statusFilter)?.label ?? statusFilter } : null,
    vpnFilter ? { key: 'vpn', label: 'VPN', values: yesNo(vpnFilter, 'Con VPN', 'Senza VPN') } : null,
    contactFilter ? { key: 'contact', label: 'Contatto primario', values: yesNo(contactFilter, 'Con contatto', 'Senza contatto') } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'status') setStatusFilter('', filterOpts)
    if (key === 'vpn') setVpnFilter('', filterOpts)
    if (key === 'contact') setContactFilter('', filterOpts)
  }

  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<CustomerRow>({
      url: '/customers/',
      params,
      filename: 'clienti',
      columns: [
        { label: 'Codice', getValue: (r) => r.code },
        { label: 'Cliente', getValue: (r) => r.display_name },
        { label: 'Ragione sociale', getValue: (r) => r.name },
        { label: 'Vendor', getValue: (r) => r.status_label ?? '' },
        { label: 'Città', getValue: (r) => r.city ?? '' },
        { label: 'Provincia', getValue: (r) => r.province ?? '' },
        { label: 'Contatto primario', getValue: (r) => r.primary_contact_name ?? '' },
        { label: 'Telefono', getValue: (r) => r.primary_contact_phone ?? '' },
        { label: 'Email', getValue: (r) => r.primary_contact_email ?? '' },
        { label: 'Siti', getValue: (r) => String(r.sites_count ?? 0) },
        { label: 'Inventari', getValue: (r) => String(r.assets_count ?? 0) },
        { label: 'Issue aperte', getValue: (r) => String(r.open_issues_count ?? 0) },
        { label: 'Prossima scadenza contratto', getValue: (r) => (r.next_contract_end ? dIt(r.next_contract_end) : '') },
        { label: 'P.IVA', getValue: (r) => r.vat_number ?? '' },
        { label: 'Codice fiscale', getValue: (r) => r.tax_code ?? '' },
      ],
    })
  }

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => new URLSearchParams(loc.search).get('return'), [loc.search])

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedId(null)
    lastOpenRef.current = null
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }

  const openCreateOnceRef = React.useRef(false)
  const openCreate = React.useCallback(() => {
    setDlgMode('create')
    setDlgId(null)
    setForm({ status: '', name: '', display_name: '', vat_number: '', tax_code: '', province: '', custom_fields: {}, notes: '' })
    setDlgOpen(true)
    setFieldErrors({})
  }, [])

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
    setForm({
      status: detail.status ?? '', name: detail.name ?? '', display_name: detail.display_name ?? '', vat_number: detail.vat_number ?? '',
      tax_code: detail.tax_code ?? '', province: detail.province ?? '', custom_fields: detail.custom_fields ?? {}, notes: detail.notes ?? '',
    })
    setDlgOpen(true)
    setFieldErrors({})
  }, [detail])
  openEditRef.current = openEdit

  const save = async () => {
    // Validazione client-side: popola fieldErrors come gli errori del backend.
    const clientErrors: Record<string, string> = {}
    if (form.status === '') clientErrors.status = 'Seleziona un vendor.'
    if (!String(form.name).trim()) clientErrors.name = 'Il nome è obbligatorio.'
    if (Object.keys(clientErrors).length) { setFieldErrors(clientErrors); return }

    const payload: Record<string, unknown> = {
      status: Number(form.status),
      name: form.name.trim(),
      display_name: (form.display_name || '').trim() || form.name.trim(),
      vat_number: (form.vat_number || '').trim() || null,
      tax_code: (form.tax_code || '').trim() || null,
      province: (form.province || '').trim() || null,
      custom_fields: form.custom_fields && Object.keys(form.custom_fields).length ? form.custom_fields : null,
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
      reloadAll()
      openDrawer(id)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) setFieldErrors(feedback.fieldErrors)
      toast.error(feedback.message)
    } finally {
      setDlgSaving(false)
    }
  }

  // Modifica sul posto dalle Proprietà, con annulla.
  const patchCustomer = React.useCallback(async (patch: CustomerPatch, label: string) => {
    if (!detail) return
    const id = detail.id
    const prev: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) prev[k] = (detail as Record<string, unknown>)[k] ?? null
    try {
      await api.patch(`/customers/${id}/`, patch)
      await loadDetail(id, undefined, true)
      reloadAll()
      undoToast.show(`${label} · salvato`, async () => {
        try {
          await api.patch(`/customers/${id}/`, prev)
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
      await api.delete(`/customers/${detail.id}/`)
      toast.success('Cliente eliminato')
      grid.setViewMode('all', { keepOpen: true })
      setKpiReload((n) => n + 1)
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
  const tabCount = (n?: number | null) => (typeof n === 'number' ? n : null)

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Clienti"
        actions={<Can perm={PERMS.crm.customer.add}><Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>Nuovo cliente</Button></Can>}
      />
      <CustomerKpis summary={summary} view={view} onView={setView} vendorColor={vendorColor}
        onVendor={(key) => { const st = statuses.find((x) => x.key === key); if (st) setStatusFilter(statusFilter === String(st.id) ? '' : String(st.id), filterOpts) }} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={savedId ? `saved:${savedId}` : view}
          onChange={(k) => { if (k.startsWith('saved:')) { applySaved(k.slice(6)); return } setView(k) }}
          tabs={[
            { key: 'all', label: 'Tutti', count: summary?.total },
            { key: 'iss', label: 'Con issue aperte', count: summary?.with_open_issues },
            { key: 'exp', label: 'Contratti in scadenza', count: summary?.contracts_expiring, tone: 'alert' },
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
          onSave={(name) => { const v = saved.add(name, { view, status: statusFilter, vpn: vpnFilter, contact: contactFilter }); setSavedId(v.id) }} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={renderCustomerCard}
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca clienti, siti, hostname, IP…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
              columnSearch={{ open: colSearchOpen, active: colQActive, onToggle: () => { if (colSearchOpen) setColQ(EMPTY_COLQ); setColSearchOpen((v) => !v) } }}
            />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca clienti, siti, hostname…' }}
          grid={{
            pageKey: 'customers',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            defaultHiddenColumns: ['id', 'tax_code'],
            columnSearch: {
              open: colSearchOpen,
              fields: {
                code: { value: colQ.code, onChange: setCol('code'), placeholder: '#' },
                display_name: { value: colQ.name, onChange: setCol('name'), placeholder: 'Nome o ragione sociale' },
                status_label: { value: colQ.vendor, onChange: setCol('vendor'), options: statuses.map((st) => ({ value: String(st.id), label: st.label })) },
                city: { value: colQ.city, onChange: setCol('city'), placeholder: 'Città o provincia' },
                primary_contact_name: { value: colQ.contact, onChange: setCol('contact'), placeholder: 'Nome o telefono' },
                vat_number: { value: colQ.vat, onChange: setCol('vat'), placeholder: 'P.IVA' },
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

      {vpnModalRow && (
        <VpnModal
          open={vpnModalOpen}
          onClose={() => { setVpnModalOpen(false); reloadAll(); setVpnReload((n) => n + 1); if (detail?.id === vpnModalRow.id) void loadDetail(detail.id, undefined, true) }}
          customerId={vpnModalRow.id}
          customerName={vpnModalRow.display_name || vpnModalRow.name}
        />
      )}

      {drawerOpen ? (
        <CustomerDetailCard
          detail={detail}
          loading={detailLoading}
          statuses={statuses}
          vendorColor={vendorColor}
          canChange={canChange}
          canDelete={canDelete}
          canEditVpn={canEditVpn}
          tab={drawerTab}
          onTab={setDrawerTab}
          counts={{ sites: tabCount(sitesCount), inventories: tabCount(invCount), drive: tabCount(driveCount), contracts: tabCount(contractsCount), devices: tabCount(devicesCount) }}
          address={address}
          position={drawerIndex >= 0 ? `${drawerIndex + 1} di ${rows.length}` : undefined}
          onPrev={drawerIndex > 0 ? () => openDrawer(rows[drawerIndex - 1].id) : undefined}
          onNext={drawerIndex >= 0 && drawerIndex < rows.length - 1 ? () => openDrawer(rows[drawerIndex + 1].id) : undefined}
          onClose={closeDrawer}
          onEdit={openEdit}
          onDelete={() => setDeleteDlgOpen(true)}
          onRestore={() => void doRestore()}
          onPatch={(patch, label) => void patchCustomer(patch, label)}
          onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
          onEditVpn={() => { if (detail) openVpnModal(detail) }}
          onNewIssue={() => { if (detail) newIssueFor(detail) }}
          onAllContacts={() => { if (detail) navigate(`/contacts${buildQuery({ customer: detail.id })}`) }}
          reloadKey={vpnReload}
          sitesTab={detail ? <CustomerSitesPanel customerId={detail.id} /> : null}
          inventoriesTab={detail ? <CustomerInventoriesPanel customerId={detail.id} showDevices={showDevices} canEditDevices={hasPerm(PERMS.device.device.change)} /> : null}
          documentsTab={detail ? <CustomerDocumentsPanel customerId={detail.id} showContracts={hasPerm(PERMS.contracts.contract.view)} /> : null}
          activityTab={detail ? <CustomerActivityPanel customerId={detail.id} /> : null}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Confermi eliminazione?"
        description={detail?.code
          ? `Il cliente verrà spostato nel cestino e potrà essere ripristinato.\n\n${detail.code} • ${detail.display_name}`
          : 'Il cliente verrà spostato nel cestino e potrà essere ripristinato.'}
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
