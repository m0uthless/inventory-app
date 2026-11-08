import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded'
import CloudRoundedIcon from '@mui/icons-material/CloudRounded'
import type { TintKey } from '../../../theme/palettes'
import { tintedBg } from './tints'

function Action({ tone, icon: Icon, title, sub, onClick }: { tone: TintKey; icon: SvgIconComponent; title: string; sub: string; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} sx={{
      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.25, px: 1.5, borderRadius: '12px', textAlign: 'left',
      bgcolor: (t) => t.palette.archie.tints[tone].mid, color: (t) => (t.palette.mode === 'dark' ? '#0b1513' : '#fff'),
      '&:hover': { filter: 'brightness(1.05)' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
    }}>
      <Icon sx={{ fontSize: 24, flex: 'none' }} />
      <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.25 }}>
        <Box component="b" sx={{ fontSize: 13.5, fontWeight: 650 }}>{title}</Box>
        <Box component="small" sx={{ fontSize: 11.5, opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</Box>
      </Box>
    </ButtonBase>
  )
}

/** Azioni rapide: nuova issue e triage ServiceNow, come prima. */
export default function QuickActionsWidget() {
  const navigate = useNavigate()
  return (
    <Box component="section" aria-label="Azioni rapide" sx={{ height: '100%', width: '100%', containerType: 'inline-size', borderRadius: '14px', bgcolor: (t) => tintedBg(t, 'mint', 45) }}>
      <Box sx={{ height: '100%', display: 'flex', gap: 1, p: 1.25, '@container (max-width: 300px)': { flexDirection: 'column', '& small': { display: 'none' } } }}>
      <Action tone="mint" icon={AddCircleRoundedIcon} title="Nuova issue" sub="problema di un cliente" onClick={() => navigate('/issues', { state: { openCreate: true } })} />
      <Action tone="sky" icon={CloudRoundedIcon} title="Triage" sub="caso ServiceNow" onClick={() => navigate('/servicenow-cases', { state: { openCreate: true } })} />
      </Box>
    </Box>
  )
}
