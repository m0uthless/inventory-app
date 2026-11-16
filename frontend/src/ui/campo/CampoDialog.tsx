import * as React from 'react'
import { Box, Dialog, IconButton, Typography, useMediaQuery, type Theme } from '@mui/material'
import { CampoIcon } from './CampoIcon'

/** Cornice dei dialoghi della nota (testata con titolo, corpo che scorre, piede con azioni). */
export function CampoDialog({ open, onClose, title, sub, width = 520, busy, footer, children, labelId }: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  sub?: React.ReactNode
  width?: number
  busy?: boolean
  footer: React.ReactNode
  children: React.ReactNode
  labelId: string
}) {
  const narrow = useMediaQuery((t: Theme) => t.breakpoints.down('sm'))
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={narrow} aria-labelledby={labelId}
      slotProps={{ paper: { sx: { width, maxWidth: narrow ? '100vw' : 'calc(100vw - 32px)', maxHeight: narrow ? '100vh' : 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: narrow ? 0 : '12px' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '16px 18px 12px', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" id={labelId} sx={{ fontSize: 16, fontWeight: 650, overflowWrap: 'anywhere' }}>{title}</Typography>
          {sub ? <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{sub}</Typography> : null}
        </Box>
        <IconButton size="small" aria-label="Chiudi" onClick={onClose} disabled={busy} sx={{ mt: -0.5, mr: -0.75 }}><CampoIcon name="x" size={16} /></IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: '16px 18px 18px', display: 'grid', gap: 1.75, alignContent: 'start' }}>{children}</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '12px 18px', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>{footer}</Box>
    </Dialog>
  )
}
