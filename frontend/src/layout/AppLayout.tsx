import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  ButtonBase,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Backdrop, Fade, Zoom } from '@mui/material'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import AppFooter from './AppFooter'
import GlobalSearch from './GlobalSearch'
import NotificationsBell from './NotificationsBell'
import AppSpeedDial from './AppSpeedDial'
import MobileBottomNavArchie from './MobileBottomNavArchie'
import { useThemeConstants } from '../theme/AppThemeProvider'
import { useIdleTimer } from '@shared/hooks/useIdleTimer'
import LockScreen from '@shared/ui/LockScreen'
import DevEnvironmentBadge from '@shared/ui/DevEnvironmentBadge'
import { DashboardEditModeProvider, useDashboardEditMode } from '../features/dashboard/DashboardEditModeContext'
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'

import { getPageTitle, type NavLeaf } from './appNav'
import { AppSidebar } from './AppSidebar'
import { PageHeaderProvider, usePageHeaderState } from './PageHeaderContext'
import { UndoToastProvider } from '../ui/campo'
import { DrawerAppearanceProvider } from '@shared/ui/DrawerShell'

const ProfileDrawer = React.lazy(() =>
  import('../pages/Profile').then((m) => ({ default: m.ProfileDrawer })),
)
const ChangelogDialog = React.lazy(() => import('../ui/ChangelogDialog'))
const ChangelogLoginModal = React.lazy(() => import('../ui/ChangelogLoginModal'))

type FeedbackSummary = {
  total_count: number
  open_count: number
  resolved_count: number
  mine_open_count: number
  mine_resolved_count: number
  open_missing_screenshot_count: number
  resolved_missing_screenshot_count: number
  bug_open_count: number
  feature_open_count: number
  bug_resolved_count: number
  feature_resolved_count: number
}

type IssueSummary = {
  open_count: number
  in_progress_count: number
  resolved_count: number
  closed_count: number
  active_count: number
}

type TaskSummary = {
  mine_open_count: number
}

// Spegne automaticamente la modalità "Personalizza" quando si esce dalla
// route della dashboard (evita che il toggle resti "acceso" in background
// se l'utente naviga via senza disattivarlo esplicitamente dal menu).
// NB: eventuali modifiche di layout non ancora salvate in quel momento non
// vengono persistite — il salvataggio avviene solo allo spegnimento
// esplicito del toggle, vedi DynamicDesktopLayout in pages/Dashboard.tsx.
function DashboardEditModeRouteGuard({ isDashboardRoute }: { isDashboardRoute: boolean }) {
  const { editMode, setEditMode } = useDashboardEditMode()
  React.useEffect(() => {
    if (!isDashboardRoute && editMode) setEditMode(false)
  }, [isDashboardRoute, editMode, setEditMode])
  return null
}

// Voce di menu "Personalizza dashboard": componente separato perché deve
// leggere il context DashboardEditModeProvider, che avvolge il return di
// AppLayout (quindi non è ancora disponibile nel corpo della funzione
// AppLayout stessa al momento in cui costruisce il JSX del <Menu>).
function DashboardEditToggleMenuItem({ isDashboardRoute, onClose }: { isDashboardRoute: boolean; onClose: () => void }) {
  const { editMode, toggleEditMode } = useDashboardEditMode()
  if (!isDashboardRoute) return null
  return (
    <MenuItem
      onClick={() => { onClose(); toggleEditMode() }}
      sx={{ gap: 1.25 }}
    >
      {editMode
        ? <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        : <DashboardCustomizeOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
      {editMode ? 'Fine personalizzazione' : 'Personalizza dashboard'}
    </MenuItem>
  )
}

/** Titolo della pagina per le pagine che non hanno ancora una testata propria. */
function ShellPageTitle({ pathname }: { pathname: string }) {
  const { hidden } = usePageHeaderState()
  const title = getPageTitle(pathname)
  if (hidden || !title || pathname === '/') return null
  return (
    <Typography variant="h4" component="h1" sx={{ mb: 2 }}>{title}</Typography>
  )
}

export function AppLayout() {
  const { me, login, logout, hasPerm, locked, unlock } = useAuth()
  const themeConstants = useThemeConstants()

  // Logout automatico dopo 1h di inattività (LockScreen disattivata su Archie,
  // vedi config/settings.py SESSION_IDLE_LOCK_SECONDS["site-repo"]).
  const { resetAfterUnlock } = useIdleTimer({
    lockAfterMs:   60 * 60 * 1000,
    logoutAfterMs: 60 * 60 * 1000,
    enabled: Boolean(me),
    onLock: () => {},
    onLogout: async () => {
      try {
        await api.post('/auth/logout/')
      } catch { /* ignora errori di rete */ }
      window.location.assign('/login')
    },
  })

  const handleUnlock = React.useCallback(() => {
    unlock()
    resetAfterUnlock()
  }, [unlock, resetAfterUnlock])
  const nav = useNavigate()
  const loc = useLocation()

  const [eggOpen, setEggOpen] = React.useState(false)
  const eggTimerRef = React.useRef<number | null>(null)
  const openEgg = React.useCallback(() => {
    setEggOpen(true)
    if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current)
    eggTimerRef.current = window.setTimeout(() => setEggOpen(false), 5000)
  }, [])
  React.useEffect(() => () => { if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current) }, [])
  React.useEffect(() => {
    if (!eggOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setEggOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [eggOpen])

  // Sidebar: pannello su mobile, comprimibile su desktop (persistita).
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [desktopOpen, setDesktopOpen] = React.useState(() => {
    const v = localStorage.getItem('sidebar_open')
    return v ? v === '1' : true
  })
  React.useEffect(() => { localStorage.setItem('sidebar_open', desktopOpen ? '1' : '0') }, [desktopOpen])
  const mini = !desktopOpen
  React.useEffect(() => { setMobileOpen(false) }, [loc.pathname])

  // Menu utente
  const [userAnchorEl, setUserAnchorEl] = React.useState<null | HTMLElement>(null)
  const userMenuOpen = Boolean(userAnchorEl)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [changelogOpen, setChangelogOpen] = React.useState(false)

  const initials = React.useMemo(() => {
    const base = (me?.first_name?.[0] || '') + (me?.last_name?.[0] || '') || me?.username?.[0] || 'U'
    return base.toUpperCase()
  }, [me])
  const displayName = React.useMemo(() => {
    const name = [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim()
    return name || me?.username || 'Utente'
  }, [me])

  const handleLogout = async () => {
    await logout()
    nav('/login', { replace: true })
  }

  const canAccess = React.useCallback((it: NavLeaf) => {
    if (it.perm) return hasPerm(it.perm)
    if (it.permAny?.length) return it.permAny.some((perm) => hasPerm(perm))
    return true
  }, [hasPerm])

  // Contatori della sidebar
  const [feedbackSummary, setFeedbackSummary] = React.useState<FeedbackSummary | null>(null)
  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await api.get<FeedbackSummary>('/feedback-items/summary/')
        if (active) setFeedbackSummary(data)
      } catch {
        if (active) setFeedbackSummary(null)
      }
    })()
    return () => { active = false }
  }, [loc.pathname])

  const [issueSummary, setIssueSummary] = React.useState<IssueSummary | null>(null)
  React.useEffect(() => {
    if (!hasPerm('issues.view_issue')) return
    let active = true
    const fetchSummary = async () => {
      try {
        const { data } = await api.get<IssueSummary>('/issues/summary/')
        if (active) setIssueSummary(data)
      } catch {
        if (active) setIssueSummary(null)
      }
    }
    void fetchSummary()
    const interval = setInterval(fetchSummary, 60_000)
    return () => { active = false; clearInterval(interval) }
  }, [loc.pathname, hasPerm])

  const [taskSummary, setTaskSummary] = React.useState<TaskSummary | null>(null)
  React.useEffect(() => {
    let active = true
    const fetchSummary = async () => {
      try {
        const { data } = await api.get<TaskSummary>('/area-tasks/summary/')
        if (active) setTaskSummary(data)
      } catch {
        if (active) setTaskSummary(null)
      }
    }
    void fetchSummary()
    const interval = setInterval(fetchSummary, 60_000)
    return () => { active = false; clearInterval(interval) }
  }, [loc.pathname])

  const counts = {
    issues: issueSummary?.active_count,
    tasks: taskSummary?.mine_open_count,
    feedback: feedbackSummary?.open_count,
  }

  const menuItemSx = { gap: 1.25, '& svg': { fontSize: 16, color: 'text.secondary' } }

  return (
    <DashboardEditModeProvider>
    <PageHeaderProvider>
    <UndoToastProvider>
    <DrawerAppearanceProvider value="campo">
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'archie.frame' }}>
      <DevEnvironmentBadge />

      {/* Sidebar desktop */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0, height: '100%' }}>
        <AppSidebar mini={mini} onToggleMini={() => setDesktopOpen((v) => !v)} canAccess={canAccess} counts={counts} />
      </Box>

      {/* Sidebar mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { border: 0, boxShadow: (t) => t.palette.archie.shadowFloat } }}
      >
        <AppSidebar mini={false} mobile canAccess={canAccess} counts={counts} onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      {/* Area principale: topbar sulla cornice + foglio di lavoro */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box component="header" sx={{
          height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1,
          px: { xs: 1.5, md: 1 }, pr: { md: 2 }, position: 'relative',
        }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }} aria-label="Apri il menu">
            <MenuIcon />
          </IconButton>

          <Box sx={{ position: { sm: 'absolute' }, left: { sm: '50%' }, transform: { sm: 'translateX(-50%)' }, flex: { xs: 1, sm: 'none' }, display: 'flex', justifyContent: 'center' }}>
            <GlobalSearch onEggTrigger={openEgg} />
          </Box>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NotificationsBell enabled={Boolean(me)} />
            <ButtonBase
              onClick={(e) => setUserAnchorEl(e.currentTarget)}
              aria-label="Profilo e impostazioni"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              sx={{
                height: 40, gap: 1, pl: 0.5, pr: 1, borderRadius: '8px', border: '1px solid transparent', color: 'text.secondary',
                '&:hover': { bgcolor: 'background.paper', borderColor: 'divider' },
                '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}
            >
              <Avatar src={me?.profile?.avatar || undefined} sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 700, bgcolor: 'background.paper', color: 'primary.main', border: '1px solid', borderColor: 'divider' }}>
                {initials}
              </Avatar>
              <Box sx={{ display: { xs: 'none', lg: 'grid' }, textAlign: 'left', lineHeight: 1.25 }}>
                <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }} noWrap>{displayName}</Typography>
                {me?.profile?.leave_area_label ? (
                  <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{me.profile.leave_area_label}</Typography>
                ) : null}
              </Box>
              <ExpandMoreIcon sx={{ fontSize: 16, display: { xs: 'none', lg: 'block' } }} />
            </ButtonBase>
          </Box>
        </Box>

        <Box component="main" sx={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          bgcolor: 'background.default', borderStyle: 'solid', borderColor: 'divider',
          borderWidth: { xs: '1px 0 0 0', md: '1px 0 0 1px' }, borderTopLeftRadius: { md: 14 },
        }}>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: { xs: 10, md: 3 } }}>
              <DashboardEditModeRouteGuard isDashboardRoute={loc.pathname === '/'} />
              <ShellPageTitle pathname={loc.pathname} />
              <Outlet />
            </Box>
            <AppFooter />
          </Box>
        </Box>
      </Box>

      {/* Menu utente */}
      <Menu
        anchorEl={userAnchorEl}
        open={userMenuOpen}
        onClose={() => setUserAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, mt: 0.5 } } }}
      >
        <DashboardEditToggleMenuItem isDashboardRoute={loc.pathname === '/'} onClose={() => setUserAnchorEl(null)} />
        <MenuItem onClick={() => { setUserAnchorEl(null); setProfileOpen(true) }} sx={menuItemSx}>
          <SettingsIcon />Impostazioni
        </MenuItem>
        <MenuItem onClick={() => { setUserAnchorEl(null); setChangelogOpen(true) }} sx={menuItemSx}>
          <HistoryRoundedIcon />Changelog
        </MenuItem>
        {hasPerm('core.manage_users') && (
          <MenuItem onClick={() => { setUserAnchorEl(null); nav('/utenti') }} sx={menuItemSx}>
            <GroupOutlinedIcon />Utenti e gruppi
          </MenuItem>
        )}
        {hasPerm('core.manage_users') && (
          <MenuItem onClick={() => { setUserAnchorEl(null); nav('/accesso-portal') }} sx={menuItemSx}>
            <BusinessOutlinedIcon />Accesso Portal
          </MenuItem>
        )}
        <MenuItem onClick={async () => { setUserAnchorEl(null); await handleLogout() }} sx={menuItemSx}>
          <LogoutIcon />Esci
        </MenuItem>
      </Menu>

      <AppSpeedDial />
      <MobileBottomNavArchie />
      <LockScreen
        open={locked}
        username={me?.username ?? ''}
        displayName={me ? ([me.first_name, me.last_name].filter(Boolean).join(' ') || me.username) : 'Utente'}
        avatarUrl={me?.profile?.avatar}
        onSubmitPassword={(password) => login(me?.username ?? '', password)}
        onUnlock={handleUnlock}
        onLogout={logout}
      />
      <Backdrop
        open={eggOpen}
        onClick={() => setEggOpen(false)}
        sx={{
          zIndex: (t) => t.zIndex.modal + 20,
          bgcolor: themeConstants.overlay.blackScrim,
          backdropFilter: 'blur(2px)',
        }}
      >
        <Fade in={eggOpen} timeout={{ enter: 250, exit: 350 }}>
          <Box sx={{ outline: 'none' }}>
            <Zoom in={eggOpen} timeout={{ enter: 350, exit: 200 }}>
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 24,
                  transform: 'rotate(-1deg)',
                  width: { xs: '94vw', sm: '85vw', md: '72vw' },
                  maxWidth: 1200,
                  maxHeight: '92vh',
                  p: { xs: 1, sm: 1.75 },
                  bgcolor: '#0f172a',
                  '@keyframes eggPop': {
                    '0%': { transform: 'scale(0.92) rotate(-2deg)' },
                    '40%': { transform: 'scale(1.02) rotate(1deg)' },
                    '100%': { transform: 'scale(1.0) rotate(-1deg)' },
                  },
                  animation: 'eggPop 650ms ease-out',
                }}
                onClick={(e) => e.stopPropagation()} // evita chiusura se clicchi sull’immagine
              >
                <Box
                  component="img"
                  src="/supertennis.jpeg"
                  alt="supertennis"
                  sx={{
                    display: 'block', width: '100%', height: 'auto',
                    maxHeight: { xs: 'calc(92vh - 16px)', sm: 'calc(92vh - 28px)' },
                    objectFit: 'contain', borderRadius: 1,
                  }}
                />

                {/* cornice: bordo teal "glow" arretrato dal bordo esterno, sul passe-partout scuro */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: { xs: 6, sm: 10 },
                    border: '2px solid rgba(14,165,164,0.75)',
                    boxShadow: '0 0 0 2px rgba(15,118,110,0.25) inset',
                    borderRadius: 1,
                    pointerEvents: 'none',
                  }}
                />
              </Box>
            </Zoom>
          </Box>
        </Fade>
      </Backdrop>
      <React.Suspense fallback={null}>
        <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
        <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
        {Boolean(me) && <ChangelogLoginModal />}
      </React.Suspense>
    </Box>
    </DrawerAppearanceProvider>
    </UndoToastProvider>
    </PageHeaderProvider>
    </DashboardEditModeProvider>
  )
}
