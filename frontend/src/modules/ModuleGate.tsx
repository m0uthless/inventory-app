import * as React from 'react'
import { Box, Button, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import NotFound from '../pages/NotFound'
import { CampoIcon } from '../ui/campo'
import { MODULE_BY_KEY, moduleForPath } from './moduleRegistry'
import { useModules } from './useModules'

/**
 * Pagine dei moduli spenti: chi non è superuser trova la 404, come se la
 * pagina non esistesse; il superuser la vede con un banner che lo ricorda.
 */
export function ModuleGate({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  const { isHidden, isOff } = useModules()
  const key = moduleForPath(loc.pathname)

  if (key && isHidden(key)) return <NotFound />
  if (key && isOff(key)) {
    return (
      <>
        <DisabledModuleBanner label={MODULE_BY_KEY[key].label} />
        {children}
      </>
    )
  }
  return <>{children}</>
}

function DisabledModuleBanner({ label }: { label: string }) {
  const nav = useNavigate()
  const { me } = useAuth()
  if (!me?.is_superuser) return null
  return (
    <Box role="status" sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' }, px: 1.75, py: 1.25, mb: 2, borderRadius: '10px',
      bgcolor: (t) => alpha(t.palette.warning.main, 0.12), border: '1px solid', borderColor: (t) => alpha(t.palette.warning.main, 0.3),
    }}>
      <Box sx={{ color: 'warning.main', display: 'inline-flex', flex: 'none' }}><CampoIcon name="eyeOff" size={18} /></Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'warning.main' }}>{label} è spento</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.primary' }}>
          Lo vedi solo tu perché sei superuser: gli altri utenti non hanno la voce nel menu e trovano la pagina 404.
        </Typography>
      </Box>
      <Button variant="outlined" size="small" onClick={() => nav('/moduli')} sx={{ flex: 'none' }}>Gestisci i moduli</Button>
    </Box>
  )
}
