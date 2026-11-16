import * as React from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Box, Button, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { SvgIconComponent } from '@mui/icons-material'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { useAuth } from '../../auth/AuthProvider'
import { useModules } from '../../modules/useModules'
import { CampoIcon } from '../../ui/campo'
import { LOGIN_GRADIENT, hasWebGL } from '../login/loginColors'
import { CONDITION_LABEL } from './widgets/weatherModel'
import { isoWeek, useAwayToday, useMine, useWeather } from './weather'

const LoginBackground = React.lazy(() => import('../login/LoginBackground'))

/** Testo sulla fascia: inchiostro del tema, più scuro/chiaro del secondario perché sta sul gradiente. */
const subInk = 'color-mix(in srgb, currentColor 78%, transparent)'

function Stat({ icon: Icon, n, label, to, alert = false }: { icon: SvgIconComponent; n: number | null; label: string; to: string; alert?: boolean }) {
  return (
    <Box component={RouterLink} to={to} sx={{
      display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 1, px: 1.75, py: 1.5, textDecoration: 'none', color: 'text.primary',
      bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 86%, transparent)`, backdropFilter: "blur(8px)",
      '&:hover': { bgcolor: 'background.paper' }, '&:focus-visible': { outline: 'none', boxShadow: (t) => `inset ${t.palette.archie.focusRing}` },
    }}>
      <Icon sx={{ fontSize: 16, color: (t) => (alert ? t.palette.error.main : t.palette.archie.dash.verde.mid) }} />
      <Box component="b" sx={{ fontSize: 26, lineHeight: 1.05, fontWeight: 650, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: alert ? 'error.main' : 'text.primary' }}>{n ?? '–'}</Box>
      <Box component="span" sx={{ gridColumn: '1 / -1', mt: 0.25, fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
    </Box>
  )
}

/**
 * Fascia "Aurora" in testa alla Dashboard (anteprima db-base.html, variante F): lo stesso sfondo
 * animato della login, saluto, azioni rapide e i quattro numeri della giornata.
 * `actions` = pulsanti in alto a destra (pausa animazioni, Personalizza).
 */
export default function DashboardHero({ paused, actions }: { paused: boolean; actions?: React.ReactNode }) {
  const { me } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [webgl] = React.useState(hasWebGL)
  const w = useWeather()
  const mine = useMine(me?.id)
  const away = useAwayToday()
  const { isHidden } = useModules()
  // Contatori e azioni dei moduli spenti spariscono dalla fascia.
  const stats = [
    !isHidden('issues') && <Stat key="issues" icon={ErrorOutlineRoundedIcon} n={mine?.issues ?? null} label={mine?.issues === 1 ? 'issue tua' : 'issue tue'} to="/issues?vista=mine" />,
    !isHidden('area_tasks') && <Stat key="tasks" icon={TaskAltRoundedIcon} n={mine?.tasks ?? null} label={mine?.tasks === 1 ? 'task tuo' : 'task tuoi'} to="/tasks?vista=mine" />,
    !isHidden('maintenance') && <Stat key="maint" icon={BuildOutlinedIcon} n={mine?.overdue ?? null} label={mine?.overdue === 1 ? 'manutenzione scaduta' : 'manutenzioni scadute'} to="/maintenance?vista=over" alert={Boolean(mine?.overdue)} />,
    away !== null && !isHidden('leave') && <Stat key="away" icon={GroupsOutlinedIcon} n={away} label={away === 1 ? 'collega assente oggi' : 'colleghi assenti oggi'} to="/piano-ferie" />,
  ].filter(Boolean)

  const name = me?.first_name?.trim() || me?.username || ''
  const now = new Date()
  const hour = now.getHours()
  const hello = hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const day = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const weather = w && w !== 'err' ? ` · ${w.temp}° ${CONDITION_LABEL[w.cond].toLowerCase()} a Bologna` : ''

  return (
    <Box component="section" aria-labelledby="dash-hello" sx={{
      position: 'relative', isolation: 'isolate', overflow: 'hidden', borderRadius: '16px', color: 'text.primary',
      minHeight: { xs: 0, md: 300 }, p: { xs: '20px 18px 22px', md: '34px 32px 92px' },
      background: LOGIN_GRADIENT[dark ? 'dark' : 'light'],
    }}>
      {webgl ? (
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: -1, '& canvas': { display: 'block' } }}>
          <React.Suspense fallback={null}><LoginBackground dark={dark} still={paused || reduce} speed={0.22} /></React.Suspense>
        </Box>
      ) : null}

      {actions ? <Box sx={{ position: { xs: 'static', md: 'absolute' }, top: 12, right: 14, zIndex: 2, display: 'flex', justifyContent: 'flex-end', gap: 0.75, mb: { xs: 1.5, md: 0 } }}>{actions}</Box> : null}

      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap', mt: { md: 2.5 } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" id="dash-hello" sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.08, fontWeight: 650, letterSpacing: '-0.028em', textWrap: 'balance' }}>
            {hello}{name ? `, ${name}` : ''}
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 13.5, color: subInk, '&::first-letter': { textTransform: 'uppercase' } }}>
            {day} · settimana {isoWeek(now)}{weather}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 2.25, flexWrap: 'wrap' }}>
            {!isHidden('issues') && <Button variant="contained" startIcon={<CampoIcon name="plus" size={15} />} onClick={() => navigate('/issues', { state: { openCreate: true } })}>Nuova issue</Button>}
            {!isHidden('servicenow') && <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="cloud" size={15} />} onClick={() => navigate('/servicenow-cases', { state: { openCreate: true } })}
              sx={{ borderColor: 'transparent', bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 82%, transparent)`, backdropFilter: 'blur(6px)', '&:hover': { bgcolor: 'background.paper', borderColor: 'transparent' } }}>
              Triage
            </Button>}
          </Box>
        </Box>
        {stats.length ? <Box component="nav" aria-label="La tua giornata" sx={{
          display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${stats.length}, minmax(118px, 1fr))` }, gap: '1px',
          borderRadius: '12px', overflow: 'hidden', width: { xs: '100%', lg: 'auto' },
          bgcolor: (t) => `color-mix(in srgb, ${t.palette.text.primary} 10%, transparent)`,
        }}>
          {stats}
        </Box> : null}
      </Box>
    </Box>
  )
}
