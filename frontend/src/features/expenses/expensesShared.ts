// Tipi e costanti condivise per il modulo Rimborso Spese.

export type ExpenseCategory =
  | 'treni'
  | 'taxi_comune'
  | 'taxi_fuori_comune'
  | 'autostrade'
  | 'rimborso_km'
  | 'varie_automezzi'
  | 'carburanti'
  | 'pernottamento'
  | 'pasti'
  | 'rappresentanza'
  | 'telefoniche'
  | 'varie'

export type ExpenseReportStatus = 'bozza' | 'inviata' | 'validata' | 'rifiutata'

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  treni: 'Treni, pullman',
  taxi_comune: 'Taxi/bus/autonoleggio nel comune',
  taxi_fuori_comune: 'Taxi/bus/autonoleggio fuori comune',
  autostrade: 'Autostrade',
  rimborso_km: 'Rimborso chilometraggio',
  varie_automezzi: 'Varie automezzi (lavaggio/parcheggi/manutenzioni fino a 50€)',
  carburanti: 'Carburanti e lubrificanti',
  pernottamento: 'Pernottamento',
  pasti: 'Pasti (ristorante/bar)',
  rappresentanza: 'Spese di rappresentanza',
  telefoniche: 'Spese telefoniche',
  varie: 'Varie',
}

export const CATEGORY_ORDER: ExpenseCategory[] = [
  'treni', 'taxi_comune', 'taxi_fuori_comune', 'autostrade', 'rimborso_km',
  'varie_automezzi', 'carburanti', 'pernottamento', 'pasti', 'rappresentanza',
  'telefoniche', 'varie',
]

export const MONTH_NAMES_IT = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export const STATUS_LABELS: Record<ExpenseReportStatus, string> = {
  bozza: 'Bozza',
  inviata: 'Inviata',
  validata: 'Validata',
  rifiutata: 'Rifiutata',
}

export const STATUS_COLORS: Record<ExpenseReportStatus, { bg: string; fg: string; border: string }> = {
  bozza:     { bg: 'rgba(148,163,184,0.14)', fg: '#475569', border: 'rgba(148,163,184,0.32)' },
  inviata:   { bg: 'rgba(59,130,246,0.10)',  fg: '#1e40af', border: 'rgba(59,130,246,0.28)' },
  validata:  { bg: 'rgba(34,197,94,0.12)',   fg: '#166534', border: 'rgba(34,197,94,0.30)' },
  rifiutata: { bg: 'rgba(239,68,68,0.10)',   fg: '#991b1b', border: 'rgba(239,68,68,0.28)' },
}

export type ExpenseReceiptRow = {
  id: number
  item: number
  file_url: string | null
  file_name: string | null
  ocr_amount: string | null
  ocr_date: string | null
  created_at: string
}

export type ExpenseKmTripRow = {
  id: number
  item: number
  date: string
  destination: string
  km: number
}

export type ExpenseItemRow = {
  id: number
  report: number
  category: ExpenseCategory
  category_label: string
  is_km_category: boolean
  date: string | null
  description: string
  amount: string
  km_trips: ExpenseKmTripRow[]
  receipts: ExpenseReceiptRow[]
}

export type ExpenseReportRow = {
  id: number
  user: number
  user_name: string
  year: number
  month: number
  number: string
  month_label: string
  advances_total: string
  note: string
  status: ExpenseReportStatus
  status_label: string
  rejection_reason: string
  validated_by: number | null
  validated_by_name: string | null
  validated_at: string | null
  total_expenses: string
  total_due: string
  items: ExpenseItemRow[]
  created_at: string
  updated_at: string
}

export function isReportEditable(report: Pick<ExpenseReportRow, 'status'>): boolean {
  return report.status === 'bozza' || report.status === 'rifiutata'
}

export function formatEuro(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  if (!Number.isFinite(n)) return '0,00 €'
  return `${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function formatItDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
