import type { CampoIconName } from '../../ui/campo'
import type { BillingFrequency, ContractDetail, ContractStatus, ContractType } from './types'

/** Stato del modulo contratto, condiviso da «Passi» (creazione) e «Scheda unica» (modifica). */
export type ContractForm = {
  code: string
  title: string
  /** Il titolo segue tipo e cliente finché l'utente non lo modifica. */
  titleTouched: boolean
  customer: number | null
  contract_type: ContractType | ''
  seller: number | null
  /** `null` in creazione = società proposta dal cliente. */
  company: number | null
  start_date: string
  /** Durata in mesi; 0 = data di fine scelta a mano (`end_date`). */
  duration: number
  end_date: string
  notice_days: number
  auto_renew: boolean
  total_value: string
  billing_freq: BillingFrequency
  status: ContractStatus
  devices: number[]
  notes: string
}

export const DURATIONS = [12, 24, 36, 60]
export const NOTICE_PRESETS = [30, 60, 90, 180]

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s: string, n: number) => { const d = fromIso(s); d.setDate(d.getDate() + n); return toIso(d) }
export const addMonths = (s: string, n: number) => { const d = fromIso(s); d.setMonth(d.getMonth() + n); return toIso(d) }
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Primo giorno del mese prossimo: inizio proposto per un contratto nuovo. */
export function nextMonthStart(today = new Date()) {
  return toIso(new Date(today.getFullYear(), today.getMonth() + 1, 1))
}

/** Fine del contratto: dalla durata (inizio + N mesi − 1 giorno) o dalla data scelta. */
export function endOf(f: Pick<ContractForm, 'start_date' | 'duration' | 'end_date'>) {
  if (!isIsoDate(f.start_date)) return f.end_date
  return f.duration ? addDays(addMonths(f.start_date, f.duration), -1) : f.end_date
}

/** Durata "tonda" che produce esattamente quelle date, altrimenti 0 (fine a mano). */
export function durationFromDates(start: string, end: string) {
  return DURATIONS.find((m) => addDays(addMonths(start, m), -1) === end) ?? 0
}

export const monthsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / (30.44 * 86_400_000)))

export function invoiceCount(freq: BillingFrequency, months: number) {
  return { una_tantum: 1, mensile: months, trimestrale: Math.ceil(months / 3), annuale: Math.ceil(months / 12) }[freq]
}

/** Valore digitato all'italiana ("48.000,50") o col punto ("48000.50"). */
export function parseMoney(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  // Virgola = decimali all'italiana; "36.000" o "1.250.000" = punti delle migliaia; altrimenti il punto è decimale.
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t
  const n = Number(norm)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export function emptyForm(customer: number | null): ContractForm {
  return {
    code: '', title: '', titleTouched: false, customer, contract_type: '', seller: null, company: null,
    start_date: nextMonthStart(), duration: 12, end_date: '', notice_days: 90, auto_renew: false,
    total_value: '', billing_freq: 'annuale', status: 'attivo', devices: [], notes: '',
  }
}

export function formFromContract(c: ContractDetail): ContractForm {
  return {
    code: c.code, title: c.title, titleTouched: true, customer: c.customer, contract_type: c.contract_type,
    seller: c.seller, company: c.company, start_date: c.start_date, duration: durationFromDates(c.start_date, c.end_date),
    end_date: c.end_date, notice_days: c.notice_days ?? 0, auto_renew: c.auto_renew,
    total_value: c.total_value != null && c.total_value !== '' ? Number(c.total_value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', billing_freq: c.billing_freq, status: c.status,
    devices: c.devices ?? [], notes: c.notes ?? '',
  }
}

export type FormErrors = Partial<Record<'code' | 'title' | 'customer' | 'contract_type' | 'start_date' | 'end_date' | 'notice_days' | 'total_value' | 'devices' | 'seller' | 'company' | 'notes' | 'status' | 'billing_freq', string>>

/** Controlli lato client. `fields` limita i controlli a quelli di un passo. */
export function validate(f: ContractForm, title: string, canViewValue: boolean, fields?: (keyof FormErrors)[]): FormErrors {
  const e: FormErrors = {}
  const end = endOf(f)
  if (f.customer == null) e.customer = 'Scegli il cliente.'
  if (!f.contract_type) e.contract_type = 'Scegli il tipo.'
  if (!isIsoDate(f.start_date)) e.start_date = "Indica la data di inizio."
  if (!isIsoDate(end)) e.end_date = 'Indica la data di fine.'
  else if (isIsoDate(f.start_date) && end < f.start_date) e.end_date = "La fine non può precedere l'inizio."
  if (!Number.isInteger(f.notice_days) || f.notice_days < 0 || f.notice_days > 3650) e.notice_days = 'Giorni di preavviso non validi.'
  if (!f.code.trim()) e.code = 'Serve un codice.'
  if (!title.trim()) e.title = 'Serve un titolo.'
  if (canViewValue && Number.isNaN(parseMoney(f.total_value))) e.total_value = 'Valore non valido.'
  if (!fields) return e
  return Object.fromEntries(Object.entries(e).filter(([k]) => fields.includes(k as keyof FormErrors))) as FormErrors
}

export function toPayload(f: ContractForm, title: string, canViewValue: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    code: f.code.trim(), title: title.trim(), customer: f.customer, contract_type: f.contract_type,
    seller: f.seller, company: f.company, start_date: f.start_date, end_date: endOf(f),
    notice_days: f.notice_days, auto_renew: f.auto_renew, billing_freq: f.billing_freq, status: f.status,
    devices: f.devices, notes: f.notes.trim(),
  }
  if (canViewValue) { const v = parseMoney(f.total_value); payload.total_value = (v ?? 0).toFixed(2) }
  return payload
}

/** Codice proposto: il successivo dell'ultimo codice dell'anno ("CTR-2026-021"), modificabile. */
export function nextCode(lastCode: string | null | undefined, year = new Date().getFullYear()) {
  const m = lastCode?.match(/^(.*?)(\d+)$/)
  if (m && lastCode?.includes(String(year))) return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}`
  return `CTR-${year}-001`
}

export const TYPE_CARDS: { value: ContractType; label: string; icon: CampoIconName; hint: string }[] = [
  { value: 'assistenza', label: 'Assistenza', icon: 'wrench', hint: 'Manutenzione e supporto' },
  { value: 'noleggio', label: 'Noleggio', icon: 'monitor', hint: 'Apparecchiature a canone' },
  { value: 'licenza', label: 'Licenza', icon: 'key', hint: 'Software RIS, PACS…' },
  { value: 'altro', label: 'Altro', icon: 'file', hint: 'Formazione, consulenza' },
]
