import { describe, expect, it } from 'vitest'
import {
  STATUS_ORDER,
  createEmptyTaskForm,
  extractFieldErrors,
  fmtTaskDate,
  formToPayload,
  formatBytes,
  personInitials,
  taskToForm,
  type AreaTaskRow,
} from './types'

const row: AreaTaskRow = {
  id: 7,
  area: 3,
  area_label: 'Ufficio',
  title: 'Ordine toner',
  description: 'Chiamare il fornitore',
  status: 'in_attesa',
  priority: 'high',
  due_date: '2026-10-01',
  assigned_to: 12,
  assigned_to_name: 'Anna Rossi',
  created_by: 1,
  created_by_name: 'Fede M',
  created_at: '2026-09-24T10:00:00Z',
  updated_at: '2026-09-24T11:00:00Z',
  completed_at: null,
  comments_count: 2,
  can_edit: true,
  drive_files_detail: [],
  converted_to_issue: null,
  converted_to_issue_title: null,
}

describe('areatasks types', () => {
  it('lists the four statuses in workflow order', () => {
    expect(STATUS_ORDER).toEqual(['da_fare', 'in_corso', 'in_attesa', 'completato'])
  })

  it('creates an empty form with medium priority and no assignee', () => {
    expect(createEmptyTaskForm()).toEqual({
      title: '', description: '', status: 'da_fare', priority: 'medium', assigned_to_id: '', due_date: '',
    })
  })

  it('maps a task to form data and back to an API payload', () => {
    const form = taskToForm(row)
    expect(form).toEqual({
      title: 'Ordine toner', description: 'Chiamare il fornitore', status: 'in_attesa',
      priority: 'high', assigned_to_id: 12, due_date: '2026-10-01',
    })
    expect(formToPayload(form)).toEqual({
      title: 'Ordine toner', description: 'Chiamare il fornitore', status: 'in_attesa',
      priority: 'high', assigned_to: 12, due_date: '2026-10-01',
    })
  })

  it('sends null for an empty assignee and an empty due date, and trims the title', () => {
    const payload = formToPayload({ ...createEmptyTaskForm(), title: '  Titolo  ' })
    expect(payload.title).toBe('Titolo')
    expect(payload.assigned_to).toBeNull()
    expect(payload.due_date).toBeNull()
  })

  it('formats dates in italian and tolerates empty values', () => {
    expect(fmtTaskDate('2026-10-01')).toBe('01/10/2026')
    expect(fmtTaskDate(null)).toBeNull()
  })

  it('builds initials from a display name', () => {
    expect(personInitials('Anna Rossi')).toBe('AR')
    expect(personInitials('mario')).toBe('M')
    expect(personInitials(null)).toBe('?')
  })

  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('extracts DRF field errors from an axios-like error', () => {
    const err = { response: { data: { assigned_to: ["Non valido."], title: ['Obbligatorio.', 'Troppo corto.'] } } }
    expect(extractFieldErrors(err)).toEqual({ assigned_to: 'Non valido.', title: 'Obbligatorio. Troppo corto.' })
    expect(extractFieldErrors(new Error('x'))).toEqual({})
  })
})
