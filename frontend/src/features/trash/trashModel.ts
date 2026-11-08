import { collectionActionPath, type CollectionPath } from '@shared/api/apiPaths'
import { PERMS } from '../../auth/perms'
import type { CampoIconName } from '../../ui/campo'

export type TrashKind = 'customers' | 'sites' | 'contacts' | 'inventory' | 'monitors' | 'maintenance-plans' | 'techs'

type Raw = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v).trim())
const join = (...parts: unknown[]) => parts.map(s).filter(Boolean).join(' · ')

export type TrashResource = {
  key: TrashKind
  /** Etichetta della scheda (plurale) e del tipo (singolare). */
  label: string
  one: string
  icon: CampoIconName
  endpoint: CollectionPath
  restoreEndpoint: string
  purgeEndpoint: string
  viewPerm: string
  restorePerm: string
  purgePerm: string
  title: (r: Raw) => string
  sub: (r: Raw) => string
}

const res = (r: Omit<TrashResource, 'restoreEndpoint' | 'purgeEndpoint'>): TrashResource => ({
  ...r,
  restoreEndpoint: collectionActionPath(r.endpoint, 'bulk_restore'),
  purgeEndpoint: collectionActionPath(r.endpoint, 'bulk_purge'),
})

export const TRASH_RESOURCES: TrashResource[] = [
  res({
    key: 'customers', label: 'Clienti', one: 'Cliente', icon: 'building', endpoint: '/customers/',
    viewPerm: PERMS.crm.customer.view, restorePerm: PERMS.crm.customer.change, purgePerm: PERMS.crm.customer.delete,
    title: (r) => s(r.display_name) || s(r.name) || 'Cliente',
    sub: (r) => join(r.code, r.city),
  }),
  res({
    key: 'sites', label: 'Siti', one: 'Sito', icon: 'pin', endpoint: '/sites/',
    viewPerm: PERMS.crm.site.view, restorePerm: PERMS.crm.site.change, purgePerm: PERMS.crm.site.delete,
    title: (r) => s(r.display_name) || s(r.name) || 'Sito',
    sub: (r) => join(r.customer_name || r.customer_code, r.city),
  }),
  res({
    key: 'contacts', label: 'Contatti', one: 'Contatto', icon: 'users', endpoint: '/contacts/',
    viewPerm: PERMS.crm.contact.view, restorePerm: PERMS.crm.contact.change, purgePerm: PERMS.crm.contact.delete,
    title: (r) => s(r.name) || s(r.email) || 'Contatto',
    sub: (r) => join(r.customer_name, r.site_display_name || r.site_name, r.department),
  }),
  res({
    key: 'inventory', label: 'Inventari', one: 'Inventario', icon: 'server', endpoint: '/inventories/',
    viewPerm: PERMS.inventory.inventory.view, restorePerm: PERMS.inventory.inventory.change, purgePerm: PERMS.inventory.inventory.delete,
    title: (r) => s(r.name) || s(r.hostname) || 'Inventario',
    sub: (r) => join(r.knumber || r.hostname, r.site_display_name || r.site_name || r.customer_name),
  }),
  res({
    key: 'monitors', label: 'Monitor', one: 'Monitor', icon: 'monitor', endpoint: '/monitors/',
    viewPerm: PERMS.inventory.monitor.view, restorePerm: PERMS.inventory.monitor.change, purgePerm: PERMS.inventory.monitor.delete,
    title: (r) => [s(r.produttore), s(r.modello)].filter(Boolean).join(' ') || 'Monitor',
    sub: (r) => join(r.seriale ? `S/N ${s(r.seriale)}` : '', r.inventory_name, r.site_name),
  }),
  res({
    key: 'maintenance-plans', label: 'Piani', one: 'Piano', icon: 'wrench', endpoint: '/maintenance-plans/',
    viewPerm: PERMS.maintenance.plan.view, restorePerm: PERMS.maintenance.plan.change, purgePerm: PERMS.maintenance.plan.delete,
    title: (r) => s(r.title) || 'Piano',
    sub: (r) => join(r.customer_name || r.customer_code),
  }),
  res({
    key: 'techs', label: 'Tecnici', one: 'Tecnico', icon: 'user', endpoint: '/techs/',
    viewPerm: PERMS.maintenance.tech.view, restorePerm: PERMS.maintenance.tech.change, purgePerm: PERMS.maintenance.tech.delete,
    title: (r) => s(r.full_name) || [s(r.first_name), s(r.last_name)].filter(Boolean).join(' ') || 'Tecnico',
    sub: (r) => join(r.email, r.phone),
  }),
]

export const resourceOf = (k: TrashKind) => TRASH_RESOURCES.find((r) => r.key === k)!

export type PurgeBlocker = { label: string; count: number }
export type TrashInfo = { restore_block: string | null; purge_block: PurgeBlocker[]; deleted_by: string | null }

export type TrashRow = {
  rid: string
  id: number
  kind: TrashKind
  title: string
  sub: string
  deleted_at: string | null
  info?: TrashInfo
}

export const toRow = (kind: TrashKind, raw: Raw): TrashRow | null => {
  const id = Number(raw.id)
  if (!Number.isFinite(id)) return null
  const r = resourceOf(kind)
  return { rid: `${kind}:${id}`, id, kind, title: r.title(raw), sub: r.sub(raw), deleted_at: typeof raw.deleted_at === 'string' ? raw.deleted_at : null }
}

/** "3 inventari attivi, 1 sito attivo" → testo del blocco dell'eliminazione definitiva. */
const SINGULAR: Record<string, string> = {
  siti: 'sito', contatti: 'contatto', inventari: 'inventario', 'piani manutenzione': 'piano di manutenzione',
  'rapportini manutenzione': 'rapportino di manutenzione', 'notifiche manutenzione': 'notifica di manutenzione',
}
const PLURAL: Record<string, string> = { 'piani manutenzione': 'piani di manutenzione', 'rapportini manutenzione': 'rapportini di manutenzione', 'notifiche manutenzione': 'notifiche di manutenzione' }
export const purgeBlockText = (b: PurgeBlocker[] | undefined) =>
  (b ?? []).filter((x) => x.count > 0).map((x) => `${x.count} ${x.count === 1 ? SINGULAR[x.label] ?? x.label : PLURAL[x.label] ?? x.label}`).join(', ')

export { agoLabel } from '../../utils/agoLabel'

/** Raggruppa per tipo gli id di righe "tipo:id". */
export function groupByKind(rows: { kind: TrashKind; id: number }[]): Partial<Record<TrashKind, number[]>> {
  const out: Partial<Record<TrashKind, number[]>> = {}
  rows.forEach((r) => { (out[r.kind] ??= []).push(r.id) })
  return out
}
