import { Box, ButtonBase } from '@mui/material'
import { useNavigate } from 'react-router-dom'

/** Sottosezioni della manutenzione, come nella barra laterale. */
export default function SectionNav({ current }: { current: 'due' | 'plans' | 'events' }) {
  const navigate = useNavigate()
  const items: [typeof current, string, string][] = [['due', 'Scadenze', '/maintenance'], ['plans', 'Piani', '/maintenance/plans'], ['events', 'Rapportini', '/maintenance/rapportini']]
  return (
    <Box component="nav" aria-label="Sezioni della manutenzione" sx={{ display: 'inline-flex', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '9px', bgcolor: 'background.paper' }}>
      {items.map(([k, l, to]) => (
        <ButtonBase key={k} onClick={() => navigate(to)} aria-current={current === k ? 'page' : undefined} sx={{
          height: 30, px: 1.5, borderRadius: '6px', fontSize: 13, fontWeight: 550,
          color: current === k ? 'primary.main' : 'text.secondary', bgcolor: current === k ? 'archie.field' : 'transparent',
          '&:hover': { color: current === k ? 'primary.main' : 'text.primary', bgcolor: current === k ? 'archie.field' : 'archie.surface2' },
          '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
        }}>{l}</ButtonBase>
      ))}
    </Box>
  )
}

