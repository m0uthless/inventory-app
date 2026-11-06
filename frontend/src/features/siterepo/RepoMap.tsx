/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ITALIAN_REGIONS, PROVINCE_TO_REGION, type RegionId } from '../../data/italianRegions'
import { ITALIAN_PROVINCES } from '../../data/italianProvinces'
import { ITALY_MAP_VIEWBOX, ITALY_REGION_PATHS } from '../../data/italyMapGeo'
import { ITALY_PROVINCE_GEO } from '../../data/italyProvinceGeo'

export const REGION_NAME: Record<string, string> = Object.fromEntries(ITALIAN_REGIONS.map((r) => [r.id, r.name]))
export const PROVINCE_NAME: Record<string, string> = Object.fromEntries(ITALIAN_PROVINCES.map((p) => [p.sigla, p.name]))
export const regionOf = (sigla?: string | null): RegionId | null => (sigla ? PROVINCE_TO_REGION[sigla] ?? null : null)

type Props = {
  /** Asset per sigla di provincia: colora la cartina (più asset, verde più pieno). */
  counts: Record<string, number>
  region: RegionId | null
  selectedProvince: string | null
  onRegion: (id: RegionId) => void
  onProvince: (sigla: string) => void
}

/**
 * Cartina del Site Repository (anteprima r-base, proposta B): l'Italia per regioni,
 * clic su una regione → le sue province con la sigla; più asset, colore più pieno.
 */
export function RepoMap({ counts, region, selectedProvince, onRegion, onProvince }: Props) {
  const theme = useTheme()
  const primary = theme.palette.primary.main
  const base = theme.palette.archie.surface2
  const fill = (k: number) => `color-mix(in oklab, ${primary} ${Math.round(k * 70)}%, ${base})`

  const shapeSx = {
    fill: theme.palette.archie.neutralBg, stroke: theme.palette.background.paper, strokeWidth: 1, transition: 'fill .12s', outline: 'none',
    '&[data-has="1"]': { cursor: 'pointer', fill: 'var(--f)' },
    '&[data-has="1"]:hover, &[data-has="1"]:focus-visible': { fill: `color-mix(in oklab, ${primary} 85%, ${theme.palette.background.paper})` },
    '&[data-sel="1"], &[data-sel="1"]:hover': { fill: primary, strokeWidth: 1.5 },
  }
  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }

  if (!region) {
    const rc: Record<string, number> = {}
    Object.entries(counts).forEach(([p, n]) => { const r = regionOf(p); if (r) rc[r] = (rc[r] ?? 0) + n })
    const max = Math.max(1, ...Object.values(rc))
    return (
      <Box component="svg" viewBox={ITALY_MAP_VIEWBOX} role="img" aria-label="Cartina d'Italia per regione" sx={{ display: 'block', width: '100%', height: 'auto', '& path': shapeSx }}>
        {(Object.keys(ITALY_REGION_PATHS) as RegionId[]).map((id) => {
          const n = rc[id] ?? 0
          return (
            <path key={id} d={ITALY_REGION_PATHS[id]} data-has={n ? 1 : 0}
              style={n ? ({ '--f': fill(0.25 + 0.75 * n / max) } as React.CSSProperties) : undefined}
              {...(n ? { tabIndex: 0, role: 'button', 'aria-label': `${REGION_NAME[id]}, ${n} asset`, onClick: () => onRegion(id), onKeyDown: keyAct(() => onRegion(id)) } : {})}>
              <title>{`${REGION_NAME[id]}${n ? ` · ${n} asset` : ''}`}</title>
            </path>
          )
        })}
      </Box>
    )
  }

  const geo = ITALY_PROVINCE_GEO[region]
  const max = Math.max(1, ...geo.provinces.map((p) => counts[p.sigla] ?? 0))
  return (
    <Box component="svg" viewBox={geo.viewBox} role="img" aria-label={`Province di ${REGION_NAME[region]}`} sx={{
      display: 'block', width: '100%', height: 'auto', '& path': shapeSx,
      '& text': { font: `650 11px ${theme.typography.fontFamily}`, fill: theme.palette.text.primary, textAnchor: 'middle', dominantBaseline: 'middle', pointerEvents: 'none', paintOrder: 'stroke', stroke: theme.palette.background.paper, strokeWidth: 3 },
    }}>
      {geo.provinces.map((p) => {
        const n = counts[p.sigla] ?? 0
        const sel = p.sigla === selectedProvince
        return (
          <path key={p.sigla} d={p.path} data-has={n ? 1 : 0} data-sel={sel ? 1 : 0}
            style={n ? ({ '--f': fill(0.25 + 0.75 * n / max) } as React.CSSProperties) : undefined}
            {...(n ? { tabIndex: 0, role: 'button', 'aria-label': `${PROVINCE_NAME[p.sigla] ?? p.sigla}, ${n} asset`, onClick: () => onProvince(p.sigla), onKeyDown: keyAct(() => onProvince(p.sigla)) } : {})}>
            <title>{`${PROVINCE_NAME[p.sigla] ?? p.sigla}${n ? ` · ${n} asset` : ''}`}</title>
          </path>
        )
      })}
      {geo.provinces.filter((p) => counts[p.sigla]).map((p) => <text key={p.sigla} x={p.cx} y={p.cy} style={p.sigla === selectedProvince ? { fill: theme.palette.primary.contrastText, stroke: primary } : undefined}>{p.sigla}</text>)}
    </Box>
  )
}
