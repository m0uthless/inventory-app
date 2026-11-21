import { describe, expect, it } from 'vitest'
import { agoLabel, groupByKind, purgeBlockText, resourceOf, toRow } from './trashModel'

describe('trashModel', () => {
  const now = new Date(2026, 10, 8, 10, 30)

  it('agoLabel', () => {
    expect(agoLabel(new Date(2026, 10, 8, 9, 12).toISOString(), now)).toBe('oggi 09:12')
    expect(agoLabel(new Date(2026, 10, 7, 18, 0).toISOString(), now)).toBe('ieri')
    expect(agoLabel(new Date(2026, 10, 3, 8, 0).toISOString(), now)).toBe('5 giorni fa')
    expect(agoLabel(new Date(2026, 8, 15, 8, 0).toISOString(), now)).toBe('15 set')
    expect(agoLabel(new Date(2025, 8, 15, 8, 0).toISOString(), now)).toBe('15 set 2025')
    expect(agoLabel(null, now)).toBe('—')
  })

  it('toRow builds title and context per kind', () => {
    expect(toRow('sites', { id: 3, name: 'HQ', customer_name: 'Acme', city: 'Bologna', deleted_at: 'x' })).toMatchObject({ rid: 'sites:3', title: 'HQ', sub: 'Acme · Bologna' })
    expect(toRow('monitors', { id: 1, produttore: 'Eizo', modello: 'RX660', seriale: '123' })?.title).toBe('Eizo RX660')
    expect(toRow('monitors', { id: 1, produttore: 'Eizo', modello: 'RX660', seriale: '123' })?.sub).toBe('S/N 123')
    expect(toRow('techs', { id: 'x' })).toBeNull()
  })

  it('purgeBlockText and groupByKind', () => {
    expect(purgeBlockText([{ label: 'inventari', count: 3 }, { label: 'siti', count: 0 }, { label: 'contatti', count: 1 }])).toBe('3 inventari, 1 contatto')
    expect(purgeBlockText(undefined)).toBe('')
    expect(groupByKind([{ kind: 'sites', id: 1 }, { kind: 'customers', id: 2 }, { kind: 'sites', id: 4 }])).toEqual({ sites: [1, 4], customers: [2] })
  })

  it('PO, contratti e issue nel Cestino; solo i contratti si eliminano definitivamente', () => {
    expect(toRow('purchase-orders', { id: 4, description: 'Offerta RIS', client_name: 'AUSL Imola', purchase_order: 'PO-77' })).toMatchObject({ title: 'Offerta RIS', sub: 'AUSL Imola · PO-77' })
    expect(toRow('contracts', { id: 5, code: 'CT-2025-010', title: 'Noleggio', customer_name: 'Villa Arcoveggio' })).toMatchObject({ title: 'CT-2025-010 · Noleggio', sub: 'Villa Arcoveggio' })
    expect(toRow('issues', { id: 6, title: 'Worklist vuota', customer_name: 'AUSL', site_name: 'Marecchia' })).toMatchObject({ title: '#6 Worklist vuota', sub: 'AUSL · Marecchia' })
    expect(resourceOf('contracts').purgePerm).toBe('contracts.delete_contract')
    expect(resourceOf('purchase-orders').purgePerm).toBeNull()
    expect(resourceOf('issues').purgePerm).toBeNull()
  })
})
