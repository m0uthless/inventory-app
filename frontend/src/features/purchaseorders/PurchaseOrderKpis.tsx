import { KpiStrip, KpiTile } from '../../ui/campo'
import type { PurchaseOrderSummary } from './types'
import { formatEuro } from './types'

type Props = {
  year: number
  summary: PurchaseOrderSummary | null
  loading: boolean
  view?: string
  onView?: (key: string) => void
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/** Indicatori Purchase Order (DESIGN.md › KPI strip), dati da /purchase-order-entries/summary/. */
export default function PurchaseOrderKpis({ year, summary, loading, view, onView }: Props) {
  const d = summary?.yoy_delta_pct ?? null
  const hasYoy = summary?.previous_year != null && summary?.previous_year_amount != null
  return (
    <KpiStrip label="Indicatori Purchase Order">
      <KpiTile label={`Totale ${year}`} value={summary ? formatEuro(summary.total_amount) : '—'}
        sub={!summary ? (loading ? 'caricamento…' : null) : hasYoy
          ? <><b>{d != null ? pct(d) : '—'}</b>&nbsp;vs {formatEuro(summary.previous_year_amount)} nel {summary.previous_year}</>
          : 'nessun dato per l’anno precedente'} />
      <KpiTile label="Da inviare" value={summary ? summary.to_send : '—'} active={view === 'send'} onClick={onView ? () => onView('send') : undefined}
        sub="offerte in stato Inserito" />
      <KpiTile label="In attesa di riscontro" value={summary ? summary.waiting : '—'} active={view === 'wait'} onClick={onView ? () => onView('wait') : undefined}
        sub="inviate o con PO ricevuto, da chiudere" />
    </KpiStrip>
  )
}
