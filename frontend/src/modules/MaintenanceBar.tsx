import { Box, Button, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

import { CampoIcon } from '../ui/campo'

/** Fascia per il superuser: la modalità manutenzione è attiva e gli altri utenti sono fuori. */
export function MaintenanceBar({ onManage }: { onManage: () => void }) {
  return (
    <Box role="status" sx={{
      display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: { xs: 'wrap', sm: 'nowrap' }, px: 1.75, py: 1, mb: 2, borderRadius: '10px',
      bgcolor: (t) => alpha(t.palette.warning.main, 0.12), border: '1px solid', borderColor: (t) => alpha(t.palette.warning.main, 0.3),
    }}>
      <Box sx={{ color: 'warning.main', display: 'inline-flex', flex: 'none' }}><CampoIcon name="lock" size={16} /></Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
        <Box component="b" sx={{ color: 'warning.main', fontWeight: 650 }}>Modalità manutenzione attiva.</Box>{' '}
        Archie è chiuso a tutti tranne i superuser; il Portal clienti resta aperto.
      </Typography>
      <Button size="small" variant="outlined" onClick={onManage} sx={{ flex: 'none' }}>Gestisci</Button>
    </Box>
  )
}
