import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchAll } from './fetchAll'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))

const page = (results: number[], next: string | null, count = 5) => ({ data: { count, next, previous: null, results } })

describe('fetchAll', () => {
  beforeEach(() => api.get.mockReset())

  it('legge tutte le pagine finché c\'è `next`', async () => {
    api.get
      .mockResolvedValueOnce(page([1, 2], '/api/x/?page=2'))
      .mockResolvedValueOnce(page([3, 4], '/api/x/?page=3'))
      .mockResolvedValueOnce(page([5], null))
    expect(await fetchAll<number>('/x/', { ordering: 'name' })).toEqual([1, 2, 3, 4, 5])
    expect(api.get).toHaveBeenNthCalledWith(1, '/x/', { params: { ordering: 'name', page: 1, page_size: 200 } })
    expect(api.get).toHaveBeenNthCalledWith(3, '/x/', { params: { ordering: 'name', page: 3, page_size: 200 } })
  })

  it('continua finché ha letto `count` elementi, anche senza `next` (es. /maintenance-plans/todo/)', async () => {
    api.get
      .mockResolvedValueOnce({ data: { count: 3, next: null, previous: null, results: [1, 2] } })
      .mockResolvedValueOnce({ data: { count: 3, next: null, previous: null, results: [3] } })
    expect(await fetchAll<number>('/todo/')).toEqual([1, 2, 3])
  })

  it('una pagina vuota ferma comunque la lettura', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 9, next: null, previous: null, results: [] } })
    expect(await fetchAll<number>('/v/')).toEqual([])
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('accetta una risposta non paginata (lista semplice)', async () => {
    api.get.mockResolvedValueOnce({ data: [7, 8] })
    expect(await fetchAll<number>('/y/')).toEqual([7, 8])
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('si ferma dopo il massimo di pagine', async () => {
    api.get.mockImplementation((...args: unknown[]) => { const o = args[1] as { params: { page: number } } | undefined; return Promise.resolve(page([o?.params.page ?? -1], 'altra', 999)) })
    expect(await fetchAll<number>('/z/', {}, { maxPages: 3 })).toEqual([1, 2, 3])
  })

  it('passa il segnale di annullamento', async () => {
    const ctrl = new AbortController()
    api.get.mockResolvedValueOnce(page([1], null, 1))
    await fetchAll('/w/', {}, { signal: ctrl.signal })
    expect(api.get).toHaveBeenCalledWith('/w/', { params: { page: 1, page_size: 200 }, signal: ctrl.signal })
  })
})
