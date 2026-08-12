import { Box, Card, CardContent, Typography } from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'

export default function Scadenze() {
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ fontSize: 18, mb: 0.5 }}>Scadenze</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>
        Scadenze e interventi programmati per le tue apparecchiature
      </Typography>
      <Card elevation={0} sx={{ border: '0.5px solid', borderColor: 'divider', borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
          <AccessTimeOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography fontWeight={500} color="text.secondary">Sezione in arrivo</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            Qui saranno visibili le prossime scadenze di manutenzione
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
