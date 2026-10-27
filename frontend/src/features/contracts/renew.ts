/**
 * Proposta di rinnovo manuale di un contratto.
 *
 * Aritmetica pura su date ISO (`YYYY-MM-DD`): nessun uso di `Date`, quindi
 * nessun effetto del fuso orario locale.
 *
 * - nuova `start_date` = `end + 1 giorno` (nessun buco, nessuna sovrapposizione);
 * - nuova `end_date`   = nuova start + stessa durata in mesi interi − 1 giorno,
 *   con clamp a fine mese (31 gen + 1 mese → 28/29 feb).
 * Se il periodo originale è più corto di un mese, si mantiene la durata in giorni.
 */

type Ymd = { y: number; m: number; d: number }

function parse(iso: string): Ymd {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Data non valida: ${iso}`)
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function fmt({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

function cmp(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

function addDays(date: Ymd, n: number): Ymd {
  let { y, m, d } = date
  d += n
  while (d > daysInMonth(y, m)) {
    d -= daysInMonth(y, m)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  while (d < 1) {
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
    d += daysInMonth(y, m)
  }
  return { y, m, d }
}

/** Aggiunge `n` mesi con clamp all'ultimo giorno del mese di arrivo. */
function addMonths(date: Ymd, n: number): Ymd {
  const total = date.y * 12 + (date.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) }
}

/** Numero di giorni da `a` a `b` (b ≥ a). */
function daysBetween(a: Ymd, b: Ymd): number {
  let n = 0
  let cur = a
  // Salti per mese finché possibile, poi giorno per giorno.
  while (cur.y * 12 + cur.m < b.y * 12 + b.m) {
    n += daysInMonth(cur.y, cur.m) - cur.d + 1
    cur = cur.m === 12 ? { y: cur.y + 1, m: 1, d: 1 } : { y: cur.y, m: cur.m + 1, d: 1 }
  }
  return n + (b.d - cur.d)
}

export function proposeRenewal(start: string, end: string): { start_date: string; end_date: string } {
  const s = parse(start)
  const e = parse(end)
  const endNext = addDays(e, 1)

  // Mesi interi: il massimo m tale che start + m mesi ≤ end + 1 giorno.
  let months = (endNext.y - s.y) * 12 + (endNext.m - s.m)
  while (months > 0 && cmp(addMonths(s, months), endNext) > 0) months -= 1

  const newStart = endNext
  if (months <= 0) {
    // Periodo inferiore al mese: stessa durata in giorni.
    const days = Math.max(daysBetween(s, e), 0)
    return { start_date: fmt(newStart), end_date: fmt(addDays(newStart, days)) }
  }
  return { start_date: fmt(newStart), end_date: fmt(addDays(addMonths(newStart, months), -1)) }
}
