/** Meteo (Bologna) e riepilogo personale per la fascia "Aurora" della Dashboard. */
import * as React from 'react'
import { api } from '@shared/api/client'
import { wmoToCondition, type Condition } from './widgets/weatherModel'

export type Weather = { temp: number; cond: Condition; isNight: boolean; wind: number; min: number; max: number; next: { day: string; max: number; cond: Condition }[] }

export function useWeather() {
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
export function useMine(meId: number | undefined) {
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


/** Colleghi assenti oggi (Piano ferie). null = non visibile all'utente (403) o non ancora caricato. */
export function useAwayToday() {
  const [n, setN] = React.useState<number | null>(null)
  React.useEffect(() => {
    const d = new Date()
    const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    let alive = true
    api.get<{ user: number; status: string }[]>('/absences/', { params: { date_from: t, date_to: t } })
      .then((r) => { if (alive) setN(new Set((Array.isArray(r.data) ? r.data : []).filter((a) => a.status !== 'rifiutata').map((a) => a.user)).size) })
      .catch(() => { if (alive) setN(null) })
    return () => { alive = false }
  }, [])
  return n
}

/** Settimana dell'anno (ISO 8601). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
