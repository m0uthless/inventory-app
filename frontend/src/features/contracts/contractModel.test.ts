import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EXPIRY_TONE, STATUS_TONE, expiryHint, periodMarks } from './contractModel'
import { CONTRACT_STATUS_OPTIONS, EXPIRY_CHIP } from './types'

describe('contractModel · senza disdetta', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-20T10:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  it('stati di scadenza: In corso, Da rinnovare, Scaduto', () => {
    expect(Object.keys(EXPIRY_TONE).sort()).toEqual(['expired', 'none', 'ok', 'renew'])
    expect(EXPIRY_TONE.renew).toEqual({ label: 'Da rinnovare', tone: 'warning' })
    expect(EXPIRY_CHIP.renew.label).toBe('Da rinnovare')
  })

  it('stato «Chiuso» al posto di «Disdetto»', () => {
    expect(CONTRACT_STATUS_OPTIONS.map((o) => o.label)).toEqual(['Bozza', 'Attivo', 'Chiuso'])
    expect(STATUS_TONE.chiuso).toBe('neutral')
  })

  it('le frasi parlano di avviso di rinnovo e promemoria', () => {
    expect(expiryHint('renew', '2026-12-31', '2026-11-01', '2026-11-21')).toBe('È il momento di preparare il nuovo contratto. Prossimo promemoria domani (21 nov 2026).')
    expect(expiryHint('renew', '2026-12-31', '2026-11-01', null)).toBe('È il momento di preparare il nuovo contratto.')
    expect(expiryHint('ok', '2027-03-31', '2026-12-31', null)).toBe("L'avviso di rinnovo parte il 31 dic 2026 (tra 41 giorni).")
    expect(expiryHint('expired', '2026-10-31', '2026-09-01', null)).toBe('Finito il 31 ott 2026: i promemoria sono finiti. Rinnovalo o segnalo come chiuso.')
    expect(expiryHint('none', '2026-10-31', null, null)).toBe('Contratto non attivo: non manda promemoria.')
  })

  it('nessuna frase cita la disdetta o il preavviso', () => {
    const all = (['ok', 'renew', 'expired', 'none'] as const).map((s) => expiryHint(s, '2026-12-31', '2026-11-01', '2026-11-21')).join(' ')
    expect(all.toLowerCase()).not.toMatch(/disdett|preavviso/)
  })

  it('periodMarks dà la posizione dell\'avviso di rinnovo', () => {
    const m = periodMarks('2026-01-01', '2026-12-31', '2026-11-01')
    expect(m.reminder).toBeGreaterThan(0.8)
    expect(m.reminder).toBeLessThan(0.9)
  })
})
