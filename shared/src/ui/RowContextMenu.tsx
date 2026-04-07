import * as React from 'react'
import { Box, ListItemIcon, ListItemText, Menu, MenuItem, type MenuProps } from '@mui/material'

export type RowContextMenuItem = {
  key: string
  label: string
  icon?: React.ReactNode
  onClick: () => void | Promise<void>
  disabled?: boolean
  hidden?: boolean
  tone?: 'default' | 'danger'
  badge?: string
  badgeTone?: 'success' | 'neutral'
}

type Props = {
  open: boolean
  anchorPosition: MenuProps['anchorPosition']
  onClose: () => void
  items: RowContextMenuItem[]
}

export default function RowContextMenu({ open, anchorPosition, onClose, items }: Props) {
  const visibleItems = items.filter((item) => !item.hidden)

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      PaperProps={{
        elevation: 6,
        sx: {
          minWidth: 176,
          borderRadius: 1,
          '& .MuiMenuItem-root': {
            minHeight: 30,
            fontSize: '0.8rem',
          },
          '& .MuiListItemIcon-root': {
            minWidth: 30,
          },
        },
      }}
    >
      {visibleItems.map((item) => (
        <MenuItem
          key={item.key}
          disabled={item.disabled}
          onClick={() => {
            onClose()
            void item.onClick()
          }}
          sx={item.tone === 'danger' ? { color: 'error.main' } : undefined}
        >
          {item.icon ? <ListItemIcon sx={item.tone === 'danger' ? { color: 'error.main' } : undefined}>{item.icon}</ListItemIcon> : null}
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          />
          {item.badge && (
            <Box
              component="span"
              sx={{
                ml: 1,
                fontSize: '0.65rem',
                fontWeight: 600,
                px: 0.75,
                py: 0.2,
                borderRadius: 0.75,
                bgcolor: item.badgeTone === 'success' ? 'success.50' : 'action.hover',
                color: item.badgeTone === 'success' ? 'success.700' : 'text.secondary',
                border: '0.5px solid',
                borderColor: item.badgeTone === 'success' ? 'success.200' : 'divider',
                whiteSpace: 'nowrap',
              }}
            >
              {item.badge}
            </Box>
          )}
        </MenuItem>
      ))}
    </Menu>
  )
}
