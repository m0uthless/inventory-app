import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CustomerDetailModal, { type CustomerDetailModalProps } from './CustomerDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../../ui/LeafletMap', () => ({ default: () => null }))

const detail = { id: 2, code: '002', name: 'Azienda USL di Imola', display_name: 'AUSL Imola', city: 'Imola', province: 'BO', vat_number: '', tax_code: '', status: 1, status_label: 'Philips', notes: '', has_vpn: false }
const LISTS: Record<string, unknown[]> = {
  '/issues/': [{ id: 1041, title: 'Worklist vuota sulla CT 2', status: 'in_progress', status_label: 'In lavorazione', site: 10, site_name: 'S. Maria della Scaletta' }],
  '/sites/': [{ id: 10, name: 'Ospedale S. Maria della Scaletta', address_line1: 'Via Montericco 4', city: 'Imola' }],
  '/inventories/': [{ id: 7, site: 10, name: 'PACS', type_label: 'Server', site_name: 'S. Maria' }],
  '/contacts/': [{ id: 3, name: 'Laura Gentili', phone: '0542 662 410', is_primary: true }],
}

const show = (props: Partial<CustomerDetailModalProps> = {}) => {
  const onSaved = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <CustomerDetailModal detail={detail} loading={false} statuses={[{ id: 1, label: 'Philips' }, { id: 2, label: 'Biotron' }]} vendorColor={() => '#3f7fbf'}
      canChange canDelete canEditVpn showContracts={false} showDevices={false} canEditDevices={false} address={null}
      onClose={vi.fn()} onSaved={onSaved} onEdit={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onCopy={vi.fn()} onEditVpn={vi.fn()} onNewIssue={vi.fn()} {...props} />
  </MemoryRouter></ThemeProvider>)
  return { onSaved }
}

describe('CustomerDetailModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset()); toast.error.mockReset()
    api.get.mockImplementation((url: string) => Promise.resolve({ data: LISTS[url] ?? [] }))
    api.patch.mockResolvedValue({ data: {} })
  })

  it('mostra i record collegati e i conteggi in testata', async () => {
    show()
    expect(await screen.findByText('Worklist vuota sulla CT 2')).toBeInTheDocument()
    expect(screen.getByText('Ospedale S. Maria della Scaletta')).toBeInTheDocument()
    expect(screen.getByText('Laura Gentili')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1 issue aperta/ })).toBeInTheDocument()
  })

  it("l'anagrafica si salva tutta insieme dalla barra", async () => {
    const { onSaved } = show()
    expect(await screen.findByText('manca')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('P.IVA'), { target: { value: '00705271203' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Martedì 7–9' } })
    expect(screen.getByText('2 modifiche da salvare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    const [url, body] = api.patch.mock.calls[0]
    expect(url).toBe('/customers/2/')
    expect(body).toEqual({ vat_number: '00705271203', notes: 'Martedì 7–9' })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('si apre solo quando i dati collegati sono arrivati', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    api.get.mockImplementation((url: string) => gate.then(() => ({ data: LISTS[url] ?? [] })))
    show()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    release()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Worklist vuota sulla CT 2')).toBeInTheDocument()
  })

  it('con modifiche in sospeso non apre un altro record', async () => {
    show()
    fireEvent.change(await screen.findByLabelText('P.IVA'), { target: { value: '1' } })
    fireEvent.click(await screen.findByText('Ospedale S. Maria della Scaletta'))
    expect(toast.error).toHaveBeenCalledWith('Salva o annulla le modifiche prima di aprire un altro record.')
  })

  it('senza permesso di modifica i campi sono bloccati', async () => {
    show({ canChange: false })
    expect(await screen.findByLabelText('Ragione sociale')).toBeDisabled()
  })
})
