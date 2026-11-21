import { describe, expect, it } from 'vitest'
import { fmtEuro, fmtNumber } from '@shared/utils/number'
import { formatEuro } from '../features/purchaseorders/types'
import { formatEuro as formatExpense } from '../features/expenses/expensesShared'
import { eur0 } from '../features/contracts/contractValue'

describe('separatore delle migliaia sempre presente', () => {
  it('helper condivisi', () => {
    expect(fmtNumber(1250)).toBe('1.250')
    expect(fmtNumber(12.5, { minimumFractionDigits: 1 })).toBe('12,5')
    expect(fmtEuro(4142.857)).toBe('4.142,86 €')
    expect(fmtEuro(129600)).toBe('129.600,00 €')
  })
  it('i formattatori degli importi dell\'app', () => {
    expect(formatEuro(4142.86)).toBe('4.142,86 €')
    expect(formatEuro('3500')).toBe('3.500,00 €')
    expect(formatExpense(1234.5)).toBe('1.234,50 €')
    expect(eur0(4500)).toMatch(/^4\.500\s€$/)
  })
})
