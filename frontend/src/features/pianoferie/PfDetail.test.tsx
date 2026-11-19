import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import PfDetail from './PfDetail'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { PfRequest } from './pfModel'

const theme = THEME_REGISTRY.default.build('light')
const req = {
  key: 'r1', ids: [1], rows: [], user: 3, userName: 'Marco Bassi', from: '2026-12-22', to: '2026-12-23', part: 'giornata', reason: 'ferie', status: 'proposta',
  note: 'Reperibile se serve.', requestGroup: null, days: 2, createdAt: '2026-11-12T10:00:00Z', validatedByName: null, validatedAt: null, hourly: null,
} as unknown as PfRequest
const cal = { isOff: () => false, holiday: () => null }

const show = (over: Partial<{ canDecide: boolean; isMine: boolean }> = {}) => {
  const onDecide = vi.fn(); const onDelete = vi.fn()
  render(<ThemeProvider theme={theme}>
    <PfDetail req={req} areaLabel="Tecnici PACS" areaId={1} areaPeople={[{ id: 3, name: 'Marco Bassi', area_id: 1, area_label: 'Tecnici PACS', area_sort: 0 }, { id: 4, name: 'Anna Ferri', area_id: 1, area_label: 'Tecnici PACS', area_sort: 0 }]}
      cells={new Map()} cal={cal} canDecide={over.canDecide ?? true} canEdit isMine={over.isMine ?? false} busy={false}
      onClose={vi.fn()} onDecide={onDecide} onEdit={vi.fn()} onDelete={onDelete} />
  </ThemeProvider>)
  return { onDecide, onDelete }
}

describe('PfDetail', () => {
  it('il coordinatore valida o rifiuta dalla testata', () => {
    const { onDecide } = show()
    expect(screen.getByText('Reperibile se serve.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Valida' }))
    expect(onDecide).toHaveBeenCalledWith('validata')
    fireEvent.click(screen.getByRole('button', { name: 'Rifiuta' }))
    expect(onDecide).toHaveBeenCalledWith('rifiutata')
  })

  it('chi ha chiesto vede «Ritira la richiesta»', () => {
    const { onDelete } = show({ canDecide: false, isMine: true })
    expect(screen.queryByRole('button', { name: 'Valida' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ritira la richiesta' }))
    expect(onDelete).toHaveBeenCalled()
  })
})
