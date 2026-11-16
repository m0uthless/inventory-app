// Modello della pagina Piano ferie (restyle "Campo sterile", anteprima pf-base).
// Il backend ragiona per mezze giornate (`Absence` = utente × giorno × fascia);
// la pagina ragiona per "richieste": le mezze giornate create dalla stessa
// selezione condividono `request_group`. Le righe senza gruppo (dati storici)
// si uniscono per persona, motivo, stato e nota su giorni lavorativi contigui.

import {
  type AbsenceReason, type AbsenceRow, type AbsenceStatus, type HolidayRow, type RosterRow,
  holidaysForArea, swatchFor, toISODate,
} from './pianoFerieShared'

export type PfRow = AbsenceRow & { created_at?: string }

/** Fascia di una richiesta: giornata intera, solo mattina, solo pomeriggio o mista. */
export type PfPart = 'all' | 'mat' | 'pom' | 'mixed'

export type PfRequest = {
  key: string
  ids: number[]
  rows: PfRow[]
  user: number
  userName: string
  from: string
  to: string
  part: PfPart
  reason: AbsenceReason
  status: AbsenceStatus
  note: string
  requestGroup: string | null
  /** Giorni lavorativi (mezze giornate / 2). */
  days: number
  createdAt: string | null
  validatedByName: string | null
  validatedAt: string | null
  hourly: { from: string; to: string } | null
}

/** Chiave colore della legenda HR (stessi colori di pianoFerieShared). */
export type SwatchKey = 'ferie_p' | 'ferie_v' | 'malattia' | 'permesso_104' | 'training' | 'trasferta' | 'altro' | 'rifiutata'

export const SWATCH_KEYS: SwatchKey[] = ['ferie_p', 'ferie_v', 'malattia', 'permesso_104', 'training', 'trasferta', 'altro']

export const SWATCH_LABEL: Record<SwatchKey, string> = {
  ferie_p: 'Ferie (proposta)', ferie_v: 'Ferie (validata)', malattia: 'Malattia/Infortunio', permesso_104: '104',
  training: 'Training', trasferta: 'Trasferta', altro: 'Altro', rifiutata: 'Rifiutata',
}

export function swatchKey(reason: AbsenceReason, status: AbsenceStatus): SwatchKey {
  if (status === 'rifiutata') return 'rifiutata'
  if (reason === 'ferie') return status === 'validata' ? 'ferie_v' : 'ferie_p'
  return reason
}

export function swatchOfKey(k: SwatchKey) {
  if (k === 'rifiutata') return swatchFor('ferie', 'rifiutata')
  if (k === 'ferie_p') return swatchFor('ferie', 'proposta')
  if (k === 'ferie_v') return swatchFor('ferie', 'validata')
  return swatchFor(k, 'validata')
}

export const REASON_LABEL: Record<AbsenceReason, string> = {
  ferie: 'Ferie', malattia: 'Malattia/Infortunio', permesso_104: '104', training: 'Training', trasferta: 'Trasferta', altro: 'Altro',
}
export const STATUS_LABEL: Record<AbsenceStatus, string> = { proposta: 'Proposta', validata: 'Validata', rifiutata: 'Rifiutata' }
export const PART_LABEL: Record<PfPart, string> = { all: 'giornata intera', mat: 'mattina', pom: 'pomeriggio', mixed: 'fasce miste' }

// ─── Date ───────────────────────────────────────────────────────────────────

export const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const MSH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export const WD = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']
export const WD_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const WD_LOW = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

export const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s: string, n: number) => { const d = parseIso(s); d.setDate(d.getDate() + n); return toISODate(d) }
export const ddmm = (s: string) => { const d = parseIso(s); return `${d.getDate()} ${MSH[d.getMonth()]}` }
export const ddmmyyyy = (s: string) => s.split('-').reverse().join('/')
export const wdShort = (s: string) => WD_LOW[parseIso(s).getDay()]
export const monthShort = (s: string) => MSH[parseIso(s).getMonth()]

/** "16–20 nov", "30 nov", "28 nov – 3 dic". */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return ddmm(from)
  if (from.slice(0, 7) === to.slice(0, 7)) return `${parseIso(from).getDate()}–${ddmm(to)}`
  return `${ddmm(from)} – ${ddmm(to)}`
}

/** "1 giorno", "2,5 giorni". */
export const gg = (n: number) => `${String(n).replace('.', ',')} ${n === 1 ? 'giorno' : 'giorni'}`

export function monthDays(year: number, month: number): string[] {
  const n = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => toISODate(new Date(year, month, i + 1)))
}

export function* eachDay(from: string, to: string): Generator<string> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d
}

// ─── Calendario per area (weekend + festività) ─────────────────────────────

export type OffCalendar = {
  isOff: (iso: string, areaId: number | null) => boolean
  holiday: (iso: string) => string | null
}

export function buildOffCalendar(holidays: HolidayRow[]): OffCalendar {
  const byArea = new Map<string, Map<string, string>>()
  const all = new Map<string, string[]>()
  for (const h of holidays) all.set(h.date, [...(all.get(h.date) ?? []), h.label])
  const forArea = (areaId: number | null) => {
    const k = String(areaId)
    let m = byArea.get(k)
    if (!m) { m = holidaysForArea(holidays, areaId); byArea.set(k, m) }
    return m
  }
  return {
    isOff: (iso, areaId) => { const g = parseIso(iso).getDay(); return g === 0 || g === 6 || forArea(areaId).has(iso) },
    holiday: (iso) => all.get(iso)?.join(', ') ?? null,
  }
}

/** Giorni lavorativi di una persona nell'intervallo (estremi inclusi). */
export function workDates(from: string, to: string, areaId: number | null, cal: OffCalendar): string[] {
  const out: string[] = []
  if (!from || !to || to < from) return out
  for (const d of eachDay(from, to)) if (!cal.isOff(d, areaId)) out.push(d)
  return out
}

// ─── Richieste ─────────────────────────────────────────────────────────────

function partOf(rows: PfRow[]): PfPart {
  const byDate = new Map<string, Set<string>>()
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? new Set()).add(r.day_part))
  const sets = [...byDate.values()]
  if (sets.every((s) => s.size === 2)) return 'all'
  if (sets.every((s) => s.size === 1 && s.has('mattina'))) return 'mat'
  if (sets.every((s) => s.size === 1 && s.has('pomeriggio'))) return 'pom'
  return 'mixed'
}

function toRequest(key: string, rows: PfRow[]): PfRequest {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.day_part.localeCompare(b.day_part))
  const first = sorted[0]
  const hourlyRow = sorted.find((r) => r.is_hourly && r.time_from && r.time_to)
  const created = sorted.map((r) => r.created_at).filter(Boolean).sort()[0] ?? null
  const validated = sorted.filter((r) => r.validated_at).sort((a, b) => String(b.validated_at).localeCompare(String(a.validated_at)))[0]
  return {
    key, rows: sorted, ids: sorted.map((r) => r.id), user: first.user, userName: first.user_name,
    from: sorted[0].date, to: sorted[sorted.length - 1].date, part: partOf(sorted),
    reason: first.reason, status: first.status, note: sorted.find((r) => r.note)?.note ?? '',
    requestGroup: first.request_group, days: sorted.length / 2, createdAt: created,
    validatedByName: validated?.validated_by_name ?? null, validatedAt: validated?.validated_at ?? null,
    hourly: hourlyRow ? { from: hourlyRow.time_from!.slice(0, 5), to: hourlyRow.time_to!.slice(0, 5) } : null,
  }
}

/**
 * Raggruppa le mezze giornate in richieste. Stesso `request_group` + stesso
 * motivo e stato = una richiesta (se il coordinatore ha validato solo una parte,
 * diventano due). Senza gruppo: persona+motivo+stato+nota su giorni lavorativi
 * contigui (`isOff` dice quali giorni saltare senza spezzare).
 */
export function groupRequests(rows: PfRow[], isOff: (iso: string, userId: number) => boolean): PfRequest[] {
  const grouped = new Map<string, PfRow[]>()
  const loose = new Map<string, PfRow[]>()
  for (const r of rows) {
    if (r.request_group) {
      const k = `${r.request_group}|${r.reason}|${r.status}`
      grouped.set(k, [...(grouped.get(k) ?? []), r])
    } else {
      const k = `${r.user}|${r.reason}|${r.status}|${r.note}`
      loose.set(k, [...(loose.get(k) ?? []), r])
    }
  }
  const out: PfRequest[] = []
  grouped.forEach((rs, k) => out.push(toRequest(`g:${k}`, rs)))
  loose.forEach((rs, k) => {
    const sorted = [...rs].sort((a, b) => a.date.localeCompare(b.date))
    let cur: PfRow[] = []
    const flush = () => { if (cur.length) out.push(toRequest(`l:${k}|${cur[0].date}`, cur)); cur = [] }
    for (const r of sorted) {
      const last = cur[cur.length - 1]
      if (last && last.date !== r.date) {
        // contiguo se fra i due giorni ci sono solo giorni non lavorativi
        let gap = false
        for (let d = addDays(last.date, 1); d < r.date; d = addDays(d, 1)) if (!isOff(d, r.user)) { gap = true; break }
        if (gap) flush()
      }
      cur.push(r)
    }
    flush()
  })
  return out.sort((a, b) => a.from.localeCompare(b.from) || a.userName.localeCompare(b.userName))
}

// ─── Celle e copertura ─────────────────────────────────────────────────────

export type HalfCell = { mat: PfRow | null; pom: PfRow | null }

/** Indice "utente|giorno" → mezze giornate. */
export function indexCells(rows: PfRow[]): Map<string, HalfCell> {
  const m = new Map<string, HalfCell>()
  for (const r of rows) {
    const k = `${r.user}|${r.date}`
    const c = m.get(k) ?? { mat: null, pom: null }
    if (r.day_part === 'mattina') c.mat = r; else c.pom = r
    m.set(k, c)
  }
  return m
}

const active = (r: PfRow | null) => Boolean(r && r.status !== 'rifiutata')

/** Assente (anche solo mezza giornata, voce non rifiutata). */
export const absentOn = (c: HalfCell | undefined) => Boolean(c && (active(c.mat) || active(c.pom)))
/** Assente tutto il giorno: conta come "non presente" nella copertura. */
export const absentFull = (c: HalfCell | undefined) => Boolean(c && active(c.mat) && active(c.pom))

export type CovLevel = 'ok' | 'mid' | 'low'
/** Soglie fisse: sotto il 60% dei presenti dell'area = bassa, sotto l'80% = da guardare. */
export const COV_LOW = 0.6
export const COV_MID = 0.8
export function covLevel(present: number, total: number): CovLevel {
  if (!total) return 'ok'
  const r = present / total
  return r < COV_LOW ? 'low' : r < COV_MID ? 'mid' : 'ok'
}

export function presentCount(people: RosterRow[], day: string, cells: Map<string, HalfCell>, exclude?: number): number {
  return people.filter((p) => p.id !== exclude && !absentFull(cells.get(`${p.id}|${day}`))).length
}

/** Giorni in cui, accettando la richiesta, l'area scenderebbe sotto la soglia bassa. */
export function requestCoverage(req: PfRequest, areaPeople: RosterRow[], cells: Map<string, HalfCell>, areaId: number | null, cal: OffCalendar) {
  const total = areaPeople.length
  return workDates(req.from, req.to, areaId, cal).map((d) => {
    const present = presentCount(areaPeople, d, cells, req.user)
    return { day: d, present, total, level: covLevel(present, total) }
  })
}
