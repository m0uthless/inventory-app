import * as React from 'react'
import { Box, ButtonBase, InputBase, MenuItem, TextField, Typography } from '@mui/material'

/*
 * Pezzi comuni delle finestre dei record anagrafici (Cliente, Sito, Contatto — DESIGN.md › Record window):
 * campi della colonna laterale con il bordo arancio quando cambiano, conteggi nella testata,
 * note, e l'apertura che aspetta i dati collegati.
 */

import { recordMono } from './recordShared'

const labelSx = { fontSize: 11.5, fontWeight: 550, color: 'text.secondary' } as const

export function RecordInput({ label, value, onChange, dirty, disabled, missing, mono, placeholder, max, ariaLabel }: {
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  dirty?: boolean
  disabled?: boolean
  /** Campo atteso ma vuoto: «manca» accanto all'etichetta. */
  missing?: boolean
  mono?: boolean
  placeholder?: string
  max?: number
  ariaLabel?: string
}) {
  const miss = missing && !value.trim()
  return (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
      <Typography component="label" sx={labelSx}>
        {label}{miss ? <Box component="span" sx={{ ml: 0.75, color: 'warning.main', fontWeight: 600 }}>manca</Box> : null}
      </Typography>
      <InputBase value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        inputProps={{ 'aria-label': ariaLabel ?? (typeof label === 'string' ? label : undefined), maxLength: max }}
        sx={(t) => ({
          height: 34, px: 1.25, fontSize: 13, borderRadius: '6px', border: '1px solid', bgcolor: 'background.paper',
          borderColor: dirty ? 'warning.main' : miss ? 'warning.light' : 'divider', ...(mono ? { '& input': { ...recordMono, fontSize: 12.5 } } : {}),
          '&.Mui-focused': { borderColor: 'primary.main', boxShadow: t.palette.archie.focusRing },
        })} />
    </Box>
  )
}

export function RecordSelect({ label, value, onChange, options, dirty, disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; mark?: React.ReactNode }[]
  dirty?: boolean
  disabled?: boolean
}) {
  return (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
      <Typography component="label" sx={labelSx}>{label}</Typography>
      <TextField select size="small" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        slotProps={{ htmlInput: { 'aria-label': label } }}
        sx={{ '& .MuiOutlinedInput-root': { height: 34, fontSize: 13 }, '& fieldset': { borderColor: dirty ? 'warning.main' : undefined } }}>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>{o.mark}{o.label}</Box></MenuItem>
        ))}
      </TextField>
    </Box>
  )
}

/** Valore non modificabile da qui; con `onClick` diventa un collegamento (es. il cliente del sito). */
export function RecordReadOnly({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  const box = { height: 34, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, borderRadius: '6px', bgcolor: 'archie.surface2', fontSize: 13, color: 'text.secondary', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } as const
  return (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
      <Typography sx={labelSx}>{label}</Typography>
      {onClick ? (
        <ButtonBase onClick={onClick} sx={{ ...box, justifyContent: 'space-between', color: 'primary.main', fontWeight: 550, '&:hover': { bgcolor: 'archie.field' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</Box>
          <Box component="span" aria-hidden sx={{ flex: 'none', fontSize: 14 }}>›</Box>
        </ButtonBase>
      ) : <Box sx={box}>{children}</Box>}
    </Box>
  )
}

export function RecordNotes({ value, onChange, dirty, disabled, placeholder }: { value: string; onChange: (v: string) => void; dirty?: boolean; disabled?: boolean; placeholder?: string }) {
  return (
    <InputBase multiline minRows={3} value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      inputProps={{ 'aria-label': 'Note' }}
      sx={(t) => ({ width: '100%', p: '8px 10px', fontSize: 13, lineHeight: 1.5, borderRadius: '6px', border: '1px solid', borderColor: dirty ? 'warning.main' : 'divider', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: t.palette.archie.focusRing } })} />
  )
}

/** Conteggio sulla testata («5 siti») che porta alla sezione; `warn` lo colora d'arancio con il motivo nel tooltip. */
export function BandStat({ n, one, many, warn, onClick }: { n: number | null; one: string; many: string; warn?: string; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} title={warn} sx={{
      height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee',
      '&:hover': { bgcolor: warn ? 'rgb(224 164 58 / .4)' : 'rgb(255 255 255 / .22)', color: '#fff' }, '& b': { fontWeight: 700, color: '#fff', mr: 0.5 },
      '&.Mui-focusVisible': { boxShadow: '0 0 0 2px rgb(255 255 255 / .6)' },
    }}><b>{n ?? '…'}</b>{n === 1 ? one : many}</ButtonBase>
  )
}

/** Etichetta sulla testata accanto al titolo (vendor, stato, «Nel cestino»). */
export function BandChip({ children }: { children: React.ReactNode }) {
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 11.5, fontWeight: 600, px: 1, py: '2px', borderRadius: '5px', bgcolor: 'rgb(255 255 255 / .16)' }}>{children}</Box>
}

/** Sezione in arrivo: spazio fermo e vuoto, niente spinner. */
export function RecordLoader() {
  return <Box aria-busy="true" sx={{ minHeight: 48 }} />
}
