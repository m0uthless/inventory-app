import { describe, expect, it } from 'vitest'
import { DEVICE_BASE_FIELDS, buildDevicePayload } from './devicePayload'
import type { DeviceBaseForm } from './types'

const form: DeviceBaseForm = {
  site: 3,
  type: 1,
  status: 2,
  manufacturer: 4,
  model: 'Model X',
  serial_number: 'SN-1',
  inventario: 'INV-9',
  note: 'nota',
}

describe('buildDevicePayload', () => {
  it('create: include customer e solo i campi base, esclude ip/wifi/reparto', () => {
    const payload = buildDevicePayload(
      { ...form, ip: '1.2.3.4', wifi: true, reparto: 'Radiologia' } as unknown as DeviceBaseForm,
      'create',
      7,
    )
    expect(Object.keys(payload).sort()).toEqual(['customer', ...DEVICE_BASE_FIELDS].sort())
    expect(payload.customer).toBe(7)
  })

  it('edit: niente customer', () => {
    expect(buildDevicePayload(form, 'edit', 7)).not.toHaveProperty('customer')
  })

  it('stringa vuota → null', () => {
    const payload = buildDevicePayload({ ...form, serial_number: '', manufacturer: '' }, 'edit', 7)
    expect(payload.serial_number).toBeNull()
    expect(payload.manufacturer).toBeNull()
  })
})
