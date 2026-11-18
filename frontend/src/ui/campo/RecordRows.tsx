import * as React from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { CampoIcon } from './CampoIcon'

/**
 * Righe dei record collegati dentro la finestra dei record (DESIGN.md › Record window,
 * anteprima design-previews/core-base.html): a filo, separate da una linea che resta ferma.
 * Al passaggio del mouse cambia solo il colore del titolo e compare la freccia (niente sfondo).
 * Colonne: `lead` facoltativo (icona libera, etichetta di tipo o avatar), titolo + dettaglio,
 * `end` (stato, conteggi), freccia.
 */
export function RecordRow({ lead, title, sub, end, onClick, leadWidth = 20, ariaLabel }: {
  lead?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
  end?: React.ReactNode
  onClick?: () => void
  /** Larghezza della colonna `lead` in px (20 per un'icona, ~88 per un'etichetta di tipo). */
  leadWidth?: number
  ariaLabel?: string
}) {
  const cols = [lead ? `${leadWidth}px` : null, 'minmax(0, 1fr)', 'auto', onClick ? '16px' : null].filter(Boolean).join(' ')
  const body = (
    <>
      {lead ? <Box sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.secondary', minWidth: 0 }}>{lead}</Box> : null}
      <Box sx={{ minWidth: 0, display: 'grid', lineHeight: 1.3, textAlign: 'left' }}>
        <Typography className="rr-title" noWrap sx={{ fontSize: 13, fontWeight: 550, color: 'text.primary', transition: 'color .12s' }}>{title}</Typography>
        {sub ? <Typography noWrap component="div" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{sub}</Typography> : null}
      </Box>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flex: 'none', fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{end}</Box>
      {onClick ? <Box className="rr-go" sx={{ display: 'inline-flex', color: 'text.disabled', opacity: 0, transition: 'opacity .12s' }}><CampoIcon name="chevR" size={15} /></Box> : null}
    </>
  )
  const sx = {
    display: 'grid', gridTemplateColumns: cols, alignItems: 'center', columnGap: 1.5, width: '100%', minHeight: 48, py: 0.75,
    borderTop: '1px solid', borderColor: 'divider', '&:first-of-type': { borderTop: 0 },
  } as const
  if (!onClick) return <Box sx={sx}>{body}</Box>
  return (
    <ButtonBase onClick={onClick} aria-label={ariaLabel} sx={{
      ...sx, justifyContent: 'stretch', borderRadius: 0,
      '&:hover .rr-title': { color: 'primary.main' }, '&:hover .rr-go, &.Mui-focusVisible .rr-go': { opacity: 1 },
      '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing, borderRadius: '6px' },
    }}>{body}</ButtonBase>
  )
}

/** Contenitore delle righe: la linea fra una riga e l'altra la mette `RecordRow`. */
export function RecordRows({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'grid' }}>{children}</Box>
}

export function RecordEmpty({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 0.75 }}>{children}</Typography>
}

/** Conteggio accanto al titolo di una sezione: «Siti 5». */
export function SectionCount({ n }: { n: number | null | undefined }) {
  return n == null ? null : <Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{n}</Box>
}

/** Etichetta di stato/tipo su tono tenue (In lavorazione, Server, Da attivare…). */
export function SoftTag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'info' | 'warning' | 'success' | 'sky' | 'mint' | 'sand' }) {
  return (
    <Box component="span" sx={(t) => {
      const tint = tone === 'sky' || tone === 'mint' || tone === 'sand' ? t.palette.archie.tints[tone] : null
      const pal = tone === 'info' ? { bg: t.palette.info.light, fg: t.palette.info.main } : tone === 'warning' ? { bg: t.palette.warning.light, fg: t.palette.warning.main }
        : tone === 'success' ? { bg: t.palette.success.light, fg: t.palette.success.main } : tint ? { bg: tint.bg, fg: tint.ink } : { bg: t.palette.archie.neutralBg, fg: t.palette.text.secondary }
      return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 20, px: 0.875, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, whiteSpace: 'nowrap', bgcolor: pal.bg, color: pal.fg, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }
    }}>{children}</Box>
  )
}
