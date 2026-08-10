import * as React from 'react'
import { Autocomplete, TextField } from '@mui/material'

import { ITALIAN_PROVINCES, resolveItalianProvince, type ItalianProvince } from '../data/italianProvinces'

type ProvinceAutocompleteProps = {
  value: string
  onChange: (sigla: string) => void
  label?: string
  error?: boolean
  helperText?: string
  disabled?: boolean
}

/**
 * Selettore provincia da elenco chiuso (107 province italiane, vedi
 * data/italianProvinces.ts). Il valore salvato è sempre la sigla (es. "BO"),
 * ma l'utente sceglie dal nome esteso ("Bologna (BO)") tramite ricerca.
 *
 * Non è freeSolo: forza la scelta da elenco per evitare nuovi valori non
 * standard. Un valore legacy non riconosciuto (dato anomalo pre-esistente)
 * resta visibile come testo libero nel campo finché non viene sostituito
 * con una scelta valida, senza essere cancellato silenziosamente.
 */
export default function ProvinceAutocomplete({
  value,
  onChange,
  label = 'Provincia',
  error,
  helperText,
  disabled,
}: ProvinceAutocompleteProps) {
  const resolved = resolveItalianProvince(value)
  const canonicalLabel = resolved ? `${resolved.name} (${resolved.sigla})` : value

  // Testo mostrato nel campo mentre l'utente digita: stato locale sincronizzato
  // dall'esterno (apertura in edit, reset del form) ma libero di variare ad
  // ogni tasto premuto, come richiesto dal pattern "controlled" di Autocomplete.
  const [inputValue, setInputValue] = React.useState(canonicalLabel)

  React.useEffect(() => {
    setInputValue(canonicalLabel)
    // Risincronizza solo quando cambia il valore esterno (es. apertura dialog),
    // non ad ogni render: eslint non può verificarlo staticamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Autocomplete<ItalianProvince>
      size="small"
      fullWidth
      disabled={disabled}
      options={ITALIAN_PROVINCES}
      getOptionLabel={(opt) => `${opt.name} (${opt.sigla})`}
      isOptionEqualToValue={(opt, val) => opt.sigla === val.sigla}
      value={resolved}
      inputValue={inputValue}
      onChange={(_e, next) => onChange(next ? next.sigla : '')}
      onInputChange={(_e, next, reason) => {
        setInputValue(next)
        // Reason "clear" arriva dalla X del campo: azzera anche il valore salvato.
        if (reason === 'clear') onChange('')
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} error={error} helperText={helperText || ' '} />
      )}
    />
  )
}
