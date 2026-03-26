import { Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'login_failed' | 'logout' | string

type ChipDef =
  | { label: string; color: 'success' | 'info' | 'error' | 'warning' | 'default'; sx?: never }
  | { label: string; color?: never; sx: SxProps<Theme> }

function actionToChip(action: AuditAction): ChipDef {
  const a = (action || '').toLowerCase()
  switch (a) {
    case 'create':
      return { label: 'Creato',      color: 'success' }
    case 'update':
      return { label: 'Modificato',  color: 'info' }
    case 'delete':
      return { label: 'Eliminato',   color: 'error' }
    case 'restore':
      return { label: 'Ripristinato', color: 'warning' }
    case 'login':
      return {
        label: 'Login',
        sx: {
          bgcolor: '#ede9fe',
          color: '#5b21b6',
          border: '1px solid #c4b5fd',
          fontWeight: 700,
        },
      }
    case 'login_failed':
      return {
        label: 'Login fallito',
        sx: {
          bgcolor: '#fce7f3',
          color: '#9d174d',
          border: '1px solid #f9a8d4',
          fontWeight: 700,
        },
      }
    case 'logout':
      return {
        label: 'Logout',
        sx: {
          bgcolor: '#f0f9ff',
          color: '#0369a1',
          border: '1px solid #bae6fd',
          fontWeight: 700,
        },
      }
    default:
      return { label: action || '—', color: 'default' }
  }
}

export default function AuditActionChip(props: { action: AuditAction; size?: 'small' | 'medium' }) {
  const { action, size = 'small' } = props
  const def = actionToChip(action)

  if (def.sx) {
    return <Chip size={size} label={def.label} variant="filled" sx={def.sx} />
  }

  return (
    <Chip
      size={size}
      label={def.label}
      color={def.color}
      variant={def.color === 'default' ? 'outlined' : 'filled'}
    />
  )
}
