import { Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { formatProvinceLabel } from '../../data/italianProvinces'
import type { StatusFilter, Tone } from './types'

// ─── Palette semantica (derivata dal tema) ─────────────────────────────────────
//
// I badge della pagina si dividono in due famiglie di peso visivo, non in una
// lista piatta di colori:
//
//  · "segnale" (SignalChip)  → stato operativo o criticità: Attivo/In uso/
//    Manutenzione, issue aperte. Peso alto: fondo saturo, bordo colorato,
//    testo bold. Sono le uniche informazioni che devono "saltare all'occhio".
//
//  · "meta"    (MetaTag / CountStat) → informazione strutturale o di conteggio:
//    tipo asset, tag cliente, contatori siti/asset. Peso basso: outline neutro
//    o pura tipografia, nessun fondo saturo.
//
// Tutti i colori derivano da theme.palette (nessun hex ad-hoc).

export function toneColors(theme: Theme, tone: Tone) {
  if (tone === 'neutral') {
    return {
      bg: theme.palette.grey[100],
      fg: theme.palette.text.secondary,
      border: theme.palette.divider,
      solid: theme.palette.text.secondary,
    }
  }
  const p = theme.palette[tone]
  return {
    bg: alpha(p.main, 0.12),
    fg: p.dark,
    border: alpha(p.main, 0.3),
    solid: p.main,
  }
}

export function inventoryStatusTone(statusKey?: string | null): Tone {
  switch (statusKey) {
    case 'in_use':      return 'success'
    case 'maintenance': return 'warning'
    case 'repair':      return 'error'
    case 'spare':        return 'info'
    default:              return 'neutral' // retired, storage, sconosciuto
  }
}

export function siteStatusTone(label?: string | null): Tone {
  const l = (label ?? '').toLowerCase()
  if (l === 'attivo' || l === 'active')            return 'success'
  if (l === 'manutenzione' || l === 'maintenance') return 'warning'
  return 'neutral' // inattivo, sconosciuto
}

export function issuePriorityTone(priority?: string | null): Tone {
  switch (priority) {
    case 'critical': return 'error'
    case 'high':      return 'error'
    case 'medium':    return 'warning'
    default:           return 'neutral' // low
  }
}

export const COL_GRID = '160px 180px 140px 130px 180px 110px 140px 150px 130px 130px 130px'

// ─── Scala tipografica ──────────────────────────────────────────────────────────
//
// Prima ogni testo aveva un fontSize scelto a mano (0.6/0.68/0.72/0.78/0.82/
// 0.975/1rem...), senza relazione tra loro né con le variant del tema — con il
// risultato che elementi con lo stesso ruolo (es. nome sito vs nome asset)
// finivano a dimensioni diverse. Un'unica scala a 5 livelli, usata ovunque:
//
//   micro   10px  intestazioni colonna, didascalie sotto i contatori
//   label   11px  badge/chip, tab
//   body    12px  testo di riga: nomi, indirizzi, contatti — E campi tecnici
//                 monospace (K#, Seriale, IP, codice cliente): stessa taglia,
//                 stesso peso, per allineamento visivo nella riga
//   title   13px  enfasi di riga: nome cliente, valore dei contatori
//   section 15px  titolo di sezione: nome città

export const FS = {
  micro:   '0.625rem',
  label:   '0.6875rem',
  body:    '0.75rem',
  title:   '0.8125rem',
  section: '0.9375rem',
} as const

// Scala icone — 3 livelli invece di 6 valori sparsi (12/13/14/15/16/18px)
export const ICON = {
  inline: 14, // icone dentro badge/celle (copia IP, tipo asset, warning issue)
  action: 16, // controlli espandi/comprimi
  feature: 18, // icone di funzione autonome (nota, VPN, pin città)
} as const

// Stile condiviso per tutti i campi tecnici monospace (K#, Seriale, IP, codice
// cliente): un'unica fonte di verità così restano sempre identici tra loro.
export const monoFieldSx = {
  fontFamily: 'monospace',
  fontSize: FS.body,
  color: 'text.secondary',
  overflow: 'hidden' as const,
  textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
}

export function MonoField({ value, sx }: { value?: string | null; sx?: object }) {
  return (
    <Typography sx={{ ...monoFieldSx, ...sx }}>
      {value || '—'}
    </Typography>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeProvince(province?: string | null): string {
  const raw = (province ?? '').trim()
  if (!raw) return 'Senza provincia'
  // "BO" o "Bologna" (dati storici pre-tendina, o inseriti a mano) vengono
  // entrambi risolti allo stesso nome esteso "Bologna (BO)", così finiscono
  // nello stesso gruppo indipendentemente da come è stato salvato il valore.
  return formatProvinceLabel(raw)
}

export function normalizeCity(city?: string | null): string {
  return (city ?? 'Senza città').trim() || 'Senza città'
}

export function matchesSearch(q: string, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true
  const lq = q.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(lq))
}

export function matchesStatusFilter(filter: StatusFilter, statusLabel?: string | null): boolean {
  if (filter === 'all') return true
  const lbl = (statusLabel ?? '').toLowerCase()
  if (filter === 'attivo')       return lbl === 'attivo'
  if (filter === 'manutenzione') return lbl === 'manutenzione'
  if (filter === 'inattivo')     return lbl === 'inattivo'
  return true
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}
