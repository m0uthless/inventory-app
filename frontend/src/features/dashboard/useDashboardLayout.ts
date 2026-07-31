import * as React from 'react'
import { api } from '@shared/api/client'
import {
  DASHBOARD_COLS,
  type DashboardWidgetDef,
  type DashboardLayoutItem,
} from './dashboardTypes'

// ─── Auto-placement per i widget senza layout salvato ──────────────────────────
// Shelf-packing semplice: scandisce la griglia riga per riga, colonna per
// colonna, e piazza ogni widget (in ordine di sort_order) nella prima cella
// libera che lo contiene senza collisioni. Usato solo al primo avvio di un
// utente (nessuna riga in UserDashboardLayout) o per widget nuovi aggiunti
// al catalogo dopo che l'utente ha già personalizzato la dashboard.
function autoPlace(
  widgets: DashboardWidgetDef[],
  existing: DashboardLayoutItem[],
): DashboardLayoutItem[] {
  const occupied = new Set<string>()
  const mark = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) occupied.add(`${x + dx},${y + dy}`)
    }
  }
  const collides = (x: number, y: number, w: number, h: number) => {
    if (x + w > DASHBOARD_COLS) return true
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return true
      }
    }
    return false
  }

  const existingByKey = new Map(existing.map(it => [it.widget_key, it]))
  const result: DashboardLayoutItem[] = []

  for (const widget of widgets) {
    const saved = existingByKey.get(widget.key)
    if (saved) {
      mark(saved.x, saved.y, saved.w, saved.h)
      result.push(saved)
      continue
    }
    const w = widget.default_w
    const h = widget.default_h
    let placed = false
    for (let y = 0; !placed && y < 200; y++) {
      for (let x = 0; x <= DASHBOARD_COLS - w; x++) {
        if (!collides(x, y, w, h)) {
          mark(x, y, w, h)
          result.push({ widget_key: widget.key, x, y, w, h, visible: true })
          placed = true
          break
        }
      }
    }
  }
  return result
}

export function useDashboardLayout() {
  const [widgets, setWidgets]         = React.useState<DashboardWidgetDef[]>([])
  const [layoutItems, setLayoutItems] = React.useState<DashboardLayoutItem[]>([])
  const [loading, setLoading]         = React.useState(true)
  const [saving, setSaving]           = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [widgetsRes, layoutRes] = await Promise.all([
        api.get<DashboardWidgetDef[] | { results: DashboardWidgetDef[] }>('/dashboard-widgets/', { params: { page_size: 100 } }),
        api.get<DashboardLayoutItem[] | { results: DashboardLayoutItem[] }>('/dashboard-layout/', { params: { page_size: 100 } }),
      ])
      const widgetList = Array.isArray(widgetsRes.data) ? widgetsRes.data : widgetsRes.data.results
      const layoutListRaw = Array.isArray(layoutRes.data) ? layoutRes.data : layoutRes.data.results
      const layoutList: DashboardLayoutItem[] = layoutListRaw.map(it => ({
        widget_key: it.widget_key,
        x: it.x, y: it.y, w: it.w, h: it.h, visible: it.visible,
      }))
      setWidgets(widgetList)
      setLayoutItems(autoPlace(widgetList, layoutList))
    } catch {
      // Se il caricamento fallisce, la dashboard resta vuota/statica:
      // Dashboard.tsx ricade sul layout legacy fisso in questo caso.
      setWidgets([])
      setLayoutItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const save = React.useCallback(async (items: DashboardLayoutItem[]) => {
    setSaving(true)
    try {
      await api.post('/dashboard-layout/bulk/', items)
    } catch {
      // Salvataggio fallito silenziosamente: il layout resta com'era in
      // sessione, l'utente può riprovare uscendo/rientrando da "Personalizza".
    } finally {
      setSaving(false)
    }
  }, [])

  return { widgets, layoutItems, setLayoutItems, loading, saving, save, reload: load }
}
