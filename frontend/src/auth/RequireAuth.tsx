import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CircularProgress, Box, Typography } from '@mui/material'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, loading, hasPerm } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Superuser ha sempre accesso; gli altri devono avere il permesso core.access_archie
  if (!me.is_superuser && !hasPerm('core.access_archie')) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', p: 4 }}>
        <Box>
          <Typography variant="h5" gutterBottom>Accesso non autorizzato</Typography>
          <Typography variant="body2" color="text.secondary">
            Il tuo account non dispone dei permessi per accedere ad ARCHIE.
          </Typography>
        </Box>
      </Box>
    )
  }

  return <>{children}</>
}
