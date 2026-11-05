import * as React from 'react'
import { Box, Tooltip } from '@mui/material'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, KpiTopList, Meter, SegmentBar } from '../../ui/campo'
import { ClockIcon, dIt } from './customerUi'

export type CustomerSummary = {
  total: number
  sites: number
  inventories: number
  with_open_issues: number
  open_issues: number
  top_open_issues: { id: number; name: string; count: number } | null
  top_open_issues_list: { id: number; name: string; count: number }[]
  contracts_expiring: number
  expiring_days: number
  nearest_expiry: { id: number; name: string; date: string; title: string | null } | null
  expiring: { id: number; name: string; date: string; title: string | null; days: number }[]
  incomplete: number
  missing_vat: number
  missing_contact: number
  under_contract: number
  with_vpn: number
  growth: { month: string; count: number }[]
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

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
// eslint-disable-next-line react-refresh/only-export-components
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTHS[Number(m) - 1]} ${y}` }

/** Prossimi N giorni come una linea: un punto per ogni contratto in scadenza. */
function ExpiryTrack({ items, days }: { items: CustomerSummary['expiring']; days: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
      <Box sx={{ position: 'relative', height: 12, flex: 1 }}>
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: 5, height: 2, borderRadius: 1, bgcolor: 'archie.neutralBg' }} />
        <Tooltip title="Oggi"><Box sx={{ position: 'absolute', left: 0, top: 0, width: 2, height: 12, borderRadius: 1, bgcolor: 'text.primary' }} /></Tooltip>
        {items.map((c) => (
          <Tooltip key={`${c.id}-${c.date}`} title={`${c.name}${c.title ? ` · ${c.title}` : ''} · scade il ${dIt(c.date)} (tra ${c.days} ${c.days === 1 ? 'giorno' : 'giorni'})`}>
            <Box component="span" aria-label={`${c.name}, scade il ${dIt(c.date)}`}
              sx={{ position: 'absolute', top: 1, left: `calc(${Math.min(100, Math.max(0, (c.days / days) * 100))}% - 5px)`, width: 10, height: 10, borderRadius: '50%',
                bgcolor: 'warning.main', border: '2px solid', borderColor: 'background.paper', transition: 'transform .12s', '&:hover': { transform: 'scale(1.3)' } }} />
          </Tooltip>
        ))}
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{days} gg</Box>
    </Box>
  )
}

/** Indicatori della pagina Clienti (DESIGN.md › KPI strip). */
export default function CustomerKpis({ summary: s, view, onView, onVendor, vendorColor }: Props) {
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  const complete = s && s.total ? Math.round(((s.total - s.incomplete) / s.total) * 100) : 0
  return (
    <KpiStrip label="Indicatori clienti">
      <KpiTile label="Clienti" value={s ? s.total : '—'} unit={s ? `${s.sites} siti` : undefined}
        spark={s && s.growth.length > 1 ? { values: s.growth.map((g) => g.count), labels: s.growth.map((g) => monthLabel(g.month)), format: (v) => `${v} clienti` } : undefined}
        sub={s ? <><b>{s.under_contract}</b>&nbsp;sotto contratto · <b>{s.with_vpn}</b>&nbsp;con VPN</> : null} />

      <KpiTile label="Con issue aperte" active={view === 'iss'} onClick={toggle('iss')}
        value={s ? s.with_open_issues : '—'} unit={s ? `${s.open_issues} issue` : undefined}
        sub={s && !s.top_open_issues_list.length ? 'nessuna issue aperta' : undefined}>
        {s?.top_open_issues_list.length ? <KpiTopList rows={s.top_open_issues_list.map((r) => ({ key: r.id, label: r.name, value: r.count }))} /> : null}
      </KpiTile>

      <KpiTile label="Contratti in scadenza" active={view === 'exp'} onClick={toggle('exp')}
        value={s ? s.contracts_expiring : '—'} unit={s ? `entro ${s.expiring_days} giorni` : undefined}
        sub={s?.nearest_expiry ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'warning.main', fontWeight: 600 }}><ClockIcon size={13} />{dIt(s.nearest_expiry.date)}</Box>
            <b>{s.nearest_expiry.name}</b>
          </Box>
        ) : 'nessuna scadenza vicina'}>
        {s ? <ExpiryTrack items={s.expiring} days={s.expiring_days} /> : null}
      </KpiTile>

      <KpiTile label="Da completare" active={view === 'inc'} onClick={toggle('inc')}
        value={s ? s.incomplete : '—'} unit={s ? `di ${s.total}` : undefined}
        sub={s ? <><b>{s.missing_vat}</b>&nbsp;senza P.IVA · <b>{s.missing_contact}</b>&nbsp;senza contatto</> : null}>
        {s ? (
          <Tooltip title={`${complete}% delle anagrafiche complete`}>
            <Box><Meter value={complete} label="Anagrafiche complete" /></Box>
          </Tooltip>
        ) : null}
      </KpiTile>

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
