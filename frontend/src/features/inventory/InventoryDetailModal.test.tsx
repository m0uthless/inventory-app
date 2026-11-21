import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import InventoryDetailModal, { type InventoryDetailModalProps } from './InventoryDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))

const detail = {
  id: 7, customer: 2, customer_name: 'AUSL Imola', site: 10, site_name: 'S. Maria', name: 'PACS · nodo 1', knumber: 'K-104233', serial_number: 'CZ2391A0F',
  hostname: 'aimpacs01', local_ip: '10.20.5.10', srsa_ip: '', location: 'Sala server', telefono: '', type: 1, type_key: 'pacs', type_label: 'PACS',
  status: 1, status_key: 'in_use', status_label: 'In uso', os_user: 'Administrator', secrets_set: ['os_pwd'], app_usr: '',
  manufacturer: 'Philips', model: 'IntelliSpace', warranty_end_date: '2027-06-30', notes: 'Nodo primario', tags: [], monitors: [],
}
const closed = Array.from({ length: 7 }, (_, i) => ({ id: 900 + i, title: `Vecchio problema ${i}`, status: 'closed', status_label: 'Chiusa' }))
const get = (url: string, cfg?: { params?: { status?: string[] } }) => {
  if (url === '/issues/') return Promise.resolve({ data: cfg?.params?.status?.includes('closed') ? closed : [{ id: 1041, title: 'Worklist vuota', status: 'in_progress', status_label: 'In lavorazione' }] })
  if (url === '/inventories/7/secrets/') return Promise.resolve({ data: { os_pwd: 'Pacs!2026', app_pwd: null, vnc_pwd: null } })
  if (url === '/sites/') return Promise.resolve({ data: [{ id: 10, name: 'S. Maria' }, { id: 11, name: 'Castel San Pietro' }] })
  return Promise.resolve({ data: [] })
}

const show = (props: Partial<InventoryDetailModalProps> = {}) => {
  const onSaved = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <InventoryDetailModal detail={detail} statuses={[{ id: 1, label: 'In uso', key: 'in_use' }, { id: 2, label: 'In riparazione', key: 'repair' }]} types={[{ id: 1, label: 'PACS' }]}
      canChange canDelete canViewSecrets onClose={vi.fn()} onSaved={onSaved} onEditAll={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onCopy={vi.fn()} onNewIssue={vi.fn()} {...props} />
  </MemoryRouter></ThemeProvider>)
  return { onSaved }
}
const openEdit = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Modifica' }))
}

describe('InventoryDetailModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset()); toast.error.mockReset()
    api.get.mockImplementation(get)
    api.patch.mockResolvedValue({ data: {} })
  })

  it('mostra le issue aperte e lo storico delle chiuse, le prime cinque e poi tutte', async () => {
    show()
    expect(await screen.findByText('Worklist vuota')).toBeInTheDocument()
    expect(screen.getByText('Vecchio problema 4')).toBeInTheDocument()
    expect(screen.queryByText('Vecchio problema 6')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutte le 7' }))
    expect(screen.getByText('Vecchio problema 6')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'K-Number 000104233' })).toBeInTheDocument()
  })

  it('i dati si leggono come testo; «Modifica» li trasforma in campi e salva solo quelli cambiati', async () => {
    const { onSaved } = show()
    expect(await screen.findByText('Sala server')).toBeInTheDocument()
    expect(screen.queryByLabelText('Posizione')).not.toBeInTheDocument()
    await openEdit()
    expect(screen.getByText('In modifica')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Posizione'), { target: { value: 'Sala server, piano −1' } })
    fireEvent.change(screen.getByLabelText('Password os_pwd'), { target: { value: 'Nuova!2026' } })
    expect(screen.getByText('2 modifiche da salvare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    expect(api.patch.mock.calls[0]).toEqual(['/inventories/7/', { location: 'Sala server, piano −1', os_pwd: 'Nuova!2026' }])
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(screen.queryByText('In modifica')).not.toBeInTheDocument()
  })

  it('la manutenzione compare per l\'hardware, non per un applicativo senza piani', async () => {
    api.get.mockImplementation((url: string, cfg?: { params?: { status?: string[] } }) => (url.endsWith('/maintenance/') ? Promise.resolve({ data: { plans: [], events: [] } }) : get(url, cfg)))
    const { unmount } = render(<ThemeProvider theme={theme}><MemoryRouter>
      <InventoryDetailModal detail={{ ...detail, type_key: 'wfm' }} statuses={[]} types={[]} canChange canDelete canViewSecrets canViewMaintenance
        onClose={vi.fn()} onSaved={vi.fn()} onEditAll={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onCopy={vi.fn()} onNewIssue={vi.fn()} />
    </MemoryRouter></ThemeProvider>)
    expect(await screen.findByText('Worklist vuota')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Manutenzione' })).not.toBeInTheDocument()
    unmount()
    show({ canViewMaintenance: true, detail: { ...detail, type_key: 'server' } })
    expect(await screen.findByRole('heading', { name: 'Manutenzione' })).toBeInTheDocument()
  })

  it('senza permesso di scrittura «Modifica» è spento', async () => {
    show({ canChange: false })
    fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
    expect(screen.getByRole('menuitem', { name: 'Modifica' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('senza permesso Credenziali la password non si vede né si cambia', async () => {
    show({ canViewSecrets: false, detail: { ...detail, secrets_set: undefined } })
    expect(await screen.findByText('Serve il permesso Credenziali')).toBeInTheDocument()
    await openEdit()
    const sec = screen.getByText('Sistema operativo').parentElement!
    expect(within(sec).getByText('Serve il permesso Credenziali per cambiarla')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password os_pwd')).not.toBeInTheDocument()
  })

  it('password: non arriva col dettaglio; «Mostra» e «Copia» la chiedono al server', async () => {
    const onCopy = vi.fn()
    show({ onCopy })
    await screen.findByText('Administrator')
    const secretCalls = () => api.get.mock.calls.filter(([u]) => u === '/inventories/7/secrets/').length
    expect(secretCalls()).toBe(0)
    expect(screen.queryByText('Pacs!2026')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostra la password' }))
    expect(await screen.findByText('Pacs!2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copia la password' }))
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('Pacs!2026'))
    expect(secretCalls()).toBe(1)
  })

  it('in modifica la password impostata è «invariata» e non si manda se non la si cambia', async () => {
    show()
    await openEdit()
    expect(screen.getByLabelText('Password os_pwd')).toHaveAttribute('placeholder', 'Invariata · scrivi per cambiarla')
    fireEvent.change(screen.getByLabelText('Posizione'), { target: { value: 'Sala B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/inventories/7/', { location: 'Sala B' }))
  })
})
