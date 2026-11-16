import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Modules from './Modules'
import { MODULES } from '../modules/moduleRegistry'
import { THEME_REGISTRY } from '../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
const refreshMe = vi.hoisted(() => vi.fn())
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ refreshMe, me: { is_superuser: true } }) }))
vi.mock('../layout/PageHeaderContext', () => ({ useOwnPageHeader: () => {} }))

const state = (key: string, enabled = true) => ({
  key, label: key, enabled, reason: enabled ? '' : 'In attesa del rilascio',
  changed_by: null, changed_at: null, history: [],
})

describe('Modules', () => {
  beforeEach(() => {
    api.get.mockReset(); api.patch.mockReset(); refreshMe.mockReset()
    api.get.mockResolvedValue({ data: MODULES.map((m) => state(m.key)) })
    api.patch.mockResolvedValue({ data: state('leave', false) })
  })

  it('spegne un modulo dopo la conferma, con il motivo', async () => {
    render(<ThemeProvider theme={theme}><MemoryRouter><Modules /></MemoryRouter></ThemeProvider>)
    const sw = await screen.findByLabelText('Spegni Piano ferie')
    await waitFor(() => expect(sw).not.toBeDisabled())
    fireEvent.click(sw)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Spegnere Piano ferie?')).toBeInTheDocument()
    expect(within(dialog).getByText(/Assenze dei tecnici ServiceNow/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Motivo (facoltativo)'), { target: { value: 'In attesa del rilascio' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Spegni' }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/modules/leave/', { enabled: false, reason: 'In attesa del rilascio' }))
    expect(refreshMe).toHaveBeenCalled()
  })
})
