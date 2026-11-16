import type { ReactNode } from 'react'
import { Box } from '@mui/material'

/**
 * Stato del sito come badge con segno di forma (stesso linguaggio dello stato
 * delle Issue): pieno = attivo, anello = chiuso temporaneamente, trattino = archiviato.
 */
const MARK: Record<string, ReactNode> = {
  active: <circle cx="6" cy="6" r="4" fill="currentColor" />,
  temporarily_closed: <circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  archived: <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
}
const TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'success.light', fg: 'success.main' },
  temporarily_closed: { bg: 'warning.light', fg: 'warning.main' },
  archived: { bg: 'archie.neutralBg', fg: 'text.secondary' },
}

export function SiteStatusBadge({ statusKey, label, onDark }: { statusKey?: string | null; label?: string | null; onDark?: boolean }) {
  if (!label) return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
  const k = statusKey ?? ''
  const t = TONE[k] ?? TONE.archived
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 22, pl: 0.875, pr: 1, borderRadius: '5px',
      fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.fg,
      ...(onDark && { boxShadow: '0 0 0 1px rgb(255 255 255 / .2)' }),
    }}>
      <Box component="svg" viewBox="0 0 12 12" aria-hidden sx={{ width: 10, height: 10, flex: 'none' }}>{MARK[k] ?? MARK.archived}</Box>
      {label}
    </Box>
  )
}
