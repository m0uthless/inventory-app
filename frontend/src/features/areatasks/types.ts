import { isRecord } from '@shared/utils/guards'

export type TaskStatus = 'da_fare' | 'in_corso' | 'in_attesa' | 'completato'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type TaskDriveFile = {
  id: number
  name: string
  mime_type: string
  size: number
  folder: number | null
}

export type AreaTaskRow = {
  id: number
  area: number
  area_label: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  comments_count: number
  can_edit: boolean
  drive_files_detail: TaskDriveFile[]
}

export type AreaTaskComment = {
  id: number
  task: number
  author: number
  author_name: string
  body: string
  created_at: string
  updated_at: string
}

export type AreaUser = { id: number; label: string }

export const STATUS_ORDER: TaskStatus[] = ['da_fare', 'in_corso', 'in_attesa', 'completato']

export const STATUS_META: Record<TaskStatus, { label: string }> = {
  da_fare: { label: 'Da fare' },
  in_corso: { label: 'In corso' },
  in_attesa: { label: 'In attesa' },
  completato: { label: 'Completato' },
}

export const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'critical']

export const PRIORITY_META: Record<TaskPriority, { label: string }> = {
  low: { label: 'Bassa' },
  medium: { label: 'Media' },
  high: { label: 'Alta' },
  critical: { label: 'Critica' },
}

export type TaskFormData = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigned_to_id: number | ''
  due_date: string
}

export function createEmptyTaskForm(): TaskFormData {
  return { title: '', description: '', status: 'da_fare', priority: 'medium', assigned_to_id: '', due_date: '' }
}

export function taskToForm(task: AreaTaskRow): TaskFormData {
  return {
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigned_to_id: task.assigned_to ?? '',
    due_date: task.due_date ?? '',
  }
}

export function formToPayload(form: TaskFormData) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    assigned_to: form.assigned_to_id === '' ? null : form.assigned_to_id,
    due_date: form.due_date || null,
  }
}

export function fmtTaskDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function fmtTaskDateTime(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function personInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function formatBytes(size: number): string {
  if (!size || size < 1024) return `${size || 0} B`
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[i]}`
}

export function extractFieldErrors(e: unknown): Record<string, string> {
  const data = isRecord(e) && isRecord(e['response']) ? e['response']['data'] : undefined
  if (!isRecord(data)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] = Array.isArray(value) ? value.join(' ') : String(value)
  }
  return out
}
