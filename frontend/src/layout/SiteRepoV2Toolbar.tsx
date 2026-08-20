import { Box, Chip, IconButton, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIconSR from '@mui/icons-material/Clear'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'

import { useSiteRepoV2 } from '../features/siterepov2/SiteRepoV2Context'
import type { GroupByMode } from '../pages/siteRepository/types'

// ─── SiteRepository sticky toolbar ───────────────────────────────────────────

export function SiteRepoV2Toolbar({ sidebarWidth }: { sidebarWidth: number }) {
  const { searchQuery, setSearchQuery, handle, totalCustomers, totalCities, groupBy, setGroupBy, mapOpen, setMapOpen } = useSiteRepoV2()

  return (
    <Box sx={{
      bgcolor: 'background.paper',
      borderBottom: '1px solid',
      borderColor: 'divider',
      px: { xs: 2, md: 3 },
      py: 1.125,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      rowGap: 1,
      // Fix P2 8.4: su viewport stretti (smartphone) la toolbar andava in
      // scroll orizzontale o si comprimeva male. Ora gli elementi vanno a
      // capo su una seconda riga invece di forzare tutto su una riga sola.
      flexWrap: { xs: 'wrap', md: 'nowrap' },
      flexShrink: 0,
      // override AppBar color inheritance
      '& .MuiInputBase-root': { color: 'text.primary' },
      '& .MuiIconButton-root': { color: 'text.secondary !important' },
      // override AppBar color inheritance — il valore rgba(0,0,0,0.23) è il
      // default MUI stesso per OutlinedInput in light mode (tutti e 3 i temi
      // sono mode:'light'), qui usato per ripristinarlo esplicitamente.
      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23) !important' },
    }}>
      {/* Spacer sidebar — allinea al contenuto della pagina */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: sidebarWidth, flexShrink: 0 }} />

      <TextField
        size="small"
        placeholder="Cerca hostname, cliente, sito, IP..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ flex: '1 1 200px', minWidth: { xs: 160, sm: 220 }, maxWidth: 460 }}
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

      <ToggleButtonGroup
        size="small"
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

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
        <Chip
          label="Comprimi tutto"
          size="small"
          clickable
          onClick={() => handle?.collapseAll()}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.75rem', borderColor: 'divider' }}
        />
        <Chip
          label="Espandi tutto"
          size="small"
          clickable
          onClick={() => handle?.expandAll()}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.75rem', borderColor: 'divider' }}
        />
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontSize: '0.78rem',
          ml: { xs: 0, md: 'auto' },
          whiteSpace: 'nowrap',
          flexBasis: { xs: '100%', md: 'auto' },
        }}
      >
        {totalCustomers} clienti · {totalCities} {groupBy === 'province' ? 'province' : 'città'}
      </Typography>
    </Box>
  )
}

// Wrapper condizionale — mostrato solo su /site-repository (V2, ora rotta definitiva)
export function SiteRepoV2Toolbar_Shell({ loc, sidebarWidth }: { loc: string; sidebarWidth: number }) {
  if (loc !== '/site-repository') return null
  return <SiteRepoV2Toolbar sidebarWidth={sidebarWidth} />
}
