import { describe, expect, it } from 'vitest'

import { apiErrorToMessage } from '@shared/api/error'

const axiosErr = (status: number, data: unknown) => ({ isAxiosError: true, message: 'Request failed', response: { status, data } })

describe('apiErrorToMessage', () => {
  it('traduce il 404 grezzo di Django («No X matches the given query.»)', () => {
    expect(apiErrorToMessage(axiosErr(404, { detail: 'No Issue matches the given query.' }))).toBe('Elemento non trovato o non visibile.')
    expect(apiErrorToMessage(axiosErr(404, { detail: 'No AreaTask matches the given query.' }))).toBe('Elemento non trovato o non visibile.')
  })

  it('lascia invariati i messaggi italiani del backend', () => {
    expect(apiErrorToMessage(axiosErr(404, { detail: 'Il modulo Issue non è disponibile.' }))).toBe('Il modulo Issue non è disponibile.')
  })
})
