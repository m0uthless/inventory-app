import type { AxiosError } from 'axios'

type UnknownRecord = Record<string, unknown>

export type ApiFormFeedback = {
  fieldErrors: Record<string, string>
  message: string
  hasFieldErrors: boolean
  status?: number
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null
}

function isAxiosError(v: unknown): v is AxiosError {
  return isRecord(v) && (v as UnknownRecord).isAxiosError === true
}

function coerceString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

function statusFallback(status?: number): string | undefined {
  switch (status) {
    case 400:
      return 'Dati non validi.'
    case 401:
      return "Sessione non valida. Effettua di nuovo l'accesso."
    case 403:
      return 'Non hai i permessi per questa operazione.'
    case 404:
      return 'Risorsa non trovata.'
    case 409:
      return 'Operazione non consentita nello stato attuale.'
    case 429:
      return 'Troppe richieste. Riprova tra poco.'
    default:
      if (status && status >= 500) return 'Errore interno del server.'
      return undefined
  }
}

function firstMessageFromArray(v: unknown): string | undefined {
  if (!Array.isArray(v)) return undefined
  for (const item of v) {
    const s = coerceString(item)
    if (s) return s
  }
  return undefined
}

function firstFieldMessage(errors: Record<string, string>): string | undefined {
  for (const key of Object.keys(errors)) {
    if (key === '_error' || key === 'non_field_errors') continue
    const s = errors[key]
    if (s) return s
  }
  return undefined
}

function flattenFieldErrors(data: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (!isRecord(data)) return out

  for (const [rawKey, value] of Object.entries(data)) {
    if (rawKey === 'detail' || rawKey === 'message') continue

    const key = rawKey === 'non_field_errors' ? '_error' : rawKey
    const path = prefix ? `${prefix}.${key}` : key

    if (Array.isArray(value)) {
      const first = firstMessageFromArray(value)
      if (first) {
        out[path] = first
        if (key === '_error') out.non_field_errors = first
      }
      continue
    }

    if (isRecord(value)) {
      flattenFieldErrors(value, path, out)
      continue
    }

    const s = coerceString(value)
    if (s) {
      out[path] = s
      if (key === '_error') out.non_field_errors = s
    }
  }

  return out
}

/**
 * Extract field errors from a DRF validation response.
 * Nested objects are flattened using dot notation.
 */
export function getApiErrorFieldErrors(err: unknown): Record<string, string> {
  if (!isAxiosError(err)) return {}
  return flattenFieldErrors(err.response?.data)
}

/**
 * Extract a user-friendly message from an API error (Axios or generic).
 */
export function getApiErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data
    const status = err.response?.status

    if (isRecord(data)) {
      const detail = coerceString(data.detail)
      if (detail) return detail

      const nonField = firstMessageFromArray(data.non_field_errors)
      if (nonField) return nonField

      const message = coerceString(data.message)
      if (message) return message

      const firstField = firstFieldMessage(flattenFieldErrors(data))
      if (firstField) return firstField
    }

    return statusFallback(status) || err.message || 'Errore di rete'
  }

  if (err instanceof Error) return err.message
  return 'Errore inatteso'
}

export function getApiFormFeedback(err: unknown, defaultValidationMessage = 'Controlla i campi evidenziati.'): ApiFormFeedback {
  const fieldErrors = getApiErrorFieldErrors(err)
  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const message = hasFieldErrors
    ? fieldErrors._error || fieldErrors.non_field_errors || firstFieldMessage(fieldErrors) || defaultValidationMessage
    : getApiErrorMessage(err)

  return {
    fieldErrors,
    hasFieldErrors,
    message,
    status: isAxiosError(err) ? err.response?.status : undefined,
  }
}

/**
 * Backwards-compatible aliases (older code imports these names).
 */
export function apiErrorToMessage(err: unknown): string {
  return getApiErrorMessage(err)
}

export function apiErrorToFieldErrors(err: unknown): Record<string, string> {
  return getApiErrorFieldErrors(err)
}

export function apiErrorToFormFeedback(err: unknown, defaultValidationMessage?: string): ApiFormFeedback {
  return getApiFormFeedback(err, defaultValidationMessage)
}
