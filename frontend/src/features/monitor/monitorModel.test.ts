import { describe, expect, it } from 'vitest'
import { EMPTY_FORM, monitorTitle, setFormField, viewCount, viewParams, wsWhere } from './monitorModel'

describe('monitorModel', () => {
  it('viewParams', () => {
    expect(viewParams('all')).toEqual({})
    expect(viewParams('free')).toEqual({ inventory__isnull: 'true' })
    expect(viewParams('guasto')).toEqual({ stato: 'guasto' })
  })
  it('viewCount', () => {
    const s = { total: 5, unassigned: 2, by_stato: { in_uso: 2, da_installare: 1, guasto: 1, rma: 1 } }
    expect(viewCount('all', s)).toBe(5)
    expect(viewCount('free', s)).toBe(2)
    expect(viewCount('guasto', s)).toBe(1)
    expect(viewCount('all', null)).toBeNull()
  })
  it('labels', () => {
    expect(monitorTitle({ produttore: 'Eizo', modello: 'RX660' })).toBe('Eizo RX660')
    expect(monitorTitle({ produttore: 'Eizo', modello: null })).toBe('Eizo')
    expect(wsWhere({ customer_name: 'AUSL Bologna', site_name: 'Porretta' })).toBe('AUSL Bologna · Porretta')
  })
  it('radinet si spegne per i monitor amministrativi', () => {
    const f = setFormField({ ...EMPTY_FORM, radinet: true }, 'tipo', 'amministrativo')
    expect(f.radinet).toBe(false)
    expect(setFormField({ ...EMPTY_FORM, radinet: true }, 'tipo', 'diagnostico').radinet).toBe(true)
  })
})
