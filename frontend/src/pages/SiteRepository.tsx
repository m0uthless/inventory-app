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
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBoundary } from '@shared/ui/ErrorBoundary'

const Contacts  = React.lazy(() => import('./Contacts'))
const Customers = React.lazy(() => import('./Customers'))
const Inventory = React.lazy(() => import('./Inventory'))
const Sites     = React.lazy(() => import('./Sites'))

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
      <Alert severity="warning">
        Non hai permessi disponibili per visualizzare il Site Repository.
      </Alert>
    )
  }

  return (
    <Stack spacing={2.5}>
      {loadError ? (
        <Alert severity="info">
          {loadError}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(4, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 1, sm: 2 },
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
                borderRadius: '8px',
                minHeight: { xs: 'auto', sm: 130 },
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
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  right: -24,
                  top: -18,
                  backgroundColor: alpha(theme.palette.common.white, 0.14),
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  right: 24,
                  bottom: -64,
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
                    px: { xs: 1, sm: 2 },
                    py: { xs: 1, sm: 1.5 },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: { xs: 'center', sm: 'space-between' },
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      <Typography
                        variant="body1"
                        sx={{
                          mt: 0.25,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          fontSize: '0.88rem',
                          color: theme.palette.common.white,
                        }}
                      >
                        {section.label}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        width: { xs: 28, sm: 32 },
                        height: { xs: 28, sm: 32 },
                        borderRadius: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(theme.palette.common.white, 0.16),
                        border: `1px solid ${alpha(theme.palette.common.white, 0.22)}`,
                        backdropFilter: 'blur(4px)',
                        boxShadow: `0 10px 20px ${alpha(theme.palette.common.black, 0.08)}`,
                      }}
                    >
                      <Icon sx={{ fontSize: { xs: 16, sm: 18 }, color: theme.palette.common.white }} />
                    </Box>
                  </Box>

                  <Box sx={{ mt: { xs: 0.75, sm: 1.5 }, minHeight: { xs: 0, sm: 40 } }}>
                    {countState?.loading ? (
                      <CircularProgress
                        size={28}
                        thickness={5}
                        sx={{ color: theme.palette.common.white }}
                      />
                    ) : (
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          lineHeight: 1,
                          letterSpacing: -1,
                          fontSize: { xs: '1.25rem', sm: undefined },
                          color: theme.palette.common.white,
                          textShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.12)}`,
                          textAlign: { xs: 'center', sm: 'left' },
                        }}
                      >
                        {countState?.value != null ? countState.value.toLocaleString('it-IT') : '—'}
                      </Typography>
                    )}
                  </Box>

                  {/* Label visibile solo su mobile sotto il numero */}
                  <Typography
                    variant="caption"
                    sx={{
                      display: { xs: 'block', sm: 'none' },
                      color: alpha(theme.palette.common.white, 0.85),
                      fontWeight: 700,
                      fontSize: '0.62rem',
                      textAlign: 'center',
                      mt: 0.5,
                      lineHeight: 1.2,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {section.label}
                  </Typography>

                  <Box
                    sx={{
                      mt: 1.25,
                      display: { xs: 'none', sm: 'flex' },
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.9),
                        fontWeight: 600,
                        fontSize: '0.72rem',
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
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      left: -20,
                      bottom: -42,
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
        {activeSection ? (
          <ErrorBoundary>
            <React.Suspense fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            }>
              <SectionView key={activeSection} section={activeSection} />
            </React.Suspense>
          </ErrorBoundary>
        ) : null}
      </Box>
    </Stack>
  )
}
