import { Box, ButtonBase } from '@mui/material'
import { useNavigate } from 'react-router-dom'

/** «Elenco / Valore» accanto al titolo dei Contratti (come le sezioni della Manutenzione). Solo con il permesso sui valori. */
export default function ContractsNav({ current }: { current: 'list' | 'value' }) {
  const navigate = useNavigate()
  const items: [typeof current, string, string][] = [['list', 'Elenco', '/contracts'], ['value', 'Valore', '/contracts/valore']]
  return (
    <Box component="nav" aria-label="Sezioni dei contratti" sx={{ display: 'inline-flex', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '9px', bgcolor: 'background.paper' }}>
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
