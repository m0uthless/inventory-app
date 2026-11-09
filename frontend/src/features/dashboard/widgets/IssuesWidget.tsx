import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import { api } from '@shared/api/client'
import { useAuth } from '../../../auth/AuthProvider'
import { PRIORITY_META, type IssueRow } from '../../issues/types'
import WidgetShell, { BigNumber, WidgetNote } from './WidgetShell'
import { DARK_INK } from './tints'

const ACTIVE = ['open', 'in_progress', 'waiting']
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
type Pri = (typeof PRIORITIES)[number]

/** Colore della priorità sul widget scuro: bianco per critica e alta, verde chiaro per media, velo per bassa. */
const priColor = (p: string) => (p === 'critical' || p === 'high' ? DARK_INK.text : p === 'medium' ? DARK_INK.mid : 'rgb(255 255 255 / .25)')

export default function IssuesWidget() {
  const navigate = useNavigate()
  const { me } = useAuth()
  const [scope, setScope] = React.useState<'all' | 'mine'>('all')
  const [rows, setRows] = React.useState<IssueRow[] | null>(null)
  const [total, setTotal] = React.useState(0)
  const [byPri, setByPri] = React.useState<Record<Pri, number> | null>(null)

  React.useEffect(() => {
    let alive = true
    const base = { status: ACTIVE, ...(scope === 'mine' && me?.id ? { assigned_to: me.id } : {}) }
    setRows(null)
    api.get<{ results: IssueRow[]; count: number }>('/issues/', { params: { ...base, ordering: '-created_at', page_size: 6 } })
      .then((r) => { if (alive) { setRows(r.data.results); setTotal(r.data.count) } }).catch(() => { if (alive) setRows([]) })
    Promise.all(PRIORITIES.map((p) => api.get<{ count: number }>('/issues/', { params: { ...base, priority: p, page_size: 1 } }).then((r) => r.data.count ?? 0).catch(() => 0)))
      .then((n) => { if (alive) setByPri(Object.fromEntries(PRIORITIES.map((p, i) => [p, n[i]])) as Record<Pri, number>) })
    return () => { alive = false }
  }, [scope, me?.id])

  return (
    <WidgetShell tone="verde" look="dark" icon={ErrorRoundedIcon} title="Issue aperte" link={{ label: 'Tutte', to: scope === 'mine' ? '/issues?vista=mine' : '/issues' }}
      bodySx={{ px: 2, pb: 1.75, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        <BigNumber dark value={rows ? total : '–'} unit={scope === 'mine' ? (total === 1 ? 'tua' : 'tue') : total === 1 ? 'aperta' : 'aperte'} />
        {byPri && total ? (
          <Box aria-label="Per priorità" sx={{ flex: 1, display: 'flex', gap: '3px', height: 10, mb: 0.75, borderRadius: '5px', overflow: 'hidden' }}>
            {PRIORITIES.filter((p) => byPri[p]).map((p) => (
              <Tooltip key={p} title={`${PRIORITY_META[p].label}: ${byPri[p]}`}>
                <Box sx={{ flex: byPri[p], borderRadius: '3px', bgcolor: priColor(p) }} />
              </Tooltip>
            ))}
          </Box>
        ) : null}
      </Box>
      <Box role="group" aria-label="Quali issue" sx={{ display: 'inline-flex', alignSelf: 'flex-start', gap: '2px', p: '3px', borderRadius: '9px', bgcolor: 'rgb(255 255 255 / .10)' }}>
        {([['all', 'Tutte'], ['mine', 'Mie']] as const).map(([k, l]) => (
          <ButtonBase key={k} aria-pressed={scope === k} onClick={() => setScope(k)} sx={{
            height: 24, px: 1.25, borderRadius: '6px', fontSize: 12, fontWeight: 600,
            color: (t) => (scope === k ? t.palette.archie.band : '#d8ebe5'), bgcolor: scope === k ? '#ffffff' : 'transparent',
            '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>{l}</ButtonBase>
        ))}
      </Box>
      {!rows ? <WidgetNote dark>Caricamento…</WidgetNote> : !rows.length ? <WidgetNote dark>{scope === 'mine' ? 'Nessuna issue assegnata a te.' : 'Nessuna issue aperta.'}</WidgetNote> : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '2px', minHeight: 0, overflow: 'hidden' }}>
          {rows.map((i) => (
            <Box component="li" key={i.id}>
              <ButtonBase onClick={() => navigate(`/issues?open=${i.id}`)} sx={{
                width: '100%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1.25, px: 1, mx: -1, py: 0.75, borderRadius: '8px', textAlign: 'left',
                '&:hover': { bgcolor: 'rgb(255 255 255 / .07)' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>
                <Box component="span" title={PRIORITY_META[i.priority]?.label} sx={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', bgcolor: priColor(i.priority) }} />
                <Box sx={{ minWidth: 0, display: 'grid', lineHeight: 1.3 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{i.title}</Typography>
                  <Typography noWrap sx={{ fontSize: 11.5, color: DARK_INK.sub }}>#{i.id} · {i.customer_name}{i.assigned_to_full_name ? ` · ${i.assigned_to_full_name}` : ''}</Typography>
                </Box>
              </ButtonBase>
            </Box>
          ))}
        </Box>
      )}
    </WidgetShell>
  )
}
