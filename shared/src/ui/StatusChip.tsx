import { Chip, type ChipProps } from '@mui/material'

// Palette coerente con Customers/Sites (status_id -> colori).
// Consolidamento colori 0.9.x: riassegnata in sync con
// frontend/src/theme/statusTokens.ts → DomainStatusTokens.entityStatus
// (quella è la fonte "principale" per Archie mobile; questa è la copia
// condivisa consumata anche da Archie desktop e dal Portal — vanno
// mantenute allineate a mano, shared/ non può importare da frontend/).
const STATUS_STYLE_BY_ID: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#E0F2FE', fg: '#0369A1' }, // azzurro — invariato
  2: { bg: '#E2E8F0', fg: '#334155' }, // slate — NUOVO (era verde)
  3: { bg: '#DCFCE7', fg: '#166534' }, // verde — era 2
  4: { bg: '#FEF9C3', fg: '#854D0E' }, // giallo — era 3
  5: { bg: '#FEE2E2', fg: '#991B1B' }, // rosso — era 4
  6: { bg: '#EDE9FE', fg: '#5B21B6' }, // viola — era 5 (l'arancio, ex-6, è stato rimosso)
}

function statusChipSx(statusId?: number | null) {
  const s = statusId ? STATUS_STYLE_BY_ID[statusId] : null
  return {
    fontWeight: 400,
    ...(s
      ? {
          bgcolor: s.bg,
          color: s.fg,
          border: '1px solid transparent',
        }
      : {
          bgcolor: 'rgba(0,0,0,0.04)',
          color: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(0,0,0,0.10)',
        }),
  } as const
}

export type StatusChipProps = Omit<ChipProps, 'label'> & {
  statusId?: number | null
  label?: string | null
}

export default function StatusChip(props: StatusChipProps) {
  const { statusId, label, sx, size = 'small', variant = 'filled', ...rest } = props
  const sxArr = Array.isArray(sx) ? sx : sx ? [sx] : []
  const resolvedLabel = label || '—'
  const defaultAriaLabel = resolvedLabel !== '—' ? `Stato: ${resolvedLabel}` : 'Stato'

  return (
    <Chip
      size={size}
      variant={variant}
      label={resolvedLabel}
      title={resolvedLabel}
      aria-label={defaultAriaLabel}
      sx={[statusChipSx(statusId), ...sxArr]}
      {...rest}
    />
  )
}
