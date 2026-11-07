import { dShort } from '../contracts/contractModel'
import type { TodoRow } from '../../pages/maintenanceTypes'

export type DueState = 'overdue' | 'next30' | 'later'
export type Result = 'ok' | 'ko' | 'partial' | 'not_planned'

/** Risposta di /maintenance-plans/todo-stats/. */
export type TodoStats = {
  total: number
  overdue: number
  next30: number
  later: number
  override: number
  first_next30: string | null
  next30_customers: number
  coverage: { done: number; total: number }
  overdue_by_customer: { customer_id: number; customer_name: string; count: number }[]
  next_visits: { customer_id: number; customer_name: string; site_id: number | null; site_name: string | null; count: number; first_due: string }[]
  months: { month: string; overdue: number; next30: number; later: number }[]
  events_this_month: number
  follow_up: number
  customers: { id: number; name: string }[]
  plans: { id: number; title: string }[]
  types: string[]
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => isoOf(new Date())
export const parseIso = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }

export function dueStateOf(due: string, today = todayIso()): DueState {
  if (due < today) return 'overdue'
  const in30 = new Date(parseIso(today)); in30.setDate(in30.getDate() + 30)
  return due <= isoOf(in30) ? 'next30' : 'later'
}

export const RESULT_LABEL: Record<Result, string> = { ok: 'OK', partial: 'Parziale', ko: 'KO', not_planned: 'Non prevista' }

const UNIT: Record<string, [string, string]> = { days: ['giorno', 'giorni'], weeks: ['settimana', 'settimane'], months: ['mese', 'mesi'], years: ['anno', 'anni'] }
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

type Sched = Pick<TodoRow, 'schedule_type' | 'interval_value' | 'interval_unit' | 'fixed_month' | 'fixed_day'>

/** "Ogni 6 mesi", "Ogni anno", "Ogni anno il 15 marzo". */
export function scheduleText(r: Sched) {
  if (r.schedule_type === 'fixed_date' && r.fixed_month && r.fixed_day) return `Ogni anno il ${r.fixed_day} ${MONTHS[r.fixed_month - 1]}`
  const n = r.interval_value ?? 1
  const u = UNIT[r.interval_unit ?? ''] ?? ['ciclo', 'cicli']
  if (n === 1) return u[0] === 'settimana' ? 'Ogni settimana' : `Ogni ${u[0]}`
  return `Ogni ${n} ${u[1]}`
}

/** Prossima scadenza del piano dopo quella indicata (stessa regola del backend). */
export function nextDueAfter(r: Sched, due: string) {
  const d = parseIso(due)
  if (r.schedule_type === 'fixed_date' && r.fixed_month && r.fixed_day) return isoOf(new Date(d.getFullYear() + 1, r.fixed_month - 1, r.fixed_day))
  const n = r.interval_value ?? 1
  switch (r.interval_unit) {
    case 'days': d.setDate(d.getDate() + n); break
    case 'weeks': d.setDate(d.getDate() + 7 * n); break
    case 'months': d.setMonth(d.getMonth() + n); break
    default: d.setFullYear(d.getFullYear() + n)
  }
  return isoOf(d)
}

export const rowKey = (r: Pick<TodoRow, 'plan_id' | 'inventory_id'>) => `${r.plan_id}-${r.inventory_id}`

export const overrideTipOf = (override?: string | null, planDue?: string | null) =>
  override ? `Scadenza modificata per questo inventario${planDue ? ` · il piano dice ${dShort(planDue)}` : ''}` : null

export type PlanState = 'run' | 'done' | 'arch'
/** In corso · Completato (tutto fatto nel ciclo) · Archiviato (scadenza prima dell'anno corrente o non attivo). */
export function planStateOf(p: { next_due_date?: string | null; is_active?: boolean; covered_count?: number | null; todo_count?: number | null }): PlanState {
  const yearStart = `${new Date().getFullYear()}-01-01`
  if (!p.is_active || (p.next_due_date && p.next_due_date < yearStart)) return 'arch'
  return (p.covered_count ?? 0) > 0 && !p.todo_count ? 'done' : 'run'
}
