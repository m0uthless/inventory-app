import type { AxiosError } from "axios";

function isObject(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function flattenFieldErrors(obj: Record<string, any>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "detail" && typeof v === "string") out.push(v);
    else if (Array.isArray(v)) out.push(`${k}: ${v.join(", ")}`);
    else if (typeof v === "string") out.push(`${k}: ${v}`);
    else if (isObject(v)) out.push(`${k}: ${flattenFieldErrors(v).join(" | ")}`);
  }
  return out;
}

export function apiErrorToMessage(err: unknown): string {
  const e = err as AxiosError<any>;

  // Axios network / timeout
  if ((e as any)?.code === "ECONNABORTED") return "Timeout: il server non risponde.";
  if (!e?.response) return "Errore di rete: controlla connessione / proxy / backend.";

  const data = e.response.data;

  if (typeof data === "string") return data;

  if (isObject(data)) {
    if (typeof data.detail === "string") return data.detail;
    const parts = flattenFieldErrors(data);
    if (parts.length) return parts.join(" • ");
  }

  const status = e.response.status;
  return `Errore (${status}).`;
}


export function apiErrorToFieldErrors(err: unknown): Record<string, string> | null {
  const e = err as AxiosError<any>;
  if (!e?.response) return null;
  if (e.response.status !== 400) return null;

  const data = e.response.data;
  if (!isObject(data)) return null;

  const out: Record<string, string> = {};

  const add = (k: string, v: unknown) => {
    if (!k || k === "detail") return;
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === "string") as any;
      if (typeof first === "string" && first.trim()) out[k] = first;
      else if (v.length) out[k] = String(v[0]);
      return;
    }
    if (typeof v === "string" && v.trim()) out[k] = v;
  };

  for (const [k, v] of Object.entries(data)) {
    if (k === "detail") continue;

    // DRF convention for form-level errors
    if (k === "non_field_errors") {
      if (Array.isArray(v) && v.length) out["_error"] = String(v[0]);
      else if (typeof v === "string") out["_error"] = v;
      continue;
    }

    if (isObject(v)) {
      // Flatten 1-level nested errors (e.g. custom_fields.xxx)
      for (const [k2, v2] of Object.entries(v)) add(`${k}.${k2}`, v2);
      continue;
    }

    add(k, v);
  }

  return Object.keys(out).length ? out : null;
}
