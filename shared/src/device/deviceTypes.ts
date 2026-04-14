/**
 * Tipi condivisi per l'entità Device.
 *
 * Usati in:
 *  - frontend-auslbo (drawer, form, pagina Device)
 *  - frontend (futuro: gestione device sul portale principale)
 *
 * Non dipende da API, React o MUI — puro TypeScript.
 */

// ─── Lookup / select ──────────────────────────────────────────────────────────

export type LookupItem = { id: number; name: string }

export type DeviceTypeItem = { id: number; name: string; dose_sr: boolean }

export type ManufacturerItem = { id: number; name: string; logo_url: string | null }

export type SiteItem = { id: number; name: string; display_name: string }

export type RispacsItem = {
  id: number
  name: string
  ip: string | null
  aetitle: string | null
}

// ─── Detail (read-only) ───────────────────────────────────────────────────────

export type RispacsLink = {
  id: number
  device: number
  rispacs: number
  rispacs_name: string | null
  rispacs_ip: string | null
  rispacs_port: number | null
  rispacs_aetitle: string | null
}

export type WifiDetail = {
  id: number
  ip: string | null
  mac_address: string | null
  certificato_url: string | null
  pass_certificato: string | null
  scad_certificato: string | null
}

export type DeviceReadDetail = {
  model: string | null
  aetitle: string | null
  serial_number: string | null
  inventario: string | null
  reparto: string | null
  room: string | null
  ip: string | null
  location: string | null
  note: string | null
  site_name: string | null
  site_display_name: string | null
  type_name: string | null
  manufacturer_name: string | null
  custom_fields: Record<string, unknown> | null
  rispacs_links: RispacsLink[]
  wifi_detail: WifiDetail | null
}

// ─── Form state ───────────────────────────────────────────────────────────────

export type DeviceFormState = {
  site: number | ''
  type: number | ''
  status: number | ''
  manufacturer: number | ''
  model: string
  aetitle: string
  serial_number: string
  inventario: string
  reparto: string
  room: string
  ip: string
  vlan: boolean
  wifi: boolean
  rispacs: boolean
  dose: boolean
  note: string
  location: string
  rispacs_ids: number[]
  wifi_ip: string
  wifi_mac: string
  wifi_pass: string
  wifi_scad: string
  /** Solo frontend: non serializzato verso l'API */
  wifi_cert_file: File | null
}

export const emptyDeviceForm = (): DeviceFormState => ({
  site: '', type: '', status: '', manufacturer: '',
  model: '', aetitle: '', serial_number: '', inventario: '',
  reparto: '', room: '', ip: '', location: '', note: '',
  vlan: false, wifi: false, rispacs: false, dose: false,
  rispacs_ids: [],
  wifi_ip: '', wifi_mac: '', wifi_pass: '', wifi_scad: '', wifi_cert_file: null,
})

/** Alias per form creazione (al momento identico a DeviceFormState) */
export type NewDeviceFormState = DeviceFormState
