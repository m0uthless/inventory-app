export type ExpiryState = 'none' | 'ok' | 'notice' | 'expiring' | 'expired'

export type ContractType = 'assistenza' | 'noleggio' | 'licenza' | 'altro'
export type ContractStatus = 'bozza' | 'attivo' | 'disdetto'
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
  { value: 'disdetto', label: 'Disdetto' },
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
  notice: { label: 'Preavviso', color: 'warning' },
  expiring: { label: 'In scadenza', color: 'warning' },
  expired: { label: 'Scaduto', color: 'error' },
}

export type Seller = {
  id: number
  name: string
  email: string
  phone: string
  user: number | null
  user_username: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ContractDeviceDetail = { id: number; label: string; serial_number: string }

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
  start_date: string
  end_date: string
  notice_days: number
  notice_deadline: string | null
  auto_renew: boolean
  /** Assente se l'utente non ha `contracts.view_contract_value`. Decimal serializzato come stringa. */
  total_value?: string
  billing_freq: BillingFrequency
  billing_freq_label: string
  status: ContractStatus
  status_label: string
  expiry_state: ExpiryState
  devices: number[]
  devices_detail: ContractDeviceDetail[]
  document_url: string | null
  document_filename: string | null
  notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ContractDetail = ContractListItem
