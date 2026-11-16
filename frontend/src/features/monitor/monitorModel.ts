export type MonitorStato = 'in_uso' | 'da_installare' | 'guasto' | 'rma'
export type MonitorTipo = 'diagnostico' | 'amministrativo'

export type MonitorRow = {
  id: number
  inventory: number | null
  inventory_name: string | null
  site_name: string | null
  customer_name?: string | null
  produttore: string
  modello: string | null
  seriale: string | null
  stato: MonitorStato
  stato_label: string
  tipo: MonitorTipo
  tipo_label: string
  radinet: boolean
  created_at?: string | null
  updated_at: string | null
  deleted_at: string | null
}

export type MonitorStats = { total: number; by_stato: Record<MonitorStato, number>; unassigned: number }

export type MonitorForm = {
  inventory: number | null
  produttore: string
  modello: string
  seriale: string
  stato: MonitorStato
  tipo: MonitorTipo
  radinet: boolean
}

export const EMPTY_FORM: MonitorForm = { inventory: null, produttore: 'Eizo', modello: '', seriale: '', stato: 'da_installare', tipo: 'diagnostico', radinet: false }

export const STATO_META: Record<MonitorStato, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  in_uso: { label: 'In uso', tone: 'success' },
  da_installare: { label: 'Da installare', tone: 'warning' },
  guasto: { label: 'Guasto', tone: 'error' },
  rma: { label: 'RMA', tone: 'neutral' },
}
export const STATI = Object.keys(STATO_META) as MonitorStato[]
export const TIPO_LABEL: Record<MonitorTipo, string> = { diagnostico: 'Diagnostico', amministrativo: 'Amministrativo' }

export type MonitorView = 'all' | MonitorStato | 'free'
export const VIEWS: { key: MonitorView; label: string; alert?: boolean }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'in_uso', label: 'In uso' },
  { key: 'da_installare', label: 'Da installare' },
  { key: 'guasto', label: 'Guasti', alert: true },
  { key: 'rma', label: 'In RMA' },
  { key: 'free', label: 'Senza workstation' },
]

/** Parametri della lista per la vista scelta. */
export const viewParams = (v: MonitorView): Record<string, string> =>
  v === 'all' ? {} : v === 'free' ? { inventory__isnull: 'true' } : { stato: v }

export const viewCount = (v: MonitorView, s: MonitorStats | null): number | null =>
  !s ? null : v === 'all' ? s.total : v === 'free' ? s.unassigned : s.by_stato[v] ?? 0

export const monitorTitle = (m: Pick<MonitorRow, 'produttore' | 'modello'>) => [m.produttore, m.modello].filter(Boolean).join(' ') || 'Monitor'

/** Dove sta la workstation: cliente · sito. */
export const wsWhere = (m: Pick<MonitorRow, 'customer_name' | 'site_name'>) => [m.customer_name, m.site_name].filter(Boolean).join(' · ')

export const formFrom = (m: MonitorRow | null): MonitorForm =>
  m ? { inventory: m.inventory, produttore: m.produttore, modello: m.modello ?? '', seriale: m.seriale ?? '', stato: m.stato, tipo: m.tipo, radinet: m.radinet } : { ...EMPTY_FORM }

/** Radinet vale solo per i diagnostici: cambiando tipo si spegne. */
export const setFormField = <K extends keyof MonitorForm>(f: MonitorForm, k: K, v: MonitorForm[K]): MonitorForm => {
  const next = { ...f, [k]: v }
  if (k === 'tipo' && v !== 'diagnostico') next.radinet = false
  return next
}

/** Valori da copiare (seriali): Geist Mono, come da DESIGN.md. */
export const MONO = { fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 12 } as const
