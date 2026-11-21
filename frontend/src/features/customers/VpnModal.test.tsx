import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPerm: () => true, me: { is_superuser: true } }) }))

import VpnModal from './VpnModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const vpn = { id: 1, customer: 3, applicativo: 'AnyConnect', utenza: 'tech', password: null, has_password: true, remote_address: 'vpn.x', porta: '443', note: '', created_at: null, updated_at: null }

describe('VpnModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.get.mockResolvedValue({ data: vpn })
    api.patch.mockResolvedValue({ data: { ...vpn, has_password: false } })
  })

  it('«Togli la password» manda una password vuota', async () => {
    render(<ThemeProvider theme={theme}><VpnModal open customerId={3} customerName="AUSL" onClose={vi.fn()} /></ThemeProvider>)
    fireEvent.click(await screen.findByRole('button', { name: /Modifica/ }))
    fireEvent.click(screen.getByLabelText('Togli la password'))
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(api.patch.mock.calls[0][1]).toMatchObject({ password_input: '' })
  })

  it('senza la spunta la password vuota resta invariata', async () => {
    render(<ThemeProvider theme={theme}><VpnModal open customerId={3} customerName="AUSL" onClose={vi.fn()} /></ThemeProvider>)
    fireEvent.click(await screen.findByRole('button', { name: /Modifica/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty('password_input')
  })
})
