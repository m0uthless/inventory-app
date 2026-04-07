import { ToggleButton, ToggleButtonGroup, type SxProps, type Theme } from '@mui/material'

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

import type { ListViewMode } from '@shared/hooks/useServerGrid'

type Props = {
  value: ListViewMode
  onChange: (v: ListViewMode) => void
  sx?: SxProps<Theme>
  compact?: boolean
}

export default function ListViewModeToggle({ value, onChange, sx, compact = false }: Props) {
  const baseSx: SxProps<Theme> = {
    // Altezza 32px come tutti gli altri elementi della toolbar
    '& .MuiToggleButtonGroup-grouped': {
      textTransform: 'none',
      px: compact ? 1.35 : 1.25,
      py: 0,
      height: compact ? 40 : 32,
      fontSize: compact ? '0.9rem' : '0.8125rem',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      gap: 0.75,
    },
    '& .MuiToggleButtonGroup-grouped:first-of-type': {
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    '& .MuiToggleButtonGroup-grouped:last-of-type': {
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },
  }

  const mergedSx: SxProps<Theme> = sx
    ? Array.isArray(sx) ? [baseSx, ...sx] : [baseSx, sx]
    : baseSx

  return (
    <ToggleButtonGroup
      size="small"
      value={value}
      exclusive
      onChange={(_e, v) => { if (!v) return; onChange(v) }}
      sx={mergedSx}
    >
      <ToggleButton value="active">
        <CheckCircleOutlineIcon sx={{ fontSize: 15 }} />
        Attivi
      </ToggleButton>
      <ToggleButton value="all">
        <ViewListOutlinedIcon sx={{ fontSize: 15 }} />
        Tutti
      </ToggleButton>
      <ToggleButton value="deleted">
        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
        Cestino
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
