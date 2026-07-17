// Tipi e helper condivisi per la gestione delle assenze tecnici ServiceNow.
// Usati sia dal dialog per-tecnico nel pannello Triage (ServiceNowCases.tsx)
// sia dalla pagina calendario "Assenze tecnici" (ServiceNowAbsences.tsx).

export type AbsenceReason = 'ferie' | 'malattia' | 'trasferta' | 'altro'

export type AbsenceRow = {
  id: number
  user: number
  user_name: string
  date_from: string
  date_to: string
  reason: AbsenceReason
  reason_label: string
  note: string
  time_from: string | null
  time_to: string | null
  is_hourly: boolean
}

export type AbsenceTechnician = {
  id: number
  name: string
  category: 'philips' | 'biotron'
}

export const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'ferie', label: 'Ferie' },
  { value: 'malattia', label: 'Malattia' },
  { value: 'trasferta', label: 'Trasferta' },
  { value: 'altro', label: 'Altro' },
]

export const ABSENCE_REASON_COLORS: Record<AbsenceReason, { bg: string; fg: string }> = {
  ferie:     { bg: 'rgba(99,153,34,0.14)',  fg: '#3b6d11' },
  malattia:  { bg: 'rgba(226,75,74,0.14)',  fg: '#a32d2d' },
  trasferta: { bg: 'rgba(55,138,221,0.14)', fg: '#185fa5' },
  altro:     { bg: 'rgba(136,135,128,0.16)', fg: '#5f5e5a' },
}

export const ABSENCE_HOURLY_COLOR = { bg: 'rgba(186,117,23,0.16)', fg: '#854f0b' }

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

export function absenceCoversDate(a: AbsenceRow, iso: string): boolean {
  return a.date_from <= iso && a.date_to >= iso
}

/** Validazione lato client, rispecchia le regole del serializer DRF. */
export function validateAbsencePayload(p: {
  dateFrom: string; dateTo: string; timeFrom: string | null; timeTo: string | null
}): string | null {
  if (p.dateTo < p.dateFrom) return 'La data di fine non può precedere quella di inizio.'
  if (p.timeFrom || p.timeTo) {
    if (!(p.timeFrom && p.timeTo)) return "Per un'assenza oraria vanno indicate sia l'ora di inizio sia l'ora di fine."
    if (p.dateFrom !== p.dateTo) return "Un'assenza oraria (permesso) deve riguardare un solo giorno (Dal = Al)."
    if (p.timeTo <= p.timeFrom) return "L'ora di fine deve essere successiva all'ora di inizio."
  }
  return null
}
