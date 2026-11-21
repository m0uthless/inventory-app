import type { CampoIconName } from '../../ui/campo'
import { GROUPS, groupOf, iconOf, resultPath, type SearchResult } from './searchModel'

/** Una riga della palette Ctrl K: dove porta e con quale stato di navigazione. */
export type PaletteItem = { key: string; icon: CampoIconName; title: string; sub?: string; path: string; state?: { openCreate: true }; recent?: string }
export type PaletteSection = { label: string; items: PaletteItem[] }

export type PalettePage = { label: string; path: string; parent?: string }
export type PaletteAction = { label: string; path: string; perm?: string; icon: CampoIconName }

/** Azioni «Nuovo…» (le pagine aprono il modulo con `state.openCreate`, come il pulsante +). */
export const PALETTE_ACTIONS: PaletteAction[] = [
  { label: 'Nuova issue', path: '/issues', perm: 'issues.add_issue', icon: 'plus' },
  { label: 'Nuovo cliente', path: '/customers', perm: 'crm.add_customer', icon: 'plus' },
  { label: 'Nuovo sito', path: '/sites', perm: 'crm.add_site', icon: 'plus' },
  { label: 'Nuovo contatto', path: '/contacts', perm: 'crm.add_contact', icon: 'plus' },
  { label: 'Nuovo inventario', path: '/inventory', perm: 'inventory.add_inventory', icon: 'plus' },
  { label: 'Nuovo contratto', path: '/contracts', perm: 'contracts.add_contract', icon: 'plus' },
  { label: 'Nuovo PO', path: '/purchase-orders', perm: 'purchaseorders.add_purchaseorderentry', icon: 'plus' },
]

const PER_GROUP = 5
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const matches = (text: string, q: string) => norm(text).includes(norm(q))

/**
 * Sezioni della palette: con la ricerca vuota ricerche recenti e azioni; mentre si scrive i risultati
 * del server raggruppati come la pagina Ricerca (al massimo 5 per gruppo), poi pagine e azioni che corrispondono.
 */
export function buildSections(opts: { q: string; results: SearchResult[]; pages: PalettePage[]; actions: PaletteAction[]; recent: string[] }): PaletteSection[] {
  const q = opts.q.trim()
  const actionItems = (list: PaletteAction[]) => list.map((a) => ({ key: `act:${a.path}`, icon: a.icon, title: a.label, path: a.path, state: { openCreate: true as const } }))
  if (!q) {
    const out: PaletteSection[] = []
    if (opts.recent.length) out.push({ label: 'Ricerche recenti', items: opts.recent.map((r) => ({ key: `rec:${r}`, icon: 'history', title: r, path: `/search?search=${encodeURIComponent(r)}`, recent: r })) })
    if (opts.actions.length) out.push({ label: 'Azioni', items: actionItems(opts.actions) })
    return out
  }
  const out: PaletteSection[] = []
  for (const g of GROUPS) {
    const items = opts.results.filter((r) => groupOf(r.kind) === g.key).slice(0, PER_GROUP).flatMap((r) => {
      const path = resultPath(r)
      return path ? [{ key: `${r.kind}:${r.id}`, icon: iconOf(r.kind), title: r.title, sub: r.subtitle ?? undefined, path }] : []
    })
    if (items.length) out.push({ label: g.label, items })
  }
  const pages = opts.pages.filter((p) => matches(p.label, q) || (p.parent && matches(`${p.parent} ${p.label}`, q))).slice(0, PER_GROUP)
  if (pages.length) out.push({ label: 'Pagine', items: pages.map((p) => ({ key: `page:${p.path}`, icon: 'arrowR' as const, title: p.parent ? `${p.parent} › ${p.label}` : p.label, path: p.path })) })
  const acts = opts.actions.filter((a) => matches(a.label, q))
  if (acts.length) out.push({ label: 'Azioni', items: actionItems(acts) })
  return out
}
