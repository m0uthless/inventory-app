import * as React from 'react'
import { Box, ButtonBase, Collapse, InputBase, Menu, MenuItem } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckIcon from '@mui/icons-material/Check'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

export type PropOption = { value: string; label: React.ReactNode }

type PropDef = {
  key: string
  label: string
  /** Valore mostrato. */
  display: React.ReactNode
  /** Menu di scelta (stato, priorità, assegnatario…). */
  options?: PropOption[]
  current?: string
  /** Campo libero (testo/data): valore iniziale e segnaposto. */
  text?: { value: string; placeholder?: string; type?: 'text' | 'date'; mono?: boolean }
  onChange?: (value: string) => void
  /** Occupa tutta la riga. */
  full?: boolean
  disabled?: boolean
}

/**
 * Proprietà comprimibili (DESIGN.md › Detail card): chiuse di default con un
 * riepilogo; aperte come elenco etichetta/valore su due colonne. Ogni valore è
 * un pulsante che apre un menu o un campo; il salvataggio lo fa il chiamante
 * (subito, con annulla).
 */
export function Properties({ props, summary, defaultOpen = false, storageKey }: {
  props: PropDef[]
  summary: React.ReactNode
  defaultOpen?: boolean
  storageKey?: string
}) {
  const [open, setOpen] = React.useState(() => {
    if (!storageKey) return defaultOpen
    try { return sessionStorage.getItem(storageKey) === '1' } catch { return defaultOpen }
  })
  React.useEffect(() => { if (storageKey) try { sessionStorage.setItem(storageKey, open ? '1' : '0') } catch { /* niente */ } }, [open, storageKey])
  return (
    <Box component="section" aria-label="Proprietà" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.25 }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} aria-expanded={open} sx={{
        display: 'flex', width: 'calc(100% + 16px)', mx: -1, px: 1, py: 0.5, minHeight: 36, gap: 1.25, borderRadius: '8px', justifyContent: 'flex-start',
        '&:hover': { bgcolor: 'archie.surface2' }, '&:hover .pm': { bgcolor: 'archie.field', color: 'primary.main' },
      }}>
        <Box className="pm" aria-hidden sx={{
          position: 'relative', width: 22, height: 22, flex: 'none', borderRadius: '6px', transition: 'background .12s, color .12s',
          bgcolor: open ? 'archie.field' : 'archie.neutralBg', color: open ? 'primary.main' : 'text.secondary',
          '&::before, &::after': { content: '""', position: 'absolute', left: '50%', top: '50%', width: 10, height: 2, m: '-1px 0 0 -5px', borderRadius: 1, bgcolor: 'currentColor', transition: 'transform .18s' },
          '&::after': { transform: open ? 'rotate(0)' : 'rotate(90deg)' },
        }} />
        <Box component="span" sx={{ fontSize: 12, fontWeight: 650 }}>Proprietà</Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 12, color: open ? 'text.disabled' : 'text.secondary' }}>
          {open ? 'clic su un valore per modificarlo · si salva subito' : summary}
        </Box>
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 1.5, pt: 0.5 }}>
          {props.map((p) => <PropRow key={p.key} p={p} />)}
        </Box>
      </Collapse>
    </Box>
  )
}

function PropRow({ p }: { p: PropDef }) {
  const [menuEl, setMenuEl] = React.useState<HTMLElement | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(p.text?.value ?? '')
  const editable = !p.disabled && !!p.onChange && (!!p.options || !!p.text)
  const commit = () => { setEditing(false); if (draft !== (p.text?.value ?? '')) p.onChange?.(draft) }
  return (
    <Box sx={{ gridColumn: p.full ? '1 / -1' : undefined }}>
      {editing && p.text ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', alignItems: 'center', columnGap: 0.75, minHeight: 32, px: 1, mx: -1 }}>
          <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{p.label}</Box>
          <InputBase autoFocus type={p.text.type ?? 'text'} value={draft} placeholder={p.text.placeholder}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') { e.stopPropagation(); setDraft(p.text?.value ?? ''); setEditing(false) } }}
            inputProps={{ 'aria-label': p.label }}
            sx={{ height: 26, px: 0.75, fontSize: 12, border: '1px solid', borderColor: 'primary.main', borderRadius: '5px', boxShadow: (t) => t.palette.archie.focusRing, fontFamily: p.text.mono ? '"Geist Mono", monospace' : undefined }} />
        </Box>
      ) : (
        <ButtonBase
          disabled={!editable}
          onClick={(e) => { if (p.options) setMenuEl(e.currentTarget); else { setDraft(p.text?.value ?? ''); setEditing(true) } }}
          aria-haspopup={p.options ? 'menu' : undefined}
          sx={{
            display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) 14px', alignItems: 'center', columnGap: 0.75, width: 'calc(100% + 16px)',
            minHeight: 32, px: 1, mx: -1, borderRadius: '6px', textAlign: 'left',
            '&:hover': { bgcolor: 'archie.surface2' }, '&:hover .pr-ic, &.Mui-focusVisible .pr-ic': { opacity: 1 },
            '&.Mui-disabled': { color: 'text.primary' },
          }}
        >
          <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{p.label}</Box>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 550, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: p.text?.mono ? '"Geist Mono", monospace' : undefined }}>{p.display}</Box>
          {editable ? (p.options ? <ExpandMoreIcon className="pr-ic" sx={{ fontSize: 14, color: 'text.disabled', opacity: 0 }} /> : <EditOutlinedIcon className="pr-ic" sx={{ fontSize: 13, color: 'text.disabled', opacity: 0 }} />) : <span />}
        </ButtonBase>
      )}
      {p.options ? (
        <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)} slotProps={{ paper: { sx: { minWidth: menuEl?.offsetWidth } } }}>
          {p.options.map((o) => (
            <MenuItem key={o.value} selected={o.value === p.current} onClick={() => { setMenuEl(null); if (o.value !== p.current) p.onChange?.(o.value) }}>
              {o.label}
              {o.value === p.current ? <CheckIcon sx={{ ml: 'auto', fontSize: 15, color: 'primary.main' }} /> : null}
            </MenuItem>
          ))}
        </Menu>
      ) : null}
    </Box>
  )
}
