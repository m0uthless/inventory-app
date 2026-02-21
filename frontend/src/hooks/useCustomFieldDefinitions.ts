import * as React from "react";
import { apiGet } from "../api/client";

export type CustomFieldEntity = "customer" | "site" | "inventory" | "maintenance_plan";
export type CustomFieldType = "text" | "number" | "date" | "select" | "boolean";

export type CustomFieldDefinition = {
  id: number;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  field_type: CustomFieldType;
  required: boolean;
  options?: unknown;
  aliases?: string[] | null;
  help_text?: string | null;
  sort_order?: number;
  is_active?: boolean;
  is_sensitive?: boolean;
};

type ApiPage<T> = { count: number; results: T[] };

// Simple module-level cache to avoid refetching on every dialog open.
const cache = new Map<string, CustomFieldDefinition[]>();

function cacheKey(entity: CustomFieldEntity) {
  return entity;
}

export function useCustomFieldDefinitions(entity: CustomFieldEntity) {
  const key = cacheKey(entity);
  const [defs, setDefs] = React.useState<CustomFieldDefinition[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = React.useState<boolean>(!cache.has(key));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cache.has(key)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<ApiPage<CustomFieldDefinition>>(
          `/custom-field-definitions/?entity=${encodeURIComponent(entity)}&is_active=1&page_size=200&ordering=sort_order,key`
        );
        const items = Array.isArray(data?.results) ? data.results : [];
        cache.set(key, items);
        if (!cancelled) setDefs(items);
      } catch (e: any) {
        if (!cancelled) setError("Impossibile caricare i campi custom.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [entity, key]);

  const reload = React.useCallback(async () => {
    cache.delete(key);
    setLoading(true);
    setError(null);
    const data = await apiGet<ApiPage<CustomFieldDefinition>>(
      `/custom-field-definitions/?entity=${encodeURIComponent(entity)}&is_active=1&page_size=200&ordering=sort_order,key`
    );
    const items = Array.isArray(data?.results) ? data.results : [];
    cache.set(key, items);
    setDefs(items);
    setLoading(false);
  }, [entity, key]);

  return { defs, loading, error, reload } as const;
}

export function normalizeKey(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replaceAll("à", "a")
    .replaceAll("á", "a")
    .replaceAll("â", "a")
    .replaceAll("ä", "a")
    .replaceAll("è", "e")
    .replaceAll("é", "e")
    .replaceAll("ê", "e")
    .replaceAll("ì", "i")
    .replaceAll("í", "i")
    .replaceAll("ò", "o")
    .replaceAll("ó", "o")
    .replaceAll("ù", "u")
    .replaceAll("ú", "u")
    .replaceAll("'", "");
}

export function getCustomFieldValue(
  customFields: Record<string, any> | null | undefined,
  def: CustomFieldDefinition
): any {
  const cf = customFields ?? {};
  if (Object.prototype.hasOwnProperty.call(cf, def.key)) return (cf as any)[def.key];

  const wanted = new Set<string>([normalizeKey(def.key)]);
  for (const a of def.aliases ?? []) wanted.add(normalizeKey(String(a)));

  for (const [k, v] of Object.entries(cf)) {
    if (wanted.has(normalizeKey(k))) return v;
  }
  return undefined;
}

export function setCustomFieldValue(
  prev: Record<string, any> | null | undefined,
  def: CustomFieldDefinition,
  nextVal: any
): Record<string, any> {
  const base: Record<string, any> = { ...(prev ?? {}) };

  const wanted = new Set<string>([normalizeKey(def.key)]);
  for (const a of def.aliases ?? []) wanted.add(normalizeKey(String(a)));

  // Remove legacy/alias keys for this field to avoid duplicates
  for (const k of Object.keys(base)) {
    if (wanted.has(normalizeKey(k)) && k !== def.key) {
      delete base[k];
    }
  }

  const empty = nextVal === undefined || nextVal === null || (typeof nextVal === "string" && !nextVal.trim());

  if (empty) {
    delete base[def.key];
  } else {
    base[def.key] = nextVal;
  }

  return base;
}
