import { screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DevicePicker from './DevicePicker'

const apiGet = vi.fn()
vi.mock('@shared/api/client', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a) },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
let granted = new Set<string>()
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ hasPerm: (p: string) => granted.has(p) }),
}))
// Il dialog di creazione ha dipendenze proprie: qui non serve.
vi.mock('./DeviceDialog', () => ({ default: () => null }))

const initial = [{ id: 12, label: 'CT 64 — SN-1', serial_number: 'SN-1' }]

function setup() {
  render(
    <DevicePicker customerId={3} value={[12]} onChange={vi.fn()} allowCreate initialOptions={initial} />,
  )
}

beforeEach(() => {
  apiGet.mockReset()
  toast.error.mockReset()
})

describe('DevicePicker', () => {
  it('senza device.view_device non chiama l’API e mostra i device collegati in sola lettura', () => {
    granted = new Set()
    setup()
    expect(apiGet).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.getByText('CT 64 — SN-1')).toBeTruthy()
    expect(screen.queryByText('Device #12')).toBeNull()
    expect(screen.getByText('Non hai i permessi per modificare i device collegati')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nuovo device/ })).toBeNull()
  })

  it('con device.view_device carica la lista; "Nuovo device" solo con device.add_device', async () => {
    granted = new Set(['device.view_device'])
    apiGet.mockResolvedValue({ data: { results: [] } })
    setup()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))
    expect(apiGet.mock.calls[0][0]).toBe('/devices/')
    // La lista vuota non cancella l'etichetta nota del device collegato.
    expect(screen.getByText('CT 64 — SN-1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nuovo device/ })).toBeNull()
  })

  it('mostra "Nuovo device" con view e add', async () => {
    granted = new Set(['device.view_device', 'device.add_device'])
    apiGet.mockResolvedValue({ data: { results: [] } })
    setup()
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Nuovo device/ })).toBeTruthy()
  })
})
