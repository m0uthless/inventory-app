import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import IssueAttachments from './IssueAttachments'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Estensione non supportata per il file.' }))

const rows = [
  { id: 1, name: 'schermata.png', size: 2048, mime_type: 'image/png', from_task: false, url: '/api/issues/7/attachments/1/download/', uploaded_by_name: 'Marco Bassi', created_at: '2026-11-20T09:00:00Z' },
  { id: 2, name: '[Task] verbale.pdf', size: 1_500_000, mime_type: 'application/pdf', from_task: true, url: '/api/drive-files/4/download/', uploaded_by_name: 'Root', created_at: '2026-11-19T09:00:00Z' },
]
const show = (canEdit = true, onChanged = vi.fn()) => {
  render(<ThemeProvider theme={theme}><IssueAttachments issueId={7} canEdit={canEdit} onChanged={onChanged} /></ThemeProvider>)
  return { onChanged }
}

describe('IssueAttachments', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset()); toast.success.mockReset(); toast.error.mockReset()
    api.get.mockResolvedValue({ data: rows })
  })

  it('elenca gli allegati con dimensione, autore e il segno degli ereditati', async () => {
    show()
    expect(await screen.findByText('schermata.png')).toBeInTheDocument()
    expect(screen.getByText(/2 KB · Marco Bassi/)).toBeInTheDocument()
    expect(screen.getByText('[Task] verbale.pdf')).toBeInTheDocument()
    expect(screen.getByText(/1,4 MB · dal task di area/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apri schermata.png' })).toHaveAttribute('href', '/api/issues/7/attachments/1/download/')
  })

  it('«Allega file» carica in multipart e aggiorna l\'elenco', async () => {
    api.post.mockResolvedValue({ data: [] })
    const { onChanged } = show()
    await screen.findByText('schermata.png')
    const input = screen.getByLabelText('Allega file') as HTMLInputElement
    const file = new File(['x'], 'log.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/issues/7/attachments/')
    expect((body as FormData).getAll('file')).toHaveLength(1)
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('trascinare un file sulla zona lo carica', async () => {
    api.post.mockResolvedValue({ data: [] })
    show()
    const zone = await screen.findByTestId('attach-drop')
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } })
    await waitFor(() => expect(api.post).toHaveBeenCalled())
  })

  it('un errore del server compare nel toast', async () => {
    api.post.mockRejectedValue(new Error('400'))
    show()
    await screen.findByText('schermata.png')
    fireEvent.change(screen.getByLabelText('Allega file'), { target: { files: [new File(['x'], 'virus.exe')] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Estensione non supportata per il file.'))
  })

  it('togliere chiede conferma e poi cancella', async () => {
    api.delete.mockResolvedValue({})
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Togli schermata.png' }))
    const dlg = await screen.findByRole('dialog')
    fireEvent.click(within(dlg).getByRole('button', { name: 'Togli' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/issues/7/attachments/1/'))
  })

  it('in sola lettura niente caricamento né rimozione', async () => {
    show(false)
    await screen.findByText('schermata.png')
    expect(screen.queryByLabelText('Allega file')).toBeNull()
    expect(screen.queryByRole('button', { name: /Togli/ })).toBeNull()
  })

  it('senza allegati lo dice', async () => {
    api.get.mockResolvedValue({ data: [] })
    show(false)
    expect(await screen.findByText('Nessun allegato.')).toBeInTheDocument()
  })
})
