import * as React from 'react'
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

/**
 * Fascia indicatori (DESIGN.md › KPI strip): fino a quattro riquadri + un
 * piccolo widget. I riquadri che portano a una vista sono pulsanti.
 * Si adatta alla larghezza del contenitore (container query), non della finestra.
 */
export function KpiStrip({ children, label = 'Indicatori' }: { children: React.ReactNode; label?: string }) {
  const n = React.Children.toArray(children).length
  return (
    <Box sx={{ containerType: 'inline-size', mb: 1.5 }}>
      <Box role="group" aria-label={label} style={{ ['--kpi-n' as string]: Math.max(1, n - 1) }} sx={{
        display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        '&:has(> .kpi-wide)': { gridTemplateColumns: 'repeat(var(--kpi-n), minmax(0, 1fr)) minmax(0, 1.35fr)' },
        '@container (max-width: 980px)': { '&:has(> .kpi-wide)': { gridTemplateColumns: 'repeat(var(--kpi-n), minmax(0, 1fr))' }, '& > .kpi-wide': { display: 'none' } },
        '@container (max-width: 560px)': {
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', mx: -2, px: 2, scrollPaddingInline: '16px',
          '& > *': { flex: '0 0 172px', scrollSnapAlign: 'start' },
        },
        '@container (max-width: 780px)': { '& .kpi-spark': { display: 'none' } },
      }}>
        {children}
      </Box>
    </Box>
  )
}

type TileProps = {
  label: string
  value?: React.ReactNode
  /** Valore secondario accanto al principale (es. importo). */
  unit?: React.ReactNode
  /** Riga di contesto in basso. */
  sub?: React.ReactNode
  /** Serie per il mini grafico (andamento). */
  spark?: { values: number[]; labels?: string[]; format?: (v: number) => string }
  onClick?: () => void
  active?: boolean
  /** Contenuto libero sotto il valore (misuratore, barra…). */
  children?: React.ReactNode
  wide?: boolean
}

export function KpiTile({ label, value, unit, sub, spark, onClick, active, children, wide }: TileProps) {
  const content = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 550, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {label}
        {onClick ? <ArrowForwardIcon className="kpi-go" sx={{ ml: 'auto', fontSize: 14, color: 'text.disabled', opacity: 0, transition: 'opacity .12s' }} /> : null}
      </Box>
      {value !== undefined ? <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, fontSize: 24, lineHeight: 1.15, fontWeight: 650, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', '@container (max-width: 780px)': { fontSize: 20 } }}>
        {value}
        {unit ? <Box component="small" sx={{ fontSize: 13, fontWeight: 550, color: 'text.secondary', letterSpacing: 0 }}>{unit}</Box> : null}
      </Box> : null}
      {children}
      {sub ? <Box sx={{ mt: 'auto', pt: 0.5, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', '& b': { color: 'text.primary', fontWeight: 600 } }}>{sub}</Box> : null}
      {spark && spark.values.length > 1 && spark.values.some((v) => v !== spark.values[0]) ? <Spark {...spark} /> : null}
    </>
  )
  const sx = {
    position: 'relative' as const, minWidth: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch', textAlign: 'left' as const,
    gap: 0.25, p: '10px 12px', minHeight: 116, bgcolor: 'background.paper', border: '1px solid', borderColor: active ? 'archie.fieldLine' : 'divider',
    boxShadow: active ? (t: { palette: { archie: { fieldLine: string } } }) => `inset 0 0 0 1px ${t.palette.archie.fieldLine}` : 'none',
    borderRadius: '8px', color: 'text.primary', 
    '@container (max-width: 780px)': { minHeight: 80, p: '8px 10px' },
  }
  if (onClick) {
    return (
      <ButtonBase onClick={onClick} aria-pressed={active} className={wide ? 'kpi-wide' : undefined} sx={{ ...sx, '&:hover': { borderColor: 'archie.borderStrong' }, '&:hover .kpi-go, &.Mui-focusVisible .kpi-go': { opacity: 1 }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
        {content}
      </ButtonBase>
    )
  }
  return <Box className={wide ? 'kpi-wide' : undefined} sx={sx}>{content}</Box>
}

function Spark({ values, labels, format }: { values: number[]; labels?: string[]; format?: (v: number) => string }) {
  const W = 84, H = 30
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4)
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const [hover, setHover] = React.useState<number | null>(null)
  const step = W / (values.length - 1)
  const tip = hover != null ? `${labels?.[hover] ?? ''}${labels?.[hover] ? ' · ' : ''}${format ? format(values[hover]) : values[hover]}` : ''
  return (
    <Tooltip title={tip} open={hover != null} placement="top" disableInteractive>
      <Box component="svg" className="kpi-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden onMouseLeave={() => setHover(null)}
        sx={{ position: 'absolute', right: 12, top: 30, width: W, height: H, overflow: 'visible' }}>
        <Box component="path" d={`M0,${H} L${pts.join(' L')} L${W},${H}Z`} sx={{ fill: (t) => t.palette.primary.main, opacity: 0.1 }} />
        <Box component="path" d={`M${pts.join(' L')}`} sx={{ fill: 'none', stroke: (t) => t.palette.primary.main, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.25} /> : null}
        <Box component="circle" cx={x(hover ?? values.length - 1)} cy={y(values[hover ?? values.length - 1])} r={3}
          sx={{ fill: (t) => t.palette.primary.main, stroke: (t) => t.palette.background.paper, strokeWidth: 2 }} />
        {values.map((_, i) => (
          <rect key={i} x={x(i) - step / 2} y={-6} width={step} height={H + 12} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </Box>
    </Tooltip>
  )
}

/** Barra segmentata sottile + legenda (es. attive per priorità). Scala sequenziale a una tinta. */
export function SegmentBar({ parts, onPick, dimmed, darkFirst }: {
  parts: { key: string; label: string; value: number; display?: string }[]
  onPick?: (key: string) => void
  /** Chiavi da mostrare attenuate (es. escluse dal filtro attivo). */
  dimmed?: Set<string>
  /** Il primo segmento è il più scuro (es. priorità dalla più urgente). */
  darkFirst?: boolean
}) {
  const seqIdx = (i: number) => { const k = Math.min(3, Math.round((i / Math.max(1, parts.length - 1)) * 3)); return darkFirst ? 3 - k : k }
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <>
      <Box aria-hidden sx={{ display: 'flex', gap: '2px', height: 8, mt: '10px', mb: '8px' }}>
        {parts.map((p, i) => (
          <Tooltip key={p.key} title={`${p.label} · ${p.display ?? p.value}`} placement="top">
            <Box sx={{
              flex: Math.max(p.value, 0.0001), minWidth: p.value ? 4 : 0, borderRadius: '2px', opacity: dimmed?.has(p.key) ? 0.3 : 1,
              bgcolor: (t) => t.palette.archie.seq[seqIdx(i)],
              '&:first-of-type': { borderRadius: '4px 2px 2px 4px' }, '&:last-of-type': { borderRadius: '2px 4px 4px 2px' },
            }} />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, color: 'text.secondary' }}>
        {parts.map((p, i) => (
          <ButtonBase key={p.key} disabled={!onPick} onClick={() => onPick?.(p.key)} sx={{
            gap: 0.75, py: '2px', borderRadius: '4px', fontSize: 12, color: 'inherit', whiteSpace: 'nowrap', '&:hover': { color: 'text.primary' },
          }}>
            <Box component="i" sx={{ width: 8, height: 8, borderRadius: '2px', opacity: dimmed?.has(p.key) ? 0.3 : 1, bgcolor: (t) => t.palette.archie.seq[seqIdx(i)] }} />
            {p.label}
            <Box component="b" sx={{ color: dimmed?.has(p.key) ? 'text.secondary' : 'text.primary', fontWeight: dimmed?.has(p.key) ? 500 : 600, fontVariantNumeric: 'tabular-nums' }}>{p.display ?? Math.round((p.value / total) * 100) + '%'}</Box>
          </ButtonBase>
        ))}
      </Box>
    </>
  )
}

/** Misuratore: valore su obiettivo, stessa tinta. */
export function Meter({ value, target, label }: { value: number; target?: number; label: string }) {
  return (
    <Box role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}
      sx={{ position: 'relative', height: 8, borderRadius: 4, bgcolor: 'archie.neutralBg', my: 1 }}>
      <Box sx={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(100, value)}%`, borderRadius: 4, bgcolor: (t) => t.palette.archie.seq[2] }} />
      {target != null ? <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${target}% - 1px)`, width: 2, borderRadius: 1, bgcolor: 'text.primary' }} /> : null}
    </Box>
  )
}

export function KpiFlag({ tone, children }: { tone: 'error' | 'warning' | 'success'; children: React.ReactNode }) {
  return (
    <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, fontWeight: 600, borderRadius: '5px', px: 0.75, lineHeight: '18px', letterSpacing: 0, bgcolor: `${tone}.light`, color: `${tone}.main` }}>
      {children}
    </Typography>
  )
}
