import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useList } from './ListRows'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))

describe('useList', () => {
  beforeEach(() => api.get.mockReset())

  it('oltre 200 elementi legge tutte le pagine', async () => {
    api.get
      .mockResolvedValueOnce({ data: { count: 3, next: 'p2', previous: null, results: [{ id: 1 }, { id: 2 }] } })
      .mockResolvedValueOnce({ data: { count: 3, next: null, previous: 'p1', results: [{ id: 3 }] } })
    const { result } = renderHook(() => useList<{ id: number }>('/sites/', { customer: 4, page_size: 500 }))
    await waitFor(() => expect(result.current).toHaveLength(3))
    expect(api.get).toHaveBeenNthCalledWith(1, '/sites/', { params: { customer: 4, page: 1, page_size: 200 } })
  })

  it('fino a 200 fa una sola richiesta come prima', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 1, next: 'p2', previous: null, results: [{ id: 1 }] } })
    const { result } = renderHook(() => useList<{ id: number }>('/audit-events/', { page_size: 50 }))
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(api.get).toHaveBeenCalledTimes(1)
  })
})
