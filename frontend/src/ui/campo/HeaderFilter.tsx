import * as React from 'react'
import { Box, Button, ButtonBase, Checkbox, IconButton, InputBase, Popover, Radio, Tooltip } from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'

export type FilterOption = { value: string; label: string; count?: number }

type Props = {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  /** Una sola scelta (filtri backend a valore singolo). */
  single?: boolean
  /** Ordinamento dal menu (facoltativo). */
  onSort?: (dir: 'asc' | 'desc') => void
  /** Campo di ricerca tra le opzioni (liste lunghe). */
  searchable?: boolean
}

/**
 * Imbuto nell'intestazione di colonna (DESIGN.md › Data table): visibile al
 * passaggio o quando il filtro è attivo; apre ordinamento + elenco valori.
 * Da usare in `renderHeader` di una colonna DataGrid (con `disableColumnMenu`).
 */
export function HeaderFilter({ label, options, selected, onChange, single, onSort, searchable }: Props) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const [draft, setDraft] = React.useState<string[]>(selected)
  const [q, setQ] = React.useState('')
  const on = selected.length > 0
  const open = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setDraft(selected)
    setQ('')
    setAnchor(e.currentTarget)
  }
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options
  const toggle = (v: string) => setDraft((d) => single ? (d[0] === v ? [] : [v]) : d.includes(v) ? d.filter((x) => x !== v) : [...d, v])

  return (
    <>
      <Tooltip title={`Filtra ${label}`}>
        <IconButton
          size="small"
          className={`hf-btn${on ? ' is-on' : ''}${anchor ? ' is-open' : ''}`}
          aria-label={`Filtra ${label}`}
          aria-haspopup="dialog"
          onClick={open}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            ml: 'auto', width: 24, height: 24, p: 0, '& svg': { fontSize: 15 },
            opacity: on || anchor ? 1 : 0, transition: 'opacity .12s',
            ...(on && { bgcolor: 'archie.field', borderColor: 'archie.fieldLine', color: 'primary.main' }),
            '&.Mui-focusVisible': { opacity: 1 },
          }}
        >
          <FilterAltOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { sx: { width: 248, p: 0.75, mt: 0.5 }, role: 'dialog', 'aria-label': `Filtra ${label}` } }}
      >
        {onSort ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, pb: 0.75, mb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Button size="small" variant="outlined" startIcon={<ArrowUpwardIcon />} onClick={() => { onSort('asc'); setAnchor(null) }}>Crescente</Button>
            <Button size="small" variant="outlined" startIcon={<ArrowDownwardIcon />} onClick={() => { onSort('desc'); setAnchor(null) }}>Decrescente</Button>
          </Box>
        ) : null}
        {searchable ? (
          <InputBase autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca…" inputProps={{ 'aria-label': `Cerca in ${label}` }}
            sx={{ width: '100%', height: 30, px: 1, mb: 0.5, fontSize: 13, border: '1px solid', borderColor: 'divider', borderRadius: '6px' }} />
        ) : null}
        <Box sx={{ maxHeight: 260, overflowY: 'auto', display: 'grid' }}>
          {shown.map((o) => (
            <ButtonBase key={o.value} onClick={() => toggle(o.value)} sx={{ justifyContent: 'flex-start', gap: 1, height: 30, px: 0.5, borderRadius: '5px', fontSize: 13, '&:hover': { bgcolor: 'archie.surface2' } }}>
              {single
                ? <Radio size="small" checked={draft.includes(o.value)} tabIndex={-1} sx={{ p: 0.25 }} />
                : <Checkbox size="small" checked={draft.includes(o.value)} tabIndex={-1} sx={{ p: 0.25 }} />}
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</Box>
              {o.count != null ? <Box component="small" sx={{ ml: 'auto', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{o.count}</Box> : null}
            </ButtonBase>
          ))}
          {!shown.length ? <Box sx={{ p: 1, fontSize: 12, color: 'text.secondary' }}>Nessun valore</Box> : null}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.75, mt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button size="small" onClick={() => { onChange([]); setAnchor(null) }}>Rimuovi filtro</Button>
          <Button size="small" variant="contained" onClick={() => { onChange(draft); setAnchor(null) }}>Applica</Button>
        </Box>
      </Popover>
    </>
  )
}

/** Intestazione di colonna con etichetta + imbuto, da usare in `renderHeader`. */
export function FilterHeader({ title, filter }: { title: string; filter?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', minWidth: 0 }}>
      <Box component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Box>
      {filter}
    </Box>
  )
}

/** Stile da aggiungere al DataGrid per mostrare l'imbuto al passaggio sull'intestazione. */
export const headerFilterGridSx = {
  '& .MuiDataGrid-columnHeader:hover .hf-btn, & .MuiDataGrid-columnHeader:focus-within .hf-btn': { opacity: 1 },
  '& .MuiDataGrid-columnHeaderTitleContainerContent': { width: '100%' },
} as const

export type ActiveFilter = { key: string; label: string; values: string }

/** Filtri attivi sopra la tabella, rimovibili, con "Azzera filtri". */
export function FilterTokens({ filters, onRemove, onClear, empty }: {
  filters: ActiveFilter[]
  onRemove: (key: string) => void
  onClear: () => void
  empty?: React.ReactNode
}) {
  if (!filters.length) return empty ? <Box sx={{ fontSize: 12, color: 'text.disabled' }}>{empty}</Box> : null
  return (
    <Box aria-label="Filtri attivi" aria-live="polite" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
      {filters.map((f) => (
        <Box key={f.key} sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 26, pl: 1, pr: 0.25, fontSize: 12,
          bgcolor: 'archie.field', border: '1px solid', borderColor: 'archie.fieldLine', borderRadius: '6px',
        }}>
          <Box component="span" sx={{ color: 'text.secondary' }}>{f.label}</Box>
          <Box component="b" sx={{ fontWeight: 600 }}>{f.values}</Box>
          <IconButton size="small" aria-label={`Rimuovi filtro ${f.label}`} onClick={() => onRemove(f.key)} sx={{ width: 20, height: 20, p: 0, '& svg': { fontSize: 14 } }}>
            <CloseIcon />
          </IconButton>
        </Box>
      ))}
      <Button size="small" onClick={onClear} sx={{ color: 'primary.main' }}>Azzera filtri</Button>
    </Box>
  )
}
