import type * as React from 'react'
import AreaTaskCard from '../../ui/AreaTaskCard'
import WelcomeWidget from './widgets/WelcomeWidget'
import QuickActionsWidget from './widgets/QuickActionsWidget'
import IssuesWidget from './widgets/IssuesWidget'
import MaintenanceWidget from './widgets/MaintenanceWidget'
import AnnouncementsWidget from './widgets/AnnouncementsWidget'
import TodoWidget from './widgets/TodoWidget'
import NoteWidget from './widgets/NoteWidget'
import { BirthdaysWidget, ContributorWidget, TeamWidget } from './widgets/PeopleWidgets'

// ─── Tipi (rispecchiano DashboardWidget / UserDashboardLayout nel backend) ─────

export type DashboardWidgetDef = {
  id: number
  key: string
  label: string
  /** Coppie [w, h] ammesse (non due assi indipendenti: alcuni widget hanno
   * combinazioni specifiche non cartesiane, es. il meteo può essere 5x2 ma
   * non 5x1). */
  allowed_sizes: [number, number][]
  default_w: number
  default_h: number
  sort_order: number
}

export type DashboardLayoutItem = {
  widget_key: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
}

// ─── Registry: chiave backend → componente React ───────────────────────────────
// La chiave deve coincidere esattamente con `key` nel catalogo backend
// (core/migrations/0019_seed_dashboard_widgets.py, 0043_dashboard_tinte_widgets.py).
// Stile "Tinte" (anteprima design-previews/db-base.html).

export const WIDGET_REGISTRY: Record<string, React.ComponentType> = {
  weather:       WelcomeWidget,
  contributor:   ContributorWidget,
  issues:        IssuesWidget,
  'area-tasks':  AreaTaskCard,
  announcements: AnnouncementsWidget,
  todo:          TodoWidget,
  maintenance:   MaintenanceWidget,
  'sticky-note': NoteWidget,
  birthdays:     BirthdaysWidget,
  'quick-actions-pair': QuickActionsWidget,
  team:          TeamWidget,
}

// ─── Griglia: 6 colonne, altezza riga in px ────────────────────────────────────

export const DASHBOARD_COLS = 6
// Calibrato sulla dimensione reale della card "Contributor del mese" nel
// layout statico storico (content box 348.72×238.72px, misurato via DevTools):
// con h=2 e margine verticale 16px, altezza_totale = h*rowHeight + (h-1)*margine
// → 238.72 ≈ 2*rowHeight + 16 → rowHeight ≈ 112.
export const DASHBOARD_ROW_HEIGHT = 112
export const DASHBOARD_MARGIN: [number, number] = [14, 14]

/** Trova la coppia [w,h] ammessa più vicina a (w,h) per distanza Manhattan
 * in unità di griglia (usato per lo snap del resize libero ai formati
 * dichiarati dal widget — non due assi indipendenti, vedi allowed_sizes). */
export function snapToNearestSize(
  w: number,
  h: number,
  allowed: [number, number][],
): [number, number] {
  if (!allowed || allowed.length === 0) return [w, h]
  return allowed.reduce((closest, curr) => {
    const dCurr = Math.abs(curr[0] - w) + Math.abs(curr[1] - h)
    const dClosest = Math.abs(closest[0] - w) + Math.abs(closest[1] - h)
    return dCurr < dClosest ? curr : closest
  }, allowed[0])
}

/** Trova la prima cella libera (scandendo riga per riga) che può ospitare
 * un widget w×h senza sovrapporsi ai `visibleItems` correnti. Usato quando
 * si riattiva un widget nascosto dal pannello "widget nascosti": non ne
 * riusa la vecchia posizione (potrebbe essere stata occupata nel frattempo
 * da altri widget spostati), ne cerca una libera da capo. */
export function findFreeSlot(
  visibleItems: DashboardLayoutItem[],
  w: number,
  h: number,
): { x: number; y: number } {
  const occupied = new Set<string>()
  for (const it of visibleItems) {
    for (let dx = 0; dx < it.w; dx++) {
      for (let dy = 0; dy < it.h; dy++) occupied.add(`${it.x + dx},${it.y + dy}`)
    }
  }
  const collides = (x: number, y: number) => {
    if (x + w > DASHBOARD_COLS) return true
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return true
      }
    }
    return false
  }
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x <= DASHBOARD_COLS - w; x++) {
      if (!collides(x, y)) return { x, y }
    }
  }
  return { x: 0, y: 200 } // fallback teorico, non dovrebbe mai servire
}
