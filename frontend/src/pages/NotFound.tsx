import { Box, Button, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied'

export default function NotFound() {
  const nav = useNavigate()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        px: 3,
        background: (theme) => `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${theme.palette.background.default} 100%)`,
      }}
    >
      {/* Numero 404 grande */}
      <Box sx={{ position: 'relative', mb: 1 }}>
        <Typography
          sx={{
            fontSize: { xs: 96, sm: 140 },
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            userSelect: 'none',
          }}
        >
          404
        </Typography>
        <SentimentDissatisfiedIcon
          sx={{
            position: 'absolute',
            bottom: 8,
            right: -32,
            fontSize: 40,
            color: 'text.disabled',
          }}
        />
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
        Pagina non trovata
      </Typography>
      <Typography
        variant="body1"
        sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 380 }}
      >
        Il percorso che hai richiesto non esiste o è stato rimosso.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
        <Button
          variant="outlined"
          onClick={() => nav(-1)}
          sx={{ textTransform: 'none', borderRadius: 1 }}
        >
          Torna indietro
        </Button>
        <Button
          variant="contained"
          onClick={() => nav('/')}
          sx={{ textTransform: 'none', borderRadius: 1 }}
        >
          Vai alla home
        </Button>
      </Box>
    </Box>
  )
}
