import * as React from 'react'
import { alpha } from '@mui/material/styles'

import {
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'

import type { GridColDef, GridSortModel } from '@mui/x-data-grid'

import { useAuth } from '../auth/AuthProvider'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { buildDrfListParams, type DrfParams } from '@shared/api/drf'
import {
  createEmptyIssueForm as createEmptyForm,
  fmtIssueDate as fmtDate,
  PRIORITY_META,
  STATUS_META,
  type CategoryOption,
  type CustomerOption,
  type InventoryOption,
  type IssueComment,
  type IssueFormData,
  type IssueRow,
  type UserOption,
} from '../features/issues/types'
import IssueDialog from '../features/issues/IssueDialog'
import IssueDetail, { type IssuePatch } from '../features/issues/IssueDetail'
import IssuesKpis, { useIssueCounts, overdueBefore } from '../features/issues/IssuesKpis'
import { useExportCsv } from '@shared/ui/useExportCsv'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import SearchIcon from '@mui/icons-material/Search'
import { IssuePriorityMark, IssueStatusBadge } from '../features/issues/IssueBadges'
import { PageHead, ViewTabs, FilterOptionList, FilterTokens, headerFilterGridSx, useUndoToast, type ActiveFilter } from '../ui/campo'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { isRecord } from '@shared/utils/guards'

type CreateFromInventoryState = {
  inventoryId: number
  inventoryName: string
  inventoryKnumber: string | null
  inventorySerialNumber: string | null
  inventoryHostname: string | null
  customerId: number
  customerName: string
  siteId: number | null
}

type CreateFromServiceNowCaseState = {
  number: string
  account: string
  shortDescription: string
}

type OpenCreateState = {
  openCreate?: boolean
  createFromInventory?: CreateFromInventoryState
  createFromServiceNowCase?: CreateFromServiceNowCaseState
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIdLabel(v: unknown, labelKeys: string[]): { id: number; label: string } | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  for (const k of labelKeys) {
    const val = v[k]
    if (typeof val === 'string' && val.trim()) return { id, label: val }
  }
  return { id, label: String(id) }
}

function toUserOption(v: unknown): UserOption | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  const username = typeof v['username'] === 'string' ? v['username'] : ''
  const fullName = typeof v['full_name'] === 'string' ? v['full_name'] : ''
  const label = (fullName || username || String(id)).trim()
  const is_philips = v['is_philips'] === true
  const is_servicenow_technician = v['is_servicenow_technician'] !== false
  return { id, label, username, is_philips, is_servicenow_technician }
}

function toInventoryOption(v: unknown): InventoryOption | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  const name =
    typeof v['name'] === 'string' && v['name'].trim() ? v['name'].trim() : `Inventory #${id}`
  const knumber = typeof v['knumber'] === 'string' ? v['knumber'] : null
  const serialNumber = typeof v['serial_number'] === 'string' ? v['serial_number'] : null
  const hostname = typeof v['hostname'] === 'string' ? v['hostname'] : null
  const typeLabel = typeof v['type_label'] === 'string' ? v['type_label'] : null
  const statusLabel = typeof v['status_label'] === 'string' ? v['status_label'] : null
  const siteName = typeof v['site_name'] === 'string' ? v['site_name'] : null
  return {
    id,
    name,
    knumber,
    serial_number: serialNumber,
    hostname,
    type_label: typeLabel,
    status_label: statusLabel,
    site_name: siteName,
  }
}

type InventoryLabelSource =
  | Pick<
      IssueRow,
      'inventory_name' | 'inventory_knumber' | 'inventory_serial_number' | 'inventory_hostname'
    >
  | InventoryOption
  | null

function isIssueInventoryLabelSource(
  item: Exclude<InventoryLabelSource, null>,
): item is Pick<
  IssueRow,
  'inventory_name' | 'inventory_knumber' | 'inventory_serial_number' | 'inventory_hostname'
> {
  return 'inventory_name' in item
}

function UnlinkedInventoryWarningIcon() {
  return (
    <Tooltip title="Questa issue non è ancora collegata a un inventory.">
      <WarningAmberRoundedIcon sx={{ color: 'warning.main', fontSize: 18, flexShrink: 0 }} />
    </Tooltip>
  )
}

function inventoryLabel(item: InventoryLabelSource) {
  if (!item) return '—'

  const normalized = isIssueInventoryLabelSource(item)
    ? {
        name: item.inventory_name,
        knumber: item.inventory_knumber,
        hostname: item.inventory_hostname,
        serial_number: item.inventory_serial_number,
      }
    : {
        name: item.name,
        knumber: item.knumber ?? null,
        hostname: item.hostname ?? null,
        serial_number: item.serial_number ?? null,
      }

  const parts = [
    normalized.name,
    normalized.knumber,
    normalized.hostname,
    normalized.serial_number,
  ].filter((value): value is string => Boolean(value && value.trim()))
  return parts.length > 0 ? parts.join(' · ') : '—'
}

// Raggruppamento "Aperte"/"Chiuse" già usato in /issues/summary/ e nel grafico
// andamento: risolta + chiusa contano entrambe come "chiuse" agli occhi
// dell'utente (solo "chiusa" è lo stato terminale/immutabile).
function isClosedIssueRow(row: Pick<IssueRow, 'status'>) {
  return row.status === 'resolved' || row.status === 'closed'
}

export default function Issues() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { me } = useAuth()
  const toast = useToast()

  // ── Grid ──────────────────────────────────────────────────────────────────
  const grid = useServerGrid({
    defaultOrdering: '-created_at',
    allowedOrderingFields: [
      'created_at',
      'updated_at',
      'due_date',
      'closed_at',
      'priority',
      'status',
      'title',
      'servicenow_id',
      'opened_at',
      'customer__name',
      'category__label',
      'assigned_to__last_name',
      'comments_count',
    ],
    columnOrderingMap: {
      customer_name: 'customer__name',
      category_label: 'category__label',
      assigned_to_full_name: 'assigned_to__last_name',
    },
  })

  // "Giorni passati" è calcolato lato backend a partire da opened_at
  // (SerializerMethodField, non ordinabile direttamente sul queryset).
  // Mappiamo l'ordinamento della colonna su opened_at con direzione
  // invertita (opened_at più vecchio ⇒ giorni passati maggiore) mantenendo
  // localmente solo l'informazione per mostrare la freccetta sulla colonna
  // giusta in intestazione.
  const [daysOpenSortDir, setDaysOpenSortDir] = React.useState<'asc' | 'desc' | null>(null)

  React.useEffect(() => {
    if (grid.sortModel[0]?.field !== 'opened_at') setDaysOpenSortDir(null)
  }, [grid.sortModel])

  const handleSortModelChange = React.useCallback(
    (model: GridSortModel) => {
      const m = model[0]
      if (m?.field === 'days_open') {
        setDaysOpenSortDir(m.sort ?? null)
        grid.onSortModelChange(
          m.sort ? [{ field: 'opened_at', sort: m.sort === 'asc' ? 'desc' : 'asc' }] : [],
        )
        return
      }
      setDaysOpenSortDir(null)
      grid.onSortModelChange(model)
    },
    [grid],
  )

  const displaySortModel: GridSortModel = daysOpenSortDir
    ? [{ field: 'days_open', sort: daysOpenSortDir }]
    : grid.sortModel

  // ── Viste e filtri (dalle intestazioni di colonna) ──────────────────────
  type IssueView = 'active' | 'mine' | 'overdue' | 'closed' | 'all'
  const [view, setView] = React.useState<IssueView>('active')
  const [fStatus, setFStatus] = React.useState<string[]>([])
  const [fPriority, setFPriority] = React.useState<string[]>([])
  const [fCategory, setFCategory] = React.useState<string[]>([])
  const [fAssigned, setFAssigned] = React.useState<string[]>([])
  const activeFilterCount = [fStatus, fPriority, fCategory, fAssigned].filter((f) => f.length).length + (view !== 'active' ? 1 : 0)

  const resetFilters = () => {
    setView('active'); setFStatus([]); setFPriority([]); setFCategory([]); setFAssigned([])
  }

  const allExtraParams = React.useMemo(() => {
    const p: DrfParams = {}
    if (grid.view === 'deleted') p.deleted = 'true'
    if (view === 'active' || view === 'mine' || view === 'overdue') p.hide_closed = true
    if (view === 'overdue') p.due_before = overdueBefore()
    if (view === 'closed') p.only_closed = true
    if (view === 'mine' && me?.id) p.assigned_to = me.id
    else if (fAssigned.length) p.assigned_to = fAssigned[0]
    if (fStatus.length) p.status = fStatus
    if (fPriority.length) p.priority = fPriority
    if (fCategory.length) p.category = fCategory[0]
    return p
  }, [grid.view, view, me?.id, fStatus, fPriority, fCategory, fAssigned])
  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        ordering: grid.ordering,
        search: grid.search,
        extra: allExtraParams,
      }),
    [grid.paginationModel, grid.ordering, grid.search, allExtraParams],
  )

  const { rows, rowCount, loading, reload } = useDrfList<IssueRow>('/issues/', listParams, (e) =>
    toast.error(apiErrorToMessage(e)),
  )

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [categories, setCategories] = React.useState<CategoryOption[]>([])
  const [users, setUsers] = React.useState<UserOption[]>([])

  // Assegnabili alle issue: solo utenti "tecnico ServiceNow" e non Philips (categoria Biotron)
  const assignableUsers = React.useMemo(
    () => users.filter((u) => u.is_servicenow_technician !== false && !u.is_philips),
    [users],
  )

  React.useEffect(() => {
    api
      .get('/issue-categories/')
      .then((r) => {
        const listU: unknown = r.data
        const list = Array.isArray(listU) ? listU : []
        setCategories(
          list
            .map((c: unknown) => toIdLabel(c, ['label']))
            .filter((x: CategoryOption | null): x is CategoryOption => Boolean(x)),
        )
      })
      .catch(() => {})
    api
      .get('/users/', { params: { page_size: 200 } })
      .then((r) => {
        const payloadU: unknown = (r as unknown as { data: unknown }).data
        const list: unknown[] = Array.isArray(payloadU)
          ? payloadU
          : isRecord(payloadU) && Array.isArray(payloadU['results'])
            ? (payloadU['results'] as unknown[])
            : []
        setUsers(
          (list as unknown[])
            .map((u: unknown) => toUserOption(u))
            .filter((x: UserOption | null): x is UserOption => Boolean(x)),
        )
      })
      .catch(() => {})
  }, [])

  // ── Customer autocomplete (form) ──────────────────────────────────────────
  const [custFormInput, setCustFormInput] = React.useState('')
  const [custFormOptions, setCustFormOptions] = React.useState<CustomerOption[]>([])
  const [custFormLoading, setCustFormLoading] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      setCustFormLoading(true)
      try {
        const r = await api.get('/customers/', {
          params: { search: custFormInput || undefined, page_size: 25 },
        })
        const payloadU: unknown = (r as unknown as { data: unknown }).data
        const list: unknown[] = Array.isArray(payloadU)
          ? payloadU
          : isRecord(payloadU) && Array.isArray(payloadU['results'])
            ? (payloadU['results'] as unknown[])
            : []
        if (alive)
          setCustFormOptions(
            list
              .map((c: unknown) => toIdLabel(c, ['display_name', 'name']))
              .filter((x: CustomerOption | null): x is CustomerOption => Boolean(x)),
          )
      } catch {
        /* silent */
      } finally {
        if (alive) setCustFormLoading(false)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [custFormInput])

  // ── Drawer: crea / modifica ───────────────────────────────────────────────
  const [formOpen, setFormOpen] = React.useState(false)
  const [editIssue, setEditIssue] = React.useState<IssueRow | null>(null)
  const [form, setForm] = React.useState<IssueFormData>(() => createEmptyForm(me?.id))
  const [formSaving, setFormSaving] = React.useState(false)
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [linkInventoryOpen, setLinkInventoryOpen] = React.useState(false)
  const [linkInventoryLoading, setLinkInventoryLoading] = React.useState(false)
  const [linkInventorySaving, setLinkInventorySaving] = React.useState(false)
  const [inventoryOptions, setInventoryOptions] = React.useState<InventoryOption[]>([])
  const [selectedInventory, setSelectedInventory] = React.useState<InventoryOption | null>(null)
  // inventory pre-selezionato quando si arriva da Inventory → "Apri issue"
  const [pendingInventory, setPendingInventory] = React.useState<InventoryOption | null>(null)

  const syncIssueState = React.useCallback((next: IssueRow) => {
    setEditIssue(next)
    setDetailIssue((current) => (current?.id === next.id ? next : current))
  }, [])

  // Siti filtrati per cliente selezionato
  const [siteOptions, setSiteOptions] = React.useState<{ id: number; label: string }[]>([])
  React.useEffect(() => {
    if (!form.customer) {
      setSiteOptions([])
      return
    }
    api
      .get('/sites/', { params: { customer: form.customer.id, page_size: 100 } })
      .then((r) => {
        const payloadU: unknown = (r as unknown as { data: unknown }).data
        const list: unknown[] = Array.isArray(payloadU)
          ? payloadU
          : isRecord(payloadU) && Array.isArray(payloadU['results'])
            ? (payloadU['results'] as unknown[])
            : []
        setSiteOptions(
          list
            .map((s: unknown) => toIdLabel(s, ['display_name', 'name']))
            .filter((x: { id: number; label: string } | null): x is { id: number; label: string } =>
              Boolean(x),
            ),
        )
      })
      .catch(() => {})
  }, [form.customer])

  const openCreate = React.useCallback(() => {
    setEditIssue(null)
    setForm(createEmptyForm(me?.id))
    setCustFormInput('')
    setFormErrors({})
    setInventoryOptions([])
    setSelectedInventory(null)
    setPendingInventory(null)
    setLinkInventoryOpen(false)
    setFormOpen(true)
  }, [me?.id])

  // Click sul numero ServiceNow di un'Issue → apre il drawer del caso
  // corrispondente nella pagina ServiceNow Case (solo quello: non tocca
  // il drawer dell'Issue, il click viene fermato con stopPropagation).
  const [resolvingServiceNowId, setResolvingServiceNowId] = React.useState<string | null>(null)

  const openServiceNowCaseDrawer = React.useCallback(
    async (number: string) => {
      setResolvingServiceNowId(number)
      try {
        const res = await api.get('/servicenow-cases/', { params: { number } })
        const payload: unknown = res.data
        const list: unknown[] = Array.isArray(payload)
          ? payload
          : isRecord(payload) && Array.isArray(payload['results'])
            ? (payload['results'] as unknown[])
            : []
        const found = list[0]
        const caseId = isRecord(found) ? found['id'] : undefined
        if (typeof caseId === 'number') {
          navigate(`/servicenow-cases?open=${caseId}`)
        } else {
          toast.error(`Nessun ServiceNow Case trovato con numero "${number}"`)
        }
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setResolvingServiceNowId(null)
      }
    },
    [navigate, toast],
  )

  const openCreateOnceRef = React.useRef(false)

  React.useEffect(() => {
    const st = loc.state as OpenCreateState | null
    const hasOpenCreate = st?.openCreate || st?.createFromInventory || st?.createFromServiceNowCase
    if (!hasOpenCreate) {
      openCreateOnceRef.current = false
      return
    }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true

    const cfi = st?.createFromInventory
    const cfsn = st?.createFromServiceNowCase
    if (cfi) {
      // Pre-compila il form con i dati dell'inventory
      const custOpt = { id: cfi.customerId, label: cfi.customerName }
      const invOpt: InventoryOption = {
        id: cfi.inventoryId,
        name: cfi.inventoryName,
        knumber: cfi.inventoryKnumber,
        serial_number: cfi.inventorySerialNumber,
        hostname: cfi.inventoryHostname,
      }
      setEditIssue(null)
      setForm({
        ...createEmptyForm(me?.id),
        customer: custOpt,
        site_id: cfi.siteId ?? '',
      })
      setCustFormInput(cfi.customerName)
      setFormErrors({})
      setInventoryOptions([invOpt])
      setSelectedInventory(invOpt)
      setPendingInventory(invOpt)
      setLinkInventoryOpen(false)
      setFormOpen(true)
    } else if (cfsn) {
      // Pre-compila il form con i dati del ServiceNow Case: il case non ha un
      // collegamento diretto a Customer/Site, quindi vanno scelti manualmente.
      // L'account del caso viene comunque usato per avviare la ricerca del
      // cliente in anagrafica e, se l'utente spunta "Cliente non presente in
      // DB", come testo libero già pronto.
      setEditIssue(null)
      setForm({
        ...createEmptyForm(me?.id),
        title: (cfsn.shortDescription.trim() || `Caso ServiceNow ${cfsn.number}`).slice(0, 255),
        description: cfsn.shortDescription,
        servicenow_id: cfsn.number,
        customerPlaceholder: cfsn.account || '',
      })
      setCustFormInput(cfsn.account || '')
      setFormErrors({})
      setInventoryOptions([])
      setSelectedInventory(null)
      setPendingInventory(null)
      setLinkInventoryOpen(false)
      setFormOpen(true)
    } else {
      openCreate()
    }

    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc, navigate, me?.id, openCreate])

  const openEdit = React.useCallback((row: IssueRow) => {
    setEditIssue(row)
    const custOpt = row.customer
      ? { id: row.customer, label: row.customer_name || String(row.customer) }
      : null
    setForm({
      title: row.title,
      description: row.description,
      servicenow_id: row.servicenow_id,
      customer: row.is_customer_placeholder ? null : custOpt,
      useCustomerPlaceholder: row.is_customer_placeholder,
      customerPlaceholder: row.customer_placeholder || '',
      site_id: row.site ?? '',
      category_id: row.category ?? '',
      assigned_to_id: row.assigned_to ?? '',
      priority: row.priority,
      status: row.status,
      waiting_reason: row.waiting_reason || '',
      opened_at: row.opened_at ?? '',
      due_date: row.due_date ?? '',
    })
    if (custOpt) setCustFormInput(custOpt.label)
    setFormErrors({})
    setSelectedInventory(
      row.inventory
        ? {
            id: row.inventory,
            name: row.inventory_name || `Inventory #${row.inventory}`,
            knumber: row.inventory_knumber,
            serial_number: row.inventory_serial_number,
            hostname: row.inventory_hostname,
          }
        : null,
    )
    setFormOpen(true)
  }, [])

  const openLinkInventoryPicker = React.useCallback(async () => {
    if (!editIssue) return

    setLinkInventoryOpen(true)
    setLinkInventoryLoading(true)
    try {
      const r = await api.get('/inventories/', {
        params: { customer: editIssue.customer, page_size: 100, ordering: 'name' },
      })
      const payloadU: unknown = (r as unknown as { data: unknown }).data
      const list: unknown[] = Array.isArray(payloadU)
        ? payloadU
        : isRecord(payloadU) && Array.isArray(payloadU['results'])
          ? (payloadU['results'] as unknown[])
          : []
      const options = list
        .map((item: unknown) => toInventoryOption(item))
        .filter((item: InventoryOption | null): item is InventoryOption => Boolean(item))
      setInventoryOptions(options)
      setSelectedInventory(options.find((item) => item.id === editIssue.inventory) ?? null)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLinkInventoryLoading(false)
    }
  }, [editIssue, toast])

  const handleLinkInventory = async (
    inventoryToLink: InventoryOption | null = selectedInventory,
  ) => {
    if (!editIssue) return

    setLinkInventorySaving(true)
    try {
      const r = await api.patch<IssueRow>(`/issues/${editIssue.id}/`, {
        inventory: inventoryToLink ? inventoryToLink.id : null,
      })
      syncIssueState(r.data)
      setSelectedInventory(inventoryToLink)
      setLinkInventoryOpen(false)
      reload()
      toast.success(inventoryToLink ? 'Inventory collegato.' : 'Collegamento inventory rimosso.')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLinkInventorySaving(false)
    }
  }

  const handleFormSave = async () => {
    const errors: Record<string, string> = {}
    if (!form.title.trim()) errors.title = 'Il titolo è obbligatorio.'
    if (form.useCustomerPlaceholder) {
      if (!form.customerPlaceholder.trim())
        errors.customer_placeholder = 'Il nome del cliente è obbligatorio.'
    } else if (!form.customer) {
      errors.customer = 'Il cliente è obbligatorio.'
    }
    if (form.status === 'waiting' && !form.waiting_reason) {
      errors.waiting_reason = 'La causale è obbligatoria quando lo stato è «In attesa».'
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors)
      return
    }

    setFormSaving(true)
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      servicenow_id: form.servicenow_id.trim(),
      customer_placeholder: form.useCustomerPlaceholder ? form.customerPlaceholder.trim() : '',
      category: form.category_id || null,
      assigned_to: form.assigned_to_id || null,
      priority: form.priority,
      status: form.status,
      waiting_reason: form.status === 'waiting' ? form.waiting_reason : '',
      opened_at: form.opened_at || null,
      due_date: form.due_date || null,
    }
    if (form.useCustomerPlaceholder) {
      // Cliente/sito non applicabili col testo libero: il backend risolve
      // customer al record sentinella a partire da customer_placeholder.
      payload.site = null
    } else {
      payload.customer = form.customer!.id
      payload.site = form.site_id || null
    }

    // Se c'è un inventory pre-selezionato (da "Apri issue" in Inventory) lo includiamo subito
    if (!editIssue && pendingInventory) {
      payload.inventory = pendingInventory.id
    }

    try {
      if (editIssue) {
        const r = await api.patch<IssueRow>(`/issues/${editIssue.id}/`, payload)
        syncIssueState(r.data)
        toast.success('Issue aggiornata.')
        setFormOpen(false)
      } else {
        const r = await api.post<IssueRow>('/issues/', payload)
        syncIssueState(r.data)
        setSelectedInventory(pendingInventory)
        setPendingInventory(null)
        toast.success(
          pendingInventory
            ? `Issue creata e collegata a ${pendingInventory.name || pendingInventory.knumber || 'inventory'}.`
            : 'Issue creata. Ora puoi collegarla a un inventory.',
        )
      }
      reload()
    } catch (e: unknown) {
      const mapped: Record<string, string> = {}
      if (isRecord(e)) {
        const resp = e['response']
        if (isRecord(resp)) {
          const data = resp['data']
          if (isRecord(data)) {
            for (const [k, v] of Object.entries(data)) {
              if (Array.isArray(v) && typeof v[0] === 'string') mapped[k] = v[0]
              else mapped[k] = String(v)
            }
          }
        }
      }
      if (Object.keys(mapped).length) {
        setFormErrors(mapped)
        return
      }
      toast.error(apiErrorToMessage(e))
    } finally {
      setFormSaving(false)
    }
  }

  // ── Drawer: dettaglio ─────────────────────────────────────────────────────
  const [detailIssue, setDetailIssue] = React.useState<IssueRow | null>(null)
  const [detailTab, setDetailTab] = React.useState(0)
  const [comments, setComments] = React.useState<IssueComment[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [newComment, setNewComment] = React.useState('')
  const [sendingComment, setSendingComment] = React.useState(false)

  const openDetail = React.useCallback((row: IssueRow, tab = 0) => {
    setDetailIssue(row)
    setDetailTab(tab)
    setNewComment('')
  }, [])

  // Ref che mantiene sempre le righe correnti senza finire nelle dep dell'effect
  const rowsRef = React.useRef<IssueRow[]>(rows)
  React.useEffect(() => {
    rowsRef.current = rows
  })

  // Gestisce ?open=<id> — apre il drawer della issue specificata nell'URL
  // (usato dal link "vai alla issue" nel drawer di Inventory)
  const openParamHandledRef = React.useRef(false)
  React.useEffect(() => {
    const params = new URLSearchParams(loc.search)
    const openId = params.get('open')
    if (!openId) {
      openParamHandledRef.current = false
      return
    }
    if (openParamHandledRef.current) return
    const id = Number(openId)
    if (!Number.isFinite(id) || id <= 0) return
    openParamHandledRef.current = true

    const showIssueDetail = (row: IssueRow, tab = 0) => {
      setDetailIssue(row)
      setDetailTab(tab)
      setNewComment('')
    }

    // Cerca prima nelle righe già caricate (via ref, sempre aggiornato), altrimenti fetch diretto
    const existing = rowsRef.current.find((r) => r.id === id)
    if (existing) {
      showIssueDetail(existing)
    } else {
      api
        .get<IssueRow>(`/issues/${id}/`)
        .then((r) => {
          showIssueDetail(r.data)
        })
        .catch((e) => toast.error(apiErrorToMessage(e)))
    }
    // Pulisce il param dall'URL senza reload
    const newSearch = new URLSearchParams(loc.search)
    newSearch.delete('open')
    navigate(loc.pathname + (newSearch.toString() ? `?${newSearch.toString()}` : ''), {
      replace: true,
      state: loc.state,
    })
  }, [loc.pathname, loc.search, loc.state, navigate])

  React.useEffect(() => {
    if (!detailIssue) return
    setCommentsLoading(true)
    api
      .get(`/issues/${detailIssue.id}/comments/`)
      .then((r) => setComments(r.data ?? []))
      .catch(() => toast.error('Errore caricamento commenti.'))
      .finally(() => setCommentsLoading(false))
  }, [detailIssue, toast])

  const handleSendComment = async () => {
    if (!newComment.trim() || !detailIssue) return
    setSendingComment(true)
    try {
      const r = await api.post(`/issues/${detailIssue.id}/comments/`, { body: newComment.trim() })
      setComments((prev) => [...prev, r.data])
      setNewComment('')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSendingComment(false)
    }
  }

  // ── Modifica sul posto dal pannello: salva subito, con Annulla ──────────
  const undoToast = useUndoToast()
  const [kpiReload, setKpiReload] = React.useState(0)
  const patchIssue = React.useCallback(async (patch: IssuePatch, label: string) => {
    if (!detailIssue) return
    const id = detailIssue.id
    const prev: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) prev[k] = (detailIssue as Record<string, unknown>)[k]
    try {
      const r = await api.patch<IssueRow>(`/issues/${id}/`, patch)
      syncIssueState(r.data)
      reload()
      setKpiReload((n) => n + 1)
      undoToast.show(`${label} · salvato`, async () => {
        try {
          const back = await api.patch<IssueRow>(`/issues/${id}/`, prev)
          syncIssueState(back.data)
          reload()
          setKpiReload((n) => n + 1)
        } catch (e) {
          toast.error(apiErrorToMessage(e))
        }
      })
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }, [detailIssue, syncIssueState, reload, undoToast, toast])

  const detailIndex = detailIssue ? rows.findIndex((r) => r.id === detailIssue.id) : -1

  const issueCounts = useIssueCounts(kpiReload, me?.id)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<IssueRow>({
      url: '/issues/',
      params,
      filename: 'issue',
      columns: [
        { label: 'ID', getValue: (r) => r.id },
        { label: 'Priorità', getValue: (r) => r.priority_label || r.priority },
        { label: 'Stato', getValue: (r) => r.status_label || r.status },
        { label: 'Titolo', getValue: (r) => r.title },
        { label: 'Cliente', getValue: (r) => r.customer_name || r.customer_placeholder },
        { label: 'Sito', getValue: (r) => r.site_name },
        { label: 'ServiceNow', getValue: (r) => r.servicenow_id },
        { label: 'Assegnata a', getValue: (r) => r.assigned_to_full_name },
        { label: 'Scadenza', getValue: (r) => r.due_date },
        { label: 'Apertura', getValue: (r) => r.opened_at },
      ],
    })
  }

  // Conteggi delle viste (globali, da /issues/summary/)
  const [kpiCounts, setKpiCounts] = React.useState<{ active: number; closed: number; all: number } | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get('/issues/summary/').then((r) => {
      const d = r.data as Record<string, number>
      if (alive) setKpiCounts({
        active: d.active_count ?? 0,
        closed: (d.resolved_count ?? 0) + (d.closed_count ?? 0),
        all: (d.active_count ?? 0) + (d.resolved_count ?? 0) + (d.closed_count ?? 0),
      })
    }).catch(() => {})
    return () => { alive = false }
  }, [kpiReload])

  const userLabel = (id: string) => users.find((u) => String(u.id) === id)?.label ?? id
  const catLabel = (id: string) => categories.find((c) => String(c.id) === id)?.label ?? id
  const activeFilters: ActiveFilter[] = [
    fStatus.length ? { key: 'status', label: 'Stato', values: fStatus.map((x) => STATUS_META[x]?.label ?? x).join(', ') } : null,
    fPriority.length ? { key: 'priority', label: 'Priorità', values: fPriority.map((x) => PRIORITY_META[x]?.label ?? x).join(', ') } : null,
    fCategory.length ? { key: 'category', label: 'Categoria', values: fCategory.map(catLabel).join(', ') } : null,
    fAssigned.length && view !== 'mine' ? { key: 'assigned', label: 'Assegnata a', values: fAssigned.map(userLabel).join(', ') } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'status') setFStatus([])
    if (key === 'priority') setFPriority([])
    if (key === 'category') setFCategory([])
    if (key === 'assigned') setFAssigned([])
  }
  // Card su telefono: stato e scadenza in alto, titolo, cliente.
  const renderIssueCard = React.useCallback(({ row, onOpen, onContextMenu }: { row: IssueRow; onOpen: (id: number) => void; onContextMenu: (r: IssueRow, e: React.MouseEvent<HTMLElement>) => void }) => {
    const overdue = !!row.due_date && new Date(row.due_date) < new Date() && !isClosedIssueRow(row)
    return (
      <Box role="button" tabIndex={0} onClick={() => onOpen(row.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row.id) }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(row, e) }}
        sx={{ display: 'grid', gap: 0.5, p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: detailIssue?.id === row.id ? 'archie.fieldLine' : 'divider', borderRadius: '8px', cursor: 'pointer' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'text.secondary' }}>#{row.id}</Typography>
          <IssueStatusBadge status={row.status} label={row.status_label || undefined} />
          <IssuePriorityMark priority={row.priority} compact />
          <Typography component="span" sx={{ ml: 'auto', fontSize: 12, fontWeight: overdue ? 600 : 500, color: overdue ? 'error.main' : 'text.secondary' }}>
            {row.due_date ? fmtDate(row.due_date) : ''}
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{row.title}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {[row.customer_name, row.site_name].filter(Boolean).join(' · ')}{row.assigned_to_full_name ? ` · ${row.assigned_to_full_name}` : ''}
        </Typography>
      </Box>
    )
  }, [detailIssue?.id])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => {
    const make = (label: string, sel: string[], set: (v: string[]) => void, options: { value: string; label: string }[], opts?: { single?: boolean; searchable?: boolean }) => ({
      value: sel.join(','),
      label: `Filtra ${label.toLowerCase()}`,
      onSet: (v: string | number | '') => set(v === '' ? [] : String(v).split(',')),
      onReset: () => set([]),
      children: <FilterOptionList label={label} options={options} selected={sel} onChange={set} single={opts?.single} searchable={opts?.searchable} />,
    })
    const cfg: Record<string, ColumnFilterConfig> = {
      priority: make('Priorità', fPriority, setFPriority, ['critical', 'high', 'medium', 'low'].map((k) => ({ value: k, label: PRIORITY_META[k].label }))),
      status: make('Stato', fStatus, setFStatus, Object.entries(STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))),
      category_label: make('Categoria', fCategory, setFCategory, categories.map((c) => ({ value: String(c.id), label: c.label })), { single: true }),
    }
    if (view !== 'mine') cfg.assigned_to_full_name = make('Assegnata a', fAssigned, setFAssigned, assignableUsers.map((u) => ({ value: String(u.id), label: u.label })), { single: true, searchable: true })
    return cfg
  }, [fPriority, fStatus, fCategory, fAssigned, categories, assignableUsers, view])

  // ── Delete / restore ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<IssueRow | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/issues/${deleteTarget.id}/`)
      toast.success('Issue eliminata.')
      setDeleteTarget(null)
      reload()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = React.useState<{
    row: IssueRow
    mouseX: number
    mouseY: number
  } | null>(null)

  const handleRowContextMenu = React.useCallback(
    (row: IssueRow, event: React.MouseEvent<HTMLElement>) => {
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    },
    [],
  )

  const handleResolveIssue = React.useCallback(
    async (row: IssueRow) => {
      try {
        const r = await api.patch<IssueRow>(`/issues/${row.id}/`, { status: 'resolved' })
        syncIssueState(r.data)
        reload()
        toast.success('Issue segnata come risolta.')
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      }
    },
    [syncIssueState, reload, toast],
  )

  const contextMenuItems: RowContextMenuItem[] = (() => {
    const row = contextMenu?.row
    if (!row) return []

    const isClosed = row.status === 'closed'
    const isResolved = row.status === 'resolved'

    return [
      {
        key: 'open',
        label: 'Apri dettaglio',
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => openDetail(row, 0),
      },
      {
        key: 'edit',
        label: 'Modifica',
        icon: <EditIcon fontSize="small" />,
        onClick: () => openEdit(row),
        disabled: isClosed,
      },
      {
        key: 'resolve',
        label: 'Segna come risolta',
        icon: <CheckCircleOutlineIcon fontSize="small" />,
        onClick: () => handleResolveIssue(row),
        hidden: isResolved || isClosed,
      },
      {
        key: 'comment',
        label: 'Aggiungi commento',
        icon: <ChatBubbleOutlineIcon fontSize="small" />,
        onClick: () => openDetail(row, 1),
      },
      {
        key: 'link_inventory',
        label: 'Collega a inventory',
        icon: <LinkIcon fontSize="small" />,
        onClick: () => {
          openEdit(row)
          // apriamo il picker dopo che il form è montato
          window.setTimeout(() => openLinkInventoryPicker(), 120)
        },
        disabled: isClosed,
      },
      {
        key: 'delete',
        label: 'Elimina',
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: () => setDeleteTarget(row),
        tone: 'danger',
        disabled: isClosed,
      },
    ]
  })()

  const emptyState = React.useMemo(() => {
    if (grid.view === 'deleted' && !grid.search.trim()) {
      return {
        title: 'Cestino issue vuoto',
        subtitle: 'Non ci sono issue eliminate da ripristinare.',
      }
    }

    if (!grid.search.trim() && activeFilterCount === 0) {
      return {
        title: 'Nessuna issue',
        subtitle: 'Crea una nuova issue oppure collega un caso a un inventory esistente.',
        action: (
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
            Nuova issue
          </Button>
        ),
      }
    }

    return {
      title: 'Nessun risultato',
      subtitle: 'Prova a cambiare ricerca o filtri per trovare le issue che ti servono.',
      action:
        grid.search.trim() || activeFilterCount > 0 ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={() => {
              grid.reset()
              resetFilters()
            }}
          >
            Reimposta ricerca e filtri
          </Button>
        ) : undefined,
    }
  }, [activeFilterCount, grid, openCreate])

  const columns: GridColDef<IssueRow>[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 68,
      sortable: false,
      renderCell: ({ row }) => <Typography component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'text.secondary' }}>#{row.id}</Typography>,
    },
    {
      field: 'priority',
      headerName: 'Priorità',
      width: 104,
      sortable: true,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <IssuePriorityMark priority={row.priority} />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Stato',
      width: 168,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%' }}>
          <IssueStatusBadge status={row.status} label={row.status_label || undefined} />
          {row.status === 'waiting' && row.waiting_reason_label ? (
            <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{row.waiting_reason_label}</Typography>
          ) : null}
        </Box>
      ),
    },
    {
      field: 'title',
      headerName: 'Titolo',
      flex: 1,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%', minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{row.title}</Typography>
          {!row.inventory && <UnlinkedInventoryWarningIcon />}
        </Box>
      ),
    },
    {
      field: 'customer_name',
      headerName: 'Cliente · sito',
      width: 190,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 13 }}>{row.customer_name || row.customer_placeholder}</Typography>
            {row.is_customer_placeholder ? (
              <Tooltip title="Cliente non in Site Repository">
                <InfoOutlinedIcon sx={{ color: 'text.disabled', fontSize: 14, flexShrink: 0 }} />
              </Tooltip>
            ) : null}
          </Box>
          {row.site_name ? <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{row.site_name}</Typography> : null}
        </Box>
      ),
    },
    {
      field: 'servicenow_id',
      headerName: 'ServiceNow',
      width: 128,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
          {row.servicenow_id ? (
            <>
              <Typography
                onClick={(e) => {
                  e.stopPropagation()
                  void openServiceNowCaseDrawer(row.servicenow_id as string)
                }}
                sx={{
                  fontFamily: '"Geist Mono", monospace',
                  fontWeight: 500,
                  fontSize: 12,
                  cursor: resolvingServiceNowId === row.servicenow_id ? 'wait' : 'pointer',
                  color: 'primary.main',
                  opacity: resolvingServiceNowId === row.servicenow_id ? 0.5 : 1,
                  '&:hover': { textDecoration: 'underline' },
                }}
                noWrap
              >
                {row.servicenow_id}
              </Typography>
              {row.servicenow_external_url ? (
                <Tooltip title="Apri il case sul portale ServiceNow">
                  <IconButton
                    size="small"
                    component="a"
                    href={row.servicenow_external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ p: 0.25 }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'assigned_to_full_name',
      headerName: 'Assegnata a',
      width: 150,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          {row.assigned_to_full_name ? (
            <Typography variant="body2" noWrap>{row.assigned_to_full_name}</Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>Non assegnata</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'due_date',
      headerName: 'Scadenza',
      width: 124,
      renderCell: ({ row }) => {
        if (!row.due_date) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const due = new Date(row.due_date + 'T00:00:00')
        const open = !isClosedIssueRow(row)
        const overdue = open && due < today
        const isToday = open && due.getTime() === today.getTime()
        return (
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: overdue || isToday ? 600 : 400, color: overdue ? 'error.main' : isToday ? 'warning.main' : 'inherit' }}>
            {fmtDate(row.due_date)?.slice(0, 5)}{overdue ? ' · scaduta' : isToday ? ' · oggi' : ''}
          </Typography>
        )
      },
    },
    {
      field: 'opened_at',
      headerName: 'Apertura',
      width: 130,
      renderCell: ({ row }) => {
        const d = fmtDate(row.opened_at) || fmtDate(row.created_at.split('T')[0])
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{d}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'category_label',
      headerName: 'Categoria',
      width: 150,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          {row.category_label ? (
            <Typography variant="body2" noWrap>{row.category_label}</Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'comments_count',
      headerName: 'Commenti',
      width: 90,
      align: 'center',
      headerAlign: 'center',
      renderCell: ({ row }) => {
        const count = row.comments_count ?? 0
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
            }}
          >
            <Tooltip
              title={
                count ? `${count} ${count === 1 ? 'commento' : 'commenti'}` : 'Nessun commento'
              }
            >
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  openDetail(row, 1)
                }}
                sx={{
                  color: count ? 'primary.main' : 'text.disabled',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, count ? 0.08 : 0),
                  '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16) },
                }}
              >
                <Badge
                  badgeContent={count || null}
                  color="primary"
                  max={99}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.6rem',
                      height: 15,
                      minWidth: 15,
                      top: 1,
                      right: 1,
                    },
                  }}
                >
                  <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        )
      },
    },
    {
      field: 'closed_at',
      headerName: 'Data chiusura',
      width: 130,
      renderCell: ({ row }) => {
        const d = fmtDate(row.closed_at)
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{d || '—'}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'days_open',
      headerName: 'Giorni passati',
      width: 120,
      // Campo calcolato lato backend (oggi - opened_at, SerializerMethodField):
      // non esiste come colonna ordinabile sul queryset. Ordiniamo sfruttando
      // opened_at (già ordinabile) con direzione invertita — vedi
      // handleSortModelChange/displaySortModel più sotto.
      renderCell: ({ row }) => {
        const days = row.days_open ?? 0
        const color = days > 30 ? 'error.main' : days > 14 ? 'warning.main' : 'text.primary'
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color }}>
              {days} {days === 1 ? 'giorno' : 'giorni'}
            </Typography>
          </Box>
        )
      },
    },
  ]


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Issue"
        actions={<Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>Nuova issue</Button>}
      />
      <IssuesKpis
        reloadKey={kpiReload}
        counts={issueCounts}
        view={view}
        priority={fPriority}
        onView={(k) => { setView(k as IssueView); setFPriority([]) }}
        onPriorityPick={(pr) => { setView('active'); setFPriority((cur) => (cur.length === 1 && cur[0] === pr ? [] : [pr])) }}
      />
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <ViewTabs
          value={view}
          onChange={(k) => setView(k as IssueView)}
          tabs={[
            { key: 'active', label: 'Attive', count: kpiCounts?.active },
            { key: 'mine', label: 'Le mie', count: issueCounts?.mine },
            { key: 'overdue', label: 'Scadute', count: issueCounts?.overdue, tone: 'alert' },
            { key: 'closed', label: 'Risolte e chiuse', count: kpiCounts?.closed },
            { key: 'all', label: 'Tutte', count: kpiCounts?.all },
          ]}
        />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          mobileCard={renderIssueCard}
          toolbar={{
            compact: true,
            q: grid.q,
            onQChange: grid.setQ,
            hideSearch: !searchOpen && !grid.q,
            searchLabel: 'Cerca titolo, cliente, ServiceNow, inventario…',
            alignRightActions: true,
            children: (
              <FilterTokens filters={activeFilters} onRemove={removeFilter} onClear={() => { setFStatus([]); setFPriority([]); setFCategory([]); setFAssigned([]) }}
                empty={searchOpen || grid.q ? undefined : 'Filtra e ordina dalle intestazioni di colonna'} />
            ),
            rightActions: (
              <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                <Tooltip title="Esporta le righe visibili (CSV)">
                  <span>
                    <IconButton aria-label="Esporta le righe visibili" disabled={exporting} onClick={exportVisible}>
                      {exporting ? <CircularProgress size={16} /> : <FileDownloadOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={searchOpen ? 'Nascondi la ricerca' : 'Cerca nella tabella'}>
                  <IconButton aria-label="Cerca nella tabella" aria-pressed={searchOpen || !!grid.q}
                    onClick={() => { if (searchOpen && grid.q) grid.setQ(''); setSearchOpen((v) => !v) }}
                    sx={searchOpen || grid.q ? { bgcolor: 'archie.field', color: 'primary.main', borderColor: 'archie.fieldLine' } : undefined}>
                    <SearchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          }}
          grid={{
            pageKey: 'issues',
            rowHeight: 44,
            filterConfig,
            username: me?.username,
            rows,
            emptyState,
            rowCount,
            loading,
            columns,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: displaySortModel,
            onSortModelChange: handleSortModelChange,
            onRowClick: (id) => {
              const row = rows.find((r) => r.id === id)
              if (row) openDetail(row, 0)
            },
            onRowContextMenu: handleRowContextMenu,
            getRowClassName: (row) => [isClosedIssueRow(row) ? 'row-closed-issue' : '', detailIssue?.id === row.id ? 'Mui-selected' : ''].filter(Boolean).join(' ') || undefined,
            sx: {
              cursor: 'pointer',
              ...headerFilterGridSx,
              '& .row-closed-issue': { color: 'text.secondary' },
            },
          }}
        />
      </Box>
      <IssueDialog
        open={formOpen}
        editIssue={editIssue}
        form={form}
        saving={formSaving}
        errors={formErrors}
        customerInput={custFormInput}
        customerOptions={custFormOptions}
        customerLoading={custFormLoading}
        siteOptions={siteOptions}
        categories={categories}
        users={assignableUsers}
        pendingInventory={pendingInventory}
        onClose={() => setFormOpen(false)}
        onSave={handleFormSave}
        onOpenLinkInventory={openLinkInventoryPicker}
        onCustomerInputChange={setCustFormInput}
        onFormChange={setForm}
      />

      <Dialog
        open={linkInventoryOpen}
        onClose={() => {
          if (!linkInventorySaving) setLinkInventoryOpen(false)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Collega a inventory</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Inventories del cliente {editIssue?.customer_name}
            </Typography>

            <Autocomplete
              options={inventoryOptions}
              loading={linkInventoryLoading}
              value={selectedInventory}
              onChange={(_, value) => setSelectedInventory(value)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(option) => inventoryLabel(option)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Seleziona inventory"
                  size="small"
                  helperText="Puoi lasciare vuoto e usare “Scollega” per rimuovere il collegamento attuale."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {linkInventoryLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Stack spacing={0.25} sx={{ py: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {option.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[
                        option.type_label,
                        option.site_name,
                        option.hostname,
                        option.knumber,
                        option.serial_number,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Nessun dettaglio aggiuntivo'}
                    </Typography>
                  </Stack>
                </Box>
              )}
            />

            {!linkInventoryLoading && inventoryOptions.length === 0 && (
              <Alert severity="info">Nessun inventory trovato per questo cliente.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="text"
            color="inherit"
            onClick={() => setLinkInventoryOpen(false)}
            disabled={linkInventorySaving}
          >
            Annulla
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              void handleLinkInventory(null)
            }}
            disabled={linkInventorySaving || !editIssue?.inventory}
          >
            Scollega
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleLinkInventory(selectedInventory)
            }}
            disabled={linkInventorySaving || !selectedInventory}
          >
            {linkInventorySaving && <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />}
            Collega
          </Button>
        </DialogActions>
      </Dialog>
      <IssueDetail
        issue={detailIssue}
        tab={detailTab === 1 ? 'att' : 'det'}
        onTab={(t) => setDetailTab(t === 'att' ? 1 : 0)}
        position={detailIndex >= 0 ? `${detailIndex + 1} di ${rows.length}` : undefined}
        onPrev={detailIndex > 0 ? () => openDetail(rows[detailIndex - 1], detailTab) : undefined}
        onNext={detailIndex >= 0 && detailIndex < rows.length - 1 ? () => openDetail(rows[detailIndex + 1], detailTab) : undefined}
        onClose={() => setDetailIssue(null)}
        comments={comments}
        commentsLoading={commentsLoading}
        newComment={newComment}
        sendingComment={sendingComment}
        onNewCommentChange={setNewComment}
        onSendComment={handleSendComment}
        users={assignableUsers}
        categories={categories}
        meId={me?.id}
        onPatch={patchIssue}
        onEdit={() => {
          if (!detailIssue) return
          openEdit(detailIssue)
        }}
        onDelete={() => {
          if (!detailIssue) return
          setDeleteTarget(detailIssue)
          setDetailIssue(null)
        }}
        onLinkInventory={() => {
          if (!detailIssue) return
          openEdit(detailIssue)
          window.setTimeout(() => openLinkInventoryPicker(), 120)
        }}
        onOpenServiceNow={(n) => void openServiceNowCaseDrawer(n)}
      />

      {/* ── Context menu ── */}
      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        onClose={() => setContextMenu(null)}
        items={contextMenuItems}
      />

      {/* ── Confirm delete ── */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Elimina issue"
        description={`Sei sicuro di voler eliminare "${deleteTarget?.title}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Stack>
  )
}
