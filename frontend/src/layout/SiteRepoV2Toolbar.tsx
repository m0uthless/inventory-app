import * as React from 'react'
import { Box, Chip, IconButton, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import SearchIcon from '@mui/icons-material/Search'
import ClearIconSR from '@mui/icons-material/Clear'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'

import { useSiteRepoV2 } from '../features/siterepov2/SiteRepoV2Context'
import type { GroupByMode } from '../pages/siteRepository/types'

// ─── SiteRepository sticky toolbar ───────────────────────────────────────────

// Altezza reale della toolbar esposta come CSS var: su telefono va a capo su
// più righe e lo spacer fisso di AppLayout (56px) lasciava il primo gruppo
// coperto. AppLayout usa var(--site-repo-toolbar-h, 56px).
function useToolbarHeightVar() {
  return React.useCallback((node: HTMLDivElement | null) => {
    const root = document.documentElement
    if (!node) { root.style.removeProperty('--site-repo-toolbar-h'); return }
    const set = () => root.style.setProperty('--site-repo-toolbar-h', `${node.offsetHeight}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(node)
    return () => { ro.disconnect(); root.style.removeProperty('--site-repo-toolbar-h') }
  }, [])
}

export function SiteRepoV2Toolbar({ sidebarWidth }: { sidebarWidth: number }) {
  const toolbarRef = useToolbarHeightVar()
  const { searchQuery, setSearchQuery, handle, totalCustomers, totalCities, groupBy, setGroupBy, mapOpen, setMapOpen } = useSiteRepoV2()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const groupWord = groupBy === 'province'
    ? (totalCities === 1 ? 'provincia' : 'province')
    : 'città'

  return (
    <Box ref={toolbarRef} sx={{
      bgcolor: 'background.paper',
      borderBottom: '1px solid',
      borderColor: 'divider',
      px: { xs: 2, md: 3 },
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      rowGap: 1,
      // Fix P2 8.4: su viewport stretti (smartphone) la toolbar andava in
      // scroll orizzontale o si comprimeva male. Ora gli elementi vanno a
      // capo su una seconda riga invece di forzare tutto su una riga sola.
      flexWrap: { xs: 'wrap', md: 'nowrap' },
      py: { xs: 1, md: 1.125 },
      flexShrink: 0,
      // override AppBar color inheritance
      '& .MuiInputBase-root': { color: 'text.primary' },
      // Il path di palette con "!important" non viene risolto da sx (CSS non
      // valido → vinceva il bianco dell'AppBar): serve il valore esplicito.
      '& .MuiIconButton-root': { color: `${theme.palette.text.secondary} !important` },
      // override AppBar color inheritance — il valore rgba(0,0,0,0.23) è il
      // default MUI stesso per OutlinedInput in light mode (tutti e 3 i temi
      // sono mode:'light'), qui usato per ripristinarlo esplicitamente.
      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23) !important' },
    }}>
      {/* Spacer sidebar — allinea al contenuto della pagina */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: sidebarWidth, flexShrink: 0 }} />

      <TextField
        size="small"
        placeholder={isPhone ? 'Cerca host, IP, K#, cliente…' : 'Cerca hostname, IP, K#, seriale, cliente o sito'}
        inputProps={{ 'aria-label': 'Cerca nel Site Repository per hostname, IP, K#, seriale, cliente o sito' }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ flex: { xs: '1 1 100%', sm: '1 1 200px' }, minWidth: { xs: 0, sm: 220 }, maxWidth: { xs: 'none', sm: 460 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: searchQuery ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Cancella ricerca" onClick={() => setSearchQuery('')}>
                <ClearIconSR sx={{ fontSize: 16 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography component="span" id="siterepo-groupby-label" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'grey.700', whiteSpace: 'nowrap' }}>
        Raggruppa per
      </Typography>
      <ToggleButtonGroup
        size="small"
        aria-labelledby="siterepo-groupby-label"
        value={groupBy}
        exclusive
        onChange={(_e, next: GroupByMode | null) => {
          if (next) setGroupBy(next)
        }}
        sx={{
          '& .MuiToggleButton-root': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'none',
            px: 1.25,
            py: 0.375,
          },
        }}
      >
        <ToggleButton value="province">Provincia</ToggleButton>
        <ToggleButton value="city">Città</ToggleButton>
      </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Chip
          label="Mappa"
          icon={<MapOutlinedIcon sx={{ fontSize: 16 }} />}
          size="small"
          clickable
          color={mapOpen ? 'primary' : 'default'}
          variant={mapOpen ? 'filled' : 'outlined'}
          onClick={() => setMapOpen(!mapOpen)}
          sx={{ fontWeight: 600, fontSize: '0.75rem', borderColor: 'divider' }}
        />
        {isPhone ? (
          <>
            <IconButton size="small" aria-label="Comprimi tutto" onClick={() => handle?.collapseAll()}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', width: 36, height: 36 }}>
              <UnfoldLessIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" aria-label="Espandi tutto" onClick={() => handle?.expandAll()}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', width: 36, height: 36 }}>
              <UnfoldMoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </>
        ) : (
          <>
            <Chip
              label="Comprimi tutto"
              icon={<UnfoldLessIcon sx={{ fontSize: 16 }} />}
              size="small"
              clickable
              onClick={() => handle?.collapseAll()}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.75rem', borderColor: 'divider' }}
            />
            <Chip
              label="Espandi tutto"
              icon={<UnfoldMoreIcon sx={{ fontSize: 16 }} />}
              size="small"
              clickable
              onClick={() => handle?.expandAll()}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.75rem', borderColor: 'divider' }}
            />
          </>
        )}
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        aria-live="polite"
        sx={{
          fontSize: '0.8rem',
          color: 'grey.700',
          ml: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {totalCustomers} {totalCustomers === 1 ? 'cliente' : 'clienti'} · {totalCities} {groupWord}
      </Typography>
    </Box>
  )
}

// Wrapper condizionale — mostrato solo su /site-repository (V2, ora rotta definitiva)
export function SiteRepoV2Toolbar_Shell({ loc, sidebarWidth }: { loc: string; sidebarWidth: number }) {
  if (loc !== '/site-repository') return null
  return <SiteRepoV2Toolbar sidebarWidth={sidebarWidth} />
}
