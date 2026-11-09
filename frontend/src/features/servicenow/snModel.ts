import { formatItDate, formatItTime, type AbsenceReason } from './absenceShared'

export type ServiceNowCaseRow = {
  id: number
  number: string
  account: string
  short_description: string
  priority: string
  priority_label: string
  category: string
  category_label: string
  case_type: number
  case_type_label: string
  opened_date: string | null
  opened_time: string | null
  screenshot_url: string | null
  status: string
  status_label: string
  assigned_to: number | null
  assigned_to_username: string | null
  assigned_to_full_name: string | null
  assigned_to_avatar: string | null
  external_url: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** "Aperto il": data e ora se ci sono entrambe. */
export function formatOpenedAt(row: { opened_date: string | null; opened_time: string | null }): string | null {
  if (!row.opened_date) return null
  const time = row.opened_time ? ` · ${formatItTime(row.opened_time)}` : ''
  return `${formatItDate(row.opened_date)}${time}`
}

// ── Triage (casi di oggi per tecnico) ──
export type TriageTechnician = { id: number | null; name: string; count: number; absent?: boolean; absence_reason?: string | null }
export type TriageCategoryData = { total: number; technicians: TriageTechnician[] }
export type TriageResponse = { date: string; categories: Record<string, TriageCategoryData> }

// ── Statistiche ──
export type StatsPeriod = { key: number; label: string }
export type StatsSeries = {
  user_id: number | null
  name: string
  counts: number[]
  absence_periods?: (string | null)[]
  type_totals?: Record<string, number>
  type_totals_by_period?: Record<string, number>[]
}
export type StatsResponse = {
  granularity: 'day' | 'week' | 'month'
  year: number
  periods: StatsPeriod[]
  series: StatsSeries[]
  kpi: { total: number; top_technician: { id: number | null; name: string; count: number } | null; top_type: { value: number; label: string; count: number } | null }
  type_breakdown: { id: number; name: string; count: number }[]
}
export type Granularity = 'month' | 'week' | 'day'
export type CaseTypeOption = { id: number; name: string; category: string }

/** Totali per periodo (somma delle serie) e per type in ogni periodo. */
export function periodTotals(d: StatsResponse): { total: number; byType: Record<string, number> }[] {
  return d.periods.map((_p, i) => {
    const byType: Record<string, number> = {}
    let total = 0
    d.series.forEach((s) => {
      total += s.counts[i] ?? 0
      Object.entries(s.type_totals_by_period?.[i] ?? {}).forEach(([k, v]) => { byType[k] = (byType[k] ?? 0) + v })
    })
    return { total, byType }
  })
}

/**
 * Palette categoriale dei type (verificata per daltonismo, chiaro e scuro):
 * l'ordine segue i type configurati, non il loro peso, così un filtro non ridipinge i colori.
 */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']
export const typeColor = (typeNames: string[], name: string, dark: boolean) => {
  const i = typeNames.indexOf(name)
  const pal = dark ? SERIES_DARK : SERIES_LIGHT
  return i >= 0 && i < pal.length ? pal[i] : dark ? '#7d8796' : '#9aa3ae'
}

/** Tinta del motivo di assenza (chiavi di palette.archie.tints). */
export const REASON_TINT: Record<AbsenceReason | 'hourly', 'mint' | 'rose' | 'lilac' | 'sky' | 'sand' | 'peach' | 'neutral'> = {
  ferie: 'mint', malattia: 'rose', permesso_104: 'lilac', training: 'sky', trasferta: 'sand', altro: 'neutral', hourly: 'peach',
}

export const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
export const MONTHS_LONG = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export const firstName = (n: string) => n.trim().split(/\s+/)[0] || n
export const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/).map((x) => x.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean)
  if (!p.length) return '?'
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

/** Testo della richiesta di task partendo da un caso. */
export function taskPrefillFromCase(c: { number: string; account: string; short_description: string }) {
  const title = (c.short_description.trim() || `Caso ServiceNow ${c.number}`).slice(0, 255)
  const description = [`Caso ServiceNow ${c.number} · ${c.account}`, c.short_description.trim()].filter(Boolean).join('\n\n')
  return { title, description }
}
