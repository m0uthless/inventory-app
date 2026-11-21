import * as React from 'react'

import { CampoIcon } from '../ui/campo/CampoIcon'

/**
 * Navigazione del restyle "Campo sterile" (frontend/DESIGN.md › Navigation).
 *
 * Voci raggruppate per lavoro (Operatività, Anagrafiche, Conoscenza,
 * Amministrazione, Sistema). Le sottopagine di un modulo compaiono sotto la
 * voce solo quando il modulo è aperto (niente gruppi da espandere a mano);
 * con la sidebar compressa sono raggiungibili dal menu a comparsa.
 * I permessi sono gli stessi della navigazione precedente.
 */

export type CountKey = 'issues' | 'tasks' | 'feedback'

export type NavLeaf = {
  label: string
  path: string
  perm?: string
  permAny?: string[]
  /** Regola di selezione; predefinita: la rotta inizia con `path`. */
  match?: (pathname: string) => boolean
}

export type NavEntry = NavLeaf & {
  icon: React.ReactNode
  count?: CountKey
  /** Sottopagine del modulo (la voce stessa resta la pagina principale). */
  children?: NavLeaf[]
}

export type NavGroup = { id: string; label: string; items: NavEntry[] }

const prefix = (p: string) => (pathname: string) => pathname === p || pathname.startsWith(p + '/')

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'op', label: 'Operatività', items: [
      { label: 'Dashboard', path: '/', icon: <CampoIcon name="dashboard" />, match: (p) => p === '/' },
      { label: 'Issue', path: '/issues', icon: <CampoIcon name="alert" />, perm: 'issues.view_issue', count: 'issues' },
      { label: 'Task di area', path: '/tasks', icon: <CampoIcon name="task" />, count: 'tasks' },
      {
        label: 'Manutenzione', path: '/maintenance', icon: <CampoIcon name="wrench" />,
        permAny: ['maintenance.view_maintenanceplan', 'maintenance.view_maintenanceevent'],
        match: (p) => p === '/maintenance',
        children: [
          { label: 'Piani', path: '/maintenance/plans', perm: 'maintenance.view_maintenanceplan' },
          { label: 'Rapportini', path: '/maintenance/rapportini', perm: 'maintenance.view_maintenanceevent' },
        ],
      },
      {
        label: 'ServiceNow', path: '/servicenow-cases', icon: <CampoIcon name="cloud" />, perm: 'servicenow.view_servicenowcase',
        children: [
          { label: 'Dashboard casi', path: '/servicenow-dashboard', perm: 'servicenow.view_servicenowcase' },
        ],
      },
    ],
  },
  {
    id: 'ana', label: 'Anagrafiche', items: [
      {
        label: 'Site Repository', path: '/site-repository', icon: <CampoIcon name="layers" />,
        permAny: ['inventory.view_inventory', 'crm.view_customer', 'crm.view_site', 'crm.view_contact'],
      },
      { label: 'Clienti', path: '/customers', icon: <CampoIcon name="building" />, perm: 'crm.view_customer' },
      { label: 'Siti', path: '/sites', icon: <CampoIcon name="pin" />, perm: 'crm.view_site' },
      { label: 'Contatti', path: '/contacts', icon: <CampoIcon name="users" />, perm: 'crm.view_contact' },
      { label: 'Monitor', path: '/monitors', icon: <CampoIcon name="monitor" />, perm: 'inventory.view_monitor' },
    ],
  },
  {
    id: 'kno', label: 'Conoscenza', items: [
      {
        label: 'Wiki', path: '/wiki', icon: <CampoIcon name="book" />, perm: 'wiki.view_wikipage',
        match: (p) => p === '/wiki' || /^\/wiki\/\d+/.test(p),
        children: [
          { label: 'Query', path: '/wiki/queries', perm: 'wiki.view_wikiquery' },
          { label: 'Statistiche', path: '/wiki/stats', perm: 'wiki.view_wikipage' },
        ],
      },
      { label: 'Drive', path: '/drive', icon: <CampoIcon name="folder" />, permAny: ['drive.view_drivefolder', 'drive.view_drivefile'] },
      { label: 'Generatore SQL', path: '/knowledge/sql', icon: <CampoIcon name="chat" />, perm: 'text2sql.use_text2sql' },
    ],
  },
  {
    id: 'adm', label: 'Amministrazione', items: [
      { label: 'Contratti', path: '/contracts', icon: <CampoIcon name="file" />, perm: 'contracts.view_contract' },
      { label: 'Purchase Order', path: '/purchase-orders', icon: <CampoIcon name="bag" />, perm: 'purchaseorders.view_purchaseorderentry' },
      { label: 'Rimborso spese', path: '/rimborso-spese', icon: <CampoIcon name="receipt" />, perm: 'expenses.view_expensereport' },
      { label: 'Piano ferie', path: '/piano-ferie', icon: <CampoIcon name="calendar" /> },
    ],
  },
  {
    id: 'sys', label: 'Sistema', items: [
      { label: 'Audit', path: '/audit', icon: <CampoIcon name="history" />, perm: 'audit.view_auditevent' },
      {
        label: 'Cestino', path: '/trash', icon: <CampoIcon name="trash" />,
        permAny: ['crm.view_customer', 'crm.view_site', 'crm.view_contact', 'inventory.view_inventory'],
      },
      {
        label: 'Bug e feature', path: '/bug-feature', icon: <CampoIcon name="message" />, count: 'feedback', perm: 'feedback.view_reportrequest',
        match: (p) => prefix('/bug-feature')(p) && !p.startsWith('/bug-feature/resolved'),
        children: [{ label: 'Chiuse', path: '/bug-feature/resolved' }],
      },
    ],
  },
]

export function leafMatches(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.match) return leaf.match(pathname)
  if (leaf.path === '/') return pathname === '/'
  return prefix(leaf.path)(pathname)
}

/** Il modulo è aperto se è selezionata la voce o una delle sue sottopagine. */
export function entryActive(entry: NavEntry, pathname: string): boolean {
  return leafMatches(entry, pathname) || (entry.children ?? []).some((c) => leafMatches(c, pathname))
}

// Titoli di pagina (sentence case) per le pagine che non hanno ancora una
// testata propria. Ordine: prefisso più specifico prima.
const ROUTE_TITLES: Array<[prefix: string, title: string]> = [
  ['/bug-feature/resolved', 'Segnalazioni chiuse'],
  ['/maintenance/plans', 'Piani di manutenzione'],
  ['/maintenance/rapportini', 'Rapportini'],
  ['/wiki/stats', 'Statistiche Wiki'],
  ['/wiki/queries', 'Query'],
  ['/wiki', 'Wiki'],
  ['/site-repository', 'Site Repository'],
  ['/customers', 'Clienti'],
  ['/sites', 'Siti'],
  ['/contacts', 'Contatti'],
  ['/inventory', 'Inventari'],
  ['/monitors', 'Monitor'],
  ['/maintenance', 'Manutenzione'],
  ['/issues', 'Issue'],
  ['/tasks', 'Task di area'],
  ['/servicenow-dashboard', 'Dashboard casi'],
  ['/servicenow-cases', 'ServiceNow'],
  ['/piano-ferie', 'Piano ferie'],
  ['/rimborso-spese', 'Rimborso spese'],
  ['/purchase-orders', 'Purchase Order'],
  ['/contracts', 'Contratti'],
  ['/bug-feature', 'Bug e feature'],
  ['/utenti', 'Utenti e gruppi'],
  ['/accesso-portal', 'Accesso Portal'],
  ['/moduli', 'Moduli'],
  ['/impostazioni', 'Impostazioni'],
  ['/audit', 'Audit'],
  ['/drive', 'Drive'],
  ['/trash', 'Cestino'],
  ['/search', 'Ricerca'],
  ['/profile', 'Profilo'],
  ['/', 'Dashboard'],
]

export function getPageTitle(pathname: string): string {
  return ROUTE_TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'))?.[1] ?? ''
}
