import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { useAuth } from '../../../auth/AuthProvider'
import WidgetShell from './WidgetShell'
import { tintedBg } from './tints'
import { CONDITION_LABEL, wmoToCondition, type Condition } from './weatherModel'

type Weather = { temp: number; cond: Condition; isNight: boolean; wind: number; min: number; max: number; next: { day: string; max: number; cond: Condition }[] }

/** Disegno del tempo: sole, nuvola, pioggia, neve, temporale, nebbia (tinte del tema). */
function WeatherGlyph({ cond, night }: { cond: Condition; night: boolean }) {
  const sun = cond === 'clear' || cond === 'partly'
  const cloud = cond !== 'clear'
  return (
    <Box component="svg" viewBox="0 0 64 64" aria-hidden sx={{ width: 64, height: 64, flex: 'none',
      '& .sun': { fill: (t) => t.palette.archie.tints.sand.mid }, '& .ray': { stroke: (t) => t.palette.archie.tints.sand.mid, strokeWidth: 2.5, strokeLinecap: 'round' },
      '& .moon': { fill: (t) => t.palette.archie.tints.butter.mid },
      '& .cl': { fill: 'background.paper', stroke: (t) => `color-mix(in srgb, ${t.palette.archie.tints.sky.mid} 60%, ${t.palette.archie.borderStrong})`, strokeWidth: 2 },
      '& .drop': { stroke: (t) => t.palette.archie.tints.sky.mid, strokeWidth: 2.5, strokeLinecap: 'round' },
      '& .snow': { fill: (t) => t.palette.archie.tints.sky.mid },
      '& .bolt': { fill: (t) => t.palette.archie.tints.sand.mid },
      '& .fog': { stroke: (t) => t.palette.archie.borderStrong, strokeWidth: 2.5, strokeLinecap: 'round' } }}>
      {sun && !night ? <><circle className="sun" cx={cloud ? 24 : 32} cy={cloud ? 22 : 30} r={cloud ? 10 : 13} /><g className="ray">{(cloud ? ['M24 6v4', 'M8 22h4', 'M12.7 10.7l2.8 2.8', 'M35.3 10.7l-2.8 2.8'] : ['M32 8v5', 'M32 47v5', 'M10 30h5', 'M49 30h5', 'M16.4 14.4l3.5 3.5', 'M44.1 42.1l3.5 3.5', 'M16.4 45.6l3.5-3.5', 'M44.1 17.9l3.5-3.5']).map((d) => <path key={d} d={d} />)}</g></> : null}
      {sun && night ? <path className="moon" d={cloud ? 'M28 10a12 12 0 1 0 10 18A10 10 0 0 1 28 10z' : 'M34 12a18 18 0 1 0 14 28A15 15 0 0 1 34 12z'} /> : null}
      {cloud ? <path className="cl" d="M48 46H22a10 10 0 1 1 3.4-19.4A12 12 0 0 1 48 30a8 8 0 0 1 0 16z" /> : null}
      {cond === 'rain' ? <g className="drop"><path d="M26 51l-2 5" /><path d="M34 51l-2 5" /><path d="M42 51l-2 5" /></g> : null}
      {cond === 'snow' ? <g className="snow"><circle cx="26" cy="54" r="2.2" /><circle cx="34" cy="57" r="2.2" /><circle cx="42" cy="54" r="2.2" /></g> : null}
      {cond === 'storm' ? <path className="bolt" d="M34 47l-6 9h5l-3 7 9-11h-5l3-5z" /> : null}
      {cond === 'fog' ? <g className="fog"><path d="M16 52h32" /><path d="M20 58h24" /></g> : null}
    </Box>
  )
}

function useWeather() {
  const [w, setW] = React.useState<Weather | null | 'err'>(null)
  React.useEffect(() => {
    // Bologna (come prima): attuale + 5 giorni.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=44.4949&longitude=11.3426&current=temperature_2m,weathercode,windspeed_10m,is_day&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=Europe%2FRome', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const days: string[] = d.daily.time
        setW({
          temp: Math.round(d.current.temperature_2m), cond: wmoToCondition(d.current.weathercode), isNight: d.current.is_day === 0, wind: Math.round(d.current.windspeed_10m),
          min: Math.round(d.daily.temperature_2m_min[0]), max: Math.round(d.daily.temperature_2m_max[0]),
          next: days.slice(1, 5).map((iso, i) => ({ day: new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''), max: Math.round(d.daily.temperature_2m_max[i + 1]), cond: wmoToCondition(d.daily.weathercode[i + 1]) })),
        })
      })
      .catch(() => setW('err'))
      .finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [])
  return w
}

/** Riepilogo personale: issue assegnate, task di area tuoi, manutenzioni scadute. */
function useMine(meId: number | undefined) {
  const [m, setM] = React.useState<{ issues: number; tasks: number; overdue: number } | null>(null)
  React.useEffect(() => {
    if (!meId) return
    let alive = true
    Promise.all([
      api.get<{ count: number }>('/issues/', { params: { assigned_to: meId, status: ['open', 'in_progress', 'waiting'], page_size: 1 }, paramsSerializer: { indexes: null } }).then((r) => r.data.count ?? 0).catch(() => 0),
      api.get<{ count?: number } | unknown[]>('/area-tasks/', { params: { assigned_to: meId, is_open: true, page_size: 1 } })
        .then((r) => (Array.isArray(r.data) ? r.data.length : r.data.count ?? 0)).catch(() => 0),
      api.get<{ overdue: number }>('/maintenance-plans/todo-stats/').then((r) => r.data.overdue ?? 0).catch(() => 0),
    ]).then(([issues, tasks, overdue]) => { if (alive) setM({ issues, tasks, overdue }) })
    return () => { alive = false }
  }, [meId])
  return m
}

export default function WelcomeWidget() {
  const { me } = useAuth()
  const w = useWeather()
  const mine = useMine(me?.id)
  const name = me?.first_name?.trim() || me?.username || ''
  const hour = new Date().getHours()
  const hello = hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const chip = (to: string, n: number, label: string, alert = false) => (
    <Box component={RouterLink} to={to} sx={{
      fontSize: 12.5, px: 1.25, lineHeight: '28px', borderRadius: '14px', textDecoration: 'none', color: 'text.primary', whiteSpace: 'nowrap',
      bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 75%, transparent)`, '&:hover': { bgcolor: 'background.paper' },
      '& b': { fontWeight: 700, color: (t) => (alert ? t.palette.archie.tints.rose.ink : t.palette.archie.tints.sky.ink) },
    }}><b>{n}</b> {label}</Box>
  )
  return (
    <WidgetShell tone="sky" ariaLabel="Benvenuto" sx={{ background: (t) => `linear-gradient(135deg, ${tintedBg(t, 'sky', 70)} 0%, ${tintedBg(t, 'mint', 70)} 100%)` }}
      bodySx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 2.5, p: { xs: '18px', sm: '20px 24px' } }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography component="h1" sx={{ fontSize: { xs: 26, sm: 32 }, lineHeight: 1.1, fontWeight: 650, letterSpacing: '-0.025em', color: (t) => t.palette.archie.tints.sky.ink, textWrap: 'balance' }}>
          {hello}{name ? `, ${name}` : ''}
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: 13, color: 'text.secondary', '&::first-letter': { textTransform: 'uppercase' } }}>{today}</Typography>
        {mine ? (
          <Box sx={{ mt: 'auto', pt: 1.75, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {chip('/issues?vista=mine', mine.issues, mine.issues === 1 ? 'issue tua' : 'issue tue')}
            {chip('/tasks?vista=mine', mine.tasks, mine.tasks === 1 ? 'task tuo' : 'task tuoi')}
            {chip('/maintenance?vista=over', mine.overdue, mine.overdue === 1 ? 'manutenzione scaduta' : 'manutenzioni scadute', mine.overdue > 0)}
          </Box>
        ) : null}
      </Box>
      {w && w !== 'err' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto', alignContent: 'center', justifyItems: 'start', columnGap: 1.5, rowGap: 0.5 }} title="Bologna, adesso">
          <WeatherGlyph cond={w.cond} night={w.isNight} />
          <Box sx={{ display: 'grid', lineHeight: 1.15 }}>
            <Box component="b" sx={{ fontSize: 34, fontWeight: 650, letterSpacing: '-0.02em', color: (t) => t.palette.archie.tints.sky.ink }}>{w.temp}°</Box>
            <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{CONDITION_LABEL[w.cond]}<br />Bologna · {w.min}°/{w.max}°</Box>
          </Box>
          <Box component="ul" sx={{ gridColumn: '1 / -1', listStyle: 'none', m: 0, mt: 0.5, p: 0, display: 'flex', gap: 0.75 }}>
            {w.next.map((d) => (
              <Box component="li" key={d.day} title={CONDITION_LABEL[d.cond]} sx={{ display: 'grid', justifyItems: 'center', px: 1, py: 0.5, borderRadius: '8px', fontSize: 11, color: 'text.secondary', bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 70%, transparent)`, '& b': { fontSize: 13, color: 'text.primary', fontWeight: 650 } }}>
                <span>{d.day}</span><b>{d.max}°</b>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
    </WidgetShell>
  )
}
