import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'

import { KIND_LABEL, STATUS_LABEL, type T2sKind, type T2sStatus } from './api'

const pulse = keyframes`0%, 100% { opacity: .35 } 50% { opacity: 1 }`
const chip = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: 20, px: '7px', borderRadius: '5px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' } as const

const STATUS_SX: Record<T2sStatus, object> = {
  queued: { bgcolor: 'archie.neutralBg', color: 'text.secondary' },
  running: { bgcolor: 'info.light', color: 'info.main' },
  done: { bgcolor: 'success.light', color: 'success.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
}
const KIND_SX: Record<Exclude<T2sKind, ''>, object> = {
  read: { bgcolor: 'archie.neutralBg', color: 'text.secondary' },
  write: { bgcolor: 'warning.light', color: 'warning.main' },
  impossible: { bgcolor: 'error.light', color: 'error.main' },
}

export function StatusBadge({ status }: { status: T2sStatus }) {
  return (
    <Box component="span" sx={{ ...chip, ...STATUS_SX[status] }}>
      {status === 'running' ? <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'currentColor', animation: `${pulse} 1.2s ease-in-out infinite`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} /> : null}
      {STATUS_LABEL[status]}
    </Box>
  )
}

export function KindBadge({ kind }: { kind: T2sKind }) {
  if (!kind) return null
  return <Box component="span" sx={{ ...chip, fontWeight: 650, ...KIND_SX[kind] }}>{KIND_LABEL[kind]}</Box>
}
