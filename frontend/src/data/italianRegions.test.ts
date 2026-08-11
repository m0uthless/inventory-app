import { describe, expect, it } from 'vitest'
import { ITALIAN_PROVINCES } from './italianProvinces'
import { ITALIAN_REGIONS, PROVINCE_TO_REGION, regionOfProvinceSigla } from './italianRegions'

describe('italianRegions', () => {
  it('contiene esattamente le 20 regioni italiane, senza id duplicati', () => {
    expect(ITALIAN_REGIONS).toHaveLength(20)
    const ids = ITALIAN_REGIONS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ogni regione ha una posizione (row/col) unica sulla griglia', () => {
    const positions = ITALIAN_REGIONS.map((r) => `${r.row}:${r.col}`)
    expect(new Set(positions).size).toBe(positions.length)
  })

  it('ogni provincia di ITALIAN_PROVINCES è mappata a esattamente una regione valida', () => {
    const regionIds = new Set(ITALIAN_REGIONS.map((r) => r.id))
    for (const p of ITALIAN_PROVINCES) {
      const region = PROVINCE_TO_REGION[p.sigla]
      expect(region, `provincia ${p.sigla} (${p.name}) senza regione`).toBeDefined()
      expect(regionIds.has(region)).toBe(true)
    }
  })

  it('non ci sono sigle mappate a una regione che non esistono in ITALIAN_PROVINCES', () => {
    const validSigle = new Set(ITALIAN_PROVINCES.map((p) => p.sigla))
    for (const sigla of Object.keys(PROVINCE_TO_REGION)) {
      expect(validSigle.has(sigla)).toBe(true)
    }
  })

  it('la somma delle province per regione è 107', () => {
    expect(Object.keys(PROVINCE_TO_REGION)).toHaveLength(107)
  })

  it('regionOfProvinceSigla risolve case-insensitive e ritorna null per sigle sconosciute', () => {
    expect(regionOfProvinceSigla('BO')).toBe('EMR')
    expect(regionOfProvinceSigla('bo')).toBe('EMR')
    expect(regionOfProvinceSigla('XX')).toBeNull()
    expect(regionOfProvinceSigla(null)).toBeNull()
    expect(regionOfProvinceSigla(undefined)).toBeNull()
  })
})
