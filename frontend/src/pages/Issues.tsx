import * as React from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import { useDataGridZebraSx } from '../theme/AppThemeProvider'

import {
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
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
import { useKpiAccents } from '../theme/AppThemeProvider'
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
import IssueDrawer from '../features/issues/IssueDrawer'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { isRecord } from '@shared/utils/guards'
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
  const dotColor = m.color === 'default' ? 'text.disabled' : `${m.color}.main`
  return (
    <Tooltip title={m.label}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
    </Tooltip>
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

// Raggruppamento "Aperte"/"Chiuse" già usato in /issues/summary/ e nel grafico
// andamento: risolta + chiusa contano entrambe come "chiuse" agli occhi
// dell'utente (solo "chiusa" è lo stato terminale/immutabile).
function isClosedIssueRow(row: Pick<IssueRow, 'status'>) {
  return row.status === 'resolved' || row.status === 'closed'
}

function StatusViewChipBar({
  value,
  onChange,
}: {
  value: 'all' | 'open' | 'closed'
  onChange: (v: 'all' | 'open' | 'closed') => void
}) {
  const options: { key: 'all' | 'open' | 'closed'; label: string }[] = [
    { key: 'open', label: 'Aperte' },
    { key: 'closed', label: 'Chiuse' },
    { key: 'all', label: 'Tutte' },
  ]
  return (
    <Stack direction="row" spacing={1}>
      {options.map((o) => {
        const selected = value === o.key
        return (
          <Chip
            key={o.key}
            size="small"
            label={o.label}
            clickable
            onClick={() => onChange(o.key)}
            color={selected ? (o.key === 'open' ? 'error' : o.key === 'closed' ? 'default' : 'primary') : 'default'}
            variant={selected ? 'filled' : 'outlined'}
          />
        )
      })}
    </Stack>
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
  const kpiAccents = useKpiAccents()
  const toast = useToast()
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
    }).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [granularity, toast])

  const open     = rows.filter((r) => r.status === 'open').length
  const inProg   = rows.filter((r) => r.status === 'in_progress').length
  const critical = rows.filter((r) => r.priority === 'critical' && (r.status === 'open' || r.status === 'in_progress')).length

  const cardSx = { bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 2, p: '1rem 1.25rem', opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }

  const avgLabel = avgDaysGlobal != null ? `${avgDaysGlobal.toFixed(1)} gg` : '—'

  const kpis = [
    { label: 'Aperte',          value: open,       sub: `su ${rows.length} totali`,    accent: theme.palette.error.main },
    { label: 'In lavorazione',  value: inProg,     sub: 'in corso',                    accent: theme.palette.warning.main },
    { label: 'Critiche aperte', value: critical,   sub: critical > 0 ? 'richiedono attenzione' : 'nessuna criticità', accent: critical > 0 ? theme.palette.error.dark : theme.palette.success.main },
    { label: 'Tempo medio',     value: avgLabel,   sub: 'su tutte le issue chiuse',    accent: kpiAccents.teal1 },
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
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.error.main, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>Aperte</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.success.main, flexShrink: 0 }} />
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

// NOTA (color refactor 0.9.x): stile del grafico Recharts — eccezione
// tecnica deliberata (non theme-aware, non duplicata altrove nell'app).
// I colori "di significato" (aperte/chiuse) restano su theme.palette
// (error/success), qui restano solo i grigi neutri di assi/griglia/tooltip,
// centralizzati in un'unica costante per evitare 7 letterali sparsi nel file.
const CHART_NEUTRAL = {
  grid: 'rgba(0,0,0,0.06)',
  axisLabel: '#888',
  tooltipBg: '#fff',
  tooltipBorder: 'rgba(0,0,0,0.12)',
  tooltipShadow: 'rgba(0,0,0,0.08)',
} as const

function IssueAreaChart({ data, granularity }: { data: { label: string; opened: number; closed: number }[]; granularity: Granularity }) {
  const theme = useTheme()
  const openedColor = theme.palette.error.main
  const closedColor = theme.palette.success.main
  const interval = granularity === 'day' ? 6 : 2
  return (
    <ResponsiveContainer width="100%" height={148}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="issueAreaGradOpened" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={openedColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={openedColor} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="issueAreaGradClosed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={closedColor} stopOpacity={0.22} />
            <stop offset="95%" stopColor={closedColor} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEUTRAL.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_NEUTRAL.axisLabel }} tickLine={false} axisLine={false} interval={interval} />
        <YAxis tick={{ fontSize: 10, fill: CHART_NEUTRAL.axisLabel }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <RechartsTooltip
          wrapperStyle={{ outline: 'none' }}
          contentStyle={{
            background: CHART_NEUTRAL.tooltipBg,
            border: `0.5px solid ${CHART_NEUTRAL.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
            padding: '6px 10px',
            boxShadow: `0 2px 8px ${CHART_NEUTRAL.tooltipShadow}`,
          }}
          formatter={(value: number, name: string) => [value, name === 'opened' ? 'Aperte' : 'Risolte/Chiuse'] as [number, string]}
          labelStyle={{ color: CHART_NEUTRAL.axisLabel, marginBottom: 2 }}
        />
        <Area type="monotone" dataKey="opened" stroke={openedColor} strokeWidth={2} fill="url(#issueAreaGradOpened)" dot={false} activeDot={{ r: 4, fill: openedColor, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="closed" stroke={closedColor} strokeWidth={2} fill="url(#issueAreaGradClosed)" dot={false} activeDot={{ r: 4, fill: closedColor, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}


// ─── Componente principale ────────────────────────────────────────────────────

// prettier-ignore
export default function Issues() {
  const zebraSx = useDataGridZebraSx()
  const loc = useLocation()
  const navigate = useNavigate()
  const { me } = useAuth()
  const toast = useToast()

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

  const handleSortModelChange = React.useCallback((model: GridSortModel) => {
    const m = model[0]
    if (m?.field === 'days_open') {
      setDaysOpenSortDir(m.sort ?? null)
      grid.onSortModelChange(m.sort ? [{ field: 'opened_at', sort: m.sort === 'asc' ? 'desc' : 'asc' }] : [])
      return
    }
    setDaysOpenSortDir(null)
    grid.onSortModelChange(model)
  }, [grid])

  const displaySortModel: GridSortModel = daysOpenSortDir
    ? [{ field: 'days_open', sort: daysOpenSortDir }]
    : grid.sortModel

  // ── Filtri extra ──────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = React.useState('')
  const [filterPriority, setFilterPriority] = React.useState('')
  const [filterCustomer, setFilterCustomer] = React.useState<CustomerOption | null>(null)
  const [filterAssigned, setFilterAssigned] = React.useState<UserOption | null>(null)
  const [hideClosedCases, setHideClosedCases] = React.useState(false)
  const [onlyMyIssues, setOnlyMyIssues] = React.useState(false)
  const [statusView, setStatusView] = React.useState<'all' | 'open' | 'closed'>('open')
  const previousAssignedFilterRef = React.useRef<UserOption | null>(null)
  const activeFilterCount = [
    filterStatus,
    filterPriority,
    filterCustomer,
    onlyMyIssues ? 'only_mine' : filterAssigned,
    hideClosedCases ? 'hide_closed' : '',
    statusView !== 'open' ? statusView : '',
  ].filter(Boolean).length

  const resetFilters = () => {
    setFilterStatus('')
    setFilterPriority('')
    setFilterCustomer(null)
    setFilterAssigned(null)
    setHideClosedCases(false)
    setOnlyMyIssues(false)
    setStatusView('open')
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
    if (statusView === 'open') p.hide_closed = true
    if (statusView === 'closed') p.only_closed = true
    return p
  }, [grid.view, filterStatus, filterPriority, filterCustomer, filterAssigned, hideClosedCases, onlyMyIssues, statusView, me])
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

  // Click sul numero ServiceNow di un'Issue → apre il drawer del caso
  // corrispondente nella pagina ServiceNow Case (solo quello: non tocca
  // il drawer dell'Issue, il click viene fermato con stopPropagation).
  const [resolvingServiceNowId, setResolvingServiceNowId] = React.useState<string | null>(null)

  const openServiceNowCaseDrawer = React.useCallback(async (number: string) => {
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
  }, [navigate, toast])

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
  }, [editIssue, toast])

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
    if (form.useCustomerPlaceholder) {
      if (!form.customerPlaceholder.trim()) errors.customer_placeholder = 'Il nome del cliente è obbligatorio.'
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
    navigate(
      loc.pathname + (newSearch.toString() ? `?${newSearch.toString()}` : ''),
      { replace: true, state: loc.state },
    )
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
      field: 'opened_at',
      headerName: 'Data apertura',
      width: 130,
      renderCell: ({ row }) => {
        const d = fmtDate(row.opened_at) || fmtDate(row.created_at.split('T')[0])
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2">{d}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'priority',
      headerName: 'Priorità',
      width: 64,
      sortable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <IssuePriorityChip priority={row.priority} />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Stato',
      width: 220,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%' }}>
          <IssueStatusChip status={row.status} />
          {row.status === 'waiting' && row.waiting_reason_label ? (
            <Chip size="small" label={row.waiting_reason_label} variant="outlined" />
          ) : null}
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
          <Typography variant="body2" noWrap>
            {row.title}
          </Typography>
          {!row.inventory && <UnlinkedInventoryWarningIcon />}
        </Box>
      ),
    },
    {
      field: 'servicenow_id',
      headerName: 'ServiceNow',
      width: 150,
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
                  fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem',
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
            <Chip size="small" variant="outlined" label="Non collegato" sx={{ color: 'text.disabled', borderColor: 'divider' }} />
          )}
        </Box>
      ),
    },
    {
      field: 'customer_name',
      headerName: 'Cliente',
      width: 160,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%', minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {row.customer_name}
          </Typography>
          {row.is_customer_placeholder ? (
            <Tooltip title="Cliente non in Site Repository">
              <InfoOutlinedIcon sx={{ color: 'text.disabled', fontSize: 16, flexShrink: 0 }} />
            </Tooltip>
          ) : null}
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
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'assigned_to_full_name',
      headerName: 'Assegnato a',
      width: 190,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          {row.assigned_to_full_name ? (
            <Typography variant="body2" noWrap>
              {row.assigned_to_full_name}
            </Typography>
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
                variant="body2"
                sx={{
                  color: overdue ? 'error.main' : 'inherit',
                  fontWeight: overdue ? 700 : 400,
                }}
              >
                {d}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
            )}
          </Box>
        )
      },
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
            <Tooltip title={count ? `${count} ${count === 1 ? 'commento' : 'commenti'}` : 'Nessun commento'}>
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
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 15, minWidth: 15, top: 1, right: 1 } }}
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
    <Stack spacing={2} sx={{ height: '100%' }}>
      <IssuesSummaryWidget rows={rows} loading={loading} />
      <EntityListCard
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          alignRightActions: true,
          rightActions: (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
              Nuova issue
            </Button>
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
          sortModel: displaySortModel,
          onSortModelChange: handleSortModelChange,
          onRowClick: (id) => {
            const row = rows.find((r) => r.id === id)
            if (row) openDetail(row, 0)
          },
          onRowContextMenu: handleRowContextMenu,
          getRowClassName: (row) => (isClosedIssueRow(row) ? 'row-closed-issue' : undefined),
          sx: {
            cursor: 'pointer',
            ...zebraSx,
            '& .row-closed-issue': { opacity: 0.5 },
            '& .row-closed-issue:hover': { opacity: 0.8 },
          },
        }}
      >
        <StatusViewChipBar value={statusView} onChange={setStatusView} />
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


