import * as React from 'react'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { alpha, useTheme } from '@mui/material/styles'

import { ITALIAN_REGIONS, PROVINCE_TO_REGION, type RegionId } from '../../data/italianRegions'
import { ITALIAN_PROVINCES } from '../../data/italianProvinces'
import { ITALY_MAP_VIEWBOX, ITALY_REGION_PATHS } from '../../data/italyMapGeo'
import { ITALY_PROVINCE_GEO } from '../../data/italyProvinceGeo'
import { FS } from './style'

// ─── ItalyRegionMap ───────────────────────────────────────────────────────────
//
// Cartina reale d'Italia (confini ISTAT semplificati, vedi data/italyMapGeo.ts
// e data/italyProvinceGeo.ts): livello 1 mostra le 20 regioni come sagoma
// geografica vera; click su una regione → drill-down nella vista zoomata di
// quella regione con i confini reali delle sue province. A differenza del
// livello 1, le province NON riportano il nome disegnato sopra la sagoma:
// l'abbinamento nome↔provincia avviene tramite la lista a destra della
// mappa, che si evidenzia in sincrono con l'hover sulla sagoma (e viceversa).
// Click su una provincia con clienti (da mappa o da lista) → onSelectProvince.

const REGION_NAME: Record<RegionId, string> = Object.fromEntries(
  ITALIAN_REGIONS.map((r) => [r.id, r.name]),
) as Record<RegionId, string>

const PROVINCE_NAME: Record<string, string> = Object.fromEntries(
  ITALIAN_PROVINCES.map((p) => [p.sigla, p.name]),
)

// Rimuove il riquadro di focus (rettangolo nero) che i browser disegnano di
// default sugli elementi SVG focusabili dopo un click col mouse, mantenendo
// però l'indicatore visibile per la navigazione da tastiera (:focus-visible).
function MapFocusStyle({ accentColor }: { accentColor: string }) {
  return (
    <style>{`
      .italy-map-shape { outline: none; }
      .italy-map-shape:focus-visible { outline: 2px solid ${accentColor}; outline-offset: 1px; }
    `}</style>
  )
}

export function ItalyRegionMap({
  provinceCounts,
  onSelectProvince,
}: {
  /** Conteggio clienti per sigla provincia (province senza clienti = 0/assente). */
  provinceCounts: Record<string, number>
  onSelectProvince: (sigla: string) => void
}) {
  const theme = useTheme()
  const [selectedRegion, setSelectedRegion] = React.useState<RegionId | null>(null)
  const [hoverId, setHoverId] = React.useState<string | null>(null)

  const regionCounts = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const [sigla, regionId] of Object.entries(PROVINCE_TO_REGION)) {
      map[regionId] = (map[regionId] ?? 0) + (provinceCounts[sigla] ?? 0)
    }
    return map
  }, [provinceCounts])

  // ── Livello 1: cartina Italia, regioni ──────────────────────────────────
  if (!selectedRegion) {
    return (
      <Box>
        <MapFocusStyle accentColor={theme.palette.primary.main} />
        <Box sx={{ maxWidth: 380, mx: 'auto' }}>
          <svg viewBox={ITALY_MAP_VIEWBOX} width="100%" role="img" aria-label="Cartina d'Italia per regione">
            {ITALIAN_REGIONS.map((region) => {
              const count = regionCounts[region.id] ?? 0
              const hasCustomers = count > 0
              const isHover = hoverId === region.id
              const fill = isHover
                ? alpha(theme.palette.primary.main, 0.5)
                : hasCustomers
                  ? alpha(theme.palette.primary.main, 0.28)
                  : theme.palette.grey[100]

              return (
                <path
                  key={region.id}
                  className="italy-map-shape"
                  d={ITALY_REGION_PATHS[region.id]}
                  fill={fill}
                  stroke={theme.palette.common.white}
                  strokeWidth={1.2}
                  style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
                  onClick={() => setSelectedRegion(region.id)}
                  onMouseEnter={() => setHoverId(region.id)}
                  onMouseLeave={() => setHoverId(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${region.name}${count ? ` — ${count} client${count === 1 ? 'e' : 'i'}` : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedRegion(region.id)
                    }
                  }}
                >
                  <title>{`${region.name}${count ? ` — ${count} client${count === 1 ? 'e' : 'i'}` : ' — nessun cliente'}`}</title>
                </path>
              )
            })}
          </svg>
        </Box>
        <Typography sx={{ fontSize: FS.body, color: 'text.secondary', textAlign: 'center', mt: 1 }}>
          Clicca una regione per vedere le sue province.
        </Typography>
      </Box>
    )
  }

  // ── Livello 2: drill-down province della regione selezionata ────────────
  const geo = ITALY_PROVINCE_GEO[selectedRegion]
  const sortedProvinces = [...geo.provinces].sort((a, b) =>
    (PROVINCE_NAME[a.sigla] ?? a.sigla).localeCompare(PROVINCE_NAME[b.sigla] ?? b.sigla, 'it'),
  )

  return (
    <Box>
      <MapFocusStyle accentColor={theme.palette.primary.main} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton size="small" onClick={() => setSelectedRegion(null)} aria-label="Torna alla cartina">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: FS.title }}>
          {REGION_NAME[selectedRegion]}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
        <Box sx={{ flex: '0 1 300px', minWidth: 0 }}>
          <svg viewBox={geo.viewBox} width="100%" role="img" aria-label={`Province di ${REGION_NAME[selectedRegion]}`}>
            {geo.provinces.map((p) => {
              const count = provinceCounts[p.sigla] ?? 0
              const hasCustomers = count > 0
              const isHover = hoverId === p.sigla
              const fill = isHover
                ? alpha(theme.palette.primary.main, 0.45)
                : hasCustomers
                  ? alpha(theme.palette.primary.main, 0.22)
                  : theme.palette.grey[50]

              return (
                <path
                  key={p.sigla}
                  className="italy-map-shape"
                  d={p.path}
                  fill={fill}
                  stroke={theme.palette.common.white}
                  strokeWidth={1}
                  style={{ cursor: hasCustomers ? 'pointer' : 'default', transition: 'fill 0.1s' }}
                  onClick={() => { if (hasCustomers) onSelectProvince(p.sigla) }}
                  onMouseEnter={() => setHoverId(p.sigla)}
                  onMouseLeave={() => setHoverId(null)}
                  role={hasCustomers ? 'button' : undefined}
                  tabIndex={hasCustomers ? 0 : undefined}
                  aria-label={`${PROVINCE_NAME[p.sigla] ?? p.sigla}${count ? ` — ${count} client${count === 1 ? 'e' : 'i'}` : ' — nessun cliente'}`}
                  onKeyDown={(e) => {
                    if (hasCustomers && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onSelectProvince(p.sigla)
                    }
                  }}
                >
                  <title>{`${PROVINCE_NAME[p.sigla] ?? p.sigla}${count ? ` — ${count} client${count === 1 ? 'e' : 'i'}` : ' — nessun cliente'}`}</title>
                </path>
              )
            })}
          </svg>
        </Box>

        {/* Lista province a destra: sostituisce le etichette disegnate sulla
            mappa, evidenziata in sincrono con l'hover sulla sagoma SVG. */}
        <Stack
          spacing={0.25}
          sx={{ flex: '1 1 auto', minWidth: 140, maxHeight: 340, overflowY: 'auto', pr: 0.5 }}
        >
          {sortedProvinces.map((p) => {
            const count = provinceCounts[p.sigla] ?? 0
            const hasCustomers = count > 0
            const isHover = hoverId === p.sigla
            return (
              <Box
                key={p.sigla}
                onMouseEnter={() => setHoverId(p.sigla)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => { if (hasCustomers) onSelectProvince(p.sigla) }}
                role={hasCustomers ? 'button' : undefined}
                tabIndex={hasCustomers ? 0 : undefined}
                onKeyDown={(e) => {
                  if (hasCustomers && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onSelectProvince(p.sigla)
                  }
                }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: 1, py: 0.5, borderRadius: 1,
                  cursor: hasCustomers ? 'pointer' : 'default',
                  bgcolor: isHover ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                  transition: 'background-color 0.1s',
                }}
              >
                <Box
                  sx={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    bgcolor: hasCustomers ? theme.palette.primary.dark : theme.palette.grey[400],
                  }}
                />
                <Typography
                  noWrap
                  sx={{
                    fontSize: FS.body,
                    fontWeight: isHover || hasCustomers ? 600 : 400,
                    color: hasCustomers ? 'text.primary' : 'text.disabled',
                  }}
                >
                  {PROVINCE_NAME[p.sigla] ?? p.sigla}
                  {count ? ` (${count})` : ''}
                </Typography>
              </Box>
            )
          })}
        </Stack>
      </Box>

      <Typography sx={{ fontSize: FS.body, color: 'text.secondary', textAlign: 'center', mt: 1.5 }}>
        {geo.provinces.some((p) => (provinceCounts[p.sigla] ?? 0) > 0)
          ? 'Clicca una provincia evidenziata (sulla mappa o in lista) per aprirla.'
          : 'Nessun cliente in questa regione.'}
      </Typography>
    </Box>
  )
}
