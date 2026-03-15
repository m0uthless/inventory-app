import * as React from 'react'
import { Link as RouterLink, Navigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { useAuth } from './AuthProvider'

export function RequirePerm({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { me, loading, hasPerm } = useAuth()

  if (loading) return null // RequireAuth mostra già lo spinner
  if (!me) return <Navigate to="/login" replace />

  if (!hasPerm(perm)) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          403 — Non autorizzato
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
          Non hai i permessi per accedere a questa pagina.
        </Typography>

        <Button component={RouterLink} to="/" variant="outlined" size="small">
          Torna alla Dashboard
        </Button>
      </Box>
    )
  }

  return <>{children}</>
}
