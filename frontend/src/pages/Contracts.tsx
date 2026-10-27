import * as React from 'react'
import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'

import type { GridColDef } from '@mui/x-data-grid'
import { useLocation, useNavigate } from 'react-router-dom'

import { api } from '@shared/api/client'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import EntityListCard from '@shared/ui/EntityListCard'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'

import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { PERMS } from '../auth/perms'
import { useDataGridZebraSx } from '../theme/AppThemeProvider'
import ContractDialog from '../features/contracts/ContractDialog'
import ContractDrawer from '../features/contracts/ContractDrawer'
import ContractRenewDialog from '../features/contracts/ContractRenewDialog'
import SellersDialog from '../features/contracts/SellersDialog'
import {
  CONTRACT_STATUS_OPTIONS,
  EXPIRY_CHIP,
  type CompanyOption,
  type ContractDetail,
  type ContractListItem,
  type ContractStatus,
  type CustomerOption,
  type Seller,
} from '../features/contracts/types'
import { formatEuro, formatItDate } from '../features/purchaseorders/types'

type OpenCreateState = { openCreate?: boolean }

const STATUS_CHIP_COLOR: Record<ContractStatus, 'default' | 'success' | 'error'> = {
  bozza: 'default',
  attivo: 'success',
  disdetto: 'error',
}

// Filtro stato in toolbar ('' = tutti).
const STATUS_FILTER_OPTIONS: { value: '' | ContractStatus; label: string }[] = [
  { value: '', label: 'Tutti' },
  ...CONTRACT_STATUS_OPTIONS,
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => CURRENT_YEAR + 5 - i)

function buildColumns(canViewValue: boolean): GridColDef<ContractListItem>[] {
  return [
    { field: 'code', headerName: 'Codice', width: 130 },
    { field: 'title', headerName: 'Titolo', flex: 1.2, minWidth: 200 },
    { field: 'customer_name', headerName: 'Cliente', flex: 1, minWidth: 170 },
    {
      field: 'company_label',
      headerName: 'Società',
      width: 140,
      valueGetter: (v, row) => {
        void v
        return row.company_label || '—'
      },
    },
    {
      field: 'seller_name',
      headerName: 'Venditore',
      width: 150,
      valueGetter: (v, row) => {
        void v
        return row.seller_name || '—'
      },
    },
    {
      field: 'contract_type',
      headerName: 'Tipo',
      width: 120,
      sortable: false,
      valueGetter: (v, row) => {
        void v
        return row.contract_type_label
      },
    },
    {
      field: 'start_date',
      headerName: 'Inizio',
      width: 110,
      valueGetter: (v, row) => {
        void v
        return formatItDate(row.start_date)
      },
    },
    {
      field: 'end_date',
      headerName: 'Fine',
      width: 110,
      valueGetter: (v, row) => {
        void v
        return formatItDate(row.end_date)
      },
    },
    {
      field: 'expiry_state',
      headerName: 'Scadenza',
      width: 125,
      sortable: false,
      renderCell: (p) => {
        const row = p.row
        if (row.expiry_state === 'none') return '—'
        const c = EXPIRY_CHIP[row.expiry_state] ?? EXPIRY_CHIP.none
        return <Chip size="small" color={c.color} label={c.label} />
      },
    },
    ...(canViewValue
      ? [
          {
            field: 'total_value',
            headerName: 'Valore',
            width: 130,
            align: 'right',
            headerAlign: 'right',
            valueGetter: (v: unknown, row: ContractListItem) => {
              void v
              return row.total_value !== undefined ? formatEuro(row.total_value) : '—'
            },
          } satisfies GridColDef<ContractListItem>,
        ]
      : []),
    {
      field: 'status',
      headerName: 'Stato',
      width: 110,
      sortable: false,
      renderCell: (p) => {
        const row = p.row
        return (
          <Chip
            size="small"
            variant={row.status === 'bozza' ? 'outlined' : 'filled'}
            color={STATUS_CHIP_COLOR[row.status] ?? 'default'}
            label={row.status_label}
          />
        )
      },
    },
  ]
}

export default function Contracts() {
  const zebraSx = useDataGridZebraSx()
  const { me, hasPerm } = useAuth()
  const canChange = hasPerm(PERMS.contracts.contract.change)
  const canDelete = hasPerm(PERMS.contracts.contract.delete)
  const canViewValue = hasPerm(PERMS.contracts.contract.viewValue)
  const canViewSellers = hasPerm('contracts.view_seller')
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const grid = useServerGrid({
    defaultOrdering: 'end_date',
    allowedOrderingFields: [
      'code',
      'title',
      'customer_name',
      'seller_name',
      'company_label',
      'start_date',
      'end_date',
      'updated_at',
      ...(canViewValue ? ['total_value'] : []),
    ],
    defaultPageSize: 25,
  })

  // Filtri (URL): `customer` arriva anche dal tab Contratti del drawer Cliente.
  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [year, setYear] = useUrlNumberParam('year')
  const [statusFilter, setStatusFilter] = useUrlStringParam('status')

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        orderingMap: {
          customer_name: 'customer__display_name',
          seller_name: 'seller__name',
          company_label: 'company__label',
        },
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
        extra: {
          ...(customerId !== '' ? { customer: customerId } : {}),
          ...(year !== '' ? { year } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
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
      year,
      statusFilter,
    ],
  )

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<ContractListItem>(
    '/contracts/',
    listParams,
    (e: unknown) => toast.error(apiErrorToMessage(e)),
  )

  // ── Lookups ────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = React.useState<CustomerOption[]>([])
  const [sellers, setSellers] = React.useState<Seller[]>([])
  const [companies, setCompanies] = React.useState<CompanyOption[]>([])

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CustomerOption>>('/customers/', {
        params: { ordering: 'name', page_size: 500 },
      })
      setCustomers(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  const loadSellers = React.useCallback(async () => {
    if (!canViewSellers) return
    try {
      const res = await api.get<ApiPage<Seller>>('/sellers/', { params: { ordering: 'name', page_size: 500 } })
      setSellers(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast, canViewSellers])

  const loadCompanies = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<CompanyOption> | CompanyOption[]>('/customer-statuses/')
      const data = res.data
      setCompanies(Array.isArray(data) ? data : (data.results ?? []))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [toast])

  React.useEffect(() => {
    void loadCustomers()
    void loadSellers()
    void loadCompanies()
  }, [loadCustomers, loadSellers, loadCompanies])

  // ── Drawer ─────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<ContractDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const loadDetail = React.useCallback(
    async (id: number, forceIncludeDeleted?: boolean) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const incParams = includeDeletedParams(forceIncludeDeleted ?? grid.includeDeleted)
        const res = await api.get<ContractDetail>(`/contracts/${id}/`, incParams ? { params: incParams } : undefined)
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
      void loadDetail(id)
      grid.setOpenId(id)
    },
    [grid, loadDetail],
  )

  // Apertura dal link `?open=<id>` (es. tab Contratti del drawer Cliente).
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

  // ── Dialog crea/modifica ───────────────────────────────────────────────────
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgContract, setDlgContract] = React.useState<ContractDetail | null>(null)

  const openCreate = React.useCallback(() => {
    setDlgContract(null)
    setDlgOpen(true)
  }, [])

  const openEdit = React.useCallback(() => {
    if (!detail) return
    setDlgContract(detail)
    setDlgOpen(true)
  }, [detail])

  const openCreateOnceRef = React.useRef(false)
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

  const onSaved = React.useCallback(
    (c: ContractDetail) => {
      setDlgOpen(false)
      reloadList()
      openDrawer(c.id)
    },
    [reloadList, openDrawer],
  )

  // ── Rinnovo manuale ────────────────────────────────────────────────────────
  const [renewOpen, setRenewOpen] = React.useState(false)

  const onRenewed = React.useCallback(
    (c: ContractDetail) => {
      setRenewOpen(false)
      setDetail(c)
      reloadList()
    },
    [reloadList],
  )

  // ── Elimina / ripristina ───────────────────────────────────────────────────
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  const doDelete = React.useCallback(async () => {
    if (!selectedId) return
    setDeleteBusy(true)
    try {
      await api.delete(`/contracts/${selectedId}/`)
      toast.success('Contratto eliminato.')
      setDeleteDlgOpen(false)
      closeDrawer()
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }, [selectedId, toast, closeDrawer, reloadList])

  const doRestore = React.useCallback(async () => {
    if (!selectedId) return
    setRestoreBusy(true)
    try {
      await api.post(`/contracts/${selectedId}/restore/`)
      toast.success('Contratto ripristinato.')
      await loadDetail(selectedId, true)
      reloadList()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }, [selectedId, toast, loadDetail, reloadList])

  // ── Documento PDF ──────────────────────────────────────────────────────────
  const [documentBusy, setDocumentBusy] = React.useState(false)

  const uploadDocument = React.useCallback(
    async (file: File) => {
      if (!selectedId) return
      setDocumentBusy(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await api.post<ContractDetail>(`/contracts/${selectedId}/document/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setDetail(res.data)
        toast.success('Documento caricato')
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setDocumentBusy(false)
      }
    },
    [selectedId, toast],
  )

  // La rimozione del PDF è definitiva (niente cestino): sempre con conferma.
  const [deleteDocDlgOpen, setDeleteDocDlgOpen] = React.useState(false)

  const deleteDocument = React.useCallback(async () => {
    if (!selectedId) return
    setDocumentBusy(true)
    try {
      await api.delete(`/contracts/${selectedId}/document/`)
      toast.success('Documento rimosso')
      setDeleteDocDlgOpen(false)
      await loadDetail(selectedId)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDocumentBusy(false)
    }
  }, [selectedId, toast, loadDetail])

  // ── Venditori ──────────────────────────────────────────────────────────────
  const [sellersOpen, setSellersOpen] = React.useState(false)

  // ── Griglia ────────────────────────────────────────────────────────────────
  const columns = React.useMemo(() => buildColumns(canViewValue), [canViewValue])

  // Cliente filtrato (es. arrivando dal tab Contratti del drawer Cliente).
  const filteredCustomer = React.useMemo(
    () => (customerId === '' ? null : customers.find((c) => c.id === customerId) ?? null),
    [customerId, customers],
  )

  const emptyState = React.useMemo(() => {
    if (grid.view === 'deleted' && !grid.search.trim()) {
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono contratti eliminati.' }
    }
    if (!grid.search.trim()) {
      return {
        title: 'Nessun contratto',
        subtitle: 'Crea un nuovo contratto o cambia i filtri.',
        action: (
          <Can perm={PERMS.contracts.contract.add}>
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
              Nuovo contratto
            </Button>
          </Can>
        ),
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
  }, [grid.view, grid.search, openCreate])

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          alignRightActions: true,
          children: (
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              {customerId !== '' ? (
                <Chip
                  size="small"
                  label={`Cliente: ${filteredCustomer ? filteredCustomer.display_name || filteredCustomer.name : `#${customerId}`}`}
                  onDelete={() => setCustomerId('', { patch: { page: 1 }, keepOpen: true })}
                />
              ) : null}
              <ToggleButtonGroup
                size="small"
                exclusive
                value={statusFilter}
                onChange={(_e, v: string | null) => {
                  if (v === null) return
                  setStatusFilter(v, { patch: { page: 1 }, keepOpen: true })
                }}
                aria-label="Filtro stato contratto"
                sx={{
                  height: 32,
                  '& .MuiToggleButton-root': { px: 1.25, fontSize: '0.78rem', fontWeight: 600 },
                }}
              >
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <ToggleButton key={o.value || 'all'} value={o.value} aria-label={o.label}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="contracts-year-label">Anno</InputLabel>
                <Select
                  labelId="contracts-year-label"
                  label="Anno"
                  value={year === '' ? '' : String(year)}
                  onChange={(e) =>
                    setYear(e.target.value === '' ? '' : Number(e.target.value), {
                      patch: { page: 1 },
                      keepOpen: true,
                    })
                  }
                  sx={{ height: 32 }}
                >
                  <MenuItem value="">Tutti gli anni</MenuItem>
                  {YEAR_OPTIONS.map((y) => (
                    <MenuItem key={y} value={String(y)}>
                      {y}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          ),
          rightActions: (
            <Stack direction="row" alignItems="center" gap={1}>
              {canViewSellers ? (
                <Button
                  variant="outlined"
                  startIcon={<BadgeOutlinedIcon />}
                  onClick={() => setSellersOpen(true)}
                >
                  Venditori
                </Button>
              ) : null}
              <Can perm={PERMS.contracts.contract.add}>
                <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
                  Nuovo contratto
                </Button>
              </Can>
            </Stack>
          ),
        }}
        grid={{
          pageKey: 'contracts',
          username: me?.username,
          emptyState,
          rows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          sx: {
            '--DataGrid-rowHeight': '24px',
            '--DataGrid-headerHeight': '35px',
            '& .MuiDataGrid-cell': { py: 0.25 },
            '& .MuiDataGrid-columnHeader': { py: 0.75 },
            ...zebraSx,
          },
        }}
      />

      <ContractDrawer
        open={drawerOpen}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
        canChange={canChange}
        canDelete={canDelete}
        canViewValue={canViewValue}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        documentBusy={documentBusy}
        onClose={closeDrawer}
        onEdit={openEdit}
        onDelete={() => setDeleteDlgOpen(true)}
        onRestore={doRestore}
        onRenew={() => setRenewOpen(true)}
        onCopy={async (v: string) => {
          await copyToClipboard(v)
          toast.success('Copiato')
        }}
        onUploadDocument={(f) => void uploadDocument(f)}
        onDeleteDocument={() => setDeleteDocDlgOpen(true)}
      />

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

      <ContractRenewDialog
        open={renewOpen}
        contract={detail}
        onClose={() => setRenewOpen(false)}
        onRenewed={onRenewed}
      />

      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Confermi eliminazione contratto?"
        description="Il contratto verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      <ConfirmDeleteDialog
        open={deleteDocDlgOpen}
        busy={documentBusy}
        title="Rimuovere il documento?"
        description={`Il PDF${detail?.document_filename ? ` "${detail.document_filename}"` : ''} verrà eliminato definitivamente e non potrà essere ripristinato.`}
        confirmText="Rimuovi"
        onClose={() => setDeleteDocDlgOpen(false)}
        onConfirm={() => void deleteDocument()}
      />

      {canViewSellers ? (
        <SellersDialog
          open={sellersOpen}
          onClose={() => {
            setSellersOpen(false)
            void loadSellers()
          }}
        />
      ) : null}
    </Stack>
  )
}
