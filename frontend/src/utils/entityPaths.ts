import { buildQuery } from './nav'

export type SearchResultPathInput = {
  kind: string
  id: number
  path?: string | null
}

export type AuditEntityPathInput = {
  entity_path?: string | null
  content_type_app?: string | null
  content_type_model?: string | null
  object_id?: string | number | null
}

function withQuery(basePath: string, params?: Record<string, unknown>) {
  return `${basePath}${buildQuery(params ?? {})}`
}

export function customersPath(params?: Record<string, unknown>) {
  return withQuery('/customers', params)
}

export function sitesPath(params?: Record<string, unknown>) {
  return withQuery('/sites', params)
}

export function contactsPath(params?: Record<string, unknown>) {
  return withQuery('/contacts', params)
}

export function inventoryPath(params?: Record<string, unknown>) {
  return withQuery('/inventory', params)
}

export function customerDrawerPath(open: number | string, params?: Record<string, unknown>) {
  return customersPath({ open, ...(params ?? {}) })
}

export function siteDrawerPath(open: number | string, params?: Record<string, unknown>) {
  return sitesPath({ open, ...(params ?? {}) })
}

export function contactDrawerPath(open: number | string, params?: Record<string, unknown>) {
  return contactsPath({ open, ...(params ?? {}) })
}

export function inventoryDrawerPath(open: number | string, params?: Record<string, unknown>) {
  return inventoryPath({ open, ...(params ?? {}) })
}

export function issuesPath(params?: Record<string, unknown>) {
  return withQuery('/issues', params)
}

export function maintenanceTabPath(
  tab: 'plans' | 'events' | 'notifications' | 'techs',
  params?: Record<string, unknown>,
) {
  return withQuery('/maintenance', { tab, ...(params ?? {}) })
}

export function wikiPagePath(id: number | string) {
  return `/wiki/${id}`
}

export function drivePath() {
  return '/drive'
}

export function resolveAuditEntityPath(ev: AuditEntityPathInput): string | null {
  if (ev.entity_path) return ev.entity_path

  const app = String(ev.content_type_app || '').toLowerCase()
  const model = String(ev.content_type_model || '').toLowerCase()
  const rawId = ev.object_id
  const oid = typeof rawId === 'number' ? rawId : Number(rawId)
  if (!Number.isFinite(oid)) return null

  if (app === 'crm' && model === 'customer') return customerDrawerPath(oid)
  if (app === 'crm' && model === 'site') return siteDrawerPath(oid)
  if (app === 'crm' && model === 'contact') return contactDrawerPath(oid)
  if (app === 'inventory' && model === 'inventory') return inventoryDrawerPath(oid)
  if (app === 'maintenance' && model === 'maintenanceplan') {
    return maintenanceTabPath('plans', { open: oid })
  }
  if (app === 'maintenance' && model === 'maintenanceevent') {
    return maintenanceTabPath('events', { open: oid })
  }
  if (app === 'maintenance' && model === 'maintenancenotification') {
    return maintenanceTabPath('notifications', { open: oid })
  }
  if (app === 'maintenance' && model === 'tech') return maintenanceTabPath('techs', { open: oid })
  if (app === 'issues' && model === 'issue') return issuesPath({ open: oid })
  if (app === 'wiki' && model === 'wikipage') return wikiPagePath(oid)
  if (app === 'drive' && (model === 'drivefolder' || model === 'drivefile')) return drivePath()
  return null
}

export function resolveSearchResultPath(
  result: SearchResultPathInput,
  options?: { search?: string; returnTo?: string },
): string | null {
  if (result.path) return result.path

  const search = options?.search ?? ''
  const returnTo = options?.returnTo ?? ''

  if (result.kind === 'inventory') {
    return inventoryDrawerPath(result.id, { search, return: returnTo })
  }
  if (result.kind === 'customer') {
    return customerDrawerPath(result.id, { search, return: returnTo })
  }
  if (result.kind === 'site') {
    return siteDrawerPath(result.id, { search, return: returnTo })
  }
  if (result.kind === 'contact') {
    return contactDrawerPath(result.id, { search, return: returnTo })
  }
  if (result.kind === 'maintenance_plan') {
    return maintenanceTabPath('plans', { open: result.id, return: returnTo })
  }
  if (result.kind === 'wiki_page') return wikiPagePath(result.id)
  if (result.kind === 'drive_folder' || result.kind === 'drive_file') return drivePath()
  return null
}
