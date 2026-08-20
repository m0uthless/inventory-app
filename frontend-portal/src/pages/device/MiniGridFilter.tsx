import { Box, Chip, Typography } from '@mui/material'

// ─── Mini-grid filtro riusabile (Sedi / Tipi / Produttori) ────────────────────

export interface MiniGridFilterItem {
  id: number
  name: string
}

export default function MiniGridFilter({
  title,
  items,
  activeId,
  onChange,
}: {
  title: string
  items: MiniGridFilterItem[]
  activeId: number | ''
  onChange: (id: number | '') => void
}) {
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{title}</Typography>
        {activeId !== '' && (
          <Chip size="small" label="✕ reset" onClick={() => onChange('')}
            sx={{ height: 16, fontSize: '0.60rem', fontWeight: 700, cursor: 'pointer', bgcolor: 'rgba(26,107,181,0.12)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.25)', '& .MuiChip-label': { px: 0.6 }, '&:hover': { bgcolor: 'rgba(26,107,181,0.22)' } }} />
        )}
      </Box>
      <Box sx={{
        maxHeight: 180,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {items.map((row) => {
          const active = activeId === row.id
          return (
            <Box
              key={row.id}
              onClick={() => onChange(active ? '' : row.id)}
              sx={{
                height: 36,
                display: 'flex',
                alignItems: 'center',
                px: 1.5,
                fontSize: '0.78rem',
                cursor: 'pointer',
                bgcolor: active ? 'rgba(26,107,181,0.22)' : 'transparent',
                '&:hover': { bgcolor: active ? 'rgba(26,107,181,0.28)' : 'rgba(26,107,181,0.07)' },
                userSelect: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {row.name}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
