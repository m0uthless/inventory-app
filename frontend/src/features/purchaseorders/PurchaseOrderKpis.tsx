import * as React from 'react'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, SegmentBar } from '../../ui/campo'
import type { PurchaseOrderRow, PurchaseOrderStatus, PurchaseOrderSummary } from './types'

/** Statistiche dell'anno calcolate dalle righe (stessi filtri anno/tipo della lista). */
export type PoYearStats = {
  byStatus: Record<PurchaseOrderStatus, { n: number; amount: number }>
  oldestSentDays: number | null
  monthlyCumulative: number[]
}

const EMPTY = (): PoYearStats['byStatus'] => ({
  inserito: { n: 0, amount: 0 }, inviato: { n: 0, amount: 0 }, ricevuto: { n: 0, amount: 0 }, fatturato: { n: 0, amount: 0 },
})

/** € 61.750 — formato compatto per gli indicatori (la tabella usa i centesimi). */
// eslint-disable-next-line react-refresh/only-export-components
export const eurK = (n: number) => `€ ${new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 } as unknown as Intl.NumberFormatOptions).format(Math.round(n))}`

// eslint-disable-next-line react-refresh/only-export-components
export function usePoYearStats(year: number, kind: string | null, reloadKey: unknown) {
  const [stats, setStats] = React.useState<PoYearStats | null>(null)
  React.useEffect(() => {
    let alive = true
    ;(async () => {
      const rows: PurchaseOrderRow[] = []
      let page = 1
      while (page < 20) {
        const r = await api.get('/purchase-order-entries/', { params: { year, ...(kind ? { kind } : {}), page, page_size: 500 } })
        const d = r.data as { results?: PurchaseOrderRow[]; next?: string | null }
        rows.push(...(d.results ?? []))
        if (!d.next) break
        page++
      }
      const byStatus = EMPTY()
      const monthly = Array(12).fill(0) as number[]
      let oldest: number | null = null
      const now = Date.now()
      for (const r of rows) {
        const a = Number(r.amount) || 0
        byStatus[r.status].n++
        byStatus[r.status].amount += a
        monthly[new Date(r.offer_date).getMonth()] += a
        if (r.status === 'inviato' && r.sent_at) {
          const days = Math.round((now - new Date(r.sent_at).getTime()) / 864e5)
          oldest = oldest == null ? days : Math.max(oldest, days)
        }
      }
      const lastMonth = year === new Date().getFullYear() ? new Date().getMonth() : 11
      const cum: number[] = []
      monthly.slice(0, lastMonth + 1).reduce((acc, v) => { cum.push(acc + v); return acc + v }, 0)
      if (alive) setStats({ byStatus, oldestSentDays: oldest, monthlyCumulative: cum })
    })().catch(() => { if (alive) setStats(null) })
    return () => { alive = false }
  }, [year, kind, reloadKey])
  return stats
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

type Props = {
  year: number
  summary: PurchaseOrderSummary | null
  stats: PoYearStats | null
  loading: boolean
  view?: string
  onView?: (key: string) => void
}

/** Indicatori Purchase Order (DESIGN.md › KPI strip). */
export default function PurchaseOrderKpis({ year, summary, stats, loading, view, onView }: Props) {
  const d = summary?.yoy_delta_pct ?? null
  const hasYoy = summary?.previous_year != null && summary?.previous_year_amount != null
  const s = stats?.byStatus
  const total = s ? s.inserito.amount + s.inviato.amount + s.ricevuto.amount + s.fatturato.amount : 0
  const parts = s ? (['inserito', 'inviato', 'ricevuto', 'fatturato'] as const).map((k) => ({
    key: k, label: { inserito: 'Inserito', inviato: 'Inviato', ricevuto: 'Ricevuto', fatturato: 'Fatturato' }[k],
    value: s[k].amount, display: total ? `${Math.round((s[k].amount / total) * 100)}%` : '0%',
  })) : []
  const go = (k: string) => (onView ? () => onView(k) : undefined)
  return (
    <KpiStrip label="Indicatori Purchase Order">
      <KpiTile label={`Totale ${year}`} value={summary ? eurK(Number(summary.total_amount)) : '—'}
        spark={stats && stats.monthlyCumulative.length > 1 ? { values: stats.monthlyCumulative, labels: MONTHS, format: (v) => `${eurK(v)} cumulati` } : undefined}
        sub={!summary ? (loading ? 'caricamento…' : null) : hasYoy
          ? <><b>{d != null ? `${d >= 0 ? '↑' : '↓'} ${pct(Math.abs(d)).replace('+', '')}` : '—'}</b>&nbsp;vs {eurK(Number(summary.previous_year_amount))} nel {summary.previous_year}</>
          : 'nessun dato per l’anno precedente'} />
      <KpiTile label="Da inviare" active={view === 'send'} onClick={go('send')}
        value={s ? s.inserito.n : summary?.to_send ?? '—'} unit={s ? eurK(s.inserito.amount) : undefined} sub="offerte in stato Inserito" />
      <KpiTile label="In attesa del PO" active={view === 'wait'} onClick={go('wait')}
        value={s ? s.inviato.n : '—'} unit={s ? eurK(s.inviato.amount) : undefined}
        sub={stats?.oldestSentDays != null ? <>la più vecchia da&nbsp;<b>{stats.oldestSentDays} giorni</b></> : 'nessuna offerta in attesa'} />
      <KpiTile label="Da fatturare" active={view === 'inv'} onClick={go('inv')}
        value={s ? s.ricevuto.n : '—'} unit={s ? eurK(s.ricevuto.amount) : undefined} sub="PO ricevuto, fattura da emettere" />
      <KpiTile label={`Avanzamento ${year}${s ? ` · ${eurK(total)}` : ''}`} wide>
        {s ? <SegmentBar parts={parts} onPick={(k) => onView?.({ inserito: 'send', inviato: 'wait', ricevuto: 'inv', fatturato: 'done' }[k as PurchaseOrderStatus])} /> : null}
      </KpiTile>
    </KpiStrip>
  )
}
