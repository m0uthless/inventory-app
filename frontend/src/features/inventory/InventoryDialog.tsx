import * as React from 'react'
import { Box, Chip, InputBase } from '@mui/material'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import TagRoundedIcon from '@mui/icons-material/TagRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import ComputerOutlinedIcon from '@mui/icons-material/ComputerOutlined'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'

import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import { QuickField, QuickFields, QuickForm, QuickGroup, SelectPill, TextPill } from '../../ui/campo'
import type { CustomerItem, InventoryFieldName, InventoryForm, LookupItem, SiteItem } from './types'

type InventoryDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  canViewSecrets: boolean
  errors: Record<string, string | undefined>
  customers: CustomerItem[]
  sites: SiteItem[]
  statuses: LookupItem[]
  types: LookupItem[]
  form: InventoryForm
  tagInput: string
  onClose: () => void
  onSave: () => void
  onTagInputChange: (value: string) => void
  onFormChange: React.Dispatch<React.SetStateAction<InventoryForm>>
  onErrorsChange: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
  onCustomerChange: (customer: number | '') => Promise<void>
  isFieldDisabled: (field: InventoryFieldName) => boolean
  fieldHelpText: (field: InventoryFieldName) => string | undefined
}

const FIELD_LABEL: Record<string, string> = {
  customer: 'Cliente', site: 'Sito', status: 'Stato', type: 'Tipo', name: 'Nome', knumber: 'K-number', serial_number: 'Seriale', hostname: 'Hostname',
  local_ip: 'IP locale', srsa_ip: 'SRSA IP', location: 'Posizione', telefono: 'Telefono', os_user: 'Utente OS', os_pwd: 'Password OS', app_usr: 'Utente App',
  app_pwd: 'Password App', vnc_pwd: 'Password VNC', manufacturer: 'Produttore', model: 'Modello', warranty_end_date: 'Fine garanzia', notes: 'Note', tags: 'Tag', custom_fields: 'Campi personalizzati',
}
const MORE_FIELDS = ['srsa_ip', 'location', 'telefono', 'os_user', 'os_pwd', 'app_usr', 'app_pwd', 'vnc_pwd', 'manufacturer', 'model', 'warranty_end_date', 'tags', 'custom_fields'] as const

/**
 * Nuovo inventario / modifica: inserimento rapido. Il nome è il titolo, le note la descrizione;
 * in pillole i dati che servono sempre, in "Altri campi" rete, credenziali, apparecchio e tag.
 * Le password si vedono e si scrivono solo con il permesso sulle credenziali (come prima).
 */
export default function InventoryDialog({
  open, mode, saving, canViewSecrets, errors, customers, sites, statuses, types, form, tagInput,
  onClose, onSave, onTagInputChange, onFormChange, onErrorsChange, onCustomerChange, isFieldDisabled, fieldHelpText,
}: InventoryDialogProps) {
  const set = <K extends keyof InventoryForm>(k: K, v: InventoryForm[K]) => {
    onFormChange((prev) => ({ ...prev, [k]: v }))
    if (errors[k as string]) onErrorsChange((prev) => ({ ...prev, [k]: undefined }))
  }
  const errs = Object.entries(errors).filter(([, m]) => m).map(([k, m]) => (FIELD_LABEL[k] ? `${FIELD_LABEL[k]}: ${m}` : String(m)))
  const field = (k: InventoryFieldName & keyof InventoryForm, extra?: { secret?: boolean; mono?: boolean; type?: string }) => {
    if (extra?.secret && !canViewSecrets) return <QuickField key={k} label={FIELD_LABEL[k]} value="" onChange={() => {}} disabled help="Non autorizzato" />
    return (
      <QuickField key={k} label={FIELD_LABEL[k]} value={String(form[k] ?? '')} onChange={(v) => set(k, v as never)} error={errors[k]}
        disabled={isFieldDisabled(k)} help={extra?.secret && mode === 'edit' ? 'Vuota = invariata' : fieldHelpText(k)} secret={extra?.secret} mono={extra?.mono} type={extra?.type} />
    )
  }
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag) return
    if (!form.tags.includes(tag)) onFormChange((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
    onTagInputChange('')
  }
  const moreFilled = MORE_FIELDS.some((k) => (k === 'tags' ? form.tags.length : k === 'custom_fields' ? Object.keys(form.custom_fields ?? {}).length : String(form[k] ?? '').trim()) || errors[k])

  return (
    <QuickForm
      dialogLabel={mode === 'create' ? 'Nuovo inventario' : 'Modifica inventario'}
      open={open} onClose={onClose} mode={mode} saving={saving} onSubmit={onSave}
      crumb={{ icon: <DnsOutlinedIcon />, label: 'Inventari' }}
      submitLabel={mode === 'create' ? 'Crea inventario' : 'Salva modifiche'}
      title={{ value: form.name, onChange: (v) => set('name', v), placeholder: 'Nome, es. Server principale sala CED', label: 'Nome / Descrizione', error: errors.name }}
      description={{ value: form.notes, onChange: (v) => set('notes', v), placeholder: 'Note…', label: 'Note' }}
      errors={errs}
      pills={
        <>
          <SelectPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente" value={form.customer} error={Boolean(errors.customer)} required
            options={customers.map((c) => ({ value: c.id, label: c.name || c.code || `Cliente #${c.id}`, sub: c.code || undefined }))}
            onChange={(v) => { const id = v === '' ? '' : Number(v); onFormChange((prev) => ({ ...prev, customer: id, site: '' })); onErrorsChange((prev) => ({ ...prev, customer: undefined })); void onCustomerChange(id) }} />
          <SelectPill icon={<PlaceOutlinedIcon />} placeholder="Sito" value={form.site} emptyLabel="Nessun sito" disabled={form.customer === ''} disabledHint="Scegli prima il cliente"
            options={sites.map((s) => ({ value: s.id, label: s.display_name || s.name }))} onChange={(v) => set('site', v === '' ? '' : Number(v))} />
          <SelectPill icon={<FlagOutlinedIcon />} placeholder="Stato" value={form.status} error={Boolean(errors.status)} required
            options={statuses.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set('status', v === '' ? '' : Number(v))} />
          <SelectPill icon={<CategoryOutlinedIcon />} placeholder="Tipo" value={form.type} emptyLabel="Nessun tipo"
            options={types.map((t) => ({ value: t.id, label: t.label }))} onChange={(v) => set('type', v === '' ? '' : Number(v))} />
          <TextPill icon={<TagRoundedIcon />} placeholder="K-number" mono value={form.knumber} onChange={(v) => set('knumber', v)} error={Boolean(errors.knumber)} width={80} />
          <TextPill icon={<QrCode2RoundedIcon />} placeholder="Seriale" mono value={form.serial_number} onChange={(v) => set('serial_number', v)} error={Boolean(errors.serial_number)} width={80} />
          <TextPill icon={<ComputerOutlinedIcon />} placeholder="Hostname" mono value={form.hostname} onChange={(v) => set('hostname', v)} error={Boolean(errors.hostname)}
            disabled={isFieldDisabled('hostname')} title={fieldHelpText('hostname')} width={90} />
          <TextPill icon={<LanOutlinedIcon />} placeholder="IP locale" mono value={form.local_ip} onChange={(v) => set('local_ip', v)} error={Boolean(errors.local_ip)}
            disabled={isFieldDisabled('local_ip')} title={fieldHelpText('local_ip')} width={90} />
        </>
      }
      more={{
        hint: 'rete, credenziali, apparecchio, tag', defaultOpen: Boolean(mode === 'edit' && moreFilled) || MORE_FIELDS.some((k) => errors[k]),
        children: (
          <>
            <QuickGroup title="Rete e posizione">
              <QuickFields cols={3}>{field('srsa_ip', { mono: true })}{field('location')}{field('telefono')}</QuickFields>
            </QuickGroup>
            <QuickGroup title="Credenziali">
              <QuickFields>{field('os_user', { mono: true })}{field('os_pwd', { secret: true })}{field('app_usr', { mono: true })}{field('app_pwd', { secret: true })}{field('vnc_pwd', { secret: true })}</QuickFields>
            </QuickGroup>
            <QuickGroup title="Apparecchio">
              <QuickFields cols={3}>{field('manufacturer')}{field('model')}{field('warranty_end_date', { type: 'date' })}</QuickFields>
            </QuickGroup>
            <QuickGroup title="Tag">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                {form.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" onDelete={() => onFormChange((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))} />
                ))}
                <InputBase value={tagInput} onChange={(e) => onTagInputChange(e.target.value)} placeholder={form.tags.length ? 'Altro tag…' : 'Scrivi un tag e premi Invio'}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && tagInput.trim()) { e.preventDefault(); e.stopPropagation(); addTag() } }}
                  inputProps={{ 'aria-label': 'Nuovo tag' }}
                  sx={{ flex: 1, minWidth: 180, height: 32, px: 1.25, fontSize: 13, border: '1px dashed', borderColor: 'archie.borderStrong', borderRadius: '7px', '&.Mui-focused': { borderStyle: 'solid', borderColor: 'primary.main' } }} />
              </Box>
            </QuickGroup>
            <CustomFieldsEditor entity="inventory" value={form.custom_fields} onChange={(value) => onFormChange((prev) => ({ ...prev, custom_fields: value }))} mode="inline" />
          </>
        ),
      }}
    />
  )
}
