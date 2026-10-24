import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConvertToIssueDialog from './ConvertToIssueDialog'
import type { AreaTaskRow } from './types'

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@shared/api/client', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
  },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))

const task: AreaTaskRow = {
  id: 7, area: 3, area_label: 'Ufficio', title: 'Ordine toner', description: 'Chiamare il fornitore',
  status: 'in_corso', priority: 'high', due_date: null, assigned_to: null, assigned_to_name: null,
  created_by: 1, created_by_name: 'Fede', created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z',
  completed_at: null, comments_count: 0, can_edit: true, drive_files_detail: [],
  converted_to_issue: null, converted_to_issue_title: null,
}

beforeEach(() => {
  apiGet.mockReset()
  apiPost.mockReset()
  toast.error.mockReset()
  apiGet.mockImplementation((url: string) => {
    if (url === '/customers/') return Promise.resolve({ data: { results: [{ id: 9, display_name: 'ACME' }] } })
    if (url === '/sites/') return Promise.resolve({ data: { results: [{ id: 21, display_name: 'Sede principale' }] } })
    return Promise.resolve({ data: [] })
  })
})

async function selectCustomer(dlg: HTMLElement) {
  const custInput = within(dlg).getByLabelText(/Cliente/)
  fireEvent.change(custInput, { target: { value: 'ACME' } })
  const option = await screen.findByText('ACME')
  fireEvent.click(option)
}

describe('ConvertToIssueDialog', () => {
  it('precompiles title, description and priority from the task', () => {
    render(<ConvertToIssueDialog open task={task} onClose={vi.fn()} onConverted={vi.fn()} />)
    expect(screen.getByLabelText(/Titolo/)).toHaveValue('Ordine toner')
    expect(screen.getByLabelText(/Descrizione/)).toHaveValue('Chiamare il fornitore')
    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('disables "Conferma" until a customer is selected', async () => {
    render(<ConvertToIssueDialog open task={task} onClose={vi.fn()} onConverted={vi.fn()} />)
    const dlg = screen.getByRole('dialog')
    expect(within(dlg).getByRole('button', { name: 'Conferma' })).toBeDisabled()
    await selectCustomer(dlg)
    expect(within(dlg).getByRole('button', { name: 'Conferma' })).toBeEnabled()
  })

  it('submits the conversion with the selected customer and reports the result', async () => {
    apiPost.mockResolvedValue({
      data: { task: { ...task, converted_to_issue: 55 }, issue: { id: 55, title: 'Ordine toner' } },
    })
    const onConverted = vi.fn()
    const onClose = vi.fn()
    render(<ConvertToIssueDialog open task={task} onClose={onClose} onConverted={onConverted} />)
    const dlg = screen.getByRole('dialog')
    await selectCustomer(dlg)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Conferma' }))

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/area-tasks/7/convert-to-issue/', {
      customer: 9, site: undefined, title: 'Ordine toner', description: 'Chiamare il fornitore',
    }))
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith({ task: { ...task, converted_to_issue: 55 }, issue: { id: 55, title: 'Ordine toner' } }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a field-level error on a 400 response for the customer field', async () => {
    apiPost.mockRejectedValue({ response: { data: { customer: ['Campo obbligatorio.'] } } })
    render(<ConvertToIssueDialog open task={task} onClose={vi.fn()} onConverted={vi.fn()} />)
    const dlg = screen.getByRole('dialog')
    await selectCustomer(dlg)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Conferma' }))
    expect(await within(dlg).findByText('Campo obbligatorio.')).toBeInTheDocument()
  })

  it('toasts a clear message on a 409 (already converted)', async () => {
    apiPost.mockRejectedValue({ response: { status: 409, data: { detail: 'Already converted' } } })
    render(<ConvertToIssueDialog open task={task} onClose={vi.fn()} onConverted={vi.fn()} />)
    const dlg = screen.getByRole('dialog')
    await selectCustomer(dlg)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('già stato trasformato')))
  })

  it('shows a visible message (not just a stopped spinner) on a 403 outside the task area', async () => {
    apiPost.mockRejectedValue({ response: { status: 403, data: { detail: 'Non puoi modificare questo task.' } } })
    render(<ConvertToIssueDialog open task={task} onClose={vi.fn()} onConverted={vi.fn()} />)
    const dlg = screen.getByRole('dialog')
    await selectCustomer(dlg)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Conferma' }))

    expect(await within(dlg).findByText('Non puoi modificare questo task.')).toBeInTheDocument()
    // Lo spinner si ferma e il dialog resta apribile/aperto, non bloccato a metà.
    await waitFor(() => expect(within(dlg).getByRole('button', { name: 'Conferma' })).toBeEnabled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('toasts errors on fields the dialog does not render (e.g. site)', async () => {
    apiPost.mockRejectedValue({ response: { data: { customer: ['Obbligatorio.'], site: ['Il sito non appartiene al cliente.'] } } })
    render(<ConvertToIssueDialog open task={task} onClose={vi.fn()} onConverted={vi.fn()} />)
    const dlg = screen.getByRole('dialog')
    await selectCustomer(dlg)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Conferma' }))

    expect(await within(dlg).findByText('Obbligatorio.')).toBeInTheDocument()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Il sito non appartiene al cliente.')))
  })
})
