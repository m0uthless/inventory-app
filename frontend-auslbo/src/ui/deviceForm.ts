export type LookupItem = { id: number; name: string }
export type DeviceTypeItem = { id: number; name: string; dose_sr: boolean }
export type ManufacturerItem = { id: number; name: string; logo_url: string | null }
export type SiteItem = { id: number; name: string; display_name: string }
export type RispacsItem = { id: number; name: string; ip: string | null; aetitle: string | null }

export type NewDeviceFormState = {
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
  wifi_cert_file: File | null
}

export const emptyDeviceForm = (): NewDeviceFormState => ({
  site: '', type: '', status: '', manufacturer: '',
  model: '', aetitle: '', serial_number: '', inventario: '',
  reparto: '', room: '', ip: '', location: '', note: '',
  vlan: false, wifi: false, rispacs: false, dose: false,
  rispacs_ids: [],
  wifi_ip: '', wifi_mac: '', wifi_pass: '', wifi_scad: '', wifi_cert_file: null,
})
