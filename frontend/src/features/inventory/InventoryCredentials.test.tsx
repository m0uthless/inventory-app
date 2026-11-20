import { act, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import InventoryCredentials from './InventoryCredentials'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn() }))
const clip = vi.hoisted(() => ({ copyToClipboard: vi.fn().mockResolvedValue(undefined) }))
const auth = vi.hoisted(() => ({ secrets: true }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/utils/clipboard', () => clip)
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPerm: (p: string) => auth.secrets && p === 'inventory.view_secrets' }) }))

const show = (data: Record<string, unknown>) => {
  api.get.mockResolvedValue({ data })
  return render(<ThemeProvider theme={theme}><InventoryCredentials inventoryId={9} /></ThemeProvider>)
}

describe('InventoryCredentials', () => {
  beforeEach(() => { api.get.mockReset(); auth.secrets = true; clip.copyToClipboard.mockClear() })
  afterEach(() => { vi.useRealTimers() })

  it('mostra gli utenti e maschera le password', async () => {
    show({ os_user: 'administrator', os_pwd: 'S3greta!', app_usr: 'pacsadmin', app_pwd: '' })
    expect(await screen.findByText('administrator')).toBeInTheDocument()
    expect(screen.getByText('pacsadmin')).toBeInTheDocument()
    expect(screen.queryByText('S3greta!')).toBeNull()
  })

  it('«Mostra» la rivela e dopo 30 secondi la nasconde', async () => {
    show({ os_user: 'administrator', os_pwd: 'S3greta!' })
    await screen.findByText('administrator')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Mostra la password' }))
    expect(screen.getByText('S3greta!')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(screen.queryByText('S3greta!')).toBeNull()
  })

  it('copia la password', async () => {
    show({ os_user: 'administrator', os_pwd: 'S3greta!' })
    await screen.findByText('administrator')
    fireEvent.click(screen.getByRole('button', { name: 'Copia la password' }))
    expect(clip.copyToClipboard).toHaveBeenCalledWith('S3greta!')
  })

  it('senza permesso: «Serve il permesso Credenziali» e nessuna password nel DOM', async () => {
    auth.secrets = false
    show({ os_user: 'administrator', os_pwd: 'S3greta!' })
    expect(await screen.findByText('Serve il permesso Credenziali')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('S3greta!')
  })

  it('nessuna credenziale registrata', async () => {
    show({ os_user: '', os_pwd: '', app_usr: '', app_pwd: '', vnc_pwd: '' })
    expect(await screen.findByText('Nessuna credenziale registrata')).toBeInTheDocument()
  })
})
