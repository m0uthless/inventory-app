import { Box, Tooltip, Typography, useTheme } from '@mui/material'
import { periodTotals, typeColor, firstName, type StatsResponse } from './snModel'

const small = { fontSize: 11.5, color: 'text.secondary' } as const

/** Torta (ad anello) dei casi per type, con percentuali scritte accanto. */
export function TypeDonut({ data, typeNames }: { data: StatsResponse; typeNames: string[] }) {
  const dark = useTheme().palette.mode === 'dark'
  const rows = data.type_breakdown.filter((r) => r.count > 0)
  const total = rows.reduce((s, r) => s + r.count, 0)
  const r = 52; const C = 2 * Math.PI * r
  const offsets = rows.map((_t, i) => rows.slice(0, i).reduce((a, x) => a + (total ? (x.count / total) * C : 0), 0))
  return (
    <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1, width: 170, flex: 'none' }}>
      <Box component="svg" viewBox="0 0 140 140" role="img" aria-label="Casi per type" sx={{ width: 132, height: 132 }}>
        <circle r={r} cx={70} cy={70} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={18} />
        {rows.map((t, i) => {
          const len = total ? (t.count / total) * C : 0
          const seg = Math.max(0, len - (rows.length > 1 ? 2 : 0))
          return (
            <circle key={t.id} r={r} cx={70} cy={70} fill="none" stroke={typeColor(typeNames, t.name, dark)} strokeWidth={18}
              strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 70 70)">
              <title>{`${t.name}: ${t.count} casi`}</title>
            </circle>
          )
        })}
        <Box component="text" x={70} y={68} textAnchor="middle" sx={{ fontSize: 22, fontWeight: 750, fill: (th) => th.palette.text.primary }}>{total.toLocaleString('it-IT')}</Box>
        <Box component="text" x={70} y={86} textAnchor="middle" sx={{ fontSize: 11, fill: (th) => th.palette.text.secondary }}>casi</Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 0.4, width: '100%' }}>
        {rows.map((t) => (
          <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ...small }}>
            <Box component="i" sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: typeColor(typeNames, t.name, dark) }} />
            {t.name}
            <Box component="b" sx={{ ml: 'auto', color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{total ? Math.round((t.count / total) * 100) : 0}%</Box>
          </Box>
        ))}
        {!rows.length ? <Typography sx={small}>Nessun caso nel periodo.</Typography> : null}
      </Box>
    </Box>
  )
}

/** Colonne per periodo divise per type; il valore più alto e l'ultimo sono scritti sopra. */
export function PeriodBars({ data, typeNames, height = 120, currentKey }: { data: StatsResponse; typeNames: string[]; height?: number; currentKey?: number }) {
  const dark = useTheme().palette.mode === 'dark'
  const totals = periodTotals(data)
  const max = Math.max(1, ...totals.map((t) => t.total))
  const n = data.periods.length
  const dense = n > 16
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: dense ? '2px' : '6px', alignItems: 'end', height: height + 18, borderBottom: '1px solid', borderColor: 'divider' }}>
        {data.periods.map((p, i) => {
          const t = totals[i]
          const partial = currentKey != null && p.key === currentKey
          const showVal = !dense && (t.total === max || partial)
          const order = typeNames.filter((nm) => (t.byType[nm] ?? 0) > 0)
          const other = t.total - order.reduce((s, nm) => s + (t.byType[nm] ?? 0), 0)
          return (
            <Tooltip key={p.key} title={`${p.label}: ${t.total} casi${order.length ? ` — ${order.map((nm) => `${nm} ${t.byType[nm]}`).join(', ')}` : ''}`}>
              <Box tabIndex={0} sx={{ display: 'grid', justifyItems: 'center', alignContent: 'end', height: '100%', outline: 0, '&:hover .stk, &:focus-visible .stk': { outline: '2px solid', outlineColor: 'archie.fieldLine', outlineOffset: '2px' } }}>
                <Typography sx={{ fontSize: 11, fontWeight: 650, minHeight: 16 }}>{showVal ? t.total : ''}</Typography>
                <Box className="stk" sx={{ width: dense ? '100%' : 'min(30px, 100%)', height: (t.total / max) * height, display: 'flex', flexDirection: 'column-reverse', gap: t.total ? '2px' : 0, borderRadius: '4px 4px 0 0', overflow: 'hidden', opacity: partial ? 0.55 : 1 }}>
                  {order.map((nm) => <Box key={nm} sx={{ flex: t.byType[nm], bgcolor: typeColor(typeNames, nm, dark) }} />)}
                  {other > 0 ? <Box sx={{ flex: other, bgcolor: typeColor([], '', dark) }} /> : null}
                </Box>
              </Box>
            </Tooltip>
          )
        })}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: dense ? '2px' : '6px', mt: 0.5 }}>
        {data.periods.map((p, i) => <Typography key={p.key} sx={{ ...small, fontSize: 10.5, textAlign: 'center', visibility: dense && i % 5 ? 'hidden' : 'visible', whiteSpace: 'nowrap' }}>{p.label}</Typography>)}
      </Box>
    </Box>
  )
}

/** Mappa tecnico × periodo (un solo colore, più intenso = più casi), con totali; le assenze sono segnate. */
export function TechHeatmap({ data }: { data: StatsResponse }) {
  const series = data.series.filter((s) => s.user_id !== null || s.counts.some(Boolean))
  const max = Math.max(1, ...series.flatMap((s) => s.counts))
  const colTotals = data.periods.map((_p, i) => series.reduce((a, s) => a + (s.counts[i] ?? 0), 0))
  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: '2px', width: '100%', fontSize: 11.5, '& th': { fontWeight: 550, color: 'text.secondary', fontSize: 11, px: 0.5 } }}>
          <thead>
            <tr>
              <th />
              {data.periods.map((p) => <th key={p.key}>{p.label}</th>)}
              <Box component="th" sx={{ color: 'text.primary !important', fontWeight: '700 !important' }}>Tot.</Box>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.user_id ?? 'none'}>
                <Box component="th" sx={{ textAlign: 'left', color: 'text.primary !important', fontSize: '12px !important', whiteSpace: 'nowrap', pr: 1 }} title={s.name}>{s.user_id === null ? 'Non assegnati' : firstName(s.name)}</Box>
                {s.counts.map((v, i) => {
                  const a = v / max
                  const away = s.absence_periods?.[i]
                  return (
                    <Tooltip key={i} title={`${s.name}, ${data.periods[i].label}: ${v} casi${away ? ` · assente (${away})` : ''}`}>
                      <Box component="td" sx={{
                        textAlign: 'center', height: 24, minWidth: 26, borderRadius: '4px', fontVariantNumeric: 'tabular-nums',
                        bgcolor: (t) => (v ? `color-mix(in srgb, ${t.palette.archie.tints.mint.mid} ${Math.round((0.08 + a * 0.92) * 70)}%, ${t.palette.background.paper})` : t.palette.archie.surface2),
                        color: (t) => (a > 0.7 ? t.palette.archie.tints.mint.ink : v ? t.palette.text.primary : t.palette.text.disabled), fontWeight: a > 0.7 ? 650 : 400,
                        boxShadow: away ? (t) => `inset 0 0 0 1.5px ${t.palette.archie.tints.peach.mid}` : 'none',
                      }}>{v || ''}</Box>
                    </Tooltip>
                  )
                })}
                <Box component="td" sx={{ textAlign: 'center', fontWeight: 700, px: 0.5 }}>{s.counts.reduce((x, y) => x + y, 0)}</Box>
              </tr>
            ))}
            <tr>
              <Box component="th" sx={{ textAlign: 'left', color: 'text.primary !important', fontSize: '12px !important', pt: 0.5 }}>Totale</Box>
              {colTotals.map((v, i) => <Box component="td" key={i} sx={{ textAlign: 'center', fontWeight: 650, pt: 0.5 }}>{v || ''}</Box>)}
              <Box component="td" sx={{ textAlign: 'center', fontWeight: 750, pt: 0.5 }}>{colTotals.reduce((x, y) => x + y, 0)}</Box>
            </tr>
          </tbody>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, ...small, flexWrap: 'wrap' }}>
        meno
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((a) => <Box key={a} component="i" sx={{ width: 16, height: 10, borderRadius: '2px', bgcolor: (t) => `color-mix(in srgb, ${t.palette.archie.tints.mint.mid} ${Math.round(a * 70)}%, ${t.palette.background.paper})` }} />)}
        più
        {series.some((s) => s.absence_periods?.some(Boolean)) ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 1.5 }}><Box component="i" sx={{ width: 14, height: 10, borderRadius: '2px', boxShadow: (t) => `inset 0 0 0 1.5px ${t.palette.archie.tints.peach.mid}` }} />assente in quel periodo</Box> : null}
      </Box>
    </Box>
  )
}
