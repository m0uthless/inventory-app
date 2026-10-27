import { describe, expect, it } from 'vitest'
import { proposeRenewal } from './renew'

describe('proposeRenewal', () => {
  it('rinnova un contratto annuale da inizio anno', () => {
    expect(proposeRenewal('2025-01-01', '2025-12-31')).toEqual({ start_date: '2026-01-01', end_date: '2026-12-31' })
  })

  it('mantiene la durata in mesi interi a cavallo d\'anno', () => {
    expect(proposeRenewal('2024-02-01', '2025-01-31')).toEqual({ start_date: '2025-02-01', end_date: '2026-01-31' })
  })

  it('rinnova un contratto trimestrale', () => {
    expect(proposeRenewal('2025-03-01', '2025-05-31')).toEqual({ start_date: '2025-06-01', end_date: '2025-08-31' })
  })

  it('gestisce gli anni bisestili', () => {
    expect(proposeRenewal('2024-03-01', '2028-02-29')).toEqual({ start_date: '2028-03-01', end_date: '2032-02-29' })
  })

  it('rinnovo da fine mese: non sfora e non salta giorni', () => {
    // 2025-01-31 → 2026-01-30 (12 mesi): nuovo periodo 2026-01-31 → 2027-01-30
    expect(proposeRenewal('2025-01-31', '2026-01-30')).toEqual({ start_date: '2026-01-31', end_date: '2027-01-30' })
    // fine a fine febbraio: nuova start 1 marzo
    expect(proposeRenewal('2025-03-01', '2026-02-28')).toEqual({ start_date: '2026-03-01', end_date: '2027-02-28' })
  })

  it('periodo inferiore al mese: mantiene la durata in giorni', () => {
    expect(proposeRenewal('2025-01-01', '2025-01-10')).toEqual({ start_date: '2025-01-11', end_date: '2025-01-20' })
  })
})
