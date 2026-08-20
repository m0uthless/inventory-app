import * as React from 'react'

import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import LayersIcon from '@mui/icons-material/Layers'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined'
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined'
import HandymanIcon from '@mui/icons-material/HandymanOutlined'
import FolderIcon from '@mui/icons-material/FolderOutlined'
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined'
import HistoryIcon from '@mui/icons-material/HistoryOutlined'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import ContactsRoundedIcon from '@mui/icons-material/ContactsRounded'
import MonitorIcon from '@mui/icons-material/MonitorOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import TerminalIcon from '@mui/icons-material/TerminalOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import DoneAllIcon from '@mui/icons-material/DoneAllOutlined'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavItem = {
  label: string
  path: string
  icon: React.ReactNode
  perm?: string
  permAny?: string[]
  /** Sezione di appartenenza nella sidebar — usata per i label di gruppo */
  section?: 'principale' | 'strumenti' | 'sistema'
  /** Mostra un badge "WIP" accanto al label */
  wip?: boolean
}

// ─── Nav data ─────────────────────────────────────────────────────────────────

export const SITE_REPOSITORY_CHILDREN: NavItem[] = [
  { label: 'Clienti', path: '/customers', icon: <PeopleAltRoundedIcon />, perm: 'crm.view_customer' },
  { label: 'Siti', path: '/sites', icon: <ApartmentRoundedIcon />, perm: 'crm.view_site' },
  { label: 'Contatti', path: '/contacts', icon: <ContactsRoundedIcon />, perm: 'crm.view_contact' },
  { label: 'Monitor', path: '/monitors', icon: <MonitorIcon />, perm: 'inventory.view_monitor' },
]

export const MAINTENANCE_CHILDREN: NavItem[] = [
  { label: 'Scadenze', path: '/maintenance', icon: <HandymanIcon />, permAny: ['maintenance.view_maintenanceplan'] },
  { label: 'Piani', path: '/maintenance/plans', icon: <BuildOutlinedIcon />, perm: 'maintenance.view_maintenanceplan' },
  { label: 'Rapportini', path: '/maintenance/rapportini', icon: <CheckCircleOutlineIcon />, perm: 'maintenance.view_maintenanceevent' },
]

export const WIKI_CHILDREN: NavItem[] = [
  { label: 'Wiki', path: '/wiki', icon: <MenuBookIcon />, perm: 'wiki.view_wikipage' },
  { label: 'Query', path: '/wiki/queries', icon: <TerminalIcon />, perm: 'wiki.view_wikiquery' },
  { label: 'Statistiche', path: '/wiki/stats', icon: <BarChartOutlinedIcon />, perm: 'wiki.view_wikipage' },
]

export const BUG_FEATURE_CHILDREN: NavItem[] = [
  { label: 'Aperte', path: '/bug-feature', icon: <FeedbackOutlinedIcon /> },
  { label: 'Risolte', path: '/bug-feature/resolved', icon: <DoneAllIcon /> },
]

export const SERVICENOW_CHILDREN: NavItem[] = [
  { label: 'SNow Statistiche', path: '/servicenow-stats', icon: <BarChartOutlinedIcon />, perm: 'servicenow.view_servicenowcase' },
  { label: 'Assenze tecnici', path: '/servicenow-absences', icon: <EventBusyOutlinedIcon />, perm: 'servicenow.view_servicenowcase' },
]

export const NAV: NavItem[] = [
  // ── Principale ──────────────────────────────────────────────────────────────
  { label: 'Dashboard', path: '/', icon: <DashboardIcon />, section: 'principale' },

  {
    label: 'Site Repository',
    path: '/site-repository',
    icon: <LayersIcon />,
    section: 'principale',
    permAny: ['inventory.view_inventory', 'crm.view_customer', 'crm.view_site', 'crm.view_contact'],
  },

  { label: 'Issues', path: '/issues', icon: <BugReportOutlinedIcon />, section: 'principale', perm: 'issues.view_issue' },

  { label: 'ServiceNow', path: '/servicenow-cases', icon: <CloudSyncOutlinedIcon />, section: 'principale', perm: 'servicenow.view_servicenowcase' },

  { label: 'Piano Ferie', path: '/piano-ferie', icon: <BeachAccessOutlinedIcon />, section: 'principale' },

  { label: 'Rimborso Spese', path: '/rimborso-spese', icon: <ReceiptLongOutlinedIcon />, section: 'principale' },

  { label: 'Purchase Order', path: '/purchase-orders', icon: <RequestQuoteOutlinedIcon />, section: 'principale', perm: 'purchaseorders.view_purchaseorderentry' },

  {
    label: 'Manutenzione',
    path: '/maintenance',
    icon: <HandymanIcon />,
    section: 'principale',
    permAny: [
      'maintenance.view_maintenanceplan',
      'maintenance.view_maintenanceevent',
    ],
  },

  // ── Strumenti ────────────────────────────────────────────────────────────────
  {
    label: 'Drive',
    path: '/drive',
    icon: <FolderIcon />,
    section: 'strumenti',
    permAny: ['drive.view_drivefolder', 'drive.view_drivefile'],
  },
  { label: 'Knowledge', path: '/wiki', icon: <MenuBookIcon />, section: 'strumenti', perm: 'wiki.view_wikipage' },

  // ── Sistema ──────────────────────────────────────────────────────────────────
  { label: 'Audit', path: '/audit', icon: <HistoryIcon />, section: 'sistema', perm: 'audit.view_auditevent' },

  {
    label: 'Cestino',
    path: '/trash',
    icon: <DeleteSweepIcon />,
    section: 'sistema',
    permAny: ['crm.view_customer', 'crm.view_site', 'crm.view_contact', 'inventory.view_inventory'],
  },

  { label: 'Bug / Feature', path: '/bug-feature', icon: <FeedbackOutlinedIcon />, section: 'sistema' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isSelected(currentPath: string, itemPath: string) {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}

// Entries are checked longest-prefix-first so more-specific routes win.
const ROUTE_TITLES: Array<[prefix: string, title: string]> = [
  ['/bug-feature/resolved',   'BUG / FEATURE · RESOLVED'],
  ['/maintenance/plans',      'MANUTENZIONE · PIANI'],
  ['/maintenance/rapportini', 'MANUTENZIONE · RAPPORTINI'],
  ['/wiki/stats',             'KNOWLEDGE · STATISTICHE'],
  ['/wiki/queries',           'KNOWLEDGE · QUERY'],
  ['/wiki',                   'KNOWLEDGE · WIKI'],
  ['/site-repository',        'SITE REPOSITORY'],
  ['/customers',              'CLIENTI'],
  ['/sites',                  'SITI'],
  ['/contacts',               'CONTATTI'],
  ['/inventory',              'INVENTARI'],
  ['/monitors',               'SITE REPOSITORY · MONITOR'],
  ['/maintenance',            'MANUTENZIONE'],
  ['/issues',                 'ISSUES'],
  ['/servicenow-stats',       'SERVICENOW · STATISTICHE'],
  ['/servicenow-absences',    'SERVICENOW · ASSENZE TECNICI'],
  ['/servicenow-cases',       'SERVICENOW'],
  ['/piano-ferie',            'PIANO FERIE'],
  ['/rimborso-spese',         'RIMBORSO SPESE'],
  ['/purchase-orders',        'PURCHASE ORDERS'],
  ['/bug-feature',            'BUG / FEATURE'],
  ['/utenti',                 'UTENTI E GRUPPI'],
  ['/accesso-portal',         'ACCESSO PORTAL'],
  ['/audit',                  'AUDIT'],
  ['/drive',                  'DRIVE'],
  ['/trash',                  'CESTINO'],
  ['/search',                 'RICERCA'],
  ['/profile',                'PROFILO'],
  ['/',                       'DASHBOARD'],
]

export function getPageTitle(pathname: string): string {
  return ROUTE_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1] ?? ''
}
