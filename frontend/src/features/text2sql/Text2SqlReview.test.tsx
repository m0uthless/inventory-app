import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Text2SqlReview from './Text2SqlReview'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
const clip = vi.hoisted(() => ({ copyToClipboard: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/utils/clipboard', () => clip)
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const row = {
  id: 35, question: 'Studi MR senza referto', status: 'done', sql: "SELECT 1 FROM dual WHERE m = 'MR';", kind: 'read', warnings: [], seconds: 40, error: '',
  created_at: '2026-11-18T14:20:00Z', started_at: null, finished_at: null, feedback: 'ko', corrected_sql: 'SELECT 2 FROM dual;', feedback_note: 'Modalità con =',
  feedback_at: '2026-11-18T15:00:00Z', user_full_name: 'Marco Bassi', example_markdown: '### Domanda: Studi MR senza referto\n```sql\nSELECT 2 FROM dual;\n```\n', reviewed_at: null,
}

describe('Text2SqlReview', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.get.mockResolvedValue({ data: [row] })
    api.post.mockResolvedValue({ data: { ...row, reviewed_at: '2026-11-20T10:00:00Z' } })
  })
  it('mostra domanda, query generata e corretta, nota e autore', async () => {
    render(<ThemeProvider theme={theme}><Text2SqlReview /></ThemeProvider>)
    expect(await screen.findByText('Studi MR senza referto')).toBeInTheDocument()
    expect(screen.getByText(/Marco Bassi/)).toBeInTheDocument()
    expect(screen.getByText('Modalità con =')).toBeInTheDocument()
    expect(screen.getByText('Corretta dal tecnico')).toBeInTheDocument()
  })
  it('«Copia come esempio» copia il blocco per esempi_query.md', async () => {
    render(<ThemeProvider theme={theme}><Text2SqlReview /></ThemeProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Copia come esempio' }))
    expect(clip.copyToClipboard).toHaveBeenCalledWith(row.example_markdown)
  })
  it('«Segna come rivista» chiama l\'API', async () => {
    render(<ThemeProvider theme={theme}><Text2SqlReview /></ThemeProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Segna come rivista' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/text2sql/35/reviewed/', { reviewed: true }))
  })
})
