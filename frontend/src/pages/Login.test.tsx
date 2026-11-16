import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Login from './Login'
import { THEME_REGISTRY } from '../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ refreshMe: vi.fn() }) }))

const show = () => render(<ThemeProvider theme={theme}><MemoryRouter><Login /></MemoryRouter></ThemeProvider>)

describe('Login · modalità manutenzione', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset() })

  it("mostra l'avviso quando la manutenzione è attiva, non per il Portale clienti", async () => {
    api.get.mockResolvedValue({ data: { active: true, message: 'Torniamo alle 14.' } })
    show()
    expect(await screen.findByText('Sistema in manutenzione')).toBeInTheDocument()
    expect(screen.getByText(/Torniamo alle 14\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Portale clienti' }))
    expect(screen.queryByText('Sistema in manutenzione')).not.toBeInTheDocument()
  })

  it("al login rifiutato per manutenzione mostra l'avviso, non l'errore di credenziali", async () => {
    api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/auth/maintenance/' ? { active: false, message: '' } : {} }))
    api.post.mockRejectedValue({ response: { status: 503, data: { detail: 'Lavori in corso.', reason: 'maintenance' } } })
    show()
    fireEvent.change(screen.getByPlaceholderText('nome.cognome'), { target: { value: 'tech' } })
    fireEvent.change(document.getElementById('login-p') as HTMLInputElement, { target: { value: 'pw' } })
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(screen.getByText('Sistema in manutenzione')).toBeInTheDocument())
    expect(screen.getByText(/Lavori in corso\./)).toBeInTheDocument()
    expect(screen.queryByText('Nome utente o password non corretti.')).not.toBeInTheDocument()
  })
})
