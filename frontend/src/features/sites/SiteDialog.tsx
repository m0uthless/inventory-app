import * as React from 'react'
import { Typography } from '@mui/material'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import SignpostOutlinedIcon from '@mui/icons-material/SignpostOutlined'
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined'
import MarkunreadMailboxOutlinedIcon from '@mui/icons-material/MarkunreadMailboxOutlined'

import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import ProvincePill from '../../ui/ProvincePill'
import { QuickField, QuickFields, QuickForm, SelectPill, TextPill } from '../../ui/campo'
import type { CustomerItem, LookupItem, SiteForm } from './types'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  form: SiteForm
  setForm: React.Dispatch<React.SetStateAction<SiteForm>>
  customers: CustomerItem[]
  statuses: LookupItem[]
  onClose: () => void
  onSave: () => void
}

const FIELD_LABEL: Record<string, string> = {
  customer: 'Cliente', status: 'Stato', name: 'Nome', display_name: 'Nome visualizzato', address_line1: 'Indirizzo', city: 'Città',
  postal_code: 'CAP', province: 'Provincia', country: 'Paese', custom_fields: 'Campi personalizzati', notes: 'Note',
}

/** Nuovo sito / modifica: inserimento rapido (nome come titolo, note come descrizione, indirizzo in pillole). */
export default function SiteDialog(props: Props) {
  const { open, mode, saving, errors, form, setForm, customers, statuses, onClose, onSave } = props
  const set = <K extends keyof SiteForm>(k: K, v: SiteForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const errs = Object.entries(errors).filter(([, m]) => m).map(([k, m]) => (k === '_error' || !FIELD_LABEL[k] ? m : `${FIELD_LABEL[k]}: ${m}`))
  // In modifica, se ci sono già valori nei campi rari, "Altri campi" parte aperto.
  const moreFilled = Boolean(form.display_name.trim() || (form.country.trim() && form.country.trim().toUpperCase() !== 'IT') || Object.keys(form.custom_fields ?? {}).length || errors.display_name || errors.country || errors.custom_fields)
  return (
    <QuickForm
      dialogLabel={mode === 'create' ? 'Nuovo sito' : 'Modifica sito'}
      open={open} onClose={onClose} mode={mode} saving={saving} onSubmit={onSave}
      crumb={{ icon: <PlaceOutlinedIcon />, label: 'Siti' }}
      submitLabel={mode === 'create' ? 'Crea sito' : 'Salva modifiche'}
      title={{ value: form.name, onChange: (v) => set('name', v), placeholder: 'Nome del sito', label: 'Nome', error: errors.name }}
      description={{ value: form.notes, onChange: (v) => set('notes', v), placeholder: 'Note: accessi, orari, referenti in loco…', label: 'Note' }}
      errors={errs}
      pills={
        <>
          <SelectPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente" value={form.customer} error={Boolean(errors.customer)} required
            options={customers.map((c) => ({ value: c.id, label: c.display_name || c.name || c.code || `Cliente #${c.id}`, sub: c.code || undefined }))}
            onChange={(v) => set('customer', v === '' ? '' : Number(v))} />
          <SelectPill icon={<FlagOutlinedIcon />} placeholder="Stato" value={form.status} error={Boolean(errors.status)}
            options={statuses.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set('status', v === '' ? '' : Number(v))} />
          <TextPill icon={<SignpostOutlinedIcon />} placeholder="Indirizzo" value={form.address_line1} onChange={(v) => set('address_line1', v)} error={Boolean(errors.address_line1)} width={150} />
          <TextPill icon={<MarkunreadMailboxOutlinedIcon />} placeholder="CAP" mono inputMode="numeric" value={form.postal_code} onChange={(v) => set('postal_code', v)} error={Boolean(errors.postal_code)} width={50} />
          <TextPill icon={<LocationCityOutlinedIcon />} placeholder="Città" value={form.city} onChange={(v) => set('city', v)} error={Boolean(errors.city)} />
          <ProvincePill value={form.province} onChange={(v) => set('province', v)} error={Boolean(errors.province)} />
        </>
      }
      more={{
        hint: 'nome visualizzato, paese, campi personalizzati', defaultOpen: mode === 'edit' && moreFilled,
        children: (
          <>
            <QuickFields>
              <QuickField label="Nome visualizzato" value={form.display_name} onChange={(v) => set('display_name', v)} error={errors.display_name} help="Se vuoto, si usa il nome." />
              <QuickField label="Paese" value={form.country} onChange={(v) => set('country', v)} error={errors.country} />
            </QuickFields>
            <CustomFieldsEditor entity="site" value={form.custom_fields} onChange={(v) => set('custom_fields', v)} mode="inline" />
            {errors.custom_fields ? <Typography sx={{ fontSize: 12, color: 'error.main' }}>{errors.custom_fields}</Typography> : null}
          </>
        ),
      }}
    />
  )
}
