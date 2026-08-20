import { Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useWidgetAccents, useStatusTokens } from '../theme/AppThemeProvider'
import type { WidgetAccents } from '../theme/tokens'
import type { DomainStatusTokens } from '../theme/statusTokens'

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'login_failed' | 'logout' | string

type ChipDef =
  | { label: string; color: 'success' | 'info' | 'error' | 'warning' | 'default'; sx?: never }
  | { label: string; color?: never; sx: SxProps<Theme> }

function actionToChip(action: AuditAction, accents: WidgetAccents, statusTokens: DomainStatusTokens): ChipDef {
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
          bgcolor: accents.violetBg,
          color: accents.violetText,
          border: `1px solid ${accents.violetBorderChip}`,
          fontWeight: 700,
        },
      }
    case 'login_failed':
      return {
        label: 'Login fallito',
        sx: {
          bgcolor: statusTokens.auditAction.login_failed.bg,
          color: statusTokens.auditAction.login_failed.color,
          border: `1px solid ${statusTokens.auditAction.login_failed.border}`,
          fontWeight: 700,
        },
      }
    case 'logout':
      return {
        label: 'Logout',
        sx: {
          bgcolor: statusTokens.auditAction.logout.bg,
          color: statusTokens.auditAction.logout.color,
          border: `1px solid ${statusTokens.auditAction.logout.border}`,
          fontWeight: 700,
        },
      }
    default:
      return { label: action || '—', color: 'default' }
  }
}

export default function AuditActionChip(props: { action: AuditAction; size?: 'small' | 'medium' }) {
  const { action, size = 'small' } = props
  const accents = useWidgetAccents()
  const statusTokens = useStatusTokens()
  const def = actionToChip(action, accents, statusTokens)

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
