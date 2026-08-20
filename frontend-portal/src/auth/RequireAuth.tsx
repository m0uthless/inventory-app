import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CircularProgress, Box, Typography, Button, Stack } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, loading, blockedMessage, logout } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  // 0.9.0 punto 4: profilo Portal esistente ma bloccato (il cliente di
  // default non è più tra quelli assegnati). Diverso da "non autenticato":
  // niente redirect al login, si spiega perché e si offre solo il logout.
  if (blockedMessage) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 3 }}>
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 420, textAlign: 'center' }}>
          <LockOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="h6">Accesso sospeso</Typography>
          <Typography variant="body2" color="text.secondary">
            {blockedMessage}
          </Typography>
          <Button variant="outlined" onClick={() => logout()}>
            Esci
          </Button>
        </Stack>
      </Box>
    )
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
