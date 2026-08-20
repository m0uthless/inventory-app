import * as React from 'react'
import { Avatar, AvatarGroup, Box, Card, Skeleton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CakeRoundedIcon from '@mui/icons-material/CakeRounded'
import { api } from '@shared/api/client'
import { useKpiAccents } from '../theme/AppThemeProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

type BirthdayPerson = {
  user_id: number
  name: string
  avatar: string | null
}

type BirthdaysData = {
  day: number | null
  month: number | null
  people: BirthdayPerson[]
}

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

// ─── Palloncini (sostituiscono i coriandoli di ContributorCard: salgono dal
// basso ondeggiando invece di cadere dall'alto — stessa idea di pattern
// deterministico, effetto diverso e più "compleanno" che "premiazione") ──────

const BALLOON_COLORS = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#c084fc', '#fb7185']

const BALLOONS = Array.from({ length: 7 }, (_, i) => ({
  id: i,
  color: BALLOON_COLORS[i % BALLOON_COLORS.length],
  left: `${8 + (i * 12.7) % 84}%`,
  size: 20 + (i * 5) % 14,
  riseDelay: `${(i * 0.53) % 3}s`,
  riseDuration: `${7 + (i * 0.41) % 2.6}s`,
  swayDelay: `${(i * 0.29) % 1.6}s`,
  swayDuration: `${2.6 + (i * 0.37) % 1.4}s`,
  sway: 7 + (i * 3) % 9,
}))

// ─── Component ────────────────────────────────────────────────────────────────
// Mostra solo chi festeggia il compleanno OGGI tra gli utenti attivi (l'API
// /birthdays/ filtra già per giorno/mese corrente, nessun fallback sul
// "prossimo compleanno futuro"). Se c'è qualcuno, versione festosa con
// palloncini; altrimenti stato vuoto sobrio.

export default function BirthdaysCard() {
  const kpiAccents = useKpiAccents()
  const [data, setData]       = React.useState<BirthdaysData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    api.get<BirthdaysData>('/birthdays/')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const people = data?.people ?? []
  const first = people[0]

  const dateLabel = data?.day != null && data?.month != null
    ? `${data.day} ${MONTH_NAMES[data.month - 1]}`
    : null

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        height: '100%',
        minHeight: 240,
        // Gradiente sui toni violet derivato da KPI_ACCENTS (useKpiAccents(),
        // theme-aware). Prima era magenta hex fisso indipendente dal tema —
        // vedi 0.9.0: card in linea con ContributorCard (teal) su richiesta.
        background: `linear-gradient(160deg, ${kpiAccents.violet2} 0%, ${kpiAccents.violet1} 55%, ${kpiAccents.violet2} 100%)`,
        border: `1px solid ${alpha(kpiAccents.violet1, 0.3)}`,
        boxShadow: `0 14px 34px ${alpha(kpiAccents.violet2, 0.35)}`,
      }}
    >
      <style>{`
        ${BALLOONS.map(b => `
        @keyframes balloonRise${b.id} {
          0%   { transform: translateY(0); opacity: 0; }
          10%  { opacity: 0.92; }
          88%  { opacity: 0.85; }
          100% { transform: translateY(-300px); opacity: 0; }
        }
        @keyframes balloonSway${b.id} {
          0%   { transform: translateX(-${b.sway}px) rotate(-2deg); }
          50%  { transform: translateX(${b.sway}px) rotate(2deg); }
          100% { transform: translateX(-${b.sway}px) rotate(-2deg); }
        }`).join('\n')}
      `}</style>

      {/* Palloncini, solo se c'è almeno un compleanno oggi. Salita e
          ondeggio sono due animazioni indipendenti (contenitore esterno +
          elemento interno) invece di un'unica keyframe con pochi punti di
          svolta: cicli continui e sfasati tra loro, niente "scatti" ai
          cambi di direzione — moto molto più naturale. */}
      {!loading && people.length > 0 && BALLOONS.map(b => (
        <Box
          key={b.id}
          sx={{
            position: 'absolute',
            left: b.left,
            bottom: -40,
            width: b.size,
            animation: `balloonRise${b.id} ${b.riseDuration} ${b.riseDelay} infinite ease-out`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <Box sx={{
            animation: `balloonSway${b.id} ${b.swayDuration} ${b.swayDelay} infinite ease-in-out`,
          }}>
          {/* Corpo */}
          <Box sx={{
            width: '100%',
            height: b.size * 1.2,
            bgcolor: b.color,
            borderRadius: '50% 50% 50% 50% / 58% 58% 42% 42%',
            boxShadow: 'inset -3px -3px 6px rgba(0,0,0,0.15), inset 3px 3px 5px rgba(255,255,255,0.3)',
          }} />
          {/* Nodo */}
          <Box sx={{
            width: 0, height: 0, mx: 'auto',
            borderLeft: '3px solid transparent',
            borderRight: '3px solid transparent',
            borderTop: `4px solid ${b.color}`,
          }} />
          {/* Filo */}
          <Box sx={{ width: '1px', height: 26, bgcolor: 'rgba(255,255,255,0.35)', mx: 'auto' }} />
          </Box>
        </Box>
      ))}

      {/* Torta grande di sfondo */}
      <Box sx={{ position: 'absolute', right: -8, bottom: -8, zIndex: 1, opacity: 0.18 }}>
        <CakeRoundedIcon sx={{ fontSize: 140, color: '#fbbf24' }} />
      </Box>

      {/* Contenuto */}
      <Box sx={{
        position: 'relative', zIndex: 2, height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        px: 2.5, py: 2.5, gap: 1.5,
      }}>

        {/* Titolo */}
        <Stack alignItems="center" spacing={0.25}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <CakeRoundedIcon sx={{ fontSize: 20, color: '#fbbf24' }} />
            <Typography variant="overline" sx={{
              color: '#fbcfe8', fontSize: '0.68rem', fontWeight: 800,
              letterSpacing: '0.1em', lineHeight: 1,
            }}>
              Compleanni
            </Typography>
          </Stack>
          {dateLabel && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem' }}>
              Oggi, {dateLabel}
            </Typography>
          )}
        </Stack>

        {/* Corpo */}
        {loading ? (
          <Stack alignItems="center" spacing={1.5}>
            <Skeleton variant="circular" width={92} height={92} sx={{ bgcolor: 'rgba(255,255,255,0.12)' }} />
            <Skeleton variant="text" width={100} height={18} sx={{ bgcolor: 'rgba(255,255,255,0.10)' }} />
            <Skeleton variant="text" width={70} height={14} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
          </Stack>
        ) : first ? (
          <>
            {/* Avatar(i) con ring festivo */}
            <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{
                position: 'absolute', width: 108, height: 108, borderRadius: '50%',
                border: '2.5px solid #fbbf24',
                boxShadow: '0 0 18px rgba(251,191,36,0.45)',
              }} />
              {people.length > 1 ? (
                <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 52, height: 52, fontSize: 18, border: '2px solid rgba(255,255,255,0.3)' } }}>
                  {people.map(p => (
                    <Avatar key={p.user_id} src={p.avatar ?? undefined} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 800 }}>
                      {p.name[0]?.toUpperCase()}
                    </Avatar>
                  ))}
                </AvatarGroup>
              ) : (
                <Avatar
                  src={first.avatar ?? undefined}
                  sx={{
                    width: 92, height: 92, fontSize: 34, fontWeight: 800,
                    bgcolor: 'rgba(255,255,255,0.18)', color: '#fff',
                    border: '2px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {first.name[0]?.toUpperCase()}
                </Avatar>
              )}
              {/* Badge torta */}
              <Box sx={{
                position: 'absolute', bottom: -4, right: -4,
                width: 22, height: 22, borderRadius: '50%',
                bgcolor: '#fbbf24', display: 'grid', placeItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}>
                <CakeRoundedIcon sx={{ fontSize: 13, color: '#831843' }} />
              </Box>
            </Box>

            {/* Nome/i */}
            <Stack alignItems="center" spacing={0.25}>
              <Typography variant="h6" fontWeight={800} sx={{
                color: '#fff', textAlign: 'center', lineHeight: 1.2, fontSize: '1rem',
              }}>
                {people.length > 1 ? `${first.name} +${people.length - 1}` : first.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>
                Oggi! 🎉
              </Typography>
            </Stack>
          </>
        ) : (
          <Stack alignItems="center" spacing={1}>
            <CakeRoundedIcon sx={{ fontSize: 40, color: 'rgba(251,191,36,0.4)' }} />
            <Typography variant="body2" sx={{
              color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontSize: '0.75rem',
            }}>
              Nessun compleanno<br />oggi
            </Typography>
          </Stack>
        )}
      </Box>
    </Card>
  )
}
