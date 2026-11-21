import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))

import { useSavedViews } from './savedViews'

const LOCAL = 'archie-views:fede:issues'
const SYNCED = 'archie-views-synced:fede:issues'

describe('useSavedViews (sul server)', () => {
  beforeEach(() => {
    localStorage.clear(); Object.values(api).forEach((f) => f.mockReset())
    api.post.mockImplementation((_u: string, body: unknown) => Promise.resolve({ data: body }))
    api.delete.mockResolvedValue({})
  })

  it('legge le viste dal server', async () => {
    api.get.mockResolvedValue({ data: [{ id: 's1', page: 'issues', name: 'Aperte', state: { v: 1 } }] })
    const { result } = renderHook(() => useSavedViews<{ v: number }>('issues', 'fede'))
    await waitFor(() => expect(result.current.views.map((v) => v.name)).toEqual(['Aperte']))
    expect(api.get).toHaveBeenCalledWith('/saved-views/', { params: { page: 'issues' } })
  })

  it('al primo avvio carica sul server le viste che erano solo nel browser, poi non più', async () => {
    localStorage.setItem(LOCAL, JSON.stringify([{ id: 'loc1', name: 'Mia', state: { q: 'x' } }]))
    api.get.mockResolvedValue({ data: [] })
    const { result, unmount } = renderHook(() => useSavedViews('issues', 'fede'))
    expect(result.current.views.map((v) => v.name)).toEqual(['Mia'])
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/saved-views/', { id: 'loc1', page: 'issues', name: 'Mia', state: { q: 'x' } }))
    await waitFor(() => expect(localStorage.getItem(SYNCED)).toBe('1'))
    unmount()
    // cancellata da un altro dispositivo: non torna sul server
    api.post.mockClear(); api.get.mockResolvedValue({ data: [] })
    const second = renderHook(() => useSavedViews('issues', 'fede'))
    await waitFor(() => expect(second.result.current.views).toEqual([]))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('aggiungi e togli passano dal server; l\'id resta quello restituito subito', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { result } = renderHook(() => useSavedViews<{ v: number }>('issues', 'fede'))
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    let id = ''
    act(() => { id = result.current.add('Nuova', { v: 2 }).id })
    expect(result.current.views.map((v) => v.id)).toEqual([id])
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/saved-views/', { id, page: 'issues', name: 'Nuova', state: { v: 2 } }))
    act(() => { result.current.remove(id) })
    expect(result.current.views).toEqual([])
    expect(api.delete).toHaveBeenCalledWith(`/saved-views/${id}/`, { params: { page: 'issues' } })
  })

  it('se il server non risponde restano quelle del browser', async () => {
    localStorage.setItem(LOCAL, JSON.stringify([{ id: 'loc1', name: 'Mia', state: {} }]))
    api.get.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useSavedViews('issues', 'fede'))
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(result.current.views.map((v) => v.name)).toEqual(['Mia'])
  })
})
