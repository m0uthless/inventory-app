import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'

import { useAuth } from '../auth/AuthProvider'
import { Suspense } from 'react'
import { SIDEBAR } from '../theme'
import AppFooter from './AppFooter'
import MobileBottomNavAuslbo from './MobileBottomNavAuslbo'

const ProfileDrawer = React.lazy(() =>
  import('../pages/ProfileDrawer').then((m) => ({ default: m.ProfileDrawer })),
)

const drawerWidth = 208
const collapsedWidth = 58

type NavItem = {
  label: string
  path: string
  icon: React.ReactNode
  section: 'panoramica' | 'inventario' | 'struttura' | 'dedicato'
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        path: '/',          icon: <DashboardOutlinedIcon />,  section: 'panoramica' },
  { label: 'RIS/PACS Systems', path: '/inventory', icon: <MemoryOutlinedIcon />,     section: 'inventario' },
  { label: 'Device',           path: '/device',    icon: <RouterOutlinedIcon />,     section: 'inventario' },
  { label: 'VLAN',             path: '/vlan',      icon: <LanOutlinedIcon />,        section: 'inventario' },
  { label: 'Richieste',        path: '/richieste', icon: <AssignmentOutlinedIcon />, section: 'inventario' },
  { label: 'Scadenze',         path: '/scadenze',  icon: <AccessTimeOutlinedIcon />, section: 'inventario' },
  { label: 'Sedi',             path: '/sites',     icon: <HomeWorkOutlinedIcon />,   section: 'struttura'  },
  { label: 'Contatti',         path: '/contacts',  icon: <PeopleOutlinedIcon />,     section: 'struttura'  },
  { label: 'Report',           path: '/report',    icon: <BarChartOutlinedIcon />,   section: 'dedicato'   },
]

const SECTIONS: Array<{ key: NavItem['section']; label: string }> = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'struttura',  label: 'Struttura'  },
  { key: 'dedicato',   label: 'Dedicato'   },
]

const ROUTE_TITLES: Array<[prefix: string, title: string]> = [
  ['/inventory', 'RIS/PACS SYSTEMS'],
  ['/device',    'DEVICE'],
  ['/vlan',      'RETI VLAN'],
  ['/richieste', 'RICHIESTE MODALITÀ'],
  ['/scadenze',  'SCADENZE'],
  ['/sites',     'SEDI'],
  ['/contacts',  'CONTATTI'],
  ['/report',    'REPORT'],
  ['/',          'DASHBOARD'],
]

function isSelected(currentPath: string, itemPath: string) {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}

export function AppLayout() {
  const { me, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  // Sidebar mini-variant, persistita in localStorage
  const [desktopOpen, setDesktopOpen] = React.useState(() => {
    const v = localStorage.getItem('auslbo_sidebar_open')
    return v ? v === '1' : true
  })
  React.useEffect(() => {
    localStorage.setItem('auslbo_sidebar_open', desktopOpen ? '1' : '0')
  }, [desktopOpen])

  const [mobileOpen, setMobileOpen] = React.useState(false)

  const mini = !desktopOpen
  const sidebarWidth = mini ? collapsedWidth : drawerWidth

  // User menu
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [profileOpen, setProfileOpen] = React.useState(false)

  const initials = React.useMemo(() => {
    const u = me?.user
    if (!u) return '?'
    const f = u.first_name?.charAt(0) || ''
    const l = u.last_name?.charAt(0) || ''
    return (f + l).toUpperCase() || u.username.substring(0, 2).toUpperCase()
  }, [me])

  const displayName = React.useMemo(() => {
    const u = me?.user
    if (!u) return ''
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
    return name || u.username
  }, [me])

  const pageTitle = React.useMemo(() => {
    const path = loc.pathname
    return ROUTE_TITLES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))?.[1] ?? ''
  }, [loc.pathname])

  const handleLogout = async () => {
    setAnchorEl(null)
    await logout()
    nav('/login', { replace: true })
  }

  // ─── Drawer content ─────────────────────────────────────────────────────────

  const drawerContent = (isMini: boolean) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header allineato alla topbar */}
      <Toolbar
        sx={{
          px: isMini ? 1 : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMini ? 'center' : 'space-between',
          overflow: 'hidden',
        }}
      >
        {!isMini ? (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              pl: 1.5,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 1.5,
                bgcolor: 'rgba(93,174,240,0.20)',
                border: '1px solid rgba(93,174,240,0.30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BusinessOutlinedIcon sx={{ color: SIDEBAR.accentLight, fontSize: 16 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: '0.12em',
                  color: SIDEBAR.textBright,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                AUSL BO
              </Typography>
              <Typography
                sx={{
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  color: SIDEBAR.textMuted,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                Portal
              </Typography>
            </Box>
          </Box>
        ) : (
          <span />
        )}

        <Tooltip title={isMini ? 'Apri sidebar' : 'Chiudi sidebar'}>
          <IconButton
            onClick={() => setDesktopOpen((v) => !v)}
            aria-label="Toggle sidebar"
            sx={{ color: SIDEBAR.textMuted, '&:hover': { color: 'rgba(255,255,255,0.9)' } }}
          >
            {isMini ? <MenuIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      {/* Nav */}
      <List sx={{ px: isMini ? 0.75 : 1, py: 1, flex: 1 }}>
        {SECTIONS.flatMap(({ key, label }) => {
          const items = NAV_ITEMS.filter((it) => it.section === key)
          if (!items.length) return []

          const sectionEl = !isMini ? (
            <Typography
              key={`sl-${key}`}
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: SIDEBAR.textMuted,
                px: 1.25,
                pt: key === 'panoramica' ? 0.5 : 1.5,
                pb: 0.5,
                display: 'block',
                opacity: 0.7,
              }}
            >
              {label}
            </Typography>
          ) : key !== 'panoramica' ? (
            <Divider key={`sd-${key}`} sx={{ borderColor: SIDEBAR.divider, my: 0.75 }} />
          ) : null

          const navEls = items.map((it) => {
            const selected = isSelected(loc.pathname, it.path)
            const btn = (
              <ListItemButton
                key={it.path}
                selected={selected}
                onClick={() => {
                  nav(it.path)
                  setMobileOpen(false)
                }}
                sx={{
                  borderRadius: 1.25,
                  mb: 0.25,
                  px: isMini ? 1 : 1.25,
                  py: 0.9,
                  justifyContent: isMini ? 'center' : 'flex-start',
                  transition: 'all 200ms ease',
                  color: SIDEBAR.textDefault,
                  '& .MuiListItemIcon-root': {
                    minWidth: isMini ? 'auto' : 38,
                    color: SIDEBAR.textDefault,
                    justifyContent: 'center',
                  },
                  '&:hover': {
                    backgroundColor: SIDEBAR.selectedBg,
                    color: SIDEBAR.textStrong,
                    '& .MuiListItemIcon-root': { color: SIDEBAR.textStrong },
                  },
                  '&.Mui-selected': {
                    background: 'linear-gradient(90deg, rgba(93,174,240,0.20), rgba(93,174,240,0.07))',
                    color: SIDEBAR.accentLight,
                    borderLeft: SIDEBAR.activeBorder,
                    pl: isMini ? 1 : '10px',
                    '& .MuiListItemIcon-root': { color: SIDEBAR.accent },
                  },
                  '&.Mui-selected:hover': {
                    background: 'linear-gradient(90deg, rgba(93,174,240,0.28), rgba(93,174,240,0.12))',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: isMini ? 'auto' : 38 }}>{it.icon}</ListItemIcon>
                <ListItemText
                  primary={it.label}
                  primaryTypographyProps={{
                    fontWeight: selected ? 700 : 500,
                    noWrap: true,
                    fontSize: '0.84rem',
                  }}
                  sx={{
                    ml: 0.25,
                    opacity: isMini ? 0 : 1,
                    maxWidth: isMini ? 0 : 220,
                    flex: isMini ? '0 0 auto' : '1 1 auto',
                    transition: 'opacity 150ms ease, max-width 200ms ease',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                />
              </ListItemButton>
            )

            return isMini ? (
              <Tooltip key={it.path} title={it.label} placement="right">
                {btn}
              </Tooltip>
            ) : (
              btn
            )
          })

          return [sectionEl, ...navEls].filter(Boolean)
        })}
      </List>
    </Box>
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* AppBar FULL WIDTH */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: '100%',
          left: 0,
          right: 0,
          bgcolor: 'primary.main',
          '& .MuiIconButton-root': { color: SIDEBAR.textStrong },
          '& .MuiIconButton-root:hover': {
            color: '#ffffff',
            backgroundColor: 'rgba(255,255,255,0.12)',
          },
        }}
      >
        <Toolbar sx={{ pl: 2, pr: 1, gap: 1 }}>
          {/* Spacer allineato alla sidebar su desktop */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: sidebarWidth, flexShrink: 0 }} />

          {/* LEFT: hamburger mobile + page title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' } }}
              aria-label="Apri menu"
            >
              <MenuIcon />
            </IconButton>

            {!!pageTitle && (
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 900,
                  letterSpacing: '0.22em',
                  color: SIDEBAR.accentLight,
                  lineHeight: 1,
                  fontSize: { xs: 13, md: 15 },
                }}
              >
                {pageTitle}
              </Typography>
            )}
          </Box>

          {/* RIGHT: avatar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            <Tooltip title={displayName}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="User menu" sx={{ mr: 0.5 }}>
                <Avatar
                  src={me?.user.avatar || undefined}
                  sx={{
                    width: 28,
                    height: 28,
                    fontWeight: 800,
                    fontSize: 11,
                    bgcolor: 'rgba(93,174,240,0.25)',
                    border: SIDEBAR.activeBorder,
                    color: SIDEBAR.textBright,
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* User menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              py: 0.5,
            },
          },
          list: { dense: true, sx: { py: 0 } },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{displayName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {me?.customer.display_name || me?.customer.name}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => { setAnchorEl(null); setProfileOpen(true) }}
          sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5 }}
        >
          <SettingsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          Impostazioni
        </MenuItem>
        <MenuItem
          onClick={handleLogout}
          sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5, color: 'error.main' }}
        >
          <LogoutIcon sx={{ fontSize: 16 }} />
          Esci
        </MenuItem>
      </Menu>

      {/* Sidebar desktop (mini-variant permanente) */}
      <Drawer
        variant="permanent"
        PaperProps={{
          style: {
            background: SIDEBAR.bgGradient,
            borderRight: 'none',
            overflow: 'hidden',
            width: sidebarWidth,
            transition: 'width 200ms ease',
            boxSizing: 'border-box',
          },
        }}
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            transition: 'width 200ms ease',
          },
        }}
        open
      >
        {drawerContent(mini)}
      </Drawer>

      {/* Sidebar mobile (temporary) */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          style: {
            background: SIDEBAR.bgGradient,
            borderRight: 'none',
            width: drawerWidth,
          },
        }}
        sx={{ display: { xs: 'block', md: 'none' } }}
      >
        {drawerContent(false)}
      </Drawer>

      {/* Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} />

        <Box sx={{ p: { xs: 2, md: 3 }, pb: { xs: 10, md: 3 }, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
      <MobileBottomNavAuslbo />
      <Suspense fallback={null}>
        <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
      </Suspense>
    </Box>
  )
}
