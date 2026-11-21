import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import PurchaseOrderTransitionDialog from './PurchaseOrderTransitionDialog'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const show = (over: Partial<React.ComponentProps<typeof PurchaseOrderTransitionDialog>> = {}) => {
  const onConfirm = vi.fn()
  render(<ThemeProvider theme={theme}>
    <PurchaseOrderTransitionDialog open direction="advance" fromStatus="inviato" toStatus="ricevuto" entryId={77} description="Upgrade RIS"
      initialPurchaseOrder="" busy={false} onClose={vi.fn()} onConfirm={onConfirm} {...over} />
  </ThemeProvider>)
  return { onConfirm }
}

describe('PurchaseOrderTransitionDialog (anteprima po-base)', () => {
  it('titolo con l\'azione, riga del PO e solo i campi del passo', () => {
    show()
    expect(screen.getByRole('dialog', { name: 'Registra PO ricevuto' })).toBeInTheDocument()
    expect(screen.getByText('#77 · Upgrade RIS')).toBeInTheDocument()
    expect(screen.getByLabelText('Numero Purchase Order')).toBeInTheDocument()
    expect(screen.getByLabelText('Data ricezione')).toBeInTheDocument()
    expect(screen.queryByLabelText('Numero fattura')).toBeNull()
    expect(screen.getByRole('button', { name: 'Registra PO ricevuto' })).toBeInTheDocument()
  })

  it('manda numero e data; la data è oggi se non la si cambia', () => {
    const { onConfirm } = show()
    fireEvent.change(screen.getByLabelText('Numero Purchase Order'), { target: { value: '4500213377' } })
    fireEvent.change(screen.getByLabelText('Data ricezione'), { target: { value: '2026-11-18' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registra PO ricevuto' }))
    expect(onConfirm).toHaveBeenCalledWith(null, { purchase_order: '4500213377', invoice_number: '', date: '2026-11-18' })
  })

  it('invio offerta: avvisa che descrizione e importo si bloccano', () => {
    show({ fromStatus: 'inserito', toStatus: 'inviato' })
    expect(screen.getByRole('dialog', { name: 'Segna come inviato' })).toBeInTheDocument()
    expect(screen.getByText(/Dopo l'invio descrizione e importo non sono più modificabili/)).toBeInTheDocument()
    expect(screen.getByLabelText('Data invio offerta')).toBeInTheDocument()
  })

  it('ritorno indietro: solo l\'avviso e «Riporta a …»', () => {
    show({ direction: 'revert', fromStatus: 'inviato', toStatus: 'inserito' })
    expect(screen.getByRole('dialog', { name: 'Riporta a Inserito' })).toBeInTheDocument()
    expect(screen.getByText('Descrizione e importo torneranno modificabili.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Data/)).toBeNull()
  })
})
