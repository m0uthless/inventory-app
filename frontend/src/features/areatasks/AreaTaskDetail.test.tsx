import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTaskDetail from './AreaTaskDetail'
import type { AreaTaskRow } from './types'

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
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ me: { id: 1 }, hasPerm: () => true, inGroup: () => true }),
}))
// Il selettore Drive ha un test proprio: qui lo sostituiamo con un finto pulsante.
vi.mock('./DriveFilePickerDialog', () => ({
  default: (p: { open: boolean; onConfirm: (f: unknown[]) => void }) =>
    p.open ? (
      <button onClick={() => p.onConfirm([{ id: 99, name: 'nuovo.pdf', mime_type: '', size: 10, folder: null }])}>
        conferma-picker
      </button>
    ) : null,
}))

const baseTask: AreaTaskRow = {
  id: 7, area: 3, area_label: 'Ufficio', title: 'Ordine toner', description: 'desc',
  status: 'in_corso', priority: 'medium', due_date: null, assigned_to: null, assigned_to_name: null,
  created_by: 1, created_by_name: 'Fede', created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z',
  completed_at: null, comments_count: 0, can_edit: true,
  drive_files_detail: [{ id: 5, name: 'verbale.pdf', mime_type: 'application/pdf', size: 2048, folder: null }],
}

function setup(task: AreaTaskRow = baseTask) {
  const onClose = vi.fn()
  const onChanged = vi.fn()
  const onDeleted = vi.fn()
  render(<AreaTaskDetail task={task} onClose={onClose} onChanged={onChanged} onDeleted={onDeleted} />)
  return { onClose, onChanged, onDeleted }
}

beforeEach(() => {
  ;[apiGet, apiPost, apiPatch, apiDelete].forEach((m) => m.mockReset())
  toast.error.mockReset()
  apiGet.mockImplementation((url: string) => {
    if (url === '/area-tasks/7/comments/') return Promise.resolve({ data: [] })
    if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('AreaTaskDetail', () => {
  it('loads the comments of the task on open', async () => {
    apiGet.mockImplementation((url: string) =>
      url === '/area-tasks/7/comments/'
        ? Promise.resolve({ data: [{ id: 1, task: 7, author: 2, author_name: 'Anna', body: 'Primo commento', created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z' }] })
        : Promise.resolve({ data: [] }),
    )
    setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Commenti \(1\)/ }))
    expect(await screen.findByText('Primo commento')).toBeInTheDocument()
  })

  it('posts a comment and updates the count', async () => {
    apiPost.mockResolvedValue({
      data: { id: 2, task: 7, author: 1, author_name: 'Fede', body: 'Fatto', created_at: '2026-09-24T12:00:00Z', updated_at: '2026-09-24T12:00:00Z' },
    })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Commenti/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Scrivi un commento/), { target: { value: 'Fatto' } })
    fireEvent.click(screen.getByRole('button', { name: /Invia/ }))

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/7/comments/', { body: 'Fatto' }))
    expect(await screen.findByText('Fatto')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 7, comments_count: 1 }))
  })

  it('unlinks a file by patching the remaining visible ids', async () => {
    apiPatch.mockResolvedValue({ data: { ...baseTask, drive_files_detail: [] } })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Allegati/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Scollega verbale.pdf' }))

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/7/', { drive_files: [] }))
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ drive_files_detail: [] }))
  })

  it('links new files keeping the ones already visible', async () => {
    apiPatch.mockResolvedValue({
      data: { ...baseTask, drive_files_detail: [...baseTask.drive_files_detail, { id: 99, name: 'nuovo.pdf', mime_type: '', size: 10, folder: null }] },
    })
    setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Allegati/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Collega file da Drive/ }))
    fireEvent.click(await screen.findByText('conferma-picker'))

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/7/', { drive_files: [5, 99] }))
    expect(await screen.findByText('nuovo.pdf')).toBeInTheDocument()
  })

  it('edits the task with the assignable users of its area', async () => {
    apiPatch.mockResolvedValue({ data: { ...baseTask, title: 'Nuovo titolo', priority: 'high', assigned_to: 12, assigned_to_name: 'Anna Rossi' } })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3 }) })))
    const title = await screen.findByLabelText(/Titolo/)
    fireEvent.change(title, { target: { value: 'Nuovo titolo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1))
    const [url, payload] = apiPatch.mock.calls[0]!
    expect(url).toBe('/area-tasks/7/')
    expect(payload).toMatchObject({ title: 'Nuovo titolo', priority: 'medium', assigned_to: null })
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuovo titolo' }))
  })

  it('shows the server validation error for the assignee and keeps the dialog open', async () => {
    apiPatch.mockRejectedValue({ response: { data: { assigned_to: ["L'assegnatario deve appartenere all'area del task."] } } })
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByText(/deve appartenere all'area/)).toBeInTheDocument()
  })

  it('deletes after confirmation', async () => {
    apiDelete.mockResolvedValue({})
    const { onDeleted, onClose } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }))
    const dlg = await screen.findByRole('dialog', { name: /Eliminare il task/ })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/area-tasks/7/'))
    expect(onDeleted).toHaveBeenCalledWith(7)
    expect(onClose).toHaveBeenCalled()
  })

  it('hides write actions on a read-only task', async () => {
    setup({ ...baseTask, can_edit: false })
    expect(screen.queryByRole('button', { name: 'Modifica' })).toBeNull()
    fireEvent.click(await screen.findByRole('tab', { name: /Allegati/ }))
    expect(screen.queryByRole('button', { name: /Collega file da Drive/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Scollega verbale.pdf' })).toBeNull()
  })

  it('shows the current assignee while the users list is still loading', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apiGet.mockImplementation((url: string) => {
      if (url === '/users/') return new Promise(() => {})
      return Promise.resolve({ data: [] })
    })
    setup({ ...baseTask, assigned_to: 12, assigned_to_name: 'Anna Rossi' })
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))
    const dlg = await screen.findByRole('dialog', { name: /Modifica task/ })
    expect(within(dlg).getByText('Anna Rossi')).toBeInTheDocument()
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('out-of-range'))).toHaveLength(0)
    warn.mockRestore()
  })
  it('keeps the content mounted while the drawer slides out and reloads comments on reopen', async () => {
    const props = { onClose: vi.fn(), onChanged: vi.fn(), onDeleted: vi.fn() }
    const { rerender } = render(<AreaTaskDetail task={baseTask} {...props} />)
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('tab', { name: /Allegati/ }))
    rerender(<AreaTaskDetail task={null} {...props} />)
    expect(screen.getByText('Ordine toner')).toBeInTheDocument()
    expect(screen.getByText('verbale.pdf')).toBeInTheDocument()
    rerender(<AreaTaskDetail task={baseTask} {...props} />)
    await waitFor(() => expect(apiGet.mock.calls.filter((c) => c[0] === '/area-tasks/7/comments/')).toHaveLength(2))
  })

  it('toasts server errors on fields the dialog does not render and keeps it open', async () => {
    apiPatch.mockRejectedValue({ response: { data: { priority: ['Scelta non valida.'] } } })
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Salva modifiche' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Scelta non valida.')))
    expect(screen.getByRole('dialog', { name: /Modifica task/ })).toBeInTheDocument()
  })

  it('does not revert an unlink that completed while a comment was being posted', async () => {
    let resolveComment: (v: unknown) => void = () => {}
    apiPost.mockReturnValue(new Promise((r) => { resolveComment = r }))
    apiPatch.mockResolvedValue({ data: { ...baseTask, drive_files_detail: [] } })
    const { onChanged } = setup()
    fireEvent.click(await screen.findByRole('tab', { name: /Commenti/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Scrivi un commento/), { target: { value: 'Ciao' } })
    fireEvent.click(screen.getByRole('button', { name: /Invia/ }))
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: /Allegati/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Scollega verbale.pdf' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ drive_files_detail: [] })))
    resolveComment({ data: { id: 2, task: 7, author: 1, author_name: 'Fede', body: 'Ciao', created_at: '2026-09-24T12:00:00Z', updated_at: '2026-09-24T12:00:00Z' } })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2))
    expect(onChanged.mock.calls.at(-1)![0]).toMatchObject({ drive_files_detail: [], comments_count: 1 })
    expect(screen.queryByText('verbale.pdf')).toBeNull()
  })
})
