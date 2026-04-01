import type { ReactNode } from 'react'

import { Box, Button, InputAdornment, Stack, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

import type { ListViewMode } from '../hooks/useServerGrid'

import ListViewModeToggle from './ListViewModeToggle'
import { compactResetButtonSx } from './toolbarStyles'

type Props = {
  compact?: boolean
  q: string
  onQChange: (v: string) => void

  viewMode?: ListViewMode
  onViewModeChange?: (v: ListViewMode) => void

  /** Optional. If omitted, the "Reimposta" button is hidden. */
  onReset?: () => void

  children?: ReactNode
  createButton?: ReactNode

  /** Right-side extra actions (e.g. export button) */
  rightActions?: ReactNode

  searchLabel?: string
  resetLabel?: string
}

export type ListToolbarProps = Props

// Altezza comune per tutti gli elementi della toolbar
const H = 26
const HC = 32

export default function ListToolbar(props: Props) {
  const {
    q,
    onQChange,
    viewMode,
    onViewModeChange,
    onReset,
    children,
    createButton,
    rightActions,
    searchLabel = 'Cerca',
    resetLabel = 'Reimposta',
    compact = false,
  } = props

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1}
      alignItems={{ xs: 'stretch', md: 'center' }}
      sx={{
        width: '100%',
        flexWrap: { md: 'nowrap' },
        rowGap: 0,
        columnGap: 1,
        minHeight: compact ? HC : H,
        '& .MuiButton-root': { height: compact ? HC : H, fontSize: '0.75rem' },
        '& .MuiToggleButton-root': { height: compact ? HC : H, fontSize: '0.75rem' },
        ...(compact
          ? {
              '& > *': { flexShrink: 0 },
            }
          : {}),
      }}
    >
      <TextField
        size="small"
        placeholder={searchLabel}
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: compact ? 18 : 16, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          width: { xs: '100%', md: compact ? 340 : 240 },
          flexShrink: { xs: 0, md: 0 },
          '& .MuiInputBase-root': {
            height: compact ? HC : H,
            fontSize: compact ? '0.95rem' : '0.8125rem',
            borderRadius: compact ? 1.5 : undefined,
            bgcolor: { xs: 'background.paper', md: 'transparent' },
          },
          '& .MuiInputBase-input': { py: 0 },
        }}
      />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: { xs: '100%', md: 'auto' },
          ml: { md: compact ? 0 : 'auto' },
          justifyContent: { xs: 'flex-start', md: 'flex-start' },
          flexWrap: 'wrap',
          flexDirection: 'row',
          rowGap: 1,
          columnGap: 1,
        }}
      >
        {children}

        {createButton ? <Box sx={{ width: 'auto', display: 'flex' }}>{createButton}</Box> : null}

        {viewMode !== undefined && typeof onViewModeChange === 'function' ? (
          <ListViewModeToggle
            value={viewMode}
            onChange={onViewModeChange}
            compact={compact}
            sx={{ width: { xs: 'auto', md: 'auto' } }}
          />
        ) : null}

        {rightActions ? (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
              flexDirection: 'row',
              rowGap: 1,
              columnGap: 1,
              '& > *': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              },
            }}
          >
            {rightActions}
          </Box>
        ) : null}

        {typeof onReset === 'function' ? (
          <Button
            size="small"
            variant={compact ? 'contained' : 'outlined'}
            onClick={onReset}
            startIcon={compact ? <RestartAltIcon /> : undefined}
            aria-label={resetLabel}
            sx={compact ? compactResetButtonSx : { width: 'auto' }}
          >
            {compact ? '' : resetLabel}
          </Button>
        ) : null}
      </Box>
    </Stack>
  )
}
