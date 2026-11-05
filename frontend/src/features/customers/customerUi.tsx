/* eslint-disable react-refresh/only-export-components */
import { Box } from '@mui/material'
import { CampoIcon } from '../../ui/campo'
import type { ColorTriple } from '../../theme/statusTokens'

/** 2026-11-30 → 30/11/2026 */
export const dIt = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')

/** Giorni da oggi a una data ISO (negativo se passata). */
export const daysTo = (d: string) =>
  Math.round((new Date(d.slice(0, 10) + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 864e5)

/** Finestra di "in scadenza" (allineata a CONTRACT_EXPIRING_DAYS nel backend). */
export const EXPIRING_DAYS = 60

export function ClockIcon({ size = 14 }: { size?: number }) {
  return <CampoIcon name="clock" size={size} bold />
}

/** Vendor (= "stato" del cliente): quadratino di riconoscimento + nome, mai semaforico. */
export function VendorMark({ label, color }: { label?: string | null; color: string }) {
  if (!label) return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875, fontWeight: 550, whiteSpace: 'nowrap', minWidth: 0 }}>
      <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color, flex: 'none' }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
    </Box>
  )
}

/** Scadenza vicina: orologio + data in arancione, senza riquadro. */
export function ExpiryMark({ date, title }: { date: string; title?: string | null }) {
  const n = daysTo(date)
  return (
    <Box component="span" title={`${title ? title + ' · ' : ''}scade tra ${n} ${n === 1 ? 'giorno' : 'giorni'}`}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625, fontSize: 12, fontWeight: 600, color: 'warning.main', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <ClockIcon />{dIt(date)}
    </Box>
  )
}

// Tinte calme della palette dei committenti: niente rosso/rosa/fucsia (sembrano
// allarmi) né verde (è il colore di "ok"). Il vendor è un'etichetta, non uno stato.
const VENDOR_SLOTS = [4, 2, 3, 0, 8, 5]
/** Colore del vendor: per posizione nell'elenco dei vendor (sempre distinti), altrimenti per nome. */
export function vendorColorOf(label: string, palette: ColorTriple[], order: string[] = []): string {
  const i = order.indexOf(label)
  if (i >= 0) return (palette[VENDOR_SLOTS[i % VENDOR_SLOTS.length]] ?? palette[0]).color
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0
  const slot = VENDOR_SLOTS[Math.abs(h) % VENDOR_SLOTS.length]
  return (palette[slot] ?? palette[0]).color
}
