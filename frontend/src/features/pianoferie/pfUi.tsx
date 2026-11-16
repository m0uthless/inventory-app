import * as React from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { initialsOf } from './pianoFerieShared'
import { STATUS_LABEL, swatchOfKey, type SwatchKey } from './pfModel'
import type { AbsenceStatus } from './pianoFerieShared'

/** Quadratino colore della legenda HR. Le proposte hanno il bordo tratteggiato. */
export function Swatch({ k, size = 12 }: { k: SwatchKey; size?: number }) {
  const sw = swatchOfKey(k)
  return (
    <Box component="span" aria-hidden sx={{
      display: 'inline-block', flex: 'none', width: size, height: size, borderRadius: '3px',
      border: '1.5px solid', borderColor: sw.fg, borderStyle: k === 'ferie_p' ? 'dashed' : 'solid', bgcolor: sw.bg,
    }} />
  )
}

export function StatusBadge({ status }: { status: AbsenceStatus }) {
  const tone = status === 'validata' ? { bgcolor: 'success.light', color: 'success.main' }
    : status === 'proposta' ? { bgcolor: 'warning.light', color: 'warning.main' }
      : { bgcolor: 'archie.neutralBg', color: 'text.secondary', textDecoration: 'line-through' }
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', ...tone }}>
      {STATUS_LABEL[status]}
    </Box>
  )
}

export function Ava({ name, size = 24, sx, style }: { name: string; size?: number; sx?: SxProps<Theme>; style?: React.CSSProperties }) {
  return (
    <Box component="span" aria-hidden style={style} sx={[{
      display: 'inline-grid', placeItems: 'center', flex: 'none', width: size, height: size, borderRadius: '50%',
      bgcolor: 'archie.neutralBg', color: 'text.secondary', fontSize: Math.max(8, Math.round(size * 0.38)), fontWeight: 650, letterSpacing: 0,
    }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {initialsOf(name)}
    </Box>
  )
}

/** Riga "nome + sottotitolo" che taglia con i puntini. */
export function NameSub({ name, sub }: { name: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'grid', minWidth: 0, textAlign: 'left', '& > b': { fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, '& > small': { fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }}>
      <b>{name}</b>
      {sub ? <small>{sub}</small> : null}
    </Box>
  )
}
