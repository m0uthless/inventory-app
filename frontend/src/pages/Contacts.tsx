import * as React from 'react'

import {
  Box,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Drawer,
  FormControl,
  LinearProgress,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { useLocation, useNavigate } from 'react-router-dom'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam } from '@shared/hooks/useUrlParam'

import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import type { ApiPage } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'

import { api } from '@shared/api/client'
import ContactDialog from '../features/contacts/ContactDialog'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { Can } from '../auth/Can'
import { buildQuery } from '@shared/utils/nav'
import { emptySelectionModel, selectionSize, selectionToNumberIds } from '@shared/utils/gridSelection'
import { useToast } from '@shared/ui/toast'
import { ActionIconButton } from '@shared/ui/ActionIconButton'

import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import ConfirmActionDialog from '@shared/ui/ConfirmActionDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'

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

const cols: GridColDef<ContactRow>[] = [
  { field: 'name', headerName: 'Nome', flex: 1, minWidth: 220 },
  { field: 'email', headerName: 'Email', width: 240 },
  { field: 'phone', headerName: 'Telefono', width: 160 },
  {
    field: 'customer_display_name',
    headerName: 'Cliente',
    width: 220,
    valueGetter: (v, row) => {
      void v
      return row.customer_display_name || row.customer_name || row.customer_code || '—'
    },
  },
  {
    field: 'site_display_name',
    headerName: 'Sito',
    width: 220,
    valueGetter: (v, row) => {
      void v
      return row.site_display_name || row.site_name || '—'
    },
  },
  {
    field: 'is_primary',
    headerName: 'Primario',
    width: 120,
    renderCell: (p) =>
      p.value ? (
        <Chip size="small" label="Sì" />
      ) : (
        <Chip size="small" variant="outlined" label="No" />
      ),
  },
]


// ─── Mobile card renderer ────────────────────────────────────────────────────

const renderContactCard: MobileCardRenderFn<ContactRow> = ({ row, onOpen }) => {
  const meta: { label: string; value: string | null | undefined }[] = [
    { label: 'Cliente',  value: row.customer_display_name || row.customer_name },
    { label: 'Sito',     value: row.site_display_name || row.site_name },
    { label: 'Email',    value: row.email },
    { label: 'Telefono', value: row.phone },
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
          <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </Typography>
          {row.department && (
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.department}
            </Typography>
          )}
        </Box>
        {row.is_primary && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20, bgcolor: 'rgba(16,185,129,0.10)', color: '#065f46', border: '0.5px solid rgba(16,185,129,0.28)', whiteSpace: 'nowrap' }}>
            Primario
          </Box>
        )}
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
export default function Contacts() {
  const { me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const grid = useServerGrid({
    defaultOrdering: 'name',
    allowedOrderingFields: [
      'name',
      'email',
      'phone',
      'customer_display_name',
      'site_display_name',
      'is_primary',
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
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono contatti eliminati.' }
    }
    if (!grid.search.trim()) {
      return {
        title: 'Nessun contatto',
        subtitle: 'Crea un nuovo contatto o cambia i filtri.',
        action: (
          <Can perm={PERMS.crm.contact.add}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => navigate(loc.pathname + loc.search, { state: { openCreate: true } })}
            >
              Crea contatto
            </Button>
          </Can>
        ),
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
  }, [grid.view, grid.search, loc.pathname, loc.search, navigate])

  // filters (URL)
  const [customerId, setCustomerId] = useUrlNumberParam('customer')
  const [siteId, setSiteId] = useUrlNumberParam('site')

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
    ],
  )

  const {
    rows,
    rowCount,
    loading,
    reload: reloadList,
  } = useDrfList<ContactRow>('/contacts/', listParams, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  // lookups
  const [customers, setCustomers] = React.useState<CustomerItem[]>([])
  const [sites, setSites] = React.useState<SiteItem[]>([]) // sites for selected customer (filter + dialog)

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<ContactDetail | null>(null)
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
  const [form, setForm] = React.useState<ContactForm>({
    customer: '',
    site: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    is_primary: false,
    notes: '',
  })

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

  const loadSitesForCustomer = React.useCallback(
    async (cust: number | '') => {
      try {
        if (cust === '') {
          setSites([])
          return
        }
        const res = await api.get<ApiPage<SiteItem>>('/sites/', {
          params: { customer: cust, ordering: 'name', page_size: 500 },
        })
        setSites(res.data.results ?? [])
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
        const res = await api.get<ContactDetail>(
          `/contacts/${id}/`,
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
    row: ContactRow
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
        await api.post(`/contacts/${id}/restore/`)
        toast.success('Contatto ripristinato ✅')
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
    (row: ContactRow, event: React.MouseEvent<HTMLElement>) => {
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

  const columns = React.useMemo<GridColDef<ContactRow>[]>(() => {
    return cols
  }, [])

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
            {customers.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>)}
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
            {sites.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.display_name || s.name}</MenuItem>)}
          </Select>
        </FormControl>
      ),
    },
  }), [customerId, siteId, setCustomerId, setSiteId, customers, sites])

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
      await api.delete(`/contacts/${selectedId}/`)
      toast.success('Contatto eliminato.')
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
      await api.post(`/contacts/bulk_restore/`, { ids })
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
      await api.post(`/contacts/${selectedId}/restore/`)
      toast.success('Contatto ripristinato.')
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
  }, [loadCustomers])

  // initial sites load (based on customer from URL) - run once on mount
  const didInitSitesRef = React.useRef(false)
  React.useEffect(() => {
    if (didInitSitesRef.current) return
    didInitSitesRef.current = true
    loadSitesForCustomer(customerId)
  }, [customerId, loadSitesForCustomer])

  // when customerId changes after init, reload sites and reset site filter
  const prevCustomerRef = React.useRef<number | ''>(customerId)
  React.useEffect(() => {
    loadSitesForCustomer(customerId)
    if (prevCustomerRef.current !== customerId) {
      setSiteId('', { patch: { page: 1 }, keepOpen: true })
      prevCustomerRef.current = customerId
    }
  }, [customerId, loadSitesForCustomer, setSiteId])

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

  const openCreate = React.useCallback(async () => {
    const preCustomer = customerId !== '' ? customerId : ''
    setDlgMode('create')
    setDlgId(null)
    setDlgErrors({})
    setForm({
      customer: preCustomer,
      site: '',
      name: '',
      email: '',
      phone: '',
      department: '',
      is_primary: false,
      notes: '',
    })
    setDlgOpen(true)
    await loadSitesForCustomer(preCustomer)
  }, [customerId, loadSitesForCustomer])

  React.useEffect(() => {
    const st = (loc.state as OpenCreateState | null | undefined) ?? null
    if (!st?.openCreate) {
      openCreateOnceRef.current = false
      return
    }
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
    setForm({
      customer: cust,
      site: detail.site ?? '',
      name: detail.name ?? '',
      email: detail.email ?? '',
      phone: detail.phone ?? '',
      department: detail.department ?? '',
      is_primary: Boolean(detail.is_primary),
      notes: detail.notes ?? '',
    })

    setDlgOpen(true)
    await loadSitesForCustomer(cust)
  }, [detail, loadSitesForCustomer])

  openEditRef.current = openEdit

  const save = async () => {
    const clientErrors: Record<string, string> = {}
    if (form.customer === '') clientErrors.customer = 'Seleziona un cliente.'
    if (!String(form.name).trim()) clientErrors.name = 'Il nome è obbligatorio.'
    if (Object.keys(clientErrors).length) {
      setDlgErrors(clientErrors)
      return
    }
    setDlgErrors({})

    const payload: Record<string, unknown> = {
      customer: Number(form.customer),
      site: form.site === '' ? null : Number(form.site),
      name: form.name.trim(),
      email: (form.email || '').trim() || null,
      phone: (form.phone || '').trim() || null,
      department: (form.department || '').trim() || null,
      is_primary: Boolean(form.is_primary),
      notes: (form.notes || '').trim() || null,
    }

    setDlgSaving(true)
    try {
      let id: number
      if (dlgMode === 'create') {
        const res = await api.post<ContactDetail>('/contacts/', payload)
        id = res.data.id
        toast.success('Contatto creato ✅')
      } else {
        if (!dlgId) return
        const res = await api.patch<ContactDetail>(`/contacts/${dlgId}/`, payload)
        id = res.data.id
        toast.success('Contatto aggiornato ✅')
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

  const customerLabel = (d: ContactDetail | null) =>
    d?.customer_display_name || d?.customer_name || d?.customer_code || ''
  const siteLabel = (d: ContactDetail | null) => d?.site_display_name || d?.site_name || ''

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>

      <EntityListCard
        mobileCard={renderContactCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
        }}
        grid={{
          pageKey: 'contacts',
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

            {/* badge + actions */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}
            >
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
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Chip
                size="small"
                label={detail?.is_primary ? '● Primario' : '● Non primario'}
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
                <Can perm={PERMS.crm.contact.change}>
                  {detail?.deleted_at ? (
                    <ActionIconButton
                      label="Ripristina"
                      icon={<RestoreFromTrashIcon fontSize="small" />}
                      size="small"
                      onClick={doRestore}
                      disabled={!detail || restoreBusy}
                      sx={{
                        color: 'rgba(255,255,255,0.85)',
                        bgcolor: 'rgba(255,255,255,0.12)',
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                      }}
                    />
                  ) : (
                    <ActionIconButton
                      label="Modifica"
                      icon={<EditIcon fontSize="small" />}
                      size="small"
                      onClick={openEdit}
                      disabled={!detail}
                      sx={{
                        color: 'rgba(255,255,255,0.85)',
                        bgcolor: 'rgba(255,255,255,0.12)',
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                      }}
                    />
                  )}
                </Can>
                <Can perm={PERMS.crm.contact.delete}>
                  {!detail?.deleted_at && (
                    <ActionIconButton
                      label="Elimina"
                      icon={<DeleteOutlineIcon fontSize="small" />}
                      size="small"
                      onClick={() => setDeleteDlgOpen(true)}
                      disabled={!detail || deleteBusy}
                      sx={{
                        color: 'rgba(255,255,255,0.85)',
                        bgcolor: 'rgba(255,255,255,0.12)',
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
                      }}
                    />
                  )}
                </Can>
                <ActionIconButton
                  label="Chiudi"
                  icon={<CloseIcon fontSize="small" />}
                  size="small"
                  onClick={closeDrawer}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                  }}
                />
              </Stack>
            </Stack>

            {/* name + customer/site */}
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
                {detail?.name || (selectedId ? `Contatto #${selectedId}` : 'Contatto')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                {[customerLabel(detail), siteLabel(detail)].filter(Boolean).join(' · ') || ' '}
              </Typography>
              {detail?.department && (
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mt: 0.25 }}
                >
                  {detail.department}
                </Typography>
              )}
            </Box>
          </Box>

          {detailLoading && <LinearProgress sx={{ height: 2 }} />}

          {/* ── SCROLLABLE BODY ── */}
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
                {/* Quick nav */}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {detail.customer && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/customers${buildQuery({ open: detail.customer })}`)}
                    >
                      Apri cliente
                    </Button>
                  )}
                  {detail.site && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        navigate(
                          `/sites${buildQuery({ open: detail.site, customer: detail.customer ?? '' })}`,
                        )
                      }
                    >
                      Apri sito
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      navigate(
                        `/inventory${buildQuery({
                          customer: detail.customer ?? '',
                          site: detail.site ?? '',
                        })}`,
                      )
                    }
                  >
                    Apri inventario
                  </Button>
                </Stack>

                {/* Dati contatto */}
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
                      display: 'block',
                      mb: 1,
                    }}
                  >
                    Dati contatto
                  </Typography>
                  <Stack spacing={0.75}>
                    {(
                      [
                        { label: 'Nome', value: detail.name, mono: false },
                        { label: 'Email', value: detail.email, mono: true },
                        { label: 'Telefono', value: detail.phone, mono: true },
                        { label: 'Reparto', value: detail.department, mono: false },
                        { label: 'Cliente', value: customerLabel(detail), mono: false },
                        { label: 'Sito', value: siteLabel(detail), mono: false },
                      ] as { label: string; value?: string | null; mono: boolean }[]
                    )
                      .filter((r) => r.value)
                      .map((r) => (
                        <Stack
                          key={r.label}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.disabled', minWidth: 70 }}
                          >
                            {r.label}
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, fontFamily: r.mono ? 'monospace' : undefined }}
                            >
                              {r.value}
                            </Typography>
                            {r.mono && r.value && (
                              <ActionIconButton
                                label="Copia"
                                icon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                                size="small"
                                onClick={async () => {
                                  await copyToClipboard(r.value!)
                                  toast.success('Copiato ✅')
                                }}
                              />
                            )}
                          </Stack>
                        </Stack>
                      ))}
                  </Stack>
                </Box>

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
                        display: 'block',
                        mb: 0.75,
                      }}
                    >
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
        title="Ripristinare i contatti selezionati?"
        description={`Verranno ripristinati ${selectedCount} contatti dal cestino.`}
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
