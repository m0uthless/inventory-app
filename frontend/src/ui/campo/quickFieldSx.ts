import type { Theme } from '@mui/material'
import type { SystemStyleObject } from '@mui/system'

/** Stile dei campi compatti (36px, etichetta sopra): per riusarlo su Autocomplete e simili. */
export const quickFieldSx = (error = false): SystemStyleObject<Theme> => ({
  minHeight: 36, px: 1.25, fontSize: 13.5, border: '1px solid', borderColor: error ? 'error.main' : 'archie.borderStrong', borderRadius: '7px', bgcolor: 'background.paper',
  '&.Mui-focused': { borderColor: error ? 'error.main' : 'primary.main', boxShadow: (t: Theme) => t.palette.archie.focusRing },
  '&.Mui-disabled': { bgcolor: 'archie.surface2' }, '&.MuiInputBase-multiline': { py: 1 },
})
