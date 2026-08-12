import { Box, Card, CardContent, Typography } from '@mui/material'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'

export default function Report() {
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ fontSize: 18, mb: 0.5 }}>Report</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>
        Report e statistiche sulle apparecchiature del tuo ente
      </Typography>
      <Card elevation={0} sx={{ border: '0.5px solid', borderColor: 'divider', borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
          <BarChartOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography fontWeight={500} color="text.secondary">Sezione in arrivo</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            Qui saranno disponibili report e statistiche del tuo parco apparecchiature
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
