import { describe, expect, it } from 'vitest'
import { agoLabel, amountInput, daysSince, filledItems, firstFreeMonth, missingReceipts, parseEuroInput, rateLabel, reportNumber, statusLabel } from './nsModel'
import type { ExpenseItemRow } from './expensesShared'

const item = (p: Partial<ExpenseItemRow>): ExpenseItemRow => ({
  id: 1, report: 1, category: 'pasti', category_label: 'Pasti', is_km_category: false, date: null, description: '', amount: '0', km_trips: [], receipts: [], ...p,
})

describe('nsModel', () => {
  it('legge gli importi all\'italiana', () => {
    expect(parseEuroInput('36,50')).toBe(36.5)
    expect(parseEuroInput('1.036,50')).toBe(1036.5)
    expect(parseEuroInput('1.036')).toBe(1036)
    expect(parseEuroInput('12.5')).toBe(12.5)
    expect(parseEuroInput(' € 7 ')).toBe(7)
    expect(parseEuroInput('')).toBe(0)
    expect(parseEuroInput('dodici')).toBeNull()
  })

  it('formatta importi e tariffe', () => {
    expect(amountInput('0.00')).toBe('')
    expect(amountInput('38.6')).toBe('38,60')
    expect(rateLabel('0.420')).toBe('0,42 €/km')
    expect(rateLabel(null)).toBeNull()
    expect(reportNumber({ month: 3, year: 2026 })).toBe('03/26')
    expect(statusLabel('inviata', true)).toBe('Da validare')
    expect(statusLabel('inviata', false)).toBe('Inviata')
  })

  it('trova voci compilate e scontrini mancanti', () => {
    const r = {
      items: [
        item({ id: 1, category: 'pasti', amount: '20', receipts: [{ id: 9, item: 1, file_url: null, file_name: 'a.jpg', ocr_amount: null, ocr_date: null, created_at: '' }] }),
        item({ id: 2, category: 'varie_automezzi', amount: '7.5' }),
        item({ id: 3, category: 'rimborso_km', is_km_category: true, amount: '10', km_trips: [{ id: 1, item: 3, date: '2026-11-03', destination: 'Imola', km: 24 }] }),
        item({ id: 4, category: 'treni', amount: '0' }),
      ],
    }
    expect(filledItems(r).map((i) => i.id)).toEqual([3, 2, 1])
    expect(missingReceipts(r).map((i) => i.id)).toEqual([2])
  })

  it('conta i giorni e trova il mese libero', () => {
    const now = new Date(2026, 10, 7, 15)
    expect(daysSince('2026-11-07T08:00:00', now)).toBe(0)
    expect(agoLabel('2026-11-06T23:00:00', now)).toBe('ieri')
    expect(agoLabel('2026-10-02T10:00:00', now)).toBe('36 giorni fa')
    expect(firstFreeMonth(new Set([11, 10]), 11)).toBe(9)
    expect(firstFreeMonth(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 11)).toBe(12)
    expect(firstFreeMonth(new Set(Array.from({ length: 12 }, (_, i) => i + 1)), 11)).toBeNull()
  })
})
