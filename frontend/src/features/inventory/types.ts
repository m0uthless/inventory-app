export type LookupItem = { id: number; label: string; key?: string }

export type CustomerItem = { id: number; code: string; name: string }
export type SiteItem = { id: number; name: string; display_name?: string | null }

export type InventoryRow = {
  id: number
  customer: number
  customer_code?: string
  customer_name?: string
  site?: number | null
  site_name?: string
  site_display_name?: string | null
  name: string
  hostname?: string | null
  knumber?: string | null
  serial_number?: string | null
  type_key?: string | null
  type_label?: string | null
  status_label?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  notes?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  has_active_issue?: boolean
}

export type InventoryDetail = {
  id: number
  customer: number
  customer_code?: string
  customer_name?: string
  site?: number | null
  site_name?: string
  site_display_name?: string | null
  name: string
  knumber?: string | null
  serial_number?: string | null
  hostname?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  type?: number | null
  type_key?: string | null
  type_label?: string | null
  status: number
  status_label?: string | null
  os_user?: string | null
  os_pwd?: string | null
  app_usr?: string | null
  app_pwd?: string | null
  vnc_pwd?: string | null
  manufacturer?: string | null
  model?: string | null
  warranty_end_date?: string | null
  notes?: string | null
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  has_active_issue?: boolean
}

export type InventoryForm = {
  customer: number | ''
  site: number | ''
  status: number | ''
  type: number | ''
  name: string
  knumber: string
  serial_number: string
  hostname: string
  local_ip: string
  srsa_ip: string
  os_user: string
  os_pwd: string
  app_usr: string
  app_pwd: string
  vnc_pwd: string
  manufacturer: string
  model: string
  warranty_end_date: string
  custom_fields: Record<string, unknown>
  notes: string
  tags: string[]
}

export type InventoryFieldName =
  | 'hostname'
  | 'local_ip'
  | 'srsa_ip'
  | 'os_user'
  | 'os_pwd'
  | 'app_usr'
  | 'app_pwd'
  | 'vnc_pwd'
  | 'manufacturer'
  | 'model'
  | 'warranty_end_date'
