import * as React from 'react'

import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import LayersIcon from '@mui/icons-material/LayersOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined'
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import HandymanIcon from '@mui/icons-material/HandymanOutlined'
import FolderIcon from '@mui/icons-material/FolderOutlined'
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined'
import HistoryIcon from '@mui/icons-material/HistoryOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import MonitorIcon from '@mui/icons-material/MonitorOutlined'

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
      { label: 'Dashboard', path: '/', icon: <DashboardIcon />, match: (p) => p === '/' },
      { label: 'Issue', path: '/issues', icon: <ReportProblemOutlinedIcon />, perm: 'issues.view_issue', count: 'issues' },
      { label: 'Task di area', path: '/tasks', icon: <TaskAltOutlinedIcon />, count: 'tasks' },
      {
        label: 'Manutenzione', path: '/maintenance', icon: <HandymanIcon />,
        permAny: ['maintenance.view_maintenanceplan', 'maintenance.view_maintenanceevent'],
        match: (p) => p === '/maintenance',
        children: [
          { label: 'Piani', path: '/maintenance/plans', perm: 'maintenance.view_maintenanceplan' },
          { label: 'Rapportini', path: '/maintenance/rapportini', perm: 'maintenance.view_maintenanceevent' },
        ],
      },
      {
        label: 'ServiceNow', path: '/servicenow-cases', icon: <CloudSyncOutlinedIcon />, perm: 'servicenow.view_servicenowcase',
        children: [
          { label: 'Statistiche', path: '/servicenow-stats', perm: 'servicenow.view_servicenowcase' },
          { label: 'Assenze tecnici', path: '/servicenow-absences', perm: 'servicenow.view_servicenowcase' },
        ],
      },
    ],
  },
  {
    id: 'ana', label: 'Anagrafiche', items: [
      {
        label: 'Site Repository', path: '/site-repository', icon: <LayersIcon />,
        permAny: ['inventory.view_inventory', 'crm.view_customer', 'crm.view_site', 'crm.view_contact'],
      },
      { label: 'Clienti', path: '/customers', icon: <PeopleAltOutlinedIcon />, perm: 'crm.view_customer' },
      { label: 'Siti', path: '/sites', icon: <ApartmentOutlinedIcon />, perm: 'crm.view_site' },
      { label: 'Contatti', path: '/contacts', icon: <ContactsOutlinedIcon />, perm: 'crm.view_contact' },
      { label: 'Monitor', path: '/monitors', icon: <MonitorIcon />, perm: 'inventory.view_monitor' },
    ],
  },
  {
    id: 'kno', label: 'Conoscenza', items: [
      {
        label: 'Wiki', path: '/wiki', icon: <MenuBookIcon />, perm: 'wiki.view_wikipage',
        match: (p) => p === '/wiki' || /^\/wiki\/\d+/.test(p),
        children: [
          { label: 'Query', path: '/wiki/queries', perm: 'wiki.view_wikiquery' },
          { label: 'Statistiche', path: '/wiki/stats', perm: 'wiki.view_wikipage' },
        ],
      },
      { label: 'Drive', path: '/drive', icon: <FolderIcon />, permAny: ['drive.view_drivefolder', 'drive.view_drivefile'] },
    ],
  },
  {
    id: 'adm', label: 'Amministrazione', items: [
      { label: 'Contratti', path: '/contracts', icon: <GavelOutlinedIcon />, perm: 'contracts.view_contract' },
      { label: 'Purchase Order', path: '/purchase-orders', icon: <RequestQuoteOutlinedIcon />, perm: 'purchaseorders.view_purchaseorderentry' },
      { label: 'Rimborso spese', path: '/rimborso-spese', icon: <ReceiptLongOutlinedIcon /> },
      { label: 'Piano ferie', path: '/piano-ferie', icon: <BeachAccessOutlinedIcon /> },
    ],
  },
  {
    id: 'sys', label: 'Sistema', items: [
      { label: 'Audit', path: '/audit', icon: <HistoryIcon />, perm: 'audit.view_auditevent' },
      {
        label: 'Cestino', path: '/trash', icon: <DeleteOutlineIcon />,
        permAny: ['crm.view_customer', 'crm.view_site', 'crm.view_contact', 'inventory.view_inventory'],
      },
      {
        label: 'Bug e feature', path: '/bug-feature', icon: <FeedbackOutlinedIcon />, count: 'feedback',
        match: (p) => prefix('/bug-feature')(p) && !p.startsWith('/bug-feature/resolved'),
        children: [{ label: 'Risolte', path: '/bug-feature/resolved' }],
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
  ['/bug-feature/resolved', 'Bug e feature risolte'],
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
  ['/servicenow-stats', 'Statistiche ServiceNow'],
  ['/servicenow-absences', 'Assenze tecnici'],
  ['/servicenow-cases', 'ServiceNow'],
  ['/piano-ferie', 'Piano ferie'],
  ['/rimborso-spese', 'Rimborso spese'],
  ['/purchase-orders', 'Purchase Order'],
  ['/contracts', 'Contratti'],
  ['/bug-feature', 'Bug e feature'],
  ['/utenti', 'Utenti e gruppi'],
  ['/accesso-portal', 'Accesso Portal'],
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
