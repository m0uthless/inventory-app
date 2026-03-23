import { alpha, type Theme } from '@mui/material/styles'
import type { SxProps } from '@mui/system'

export const compactToolbarButtonBaseSx = {
  minWidth: 32,
  width: 32,
  height: 32,
  p: 0,
  borderRadius: 1,
  boxShadow: 'none',
  flex: '0 0 32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& .MuiButton-startIcon': {
    m: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '& .MuiSvgIcon-root': { fontSize: 16 },
} as const

const compactUnifiedButtonSx = (theme: Theme) => ({
  ...compactToolbarButtonBaseSx,
  bgcolor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  border: 0,
  transition: 'background-color 140ms ease',
  '&:hover': { bgcolor: theme.palette.primary.dark },
  '&:disabled': { opacity: 0.45 },
  '&.Mui-focusVisible': {
    outline: `2px solid ${alpha(theme.palette.primary.main, 0.34)}`,
    outlineOffset: 1,
  },
})

export const compactCreateButtonSx  = compactUnifiedButtonSx
export const compactColumnsButtonSx = compactUnifiedButtonSx
export const compactExportButtonSx  = compactUnifiedButtonSx
export const compactResetButtonSx   = compactUnifiedButtonSx
export const compactToolbarButtonSx = compactUnifiedButtonSx

export type { SxProps }
