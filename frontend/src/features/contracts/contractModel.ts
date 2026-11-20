import type { ContractStatus, ExpiryState } from './types'

const DAY = 86_400_000
const toDay = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) }
const today = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) }

/** Giorni da oggi alla data (negativo se passata). */
export const daysTo = (iso: string) => Math.round((toDay(iso) - today()) / DAY)

/** "tra 12 giorni", "oggi", "3 giorni fa". */
export function daysLabel(iso: string) {
  const n = daysTo(iso)
  if (n === 0) return 'oggi'
  if (n === 1) return 'domani'
  if (n === -1) return 'ieri'
  if (n > 0) return n > 60 ? `tra ${Math.round(n / 30)} mesi` : `tra ${n} giorni`
  return -n > 60 ? `${Math.round(-n / 30)} mesi fa` : `${-n} giorni fa`
}

/** Data breve: "12 mar 2026". */
export const dShort = (iso?: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/** Posizioni (0–1) dell'avviso di rinnovo e di oggi lungo il periodo del contratto. */
export function periodMarks(start: string, end: string, reminder: string | null) {
  const s = toDay(start), e = toDay(end)
  const span = Math.max(1, e - s)
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    today: clamp((today() - s) / span),
    reminder: reminder ? clamp((toDay(reminder) - s) / span) : null,
    started: today() >= s,
    ended: today() > e,
  }
}

export type Tone = 'success' | 'warning' | 'error' | 'neutral'
export const EXPIRY_TONE: Record<ExpiryState, { label: string; tone: Tone }> = {
  none: { label: '—', tone: 'neutral' },
  ok: { label: 'In corso', tone: 'success' },
  renew: { label: 'Da rinnovare', tone: 'warning' },
  expired: { label: 'Scaduto', tone: 'error' },
}
export const STATUS_TONE: Record<ContractStatus, Tone> = { bozza: 'neutral', attivo: 'success', chiuso: 'neutral' }

/** Spiegazione dello stato di scadenza, per tooltip e scheda: avviso di rinnovo e promemoria. */
export function expiryHint(state: ExpiryState, end: string, reminder: string | null, nextReminder?: string | null) {
  switch (state) {
    case 'expired': return `Finito il ${dShort(end)}: i promemoria sono finiti. Rinnovalo o segnalo come chiuso.`
    case 'renew': return `È il momento di preparare il nuovo contratto.${nextReminder ? ` Prossimo promemoria ${daysLabel(nextReminder)} (${dShort(nextReminder)}).` : ''}`
    case 'ok': return reminder ? `L'avviso di rinnovo parte il ${dShort(reminder)} (${daysLabel(reminder)}).` : 'In corso.'
    default: return 'Contratto non attivo: non manda promemoria.'
  }
}

/**
 * Importo scritto a mano: «66.250,00» o «66250,00» (italiano) oppure «66250.00» (come arriva dal server).
 * Con la virgola il punto separa le migliaia; senza virgola il punto è il decimale.
 */
export const parseAmount = (raw: string) => {
  const t = raw.trim().replace(/\s|€/g, '')
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}
