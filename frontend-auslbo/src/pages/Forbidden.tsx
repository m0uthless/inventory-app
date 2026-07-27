import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function Forbidden() {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Typography sx={{ fontSize: 64, fontWeight: 700, color: 'text.disabled', lineHeight: 1 }}>403</Typography>
      <Typography variant="h6" color="text.secondary">Non hai i permessi per accedere a questa pagina</Typography>
      <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 360, textAlign: 'center' }}>
        Se pensi sia un errore, contatta l'amministratore per verificare i permessi assegnati al tuo utente.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')}>Torna alla dashboard</Button>
    </Box>
  )
}
