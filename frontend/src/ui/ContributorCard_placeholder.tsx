import { Box, Card, Typography } from '@mui/material'

// Tipo esportato per compatibilità con WikiStats.tsx e Dashboard.tsx.
// Non rimuovere: viene importato come `type ContributorData` in WikiStats.
export type ContributorData = {
  user_id: number
  name: string
  username: string
  avatar: string | null
  pages_created: number
}

type Props = {
  contributor?: ContributorData | null
}

export default function ContributorCard(_props: Props) {
  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        height: '100%',
        minHeight: 0,
        background: 'linear-gradient(160deg, #0d4f4a 0%, #0f766e 55%, #0a3d38 100%)',
        border: '1px solid rgba(94,234,212,0.25)',
        boxShadow: '0 14px 34px rgba(15,118,110,0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Cerchi decorativi di sfondo */}
      <Box sx={{
        position: 'absolute', width: 200, height: 200,
        borderRadius: '50%', right: -60, top: -60,
        bgcolor: 'rgba(255,255,255,0.05)',
        pointerEvents: 'none',
      }} />
      <Box sx={{
        position: 'absolute', width: 160, height: 160,
        borderRadius: '50%', left: -40, bottom: -60,
        bgcolor: 'rgba(255,255,255,0.04)',
        pointerEvents: 'none',
      }} />

      <Typography sx={{
        position: 'relative', zIndex: 1,
        fontWeight: 900,
        fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
        letterSpacing: '0.18em',
        color: 'rgba(255,255,255,0.25)',
        textTransform: 'uppercase',
        textAlign: 'center',
        userSelect: 'none',
        px: 2,
      }}>
        Coming Soon
      </Typography>
    </Card>
  )
}
