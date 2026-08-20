// Tipi e helper condivisi per il Piano Ferie (pagina PianoFerie.tsx).
// Il modello backend è `attendance.Absence`: una riga = utente × giorno ×
// fascia (MAT/POM). Una giornata intera = due righe.

export type DayPart = 'mattina' | 'pomeriggio'

export type AbsenceReason =
  | 'ferie' | 'malattia' | 'permesso_104' | 'training' | 'trasferta' | 'altro'

export type AbsenceStatus = 'proposta' | 'validata' | 'rifiutata'

export type AbsenceRow = {
  id: number
  user: number
  user_name: string
  date: string            // ISO yyyy-mm-dd
  day_part: DayPart
  day_part_label: string
  reason: AbsenceReason
  reason_label: string
  status: AbsenceStatus
  status_label: string
  note: string
  time_from: string | null
  time_to: string | null
  is_hourly: boolean
  request_group: string | null
  validated_by: number | null
  validated_by_name: string | null
  validated_at: string | null
}

export type RosterRow = {
  id: number
  name: string
  area_id: number | null
  area_label: string | null
  area_sort: number
}

export type RosterResponse = {
  can_edit_all: boolean
  is_full_access: boolean
  current_user_id: number
  current_user_area_id: number | null
  rows: RosterRow[]
}

export const DAY_PARTS: { value: DayPart; label: string; short: string }[] = [
  { value: 'mattina', label: 'Mattina', short: 'MAT' },
  { value: 'pomeriggio', label: 'Pomeriggio', short: 'POM' },
]

export const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'ferie', label: 'Ferie' },
  { value: 'malattia', label: 'Malattia/Infortunio' },
  { value: 'permesso_104', label: '104' },
  { value: 'training', label: 'Training' },
  { value: 'trasferta', label: 'Trasferta' },
  { value: 'altro', label: 'Altro' },
]

export const ABSENCE_STATUSES: { value: AbsenceStatus; label: string }[] = [
  { value: 'proposta', label: 'Proposta' },
  { value: 'validata', label: 'Validata' },
  { value: 'rifiutata', label: 'Rifiutata' },
]

type Swatch = { bg: string; fg: string }

// ECCEZIONE STRUTTURALE al sistema di tema (refactoring colori 0.9.x,
// confermata esplicitamente): colore cella = f(reason, status), rispecchia
// la legenda dell'Excel usata da HR — resta fisso in ogni tema
//  per non rompere l'associazione già imparata da chi
// usa lo strumento. STESSA legenda (reason → colore) esiste in forma
// leggermente diversa in `features/servicenow/absenceShared.ts`: da
// unificare in un secondo momento, non in questo incremento.
//   ferie proposta → giallo · ferie validata → verde · malattia → rosso
//   104 → rosa · training → azzurro/indaco · trasferta → blu · altro → grigio
const FERIE_PROPOSTA: Swatch = { bg: 'rgba(245,197,24,0.28)', fg: '#8a6d0b' }   // giallo
const FERIE_VALIDATA: Swatch = { bg: 'rgba(0,176,80,0.20)',  fg: '#2f7d32' }   // verde (#00B050)

const REASON_COLORS: Record<AbsenceReason, Swatch> = {
  ferie:        FERIE_VALIDATA, // ferie senza stato → verde (override sotto per proposta)
  malattia:     { bg: 'rgba(243,115,115,0.24)', fg: '#b23b3b' }, // rosso (#F37373)
  permesso_104: { bg: 'rgba(242,184,245,0.34)', fg: '#8e3d92' }, // rosa (#F2B8F5)
  training:     { bg: 'rgba(99,102,241,0.18)',  fg: '#4338ca' }, // azzurro/indaco
  trasferta:    { bg: 'rgba(55,138,221,0.18)',  fg: '#185fa5' }, // blu
  altro:        { bg: 'rgba(172,185,202,0.30)', fg: '#5f6b7a' }, // grigio (#ACB9CA)
}

const RIFIUTATA: Swatch = { bg: 'rgba(120,120,120,0.10)', fg: '#8a8a8a' }

/** Colore della cella per una voce. */
export function swatchFor(reason: AbsenceReason, status: AbsenceStatus): Swatch {
  if (status === 'rifiutata') return RIFIUTATA
  if (reason === 'ferie') return status === 'validata' ? FERIE_VALIDATA : FERIE_PROPOSTA
  return REASON_COLORS[reason]
}

/** Voci di legenda (reason+status con colori distinti). */
export const LEGEND: { label: string; swatch: Swatch }[] = [
  { label: 'Ferie (proposta)', swatch: FERIE_PROPOSTA },
  { label: 'Ferie (validata)', swatch: FERIE_VALIDATA },
  { label: 'Malattia/Infortunio', swatch: REASON_COLORS.malattia },
  { label: '104', swatch: REASON_COLORS.permesso_104 },
  { label: 'Training', swatch: REASON_COLORS.training },
  { label: 'Trasferta', swatch: REASON_COLORS.trasferta },
  { label: 'Altro', swatch: REASON_COLORS.altro },
]

// ─── Helper data ──────────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Giorni (Date) del mese `month` (0-based) di `year`. */
export function daysInMonth(year: number, month: number): Date[] {
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => new Date(year, month, i + 1))
}

/** true se sabato/domenica (colonne weekend attenuate). */
export function isWeekend(d: Date): boolean {
  const g = d.getDay()
  return g === 0 || g === 6
}

export const MONTH_LABELS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]
export const MONTH_SHORT_IT = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
]

/** Sigla giorno settimana, indicizzata come Date.getDay() (0 = domenica). */
export const WEEKDAY_SHORT_IT = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']

/** Indicizza le voci per accesso rapido: "userId|isoDate|dayPart" → riga. */
export function indexAbsences(rows: AbsenceRow[]): Map<string, AbsenceRow> {
  const m = new Map<string, AbsenceRow>()
  for (const r of rows) m.set(`${r.user}|${r.date}|${r.day_part}`, r)
  return m
}

export function cellKey(userId: number, iso: string, part: DayPart): string {
  return `${userId}|${iso}|${part}`
}

/** Iniziali (1-2 lettere) da un nome completo, per gli avatar del roster. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Festività ───────────────────────────────────────────────────────────────

/** Domenica di Pasqua (algoritmo di Meeus/Gauss, calendario gregoriano). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=marzo, 4=aprile
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/**
 * Festività nazionali italiane per l'anno indicato: iso → etichetta.
 * NB: i patroni locali (es. San Petronio a Bologna) NON sono inclusi —
 * si possono aggiungere in un secondo momento (es. da un elenco lato admin).
 */
export function italianHolidays(year: number): Map<string, string> {
  const m = new Map<string, string>()
  const fixed: [number, number, string][] = [
    [1, 1, 'Capodanno'],
    [1, 6, 'Epifania'],
    [4, 25, 'Liberazione'],
    [5, 1, 'Festa del Lavoro'],
    [6, 2, 'Festa della Repubblica'],
    [8, 15, 'Ferragosto'],
    [11, 1, 'Ognissanti'],
    [12, 8, 'Immacolata'],
    [12, 25, 'Natale'],
    [12, 26, 'Santo Stefano'],
  ]
  for (const [mm, dd, label] of fixed) {
    m.set(toISODate(new Date(year, mm - 1, dd)), label)
  }
  // Pasquetta (lunedì dell'Angelo): domenica di Pasqua + 1 giorno.
  const em = easterSunday(year)
  em.setDate(em.getDate() + 1)
  m.set(toISODate(em), "Lunedì dell'Angelo")
  return m
}

export function isHoliday(iso: string, holidays: Map<string, string>): boolean {
  return holidays.has(iso)
}

/** Giorno non selezionabile: weekend oppure festività. */
export function isBlocked(d: Date, holidays: Map<string, string>): boolean {
  return isWeekend(d) || holidays.has(toISODate(d))
}

// ─── Festività dal backend ────────────────────────────────────────────────────
// `Holiday.area_ids` vuoto = vale per tutte le aree; valorizzato = vale solo
// per le aree indicate (es. patrono locale, chiusura di uno stabilimento).

export type HolidayRow = {
  id: number
  date: string
  label: string
  area_ids: number[]
}

/** Festività applicabili a una specifica area (o "tutte le aree" se area_id è null). */
export function holidaysForArea(rows: HolidayRow[], areaId: number | null): Map<string, string> {
  const m = new Map<string, string>()
  for (const h of rows) {
    const appliesToAll = h.area_ids.length === 0
    const appliesToArea = areaId != null && h.area_ids.includes(areaId)
    if (appliesToAll || appliesToArea) m.set(h.date, h.label)
  }
  return m
}
