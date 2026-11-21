import { describe, expect, it } from 'vitest'

import { normalizeAddress } from './geocode'

describe('normalizeAddress', () => {
  it('espande le abbreviazioni italiane', () => {
    expect(normalizeAddress('V.le Pepoli 3, Bologna')).toBe('Viale Pepoli 3, Bologna')
    expect(normalizeAddress('P.zza Maggiore 1')).toBe('Piazza Maggiore 1')
    expect(normalizeAddress(' S.S. 9 km 12 ')).toBe('Strada Statale 9 km 12')
  })
})
