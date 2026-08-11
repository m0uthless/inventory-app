import { describe, expect, it } from 'vitest'
import { ITALIAN_PROVINCES, resolveItalianProvince, formatProvinceLabel } from './italianProvinces'

describe('italianProvinces', () => {
  it('contiene esattamente le 107 province italiane, senza sigle duplicate', () => {
    expect(ITALIAN_PROVINCES).toHaveLength(107)
    const sigle = ITALIAN_PROVINCES.map((p) => p.sigla)
    expect(new Set(sigle).size).toBe(sigle.length)
  })

  it('ogni sigla è di 2 lettere maiuscole e ogni nome non è vuoto', () => {
    for (const p of ITALIAN_PROVINCES) {
      expect(p.sigla).toMatch(/^[A-Z]{2}$/)
      expect(p.name.trim().length).toBeGreaterThan(0)
    }
  })

  it('resolveItalianProvince trova la provincia dalla sigla, case-insensitive', () => {
    expect(resolveItalianProvince('BO')).toEqual({ sigla: 'BO', name: 'Bologna' })
    expect(resolveItalianProvince('bo')).toEqual({ sigla: 'BO', name: 'Bologna' })
  })

  it('resolveItalianProvince trova la provincia dal nome esteso, case-insensitive', () => {
    expect(resolveItalianProvince('Bologna')).toEqual({ sigla: 'BO', name: 'Bologna' })
    expect(resolveItalianProvince('bologna')).toEqual({ sigla: 'BO', name: 'Bologna' })
  })

  it('resolveItalianProvince ritorna null per valori sconosciuti o vuoti', () => {
    expect(resolveItalianProvince('Non Esiste')).toBeNull()
    expect(resolveItalianProvince('')).toBeNull()
    expect(resolveItalianProvince(null)).toBeNull()
    expect(resolveItalianProvince(undefined)).toBeNull()
  })

  it('formatProvinceLabel produce "Nome (SIGLA)" per un valore riconosciuto', () => {
    expect(formatProvinceLabel('BO')).toBe('Bologna (BO)')
    expect(formatProvinceLabel('Bologna')).toBe('Bologna (BO)')
  })

  it('formatProvinceLabel ricade sul valore originale per dati legacy non riconosciuti', () => {
    expect(formatProvinceLabel('Emilia')).toBe('Emilia')
  })

  it('formatProvinceLabel ritorna stringa vuota per valori assenti', () => {
    expect(formatProvinceLabel(null)).toBe('')
    expect(formatProvinceLabel(undefined)).toBe('')
    expect(formatProvinceLabel('  ')).toBe('')
  })
})
