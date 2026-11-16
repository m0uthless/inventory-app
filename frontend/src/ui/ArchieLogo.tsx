import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'

/*
 * Logo di Archie: schedario a tre barre (il cassetto centrale estratto) +
 * lettering "archie" a tratto unico, con il punto della i come piccolo cassetto.
 * È disegnato inline (non <img>) così segue il tema attivo e la modalità
 * chiara/scura. Le copie statiche sono in public/logo.svg e public/favicon.svg:
 * se cambi la geometria qui, aggiorna anche quelle.
 *
 * Unità: il simbolo occupa 48×48; il logo completo è 221×48.
 */

/** Porta il lettering (disegnato su una griglia propria) accanto al simbolo, alla stessa altezza. */
const WORDMARK_TRANSFORM = 'translate(63.65 -6.92) scale(1.2493)'

export type ArchieLogoProps = {
  /** Altezza in px; la larghezza segue le proporzioni. */
  height?: number
  /** `full` = simbolo + scritta, `symbol` = solo lo schedario. */
  variant?: 'full' | 'symbol'
  /** Testo alternativo per i lettori di schermo. */
  label?: string
  sx?: SxProps<Theme>
}

export function ArchieLogo({ height = 32, variant = 'full', label = 'Archie', sx }: ArchieLogoProps) {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const bar = theme.palette.primary.main
  const accent = dark ? theme.palette.archie.seq[3] : theme.palette.archie.seq[1]
  const ink = dark ? theme.palette.text.primary : theme.palette.archie.band
  const full = variant === 'full'

  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      sx={[{ display: 'inline-flex', flex: 'none', height, lineHeight: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <svg viewBox={full ? '0 0 221 48' : '0 0 48 48'} aria-hidden="true" focusable="false" style={{ display: 'block', height: '100%', width: 'auto', maxWidth: '100%' }}>
        <rect x="5" y="6.5" width="30" height="9" rx="4.5" fill={bar} />
        <rect x="13" y="19.5" width="30" height="9" rx="4.5" fill={accent} />
        <rect x="5" y="32.5" width="30" height="9" rx="4.5" fill={bar} />
        {full ? (
          <g transform={WORDMARK_TRANSFORM}>
            <g fill="none" stroke={ink} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="30" r="10" />
              <path d="M22 20V40" />
              <path d="M31 40V28A8 8 0 0 1 39 20H41" />
              <path d="M64.07 22.93A10 10 0 1 0 64.07 37.07" />
              <path d="M70 10V40M70 28A8 8 0 0 1 86 28V40" />
              <path d="M95 20V40" />
              <path d="M102 30H122A10 10 0 1 0 119.07 37.07" />
            </g>
            <rect x="92.1" y="9.3" width="5.8" height="5.8" rx="1.4" fill={accent} />
          </g>
        ) : null}
      </svg>
    </Box>
  )
}
