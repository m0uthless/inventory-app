import * as React from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

import type { DeviceRow } from './deviceGrid'

// ─── Grafico torta Reparto ────────────────────────────────────────────────────

export const PIE_COLORS = ['#1A6BB5', '#6366f1', '#14b8a6', '#f59e0b', '#e24b4a', '#8b5cf6', '#10b981', '#f97316']

export default function RepartoChart({
  rows,
  repartoF,
  onSelect,
}: {
  rows: DeviceRow[]
  repartoF: string
  onSelect: (v: string) => void
}) {
  const theme = useTheme()
  const data = React.useMemo(() => {
    const counts: Record<string, number> = {}
    rows.forEach((r) => {
      const key = r.reparto?.trim() || '—'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [rows])

  if (!data.length) {
    return (
      <Box sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Reparto</Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>Nessun dato</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Titolo */}
      <Box sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Reparto</Typography>
        {repartoF && (
          <Chip size="small" label="✕ reset" onClick={() => onSelect('')}
            sx={{ height: 16, fontSize: '0.60rem', fontWeight: 700, cursor: 'pointer', bgcolor: 'rgba(26,107,181,0.12)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.25)', '& .MuiChip-label': { px: 0.6 }, '&:hover': { bgcolor: 'rgba(26,107,181,0.22)' } }} />
        )}
      </Box>

      {/* Torta + legenda */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.5, overflow: 'hidden' }}>
        {/* Pie */}
        <Box sx={{ width: 140, height: '100%', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="82%"
                paddingAngle={2}
                dataKey="value"
                onClick={(entry) => {
                  const name = (entry as { name: string }).name
                  onSelect(repartoF === (name === '—' ? '' : name) ? '' : (name === '—' ? '' : name))
                }}
                cursor="pointer"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    opacity={repartoF && repartoF !== entry.name ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ fontSize: '0.70rem', borderRadius: 6, border: `1px solid ${theme.palette.divider}`, padding: '4px 8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* Legenda compatta */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.3, overflowY: 'auto', maxHeight: '100%', pr: 0.5 }}>
          {data.map((entry, i) => {
            const color = PIE_COLORS[i % PIE_COLORS.length]
            const active = repartoF === entry.name || (!repartoF)
            return (
              <Box
                key={entry.name}
                onClick={() => onSelect(repartoF === entry.name ? '' : (entry.name === '—' ? '' : entry.name))}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', opacity: active ? 1 : 0.4, transition: 'opacity 0.15s', '&:hover': { opacity: 1 } }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.65rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {entry.name}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', flexShrink: 0 }}>
                  {entry.value}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
