import * as React from 'react'
import { Avatar, Box, Card, Skeleton, Stack, Typography } from '@mui/material'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import { api } from '@shared/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContributorData = {
  user_id: number
  name: string
  username: string
  avatar: string | null
  pages_created: number
}

type Props = {
  /**
   * Se fornito, il componente usa questi dati direttamente (WikiStats).
   * Se omesso, il componente fa il fetch autonomo da /api/wiki-stats/ (Dashboard).
   */
  contributor?: ContributorData | null
}

// ─── Confetti (deterministici, nessun random a ogni render) ───────────────────

const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6']

const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${5 + (i * 6.1) % 90}%`,
  size: 5 + (i * 3) % 6,
  delay: `${(i * 0.31) % 2.4}s`,
  duration: `${2.2 + (i * 0.17) % 1.6}s`,
  rotate: (i * 47) % 360,
  shape: i % 3, // 0=quadrato, 1=cerchio, 2=rettangolo
}))

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContributorCard({ contributor: contributorProp }: Props) {
  const isControlled = contributorProp !== undefined

  const [contributor, setContributor] = React.useState<ContributorData | null>(
    isControlled ? (contributorProp ?? null) : null,
  )
  const [loading, setLoading] = React.useState(!isControlled)

  // Fetch autonomo solo se non riceve i dati come prop (modalità Dashboard)
  React.useEffect(() => {
    if (isControlled) return
    api.get<{ monthly_contributor: ContributorData | null }>('/wiki-stats/')
      .then(r => setContributor(r.data.monthly_contributor))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isControlled])

  // Sync prop → state quando WikiStats aggiorna i dati
  React.useEffect(() => {
    if (isControlled) setContributor(contributorProp ?? null)
  }, [isControlled, contributorProp])

  const now = new Date()
  const monthName = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        height: '100%',
        minHeight: 240,
        background: 'linear-gradient(160deg, #0d4f4a 0%, #0f766e 55%, #0a3d38 100%)',
        border: '1px solid rgba(94,234,212,0.25)',
        boxShadow: '0 14px 34px rgba(15,118,110,0.28)',
      }}
    >
      {/* Keyframes coriandoli */}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(260px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Coriandoli */}
      {!loading && contributor && CONFETTI.map(c => (
        <Box
          key={c.id}
          sx={{
            position: 'absolute',
            left: c.left,
            top: -8,
            width: c.shape === 2 ? c.size * 2 : c.size,
            height: c.size,
            borderRadius: c.shape === 1 ? '50%' : '1px',
            bgcolor: c.color,
            opacity: 0.85,
            animation: `confettiFall ${c.duration} ${c.delay} infinite linear`,
            transform: `rotate(${c.rotate}deg)`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Trofeo grande di sfondo */}
      <Box sx={{ position: 'absolute', right: -8, bottom: -8, zIndex: 1, opacity: 0.18 }}>
        <EmojiEventsRoundedIcon sx={{ fontSize: 140, color: '#f59e0b' }} />
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
            <EmojiEventsRoundedIcon sx={{ fontSize: 20, color: '#fbbf24' }} />
            <Typography variant="overline" sx={{
              color: '#fde68a', fontSize: '0.68rem', fontWeight: 800,
              letterSpacing: '0.1em', lineHeight: 1,
            }}>
              Contributor del mese
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem' }}>
            {monthName}
          </Typography>
        </Stack>

        {/* Corpo */}
        {loading ? (
          <Stack alignItems="center" spacing={1.5}>
            <Skeleton variant="circular" width={92} height={92} sx={{ bgcolor: 'rgba(255,255,255,0.12)' }} />
            <Skeleton variant="text" width={100} height={18} sx={{ bgcolor: 'rgba(255,255,255,0.10)' }} />
            <Skeleton variant="text" width={70} height={14} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
          </Stack>
        ) : contributor ? (
          <>
            {/* Avatar con ring trofeo */}
            <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{
                position: 'absolute', width: 108, height: 108, borderRadius: '50%',
                border: '2.5px solid #f59e0b',
                boxShadow: '0 0 18px rgba(245,158,11,0.45)',
              }} />
              <Avatar
                src={contributor.avatar ?? undefined}
                sx={{
                  width: 92, height: 92, fontSize: 34, fontWeight: 800,
                  bgcolor: 'rgba(255,255,255,0.18)', color: '#fff',
                  border: '2px solid rgba(255,255,255,0.3)',
                }}
              >
                {contributor.name[0]?.toUpperCase()}
              </Avatar>
              {/* Badge trofeo */}
              <Box sx={{
                position: 'absolute', bottom: -4, right: -4,
                width: 22, height: 22, borderRadius: '50%',
                bgcolor: '#f59e0b', display: 'grid', placeItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}>
                <EmojiEventsRoundedIcon sx={{ fontSize: 13, color: '#fff' }} />
              </Box>
            </Box>

            {/* Nome e conteggio */}
            <Stack alignItems="center" spacing={0.25}>
              <Typography variant="h6" fontWeight={800} sx={{
                color: '#fff', textAlign: 'center', lineHeight: 1.2, fontSize: '1rem',
              }}>
                {contributor.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>
                {contributor.pages_created}{' '}
                {contributor.pages_created === 1 ? 'pagina creata' : 'pagine create'}
              </Typography>
            </Stack>
          </>
        ) : (
          <Stack alignItems="center" spacing={1}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 40, color: 'rgba(245,158,11,0.4)' }} />
            <Typography variant="body2" sx={{
              color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontSize: '0.75rem',
            }}>
              Nessuna pagina creata<br />questo mese
            </Typography>
          </Stack>
        )}
      </Box>
    </Card>
  )
}
