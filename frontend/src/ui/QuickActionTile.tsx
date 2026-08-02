import * as React from 'react'
import { Box, Card, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'

type Props = {
  /** Icona del modulo, usata solo come watermark grande e trasparente sullo sfondo. */
  watermarkIcon: React.ReactNode
  /** Etichetta breve sotto il "+" (es. "Issue", "Triage"). */
  label: string
  /** Colore pieno di sfondo (non gradiente). */
  background: string
  borderColor: string
  hoverBorderColor: string
  glowColor: string
  onClick: () => void
  disabled?: boolean
  /**
   * 'fill' (default): riempie tutta la cella della griglia.
   * 'square': dimensione fissa e compatta (84x84), centrata nel genitore
   * invece di riempire tutta l'altezza della riga — usato da
   * QuickActionsPairCard per affiancare due tile piccole, non due "hero"
   * card enormi.
   */
  fit?: 'fill' | 'square'
}

const SQUARE_SIZE = 84

// Tile riusata dai widget dashboard "scorciatoia di creazione" (attualmente
// solo dal widget combinato QuickActionsPairCard). Colore pieno, icona del
// modulo come watermark di sfondo (stessa idea della torta/trofeo in
// trasparenza di ContributorCard/BirthdaysCard) e un grande "+" al centro.
// Leggero sollevamento al passaggio del mouse (nessuna animazione continua,
// solo la transizione sull'hover).
export default function QuickActionTile({
  watermarkIcon, label, background, borderColor, hoverBorderColor, glowColor, onClick, disabled, fit = 'fill',
}: Props) {
  const card = (
    <Card
      elevation={0}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={e => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() }
      }}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: fit === 'square' ? SQUARE_SIZE : '100%',
        width: fit === 'square' ? SQUARE_SIZE : '100%',
        flexShrink: 0,
        borderRadius: 1,
        bgcolor: background,
        border: '1px solid',
        borderColor,
        boxShadow: `0 14px 34px ${glowColor}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        '&:hover': disabled ? undefined : {
          transform: 'translateY(-2px)',
          boxShadow: `0 18px 40px ${glowColor}`,
          borderColor: hoverBorderColor,
        },
        '&:active': disabled ? undefined : { transform: 'translateY(0)' },
      }}
    >
      {/* Watermark grande di sfondo, stessa idea della torta/trofeo */}
      <Box sx={{ position: 'absolute', right: -8, bottom: -8, zIndex: 0, opacity: 0.18 }}>
        <Box sx={{ '& svg': { fontSize: fit === 'square' ? 56 : 84 } }}>{watermarkIcon}</Box>
      </Box>

      <Box sx={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: fit === 'square' ? 0.25 : 0.5,
      }}>
        <AddRoundedIcon sx={{ fontSize: fit === 'square' ? 30 : 52, color: '#fff' }} />
        <Typography variant="caption" fontWeight={800} sx={{
          color: '#fff', fontSize: fit === 'square' ? '0.65rem' : '0.78rem', letterSpacing: '0.02em',
        }}>
          {label}
        </Typography>
      </Box>
    </Card>
  )

  if (disabled) {
    return (
      <Tooltip title="Non hai i permessi necessari">
        <span style={{
          height: fit === 'square' ? SQUARE_SIZE : '100%',
          width: fit === 'square' ? SQUARE_SIZE : '100%',
          display: 'block',
        }}>{card}</span>
      </Tooltip>
    )
  }
  return card
}
