import { TextField } from '@mui/material'

// Campo "Anno" (filtro) usato identico in Maintenance.tsx e Rapportini.tsx:
// solo cifre, massimo 4 caratteri. Estratto in un file dedicato (invece che
// in maintenanceShared.tsx) perché quel modulo deve restare solo costanti:
// mischiare un componente con delle costanti nello stesso file fa scattare
// react-refresh/only-export-components.
export function YearFilterField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <TextField
      size="small"
      label="Anno"
      placeholder="es. 2025"
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      inputProps={{ inputMode: 'numeric', maxLength: 4 }}
      fullWidth
    />
  )
}
