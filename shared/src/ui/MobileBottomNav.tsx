import * as React from 'react'
import { Box, Paper, Typography, Backdrop } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'

export type MobileNavItem = {
  key: string
  label: string
  icon: React.ReactNode
  path: string
}

export type MobileNavAction = {
  key: string
  label: string
  description?: string
  icon: React.ReactNode
  onClick: () => void
}

type Props = {
  color: string
  items: [MobileNavItem, MobileNavItem, MobileNavItem, MobileNavItem]
  activeKey: string
  onNavigate: (item: MobileNavItem) => void
  actions: MobileNavAction[]
}

const NAV_HEIGHT = 64
const CIRCLE_D = 52

export function MobileBottomNav({ color, items, activeKey, onNavigate, actions }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false)

  const left  = items.slice(0, 2) as [MobileNavItem, MobileNavItem]
  const right = items.slice(2, 4) as [MobileNavItem, MobileNavItem]

  const handleNavClick = (item: MobileNavItem) => {
    setMenuOpen(false)
    onNavigate(item)
  }

  const handleActionClick = (action: MobileNavAction) => {
    setMenuOpen(false)
    action.onClick()
  }

  return (
    <>
      <Backdrop
        open={menuOpen}
        onClick={() => setMenuOpen(false)}
        sx={{ zIndex: (t) => t.zIndex.appBar + 10, bgcolor: 'rgba(0,0,0,0.35)' }}
      />

      {/* Card menu azioni */}
      <Box
        sx={{
          position: 'fixed',
          bottom: NAV_HEIGHT + 12,
          left: 12,
          right: 12,
          zIndex: (t) => t.zIndex.appBar + 11,
          transform: menuOpen ? 'translateY(0)' : 'translateY(16px)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'all' : 'none',
          transition: 'transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s',
          display: { md: 'none' },
        }}
      >
        <Paper elevation={6} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Crea nuovo
            </Typography>
          </Box>
          {actions.map((action) => (
            <Box
              key={action.key}
              onClick={() => handleActionClick(action)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.75,
                px: 2, py: 1.5, cursor: 'pointer',
                borderBottom: '1px solid', borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background 0.15s',
              }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color, '& svg': { fontSize: 20 } }}>
                {action.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3 }}>{action.label}</Typography>
                {action.description && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3 }}>{action.description}</Typography>
                )}
              </Box>
            </Box>
          ))}
        </Paper>
      </Box>

      {/* Bottom nav bar */}
      <Box
        component="nav"
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: NAV_HEIGHT,
          bgcolor: color,
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          zIndex: (t) => t.zIndex.appBar + 5,
          boxShadow: '0 -2px 16px rgba(0,0,0,0.18)',
        }}
      >
        {left.map((item) => (
          <NavTab key={item.key} item={item} active={activeKey === item.key} onClick={() => handleNavClick(item)} />
        ))}

        {/* Slot + centrale — cerchio sopraelevato, label allineata agli altri tab */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pb: '10px',
            gap: 0.5,
            cursor: 'pointer',
            position: 'relative',
            height: '100%',
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Box
            sx={{
              width: CIRCLE_D,
              height: CIRCLE_D,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
              color,
              transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
              transform: menuOpen ? 'translateY(-14px) rotate(45deg)' : 'translateY(-14px)',
              '& svg': { fontSize: 28, transition: 'inherit' },
              mb: '-8px',
            }}
          >
            {menuOpen ? <CloseIcon /> : <AddIcon />}
          </Box>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1, userSelect: 'none' }}>
            Nuovo
          </Typography>
        </Box>

        {right.map((item) => (
          <NavTab key={item.key} item={item} active={activeKey === item.key} onClick={() => handleNavClick(item)} />
        ))}
      </Box>
    </>
  )
}

type NavTabProps = { item: MobileNavItem; active: boolean; onClick: () => void }

function NavTab({ item, active, onClick }: NavTabProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0.5, cursor: 'pointer', position: 'relative',
        height: '100%',
        WebkitTapHighlightColor: 'transparent',
        color: active ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
        transition: 'color 0.2s',
        '& svg': { fontSize: 22, transform: active ? 'translateY(-1px)' : 'none', transition: 'transform 0.2s' },
        '&::before': active ? {
          content: '""', position: 'absolute', top: 0,
          left: '22%', right: '22%', height: 3,
          bgcolor: 'rgba(255,255,255,0.9)', borderRadius: '0 0 3px 3px',
        } : {},
      }}
    >
      {item.icon}
      <Typography sx={{ fontSize: '0.6rem', fontWeight: active ? 700 : 500, color: 'inherit', lineHeight: 1 }}>
        {item.label}
      </Typography>
    </Box>
  )
}
