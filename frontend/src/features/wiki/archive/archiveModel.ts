import type * as React from 'react'
import type { Theme } from '@mui/material/styles'
import type { CampoIconName } from '../../../ui/campo'

// ── Tipi condivisi ───────────────────────────────────────────────────────────

export type WikiCategory = { id: number; name: string; description?: string | null; sort_order?: number; color?: string | null }

export type WikiPageRow = {
  id: number
  kb_code?: string | null
  title: string
  slug: string
  category?: number | null
  category_name?: string | null
  summary?: string | null
  tags?: string[] | null
  content_markdown?: string
  is_published: boolean
  view_count?: number
  average_rating?: number | null
  rating_count?: number
  attachment_count?: number
  is_favorite?: boolean
  favorited_at?: string | null
  created_by?: number | null
  created_by_username?: string | null
  updated_by_username?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type ApiList<T> = { count: number; results: T[] }

/** Cartella "senza categoria" per le pagine che non ne hanno una. */
export const NO_CAT: WikiCategory = { id: 0, name: 'Senza cartella', description: 'Pagine non ancora archiviate in una cartella.', color: null }

// ── Colori e icone ───────────────────────────────────────────────────────────

/** Variabili CSS dell'archivio, tutte dal tema (archive.css le usa con var()). */
export function archiveVars(t: Theme): React.CSSProperties {
  const a = t.palette.archie
  const dark = t.palette.mode === 'dark'
  const paper = dark ? a.surface2 : `color-mix(in oklab, ${t.palette.background.paper} 96%, ${t.palette.warning.main})`
  return {
    ['--primary' as string]: t.palette.primary.main,
    ['--primary-ink' as string]: t.palette.primary.contrastText,
    ['--text' as string]: t.palette.text.primary,
    ['--muted' as string]: t.palette.text.secondary,
    ['--faint' as string]: a.textFaint,
    ['--border' as string]: t.palette.divider,
    ['--border-strong' as string]: a.borderStrong,
    ['--surface' as string]: t.palette.background.paper,
    ['--surface-2' as string]: a.surface2,
    ['--bg' as string]: t.palette.background.default,
    ['--rail' as string]: a.frame,
    ['--field' as string]: a.field,
    ['--field-line' as string]: a.fieldLine,
    ['--neutral-bg' as string]: a.neutralBg,
    ['--warning' as string]: t.palette.warning.main,
    ['--warning-bg' as string]: t.palette.warning.light,
    ['--success' as string]: t.palette.success.main,
    ['--info' as string]: t.palette.info.main,
    ['--info-bg' as string]: t.palette.info.light,
    ['--focus' as string]: a.focusRing,
    ['--seq-3' as string]: a.seq[2],
    ['--paper' as string]: paper,
    ['--paper-line' as string]: `color-mix(in oklab, ${t.palette.divider} 70%, transparent)`,
    ['--note' as string]: dark ? `color-mix(in oklab, ${t.palette.warning.main} 30%, ${a.surface2})` : `color-mix(in oklab, ${t.palette.warning.main} 8%, ${t.palette.warning.light})`,
    ['--note-ink' as string]: dark ? t.palette.text.primary : `color-mix(in oklab, ${t.palette.warning.main} 55%, ${t.palette.text.primary})`,
    ['--wood' as string]: `color-mix(in oklab, ${t.palette.warning.main} ${dark ? 30 : 38}%, ${a.borderStrong})`,
    ['--code-bg' as string]: dark ? a.frame : t.palette.text.primary,
  }
}

const FALLBACK = '#5b6b67'
/** Colore della categoria (dato scelto dall'amministratore). */
export const catColor = (c?: WikiCategory | null) => (c?.color && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : FALLBACK)

/** Testo leggibile sopra il colore della categoria (bianco o inchiostro scuro). */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  return (1.05) / (lum + 0.05) >= 4.5 ? '#ffffff' : '#15201e'
}

/** Variabili --c e --c-ink per un elemento colorato dalla categoria. */
export const cVars = (hex: string): React.CSSProperties => ({ ['--c' as string]: hex, ['--c-ink' as string]: inkOn(hex) })

/** Icona ricavata dal nome della categoria (nessun campo nel backend). */
export function catIcon(name: string): CampoIconName {
  const n = name.toLowerCase()
  if (/check|collaud|verific|test|controll/.test(n)) return 'task'
  if (/vpn|access|rete|network|firewall|credenz|password/.test(n)) return 'key'
  if (/pacs|ris\b|sistem|server|dicom|hardware|software|applicativ/.test(n)) return 'server'
  if (/client|sito|siti|struttur|ospedal/.test(n)) return 'building'
  if (/manutenz|riparaz|guast/.test(n)) return 'wrench'
  if (/modalit|device|apparecch|monitor/.test(n)) return 'monitor'
  if (/intern|aziend|hr\b|amministr|personale|regol/.test(n)) return 'users'
  if (/procedur|istruz|guid|how|manual/.test(n)) return 'file'
  if (/senza/.test(n)) return 'folder'
  return 'book'
}

// ── Date e numeri ────────────────────────────────────────────────────────────

const MSH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export const dshort = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MSH[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`
}
export const rel = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5)
  return days <= 0 ? 'oggi' : days === 1 ? 'ieri' : days < 7 ? `${days} giorni fa` : dshort(iso)
}
export const r1 = (n?: number | null) => (typeof n === 'number' ? n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—')
export const plain = (html?: string | null) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

/** Ricerca nell'archivio: titolo, codice, riepilogo, tag e testo. */
export function matchesPage(p: WikiPageRow, term: string): boolean {
  const hay = [p.title, p.kb_code, p.summary, (p.tags ?? []).join(' '), plain(p.content_markdown)].join(' ').toLowerCase()
  return term.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

/** Passaggio del testo che contiene il termine cercato. */
export function snippetOf(p: WikiPageRow, term: string): string {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean)
  const sentences = [p.summary ?? '', ...plain(p.content_markdown).split(/(?<=[.!?:])\s+/)]
  return sentences.find((s) => words.some((w) => s.toLowerCase().includes(w))) ?? p.summary ?? ''
}

