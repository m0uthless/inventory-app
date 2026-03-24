import * as React from 'react'
import {
  Box, Card, Chip, Divider, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import type { TodoRow } from '../pages/maintenanceTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

// ─── Urgency config ───────────────────────────────────────────────────────────

type Urgency = 'overdue' | 'critical' | 'soon' | 'ok'

function getUrgency(days: number): Urgency {
  if (days < 0) return 'overdue'
  if (days <= 7) return 'critical'
  if (days <= 30) return 'soon'
  return 'ok'
}

const URGENCY: Record<Urgency, { label: string; color: string; chipColor: 'error' | 'warning' | 'info' | 'default'; barColor: string }> = {
  overdue:  { label: 'Scaduto',   color: '#d32f2f', chipColor: 'error',   barColor: '#d32f2f' },
  critical: { label: 'Urgente',   color: '#ed6c02', chipColor: 'warning', barColor: '#ed6c02' },
  soon:     { label: 'In arrivo', color: '#0288d1', chipColor: 'info',    barColor: '#0288d1' },
  ok:       { label: 'Ok',        color: '#9e9e9e', chipColor: 'default', barColor: '#9e9e9e' },
}

// ─── Grouped by customer ──────────────────────────────────────────────────────

type EnrichedRow = TodoRow & { days: number; urgency: Urgency }

type GroupedCustomer = {
  customerId: number
  customerName: string
  items: EnrichedRow[]
}

function groupByCustomer(rows: TodoRow[]): GroupedCustomer[] {
  const map = new Map<number, GroupedCustomer>()
  for (const row of rows) {
    const days    = daysUntil(row.next_due_date)
    const urgency = getUrgency(days)
    const entry   = map.get(row.customer_id)
    if (entry) {
      entry.items.push({ ...row, days, urgency })
    } else {
      map.set(row.customer_id, {
        customerId:   row.customer_id,
        customerName: row.customer_name,
        items: [{ ...row, days, urgency }],
      })
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    Math.min(...a.items.map(i => i.days)) - Math.min(...b.items.map(i => i.days))
  )
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'overdue' | 'next30'

// ─── Component ───────────────────────────────────────────────────────────────

export default function MaintenanceAlertsCard() {
  const navigate = useNavigate()
  const { me }   = useAuth()
  const [tab, setTab]             = React.useState<Tab>('overdue')
  const [rows, setRows]           = React.useState<TodoRow[]>([])
  const [loading, setLoading]     = React.useState(true)
  const [overdueCount, setOverdueCount] = React.useState(0)
  const [next30Count,  setNext30Count]  = React.useState(0)

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), [])
  const in30  = React.useMemo(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), [])

  // Badge counts — chiamata leggera con page_size=1
  React.useEffect(() => {
    if (!me) return
    Promise.all([
      api.get<{ count: number }>('/maintenance-plans/todo/', {
        params: { due_before: today, page_size: 1 },
      }),
      api.get<{ count: number }>('/maintenance-plans/todo/', {
        params: { due_from: today, due_to: in30, page_size: 1 },
      }),
    ]).then(([od, n30]) => {
      setOverdueCount(od.data.count ?? 0)
      setNext30Count(n30.data.count ?? 0)
    }).catch(() => {})
  }, [me, today, in30])

  // Righe per il tab corrente
  React.useEffect(() => {
    if (!me) return
    setLoading(true)
    const params =
      tab === 'overdue'
        ? { due_before: today, ordering: 'next_due_date', page_size: 50 }
        : { due_from: today, due_to: in30, ordering: 'next_due_date', page_size: 50 }

    api.get<{ results: TodoRow[] }>('/maintenance-plans/todo/', { params })
      .then(r => setRows(r.data.results ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [me, tab, today, in30])

  const groups     = React.useMemo(() => groupByCustomer(rows), [rows])
  const totalCount = tab === 'overdue' ? overdueCount : next30Count

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <BuildOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>Manutenzioni</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          {overdueCount > 0 && (
            <Chip
              size="small"
              icon={<WarningAmberRoundedIcon sx={{ fontSize: '0.75rem !important' }} />}
              label={`${overdueCount} scadut${overdueCount === 1 ? 'o' : 'i'}`}
              color="error"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
            />
          )}
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
        {([
          { key: 'overdue' as Tab, label: 'Scaduti',       icon: <WarningAmberRoundedIcon sx={{ fontSize: 13 }} />, count: overdueCount },
          { key: 'next30'  as Tab, label: 'Prossimi 30gg', icon: <EventOutlinedIcon       sx={{ fontSize: 13 }} />, count: next30Count  },
        ] as const).map(({ key, label, icon, count }) => (
          <Box
            key={key}
            onClick={() => setTab(key)}
            sx={{
              flex: 1, px: 1.5, py: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              cursor: 'pointer',
              borderBottom: tab === key ? '2px solid' : '2px solid transparent',
              borderColor: tab === key ? 'primary.main' : 'transparent',
              color: tab === key ? 'primary.main' : 'text.secondary',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {icon}
            <Typography variant="caption" fontWeight={tab === key ? 700 : 400} sx={{ fontSize: '0.75rem' }}>
              {label}
            </Typography>
            {count > 0 && (
              <Box sx={{
                minWidth: 18, height: 18, px: 0.5,
                borderRadius: '999px',
                bgcolor: tab === key ? 'primary.main' : 'action.selected',
                color: tab === key ? 'primary.contrastText' : 'text.secondary',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700, lineHeight: 1,
              }}>
                {count > 99 ? '99+' : count}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Stack spacing={0} divider={<Divider />}>
            {[1, 2, 3].map(n => (
              <Box key={n} sx={{ px: 2, py: 1.25 }}>
                <Skeleton variant="text" width="40%" height={14} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width="70%" height={12} />
              </Box>
            ))}
          </Stack>
        ) : groups.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 28, color: 'success.main', mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary" display="block">
              {tab === 'overdue'
                ? 'Nessuna manutenzione scaduta'
                : 'Nessuna manutenzione nei prossimi 30 giorni'}
            </Typography>
          </Box>
        ) : (
          groups.map((group, gi) => (
            <Box key={group.customerId}>
              {/* Customer header */}
              <Box sx={{
                px: 2, py: 0.75,
                bgcolor: 'action.hover',
                borderBottom: '1px solid', borderColor: 'divider',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {group.customerName}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                  {group.items.length} {group.items.length === 1 ? 'inventory' : 'inventory'}
                </Typography>
              </Box>

              {/* Inventory rows */}
              <Stack divider={<Divider />}>
                {group.items.map(item => {
                  const urg      = URGENCY[item.urgency]
                  const daysLabel = item.days < 0
                    ? `${Math.abs(item.days)}gg fa`
                    : item.days === 0 ? 'oggi'
                    : `tra ${item.days}gg`

                  return (
                    <Stack
                      key={`${item.plan_id}-${item.inventory_id}`}
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{
                        px: 2, py: 0.9,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background 0.15s',
                      }}
                      onClick={() => navigate('/maintenance')}
                    >
                      {/* Barra urgenza */}
                      <Box sx={{ width: 3, height: 32, borderRadius: '999px', bgcolor: urg.barColor, flexShrink: 0 }} />

                      {/* Testo */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.82rem' }}>
                          {item.inventory_name}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.15 }}>
                          {item.type_label && (
                            <>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem', maxWidth: 90 }}>
                                {item.type_label}
                              </Typography>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                            </>
                          )}
                          {item.site_name && (
                            <>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem', maxWidth: 90 }}>
                                {item.site_name}
                              </Typography>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                            </>
                          )}
                          <Tooltip title={formatDate(item.next_due_date)} placement="top">
                            <Typography variant="caption" sx={{ fontSize: '0.72rem', color: urg.color, fontWeight: 600, cursor: 'default' }}>
                              {daysLabel}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem', maxWidth: 100 }}>
                            {item.plan_title}
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Chip urgenza */}
                      <Chip
                        size="small"
                        label={urg.label}
                        color={urg.chipColor}
                        variant={urg.chipColor === 'default' ? 'outlined' : 'filled'}
                        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}
                      />
                    </Stack>
                  )
                })}
              </Stack>

              {gi < groups.length - 1 && <Divider />}
            </Box>
          ))
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2, py: 1,
          borderTop: '1px solid', borderColor: 'divider',
          textAlign: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => navigate('/maintenance')}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {totalCount > 0
            ? `Vedi tutti i ${totalCount} inventory →`
            : 'Vai alle scadenze manutenzione →'}
        </Typography>
      </Box>
    </Card>
  )
}
