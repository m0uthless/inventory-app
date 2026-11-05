import * as React from 'react'
import { Box, CircularProgress, IconButton, InputBase, Tooltip } from '@mui/material'
import { CampoIcon } from './CampoIcon'
import { FilterTokens, type ActiveFilter } from './HeaderFilter'

type Props = {
  filters: ActiveFilter[]
  onRemoveFilter: (key: string) => void
  onClearFilters: () => void
  q: string
  onQChange: (v: string) => void
  searchPlaceholder?: string
  onExport?: () => void
  exporting?: boolean
  onColumns?: (anchor: HTMLElement) => void
  /** Se presente, la lente apre la ricerca per colonna sotto le intestazioni (come l'anteprima). */
  columnSearch?: { open: boolean; active: boolean; onToggle: () => void }
}

/**
 * Barra sopra la tabella (anteprima approvata, `.tb-row`): filtri attivi o
 * suggerimento a sinistra; Esporta, lente e Colonne a destra. La lente apre
 * la riga di ricerca sotto la barra.
 */
export function TableBar({ filters, onRemoveFilter, onClearFilters, q, onQChange, searchPlaceholder = 'Cerca…', onExport, exporting, onColumns, columnSearch }: Props) {
  const [open, setOpen] = React.useState(Boolean(q))
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  const on = columnSearch ? columnSearch.open : open || Boolean(q)
  const dot = columnSearch ? columnSearch.active : Boolean(q)
  const iconBtn = { width: 32, height: 32 }
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 49, px: '12px', py: '8px', borderBottom: on && !columnSearch ? 0 : '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <FilterTokens filters={filters} onRemove={onRemoveFilter} onClear={onClearFilters}
            empty={<Box component="span" sx={{ fontSize: 12, color: 'text.disabled' }}>Nessun filtro. Usa l'imbuto accanto al nome di una colonna.</Box>} />
        </Box>
        {onExport ? (
          <Tooltip title="Esporta le righe visibili">
            <span>
              <IconButton aria-label="Esporta le righe visibili" disabled={exporting} onClick={onExport} sx={iconBtn}>
                {exporting ? <CircularProgress size={14} /> : <CampoIcon name="download" />}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        <Tooltip title={columnSearch ? (on ? 'Chiudi la ricerca per colonna' : 'Cerca per colonna') : on ? 'Chiudi la ricerca' : 'Cerca nella tabella'}>
          <IconButton aria-label="Cerca nella tabella" aria-pressed={on} aria-expanded={on}
            onClick={() => { if (columnSearch) { columnSearch.onToggle(); return } if (on) { onQChange(''); setOpen(false) } else setOpen(true) }}
            sx={{ ...iconBtn, position: 'relative', ...(on && { bgcolor: 'archie.field', color: 'primary.main', borderColor: 'archie.fieldLine' }),
              ...(dot && { '&::after': { content: '""', position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', border: '1.5px solid', borderColor: 'background.paper' } }) }}>
            <CampoIcon name="search" />
          </IconButton>
        </Tooltip>
        {onColumns ? (
          <Tooltip title="Colonne">
            <IconButton aria-label="Colonne" onClick={(e) => onColumns(e.currentTarget)} sx={iconBtn}>
              <CampoIcon name="columns" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      {on && !columnSearch ? (
        <Box sx={{ px: '12px', pb: '10px', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, height: 32, px: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: '6px',
            bgcolor: 'archie.surface2', color: 'text.disabled', '&:focus-within': { borderColor: 'primary.main', bgcolor: 'background.paper', boxShadow: (t) => t.palette.archie.focusRing },
          }}>
            <CampoIcon name="search" size={15} />
            <InputBase inputRef={inputRef} value={q} onChange={(e) => onQChange(e.target.value)} placeholder={searchPlaceholder}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onQChange(''); setOpen(false) } }}
              inputProps={{ 'aria-label': 'Cerca nella tabella' }} sx={{ flex: 1, fontSize: 13, color: 'text.primary' }} />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
