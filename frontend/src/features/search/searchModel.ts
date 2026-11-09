import type { CampoIconName } from '../../ui/campo'

export type SearchResult = { kind: string; id: number; title: string; subtitle?: string | null; path?: string | null; updated_at?: string | null }

export type SearchGroup = 'customer' | 'site' | 'contact' | 'inventory' | 'maintenance_plan' | 'wiki_page' | 'drive'

/** Gruppi nell'ordine della pagina; cartelle e file del Drive stanno insieme. */
export const GROUPS: { key: SearchGroup; label: string; icon: CampoIconName }[] = [
  { key: 'customer', label: 'Clienti', icon: 'building' },
  { key: 'site', label: 'Siti', icon: 'pin' },
  { key: 'contact', label: 'Contatti', icon: 'users' },
  { key: 'inventory', label: 'Inventari', icon: 'server' },
  { key: 'maintenance_plan', label: 'Manutenzione', icon: 'wrench' },
  { key: 'wiki_page', label: 'Wiki', icon: 'book' },
  { key: 'drive', label: 'Drive', icon: 'folder' },
]

export const groupOf = (kind: string): SearchGroup | null =>
  kind === 'drive_folder' || kind === 'drive_file' ? 'drive' : (GROUPS.find((g) => g.key === kind)?.key ?? null)

export const iconOf = (kind: string): CampoIconName =>
  kind === 'drive_file' ? 'file' : GROUPS.find((g) => g.key === groupOf(kind))?.icon ?? 'search'

/** Dove porta un risultato: il path del backend, altrimenti la lista del modulo con il pannello aperto. */
export function resultPath(r: SearchResult): string | null {
  if (r.path) return r.path
  const base: Record<string, string> = { customer: '/customers', site: '/sites', contact: '/contacts', inventory: '/inventory' }
  if (base[r.kind]) return `${base[r.kind]}?open=${r.id}`
  if (r.kind === 'maintenance_plan') return `/maintenance/plans?apri=${r.id}`
  if (r.kind === 'wiki_page') return `/wiki/${r.id}`
  if (r.kind === 'drive_folder') return `/drive?cartella=${r.id}`
  if (r.kind === 'drive_file') return `/drive?file=${r.id}`
  return null
}

/** Spezza il testo per evidenziare le parole cercate (senza distinguere maiuscole). */
export function highlightParts(text: string, q: string): { t: string; hit: boolean }[] {
  const words = q.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!text || !words.length) return [{ t: text, hit: false }]
  const re = new RegExp(`(${words.join('|')})`, 'ig')
  return text.split(re).filter(Boolean).map((t) => ({ t, hit: words.some((w) => new RegExp(`^${w}$`, 'i').test(t)) }))
}

// ── Ricerche recenti (solo in questo browser) ──
const KEY = 'archie-recent-searches'
export function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : [] } catch { return [] }
}
export function pushRecent(q: string): string[] {
  const t = q.trim()
  if (t.length < 2) return readRecent()
  const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* niente */ }
  return next
}
