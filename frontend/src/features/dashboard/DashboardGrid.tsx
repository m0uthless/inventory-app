import * as React from 'react'
import { Box, IconButton } from '@mui/material'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import GridLayout, { useContainerWidth, type Layout } from 'react-grid-layout'
import { gridBounds, minMaxSize, type LayoutConstraint } from 'react-grid-layout/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  DASHBOARD_COLS, DASHBOARD_ROW_HEIGHT, DASHBOARD_MARGIN,
  WIDGET_REGISTRY, snapToNearestSize,
  type DashboardWidgetDef, type DashboardLayoutItem,
} from './dashboardTypes'

const DRAG_HANDLE_CLASS = 'dashboard-drag-handle'

type Props = {
  widgets: DashboardWidgetDef[]
  layoutItems: DashboardLayoutItem[]
  onLayoutItemsChange: (items: DashboardLayoutItem[]) => void
  editMode: boolean
}

export default function DashboardGrid({ widgets, layoutItems, onLayoutItemsChange, editMode }: Props) {
  const { width, containerRef, mounted } = useContainerWidth()

  const widgetsByKey = React.useMemo(() => {
    const map = new Map<string, DashboardWidgetDef>()
    widgets.forEach(w => map.set(w.key, w))
    return map
  }, [widgets])

  // Constraint personalizzato: lo snap non è al min/max continuo (comportamento
  // di default di react-grid-layout) né a due assi indipendenti, ma alla
  // coppia [w,h] più vicina tra i formati discreti dichiarati dal widget
  // (allowed_sizes), come definito con Fede.
  const snapConstraint = React.useMemo<LayoutConstraint>(() => ({
    name: 'snap-to-allowed-sizes',
    constrainSize: (item, w, h) => {
      const widget = widgetsByKey.get(item.i)
      if (!widget) return { w, h }
      const [snappedW, snappedH] = snapToNearestSize(w, h, widget.allowed_sizes)
      return { w: snappedW, h: snappedH }
    },
  }), [widgetsByKey])

  const layout: Layout = React.useMemo(
    () => layoutItems
      .filter(it => it.visible && widgetsByKey.has(it.widget_key))
      .map(it => {
        const widget = widgetsByKey.get(it.widget_key)!
        const widths  = widget.allowed_sizes.map(([w]) => w)
        const heights = widget.allowed_sizes.map(([, h]) => h)
        const minW = Math.min(...widths)
        const maxW = Math.max(...widths)
        const minH = Math.min(...heights)
        const maxH = Math.max(...heights)
        const widthVaries  = minW !== maxW
        const heightVaries = minH !== maxH

        // Le maniglie mostrate corrispondono solo agli assi che il widget
        // può effettivamente cambiare: se un asse è fisso (es. il meteo ha
        // altezza sempre 2), non mostriamo le maniglie n/s che altrimenti
        // si trascinerebbero visivamente senza produrre alcun effetto reale
        // (il preview a livello pixel andrebbe oltre il min/max valido e
        // scatterebbe indietro solo al rilascio — l'effetto "non si
        // ridimensiona bene" segnalato).
        let resizeHandles: NonNullable<Layout[number]['resizeHandles']>
        if (widthVaries && heightVaries) {
          resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
        } else if (widthVaries) {
          resizeHandles = ['e', 'w']
        } else if (heightVaries) {
          resizeHandles = ['n', 's']
        } else {
          resizeHandles = []
        }

        return {
          i: it.widget_key, x: it.x, y: it.y, w: it.w, h: it.h,
          minW, maxW, minH, maxH, resizeHandles,
        }
      }),
    [layoutItems, widgetsByKey],
  )

  const handleLayoutChange = React.useCallback((newLayout: Layout) => {
    // IMPORTANTE: newLayout contiene solo i widget attualmente visibili
    // (quelli passati nella prop `layout`, filtrati per visible). Se qui
    // sostituissimo l'intero array layoutItems con newLayout.map(...), ogni
    // widget nascosto sparirebbe dallo stato invece di restare con
    // visible:false — bug reale riscontrato: "nascondo un widget e non
    // appare più in 'widget nascosti'" perché la riga veniva proprio persa,
    // non solo marcata invisibile. Aggiorniamo quindi SOLO le righe
    // corrispondenti a un item presente in newLayout, lasciando invariato
    // (nascosti compresi) tutto il resto.
    const updatesByKey = new Map(newLayout.map(li => [li.i, li]))
    onLayoutItemsChange(
      layoutItems.map(it => {
        const li = updatesByKey.get(it.widget_key)
        return li ? { ...it, x: li.x, y: li.y, w: li.w, h: li.h, visible: true } : it
      })
    )
  }, [layoutItems, onLayoutItemsChange])

  // Nascondere non rimuove la riga di layout, imposta solo `visible: false`:
  // posizione/dimensione restano salvate, così se l'utente lo riattiva dal
  // pannello "widget nascosti" (vedi Dashboard.tsx) ricompare dov'era.
  const handleHideWidget = React.useCallback((widgetKey: string) => {
    onLayoutItemsChange(
      layoutItems.map(it => it.widget_key === widgetKey ? { ...it, visible: false } : it)
    )
  }, [layoutItems, onLayoutItemsChange])

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: DASHBOARD_COLS,
            rowHeight: DASHBOARD_ROW_HEIGHT,
            margin: DASHBOARD_MARGIN,
            containerPadding: [0, 0],
            maxRows: Infinity,
          }}
          dragConfig={{ enabled: editMode, handle: `.${DRAG_HANDLE_CLASS}` }}
          resizeConfig={{ enabled: editMode, handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] }}
          constraints={[gridBounds, minMaxSize, snapConstraint]}
          onLayoutChange={handleLayoutChange}
          autoSize
        >
          {layout.map(item => {
            const Widget = WIDGET_REGISTRY[item.i]
            if (!Widget) return null
            return (
              <Box
                key={item.i}
                sx={{
                  height: '100%',
                  width: '100%',
                  position: 'relative',
                  ...(editMode && {
                    outline: '2px dashed',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                    borderRadius: 1,
                  }),
                }}
              >
                {editMode && (
                  <Box
                    className={DRAG_HANDLE_CLASS}
                    sx={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      // px inset per non sovrapporsi alle maniglie di resize
                      // agli angoli (20px), che restano comunque sopra e
                      // cliccabili grazie all'ordine nel DOM.
                      px: '22px',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      cursor: 'move',
                      opacity: 0.85,
                    }}
                  >
                    <DragIndicatorRoundedIcon sx={{ fontSize: 18 }} />
                    <IconButton
                      size="small"
                      aria-label="Nascondi widget"
                      onClick={() => handleHideWidget(item.i)}
                      onMouseDown={(e) => e.stopPropagation()}
                      sx={{ color: 'inherit', p: 0.25 }}
                    >
                      <VisibilityOffOutlinedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                )}
                <Box sx={{ height: '100%', width: '100%', ...(editMode && { pointerEvents: 'none' }) }}>
                  <Widget />
                </Box>
              </Box>
            )
          })}
        </GridLayout>
      )}
    </Box>
  )
}
