import type { CampoIconName } from '../../ui/campo'

// Registro Audit (restyle "Campo sterile", anteprima design-previews/au-base.html, variante A · Registro).

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'login_failed' | 'logout' | 'rate' | 'view_secret'

export type AuditEvent = {
  id: number
  created_at: string
  action: AuditAction
  actor: number | null
  actor_username?: string | null
  actor_name?: string | null
  actor_email?: string | null
  content_type_app?: string
  content_type_model?: string
  object_id?: string
  object_repr?: string
  subject?: string
  changes?: unknown
  entity_path?: string | null
  path?: string | null
  method?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata_summary?: Record<string, unknown> | null
}

export type AuditStats = {
  today: { total: number; changes: number }
  days: { date: string; count: number }[]
  failed_24h: { count: number; top: { username: string; ip: string | null; count: number } | null }
  deleted_7d: number
  top_modifiers_7d: { id: number; name: string; count: number }[]
  system_7d: number
}

export const AUTH_ACTIONS: AuditAction[] = ['login', 'logout', 'login_failed']
export const CHANGE_ACTIONS: AuditAction[] = ['create', 'update', 'delete', 'restore']

export const ACTION_META: Record<AuditAction, { label: string; tone: 'success' | 'info' | 'error' | 'neutral' }> = {
  create: { label: 'Creato', tone: 'success' },
  update: { label: 'Modificato', tone: 'info' },
  delete: { label: 'Eliminato', tone: 'error' },
  restore: { label: 'Ripristinato', tone: 'success' },
  login: { label: 'Accesso', tone: 'neutral' },
  logout: { label: 'Uscita', tone: 'neutral' },
  login_failed: { label: 'Accesso fallito', tone: 'error' },
  rate: { label: 'Valutato', tone: 'neutral' },
  view_secret: { label: 'Password letta', tone: 'info' },
}
export const actionMeta = (a: string) => ACTION_META[a as AuditAction] ?? { label: a || '—', tone: 'neutral' as const }

export type AuditView = 'all' | 'changes' | 'delete' | 'access' | 'failed'
export const VIEWS: { key: AuditView; label: string; params: Record<string, string>; alert?: boolean }[] = [
  { key: 'all', label: 'Tutto', params: {} },
  { key: 'changes', label: 'Modifiche', params: { actions: CHANGE_ACTIONS.join(',') } },
  { key: 'delete', label: 'Eliminazioni', params: { action: 'delete' } },
  { key: 'access', label: 'Accessi', params: { actions: AUTH_ACTIONS.join(',') } },
  { key: 'failed', label: 'Accessi falliti', params: { action: 'login_failed' }, alert: true },
]

export type Period = '0' | '7' | '30' | 'all'
export const PERIODS: { key: Period; label: string }[] = [
  { key: '0', label: 'Oggi' }, { key: '7', label: '7 giorni' }, { key: '30', label: '30 giorni' }, { key: 'all', label: 'Sempre' },
]
/** Inizio del periodo come ISO (null = nessun limite). "Oggi" parte dalla mezzanotte locale. */
export function periodStart(p: Period, now: Date = new Date()): string | null {
  if (p === 'all') return null
  if (p === '0') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  return new Date(now.getTime() - Number(p) * 864e5).toISOString()
}

/** Tipi di oggetto (app.model) con il nome italiano; [singolare con articolo per "Apri …", plurale]. */
export const ENTITY: Record<string, { label: string; open?: string }> = {
  'crm.customer': { label: 'Clienti', open: 'il cliente' },
  'crm.site': { label: 'Siti', open: 'il sito' },
  'crm.contact': { label: 'Contatti', open: 'il contatto' },
  'crm.customervpnaccess': { label: 'VPN cliente' },
  'inventory.inventory': { label: 'Inventari', open: "l'inventario" },
  'device.device': { label: 'Device' },
  'issues.issue': { label: 'Issue', open: 'la issue' },
  'core.areatask': { label: 'Task di area', open: 'il task' },
  'contracts.contract': { label: 'Contratti', open: 'il contratto' },
  'purchaseorders.purchaseorderentry': { label: 'Purchase order' },
  'maintenance.tech': { label: 'Tecnici' },
  'maintenance.maintenanceplan': { label: 'Piani di manutenzione', open: 'il piano' },
  'maintenance.maintenanceplaninventory': { label: 'Piani di manutenzione' },
  'maintenance.maintenancetemplate': { label: 'Template di manutenzione' },
  'maintenance.maintenanceevent': { label: 'Rapportini' },
  'maintenance.maintenancenotification': { label: 'Notifiche di manutenzione' },
  'attendance.absence': { label: 'Piano ferie' },
  'servicenow.servicenowcase': { label: 'Casi ServiceNow' },
  'expenses.expensereport': { label: 'Note spese', open: 'la nota spese' },
  'expenses.expenseitem': { label: 'Voci note spese' },
  'expenses.expensekmtrip': { label: 'Trasferte km' },
  'expenses.expensereceipt': { label: 'Scontrini' },
  'wiki.wikipage': { label: 'Pagine wiki', open: 'la pagina' },
  'wiki.wikicategory': { label: 'Categorie wiki' },
  'wiki.wikiattachment': { label: 'Allegati wiki' },
  'wiki.wikilink': { label: 'Link wiki' },
  'wiki.wikiquery': { label: 'Query' },
  'feedback.reportrequest': { label: 'Bug e feature' },
  'drive.drivefolder': { label: 'Cartelle drive', open: 'la cartella' },
  'drive.drivefile': { label: 'File drive', open: 'il file' },
  'custom_fields.customfielddefinition': { label: 'Campi personalizzati' },
  'auth.user': { label: 'Utenti' },
}
export const entityKey = (app?: string | null, model?: string | null) => (app && model ? `${app.toLowerCase()}.${model.toLowerCase()}` : '')
const humanize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s)

export function entityLabel(e: Pick<AuditEvent, 'content_type_app' | 'content_type_model' | 'action'>): string {
  if (AUTH_ACTIONS.includes(e.action)) return 'Accessi'
  const k = entityKey(e.content_type_app, e.content_type_model)
  if (!k) return 'Sistema'
  return ENTITY[k]?.label ?? humanize(e.content_type_model ?? k)
}

export const failedUsername = (e: Pick<AuditEvent, 'metadata_summary' | 'object_repr'>) => {
  const u = e.metadata_summary?.username
  return typeof u === 'string' && u ? u : e.object_repr || ''
}

/** Nome di chi ha agito: per gli accessi falliti il nome utente tentato, per gli eventi senza utente "Sistema". */
export function actorLabel(e: AuditEvent): { name: string; kind: 'user' | 'system' | 'unknown' } {
  if (e.action === 'login_failed') return { name: `«${failedUsername(e) || '?'}»`, kind: 'unknown' }
  if (e.actor == null) return { name: 'Sistema', kind: 'system' }
  return { name: e.actor_name || e.actor_username || `Utente #${e.actor}`, kind: 'user' }
}

export function objectTitle(e: AuditEvent): string {
  if (e.action === 'login') return `Accesso di ${e.actor_name || e.actor_username || e.object_repr || 'utente'}`
  if (e.action === 'logout') return `Uscita di ${e.actor_name || e.actor_username || e.object_repr || 'utente'}`
  if (e.action === 'login_failed') return `Accesso non riuscito per «${failedUsername(e) || '?'}»`
  const sub = (e.subject || '').includes(' | ') ? (e.subject || '').split(' | ').slice(1).join(' | ').trim() : e.subject
  return e.object_repr || sub || (e.object_id ? `#${e.object_id}` : '—')
}

// ── Modifiche ──────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  status: 'Stato', priority: 'Priorità', assignee: 'Assegnata a', assigned_to: 'Assegnata a', area: 'Area', title: 'Titolo', name: 'Nome', display_name: 'Nome visualizzato',
  description: 'Descrizione', notes: 'Note', note: 'Note', customer: 'Cliente', site: 'Sito', type: 'Tipo', category: 'Categoria',
  notice_days: 'Avviso di rinnovo (giorni)', reminder_days: 'Avviso di rinnovo (giorni)', billing_freq: 'Fatturazione', amount: 'Importo', total_value: 'Valore', start_date: 'Inizio', end_date: 'Fine',
  result: 'Esito', pdf_file: 'PDF', date: 'Data', date_from: 'Dal', date_to: 'Al', reason: 'Motivo', hostname: 'Hostname', ip: 'IP', email: 'Email',
  phone: 'Telefono', is_active: 'Attivo', groups: 'Gruppi', due_date_override: 'Scadenza modificata', next_due_date: 'Prossima scadenza',
  year: 'Anno', month: 'Mese', advances_total: 'Anticipi', rejection_reason: 'Motivo rifiuto', km: 'Km', destination: 'Destinazione',
  devices: 'Device', knumber: 'KNumber', serial_number: 'Numero di serie', file: 'File', folder: 'Cartella', deleted_at: 'Eliminato il',
}
export const fieldLabel = (k: string) => FIELD_LABELS[k] ?? humanize(k)
export const isSecretField = (k: string) => /password|secret|token|pwd|passphrase/i.test(k)

export type ChangeEntry = { field: string; from: unknown; to: unknown; hasFrom: boolean }
/** Normalizza le forme di `changes` viste nel registro: {from,to}, [prima, dopo] o un valore solo. */
export function changeEntries(changes: unknown): ChangeEntry[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return []
  return Object.entries(changes as Record<string, unknown>).map(([field, c]) => {
    if (c && typeof c === 'object' && !Array.isArray(c) && ('from' in c || 'to' in c)) {
      const o = c as { from?: unknown; to?: unknown }
      return { field, from: o.from, to: o.to, hasFrom: true }
    }
    if (Array.isArray(c) && c.length === 2) return { field, from: c[0], to: c[1], hasFrom: true }
    return { field, from: undefined, to: c, hasFrom: false }
  })
}

export function fmtValue(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v ? 'Sì' : 'No'
  if (Array.isArray(v)) return v.length ? v.map((x) => fmtValue(x) ?? '—').join(', ') : null
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  if (/\.None$/.test(s)) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toLocaleDateString('it-IT')
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s))) return new Date(s).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
  return s
}

// ── Date e browser ─────────────────────────────────────────────────────────

export const dateCell = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
export const timeCell = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
export const fullDate = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5)
  const t = timeCell(iso)
  return days === 0 ? `oggi ${t}` : days === 1 ? `ieri ${t}` : `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${t}`
}

/** "Edge su Windows", "Safari su iPhone"… (solo per leggere, l'originale resta nei dettagli tecnici). */
export function browserOf(ua?: string | null): string | null {
  if (!ua) return null
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? (/HeadlessChrome/.test(ua) ? 'Chrome (automatico)' : 'Chrome') : /Safari\//.test(ua) ? 'Safari' : /curl|python|okhttp|axios/i.test(ua) ? 'Script' : null
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  if (!b && !os) return null
  return [b ?? 'Browser', os].filter(Boolean).join(' su ')
}

/** Indirizzo della rete interna (privato) o esterno. */
export const isPrivateIp = (ip?: string | null) => Boolean(ip && /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd)/i.test(ip))

// ── Icone per tipo ─────────────────────────────────────────────────────────

const ICONS: Record<string, CampoIconName> = {
  issues: 'alert', crm: 'building', inventory: 'server', device: 'monitor', contracts: 'file', maintenance: 'wrench', attendance: 'calendar',
  servicenow: 'cloud', expenses: 'receipt', wiki: 'book', drive: 'folder', purchaseorders: 'bag', core: 'task', auth: 'user', feedback: 'chat',
}
const SITE_ICON: Record<string, CampoIconName> = { 'crm.site': 'pin', 'crm.contact': 'users' }

export function entityIcon(ev: AuditEvent): CampoIconName {
  if (AUTH_ACTIONS.includes(ev.action)) return ev.action === 'login_failed' ? 'lock' : 'key'
  const k = entityKey(ev.content_type_app, ev.content_type_model)
  return SITE_ICON[k] ?? ICONS[(ev.content_type_app || '').toLowerCase()] ?? 'history'
}

