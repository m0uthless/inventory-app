import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import LogoutIcon from '@mui/icons-material/Logout'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import SettingsIcon from '@mui/icons-material/Settings'

import FolderIcon from '@mui/icons-material/FolderOutlined'
import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import LayersIcon from '@mui/icons-material/Layers'
import HistoryIcon from '@mui/icons-material/HistoryOutlined'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import HandymanIcon from '@mui/icons-material/HandymanOutlined'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import DoneAllIcon from '@mui/icons-material/DoneAllOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import TerminalIcon from '@mui/icons-material/TerminalOutlined'
import { Backdrop, Fade, Zoom } from '@mui/material'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import AppFooter from './AppFooter'
import AppSpeedDial from './AppSpeedDial'
import { SIDEBAR } from '../theme/tokens'
import { useIdleTimer } from '../hooks/useIdleTimer'
import LockScreen from '../ui/LockScreen'

const ProfileDrawer = React.lazy(() =>
  import('../pages/Profile').then((m) => ({ default: m.ProfileDrawer })),
)

const drawerWidth = 208
const collapsedWidth = 58

type NavItem = {
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


const MAINTENANCE_CHILDREN: NavItem[] = [
  { label: 'Scadenze', path: '/maintenance', icon: <HandymanIcon />, permAny: ['maintenance.view_maintenanceplan'] },
  { label: 'Piani', path: '/maintenance/plans', icon: <BuildOutlinedIcon />, perm: 'maintenance.view_maintenanceplan' },
  { label: 'Rapportini', path: '/maintenance/rapportini', icon: <CheckCircleOutlineIcon />, perm: 'maintenance.view_maintenanceevent' },
]

const WIKI_CHILDREN: NavItem[] = [
  { label: 'Wiki', path: '/wiki', icon: <MenuBookIcon />, perm: 'wiki.view_wikipage' },
  { label: 'Query', path: '/wiki/queries', icon: <TerminalIcon />, perm: 'wiki.view_wikiquery' },
  { label: 'Statistiche', path: '/wiki/stats', icon: <BarChartOutlinedIcon />, perm: 'wiki.view_wikipage' },
]

const BUG_FEATURE_CHILDREN: NavItem[] = [
  { label: 'Aperte', path: '/bug-feature', icon: <FeedbackOutlinedIcon /> },
  { label: 'Risolte', path: '/bug-feature/resolved', icon: <DoneAllIcon /> },
]

const NAV: NavItem[] = [
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

function isSelected(currentPath: string, itemPath: string) {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}


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

export function AppLayout() {
  const { me, logout, hasPerm, locked, lock, unlock } = useAuth()

  const { resetAfterUnlock } = useIdleTimer({
    lockAfterMs:   15 * 60 * 1000, // 15 minuti → lock screen
    logoutAfterMs: 60 * 60 * 1000, // 60 minuti → logout automatico
    enabled: Boolean(me),
    onLock: lock,
    onLogout: async () => {
      try {
        const { api } = await import('../api/client')
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

  const EGG_TRIGGER = 'supertennis'
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

  // Global search
  const [globalQ, setGlobalQ] = React.useState('')
  const goGlobalSearch = React.useCallback(() => {
    const q = globalQ.trim()
    if (q.toLowerCase() === EGG_TRIGGER) {
      openEgg()
      setGlobalQ('') // opzionale: pulisce la barra
      return // non naviga alla search
    }
    if (!q) {
      nav('/search')
      return
    }
    // Canonical query param is `search` (legacy `q` removed)
    nav(`/search?search=${encodeURIComponent(q)}`)
  }, [globalQ, nav, openEgg])

  // Drawer mobile
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // ── Maintenance notifications ──────────────────────────────────────────────
  type DueItem = {
    plan_id: number
    plan_title: string
    inventory_id: number
    inventory_name: string
    customer_name: string
    customer_code: string
    site_name?: string | null
    knumber?: string | null
    hostname?: string | null
    type_label?: string | null
    next_due_date: string
    due_date_override?: string | null
    days_left: number
  }
  const [duePlans, setDuePlans] = React.useState<DueItem[]>([])
  const [notifAnchor, setNotifAnchor] = React.useState<null | HTMLElement>(null)

  React.useEffect(() => {
    if (!me) return
    const fetchDue = () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const in30Date = new Date(today)
      in30Date.setDate(in30Date.getDate() + 30)
      const in30 = in30Date.toLocaleDateString('en-CA') // YYYY-MM-DD locale-safe
      // Usa il todo endpoint: ritorna singoli inventory (non piani aggregati)
      // Solo inventory in scadenza nei prossimi 30 giorni (esclusi gli scaduti)
      const todayStr = today.toLocaleDateString('en-CA')
      api.get('/maintenance-plans/todo/', {
        params: { due_from: todayStr, due_to: in30, ordering: 'next_due_date', page_size: 40 },
      })
        .then((res) => {
          const rows = res.data?.results ?? []
          const enriched = rows.map((r: Record<string, unknown>) => {
            const due = new Date(String(r.next_due_date))
            due.setHours(0, 0, 0, 0)
            const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
            return { ...r, days_left: diff } as DueItem
          })
          // Ordina: scaduti prima, poi per data
          enriched.sort((a: DueItem, b: DueItem) => a.days_left - b.days_left)
          setDuePlans(enriched)
        })
        .catch(() => {})
    }
    fetchDue()
    const interval = setInterval(fetchDue, 5 * 60 * 1000)
    // Aggiorna la bell quando DueDateOverrideDialog salva un override
    window.addEventListener('maintenance-due-date-changed', fetchDue)
    return () => {
      clearInterval(interval)
      window.removeEventListener('maintenance-due-date-changed', fetchDue)
    }
  }, [me])

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


  const wikiSectionActive = React.useMemo(
    () => ['/wiki', '/wiki/stats', '/wiki/queries'].some((path) => isSelected(loc.pathname, path)),
    [loc.pathname],
  )
  const [wikiOpen, setWikiOpen] = React.useState(() => {
    const v = localStorage.getItem('wiki_nav_open')
    return v ? v === '1' : true
  })
  const [wikiFlyoutAnchor, setWikiFlyoutAnchor] = React.useState<null | HTMLElement>(null)
  const wikiFlyoutOpen = Boolean(wikiFlyoutAnchor)
  const bugFeatureSectionActive = React.useMemo(
    () => ['/bug-feature', '/bug-feature/resolved'].some((path) => isSelected(loc.pathname, path)),
    [loc.pathname],
  )
  const [bugFeatureOpen, setBugFeatureOpen] = React.useState(() => {
    const v = localStorage.getItem('bug_feature_nav_open')
    return v ? v === '1' : true
  })
  const [bugFeatureFlyoutAnchor, setBugFeatureFlyoutAnchor] = React.useState<null | HTMLElement>(null)
  const bugFeatureFlyoutOpen = Boolean(bugFeatureFlyoutAnchor)

  const maintenanceSectionActive = React.useMemo(
    () => ['/maintenance', '/maintenance/plans', '/maintenance/rapportini'].some((path) => isSelected(loc.pathname, path)),
    [loc.pathname],
  )
  const [maintenanceOpen, setMaintenanceOpen] = React.useState(() => {
    const v = localStorage.getItem('maintenance_nav_open')
    return v ? v === '1' : true
  })
  const [maintenanceFlyoutAnchor, setMaintenanceFlyoutAnchor] = React.useState<null | HTMLElement>(null)
  const maintenanceFlyoutOpen = Boolean(maintenanceFlyoutAnchor)


  React.useEffect(() => {
    localStorage.setItem('wiki_nav_open', wikiOpen ? '1' : '0')
  }, [wikiOpen])

  React.useEffect(() => {
    localStorage.setItem('bug_feature_nav_open', bugFeatureOpen ? '1' : '0')
  }, [bugFeatureOpen])

  React.useEffect(() => {
    localStorage.setItem('maintenance_nav_open', maintenanceOpen ? '1' : '0')
  }, [maintenanceOpen])


  React.useEffect(() => {
    if (wikiSectionActive) {
      setWikiOpen(true)
    }
  }, [wikiSectionActive])

  React.useEffect(() => {
    if (bugFeatureSectionActive) {
      setBugFeatureOpen(true)
    }
  }, [bugFeatureSectionActive])

  React.useEffect(() => {
    if (maintenanceSectionActive) {
      setMaintenanceOpen(true)
    }
  }, [maintenanceSectionActive])

  React.useEffect(() => {
    setWikiFlyoutAnchor(null)
    setBugFeatureFlyoutAnchor(null)
    setMaintenanceFlyoutAnchor(null)

    // Chiudi automaticamente i gruppi che non contengono la rotta corrente.
    if (!wikiSectionActive)           setWikiOpen(false)
    if (!bugFeatureSectionActive)     setBugFeatureOpen(false)
    if (!maintenanceSectionActive)    setMaintenanceOpen(false)
  }, [loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!mini) {
      setWikiFlyoutAnchor(null)
      setBugFeatureFlyoutAnchor(null)
    }
  }, [mini])

  const pageTitle = React.useMemo(() => {
    const path = loc.pathname
    if (path === '/') return 'DASHBOARD'
    if (path === '/customers' || path.startsWith('/customers/')) return 'CLIENTI'
    if (path === '/sites' || path.startsWith('/sites/')) return 'SITI'
    if (path === '/contacts' || path.startsWith('/contacts/')) return 'CONTATTI'
    if (path === '/site-repository' || path.startsWith('/site-repository/')) return 'SITE REPOSITORY'
    if (path === '/inventory' || path.startsWith('/inventory/')) return 'INVENTARI'
    if (path === '/trash' || path.startsWith('/trash/')) return 'CESTINO'
    if (path === '/issues' || path.startsWith('/issues/')) return 'ISSUES'
    if (path === '/bug-feature/resolved' || path.startsWith('/bug-feature/resolved/')) return 'BUG / FEATURE · RESOLVED'
    if (path === '/bug-feature' || path.startsWith('/bug-feature/')) return 'BUG / FEATURE'
    if (path === '/audit' || path.startsWith('/audit/')) return 'AUDIT'
    if (path === '/drive' || path.startsWith('/drive/')) return 'DRIVE'
    if (path === '/maintenance/plans') return 'MANUTENZIONE · PIANI'
    if (path === '/maintenance/rapportini') return 'MANUTENZIONE · RAPPORTINI'
    if (path === '/maintenance' || path.startsWith('/maintenance/')) return 'MANUTENZIONE'
    if (path === '/search' || path.startsWith('/search/')) return 'RICERCA'
    if (path === '/profile' || path.startsWith('/profile/')) return 'PROFILO'
    if (path === '/wiki' || path.startsWith('/wiki/')) {
      if (path === '/wiki/stats' || path.startsWith('/wiki/stats/')) return 'KNOWLEDGE · STATISTICHE'
      if (path === '/wiki/queries' || path.startsWith('/wiki/queries/')) return 'KNOWLEDGE · QUERY'
      return 'KNOWLEDGE · WIKI'
    }
    return ''
  }, [loc.pathname])

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

  const renderFeedbackCount = React.useCallback((count?: number | null, tone: 'open' | 'resolved' = 'open') => {
    if (!count) return null
    return (
      <Chip
        size="small"
        label={count > 99 ? '99+' : count}
        sx={{
          height: 20,
          fontSize: '0.72rem',
          fontWeight: 800,
          borderRadius: 1.25,
          color: tone === 'open' ? SIDEBAR.accentBright : SIDEBAR.textStrong,
          bgcolor: tone === 'open' ? SIDEBAR.selectedBgHover : SIDEBAR.chipBg,
          border: '1px solid',
          borderColor: tone === 'open' ? SIDEBAR.chipBorderOpen : SIDEBAR.chipBorder,
          '& .MuiChip-label': { px: 0.9 },
        }}
      />
    )
  }, [])

  const renderIssueCount = React.useCallback((count?: number | null) => {
    if (!count) return null
    return (
      <Chip
        size="small"
        label={count > 99 ? '99+' : count}
        sx={{
          height: 20,
          fontSize: '0.72rem',
          fontWeight: 800,
          borderRadius: 1.25,
          color: SIDEBAR.accentBright,
          bgcolor: SIDEBAR.selectedBgHover,
          border: '1px solid',
          borderColor: SIDEBAR.chipBorderOpen,
          '& .MuiChip-label': { px: 0.9 },
        }}
      />
    )
  }, [])


  const renderNavItem = (
    it: NavItem,
    isMini: boolean,
    options?: {
      selected?: boolean
      nested?: boolean
      onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
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
          nav(it.path)
          setMobileOpen(false)
        }}
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
                color: '#ffffff',
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
                    color: '#f59e0b',
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

              if (!isSiteRepositoryGroup && !isWikiGroup && !isBugFeatureGroup && !isMaintenanceGroup) {
                const issueEndAdornment =
                  it.path === '/issues' ? renderIssueCount(issueSummary?.active_count) : null
                return (
                  <React.Fragment key={it.path}>
                    {renderNavItem(it, isMini, issueEndAdornment ? { endAdornment: issueEndAdornment } : undefined)}
                  </React.Fragment>
                )
              }

              // Site Repository è ora un link diretto (senza sotto-elementi)
              if (isSiteRepositoryGroup) {
                return (
                  <React.Fragment key={it.path}>
                    {renderNavItem(it, isMini)}
                  </React.Fragment>
                )
              }

              const children = isWikiGroup
                  ? visibleWikiChildren
                  : isMaintenanceGroup
                    ? visibleMaintenanceChildren
                    : visibleBugFeatureChildren
              const parentSelected = isWikiGroup
                  ? wikiSectionActive
                  : isMaintenanceGroup
                    ? maintenanceSectionActive
                    : bugFeatureSectionActive
              const groupOpen = isWikiGroup ? wikiOpen : isMaintenanceGroup ? maintenanceOpen : bugFeatureOpen
              const setGroupOpen = isWikiGroup ? setWikiOpen : isMaintenanceGroup ? setMaintenanceOpen : setBugFeatureOpen
              const setFlyoutAnchor = isWikiGroup ? setWikiFlyoutAnchor : isMaintenanceGroup ? setMaintenanceFlyoutAnchor : setBugFeatureFlyoutAnchor
              const flyoutLabel = isWikiGroup ? 'Knowledge' : isMaintenanceGroup ? 'Manutenzione' : 'Bug / Feature'
              const canExpand = !isMini && children.length > 0

              return (
                <React.Fragment key={it.path}>
                  {renderNavItem(it, isMini, {
                    selected: parentSelected,
                    variant: 'group-parent',
                    onClick: isMini
                      ? (event) => {
                          if (!children.length) {
                            nav(it.path)
                            setMobileOpen(false)
                            return
                          }
                          setFlyoutAnchor((current) => (current === event.currentTarget ? null : event.currentTarget))
                        }
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
    <Box
      sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}
    >
      {/* AppBar FULL WIDTH */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: '100%',
          left: 0,
          right: 0,
          '& .MuiIconButton-root': { color: SIDEBAR.textStrong },
          '& .MuiIconButton-root:hover': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.12)' },
          '& .MuiInputBase-root': { color: '#ffffff' },
        }}
      >
        <Toolbar sx={{ pl: 2, pr: 0, gap: 1, position: 'relative' }}>
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
                }}
              >
                {pageTitle}
              </Typography>
            )}
          </Box>

          {/* RIGHT */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            {/* Global search (desktop) */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, width: { sm: 216, md: 312 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Cerca…"
                value={globalQ}
                onChange={(e) => setGlobalQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    goGlobalSearch()
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: globalQ ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Cancella ricerca"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setGlobalQ('')}
                        edge="end"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1,
                    backgroundColor: SIDEBAR.chipBg,
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
                    '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
                    '& .MuiInputAdornment-root svg': { color: SIDEBAR.textDefault },
                    '& input::placeholder': { color: SIDEBAR.textMuted, opacity: 1 },
                  },
                }}
              />
            </Box>

            {/* Global search (mobile) */}
            <IconButton
              onClick={() => nav('/search')}
              sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
              aria-label="Ricerca"
            >
              <SearchIcon />
            </IconButton>

            {/* Maintenance notification bell */}
            <Tooltip
              title={
                duePlans.length
                  ? `${duePlans.length} scadenz${duePlans.length === 1 ? 'a' : 'e'} imminenti`
                  : 'Nessuna scadenza imminente'
              }
            >
              <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)} size="small">
                <Badge badgeContent={duePlans.length || null} color="warning" max={99}>
                  <NotificationsOutlinedIcon
                    fontSize="small"
                    sx={{ color: duePlans.length ? 'warning.main' : 'inherit' }}
                  />
                </Badge>
              </IconButton>
            </Tooltip>

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
      </AppBar>

      <Popover
        open={wikiFlyoutOpen}
        anchorEl={wikiFlyoutAnchor}
        onClose={() => setWikiFlyoutAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            ml: 1,
            mt: -0.25,
            minWidth: 248,
            borderRadius: 1,
            overflow: 'hidden',
            background: SIDEBAR.bgGradient,
            color: '#ffffff',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(94,234,212,0.12)',
          },
        }}
      >
        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 1,
              pb: 0.75,
              color: SIDEBAR.textMuted,
              letterSpacing: '0.16em',
              fontWeight: 800,
            }}
          >
            WIKI
          </Typography>

          <List disablePadding sx={{ display: 'grid', gap: 0.35 }}>
            {visibleWikiChildren.map((child) => (
              <React.Fragment key={`wiki-flyout-${child.path}`}>
                {renderNavItem(child, false, {
                  nested: true,
                  selected: child.path === '/wiki' ? isWikiPagesSelected : child.path === '/wiki/queries' ? isWikiQueriesSelected : isWikiStatsSelected,
                  onClick: () => {
                    setWikiFlyoutAnchor(null)
                    nav(child.path)
                  },
                })}
              </React.Fragment>
            ))}
          </List>
        </Box>
      </Popover>

      <Popover
        open={bugFeatureFlyoutOpen}
        anchorEl={bugFeatureFlyoutAnchor}
        onClose={() => setBugFeatureFlyoutAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            ml: 1,
            mt: -0.25,
            minWidth: 248,
            borderRadius: 1,
            overflow: 'hidden',
            background: SIDEBAR.bgGradient,
            color: '#ffffff',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(94,234,212,0.12)',
          },
        }}
      >
        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 1,
              pb: 0.75,
              color: SIDEBAR.textMuted,
              letterSpacing: '0.16em',
              fontWeight: 800,
            }}
          >
            BUG / FEATURE
          </Typography>

          <List disablePadding sx={{ display: 'grid', gap: 0.35 }}>
            {visibleBugFeatureChildren.map((child) => (
              <React.Fragment key={`bugfeature-flyout-${child.path}`}>
                {renderNavItem(child, false, {
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
              </React.Fragment>
            ))}
          </List>
        </Box>
      </Popover>

      {/* Maintenance group flyout (mini sidebar) */}
      <Popover
        open={maintenanceFlyoutOpen}
        anchorEl={maintenanceFlyoutAnchor}
        onClose={() => setMaintenanceFlyoutAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            ml: 1,
            mt: -0.25,
            minWidth: 248,
            borderRadius: 1,
            overflow: 'hidden',
            background: SIDEBAR.bgGradient,
            color: '#ffffff',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(94,234,212,0.12)',
          },
        }}
      >
        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 1,
              pb: 0.75,
              color: SIDEBAR.textMuted,
              letterSpacing: '0.16em',
              fontWeight: 800,
            }}
          >
            MANUTENZIONE
          </Typography>
          <List disablePadding sx={{ display: 'grid', gap: 0.35 }}>
            {visibleMaintenanceChildren.map((child) => (
              <React.Fragment key={`maintenance-flyout-${child.path}`}>
                {renderNavItem(child, false, {
                  nested: true,
                  selected: child.path === '/maintenance'
                    ? loc.pathname === '/maintenance'
                    : isSelected(loc.pathname, child.path),
                  onClick: () => {
                    setMaintenanceFlyoutAnchor(null)
                    nav(child.path)
                  },
                })}
              </React.Fragment>
            ))}
          </List>
        </Box>
      </Popover>

      {/* Maintenance notifications popover */}
      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, borderRadius: 1, mt: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Scadenze manutenzione
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Inventory in scadenza entro 30 giorni
          </Typography>
        </Box>
        {duePlans.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              ✅ Nessuna scadenza imminente
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Stack divider={<Divider />}>
              {duePlans.map((item) => (
                <ListItemButton
                  key={`${item.plan_id}-${item.inventory_id}`}
                  onClick={() => { setNotifAnchor(null); nav('/maintenance') }}
                  sx={{ px: 2, py: 1 }}
                >
                  <BuildOutlinedIcon
                    sx={{
                      fontSize: 16,
                      color: item.days_left < 0 ? 'error.main' : item.days_left <= 7 ? 'warning.main' : 'info.main',
                      mr: 1.25,
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                      {item.inventory_name}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.15 }}>
                      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontSize: '0.7rem', maxWidth: 120 }}>
                        {item.customer_name}
                      </Typography>
                      {item.type_label && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>·</Typography>
                          <Typography variant="caption" noWrap sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                            {item.type_label}
                          </Typography>
                        </>
                      )}
                      {(item.knumber || item.hostname) && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>·</Typography>
                          <Typography variant="caption" noWrap sx={{ color: 'text.disabled', fontSize: '0.7rem', fontFamily: 'ui-monospace,monospace' }}>
                            {item.knumber || item.hostname}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Box>
                  <Chip
                    size="small"
                    label={
                      item.days_left < 0
                        ? `${Math.abs(item.days_left)}gg fa`
                        : item.days_left === 0
                          ? 'Oggi'
                          : item.days_left === 1
                            ? 'Domani'
                            : `${item.days_left}gg`
                    }
                    color={item.days_left < 0 ? 'error' : item.days_left <= 7 ? 'warning' : 'default'}
                    variant={item.days_left < 0 ? 'filled' : 'outlined'}
                    sx={{ fontSize: '0.68rem', ml: 1, flexShrink: 0, height: 20 }}
                  />
                </ListItemButton>
              ))}
            </Stack>
          </Box>
        )}
        <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <ListItemButton
            onClick={() => { setNotifAnchor(null); nav('/maintenance') }}
            sx={{ borderRadius: 1.5, justifyContent: 'center' }}
          >
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
              Vai alle scadenze →
            </Typography>
          </ListItemButton>
        </Box>
      </Popover>

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

        <Box sx={{ p: { xs: 2, md: 3 }, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
      <AppSpeedDial />
      <LockScreen open={locked} onUnlock={handleUnlock} />
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
                  borderRadius: 1,
                  overflow: 'hidden',
                  boxShadow: 24,
                  transform: 'rotate(-1deg)',
                  width: { xs: '85vw', sm: 416 },
                  maxWidth: 720,
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
                  sx={{ display: 'block', width: '100%' }}
                />

                {/* cornice teal “glow” */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid rgba(14,165,164,0.75)',
                    boxShadow: '0 0 0 2px rgba(15,118,110,0.25) inset',
                    pointerEvents: 'none',
                  }}
                />
              </Box>
            </Zoom>
          </Box>
        </Fade>
      </Backdrop>

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
                  borderRadius: 1,
                  overflow: 'hidden',
                  boxShadow: 24,
                  transform: 'rotate(-1deg)',
                  width: { xs: '85vw', sm: 416 },
                  maxWidth: 720,
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
                  sx={{ display: 'block', width: '100%' }}
                />

                {/* cornice teal “glow” */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid rgba(14,165,164,0.75)',
                    boxShadow: '0 0 0 2px rgba(15,118,110,0.25) inset',
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
      </React.Suspense>
    </Box>
  )
}
