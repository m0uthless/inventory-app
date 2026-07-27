import { alpha, useTheme } from '@mui/material/styles'
import { Box, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RemoveIcon from '@mui/icons-material/Remove'

import type { PurchaseOrderSummary } from './types'
import { formatEuro } from './types'

type PurchaseOrderKpisProps = {
  year: number
  summary: PurchaseOrderSummary | null
  loading: boolean
}

function formatDeltaPct(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export default function PurchaseOrderKpis({ year, summary, loading }: PurchaseOrderKpisProps) {
  const theme = useTheme()

  const hasYoy = summary?.previous_year != null && summary?.previous_year_amount != null
  const deltaPct = summary?.yoy_delta_pct ?? null

  // Verde se in crescita, rosso se in calo, grigio se invariato/non disponibile
  // (deciso in chat: confronto Totale in Euro vs anno precedente).
  const yoyAccent = deltaPct == null ? '#64748b' : deltaPct > 0 ? '#16a34a' : deltaPct < 0 ? '#dc2626' : '#64748b'
  const YoyIcon = deltaPct == null || deltaPct === 0 ? RemoveIcon : deltaPct > 0 ? ArrowUpwardIcon : ArrowDownwardIcon

  const yoySub = !hasYoy
    ? 'nessun dato per l\u2019anno precedente'
    : `vs ${formatEuro(summary!.previous_year_amount)} nel ${summary!.previous_year}`

  const kpis = [
    { label: 'Totale Purchase Order', value: summary ? formatEuro(summary.total_amount) : '—', sub: `valore economico nel ${year}`, accent: '#0d9488' },
    { label: 'Da inviare',            value: summary?.to_send ?? '—', sub: 'stato "Inserito"', accent: '#f59e0b' },
    { label: 'In attesa',             value: summary?.waiting ?? '—', sub: 'inviato o ricevuto, in attesa di riscontro', accent: '#6366f1' },
    {
      label: `Variazione vs ${year - 1}`,
      value: deltaPct != null ? formatDeltaPct(deltaPct) : '—',
      sub: yoySub,
      accent: yoyAccent,
      icon: <YoyIcon sx={{ fontSize: 16 }} />,
    },
  ]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: '10px', opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      {kpis.map((m) => (
        <Box
          key={m.label}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '8px',
            p: { xs: '12px', sm: '14px 16px' },
            backgroundImage: `linear-gradient(135deg, ${alpha(m.accent, 0.62)} 0%, ${alpha(m.accent, 0.86)} 100%)`,
            border: `1px solid ${alpha(m.accent, 0.18)}`,
            boxShadow: `0 10px 28px ${alpha(m.accent, 0.18)}`,
            '&::before': {
              content: '""', position: 'absolute',
              width: 80, height: 80, borderRadius: '50%',
              right: -20, top: -16,
              backgroundColor: alpha(theme.palette.common.white, 0.14),
            },
            '&::after': {
              content: '""', position: 'absolute',
              width: 100, height: 100, borderRadius: '50%',
              right: 16, bottom: -52,
              backgroundColor: alpha(theme.palette.common.white, 0.10),
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: alpha(theme.palette.common.white, 0.85), mb: '6px', lineHeight: 1.2 }}>
              {m.label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {m.icon ? (
                <Box sx={{ display: 'inline-flex', color: theme.palette.common.white, opacity: 0.85 }}>
                  {m.icon}
                </Box>
              ) : null}
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: theme.palette.common.white, lineHeight: 1, letterSpacing: -0.5, textShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.12)}` }}>
                {m.value}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: alpha(theme.palette.common.white, 0.75), mt: '4px' }}>
              {m.sub}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
