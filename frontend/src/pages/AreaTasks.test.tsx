import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTasks from './AreaTasks'
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

const auth: { me: Record<string, unknown>; hasPerm: (perm: string) => boolean; inGroup: () => boolean } = {
  me: { id: 1, username: 'fede', is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } },
  hasPerm: () => true,
  inGroup: () => true,
}
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('../features/areatasks/AreaTaskDetail', () => ({
  default: (p: { task: AreaTaskRow | null; initialTab?: number }) =>
    p.task ? <div data-testid="detail" data-initial-tab={p.initialTab ?? 0}>{p.task.title}</div> : null,
}))

function row(over: Partial<AreaTaskRow>): AreaTaskRow {
  return {
    id: 1, area: 3, area_label: 'Ufficio', title: 'Task', description: '', status: 'da_fare', priority: 'medium',
    due_date: null, assigned_to: null, assigned_to_name: null, created_by: 1, created_by_name: 'Fede',
    created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z', completed_at: null,
    comments_count: 0, can_edit: true, drive_files_detail: [],
    converted_to_issue: null, converted_to_issue_title: null, ...over,
  }
}

const rows = [
  row({ id: 1, title: 'Ordine toner', priority: 'high', assigned_to_name: 'Anna Rossi', comments_count: 2 }),
  row({ id: 2, title: 'Rapporto mensile', status: 'in_attesa' }),
]

function listCalls() {
  return apiGet.mock.calls.filter((c) => c[0] === '/area-tasks/')
}

function renderPage() {
  return render(<MemoryRouter><AreaTasks /></MemoryRouter>)
}

beforeEach(() => {
  ;[apiGet, apiPost, apiPatch, apiDelete, toast.error, toast.success].forEach((m) => m.mockReset())
  apiGet.mockImplementation((url: string) => {
    if (url === '/area-tasks/') return Promise.resolve({ data: { count: rows.length, results: rows } })
    if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }, { id: 4, label: 'Romagna' }] } })
    if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
  auth.me = { id: 1, username: 'fede', is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } }
  auth.hasPerm = () => true
})

describe('AreaTasks page', () => {
  it('lists the tasks of the own area by default, open tasks only, including old completed ones', async () => {
    renderPage()
    expect(await screen.findByText('Ordine toner')).toBeInTheDocument()
    expect(screen.getByText('Rapporto mensile')).toBeInTheDocument()
    const params = listCalls()[0]![1].params
    expect(params).toMatchObject({ include_hidden: 1, area: 3, status: ['da_fare', 'in_corso', 'in_attesa'] })
  })

  it('shows priority, status, assignee and due information per row', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('In attesa')).toBeInTheDocument()
    expect(screen.getByText('Anna Rossi')).toBeInTheDocument()
  })

  it('switches the status view to "Chiusi" and reloads with that filter', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: 'Chiusi' }))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.status === 'completato')).toBe(true))
  })

  it('applies "Assegnati a me" as mine=true', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByLabelText('Assegnati a me'))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.mine === 'true')).toBe(true))
  })

  it('removes the area filter when "Tutte le aree" is chosen', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.mouseDown(screen.getByLabelText('Area'))
    fireEvent.click(await screen.findByRole('option', { name: 'Tutte le aree' }))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.area === undefined)).toBe(true))
  })

  it('opens the detail when a row is clicked', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Ordine toner'))
    expect(await screen.findByTestId('detail')).toHaveTextContent('Ordine toner')
  })

  it('creates a task in the own area from the "Nuovo task" dialog', async () => {
    apiPost.mockResolvedValue({ data: row({ id: 9, title: 'Nuovo' }) })
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: /Nuovo task/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Titolo/), { target: { value: 'Nuovo' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea task' }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/', expect.objectContaining({ title: 'Nuovo', area: 3 })))
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(1)) // ricarica dopo la creazione
  })

  it('loads the assignable users of the area for the create dialog', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: /Nuovo task/ }))
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3 }) })),
    )
  })
  it('resets the page to 1 when a filter changes', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/area-tasks/') return Promise.resolve({ data: { count: 80, results: rows } })
      if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    render(<MemoryRouter initialEntries={['/?page=3']}><AreaTasks /></MemoryRouter>)
    await screen.findByText('Ordine toner')
    expect(listCalls()[0]![1].params).toMatchObject({ page: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Chiusi' }))
    await waitFor(() =>
      expect(listCalls().some((c) => c[1].params.status === 'completato' && c[1].params.page === 1)).toBe(true),
    )
    fireEvent.click(screen.getByLabelText('Assegnati a me'))
    await waitFor(() =>
      expect(listCalls().some((c) => c[1].params.mine === 'true' && c[1].params.page === 1)).toBe(true),
    )
  })

  it('filters by assignee, and reloads users and clears the assignee when the area changes', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3, page_size: 200 }) })),
    )
    fireEvent.mouseDown(screen.getByLabelText('Assegnatario'))
    fireEvent.click(await screen.findByRole('option', { name: 'Anna Rossi' }))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.assigned_to === 12)).toBe(true))
    fireEvent.mouseDown(screen.getByLabelText('Area'))
    fireEvent.click(await screen.findByRole('option', { name: 'Romagna' }))
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 4 }) })),
    )
    await waitFor(() => {
      const last = listCalls().at(-1)![1].params
      expect(last.area).toBe(4)
      expect(last.assigned_to).toBeUndefined()
    })
  })

  it('loads all users when "Tutte le aree" is selected', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.mouseDown(screen.getByLabelText('Area'))
    fireEvent.click(await screen.findByRole('option', { name: 'Tutte le aree' }))
    await waitFor(() =>
      expect(apiGet.mock.calls.some((c) => c[0] === '/users/' && c[1].params.leave_area === undefined && c[1].params.page_size === 200)).toBe(true),
    )
  })

  it('"Scaduti" sends due_before=yesterday and the open statuses even in the "Chiusi" view', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: 'Chiusi' }))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.status === 'completato')).toBe(true))
    fireEvent.click(screen.getByLabelText('Scaduti'))
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    const yesterday = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    await waitFor(() =>
      expect(
        listCalls().some(
          (c) => c[1].params.due_before === yesterday && JSON.stringify(c[1].params.status) === JSON.stringify(['da_fare', 'in_corso', 'in_attesa']),
        ),
      ).toBe(true),
    )
  })

  it('assignee and overdue filters reset the page to 1', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/area-tasks/') return Promise.resolve({ data: { count: 80, results: rows } })
      if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
      if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    const { unmount } = render(<MemoryRouter initialEntries={['/?page=3']}><AreaTasks /></MemoryRouter>)
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByLabelText('Scaduti'))
    await waitFor(() => expect(listCalls().some((c) => c[1].params.due_before && c[1].params.page === 1)).toBe(true))
    unmount()
    // assegnatario da solo, partendo di nuovo dalla pagina 3
    apiGet.mockClear()
    render(<MemoryRouter initialEntries={['/?page=3']}><AreaTasks /></MemoryRouter>)
    await screen.findByText('Ordine toner')
    fireEvent.mouseDown(screen.getByLabelText('Assegnatario'))
    fireEvent.click(await screen.findByRole('option', { name: 'Anna Rossi' }))
    await waitFor(() => {
      const last = listCalls().at(-1)![1].params
      expect(last.assigned_to).toBe(12)
      expect(last.page).toBe(1)
    })
  })

  it('shows the own area in the Area select before /leave-areas/ loads, without MUI warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apiGet.mockImplementation((url: string) => {
      if (url === '/area-tasks/') return Promise.resolve({ data: { count: 0, results: [] } })
      if (url === '/leave-areas/') return new Promise(() => {})
      if (url === '/users/') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Area')).toHaveTextContent('Ufficio'))
    expect(warn.mock.calls.some((c) => String(c[0]).includes('out-of-range'))).toBe(false)
    warn.mockRestore()
  })

  it('shows a toast when /leave-areas/ fails', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/area-tasks/') return Promise.resolve({ data: { count: 0, results: [] } })
      if (url === '/leave-areas/') return Promise.reject(new Error('boom'))
      if (url === '/users/') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    renderPage()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('tooltip on the disabled "Nuovo task" says "Seleziona un\'area" for a superuser', async () => {
    auth.me = { id: 1, username: 'root', is_superuser: true, profile: { leave_area: null, leave_area_label: null } }
    renderPage()
    await screen.findByText('Ordine toner')
    expect(screen.getByRole('button', { name: /Nuovo task/ })).toBeDisabled()
    fireEvent.mouseOver(screen.getByRole('button', { name: /Nuovo task/ }).parentElement!)
    expect(await screen.findByText("Seleziona un'area")).toBeInTheDocument()
  })

  it('tooltip on the disabled "Nuovo task" says no area assigned for a non-superuser without area', async () => {
    auth.me = { id: 1, username: 'x', is_superuser: false, profile: { leave_area: null, leave_area_label: null } }
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.mouseOver(screen.getByRole('button', { name: /Nuovo task/ }).parentElement!)
    expect(await screen.findByText('Nessuna area assegnata al tuo profilo')).toBeInTheDocument()
  })

  describe('never requests the old page together with a new filter', () => {
    const cases: Array<[string, () => Promise<void>, (p: Record<string, unknown>) => boolean]> = [
      ['status view', async () => { fireEvent.click(screen.getByRole('button', { name: 'Chiusi' })) }, (p) => p.status === 'completato'],
      ['mine', async () => { fireEvent.click(screen.getByLabelText('Assegnati a me')) }, (p) => p.mine === 'true'],
      [
        'assignee',
        async () => {
          fireEvent.mouseDown(screen.getByLabelText('Assegnatario'))
          fireEvent.click(await screen.findByRole('option', { name: 'Anna Rossi' }))
        },
        (p) => p.assigned_to === 12,
      ],
    ]
    it.each(cases)('%s', async (_name, change, isNew) => {
      apiGet.mockImplementation((url: string) => {
        if (url === '/area-tasks/') return Promise.resolve({ data: { count: 80, results: rows } })
        if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
        if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
        return Promise.reject(new Error(`unexpected ${url}`))
      })
      render(<MemoryRouter initialEntries={['/?page=3']}><AreaTasks /></MemoryRouter>)
      await screen.findByText('Ordine toner')
      await waitFor(() => expect(screen.getByLabelText('Assegnatario')).toBeInTheDocument())
      const before = listCalls().length
      await change()
      await waitFor(() => expect(listCalls().slice(before).some((c) => isNew(c[1].params))).toBe(true))
      await act(async () => { await new Promise((r) => setTimeout(r, 80)) })
      const after = listCalls().slice(before)
      expect(after.filter((c) => isNew(c[1].params) && c[1].params.page === 3)).toHaveLength(0)
      expect(after).toHaveLength(1)
      expect(after[0]![1].params.page).toBe(1)
    })
  })
  it('shows search, area select, the Aperti/Chiusi/Tutti chips and "Nuovo task" in the toolbar, with no reset button', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    expect(screen.getByRole('button', { name: 'Aperti' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chiusi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tutti' })).toBeInTheDocument()
    expect(screen.getByLabelText('Area')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nuovo task/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reimposta/ })).toBeNull()
  })

  describe('context menu', () => {
    it('opens on right-click and shows the expected items in order', async () => {
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      const menu = await screen.findByRole('menu')
      const items = within(menu).getAllByRole('menuitem').map((el) => el.textContent)
      expect(items).toEqual(['Apri dettaglio', 'Modifica', 'Commenta', 'Segna come In corso', 'Trasforma in issue', 'Elimina'])
    })

    it('"Apri dettaglio" opens the detail drawer on the default tab', async () => {
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Apri dettaglio' }))
      const detail = await screen.findByTestId('detail')
      expect(detail).toHaveTextContent('Ordine toner')
      expect(detail).toHaveAttribute('data-initial-tab', '0')
    })

    it('"Modifica" opens the dialog populated with the row values and saves with PATCH', async () => {
      apiPatch.mockResolvedValue({ data: row({ id: 1, title: 'Ordine toner aggiornato' }) })
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Modifica' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByLabelText(/Titolo/)).toHaveValue('Ordine toner')
      await waitFor(() =>
        expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3 }) })),
      )
      fireEvent.change(within(dialog).getByLabelText(/Titolo/), { target: { value: 'Ordine toner aggiornato' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }))
      await waitFor(() =>
        expect(apiPatch).toHaveBeenCalledWith('/area-tasks/1/', expect.objectContaining({ title: 'Ordine toner aggiornato' })),
      )
    })

    it('"Commenta" opens the detail drawer on the comments tab', async () => {
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Commenta' }))
      const detail = await screen.findByTestId('detail')
      expect(detail).toHaveTextContent('Ordine toner')
      expect(detail).toHaveAttribute('data-initial-tab', '1')
    })

    it('"Segna come..." sends the PATCH to the next status and reloads', async () => {
      apiPatch.mockResolvedValue({ data: row({ id: 1, title: 'Ordine toner', status: 'in_corso' }) })
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      const before = listCalls().length
      fireEvent.contextMenu(titleCell)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Segna come In corso' }))
      await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/1/', { status: 'in_corso' }))
      await waitFor(() => expect(listCalls().length).toBeGreaterThan(before))
    })

    it('"Elimina" calls DELETE after confirmation and reloads', async () => {
      apiDelete.mockResolvedValue({ data: {} })
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      const before = listCalls().length
      fireEvent.contextMenu(titleCell)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Elimina' }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }))
      await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/area-tasks/1/'))
      await waitFor(() => expect(listCalls().length).toBeGreaterThan(before))
    })

    it('hides "Trasforma in issue" when the user lacks issues.add_issue', async () => {
      auth.hasPerm = (perm: string) => perm !== 'issues.add_issue'
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      await screen.findByRole('menuitem', { name: 'Apri dettaglio' })
      expect(screen.queryByRole('menuitem', { name: 'Trasforma in issue' })).toBeNull()
    })

    it('hides "Trasforma in issue" for a task already converted to an issue', async () => {
      const convertedRow = { ...row({ id: 1, title: 'Ordine toner' }), converted_to_issue: 7 } as unknown as AreaTaskRow
      apiGet.mockImplementation((url: string) => {
        if (url === '/area-tasks/') return Promise.resolve({ data: { count: 1, results: [convertedRow] } })
        if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }] } })
        if (url === '/users/') return Promise.resolve({ data: [] })
        return Promise.reject(new Error(`unexpected ${url}`))
      })
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      await screen.findByRole('menuitem', { name: 'Apri dettaglio' })
      expect(screen.queryByRole('menuitem', { name: 'Trasforma in issue' })).toBeNull()
    })

    it('"Trasforma in issue" opens the convert dialog for the right task', async () => {
      renderPage()
      const titleCell = await screen.findByText('Ordine toner')
      fireEvent.contextMenu(titleCell)
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Trasforma in issue' }))
      const dlg = await screen.findByRole('dialog')
      expect(within(dlg).getByLabelText(/Titolo/)).toHaveValue('Ordine toner')
    })
  })
})
