import { describe, expect, it } from 'vitest'
import { firstName, formatOpenedAt, initialsOf, periodTotals, taskPrefillFromCase, typeColor, type StatsResponse } from './snModel'

describe('snModel', () => {
  it('formatOpenedAt', () => {
    expect(formatOpenedAt({ opened_date: null, opened_time: null })).toBeNull()
    expect(formatOpenedAt({ opened_date: '2026-11-09', opened_time: '10:12:00' })).toMatch(/09\/11\/2026 · 10:12/)
  })
  it('periodTotals sums series and types', () => {
    const d = {
      granularity: 'month', year: 2026, periods: [{ key: 1, label: 'Gen' }, { key: 2, label: 'Feb' }],
      series: [
        { user_id: 1, name: 'A', counts: [2, 1], type_totals_by_period: [{ L1: 2 }, { CDD: 1 }] },
        { user_id: 2, name: 'B', counts: [3, 0], type_totals_by_period: [{ L1: 1, CDD: 2 }, {}] },
      ],
      kpi: { total: 6, top_technician: null, top_type: null }, type_breakdown: [],
    } as StatsResponse
    expect(periodTotals(d)).toEqual([{ total: 5, byType: { L1: 3, CDD: 2 } }, { total: 1, byType: { CDD: 1 } }])
  })
  it('colors follow the type order, not the rank', () => {
    expect(typeColor(['L1', 'PRIVATI', 'CDD'], 'CDD', false)).toBe('#1baf7a')
    expect(typeColor(['L1'], 'X', false)).toBe('#9aa3ae')
  })
  it('names and task prefill', () => {
    expect(firstName('Nicole Spazzoli')).toBe('Nicole')
    expect(initialsOf('Luca Della Zazzera')).toBe('LZ')
    expect(initialsOf('Archie (root)')).toBe('AR')
    expect(taskPrefillFromCase({ number: 'CS1', account: 'AUSL', short_description: '' })).toEqual({ title: 'Caso ServiceNow CS1', description: 'Caso ServiceNow CS1 · AUSL' })
  })
})
