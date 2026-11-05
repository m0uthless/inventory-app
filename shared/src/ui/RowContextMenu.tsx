import * as React from 'react'
import { Box, ListItemIcon, ListItemText, Menu, MenuItem, type MenuProps } from '@mui/material'
import { useDrawerAppearance } from './DrawerShell'

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
  const campo = useDrawerAppearance() === 'campo'

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      PaperProps={{
        elevation: 6,
        sx: campo ? {
          minWidth: 200, p: 0.5,
          '& .MuiList-root': { p: 0 },
          '& .MuiMenuItem-root': { minHeight: 32, px: 1, borderRadius: '5px', gap: 1, fontSize: 13 },
          '& .MuiListItemIcon-root': { minWidth: 0, color: 'text.secondary', '& svg': { fontSize: 16 } },
          '& .MuiMenuItem-root:hover': { bgcolor: 'archie.surface2' },
        } : {
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
              fontSize: campo ? 13 : '0.8rem',
              fontWeight: campo ? 400 : 500,
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
