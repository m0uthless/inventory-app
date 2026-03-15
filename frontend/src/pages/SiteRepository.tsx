import * as React from 'react'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import ContactsRoundedIcon from '@mui/icons-material/ContactsRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import Contacts from './Contacts'
import Customers from './Customers'
import Inventory from './Inventory'
import Sites from './Sites'

type SectionKey = 'customers' | 'inventory' | 'sites' | 'contacts'

type SectionDef = {
  key: SectionKey
  label: string
  endpoint: string
  perm: string
  accent: string
  helperText: string
  icon: typeof PeopleAltRoundedIcon
}

type CountState = {
  loading: boolean
  value: number | null
}

const SECTIONS: SectionDef[] = [
  {
    key: 'customers',
    label: 'Clienti',
    endpoint: '/customers/',
    perm: 'crm.view_customer',
    accent: '#0ea5e9',
    helperText: 'Anagrafica clienti',
    icon: PeopleAltRoundedIcon,
  },
  {
    key: 'inventory',
    label: 'Inventari',
    endpoint: '/inventories/',
    perm: 'inventory.view_inventory',
    accent: '#14b8a6',
    helperText: 'Asset censiti',
    icon: Inventory2RoundedIcon,
  },
  {
    key: 'sites',
    label: 'Siti',
    endpoint: '/sites/',
    perm: 'crm.view_site',
    accent: '#6366f1',
    helperText: 'Sedi operative',
    icon: ApartmentRoundedIcon,
  },
  {
    key: 'contacts',
    label: 'Contatti',
    endpoint: '/contacts/',
    perm: 'crm.view_contact',
    accent: '#f59e0b',
    helperText: 'Rubrica referenti',
    icon: ContactsRoundedIcon,
  },
]

function getInitialSection(allowedKeys: SectionKey[]): SectionKey | null {
  if (allowedKeys.includes('inventory')) return 'inventory'
  return allowedKeys[0] ?? null
}

function SectionView({ section }: { section: SectionKey }) {
  switch (section) {
    case 'customers':
      return <Customers />
    case 'sites':
      return <Sites />
    case 'contacts':
      return <Contacts />
    case 'inventory':
    default:
      return <Inventory />
  }
}

export default function SiteRepository() {
  const theme = useTheme()
  const { hasPerm } = useAuth()

  const availableSections = React.useMemo(
    () => SECTIONS.filter((section) => hasPerm(section.perm)),
    [hasPerm],
  )

  const availableKeys = React.useMemo(
    () => availableSections.map((section) => section.key),
    [availableSections],
  )

  const [activeSection, setActiveSection] = React.useState<SectionKey | null>(() =>
    getInitialSection(availableKeys),
  )
  const [counts, setCounts] = React.useState<Record<SectionKey, CountState>>(() => ({
    customers: { loading: false, value: null },
    inventory: { loading: false, value: null },
    sites: { loading: false, value: null },
    contacts: { loading: false, value: null },
  }))
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const next = getInitialSection(availableKeys)
    if (!next) {
      setActiveSection(null)
      return
    }
    if (!activeSection || !availableKeys.includes(activeSection)) {
      setActiveSection(next)
    }
  }, [activeSection, availableKeys])

  React.useEffect(() => {
    if (!availableSections.length) return

    let cancelled = false
    setLoadError(null)
    setCounts((prev) => {
      const next = { ...prev }
      availableSections.forEach((section) => {
        next[section.key] = { loading: true, value: prev[section.key]?.value ?? null }
      })
      return next
    })

    Promise.allSettled(
      availableSections.map(async (section) => {
        const response = await api.get(section.endpoint, { params: { page_size: 1 } })
        const rawCount = response.data?.count
        return {
          key: section.key,
          count: typeof rawCount === 'number' ? rawCount : Number(rawCount ?? 0),
        }
      }),
    ).then((results) => {
      if (cancelled) return

      let hasError = false
      setCounts((prev) => {
        const next: Record<SectionKey, CountState> = {
          customers: { loading: false, value: prev.customers.value },
          inventory: { loading: false, value: prev.inventory.value },
          sites: { loading: false, value: prev.sites.value },
          contacts: { loading: false, value: prev.contacts.value },
        }

        results.forEach((result, index) => {
          const section = availableSections[index]
          if (!section) return
          if (result.status === 'fulfilled') {
            next[section.key] = { loading: false, value: result.value.count }
          } else {
            hasError = true
            next[section.key] = { loading: false, value: null }
          }
        })

        return next
      })

      if (hasError) {
        setLoadError('Alcuni conteggi non sono disponibili al momento.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [availableSections])

  if (!availableSections.length) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 3 }}>
        Non hai permessi disponibili per visualizzare il Site Repository.
      </Alert>
    )
  }

  return (
    <Stack spacing={2.5}>
      {loadError ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          {loadError}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        {availableSections.map((section) => {
          const selected = section.key === activeSection
          const countState = counts[section.key]
          const Icon = section.icon
          const cardShadow = selected
            ? `0 18px 42px ${alpha(section.accent, 0.28)}`
            : `0 10px 28px ${alpha(section.accent, 0.18)}`

          return (
            <Card
              key={section.key}
              elevation={0}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                minHeight: 192,
                color: theme.palette.common.white,
                backgroundImage: `linear-gradient(135deg, ${alpha(section.accent, selected ? 0.72 : 0.62)} 0%, ${alpha(section.accent, selected ? 0.96 : 0.86)} 100%)`,
                border: `1px solid ${alpha(section.accent, selected ? 0.3 : 0.18)}`,
                boxShadow: cardShadow,
                transition:
                  'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease, border-color 0.2s ease',
                transform: selected ? 'translateY(-3px)' : 'translateY(0)',
                filter: selected ? 'saturate(1.08)' : 'saturate(0.98)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  right: -34,
                  top: -26,
                  backgroundColor: alpha(theme.palette.common.white, 0.14),
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: 164,
                  height: 164,
                  borderRadius: '50%',
                  right: 34,
                  bottom: -88,
                  backgroundColor: alpha(theme.palette.common.white, 0.12),
                },
              }}
            >
              <CardActionArea
                onClick={() => setActiveSection(section.key)}
                sx={{
                  height: '100%',
                  alignItems: 'stretch',
                  '&:hover': {
                    backgroundColor: 'transparent',
                  },
                }}
              >
                <CardContent
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    height: '100%',
                    px: 2.5,
                    py: 2.25,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          display: 'block',
                          color: alpha(theme.palette.common.white, 0.92),
                          letterSpacing: 0.4,
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          textTransform: 'none',
                        }}
                      >
                        Site Repository
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          mt: 0.75,
                          fontWeight: 700,
                          lineHeight: 1.15,
                          color: theme.palette.common.white,
                        }}
                      >
                        {section.label}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(theme.palette.common.white, 0.16),
                        border: `1px solid ${alpha(theme.palette.common.white, 0.22)}`,
                        backdropFilter: 'blur(4px)',
                        boxShadow: `0 10px 20px ${alpha(theme.palette.common.black, 0.08)}`,
                      }}
                    >
                      <Icon sx={{ fontSize: 24, color: theme.palette.common.white }} />
                    </Box>
                  </Box>

                  <Box sx={{ mt: 3.5, minHeight: 68 }}>
                    {countState?.loading ? (
                      <CircularProgress
                        size={28}
                        thickness={5}
                        sx={{ color: theme.palette.common.white }}
                      />
                    ) : (
                      <Typography
                        variant="h3"
                        sx={{
                          fontWeight: 800,
                          lineHeight: 1,
                          letterSpacing: -1.6,
                          color: theme.palette.common.white,
                          textShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.12)}`,
                        }}
                      >
                        {countState?.value != null ? countState.value.toLocaleString('it-IT') : '—'}
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      mt: 2.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.9),
                        fontWeight: 600,
                      }}
                    >
                      {section.helperText}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1.1,
                        py: 0.45,
                        borderRadius: 999,
                        backgroundColor: alpha(theme.palette.common.white, selected ? 0.2 : 0.14),
                        color: theme.palette.common.white,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selected ? 'Sezione attiva' : 'Apri sezione'}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      position: 'absolute',
                      width: 108,
                      height: 108,
                      borderRadius: '50%',
                      left: -26,
                      bottom: -58,
                      backgroundColor: alpha(theme.palette.common.white, 0.08),
                    }}
                  />
                </CardContent>
              </CardActionArea>
            </Card>
          )
        })}
      </Box>

      <Box sx={{ minHeight: 320 }}>
        {activeSection ? <SectionView key={activeSection} section={activeSection} /> : null}
      </Box>
    </Stack>
  )
}
