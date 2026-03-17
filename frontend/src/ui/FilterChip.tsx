/**
 * FilterChip — chip compatto con Popover per i filtri di lista.
 *
 * Usa ThemeProvider locale per ridurre il font dei controlli interni
 * (label, select, menuitem) anche quando renderizzati in Portal MUI.
 */
import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Popover,
  Stack,
  Typography,
  Tooltip,
  createTheme,
  ThemeProvider,
  useTheme,
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import CloseIcon from '@mui/icons-material/Close'

type Props = {
  compact?: boolean
  /** Numero di filtri attivi (mostra badge arancio se > 0). */
  activeCount: number
  /** Callback "Reimposta filtri" — se omesso il pulsante non appare. */
  onReset?: () => void
  /** I controlli filtro (FormControl, Select, ecc.). */
  children: React.ReactNode
  tooltip?: string
}

const FONT_SIZE = 12

export default function FilterChip({ activeCount, onReset, children, compact = false, tooltip = 'Filtri' }: Props) {
  const parentTheme = useTheme()
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const open = Boolean(anchor)
  const hasActive = activeCount > 0

  // Tema locale con font ridotto — il React context si propaga anche
  // attraverso i Portal MUI (Select dropdown, Menu, ecc.).
  const smallTheme = React.useMemo(
    () =>
      createTheme(parentTheme, {
        components: {
          MuiMenuItem: {
            styleOverrides: {
              root: {
                fontSize: FONT_SIZE,
                minHeight: 32,
                paddingTop: 4,
                paddingBottom: 4,
              },
            },
          },
          MuiInputLabel: {
            styleOverrides: {
              root: { fontSize: FONT_SIZE },
              shrink: { fontSize: 13 },
            },
          },
          MuiSelect: {
            styleOverrides: {
              select: {
                fontSize: FONT_SIZE,
                paddingTop: 6,
                paddingBottom: 6,
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: { fontSize: FONT_SIZE },
            },
          },
        },
      }),
    [parentTheme],
  )

  return (
    <>
      <Tooltip title={tooltip} arrow enterDelay={120}>
        <Badge
          badgeContent={activeCount}
          color="warning"
          overlap="circular"
          invisible={!hasActive}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: 10,
              height: 16,
              minWidth: 16,
              padding: '0 3px',
            },
          }}
        >
          <Chip
          icon={<FilterListIcon fontSize={compact ? 'medium' : 'small'} />}
          label={compact ? '' : hasActive ? `Filtri (${activeCount})` : 'Filtri'}
          onClick={(e) => setAnchor(e.currentTarget)}
          onDelete={hasActive && onReset ? onReset : undefined}
          deleteIcon={<CloseIcon fontSize="small" />}
          variant={hasActive ? 'filled' : 'outlined'}
          size="medium"
          sx={{
            minWidth: compact ? 40 : undefined,
            width: compact ? 40 : undefined,
            height: compact ? 40 : undefined,
            px: compact ? 0 : undefined,
            flex: compact ? '0 0 40px' : undefined,
            borderRadius: compact ? 1 : undefined,
            fontWeight: hasActive ? 700 : 400,
            // compact: teal filled come tutti gli altri bottoni toolbar
            bgcolor: compact ? 'primary.main' : hasActive ? 'primary.main' : undefined,
            color: compact ? 'primary.contrastText' : hasActive ? 'primary.contrastText' : undefined,
            borderColor: compact ? 'primary.main' : hasActive ? 'primary.main' : 'divider',
            border: compact ? 0 : undefined,
            display: compact ? 'inline-flex' : undefined,
            alignItems: compact ? 'center' : undefined,
            justifyContent: compact ? 'center' : undefined,
            '&:hover': compact
              ? { bgcolor: 'primary.dark', borderColor: 'primary.dark' }
              : undefined,
            '&.MuiChip-clickable:hover': compact
              ? { bgcolor: 'primary.dark', borderColor: 'primary.dark' }
              : undefined,
            '&.MuiChip-filled:hover': compact
              ? { bgcolor: 'primary.dark', borderColor: 'primary.dark' }
              : undefined,
            '&.Mui-focusVisible': compact
              ? { outline: '2px solid rgba(15, 118, 110, 0.34)', outlineOffset: 1 }
              : undefined,
            transition: compact
              ? 'background-color 140ms ease'
              : 'all 180ms ease',
            '& .MuiChip-label': { display: compact ? 'none' : 'inline' },
            '& .MuiChip-icon': {
              margin: compact ? 0 : undefined,
              color: compact ? 'primary.contrastText' : hasActive ? 'primary.contrastText' : 'text.secondary',
              fontSize: compact ? 18 : undefined,
            },
            '& .MuiChip-deleteIcon': {
              display: compact ? 'none' : undefined,
              color: hasActive ? 'rgba(255,255,255,0.7)' : undefined,
              '&:hover': { color: hasActive ? 'rgba(255,255,255,1)' : undefined },
            },
            '& .MuiChip-action': {
              display: compact ? 'inline-flex' : undefined,
              alignItems: compact ? 'center' : undefined,
              justifyContent: compact ? 'center' : undefined,
            },
            cursor: 'pointer',
          }}
          />
        </Badge>
      </Tooltip>

      {/* ThemeProvider avvolge il Popover: il context React segue l'albero
          dei componenti, non il DOM, quindi raggiunge anche i Portal dei Select. */}
      <ThemeProvider theme={smallTheme}>
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                borderRadius: 1.5,
                boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
                border: '1px solid',
                borderColor: 'divider',
                minWidth: 240,
                maxWidth: 320,
              },
            },
          }}
        >
          {/* Header */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 1.5, pt: 1, pb: 0.75 }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Filtri
            </Typography>

            {onReset && hasActive && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  onReset()
                  setAnchor(null)
                }}
                sx={{
                  fontSize: 11,
                  minWidth: 0,
                  px: 0.75,
                  py: 0,
                  color: 'text.secondary',
                  lineHeight: 1.6,
                }}
              >
                Reimposta
              </Button>
            )}
          </Stack>

          <Divider />

          {/* Filter controls */}
          <Box sx={{ px: 1.5, py: 1.25 }}>
            <Stack spacing={1}>{children}</Stack>
          </Box>

          {/* Footer */}
          <Divider />
          <Box sx={{ px: 1.5, py: 0.75, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => setAnchor(null)}
              sx={{ minWidth: 64, fontSize: 12, py: 0.4 }}
            >
              Chiudi
            </Button>
          </Box>
        </Popover>
      </ThemeProvider>
    </>
  )
}
