import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import PurchaseOrderDetailCard from './PurchaseOrderDetailCard'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { PurchaseOrderDetail } from './types'

const theme = THEME_REGISTRY.default.build('light')
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const base = {
  id: 142, offer_date: '2026-10-20', description: 'Migrazione storage su NAS', client_name: 'Philips', customer: 2, customer_name: 'AUSL Imola',
  purchase_order: '', invoice_number: '', is_invoiced: false, kind: 'extra', kind_label: 'Extra', status: 'inviato', status_label: 'Inviato', is_editable: false,
  sent_at: '2026-10-24T09:00:00Z', received_at: null, invoiced_at: null, documents: [], amount_mode: 'fisso', amount: '18400.00', costs_incurred: '9800.00',
  notes: '', followed_by: null, followed_by_name: null,
} as unknown as PurchaseOrderDetail

const show = (detail: PurchaseOrderDetail = base) => {
  const onPatch = vi.fn().mockResolvedValue(undefined)
  const onAdvance = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <PurchaseOrderDetailCard detail={detail} loading={false} committenteColor="#3f7fbf" canChange canDelete events={[]} users={[{ id: 7, label: 'Anna Ferri' }]} meId={5}
      onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onCopy={vi.fn()} onPatch={onPatch} onAdvance={onAdvance} onRevert={vi.fn()}
      uploadingSlot={null} deletingDocId={null} onUploadDocument={vi.fn()} onDeleteDocument={vi.fn()} />
  </MemoryRouter></ThemeProvider>)
  return { onPatch, onAdvance }
}

describe('PurchaseOrderDetailCard', () => {
  it('«Seguito da» si sceglie al volo, e «Lo seguo io» quando non lo segue nessuno', async () => {
    const { onPatch } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Lo seguo io' }))
    expect(onPatch).toHaveBeenCalledWith({ followed_by: 5 }, 'Lo segui tu')
    fireEvent.click(screen.getByRole('button', { name: 'Seguito da: cambia' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Anna Ferri' }))
    expect(onPatch).toHaveBeenCalledWith({ followed_by: 7 }, 'Seguito da Anna Ferri')
  })

  it("l'azione principale fa avanzare il flusso", async () => {
    const { onAdvance } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Registra PO ricevuto' }))
    expect(onAdvance).toHaveBeenCalled()
  })

  it("dopo l'invio descrizione e importo restano bloccati in modifica; il resto si salva", async () => {
    const { onPatch } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifica' }))
    expect(screen.queryByLabelText('Descrizione')).not.toBeInTheDocument()
    expect(screen.getByText('Descrizione · bloccata')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Numero PO'), { target: { value: 'PO-2026-00871' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith({ purchase_order: 'PO-2026-00871' }, 'Purchase Order aggiornato'))
  })
})
