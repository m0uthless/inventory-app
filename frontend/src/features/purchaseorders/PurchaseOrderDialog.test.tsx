import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import PurchaseOrderDialog from './PurchaseOrderDialog'
import { emptyForm, type PurchaseOrderForm } from './types'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
Element.prototype.scrollIntoView = vi.fn()
const customers = [{ id: 3, name: 'AUSL Imola', display_name: 'AUSL Imola', code: 'C-3' }]

function Harness({ initial, isEditable = true, mode = 'create', onSave = vi.fn(), spy }: { initial?: Partial<PurchaseOrderForm>; isEditable?: boolean; mode?: 'create' | 'edit'; onSave?: () => void; spy?: (f: PurchaseOrderForm) => void }) {
  const [form, setForm] = React.useState<PurchaseOrderForm>({ ...emptyForm(), ...initial })
  React.useEffect(() => { spy?.(form) }, [form, spy])
  return <ThemeProvider theme={theme}><PurchaseOrderDialog open mode={mode} saving={false} errors={{}} customers={customers as never} form={form} isEditable={isEditable} onClose={vi.fn()} onSave={onSave} onFormChange={setForm} /></ThemeProvider>
}

describe('PurchaseOrderDialog (QuickForm, anteprima fm-base)', () => {
  it('nuovo PO: descrizione, committente e importo; Crea PO', () => {
    const onSave = vi.fn(); let last: PurchaseOrderForm | null = null
    render(<Harness onSave={onSave} spy={(f) => { last = f }} />)
    expect(screen.getByRole('dialog', { name: 'Nuovo Purchase Order' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Descrizione dell\'offerta'), { target: { value: 'Upgrade RIS' } })
    fireEvent.change(screen.getByLabelText('Committente'), { target: { value: 'AUSL Imola' } })
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '12000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crea PO' }))
    expect(onSave).toHaveBeenCalled()
    expect(last).toMatchObject({ description: 'Upgrade RIS', client_name: 'AUSL Imola', amount: '12000', amount_mode: 'fisso' })
  })

  it('a giornate: giornate e tariffa, con l\'importo calcolato', () => {
    render(<Harness initial={{ amount_mode: 'giornate', days: '3', daily_rate: '500' }} />)
    expect(screen.getByLabelText('Giornate')).toHaveValue('3')
    expect(screen.getByLabelText('Tariffa al giorno')).toHaveValue('500')
    expect(screen.getByText(/= 1\.500,00 €/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Importo')).toBeNull()
  })

  it('cliente non in anagrafica: testo libero al posto della scelta', () => {
    let last: PurchaseOrderForm | null = null
    render(<Harness initial={{ customer: 3 }} spy={(f) => { last = f }} />)
    fireEvent.click(screen.getByRole('button', { name: /Cliente/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Non è in anagrafica? Scrivi il nome' }))
    fireEvent.change(screen.getByLabelText('Cliente non in anagrafica'), { target: { value: 'Clinica Nuova' } })
    expect(last).toMatchObject({ customer: '', customer_placeholder: 'Clinica Nuova' })
  })

  it('PO già inviato: descrizione e importo bloccati, con l\'avviso', () => {
    render(<Harness mode="edit" isEditable={false} initial={{ description: 'Upgrade RIS', amount: '12000' }} />)
    expect(screen.getByText(/Descrizione e importo non sono modificabili/)).toBeInTheDocument()
    expect(screen.getByLabelText('Descrizione dell\'offerta')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Importo')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeEnabled()
  })
})
