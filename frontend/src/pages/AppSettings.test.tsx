import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppSettings from './AppSettings'
import { THEME_REGISTRY } from '../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ me: { id: 1, is_superuser: false }, loading: false, hasPerm: (p: string) => auth.allowed && p === 'core.manage_app_settings' }) }))

const data = (emails = 'contratti@biotron.it; amministrazione@biotron.it', days = 90, every = 10) => ({
  sections: [{ key: 'contracts', label: 'Contratti', settings: [
    { key: 'contracts.reminder_emails', label: "Indirizzi dell'ufficio", kind: 'emails', value: emails, default: '', min: null, max: null },
    { key: 'contracts.reminder_default_days', label: 'Avviso predefinito per i nuovi contratti', kind: 'int', value: days, default: 90, min: 1, max: 365 },
    { key: 'contracts.reminder_every_days', label: 'Ripeti il promemoria ogni', kind: 'int', value: every, default: 10, min: 1, max: 60 },
  ] }],
})

const show = () => render(<ThemeProvider theme={theme}><MemoryRouter><AppSettings /></MemoryRouter></ThemeProvider>)

describe('Impostazioni di Archie', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset()); toast.success.mockReset(); toast.error.mockReset(); auth.allowed = true
    api.get.mockResolvedValue({ data: data() })
  })

  it('mostra gli indirizzi dell\'ufficio come etichette', async () => {
    show()
    expect(await screen.findByText('contratti@biotron.it')).toBeInTheDocument()
    expect(screen.getByText('amministrazione@biotron.it')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90 giorni' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('una modifica accende la barra di salvataggio e salva solo le chiavi cambiate', async () => {
    api.patch.mockResolvedValue({ data: data('contratti@biotron.it', 90, 7) })
    show()
    const every = await screen.findByLabelText('Ripeti il promemoria ogni')
    fireEvent.change(every, { target: { value: '7' } })
    expect(screen.getByText('1 modifica da salvare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/app-settings/', { 'contracts.reminder_every_days': 7 }))
    expect(toast.success).toHaveBeenCalledWith('Impostazioni salvate')
  })

  it('un indirizzo non valido blocca il salvataggio', async () => {
    show()
    const box = await screen.findByLabelText("Indirizzi dell'ufficio")
    fireEvent.change(box, { target: { value: 'a@x.it; nonvalida' } })
    expect(screen.getByText('Questo indirizzo non è valido: nonvalida')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled()
  })

  it('l\'avviso predefinito si sceglie dalle pastiglie', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: '60 giorni' }))
    expect(screen.getByRole('button', { name: '60 giorni' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 modifica da salvare')).toBeInTheDocument()
  })

  it('manda l\'email di prova all\'ufficio', async () => {
    api.post.mockResolvedValue({ data: { sent_to: ['contratti@biotron.it', 'amministrazione@biotron.it'] } })
    show()
    fireEvent.click(await screen.findByRole('button', { name: "Manda un'email di prova all'ufficio" }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/app-settings/contracts/test-email/'))
    expect(toast.success).toHaveBeenCalledWith('Email di prova inviata a 2 indirizzi')
  })

  it('senza permesso la pagina non esiste', async () => {
    auth.allowed = false
    show()
    expect(await screen.findByText('Questa pagina non esiste')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
})
