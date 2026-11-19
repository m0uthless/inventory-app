import type { AdminGroupRow, AdminUserRow, ModuleRwd, PermissionModule, RwdLevel } from '../../types/adminUsers'
import { rwdLevelIndex, rwdToLevel } from '../../types/adminUsers'
import { MODULE_LABEL } from '../profile/profileModel'

export type LeaveAreaOption = { id: number; label: string }

export const fullName = (u: { first_name?: string; last_name?: string; username: string }) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
export const initials = (u: { first_name?: string; last_name?: string; username: string }) =>
  ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?'

/** Stesso criterio del backend (portal/permissions.py::_can_access_archie). */
export function hasArchieAccess(u: AdminUserRow): boolean {
  if (u.is_superuser) return true
  const c = 'core.access_archie'
  return u.group_permissions.extra_permissions.includes(c) || u.direct_permissions.extra_permissions.includes(c)
}

export const isPortalOnly = (u: AdminUserRow) => u.has_portal_access && !hasArchieAccess(u)

export type UserView = 'active' | 'portal' | 'functional' | 'off' | 'all'
export const USER_VIEWS: { key: UserView; label: string; match: (u: AdminUserRow) => boolean }[] = [
  { key: 'active', label: 'Attivi', match: (u) => u.is_active && !isPortalOnly(u) && !u.profile.is_functional_account },
  { key: 'portal', label: 'Solo Portal', match: (u) => u.is_active && isPortalOnly(u) },
  { key: 'functional', label: 'Account funzionali', match: (u) => u.is_active && u.profile.is_functional_account },
  { key: 'off', label: 'Disattivati', match: (u) => !u.is_active },
  { key: 'all', label: 'Tutti', match: () => true },
]

export type RoleTag = { label: string; tint: 'sand' | 'sky' | 'lilac' | 'mint' | 'neutral' }
/** Ruoli e configurazioni da mostrare come etichette. */
export function roleTags(u: AdminUserRow): RoleTag[] {
  const t: RoleTag[] = []
  if (u.is_superuser) t.push({ label: 'Superuser', tint: 'sand' })
  if (u.profile.is_philips) t.push({ label: 'Philips', tint: 'lilac' })
  if (u.profile.is_leave_coordinator) t.push({ label: 'Coordinatore ferie', tint: 'sand' })
  if (u.profile.is_expense_secretary) t.push({ label: 'Segreteria spese', tint: 'mint' })
  if (u.profile.is_functional_account) t.push({ label: 'Account funzionale', tint: 'neutral' })
  return t
}

export const LEVEL_LABEL: Record<RwdLevel, string> = { none: 'Nessuno', read: 'Lettura', read_write: 'Scrittura', full: 'Completo' }
export const LEVELS: RwdLevel[] = ['none', 'read', 'read_write', 'full']
export const maxLevel = (a: RwdLevel, b: RwdLevel): RwdLevel => (rwdLevelIndex(a) >= rwdLevelIndex(b) ? a : b)

/**
 * Da dove arriva il livello di un modulo per un utente: i gruppi che lo concedono
 * (al livello più alto) oppure un'assegnazione diretta più alta di quella dei gruppi.
 */
export function levelSource(u: AdminUserRow, groups: AdminGroupRow[], app: string, direct: Record<string, ModuleRwd>): { level: RwdLevel; floor: RwdLevel; from: string } {
  if (u.is_superuser) return { level: 'full', floor: 'full', from: 'superuser' }
  const floor = rwdToLevel(u.group_permissions.modules[app])
  const own = rwdToLevel(direct[app])
  const level = maxLevel(floor, own)
  if (level === 'none') return { level, floor, from: '' }
  if (rwdLevelIndex(own) > rwdLevelIndex(floor)) return { level, floor, from: 'assegnato a mano' }
  const names = groups.filter((g) => u.groups.some((x) => x.id === g.id) && rwdToLevel(g.permissions_state.modules[app]) === floor).map((g) => g.name)
  return { level, floor, from: names.length ? `gruppo ${names.join(', ')}` : 'gruppo' }
}

/** Etichette dei moduli in italiano (le stesse del Profilo), con ripiego su quelle del backend. */
const relabel = (m: PermissionModule[]) => m.map((x) => ({ ...x, label: MODULE_LABEL[x.app_label] ?? x.label }))
export const archieModules = (m: PermissionModule[]) => relabel(m.filter((x) => !x.is_portal_dedicated))
/** "portal" è il controllo d'accesso al Portal, mostrato a parte. */
export const portalModules = (m: PermissionModule[]) => relabel(m.filter((x) => x.is_portal_dedicated && x.app_label !== 'portal'))

/** Quanti moduli Archie un gruppo apre (per la scheda del gruppo). */
export const openModules = (g: AdminGroupRow, mods: PermissionModule[]) => archieModules(mods).filter((m) => rwdToLevel(g.permissions_state.modules[m.app_label]) !== 'none').length


/** Ricerca locale su nome, username ed email. */
export const matchUser = (u: AdminUserRow, q: string) => {
  const n = q.trim().toLowerCase()
  if (!n) return true
  return [u.username, u.first_name, u.last_name, u.email, fullName(u)].some((x) => (x || '').toLowerCase().includes(n))
}
