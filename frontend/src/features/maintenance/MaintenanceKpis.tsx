import * as React from 'react'
import { Box, ButtonBase } from '@mui/material'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, KpiTopList, Meter } from '../../ui/campo'
import { dShort } from '../contracts/contractModel'
import { dueStateOf, type TodoStats } from './mtModel'

// eslint-disable-next-line react-refresh/only-export-components
export function useTodoStats(reloadKey: unknown, filters: Record<string, unknown>) {
  const [data, setData] = React.useState<TodoStats | null>(null)
  const key = JSON.stringify(filters)
  React.useEffect(() => {
    let alive = true
    api.get<TodoStats>('/maintenance-plans/todo-stats/', { params: JSON.parse(key) })
      .then((r) => { if (alive) setData(r.data) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey, key])
  return data
}

type Props = {
  stats: TodoStats | null
  view: string
  onView: (key: string) => void
  onCustomer: (id: number) => void
}

const MONTH = () => new Date().toLocaleDateString('it-IT', { month: 'long' })

/** Indicatori delle Scadenze (anteprima design-previews/mt-base.html). */
export default function MaintenanceKpis({ stats: s, view, onView, onCustomer }: Props) {
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  const pct = s && s.coverage.total ? Math.round((s.coverage.done / s.coverage.total) * 100) : 0
  return (
    <KpiStrip label="Indicatori manutenzione">
      <KpiTile label="Scadute" active={view === 'over'} onClick={toggle('over')}
        value={s ? s.overdue : '—'} unit={s ? 'da recuperare' : undefined}
        sub={s && !s.overdue ? 'nessuna manutenzione in ritardo' : undefined}>
        {s?.overdue_by_customer.length ? <KpiTopList rows={s.overdue_by_customer.map((c) => ({ key: c.customer_id, label: c.customer_name, value: c.count }))} /> : null}
      </KpiTile>

      <KpiTile label="Prossimi 30 giorni" active={view === 'soon'} onClick={toggle('soon')}
        value={s ? s.next30 : '—'}
        sub={s ? (s.first_next30 ? <>la prima <b>{dShort(s.first_next30).replace(/ \d{4}$/, '')}</b>&nbsp;· {s.next30_customers} {s.next30_customers === 1 ? 'cliente' : 'clienti'}</> : 'niente in arrivo') : null} />

      <KpiTile label="Copertura dei piani attivi" value={s ? `${pct}%` : '—'} unit={s ? `${s.coverage.done} di ${s.coverage.total}` : undefined}
        sub={s ? <><b>{s.events_this_month}</b>&nbsp;rapportini a {MONTH()} · <b>{s.follow_up}</b>&nbsp;KO o parziali</> : null}>
        {s ? <Meter value={pct} label="Manutenzioni eseguite nel ciclo" /> : null}
      </KpiTile>

      <KpiTile label="Prossime uscite" wide>
        {s && s.next_visits.length ? (
          <Box sx={{ display: 'grid', gap: '2px', mt: '2px' }}>
            {s.next_visits.slice(0, 4).map((v) => {
              const st = dueStateOf(v.first_due)
              return (
                <ButtonBase key={`${v.customer_id}-${v.site_id}`} onClick={() => onCustomer(v.customer_id)} title={`Filtra ${v.customer_name}`} sx={{
                  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 1, alignItems: 'baseline', justifyItems: 'start',
                  fontSize: 12, lineHeight: '19px', px: 0.5, mx: -0.5, borderRadius: '4px', textAlign: 'left',
                  '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                  <Box component="span" sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{v.customer_name}</Box>{v.site_name ? ` · ${v.site_name}` : ''} · {v.count} {v.count === 1 ? 'intervento' : 'interventi'}
                  </Box>
                  <Box component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: st === 'overdue' ? 'error.main' : st === 'next30' ? 'warning.main' : 'text.primary' }}>
                    {dShort(v.first_due).replace(/ \d{4}$/, '')}
                  </Box>
                </ButtonBase>
              )
            })}
          </Box>
        ) : <Box sx={{ mt: 'auto', fontSize: 12, color: 'text.secondary' }}>{s ? 'Nessuna uscita in programma.' : ''}</Box>}
      </KpiTile>
    </KpiStrip>
  )
}
