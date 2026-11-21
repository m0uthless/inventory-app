import * as React from 'react'
import { Box, ButtonBase, IconButton } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

import CommandPalette from '../features/search/CommandPalette'
import type { NavLeaf } from './appNav'

type Props = {
  /** Chiamata quando si conferma la parola segreta, invece di cercare. */
  onEggTrigger: () => void
  canAccess: (leaf: NavLeaf) => boolean
  hasPerm: (perm: string) => boolean
}

/**
 * Ricerca globale della topbar (DESIGN.md › Navigation): il campo centrato con il suggerimento Ctrl K
 * apre la palette a finestra (risultati raggruppati, pagine, azioni). Ctrl K (o ⌘K) la apre da qualunque pagina.
 */
export default function GlobalSearch({ onEggTrigger, canAccess, hasPerm }: Props) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <ButtonBase
        role="search"
        aria-label="Cerca in ARCHIE (Ctrl K)"
        onClick={() => setOpen(true)}
        sx={{
          display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'flex-start', gap: 1,
          width: { sm: 300, md: 'min(520px, 42vw)' }, height: 34, px: 1.25,
          bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px',
          color: 'text.disabled', fontSize: 13, transition: 'border-color .15s, box-shadow .15s',
          '&:hover': { borderColor: 'archie.borderStrong' },
          '&.Mui-focusVisible': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing },
        }}
      >
        <SearchIcon sx={{ fontSize: 18 }} />
        <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>Cerca clienti, siti, inventari, issue…</Box>
        <Box component="kbd" sx={{
          fontFamily: (t) => t.typography.fontFamily, fontSize: 11, fontWeight: 500, color: 'text.secondary',
          border: '1px solid', borderColor: 'divider', borderRadius: '4px', px: 0.6, lineHeight: '18px', bgcolor: 'archie.surface2',
        }}>Ctrl K</Box>
      </ButtonBase>

      <IconButton onClick={() => setOpen(true)} sx={{ display: { xs: 'inline-flex', sm: 'none' } }} aria-label="Ricerca">
        <SearchIcon />
      </IconButton>

      <CommandPalette open={open} onClose={() => setOpen(false)} canAccess={canAccess} hasPerm={hasPerm} onEggTrigger={onEggTrigger} />
    </>
  )
}
