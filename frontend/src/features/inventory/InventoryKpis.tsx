import * as React from 'react'
import { Box, Tooltip } from '@mui/material'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, KpiTopList, Meter, SegmentBar } from '../../ui/campo'
import { monthLabel } from '../customers/CustomerKpis'

export type InventorySummary = {
  total: number
  customers: number
  in_use: number
  retired: number
  to_install: number
  maintenance: number
  repair: number
  not_operational: number
  with_issue: number
  incomplete: number
  missing_site: number
  missing_ip: number
  issue_priority: Record<'critical' | 'high' | 'medium' | 'low', number>
  by_type: { id: number; key: string; label: string; count: number }[]
  growth: { month: string; count: number }[]
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventorySummary(reloadKey: unknown) {
  const [data, setData] = React.useState<InventorySummary | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<InventorySummary>('/inventories/summary/').then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey])
  return data
}

type Props = {
  summary: InventorySummary | null
  view: string
  onView: (key: string) => void
  onType: (id: number) => void
}

const PRIO: [keyof InventorySummary['issue_priority'], string][] = [['critical', 'Critica'], ['high', 'Alta'], ['medium', 'Media'], ['low', 'Bassa']]

/** Indicatori della pagina Inventari (DESIGN.md › KPI strip). */
export default function InventoryKpis({ summary: s, view, onView, onType }: Props) {
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)
  const top = s ? s.by_type.slice(0, 4) : []
  const rest = s ? s.by_type.slice(4).reduce((a, b) => a + b.count, 0) : 0
  const prioRows = s ? PRIO.filter(([k]) => s.issue_priority[k] > 0).map(([k, l]) => ({ key: k, label: l, value: s.issue_priority[k] })) : []
  return (
    <KpiStrip label="Indicatori inventari">
      <KpiTile label="Inventari" value={s ? s.total : '—'} unit={s ? `${s.customers} clienti` : undefined}
        spark={s && s.growth.length > 1 ? { values: s.growth.map((g) => g.count), labels: s.growth.map((g) => monthLabel(g.month)), format: (v) => `${v} inventari` } : undefined}
        sub={s ? <><b>{s.in_use}</b>&nbsp;in uso · <b>{s.retired}</b>&nbsp;dismessi</> : null} />

      <KpiTile label="Con issue aperte" active={view === 'iss'} onClick={toggle('iss')}
        value={s ? s.with_issue : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s && !prioRows.length ? 'nessuna issue aperta' : undefined}>
        {prioRows.length ? <KpiTopList rows={prioRows} /> : null}
      </KpiTile>

      <KpiTile label="Non operativi" active={view === 'nop'} onClick={toggle('nop')}
        value={s ? s.not_operational : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s ? <><b>{s.repair}</b>&nbsp;guasti · <b>{s.maintenance}</b>&nbsp;in manut. · <b>{s.to_install}</b>&nbsp;da installare</> : null}>
        {s ? <Tooltip title={`${pct(s.in_use, s.total - s.retired)}% dei sistemi attivi è in uso`}><Box><Meter value={pct(s.in_use, s.total - s.retired)} label="Sistemi in uso" /></Box></Tooltip> : null}
      </KpiTile>

      <KpiTile label="Da completare" active={view === 'inc'} onClick={toggle('inc')}
        value={s ? s.incomplete : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s ? <><b>{s.missing_site}</b>&nbsp;senza sito · <b>{s.missing_ip}</b>&nbsp;senza IP</> : null}>
        {s ? <Tooltip title={`${pct(s.total - s.incomplete, s.total)}% con sito e IP`}><Box><Meter value={pct(s.total - s.incomplete, s.total)} label="Inventari completi" /></Box></Tooltip> : null}
      </KpiTile>

      <KpiTile label="Per tipo" wide>
        {s && s.by_type.length ? (
          <SegmentBar darkFirst
            parts={[
              ...top.map((t) => ({ key: String(t.id), label: t.label, value: t.count, display: String(t.count) })),
              ...(rest ? [{ key: 'altri', label: 'Altri', value: rest, display: String(rest) }] : []),
            ]}
            onPick={(k) => { if (k !== 'altri') onType(Number(k)) }}
          />
        ) : null}
      </KpiTile>
    </KpiStrip>
  )
}
