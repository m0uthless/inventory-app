import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RecordStackHost from './RecordStackHost'
import CustomerDetailModal from '../customers/CustomerDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../../ui/AddressMap', () => ({ default: () => null }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPerm: () => true }) }))

const customer = { id: 2, code: '002', name: 'Azienda USL di Imola', display_name: 'AUSL Imola', city: 'Imola', status: 1, notes: '' }
const site = { id: 10, name: 'Ospedale S. Maria', customer: 2, customer_name: 'AUSL Imola', status: 1, status_key: 'active', address_line1: 'Via Montericco 4', city: 'Imola' }
const GET: Record<string, unknown> = {
  '/sites/': [site], '/sites/10/': site, '/customers/2/': customer, '/contacts/': [], '/issues/': [], '/inventories/': [], '/drive-files/': [],
}

describe('RecordStackHost', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.get.mockImplementation((url: string) => Promise.resolve({ data: GET[url] ?? [] }))
  })

  it('apre il sito sopra il cliente nella stessa finestra e «‹ AUSL Imola» torna indietro', async () => {
    const onClose = vi.fn()
    render(<ThemeProvider theme={theme}><MemoryRouter>
      <RecordStackHost root={{ kind: 'customer', id: 2, label: 'AUSL Imola' }} onClose={onClose}>
        <CustomerDetailModal detail={customer} loading={false} statuses={[]} vendorColor={() => '#000'} canChange canDelete canEditVpn
          showContracts={false} showDevices={false} canEditDevices={false} address={null}
          onClose={onClose} onSaved={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onCopy={vi.fn()} onEditVpn={vi.fn()} onNewIssue={vi.fn()} />
      </RecordStackHost>
    </MemoryRouter></ThemeProvider>)

    fireEvent.click(await screen.findByText('Ospedale S. Maria'))
    const nav = await screen.findByRole('navigation', { name: 'Percorso' })
    expect(within(nav).getByRole('button', { name: 'AUSL Imola' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Ospedale S. Maria' })).toBeVisible()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)

    fireEvent.click(within(nav).getByRole('button', { name: 'AUSL Imola' }))
    expect(screen.queryByRole('navigation', { name: 'Percorso' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /AUSL Imola/ })).toBeVisible()
  })
})
