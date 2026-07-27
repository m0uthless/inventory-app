import * as React from 'react'
import { Box, List, Popover, Typography } from '@mui/material'

import { SIDEBAR } from '../theme/tokens'
import type { NavItem } from './appLayoutNav'

// ─── Popover di flyout per un gruppo di nav (sidebar mini) ────────────────────

export function NavGroupFlyout({
  open,
  anchorEl,
  onClose,
  onMouseEnter,
  onMouseLeave,
  label,
  items,
  renderItem,
}: {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  label: string
  items: NavItem[]
  renderItem: (item: NavItem) => React.ReactNode
}) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableRestoreFocus
      disableScrollLock
      sx={{ pointerEvents: 'none' }}
      PaperProps={{
        onMouseEnter,
        onMouseLeave,
        sx: {
          pointerEvents: 'auto',
          ml: 1,
          mt: -0.25,
          minWidth: 248,
          borderRadius: 1,
          overflow: 'hidden',
          background: SIDEBAR.bgGradient,
          color: '#ffffff',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35)',
          border: '1px solid rgba(94,234,212,0.12)',
        },
      }}
    >
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            px: 1,
            pb: 0.75,
            color: SIDEBAR.textMuted,
            letterSpacing: '0.16em',
            fontWeight: 800,
          }}
        >
          {label}
        </Typography>

        <List disablePadding sx={{ display: 'grid', gap: 0.35 }}>
          {items.map((child) => (
            <React.Fragment key={`${label}-flyout-${child.path}`}>
              {renderItem(child)}
            </React.Fragment>
          ))}
        </List>
      </Box>
    </Popover>
  )
}
