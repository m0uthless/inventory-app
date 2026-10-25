import { Chip } from '@mui/material'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { dueDiffDays } from '../maintenanceShared'

// Badge di scadenza condiviso tra Maintenance.tsx e MaintenancePlans.tsx.
// Era duplicato nei due file con un'incongruenza: il ramo di fallback (oltre
// 30gg) formattava la data in dd/mm/yyyy in Maintenance.tsx ma mostrava la
// stringa ISO grezza in MaintenancePlans.tsx. Qui si usa sempre dd/mm/yyyy,
// coerente con il formato data user-facing del resto dell'app.
export function DueBadge({ dateStr }: { dateStr: string }) {
  const diff = dueDiffDays(dateStr)
  if (diff < 0) return <Chip size="small" icon={<WarningAmberRoundedIcon sx={{ fontSize: '14px !important' }} />} label={`${Math.abs(diff)} gg fa`} color="error" sx={{ height: 22, fontWeight: 600, fontSize: '0.72rem' }} />
  if (diff === 0) return <Chip size="small" label="Oggi" color="error" sx={{ height: 22, fontWeight: 700, fontSize: '0.72rem' }} />
  if (diff <= 30) return <Chip size="small" label={`${diff} gg`} color="warning" variant="outlined" sx={{ height: 22, fontWeight: 600, fontSize: '0.72rem' }} />
  const [y, m, d] = dateStr.split('-')
  return <Chip size="small" label={`${d}/${m}/${y}`} color="default" variant="outlined" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, borderRadius: 1.5 }} />
}
