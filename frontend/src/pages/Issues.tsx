import * as React from 'react'
import { alpha, useTheme } from '@mui/material/styles'

import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
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
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RowContextMenu, { type RowContextMenuItem } from '../ui/RowContextMenu'

import type { GridColDef } from '@mui/x-data-grid'

import { useAuth } from '../auth/AuthProvider'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { apiErrorToMessage } from '../api/error'
import { buildDrfListParams, type DrfParams } from '../api/drf'
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
import IssueDrawer from '../features/issues/IssueDrawer'
import { useDrfList } from '../hooks/useDrfList'
import { useServerGrid } from '../hooks/useServerGrid'
import { useToast } from '../ui/toast'
import EntityListCard from '../ui/EntityListCard'
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog'
import FilterChip from '../ui/FilterChip'
import { compactCreateButtonSx, compactExportButtonSx, compactResetButtonSx } from '../ui/toolbarStyles'
import { useExportCsv } from '../ui/useExportCsv'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { isRecord } from '../utils/guards'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

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

type OpenCreateState = {
  openCreate?: boolean
  createFromInventory?: CreateFromInventoryState
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
  return { id, label, username }
}

function toInventoryOption(v: unknown): InventoryOption | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  const name = typeof v['name'] === 'string' && v['name'].trim() ? v['name'].trim() : `Inventory #${id}`
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
  | Pick<IssueRow, 'inventory_name' | 'inventory_knumber' | 'inventory_serial_number' | 'inventory_hostname'>
  | InventoryOption
  | null

function isIssueInventoryLabelSource(
  item: Exclude<InventoryLabelSource, null>,
): item is Pick<IssueRow, 'inventory_name' | 'inventory_knumber' | 'inventory_serial_number' | 'inventory_hostname'> {
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

  const parts = [normalized.name, normalized.knumber, normalized.hostname, normalized.serial_number].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function IssuePriorityChip({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? { label: priority, color: 'default' as const }
  return (
    <Chip
      size="small"
      label={m.label}
      color={m.color}
      variant={m.color === 'default' ? 'outlined' : 'filled'}
    />
  )
}

function IssueStatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: 'default' as const }
  return (
    <Chip
      size="small"
      label={m.label}
      color={m.color}
      variant={m.color === 'default' ? 'outlined' : 'filled'}
    />
  )
}

// ─── Widget riepilogo ────────────────────────────────────────────────────────

type Granularity = 'day' | 'week' | 'month'

// Riempie i buchi del calendario e fonde due serie (aperte + risolte/chiuse)
function fillChartBuckets(
  openedBuckets: { date: string; count: number }[],
  closedBuckets: { date: string; count: number }[],
  granularity: Granularity,
): { label: string; opened: number; closed: number }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Usa date locali (evita lo sfasamento UTC di toISOString con fuso +X)
  const localISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const slots: { key: string; label: string; opened: number; closed: number }[] = []

  if (granularity === 'day') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      slots.push({ key: localISO(d), label: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), opened: 0, closed: 0 })
    }
  } else if (granularity === 'week') {
    const monday = new Date(today)
    const dow = today.getDay()
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(monday)
      ws.setDate(monday.getDate() - i * 7)
      slots.push({ key: localISO(ws), label: ws.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), opened: 0, closed: 0 })
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      slots.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }), opened: 0, closed: 0 })
    }
  }

  const byKey = Object.fromEntries(slots.map((s) => [s.key, s]))
  for (const b of openedBuckets) {
    const k = granularity === 'month' ? b.date.slice(0, 7) + '-01' : b.date.slice(0, 10)
    if (byKey[k]) byKey[k].opened = b.count
  }
  for (const b of closedBuckets) {
    const k = granularity === 'month' ? b.date.slice(0, 7) + '-01' : b.date.slice(0, 10)
    if (byKey[k]) byKey[k].closed = b.count
  }
  return slots
}

function IssuesSummaryWidget({ rows, loading }: { rows: IssueRow[]; loading: boolean }) {
  const theme = useTheme()
  const [granularity, setGranularity] = React.useState<Granularity>('day')
  const [avgDaysGlobal, setAvgDaysGlobal] = React.useState<number | null>(null)
  const [chartData, setChartData] = React.useState<{ label: string; opened: number; closed: number }[]>([])

  // Carica dati globali (avg + grafico) ad ogni cambio di granularità
  React.useEffect(() => {
    api.get<{
      avg_days_to_close: number | null
      chart_buckets: { date: string; count: number }[]
      closed_buckets: { date: string; count: number }[]
    }>(
      '/issues/summary/',
      { params: { granularity } },
    ).then((r) => {
      setAvgDaysGlobal(r.data.avg_days_to_close ?? null)
      setChartData(fillChartBuckets(
        r.data.chart_buckets ?? [],
        r.data.closed_buckets ?? [],
        granularity,
      ))
    }).catch(() => {})
  }, [granularity])

  const open     = rows.filter((r) => r.status === 'open').length
  const inProg   = rows.filter((r) => r.status === 'in_progress').length
  const critical = rows.filter((r) => r.priority === 'critical' && (r.status === 'open' || r.status === 'in_progress')).length

  const cardSx = { bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 2, p: '1rem 1.25rem', opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }

  const avgLabel = avgDaysGlobal != null ? `${avgDaysGlobal.toFixed(1)} gg` : '—'

  const kpis = [
    { label: 'Aperte',          value: open,       sub: `su ${rows.length} totali`,    accent: '#e24b4a' },
    { label: 'In lavorazione',  value: inProg,     sub: 'in corso',                    accent: '#f59e0b' },
    { label: 'Critiche aperte', value: critical,   sub: 'richiedono attenzione',       accent: '#6366f1' },
    { label: 'Tempo medio',     value: avgLabel,   sub: 'su tutte le issue chiuse',    accent: '#14b8a6' },
  ]

  const granularityOptions: { key: Granularity; label: string }[] = [
    { key: 'day',   label: 'Giornaliero' },
    { key: 'week',  label: 'Settimanale' },
    { key: 'month', label: 'Mensile' },
  ]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {/* ── Sinistra: KPI gradient cards ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
        {kpis.map((m) => (
          <Box
            key={m.label}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '8px',
              p: { xs: '12px', sm: '14px 16px' },
              backgroundImage: `linear-gradient(135deg, ${alpha(m.accent, 0.62)} 0%, ${alpha(m.accent, 0.86)} 100%)`,
              border: `1px solid ${alpha(m.accent, 0.18)}`,
              boxShadow: `0 10px 28px ${alpha(m.accent, 0.18)}`,
              '&::before': {
                content: '""', position: 'absolute',
                width: 80, height: 80, borderRadius: '50%',
                right: -20, top: -16,
                backgroundColor: alpha(theme.palette.common.white, 0.14),
              },
              '&::after': {
                content: '""', position: 'absolute',
                width: 100, height: 100, borderRadius: '50%',
                right: 16, bottom: -52,
                backgroundColor: alpha(theme.palette.common.white, 0.10),
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: alpha(theme.palette.common.white, 0.85), mb: '6px', lineHeight: 1.2 }}>
                {m.label}
              </Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: theme.palette.common.white, lineHeight: 1, letterSpacing: -0.5, textShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.12)}` }}>
                {m.value}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: alpha(theme.palette.common.white, 0.75), mt: '4px' }}>
                {m.sub}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={cardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '8px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: 'text.disabled' }}>
              Andamento issue
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#E24B4A', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>Aperte</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#16a34a', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>Risolte/Chiuse</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', bgcolor: 'action.hover', borderRadius: 1, p: '2px', gap: '2px' }}>
            {granularityOptions.map((o) => (
              <Box
                key={o.key}
                onClick={() => setGranularity(o.key)}
                sx={{
                  px: 1, py: '3px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', transition: 'all .15s',
                  color: granularity === o.key ? 'text.primary' : 'text.secondary',
                  bgcolor: granularity === o.key ? 'background.paper' : 'transparent',
                  border: '0.5px solid',
                  borderColor: granularity === o.key ? 'divider' : 'transparent',
                }}
              >
                {o.label}
              </Box>
            ))}
          </Box>
        </Box>
        <IssueAreaChart data={chartData} granularity={granularity} />
      </Box>
    </Box>
  )
}

function IssueAreaChart({ data, granularity }: { data: { label: string; opened: number; closed: number }[]; granularity: Granularity }) {
  const interval = granularity === 'day' ? 6 : 2
  return (
    <ResponsiveContainer width="100%" height={148}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="issueAreaGradOpened" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#E24B4A" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#E24B4A" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="issueAreaGradClosed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} interval={interval} />
        <YAxis tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <RechartsTooltip
          wrapperStyle={{ outline: 'none' }}
          contentStyle={{
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: 8,
            fontSize: 12,
            padding: '6px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
          formatter={(value: number, name: string) => [value, name === 'opened' ? 'Aperte' : 'Risolte/Chiuse'] as [number, string]}
          labelStyle={{ color: '#888', marginBottom: 2 }}
        />
        <Area type="monotone" dataKey="opened" stroke="#E24B4A" strokeWidth={2} fill="url(#issueAreaGradOpened)" dot={false} activeDot={{ r: 4, fill: '#E24B4A', strokeWidth: 0 }} />
        <Area type="monotone" dataKey="closed" stroke="#16a34a" strokeWidth={2} fill="url(#issueAreaGradClosed)" dot={false} activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}


// ─── Componente principale ────────────────────────────────────────────────────

// prettier-ignore
export default function Issues() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { me } = useAuth()
  const toast = useToast()
  const { exporting, exportCsv } = useExportCsv()

  // ── Grid ──────────────────────────────────────────────────────────────────
  const grid = useServerGrid({
    defaultOrdering: '-created_at',
    allowedOrderingFields: [
      'created_at', 'updated_at', 'due_date', 'closed_at',
      'priority', 'status', 'title', 'servicenow_id', 'opened_at',
      'customer__name', 'category__label', 'assigned_to__last_name',
      'comments_count',
    ],
    columnOrderingMap: {
      customer_name:          'customer__name',
      category_label:         'category__label',
      assigned_to_full_name:  'assigned_to__last_name',
    },
  })

  // ── Filtri extra ──────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = React.useState('')
  const [filterPriority, setFilterPriority] = React.useState('')
  const [filterCustomer, setFilterCustomer] = React.useState<CustomerOption | null>(null)
  const [filterAssigned, setFilterAssigned] = React.useState<UserOption | null>(null)
  const [hideClosedCases, setHideClosedCases] = React.useState(false)
  const [onlyMyIssues, setOnlyMyIssues] = React.useState(false)
  const previousAssignedFilterRef = React.useRef<UserOption | null>(null)
  const activeFilterCount = [
    filterStatus,
    filterPriority,
    filterCustomer,
    onlyMyIssues ? 'only_mine' : filterAssigned,
    hideClosedCases ? 'hide_closed' : '',
  ].filter(Boolean).length

  const resetFilters = () => {
    setFilterStatus('')
    setFilterPriority('')
    setFilterCustomer(null)
    setFilterAssigned(null)
    setHideClosedCases(false)
    setOnlyMyIssues(false)
    previousAssignedFilterRef.current = null
  }

  const allExtraParams = React.useMemo(() => {
    const p: DrfParams = {}
    if (grid.view === 'deleted') p.deleted = 'true'
    if (filterStatus) p.status = filterStatus
    if (filterPriority) p.priority = filterPriority
    if (filterCustomer) p.customer = filterCustomer.id
    if (onlyMyIssues && me?.id) p.assigned_to = me.id
    else if (filterAssigned) p.assigned_to = filterAssigned.id
    if (hideClosedCases) p.hide_closed = true
    return p
  }, [grid.view, filterStatus, filterPriority, filterCustomer, filterAssigned, hideClosedCases, onlyMyIssues, me])
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

  const currentUserOption = React.useMemo<UserOption | null>(() => {
    if (!me?.id) return null
    const existing = users.find((u) => u.id === me.id)
    if (existing) return existing
    const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ').trim()
    return {
      id: me.id,
      username: me.username,
      label: fullName || me.username,
    }
  }, [me, users])

  const handleOnlyMyIssuesChange = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        previousAssignedFilterRef.current = filterAssigned
        setOnlyMyIssues(true)
        setFilterAssigned(currentUserOption)
        return
      }
      setOnlyMyIssues(false)
      setFilterAssigned(previousAssignedFilterRef.current)
      previousAssignedFilterRef.current = null
    },
    [filterAssigned, currentUserOption],
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
        const list: unknown[] =
          Array.isArray(payloadU) ? payloadU : isRecord(payloadU) && Array.isArray(payloadU['results']) ? (payloadU['results'] as unknown[]) : []
        setUsers(
          (list as unknown[]).map((u: unknown) => toUserOption(u)).filter((x: UserOption | null): x is UserOption => Boolean(x)),
        )
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (!onlyMyIssues) return
    setFilterAssigned(currentUserOption)
  }, [onlyMyIssues, currentUserOption])

  // ── Customer autocomplete (filtri) ────────────────────────────────────────
  const [custFilterInput, setCustFilterInput] = React.useState('')
  const [custFilterOptions, setCustFilterOptions] = React.useState<CustomerOption[]>([])

  React.useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/customers/', {
          params: { search: custFilterInput || undefined, page_size: 25 },
        })
        const payloadU: unknown = (r as unknown as { data: unknown }).data
        const list: unknown[] =
          Array.isArray(payloadU) ? payloadU : isRecord(payloadU) && Array.isArray(payloadU['results']) ? (payloadU['results'] as unknown[]) : []
        if (alive)
          setCustFilterOptions(
            list
              .map((c: unknown) => toIdLabel(c, ['display_name', 'name']))
              .filter((x: CustomerOption | null): x is CustomerOption => Boolean(x)),
          )
      } catch {
        /* silent */
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [custFilterInput])

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
        const list: unknown[] =
          Array.isArray(payloadU) ? payloadU : isRecord(payloadU) && Array.isArray(payloadU['results']) ? (payloadU['results'] as unknown[]) : []
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
        const list: unknown[] =
          Array.isArray(payloadU) ? payloadU : isRecord(payloadU) && Array.isArray(payloadU['results']) ? (payloadU['results'] as unknown[]) : []
        setSiteOptions(
          list
            .map((s: unknown) => toIdLabel(s, ['display_name', 'name']))
            .filter((x: { id: number; label: string } | null): x is { id: number; label: string } => Boolean(x)),
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

  const openCreateOnceRef = React.useRef(false)

  React.useEffect(() => {
    const st = loc.state as OpenCreateState | null
    const hasOpenCreate = st?.openCreate || st?.createFromInventory
    if (!hasOpenCreate) {
      openCreateOnceRef.current = false
      return
    }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true

    const cfi = st?.createFromInventory
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
    } else {
      openCreate()
    }

    navigate(loc.pathname + loc.search, { replace: true, state: {} })
  }, [loc, navigate, me?.id, openCreate])

  const openEdit = (row: IssueRow) => {
    setEditIssue(row)
    const custOpt = row.customer
      ? { id: row.customer, label: row.customer_name || String(row.customer) }
      : null
    setForm({
      title: row.title,
      description: row.description,
      servicenow_id: row.servicenow_id,
      customer: custOpt,
      site_id: row.site ?? '',
      category_id: row.category ?? '',
      assigned_to_id: row.assigned_to ?? '',
      priority: row.priority,
      status: row.status,
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
  }

  const openLinkInventoryPicker = async () => {
    if (!editIssue) return

    setLinkInventoryOpen(true)
    setLinkInventoryLoading(true)
    try {
      const r = await api.get('/inventories/', {
        params: { customer: editIssue.customer, page_size: 100, ordering: 'name' },
      })
      const payloadU: unknown = (r as unknown as { data: unknown }).data
      const list: unknown[] =
        Array.isArray(payloadU)
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
  }

  const handleLinkInventory = async (inventoryToLink: InventoryOption | null = selectedInventory) => {
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
    if (!form.customer) errors.customer = 'Il cliente è obbligatorio.'
    if (Object.keys(errors).length) {
      setFormErrors(errors)
      return
    }

    setFormSaving(true)
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      servicenow_id: form.servicenow_id.trim(),
      customer: form.customer!.id,
      site: form.site_id || null,
      category: form.category_id || null,
      assigned_to: form.assigned_to_id || null,
      priority: form.priority,
      status: form.status,
      opened_at: form.opened_at || null,
      due_date: form.due_date || null,
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

  const openDetail = (row: IssueRow, tab = 0) => {
    setDetailIssue(row)
    setDetailTab(tab)
    setNewComment('')
  }

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
    // Cerca prima nelle righe già caricate (via ref, sempre aggiornato), altrimenti fetch diretto
    const existing = rowsRef.current.find((r) => r.id === id)
    if (existing) {
      openDetail(existing)
    } else {
      api.get<IssueRow>(`/issues/${id}/`).then((r) => {
        openDetail(r.data)
      }).catch(() => {})
    }
    // Pulisce il param dall'URL senza reload
    const newSearch = new URLSearchParams(loc.search)
    newSearch.delete('open')
    navigate(
      loc.pathname + (newSearch.toString() ? `?${newSearch.toString()}` : ''),
      { replace: true, state: loc.state }
    )
  }, [loc.search, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!detailIssue) return
    setCommentsLoading(true)
    api
      .get(`/issues/${detailIssue.id}/comments/`)
      .then((r) => setComments(r.data ?? []))
      .catch(() => toast.error('Errore caricamento commenti.'))
      .finally(() => setCommentsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
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
  }, [contextMenu, handleResolveIssue, openEdit, openDetail, openLinkInventoryPicker])


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
      action: (grid.search.trim() || activeFilterCount > 0) ? (
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
      field: 'priority',
      headerName: 'Priorità',
      width: 110,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <IssuePriorityChip priority={row.priority} />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Stato',
      width: 140,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <IssueStatusChip status={row.status} />
        </Box>
      ),
    },
    {
      field: 'id',
      headerName: '#',
      width: 72,
      sortable: true,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', fontFamily: 'ui-monospace, monospace' }}>
            #{row.id}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'title',
      headerName: 'Titolo',
      flex: 1,
      minWidth: 200,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%', minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.85rem' }} noWrap>
            {row.title}
          </Typography>
          {!row.inventory && <UnlinkedInventoryWarningIcon />}
        </Box>
      ),
    },
    {
      field: 'servicenow_id',
      headerName: 'ServiceNow',
      width: 130,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {row.servicenow_id ? (
            <Typography sx={{ fontSize: '0.85rem' }} noWrap>
              {row.servicenow_id}
            </Typography>
          ) : (
            <Typography sx={{ color: '#bbb' }}>—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'customer_name',
      headerName: 'Cliente',
      width: 160,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography sx={{ fontSize: '0.82rem' }} noWrap>
            {row.customer_name}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'category_label',
      headerName: 'Categoria',
      width: 140,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {row.category_label ? (
            <Chip size="small" label={row.category_label} variant="outlined" />
          ) : (
            <Typography sx={{ color: '#bbb' }}>—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'assigned_to_full_name',
      headerName: 'Assegnato a',
      width: 190,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%', minWidth: 0 }}>
          {row.assigned_to_full_name ? (
            <>
              <Avatar
                src={row.assigned_to_avatar || undefined}
                sx={{
                  width: 26,
                  height: 26,
                  fontSize: '0.74rem',
                  bgcolor: 'rgba(15,118,110,0.12)',
                  color: 'teal',
                  border: '1px solid rgba(15,118,110,0.14)',
                  flexShrink: 0,
                }}
              >
                {initialsFromName(row.assigned_to_full_name)}
              </Avatar>
              <Typography sx={{ fontSize: '0.82rem' }} noWrap>
                {row.assigned_to_full_name}
              </Typography>
            </>
          ) : (
            <Chip size="small" variant="outlined" label="Non assegnata" sx={{ height: 24 }} />
          )}
        </Box>
      ),
    },
    {
      field: 'due_date',
      headerName: 'Scadenza',
      width: 110,
      renderCell: ({ row }) => {
        const d = fmtDate(row.due_date)
        const overdue =
          !!d &&
          new Date(row.due_date!) < new Date() &&
          !['resolved', 'closed'].includes(row.status)
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {d ? (
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: overdue ? 'error.main' : 'inherit',
                  fontWeight: overdue ? 700 : 400,
                }}
              >
                {d}
              </Typography>
            ) : (
              <Typography sx={{ color: '#bbb' }}>—</Typography>
            )}
          </Box>
        )
      },
    },
    {
      field: 'comments_count',
      headerName: 'Commenti',
      width: 110,
      renderCell: ({ row }) => (
        <Box
          onClick={(e) => {
            e.stopPropagation()
            openDetail(row, 1)
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            cursor: 'pointer',
          }}
        >
          <Chip
            size="small"
            icon={<ChatBubbleOutlineIcon />}
            label={row.comments_count ?? 0}
            variant={row.comments_count ? 'filled' : 'outlined'}
            color={row.comments_count ? 'primary' : 'default'}
            sx={{ height: 24, '& .MuiChip-icon': { fontSize: 16 } }}
          />
        </Box>
      ),
    },
    {
      field: 'opened_at',
      headerName: 'Data apertura',
      width: 130,
      renderCell: ({ row }) => {
        const d = fmtDate(row.opened_at) || fmtDate(row.created_at.split('T')[0])
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography sx={{ fontSize: '0.82rem' }}>{d}</Typography>
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
            <Typography sx={{ fontSize: '0.82rem' }}>{d || '—'}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'days_open',
      headerName: 'Giorni passati',
      width: 120,
      sortable: false,
      renderCell: ({ row }) => {
        const days = row.days_open ?? 0
        const color = days > 30 ? 'error.main' : days > 14 ? 'warning.main' : 'text.primary'
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color }}>
              {days} {days === 1 ? 'giorno' : 'giorni'}
            </Typography>
          </Box>
        )
      },
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={2}>
      <IssuesSummaryWidget rows={rows} loading={loading} />
      <EntityListCard
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          rightActions: (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <FilterChip
                        compact
                        activeCount={activeFilterCount}
                        onReset={activeFilterCount > 0 ? resetFilters : undefined}
                      >
                        <FormControl size="small" fullWidth>
                          <InputLabel>Stato</InputLabel>
                          <Select
                            value={filterStatus}
                            label="Stato"
                            onChange={(e) => setFilterStatus(e.target.value)}
                          >
                            <MenuItem value="">Tutti</MenuItem>
                            {Object.entries(STATUS_META).map(([k, v]) => (
                              <MenuItem key={k} value={k}>
                                {v.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
              
                        <FormControl size="small" fullWidth>
                          <InputLabel>Priorità</InputLabel>
                          <Select
                            value={filterPriority}
                            label="Priorità"
                            onChange={(e) => setFilterPriority(e.target.value)}
                          >
                            <MenuItem value="">Tutte</MenuItem>
                            {Object.entries(PRIORITY_META).map(([k, v]) => (
                              <MenuItem key={k} value={k}>
                                {v.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
              
                        <Autocomplete
                          size="small"
                          fullWidth
                          value={filterCustomer}
                          inputValue={custFilterInput}
                          onInputChange={(_, v) => setCustFilterInput(v)}
                          onChange={(_, v) => setFilterCustomer(v)}
                          options={custFilterOptions}
                          isOptionEqualToValue={(a, b) => a.id === b.id}
                          renderInput={(p) => <TextField {...p} label="Cliente" />}
                        />
              
                        <Autocomplete
                          size="small"
                          fullWidth
                          value={filterAssigned}
                          onChange={(_, v) => {
                            setFilterAssigned(v)
                            if (onlyMyIssues) {
                              previousAssignedFilterRef.current = v
                              setOnlyMyIssues(false)
                            }
                          }}
                          options={users}
                          disabled={onlyMyIssues}
                          isOptionEqualToValue={(a, b) => a.id === b.id}
                          renderInput={(p) => <TextField {...p} label="Assegnato a" />}
                        />
                      </FilterChip>

              <Tooltip title="Reimposta" arrow>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      grid.reset()
                      resetFilters()
                    }}
                    sx={compactResetButtonSx}
                  >
                    <RestartAltIcon />
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={exporting ? 'Esportazione…' : 'Esporta CSV'} arrow>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={exporting}
                    onClick={() =>
                      exportCsv({
                        url: '/issues/',
                        params: {
                          search: grid.q,
                          ordering: grid.ordering,
                        },
                        filename: 'issues',
                        columns: [
                          { label: 'ID', getValue: (r: IssueRow) => String(r.id) },
                          { label: 'Titolo', getValue: (r: IssueRow) => r.title },
                          { label: 'Cliente', getValue: (r: IssueRow) => r.customer_name },
                          { label: 'Priorità', getValue: (r: IssueRow) => r.priority_label },
                          { label: 'Stato', getValue: (r: IssueRow) => r.status_label },
                          { label: 'Assegnato a', getValue: (r: IssueRow) => r.assigned_to_full_name || r.assigned_to_username },
                          { label: 'Aperta il', getValue: (r: IssueRow) => r.opened_at },
                          { label: 'Chiusa il', getValue: (r: IssueRow) => r.closed_at },
                          { label: 'ServiceNow', getValue: (r: IssueRow) => r.servicenow_id },
                        ],
                      })
                    }
                    sx={compactExportButtonSx}
                  >
                    <FileDownloadOutlinedIcon />
                  </Button>
                </span>
              </Tooltip>

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={hideClosedCases}
                    onChange={(e) => setHideClosedCases(e.target.checked)}
                  />
                }
                label="Nascondi casi chiusi"
                sx={{
                  ml: 0,
                  mr: 0,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                  },
                }}
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={onlyMyIssues}
                    onChange={(e) => handleOnlyMyIssuesChange(e.target.checked)}
                    disabled={!me}
                  />
                }
                label="Solo mie issues"
                sx={{
                  ml: 0,
                  mr: 0,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                  },
                }}
              />
            </Stack>
          ),
          createButton: (
            <Tooltip title="Nuova issue" arrow>
              <span>
                <Button size="small" variant="contained" onClick={openCreate} sx={compactCreateButtonSx}>
                  <AddIcon />
                </Button>
              </span>
            </Tooltip>
          ),
        }}
        grid={{
          pageKey: 'issues',
          username: me?.username,
          rows,
          emptyState,
          rowCount,
          loading,
          columns,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => {
            const row = rows.find((r) => r.id === id)
            if (row) openDetail(row, 0)
          },
          onRowContextMenu: handleRowContextMenu,
          sx: {
            cursor: 'pointer',
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
            '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
          },
        }}
      >
      </EntityListCard>
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
        users={users}
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
              <Alert severity="info">
                Nessun inventory trovato per questo cliente.
              </Alert>
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
      <IssueDrawer
        open={!!detailIssue}
        issue={detailIssue}
        detailTab={detailTab}
        comments={comments}
        commentsLoading={commentsLoading}
        newComment={newComment}
        sendingComment={sendingComment}
        onClose={() => setDetailIssue(null)}
        onEdit={() => {
          if (!detailIssue) return
          setDetailIssue(null)
          openEdit(detailIssue)
        }}
        onDelete={() => {
          if (!detailIssue) return
          setDeleteTarget(detailIssue)
          setDetailIssue(null)
        }}
        onDetailTabChange={setDetailTab}
        onNewCommentChange={setNewComment}
        onSendComment={handleSendComment}
      />

      {/* ── Context menu ── */}
      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
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

function initialsFromName(name?: string | null) {
  const raw = (name || '').trim()
  if (!raw) return '—'
  const parts = raw.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || raw.slice(0, 2).toUpperCase()
}

