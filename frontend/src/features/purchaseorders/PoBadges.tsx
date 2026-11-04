import type * as React from 'react'
import { Box } from '@mui/material'
import { STATUS_LABEL, STATUS_ORDER, type PurchaseOrderStatus } from './types'

const TONE: Record<PurchaseOrderStatus, { bg: string; fg: string }> = {
  inserito: { bg: 'archie.neutralBg', fg: 'text.secondary' },
  inviato: { bg: 'info.light', fg: 'info.main' },
  ricevuto: { bg: 'warning.light', fg: 'warning.main' },
  fatturato: { bg: 'success.light', fg: 'success.main' },
}

/** Stato del flusso con 4 tacche: la posizione nel flusso si legge anche senza colore. */
export function PoStatusBadge({ status, onDark }: { status: PurchaseOrderStatus; onDark?: boolean }) {
  const t = TONE[status] ?? TONE.inserito
  const i = STATUS_ORDER.indexOf(status)
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 22, pl: 0.875, pr: 1, borderRadius: '5px',
      fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', bgcolor: t.bg, color: t.fg,
      ...(onDark && { boxShadow: '0 0 0 1px rgb(255 255 255 / .2)' }),
    }}>
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', gap: '2px' }}>
        {STATUS_ORDER.map((s, j) => <Box key={s} component="i" sx={{ width: 6, height: 10, borderRadius: '2px', bgcolor: 'currentColor', opacity: j <= i ? 1 : 0.25 }} />)}
      </Box>
      {STATUS_LABEL[status] ?? status}
    </Box>
  )
}

/** Committente: pastiglia del suo colore di riconoscimento + nome (il colore è un dato, non decorazione). */
export function Committente({ name, color, sub }: { name: string; color: string; sub?: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0, lineHeight: 1.35 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color, flex: 'none' }} />
        {name}
      </Box>
      {sub ? <Box sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pl: 2 }}>{sub}</Box> : null}
    </Box>
  )
}
