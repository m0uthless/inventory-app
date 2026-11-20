import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SiteDetailModal, { type SiteDetailModalProps } from './SiteDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../../ui/LeafletMap', () => ({ default: () => null }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))

const detail = {
  id: 10, name: 'Ospedale S. Maria della Scaletta', display_name: 'S. Maria', customer: 2, customer_name: 'AUSL Imola',
  status: 1, status_key: 'active', status_label: 'Attivo', address_line1: 'Via Montericco 4', postal_code: '40026', city: 'Imola', province: 'BO', notes: '',
}
const LISTS: Record<string, unknown[]> = {
  '/issues/': [{ id: 1041, title: 'Worklist vuota sulla CT 2', status: 'in_progress', status_label: 'In lavorazione', site: 10 }],
  '/inventories/': [{ id: 7, site: 10, name: 'PACS', type_label: 'Server' }, { id: 8, site: 10, name: 'CT 2', type_label: 'Modalità' }],
  '/contacts/': [{ id: 3, name: 'Laura Gentili', phone: '0542 662 410', is_primary: true }],
}

const show = (props: Partial<SiteDetailModalProps> = {}) => {
  const onSaved = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <SiteDetailModal detail={detail} statuses={[{ id: 1, label: 'Attivo', key: 'active' }, { id: 2, label: 'Chiuso temporaneamente', key: 'temporarily_closed' }]}
      canChange canDelete onClose={vi.fn()} onSaved={onSaved} onEdit={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onCopy={vi.fn()} onNewIssue={vi.fn()} {...props} />
  </MemoryRouter></ThemeProvider>)
  return { onSaved }
}

const openEdit = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Modifica' }))
}

describe('SiteDetailModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset()); toast.error.mockReset(); navigate.mockReset()
    api.get.mockImplementation((url: string) => Promise.resolve({ data: LISTS[url] ?? [] }))
    api.patch.mockResolvedValue({ data: {} })
  })

  it('mostra cliente, record collegati e conteggi del sito', async () => {
    show()
    expect(await screen.findByText('Worklist vuota sulla CT 2')).toBeInTheDocument()
    expect(screen.getByText('PACS')).toBeInTheDocument()
    expect(screen.getByText('Laura Gentili')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2 inventari/ })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/inventories/', expect.objectContaining({ params: expect.objectContaining({ site: 10 }) }))
    fireEvent.click(screen.getAllByRole('button', { name: 'AUSL Imola' })[0])
    expect(navigate).toHaveBeenCalledWith('/customers?open=2')
  })

  it("salva insieme anagrafica e note, solo i campi cambiati", async () => {
    const { onSaved } = show()
    expect(await screen.findByText('40026')).toBeInTheDocument()
    await openEdit()
    fireEvent.change(screen.getByLabelText('CAP'), { target: { value: '40027' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Accesso dal pronto soccorso' } })
    expect(screen.getByText('2 modifiche da salvare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    expect(api.patch.mock.calls[0]).toEqual(['/sites/10/', { postal_code: '40027', notes: 'Accesso dal pronto soccorso' }])
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('con modifiche in sospeso non apre un altro record', async () => {
    show()
    await openEdit()
    fireEvent.change(screen.getByLabelText('Città'), { target: { value: 'Castel San Pietro' } })
    fireEvent.click(screen.getByText('PACS'))
    expect(toast.error).toHaveBeenCalledWith('Salva o annulla le modifiche prima di aprire un altro record.')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('senza permesso di modifica «Modifica» è spento', async () => {
    show({ canChange: false })
    fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
    expect(screen.getByRole('menuitem', { name: 'Modifica' })).toHaveAttribute('aria-disabled', 'true')
  })
})
