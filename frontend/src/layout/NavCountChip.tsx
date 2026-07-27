import { Chip } from '@mui/material'
import { SIDEBAR } from '../theme/tokens'

// ─── Chip contatore per badge sidebar (feedback / issue) ─────────────────────

export function renderFeedbackCount(count: number | null | undefined, tone: 'open' | 'resolved' = 'open') {
  if (!count) return null
  return (
    <Chip
      size="small"
      label={count > 99 ? '99+' : count}
      sx={{
        height: 20,
        fontSize: '0.72rem',
        fontWeight: 800,
        borderRadius: 1.25,
        color: tone === 'open' ? SIDEBAR.accentBright : SIDEBAR.textStrong,
        bgcolor: tone === 'open' ? SIDEBAR.selectedBgHover : SIDEBAR.chipBg,
        border: '1px solid',
        borderColor: tone === 'open' ? SIDEBAR.chipBorderOpen : SIDEBAR.chipBorder,
        '& .MuiChip-label': { px: 0.9 },
      }}
    />
  )
}

export function renderIssueCount(count: number | null | undefined) {
  if (!count) return null
  return (
    <Chip
      size="small"
      label={count > 99 ? '99+' : count}
      sx={{
        height: 20,
        fontSize: '0.72rem',
        fontWeight: 800,
        borderRadius: 1.25,
        color: SIDEBAR.accentBright,
        bgcolor: SIDEBAR.selectedBgHover,
        border: '1px solid',
        borderColor: SIDEBAR.chipBorderOpen,
        '& .MuiChip-label': { px: 0.9 },
      }}
    />
  )
}
