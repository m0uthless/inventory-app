import * as React from 'react'
import { Box, ButtonBase, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import type { Tone } from './types'
import { FS, ICON, toneColors, issuePriorityTone, copyText, MonoField } from './style'
import { RADIUS, LABEL_COLOR } from './tokens'
import { SHARED } from '../../theme/constants'

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
          bgcolor: alpha(SHARED.pureWhite, 0.16), color: SHARED.pureWhite,
          border: `1px solid ${alpha(SHARED.pureWhite, 0.32)}`,
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: SHARED.pureWhite, fontSize: ICON.inline, ml: '4px' },
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
          bgcolor: 'transparent', color: alpha(SHARED.pureWhite, 0.92),
          borderColor: alpha(SHARED.pureWhite, 0.32),
          cursor: onClick ? 'pointer' : 'default',
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: alpha(SHARED.pureWhite, 0.85), fontSize: ICON.inline, ml: '4px' },
          ...(onClick ? { '&:hover': { bgcolor: alpha(SHARED.pureWhite, 0.14) } } : {}),
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

// ─── ActionButton — pulsante azione di riga ─────────────────────────────────────
// Con `label` mostra anche il testo da `labelFrom` in su: le icone nude (nota,
// VPN, contatti, info) si capivano solo passandoci sopra col mouse. Sotto quel
// breakpoint resta l'icona quadrata da 36px con aria-label e tooltip.

export function ActionButton({
  icon, tone = 'neutral', onClick, ariaLabel, title, label, labelFrom = 'lg',
}: {
  icon: React.ReactElement
  tone?: 'info' | 'neutral' | 'success' | 'danger' | 'warning'
  onClick?: (e: React.MouseEvent) => void
  ariaLabel: string
  title?: string
  label?: string
  labelFrom?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const theme = useTheme()
  const paletteColor = {
    info: theme.palette.info,
    success: theme.palette.success,
    danger: theme.palette.error,
    warning: theme.palette.warning,
  }[tone as 'info' | 'success' | 'danger' | 'warning']
  const isNeutral = tone === 'neutral'
  const colors = {
    border: isNeutral ? alpha(theme.palette.text.secondary, 0.28) : alpha(paletteColor.main, 0.28),
    bg: isNeutral ? 'background.paper' : alpha(paletteColor.main, 0.10),
    fg: isNeutral ? 'grey.700' : paletteColor.dark,
    hoverBg: isNeutral ? 'action.hover' : alpha(paletteColor.main, 0.20),
    hoverBorder: isNeutral ? 'text.secondary' : paletteColor.main,
  }
  const btn = (
    <ButtonBase
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => e.stopPropagation()}
      sx={{
        minWidth: 36, height: 36, px: label ? { xs: 0, [labelFrom]: 1.25 } : 0,
        gap: 0.75, borderRadius: RADIUS, flexShrink: 0,
        border: '1px solid', borderColor: colors.border,
        bgcolor: colors.bg, color: colors.fg,
        fontSize: FS.label, fontWeight: 600, fontFamily: 'inherit',
        transition: 'background 0.15s, border-color 0.15s',
        '&:hover': onClick ? { bgcolor: colors.hoverBg, borderColor: colors.hoverBorder } : {},
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
        '& svg': { fontSize: ICON.feature },
      }}
    >
      {icon}
      {label ? (
        <Box component="span" aria-hidden="true" sx={{ display: { xs: 'none', [labelFrom]: 'inline' }, whiteSpace: 'nowrap' }}>
          {label}
        </Box>
      ) : null}
    </ButtonBase>
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
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${value} ${label}: ${tooltip.toLowerCase()}`}
        onKeyDown={onClick ? (e) => {
          e.stopPropagation()
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as React.MouseEvent) }
        } : undefined}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: 44, px: 0.5, py: 0.25, borderRadius: RADIUS,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'background 0.15s',
          '&:hover': onClick ? { bgcolor: 'action.hover' } : undefined,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
        }}
      >
        <Typography sx={{ fontWeight: 800, lineHeight: 1, fontSize: FS.title, color: 'text.primary' }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: FS.micro, fontWeight: 600, color: LABEL_COLOR, lineHeight: 1.3 }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ─── IpCell ───────────────────────────────────────────────────────────────────
// Stessa taglia/fontFamily dei campi K#/Seriale (monoFieldSx): l'IP è un campo
// tecnico come gli altri, deve avere lo stesso peso visivo in riga.

export function IpCell({ ip, query }: { ip?: string | null; query?: string }) {
  if (!ip) return <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <MonoField value={ip} query={query} sx={{ color: 'text.primary' }} />
      <Tooltip title="Copia IP">
        <IconButton size="small" aria-label={`Copia IP ${ip}`} onClick={(e) => { e.stopPropagation(); void copyText(ip) }}
          onKeyDown={(e) => e.stopPropagation()}
          sx={{ opacity: 0.55, '&:hover, &:focus-visible': { opacity: 1 }, p: 0.25 }}>
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
