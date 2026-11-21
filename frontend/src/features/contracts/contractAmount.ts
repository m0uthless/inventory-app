import { addMonths, invoiceCount, monthsBetween } from './contractForm'
import type { BillingFrequency } from './types'
import { fmtEuro } from '@shared/utils/number'

const STEP: Record<BillingFrequency, number> = { una_tantum: 0, mensile: 1, trimestrale: 3, annuale: 12 }

export type AmountSummary = {
  months: number; perMonth: number; perYear: number; perBill: number; bills: number
  /** Quota del periodo già trascorsa, 0–1 (ripartizione lineare sul tempo). */
  elapsed: number
  /** Data stimata della prossima fattura (dall'inizio e dalla frequenza), se ce n'è ancora una. */
  nextBill: string | null
}

/** Numeri della card «Importo» del contratto. `today` in formato ISO (YYYY-MM-DD). */
export function amountSummary(value: number, freq: BillingFrequency, start: string, end: string, today: string): AmountSummary {
  const months = monthsBetween(start, end)
  const perMonth = value / months
  const step = STEP[freq] ?? 0
  const span = Date.parse(end) - Date.parse(start)
  const elapsed = span > 0 ? Math.min(1, Math.max(0, (Date.parse(today) - Date.parse(start)) / span)) : today >= end ? 1 : 0
  let nextBill: string | null = null
  if (!step) nextBill = start > today ? start : null
  else for (let i = 0; i < months; i += step) { const d = addMonths(start, i); if (d > today) { nextBill = d; break } }
  return { months, perMonth, perYear: perMonth * 12, perBill: step ? perMonth * step : value, bills: invoiceCount(freq, months), elapsed, nextBill }
}

/** Euro con due decimali e separatore delle migliaia anche sotto 10.000 («4.142,86 €»). */
export const eurFull = fmtEuro

/** Oggi in ora locale, formato ISO. */
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
