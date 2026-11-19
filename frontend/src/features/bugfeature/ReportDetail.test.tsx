import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import { ReportDetail } from './bfUi'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { ReportRow } from './bfModel'

const theme = THEME_REGISTRY.default.build('light')
const base: ReportRow = {
  id: 41, kind: 'bug', status: 'open', section: 'drive', section_label: 'Drive', description: 'Il filtro si azzera\nSolo trascinando.',
  can_resolve: true, created_by_full_name: 'Marco Bassi', created_at: '2026-11-17T09:00:00Z', updated_at: '2026-11-17T09:00:00Z',
}
const show = (r: ReportRow) => {
  const h = { onResolve: vi.fn(), onReject: vi.fn(), onReopen: vi.fn(), onCopyLink: vi.fn() }
  render(<ThemeProvider theme={theme}><ReportDetail r={r} busy={false} onClose={vi.fn()} onUpload={vi.fn()} {...h} /></ThemeProvider>)
  return h
}

describe('ReportDetail', () => {
  it('chi può chiuderla la segna come risolta o la rifiuta dalla testata', () => {
    const h = show(base)
    expect(screen.getByRole('heading', { name: /Il filtro si azzera/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Segna come risolta' }))
    expect(h.onResolve).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Rifiuta' }))
    expect(h.onReject).toHaveBeenCalled()
  })

  it('una chiusa si riapre; chi segnala non vede le azioni', () => {
    const h = show({ ...base, status: 'rejected', rejection_reason: 'Non riproducibile', rejected_by_full_name: 'Federico Mutuale', rejected_at: '2026-11-18T09:00:00Z' })
    expect(screen.getByText('Non riproducibile')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Riapri' }))
    expect(h.onReopen).toHaveBeenCalled()
  })

  it('senza permesso niente Risolta / Rifiuta', () => {
    show({ ...base, can_resolve: false })
    expect(screen.queryByRole('button', { name: 'Segna come risolta' })).not.toBeInTheDocument()
  })
})
