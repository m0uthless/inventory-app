export type LookupItem = { id: number; label: string; key?: string }

export type CustomerRow = {
  id: number
  code: string
  name: string
  display_name: string
  city?: string | null
  primary_contact_id?: number | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  vat_number?: string | null
  tax_code?: string | null
  status?: number | null
  status_label?: string | null
  notes?: string | null
  has_vpn?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type CustomerDetail = CustomerRow & {
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
  deleted_at?: string | null
}

export type CustomerForm = {
  status: number | ''
  name: string
  display_name: string
  vat_number: string
  tax_code: string
  custom_fields: Record<string, unknown>
  notes: string
}

export type SiteMini = {
  id: number
  name?: string | null
  display_name?: string | null
  city?: string | null
  status?: number | null
  status_label?: string | null
  deleted_at?: string | null
}

export type InventoryMini = {
  id: number
  customer: number
  site?: number | null
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  site_name?: string | null
  site_display_name?: string | null
  type_label?: string | null
  status_label?: string | null
  deleted_at?: string | null
}
