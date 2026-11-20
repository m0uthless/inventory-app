import type * as React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTasks from './AreaTasks'
import { THEME_REGISTRY } from '../theme/themeRegistry'
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
const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))

const auth: { me: Record<string, unknown>; hasPerm: (perm: string) => boolean; inGroup: () => boolean } = {
  me: { id: 1, username: 'fede', is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } },
  hasPerm: () => true,
  inGroup: () => true,
}
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('../features/areatasks/AreaTaskDetail', () => ({
  default: (p: { task: AreaTaskRow | null; initialTab?: number; onClose: () => void }) =>
    p.task ? <div data-testid="detail" data-initial-tab={p.initialTab ?? 0}>{p.task.title}<button type="button" onClick={p.onClose}>Chiudi</button></div> : null,
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

let rows: AreaTaskRow[] = []
const stats = {
  open: 2, overdue: 1, due_today: 0, due_week: 1, mine: 1, mine_in_progress: 0, mine_waiting: 0, unassigned: 1,
  done_recent: 0, converted_recent: 0, created_week: 2, da_fare: 1, in_corso: 0, in_attesa: 1, trend: [],
}

const listCalls = () => apiGet.mock.calls.filter((c) => c[0] === '/area-tasks/')
const lastParams = () => listCalls().at(-1)![1].params as Record<string, unknown>

const theme = THEME_REGISTRY.default.build('light')
function renderPage(path = '/tasks') {
  const Wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider theme={theme}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></ThemeProvider>
  return render(<AreaTasks />, { wrapper: Wrap })
}

beforeEach(() => {
  ;[apiGet, apiPost, apiPatch, apiDelete, toast.error, toast.success].forEach((m) => m.mockReset())
  rows = [
    row({ id: 1, title: 'Ordine toner', priority: 'high', assigned_to: 12, assigned_to_name: 'Anna Rossi', comments_count: 2 }),
    row({ id: 2, title: 'Rapporto mensile', status: 'in_attesa' }),
  ]
  apiGet.mockImplementation((url: string) => {
    if (url === '/area-tasks/') return Promise.resolve({ data: { count: rows.length, results: rows } })
    if (url === '/area-tasks/stats/') return Promise.resolve({ data: stats })
    const one = /^\/area-tasks\/(\d+)\/$/.exec(url)
    if (one && rows.some((r) => r.id === Number(one[1]))) return Promise.resolve({ data: rows.find((r) => r.id === Number(one[1])) })
    if (url === '/leave-areas/') return Promise.resolve({ data: { results: [{ id: 3, label: 'Ufficio' }, { id: 4, label: 'Romagna' }] } })
    if (url === '/users/') return Promise.resolve({ data: [{ id: 12, full_name: 'Anna Rossi', username: 'anna' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
  auth.me = { id: 1, username: 'fede', is_superuser: false, profile: { leave_area: 3, leave_area_label: 'Ufficio' } }
  auth.hasPerm = () => true
})

describe('AreaTasks page', () => {
  it('lists the open tasks of the own area by default and loads the indicators for it', async () => {
    renderPage()
    expect(await screen.findByText('Ordine toner')).toBeInTheDocument()
    expect(lastParams()).toMatchObject({ area: 3, is_open: 'true' })
    expect(apiGet).toHaveBeenCalledWith('/area-tasks/stats/', { params: { area: 3 } })
  })

  it('shows id, status, assignee and the comments chip like the Issues table', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getAllByText('In attesa').length).toBeGreaterThan(0)
    expect(screen.getByText('Anna Rossi')).toBeInTheDocument()
    expect(within(screen.getByRole('grid')).getByText('Da assegnare')).toBeInTheDocument()
    expect(screen.getByTitle('2 commenti')).toBeInTheDocument()
  })

  it.each([
    ['I miei', { is_open: 'true', mine: 'true' }],
    ['Scaduti', { overdue: 'true' }],
    ['Da assegnare', { is_open: 'true', unassigned: 'true' }],
    ['Completati', { is_open: 'false' }],
  ])('the "%s" view sends its filter', async (label, expected) => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${label}`) }))
    await waitFor(() => expect(lastParams()).toMatchObject(expected))
  })

  it('"Tutte" removes the area filter and marks the other areas as read-only', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: 'Tutte' }))
    await waitFor(() => expect(lastParams()).not.toHaveProperty('area'))
    expect(await screen.findByText(/sola lettura/)).toBeInTheDocument()
  })

  it('another area is read-only and does not allow creating tasks there', async () => {
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(await screen.findByRole('button', { name: 'Romagna' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ area: 4 }))
    expect(await screen.findByText(/sola lettura\. Puoi leggere/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nuovo task/ })).toBeDisabled()
  })

  it('a click selects the row, a double click opens the detail', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Rapporto mensile'))
    expect(screen.queryByTestId('detail')).toBeNull()
    fireEvent.doubleClick(screen.getByText('Rapporto mensile'))
    expect(await screen.findByTestId('detail')).toHaveTextContent('Rapporto mensile')
  })

  it('?open= opens a task of the list', async () => {
    renderPage('/tasks?open=2')
    expect(await screen.findByTestId('detail')).toHaveTextContent('Rapporto mensile')
  })

  it('?open= opens a task outside the current page through the API', async () => {
    const base = apiGet.getMockImplementation()!
    apiGet.mockImplementation((url: string) => (url === '/area-tasks/77/' ? Promise.resolve({ data: row({ id: 77, title: 'Fuori pagina' }) }) : base(url)))
    renderPage('/tasks?open=77')
    expect(await screen.findByTestId('detail')).toHaveTextContent('Fuori pagina')
  })

  it('closing the detail keeps it closed (no reopening from the URL)', async () => {
    renderPage()
    fireEvent.doubleClick(await screen.findByText('Rapporto mensile'))
    fireEvent.click(await screen.findByRole('button', { name: 'Chiudi' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId('detail')).toBeNull()
  })

  it('creates a task in the own area from the "Nuovo task" dialog and opens it', async () => {
    apiPost.mockResolvedValue({ data: row({ id: 9, title: 'Nuovo' }) })
    renderPage()
    await screen.findByText('Ordine toner')
    fireEvent.click(screen.getByRole('button', { name: /Nuovo task/ }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/users/', expect.objectContaining({ params: expect.objectContaining({ leave_area: 3 }) })))
    fireEvent.change(within(dialog).getByLabelText(/Titolo/), { target: { value: 'Nuovo' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea task' }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/', expect.objectContaining({ title: 'Nuovo', area: 3 })))
    expect(await screen.findByTestId('detail')).toHaveTextContent('Nuovo')
  })

  it('tooltip on the disabled "Nuovo task" says "Seleziona un\'area" for a superuser without area', async () => {
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

  describe('context menu', () => {
    it('shows the actions, with "Trasforma in issue" for an open task', async () => {
      renderPage()
      fireEvent.contextMenu(await screen.findByText('Ordine toner'))
      const menu = await screen.findByRole('menu')
      const items = within(menu).getAllByRole('menuitem').map((el) => el.textContent)
      expect(items).toEqual(['Apri', 'Commenta', 'Segna come In corso', 'Trasforma in issue', 'Elimina'])
    })

    it('"Commenta" opens the detail on the comments tab', async () => {
      renderPage()
      fireEvent.contextMenu(await screen.findByText('Ordine toner'))
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Commenta' }))
      expect(await screen.findByTestId('detail')).toHaveAttribute('data-initial-tab', '1')
    })

    it('"Segna come…" sends the next status and reloads', async () => {
      apiPatch.mockResolvedValue({ data: {} })
      renderPage()
      fireEvent.contextMenu(await screen.findByText('Ordine toner'))
      const before = listCalls().length
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Segna come In corso' }))
      await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/area-tasks/1/', { status: 'in_corso' }))
      await waitFor(() => expect(listCalls().length).toBeGreaterThan(before))
    })

    it('"Elimina" calls DELETE after confirmation', async () => {
      apiDelete.mockResolvedValue({})
      renderPage()
      fireEvent.contextMenu(await screen.findByText('Ordine toner'))
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Elimina' }))
      const dlg = await screen.findByRole('dialog', { name: /Eliminare il task/ })
      fireEvent.click(within(dlg).getByRole('button', { name: 'Elimina' }))
      await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/area-tasks/1/'))
    })

    it('"Trasforma in issue" opens the convert dialog for that task', async () => {
      renderPage()
      fireEvent.contextMenu(await screen.findByText('Ordine toner'))
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Trasforma in issue' }))
      const dlg = await screen.findByRole('dialog', { name: /Trasforma in issue/ })
      expect(within(dlg).getByDisplayValue('Ordine toner')).toBeInTheDocument()
    })

    it('a task already converted shows "Apri la issue" instead of "Trasforma in issue"', async () => {
      rows = [row({ id: 5, title: 'Switch rack', status: 'completato', converted_to_issue: 42, converted_to_issue_title: 'Switch' })]
      renderPage()
      expect(await screen.findByText('Issue #42')).toBeInTheDocument()
      fireEvent.contextMenu(screen.getByText('Switch rack'))
      expect(await screen.findByRole('menuitem', { name: 'Apri la issue #42' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Trasforma in issue' })).toBeNull()
    })

    it('a task whose issue was trashed can be converted again', async () => {
      rows = [row({ id: 5, title: 'Switch rack', status: 'completato', converted_to_issue: 42, converted_to_issue_title: 'Switch', converted_to_issue_deleted: true })]
      renderPage()
      expect(await screen.findByText('Issue #42 nel cestino')).toBeInTheDocument()
      fireEvent.contextMenu(screen.getByText('Switch rack'))
      expect(await screen.findByRole('menuitem', { name: 'Trasforma in issue' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Apri la issue #42' })).toBeNull()
    })

    it('hides "Trasforma in issue" when the user lacks issues.add_issue', async () => {
      auth.hasPerm = (perm: string) => perm !== 'issues.add_issue'
      renderPage()
      fireEvent.contextMenu(await screen.findByText('Ordine toner'))
      await screen.findByRole('menu')
      expect(screen.queryByRole('menuitem', { name: 'Trasforma in issue' })).toBeNull()
    })
  })
})
