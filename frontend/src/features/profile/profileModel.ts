/** Etichette dei moduli (app Django) in italiano, come nel pannello Utenti e gruppi. */
export const MODULE_LABEL: Record<string, string> = {
  crm: 'Clienti, siti e contatti',
  inventory: 'Inventari e monitor',
  issues: 'Issue',
  maintenance: 'Manutenzione',
  wiki: 'Wiki',
  drive: 'Drive',
  contracts: 'Contratti',
  purchaseorders: 'Purchase Order',
  expenses: 'Rimborso spese',
  attendance: 'Piano ferie',
  servicenow: 'ServiceNow',
  feedback: 'Bug e feature',
  audit: 'Audit',
  core: 'Sistema',
  custom_fields: 'Campi personalizzati',
  portal: 'Portal',
  device: 'Device',
  vlan: 'VLAN e rete',
}
export const MODULE_ORDER = Object.keys(MODULE_LABEL)

export type ModuleAccess = { app: string; label: string; r: boolean; w: boolean; d: boolean; extra: string[] }

/**
 * Riassume i permessi Django ("app.codename") per modulo: lettura (view), scrittura (add/change),
 * eliminazione (delete); il resto sono permessi speciali (es. view_secrets).
 */
export function summarizePermissions(perms: string[]): ModuleAccess[] {
  const by = new Map<string, ModuleAccess>()
  perms.forEach((p) => {
    const [app, code] = p.split('.', 2)
    if (!app || !code || !(app in MODULE_LABEL)) return
    const m = by.get(app) ?? { app, label: MODULE_LABEL[app], r: false, w: false, d: false, extra: [] }
    // i permessi sulle password (view_secrets, view_vpn_secrets…) sono speciali, non semplice lettura
    if (/secret/.test(code)) m.extra.push(code)
    else if (code.startsWith('view_')) m.r = true
    else if (code.startsWith('add_') || code.startsWith('change_')) m.w = true
    else if (code.startsWith('delete_')) m.d = true
    else m.extra.push(code)
    by.set(app, m)
  })
  return MODULE_ORDER.filter((k) => by.has(k)).map((k) => by.get(k)!)
}

/** Robustezza indicativa della password: 0–4. */
export function passwordScore(pw: string): number {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s)
}
export const SCORE_LABEL = ['', 'Debole', 'Discreta', 'Buona', 'Ottima']

/** "Chrome su Windows" dallo user agent. */
export function deviceLabel(ua: string): string {
  const b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const o = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  return o ? `${b} su ${o}` : b
}

export const fullName = (m: { first_name?: string; last_name?: string; username: string }) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username
export const initialsOf = (m: { first_name?: string; last_name?: string; username: string }) =>
  ((m.first_name?.[0] || '') + (m.last_name?.[0] || '')).toUpperCase() || m.username?.[0]?.toUpperCase() || 'U'

export const monthYear = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : '—')
