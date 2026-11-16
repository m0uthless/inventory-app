import * as React from 'react'
import { Avatar, Box } from '@mui/material'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { DatePill, QuickForm, SelectPill } from '../../ui/campo'
import { IssuePriorityMark } from '../issues/IssueBadges'
import { TaskStatusBadge } from './taskUi'
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER,
  type AreaTaskRow, type AreaUser, type TaskFormData, type TaskPriority, type TaskStatus,
} from './types'

export type AreaTaskDialogProps = {
  open: boolean
  task: AreaTaskRow | null
  areaLabel: string
  form: TaskFormData
  users: AreaUser[]
  saving: boolean
  errors: Record<string, string>
  onFormChange: React.Dispatch<React.SetStateAction<TaskFormData>>
  onSave: () => void
  onClose: () => void
}

const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()

/** Nuovo task / modifica task: inserimento rapido (titolo, descrizione, pillole). */
export default function AreaTaskDialog({
  open, task, areaLabel, form, users, saving, errors, onFormChange, onSave, onClose,
}: AreaTaskDialogProps) {
  const set = <K extends keyof TaskFormData>(k: K, v: TaskFormData[K]) => onFormChange((f) => ({ ...f, [k]: v }))
  const errs = [errors.title, errors.assigned_to, errors.due_date, errors.non_field_errors || errors.detail].filter(Boolean) as string[]
  return (
    <QuickForm
      dialogLabel={task ? `Modifica task #${task.id}` : 'Nuovo task'}
      open={open} onClose={onClose} mode={task ? 'edit' : 'create'} saving={saving} onSubmit={onSave} canSubmit={Boolean(form.title.trim())}
      crumb={{ icon: <TaskAltOutlinedIcon />, label: 'Task di area', extra: <>{task ? `#${task.id} · ` : ''}{areaLabel}</> }}
      submitLabel={task ? 'Salva modifiche' : 'Crea task'}
      title={{ value: form.title, onChange: (v) => set('title', v), placeholder: 'Cosa c\'è da fare?', label: 'Titolo', error: errors.title, maxLength: 200 }}
      description={{ value: form.description, onChange: (v) => set('description', v), placeholder: 'Aggiungi una descrizione…', label: 'Descrizione' }}
      errors={errs}
      pills={
        <>
          <SelectPill placeholder="Stato" value={form.status} onChange={(v) => v && set('status', v as TaskStatus)}
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label, node: <TaskStatusBadge status={s} /> }))}
            render={(o) => <TaskStatusBadge status={o.value as TaskStatus} />} />
          <SelectPill placeholder="Priorità" value={form.priority} onChange={(v) => v && set('priority', v as TaskPriority)}
            options={[...PRIORITY_ORDER].reverse().map((p) => ({ value: p, label: PRIORITY_META[p].label, node: <IssuePriorityMark priority={p} /> }))}
            render={(o) => <IssuePriorityMark priority={String(o.value)} />} />
          <SelectPill icon={<PersonOutlineRoundedIcon />} placeholder="Assegna" title="Assegnato a" value={form.assigned_to_id} emptyLabel="Nessuno" error={Boolean(errors.assigned_to)}
            onChange={(v) => set('assigned_to_id', v === '' ? '' : Number(v))}
            options={users.map((u) => ({ value: u.id, label: u.label, node: <><Avatar sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{initials(u.label)}</Avatar>{u.label}</> }))}
            render={(o) => <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>{o.node}</Box>} />
          <DatePill icon={<EventOutlinedIcon />} placeholder="Scadenza" value={form.due_date} onChange={(v) => set('due_date', v)} error={Boolean(errors.due_date)} />
        </>
      }
    />
  )
}
