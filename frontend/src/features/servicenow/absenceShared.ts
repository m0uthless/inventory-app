import type { WidgetAccents } from '../../theme/tokens'

// Tipi e helper condivisi per la gestione delle assenze tecnici ServiceNow.
// Usati sia dal dialog per-tecnico nel pannello Triage (ServiceNowCases.tsx)
// sia dalla pagina calendario "Assenze tecnici" (ServiceNowAbsences.tsx).
//
// Backend: /api/servicenow-technician-absences/ (servicenow.api.SnTechnicianAbsenceViewSet),
// basato sulla tabella condivisa `attendance.Absence` a mezza giornata
// (una riga = utente × giorno × fascia MATTINA/POMERIGGIO), la stessa usata
// dal Piano Ferie. Le voci create da qui nascono sempre "validata" (non sono
// proposte del dipendente, ma inserimenti diretti del dispatcher ServiceNow).

export type AbsenceReason = 'ferie' | 'malattia' | 'permesso_104' | 'training' | 'trasferta' | 'altro'
export type DayPart = 'mattina' | 'pomeriggio'

export type AbsenceRow = {
  id: number
  user: number
  user_name: string
  date: string
  day_part: DayPart
  day_part_label: string
  reason: AbsenceReason
  reason_label: string
  note: string
  time_from: string | null
  time_to: string | null
  is_hourly: boolean
  status: 'proposta' | 'validata' | 'rifiutata'
  created_at: string
  updated_at: string
}

export type AbsenceTechnician = {
  id: number
  name: string
  category: 'philips' | 'biotron'
}

export const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'ferie',        label: 'Ferie' },
  { value: 'malattia',     label: 'Malattia/Infortunio' },
  { value: 'permesso_104', label: '104' },
  { value: 'training',     label: 'Training' },
  { value: 'trasferta',    label: 'Trasferta' },
  { value: 'altro',        label: 'Altro' },
]

/**
 * Colori badge per motivo assenza. "training" usa un colore fuori dalla
 * palette semantica (era viola fisso) — per questo dipende dal tema attivo
 * (vedi WidgetAccents.trainingBadgeBg/Text); gli altri motivi restano fissi
 * in tutti i temi (confermato esplicitamente, refactoring colori 0.9.x).
 * STESSA legenda (motivo → colore) esiste in forma leggermente diversa in
 * `features/pianoferie/pianoFerieShared.ts`: da unificare in un secondo
 * momento, non in questo incremento.
 */
export function getAbsenceReasonColors(accents: WidgetAccents): Record<AbsenceReason, { bg: string; fg: string }> {
  return {
    ferie:        { bg: 'rgba(99,153,34,0.14)',   fg: '#3b6d11' },
    malattia:     { bg: 'rgba(226,75,74,0.14)',   fg: '#a32d2d' },
    permesso_104: { bg: 'rgba(219,39,119,0.14)',  fg: '#9d174d' },
    training:     { bg: accents.trainingBadgeBg,  fg: accents.trainingBadgeText },
    trasferta:    { bg: 'rgba(55,138,221,0.14)',  fg: '#185fa5' },
    altro:        { bg: 'rgba(136,135,128,0.16)', fg: '#5f5e5a' },
  }
}

export const ABSENCE_HOURLY_COLOR = { bg: 'rgba(186,117,23,0.16)', fg: '#854f0b' }

export const DAY_PART_OPTIONS: { value: DayPart; label: string; short: string }[] = [
  { value: 'mattina',    label: 'Mattina',    short: 'M' },
  { value: 'pomeriggio', label: 'Pomeriggio', short: 'P' },
]

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatItDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// "14:00:00" (formato DRF) -> "14:00"
export function formatItTime(hms: string | null): string {
  if (!hms) return ''
  return hms.slice(0, 5)
}

// Lunedì della settimana contenente `d` (locale, non UTC).
export function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = domenica
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** La riga (al più una, vincolo unique lato DB) per utente/giorno/fascia. */
export function findAbsence(
  absences: AbsenceRow[], userId: number, dateISO: string, dayPart: DayPart,
): AbsenceRow | null {
  return absences.find((a) => a.user === userId && a.date === dateISO && a.day_part === dayPart) ?? null
}

/** Validazione lato client, rispecchia le regole del serializer DRF. */
export function validateAbsencePayload(p: { timeFrom: string | null; timeTo: string | null }): string | null {
  if (p.timeFrom || p.timeTo) {
    if (!(p.timeFrom && p.timeTo)) return "Per un permesso orario vanno indicate sia l'ora di inizio sia l'ora di fine."
    if (p.timeTo <= p.timeFrom) return "L'ora di fine deve essere successiva all'ora di inizio."
  }
  return null
}
