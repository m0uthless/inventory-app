import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material'
import BuildRoundedIcon from '@mui/icons-material/BuildRounded'
import { api } from '@shared/api/client'
import { isoOf, type TodoStats } from '../../maintenance/mtModel'
import WidgetShell, { BigNumber, WidgetNote } from './WidgetShell'
import { tintVeil } from './tints'

type Row = { next_due_date: string }

/** Manutenzioni: scadute in grande, carico dei prossimi 14 giorni, clienti con più scadute. */
export default function MaintenanceWidget() {
  const navigate = useNavigate()
  const [stats, setStats] = React.useState<TodoStats | null>(null)
  const [days, setDays] = React.useState<{ iso: string; n: number }[] | null>(null)

  React.useEffect(() => {
    let alive = true
    api.get<TodoStats>('/maintenance-plans/todo-stats/').then((r) => { if (alive) setStats(r.data) }).catch(() => {})
    const from = new Date(); const to = new Date(); to.setDate(to.getDate() + 13)
    api.get<{ results: Row[] }>('/maintenance-plans/todo/', { params: { due_from: isoOf(from), due_to: isoOf(to), page_size: 500 } })
      .then((r) => {
        const counts = new Map<string, number>()
        for (const x of r.data.results ?? []) counts.set(x.next_due_date, (counts.get(x.next_due_date) ?? 0) + 1)
        const list = Array.from({ length: 14 }, (_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); const iso = isoOf(d); return { iso, n: counts.get(iso) ?? 0 } })
        if (alive) setDays(list)
      }).catch(() => { if (alive) setDays([]) })
    return () => { alive = false }
  }, [])

  const max = Math.max(1, ...(days ?? []).map((d) => d.n))
  return (
    <WidgetShell tone="rose" icon={BuildRoundedIcon} title="Manutenzioni" link={{ label: 'Scadenze', to: '/maintenance' }} bodySx={{ px: 2, pb: 1.75, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <BigNumber tone="rose" value={stats ? stats.overdue : '–'} unit={stats?.overdue === 1 ? 'scaduta' : 'scadute'} />
        {stats ? <Typography sx={{ fontSize: 12, color: 'text.secondary', pb: 0.5, '& b': { color: 'text.primary', fontWeight: 650 } }}><b>{stats.next30}</b> nei prossimi 30 giorni</Typography> : null}
      </Box>
      {days && days.length ? (
        <Box aria-label="Manutenzioni in scadenza nei prossimi 14 giorni" sx={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: '4px', alignItems: 'end', height: 34 }}>
          {days.map((d) => (
            <Tooltip key={d.iso} title={`${new Date(`${d.iso}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.n}`}>
              <Box sx={{ height: d.n ? 6 + (d.n / max) * 26 : 3, borderRadius: '3px', bgcolor: (t) => t.palette.archie.tints.rose.mid, opacity: d.n ? 0.85 : 0.25 }} />
            </Tooltip>
          ))}
        </Box>
      ) : null}
      {!stats ? <WidgetNote>Caricamento…</WidgetNote> : !stats.overdue_by_customer.length ? <WidgetNote>Nessuna manutenzione scaduta.</WidgetNote> : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '2px', minHeight: 0, overflow: 'hidden' }}>
          {stats.overdue_by_customer.slice(0, 5).map((c) => (
            <Box component="li" key={c.customer_id}>
              <ButtonBase onClick={() => navigate(`/maintenance?vista=over&m_customer=${c.customer_id}`)} sx={{
                width: '100%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1.25, px: 1, mx: -1, py: 0.75, borderRadius: '8px', textAlign: 'left',
                '&:hover': { bgcolor: (t) => tintVeil(t, 'rose', 12) }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>
                <Box component="span" sx={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', bgcolor: (t) => t.palette.archie.tints.rose.mid }} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 550 }}>{c.customer_name}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 650, color: (t) => t.palette.archie.tints.rose.ink, whiteSpace: 'nowrap' }}>{c.count} {c.count === 1 ? 'scaduta' : 'scadute'}</Typography>
              </ButtonBase>
            </Box>
          ))}
        </Box>
      )}
    </WidgetShell>
  )
}
