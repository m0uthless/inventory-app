import { describe, expect, it } from 'vitest'
import { actorLabel, browserOf, changeEntries, entityLabel, fmtValue, isPrivateIp, objectTitle, periodStart, whenLabel, type AuditEvent } from './auditModel'

const ev = (p: Partial<AuditEvent>): AuditEvent => ({ id: 1, created_at: '2026-11-07T18:00:00Z', action: 'update', actor: 6, ...p })

describe('auditModel', () => {
  it('normalizza le forme di changes', () => {
    expect(changeEntries({ a: { from: 1, to: 2 }, b: ['x', null], c: 'prova.pdf' })).toEqual([
      { field: 'a', from: 1, to: 2, hasFrom: true },
      { field: 'b', from: 'x', to: null, hasFrom: true },
      { field: 'c', from: undefined, to: 'prova.pdf', hasFrom: false },
    ])
    expect(changeEntries(null)).toEqual([])
    expect(changeEntries(['a'])).toEqual([])
  })

  it('formatta i valori', () => {
    expect(fmtValue(null)).toBeNull()
    expect(fmtValue('')).toBeNull()
    expect(fmtValue([])).toBeNull()
    expect(fmtValue('device.Device.None')).toBeNull()
    expect(fmtValue(true)).toBe('Sì')
    expect(fmtValue(['a', 'b'])).toBe('a, b')
    expect(fmtValue('2026-12-31')).toBe('31/12/2026')
    expect(fmtValue(120)).toBe('120')
  })

  it('dà nomi a persone, oggetti e tipi', () => {
    expect(actorLabel(ev({ actor: null, action: 'create' }))).toEqual({ name: 'Sistema', kind: 'system' })
    expect(actorLabel(ev({ actor: null, action: 'login_failed', metadata_summary: { username: 'root' } })).name).toBe('«root»')
    expect(actorLabel(ev({ actor_name: 'Federico Mutuale' })).name).toBe('Federico Mutuale')
    expect(objectTitle(ev({ action: 'login_failed', object_repr: 'fede' }))).toBe('Accesso non riuscito per «fede»')
    expect(objectTitle(ev({ object_repr: 'AUSL Imola' }))).toBe('AUSL Imola')
    expect(entityLabel({ action: 'login', content_type_app: 'auth', content_type_model: 'user' })).toBe('Accessi')
    expect(entityLabel({ action: 'update', content_type_app: 'auth', content_type_model: 'user' })).toBe('Utenti')
    expect(entityLabel({ action: 'update', content_type_app: 'contracts', content_type_model: 'contract' })).toBe('Contratti')
    expect(entityLabel({ action: 'update', content_type_app: 'x', content_type_model: 'foo_bar' })).toBe('Foo bar')
  })

  it('riconosce browser, rete e periodi', () => {
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36 Edg/156.0')).toBe('Edge su Windows')
    expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari su iPhone')
    expect(browserOf(null)).toBeNull()
    expect(isPrivateIp('172.26.216.7')).toBe(true)
    expect(isPrivateIp('185.220.101.4')).toBe(false)
    const now = new Date(2026, 10, 7, 19, 10)
    expect(periodStart('all', now)).toBeNull()
    expect(new Date(periodStart('0', now)!).getHours()).toBe(0)
    expect(whenLabel(new Date(2026, 10, 6, 9, 5).toISOString(), now)).toBe('ieri 09:05')
  })
})
