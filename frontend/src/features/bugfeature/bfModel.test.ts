import { describe, expect, it } from 'vitest'
import { appendReason, closedBy, firstLine, firstName, initials, sectionLabel, type ReportRow } from './bfModel'

describe('bfModel', () => {
  it('firstLine skips empty lines', () => {
    expect(firstLine('\n  Il filtro non va\nDettagli')).toBe('Il filtro non va')
    expect(firstLine('')).toBe('—')
  })
  it('labels and names', () => {
    expect(sectionLabel('customers')).toBe('Clienti')
    expect(sectionLabel('xyz', 'Boh')).toBe('Boh')
    expect(initials('Nicole Spazzoli')).toBe('NS')
    expect(initials('Archie (root)')).toBe('AR')
    expect(initials('')).toBe('?')
    expect(firstName('Federico Mutuale')).toBe('Federico')
    expect(appendReason('', 'Già segnalato.')).toBe('Già segnalato.')
    expect(appendReason('Ok.', 'Già segnalato.')).toBe('Ok. Già segnalato.')
  })
  it('closedBy', () => {
    const base = { id: 1, kind: 'bug', section: 'x', section_label: 'x', description: '', created_at: '', updated_at: '' } as const
    expect(closedBy({ ...base, status: 'open' } as ReportRow)).toBeNull()
    expect(closedBy({ ...base, status: 'resolved', resolved_by_full_name: 'A', resolved_at: 't' } as ReportRow)).toEqual({ by: 'A', at: 't' })
    expect(closedBy({ ...base, status: 'rejected', rejected_by_full_name: 'B', rejected_at: 'u' } as ReportRow)).toEqual({ by: 'B', at: 'u' })
  })
})
