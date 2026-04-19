/**
 * MobileBottomNavAuslbo
 *
 * Bottom navigation bar visibile solo su mobile (xs/sm).
 * Le azioni del tasto + sono contestuali alla route corrente.
 */
import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AddToQueueOutlinedIcon from '@mui/icons-material/AddToQueueOutlined'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import { MobileBottomNav, type MobileNavAction, type MobileNavItem } from '@shared/ui/MobileBottomNav'

/* Colore primario AUSL BO (blu istituzionale) */
const NAV_COLOR = '#1A6BB5'

const NAV_ITEMS: [MobileNavItem, MobileNavItem, MobileNavItem, MobileNavItem] = [
  { key: 'home',      label: 'Home',      icon: <DashboardOutlinedIcon />, path: '/'          },
  { key: 'device',   label: 'Device',    icon: <RouterOutlinedIcon />,    path: '/device'    },
  { key: 'vlan',     label: 'VLAN',      icon: <LanOutlinedIcon />,       path: '/vlan'      },
  { key: 'richieste',label: 'Richieste', icon: <AssignmentOutlinedIcon />, path: '/richieste' },
]

function getActiveKey(pathname: string): string {
  if (pathname === '/')                    return 'home'
  if (pathname.startsWith('/device'))     return 'device'
  if (pathname.startsWith('/vlan'))       return 'vlan'
  if (pathname.startsWith('/richieste'))  return 'richieste'
  return 'home'
}

function pathStarts(p: string, base: string) {
  return p === base || p.startsWith(`${base}/`)
}

export default function MobileBottomNavAuslbo() {
  const nav = useNavigate()
  const loc = useLocation()

  const activeKey = getActiveKey(loc.pathname)

  const handleNavigate = (item: MobileNavItem) => {
    nav(item.path)
  }

  const actions = React.useMemo<MobileNavAction[]>(() => {
    const all: Record<string, MobileNavAction> = {
      newDevice: {
        key: 'newDevice',
        label: 'Nuovo device',
        description: 'Registra dispositivo',
        icon: <AddToQueueOutlinedIcon />,
        onClick: () => nav('/device', { state: { openCreate: true } }),
      },
      newVlan: {
        key: 'newVlan',
        label: 'Nuova VLAN',
        description: 'Aggiungi rete VLAN',
        icon: <LanOutlinedIcon />,
        onClick: () => nav('/vlan', { state: { openCreate: true } }),
      },
      newIpRequest: {
        key: 'newIpRequest',
        label: 'Richiesta IP',
        description: 'Richiedi assegnazione indirizzo',
        icon: <WifiOutlinedIcon />,
        onClick: () => nav('/richieste', { state: { openCreate: true } }),
      },
    }

    if (pathStarts(loc.pathname, '/device')) {
      return [all.newDevice, all.newIpRequest]
    }
    if (pathStarts(loc.pathname, '/vlan')) {
      return [all.newVlan, all.newIpRequest]
    }
    if (pathStarts(loc.pathname, '/richieste')) {
      return [all.newIpRequest, all.newDevice]
    }
    // home e resto
    return [all.newDevice, all.newVlan, all.newIpRequest]
  }, [loc.pathname, nav])

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
