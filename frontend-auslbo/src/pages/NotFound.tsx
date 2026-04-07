import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Typography sx={{ fontSize: 64, fontWeight: 700, color: 'text.disabled', lineHeight: 1 }}>404</Typography>
      <Typography variant="h6" color="text.secondary">Pagina non trovata</Typography>
      <Button variant="contained" onClick={() => navigate('/')}>Torna alla dashboard</Button>
    </Box>
  )
}
