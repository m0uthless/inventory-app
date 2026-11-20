import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import IssueDetail from './IssueDetail'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { IssueRow } from './types'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPerm: () => true }) }))

const issue = {
  id: 1041, title: 'Worklist vuota sulla CT 2', description: 'Dalle 7:30 niente worklist.', servicenow_id: '', customer: 2, customer_name: 'AUSL Imola', customer_code: '002',
  customer_placeholder: '', is_customer_placeholder: false, site: 10, site_name: 'S. Maria', inventory: null, inventory_name: null, inventory_knumber: null,
  inventory_serial_number: null, inventory_hostname: null, category: null, category_label: null, assigned_to: null, assigned_to_username: null,
  assigned_to_full_name: null, assigned_to_avatar: null, created_by: 1, created_by_username: 'root', created_by_full_name: 'Root', priority: 'high', priority_label: 'Alta',
  status: 'in_progress', status_label: 'In lavorazione', waiting_reason: '', waiting_reason_label: null, opened_at: '2026-11-16T08:40:00Z', closed_at: null,
  due_date: null, days_open: 2, comments_count: 0, servicenow_external_url: null, created_at: '2026-11-16T08:40:00Z', updated_at: '2026-11-17T15:41:00Z', deleted_at: null,
} as unknown as IssueRow

const show = (over: Partial<IssueRow> = {}) => {
  const onPatch = vi.fn().mockResolvedValue(undefined)
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <IssueDetail issue={{ ...issue, ...over }} onClose={vi.fn()} comments={[]} commentsLoading={false} events={[]} newComment="" sendingComment={false}
      onNewCommentChange={vi.fn()} onSendComment={vi.fn()} users={[{ id: 7, label: 'Marco Bassi', username: 'mbassi', leave_area: 4 } as never]} categories={[{ id: 1, label: 'DICOM' }]} meId={5}
      areas={[{ id: 4, label: 'Radiologia' }, { id: 5, label: 'Sistemi' }]}
      onPatch={onPatch} onEdit={vi.fn()} onDelete={vi.fn()} onLinkInventory={vi.fn()} onOpenServiceNow={vi.fn()} />
  </MemoryRouter></ThemeProvider>)
  return { onPatch }
}

describe('IssueDetail', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.get.mockResolvedValue({ data: [] }) })

  it('«Segna come risolta» e «Assegna a me» salvano subito', async () => {
    const { onPatch } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Segna come risolta' }))
    expect(onPatch).toHaveBeenCalledWith({ status: 'resolved', waiting_reason: '' }, 'Issue risolta')
    fireEvent.click(screen.getByRole('button', { name: 'Assegna a me' }))
    expect(onPatch).toHaveBeenCalledWith({ assigned_to: 5 }, 'Assegnata a te')
  })

  it('la priorità si cambia al volo dal menu', async () => {
    const { onPatch } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Priorità: cambia' }))
    fireEvent.click(screen.getAllByRole('menuitem')[0])
    expect(onPatch).toHaveBeenCalledWith({ priority: 'critical' }, 'Priorità aggiornata')
  })

  it('in lettura la descrizione è testo; «Modifica» la rende un campo e salva solo quello che cambia', async () => {
    const { onPatch } = show()
    expect(await screen.findByText('Dalle 7:30 niente worklist.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Descrizione')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifica' }))
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Dalle 7:30 niente worklist dal RIS.' } })
    fireEvent.change(screen.getByLabelText('Titolo'), { target: { value: 'Worklist vuota sulla CT 2 (RIS)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith({ title: 'Worklist vuota sulla CT 2 (RIS)', description: 'Dalle 7:30 niente worklist dal RIS.' }, 'Issue aggiornata'))
  })

  it('una issue di un\'altra area si apre in sola lettura', async () => {
    show({ area: 3, area_label: 'Radiologia', can_edit: false })
    expect(await screen.findByText('Issue dell\'area Radiologia: puoi solo consultarla.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Segna come risolta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assegna a me' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Scrivi un commento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }))
    expect(screen.getByRole('menuitem', { name: 'Modifica' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: 'Elimina' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('l\'area si cambia dai Dettagli; un assegnatario fuori dalla nuova area si toglie', async () => {
    const { onPatch } = show({ area: 4, area_label: 'Radiologia', can_edit: true, assigned_to: 7, assigned_to_full_name: 'Marco Bassi' })
    fireEvent.click(await screen.findByRole('button', { name: 'Area: cambia' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sistemi' }))
    expect(onPatch).toHaveBeenCalledWith({ area: 5, assigned_to: null }, "Area aggiornata. L'assegnatario non fa parte della nuova area: è stato tolto.")
  })

  it('con un assegnatario della nuova area cambia solo l\'area', async () => {
    const { onPatch } = show({ area: 5, area_label: 'Sistemi', can_edit: true, assigned_to: 7, assigned_to_full_name: 'Marco Bassi' })
    fireEvent.click(await screen.findByRole('button', { name: 'Area: cambia' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Radiologia' }))
    expect(onPatch).toHaveBeenCalledWith({ area: 4 }, 'Area aggiornata')
  })

  it('in sola lettura l\'area non si cambia', async () => {
    show({ area: 4, area_label: 'Radiologia', can_edit: false })
    expect(await screen.findByRole('button', { name: 'Area: cambia' })).toBeDisabled()
  })
})
