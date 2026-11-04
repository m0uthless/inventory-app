import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, IconButton, InputBase } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'

type Props = {
  /** Called when the easter-egg trigger word is typed, instead of navigating. */
  onEggTrigger: () => void
}

const EGG_TRIGGER = 'supertennis'

/**
 * Ricerca globale della topbar (DESIGN.md › Navigation): campo centrato su
 * fondo paper con il suggerimento Ctrl K. Ctrl K (o ⌘K) porta il focus qui da
 * qualunque pagina; Invio apre la pagina Ricerca, Esc svuota ed esce.
 */
export default function GlobalSearch({ onEggTrigger }: Props) {
  const nav = useNavigate()
  const [q, setQ] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = React.useCallback(() => {
    const trimmed = q.trim()
    if (trimmed.toLowerCase() === EGG_TRIGGER) {
      onEggTrigger()
      setQ('')
      return
    }
    nav(trimmed ? `/search?search=${encodeURIComponent(trimmed)}` : '/search')
    inputRef.current?.blur()
  }, [q, nav, onEggTrigger])

  return (
    <>
      <Box
        role="search"
        onClick={() => inputRef.current?.focus()}
        sx={{
          display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1,
          width: { sm: 300, md: 'min(520px, 42vw)' }, height: 34, px: 1.25,
          bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px',
          color: 'text.disabled', cursor: 'text', transition: 'border-color .15s, box-shadow .15s',
          '&:hover': { borderColor: 'archie.borderStrong' },
          '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing },
        }}
      >
        <SearchIcon sx={{ fontSize: 18 }} />
        <InputBase
          inputRef={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); go() }
            if (e.key === 'Escape') { setQ(''); inputRef.current?.blur() }
          }}
          placeholder="Cerca clienti, siti, inventari, issue…"
          inputProps={{ 'aria-label': 'Cerca in ARCHIE' }}
          sx={{ flex: 1, fontSize: 13, color: 'text.primary', '& input::placeholder': { color: 'text.disabled', opacity: 1 } }}
        />
        {q ? (
          <IconButton size="small" aria-label="Cancella ricerca" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ('')} sx={{ p: 0.25 }}>
            <ClearIcon sx={{ fontSize: 16 }} />
          </IconButton>
        ) : (
          <Box component="kbd" sx={{
            fontFamily: (t) => t.typography.fontFamily, fontSize: 11, fontWeight: 500, color: 'text.secondary',
            border: '1px solid', borderColor: 'divider', borderRadius: '4px', px: 0.6, lineHeight: '18px', bgcolor: 'archie.surface2',
          }}>Ctrl K</Box>
        )}
      </Box>

      <IconButton onClick={() => nav('/search')} sx={{ display: { xs: 'inline-flex', sm: 'none' } }} aria-label="Ricerca">
        <SearchIcon />
      </IconButton>
    </>
  )
}
