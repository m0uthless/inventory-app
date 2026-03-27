import * as React from 'react'

import { Box, Card, CardContent } from '@mui/material'
import { alpha, type SxProps, type Theme } from '@mui/material/styles'
import type { GridValidRowModel } from '@mui/x-data-grid'

import ListToolbar, { type ListToolbarProps } from './ListToolbar'
import ServerDataGrid, { type ServerDataGridProps } from './ServerDataGrid'
import ColumnCustomizerPanel from './ColumnCustomizerPanel'
import { type UseColumnPrefsReturn } from '../hooks/useColumnPrefs'

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
  const [colPanelSnapshot, setColPanelSnapshot] = React.useState<{
    columnOrder: string[]
    columnVisibility: Record<string, boolean>
    hasPrefs: boolean
  } | null>(null)

  // Stato locale sincronizzato con colPrefs per forzare re-render quando serve
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0)

  const openColumnPanel = React.useCallback((anchorEl: HTMLElement) => {
    const prefs = colPrefsRef.current
    setColPanelAnchor(anchorEl)
    setColPanelSnapshot(
      prefs
        ? {
            columnOrder: prefs.columnOrder,
            columnVisibility: prefs.columnVisibilityModel,
            hasPrefs: prefs.hasPrefs,
          }
        : null,
    )
    forceUpdate()
  }, [])

  return (
    <Card variant="outlined" sx={[{ borderRadius: 1, borderColor: 'divider', boxShadow: 'none', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <CardContent
        sx={{
          pt: toolbar.compact ? 1.75 : 2,
          pb: 2,
          px: 2,
          '&:last-child': { pb: 2 },
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
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
                  borderRadius: 1,
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
            {children}
          </ListToolbar>

          {belowToolbar ? <Box sx={{ mt: 1 }}>{belowToolbar}</Box> : null}
        </Box>

        <ServerDataGrid
          {...grid}
          colPrefsRef={colPrefsRef}
          onOpenColumnPanel={persistEnabled ? openColumnPanel : undefined}
        />

        {/* Pannello drag & drop colonne */}
        {persistEnabled && colPanelSnapshot && (
          <ColumnCustomizerPanel
            anchorEl={colPanelAnchor}
            onClose={() => {
              setColPanelAnchor(null)
              setColPanelSnapshot(null)
            }}
            columns={grid.columns}
            columnOrder={colPanelSnapshot.columnOrder}
            columnVisibility={colPanelSnapshot.columnVisibility}
            onOrderChange={(order) => {
              colPrefsRef.current?.saveOrder(order)
              setColPanelSnapshot((prev) =>
                prev ? { ...prev, columnOrder: order, hasPrefs: true } : prev,
              )
              forceUpdate()
            }}
            onVisibilityChange={(model) => {
              colPrefsRef.current?.onColumnVisibilityModelChange(model)
              setColPanelSnapshot((prev) =>
                prev ? { ...prev, columnVisibility: model, hasPrefs: true } : prev,
              )
              forceUpdate()
            }}
            onReset={() => {
              colPrefsRef.current?.resetPrefs()
              const prefs = colPrefsRef.current
              setColPanelSnapshot(
                prefs
                  ? {
                      columnOrder: prefs.columnOrder,
                      columnVisibility: prefs.columnVisibilityModel,
                      hasPrefs: prefs.hasPrefs,
                    }
                  : null,
              )
              forceUpdate()
            }}
            hasPrefs={colPanelSnapshot.hasPrefs}
          />
        )}
      </CardContent>
    </Card>
  )
}
