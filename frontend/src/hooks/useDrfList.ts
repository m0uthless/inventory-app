import * as React from "react";
import { api } from "../api/client";
import type { ApiPage } from "../api/drf";

type OnError = (e: unknown) => void;

function isCanceled(err: any) {
  // Axios v1 cancellation
  return err?.code === "ERR_CANCELED" || err?.name === "CanceledError";
}

/**
 * Shared DRF list loader.
 * - cancels in-flight requests on param changes/unmount
 * - returns { rows, rowCount, loading, reload }
 */
export function useDrfList<T>(path: string, params: Record<string, any>, onError?: OnError) {
  const [rows, setRows] = React.useState<T[]>([]);
  const [rowCount, setRowCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const paramsKey = React.useMemo(() => JSON.stringify(params ?? {}), [params]);
  const abortRef = React.useRef<AbortController | null>(null);

  // IMPORTANT:
  // `onError` is usually passed inline from pages. If we include it in
  // dependencies it changes on each render, which can create an endless
  // reload loop. Store it in a ref instead.
  const onErrorRef = React.useRef<OnError | undefined>(onError);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Also keep latest params in a ref; reloads are keyed by `paramsKey`.
  const paramsRef = React.useRef<Record<string, any>>(params);
  React.useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const load = React.useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    try {
      const res = await api.get<ApiPage<T>>(path, { params: paramsRef.current, signal: ac.signal });
      setRows(res.data?.results ?? []);
      setRowCount(Number(res.data?.count ?? 0));
    } catch (e) {
      if (!isCanceled(e)) onErrorRef.current?.(e);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [path, paramsKey]);

  React.useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const reload = React.useCallback(() => {
    void load();
  }, [load]);

  return { rows, rowCount, loading, reload } as const;
}
