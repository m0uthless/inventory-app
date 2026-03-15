import * as React from 'react'
import { api } from '../api/client'
import type { ApiPage } from '../api/drf'
import { isRecord } from '../utils/guards'

type OnError = (e: unknown) => void

function isCanceled(err: unknown) {
  // Axios v1 cancellation
  if (!isRecord(err)) return false
  const code = err['code']
  const name = err['name']
  return code === 'ERR_CANCELED' || name === 'CanceledError'
}

/**
 * Shared DRF list loader.
 * - cancels in-flight requests on param changes/unmount
 * - returns { rows, rowCount, loading, reload }
 */
// prettier-ignore
export function useDrfList<T>(
  path: string,
  params: Record<string, unknown>,
  onError?: OnError,
) {
  const [rows, setRows] = React.useState<T[]>([])
  const [rowCount, setRowCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  const paramsKey = React.useMemo(() => JSON.stringify(params ?? {}), [params])
  const abortRef = React.useRef<AbortController | null>(null)

  // IMPORTANT:
  // `onError` is usually passed inline from pages. If we include it in
  // dependencies it changes on each render, which can create an endless
  // reload loop. Store it in a ref instead.
  const onErrorRef = React.useRef<OnError | undefined>(onError)
  React.useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Also keep latest params in a ref; reloads are keyed by `paramsKey`.
  const paramsRef = React.useRef<Record<string, unknown>>(params)
  React.useEffect(() => {
    paramsRef.current = params
  }, [params])

  const load = React.useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    try {
      const res = await api.get<ApiPage<T>>(path, { params: paramsRef.current, signal: ac.signal })
      setRows(res.data?.results ?? [])
      setRowCount(Number(res.data?.count ?? 0))
    } catch (e) {
      if (!isCanceled(e)) onErrorRef.current?.(e)
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [path])

  React.useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load, paramsKey])

  const reload = React.useCallback(() => {
    void load()
  }, [load])

  return { rows, rowCount, loading, reload } as const
}
