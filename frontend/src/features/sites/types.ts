export type LookupItem = { id: number; label: string; key?: string }

export type CustomerItem = {
  id: number
  code?: string
  name?: string
  display_name?: string | null
}

export type SiteRow = {
  id: number
  name: string
  display_name?: string | null

  customer?: number | null
  customer_code?: string | null
  customer_name?: string | null
  customer_display_name?: string | null

  status?: number | null
  status_label?: string | null

  city?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  postal_code?: string | null
  address_line1?: string | null

  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type SiteDetail = SiteRow & {
  province?: string | null
  country?: string | null
  custom_fields?: Record<string, unknown> | null
  deleted_at?: string | null
}

export type SiteForm = {
  customer: number | ''
  status: number | ''
  name: string
  display_name: string
  address_line1: string
  city: string
  postal_code: string
  province: string
  country: string
  custom_fields: Record<string, unknown>
  notes: string
}

export type ContactMini = {
  id: number
  customer?: number
  site?: number | null
  name?: string | null
  email?: string | null
  phone?: string | null
  department?: string | null
  is_primary?: boolean | null
  deleted_at?: string | null
}

export type InventoryMini = {
  id: number
  customer: number
  site?: number | null
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  type_label?: string | null
  status_label?: string | null
  deleted_at?: string | null
}
