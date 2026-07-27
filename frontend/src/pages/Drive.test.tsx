import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Drive from './Drive'
import type { DriveFolder } from './drive/types'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const successToast = vi.fn()
const errorToast = vi.fn()

const apiGet = vi.fn()
const apiPost = vi.fn()
const apiPatch = vi.fn()
const apiDelete = vi.fn()

vi.mock('@shared/api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}))
vi.mock('@shared/api/error', () => ({ apiErrorToMessage: () => 'Errore' }))
const toastApi = { error: errorToast, success: successToast }
vi.mock('@shared/ui/toast', () => ({
  useToast: () => toastApi,
}))
// Can (auth/Can.tsx) legge hasPerm/inGroup da qui: mockato per non richiedere
// un vero AuthProvider e per mostrare sempre i pulsanti azione nei test.
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ hasPerm: () => true, inGroup: () => true }),
}))

type Params = { params?: Record<string, unknown> }

function makeFolder(id: number, name: string): DriveFolder {
  return {
    id,
    name,
    parent: null,
    full_path: name,
    children_count: 0,
    files_count: 0,
    customers: [],
    created_by_name: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  }
}

function makeFile(id: number, name: string) {
  return {
    id,
    name,
    folder: null,
    folder_name: null,
    file: `${name}.pdf`,
    mime_type: 'application/pdf',
    size: 1024,
    size_human: '1 KB',
    extension: 'pdf',
    is_previewable: true,
    is_image: false,
    is_pdf: true,
    customers: [],
    created_by_name: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  }
}

describe('Drive page — fix P1', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiPatch.mockReset()
    apiDelete.mockReset()
    successToast.mockReset()
    errorToast.mockReset()
  })

  it('non fa doppie richieste quando si naviga in una cartella (fix 7.2)', async () => {
    apiGet.mockImplementation((url: string, config?: Params) => {
      if (url === '/customers/') return Promise.resolve({ data: { results: [] } })
      if (url === '/drive-folders/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [makeFolder(10, 'Cartella A')] } })
      }
      if (url === '/drive-files/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [] } })
      }
      if (url === '/drive-folders/10/children/') {
        return Promise.resolve({ data: { folders: [], files: [] } })
      }
      if (url === '/drive-folders/10/breadcrumb/') {
        return Promise.resolve({ data: [{ id: 10, name: 'Cartella A' }] })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Drive />)

    const folderBtn = await screen.findByRole('button', { name: /Apri cartella Cartella A/ })
    fireEvent.click(folderBtn)

    await waitFor(() => {
      const calls = apiGet.mock.calls.filter(([url]) => url === '/drive-folders/10/children/')
      expect(calls.length).toBe(1)
    })

    // Aspetta un giro extra: se il bug (doppia chiamata da navigateTo + effect)
    // fosse ancora presente, qui vedremmo una seconda chiamata.
    await new Promise((r) => setTimeout(r, 30))
    const finalCalls = apiGet.mock.calls.filter(([url]) => url === '/drive-folders/10/children/')
    expect(finalCalls.length).toBe(1)
  })

  it('preserva il filtro cliente dopo aver creato una cartella (fix 7.3)', async () => {
    apiGet.mockImplementation((url: string, config?: Params) => {
      if (url === '/customers/') {
        return Promise.resolve({ data: { results: [{ id: 1, display_name: 'Cliente Alpha' }] } })
      }
      if (url === '/drive-folders/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [] } })
      }
      if (url === '/drive-files/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [] } })
      }
      return Promise.resolve({ data: {} })
    })
    apiPost.mockResolvedValue({ data: makeFolder(50, 'Nuova') })

    render(<Drive />)

    const filterInput = await screen.findByPlaceholderText('Filtra per cliente…')
    fireEvent.change(filterInput, { target: { value: 'Alpha' } })
    fireEvent.click(await screen.findByText('Cliente Alpha'))

    await waitFor(() => {
      const filtered = apiGet.mock.calls.some(
        ([url, config]) =>
          url === '/drive-folders/' && (config as Params | undefined)?.params?.customer === 1,
      )
      expect(filtered).toBe(true)
    })

    apiGet.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Nuova cartella' }))
    const nameField = await screen.findByLabelText('Nome cartella')
    fireEvent.change(nameField, { target: { value: 'Nuova' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }))

    await waitFor(() => expect(apiPost).toHaveBeenCalled())

    // Dopo la creazione, il refresh della cartella corrente deve continuare
    // a includere il filtro cliente attivo (prima veniva perso).
    await waitFor(() => {
      const filteredAfterCreate = apiGet.mock.calls.some(
        ([url, config]) =>
          url === '/drive-folders/' && (config as Params | undefined)?.params?.customer === 1,
      )
      expect(filteredAfterCreate).toBe(true)
    })
  })

  it('ignora una risposta root obsoleta arrivata dopo un cambio di filtro più recente (fix 7.4)', async () => {
    let resolveUnfiltered: (v: unknown) => void = () => {}
    const unfilteredPromise = new Promise((resolve) => {
      resolveUnfiltered = resolve
    })

    apiGet.mockImplementation((url: string, config?: Params) => {
      if (url === '/customers/') {
        return Promise.resolve({ data: { results: [{ id: 1, display_name: 'Cliente Alpha' }] } })
      }
      if (url === '/drive-folders/' && config?.params?.root) {
        if (config?.params?.customer === 1) {
          return Promise.resolve({ data: { results: [makeFolder(20, 'Cartella Filtrata')] } })
        }
        // Richiesta iniziale (senza filtro): resta in sospeso finché non la
        // risolviamo esplicitamente più sotto, per simulare l'arrivo in
        // ritardo rispetto alla richiesta successiva (filtrata).
        return unfilteredPromise
      }
      if (url === '/drive-files/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Drive />)

    const filterInput = await screen.findByPlaceholderText('Filtra per cliente…')
    fireEvent.change(filterInput, { target: { value: 'Alpha' } })
    fireEvent.click(await screen.findByText('Cliente Alpha'))

    await screen.findByText('Cartella Filtrata')

    // La richiesta iniziale (obsoleta) arriva ora, con dati diversi: non deve
    // sovrascrivere quanto già mostrato dalla richiesta più recente.
    resolveUnfiltered({ data: { results: [makeFolder(99, 'Cartella Fantasma')] } })
    await new Promise((r) => setTimeout(r, 30))

    expect(screen.queryByText('Cartella Fantasma')).not.toBeInTheDocument()
    expect(screen.getByText('Cartella Filtrata')).toBeInTheDocument()
  })

  it('seleziona un file con un solo click, senza doppio toggle (fix 7.1)', async () => {
    apiGet.mockImplementation((url: string, config?: Params) => {
      if (url === '/customers/') return Promise.resolve({ data: { results: [] } })
      if (url === '/drive-folders/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [] } })
      }
      if (url === '/drive-files/' && config?.params?.root) {
        return Promise.resolve({ data: { results: [makeFile(1, 'documento.pdf')] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Drive />)

    const checkbox = await screen.findByRole('checkbox', { name: /Seleziona file documento.pdf/ })
    fireEvent.click(checkbox)

    // Se il bug del setState annidato fosse ancora presente, il toggle si
    // annullerebbe da solo e la barra di selezione non apparirebbe mai.
    await screen.findByText('1 selezionati')
  })
})
