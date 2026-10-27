/** Riga di `/api/devices/` (DeviceListSerializer) — solo i campi usati da Archie. */
export type DeviceListItem = {
  id: number
  customer: number
  customer_name?: string | null
  site: number | null
  site_name?: string | null
  site_display_name?: string | null
  type: number | null
  type_name?: string | null
  status: number | null
  status_name?: string | null
  manufacturer: number | null
  manufacturer_name?: string | null
  model: string | null
  serial_number: string | null
  inventario: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

/** Dettaglio `/api/devices/<id>/` — solo i campi base gestiti da Archie. */
export type DeviceDetail = DeviceListItem & {
  note: string | null
}

export type DeviceLookup = { id: number; name: string }

/**
 * Form dei soli campi base gestibili da Archie. IP, AE Title, reparto, stanza,
 * posizione, flag VLAN/DoseSR/WiFi/RIS-PACS restano esclusivi del Portal.
 * Le FK usano `''` per "non selezionato".
 */
export type DeviceBaseForm = {
  site: number | ''
  type: number | ''
  status: number | ''
  manufacturer: number | ''
  model: string
  serial_number: string
  inventario: string
  note: string
}

export const EMPTY_DEVICE_FORM: DeviceBaseForm = {
  site: '',
  type: '',
  status: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  inventario: '',
  note: '',
}

export function deviceToForm(d: DeviceDetail): DeviceBaseForm {
  return {
    site: d.site ?? '',
    type: d.type ?? '',
    status: d.status ?? '',
    manufacturer: d.manufacturer ?? '',
    model: d.model ?? '',
    serial_number: d.serial_number ?? '',
    inventario: d.inventario ?? '',
    note: d.note ?? '',
  }
}

/** Etichetta leggibile di un device (tipo · produttore modello · S/N). */
export function deviceLabel(d: Pick<DeviceListItem, 'id' | 'type_name' | 'manufacturer_name' | 'model' | 'serial_number'>): string {
  const name = [d.manufacturer_name, d.model].filter(Boolean).join(' ')
  const parts = [d.type_name, name, d.serial_number ? `S/N ${d.serial_number}` : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : `Device #${d.id}`
}
