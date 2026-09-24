import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTaskCard from './AreaTaskCard'
import type { AreaTaskRow } from '../features/areatasks/types'

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPatch = vi.fn()
const apiDelete = vi.fn()
vi.mock('@shared/api/client', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    me: { id: 1, is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } },
    hasPerm: () => true,
    inGroup: () => true,
  }),
}))
vi.mock('../features/areatasks/AreaTaskDetail', () => ({
  default: (p: { task: AreaTaskRow | null }) => (p.task ? <div data-testid="detail">{p.task.title}</div> : null),
}))

function row(over: Partial<AreaTaskRow>): AreaTaskRow {
  return {
    id: 1, area: 3, area_label: 'Ufficio', title: 'Task', description: '', status: 'da_fare', priority: 'medium',
    due_date: null, assigned_to: null, assigned_to_name: null, created_by: 1, created_by_name: 'Fede',
    created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z', completed_at: null,
    comments_count: 0, can_edit: true, drive_files_detail: [], ...over,
  }
}

const tasks = [
  row({ id: 1, title: 'Da fare uno', status: 'da_fare' }),
  row({ id: 2, title: 'Bloccato', status: 'in_attesa', priority: 'critical', assigned_to_name: 'Anna Rossi', comments_count: 2 }),
  row({ id: 3, title: 'Finito', status: 'completato' }),
]

beforeEach(() => {
  ;[apiGet, apiPost, apiPatch, apiDelete].forEach((m) => m.mockReset())
  apiGet.mockImplementation((url: string) => {
    if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
    if (url === '/area-tasks/') return Promise.resolve({ data: { results: tasks } })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('AreaTaskCard', () => {
  it('groups tasks by the four statuses, including "In attesa"', async () => {
    render(<AreaTaskCard />)
    expect(await screen.findByText('Bloccato')).toBeInTheDocument()
    expect(screen.getByText('In attesa')).toBeInTheDocument()
    expect(screen.getByText('Completato')).toBeInTheDocument()
  })

  it('shows priority, assignee initials and comment count for a task', async () => {
    render(<AreaTaskCard />)
    await screen.findByText('Bloccato')
    expect(screen.getByText('Critica')).toBeInTheDocument()
    expect(screen.getByText('AR')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('opens the detail when a task title is clicked', async () => {
    render(<AreaTaskCard />)
    fireEvent.click(await screen.findByText('Da fare uno'))
    expect(await screen.findByTestId('detail')).toHaveTextContent('Da fare uno')
  })

  const loadOnly = (list: AreaTaskRow[]) => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
      if (url === '/area-tasks/') return Promise.resolve({ data: { results: list } })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  }

  it.each([
    ['da_fare', 'in_corso'],
    ['in_corso', 'completato'],
    ['completato', 'da_fare'],
    ['in_attesa', 'in_corso'],
  ] as const)('cycles %s to %s from the status icon', async (from, to) => {
    loadOnly([row({ id: 1, title: 'Unico', status: from })])
    apiPatch.mockResolvedValue({ data: row({ id: 1, title: 'Unico', status: to }) })
    render(<AreaTaskCard />)
    await screen.findByText('Unico')
    fireEvent.click(screen.getByLabelText('Cambia stato'))
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/1/', { status: to }))
  })

  it('uses the PATCH response row (completed_at) after completing', async () => {
    loadOnly([row({ id: 1, title: 'Unico', status: 'in_corso' })])
    apiPatch.mockResolvedValue({ data: row({ id: 1, title: 'Unico', status: 'completato', completed_at: '2026-09-24T11:00:00Z', description: 'Chiuso dal server' }) })
    render(<AreaTaskCard />)
    await screen.findByText('Unico')
    fireEvent.click(screen.getByLabelText('Cambia stato'))
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Unico')).toHaveStyle('text-decoration: line-through'))
    expect(screen.getByText('Completato')).toBeInTheDocument()
    expect(await screen.findByText('Chiuso dal server')).toBeInTheDocument()
  })

  it('rolls back the optimistic status and toasts when the PATCH fails', async () => {
    toast.error.mockReset()
    loadOnly([row({ id: 1, title: 'Unico', status: 'da_fare' })])
    let rej: (e: unknown) => void = () => {}
    apiPatch.mockReturnValue(new Promise((_, r) => { rej = r }))
    render(<AreaTaskCard />)
    await screen.findByText('Unico')
    fireEvent.click(screen.getByLabelText('Cambia stato'))
    await waitFor(() => expect(screen.getByText('In corso')).toBeInTheDocument())
    rej(new Error('boom'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Errore'))
    await waitFor(() => expect(screen.queryByText('In corso')).toBeNull())
    expect(screen.getByText('Unico')).toBeInTheDocument()
  })

  it('has no status control and sends no PATCH on a read-only task', async () => {
    loadOnly([row({ id: 1, title: 'Unico', can_edit: false })])
    render(<AreaTaskCard />)
    await screen.findByText('Unico')
    expect(screen.queryByLabelText('Cambia stato')).toBeNull()
    expect(apiPatch).not.toHaveBeenCalled()
  })

  it('opens the detail with Enter on the task title', async () => {
    render(<AreaTaskCard />)
    fireEvent.keyDown(await screen.findByText('Da fare uno'), { key: 'Enter' })
    expect(await screen.findByTestId('detail')).toHaveTextContent('Da fare uno')
  })

  it('cycles the status with Enter on the status control', async () => {
    loadOnly([row({ id: 1, title: 'Unico', status: 'da_fare' })])
    apiPatch.mockResolvedValue({ data: row({ id: 1, title: 'Unico', status: 'in_corso' }) })
    render(<AreaTaskCard />)
    await screen.findByText('Unico')
    fireEvent.keyDown(screen.getByLabelText('Cambia stato'), { key: 'Enter' })
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/1/', { status: 'in_corso' }))
  })

  it('creates a task quickly with title and due date', async () => {
    apiPost.mockResolvedValue({ data: row({ id: 9, title: 'Nuovo' }) })
    render(<AreaTaskCard />)
    const input = await screen.findByPlaceholderText(/Aggiungi un task/)
    fireEvent.change(input, { target: { value: 'Nuovo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/', expect.objectContaining({ title: 'Nuovo', area: 3 })))
    expect(await screen.findByText('Nuovo')).toBeInTheDocument()
  })
})
