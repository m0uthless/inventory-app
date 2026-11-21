// Modello della Nota spese (restyle "Campo sterile", anteprima design-previews/ns-base.html).
import { CATEGORY_ORDER, type ExpenseCategory, type ExpenseItemRow, type ExpenseReportRow, type ExpenseReportStatus } from './expensesShared'
import { fmtNumber } from '@shared/utils/number'

export const MONTHS_LC = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const toNum = (v: string | number | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** "36,50" / "1.036,50" / "36.5" / "€ 12" → numero (2 decimali). Vuoto → 0. Non valido → null. */
export function parseEuroInput(s: string): number | null {
  const t = s.trim().replace(/\s|€/g, '')
  if (!t) return 0
  const norm = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null
  return Math.round(Number(norm) * 100) / 100
}

/** Valore per un campo importo: vuoto se zero. */
export const amountInput = (v: string | number | null | undefined) => {
  const n = toNum(v)
  return n ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
}

export const rateLabel = (rate: string | null | undefined) =>
  rate == null ? null : `${fmtNumber(toNum(rate), { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/km`

export const sortedItems = (r: Pick<ExpenseReportRow, 'items'>) =>
  [...r.items].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))

export const kmItemOf = (r: Pick<ExpenseReportRow, 'items'>) => r.items.find((i) => i.is_km_category) ?? null
export const kmTotal = (r: Pick<ExpenseReportRow, 'items'>) => (kmItemOf(r)?.km_trips ?? []).reduce((s, t) => s + t.km, 0)
export const tripCount = (r: Pick<ExpenseReportRow, 'items'>) => kmItemOf(r)?.km_trips.length ?? 0

/** Voci con un importo (il rimborso km conta se ha trasferte). */
export const filledItems = (r: Pick<ExpenseReportRow, 'items'>) =>
  sortedItems(r).filter((i) => (i.is_km_category ? i.km_trips.length > 0 || toNum(i.amount) > 0 : toNum(i.amount) > 0))

/** Voci con importo ma senza scontrino (il rimborso km non ne ha bisogno). */
export const missingReceipts = (r: Pick<ExpenseReportRow, 'items'>): ExpenseItemRow[] =>
  sortedItems(r).filter((i) => !i.is_km_category && toNum(i.amount) > 0 && i.receipts.length === 0)

export const reportNumber = (r: Pick<ExpenseReportRow, 'month' | 'year'>) =>
  `${String(r.month).padStart(2, '0')}/${String(r.year % 100).padStart(2, '0')}`

export const monthTitle = (r: Pick<ExpenseReportRow, 'month' | 'year'>) => `${cap(MONTHS_LC[r.month] ?? '')} ${r.year}`

export const STATUS_TONE: Record<ExpenseReportStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  bozza: 'neutral', inviata: 'info', validata: 'success', rifiutata: 'error',
}
/** Il dipendente vede "Inviata", la segreteria "Da validare". */
export const statusLabel = (s: ExpenseReportStatus, secretary: boolean) =>
  s === 'inviata' ? (secretary ? 'Da validare' : 'Inviata') : s === 'bozza' ? 'Bozza' : s === 'validata' ? 'Validata' : 'Rifiutata'

const DAY = 864e5
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
/** Giorni interi passati da una data/ora ISO (0 = oggi). */
export const daysSince = (iso: string, now: Date = new Date()) => Math.round((midnight(now) - midnight(new Date(iso))) / DAY)
export const agoLabel = (iso: string, now: Date = new Date()) => {
  const n = daysSince(iso, now)
  return n <= 0 ? 'oggi' : n === 1 ? 'ieri' : `${n} giorni fa`
}
export const dShort = (iso: string | null | undefined, year = false) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }) : '—'

/** Oltre questa attesa la nota inviata è segnata in rosso per la segreteria. */
export const LATE_DAYS = 14

/** Primo mese libero dell'anno partendo da quello indicato, all'indietro. */
export function firstFreeMonth(taken: Set<number>, from: number): number | null {
  for (let m = from; m >= 1; m--) if (!taken.has(m)) return m
  for (let m = 12; m > from; m--) if (!taken.has(m)) return m
  return null
}

/** Etichette brevi e note delle 12 categorie (le etichette lunghe del modello Excel restano nel PDF). */
export const CATEGORY_META: Record<ExpenseCategory, { label: string; hint?: string; color: string }> = {
  treni: { label: 'Treni, pullman', color: '#2f6fa8' },
  taxi_comune: { label: 'Taxi, bus, noleggio nel comune', color: '#6b8fc6' },
  taxi_fuori_comune: { label: 'Taxi, bus, noleggio fuori comune', color: '#8a6bb0' },
  autostrade: { label: 'Autostrade', color: '#3f8676' },
  rimborso_km: { label: 'Rimborso chilometraggio', hint: 'calcolato dalle trasferte', color: '#1f6b5c' },
  varie_automezzi: { label: 'Varie automezzi', hint: 'lavaggio, parcheggi, piccole manutenzioni fino a 50 €', color: '#c48a2c' },
  carburanti: { label: 'Carburanti e lubrificanti', color: '#9a5b00' },
  pernottamento: { label: 'Pernottamento', color: '#b07f9a' },
  pasti: { label: 'Pasti', hint: 'ristorante o bar', color: '#c2362b' },
  rappresentanza: { label: 'Spese di rappresentanza', color: '#5b6b67' },
  telefoniche: { label: 'Spese telefoniche', color: '#7fb3a5' },
  varie: { label: 'Varie', color: '#a3aea9' },
}
