import * as React from 'react'
import { Avatar, Box } from '@mui/material'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'

import { DatePill, Pill, QuickForm, SelectPill, StaticPill, TextPill } from '../../ui/campo'
import { IssuePriorityMark, IssueStatusBadge } from './IssueBadges'
import {
  PRIORITY_META,
  STATUS_META,
  WAITING_REASON_META,
  issueInventoryLabel,
  type CategoryOption,
  type CustomerOption,
  type IssueFormData,
  type IssueRow,
  type UserOption,
  type InventoryOption,
} from './types'

type SiteOption = { id: number; label: string }

type IssueDialogProps = {
  open: boolean
  editIssue: IssueRow | null
  form: IssueFormData
  saving: boolean
  errors: Record<string, string>
  customerInput: string
  customerOptions: CustomerOption[]
  customerLoading: boolean
  siteOptions: SiteOption[]
  categories: CategoryOption[]
  users: UserOption[]
  pendingInventory?: InventoryOption | null
  onClose: () => void
  onSave: () => void
  onOpenLinkInventory: () => void
  onCustomerInputChange: (value: string) => void
  onFormChange: React.Dispatch<React.SetStateAction<IssueFormData>>
}

const FIELD_LABEL: Record<string, string> = {
  title: 'Titolo', customer: 'Cliente', customer_placeholder: 'Cliente', site: 'Sito', priority: 'Priorità', status: 'Stato', waiting_reason: 'In attesa di',
  category: 'Categoria', assigned_to: 'Assegnata a', opened_at: 'Data di apertura', due_date: 'Scadenza', servicenow_id: 'Caso ServiceNow', description: 'Descrizione', inventory: 'Inventario',
}
const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()
const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low']

/**
 * Nuova issue / modifica: inserimento rapido (anteprima fm-base, variante C). Titolo, descrizione e le
 * proprietà in pillole; il cliente si cerca in anagrafica o, se manca, si scrive il nome (testo libero).
 * Una issue chiusa si apre in sola lettura.
 */
export default function IssueDialog({
  open, editIssue, form, saving, errors, customerOptions, customerLoading, siteOptions, categories, users, pendingInventory,
  onClose, onSave, onOpenLinkInventory, onCustomerInputChange, onFormChange,
}: IssueDialogProps) {
  const isClosed = editIssue?.status === 'closed'
  const set = <K extends keyof IssueFormData>(k: K, v: IssueFormData[K]) => onFormChange((f) => ({ ...f, [k]: v }))
  const errs = Object.entries(errors).filter(([, m]) => m).map(([k, m]) => (FIELD_LABEL[k] ? `${FIELD_LABEL[k]}: ${m}` : m))
  const setFreeCustomer = (on: boolean) => onFormChange((f) => ({
    ...f, useCustomerPlaceholder: on,
    // Passando al testo libero si azzerano cliente e sito; tornando all'anagrafica il testo libero.
    customer: on ? null : f.customer, site_id: on ? '' : f.site_id, customerPlaceholder: on ? f.customerPlaceholder : '',
  }))

  return (
    <QuickForm
      dialogLabel={editIssue ? `Modifica issue #${editIssue.id}` : 'Nuova issue'}
      open={open} onClose={onClose} mode={editIssue ? 'edit' : 'create'} saving={saving} onSubmit={onSave} readOnly={isClosed}
      crumb={{ icon: <ErrorOutlineRoundedIcon />, label: 'Issue', extra: editIssue ? `#${editIssue.id}` : undefined }}
      submitLabel={editIssue ? 'Salva modifiche' : 'Crea issue'}
      notice={isClosed ? <>Questa issue è <b>chiusa</b> e non si può modificare. Lo stato «Chiusa» si imposta da solo 48 ore dopo la risoluzione.</> : undefined}
      title={{ value: form.title, onChange: (v) => set('title', v), placeholder: 'Titolo della issue', label: 'Titolo', error: errors.title }}
      description={{ value: form.description, onChange: (v) => set('description', v), placeholder: 'Cosa succede, da quando, cosa è già stato provato…', label: 'Descrizione' }}
      errors={errs}
      pills={
        <>
          {form.useCustomerPlaceholder ? (
            <>
              <TextPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente non in anagrafica" value={form.customerPlaceholder}
                onChange={(v) => set('customerPlaceholder', v)} error={Boolean(errors.customer_placeholder || errors.customer)}
                title="Cliente non ancora in anagrafica: si collega in un secondo momento." />
              <Pill icon={<UndoRoundedIcon />} placeholder="Cerca in anagrafica" onClick={() => setFreeCustomer(false)} />
            </>
          ) : (
            <SelectPill icon={<ApartmentOutlinedIcon />} placeholder="Cliente" required value={form.customer?.id ?? ''} error={Boolean(errors.customer)}
              options={customerOptions.map((c) => ({ value: c.id, label: c.label }))} current={form.customer ? { value: form.customer.id, label: form.customer.label } : null}
              onSearch={onCustomerInputChange} loading={customerLoading}
              action={{ label: 'Non è in anagrafica? Scrivi il nome', onClick: () => setFreeCustomer(true) }}
              onChange={(v) => {
                const c = customerOptions.find((x) => x.id === v) ?? null
                onFormChange((f) => ({ ...f, customer: c, site_id: '' }))
              }} />
          )}
          {!form.useCustomerPlaceholder && siteOptions.length > 0 ? (
            <SelectPill icon={<PlaceOutlinedIcon />} placeholder="Sito" value={form.site_id} emptyLabel="Nessun sito"
              options={siteOptions.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set('site_id', v === '' ? '' : Number(v))} />
          ) : null}
          {editIssue && !editIssue.is_customer_placeholder ? (
            <Pill icon={<DnsOutlinedIcon />} placeholder="Collega un inventario" label={editIssue.inventory ? issueInventoryLabel(editIssue) : undefined}
              onClick={onOpenLinkInventory} error={Boolean(errors.inventory)} />
          ) : !editIssue && pendingInventory ? (
            <StaticPill icon={<DnsOutlinedIcon />} title="Inventario collegato"
              label={[pendingInventory.name, pendingInventory.knumber, pendingInventory.hostname].filter(Boolean).join(' · ')} />
          ) : null}
          <SelectPill placeholder="Priorità" value={form.priority} onChange={(v) => v && set('priority', String(v))}
            options={PRIORITY_ORDER.filter((k) => PRIORITY_META[k]).map((k) => ({ value: k, label: PRIORITY_META[k].label, node: <IssuePriorityMark priority={k} /> }))}
            render={(o) => <IssuePriorityMark priority={String(o.value)} />} />
          <SelectPill placeholder="Stato" value={form.status}
            options={Object.keys(STATUS_META).filter((k) => k !== 'closed').map((k) => ({ value: k, label: STATUS_META[k].label, node: <IssueStatusBadge status={k} /> }))}
            render={(o) => <IssueStatusBadge status={String(o.value)} />}
            onChange={(v) => v && onFormChange((f) => ({ ...f, status: String(v), waiting_reason: v === 'waiting' ? f.waiting_reason : '' }))} />
          {form.status === 'waiting' ? (
            <SelectPill icon={<HourglassEmptyRoundedIcon />} placeholder="In attesa di" required value={form.waiting_reason} error={Boolean(errors.waiting_reason)}
              options={Object.entries(WAITING_REASON_META).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => set('waiting_reason', String(v))} />
          ) : null}
          <SelectPill icon={<PersonOutlineRoundedIcon />} placeholder="Assegna" title="Assegnata a" value={form.assigned_to_id} emptyLabel="Nessuno"
            onChange={(v) => set('assigned_to_id', v === '' ? '' : Number(v))}
            options={users.map((u) => ({ value: u.id, label: u.label, node: <><Avatar sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{initials(u.label)}</Avatar>{u.label}</> }))}
            render={(o) => <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>{o.node}</Box>} />
          <SelectPill icon={<FolderOutlinedIcon />} placeholder="Categoria" value={form.category_id} emptyLabel="Nessuna"
            options={categories.map((c) => ({ value: c.id, label: c.label }))} onChange={(v) => set('category_id', v === '' ? '' : Number(v))} />
          <DatePill icon={<EventAvailableOutlinedIcon />} placeholder="Aperta il" value={form.opened_at} onChange={(v) => set('opened_at', v)} clearable={false}
            quick={[[0, 'Oggi'], [-1, 'Ieri']]} error={Boolean(errors.opened_at)} />
          <DatePill icon={<EventOutlinedIcon />} placeholder="Scadenza" value={form.due_date} onChange={(v) => set('due_date', v)} error={Boolean(errors.due_date)} />
          <TextPill icon={<CloudOutlinedIcon />} placeholder="Caso ServiceNow" mono value={form.servicenow_id} onChange={(v) => set('servicenow_id', v)} error={Boolean(errors.servicenow_id)} />
        </>
      }
    />
  )
}
