import { Chip } from '@mui/material'
import type { SidebarTokens } from '../theme/tokens'

// ─── Chip contatore per badge sidebar (feedback / issue) ─────────────────────
// Non sono componenti React (nessun hook al loro interno): sono helper
// invocati durante il render di AppLayout, che passa i token del tema
// sidebar attivo (letti lì con useSidebarTokens) invece di importare SIDEBAR
// staticamente — necessario da quando esistono più temi selezionabili.

export function renderFeedbackCount(
  count: number | null | undefined,
  tone: 'open' | 'resolved' = 'open',
  tokens: SidebarTokens,
) {
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
        color: tone === 'open' ? tokens.accentBright : tokens.textStrong,
        bgcolor: tone === 'open' ? tokens.selectedBgHover : tokens.chipBg,
        border: '1px solid',
        borderColor: tone === 'open' ? tokens.chipBorderOpen : tokens.chipBorder,
        '& .MuiChip-label': { px: 0.9 },
      }}
    />
  )
}

export function renderIssueCount(count: number | null | undefined, tokens: SidebarTokens) {
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
        color: tokens.accentBright,
        bgcolor: tokens.selectedBgHover,
        border: '1px solid',
        borderColor: tokens.chipBorderOpen,
        '& .MuiChip-label': { px: 0.9 },
      }}
    />
  )
}
