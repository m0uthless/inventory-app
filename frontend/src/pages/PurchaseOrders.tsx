import * as React from 'react'

import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'

import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'

import { api } from '@shared/api/client'
import PurchaseOrderDialog from '../features/purchaseorders/PurchaseOrderDialog'
import PurchaseOrderDrawer from '../features/purchaseorders/PurchaseOrderDrawer'
import PurchaseOrderTransitionDialog, { type TransitionExtraFields } from '../features/purchaseorders/PurchaseOrderTransitionDialog'
import PurchaseOrderKpis from '../features/purchaseorders/PurchaseOrderKpis'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { emptySelectionModel, selectionSize, selectionToNumberIds } from '@shared/utils/gridSelection'
import { useToast } from '@shared/ui/toast'

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
  STATUS_COLOR,
  STATUS_LABEL,
  committenteColor,
  emptyForm,
  formatEuro,
  formatItDate,
  nextStatus,
  prevStatus,
} from '../features/purchaseorders/types'

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

const cols: GridColDef<PurchaseOrderRow>[] = [
  {
    field: 'offer_date',
    headerName: 'Data offerta',
    width: 120,
    valueGetter: (v, row) => {
      void v
      return formatItDate(row.offer_date)
    },
  },
  {
    field: 'client_name',
    headerName: 'Committente',
    flex: 1,
    minWidth: 180,
    renderCell: (p) => {
      const name = p.value as string
      const c = committenteColor(name)
      return <Chip size="small" label={name} sx={{ bgcolor: c.bg, color: c.color, border: `0.5px solid ${c.border}`, fontWeight: 600 }} />
    },
  },
  { field: 'description', headerName: 'Descrizione', flex: 1.4, minWidth: 220 },
  { field: 'purchase_order', headerName: 'Purchase Order', width: 150 },
  {
    field: 'kind',
    headerName: 'Tipo',
    width: 110,
    renderCell: (p) => (
      <Chip
        size="small"
        label={KIND_LABEL[p.value as string] || p.value}
        variant={p.value === 'extra' ? 'filled' : 'outlined'}
        color={p.value === 'extra' ? 'primary' : 'default'}
      />
    ),
  },
  {
    field: 'status',
    headerName: 'Stato',
    width: 130,
    renderCell: (p) => {
      const st = p.value as PurchaseOrderStatus
      const c = STATUS_COLOR[st]
      return (
        <Chip
          size="small"
          label={STATUS_LABEL[st] || st}
          sx={{ bgcolor: c?.bg, color: c?.color, border: c ? `0.5px solid ${c.border}` : undefined }}
        />
      )
    },
  },
  {
    field: 'amount',
    headerName: 'Importo',
    width: 130,
    align: 'right',
    headerAlign: 'right',
    valueGetter: (v, row) => {
      void v
      return formatEuro(row.amount)
    },
  },
  {
    field: 'is_invoiced',
    headerName: 'Fattura',
    width: 130,
    renderCell: (p) =>
      p.value ? (
        <Chip size="small" label="Fatturato" sx={{ bgcolor: 'rgba(16,185,129,0.10)', color: '#065f46', border: '0.5px solid rgba(16,185,129,0.28)' }} />
      ) : (
        <Chip size="small" variant="outlined" label="Non fatturato" />
      ),
  },
  {
    field: 'costs_incurred',
    headerName: 'Costi sostenuti',
    width: 130,
    align: 'right',
    headerAlign: 'right',
    valueGetter: (v, row) => {
      void v
      return row.costs_incurred ? formatEuro(row.costs_incurred) : '—'
    },
  },
  {
    field: 'customer_name',
    headerName: 'Cliente collegato',
    width: 180,
    valueGetter: (v, row) => {
      void v
      return row.customer_name || row.customer_code || '—'
    },
  },
]


// ─── Mobile card renderer ────────────────────────────────────────────────────

const renderPurchaseOrderCard: MobileCardRenderFn<PurchaseOrderRow> = ({ row, onOpen }) => {
  const meta: { label: string; value: string | null | undefined }[] = [
    { label: 'Data offerta', value: formatItDate(row.offer_date) },
    { label: 'Purchase Order', value: row.purchase_order },
    { label: 'Tipo', value: KIND_LABEL[row.kind] || row.kind },
    { label: 'Costi', value: row.costs_incurred ? formatEuro(row.costs_incurred) : null },
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Chip
            size="small"
            label={row.client_name}
            sx={{
              height: 20, fontSize: '0.68rem', fontWeight: 600, maxWidth: '100%',
              bgcolor: committenteColor(row.client_name).bg,
              color: committenteColor(row.client_name).color,
              border: `0.5px solid ${committenteColor(row.client_name).border}`,
            }}
          />
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.description}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatEuro(row.amount)}
          </Typography>
          <Box sx={{ fontSize: '0.62rem', fontWeight: 600, px: 0.75, py: 0.15, borderRadius: 20, whiteSpace: 'nowrap', mt: 0.25, bgcolor: STATUS_COLOR[row.status]?.bg, color: STATUS_COLOR[row.status]?.color, border: `0.5px solid ${STATUS_COLOR[row.status]?.border}` }}>
            {STATUS_LABEL[row.status] || row.status}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}


// prettier-ignore
export default function PurchaseOrders() {
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
      'kind',
      'amount',
      'created_at',
      'updated_at',
    ],
    defaultPageSize: 25,
  })

  // Purchase Order sono divisi per anno (offer_date): anno corrente di default.
  const [year, setYear] = useUrlNumberParam('year', { defaultValue: CURRENT_YEAR })
  const effectiveYear = year === '' ? CURRENT_YEAR : year

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

  // filters (URL)
  const [kindFilter, setKindFilter] = useUrlStringParam('kind')
  const [statusFilter, setStatusFilter] = useUrlStringParam('status')
  const [invoicedFilter, setInvoicedFilter] = useUrlStringParam('invoiced')
  const [customerId, setCustomerId] = useUrlNumberParam('customer')

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          year: effectiveYear,
          ...(kindFilter !== '' ? { kind: kindFilter } : {}),
          ...(statusFilter !== '' ? { status: statusFilter } : {}),
          ...(invoicedFilter !== '' ? { invoiced: invoicedFilter } : {}),
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
      effectiveYear,
      kindFilter,
      statusFilter,
      invoicedFilter,
      customerId,
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
        params: { year: effectiveYear },
      })
      setSummary(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSummaryLoading(false)
    }
  }, [effectiveYear, toast])

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
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true)
      setDetail(null)
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

  const openDrawer = React.useCallback(
    (id: number) => {
      setSelectedId(id)
      setDrawerOpen(true)
      loadDetail(id)
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
        toast.success('Purchase Order ripristinato ✅')
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

  const openTransition = React.useCallback((row: PurchaseOrderRow, direction: 'advance' | 'revert') => {
    const target = direction === 'advance' ? nextStatus(row.status) : prevStatus(row.status)
    if (!target) return
    setTransitionState({
      id: row.id, direction, fromStatus: row.status, toStatus: target,
      initialPurchaseOrder: row.purchase_order || '',
      initialInvoiceNumber: row.invoice_number || '',
    })
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
  }, [contextMenu, deleteBusy, openDeleteFromRow, openDrawer, openEditFromRow, openTransition, restoreBusy, restoreFromRow, canChange])

  const columns = React.useMemo<GridColDef<PurchaseOrderRow>[]>(() => {
    return cols
  }, [])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    kind: {
      value: kindFilter,
      label: 'Filtra per tipo',
      onSet: (v) => setKindFilter(v as string, { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setKindFilter('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Tipo</InputLabel>
          <Select
            label="Tipo"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value, { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            <MenuItem value="ordinario">Ordinario</MenuItem>
            <MenuItem value="extra">Extra</MenuItem>
          </Select>
        </FormControl>
      ),
    },
    status: {
      value: statusFilter,
      label: 'Filtra per stato',
      onSet: (v) => setStatusFilter(v as string, { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setStatusFilter('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Stato</InputLabel>
          <Select
            label="Stato"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value, { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            <MenuItem value="inserito">Inserito</MenuItem>
            <MenuItem value="inviato">Inviato</MenuItem>
            <MenuItem value="ricevuto">Ricevuto</MenuItem>
            <MenuItem value="fatturato">Fatturato</MenuItem>
          </Select>
        </FormControl>
      ),
    },
    is_invoiced: {
      value: invoicedFilter,
      label: 'Filtra per fatturazione',
      onSet: (v) => setInvoicedFilter(v as string, { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setInvoicedFilter('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Fattura</InputLabel>
          <Select
            label="Fattura"
            value={invoicedFilter}
            onChange={(e) => setInvoicedFilter(e.target.value, { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            <MenuItem value="1">Fatturato</MenuItem>
            <MenuItem value="0">Non fatturato</MenuItem>
          </Select>
        </FormControl>
      ),
    },
    customer_name: {
      value: customerId,
      label: 'Filtra per cliente collegato',
      onSet: (v) => setCustomerId(v as number | '', { patch: { page: 1 }, keepOpen: true }),
      onReset: () => setCustomerId('', { patch: { page: 1 }, keepOpen: true }),
      children: (
        <FormControl size="small" fullWidth>
          <InputLabel>Cliente collegato</InputLabel>
          <Select
            label="Cliente collegato"
            value={customerId === '' ? '' : String(customerId)}
            onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value), { patch: { page: 1 }, keepOpen: true })}
          >
            <MenuItem value="">Tutti</MenuItem>
            {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>)}
          </Select>
        </FormControl>
      ),
    },
  }), [kindFilter, statusFilter, invoicedFilter, customerId, setKindFilter, setStatusFilter, setInvoicedFilter, setCustomerId, customers])

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
    if (!selectedId) return
    setDeleteBusy(true)
    try {
      await api.delete(`/purchase-order-entries/${selectedId}/`)
      toast.success('Purchase Order eliminato.')
      setDeleteDlgOpen(false)
      closeDrawer()
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }, [selectedId, toast, closeDrawer, reloadList])

  const doBulkRestore = async (): Promise<boolean> => {
    const ids = selectedIds.filter((n) => Number.isFinite(n))
    if (!ids.length) return false
    setRestoreBusy(true)
    try {
      await api.post(`/purchase-order-entries/bulk_restore/`, { ids })
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
  }

  const doRestore = React.useCallback(async () => {
    if (!selectedId) return
    setRestoreBusy(true)
    try {
      await api.post(`/purchase-order-entries/${selectedId}/restore/`)
      toast.success('Purchase Order ripristinato.')
      await loadDetail(selectedId)
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [selectedId, toast, loadDetail, reloadList])

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
        toast.success('Stato aggiornato ✅')
        setTransitionState(null)
        reloadList()
        if (selectedId === id) await loadDetail(id)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setTransitionBusy(false)
      }
    },
    [transitionState, selectedId, toast, reloadList, loadDetail],
  )

  // ── Workflow: upload documento (drawer, indipendente dalla transizione) ────

  const uploadDocument = React.useCallback(
    async (slot: DocumentSlot, file: File) => {
      if (!selectedId) return
      const fieldName = slot === 'offer' ? 'offer_document' : slot === 'po' ? 'po_document' : 'invoice_document'
      setUploadingSlot(slot)
      try {
        const fd = new FormData()
        fd.append(fieldName, file)
        await api.patch(`/purchase-order-entries/${selectedId}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('Documento caricato ✅')
        await loadDetail(selectedId)
        reloadList()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setUploadingSlot(null)
      }
    },
    [selectedId, toast, loadDetail, reloadList],
  )

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
    if (!String(form.description).trim()) clientErrors.description = 'La descrizione è obbligatoria.'
    if (!String(form.client_name).trim()) clientErrors.client_name = 'Il committente è obbligatorio.'
    if (form.amount_mode === 'giornate') {
      if (form.days === '' || Number.isNaN(Number(form.days))) clientErrors.days = 'Indica le giornate.'
      if (form.daily_rate === '' || Number.isNaN(Number(form.daily_rate))) clientErrors.daily_rate = 'Indica la tariffa/giorno.'
    } else {
      if (form.amount === '' || Number.isNaN(Number(form.amount))) clientErrors.amount = "Indica l'importo."
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
        toast.success('Purchase Order creato ✅')
      } else {
        if (!dlgId) return
        const res = await api.patch<PurchaseOrderDetail>(`/purchase-order-entries/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Purchase Order aggiornato ✅')
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
    <Stack spacing={2} sx={{ height: '100%' }}>
      <PurchaseOrderKpis
        year={effectiveYear}
        summary={summary}
        loading={summaryLoading}
      />

      <EntityListCard
        mobileCard={renderPurchaseOrderCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          rightActions: (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                bgcolor: 'rgba(241,245,249,0.9)',
                border: '0.5px solid',
                borderColor: 'divider',
                borderRadius: 999,
                px: 0.5,
                height: 32,
              }}
            >
              <IconButton
                size="small"
                aria-label="Anno precedente"
                onClick={() => setYear(effectiveYear - 1, { patch: { page: 1 }, keepOpen: false })}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 52, textAlign: 'center' }}>
                {effectiveYear}
              </Typography>
              <IconButton
                size="small"
                aria-label="Anno successivo"
                onClick={() => setYear(effectiveYear + 1, { patch: { page: 1 }, keepOpen: false })}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          ),
        }}
        grid={{
          pageKey: 'purchase-orders',
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
      </EntityListCard>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      <PurchaseOrderDrawer
        open={drawerOpen}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
        canChange={canChange}
        canDelete={canDelete}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        uploadingSlot={uploadingSlot}
        onClose={closeDrawer}
        onEdit={openEdit}
        onDelete={() => setDeleteDlgOpen(true)}
        onRestore={doRestore}
        onCopied={() => toast.success('Copiato ✅')}
        onUploadDocument={uploadDocument}
      />

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
