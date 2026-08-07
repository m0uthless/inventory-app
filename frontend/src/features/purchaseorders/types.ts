import { theme } from '../../theme'

export type PurchaseOrderKind = 'ordinario' | 'extra'
export type PurchaseOrderAmountMode = 'fisso' | 'giornate'
export type PurchaseOrderStatus = 'inserito' | 'inviato' | 'ricevuto' | 'fatturato'

export const STATUS_ORDER: PurchaseOrderStatus[] = ['inserito', 'inviato', 'ricevuto', 'fatturato']

export const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  inserito: 'Inserito',
  inviato: 'Inviato',
  ricevuto: 'Ricevuto',
  fatturato: 'Fatturato',
}

// Etichetta del documento richiesto per RAGGIUNGERE quello stato (usata nel
// dialog di avanzamento, es. "Segna come Inviato" chiede la PDF Offerta).
export const STATUS_DOCUMENT_LABEL: Partial<Record<PurchaseOrderStatus, string>> = {
  inviato: 'PDF Offerta',
  ricevuto: 'PDF Purchase Order',
  fatturato: 'PDF Fattura',
}

export const STATUS_COLOR: Record<PurchaseOrderStatus, { bg: string; color: string; border: string }> = {
  inserito:  { bg: 'rgba(148,163,184,0.16)', color: '#475569', border: 'rgba(148,163,184,0.34)' },
  inviato:   { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8', border: 'rgba(59,130,246,0.30)' },
  ricevuto:  { bg: 'rgba(249,115,22,0.12)',  color: '#c2410c', border: 'rgba(249,115,22,0.30)' },
  fatturato: { bg: 'rgba(16,185,129,0.10)',  color: theme.palette.success.dark, border: 'rgba(16,185,129,0.28)' },
}

export function nextStatus(status: PurchaseOrderStatus): PurchaseOrderStatus | null {
  const idx = STATUS_ORDER.indexOf(status)
  if (idx === -1 || idx === STATUS_ORDER.length - 1) return null
  return STATUS_ORDER[idx + 1]
}

export function prevStatus(status: PurchaseOrderStatus): PurchaseOrderStatus | null {
  const idx = STATUS_ORDER.indexOf(status)
  if (idx <= 0) return null
  return STATUS_ORDER[idx - 1]
}

// ─── Committente: colore deterministico da stringa ─────────────────────────

const CLIENT_CHIP_PALETTE: { bg: string; color: string; border: string }[] = [
  { bg: 'rgba(99,102,241,0.12)',  color: '#4338ca', border: 'rgba(99,102,241,0.28)' },
  { bg: 'rgba(236,72,153,0.12)',  color: '#be185d', border: 'rgba(236,72,153,0.28)' },
  { bg: 'rgba(20,184,166,0.12)',  color: '#0f766e', border: 'rgba(20,184,166,0.28)' },
  { bg: 'rgba(245,158,11,0.14)',  color: '#b45309', border: 'rgba(245,158,11,0.30)' },
  { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8', border: 'rgba(59,130,246,0.28)' },
  { bg: 'rgba(139,92,246,0.12)',  color: '#6d28d9', border: 'rgba(139,92,246,0.28)' },
  { bg: 'rgba(34,197,94,0.12)',   color: '#15803d', border: 'rgba(34,197,94,0.28)' },
  { bg: 'rgba(239,68,68,0.12)',   color: '#b91c1c', border: 'rgba(239,68,68,0.28)' },
  { bg: 'rgba(6,182,212,0.12)',   color: '#0e7490', border: 'rgba(6,182,212,0.28)' },
  { bg: 'rgba(217,70,239,0.12)',  color: '#a21caf', border: 'rgba(217,70,239,0.28)' },
]

export function committenteColor(name: string): { bg: string; color: string; border: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return CLIENT_CHIP_PALETTE[Math.abs(hash) % CLIENT_CHIP_PALETTE.length]
}

// ─── Anni ───────────────────────────────────────────────────────────────────

export const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS: number[] = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + 1 - i)

export type CustomerItem = { id: number; code?: string; name?: string; display_name?: string | null }

export type DocumentSlot = 'offer' | 'po' | 'invoice'

export type PurchaseOrderSummary = {
  total_amount: string
  to_send: number
  waiting: number
  previous_year?: number | null
  previous_year_amount?: string | null
  yoy_delta_pct?: number | null
}

export const DOCUMENT_SLOT_LABEL: Record<DocumentSlot, string> = {
  offer: 'Offerta',
  po: 'Purchase Order',
  invoice: 'Fattura',
}

export type PurchaseOrderRow = {
  id: number

  offer_date: string
  description: string

  client_name: string
  customer?: number | null
  customer_name?: string | null
  customer_code?: string | null

  purchase_order?: string | null
  invoice_number?: string | null
  is_invoiced: boolean

  kind: PurchaseOrderKind
  kind_label?: string

  status: PurchaseOrderStatus
  status_label?: string
  is_editable: boolean
  sent_at?: string | null
  received_at?: string | null
  invoiced_at?: string | null

  offer_document_name?: string | null
  offer_document_url?: string | null
  po_document_name?: string | null
  po_document_url?: string | null
  invoice_document_name?: string | null
  invoice_document_url?: string | null

  amount_mode: PurchaseOrderAmountMode
  amount_mode_label?: string
  days?: string | null
  daily_rate?: string | null
  amount: string

  costs_incurred?: string | null

  notes?: string | null

  created_by?: number | null
  created_by_username?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type PurchaseOrderDetail = PurchaseOrderRow

export type PurchaseOrderForm = {
  offer_date: string
  description: string
  client_name: string
  customer: number | ''
  purchase_order: string
  invoice_number: string
  kind: PurchaseOrderKind
  amount_mode: PurchaseOrderAmountMode
  days: string
  daily_rate: string
  amount: string
  costs_incurred: string
  notes: string
}

export function emptyForm(): PurchaseOrderForm {
  return {
    offer_date: todayISO(),
    description: '',
    client_name: '',
    customer: '',
    purchase_order: '',
    invoice_number: '',
    kind: 'extra',
    amount_mode: 'fisso',
    days: '',
    daily_rate: '',
    amount: '',
    costs_incurred: '',
    notes: '',
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatEuro(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  if (!Number.isFinite(n)) return '0,00 €'
  return `${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function formatItDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function computeGiornateAmount(days: string, dailyRate: string): string {
  const d = parseFloat(days)
  const r = parseFloat(dailyRate)
  if (!Number.isFinite(d) || !Number.isFinite(r)) return ''
  return (d * r).toFixed(2)
}

