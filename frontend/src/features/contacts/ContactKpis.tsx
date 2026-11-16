import * as React from 'react'
import { Box, Tooltip } from '@mui/material'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, Meter, SegmentBar } from '../../ui/campo'
import { monthLabel } from '../customers/CustomerKpis'

export type ContactSummary = {
  total: number
  customers: number
  primaries: number
  with_site: number
  without_site: number
  unreachable: number
  missing_phone: number
  missing_email: number
  customers_total: number
  customers_without_primary: number
  by_customer: { id: number; name: string; count: number }[]
  growth: { month: string; count: number }[]
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContactSummary(reloadKey: unknown) {
  const [data, setData] = React.useState<ContactSummary | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<ContactSummary>('/contacts/summary/').then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey])
  return data
}

type Props = {
  summary: ContactSummary | null
  view: string
  onView: (key: string) => void
  onCustomer: (id: number) => void
  /** Clienti senza primario: apre la vista "Da completare" dei Clienti. */
  onCustomersWithoutPrimary: () => void
}

/** Indicatori della pagina Contatti (DESIGN.md › KPI strip). */
export default function ContactKpis({ summary: s, view, onView, onCustomer, onCustomersWithoutPrimary }: Props) {
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)
  const top = s ? s.by_customer.slice(0, 4) : []
  const rest = s ? s.by_customer.slice(4).reduce((a, b) => a + b.count, 0) : 0
  return (
    <KpiStrip label="Indicatori contatti">
      <KpiTile label="Contatti" value={s ? s.total : '—'} unit={s ? `${s.customers} clienti` : undefined}
        spark={s && s.growth.length > 1 ? { values: s.growth.map((g) => g.count), labels: s.growth.map((g) => monthLabel(g.month)), format: (v) => `${v} contatti` } : undefined}
        sub={s ? <><b>{s.primaries}</b>&nbsp;primari · <b>{s.with_site}</b>&nbsp;referenti di sito</> : null} />

      <KpiTile label="Senza recapiti" active={view === 'unr'} onClick={toggle('unr')}
        value={s ? s.unreachable : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s ? <><b>{s.missing_phone}</b>&nbsp;senza telefono · <b>{s.missing_email}</b>&nbsp;senza email</> : null}>
        {s ? <Tooltip title={`${pct(s.total - s.unreachable, s.total)}% raggiungibili per telefono o email`}><Box><Meter value={pct(s.total - s.unreachable, s.total)} label="Contatti raggiungibili" /></Box></Tooltip> : null}
      </KpiTile>

      <KpiTile label="Senza sito" active={view === 'nosite'} onClick={toggle('nosite')}
        value={s ? s.without_site : '—'} unit={s ? `di ${s.total}` : undefined}
        sub="collegati solo al cliente">
        {s ? <Tooltip title={`${pct(s.with_site, s.total)}% collegati a un sito`}><Box><Meter value={pct(s.with_site, s.total)} label="Contatti con sito" /></Box></Tooltip> : null}
      </KpiTile>

      <KpiTile label="Clienti senza primario" onClick={onCustomersWithoutPrimary}
        value={s ? s.customers_without_primary : '—'} unit={s ? `di ${s.customers_total}` : undefined}
        sub="nessun referente principale">
        {s ? <Tooltip title={`${pct(s.customers_total - s.customers_without_primary, s.customers_total)}% dei clienti ha un primario`}><Box><Meter value={pct(s.customers_total - s.customers_without_primary, s.customers_total)} label="Clienti con primario" /></Box></Tooltip> : null}
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
