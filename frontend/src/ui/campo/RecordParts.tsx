import * as React from 'react'
import { Box, ButtonBase, InputBase, Menu, MenuItem, TextField, Typography } from '@mui/material'
import { CampoIcon } from './CampoIcon'

/*
 * Pezzi comuni delle finestre dei record anagrafici (Cliente, Sito, Contatto — DESIGN.md › Record window):
 * campi della colonna laterale con il bordo arancio quando cambiano, conteggi nella testata,
 * note, e l'apertura che aspetta i dati collegati.
 */

import { recordMono } from './recordShared'

const labelSx = { fontSize: 11.5, fontWeight: 550, color: 'text.secondary' } as const

export function RecordInput({ label, value, onChange, dirty, disabled, missing, mono, placeholder, max, ariaLabel, type }: {
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
  type?: 'text' | 'date'
}) {
  const miss = missing && !value.trim()
  return (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
      <Typography component="label" sx={labelSx}>
        {label}{miss ? <Box component="span" sx={{ ml: 0.75, color: 'warning.main', fontWeight: 600 }}>manca</Box> : null}
      </Typography>
      <InputBase type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
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
        slotProps={{ htmlInput: { 'aria-label': label }, select: { displayEmpty: true } }}
        sx={{ '& .MuiOutlinedInput-root': { height: 34, fontSize: 13 }, '& fieldset': { borderColor: dirty ? 'warning.main' : undefined } }}>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>{o.mark}{o.label}</Box></MenuItem>
        ))}
      </TextField>
    </Box>
  )
}

export function RecordNotes({ value, onChange, dirty, disabled, placeholder, ariaLabel = 'Note' }: { value: string; onChange: (v: string) => void; dirty?: boolean; disabled?: boolean; placeholder?: string; ariaLabel?: string }) {
  return (
    <InputBase multiline minRows={3} value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      inputProps={{ 'aria-label': ariaLabel }}
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

/** Un dato letto come testo (finestre in lettura): etichetta sopra, valore sotto, senza riquadro. */
export function RecordValue({ label, children, wide, mono }: { label: string; children?: React.ReactNode; wide?: boolean; mono?: boolean }) {
  const empty = children == null || children === '' || children === false
  return (
    <Box sx={{ display: 'grid', gap: '3px', minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <Typography component="span" sx={labelSx}>{label}</Typography>
      <Box component="span" sx={{ fontSize: mono ? 12.5 : 13, minHeight: 19, overflowWrap: 'anywhere', ...(mono ? recordMono : {}), color: empty ? 'text.disabled' : 'text.primary' }}>{empty ? '—' : children}</Box>
    </Box>
  )
}

/** Collegamento dentro un valore (cliente, sito): verde con la freccia, va a capo con il testo. */
export function RecordLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (!onClick) return <>{children}</>
  return (
    <ButtonBase onClick={onClick} sx={{ display: 'inline', justifySelf: 'start', font: 'inherit', fontSize: 13, fontWeight: 550, color: 'primary.main', textAlign: 'left', '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing, borderRadius: '3px' } }}>
      {children}<Box component="span" aria-hidden sx={{ ml: 0.5 }}>→</Box>
    </ButtonBase>
  )
}

/**
 * Un dato che si legge come testo e diventa un campo in modifica («Modifica» nel ⋯):
 * lo stesso schema per inventario, cliente, sito e contatto.
 */
export function RecordField({ editing, label, value, onChange, dirty, wide, mono, placeholder, missing, max, show, type }: {
  editing: boolean
  label: string
  value: string
  onChange: (v: string) => void
  dirty?: boolean
  wide?: boolean
  mono?: boolean
  placeholder?: string
  /** Dato atteso: «manca» in modifica, in arancio in lettura. */
  missing?: boolean
  max?: number
  /** Come mostrarlo in lettura (date, link…). */
  show?: (v: string) => React.ReactNode
  type?: 'text' | 'date'
}) {
  if (editing) {
    return (
      <Box sx={{ gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
        <RecordInput type={type} label={label} value={value} onChange={onChange} dirty={dirty} mono={mono} placeholder={placeholder} missing={missing} max={max} />
      </Box>
    )
  }
  const v = value.trim()
  return (
    <RecordValue label={label} wide={wide} mono={mono && Boolean(v)}>
      {v ? (show ? show(v) : v) : missing ? <Box component="span" sx={{ color: 'warning.main', fontWeight: 550, fontFamily: 'inherit' }}>manca</Box> : null}
    </RecordValue>
  )
}

/** Griglia a due colonne dei dati della colonna laterale. */
export function RecordGrid({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '12px 16px' }}>{children}</Box>
}

/** Etichetta «In modifica» sulla testata. */
export function BandEditing() {
  return <Box component="span" sx={{ fontSize: 11.5, fontWeight: 650, px: 1, py: '2px', borderRadius: '5px', bgcolor: '#e0a43a', color: '#2b1d00' }}>In modifica</Box>
}

/** Valore che si cambia sul posto da un piccolo menu (stato, priorità, assegnatario), senza passare da «Modifica». */
export function QuickPick({ label, value, options, onPick, disabled, after, wide }: {
  label: string
  value: React.ReactNode
  options: { value: string; label: React.ReactNode; selected?: boolean }[]
  onPick: (v: string) => void
  disabled?: boolean
  after?: React.ReactNode
  wide?: boolean
}) {
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  return (
    <Box sx={{ display: 'grid', gap: '3px', minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, minHeight: 22 }}>
        <ButtonBase disabled={disabled} aria-haspopup="menu" aria-label={`${label}: cambia`} onClick={(e) => setEl(e.currentTarget)} sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13, borderRadius: '6px', pr: 0.5, py: '1px',
          '&:hover': { bgcolor: 'archie.surface2', boxShadow: (t) => `0 0 0 4px ${t.palette.archie.surface2}` }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
        }}>
          {value}{disabled ? null : <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><CampoIcon name="chevD" size={13} /></Box>}
        </ButtonBase>
        {after}
      </Box>
      <Menu anchorEl={el} open={Boolean(el)} onClose={() => setEl(null)}>
        {options.map((o) => (
          <MenuItem key={o.value} selected={o.selected} onClick={() => { setEl(null); onPick(o.value) }} sx={{ fontSize: 13, gap: 1 }}>{o.label}</MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
