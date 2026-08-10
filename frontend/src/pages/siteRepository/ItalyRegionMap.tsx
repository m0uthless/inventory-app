import * as React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
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
// quella regione con i confini reali delle sue province, un pallino + etichetta
// per ciascuna (posizionati sul centroide del poligono, non sul municipio
// esatto). Click su una provincia con clienti → richiama onSelectProvince.

const REGION_NAME: Record<RegionId, string> = Object.fromEntries(
  ITALIAN_REGIONS.map((r) => [r.id, r.name]),
) as Record<RegionId, string>

const PROVINCE_NAME: Record<string, string> = Object.fromEntries(
  ITALIAN_PROVINCES.map((p) => [p.sigla, p.name]),
)

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
        <Box sx={{ maxWidth: 420, mx: 'auto' }}>
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton size="small" onClick={() => setSelectedRegion(null)} aria-label="Torna alla cartina">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: FS.title }}>
          {REGION_NAME[selectedRegion]}
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 420, mx: 'auto' }}>
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
              <g
                key={p.sigla}
                style={{ cursor: hasCustomers ? 'pointer' : 'default' }}
                onClick={() => { if (hasCustomers) onSelectProvince(p.sigla) }}
                onMouseEnter={() => setHoverId(p.sigla)}
                onMouseLeave={() => setHoverId(null)}
              >
                <title>{`${PROVINCE_NAME[p.sigla] ?? p.sigla}${count ? ` — ${count} client${count === 1 ? 'e' : 'i'}` : ' — nessun cliente'}`}</title>
                <path
                  d={p.path}
                  fill={fill}
                  stroke={theme.palette.common.white}
                  strokeWidth={1}
                  style={{ transition: 'fill 0.1s' }}
                />
                <circle
                  cx={p.cx} cy={p.cy} r={3}
                  fill={hasCustomers ? theme.palette.primary.dark : theme.palette.grey[400]}
                />
                <text
                  x={p.cx} y={p.cy - 6}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight={700}
                  fill={hasCustomers ? theme.palette.primary.dark : theme.palette.text.disabled}
                  style={{ pointerEvents: 'none' }}
                >
                  {PROVINCE_NAME[p.sigla] ?? p.sigla}{count ? ` (${count})` : ''}
                </text>
              </g>
            )
          })}
        </svg>
      </Box>

      <Typography sx={{ fontSize: FS.body, color: 'text.secondary', textAlign: 'center', mt: 1 }}>
        {geo.provinces.some((p) => (provinceCounts[p.sigla] ?? 0) > 0)
          ? 'Clicca una provincia evidenziata per aprirla nella lista.'
          : 'Nessun cliente in questa regione.'}
      </Typography>
    </Box>
  )
}
