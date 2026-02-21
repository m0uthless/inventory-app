import * as React from "react";
import { useSearchParams } from "react-router-dom";

export type UrlPatch = Record<string, any>;

export type UrlSetOptions = {
  /** Additional params to update together with the main param */
  patch?: UrlPatch;
  /** Replace history entry (default: true) */
  replace?: boolean;
  /** If false, clears the `open` param (default: true) */
  keepOpen?: boolean;
};

function setOrDelete(sp: URLSearchParams, key: string, value: any) {
  if (value === "" || value === null || value === undefined) {
    sp.delete(key);
    return;
  }
  // avoid setting NaN
  if (typeof value === "number" && Number.isNaN(value)) {
    sp.delete(key);
    return;
  }
  sp.set(key, String(value));
}

function applyPatch(sp: URLSearchParams, patch?: UrlPatch) {
  if (!patch) return;
  for (const [k, v] of Object.entries(patch)) {
    setOrDelete(sp, k, v);
  }
}

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export function useUrlStringParam(
  key: string,
  options?: { defaultValue?: string }
): [string, (value: string, opts?: UrlSetOptions) => void] {
  const [sp, setSp] = useSearchParams();
  const defaultValue = options?.defaultValue ?? "";

  const value = React.useMemo(() => sp.get(key) ?? defaultValue, [sp, key, defaultValue]);

  const setValue = React.useCallback(
    (nextValue: string, opts?: UrlSetOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          setOrDelete(next, key, nextValue);
          applyPatch(next, opts?.patch);
          if (opts?.keepOpen === false) next.delete("open");
          return next;
        },
        { replace: opts?.replace ?? true }
      );
    },
    [setSp, key]
  );

  return [value, setValue];
}

export function useUrlNumberParam(
  key: string,
  options?: { defaultValue?: number | "" }
): [number | "", (value: number | "", opts?: UrlSetOptions) => void] {
  const [sp, setSp] = useSearchParams();
  const defaultValue = options?.defaultValue ?? "";

  const value = React.useMemo((): number | "" => {
    const raw = sp.get(key);
    if (raw === null || raw === "") return defaultValue;
    const n = Number(raw);
    return Number.isNaN(n) ? defaultValue : n;
  }, [sp, key, defaultValue]);

  const setValue = React.useCallback(
    (nextValue: number | "", opts?: UrlSetOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          setOrDelete(next, key, nextValue);
          applyPatch(next, opts?.patch);
          if (opts?.keepOpen === false) next.delete("open");
          return next;
        },
        { replace: opts?.replace ?? true }
      );
    },
    [setSp, key]
  );

  return [value, setValue];
}

export function useUrlBoolParam(
  key: string,
  options?: { defaultValue?: boolean }
): [boolean, (value: boolean, opts?: UrlSetOptions) => void] {
  const [sp, setSp] = useSearchParams();
  const defaultValue = options?.defaultValue ?? false;

  const value = React.useMemo(() => {
    const raw = (sp.get(key) ?? "").toLowerCase();
    if (!raw) return defaultValue;
    return TRUTHY.has(raw);
  }, [sp, key, defaultValue]);

  const setValue = React.useCallback(
    (nextValue: boolean, opts?: UrlSetOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextValue) next.set(key, "1");
          else next.delete(key);
          applyPatch(next, opts?.patch);
          if (opts?.keepOpen === false) next.delete("open");
          return next;
        },
        { replace: opts?.replace ?? true }
      );
    },
    [setSp, key]
  );

  return [value, setValue];
}

function uniq<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

function parseArray(raw: string, separator: string): string[] {
  return raw
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * URL param restricted to a finite set of allowed string values.
 * Useful for "status" / "type" etc.
 */
export function useUrlEnumParam<T extends string>(
  key: string,
  allowed: readonly T[],
  options?: { defaultValue?: T | "" }
): [T | "", (value: T | "", opts?: UrlSetOptions) => void] {
  const [sp, setSp] = useSearchParams();
  const defaultValue = options?.defaultValue ?? "";

  const allowedSet = React.useMemo(() => new Set<string>(allowed as readonly string[]), [allowed]);

  const value = React.useMemo((): T | "" => {
    const raw = sp.get(key);
    if (!raw) return defaultValue;
    return allowedSet.has(raw) ? (raw as T) : defaultValue;
  }, [sp, key, defaultValue, allowedSet]);

  const setValue = React.useCallback(
    (nextValue: T | "", opts?: UrlSetOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!nextValue) next.delete(key);
          else if (allowedSet.has(String(nextValue))) next.set(key, String(nextValue));
          else next.delete(key);
          applyPatch(next, opts?.patch);
          if (opts?.keepOpen === false) next.delete("open");
          return next;
        },
        { replace: opts?.replace ?? true }
      );
    },
    [setSp, key, allowedSet]
  );

  return [value, setValue];
}

/**
 * Multi-value URL param stored as a single comma-separated string.
 * Example: ?status=active,pending
 */
export function useUrlArrayParam<T extends string = string>(
  key: string,
  options?: {
    separator?: string;
    allowed?: readonly T[];
    defaultValue?: readonly T[];
    /** Sort values before writing to URL (default: false). */
    canonicalize?: boolean;
  }
): [T[], (value: readonly T[], opts?: UrlSetOptions) => void] {
  const [sp, setSp] = useSearchParams();
  const separator = options?.separator ?? ",";
  const defaultValue = (options?.defaultValue ?? []) as readonly T[];

  const allowedSet = React.useMemo(() => {
    const allowed = options?.allowed;
    return allowed ? new Set<string>(allowed as readonly string[]) : null;
  }, [options?.allowed]);

  const value = React.useMemo((): T[] => {
    const raw = sp.get(key);
    if (!raw) return [...defaultValue];

    let items = parseArray(raw, separator);
    if (allowedSet) items = items.filter((v) => allowedSet.has(v));
    return uniq(items) as T[];
  }, [sp, key, separator, defaultValue, allowedSet]);

  const setValue = React.useCallback(
    (nextValue: readonly T[], opts?: UrlSetOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          let items = uniq(nextValue);
          if (allowedSet) items = items.filter((v) => allowedSet.has(String(v)));
          if (options?.canonicalize) items = [...items].sort();

          if (!items.length) next.delete(key);
          else next.set(key, items.join(separator));

          applyPatch(next, opts?.patch);
          if (opts?.keepOpen === false) next.delete("open");
          return next;
        },
        { replace: opts?.replace ?? true }
      );
    },
    [setSp, key, separator, allowedSet, options?.canonicalize]
  );

  return [value, setValue];
}

/**
 * Typed multi-enum URL param (allowed + array), stored as a single comma-separated string.
 * Example: ?status=active,pending
 *
 * This is a thin wrapper around `useUrlArrayParam` that improves type inference
 * when you pass `allowed` as a `const` array.
 */
export function useUrlEnumArrayParam<T extends string>(
  key: string,
  allowed: readonly T[],
  options?: {
    separator?: string;
    defaultValue?: readonly T[];
    canonicalize?: boolean;
  }
): [T[], (value: readonly T[], opts?: UrlSetOptions) => void] {
  return useUrlArrayParam<T>(key, {
    separator: options?.separator,
    allowed,
    defaultValue: options?.defaultValue,
    canonicalize: options?.canonicalize,
  });
}

/**
 * Multi-number URL param stored as a comma-separated string.
 * Example: ?site=12,14
 */
export function useUrlNumberArrayParam(
  key: string,
  options?: {
    separator?: string;
    defaultValue?: readonly number[];
    canonicalize?: boolean;
  }
): [number[], (value: readonly number[], opts?: UrlSetOptions) => void] {
  const [sp, setSp] = useSearchParams();
  const separator = options?.separator ?? ",";
  const defaultValue = options?.defaultValue ?? [];

  const value = React.useMemo((): number[] => {
    const raw = sp.get(key);
    if (!raw) return [...defaultValue];
    const items = parseArray(raw, separator)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    return uniq(items);
  }, [sp, key, separator, defaultValue]);

  const setValue = React.useCallback(
    (nextValue: readonly number[], opts?: UrlSetOptions) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          let items = uniq(nextValue).filter((n) => Number.isFinite(n));
          if (options?.canonicalize) items = [...items].sort((a, b) => a - b);

          if (!items.length) next.delete(key);
          else next.set(key, items.join(separator));

          applyPatch(next, opts?.patch);
          if (opts?.keepOpen === false) next.delete("open");
          return next;
        },
        { replace: opts?.replace ?? true }
      );
    },
    [setSp, key, separator, options?.canonicalize]
  );

  return [value, setValue];
}
