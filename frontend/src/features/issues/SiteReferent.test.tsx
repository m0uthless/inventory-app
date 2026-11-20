import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SiteReferent from './SiteReferent'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))

const c = (id: number, name: string, over: Record<string, unknown> = {}) => ({ id, name, phone: '', email: '', department: '', is_primary: false, ...over })
const show = (contacts: unknown[]) => {
  api.get.mockResolvedValue({ data: { count: contacts.length, next: null, previous: null, results: contacts } })
  return render(<ThemeProvider theme={theme}><SiteReferent siteId={5} /></ThemeProvider>)
}

describe('SiteReferent', () => {
  beforeEach(() => api.get.mockReset())

  it('mostra il contatto principale con chiamata ed email', async () => {
    show([c(1, 'Mario Bianchi'), c(2, 'Dr.ssa Valli', { is_primary: true, phone: '051 123', email: 'valli@ausl.it', department: 'Radiologia' })])
    expect(await screen.findByText('Dr.ssa Valli')).toBeInTheDocument()
    expect(screen.getByText(/Referente · Radiologia/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chiama Dr.ssa Valli/ })).toHaveAttribute('href', 'tel:051123')
    expect(screen.getByRole('link', { name: /Scrivi a Dr.ssa Valli/ })).toHaveAttribute('href', 'mailto:valli@ausl.it')
    expect(screen.queryByText('Mario Bianchi')).toBeNull()
  })

  it('senza principale mostra fino a 3 contatti e «altri N»', async () => {
    show([c(1, 'A'), c(2, 'B'), c(3, 'C'), c(4, 'D'), c(5, 'E')])
    expect(await screen.findByText('A')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.queryByText('D')).toBeNull()
    expect(screen.getByText('Altri 2 contatti del sito')).toBeInTheDocument()
  })

  it('contatto senza telefono: niente pulsante di chiamata', async () => {
    show([c(1, 'Senza numero', { is_primary: true })])
    expect(await screen.findByText('Senza numero')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Chiama/ })).toBeNull()
  })

  it('sito senza contatti: lo dice', async () => {
    show([])
    expect(await screen.findByText('Nessun contatto per questo sito')).toBeInTheDocument()
  })
})
