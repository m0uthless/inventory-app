import { describe, expect, it } from 'vitest'
import { parseAmount } from './contractModel'

describe('parseAmount', () => {
  it('legge il formato del server, con il punto decimale', () => {
    expect(parseAmount('66250.00')).toBe(66250)
    expect(parseAmount('1333.33')).toBe(1333.33)
  })
  it('legge il formato italiano, con la virgola decimale e il punto delle migliaia', () => {
    expect(parseAmount('66.250,00')).toBe(66250)
    expect(parseAmount('66250,5')).toBe(66250.5)
    expect(parseAmount('€ 1.200,00')).toBe(1200)
  })
})
