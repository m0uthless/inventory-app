import { Box, ButtonBase, Typography } from '@mui/material'

import { CampoIcon } from '../../ui/campo'
import type { MtAreaChoice } from './areaChoice'

type Area = { id: number; label: string }

/**
 * Interruttore delle aree della Manutenzione (anteprima design-previews/mt-base.html): la propria area
 * («la mia»), le altre per chi vede tutte le aree, «Senza area» e «Tutte».
 */
export default function MtAreaSwitch({ areas, value, onChange, myArea, canSeeAll }: {
  areas: Area[]; value: MtAreaChoice; onChange: (c: MtAreaChoice) => void; myArea: number | null; canSeeAll: boolean
}) {
  // Chi non vede tutte le aree sceglie solo fra la propria, «Senza area» e «Tutte» (le sue).
  const shown = canSeeAll ? areas : areas.filter((a) => a.id === myArea)
  const items: { key: MtAreaChoice; label: string; mine?: boolean }[] = [
    ...shown.map((a) => ({ key: a.id as MtAreaChoice, label: a.label, mine: a.id === myArea })),
    { key: 'none', label: 'Senza area' },
    { key: 'all', label: 'Tutte' },
  ]
  if (!areas.length) return null
  return (
    <Box role="group" aria-label="Area" sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '9px', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.75, fontSize: 12, color: 'text.secondary' }}><CampoIcon name="pin" size={13} />Area</Box>
      {items.map((it) => {
        const on = value === it.key
        return (
          <ButtonBase key={String(it.key)} aria-pressed={on} onClick={() => onChange(it.key)} sx={{
            height: 28, px: 1.25, borderRadius: '6px', fontSize: 12.5, fontWeight: on ? 600 : 500, gap: 0.5,
            color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent',
            '&:hover': { bgcolor: on ? 'archie.field' : 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>
            {it.label}{it.mine ? <Typography component="small" sx={{ fontSize: 10.5, color: 'text.secondary' }}>la mia</Typography> : null}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
