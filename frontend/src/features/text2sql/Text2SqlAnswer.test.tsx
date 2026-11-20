import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import Text2SqlAnswer from './Text2SqlAnswer'
import type { T2sRequest } from './api'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('@shared/utils/clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(undefined) }))

const base: T2sRequest = {
  id: 7, question: 'Quanti studi CT sono stati archiviati ieri?', status: 'done', sql: '-- READ | x\nSELECT 1 FROM dual;', kind: 'read',
  warnings: [], seconds: 52, error: '', created_at: '2026-11-20T10:42:00Z', started_at: null, finished_at: null,
  feedback: '', corrected_sql: '', feedback_note: '', feedback_at: null,
}
const show = (over: Partial<T2sRequest> = {}) => {
  const onFeedback = vi.fn().mockResolvedValue(undefined)
  const onRetry = vi.fn()
  render(<ThemeProvider theme={theme}><Text2SqlAnswer item={{ ...base, ...over }} onFeedback={onFeedback} onRetry={onRetry} onDelete={vi.fn()} /></ThemeProvider>)
  return { onFeedback, onRetry }
}

describe('Text2SqlAnswer', () => {
  it('in coda e in elaborazione mostra l\'attesa, senza query', () => {
    show({ status: 'queued', sql: '', kind: '' })
    expect(screen.getByText(/Parte appena il generatore è libero/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copia la query' })).not.toBeInTheDocument()
  })
  it('pronta: query, tipo e avvisi', () => {
    show({ kind: 'write', warnings: ['Query di MODIFICA: esegui prima l\'anteprima'] })
    expect(screen.getByRole('button', { name: 'Copia la query' })).toBeInTheDocument()
    expect(screen.getAllByText('Scrittura').length).toBeGreaterThan(0)
    expect(screen.getByText(/Query di MODIFICA/)).toBeInTheDocument()
  })
  it('«Corretta» salva subito il giudizio', async () => {
    const { onFeedback } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Corretta' }))
    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(7, { feedback: 'ok', corrected_sql: '', feedback_note: '' }))
  })
  it('«Da correggere» apre i campi e salva query corretta e nota', async () => {
    const { onFeedback } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Da correggere' }))
    fireEvent.change(screen.getByLabelText(/Query corretta/), { target: { value: 'SELECT 2 FROM dual;' } })
    fireEvent.change(screen.getByLabelText(/Cosa non andava/), { target: { value: 'Mancava il filtro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva il giudizio' }))
    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(7, { feedback: 'ko', corrected_sql: 'SELECT 2 FROM dual;', feedback_note: 'Mancava il filtro' }))
  })
  it('impossibile: niente giudizio', () => {
    show({ kind: 'impossible', sql: '-- IMPOSSIBILE: manca la tabella' })
    expect(screen.queryByRole('button', { name: 'Corretta' })).not.toBeInTheDocument()
  })
  it('non riuscita: errore e «Riprova»', () => {
    const { onRetry } = show({ status: 'error', sql: '', kind: '', error: 'Ollama non raggiungibile' })
    expect(screen.getByText('Ollama non raggiungibile')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
