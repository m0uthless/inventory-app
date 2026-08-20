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

// STATUS_COLOR è stato spostato in theme/statusTokens.ts (DomainStatusTokens.purchaseOrder)
// per essere theme-aware — consumarlo via useStatusTokens().purchaseOrder.

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

// committenteColor (palette + hash) è stato spostato in theme/statusTokens.ts:
// import { committenteColor } from '../../theme/statusTokens'
// committenteColor(name, useStatusTokens().clientChipPalette)

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

// Punto 9: multi-PDF per tipo — un'entry può avere 0..N documenti per ciascun
// DocumentSlot (offer/po/invoice), non più un solo file sovrascrivibile.
export type PurchaseOrderDocument = {
  id: number
  kind: DocumentSlot
  kind_label?: string
  filename?: string | null
  url?: string | null
  uploaded_at: string
  uploaded_by?: number | null
  uploaded_by_username?: string | null
}

export type PurchaseOrderRow = {
  id: number

  offer_date: string
  description: string

  client_name: string
  customer?: number | null
  customer_name?: string | null
  customer_code?: string | null
  customer_placeholder?: string | null
  is_customer_placeholder?: boolean

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

  documents: PurchaseOrderDocument[]

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
  customer_placeholder: string
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
    customer_placeholder: '',
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

