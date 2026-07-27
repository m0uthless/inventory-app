import { Box, Typography } from '@mui/material'

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export default function KpiCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: number | string
  color: string
  sub?: string
}) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', borderRadius: '8px',
      p: '10px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      backgroundImage: `linear-gradient(135deg, ${color}99 0%, ${color}ee 100%)`,
      border: `1px solid ${color}40`,
      boxShadow: `0 8px 20px ${color}30`,
      '&::before': { content: '""', position: 'absolute', width: 70, height: 70, borderRadius: '50%', right: -18, top: -18, backgroundColor: 'rgba(255,255,255,0.14)' },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', mb: '4px', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: -0.5 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.72)', mt: '3px' }}>{sub}</Typography>}
      </Box>
    </Box>
  )
}
