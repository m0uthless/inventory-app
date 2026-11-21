import { api } from '@shared/api/client'

/** Il backend restituisce al massimo 200 elementi per pagina (config/pagination.py, MAX_PAGE_SIZE). */
export const API_MAX_PAGE_SIZE = 200

type Page<T> = { results?: T[]; next?: string | null; count?: number }

/**
 * Tutti gli elementi di un elenco dell'API, pagina dopo pagina (finché c'è `next`).
 * Da usare al posto di `page_size: 500`, che il backend taglia in silenzio a 200.
 * Accetta anche gli endpoint non paginati (lista semplice). `maxPages` è un limite
 * di sicurezza: 50 pagine = 10.000 elementi.
 */
export async function fetchAll<T>(
  url: string,
  params: Record<string, unknown> = {},
  opts: { maxPages?: number; signal?: AbortSignal } = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 50
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const cfg = { params: { ...params, page, page_size: API_MAX_PAGE_SIZE }, ...(opts.signal ? { signal: opts.signal } : {}) }
    const { data } = await api.get<Page<T> | T[]>(url, cfg)
    if (Array.isArray(data)) return page === 1 ? data : out
    const got = data?.results ?? []
    out.push(...got)
    // Alcune azioni (es. /maintenance-plans/todo/) non danno `next`: si va avanti finché mancano elementi.
    const more = data?.next || (typeof data?.count === 'number' && out.length < data.count)
    if (!got.length || !more) break
  }
  return out
}
