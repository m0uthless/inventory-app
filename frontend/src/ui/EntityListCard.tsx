import * as React from 'react'

import { Box, Button, Card, CardContent, Tooltip } from '@mui/material'
import { alpha, type SxProps, type Theme } from '@mui/material/styles'
import type { GridValidRowModel } from '@mui/x-data-grid'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'

import ListToolbar, { type ListToolbarProps } from './ListToolbar'
import ServerDataGrid, { type ServerDataGridProps } from './ServerDataGrid'
import ColumnCustomizerPanel from './ColumnCustomizerPanel'
import { type UseColumnPrefsReturn } from '../hooks/useColumnPrefs'
import { compactColumnsButtonSx } from './toolbarStyles'

type Props<R extends GridValidRowModel> = {
  toolbar: ListToolbarProps
  children?: React.ReactNode
  belowToolbar?: React.ReactNode
  grid: ServerDataGridProps<R>
  sx?: SxProps<Theme>
  stickyToolbar?: boolean
}

export default function EntityListCard<R extends GridValidRowModel>(props: Props<R>) {
  const { toolbar, children, belowToolbar, grid, sx, stickyToolbar = false } = props

  const persistEnabled = Boolean(grid.pageKey)

  // Ref che ServerDataGrid popola con la sua istanza di useColumnPrefs
  const colPrefsRef = React.useRef<UseColumnPrefsReturn | null>(null)

  // State per l'anchor del pannello colonne
  const [colPanelAnchor, setColPanelAnchor] = React.useState<HTMLElement | null>(null)

  // Stato locale sincronizzato con colPrefs per forzare re-render quando serve
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0)

  const colPrefs = colPrefsRef.current

  return (
    <Card variant="outlined" sx={[{ borderRadius: 2.5, borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <CardContent
        sx={{
          pt: toolbar.compact ? 1.25 : 1.5,
          pb: 2,
          '&:last-child': { pb: 2 },
        }}
      >
        <Box
          sx={
            stickyToolbar
              ? {
                  position: 'sticky',
                  top: { xs: 56 + 8, sm: 64 + 8 },
                  zIndex: 2,
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.92),
                  backdropFilter: 'blur(8px)',
                  borderRadius: 2,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                  px: 1,
                  py: 0.75,
                  mb: 1.5,
                }
              : {
                  mb: toolbar.compact ? 1 : 1.5,
                  display: 'flex',
                  alignItems: 'center',
                }
          }
        >
          <ListToolbar {...toolbar}>
            {/* Pulsante "Colonne" iniettato come primo children */}
            {persistEnabled && (
              <Tooltip title="Colonne" arrow>
                <Button
                  size="small"
                  aria-label="Colonne"
                  startIcon={<ViewColumnIcon sx={{ fontSize: toolbar.compact ? '18px !important' : '15px !important' }} />}
                  onClick={(e) => {
                    setColPanelAnchor(e.currentTarget)
                    forceUpdate()
                  }}
                  sx={
                    toolbar.compact
                      ? compactColumnsButtonSx
                      : {
                          fontSize: '0.8125rem',
                          color: 'text.secondary',
                          textTransform: 'none',
                          px: 1.25,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                        }
                  }
                >
                  {toolbar.compact ? '' : 'Colonne'}
                </Button>
              </Tooltip>
            )}
            {children}
          </ListToolbar>

          {belowToolbar ? <Box sx={{ mt: 1 }}>{belowToolbar}</Box> : null}
        </Box>

        <ServerDataGrid {...grid} colPrefsRef={colPrefsRef} />

        {/* Pannello drag & drop colonne */}
        {persistEnabled && colPrefs && (
          <ColumnCustomizerPanel
            anchorEl={colPanelAnchor}
            onClose={() => setColPanelAnchor(null)}
            columns={grid.columns}
            columnOrder={colPrefs.columnOrder}
            columnVisibility={colPrefs.columnVisibilityModel}
            onOrderChange={(order) => {
              colPrefs?.saveOrder(order)
              forceUpdate()
            }}
            onVisibilityChange={(model) => {
              colPrefs?.onColumnVisibilityModelChange(model)
              forceUpdate()
            }}
            onReset={() => {
              colPrefs?.resetPrefs()
              forceUpdate()
            }}
            hasPrefs={colPrefs.hasPrefs}
          />
        )}
      </CardContent>
    </Card>
  )
}
