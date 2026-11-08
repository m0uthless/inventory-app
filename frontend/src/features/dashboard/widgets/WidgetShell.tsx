import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import type { TintKey } from '../../../theme/palettes'
import { tintVeil, tintedBg } from './tints'

type Props = {
  tone: TintKey
  icon?: SvgIconComponent
  title?: React.ReactNode
  /** Elementi accanto al titolo (conteggi, area…). */
  extra?: React.ReactNode
  /** Link a destra della testata ("Tutte →"). */
  link?: { label: string; to: string }
  /** Azioni a destra della testata (es. "+"). */
  actions?: React.ReactNode
  children: React.ReactNode
  /** false = carta bianca con il solo bordo (riservato a casi speciali). */
  tinted?: boolean
  bodySx?: SxProps<Theme>
  sx?: SxProps<Theme>
  ariaLabel?: string
}

/**
 * Cornice dei widget della Dashboard "Tinte" (anteprima design-previews/db-base.html):
 * fondo tinto tenue, angoli 14px, icona piena nel tono medio del widget, titolo in grassetto.
 */
export default function WidgetShell({ tone, icon: Icon, title, extra, link, actions, children, tinted = true, bodySx, sx, ariaLabel }: Props) {
  return (
    <Box component="section" aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)} sx={[{
      height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '14px',
      bgcolor: tinted ? (t: Theme) => tintedBg(t, tone) : 'background.paper', border: '1px solid', borderColor: tinted ? 'transparent' : 'divider',
      color: 'text.primary',
    }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {title ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, px: 2, pt: 1.75, pb: 0.75, minHeight: 48 }}>
          {Icon ? <Icon aria-hidden sx={{ fontSize: 21, color: (t) => t.palette.archie.tints[tone].mid, flex: 'none' }} /> : null}
          <Typography component="h2" sx={{ fontSize: 13.5, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Typography>
          {extra}
          <Box sx={{ flex: 1 }} />
          {actions}
          {link ? (
            <Box component={RouterLink} to={link.to} sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', borderRadius: '4px',
              color: (t) => t.palette.archie.tints[tone].ink, '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
              '&:focus-visible': { outline: 'none', boxShadow: (t) => t.palette.archie.focusRing },
            }}>{link.label}<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} /></Box>
          ) : null}
        </Box>
      ) : null}
      <Box sx={[{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, ...(Array.isArray(bodySx) ? bodySx : [bodySx])]}>{children}</Box>
    </Box>
  )
}

/** Numero grande nel tono del widget, con l'unità accanto. */
export function BigNumber({ tone, value, unit, size = 40 }: { tone: TintKey; value: React.ReactNode; unit?: React.ReactNode; size?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flex: 'none' }}>
      <Box component="b" sx={{ fontSize: size, lineHeight: 1, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: (t) => t.palette.archie.tints[tone].ink }}>{value}</Box>
      {unit ? <Box component="span" sx={{ fontSize: 13, fontWeight: 550, color: 'text.secondary' }}>{unit}</Box> : null}
    </Box>
  )
}

/** Piccolo contatore accanto al titolo. */
export function CountPill({ tone, children }: { tone: TintKey; children: React.ReactNode }) {
  return (
    <Box component="span" sx={{
      fontSize: 11, fontWeight: 650, lineHeight: '19px', px: 0.85, borderRadius: '6px', whiteSpace: 'nowrap',
      color: (t) => t.palette.archie.tints[tone].ink, bgcolor: (t) => tintVeil(t, tone, 20),
    }}>{children}</Box>
  )
}

/** Stato vuoto o di caricamento dentro un widget. */
export function WidgetNote({ children }: { children: React.ReactNode }) {
  return <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pb: 2, textAlign: 'center', fontSize: 12.5, color: 'text.secondary' }}>{children}</Box>
}
