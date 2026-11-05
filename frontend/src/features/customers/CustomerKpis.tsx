import * as React from 'react'
import { Box } from '@mui/material'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, SegmentBar } from '../../ui/campo'
import { ClockIcon, daysTo, dIt } from './customerUi'

export type CustomerSummary = {
  total: number
  sites: number
  inventories: number
  with_open_issues: number
  open_issues: number
  top_open_issues: { id: number; name: string; count: number } | null
  contracts_expiring: number
  expiring_days: number
  nearest_expiry: { id: number; name: string; date: string; title: string | null } | null
  incomplete: number
  by_vendor: { key: string | null; label: string | null; count: number }[]
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomerSummary(reloadKey: unknown) {
  const [data, setData] = React.useState<CustomerSummary | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<CustomerSummary>('/customers/summary/').then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey])
  return data
}

type Props = {
  summary: CustomerSummary | null
  view: string
  onView: (key: string) => void
  /** Clic su un vendor del riparto: filtra la lista. */
  onVendor: (key: string) => void
  vendorColor: (label: string) => string
}

/** Indicatori della pagina Clienti (DESIGN.md › KPI strip). */
export default function CustomerKpis({ summary: s, view, onView, onVendor, vendorColor }: Props) {
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  return (
    <KpiStrip label="Indicatori clienti">
      <KpiTile label="Clienti" value={s ? s.total : '—'} unit={s ? `${s.sites} siti` : undefined}
        sub={s ? <><b>{s.inventories}</b>&nbsp;inventari in anagrafica</> : null} />
      <KpiTile label="Con issue aperte" active={view === 'iss'} onClick={toggle('iss')}
        value={s ? s.with_open_issues : '—'} unit={s ? `${s.open_issues} issue` : undefined}
        sub={s?.top_open_issues ? <>più aperte:&nbsp;<b>{s.top_open_issues.name}</b></> : 'nessuna issue aperta'} />
      <KpiTile label="Contratti in scadenza" active={view === 'exp'} onClick={toggle('exp')}
        value={s ? s.contracts_expiring : '—'} unit={s ? `entro ${s.expiring_days} giorni` : undefined}
        sub={s?.nearest_expiry ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'warning.main', fontWeight: 600 }}><ClockIcon size={13} />{dIt(s.nearest_expiry.date)}</Box>
            tra&nbsp;<b>{daysTo(s.nearest_expiry.date)}</b>&nbsp;giorni
          </Box>
        ) : 'nessuna scadenza vicina'} />
      <KpiTile label="Da completare" active={view === 'inc'} onClick={toggle('inc')}
        value={s ? s.incomplete : '—'} sub="senza contatto primario o P.IVA" />
      <KpiTile label="Per vendor" wide>
        {s && s.by_vendor.length ? (
          <SegmentBar
            parts={s.by_vendor.map((v) => ({ key: v.key ?? '', label: v.label || 'Senza vendor', value: v.count, display: String(v.count), color: vendorColor(v.label || '') }))}
            onPick={onVendor}
          />
        ) : null}
      </KpiTile>
    </KpiStrip>
  )
}
