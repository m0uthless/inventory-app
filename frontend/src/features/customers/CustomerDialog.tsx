import * as React from 'react'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'

import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import ProvincePill from '../../ui/ProvincePill'
import { QuickField, QuickFields, QuickForm, SelectPill, TextPill } from '../../ui/campo'
import type { CustomerForm, LookupItem } from './types'

type CustomerDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  statuses: LookupItem[]
  form: CustomerForm
  onClose: () => void
  onSave: () => void
  onFormChange: React.Dispatch<React.SetStateAction<CustomerForm>>
  onFieldErrorsChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

const FIELD_LABEL: Record<string, string> = { status: 'Vendor', name: 'Nome', display_name: 'Nome visualizzato', vat_number: 'P.IVA', tax_code: 'Codice fiscale', province: 'Provincia', notes: 'Note', custom_fields: 'Campi personalizzati' }

/** Nuovo cliente / modifica: inserimento rapido (nome come titolo, note come descrizione, il resto in pillole). */
export default function CustomerDialog({
  open, mode, saving, errors, statuses, form, onClose, onSave, onFormChange, onFieldErrorsChange,
}: CustomerDialogProps) {
  // Ogni modifica toglie l'errore di quel campo (come prima).
  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) => {
    onFormChange((f) => ({ ...f, [k]: v }))
    onFieldErrorsChange((er) => { if (!(k in er)) return er; const n = { ...er }; delete n[k as string]; return n })
  }
  const errs = Object.entries(errors).filter(([, m]) => m).map(([k, m]) => (k === '_error' || !FIELD_LABEL[k] ? m : `${FIELD_LABEL[k]}: ${m}`))
  return (
    <QuickForm
      dialogLabel={mode === 'create' ? 'Nuovo cliente' : 'Modifica cliente'}
      open={open} onClose={onClose} mode={mode} saving={saving} onSubmit={onSave}
      crumb={{ icon: <ApartmentOutlinedIcon />, label: 'Clienti' }}
      submitLabel={mode === 'create' ? 'Crea cliente' : 'Salva modifiche'}
      title={{
        value: form.name, placeholder: 'Ragione sociale', label: 'Nome', error: errors.name,
        onChange: (name) => {
          // Il nome visualizzato segue il nome finché non lo si cambia a mano.
          onFormChange((f) => ({ ...f, name, display_name: f.display_name.trim() === '' || f.display_name === f.name ? name : f.display_name }))
          onFieldErrorsChange((er) => { if (!('name' in er)) return er; const n = { ...er }; delete n.name; return n })
        },
      }}
      description={{ value: form.notes, onChange: (v) => set('notes', v), placeholder: 'Note sul cliente…', label: 'Note' }}
      errors={errs}
      pills={
        <>
          <SelectPill icon={<StorefrontOutlinedIcon />} placeholder="Vendor" value={form.status} error={Boolean(errors.status)}
            options={statuses.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set('status', v === '' ? '' : Number(v))} />
          <ProvincePill value={form.province} onChange={(v) => set('province', v)} error={Boolean(errors.province)} />
          <TextPill icon={<ReceiptLongOutlinedIcon />} placeholder="P.IVA" mono inputMode="numeric" value={form.vat_number} onChange={(v) => set('vat_number', v)} error={Boolean(errors.vat_number)} width={90} />
          <TextPill icon={<BadgeOutlinedIcon />} placeholder="Codice fiscale" mono value={form.tax_code} onChange={(v) => set('tax_code', v)} error={Boolean(errors.tax_code)} />
        </>
      }
      more={{
        hint: 'nome visualizzato, campi personalizzati',
        defaultOpen: Boolean(errors.display_name || errors.custom_fields) || (mode === 'edit' && form.display_name.trim() !== '' && form.display_name !== form.name),
        children: (
          <>
            <QuickFields>
              <QuickField label="Nome visualizzato" value={form.display_name} onChange={(v) => set('display_name', v)} error={errors.display_name} help="Se vuoto, si usa il nome." />
            </QuickFields>
            <CustomFieldsEditor entity="customer" value={form.custom_fields} onChange={(v) => onFormChange((f) => ({ ...f, custom_fields: v }))} mode="inline" />
          </>
        ),
      }}
    />
  )
}
