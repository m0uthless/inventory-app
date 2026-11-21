import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { api, navigate } = vi.hoisted(() => ({ api: { get: vi.fn() }, navigate: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))

import GlobalSearch from '../../layout/GlobalSearch'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const show = (perms: string[] = ['issues.add_issue', 'issues.view_issue'], egg = vi.fn()) => {
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <GlobalSearch onEggTrigger={egg} canAccess={(l) => !l.perm || perms.includes(l.perm)} hasPerm={(p) => perms.includes(p)} />
  </MemoryRouter></ThemeProvider>)
  return { egg }
}

describe('Palette Ctrl K', () => {
  beforeEach(() => { localStorage.clear(); api.get.mockReset(); navigate.mockReset() })

  it('Ctrl K apre la finestra con le azioni permesse', async () => {
    show()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('dialog', { name: 'Cerca in ARCHIE' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Nuova issue/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Nuovo contratto/ })).toBeNull()
  })

  it('cerca, raggruppa e apre il risultato scelto con frecce e Invio', async () => {
    api.get.mockResolvedValue({ data: { results: [
      { kind: 'customer', id: 2, title: 'AUSL Imola', subtitle: 'Cliente' },
      { kind: 'issue', id: 41, title: '#41 Worklist vuota', subtitle: 'Aperta' },
    ] } })
    show()
    fireEvent.click(screen.getByRole('search'))
    const input = await screen.findByRole('combobox', { name: 'Cerca in ARCHIE' })
    fireEvent.change(input, { target: { value: 'imola' } })
    expect(await screen.findByRole('group', { name: 'Clienti' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Issue' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/search/', { params: { q: 'imola', limit: 40 } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith('/issues?open=41', undefined)
    expect(JSON.parse(localStorage.getItem('archie-recent-searches') || '[]')).toEqual(['imola'])
  })

  it('un\'azione apre la pagina con il modulo «Nuovo…»', async () => {
    show()
    fireEvent.click(screen.getByRole('search'))
    fireEvent.click(await screen.findByRole('option', { name: /Nuova issue/ }))
    expect(navigate).toHaveBeenCalledWith('/issues', { state: { openCreate: true } })
  })

  it('«Cerca in tutto Archie» porta alla pagina Ricerca', async () => {
    api.get.mockResolvedValue({ data: { results: [] } })
    show()
    fireEvent.click(screen.getByRole('search'))
    const input = await screen.findByRole('combobox', { name: 'Cerca in ARCHIE' })
    fireEvent.change(input, { target: { value: 'zzz' } })
    await waitFor(() => expect(screen.getByText('Nessun risultato per «zzz».')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith('/search?search=zzz', undefined)
  })

  it('la parola segreta funziona ancora', async () => {
    const { egg } = show()
    fireEvent.click(screen.getByRole('search'))
    const input = await screen.findByRole('combobox', { name: 'Cerca in ARCHIE' })
    fireEvent.change(input, { target: { value: 'supertennis' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(egg).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
