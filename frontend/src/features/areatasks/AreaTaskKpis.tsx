import * as React from 'react'
import { api } from '@shared/api/client'
import { KpiFlag, KpiStrip, KpiTile, SegmentBar } from '../../ui/campo'

export type AreaTaskStats = {
  open: number
  overdue: number
  due_today: number
  due_week: number
  mine: number
  mine_in_progress: number
  mine_waiting: number
  unassigned: number
  done_recent: number
  converted_recent: number
  created_week: number
  da_fare: number
  in_corso: number
  in_attesa: number
  trend: { day: string; count: number }[]
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAreaTaskStats(area: number | '', reloadKey: unknown) {
  const [data, setData] = React.useState<AreaTaskStats | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<AreaTaskStats>('/area-tasks/stats/', { params: area === '' ? {} : { area } })
      .then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [area, reloadKey])
  return data
}

const fmtDay = (s: string) => s.slice(5).split('-').reverse().join('/')

/** Indicatori dei Task di area (anteprima t-base): aperti, scaduti, tuoi, da assegnare, per stato. */
export default function AreaTaskKpis({ s, view, onView, statusPick, onStatusPick }: {
  s: AreaTaskStats | null
  view: string
  onView: (v: string) => void
  statusPick: string[]
  onStatusPick: (status: string) => void
}) {
  const dash = '—'
  const parts = s ? [
    { key: 'da_fare', label: 'Da fare', value: s.da_fare, display: String(s.da_fare) },
    { key: 'in_corso', label: 'In corso', value: s.in_corso, display: String(s.in_corso) },
    { key: 'in_attesa', label: 'In attesa', value: s.in_attesa, display: String(s.in_attesa) },
  ] : []
  const dimmed = statusPick.length ? new Set(parts.map((p) => p.key).filter((k) => !statusPick.includes(k))) : undefined
  return (
    <KpiStrip label="Indicatori task di area">
      <KpiTile label="Aperti" value={s ? s.open : dash} active={view === 'open' && !statusPick.length} onClick={() => onView('open')}
        sub={s ? <><b>{s.created_week}</b>&nbsp;creati negli ultimi 7 giorni</> : null}
        spark={s && s.trend.length > 1 ? { values: s.trend.map((t) => t.count), labels: s.trend.map((t) => fmtDay(t.day)), format: (v) => `${v} aperti` } : undefined} />
      <KpiTile label="Scaduti" active={view === 'late'} onClick={() => onView('late')}
        value={s ? <>{s.overdue}{s.overdue ? <KpiFlag tone="error">▲ Oltre la scadenza</KpiFlag> : null}</> : dash}
        sub={s ? <>{s.due_today ? <KpiFlag tone="warning">{s.due_today} oggi</KpiFlag> : null}<b>{s.due_week}</b>&nbsp;entro 7 giorni</> : null} />
      <KpiTile label="Assegnati a te" value={s ? s.mine : dash} active={view === 'mine'} onClick={() => onView('mine')}
        sub={s ? <><b>{s.mine_in_progress}</b>&nbsp;in corso · <b>{s.mine_waiting}</b>&nbsp;in attesa</> : null} />
      <KpiTile label="Da assegnare" value={s ? s.unassigned : dash} active={view === 'nobody'} onClick={() => onView('nobody')}
        sub={s ? <><b>{s.done_recent}</b>&nbsp;completati negli ultimi 3 giorni{s.converted_recent ? <>, <b>{s.converted_recent}</b>&nbsp;diventati issue</> : null}</> : null} />
      <KpiTile label="Aperti per stato" wide>
        {s ? <SegmentBar parts={parts} onPick={onStatusPick} dimmed={dimmed} /> : null}
      </KpiTile>
    </KpiStrip>
  )
}
