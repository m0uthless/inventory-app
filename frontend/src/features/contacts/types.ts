export type CustomerItem = {
  id: number
  code?: string
  name?: string
  display_name?: string | null
}

export type SiteItem = {
  id: number
  name: string
  display_name?: string | null
}

export type ContactRow = {
  id: number
  customer?: number | null
  customer_code?: string | null
  customer_name?: string | null
  customer_display_name?: string | null
  site?: number | null
  site_name?: string | null
  site_display_name?: string | null
  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  is_primary: boolean
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type ContactDetail = ContactRow & { deleted_at?: string | null }

export type ContactForm = {
  customer: number | ''
  site: number | ''
  name: string
  email: string
  phone: string
  department: string
  is_primary: boolean
  notes: string
}
