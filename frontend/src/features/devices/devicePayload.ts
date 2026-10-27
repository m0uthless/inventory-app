import type { DeviceBaseForm } from './types'

/**
 * Unici campi Device scrivibili da Archie. Tutto il resto (ip, aetitle,
 * reparto, room, location, vlan, dose, wifi, rispacs) è gestito dal Portal e
 * non deve mai essere inviato, così una PATCH da Archie non lo azzera.
 */
export const DEVICE_BASE_FIELDS = [
  'site',
  'type',
  'status',
  'manufacturer',
  'model',
  'serial_number',
  'inventario',
  'note',
] as const

export type DeviceBaseField = (typeof DEVICE_BASE_FIELDS)[number]

/**
 * Costruisce il payload per POST (create, con `customer`) o PATCH (edit, senza
 * `customer`) a `/api/devices/`. Considera solo `DEVICE_BASE_FIELDS`, ignorando
 * qualunque altra chiave presente nel form; stringhe vuote → `null`.
 */
export function buildDevicePayload(
  form: DeviceBaseForm,
  mode: 'create' | 'edit',
  customerId: number,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of DEVICE_BASE_FIELDS) {
    const raw: unknown = form[key]
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      payload[key] = trimmed === '' ? null : trimmed
    } else {
      payload[key] = raw ?? null
    }
  }
  if (mode === 'create') payload.customer = customerId
  return payload
}
