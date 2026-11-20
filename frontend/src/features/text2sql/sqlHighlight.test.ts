import { describe, expect, it } from 'vitest'
import { highlightSql } from './sqlHighlight'

describe('highlightSql', () => {
  it('separa commenti, stringhe e parole chiave', () => {
    const lines = highlightSql("-- READ | x\nSELECT a FROM t WHERE b = 'CT' -- nota")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual([{ text: '-- READ | x', kind: 'comment' }])
    const kinds = lines[1].map((s) => `${s.kind}:${s.text}`)
    expect(kinds).toContain('keyword:SELECT')
    expect(kinds).toContain('keyword:FROM')
    expect(kinds).toContain("string:'CT'")
    expect(kinds).toContain('comment:-- nota')
    expect(lines[1].map((s) => s.text).join('')).toBe("SELECT a FROM t WHERE b = 'CT' -- nota")
  })
  it('una parola chiave dentro una stringa resta stringa', () => {
    const kinds = highlightSql("WHERE x = 'select from'")[0].map((s) => s.kind)
    expect(kinds.filter((k) => k === 'keyword')).toHaveLength(1)
  })
})
