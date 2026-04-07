import * as React from 'react'

import {
  useUrlNumberParam,
  useUrlStringParam,
  type UrlSetOptions,
} from './useUrlParam'

function mergeListFilterOptions(opts?: UrlSetOptions): UrlSetOptions {
  return {
    replace: opts?.replace ?? true,
    keepOpen: opts?.keepOpen ?? true,
    patch: {
      page: 1,
      ...(opts?.patch ?? {}),
    },
  }
}

export function useListUrlNumberParam(
  key: string,
  options?: { defaultValue?: number | '' },
): [number | '', (value: number | '', opts?: UrlSetOptions) => void] {
  const [value, setValueBase] = useUrlNumberParam(key, options)

  const setValue = React.useCallback(
    (nextValue: number | '', opts?: UrlSetOptions) => {
      setValueBase(nextValue, mergeListFilterOptions(opts))
    },
    [setValueBase],
  )

  return [value, setValue]
}

export function useListUrlStringParam(
  key: string,
  options?: { defaultValue?: string },
): [string, (value: string, opts?: UrlSetOptions) => void] {
  const [value, setValueBase] = useUrlStringParam(key, options)

  const setValue = React.useCallback(
    (nextValue: string, opts?: UrlSetOptions) => {
      setValueBase(nextValue, mergeListFilterOptions(opts))
    },
    [setValueBase],
  )

  return [value, setValue]
}
