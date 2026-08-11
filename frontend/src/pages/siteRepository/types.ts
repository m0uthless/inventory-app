// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerRow = {
  id: number
  code: string
  name: string
  display_name: string
  city?: string | null
  province?: string | null
  primary_contact_name?: string | null
  primary_contact_phone?: string | null
  status?: number | null
  status_key?: string | null
  status_label?: string | null
  has_vpn?: boolean | null
  tags?: string[] | null
  notes?: string | null
  // Contatori annotati dal backend (crm/api.py, _count_subquery).
  assets_count?: number
  sites_count?: number
  // Siti con almeno un asset collegato: usato per il badge "siti", che deve
  // riflettere solo i siti effettivamente visibili nel Site Repository.
  sites_with_assets_count?: number
  active_issue_count?: number
}

export type SiteRow = {
  id: number
  name: string
  display_name?: string | null
  city?: string | null
  postal_code?: string | null
  address_line1?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  status?: number | null
  status_label?: string | null
  customer?: number | null
}

export type InventoryRow = {
  id: number
  hostname?: string | null
  name: string
  local_ip?: string | null
  srsa_ip?: string | null
  type_key?: string | null
  type_label?: string | null
  status_key?: string | null
  status_label?: string | null
  customer?: number | null
  site?: number | null
  site_name?: string | null
  knumber?: string | null
  model?: string | null
  serial_number?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
  deleted_at?: string | null
}

export type LocationGroup = {
  label: string
  customers: CustomerRow[]
  issueCount: number
}

export type GroupByMode = 'province' | 'city'

export type StatusFilter = 'all' | 'attivo' | 'manutenzione' | 'inattivo'

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral'
