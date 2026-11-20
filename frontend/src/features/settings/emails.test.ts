import { describe, expect, it } from 'vitest'

import { parseEmails } from './emails'

describe('parseEmails', () => {
  it('normalizza: spazi, minuscole, doppioni e separatori vuoti', () => {
    expect(parseEmails(' A@x.it ; b@y.it;;a@x.it; ')).toEqual({ list: ['a@x.it', 'b@y.it'], invalid: [] })
  })
  it('segnala gli indirizzi non validi', () => {
    expect(parseEmails('a@x.it; nonvalida')).toEqual({ list: ['a@x.it'], invalid: ['nonvalida'] })
  })
  it('vuoto: nessun indirizzo', () => {
    expect(parseEmails('  ')).toEqual({ list: [], invalid: [] })
  })
})
