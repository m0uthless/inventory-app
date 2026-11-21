import { describe, expect, it } from 'vitest'
import { amountSummary, eurFull } from './contractAmount'

describe('amountSummary', () => {
  it('trimestrale su 36 mesi: rate, numero fatture, maturato e prossima fattura', () => {
    const s = amountSummary(129600, 'trimestrale', '2025-03-01', '2028-02-29', '2026-11-21')
    expect(s.months).toBe(36)
    expect(s.perMonth).toBe(3600)
    expect(s.perYear).toBe(43200)
    expect(s.perBill).toBe(10800)
    expect(s.bills).toBe(12)
    expect(s.nextBill).toBe('2026-12-01')
    expect(Math.round(s.elapsed * 100)).toBe(58)
  })
  it('una tantum: una fattura, all\'inizio', () => {
    const s = amountSummary(18400, 'una_tantum', '2026-06-01', '2027-05-31', '2026-11-21')
    expect([s.bills, s.perBill, s.nextBill]).toEqual([1, 18400, null])
    expect(amountSummary(18400, 'una_tantum', '2027-01-01', '2027-12-31', '2026-11-21').nextBill).toBe('2027-01-01')
  })
  it('contratto finito: maturato 100% e nessuna prossima fattura', () => {
    const s = amountSummary(58000, 'annuale', '2025-09-14', '2026-11-08', '2026-11-21')
    expect(s.elapsed).toBe(1)
    expect(s.nextBill).toBeNull()
  })
  it('non ancora iniziato: maturato 0', () => {
    expect(amountSummary(1000, 'mensile', '2027-01-01', '2027-12-31', '2026-11-21').elapsed).toBe(0)
  })
})

describe('eurFull', () => {
  it('separatore delle migliaia anche sotto 10.000', () => {
    expect(eurFull(4142.857)).toBe('4.142,86 €')
    expect(eurFull(129600)).toBe('129.600,00 €')
  })
})
