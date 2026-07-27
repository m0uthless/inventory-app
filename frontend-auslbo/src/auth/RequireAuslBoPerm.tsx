import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CircularProgress, Box } from '@mui/material'
import { useAuth } from './AuthProvider'

/**
 * RequireAuslBoPerm — guard di route che verifica un permesso Django reale
 * (stesso codename applicato lato server da AuslBoModelPermissions, es.
 * "device.view_device", "vlan.view_vlan", "vlan.view_vlaniprequest").
 *
 * Fix (audit 2026-07): prima tutte le pagine AUSLBO erano montate solo
 * sotto RequireAuth (autenticazione), senza alcun controllo permessi lato
 * route — un utente poteva navigare direttamente a una pagina senza il
 * permesso relativo e vedersi fallire le chiamate API con 403 tardivi o
 * pagine vuote. Il backend resta comunque l'autorità: questo guard è solo
 * UX, non un confine di sicurezza (che vive server-side in
 * AuslBoModelPermissions).
 *
 * `perm` accetta uno o più permessi: con più permessi, basta soddisfarne
 * uno qualsiasi (semantica "any of").
 */
export function RequireAuslBoPerm({
  perm,
  children,
}: {
  perm: string | string[]
  children: React.ReactNode
}) {
  const { me, loading } = useAuth()
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

  const required = Array.isArray(perm) ? perm : [perm]
  const granted = me.auslbo.permissions ?? []
  const hasAccess = required.some((p) => granted.includes(p))

  if (!hasAccess) {
    return <Navigate to="/403" replace state={{ from: location }} />
  }

  return <>{children}</>
}
