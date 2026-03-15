import { describe, expect, it } from 'vitest'
import { getApiFormFeedback, getApiErrorMessage } from './error'
function axiosErr(data: unknown, status = 400, message = 'Request failed') {
  return { isAxiosError: true, message, response: { data, status } }
}
describe('api/error', () => {
  it('flattens nested field errors and surfaces the most useful message', () => {
    const err = axiosErr({ custom_fields: { visit_count: ['Numero non valido.'] }, non_field_errors: ['Controlla i dati inseriti.'] })
    const feedback = getApiFormFeedback(err)
    expect(feedback.hasFieldErrors).toBe(true)
    expect(feedback.fieldErrors['custom_fields.visit_count']).toBe('Numero non valido.')
    expect(feedback.fieldErrors.non_field_errors).toBe('Controlla i dati inseriti.')
    expect(feedback.message).toBe('Controlla i dati inseriti.')
  })
  it('returns fallback messages for common statuses', () => {
    expect(getApiErrorMessage(axiosErr({}, 403))).toBe('Non hai i permessi per questa operazione.')
  })
})
