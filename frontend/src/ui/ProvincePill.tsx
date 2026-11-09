import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { ITALIAN_PROVINCES, resolveItalianProvince } from '../data/italianProvinces'
import { SelectPill } from './campo'

const OPTIONS = ITALIAN_PROVINCES.map((p) => ({ value: p.sigla, label: `${p.name} (${p.sigla})` }))

/**
 * Provincia come pillola dell'inserimento rapido: elenco chiuso delle 107 province, con ricerca.
 * Si salva la sigla. Un valore vecchio non riconosciuto resta visibile finché non lo si sostituisce.
 */
export default function ProvincePill({ value, onChange, error }: { value: string; onChange: (sigla: string) => void; error?: boolean }) {
  const resolved = resolveItalianProvince(value)
  const options = value && !resolved ? [{ value, label: `${value} (non riconosciuta)` }, ...OPTIONS] : OPTIONS
  return (
    <SelectPill icon={<MapOutlinedIcon />} placeholder="Provincia" value={resolved ? resolved.sigla : value} options={options} emptyLabel="Nessuna" error={error}
      onChange={(v) => onChange(String(v))} />
  )
}
