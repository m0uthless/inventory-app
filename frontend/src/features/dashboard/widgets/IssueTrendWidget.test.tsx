import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))

import IssueTrendWidget from './IssueTrendWidget'
import { THEME_REGISTRY } from '../../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const pt = (open: number, opened = 0, closed = 0) => ({ start: '2026-11-02', end: '2026-11-08', opened, closed, open })

describe('IssueTrendWidget (variante B · Arretrato)', () => {
  beforeEach(() => { api.get.mockReset(); api.get.mockResolvedValue({ data: { period: 'week', points: [pt(26, 4, 2), pt(30, 6, 2), pt(33, 5, 2)], open_now: 33 } }) })

  it('mostra le aperte ora, la variazione e i totali del periodo', async () => {
    render(<ThemeProvider theme={theme}><MemoryRouter><IssueTrendWidget /></MemoryRouter></ThemeProvider>)
    expect(await screen.findByText('+7 da inizio periodo')).toBeInTheDocument()
    expect(screen.getByText('33')).toBeInTheDocument()
    expect(screen.getByText(/Nel periodo/)).toHaveTextContent('Nel periodo 15 aperte · 6 risolte')
    expect(api.get).toHaveBeenCalledWith('/issues/trend/', { params: { period: 'week' } })
  })

  it('cambia periodo', async () => {
    render(<ThemeProvider theme={theme}><MemoryRouter><IssueTrendWidget /></MemoryRouter></ThemeProvider>)
    await screen.findByText('33')
    fireEvent.click(screen.getByRole('button', { name: 'Mesi' }))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/issues/trend/', { params: { period: 'month' } }))
  })
})
