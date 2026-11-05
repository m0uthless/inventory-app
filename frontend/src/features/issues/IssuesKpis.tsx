import * as React from 'react'
import { api } from '@shared/api/client'
import { KpiFlag, KpiStrip, KpiTile, SegmentBar } from '../../ui/campo'

type Summary = {
  open_count: number
  in_progress_count: number
  waiting_count: number
  resolved_count: number
  closed_count: number
  active_count: number
  avg_days_to_close: number | null
  chart_buckets: { date: string | null; count: number }[]
  closed_buckets: { date: string | null; count: number }[]
}

export type IssueCounts = {
  overdue: number
  dueToday: number
  dueWeek: number
  mine: number
  byPriority: Record<'critical' | 'high' | 'medium' | 'low', number>
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
/** Data limite della vista "Scadute": scadenza fino a ieri, issue non chiuse. */
// eslint-disable-next-line react-refresh/only-export-components
export const overdueBefore = () => addDays(-1)

const fmtDay = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })

/** Ultimi 30 giorni, uno per giorno (i giorni senza eventi valgono 0). */
function daily(buckets: Summary['chart_buckets']) {
  const map = new Map(buckets.filter((b) => b.date).map((b) => [b.date!.slice(0, 10), b.count]))
  const out: { label: string; value: number }[] = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - 29)
  for (let i = 0; i < 30; i++) {
    const k = iso(d)
    out.push({ label: fmtDay(k), value: map.get(k) ?? 0 })
    d.setDate(d.getDate() + 1)
  }
  return out
}

async function count(params: Record<string, unknown>) {
  const r = await api.get('/issues/', { params: { ...params, page_size: 1 } })
  return Number((r.data as { count?: number })?.count ?? 0)
}

/** Conteggi per indicatori e schede, calcolati con l'elenco filtrato (nessuna API nuova). */
// eslint-disable-next-line react-refresh/only-export-components
export function useIssueCounts(reloadKey: number, meId?: number) {
  const [c, setC] = React.useState<IssueCounts | null>(null)
  React.useEffect(() => {
    let alive = true
    const active = { hide_closed: true }
    Promise.all([
      count({ ...active, due_before: overdueBefore() }),
      count({ ...active, due_after: addDays(0), due_before: addDays(0) }),
      count({ ...active, due_after: addDays(1), due_before: addDays(7) }),
      meId ? count({ ...active, assigned_to: meId }) : Promise.resolve(0),
      count({ ...active, priority: 'critical' }),
      count({ ...active, priority: 'high' }),
      count({ ...active, priority: 'medium' }),
      count({ ...active, priority: 'low' }),
    ]).then(([overdue, dueToday, dueWeek, mine, critical, high, medium, low]) => {
      if (alive) setC({ overdue, dueToday, dueWeek, mine, byPriority: { critical, high, medium, low } })
    }).catch(() => {})
    return () => { alive = false }
  }, [reloadKey, meId])
  return c
}

type Props = {
  reloadKey: number
  counts: IssueCounts | null
  view: string
  priority: string[]
  onView: (key: string) => void
  onPriorityPick: (p: string) => void
}

/** Fascia indicatori della pagina Issue (DESIGN.md › KPI strip), dati reali. */
export default function IssuesKpis({ reloadKey, counts, view, priority, onView, onPriorityPick }: Props) {
  const [s, setS] = React.useState<Summary | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<Summary>('/issues/summary/').then((r) => { if (alive) setS(r.data) }).catch(() => {})
    return () => { alive = false }
  }, [reloadKey])

  const opened = s ? daily(s.chart_buckets) : []
  const closed = s ? daily(s.closed_buckets) : []
  const opened7 = opened.slice(-7).reduce((a, b) => a + b.value, 0)
  const closed30 = closed.reduce((a, b) => a + b.value, 0)
  const dash = '—'
  const prio = counts ? [
    { key: 'critical', label: 'Critica', value: counts.byPriority.critical, display: String(counts.byPriority.critical) },
    { key: 'high', label: 'Alta', value: counts.byPriority.high, display: String(counts.byPriority.high) },
    { key: 'medium', label: 'Media', value: counts.byPriority.medium, display: String(counts.byPriority.medium) },
    { key: 'low', label: 'Bassa', value: counts.byPriority.low, display: String(counts.byPriority.low) },
  ] : []
  const dimmed = priority.length ? new Set(prio.map((p) => p.key).filter((k) => !priority.includes(k))) : undefined

  return (
    <KpiStrip label="Indicatori issue">
      <KpiTile label="Attive" value={s ? s.active_count : dash} active={view === 'active' && !priority.length} onClick={() => onView('active')}
        sub={s ? <><b>{opened7}</b>&nbsp;aperte negli ultimi 7 giorni</> : null}
        spark={s ? { values: opened.map((o) => o.value), labels: opened.map((o) => o.label), format: (v) => `${v} aperte` } : undefined} />
      <KpiTile label="Scadute" active={view === 'overdue'} onClick={() => onView('overdue')}
        value={counts ? <>{counts.overdue}{counts.overdue ? <KpiFlag tone="error">▲ Oltre la scadenza</KpiFlag> : null}</> : dash}
        sub={counts ? <>{counts.dueToday ? <KpiFlag tone="warning">{counts.dueToday} oggi</KpiFlag> : null}<b>{counts.dueWeek}</b>&nbsp;entro 7 giorni</> : null} />
      <KpiTile label="Tempo medio di chiusura" value={s?.avg_days_to_close != null ? s.avg_days_to_close.toLocaleString('it-IT') : dash}
        unit={s?.avg_days_to_close != null ? 'giorni' : undefined} sub="dall'apertura alla risoluzione" />
      <KpiTile label="Risolte negli ultimi 30 giorni" value={s ? closed30 : dash} active={view === 'closed'} onClick={() => onView('closed')}
        sub={s ? <><b>{s.resolved_count + s.closed_count}</b>&nbsp;risolte o chiuse in tutto</> : null}
        spark={s ? { values: closed.map((o) => o.value), labels: closed.map((o) => o.label), format: (v) => `${v} risolte` } : undefined} />
      <KpiTile label="Attive per priorità" wide>
        {counts ? <SegmentBar parts={prio} onPick={onPriorityPick} dimmed={dimmed} darkFirst /> : null}
      </KpiTile>
    </KpiStrip>
  )
}
