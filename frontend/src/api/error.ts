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
