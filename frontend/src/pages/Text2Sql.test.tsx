import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Text2Sql from './Text2Sql'
import { pendingIds } from '../features/text2sql/pending'
import { THEME_REGISTRY } from '../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => toast }))
vi.mock('@shared/utils/clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ me: { id: 1, is_superuser: false }, hasPerm: () => true }) }))

const q = (id: number, over: Record<string, unknown> = {}) => ({
  id, question: `Domanda ${id}`, status: 'done', sql: 'SELECT 1 FROM dual;', kind: 'read', warnings: [], seconds: 30, error: '',
  created_at: '2026-11-20T09:00:00Z', started_at: null, finished_at: null, feedback: '', corrected_sql: '', feedback_note: '', feedback_at: null, ...over,
})

function setup(url = '/knowledge/sql', initial = [q(2), q(1)], detail: Record<number, unknown> = {}) {
  let list = initial
  api.get.mockImplementation((u: string) => {
    if (u === '/text2sql/') return Promise.resolve({ data: { results: list } })
    const m = /^\/text2sql\/(\d+)\/$/.exec(u)
    if (m && detail[Number(m[1])]) return Promise.resolve({ data: detail[Number(m[1])] })
    return Promise.reject(new Error(`GET inatteso ${u}`))
  })
  api.post.mockResolvedValue({ data: null })
  api.delete.mockImplementation((u: string) => { list = list.filter((x) => u !== `/text2sql/${x.id}/`); return Promise.resolve({ data: null }) })
  return render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={[url]}><Text2Sql /></MemoryRouter></ThemeProvider>)
}

describe('Generatore SQL', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); localStorage.clear() })

  it('le righe dell\'elenco sono pulsanti dentro una lista', async () => {
    setup()
    const btn = await screen.findByRole('button', { name: /Domanda 1/ })
    expect(btn.closest('[role="listitem"]')).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('aprendo una risposta pronta si segna letta la sua notifica', async () => {
    setup()
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/text2sql/2/seen/'))
    fireEvent.click(screen.getByRole('button', { name: /Domanda 1/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/text2sql/1/seen/'))
  })

  it('?apri di una domanda fuori dalle prime 50 la carica e segna letta quella', async () => {
    setup('/knowledge/sql?apri=9', [q(2), q(1)], { 9: q(9) })
    expect(await screen.findByRole('button', { name: /Domanda 9/ })).toHaveAttribute('aria-current', 'true')
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/text2sql/9/seen/'))
    expect(api.post).not.toHaveBeenCalledWith('/text2sql/2/seen/')
  })

  it('l\'elenco riallinea le domande in attesa per la campanella', async () => {
    setup('/knowledge/sql', [q(3, { status: 'running' }), q(2, { status: 'queued' }), q(1)])
    await screen.findByRole('button', { name: /Domanda 1/ })
    expect(pendingIds()).toEqual([3, 2])
  })

  it('cancellando una domanda in attesa la campanella non la aspetta più', async () => {
    setup('/knowledge/sql', [q(3, { status: 'queued' }), q(1)])
    await screen.findByRole('button', { name: /Domanda 3/ })
    expect(pendingIds()).toEqual([3])
    fireEvent.click(await screen.findByRole('button', { name: 'Togli dallo storico' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/text2sql/3/'))
    await waitFor(() => expect(pendingIds()).toEqual([]))
  })

  it('su telefono scegliere una domanda porta in vista la risposta', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: /Domanda 1/ }))
    await waitFor(() => expect(scroll).toHaveBeenCalled())
  })
})
