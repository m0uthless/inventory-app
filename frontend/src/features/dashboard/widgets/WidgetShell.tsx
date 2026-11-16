import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import type { DashTone } from '../../../theme/palettes'
import { DARK_INK, tintVeil } from './tints'
import { useWidgetOff } from '../widgetOff'

/** Trattamento del widget: carta (come le tabelle), tinta tenue, scuro (testata delle schede), post-it. */
export type WidgetLook = 'paper' | 'tint' | 'dark' | 'postit'

type Props = {
  tone: DashTone
  look?: WidgetLook
  icon?: SvgIconComponent
  title?: React.ReactNode
  /** Elementi accanto al titolo (conteggi, area…). */
  extra?: React.ReactNode
  /** Link a destra della testata ("Tutte →"). */
  link?: { label: string; to: string }
  /** Azioni a destra della testata (es. "+"). */
  actions?: React.ReactNode
  children: React.ReactNode
  bodySx?: SxProps<Theme>
  sx?: SxProps<Theme>
  ariaLabel?: string
}

const lookSx = (look: WidgetLook, tone: DashTone) => {
  if (look === 'dark') return { background: (t: Theme) => `linear-gradient(160deg, ${t.palette.archie.band2}, ${t.palette.archie.band})`, borderColor: 'transparent', color: DARK_INK.text }
  if (look === 'postit') return {
    bgcolor: (t: Theme) => t.palette.archie.dash.postit.bg, borderColor: 'transparent', borderRadius: '4px', color: (t: Theme) => t.palette.archie.dash.postit.ink,
    boxShadow: '0 12px 20px -12px rgb(90 70 0 / .38), 0 1px 2px rgb(90 70 0 / .08)', transform: 'rotate(-.6deg)',
  }
  if (look === 'tint') return { bgcolor: (t: Theme) => t.palette.archie.dash[tone].bg, borderColor: 'transparent', color: 'text.primary' }
  return { bgcolor: 'background.paper', borderColor: 'divider', color: 'text.primary' }
}

/**
 * Cornice dei widget della Dashboard "Aurora" (anteprima design-previews/db-base.html, variante F):
 * angoli 12px, icona nel tono medio, titolo in grassetto; il trattamento distingue un widget dall'altro.
 */
export default function WidgetShell({ tone, look = 'paper', icon: Icon, title, extra, link, actions, children, bodySx, sx, ariaLabel }: Props) {
  const dark = look === 'dark'
  return (
    <Box component="section" aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)} sx={[{
      position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px', border: '1px solid',
      ...lookSx(look, tone),
    }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {look === 'postit' ? (
        // Angolo piegato del foglietto
        <Box aria-hidden sx={{ position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, zIndex: 1, borderTopLeftRadius: '4px', pointerEvents: 'none',
          background: (t) => `linear-gradient(315deg, ${t.palette.background.default} 0 50%, ${t.palette.archie.dash.postit.mid} 50% 100%)`, boxShadow: '-2px -2px 4px rgb(90 70 0 / .10)' }} />
      ) : null}
      {title ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, px: 2, pt: 1.75, pb: 0.75, minHeight: 48 }}>
          {Icon ? <Icon aria-hidden sx={{ fontSize: 21, flex: 'none', color: (t) => (dark ? DARK_INK.mid : look === 'postit' ? t.palette.archie.dash.postit.ink : t.palette.archie.dash[tone].mid), opacity: look === 'postit' ? 0.75 : 1 }} /> : null}
          <Typography component="h2" sx={{ fontSize: 13.5, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'inherit' }}>{title}</Typography>
          {extra}
          <WidgetOffChip />
          <Box sx={{ flex: 1 }} />
          {actions}
          {link ? (
            <Box component={RouterLink} to={link.to} sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', borderRadius: '4px',
              color: (t) => (dark ? DARK_INK.link : t.palette.archie.dash[tone].ink), '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
              '&:focus-visible': { outline: 'none', boxShadow: (t) => t.palette.archie.focusRing },
            }}>{link.label}<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} /></Box>
          ) : null}
        </Box>
      ) : null}
      <Box sx={[{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, ...(Array.isArray(bodySx) ? bodySx : [bodySx])]}>{children}</Box>
    </Box>
  )
}

/** Numero grande con l'unità accanto: inchiostro del testo, rosso se segnala uno stato da recuperare, bianco sul widget scuro. */
export function BigNumber({ value, unit, size = 40, alert = false, dark = false }: { value: React.ReactNode; unit?: React.ReactNode; size?: number; alert?: boolean; dark?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flex: 'none' }}>
      <Box component="b" sx={{ fontSize: size, lineHeight: 1, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: dark ? DARK_INK.text : alert ? 'error.main' : 'text.primary' }}>{value}</Box>
      {unit ? <Box component="span" sx={{ fontSize: 13, fontWeight: 550, color: dark ? DARK_INK.sub : 'text.secondary' }}>{unit}</Box> : null}
    </Box>
  )
}

/** Piccolo contatore accanto al titolo. */
export function CountPill({ tone, children }: { tone: DashTone; children: React.ReactNode }) {
  return (
    <Box component="span" sx={{
      fontSize: 11, fontWeight: 650, lineHeight: '19px', px: 0.85, borderRadius: '6px', whiteSpace: 'nowrap',
      color: (t) => t.palette.archie.dash[tone].ink, bgcolor: (t) => tintVeil(t, tone, 20),
    }}>{children}</Box>
  )
}

/** Stato vuoto o di caricamento dentro un widget. */
export function WidgetNote({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pb: 2, textAlign: 'center', fontSize: 12.5, color: dark ? DARK_INK.sub : 'text.secondary' }}>{children}</Box>
}

/** Etichetta «spento» per i widget di un modulo spento (li vede solo il superuser). */
export function WidgetOffChip() {
  const off = useWidgetOff()
  if (!off) return null
  return (
    <Box component="span" title="Modulo spento: lo vedi solo tu perché sei superuser" sx={{
      flex: 'none', px: 0.75, lineHeight: '18px', borderRadius: '5px', fontSize: 11, fontWeight: 600,
      bgcolor: 'warning.main', color: 'background.paper',
    }}>spento</Box>
  )
}
