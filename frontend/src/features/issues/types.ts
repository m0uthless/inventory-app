export type IssueRow = {
  id: number
  title: string
  description: string
  servicenow_id: string
  customer: number
  customer_name: string
  customer_code: string
  site: number | null
  site_name: string | null
  inventory: number | null
  inventory_name: string | null
  inventory_knumber: string | null
  inventory_serial_number: string | null
  inventory_hostname: string | null
  category: number | null
  category_label: string | null
  assigned_to: number | null
  assigned_to_username: string | null
  assigned_to_full_name: string | null
  assigned_to_avatar: string | null
  created_by: number
  created_by_username: string
  created_by_full_name: string
  priority: string
  priority_label: string
  status: string
  status_label: string
  opened_at: string | null
  closed_at: string | null
  due_date: string | null
  days_open: number
  comments_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type IssueComment = {
  id: number
  issue: number
  author: number
  author_username: string
  author_first_name: string
  author_last_name: string
  body: string
  created_at: string
  updated_at: string
}

export type CategoryOption = { id: number; label: string }
export type CustomerOption = { id: number; label: string }
export type UserOption = { id: number; label: string; username: string }
export type InventoryOption = {
  id: number
  name: string
  knumber?: string | null
  serial_number?: string | null
  hostname?: string | null
  type_label?: string | null
  status_label?: string | null
  site_name?: string | null
}

export type IssueFormData = {
  title: string
  description: string
  servicenow_id: string
  customer: CustomerOption | null
  site_id: number | ''
  category_id: number | ''
  assigned_to_id: number | ''
  priority: string
  status: string
  opened_at: string
  due_date: string
}

export const PRIORITY_META: Record<
  string,
  { label: string; color: 'error' | 'warning' | 'info' | 'default' }
> = {
  critical: { label: 'Critica', color: 'error' },
  high: { label: 'Alta', color: 'warning' },
  medium: { label: 'Media', color: 'info' },
  low: { label: 'Bassa', color: 'default' },
}

export const STATUS_META: Record<
  string,
  { label: string; color: 'error' | 'warning' | 'success' | 'default' }
> = {
  open: { label: 'Aperta', color: 'error' },
  in_progress: { label: 'In lavorazione', color: 'warning' },
  resolved: { label: 'Risolta', color: 'success' },
  closed: { label: 'Chiusa', color: 'default' },
}

type InventoryLabelSource =
  | Pick<IssueRow, 'inventory_name' | 'inventory_knumber' | 'inventory_serial_number' | 'inventory_hostname'>
  | InventoryOption
  | null

function isIssueInventoryLabelSource(
  item: Exclude<InventoryLabelSource, null>,
): item is Pick<IssueRow, 'inventory_name' | 'inventory_knumber' | 'inventory_serial_number' | 'inventory_hostname'> {
  return 'inventory_name' in item
}

export function issueInventoryLabel(item: InventoryLabelSource) {
  if (!item) return '—'

  const normalized = isIssueInventoryLabelSource(item)
    ? {
        name: item.inventory_name,
        knumber: item.inventory_knumber,
        hostname: item.inventory_hostname,
        serial_number: item.inventory_serial_number,
      }
    : {
        name: item.name,
        knumber: item.knumber ?? null,
        hostname: item.hostname ?? null,
        serial_number: item.serial_number ?? null,
      }

  const parts = [normalized.name, normalized.knumber, normalized.hostname, normalized.serial_number].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function fmtIssueDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function fmtIssueDateTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function todayIsoLocal() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function createEmptyIssueForm(defaultAssignedToId?: number): IssueFormData {
  return {
    title: '',
    description: '',
    servicenow_id: '',
    customer: null,
    site_id: '',
    category_id: '',
    assigned_to_id: defaultAssignedToId ?? '',
    priority: 'medium',
    status: 'open',
    opened_at: todayIsoLocal(),
    due_date: '',
  }
}

export function issueAuthorInitials(c: IssueComment) {
  return (
    ((c.author_first_name?.[0] || '') + (c.author_last_name?.[0] || '')).toUpperCase() ||
    c.author_username?.[0]?.toUpperCase() ||
    '?'
  )
}

export function issueAuthorName(c: IssueComment) {
  return [c.author_first_name, c.author_last_name].filter(Boolean).join(' ') || c.author_username
}
