import { beforeEach, describe, expect, it } from 'vitest'
import { defaultMtArea, mtAreaParams, readMtArea, saveMtArea } from './areaChoice'

describe('areaChoice (Manutenzione)', () => {
  beforeEach(() => localStorage.clear())
  it('parametri per area, senza area e tutte', () => {
    expect(mtAreaParams(4)).toEqual({ area: 4 })
    expect(mtAreaParams('none')).toEqual({ area: 'none' })
    expect(mtAreaParams('all')).toEqual({})
  })
  it('si parte dalla propria area, altrimenti da tutte', () => {
    expect(defaultMtArea(3)).toBe(3)
    expect(defaultMtArea(null)).toBe('all')
  })
  it('la scelta resta nel browser', () => {
    expect(readMtArea()).toBeNull()
    saveMtArea(7); expect(readMtArea()).toBe(7)
    saveMtArea('none'); expect(readMtArea()).toBe('none')
  })
})
