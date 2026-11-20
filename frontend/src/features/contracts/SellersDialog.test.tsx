import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SellersDialog from './SellersDialog'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPerm: () => true }) }))

const seller = { id: 1, name: 'Giulia Neri', email: 'g@studioneri.it', phone: '', user: null, user_username: null, reminder_email: 'g@studioneri.it', is_active: true, created_at: '', updated_at: '', deleted_at: null }

describe('SellersDialog', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.get.mockImplementation((u: string) => Promise.resolve({ data: u === '/sellers/' ? { results: [seller] } : { results: [] } }))
    api.post.mockResolvedValue({ data: {} })
  })

  it('mostra a quale email arrivano i promemoria', async () => {
    render(<ThemeProvider theme={theme}><SellersDialog open onClose={vi.fn()} /></ThemeProvider>)
    expect(await screen.findByText(/promemoria a g@studioneri\.it/)).toBeInTheDocument()
  })

  it('senza utente collegato l\'email è obbligatoria', async () => {
    render(<ThemeProvider theme={theme}><SellersDialog open onClose={vi.fn()} /></ThemeProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Nuovo venditore' }))
    fireEvent.change(screen.getByLabelText(/Nome e cognome/), { target: { value: 'Mario Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(await screen.findByText("Indica l'email del venditore o collega un utente di Archie.")).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@x.it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sellers/', expect.objectContaining({ name: 'Mario Rossi', email: 'mario@x.it' })))
  })
})
