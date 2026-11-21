import * as React from 'react'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import EuroOutlinedIcon from '@mui/icons-material/EuroOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import TagOutlinedIcon from '@mui/icons-material/TagOutlined'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'

import { DatePill, Pill, QuickForm, SelectPill, StaticPill, TextPill } from '../../ui/campo/QuickForm'
import type { CustomerItem, PurchaseOrderForm } from './types'
import { computeGiornateAmount, formatEuro } from './types'

type PurchaseOrderDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  customers: CustomerItem[]
  form: PurchaseOrderForm
  isEditable: boolean
  onClose: () => void
  onSave: () => void
  onFormChange: React.Dispatch<React.SetStateAction<PurchaseOrderForm>>
}

const FIELD_LABEL: Record<string, string> = {
  description: 'Descrizione', client_name: 'Committente', customer: 'Cliente', customer_placeholder: 'Cliente', offer_date: 'Data offerta',
  amount: 'Importo', days: 'Giornate', daily_rate: 'Tariffa', costs_incurred: 'Costi sostenuti', purchase_order: 'Purchase Order',
  invoice_number: 'Fattura', notes: 'Note', kind: 'Tipo',
}

/**
 * Nuovo / modifica Purchase Order con l'inserimento rapido standard (QuickForm, anteprima fm-base variante C):
 * la descrizione come titolo, le note sotto, il resto in pillole. Dopo l'invio descrizione e importo restano bloccati.
 */
export default function PurchaseOrderDialog({ open, mode, saving, errors, customers, form, isEditable, onClose, onSave, onFormChange }: PurchaseOrderDialogProps) {
  // Cliente dall'anagrafica oppure, se manca, nome libero (customer_placeholder): mutuamente esclusivi (validate() del backend).
  const [freeCustomer, setFreeCustomer] = React.useState(false)
  React.useEffect(() => { if (open) setFreeCustomer(Boolean(form.customer_placeholder)) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof PurchaseOrderForm>(k: K, v: PurchaseOrderForm[K]) => onFormChange((f) => ({ ...f, [k]: v }))
  const switchCustomer = (free: boolean) => {
    setFreeCustomer(free)
    onFormChange((f) => ({ ...f, customer: free ? '' : f.customer, customer_placeholder: free ? f.customer_placeholder : '' }))
  }
  const computed = form.amount_mode === 'giornate' ? computeGiornateAmount(form.days, form.daily_rate) : null
  const errs = Object.entries(errors).filter(([, m]) => m).map(([k, m]) => (k === '_error' || !FIELD_LABEL[k] ? m : `${FIELD_LABEL[k]}: ${m}`))
  const locked = !isEditable
  const customerLabel = (c: CustomerItem) => c.display_name || c.name || c.code || `Cliente #${c.id}`
  const numberPills = (
    <>
      <TextPill icon={<TagOutlinedIcon />} placeholder="Numero Purchase Order" prefix="PO" mono value={form.purchase_order} onChange={(v) => set('purchase_order', v)} error={Boolean(errors.purchase_order)} />
      <TextPill icon={<ReceiptLongOutlinedIcon />} placeholder="Numero fattura" prefix="Fattura" mono value={form.invoice_number} onChange={(v) => set('invoice_number', v)} error={Boolean(errors.invoice_number)} title="Vuoto = non ancora fatturato" />
    </>
  )

  return (
    <QuickForm
      dialogLabel={mode === 'create' ? 'Nuovo Purchase Order' : 'Modifica Purchase Order'}
      open={open} onClose={onClose} mode={mode} saving={saving} onSubmit={onSave}
      crumb={{ icon: <ReceiptLongOutlinedIcon />, label: 'Purchase Order' }}
      submitLabel={mode === 'create' ? 'Crea PO' : 'Salva modifiche'}
      notice={locked ? <>Descrizione e importo non sono modificabili con lo stato attuale: riporta il PO a <b>Inserito</b> per cambiarli.</> : undefined}
      title={{ value: form.description, onChange: (v) => set('description', v), placeholder: "Descrizione dell'offerta", label: "Descrizione dell'offerta", error: errors.description, readOnly: locked }}
      description={{ value: form.notes, onChange: (v) => set('notes', v), placeholder: 'Note (facoltative)', label: 'Note' }}
      errors={errs}
      pills={
        <>
          <TextPill icon={<BusinessCenterOutlinedIcon />} placeholder="Committente" value={form.client_name} onChange={(v) => set('client_name', v)} error={Boolean(errors.client_name)} title="Committente (testo libero)" />
          {freeCustomer ? (
            <>
              <TextPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente non in anagrafica" value={form.customer_placeholder} onChange={(v) => set('customer_placeholder', v)}
                error={Boolean(errors.customer_placeholder)} title="Cliente non ancora in anagrafica: si collega in un secondo momento." />
              <Pill icon={<UndoRoundedIcon />} placeholder="Cerca in anagrafica" onClick={() => switchCustomer(false)} />
            </>
          ) : (
            <SelectPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente" title="Cliente collegato" value={form.customer} emptyLabel="Nessuno" error={Boolean(errors.customer)}
              options={customers.map((c) => ({ value: c.id, label: customerLabel(c) }))}
              action={{ label: 'Non è in anagrafica? Scrivi il nome', onClick: () => switchCustomer(true) }}
              onChange={(v) => set('customer', v === '' ? '' : Number(v))} />
          )}
          <SelectPill placeholder="Tipo" value={form.kind} options={[{ value: 'ordinario', label: 'Ordinario' }, { value: 'extra', label: 'Extra' }]}
            onChange={(v) => v && set('kind', v as PurchaseOrderForm['kind'])} />
          <DatePill icon={<EventOutlinedIcon />} placeholder="Data offerta" value={form.offer_date} onChange={(v) => set('offer_date', v)} clearable={false}
            quick={[[0, 'Oggi'], [-1, 'Ieri']]} error={Boolean(errors.offer_date)} />
          <SelectPill icon={<CalculateOutlinedIcon />} placeholder="Calcolo" title="Calcolo dell'importo" value={form.amount_mode} disabled={locked}
            options={[{ value: 'fisso', label: 'Valore fisso' }, { value: 'giornate', label: 'Giornate × tariffa' }]}
            onChange={(v) => v && set('amount_mode', v as PurchaseOrderForm['amount_mode'])} />
          {form.amount_mode === 'fisso' ? (
            <TextPill icon={<EuroOutlinedIcon />} placeholder="Importo" prefix="Importo" suffix="€" inputMode="decimal" value={form.amount} onChange={(v) => set('amount', v)} disabled={locked} error={Boolean(errors.amount)} />
          ) : (
            <>
              <TextPill placeholder="Giornate" suffix="gg" inputMode="decimal" value={form.days} onChange={(v) => set('days', v)} disabled={locked} error={Boolean(errors.days)} />
              <TextPill placeholder="Tariffa al giorno" prefix="×" suffix="€" inputMode="decimal" value={form.daily_rate} onChange={(v) => set('daily_rate', v)} disabled={locked} error={Boolean(errors.daily_rate)} />
              <StaticPill icon={<EuroOutlinedIcon />} title="Importo calcolato" label={`= ${formatEuro(computed || 0)}`} />
            </>
          )}
          <TextPill placeholder="Costi sostenuti" prefix="Costi" suffix="€" inputMode="decimal" value={form.costs_incurred} onChange={(v) => set('costs_incurred', v)} error={Boolean(errors.costs_incurred)} />
          {mode === 'edit' ? numberPills : null}
        </>
      }
      more={mode === 'create' ? { hint: 'numero PO e fattura', children: <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{numberPills}</div> } : undefined}
    />
  )
}
