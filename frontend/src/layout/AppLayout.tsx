import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Backdrop, Fade, Zoom } from '@mui/material'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import AppFooter from './AppFooter'
import GlobalSearch from './GlobalSearch'
import NotificationsBell from './NotificationsBell'
import AppSpeedDial from './AppSpeedDial'
import MobileBottomNavArchie from './MobileBottomNavArchie'
import { SIDEBAR } from '../theme/tokens'
import { useIdleTimer } from '@shared/hooks/useIdleTimer'
import LockScreen from '@shared/ui/LockScreen'
import DevEnvironmentBadge from '@shared/ui/DevEnvironmentBadge'
import { SiteRepoV2Provider } from '../features/siterepov2/SiteRepoV2Context'
import { DashboardEditModeProvider, useDashboardEditMode } from '../features/dashboard/DashboardEditModeContext'
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'

import {
  type NavItem,
  NAV,
  SITE_REPOSITORY_CHILDREN,
  MAINTENANCE_CHILDREN,
  WIKI_CHILDREN,
  BUG_FEATURE_CHILDREN,
  SERVICENOW_CHILDREN,
  isSelected,
  getPageTitle,
} from './appLayoutNav'
import { SiteRepoV2Toolbar_Shell } from './SiteRepoV2Toolbar'
import { renderFeedbackCount, renderIssueCount } from './NavCountChip'
import { useCollapsibleNavGroup } from './useCollapsibleNavGroup'
import { NavGroupFlyout } from './NavGroupFlyout'

const ProfileDrawer = React.lazy(() =>
  import('../pages/Profile').then((m) => ({ default: m.ProfileDrawer })),
)
const ChangelogDialog = React.lazy(() => import('../ui/ChangelogDialog'))
const ChangelogLoginModal = React.lazy(() => import('../ui/ChangelogLoginModal'))

const drawerWidth = 208
const collapsedWidth = 58

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
      sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5 }}
    >
      {editMode
        ? <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        : <DashboardCustomizeOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
      {editMode ? 'Fine personalizzazione' : 'Personalizza dashboard'}
    </MenuItem>
  )
}

export function AppLayout() {
  const { me, login, logout, hasPerm, locked, lock, unlock } = useAuth()

  const { resetAfterUnlock } = useIdleTimer({
    lockAfterMs:   15 * 60 * 1000, // 15 minuti → lock screen
    logoutAfterMs: 60 * 60 * 1000, // 60 minuti → logout automatico
    enabled: Boolean(me),
    onLock: lock,
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

    if (eggTimerRef.current) {
      window.clearTimeout(eggTimerRef.current)
    }
    eggTimerRef.current = window.setTimeout(() => setEggOpen(false), 5000)
  }, [])

  React.useEffect(() => {
    return () => {
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (!eggOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEggOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [eggOpen])



  // Drawer mobile
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Sidebar mini-variant (desktop) persistita
  const [desktopOpen, setDesktopOpen] = React.useState(() => {
    const v = localStorage.getItem('sidebar_open')
    return v ? v === '1' : true
  })

  React.useEffect(() => {
    localStorage.setItem('sidebar_open', desktopOpen ? '1' : '0')
  }, [desktopOpen])

  const mini = !desktopOpen
  const sidebarWidth = mini ? collapsedWidth : drawerWidth

  // User menu (ancorato all'avatar in topbar)
  const [userAnchorEl, setUserAnchorEl] = React.useState<null | HTMLElement>(null)
  const userMenuOpen = Boolean(userAnchorEl)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [changelogOpen, setChangelogOpen] = React.useState(false)

  const initials = React.useMemo(() => {
    const base =
      (me?.first_name?.[0] || '') + (me?.last_name?.[0] || '') || me?.username?.[0] || 'U'
    return base.toUpperCase()
  }, [me])

  const displayName = React.useMemo(() => {
    const name = [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim()
    return name || me?.username || 'User'
  }, [me])

  const handleLogout = async () => {
    await logout()
    nav('/login', { replace: true })
  }

  const canAccessNavItem = React.useCallback(
    (it: NavItem) => {
      if (it.perm) return hasPerm(it.perm)
      if (it.permAny?.length) return it.permAny.some((perm) => hasPerm(perm))
      return true
    },
    [hasPerm],
  )

  const visibleNav = React.useMemo(() => NAV.filter(canAccessNavItem), [canAccessNavItem])


  const visibleWikiChildren = React.useMemo(
    () => WIKI_CHILDREN.filter(canAccessNavItem),
    [canAccessNavItem],
  )
  const visibleBugFeatureChildren = React.useMemo(
    () => BUG_FEATURE_CHILDREN.filter(canAccessNavItem),
    [canAccessNavItem],
  )
  const visibleMaintenanceChildren = React.useMemo(
    () => MAINTENANCE_CHILDREN.filter(canAccessNavItem),
    [canAccessNavItem],
  )
  const visibleSiteRepositoryChildren = React.useMemo(
    () => SITE_REPOSITORY_CHILDREN.filter(canAccessNavItem),
    [canAccessNavItem],
  )
  const visibleServiceNowChildren = React.useMemo(
    () => SERVICENOW_CHILDREN.filter(canAccessNavItem),
    [canAccessNavItem],
  )

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
    return () => {
      active = false
    }
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
    const interval = setInterval(fetchSummary, 60_000) // aggiorna il badge ogni 60s

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [loc.pathname, hasPerm])


  // Stato dei 5 gruppi collassabili della sidebar (Wiki, Bug/Feature,
  // Manutenzione, Site Repository, ServiceNow): apertura persistita in
  // localStorage + auto-espansione sulla rotta corrente + anchor flyout
  // (sidebar mini). Vedi useCollapsibleNavGroup.ts.
  const wiki           = useCollapsibleNavGroup(['/wiki', '/wiki/stats', '/wiki/queries'], 'wiki_nav_open', loc.pathname)
  const bugFeature     = useCollapsibleNavGroup(['/bug-feature', '/bug-feature/resolved'], 'bug_feature_nav_open', loc.pathname)
  const maintenance    = useCollapsibleNavGroup(['/maintenance', '/maintenance/plans', '/maintenance/rapportini'], 'maintenance_nav_open', loc.pathname)
  const siteRepository = useCollapsibleNavGroup(['/site-repository', '/customers', '/sites', '/contacts', '/monitors'], 'site_repository_nav_open', loc.pathname)
  const servicenow     = useCollapsibleNavGroup(['/servicenow-cases', '/servicenow-stats', '/servicenow-absences'], 'servicenow_nav_open', loc.pathname)

  const wikiSectionActive           = wiki.sectionActive
  const bugFeatureSectionActive     = bugFeature.sectionActive
  const maintenanceSectionActive    = maintenance.sectionActive
  const siteRepositorySectionActive = siteRepository.sectionActive
  const servicenowSectionActive     = servicenow.sectionActive

  const wikiOpen           = wiki.open,           setWikiOpen           = wiki.setOpen
  const bugFeatureOpen     = bugFeature.open,      setBugFeatureOpen     = bugFeature.setOpen
  const maintenanceOpen    = maintenance.open,     setMaintenanceOpen    = maintenance.setOpen
  const siteRepositoryOpen = siteRepository.open,  setSiteRepositoryOpen = siteRepository.setOpen
  const servicenowOpen     = servicenow.open,      setServicenowOpen     = servicenow.setOpen

  const wikiFlyoutAnchor           = wiki.flyoutAnchor,           setWikiFlyoutAnchor           = wiki.setFlyoutAnchor,           wikiFlyoutOpen           = wiki.flyoutOpen
  const bugFeatureFlyoutAnchor     = bugFeature.flyoutAnchor,     setBugFeatureFlyoutAnchor     = bugFeature.setFlyoutAnchor,     bugFeatureFlyoutOpen     = bugFeature.flyoutOpen
  const maintenanceFlyoutAnchor    = maintenance.flyoutAnchor,    setMaintenanceFlyoutAnchor    = maintenance.setFlyoutAnchor,    maintenanceFlyoutOpen    = maintenance.flyoutOpen
  const siteRepositoryFlyoutAnchor = siteRepository.flyoutAnchor, setSiteRepositoryFlyoutAnchor = siteRepository.setFlyoutAnchor, siteRepositoryFlyoutOpen = siteRepository.flyoutOpen
  const servicenowFlyoutAnchor     = servicenow.flyoutAnchor,     setServicenowFlyoutAnchor     = servicenow.setFlyoutAnchor,     servicenowFlyoutOpen     = servicenow.flyoutOpen

  React.useEffect(() => {
    setWikiFlyoutAnchor(null)
    setBugFeatureFlyoutAnchor(null)
    setMaintenanceFlyoutAnchor(null)
    setSiteRepositoryFlyoutAnchor(null)
    setServicenowFlyoutAnchor(null)

    // Chiudi automaticamente i gruppi che non contengono la rotta corrente.
    if (!wikiSectionActive)           setWikiOpen(false)
    if (!bugFeatureSectionActive)     setBugFeatureOpen(false)
    if (!maintenanceSectionActive)    setMaintenanceOpen(false)
    if (!siteRepositorySectionActive) setSiteRepositoryOpen(false)
    if (!servicenowSectionActive)     setServicenowOpen(false)
  }, [loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!mini) {
      setWikiFlyoutAnchor(null)
      setBugFeatureFlyoutAnchor(null)
      setSiteRepositoryFlyoutAnchor(null)
      setServicenowFlyoutAnchor(null)
      // NB: il flyout di Manutenzione non viene chiuso qui — comportamento
      // preesistente, mantenuto invariato.
    }
  }, [mini])

  // Flyout dei sottomenu (sidebar mini): si apre in hover sull'icona, si chiude
  // con un piccolo ritardo per dare il tempo al mouse di raggiungere il popover
  // senza che si chiuda per lo spazio vuoto fra icona e flyout.
  const flyoutCloseTimer = React.useRef<number | null>(null)
  const clearFlyoutCloseTimer = React.useCallback(() => {
    if (flyoutCloseTimer.current !== null) {
      window.clearTimeout(flyoutCloseTimer.current)
      flyoutCloseTimer.current = null
    }
  }, [])
  const scheduleFlyoutClose = React.useCallback((setter: React.Dispatch<React.SetStateAction<HTMLElement | null>>) => {
    clearFlyoutCloseTimer()
    flyoutCloseTimer.current = window.setTimeout(() => setter(null), 200)
  }, [clearFlyoutCloseTimer])
  React.useEffect(() => () => clearFlyoutCloseTimer(), [clearFlyoutCloseTimer])

  const pageTitle = React.useMemo(() => getPageTitle(loc.pathname), [loc.pathname])

  const isWikiPagesSelected = React.useMemo(
    () => loc.pathname === '/wiki' || (/^\/wiki\/\d+$/.test(loc.pathname) && !loc.pathname.startsWith('/wiki/stats')),
    [loc.pathname],
  )
  const isWikiStatsSelected = React.useMemo(
    () => loc.pathname === '/wiki/stats' || loc.pathname.startsWith('/wiki/stats/'),
    [loc.pathname],
  )
  const isWikiQueriesSelected = React.useMemo(
    () => loc.pathname === '/wiki/queries' || loc.pathname.startsWith('/wiki/queries/'),
    [loc.pathname],
  )
  const isBugFeatureOpenSelected = React.useMemo(
    () => loc.pathname === '/bug-feature' || (loc.pathname.startsWith('/bug-feature/') && !loc.pathname.startsWith('/bug-feature/resolved')),
    [loc.pathname],
  )
  const isBugFeatureResolvedSelected = React.useMemo(
    () => loc.pathname === '/bug-feature/resolved' || loc.pathname.startsWith('/bug-feature/resolved/'),
    [loc.pathname],
  )

  const renderNavItem = (
    it: NavItem,
    isMini: boolean,
    options?: {
      selected?: boolean
      nested?: boolean
      onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
      onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void
      onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void
      endAdornment?: React.ReactNode
      forceTooltip?: boolean
      variant?: 'default' | 'group-parent'
    },
  ) => {
    const selected = options?.selected ?? isSelected(loc.pathname, it.path)
    const nested = options?.nested ?? false
    const variant = options?.variant ?? 'default'
    const isGroupParent = variant === 'group-parent'

    const btn = (
      <ListItemButton
        key={it.path}
        selected={selected}
        onClick={(event) => {
          if (options?.onClick) {
            options.onClick(event)
            return
          }
          nav({ pathname: it.path, search: '' })
          setMobileOpen(false)
        }}
        onMouseEnter={options?.onMouseEnter}
        onMouseLeave={options?.onMouseLeave}
        sx={{
          borderRadius: nested ? 1.5 : 1.25,
          mb: 0.25,
          px: isMini ? 1 : nested ? 1.25 : 1.25,
          py: nested ? 0.7 : 0.9,
          ml: isMini ? 0 : nested ? 0.25 : 0,
          justifyContent: isMini ? 'center' : 'flex-start',
          transition: 'all 200ms ease',
          color: SIDEBAR.textDefault,
          '& .MuiListItemIcon-root': {
            minWidth: isMini ? 'auto' : 38,
            color: SIDEBAR.textDefault,
            justifyContent: 'center',
          },
          '&:hover': {
            backgroundColor: nested ? SIDEBAR.selectedBg : SIDEBAR.selectedBg,
            color: SIDEBAR.textStrong,
            '& .MuiListItemIcon-root': { color: SIDEBAR.textStrong },
          },
          '&.Mui-selected': nested
            ? {
                backgroundColor: SIDEBAR.selectedBgStrong,
                color: (theme) => theme.palette.common.white,
                borderLeft: SIDEBAR.activeBorder,
                pl: isMini ? 1 : '10px',
                boxShadow: 'inset 0 0 0 1px rgba(94,234,212,0.22)',
                '& .MuiListItemIcon-root': { color: '#99f6e4' },
              }
            : isGroupParent
              ? {
                  backgroundColor: SIDEBAR.selectedBgHover,
                  color: SIDEBAR.accentBright,
                  borderLeft: SIDEBAR.activeBorder,
                  pl: isMini ? 1 : '10px',
                  boxShadow: 'inset 0 0 0 1px rgba(94,234,212,0.16)',
                  '& .MuiListItemIcon-root': { color: '#99f6e4' },
                }
              : {
                  background: 'linear-gradient(90deg, rgba(94,234,212,0.2), rgba(94,234,212,0.07))',
                  color: SIDEBAR.accentLight,
                  borderLeft: SIDEBAR.activeBorder,
                  pl: isMini ? 1 : '10px',
                  '& .MuiListItemIcon-root': { color: SIDEBAR.accent },
                },
          '&.Mui-selected:hover': {
            background: nested || isGroupParent
              ? undefined
              : 'linear-gradient(90deg, rgba(94,234,212,0.28), rgba(94,234,212,0.12))',
            backgroundColor: nested
              ? SIDEBAR.chipBorderOpen
              : isGroupParent
                ? 'rgba(94,234,212,0.18)'
                : undefined,
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: isMini ? 'auto' : 38 }}>{it.icon}</ListItemIcon>

        <ListItemText
          primary={
            !isMini && it.wip ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box component="span" sx={{ fontWeight: selected ? 700 : 500, fontSize: 'inherit' }}>
                  {it.label}
                </Box>
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    px: 0.6,
                    py: 0.15,
                    borderRadius: 0.75,
                    bgcolor: 'rgba(245,158,11,0.18)',
                    color: (theme) => theme.palette.warning.main,
                    border: '1px solid rgba(245,158,11,0.28)',
                    lineHeight: 1.6,
                    flexShrink: 0,
                  }}
                >
                  WIP
                </Box>
              </Box>
            ) : it.label
          }
          primaryTypographyProps={{
            fontWeight: selected ? 700 : nested ? 500 : 500,
            noWrap: true,
            fontSize: nested ? '0.78rem' : '0.84rem',
            component: 'div',
          }}
          sx={{
            ml: 0.25,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            opacity: isMini ? 0 : 1,
            maxWidth: isMini ? 0 : 220,
            flex: isMini ? '0 0 auto' : '1 1 auto',
            transition: 'opacity 150ms ease, max-width 200ms ease',
          }}
        />

        {!isMini && options?.endAdornment ? <Box sx={{ ml: 0.5 }}>{options.endAdornment}</Box> : null}
      </ListItemButton>
    )

    return isMini || options?.forceTooltip ? (
      <Tooltip key={it.path} title={it.label} placement="right">
        {btn}
      </Tooltip>
    ) : (
      btn
    )
  }

  const drawer = (isMini: boolean) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar anche qui => divider allineato con la topbar */}
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
              justifyContent: 'center',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                letterSpacing: '0.28em',
                background: 'linear-gradient(135deg, #5eead4, #a7f3d0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1,
              }}
              noWrap
            >
              ARCHIE
            </Typography>
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



      <List sx={{ px: isMini ? 0.75 : 1, py: 1 }}>
        {(() => {
          // Raggruppa le voci per sezione e intercala i label di gruppo
          const SECTIONS: Array<{ key: NavItem['section']; label: string }> = [
            { key: 'principale', label: 'Principale' },
            { key: 'strumenti', label: 'Strumenti' },
            { key: 'sistema', label: 'Sistema' },
          ]

          return SECTIONS.flatMap(({ key, label }) => {
            const sectionItems = visibleNav.filter((it) => it.section === key)
            if (!sectionItems.length) return []

            const sectionLabel = !isMini ? (
              <Typography
                key={`section-label-${key}`}
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: SIDEBAR.textMuted,
                  px: 1.25,
                  pt: key === 'principale' ? 0.5 : 1.5,
                  pb: 0.5,
                  display: 'block',
                  opacity: 0.7,
                }}
              >
                {label}
              </Typography>
            ) : (
              key !== 'principale' ? (
                <Divider
                  key={`section-divider-${key}`}
                  sx={{ borderColor: SIDEBAR.divider, my: 0.75 }}
                />
              ) : null
            )

            const items = sectionItems.map((it) => {
              const isSiteRepositoryGroup = it.path === '/site-repository'
              const isWikiGroup = it.path === '/wiki'
              const isBugFeatureGroup = it.path === '/bug-feature'
              const isMaintenanceGroup = it.path === '/maintenance'
              const isServiceNowGroup = it.path === '/servicenow-cases'

              if (!isSiteRepositoryGroup && !isWikiGroup && !isBugFeatureGroup && !isMaintenanceGroup && !isServiceNowGroup) {
                const issueEndAdornment =
                  it.path === '/issues' ? renderIssueCount(issueSummary?.active_count) : null
                return (
                  <React.Fragment key={it.path}>
                    {renderNavItem(it, isMini, issueEndAdornment ? { endAdornment: issueEndAdornment } : undefined)}
                  </React.Fragment>
                )
              }

              const children = isSiteRepositoryGroup
                  ? visibleSiteRepositoryChildren
                  : isWikiGroup
                    ? visibleWikiChildren
                    : isMaintenanceGroup
                      ? visibleMaintenanceChildren
                      : isServiceNowGroup
                        ? visibleServiceNowChildren
                        : visibleBugFeatureChildren
              const parentSelected = isSiteRepositoryGroup
                  ? siteRepositorySectionActive
                  : isWikiGroup
                    ? wikiSectionActive
                    : isMaintenanceGroup
                      ? maintenanceSectionActive
                      : isServiceNowGroup
                        ? servicenowSectionActive
                        : bugFeatureSectionActive
              const groupOpen = isSiteRepositoryGroup ? siteRepositoryOpen : isWikiGroup ? wikiOpen : isMaintenanceGroup ? maintenanceOpen : isServiceNowGroup ? servicenowOpen : bugFeatureOpen
              const setGroupOpen = isSiteRepositoryGroup ? setSiteRepositoryOpen : isWikiGroup ? setWikiOpen : isMaintenanceGroup ? setMaintenanceOpen : isServiceNowGroup ? setServicenowOpen : setBugFeatureOpen
              const setFlyoutAnchor = isSiteRepositoryGroup ? setSiteRepositoryFlyoutAnchor : isWikiGroup ? setWikiFlyoutAnchor : isMaintenanceGroup ? setMaintenanceFlyoutAnchor : isServiceNowGroup ? setServicenowFlyoutAnchor : setBugFeatureFlyoutAnchor
              const flyoutLabel = isSiteRepositoryGroup ? 'Site Repository' : isWikiGroup ? 'Knowledge' : isMaintenanceGroup ? 'Manutenzione' : isServiceNowGroup ? 'ServiceNow' : 'Bug / Feature'
              const canExpand = !isMini && children.length > 0

              return (
                <React.Fragment key={it.path}>
                  {renderNavItem(it, isMini, {
                    selected: parentSelected,
                    variant: 'group-parent',
                    onClick: isMini
                      ? () => {
                          clearFlyoutCloseTimer()
                          setFlyoutAnchor(null)
                          nav({ pathname: it.path, search: '' })
                          setMobileOpen(false)
                        }
                      : undefined,
                    onMouseEnter: isMini && children.length > 0
                      ? (event) => {
                          clearFlyoutCloseTimer()
                          setFlyoutAnchor(event.currentTarget)
                        }
                      : undefined,
                    onMouseLeave: isMini && children.length > 0
                      ? () => scheduleFlyoutClose(setFlyoutAnchor)
                      : undefined,
                    endAdornment: canExpand ? (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {isBugFeatureGroup ? renderFeedbackCount(feedbackSummary?.open_count, 'open') : null}
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setGroupOpen((open) => !open)
                          }}
                          sx={{
                            color: parentSelected ? SIDEBAR.accentLight : SIDEBAR.textMuted,
                            '&:hover': { backgroundColor: SIDEBAR.hoverBg },
                          }}
                          aria-label={groupOpen ? `Chiudi sottomenu ${flyoutLabel}` : `Apri sottomenu ${flyoutLabel}`}
                        >
                          {groupOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Stack>
                    ) : null,
                  })}

                  {!isMini && children.length > 0 ? (
                    <Collapse in={groupOpen} timeout="auto" unmountOnExit>
                      <Box
                        sx={{
                          mt: 0.25,
                          ml: 1,
                          mr: 0.25,
                          mb: 0.5,
                          px: 0.75,
                          py: 0.75,
                          borderRadius: 1,
                          backgroundColor: 'rgba(94,234,212,0.08)',
                          boxShadow: 'inset 0 0 0 1px rgba(94,234,212,0.1)',
                        }}
                      >
                        <List disablePadding sx={{ display: 'grid', gap: 0.35 }}>
                          {children.map((child) => {
                            const nestedSelected = child.path === '/wiki'
                              ? isWikiPagesSelected
                              : child.path === '/wiki/stats'
                                ? isWikiStatsSelected
                                : child.path === '/wiki/queries'
                                  ? isWikiQueriesSelected
                                  : child.path === '/bug-feature'
                                    ? isBugFeatureOpenSelected
                                    : child.path === '/bug-feature/resolved'
                                      ? isBugFeatureResolvedSelected
                                      : child.path === '/maintenance'
                                        ? loc.pathname === '/maintenance'
                                        : isSelected(loc.pathname, child.path)

                            return (
                              <React.Fragment key={child.path}>
                                {renderNavItem(child, isMini, {
                                  nested: true,
                                  selected: nestedSelected,
                                  endAdornment:
                                    child.path === '/bug-feature'
                                      ? renderFeedbackCount(feedbackSummary?.open_count, 'open')
                                      : undefined,
                                })}
                              </React.Fragment>
                            )
                          })}
                        </List>
                      </Box>
                    </Collapse>
                  ) : null}
                </React.Fragment>
              )
            })

            return [sectionLabel, ...items].filter(Boolean)
          })
        })()}
      </List>

      <Box sx={{ flex: 1 }} />
    </Box>
  )

  return (
    <DashboardEditModeProvider>
    <SiteRepoV2Provider>
    <Box
      sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}
    >
      <DevEnvironmentBadge />
      {/* AppBar FULL WIDTH */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: '100%',
          left: 0,
          right: 0,
          flexDirection: 'column',
          '& .MuiIconButton-root': { color: SIDEBAR.textStrong },
          '& .MuiIconButton-root:hover': { color: (theme) => theme.palette.common.white, backgroundColor: 'rgba(255,255,255,0.12)' },
          '& .MuiInputBase-root': { color: (theme) => theme.palette.common.white },
        }}
      >
        <Toolbar sx={{ pl: 2, pr: 1, gap: 1 }}>
          {/* spacer: allinea contenuti dopo la sidebar su desktop */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: sidebarWidth, flexShrink: 0 }} />

          {/* LEFT */}
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

          {/* RIGHT */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            {/* Global search */}
            <GlobalSearch onEggTrigger={openEgg} />

            {/* Maintenance notification bell */}
            <NotificationsBell enabled={Boolean(me)} />

            {/* User avatar dopo search/+ */}
            <Tooltip title={displayName}>
              <IconButton onClick={(e) => setUserAnchorEl(e.currentTarget)} aria-label="User menu" sx={{ mr: 0.5 }}>
                <Avatar
                  src={me?.profile?.avatar || undefined}
                  sx={{ width: 28, height: 28, fontWeight: 800, border: SIDEBAR.activeBorder }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
        <SiteRepoV2Toolbar_Shell loc={loc.pathname} sidebarWidth={sidebarWidth} />
      </AppBar>

      <NavGroupFlyout
        open={wikiFlyoutOpen}
        anchorEl={wikiFlyoutAnchor}
        onClose={() => setWikiFlyoutAnchor(null)}
        onMouseEnter={clearFlyoutCloseTimer}
        onMouseLeave={() => scheduleFlyoutClose(setWikiFlyoutAnchor)}
        label="WIKI"
        items={visibleWikiChildren}
        renderItem={(child) => renderNavItem(child, false, {
          nested: true,
          selected: child.path === '/wiki' ? isWikiPagesSelected : child.path === '/wiki/queries' ? isWikiQueriesSelected : isWikiStatsSelected,
          onClick: () => {
            setWikiFlyoutAnchor(null)
            nav(child.path)
          },
        })}
      />

      <NavGroupFlyout
        open={bugFeatureFlyoutOpen}
        anchorEl={bugFeatureFlyoutAnchor}
        onClose={() => setBugFeatureFlyoutAnchor(null)}
        onMouseEnter={clearFlyoutCloseTimer}
        onMouseLeave={() => scheduleFlyoutClose(setBugFeatureFlyoutAnchor)}
        label="BUG / FEATURE"
        items={visibleBugFeatureChildren}
        renderItem={(child) => renderNavItem(child, false, {
          nested: true,
          selected: child.path === '/bug-feature' ? isBugFeatureOpenSelected : isBugFeatureResolvedSelected,
          endAdornment:
            child.path === '/bug-feature'
              ? renderFeedbackCount(feedbackSummary?.open_count, 'open')
              : undefined,
          onClick: () => {
            setBugFeatureFlyoutAnchor(null)
            nav(child.path)
          },
        })}
      />

      {/* ServiceNow group flyout (mini sidebar) */}
      <NavGroupFlyout
        open={servicenowFlyoutOpen}
        anchorEl={servicenowFlyoutAnchor}
        onClose={() => setServicenowFlyoutAnchor(null)}
        onMouseEnter={clearFlyoutCloseTimer}
        onMouseLeave={() => scheduleFlyoutClose(setServicenowFlyoutAnchor)}
        label="SERVICENOW"
        items={visibleServiceNowChildren}
        renderItem={(child) => renderNavItem(child, false, {
          nested: true,
          selected: isSelected(loc.pathname, child.path),
          onClick: () => {
            setServicenowFlyoutAnchor(null)
            nav(child.path)
          },
        })}
      />

      {/* Maintenance group flyout (mini sidebar) */}
      <NavGroupFlyout
        open={maintenanceFlyoutOpen}
        anchorEl={maintenanceFlyoutAnchor}
        onClose={() => setMaintenanceFlyoutAnchor(null)}
        onMouseEnter={clearFlyoutCloseTimer}
        onMouseLeave={() => scheduleFlyoutClose(setMaintenanceFlyoutAnchor)}
        label="MANUTENZIONE"
        items={visibleMaintenanceChildren}
        renderItem={(child) => renderNavItem(child, false, {
          nested: true,
          selected: child.path === '/maintenance'
            ? loc.pathname === '/maintenance'
            : isSelected(loc.pathname, child.path),
          onClick: () => {
            setMaintenanceFlyoutAnchor(null)
            nav(child.path)
          },
        })}
      />

      {/* Site Repository group flyout (mini sidebar) */}
      <NavGroupFlyout
        open={siteRepositoryFlyoutOpen}
        anchorEl={siteRepositoryFlyoutAnchor}
        onClose={() => setSiteRepositoryFlyoutAnchor(null)}
        onMouseEnter={clearFlyoutCloseTimer}
        onMouseLeave={() => scheduleFlyoutClose(setSiteRepositoryFlyoutAnchor)}
        label="SITE REPOSITORY"
        items={visibleSiteRepositoryChildren}
        renderItem={(child) => renderNavItem(child, false, {
          nested: true,
          selected: isSelected(loc.pathname, child.path),
          onClick: () => {
            setSiteRepositoryFlyoutAnchor(null)
            nav(child.path)
          },
        })}
      />

      {/* User menu */}
      <Menu
        anchorEl={userAnchorEl}
        open={userMenuOpen}
        onClose={() => setUserAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 160,
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
        <DashboardEditToggleMenuItem
          isDashboardRoute={loc.pathname === '/'}
          onClose={() => setUserAnchorEl(null)}
        />

        <MenuItem
          onClick={() => {
            setUserAnchorEl(null)
            setProfileOpen(true)
          }}
          sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5 }}
        >
          <SettingsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          Impostazioni
        </MenuItem>

        <MenuItem
          onClick={() => {
            setUserAnchorEl(null)
            setChangelogOpen(true)
          }}
          sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5 }}
        >
          <HistoryRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          Changelog
        </MenuItem>

        {hasPerm('core.manage_users') && (
          <MenuItem
            onClick={() => {
              setUserAnchorEl(null)
              nav('/utenti')
            }}
            sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5 }}
          >
            <GroupOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            Utenti e Gruppi
          </MenuItem>
        )}

        <MenuItem
          onClick={async () => {
            setUserAnchorEl(null)
            await handleLogout()
          }}
          sx={{ fontSize: 13, py: 0.9, px: 2, minHeight: 0, gap: 1.5 }}
        >
          <LogoutIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Drawer desktop (mini-variant) */}
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
        {drawer(mini)}
      </Drawer>

      {/* Drawer mobile (sempre full) */}
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
        {drawer(false)}
      </Drawer>

      {/* Content + footer sticky */}
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
        {loc.pathname === '/site-repository' && <Box sx={{ height: 56, flexShrink: 0 }} />}

        <Box sx={{ p: { xs: 2, md: 3 }, pb: { xs: 10, md: 3 }, flex: 1, overflowY: 'auto', minHeight: 0, bgcolor: 'background.default' }}>
          <DashboardEditModeRouteGuard isDashboardRoute={loc.pathname === '/'} />
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
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
          bgcolor: 'rgba(0,0,0,0.45)',
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
    </SiteRepoV2Provider>
    </DashboardEditModeProvider>
  )
}
