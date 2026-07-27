import * as React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import type { IpPoolEntry } from '../../api/vlanApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function ipCellColor(entry: IpPoolEntry): {
  bg: string
  text: string
  border: string
} {
  switch (entry.kind) {
    case 'network':
    case 'broadcast':
      return { bg: '#F1EFE8', text: '#5F5E5A', border: '#D3D1C7' }
    case 'gateway':
      return { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' }
    default:
      if (entry.status === 'used')     return { bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }
      if (entry.status === 'reserved') return { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' }
      if (entry.status === 'excluded') return { bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }
      return { bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }
  }
}

export function ipCellLabel(entry: IpPoolEntry): string {
  if (entry.kind === 'network') return 'NET'
  if (entry.kind === 'broadcast') return 'BCT'
  if (entry.kind === 'gateway') return 'GW'
  return ''
}

// ─── IP Cell ──────────────────────────────────────────────────────────────────

export default function IpCell({ entry, onClick, onContextMenu }: { entry: IpPoolEntry; onClick?: (e: IpPoolEntry) => void; onContextMenu?: (e: React.MouseEvent, entry: IpPoolEntry) => void }) {
  const { bg, text, border } = ipCellColor(entry)
  const label = ipCellLabel(entry)

  const tooltipContent =
    entry.kind === 'network'
      ? 'Indirizzo di rete'
      : entry.kind === 'broadcast'
      ? 'Indirizzo broadcast'
      : entry.kind === 'gateway'
      ? 'Gateway'
      : entry.status === 'used'
      ? `Occupato — ${entry.used_by ?? ''}${entry.used_by_type ? ` (${entry.used_by_type})` : ''}`
      : entry.status === 'reserved'
      ? `Riservato — richiesta in attesa`
      : entry.status === 'excluded'
      ? `Escluso — tasto destro per rimuovere l'esclusione`
      : 'Libero — clicca per richiedere'

  const isClickable = entry.kind === 'host' && (entry.status === 'used' || entry.status === 'free') && !!onClick
  const isContextable = entry.kind === 'host' && !!onContextMenu

  return (
    <Tooltip title={tooltipContent} placement="top" arrow>
      <Box
        onClick={isClickable ? () => onClick(entry) : undefined}
        onContextMenu={isContextable ? (e) => { e.preventDefault(); onContextMenu(e, entry) } : undefined}
        sx={{
          width: 90,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '3px',
          border: `1px solid ${border}`,
          bgcolor: bg,
          cursor: isClickable ? 'pointer' : 'default',
          position: 'relative',
          '&:hover': isClickable
            ? { opacity: 0.75, transform: 'scale(1.06)', transition: 'all 80ms', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
            : { opacity: 0.82, transform: 'scale(1.04)', transition: 'all 80ms' },
        }}
      >
        <Typography sx={{ fontSize: 9, fontWeight: 600, color: text, letterSpacing: '0.02em' }}>
          {entry.ip}
        </Typography>
        {label && (
          <Box
            sx={{
              position: 'absolute',
              top: -1,
              right: -1,
              bgcolor: border,
              borderRadius: '0 3px 0 3px',
              px: '3px',
              lineHeight: 1.4,
            }}
          >
            <Typography sx={{ fontSize: 7, fontWeight: 700, color: text }}>{label}</Typography>
          </Box>
        )}
        {entry.status === 'excluded' && (
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '3px',
            background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(163,45,45,0.18) 3px, rgba(163,45,45,0.18) 4px)',
            pointerEvents: 'none',
          }} />
        )}
      </Box>
    </Tooltip>
  )
}
