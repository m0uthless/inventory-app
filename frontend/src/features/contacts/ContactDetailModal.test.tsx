import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ContactDetailModal, { type ContactDetailModalProps } from './ContactDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))

const detail = {
  id: 3, name: 'Laura Gentili', department: 'Radiologia · TSRM', phone: '0542 662 410', email: 'l.gentili@example.org',
  customer: 2, customer_name: 'AUSL Imola', site: 10, site_name: 'Ospedale S. Maria', is_primary: false, notes: '',
}
const LISTS: Record<string, unknown[]> = {
  '/sites/': [{ id: 10, name: 'Ospedale S. Maria', city: 'Imola', assets_count: 12 }, { id: 11, name: 'Casa della Salute', city: 'Imola' }],
  '/contacts/': [detail, { id: 4, name: 'Marco Bassi', site: 10, phone: '0542 1' }, { id: 5, name: 'Sede Centrale', site: null }],
}

const show = (props: Partial<ContactDetailModalProps> = {}) => {
  const onSaved = vi.fn(); const onOpenContact = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <ContactDetailModal detail={detail} canChange canDelete onClose={vi.fn()} onSaved={onSaved} onEdit={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()}
      onCopy={vi.fn()} onOpenContact={onOpenContact} {...props} />
  </MemoryRouter></ThemeProvider>)
  return { onSaved, onOpenContact }
}

const openEdit = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Modifica' }))
}

describe('ContactDetailModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset()); toast.error.mockReset(); navigate.mockReset()
    api.get.mockImplementation((url: string) => Promise.resolve({ data: LISTS[url] ?? [] }))
    api.patch.mockResolvedValue({ data: {} })
  })

  it('mostra recapiti, dove lavora e i colleghi dello stesso sito', async () => {
    const { onOpenContact } = show()
    expect(await screen.findByText('Marco Bassi')).toBeInTheDocument()
    expect(screen.queryByText('Sede Centrale')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chiama' })).toHaveAttribute('href', 'tel:0542662410')
    expect(screen.getByText('12 inventari')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Marco Bassi'))
    expect(onOpenContact).toHaveBeenCalledWith(4)
  })

  it('salva solo i campi cambiati, sito e primario compresi', async () => {
    const { onSaved } = show()
    expect(await screen.findByText('No')).toBeInTheDocument()
    await openEdit()
    fireEvent.click(screen.getByLabelText('Contatto primario'))
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '0542 999' } })
    expect(screen.getByText('2 modifiche da salvare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    expect(api.patch.mock.calls[0]).toEqual(['/contacts/3/', { phone: '0542 999', is_primary: true }])
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('con modifiche in sospeso non apre un altro contatto', async () => {
    const { onOpenContact } = show()
    await openEdit()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@example.org' } })
    fireEvent.click(screen.getByText('Marco Bassi'))
    expect(onOpenContact).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Salva o annulla le modifiche prima di aprire un altro record.')
  })

  it('senza permesso di modifica «Modifica» è spento', async () => {
    show({ canChange: false })
    fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
    expect(screen.getByRole('menuitem', { name: 'Modifica' })).toHaveAttribute('aria-disabled', 'true')
  })
})
