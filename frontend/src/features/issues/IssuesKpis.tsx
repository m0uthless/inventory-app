import * as React from 'react'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, SegmentBar } from '../../ui/campo'

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

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })

/** Ultimi 30 giorni, uno per giorno (i giorni senza eventi valgono 0). */
function daily(buckets: Summary['chart_buckets']) {
  const map = new Map(buckets.filter((b) => b.date).map((b) => [b.date!.slice(0, 10), b.count]))
  const out: { label: string; value: number }[] = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - 29)
  for (let i = 0; i < 30; i++) {
    const iso = d.toISOString().slice(0, 10)
    out.push({ label: fmtDay(iso), value: map.get(iso) ?? 0 })
    d.setDate(d.getDate() + 1)
  }
  return out
}

type Props = {
  reloadKey: number
  view: string
  status: string[]
  onView: (key: string) => void
  onStatusPick: (status: string) => void
}

/** Fascia indicatori della pagina Issue (dati reali da /issues/summary/). */
export default function IssuesKpis({ reloadKey, view, status, onView, onStatusPick }: Props) {
  const [s, setS] = React.useState<Summary | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<Summary>('/issues/summary/').then((r) => { if (alive) setS(r.data) }).catch(() => {})
    return () => { alive = false }
  }, [reloadKey])

  const opened = s ? daily(s.chart_buckets) : []
  const closed = s ? daily(s.closed_buckets) : []
  const opened30 = opened.reduce((a, b) => a + b.value, 0)
  const closed30 = closed.reduce((a, b) => a + b.value, 0)
  const dash = '—'
  const statusParts = s ? [
    { key: 'open', label: 'Aperte', value: s.open_count, display: String(s.open_count) },
    { key: 'in_progress', label: 'In lavorazione', value: s.in_progress_count, display: String(s.in_progress_count) },
    { key: 'waiting', label: 'In attesa', value: s.waiting_count, display: String(s.waiting_count) },
  ] : []
  const dimmed = status.length ? new Set(statusParts.map((p) => p.key).filter((k) => !status.includes(k))) : undefined

  return (
    <KpiStrip label="Indicatori issue">
      <KpiTile label="Attive" value={s ? s.active_count : dash} active={view === 'active' && !status.length} onClick={() => onView('active')}
        sub={s ? <><b>{opened30}</b>&nbsp;aperte negli ultimi 30 giorni</> : null}
        spark={s ? { values: opened.map((o) => o.value), labels: opened.map((o) => o.label), format: (v) => `${v} aperte` } : undefined} />
      <KpiTile label="In attesa" value={s ? s.waiting_count : dash} active={status.length === 1 && status[0] === 'waiting'} onClick={() => onStatusPick('waiting')}
        sub="ferme su cliente o fornitore" />
      <KpiTile label="Tempo medio di chiusura" value={s?.avg_days_to_close != null ? s.avg_days_to_close.toLocaleString('it-IT') : dash} unit={s?.avg_days_to_close != null ? 'giorni' : undefined}
        sub="dall'apertura alla risoluzione" />
      <KpiTile label="Risolte negli ultimi 30 giorni" value={s ? closed30 : dash} active={view === 'closed'} onClick={() => onView('closed')}
        sub={s ? <><b>{s.resolved_count + s.closed_count}</b>&nbsp;risolte o chiuse in tutto</> : null}
        spark={s ? { values: closed.map((o) => o.value), labels: closed.map((o) => o.label), format: (v) => `${v} risolte` } : undefined} />
      <KpiTile label="Attive per stato" wide>
        {s ? <SegmentBar parts={statusParts} onPick={onStatusPick} dimmed={dimmed} /> : null}
      </KpiTile>
    </KpiStrip>
  )
}
