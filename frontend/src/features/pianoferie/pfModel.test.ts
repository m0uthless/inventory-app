import { describe, expect, it } from 'vitest'
import { buildOffCalendar, covLevel, groupRequests, indexCells, presentCount, rangeLabel, requestCoverage, workDates, type PfRow } from './pfModel'
import type { RosterRow } from './pianoFerieShared'

let seq = 1
const row = (user: number, date: string, day_part: 'mattina' | 'pomeriggio', extra: Partial<PfRow> = {}): PfRow => ({
  id: seq++, user, user_name: `U${user}`, date, day_part, day_part_label: '', reason: 'ferie', reason_label: '',
  status: 'validata', status_label: '', note: '', time_from: null, time_to: null, is_hourly: false,
  request_group: null, validated_by: null, validated_by_name: null, validated_at: null, ...extra,
})
const both = (user: number, date: string, extra: Partial<PfRow> = {}) => [row(user, date, 'mattina', extra), row(user, date, 'pomeriggio', extra)]

// novembre 2026: 7-8 weekend, 1 Ognissanti (domenica)
const cal = buildOffCalendar([{ id: 1, date: '2026-11-09', label: 'Patrono', area_ids: [2] }])
const offFor = (iso: string) => cal.isOff(iso, null)

describe('groupRequests', () => {
  it('unisce le righe dello stesso request_group in una richiesta', () => {
    const rows = [...both(1, '2026-11-05', { request_group: 'g1' }), ...both(1, '2026-11-06', { request_group: 'g1' })]
    const [r, ...rest] = groupRequests(rows, offFor)
    expect(rest).toHaveLength(0)
    expect(r).toMatchObject({ from: '2026-11-05', to: '2026-11-06', part: 'all', days: 2 })
  })

  it('separa una richiesta validata solo in parte', () => {
    const rows = [...both(1, '2026-11-05', { request_group: 'g1' }), ...both(1, '2026-11-06', { request_group: 'g1', status: 'proposta' })]
    expect(groupRequests(rows, offFor).map((r) => r.status).sort()).toEqual(['proposta', 'validata'])
  })

  it('senza gruppo unisce i giorni contigui scavalcando il weekend', () => {
    const rows = [...both(1, '2026-11-06'), ...both(1, '2026-11-09'), ...both(1, '2026-11-11')]
    const reqs = groupRequests(rows, offFor)
    expect(reqs.map((r) => [r.from, r.to])).toEqual([['2026-11-06', '2026-11-09'], ['2026-11-11', '2026-11-11']])
  })

  it('riconosce mattina, pomeriggio e fascia mista', () => {
    expect(groupRequests([row(1, '2026-11-05', 'mattina', { request_group: 'a' })], offFor)[0].part).toBe('mat')
    expect(groupRequests([row(1, '2026-11-05', 'pomeriggio', { request_group: 'b' })], offFor)[0].part).toBe('pom')
    const mixed = [row(1, '2026-11-05', 'mattina', { request_group: 'c' }), ...both(1, '2026-11-06', { request_group: 'c' })]
    expect(groupRequests(mixed, offFor)[0]).toMatchObject({ part: 'mixed', days: 1.5 })
  })
})

describe('calendario e copertura', () => {
  it('conta i giorni lavorativi con le festività dell\'area', () => {
    expect(workDates('2026-11-06', '2026-11-10', null, cal)).toEqual(['2026-11-06', '2026-11-09', '2026-11-10'])
    expect(workDates('2026-11-06', '2026-11-10', 2, cal)).toEqual(['2026-11-06', '2026-11-10'])
    expect(workDates('2026-11-10', '2026-11-06', null, cal)).toEqual([])
  })

  it('soglie 60/80%', () => {
    expect(covLevel(5, 5)).toBe('ok')
    expect(covLevel(4, 5)).toBe('ok')
    expect(covLevel(3, 5)).toBe('mid')
    expect(covLevel(2, 5)).toBe('low')
  })

  it('le mezze giornate e le rifiutate non tolgono presenti; la copertura esclude chi chiede', () => {
    const people: RosterRow[] = [1, 2, 3, 4, 5].map((id) => ({ id, name: `U${id}`, area_id: 1, area_label: 'A', area_sort: 1 }))
    const cells = indexCells([
      ...both(2, '2026-11-05'),
      row(3, '2026-11-05', 'mattina'),
      ...both(4, '2026-11-05', { status: 'rifiutata' }),
      ...both(5, '2026-11-05'),
    ])
    expect(presentCount(people, '2026-11-05', cells)).toBe(3)
    const req = groupRequests(both(1, '2026-11-05', { request_group: 'x', status: 'proposta' }), offFor)[0]
    expect(requestCoverage(req, people, cells, 1, cal)).toEqual([{ day: '2026-11-05', present: 2, total: 5, level: 'low' }])
  })

  it('etichette degli intervalli', () => {
    expect(rangeLabel('2026-11-16', '2026-11-20')).toBe('16–20 nov')
    expect(rangeLabel('2026-11-30', '2026-11-30')).toBe('30 nov')
    expect(rangeLabel('2026-11-28', '2026-12-03')).toBe('28 nov – 3 dic')
  })
})
