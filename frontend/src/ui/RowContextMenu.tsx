import * as React from 'react'
import { ListItemIcon, ListItemText, Menu, MenuItem, type MenuProps } from '@mui/material'

export type RowContextMenuItem = {
  key: string
  label: string
  icon?: React.ReactNode
  onClick: () => void | Promise<void>
  disabled?: boolean
  hidden?: boolean
  tone?: 'default' | 'danger'
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
          minWidth: 220,
          borderRadius: 2,
          '& .MuiMenuItem-root': {
            minHeight: 38,
            fontSize: '0.9rem',
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
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          />
        </MenuItem>
      ))}
    </Menu>
  )
}
