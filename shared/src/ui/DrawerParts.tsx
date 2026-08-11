/**
 * Componenti di layout per il corpo dei drawer di dettaglio ARCHIE.
 *
 * DrawerSection   — card con bordo, titolo sezione uppercase e corpo
 * DrawerFieldRow  — riga label + valore (con eventuale copia clipboard)
 * DrawerAddressSection — card indirizzo + slot mappa (Customer, Site)
 * DrawerEmptyState — messaggio quando il dettaglio non è disponibile
 * DrawerLoadingState — spinner + testo "Caricamento…"
 */

import * as React from 'react'
import {
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'

// ─── DrawerSection ────────────────────────────────────────────────────────────

/** Accento colore opzionale per categorizzare visivamente una sezione (bordo sx + titolo colorati). */
export type DrawerSectionAccent = 'info' | 'secondary' | 'warning' | 'success' | 'neutral'

/** Colore per l'accento 'neutral' (Note e sezioni di testo libero non categorizzate). Allineato a text.secondary. */
const NEUTRAL_ACCENT_COLOR = '#64748b'

export interface DrawerSectionProps {
  /** Icona opzionale affiancata al titolo */
  icon?: React.ReactNode
  /** Titolo sezione (reso uppercase via CSS) */
  title?: string
  /** Variante visiva: 'default' = sfondo leggermente più chiaro | 'muted' = ancora più sfumato */
  variant?: 'default' | 'muted'
  /** Accento colore per categoria (bordo sinistro + titolo). Opt-in, retrocompatibile se omesso. */
  accent?: DrawerSectionAccent
  children: React.ReactNode
  sx?: SxProps<Theme>
}

export function DrawerSection({
  icon,
  title,
  variant = 'default',
  accent,
  children,
  sx,
}: DrawerSectionProps) {
  const bg = variant === 'muted' ? '#fafafa' : '#f8fafc'
  const border = variant === 'muted' ? 'grey.100' : 'grey.200'

  const accentSx: SxProps<Theme> | undefined = accent
    ? {
        bgcolor: (theme: Theme) =>
          accent === 'neutral' ? alpha(NEUTRAL_ACCENT_COLOR, 0.06) : alpha(theme.palette[accent].main, 0.08),
        border: 'none',
        borderLeft: '3px solid',
        borderLeftColor: accent === 'neutral' ? NEUTRAL_ACCENT_COLOR : `${accent}.main`,
        borderRadius: 1,
      }
    : undefined

  return (
    <Box
      sx={{
        bgcolor: bg,
        border: '1px solid',
        borderColor: border,
        borderRadius: 1,
        p: 1.75,
        ...accentSx,
        ...sx,
      }}
    >
      {title ? (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: accent ? (accent === 'neutral' ? 'text.secondary' : `${accent}.dark`) : 'text.disabled',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1,
          }}
        >
          {icon}
          {title}
        </Typography>
      ) : null}
      {children}
    </Box>
  )
}

// ─── DrawerFieldRow ───────────────────────────────────────────────────────────

export interface DrawerFieldRowProps {
  label: string
  value?: string | null
  /** Usa font monospace per il valore */
  mono?: boolean
  /** Mostra bottone copia (richiede che value sia non vuoto) */
  copy?: boolean
  /** Larghezza minima della colonna label. Default 80. */
  labelMinWidth?: number
  /** Callback al click su copia. Se omesso usa navigator.clipboard direttamente. */
  onCopy?: (value: string) => void
}

export function DrawerFieldRow({
  label,
  value,
  mono = false,
  copy = false,
  labelMinWidth = 80,
  onCopy,
}: DrawerFieldRowProps) {
  if (!value) return null

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(value)
      return
    }
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // fallback legacy
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.cssText = 'position:fixed;left:-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ py: 0.75 }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.disabled', minWidth: labelMinWidth, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontFamily: mono ? 'monospace' : undefined,
            fontSize: mono ? 12 : undefined,
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 220,
          }}
        >
          {value}
        </Typography>
        {copy && (
          <Tooltip title="Copia">
            <IconButton aria-label="Copia" size="small" onClick={handleCopy}>
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  )
}

// ─── DrawerFieldList ──────────────────────────────────────────────────────────

/**
 * Lista di DrawerFieldRow con divider automatici, da usare dentro DrawerSection.
 */
export interface DrawerFieldListProps {
  rows: DrawerFieldRowProps[]
  /** Callback globale per copia, passata a ogni riga */
  onCopy?: (value: string) => void
}

export function DrawerFieldList({ rows, onCopy }: DrawerFieldListProps) {
  const visible = rows.filter((r) => Boolean(r.value))
  if (visible.length === 0) return null

  return (
    <Stack
      divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}
    >
      {visible.map((row) => (
        <DrawerFieldRow key={row.label} {...row} onCopy={onCopy} />
      ))}
    </Stack>
  )
}

// ─── DrawerAddressSection ─────────────────────────────────────────────────────

/**
 * Card indirizzo + mappa, usata nei drawer di dettaglio che hanno una
 * localizzazione fisica (Customer, Site). Il componente mappa vero e proprio
 * (es. LeafletMap) resta responsabilità del chiamante e va passato via `mapSlot`,
 * per non introdurre una dipendenza da librerie di mappe dentro `shared`.
 */
export interface DrawerAddressSectionProps {
  /** Testo indirizzo già formattato (es. "Via Roma 1, Bologna") */
  address: string
  /** Nodo mappa (es. <LeafletMap address={address} height={320} zoom={15} />) */
  mapSlot: React.ReactNode
}

export function DrawerAddressSection({ address, mapSlot }: DrawerAddressSectionProps) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.disabled',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 0.5,
          }}
        >
          <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          Indirizzo
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {address}
        </Typography>
      </Box>
      <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>{mapSlot}</Box>
    </Box>
  )
}

// ─── DrawerLoadingState ───────────────────────────────────────────────────────

export function DrawerLoadingState({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
      <CircularProgress size={18} />
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        {label}
      </Typography>
    </Stack>
  )
}

// ─── DrawerEmptyState ─────────────────────────────────────────────────────────

export function DrawerEmptyState({ label = 'Nessun dettaglio disponibile.' }: { label?: string }) {
  return (
    <Typography variant="body2" sx={{ opacity: 0.7 }}>
      {label}
    </Typography>
  )
}
