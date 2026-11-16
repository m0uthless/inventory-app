import { describe, expect, it } from 'vitest'
import { deviceLabel, fullName, initialsOf, passwordScore, summarizePermissions } from './profileModel'

describe('profileModel', () => {
  it('summarizePermissions', () => {
    const s = summarizePermissions(['inventory.view_inventory', 'crm.view_customer', 'crm.change_site', 'crm.delete_contact', 'inventory.view_secrets', 'auth.view_user'])
    expect(s.map((m) => m.app)).toEqual(['crm', 'inventory'])
    expect(s[0]).toMatchObject({ r: true, w: true, d: true, extra: [] })
    expect(s[1]).toMatchObject({ r: true, w: false, d: false, extra: ['view_secrets'] })
  })
  it('passwordScore', () => {
    expect(passwordScore('')).toBe(0)
    expect(passwordScore('abcdefgh')).toBe(1)
    expect(passwordScore('Abcdefghijkl')).toBe(3)
    expect(passwordScore('Abcdefghijk1!')).toBe(4)
  })
  it('deviceLabel and names', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120 Safari/537')).toBe('Chrome su Windows')
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17 Safari/604')).toBe('Safari su iPhone')
    expect(fullName({ first_name: 'Ada', last_name: 'Neri', username: 'a' })).toBe('Ada Neri')
    expect(initialsOf({ username: 'zeta' })).toBe('Z')
  })
})
