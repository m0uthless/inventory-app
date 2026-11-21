import { describe, expect, it } from 'vitest'
import { byRegion, share, sumValue, toCustomerValues } from './contractValue'

const rows = [
  { customer_id: 1, customer_name: 'AUSL Romagna', province: 'RA', value: '400.00', contracts: 2 },
  { customer_id: 2, customer_name: 'Senza prov', province: null, value: '900.00', contracts: 1 },
  { customer_id: 3, customer_name: 'Friuli', province: 'ud', value: '300.00', contracts: 1 },
  { customer_id: 4, customer_name: 'Ferrara', province: 'FE', value: '200.00', contracts: 1 },
]

describe('contractValue', () => {
  it('ricava la regione dalla provincia e ordina per valore', () => {
    const l = toCustomerValues(rows)
    expect(l.map((c) => c.id)).toEqual([2, 1, 3, 4])
    expect(l.find((c) => c.id === 3)?.region).toBe('FVG')
    expect(l.find((c) => c.id === 2)?.region).toBeNull()
  })
  it('raggruppa per regione con «Senza regione» in fondo anche se vale di più', () => {
    const g = byRegion(toCustomerValues(rows))
    expect(g.map((r) => [r.name, r.value, r.customers])).toEqual([['Emilia-Romagna', 600, 2], ['Friuli-Venezia Giulia', 300, 1], ['Senza regione', 900, 1]])
  })
  it('totale e quota', () => {
    expect(sumValue(toCustomerValues(rows))).toBe(1800)
    expect(share(600, 1800)).toBe(33)
    expect(share(1, 0)).toBe(0)
  })
})
