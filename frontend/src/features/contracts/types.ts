export type ExpiryState = 'none' | 'ok' | 'renew' | 'expired'

export type ContractType = 'assistenza' | 'noleggio' | 'licenza' | 'altro'
export type ContractStatus = 'bozza' | 'attivo' | 'chiuso'
export type BillingFrequency = 'una_tantum' | 'mensile' | 'trimestrale' | 'annuale'

export const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: 'assistenza', label: 'Assistenza' },
  { value: 'noleggio', label: 'Noleggio' },
  { value: 'licenza', label: 'Licenza' },
  { value: 'altro', label: 'Altro' },
]

export const CONTRACT_STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: 'bozza', label: 'Bozza' },
  { value: 'attivo', label: 'Attivo' },
  { value: 'chiuso', label: 'Chiuso' },
]

export const BILLING_FREQ_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: 'una_tantum', label: 'Una tantum' },
  { value: 'mensile', label: 'Mensile' },
  { value: 'trimestrale', label: 'Trimestrale' },
  { value: 'annuale', label: 'Annuale' },
]

export const EXPIRY_CHIP: Record<
  ExpiryState,
  { label: string; color: 'default' | 'success' | 'warning' | 'error' }
> = {
  none: { label: '—', color: 'default' },
  ok: { label: 'In corso', color: 'success' },
  renew: { label: 'Da rinnovare', color: 'warning' },
  expired: { label: 'Scaduto', color: 'error' },
}

export type Seller = {
  id: number
  name: string
  email: string
  phone: string
  user: number | null
  user_username: string | null
  /** L'email che riceverà i promemoria di rinnovo (utente Archie o inserita a mano). */
  reminder_email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ContractDeviceDetail = { id: number; label: string; serial_number: string | null }

export type ContractListItem = {
  id: number
  code: string
  title: string
  customer: number
  customer_name: string
  contract_type: ContractType
  contract_type_label: string
  seller: number | null
  seller_name: string | null
  /** Società (stesse voci del campo "Stato" dei clienti). */
  company: number | null
  company_label: string | null
  start_date: string
  end_date: string
  /** Avviso di rinnovo: giorni prima della fine. */
  reminder_days: number
  reminder_date: string | null
  /** Assente se l'utente non ha `contracts.view_contract_value`. Decimal serializzato come stringa. */
  total_value?: string
  billing_freq: BillingFrequency
  billing_freq_label: string
  status: ContractStatus
  status_label: string
  expiry_state: ExpiryState
  devices: number[]
  devices_detail: ContractDeviceDetail[]
  /** Assenti senza `contracts.view_contract_value` (il PDF riporta il prezzo). */
  document_url?: string | null
  document_filename?: string | null
  notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ReminderState = 'sent' | 'failed' | 'skipped' | 'next' | 'planned'
export type ContractReminders = {
  every: number
  to: string[]
  cc: string[]
  seller_kind: 'user' | 'manual' | null
  dates: { date: string; state: ReminderState; error: string | null }[]
}

/** Il dettaglio porta anche il calendario dei promemoria di rinnovo. */
export type ContractDetail = ContractListItem & { reminders?: ContractReminders }

export type CustomerOption = {
  id: number
  code?: string
  name?: string
  display_name?: string | null
  /** id della CustomerStatus del cliente: propone la Società del contratto. */
  status?: number | null
}

/** Voce di `/customer-statuses/`, usata come scelta per la Società. */
export type CompanyOption = { id: number; key: string; label: string; is_active?: boolean }
