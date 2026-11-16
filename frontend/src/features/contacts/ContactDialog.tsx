import * as React from 'react'
import PermContactCalendarOutlinedIcon from '@mui/icons-material/PermContactCalendarOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined'
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded'

import { QuickForm, SelectPill, TextPill, TogglePill } from '../../ui/campo'
import type { ContactForm, CustomerItem, SiteItem } from './types'

type ContactDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  customers: CustomerItem[]
  sites: SiteItem[]
  form: ContactForm
  onClose: () => void
  onSave: () => void
  onFormChange: React.Dispatch<React.SetStateAction<ContactForm>>
  onCustomerChange: (customer: number | '') => Promise<void>
}

const FIELD_LABEL: Record<string, string> = { customer: 'Cliente', site: 'Sito', name: 'Nome', email: 'Email', phone: 'Telefono', department: 'Reparto', is_primary: 'Contatto primario', notes: 'Note' }

/** Nuovo contatto / modifica: inserimento rapido (nome come titolo, note come descrizione, il resto in pillole). */
export default function ContactDialog({
  open, mode, saving, errors, customers, sites, form, onClose, onSave, onFormChange, onCustomerChange,
}: ContactDialogProps) {
  const set = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) => onFormChange((f) => ({ ...f, [k]: v }))
  const errs = Object.entries(errors).filter(([, m]) => m).map(([k, m]) => (k === '_error' || !FIELD_LABEL[k] ? m : `${FIELD_LABEL[k]}: ${m}`))
  return (
    <QuickForm
      dialogLabel={mode === 'create' ? 'Nuovo contatto' : 'Modifica contatto'}
      open={open} onClose={onClose} mode={mode} saving={saving} onSubmit={onSave}
      crumb={{ icon: <PermContactCalendarOutlinedIcon />, label: 'Contatti' }}
      submitLabel={mode === 'create' ? 'Crea contatto' : 'Salva modifiche'}
      title={{ value: form.name, onChange: (v) => set('name', v), placeholder: 'Nome e cognome', label: 'Nome', error: errors.name }}
      description={{ value: form.notes, onChange: (v) => set('notes', v), placeholder: 'Note: ruolo, orari, come preferisce essere contattato…', label: 'Note' }}
      errors={errs}
      pills={
        <>
          <SelectPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente" value={form.customer} error={Boolean(errors.customer)}
            options={customers.map((c) => ({ value: c.id, label: c.display_name || c.name || c.code || `Cliente #${c.id}`, sub: c.code || undefined }))}
            onChange={(v) => { const id = v === '' ? '' : Number(v); onFormChange((f) => ({ ...f, customer: id, site: '' })); void onCustomerChange(id) }} />
          <SelectPill icon={<PlaceOutlinedIcon />} placeholder="Sito" value={form.site} emptyLabel="Nessun sito" error={Boolean(errors.site)}
            disabled={form.customer === ''} disabledHint="Scegli prima il cliente"
            options={sites.map((s) => ({ value: s.id, label: s.display_name || s.name }))}
            onChange={(v) => set('site', v === '' ? '' : Number(v))} />
          <TextPill icon={<MeetingRoomOutlinedIcon />} placeholder="Reparto" value={form.department} onChange={(v) => set('department', v)} error={Boolean(errors.department)} />
          <TextPill icon={<AlternateEmailRoundedIcon />} placeholder="Email" type="email" inputMode="email" value={form.email} onChange={(v) => set('email', v)} error={Boolean(errors.email)} width={140} />
          <TextPill icon={<PhoneOutlinedIcon />} placeholder="Telefono" type="tel" inputMode="tel" value={form.phone} onChange={(v) => set('phone', v)} error={Boolean(errors.phone)} />
          <TogglePill icon={<StarOutlineRoundedIcon />} label="Contatto primario" checked={form.is_primary} onChange={(v) => set('is_primary', v)} error={Boolean(errors.is_primary)} />
        </>
      }
    />
  )
}
