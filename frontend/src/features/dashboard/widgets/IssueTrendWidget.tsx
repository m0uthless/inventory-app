import * as React from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { api } from '@shared/api/client'
import WidgetShell, { BigNumber, WidgetNote } from './WidgetShell'
import { DARK_INK } from './tints'

type Period = 'day' | 'week' | 'month'
type Point = { start: string; end: string; opened: number; closed: number; open: number }
type Trend = { period: Period; points: Point[]; open_now: number }

const PERIODS: [Period, string][] = [['day', 'Giorni'], ['week', 'Settimane'], ['month', 'Mesi']]
const fmt = (p: Period, iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return p === 'month' ? d.toLocaleDateString('it-IT', { month: 'short' }) : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

/**
 * «Issue ancora aperte» (anteprima design-previews/dbw-base.html, variante B · Arretrato):
 * quante issue restano aperte nel tempo, con aperte e risolte del periodo.
 */
export default function IssueTrendWidget() {
  const [period, setPeriod] = React.useState<Period>('week')
  const [data, setData] = React.useState<Trend | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    setFailed(false)
    api.get<Trend>('/issues/trend/', { params: { period } })
      .then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) { setFailed(true); setData(null) } })
    return () => { alive = false }
  }, [period])

  const pts = data?.points ?? []
  const series = pts.map((p) => p.open)
  const max = Math.max(1, ...series) * 1.15
  const min = Math.min(...(series.length ? series : [0])) * 0.85
  const H = 50
  const y = (v: number) => H - ((v - min) / Math.max(1, max - min)) * H
  const line = series.map((v, i) => `${(i / Math.max(1, series.length - 1)) * 100},${y(v)}`).join(' ')
  const delta = series.length ? series[series.length - 1] - series[0] : 0
  const opened = pts.reduce((s, p) => s + p.opened, 0)
  const closed = pts.reduce((s, p) => s + p.closed, 0)

  return (
    <WidgetShell tone="verde" look="dark" icon={TrendingUpRoundedIcon} title="Issue ancora aperte" link={{ label: 'Issue', to: '/issues' }} bodySx={{ px: 2, pb: 1.75, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap' }}>
        <BigNumber dark value={data ? data.open_now : '–'} unit="aperte ora" />
        {data ? <Typography sx={{ fontSize: 12, color: DARK_INK.sub, pb: 0.75 }}>{delta > 0 ? '+' : ''}{delta} da inizio periodo</Typography> : null}
        <Box role="group" aria-label="Periodo" sx={{ ml: 'auto', display: 'inline-flex', gap: '2px', p: '3px', borderRadius: '9px', bgcolor: 'rgb(255 255 255 / .10)' }}>
          {PERIODS.map(([k, l]) => (
            <ButtonBase key={k} aria-pressed={period === k} onClick={() => setPeriod(k)} sx={{
              height: 24, px: 1.1, borderRadius: '6px', fontSize: 12, fontWeight: 600,
              color: (t) => (period === k ? t.palette.archie.band : '#d8ebe5'), bgcolor: period === k ? '#ffffff' : 'transparent',
              '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
            }}>{l}</ButtonBase>
          ))}
        </Box>
      </Box>
      {failed ? <WidgetNote dark>Andamento non disponibile.</WidgetNote> : !data ? <WidgetNote dark>Caricamento…</WidgetNote> : (
        <>
          <Box component="svg" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img"
            aria-label={`Issue aperte nel tempo: da ${series[0] ?? 0} a ${series[series.length - 1] ?? 0}`}
            sx={{ display: 'block', width: '100%', flex: 1, minHeight: 70, overflow: 'visible' }}>
            <polygon points={`0,${H} ${line} 100,${H}`} fill="rgb(255 255 255 / .12)" />
            <polyline points={line} fill="none" stroke={DARK_INK.text} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: DARK_INK.sub }}>
            <span>{pts[0] ? fmt(period, pts[0].start) : ''}</span><span>{pts.length ? fmt(period, pts[pts.length - 1].end) : ''}</span>
          </Box>
          <Typography sx={{ fontSize: 12, color: DARK_INK.sub, '& b': { color: DARK_INK.text, fontWeight: 650 } }}>
            Nel periodo <b>{opened}</b> aperte · <b>{closed}</b> risolte
          </Typography>
        </>
      )}
    </WidgetShell>
  )
}
