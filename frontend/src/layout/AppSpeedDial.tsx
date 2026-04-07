import * as React from 'react'
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
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
import { useTheme } from '@mui/material/styles'

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

  const primary = theme.palette.primary.main
  const primaryDark = theme.palette.primary.dark

  const canManageWikiCategories =
    hasPerm('wiki.add_wikicategory') ||
    hasPerm('wiki.change_wikicategory') ||
    hasPerm('wiki.delete_wikicategory')

  const allActions = React.useMemo<Record<string, QuickAction>>(
    () => ({
      newInventory: {
        key: 'newInventory',
        label: 'Nuovo inventario',
        to: '/inventory',
        perm: 'inventory.add_inventory',
        openCreate: true,
        icon: <Inventory2Icon sx={{ fontSize: 20 }} />,
      },
      newIssue: {
        key: 'newIssue',
        label: 'Nuova issue',
        to: '/issues',
        perm: 'issues.add_issue',
        openCreate: true,
        icon: <BugReportOutlinedIcon sx={{ fontSize: 20 }} />,
      },
      newCustomer: {
        key: 'newCustomer',
        label: 'Nuovo cliente',
        to: '/customers',
        perm: 'crm.add_customer',
        openCreate: true,
        icon: <PeopleIcon sx={{ fontSize: 20 }} />,
      },
      newSite: {
        key: 'newSite',
        label: 'Nuovo sito',
        to: '/sites',
        perm: 'crm.add_site',
        openCreate: true,
        icon: <BusinessIcon sx={{ fontSize: 20 }} />,
      },
      newContact: {
        key: 'newContact',
        label: 'Nuovo contatto',
        to: '/contacts',
        perm: 'crm.add_contact',
        openCreate: true,
        icon: <ContactsIcon sx={{ fontSize: 20 }} />,
      },
      wikiCategories: {
        key: 'wikiCategories',
        label: 'Categorie wiki',
        to: '/wiki',
        state: { openCategoryManager: true },
        icon: <CategoryOutlinedIcon sx={{ fontSize: 20 }} />,
        onlyWhen: () => canManageWikiCategories,
      },
      newWikiPage: {
        key: 'newWikiPage',
        label: 'Nuova pagina wiki',
        to: '/wiki/new',
        perm: 'wiki.add_wikipage',
        icon: <DescriptionOutlinedIcon sx={{ fontSize: 20 }} />,
      },
      newReportRequest: {
        key: 'newReportRequest',
        label: 'Report / Request',
        to: '/bug-feature',
        openCreate: true,
        icon: <FeedbackOutlinedIcon sx={{ fontSize: 20 }} />,
      },
      search: {
        key: 'search',
        label: 'Ricerca globale',
        to: '/search',
        icon: <SearchIcon sx={{ fontSize: 20 }} />,
      },
    }),
    [canManageWikiCategories],
  )

  const actionOrder = React.useMemo(() => {
    if (loc.pathname === '/' || pathStarts(loc.pathname, '/site-repository')) {
      return ['newInventory', 'newIssue', 'newCustomer', 'newSite', 'newContact', 'newReportRequest', 'search']
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
        .filter((a): a is QuickAction => Boolean(a))
        .filter((a) => (!a.perm || hasPerm(a.perm)) && (!a.onlyWhen || a.onlyWhen())),
    [actionOrder, allActions, hasPerm],
  )

  if (!actions.length) return null

  const handleActionClick = (action: QuickAction) => {
    const state = action.openCreate
      ? { ...(action.state ?? {}), openCreate: true }
      : action.state
    nav(action.to, state ? { state } : undefined)
  }

  return (
    <SpeedDial
      ariaLabel="Azioni rapide"
      direction="up"
      sx={{
        position: 'fixed',
        bottom: { xs: 16, md: 20 },
        right: { xs: 16, md: 24 },
        zIndex: (t) => t.zIndex.appBar - 1,
        // FAB principale
        '& .MuiSpeedDial-fab': {
          width: 52,
          height: 52,
          bgcolor: primary,
          boxShadow: `0 8px 24px ${alpha(primary, 0.40)}`,
          '&:hover': {
            bgcolor: primaryDark,
            boxShadow: `0 12px 32px ${alpha(primary, 0.55)}`,
          },
        },
        // Pill icona delle azioni
        '& .MuiSpeedDialAction-fab': {
          width: 40,
          height: 40,
          bgcolor: alpha(primary, 0.10),
          border: `1px solid ${alpha(primary, 0.22)}`,
          color: primary,
          boxShadow: 'none',
          '&:hover': {
            bgcolor: alpha(primary, 0.18),
            borderColor: alpha(primary, 0.38),
            boxShadow: 'none',
          },
        },
        // Label testo accanto alla pill
        '& .MuiSpeedDialAction-staticTooltipLabel': {
          whiteSpace: 'nowrap',
          bgcolor: alpha(primary, 0.08),
          color: primaryDark,
          fontWeight: 600,
          fontSize: 12.5,
          letterSpacing: '-0.01em',
          boxShadow: 'none',
          border: `1px solid ${alpha(primary, 0.18)}`,
          borderRadius: '8px',
          px: 1.25,
          py: 0.6,
          cursor: 'pointer',
        },
      }}
      icon={
        <SpeedDialIcon
          sx={{
            '& .MuiSpeedDialIcon-icon': {
              transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
            },
          }}
        />
      }
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.key}
          icon={action.icon}
          tooltipTitle={action.label}
          tooltipOpen
          onClick={() => handleActionClick(action)}
        />
      ))}
    </SpeedDial>
  )
}
