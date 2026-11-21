import { describe, expect, it } from 'vitest'
import { credentialPayload } from './credentialPayload'

const base = { os_user: 'admin', os_pwd: '', app_usr: '', app_pwd: '', vnc_pwd: '' }

describe('credentialPayload', () => {
  it('password vuota = invariata: non si manda (non la cancella)', () => {
    expect(credentialPayload(base, true)).toEqual({ os_user: 'admin', app_usr: null })
  })
  it('password scritta: si manda', () => {
    expect(credentialPayload({ ...base, vnc_pwd: ' Nuova! ' }, true)).toEqual({ os_user: 'admin', app_usr: null, vnc_pwd: 'Nuova!' })
  })
  it('senza permesso solo gli utenti', () => {
    expect(credentialPayload({ ...base, os_pwd: 'x' }, false)).toEqual({ os_user: 'admin', app_usr: null })
  })
})
