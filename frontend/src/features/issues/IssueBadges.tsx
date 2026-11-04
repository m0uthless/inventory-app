import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { PRIORITY_META, STATUS_META } from './types'

/**
 * Badge di stato con un segno di forma (DESIGN.md › Status badges): il colore
 * non è mai l'unica informazione. Pieno = aperta, metà = in lavorazione,
 * anello = in attesa, spunta = risolta, trattino = chiusa.
 */
const MARK: Record<string, ReactNode> = {
  open: <circle cx="6" cy="6" r="4" fill="currentColor" />,
  in_progress: <><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor" /></>,
  waiting: <circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  resolved: <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  closed: <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
}

const TONE: Record<string, { bg: string; fg: string }> = {
  open: { bg: 'info.light', fg: 'info.main' },
  in_progress: { bg: 'warning.light', fg: 'warning.main' },
  waiting: { bg: 'archie.neutralBg', fg: 'text.secondary' },
  resolved: { bg: 'success.light', fg: 'success.main' },
  closed: { bg: 'archie.neutralBg', fg: 'text.disabled' },
}

export function IssueStatusBadge({ status, label, onDark }: { status: string; label?: string; onDark?: boolean }) {
  const t = TONE[status] ?? TONE.waiting
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 22, pl: 0.875, pr: 1, borderRadius: '5px',
      fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.fg,
      ...(onDark && { boxShadow: '0 0 0 1px rgb(255 255 255 / .2)' }),
    }}>
      <Box component="svg" viewBox="0 0 12 12" aria-hidden sx={{ width: 10, height: 10, flex: 'none' }}>{MARK[status] ?? MARK.waiting}</Box>
      {label ?? STATUS_META[status]?.label ?? status}
    </Box>
  )
}

const BARS: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }

/** Priorità come segnale a 4 tacche + etichetta; Critica nel tono di errore. */
export function IssuePriorityMark({ priority, compact }: { priority: string; compact?: boolean }) {
  const n = BARS[priority] ?? 0
  const crit = priority === 'critical'
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: crit ? 'error.main' : 'text.secondary', fontWeight: crit ? 600 : 500, whiteSpace: 'nowrap' }}>
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <Box key={i} component="i" sx={{ width: 3, height: 3 + i * 2.25, borderRadius: '1px', bgcolor: i <= n ? (crit ? 'error.main' : 'text.secondary') : 'divider' }} />
        ))}
      </Box>
      {compact ? null : PRIORITY_META[priority]?.label ?? priority}
    </Box>
  )
}
