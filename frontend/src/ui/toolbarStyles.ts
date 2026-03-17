import { alpha, type Theme } from '@mui/material/styles'
import type { SxProps } from '@mui/system'

/**
 * Base condivisa per tutti i bottoni compatti della toolbar (40×40px).
 * Oggetto statico — usabile direttamente in sx o come elemento di array sx.
 */
export const compactToolbarButtonBaseSx = {
  minWidth: 40,
  width: 40,
  height: 40,
  p: 0,
  borderRadius: 1,
  boxShadow: 'none',
  flex: '0 0 40px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& .MuiButton-startIcon': {
    m: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const

/**
 * CTA primaria — solo "Nuovo / Crea".
 * Filled teal: è l'unica azione che merita questo peso visivo.
 *
 * Funzione pura (theme) => sx — compatibile sia con sx={compactCreateButtonSx}
 * sia con sx={[compactCreateButtonSx, overrides]}.
 */
export const compactCreateButtonSx = (theme: Theme) => ({
  ...compactToolbarButtonBaseSx,
  bgcolor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  border: 0,
  transition: 'background-color 140ms ease',
  '&:hover': { bgcolor: theme.palette.primary.dark },
  '&.Mui-focusVisible': {
    outline: `2px solid ${alpha(theme.palette.primary.main, 0.34)}`,
    outlineOffset: 1,
  },
})

/**
 * Azioni secondarie — "Colonne", "Filtri".
 * Ghost outlined: visibili ma non competono con la CTA primaria.
 */
export const compactColumnsButtonSx = (theme: Theme) => ({
  ...compactToolbarButtonBaseSx,
  bgcolor: 'transparent',
  color: theme.palette.text.secondary,
  border: `1px solid ${alpha(theme.palette.divider, 1)}`,
  transition: 'border-color 140ms ease, color 140ms ease, background-color 140ms ease',
  '&:hover': {
    bgcolor: alpha(theme.palette.primary.main, 0.06),
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
  '&.Mui-focusVisible': {
    outline: `2px solid ${alpha(theme.palette.primary.main, 0.28)}`,
    outlineOffset: 1,
  },
})

/**
 * Azioni di utilità — "Esporta CSV".
 * Ghost outlined come Colonne: stessa famiglia semantica (strumenti, non CTA).
 */
export const compactExportButtonSx = compactColumnsButtonSx

/**
 * Azione distruttiva/neutrale — "Reimposta".
 * Flat senza bordo: il peso visivo più basso — ultima priorità cognitiva.
 */
export const compactResetButtonSx = (theme: Theme) => ({
  ...compactToolbarButtonBaseSx,
  border: 0,
  bgcolor: alpha(theme.palette.text.secondary, 0.07),
  color: theme.palette.text.secondary,
  transition: 'background-color 140ms ease, color 140ms ease',
  '&:hover': {
    bgcolor: alpha(theme.palette.text.secondary, 0.13),
    color: theme.palette.text.primary,
  },
  '&.Mui-focusVisible': {
    outline: `2px solid ${alpha(theme.palette.text.secondary, 0.28)}`,
    outlineOffset: 1,
  },
})

/**
 * @deprecated Usare compactCreateButtonSx, compactColumnsButtonSx o
 * compactExportButtonSx in base al ruolo semantico del bottone.
 * Mantenuto per compatibilità temporanea.
 */
export const compactToolbarButtonSx = compactCreateButtonSx

// Re-export del tipo per chi ne ha bisogno
export type { SxProps }
