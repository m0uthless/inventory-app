import * as React from 'react'

import {
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import UndoIcon from '@mui/icons-material/Undo'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { useLocation, useNavigate } from 'react-router-dom'
import { buildQuery } from '@shared/utils/nav'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'

import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'

import { api } from '@shared/api/client'
import PurchaseOrderDialog from '../features/purchaseorders/PurchaseOrderDialog'
import PurchaseOrderDetailCard, { type PoPatch, type PoEvent, type PoUser } from '../features/purchaseorders/PurchaseOrderDetailCard'
import { Committente, PoStatusBadge } from '../features/purchaseorders/PoBadges'
import { PageHead, ViewTabs, FilterOptionList, TableBar, headerFilterGridSx, useUndoToast } from '../ui/campo'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import PurchaseOrderTransitionDialog, {
  type TransitionExtraFields,
} from '../features/purchaseorders/PurchaseOrderTransitionDialog'
import PurchaseOrderKpis, { usePoYearStats } from '../features/purchaseorders/PurchaseOrderKpis'
import { useExportCsv } from '@shared/ui/useExportCsv'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import {
  emptySelectionModel,
  selectionSize,
  selectionToNumberIds,
} from '@shared/utils/gridSelection'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'

import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import ConfirmActionDialog from '@shared/ui/ConfirmActionDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'

import type {
  CustomerItem,
  DocumentSlot,
  PurchaseOrderDetail,
  PurchaseOrderForm,
  PurchaseOrderRow,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
} from '../features/purchaseorders/types'
import {
  CURRENT_YEAR,
  STATUS_LABEL,
  STATUS_ORDER,
  emptyForm,
  formatEuro,
  formatItDate,
  nextStatus,
  prevStatus,
} from '../features/purchaseorders/types'
import { committenteColor, type DomainStatusTokens } from '../theme/statusTokens'
import { useStatusTokens } from '../theme/AppThemeProvider'

type OpenCreateState = { openCreate?: boolean }

type TransitionState = {
  id: number
  direction: 'advance' | 'revert'
  fromStatus: PurchaseOrderStatus
  toStatus: PurchaseOrderStatus
  initialPurchaseOrder: string
  initialInvoiceNumber: string
}

const KIND_LABEL: Record<string, string> = { ordinario: 'Ordinario', extra: 'Extra' }

type PoView = 'all' | 'send' | 'wait' | 'inv' | 'done'
const VIEW_STATUS: Record<PoView, PurchaseOrderStatus | null> = { all: null, send: 'inserito', wait: 'inviato', inv: 'ricevuto', done: 'fatturato' }

// Filtro tipo PO (vicino al selettore anni): 'all' = nessun filtro kind lato API.
type KindFilterValue = 'all' | 'ordinario' | 'extra'
const KIND_FILTER_OPTIONS: { value: KindFilterValue; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'ordinario', label: 'Ordinario' },
  { value: 'extra', label: 'Extra' },
]

// `cols` era una costante a livello di modulo: STATUS_COLOR/committenteColor
// leggevano una palette fissa, non theme-aware. Ora è una factory chiamata
// dentro il componente (useMemo su statusTokens = useStatusTokens()), così
// i colori seguono il tema attivo.
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function buildColumns(statusTokens: DomainStatusTokens): GridColDef<PurchaseOrderRow>[] {
  const custLabel = (row: PurchaseOrderRow) => row.customer_name || row.customer_code || row.customer_placeholder || ''
  return [
    {
      field: 'offer_date',
      headerName: 'Data offerta',
      width: 120,
      renderCell: (p) => <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{formatItDate(p.row.offer_date)}</Typography>,
    },
    {
      field: 'client_name',
      headerName: 'Committente · cliente',
      flex: 1,
      minWidth: 200,
      renderCell: (p) => {
        const c = committenteColor(p.row.client_name, statusTokens.clientChipPalette)
        const cust = custLabel(p.row)
        return <Committente name={p.row.client_name} color={c.color} sub={cust && cust !== p.row.client_name ? <>→ {cust}{p.row.is_customer_placeholder ? ' · non in anagrafica' : ''}</> : undefined} />
      },
    },
    {
      field: 'description',
      headerName: 'Descrizione',
      flex: 1.4,
      minWidth: 220,
      renderCell: (p) => <Typography component="span" sx={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.row.description}</Typography>,
    },
    {
      field: 'kind',
      headerName: 'Tipo',
      width: 92,
      renderCell: (p) => (
        <Box component="span" sx={{
          display: 'inline-flex', alignItems: 'center', height: 20, px: 0.875, borderRadius: '5px', fontSize: 11, fontWeight: 600, border: '1px solid',
          ...(p.value === 'extra' ? { bgcolor: 'archie.field', color: 'primary.main', borderColor: 'archie.fieldLine' } : { color: 'text.secondary', borderColor: 'divider' }),
        }}>{KIND_LABEL[p.value as string] || p.value}</Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Stato',
      width: 136,
      renderCell: (p) => <PoStatusBadge status={p.value as PurchaseOrderStatus} />,
    },
    {
      field: 'purchase_order',
      headerName: 'PO · fattura',
      width: 150,
      renderCell: (p) => (
        <Box sx={{ lineHeight: 1.3, minWidth: 0 }}>
          <Box sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: p.row.purchase_order ? 'text.primary' : 'text.disabled' }}>{p.row.purchase_order || 'PO —'}</Box>
          {p.row.invoice_number ? <Box sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, color: 'text.secondary' }}>{p.row.invoice_number}</Box>
            : p.row.purchase_order ? <Box sx={{ fontSize: 11, color: 'text.disabled' }}>fattura da emettere</Box> : null}
        </Box>
      ),
    },
    {
      field: 'amount',
      headerName: 'Importo',
      width: 128,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => (
        <Box sx={{ textAlign: 'right', lineHeight: 1.3 }}>
          <Box sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(p.row.amount)}</Box>
          {p.row.amount_mode === 'giornate' && p.row.days ? <Box sx={{ fontSize: 11, color: 'text.secondary' }}>{Number(p.row.days).toLocaleString('it-IT')} gg × {formatEuro(p.row.daily_rate)}</Box> : null}
        </Box>
      ),
    },
    {
      field: 'followed_by_name',
      headerName: 'Seguito da',
      width: 150,
      sortable: false,
      renderCell: (p) => <Box component="span" sx={{ color: p.value ? 'text.primary' : 'text.disabled' }}>{(p.value as string) || '—'}</Box>,
    },
    {
      field: 'costs_incurred',
      headerName: 'Costi',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', color: p.row.costs_incurred ? 'text.primary' : 'text.disabled' }}>{p.row.costs_incurred ? formatEuro(p.row.costs_incurred) : '—'}</Box>,
    },
  ]
}

// ─── Mobile card renderer ────────────────────────────────────────────────────
// Stesso motivo di buildColumns sopra: factory chiamata dentro il componente.

function makeRenderPurchaseOrderCard(
  statusTokens: DomainStatusTokens,
): MobileCardRenderFn<PurchaseOrderRow> {
  return ({ row, onOpen, onContextMenu }) => (
    <Box role="button" tabIndex={0} onClick={() => onOpen(row.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row.id) }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(row, e) }}
      sx={{ display: 'grid', gap: 0.5, p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PoStatusBadge status={row.status} />
        <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{formatItDate(row.offer_date)}</Typography>
        <Typography component="span" sx={{ ml: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(row.amount)}</Typography>
      </Box>
      <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{row.description}</Typography>
      <Committente name={row.client_name} color={committenteColor(row.client_name, statusTokens.clientChipPalette).color}
        sub={row.purchase_order ? <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace' }}>{row.purchase_order}</Box> : undefined} />
    </Box>
  )
}

export default function PurchaseOrders() {
  const statusTokens = useStatusTokens()
  const { me, hasPerm } = useAuth()
  const canChange = hasPerm(PERMS.purchaseorders.entry.change)
  const canDelete = hasPerm(PERMS.purchaseorders.entry.delete)
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const grid = useServerGrid({
    defaultOrdering: '-offer_date',
    allowedOrderingFields: [
      'offer_date',
      'client_name',
      'description',
      'purchase_order',
      'kind',
      'status',
      'amount',
      'is_invoiced',
      'costs_incurred',
      'customer_name',
      'created_at',
      'updated_at',
    ],
    defaultPageSize: 25,
  })

  // Purchase Order sono divisi per anno (offer_date): anno corrente di default.
  const [year, setYear] = useUrlNumberParam('year', { defaultValue: CURRENT_YEAR })
  const effectiveYear = year === '' ? CURRENT_YEAR : year

  // Filtro tipo PO (Tutti/Ordinario/Extra), vicino al selettore anni: filtra
  // sia la lista (via querystring `kind`, già supportato dal filterset
  // backend) sia i KPI (via `summary?kind=`).
  const [kindFilterRaw, setKindFilterRaw] = useUrlStringParam('kind', { defaultValue: 'all' })
  const kindFilter: KindFilterValue =
    kindFilterRaw === 'ordinario' || kindFilterRaw === 'extra' ? kindFilterRaw : 'all'

  // Viste per stato del flusso (schede nel riquadro), salvate nell'URL.
  const [poViewRaw, setPoViewRaw] = useUrlStringParam('vista', { defaultValue: 'all' })
  const poView: PoView = (['all', 'send', 'wait', 'inv', 'done'] as const).includes(poViewRaw as PoView) ? (poViewRaw as PoView) : 'all'
  const setPoView = (v: string) => setPoViewRaw(v === 'all' ? '' : v, { patch: { page: 1 }, keepOpen: false })

  // Ricerca per colonna (riga sotto le intestazioni, aperta dalla lente).
  const EMPTY_COLQ = { month: '', client: '', description: '', kind: '', status: '', ref: '' }
  const [colSearchOpen, setColSearchOpen] = React.useState(false)
  const [colQ, setColQ] = React.useState(EMPTY_COLQ)
  const colQActive = Object.values(colQ).some(Boolean)
  const setCol = (k: keyof typeof EMPTY_COLQ) => (v: string) => { setColQ((c) => ({ ...c, [k]: v })); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }

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
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono Purchase Order eliminati.' }
    }
    if (!grid.search.trim()) {
      return {
        title: 'Nessun Purchase Order',
        subtitle: 'Crea un nuovo Purchase Order o cambia i filtri.',
        action: (
          <Can perm={PERMS.purchaseorders.entry.add}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}
            >
              Crea Purchase Order
            </Button>
          </Can>
        ),
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
  }, [grid.view, grid.search, loc.pathname, loc.search, navigate])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        // "is_invoiced"/"customer_name" (colonne del datagrid) non sono campi
        // DB reali sul backend: si traducono nei campi/relazioni sottostanti
        // solo qui, al momento di costruire la querystring — grid.ordering e
        // il sortModel visivo della grid restano sui nomi colonna originali.
        orderingMap: {
          is_invoiced: 'invoice_number',
          customer_name: 'customer__display_name',
        },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          year: effectiveYear,
          ...(kindFilter !== 'all' ? { kind: kindFilter } : {}),
          ...(VIEW_STATUS[poView] ? { status: VIEW_STATUS[poView] } : {}),
          ...(colQ.month ? { month: colQ.month } : {}),
          ...(colQ.client ? { client_q: colQ.client } : {}),
          ...(colQ.description ? { description_q: colQ.description } : {}),
          ...(colQ.kind ? { kind: colQ.kind } : {}),
          ...(colQ.status ? { status: colQ.status } : {}),
          ...(colQ.ref ? { ref_q: colQ.ref } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
      effectiveYear,
      kindFilter,
      poView,
      colQ,
    ],
  )

  const {
    rows,
    rowCount,
    loading,
    reload: reloadList,
  } = useDrfList<PurchaseOrderRow>('/purchase-order-entries/', listParams, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  // KPI (indipendenti da paginazione/ordinamento, filtrati solo per anno)
  const [summary, setSummary] = React.useState<PurchaseOrderSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = React.useState(false)

  const loadSummary = React.useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await api.get<PurchaseOrderSummary>('/purchase-order-entries/summary/', {
        params: {
          year: effectiveYear,
          ...(kindFilter !== 'all' ? { kind: kindFilter } : {}),
        },
      })
      setSummary(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSummaryLoading(false)
    }
  }, [effectiveYear, kindFilter, toast])

  React.useEffect(() => {
    loadSummary()
  }, [loadSummary, rows])

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([])

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<PurchaseOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

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
  const [form, setForm] = React.useState<PurchaseOrderForm>(emptyForm())

  // workflow: avanzamento/ritorno di stato
  const [transitionState, setTransitionState] = React.useState<TransitionState | null>(null)
  const [transitionBusy, setTransitionBusy] = React.useState(false)

  // workflow: upload documenti (drawer)
  const [uploadingSlot, setUploadingSlot] = React.useState<DocumentSlot | null>(null)

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

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean, keep?: boolean) => {
      setDetailLoading(true)
      if (!keep) setDetail(null)
      try {
        const inc = forceIncludeDeleted ?? grid.includeDeleted
        const incParams = includeDeletedParams(inc)
        const res = await api.get<PurchaseOrderDetail>(
          `/purchase-order-entries/${id}/`,
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

  // `keep`: passando al precedente/successivo la finestra resta quella di prima finché arriva il nuovo PO.
  const openDrawer = React.useCallback(
    (id: number, keep?: boolean) => {
      setSelectedId(id)
      setDrawerOpen(true)
      loadDetail(id, undefined, keep)
      grid.setOpenId(id)
    },
    [grid, loadDetail],
  )

  // ── Azioni riga / menu contestuale ──────────────────────────────────────────
  const pendingEditIdRef = React.useRef<number | null>(null)
  const pendingDeleteIdRef = React.useRef<number | null>(null)
  const openEditRef = React.useRef<(() => void | Promise<void>) | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{
    row: PurchaseOrderRow
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
        await api.post(`/purchase-order-entries/${id}/restore/`)
        toast.success('Purchase Order ripristinato')
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setRestoreBusy(false)
      }
    },
    [reloadList, toast],
  )

  React.useEffect(() => {
    if (!detail) return
    if (pendingEditIdRef.current === detail.id) {
      pendingEditIdRef.current = null
      const fn = openEditRef.current
      if (fn) void fn()
    }
    if (pendingDeleteIdRef.current === detail.id) {
      pendingDeleteIdRef.current = null
      setDeleteDlgOpen(true)
    }
  }, [detail])

  const handleRowContextMenu = React.useCallback(
    (row: PurchaseOrderRow, event: React.MouseEvent<HTMLElement>) => {
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    },
    [],
  )

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null)
  }, [])

  const openTransition = React.useCallback(
    (row: PurchaseOrderRow, direction: 'advance' | 'revert') => {
      const target = direction === 'advance' ? nextStatus(row.status) : prevStatus(row.status)
      if (!target) return
      setTransitionState({
        id: row.id,
        direction,
        fromStatus: row.status,
        toStatus: target,
        initialPurchaseOrder: row.purchase_order || '',
        initialInvoiceNumber: row.invoice_number || '',
      })
    },
    [],
  )

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

    const workflowItems: RowContextMenuItem[] = []
    const forward = nextStatus(row.status)
    const backward = prevStatus(row.status)
    if (canChange && forward) {
      workflowItems.push({
        key: 'advance',
        label: `Segna come "${STATUS_LABEL[forward]}"`,
        icon: <ArrowForwardIcon fontSize="small" />,
        onClick: () => openTransition(row, 'advance'),
      })
    }
    if (canChange && backward) {
      workflowItems.push({
        key: 'revert',
        label: `Riporta a "${STATUS_LABEL[backward]}"`,
        icon: <UndoIcon fontSize="small" />,
        onClick: () => openTransition(row, 'revert'),
      })
    }

    return [
      {
        key: 'open',
        label: 'Apri',
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => openDrawer(row.id),
      },
      ...workflowItems,
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
  }, [
    contextMenu,
    deleteBusy,
    openDeleteFromRow,
    openDrawer,
    openEditFromRow,
    openTransition,
    restoreBusy,
    restoreFromRow,
    canChange,
  ])

  const columns = React.useMemo<GridColDef<PurchaseOrderRow>[]>(() => {
    return buildColumns(statusTokens)
  }, [statusTokens])

  const renderPurchaseOrderCard = React.useMemo(
    () => makeRenderPurchaseOrderCard(statusTokens),
    [statusTokens],
  )

  // If opened from global Search, we can return back to the Search results on close.
  const returnTo = React.useMemo(() => {
    return new URLSearchParams(loc.search).get('return')
  }, [loc.search])

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    grid.setOpenId(null)
    if (returnTo) navigate(returnTo, { replace: true })
  }, [grid, returnTo, navigate])

  const doDelete = React.useCallback(async () => {
    const cid = detail?.id; if (!cid) return
    setDeleteBusy(true)
    try {
      await api.delete(`/purchase-order-entries/${cid}/`)
      toast.success('Purchase Order eliminato.')
      setDeleteDlgOpen(false)
      closeDrawer()
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }, [detail?.id, toast, closeDrawer, reloadList])

  const doBulkRestore = async (): Promise<boolean> => {
    const ids = selectedIds.filter((n) => Number.isFinite(n))
    if (!ids.length) return false
    setRestoreBusy(true)
    try {
      await api.post(`/purchase-order-entries/bulk_restore/`, { ids })
      toast.success(`Ripristinati ${ids.length} elementi`)
      setSelectionModel(emptySelectionModel())
      reloadList()
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      return false
    } finally {
      setRestoreBusy(false)
    }
  }

  const doRestore = React.useCallback(async () => {
    const cid = detail?.id; if (!cid) return
    setRestoreBusy(true)
    try {
      await api.post(`/purchase-order-entries/${cid}/restore/`)
      toast.success('Purchase Order ripristinato.')
      await loadDetail(cid, undefined, true)
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [detail?.id, toast, loadDetail, reloadList])

  // ── Workflow: avanzamento / ritorno di stato ────────────────────────────────

  const doTransition = React.useCallback(
    async (file: File | null, extra: TransitionExtraFields) => {
      if (!transitionState) return
      const { id, direction } = transitionState
      setTransitionBusy(true)
      try {
        if (direction === 'advance') {
          const fd = new FormData()
          if (file) fd.append('document', file)
          if (extra.purchase_order) fd.append('purchase_order', extra.purchase_order)
          if (extra.invoice_number) fd.append('invoice_number', extra.invoice_number)
          await api.post(`/purchase-order-entries/${id}/advance/`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } else {
          await api.post(`/purchase-order-entries/${id}/revert/`)
        }
        toast.success('Stato aggiornato')
        setTransitionState(null)
        reloadList()
        if (detail?.id === id) await loadDetail(id)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setTransitionBusy(false)
      }
    },
    [transitionState, detail?.id, toast, reloadList, loadDetail],
  )

  // ── Workflow: upload documento (drawer, indipendente dalla transizione) ────

  const uploadDocument = React.useCallback(
    async (slot: DocumentSlot, file: File) => {
      const cid = detail?.id; if (!cid) return
      setUploadingSlot(slot)
      try {
        const fd = new FormData()
        fd.append('kind', slot)
        fd.append('file', file)
        await api.post(`/purchase-order-entries/${cid}/documents/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('Documento caricato')
        await loadDetail(cid, undefined, true)
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setUploadingSlot(null)
      }
    },
    [detail?.id, toast, loadDetail, reloadList],
  )

  const [deletingDocId, setDeletingDocId] = React.useState<number | null>(null)

  const deleteDocument = React.useCallback(
    async (docId: number) => {
      const cid = detail?.id; if (!cid) return
      setDeletingDocId(docId)
      try {
        await api.delete(`/purchase-order-entries/${cid}/documents/${docId}/`)
        toast.success('Documento eliminato')
        await loadDetail(cid, undefined, true)
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setDeletingDocId(null)
      }
    },
    [detail?.id, toast, loadDetail, reloadList],
  )

  // Persone che possono seguire un PO (non Philips).
  const [poUsers, setPoUsers] = React.useState<PoUser[]>([])
  React.useEffect(() => {
    let alive = true
    api.get<{ id: number; full_name?: string; username?: string; is_philips?: boolean }[]>('/users/')
      .then((r) => { if (alive) setPoUsers((Array.isArray(r.data) ? r.data : []).filter((u) => !u.is_philips).map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) }))) })
      .catch(() => { if (alive) setPoUsers([]) })
    return () => { alive = false }
  }, [])
  const canAudit = hasPerm('audit.view_auditevent')
  const [poEvents, setPoEvents] = React.useState<PoEvent[] | null>(null)
  React.useEffect(() => {
    if (!detail || !canAudit) { setPoEvents(null); return }
    let alive = true
    api.get('/audit-events/', { params: { app_label: 'purchaseorders', model: 'purchaseorderentry', object_id: String(detail.id), ordering: '-created_at', page_size: 200 } })
      .then((r) => { const d = r.data as { results?: PoEvent[] } | PoEvent[]; if (alive) setPoEvents(Array.isArray(d) ? d : d.results ?? []) })
      .catch(() => { if (alive) setPoEvents(null) })
    return () => { alive = false }
  }, [detail, canAudit])
  const yearStats = usePoYearStats(effectiveYear, kindFilter === 'all' ? null : kindFilter, rows)
  const openColumnsRef = React.useRef<((el: HTMLElement) => void) | null>(null)
  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<PurchaseOrderRow>({
      url: '/purchase-order-entries/',
      params,
      filename: `purchase-order-${effectiveYear}`,
      columns: [
        { label: 'Data offerta', getValue: (r) => r.offer_date },
        { label: 'Committente', getValue: (r) => r.client_name },
        { label: 'Cliente collegato', getValue: (r) => r.customer_name || r.customer_placeholder },
        { label: 'Descrizione', getValue: (r) => r.description },
        { label: 'Tipo', getValue: (r) => KIND_LABEL[r.kind] || r.kind },
        { label: 'Stato', getValue: (r) => STATUS_LABEL[r.status] || r.status },
        { label: 'Purchase Order', getValue: (r) => r.purchase_order },
        { label: 'N. fattura', getValue: (r) => r.invoice_number },
        { label: 'Importo', getValue: (r) => r.amount },
        { label: 'Costi sostenuti', getValue: (r) => r.costs_incurred },
      ],
    })
  }
  const drawerIndex = drawerOpen && detail ? rows.findIndex((r) => r.id === detail.id) : -1

  // Modifica sul posto dal pannello: salva subito, con Annulla (PATCH inverso).
  const undoToast = useUndoToast()
  const patchPo = React.useCallback(async (patch: PoPatch, label: string) => {
    if (!detail) return
    const id = detail.id
    const prev: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) prev[k] = (detail as Record<string, unknown>)[k] ?? (k === 'costs_incurred' || k === 'followed_by' ? null : '')
    try {
      await api.patch(`/purchase-order-entries/${id}/`, patch)
      await loadDetail(id, undefined, true)
      reloadList()
      undoToast.show(`${label} · salvato`, async () => {
        try {
          await api.patch(`/purchase-order-entries/${id}/`, prev)
          await loadDetail(id, undefined, true)
          reloadList()
        } catch (e) {
          toast.error(apiErrorToMessage(e))
        }
      })
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [detail, loadDetail, reloadList, undoToast, toast])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    kind: {
      value: kindFilter === 'all' ? '' : kindFilter,
      label: 'Filtra tipo',
      onSet: (v) => setKindFilterRaw(v === '' ? '' : String(v), { patch: { page: 1 }, keepOpen: false }),
      onReset: () => setKindFilterRaw('', { patch: { page: 1 }, keepOpen: false }),
      children: (
        <FilterOptionList label="Tipo" single
          options={KIND_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
          selected={kindFilter === 'all' ? [] : [kindFilter]}
          onChange={(v) => setKindFilterRaw(v[0] ?? '', { patch: { page: 1 }, keepOpen: false })} />
      ),
    },
  }), [kindFilter, setKindFilterRaw])

  React.useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id

    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id)
  }, [grid.openId, loadDetail])

  // open create from sidebar quick action
  const openCreateOnceRef = React.useRef(false)

  const openCreate = React.useCallback(() => {
    setDlgMode('create')
    setDlgId(null)
    setDlgErrors({})
    setForm(emptyForm())
    setDlgOpen(true)
  }, [])

  React.useEffect(() => {
    const st = (loc.state as OpenCreateState | null | undefined) ?? null
    if (!st?.openCreate) {
      openCreateOnceRef.current = false
      return
    }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc.state, loc.pathname, loc.search, navigate, openCreate])

  const openEdit = React.useCallback(async () => {
    if (!detail) return
    setDlgMode('edit')
    setDlgId(detail.id)
    setDlgErrors({})

    setForm({
      offer_date: detail.offer_date,
      description: detail.description ?? '',
      client_name: detail.client_name ?? '',
      customer: detail.customer ?? '',
      customer_placeholder: detail.customer_placeholder ?? '',
      purchase_order: detail.purchase_order ?? '',
      invoice_number: detail.invoice_number ?? '',
      kind: detail.kind,
      amount_mode: detail.amount_mode,
      days: detail.days ?? '',
      daily_rate: detail.daily_rate ?? '',
      amount: detail.amount ?? '',
      costs_incurred: detail.costs_incurred ?? '',
      notes: detail.notes ?? '',
    })

    setDlgOpen(true)
  }, [detail])

  openEditRef.current = openEdit

  const save = async () => {
    const clientErrors: Record<string, string> = {}
    if (!form.offer_date) clientErrors.offer_date = 'La data offerta è obbligatoria.'
    if (!String(form.description).trim())
      clientErrors.description = 'La descrizione è obbligatoria.'
    if (!String(form.client_name).trim())
      clientErrors.client_name = 'Il committente è obbligatorio.'
    if (form.amount_mode === 'giornate') {
      if (form.days === '' || Number.isNaN(Number(form.days)))
        clientErrors.days = 'Indica le giornate.'
      if (form.daily_rate === '' || Number.isNaN(Number(form.daily_rate)))
        clientErrors.daily_rate = 'Indica la tariffa/giorno.'
    } else {
      if (form.amount === '' || Number.isNaN(Number(form.amount)))
        clientErrors.amount = "Indica l'importo."
    }
    if (Object.keys(clientErrors).length) {
      setDlgErrors(clientErrors)
      return
    }
    setDlgErrors({})

    const payload: Record<string, unknown> = {
      offer_date: form.offer_date,
      description: form.description.trim(),
      client_name: form.client_name.trim(),
      customer: form.customer === '' ? null : Number(form.customer),
      customer_placeholder: form.customer_placeholder.trim(),
      purchase_order: form.purchase_order.trim(),
      invoice_number: form.invoice_number.trim(),
      kind: form.kind,
      amount_mode: form.amount_mode,
      days: form.amount_mode === 'giornate' ? Number(form.days) : null,
      daily_rate: form.amount_mode === 'giornate' ? Number(form.daily_rate) : null,
      amount: form.amount_mode === 'fisso' ? Number(form.amount) : 0,
      costs_incurred: form.costs_incurred === '' ? null : Number(form.costs_incurred),
      notes: form.notes.trim(),
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<PurchaseOrderDetail>('/purchase-order-entries/', payload)
        id = res.data.id
        toast.success('Purchase Order creato')
      } else {
        if (!dlgId) return
        const res = await api.patch<PurchaseOrderDetail>(
          `/purchase-order-entries/${dlgId}/`,
          payload,
        )
        id = res.data.id
        toast.success('Purchase Order aggiornato')
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

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Purchase Order"
        inline={
          <Box role="group" aria-label="Anno" sx={{ display: 'inline-flex', alignItems: 'center', height: 30, border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper', px: '2px' }}>
            <IconButton size="small" aria-label="Anno precedente" onClick={() => setYear(effectiveYear - 1, { patch: { page: 1 }, keepOpen: false })} sx={{ width: 26, height: 26 }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography component="b" sx={{ minWidth: 44, textAlign: 'center', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{effectiveYear}</Typography>
            <IconButton size="small" aria-label="Anno successivo" onClick={() => setYear(effectiveYear + 1, { patch: { page: 1 }, keepOpen: false })} sx={{ width: 26, height: 26 }}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        actions={
          <Can perm={PERMS.purchaseorders.entry.add}>
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>Nuovo PO</Button>
          </Can>
        }
      />
      <PurchaseOrderKpis year={effectiveYear} summary={summary} stats={yearStats} loading={summaryLoading} view={poView} onView={setPoView} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={poView}
          onChange={setPoView}
          tabs={[
            { key: 'all', label: 'Tutti', count: yearStats ? yearStats.byStatus.inserito.n + yearStats.byStatus.inviato.n + yearStats.byStatus.ricevuto.n + yearStats.byStatus.fatturato.n : null },
            { key: 'send', label: 'Da inviare', count: yearStats?.byStatus.inserito.n ?? summary?.to_send },
            { key: 'wait', label: 'In attesa del PO', count: yearStats?.byStatus.inviato.n },
            { key: 'inv', label: 'Da fatturare', count: yearStats?.byStatus.ricevuto.n },
            { key: 'done', label: 'Fatturati', count: yearStats?.byStatus.fatturato.n },
          ]}
        />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          mobileCard={renderPurchaseOrderCard}
          flush
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={kindFilter !== 'all' ? [{ key: 'kind', label: 'Tipo', values: KIND_LABEL[kindFilter] }] : []}
              onRemoveFilter={() => setKindFilterRaw('', { patch: { page: 1 }, keepOpen: false })}
              onClearFilters={() => setKindFilterRaw('', { patch: { page: 1 }, keepOpen: false })}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca descrizione, committente, PO, fattura…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
              columnSearch={{ open: colSearchOpen, active: colQActive, onToggle: () => { if (colSearchOpen) setColQ(EMPTY_COLQ); setColSearchOpen((v) => !v) } }}
            />
          }
          toolbar={{
            compact: true,
            q: grid.q,
            onQChange: grid.setQ,
          }}
          grid={{
            pageKey: 'purchase-orders',
            autoHeight: true,
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
            // Clic: seleziona la riga; doppio clic o Invio: apre la finestra.
            onRowClick: setSelectedId,
            onRowOpen: openDrawer,
            onRowContextMenu: handleRowContextMenu,
            getRowClassName: (row) => (selectedId === row.id ? 'Mui-selected' : undefined),
            rowHeight: 50,
            columnSearch: {
              open: colSearchOpen,
              fields: {
                offer_date: { value: colQ.month, allLabel: 'Tutti i mesi', onChange: setCol('month'), options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
                client_name: { value: colQ.client, onChange: setCol('client'), placeholder: 'Committente o cliente' },
                description: { value: colQ.description, onChange: setCol('description'), placeholder: 'Cerca nella descrizione' },
                kind: { value: colQ.kind, onChange: setCol('kind'), options: [{ value: 'ordinario', label: KIND_LABEL.ordinario }, { value: 'extra', label: KIND_LABEL.extra }] },
                status: { value: colQ.status, onChange: setCol('status'), options: STATUS_ORDER.map((k) => ({ value: k, label: STATUS_LABEL[k] })) },
                purchase_order: { value: colQ.ref, onChange: setCol('ref'), placeholder: 'PO o fattura' },
              },
            },
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {/* La finestra si apre solo con il PO già caricato: niente passaggio da una finestra di attesa. */}
      {drawerOpen && detail ? (
        <PurchaseOrderDetailCard
          detail={detail}
          loading={detailLoading}
          committenteColor={detail ? committenteColor(detail.client_name, statusTokens.clientChipPalette).color : 'transparent'}
          canChange={canChange}
          canDelete={canDelete}
          events={poEvents}
          users={poUsers}
          meId={me?.id ?? null}
          onOpenCustomer={() => { if (detail?.customer) navigate(`/customers${buildQuery({ open: detail.customer })}`) }}
          position={drawerIndex >= 0 ? `${drawerIndex + 1} di ${rows.length}` : undefined}
          onPrev={drawerIndex > 0 ? () => openDrawer(rows[drawerIndex - 1].id, true) : undefined}
          onNext={drawerIndex >= 0 && drawerIndex < rows.length - 1 ? () => openDrawer(rows[drawerIndex + 1].id, true) : undefined}
          onClose={closeDrawer}
          onEdit={() => void openEdit()}
          onDelete={() => setDeleteDlgOpen(true)}
          onRestore={() => void doRestore()}
          onCopy={async (v: string) => {
            await copyToClipboard(v)
            toast.success('Copiato')
          }}
          onPatch={patchPo}
          onAdvance={() => { if (detail) openTransition(detail, 'advance') }}
          onRevert={() => { if (detail) openTransition(detail, 'revert') }}
          uploadingSlot={uploadingSlot}
          deletingDocId={deletingDocId}
          onUploadDocument={uploadDocument}
          onDeleteDocument={deleteDocument}
        />
      ) : null}

      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title="Ripristinare i Purchase Order selezionati?"
        description={`Verranno ripristinati ${selectedCount} Purchase Order dal cestino.`}
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
        title="Confermi eliminazione Purchase Order?"
        description="Il Purchase Order verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      {transitionState ? (
        <PurchaseOrderTransitionDialog
          open={Boolean(transitionState)}
          direction={transitionState.direction}
          fromStatus={transitionState.fromStatus}
          toStatus={transitionState.toStatus}
          initialPurchaseOrder={transitionState.initialPurchaseOrder}
          initialInvoiceNumber={transitionState.initialInvoiceNumber}
          busy={transitionBusy}
          onClose={() => setTransitionState(null)}
          onConfirm={doTransition}
        />
      ) : null}

      <PurchaseOrderDialog
        open={dlgOpen}
        mode={dlgMode}
        saving={dlgSaving}
        errors={dlgErrors}
        customers={customers}
        form={form}
        isEditable={dlgMode === 'create' ? true : (detail?.is_editable ?? true)}
        onClose={() => setDlgOpen(false)}
        onSave={save}
        onFormChange={setForm}
      />
    </Stack>
  )
}
