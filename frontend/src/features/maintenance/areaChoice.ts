/** Scelta dell'area nelle pagine della Manutenzione (anteprima mt-base, interruttore delle aree). */
export type MtAreaChoice = 'all' | 'none' | number

/** Parametri per `/maintenance-plans/`, `todo/`, `todo-stats/`: `area=<id>` o `area=none`. */
export const mtAreaParams = (c: MtAreaChoice): Record<string, string | number> => (c === 'all' ? {} : { area: c })

/** Si parte dalla propria area se c'è, altrimenti da tutte (come le Issue). */
export const defaultMtArea = (myArea: number | null): MtAreaChoice => (myArea != null ? myArea : 'all')

const KEY = 'mt_area_choice'
export function readMtArea(): MtAreaChoice | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'all' || v === 'none') return v
    return v && /^\d+$/.test(v) ? Number(v) : null
  } catch { return null }
}
export function saveMtArea(c: MtAreaChoice) { try { localStorage.setItem(KEY, String(c)) } catch { /* solo in memoria */ } }
