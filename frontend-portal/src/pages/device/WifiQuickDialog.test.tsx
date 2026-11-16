import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WifiQuickDialog from './WifiQuickDialog'

// B-04 (QA 2026-11-15): il dialog usava l'id del device come id del Wi-Fi.
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

function saveFor(deviceId: number) {
  const onSaved = vi.fn()
  render(<WifiQuickDialog deviceId={deviceId} onClose={() => {}} onSaved={onSaved} />)
  fireEvent.change(screen.getByLabelText('Indirizzo IP WiFi'), { target: { value: '10.0.0.5' } })
  fireEvent.click(screen.getByRole('button', { name: /salva/i }))
  return onSaved
}

describe('WifiQuickDialog', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    api.patch.mockResolvedValue({ data: {} })
    api.post.mockResolvedValue({ data: {} })
  })

  it('aggiorna il Wi-Fi esistente con il suo id, non quello del device', async () => {
    api.get.mockResolvedValue({ data: { wifi_detail: { id: 77 } } })
    const onSaved = saveFor(12)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(api.patch).toHaveBeenCalledWith('/devices/12/', { wifi: true })
    expect(api.patch).toHaveBeenCalledWith('/device-wifi/77/', expect.any(FormData), expect.anything())
    expect(api.post).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('crea il Wi-Fi collegato al device quando non esiste', async () => {
    api.get.mockResolvedValue({ data: { wifi_detail: null } })
    const onSaved = saveFor(12)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/device-wifi/')
    expect((body as FormData).get('device')).toBe('12')
    expect(api.patch).toHaveBeenCalledTimes(1)
  })
})
