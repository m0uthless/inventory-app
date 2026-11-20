import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import ProfileCard from './ProfileCard'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const apiPatch = vi.fn().mockResolvedValue({ data: {} })
vi.mock('@shared/api/client', () => ({ api: { get: vi.fn().mockResolvedValue({ data: { results: [] } }), patch: (...a: unknown[]) => apiPatch(...a), post: vi.fn() } }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
const me = {
  id: 1, username: 'fmutuale', email: 'f@example.com', first_name: 'Federico', last_name: 'Mutuale', is_staff: true, is_superuser: false,
  groups: ['Tecnici PACS'], permissions: ['crm.view_customer'], profile: { avatar: null, preferred_customer: null },
}
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ me, refreshMe: vi.fn().mockResolvedValue(undefined) }) }))

describe('ProfileCard', () => {
  it('una pagina sola: dati in lettura, «Modifica i dati» li trasforma in campi e salva', async () => {
    render(<ThemeProvider theme={theme}><MemoryRouter><ProfileCard onClose={vi.fn()} /></MemoryRouter></ThemeProvider>)
    expect(screen.getByRole('heading', { name: 'Aspetto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sicurezza' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Modifica i dati' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Fede' } })
    fireEvent.click(screen.getByRole('button', { name: /Salva/ }))
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/me/', expect.objectContaining({ first_name: 'Fede' })))
  })
})
