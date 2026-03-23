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
import type { PlanRow } from '../pages/maintenanceTypes'

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
  overdue:  { label: 'Scaduto',  color: '#d32f2f', chipColor: 'error',   barColor: '#d32f2f' },
  critical: { label: 'Urgente',  color: '#ed6c02', chipColor: 'warning', barColor: '#ed6c02' },
  soon:     { label: 'In arrivo', color: '#0288d1', chipColor: 'info',    barColor: '#0288d1' },
  ok:       { label: 'Ok',        color: '#9e9e9e', chipColor: 'default', barColor: '#9e9e9e' },
}

// ─── Grouped plan row ─────────────────────────────────────────────────────────

type GroupedCustomer = {
  customerId: number
  customerName: string
  plans: (PlanRow & { days: number; urgency: Urgency })[]
}

function groupByCustomer(plans: PlanRow[]): GroupedCustomer[] {
  const map = new Map<number, GroupedCustomer>()

  for (const plan of plans) {
    const days = daysUntil(plan.next_due_date)
    const urgency = getUrgency(days)
    const entry = map.get(plan.customer)
    if (entry) {
      entry.plans.push({ ...plan, days, urgency })
    } else {
      map.set(plan.customer, {
        customerId: plan.customer,
        customerName: plan.customer_name ?? `Cliente #${plan.customer}`,
        plans: [{ ...plan, days, urgency }],
      })
    }
  }

  // Sort groups: customers with most urgent plans first
  return Array.from(map.values()).sort((a, b) => {
    const urgencyRank = (g: GroupedCustomer) => Math.min(...g.plans.map(p => p.days))
    return urgencyRank(a) - urgencyRank(b)
  })
}

// ─── Summary tab type ─────────────────────────────────────────────────────────

type Tab = 'overdue' | 'next30'

// ─── Component ───────────────────────────────────────────────────────────────

export default function MaintenanceAlertsCard() {
  const navigate = useNavigate()
  const [tab, setTab] = React.useState<Tab>('overdue')
  const [plans, setPlans] = React.useState<PlanRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [overdueCount, setOverdueCount] = React.useState(0)
  const [next30Count, setNext30Count] = React.useState(0)

  // Load both counts on mount (for tab badges)
  React.useEffect(() => {
    Promise.all([
      api.get<{ count: number }>('/maintenance-plans/', {
        params: { due: 'overdue', is_active: 'true', page_size: 1 },
      }),
      api.get<{ count: number }>('/maintenance-plans/', {
        params: { due: 'next30', is_active: 'true', page_size: 1 },
      }),
    ]).then(([od, n30]) => {
      setOverdueCount(od.data.count)
      setNext30Count(n30.data.count)
    }).catch(() => {})
  }, [])

  // Load plans for current tab
  React.useEffect(() => {
    setLoading(true)
    api.get<{ results: PlanRow[] }>('/maintenance-plans/', {
      params: {
        due: tab,
        is_active: 'true',
        ordering: 'next_due_date,title',
        page_size: 20,
      },
    }).then(r => {
      setPlans(r.data.results)
    }).catch(() => {
      setPlans([])
    }).finally(() => setLoading(false))
  }, [tab])

  const groups = React.useMemo(() => groupByCustomer(plans), [plans])

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
          { key: 'overdue' as Tab, label: 'Scaduti', icon: <WarningAmberRoundedIcon sx={{ fontSize: 13 }} />, count: overdueCount },
          { key: 'next30' as Tab, label: 'Prossimi 30gg', icon: <EventOutlinedIcon sx={{ fontSize: 13 }} />, count: next30Count },
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
              <Box
                sx={{
                  minWidth: 18, height: 18, px: 0.5,
                  borderRadius: '999px',
                  bgcolor: tab === key ? 'primary.main' : 'action.selected',
                  color: tab === key ? 'primary.contrastText' : 'text.secondary',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700, lineHeight: 1,
                }}
              >
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
                  {group.plans.length} {group.plans.length === 1 ? 'piano' : 'piani'}
                </Typography>
              </Box>

              {/* Plans */}
              <Stack divider={<Divider />}>
                {group.plans.map(plan => {
                  const urg = URGENCY[plan.urgency]
                  const daysLabel = plan.days < 0
                    ? `${Math.abs(plan.days)}gg fa`
                    : plan.days === 0
                      ? 'oggi'
                      : `tra ${plan.days}gg`

                  return (
                    <Stack
                      key={plan.id}
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{
                        px: 2, py: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background 0.15s',
                      }}
                      onClick={() => navigate('/maintenance/plans')}
                    >
                      {/* Barra urgenza */}
                      <Box sx={{
                        width: 3, height: 32, borderRadius: '999px',
                        bgcolor: urg.barColor, flexShrink: 0,
                      }} />

                      {/* Testo */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ fontSize: '0.82rem' }}
                        >
                          {plan.title}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.2 }}>
                          {plan.inventory_type_labels && plan.inventory_type_labels.length > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem', maxWidth: 120 }}>
                                {plan.inventory_type_labels.join(', ')}
                              </Typography>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                            </>
                          )}
                          <Tooltip title={formatDate(plan.next_due_date)} placement="top">
                            <Typography variant="caption" sx={{ fontSize: '0.72rem', color: urg.color, fontWeight: 600 }}>
                              {daysLabel}
                            </Typography>
                          </Tooltip>
                          {plan.covered_count != null && plan.covered_count > 0 && (
                            <>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                                {plan.covered_count} inv.
                              </Typography>
                            </>
                          )}
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
        onClick={() => navigate('/maintenance/plans')}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {totalCount > 0
            ? `Vedi tutti i ${totalCount} piani →`
            : 'Vai ai piani di manutenzione →'}
        </Typography>
      </Box>
    </Card>
  )
}
