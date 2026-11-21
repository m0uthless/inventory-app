import { describe, expect, it } from 'vitest'
import { durationFromDates, emptyForm, endOf, invoiceCount, nextCode, parseMoney, toPayload, validate } from './contractForm'

describe('contractForm', () => {
  it('calcola la fine dalla durata (inizio + N mesi − 1 giorno)', () => {
    expect(endOf({ start_date: '2026-12-01', duration: 12, end_date: '' })).toBe('2027-11-30')
    expect(endOf({ start_date: '2026-01-15', duration: 36, end_date: '' })).toBe('2029-01-14')
    expect(endOf({ start_date: '2026-01-15', duration: 0, end_date: '2026-06-30' })).toBe('2026-06-30')
  })

  it('riconosce una durata tonda dalle date, altrimenti fine a mano', () => {
    expect(durationFromDates('2025-11-15', '2028-11-14')).toBe(36)
    expect(durationFromDates('2025-11-15', '2026-11-30')).toBe(0)
  })

  it("propone il codice successivo dell'anno mantenendo prefisso e cifre", () => {
    expect(nextCode('DEMO-2026-020', 2026)).toBe('DEMO-2026-021')
    expect(nextCode('CTR-2026-099', 2026)).toBe('CTR-2026-100')
    expect(nextCode('CTR-2025-010', 2026)).toBe('CTR-2026-001')
    expect(nextCode(null, 2026)).toBe('CTR-2026-001')
  })

  it('legge importi all’italiana o col punto', () => {
    expect(parseMoney('48.000,50')).toBe(48000.5)
    expect(parseMoney('48000.50')).toBe(48000.5)
    expect(parseMoney('36.000')).toBe(36000)
    expect(parseMoney('1.250.000')).toBe(1250000)
    expect(parseMoney('57250.00')).toBe(57250)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNaN()
  })

  it('conta le fatture per frequenza', () => {
    expect(invoiceCount('mensile', 24)).toBe(24)
    expect(invoiceCount('trimestrale', 12)).toBe(4)
    expect(invoiceCount('annuale', 30)).toBe(3)
    expect(invoiceCount('una_tantum', 36)).toBe(1)
  })

  it('controlla solo i campi del passo richiesto', () => {
    const f = { ...emptyForm(null), code: 'C-1' }
    expect(Object.keys(validate(f, '', true, ['customer', 'contract_type']))).toEqual(['customer', 'contract_type'])
    expect(validate({ ...f, customer: 3, contract_type: 'licenza' }, 'Licenza — X', true)).toEqual({})
    expect(validate({ ...f, customer: 3, contract_type: 'licenza', duration: 0, end_date: '2020-01-01' }, 'T', true).end_date).toBeTruthy()
  })

  it('invia la fine calcolata e il valore solo con il permesso', () => {
    const f = { ...emptyForm(5), code: 'C-1', contract_type: 'assistenza' as const, start_date: '2026-12-01', duration: 24, total_value: '1.200,00' }
    const withValue = toPayload(f, 'Assistenza — X', true)
    expect(withValue.end_date).toBe('2028-11-30')
    expect(withValue.total_value).toBe('1200.00')
    expect('total_value' in toPayload(f, 'Assistenza — X', false)).toBe(false)
  })

  it('avviso di rinnovo: predefinito dalle Impostazioni, tra 1 e 365 giorni', () => {
    expect(emptyForm(null).reminder_days).toBe(90)
    expect(emptyForm(null, 60).reminder_days).toBe(60)
    const ok = { ...emptyForm(3), code: 'C-1', contract_type: 'licenza' as const }
    expect(validate({ ...ok, reminder_days: 0 }, 'T', true).reminder_days).toBe("L'avviso va da 1 a 365 giorni prima della fine.")
    expect(validate({ ...ok, reminder_days: 366 }, 'T', true).reminder_days).toBeTruthy()
    expect(validate({ ...ok, reminder_days: 365 }, 'T', true).reminder_days).toBeUndefined()
  })

  it('il payload porta reminder_days e niente disdetta né rinnovo automatico', () => {
    const p = toPayload({ ...emptyForm(5, 30), code: 'C-1', contract_type: 'assistenza' as const }, 'T', false)
    expect(p.reminder_days).toBe(30)
    expect('notice_days' in p || 'auto_renew' in p).toBe(false)
  })
})
