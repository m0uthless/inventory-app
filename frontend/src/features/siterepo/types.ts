export type RepoCustomer = {
  id: number
  code: string
  name: string
  display_name: string
  city?: string | null
  province?: string | null
  primary_contact_name?: string | null
  primary_contact_phone?: string | null
  status_label?: string | null
  has_vpn?: boolean | null
  assets_count?: number
  sites_with_assets_count?: number
  /** Asset del cliente con almeno una issue attiva. */
  active_issue_count?: number
}

export type RepoSite = {
  id: number
  customer: number
  name: string
  display_name?: string | null
  city?: string | null
  address_line1?: string | null
  status_key?: string | null
  status_label?: string | null
}

export type RepoAsset = {
  id: number
  customer: number
  customer_name?: string
  site?: number | null
  site_name?: string | null
  site_display_name?: string | null
  name: string
  hostname?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  knumber?: string | null
  serial_number?: string | null
  type_key?: string | null
  type_label?: string | null
  status_key?: string | null
  status_label?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
}

/** Contenuto di un cliente aperto: siti con asset (+ "Senza sito") e i loro asset. */
export type RepoCustomerContent = { sites: (RepoSite & { assets: RepoAsset[] })[] }
