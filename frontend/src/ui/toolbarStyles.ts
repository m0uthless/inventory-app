import { alpha, type SxProps, type Theme } from '@mui/material/styles'

export const compactToolbarButtonBaseSx: SxProps<Theme> = {
  minWidth: 40,
  width: 40,
  height: 40,
  p: 0,
  borderRadius: 1,
  border: 0,
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
}

export const compactToolbarButtonSx: SxProps<Theme> = (theme) => ({
  ...compactToolbarButtonBaseSx,
  bgcolor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  transition: 'background-color 140ms ease, transform 140ms ease',
  '&:hover': { bgcolor: theme.palette.primary.dark },
  '&.Mui-focusVisible': {
    outline: `2px solid ${alpha(theme.palette.primary.main, 0.34)}`,
    outlineOffset: 1,
  },
})

export const compactCreateButtonSx = compactToolbarButtonSx

export const compactExportButtonSx = compactToolbarButtonSx

export const compactColumnsButtonSx = compactToolbarButtonSx

/** Reset/Reimposta: usa un tono neutro (text.secondary) invece del primary teal,
 *  per differenziarsi visivamente dal bottone Nuovo (CTA primaria). */
export const compactResetButtonSx: SxProps<Theme> = (theme) => ({
  ...compactToolbarButtonBaseSx,
  bgcolor: alpha(theme.palette.text.secondary, 0.08),
  color: theme.palette.text.secondary,
  transition: 'background-color 140ms ease',
  '&:hover': {
    bgcolor: alpha(theme.palette.text.secondary, 0.14),
    color: theme.palette.text.primary,
  },
  '&.Mui-focusVisible': {
    outline: `2px solid ${alpha(theme.palette.text.secondary, 0.30)}`,
    outlineOffset: 1,
  },
})
