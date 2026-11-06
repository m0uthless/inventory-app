/* eslint-disable react-refresh/only-export-components */
import { Box } from '@mui/material'
import { IssueStatusBadge } from '../issues/IssueBadges'
import { STATUS_META, type AreaTaskRow, type TaskStatus } from './types'

/** Stessi segni e toni dello stato delle Issue: da fare = aperta, in corso = in lavorazione, … */
const AS_ISSUE: Record<TaskStatus, string> = { da_fare: 'open', in_corso: 'in_progress', in_attesa: 'waiting', completato: 'resolved' }

export function TaskStatusBadge({ status, onDark }: { status: TaskStatus; onDark?: boolean }) {
  return <IssueStatusBadge status={AS_ISSUE[status]} label={STATUS_META[status].label} onDark={onDark} />
}

const DAY = 864e5
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const parse = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
/** Giorni alla scadenza (negativi = scaduto), rispetto a oggi. */
export const daysTo = (iso: string) => Math.round((parse(iso).getTime() - parse(todayIso()).getTime()) / DAY)
export const isOpenTask = (t: Pick<AreaTaskRow, 'status'>) => t.status !== 'completato'
export const ddmm = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '')
export const ddmmyyyy = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

/** Scadenza come nelle Issue: "04/11 · scaduto" in rosso, "06/11 · oggi" in arancione. */
export function TaskDue({ task }: { task: Pick<AreaTaskRow, 'status' | 'due_date'> }) {
  if (!task.due_date) return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
  const n = daysTo(task.due_date)
  const state = isOpenTask(task) ? (n < 0 ? 'scaduto' : n === 0 ? 'oggi' : null) : null
  return (
    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', ...(state && { fontWeight: 600, color: state === 'scaduto' ? 'error.main' : 'warning.main' }) }}>
      {ddmm(task.due_date)}{state ? ` · ${state}` : ''}
    </Box>
  )
}
