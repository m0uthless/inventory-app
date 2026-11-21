import { render, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ContractDialog from './ContractDialog'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }))

describe('ContractDialog · nuovo contratto', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.get.mockImplementation((u: string) => Promise.resolve({ data: u === '/contracts/defaults/' ? { reminder_days: 60 } : { results: [] } }))
  })

  it('chiede l\'avviso di rinnovo predefinito alle Impostazioni', async () => {
    render(<ThemeProvider theme={theme}><ContractDialog open contract={null} customers={[]} sellers={[]} companies={[]} canViewValue onClose={vi.fn()} onSaved={vi.fn()} /></ThemeProvider>)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/contracts/defaults/'))
  })
})
