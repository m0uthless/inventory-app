import * as React from 'react'
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import type { Tone } from './types'
import { FS, ICON, toneColors, issuePriorityTone, copyText, MonoField } from './style'

// ─── SignalChip — badge "segnale" ──────────────────────────────────────────────

export function SignalChip({
  label, tone, icon, inverse, sx,
}: {
  label: React.ReactNode
  tone: Tone
  icon?: React.ReactElement
  inverse?: boolean
  sx?: object
}) {
  const theme = useTheme()
  const c = toneColors(theme, tone)
  if (inverse) {
    // Variante per header a fondo pieno (es. sezione città aperta): outline chiaro su fondo scuro
    return (
      <Chip
        size="small"
        icon={icon}
        label={label}
        sx={{
          height: 22, fontSize: FS.label, fontWeight: 700,
          bgcolor: 'rgba(255,255,255,0.16)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.32)',
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: '#fff', fontSize: ICON.inline, ml: '4px' },
          ...sx,
        }}
      />
    )
  }
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        height: 22, fontSize: FS.label, fontWeight: 700,
        bgcolor: c.bg, color: c.fg,
        border: `1px solid ${c.border}`,
        '& .MuiChip-label': { px: 0.75 },
        '& .MuiChip-icon': { color: c.fg, fontSize: ICON.inline, ml: '4px' },
        ...sx,
      }}
    />
  )
}

// ─── MetaTag — badge "meta tray" ────────────────────────────────────────────────

export function MetaTag({
  label, icon, inverse, onClick, sx,
}: {
  label: React.ReactNode
  icon?: React.ReactElement
  inverse?: boolean
  onClick?: (e: React.MouseEvent) => void
  sx?: object
}) {
  if (inverse) {
    return (
      <Chip
        size="small"
        icon={icon}
        label={label}
        variant="outlined"
        onClick={onClick}
        sx={{
          height: 22, fontSize: FS.label, fontWeight: 700,
          bgcolor: 'transparent', color: 'rgba(255,255,255,0.92)',
          borderColor: 'rgba(255,255,255,0.32)',
          cursor: onClick ? 'pointer' : 'default',
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: 'rgba(255,255,255,0.85)', fontSize: ICON.inline, ml: '4px' },
          ...(onClick ? { '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' } } : {}),
          ...sx,
        }}
      />
    )
  }
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      variant="outlined"
      onClick={onClick}
      sx={{
        height: 22, fontSize: FS.label, fontWeight: 600,
        bgcolor: 'background.paper', color: 'text.secondary',
        borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        '& .MuiChip-label': { px: 0.75 },
        '& .MuiChip-icon': { color: 'text.secondary', fontSize: ICON.inline, ml: '4px' },
        ...(onClick ? { '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', color: 'primary.main' } } : {}),
        ...sx,
      }}
    />
  )
}

// ─── ActionButton — pulsante quadrato Info/Modifica ─────────────────────────────

export function ActionButton({
  icon, tone = 'neutral', onClick, ariaLabel, title,
}: {
  icon: React.ReactElement
  tone?: 'info' | 'neutral' | 'success' | 'danger'
  onClick?: (e: React.MouseEvent) => void
  ariaLabel: string
  title?: string
}) {
  const theme = useTheme()
  const paletteColor = {
    info: theme.palette.info,
    success: theme.palette.success,
    danger: theme.palette.error,
  }[tone as 'info' | 'success' | 'danger']
  const isNeutral = tone === 'neutral'
  const btn = (
    <IconButton
      size="small"
      aria-label={ariaLabel}
      onClick={onClick}
      sx={{
        width: 32, height: 32, p: 0, borderRadius: '8px', flexShrink: 0,
        border: '1px solid',
        borderColor: isNeutral ? alpha(theme.palette.text.secondary, 0.28) : alpha(paletteColor.main, 0.28),
        bgcolor: isNeutral ? 'background.paper' : alpha(paletteColor.main, 0.10),
        color: isNeutral ? 'text.secondary' : paletteColor.dark,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? {
          bgcolor: isNeutral ? 'action.hover' : alpha(paletteColor.main, 0.20),
          borderColor: isNeutral ? 'text.secondary' : paletteColor.main,
          color: isNeutral ? 'primary.main' : paletteColor.dark,
        } : {},
        '& svg': { fontSize: ICON.feature },
      }}
    >
      {icon}
    </IconButton>
  )
  return title ? <Tooltip title={title} arrow>{btn}</Tooltip> : btn
}

// ─── CountStat — metrica numerica silenziosa (siti/asset) ──────────────────────
// Il grado più leggero della gerarchia "meta": nessun contenitore, solo peso
// tipografico. Riservato a contatori puramente informativi.

export function CountStat({
  value, label, tooltip, onClick,
}: {
  value: number | string
  label: string
  tooltip: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <Tooltip title={tooltip} arrow>
      <Box
        onClick={onClick}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: 42, px: 0.5, py: 0.25, borderRadius: '6px',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'background 0.15s',
          '&:hover': onClick ? { bgcolor: 'action.hover' } : undefined,
        }}
      >
        <Typography sx={{ fontWeight: 800, lineHeight: 1, fontSize: FS.title, color: 'text.primary' }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: FS.micro, fontWeight: 700, color: 'text.secondary', opacity: 0.85, lineHeight: 1.3, letterSpacing: '0.05em' }}>
          {label.toUpperCase()}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ─── IpCell ───────────────────────────────────────────────────────────────────
// Stessa taglia/fontFamily dei campi K#/Seriale (monoFieldSx): l'IP è un campo
// tecnico come gli altri, deve avere lo stesso peso visivo in riga.

export function IpCell({ ip }: { ip?: string | null }) {
  if (!ip) return <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <MonoField value={ip} sx={{ color: 'text.primary' }} />
      <Tooltip title="Copia IP">
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); void copyText(ip) }}
          sx={{ opacity: 0.35, '&:hover': { opacity: 1 }, p: 0.25 }}>
          <ContentCopyIcon sx={{ fontSize: ICON.inline }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

// ─── ActiveIssueIcon ──────────────────────────────────────────────────────────

export function ActiveIssueIcon({ priority }: { priority?: string | null }) {
  const theme = useTheme()
  const c = toneColors(theme, issuePriorityTone(priority))
  const label = priority === 'critical' ? 'Issue critica aperta'
    : priority === 'high'   ? 'Issue alta priorità aperta'
    : priority === 'low'    ? 'Issue a bassa priorità aperta'
    : "C'è almeno una issue aperta."
  return (
    <Tooltip title={label}>
      <WarningAmberRoundedIcon sx={{ color: c.solid, fontSize: ICON.inline, flexShrink: 0 }} />
    </Tooltip>
  )
}
