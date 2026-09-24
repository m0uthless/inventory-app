import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DriveFilePickerDialog from './DriveFilePickerDialog'

const apiGet = vi.fn()
vi.mock('@shared/api/client', () => ({ api: { get: (...a: unknown[]) => apiGet(...a) } }))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toast = { error: vi.fn(), success: vi.fn() }
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))

const folder = { id: 5, name: 'Verbali', parent: null }
const fileRoot = { id: 1, name: 'root.pdf', folder: null, mime_type: 'application/pdf', size: 2048 }
const fileInFolder = { id: 2, name: 'dentro.pdf', folder: 5, mime_type: 'application/pdf', size: 1024 }

beforeEach(() => {
  apiGet.mockReset()
  apiGet.mockImplementation((url: string) => {
    if (url === '/drive-folders/') return Promise.resolve({ data: { results: [folder] } })
    if (url === '/drive-files/') return Promise.resolve({ data: { results: [fileRoot] } })
    if (url === '/drive-folders/5/children/')
      return Promise.resolve({ data: { folder, folders: [], files: [fileInFolder] } })
    if (url === '/drive-folders/5/breadcrumb/') return Promise.resolve({ data: [{ id: 5, name: 'Verbali' }] })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
})

describe('DriveFilePickerDialog', () => {
  it('lists root folders and files and confirms the selection', async () => {
    const onConfirm = vi.fn()
    render(<DriveFilePickerDialog open excludeIds={[]} onClose={() => {}} onConfirm={onConfirm} />)

    expect(await screen.findByText('Verbali')).toBeInTheDocument()
    expect(screen.getByText('root.pdf')).toBeInTheDocument()

    const confirm = screen.getByRole('button', { name: /Collega/ })
    expect(confirm).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Seleziona root.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /Collega \(1\)/ }))

    expect(onConfirm).toHaveBeenCalledWith([
      { id: 1, name: 'root.pdf', mime_type: 'application/pdf', size: 2048, folder: null },
    ])
  })

  it('keeps the selection while navigating into a folder', async () => {
    const onConfirm = vi.fn()
    render(<DriveFilePickerDialog open excludeIds={[]} onClose={() => {}} onConfirm={onConfirm} />)

    fireEvent.click(await screen.findByLabelText('Seleziona root.pdf'))
    fireEvent.click(screen.getByText('Verbali'))
    fireEvent.click(await screen.findByLabelText('Seleziona dentro.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /Collega \(2\)/ }))

    const ids = onConfirm.mock.calls[0]![0].map((f: { id: number }) => f.id).sort()
    expect(ids).toEqual([1, 2])
  })

  it('disables files that are already linked', async () => {
    render(<DriveFilePickerDialog open excludeIds={[1]} onClose={() => {}} onConfirm={() => {}} />)
    const box = await screen.findByLabelText('Seleziona root.pdf')
    expect(box).toBeDisabled()
  })

  it('goes back to the root from the breadcrumb', async () => {
    render(<DriveFilePickerDialog open excludeIds={[]} onClose={() => {}} onConfirm={() => {}} />)
    fireEvent.click(await screen.findByText('Verbali'))
    await screen.findByText('dentro.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Drive' }))
    await waitFor(() => expect(screen.getByText('root.pdf')).toBeInTheDocument())
  })
  it('resets to the root with no stale rows or selection when reopened', async () => {
    const props = { excludeIds: [] as number[], onClose: () => {}, onConfirm: () => {} }
    const { rerender } = render(<DriveFilePickerDialog open {...props} />)
    fireEvent.click(await screen.findByLabelText('Seleziona root.pdf'))
    fireEvent.click(screen.getByText('Verbali'))
    await screen.findByText('dentro.pdf')

    rerender(<DriveFilePickerDialog open={false} {...props} />)
    rerender(<DriveFilePickerDialog open {...props} />)

    expect(screen.queryByText('dentro.pdf')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Seleziona root.pdf')).not.toBeInTheDocument()
    await screen.findByText('root.pdf')
    expect(screen.queryByText('dentro.pdf')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Collega/ })).toBeDisabled()
    expect(screen.getByLabelText('Seleziona root.pdf')).not.toBeChecked()
  })

  it('ignores a response that arrives after the dialog was closed mid-fetch', async () => {
    const normal = apiGet.getMockImplementation()!
    let resolveFolders!: (v: unknown) => void
    let resolveFiles!: (v: unknown) => void
    apiGet.mockImplementation((url: string) => {
      if (url === '/drive-folders/') return new Promise((r) => { resolveFolders = r })
      if (url === '/drive-files/') return new Promise((r) => { resolveFiles = r })
      return normal(url)
    })
    const props = { excludeIds: [] as number[], onClose: () => {}, onConfirm: () => {} }
    const { rerender } = render(<DriveFilePickerDialog open {...props} />)
    rerender(<DriveFilePickerDialog open={false} {...props} />)

    apiGet.mockImplementation(normal)
    await act(async () => {
      resolveFolders({ data: { results: [folder] } })
      resolveFiles({ data: { results: [fileRoot] } })
    })

    // Hold the new fetch so the first paint after reopen is observable.
    let releaseFolders!: (v: unknown) => void
    apiGet.mockImplementation((url: string) => {
      if (url === '/drive-folders/') return new Promise((r) => { releaseFolders = r })
      return normal(url)
    })
    rerender(<DriveFilePickerDialog open {...props} />)
    expect(screen.queryByText('Verbali')).not.toBeInTheDocument()
    expect(screen.queryByText('root.pdf')).not.toBeInTheDocument()

    await act(async () => { releaseFolders({ data: { results: [folder] } }) })
    expect(await screen.findByText('Verbali')).toBeInTheDocument()
    expect(screen.getByText('root.pdf')).toBeInTheDocument()
  })
})
