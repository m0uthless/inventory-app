/**
 * MobileBottomNavArchie
 *
 * Bottom navigation bar visibile solo su mobile (xs/sm).
 * Le azioni del tasto + sono contestuali alla route corrente,
 * ricalcando la logica dell'AppSpeedDial desktop.
 */
import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import LayersIcon from '@mui/icons-material/Layers'
import BugReportIcon from '@mui/icons-material/BugReportOutlined'
import HandymanIcon from '@mui/icons-material/HandymanOutlined'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import PeopleIcon from '@mui/icons-material/People'
import BusinessIcon from '@mui/icons-material/Business'
import ContactsIcon from '@mui/icons-material/Contacts'
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import { MobileBottomNav, type MobileNavAction, type MobileNavItem } from '@shared/ui/MobileBottomNav'
import { useAuth } from '../auth/AuthProvider'

/* Colore primario ARCHIE (teal) */
const NAV_COLOR = '#0f766e'

const NAV_ITEMS: [MobileNavItem, MobileNavItem, MobileNavItem, MobileNavItem] = [
  { key: 'home',        label: 'Home',       icon: <DashboardIcon />, path: '/' },
  { key: 'repository', label: 'Repository',  icon: <LayersIcon />,    path: '/site-repository' },
  { key: 'issues',     label: 'Issues',      icon: <BugReportIcon />, path: '/issues' },
  { key: 'manut',      label: 'Manut.',      icon: <HandymanIcon />,  path: '/maintenance' },
]

function getActiveKey(pathname: string): string {
  if (pathname === '/')                          return 'home'
  if (pathname.startsWith('/site-repository'))  return 'repository'
  if (pathname.startsWith('/issues'))           return 'issues'
  if (pathname.startsWith('/maintenance'))      return 'manut'
  return 'home'
}

function pathStarts(p: string, base: string) {
  return p === base || p.startsWith(`${base}/`)
}

export default function MobileBottomNavArchie() {
  const { hasPerm } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const activeKey = getActiveKey(loc.pathname)

  const handleNavigate = (item: MobileNavItem) => {
    nav(item.path)
  }

  /* ── azioni contestuali ── */
  const actions = React.useMemo<MobileNavAction[]>(() => {
    const all: Record<string, MobileNavAction> = {
      newInventory: {
        key: 'newInventory',
        label: 'Nuovo inventario',
        description: 'Aggiungi all\'inventario',
        icon: <Inventory2Icon />,
        onClick: () => nav('/inventory', { state: { openCreate: true } }),
      },
      newIssue: {
        key: 'newIssue',
        label: 'Nuova issue',
        description: 'Segnala un problema',
        icon: <BugReportOutlinedIcon />,
        onClick: () => nav('/issues', { state: { openCreate: true } }),
      },
      newCustomer: {
        key: 'newCustomer',
        label: 'Nuovo cliente',
        description: 'Aggiungi cliente CRM',
        icon: <PeopleIcon />,
        onClick: () => nav('/customers', { state: { openCreate: true } }),
      },
      newSite: {
        key: 'newSite',
        label: 'Nuovo sito',
        description: 'Aggiungi sede/sito',
        icon: <BusinessIcon />,
        onClick: () => nav('/sites', { state: { openCreate: true } }),
      },
      newContact: {
        key: 'newContact',
        label: 'Nuovo contatto',
        description: 'Aggiungi contatto',
        icon: <ContactsIcon />,
        onClick: () => nav('/contacts', { state: { openCreate: true } }),
      },
      newMonitor: {
        key: 'newMonitor',
        label: 'Nuovo monitor',
        description: 'Aggiungi monitor',
        icon: <MonitorOutlinedIcon />,
        onClick: () => nav('/monitors', { state: { openCreate: true } }),
      },
      newReport: {
        key: 'newReport',
        label: 'Segnalazione',
        description: 'Bug o richiesta feature',
        icon: <FeedbackOutlinedIcon />,
        onClick: () => nav('/bug-feature', { state: { openCreate: true } }),
      },
    }

    type ActionKey = keyof typeof all
    let keys: ActionKey[] = []

    if (loc.pathname === '/' || pathStarts(loc.pathname, '/site-repository')) {
      keys = ['newInventory', 'newIssue', 'newCustomer', 'newSite', 'newContact']
    } else if (pathStarts(loc.pathname, '/inventory')) {
      keys = ['newInventory', 'newIssue', 'newReport']
    } else if (pathStarts(loc.pathname, '/issues')) {
      keys = ['newIssue', 'newInventory', 'newReport']
    } else if (pathStarts(loc.pathname, '/customers')) {
      keys = ['newCustomer', 'newSite', 'newContact']
    } else if (pathStarts(loc.pathname, '/sites')) {
      keys = ['newSite', 'newContact', 'newCustomer']
    } else if (pathStarts(loc.pathname, '/contacts')) {
      keys = ['newContact', 'newSite', 'newCustomer']
    } else if (pathStarts(loc.pathname, '/monitors')) {
      keys = ['newMonitor', 'newIssue', 'newReport']
    } else if (pathStarts(loc.pathname, '/maintenance')) {
      keys = ['newInventory', 'newIssue', 'newReport']
    } else {
      keys = ['newIssue', 'newInventory', 'newReport']
    }

    const PERMS: Record<string, string> = {
      newInventory: 'inventory.add_inventory',
      newMonitor:   'inventory.add_monitor',
      newIssue:     'issues.add_issue',
      newCustomer:  'crm.add_customer',
      newSite:      'crm.add_site',
      newContact:   'crm.add_contact',
    }

    return keys
      .map((k) => all[k])
      .filter((a) => {
        const perm = PERMS[a.key]
        return perm ? hasPerm(perm) : true
      })
  }, [loc.pathname, hasPerm, nav])

  return (
    <MobileBottomNav
      color={NAV_COLOR}
      items={NAV_ITEMS}
      activeKey={activeKey}
      onNavigate={handleNavigate}
      actions={actions}
    />
  )
}
