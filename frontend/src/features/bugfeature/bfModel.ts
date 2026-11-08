export type ReportKind = 'bug' | 'feature'
export type ReportStatus = 'open' | 'resolved' | 'rejected'

export type ReportRow = {
  id: number
  kind: ReportKind
  status: ReportStatus
  section: string
  section_label: string
  description: string
  screenshot_url?: string | null
  can_upload_screenshot?: boolean
  can_resolve?: boolean
  created_by?: number | null
  created_by_full_name?: string | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
  resolved_by_full_name?: string | null
  rejection_reason?: string | null
  rejected_at?: string | null
  rejected_by_full_name?: string | null
}

/** Sezioni dell'app (stesse chiavi del modello ReportRequest), in italiano. */
export const SECTIONS: { value: string; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'issues', label: 'Issue' },
  { value: 'maintenance', label: 'Manutenzione' },
  { value: 'customers', label: 'Clienti' },
  { value: 'sites', label: 'Siti' },
  { value: 'contacts', label: 'Contatti' },
  { value: 'inventory', label: 'Inventari' },
  { value: 'site_repository', label: 'Site Repository' },
  { value: 'wiki', label: 'Wiki' },
  { value: 'drive', label: 'Drive' },
  { value: 'search', label: 'Ricerca' },
  { value: 'audit', label: 'Audit' },
  { value: 'trash', label: 'Cestino' },
  { value: 'profile', label: 'Profilo' },
  { value: 'other', label: 'Altro' },
]
export const sectionLabel = (v: string, fallback?: string) => SECTIONS.find((s) => s.value === v)?.label ?? fallback ?? v

export const KIND_TONE: Record<ReportKind, { bg: string; fg: string }> = { bug: { bg: 'error.light', fg: 'error.main' }, feature: { bg: 'info.light', fg: 'info.main' } }
export const BOARD_TONES = { bug: KIND_TONE.bug, feature: KIND_TONE.feature, done: { bg: 'success.light', fg: 'success.main' } }

export const KIND_LABEL: Record<ReportKind, string> = { bug: 'Bug', feature: 'Funzionalità' }
export const STATUS_LABEL: Record<ReportStatus, string> = { open: 'Aperta', resolved: 'Risolta', rejected: 'Rifiutata' }

export const REJECT_REASONS = [
  'Funziona come previsto.',
  'Non riusciamo a riprodurlo: puoi aggiungere uno screenshot?',
  'Già segnalato.',
  'Non rientra nei piani per ora.',
]

/** Prima riga della descrizione: il titolo della scheda. */
export const firstLine = (t: string) => (t || '').split('\n').map((x) => x.trim()).find(Boolean) ?? '—'

export const initials = (n: string | null | undefined) =>
  (n || '').split(/\s+/).map((x) => x.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?'

/** Chi ha chiuso la segnalazione e quando. */
export const closedBy = (r: ReportRow) =>
  r.status === 'resolved' ? { by: r.resolved_by_full_name, at: r.resolved_at } : r.status === 'rejected' ? { by: r.rejected_by_full_name, at: r.rejected_at } : null

export const firstName = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0] || '—'

/** Aggiunge al testo un motivo pronto (separato da spazio). */
export const appendReason = (cur: string, q: string) => (cur.trim() ? `${cur.trim()} ${q}` : q)
