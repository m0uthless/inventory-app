/**
 * Tipi per il pannello "Utenti e Gruppi" (core.manage_users).
 * Rispecchiano core/admin_users_api.py e core/permission_modules.py.
 */

export type ModuleRwd = {
  r: boolean
  w: boolean
  d: boolean
}

export type PermissionState = {
  modules: Record<string, ModuleRwd>
  extra_permissions: string[] // es. "core.access_archie"
}

export type ExtraPermissionDef = {
  id: number
  codename: string // es. "core.access_archie"
  name: string // etichetta Django (spesso in inglese)
}

export type PermissionModule = {
  app_label: string
  label: string // etichetta italiana leggibile
  extra_permissions: ExtraPermissionDef[]
  is_auslbo_dedicated: boolean // true per auslbo/device/vlan (esclusivi del portal AUSL BO)
}

export type AdminGroupRow = {
  id: number
  name: string
  user_count: number
  permissions_state: PermissionState
}

export type AdminUserProfile = {
  avatar: string | null
  is_philips: boolean
  is_servicenow_technician: boolean
  is_functional_account: boolean
  is_leave_coordinator: boolean
  leave_area: number | null
  leave_area_name: string | null
  is_expense_secretary: boolean
  birth_date: string | null
  gender: 'M' | 'F' | null
}

export type AdminUserGroupRef = { id: number; name: string }

export type AuslboProfileRef = { customer_id: number; customer_name: string }

export type AdminUserRow = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  groups: AdminUserGroupRef[]
  group_permissions: PermissionState
  direct_permissions: PermissionState
  has_auslbo_access: boolean
  auslbo_profile: AuslboProfileRef | null
  profile: AdminUserProfile
}

/** Livello del menu a tendina permessi/accesso AUSL BO. */
export type RwdLevel = 'none' | 'read' | 'read_write' | 'full'

export type AuslboAccessPayload = { level: RwdLevel; customer_id: number | null }

export type AdminUserWritePayload = Partial<{
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  group_ids: number[]
  module_permissions: Record<string, ModuleRwd>
  extra_permission_ids: number[]
  auslbo_access: AuslboAccessPayload
  profile: Partial<{
    is_philips: boolean
    is_servicenow_technician: boolean
    is_functional_account: boolean
    is_leave_coordinator: boolean
    leave_area: number | null
    is_expense_secretary: boolean
    birth_date: string | null
    gender: 'M' | 'F' | null
  }>
}>

export type AdminGroupWritePayload = Partial<{
  name: string
  module_permissions: Record<string, ModuleRwd>
  extra_permission_ids: number[]
}>

export type AdminUserCreatePayload = {
  username: string
  password?: string
  first_name?: string
  last_name?: string
  email?: string
  is_active?: boolean
  group_ids?: number[]
}

/** Risposta di POST /admin-users/: la riga utente creata, più la password
 * generata automaticamente se non ne è stata specificata una (mostrata una
 * sola volta, come per reset-password). */
export type AdminUserCreateResponse = AdminUserRow & { generated_password: string | null }

export type AdminGroupCreatePayload = { name: string }

export type ResetPasswordResponse = {
  password: string
  email_sent: boolean
  email_error: string | null
}

/** Le 3 azioni logiche mostrate come colonne nella matrice permessi. */
export const RWD_ACTIONS: { key: keyof ModuleRwd; label: string; help: string }[] = [
  {
    key: 'r',
    label: 'R',
    help: 'Lettura — vedere elenco e dettaglio dei record del modulo.',
  },
  {
    key: 'w',
    label: 'W',
    help: 'Scrittura — creare e modificare record, incluso il ripristino dal cestino.',
  },
  {
    key: 'd',
    label: 'D',
    help: 'Eliminazione — spostare nel cestino ed eliminare in modo definitivo (purge).',
  },
]

export const EMPTY_RWD: ModuleRwd = { r: false, w: false, d: false }

/** Le 4 opzioni del menu a tendina permessi (sostituisce le caselle R/W/D). */
export const RWD_LEVEL_OPTIONS: { key: RwdLevel; label: string }[] = [
  { key: 'none', label: 'Nessuno' },
  { key: 'read', label: 'Lettura' },
  { key: 'read_write', label: 'Lettura e Scrittura' },
  { key: 'full', label: 'Lettura, Scrittura ed Eliminazione' },
]

const RWD_LEVEL_ORDER: RwdLevel[] = ['none', 'read', 'read_write', 'full']

export const LEVEL_TO_RWD: Record<RwdLevel, ModuleRwd> = {
  none: { r: false, w: false, d: false },
  read: { r: true, w: false, d: false },
  read_write: { r: true, w: true, d: false },
  full: { r: true, w: true, d: true },
}

/** Converte una combinazione r/w/d nel livello più alto implicato (best-effort:
 * "sana" eventuali dati storici non canonici, es. w=true senza r=true). */
export function rwdToLevel(rwd: ModuleRwd | undefined): RwdLevel {
  if (!rwd) return 'none'
  if (rwd.d) return 'full'
  if (rwd.w) return 'read_write'
  if (rwd.r) return 'read'
  return 'none'
}

export function rwdLevelIndex(level: RwdLevel): number {
  return RWD_LEVEL_ORDER.indexOf(level)
}
