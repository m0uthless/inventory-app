import * as React from 'react'
import { Tooltip, Box } from '@mui/material'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, KpiTopList, Meter, SegmentBar } from '../../ui/campo'
import { monthLabel } from '../customers/CustomerKpis'

export type SiteSummary = {
  total: number
  customers: number
  inventories: number
  with_open_issues: number
  open_issues: number
  without_inventories: number
  incomplete: number
  missing_address: number
  missing_contact: number
  top_open_issues_list: { id: number; name: string; count: number }[]
  by_status: { key: string | null; label: string | null; count: number }[]
  by_customer: { id: number; name: string; count: number }[]
  growth: { month: string; count: number }[]
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSiteSummary(reloadKey: unknown) {
  const [data, setData] = React.useState<SiteSummary | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<SiteSummary>('/sites/summary/').then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey])
  return data
}

type Props = {
  summary: SiteSummary | null
  view: string
  onView: (key: string) => void
  /** Clic su un cliente del riparto: filtra la lista. */
  onCustomer: (id: number) => void
}

/** Indicatori della pagina Siti (DESIGN.md › KPI strip). */
export default function SiteKpis({ summary: s, view, onView, onCustomer }: Props) {
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  const pct = (n: number) => (s && s.total ? Math.round((n / s.total) * 100) : 0)
  const active = s?.by_status.find((x) => x.key === 'active')?.count ?? 0
  const top = s ? s.by_customer.slice(0, 4) : []
  const rest = s ? s.by_customer.slice(4).reduce((a, b) => a + b.count, 0) : 0
  return (
    <KpiStrip label="Indicatori siti">
      <KpiTile label="Siti" value={s ? s.total : '—'} unit={s ? `${s.customers} clienti` : undefined}
        spark={s && s.growth.length > 1 ? { values: s.growth.map((g) => g.count), labels: s.growth.map((g) => monthLabel(g.month)), format: (v) => `${v} siti` } : undefined}
        sub={s ? <><b>{active}</b>&nbsp;attivi · <b>{s.total - active}</b>&nbsp;chiusi o archiviati</> : null} />

      <KpiTile label="Con issue aperte" active={view === 'iss'} onClick={toggle('iss')}
        value={s ? s.with_open_issues : '—'} unit={s ? `${s.open_issues} issue` : undefined}
        sub={s && !s.top_open_issues_list.length ? 'nessuna issue aperta' : undefined}>
        {s?.top_open_issues_list.length ? <KpiTopList rows={s.top_open_issues_list.map((r) => ({ key: r.id, label: r.name, value: r.count }))} /> : null}
      </KpiTile>

      <KpiTile label="Senza inventari" active={view === 'noinv'} onClick={toggle('noinv')}
        value={s ? s.without_inventories : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s ? <><b>{s.inventories}</b>&nbsp;inventari censiti sui siti</> : null}>
        {s ? <Tooltip title={`${pct(s.total - s.without_inventories)}% dei siti ha almeno un inventario`}><Box><Meter value={pct(s.total - s.without_inventories)} label="Siti con inventari" /></Box></Tooltip> : null}
      </KpiTile>

      <KpiTile label="Da completare" active={view === 'inc'} onClick={toggle('inc')}
        value={s ? s.incomplete : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s ? <><b>{s.missing_address}</b>&nbsp;senza indirizzo · <b>{s.missing_contact}</b>&nbsp;senza referente</> : null}>
        {s ? <Tooltip title={`${pct(s.total - s.incomplete)}% dei siti completi`}><Box><Meter value={pct(s.total - s.incomplete)} label="Siti completi" /></Box></Tooltip> : null}
      </KpiTile>

      <KpiTile label="Per cliente" wide>
        {s && s.by_customer.length ? (
          <SegmentBar darkFirst
            parts={[
              ...top.map((c) => ({ key: String(c.id), label: c.name, value: c.count, display: String(c.count) })),
              ...(rest ? [{ key: 'altri', label: 'Altri', value: rest, display: String(rest) }] : []),
            ]}
            onPick={(k) => { if (k !== 'altri') onCustomer(Number(k)) }}
          />
        ) : null}
      </KpiTile>
    </KpiStrip>
  )
}
