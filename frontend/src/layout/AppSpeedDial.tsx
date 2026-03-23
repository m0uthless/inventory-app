import * as React from 'react'
import {
  Box,
  Button,
  ClickAwayListener,
  Fab,
  Fade,
  Paper,
  Stack,
  useTheme,
} from '@mui/material'
import { alpha, lighten } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined'
import PeopleIcon from '@mui/icons-material/People'
import BusinessIcon from '@mui/icons-material/Business'
import ContactsIcon from '@mui/icons-material/Contacts'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

type QuickAction = {
  key: string
  label: string
  to: string
  icon: React.ReactNode
  perm?: string
  openCreate?: boolean
  state?: Record<string, unknown>
  onlyWhen?: () => boolean
}

function pathStarts(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export default function AppSpeedDial() {
  const { hasPerm } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const theme = useTheme()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    setOpen(false)
  }, [loc.pathname])

  const actionBg = React.useMemo(
    () => lighten(theme.palette.primary.main, 0.72),
    [theme.palette.primary.main],
  )
  const actionBgHover = React.useMemo(
    () => lighten(theme.palette.primary.main, 0.66),
    [theme.palette.primary.main],
  )

  const canManageWikiCategories =
    hasPerm('wiki.add_wikicategory') || hasPerm('wiki.change_wikicategory') || hasPerm('wiki.delete_wikicategory')

  const allActions = React.useMemo<Record<string, QuickAction>>(
    () => ({
      newInventory: {
        key: 'newInventory',
        label: 'Nuovo inventario',
        to: '/inventory',
        perm: 'inventory.add_inventory',
        openCreate: true,
        icon: <Inventory2Icon sx={{ fontSize: 18 }} />,
      },
      newIssue: {
        key: 'newIssue',
        label: 'Nuova issue',
        to: '/issues',
        perm: 'issues.add_issue',
        openCreate: true,
        icon: <BugReportOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      newCustomer: {
        key: 'newCustomer',
        label: 'Nuovo cliente',
        to: '/customers',
        perm: 'crm.add_customer',
        openCreate: true,
        icon: <PeopleIcon sx={{ fontSize: 18 }} />,
      },
      newSite: {
        key: 'newSite',
        label: 'Nuovo sito',
        to: '/sites',
        perm: 'crm.add_site',
        openCreate: true,
        icon: <BusinessIcon sx={{ fontSize: 18 }} />,
      },
      newContact: {
        key: 'newContact',
        label: 'Nuovo contatto',
        to: '/contacts',
        perm: 'crm.add_contact',
        openCreate: true,
        icon: <ContactsIcon sx={{ fontSize: 18 }} />,
      },
      wikiCategories: {
        key: 'wikiCategories',
        label: 'Categorie wiki',
        to: '/wiki',
        state: { openCategoryManager: true },
        icon: <CategoryOutlinedIcon sx={{ fontSize: 18 }} />,
        onlyWhen: () => canManageWikiCategories,
      },
      newWikiPage: {
        key: 'newWikiPage',
        label: 'Nuova pagina wiki',
        to: '/wiki/new',
        perm: 'wiki.add_wikipage',
        icon: <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      newReportRequest: {
        key: 'newReportRequest',
        label: 'Report / Request',
        to: '/bug-feature',
        openCreate: true,
        icon: <FeedbackOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      search: {
        key: 'search',
        label: 'Ricerca globale',
        to: '/search',
        icon: <SearchIcon sx={{ fontSize: 18 }} />,
      },
    }),
    [canManageWikiCategories],
  )

  const actionOrder = React.useMemo(() => {
    if (loc.pathname === '/' || pathStarts(loc.pathname, '/site-repository')) {
      return ['newInventory', 'newIssue', 'newCustomer', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/inventory')) {
      return ['newInventory', 'newIssue', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/issues')) {
      return ['newIssue', 'newInventory', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/customers')) {
      return ['newCustomer', 'newSite', 'newContact', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/sites')) {
      return ['newSite', 'newContact', 'newCustomer', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/contacts')) {
      return ['newContact', 'newSite', 'newCustomer', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/wiki')) {
      return ['newWikiPage', 'wikiCategories', 'newReportRequest', 'search']
    }
    if (pathStarts(loc.pathname, '/bug-feature')) {
      return ['newReportRequest', 'search']
    }
    return ['newReportRequest', 'search']
  }, [loc.pathname])

  const actions = React.useMemo(
    () =>
      actionOrder
        .map((key) => allActions[key])
        .filter((action): action is QuickAction => Boolean(action))
        .filter((action) => (!action.perm || hasPerm(action.perm)) && (!action.onlyWhen || action.onlyWhen())),
    [actionOrder, allActions, hasPerm],
  )

  if (!actions.length) return null

  const handleActionClick = (action: QuickAction) => {
    setOpen(false)
    const state = action.openCreate ? { ...(action.state ?? {}), openCreate: true } : action.state
    nav(action.to, state ? { state } : undefined)
  }

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 24 },
          bottom: { xs: 16, md: 20 },
          zIndex: (t) => t.zIndex.appBar - 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1.25,
        }}
      >
        <Fade in={open} timeout={{ enter: 180, exit: 120 }} unmountOnExit>
          <Stack spacing={1.1} sx={{ alignItems: 'flex-end' }}>
            {actions.map((action) => (
              <Paper
                key={action.key}
                elevation={0}
                sx={{
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  boxShadow: '0 14px 24px -18px rgba(15, 118, 110, 0.50)',
                  overflow: 'hidden',
                  backgroundColor: 'transparent',
                }}
              >
                <Button
                  onClick={() => handleActionClick(action)}
                  endIcon={action.icon}
                  sx={{
                    minWidth: 0,
                    px: 1.75,
                    py: 1.1,
                    height: 46,
                    borderRadius: 1,
                    bgcolor: actionBg,
                    color: theme.palette.primary.dark,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    justifyContent: 'space-between',
                    gap: 1.2,
                    whiteSpace: 'nowrap',
                    '& .MuiButton-endIcon': {
                      ml: 0.9,
                      mr: 0,
                      color: theme.palette.primary.main,
                    },
                    '&:hover': {
                      bgcolor: actionBgHover,
                      boxShadow: 'none',
                    },
                  }}
                >
                  {action.label}
                </Button>
              </Paper>
            ))}
          </Stack>
        </Fade>

        <Fab
          color="primary"
          aria-label={open ? 'Chiudi azioni rapide' : 'Apri azioni rapide'}
          onClick={() => setOpen((current) => !current)}
          sx={{
            width: 58,
            height: 58,
            boxShadow: '0 18px 30px -18px rgba(15, 118, 110, 0.65)',
          }}
        >
          <AddIcon
            sx={{
              fontSize: 28,
              transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 180ms ease',
            }}
          />
        </Fab>
      </Box>
    </ClickAwayListener>
  )
}
