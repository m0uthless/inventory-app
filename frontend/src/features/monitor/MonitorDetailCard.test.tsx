import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import { MonitorDetailCard } from './monitorUi'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { MonitorRow } from './monitorModel'

const theme = THEME_REGISTRY.default.build('light')
const apiPatch = vi.fn().mockResolvedValue({ data: {} })
vi.mock('@shared/api/client', () => ({ api: { get: vi.fn().mockResolvedValue({ data: { results: [] } }), patch: (...a: unknown[]) => apiPatch(...a) } }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../customers/CustomerTabs', () => ({ AuditFeedPanel: () => null }))

const m: MonitorRow = {
  id: 9, inventory: 4, inventory_name: 'WS-REF-03', site_name: 'Radiologia', customer_name: 'AUSL Imola', produttore: 'Barco', modello: 'Coronis 6MP', seriale: 'BC-1',
  stato: 'in_uso', stato_label: 'In uso', tipo: 'diagnostico', tipo_label: 'Diagnostico', radinet: true, updated_at: null, deleted_at: null,
}

const show = () => {
  const onStato = vi.fn(); const onSaved = vi.fn(); const onOpenInventory = vi.fn()
  render(<ThemeProvider theme={theme}>
    <MonitorDetailCard m={m} canChange canDelete canAudit={false} busy={false} onClose={vi.fn()} onStato={onStato} onDelete={vi.fn()} onRestore={vi.fn()}
      onOpenInventory={onOpenInventory} onOpenMonitor={vi.fn()} onSaved={onSaved} />
  </ThemeProvider>)
  return { onStato, onSaved, onOpenInventory }
}

describe('MonitorDetailCard', () => {
  it('«Apri la workstation» e lo stato cambiato sul posto', () => {
    const { onStato, onOpenInventory } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Apri la workstation' }))
    expect(onOpenInventory).toHaveBeenCalledWith(4)
    fireEvent.click(screen.getByRole('button', { name: 'Stato: cambia' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Guasto' }))
    expect(onStato).toHaveBeenCalledWith('guasto')
  })

  it('«Modifica» dal ⋯ trasforma i dati in campi e salva solo quello che cambia', async () => {
    const { onSaved } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifica' }))
    fireEvent.change(screen.getByLabelText('Modello'), { target: { value: 'Coronis Fusion 6MP' } })
    fireEvent.click(screen.getByRole('button', { name: /Salva/ }))
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/monitors/9/', { modello: 'Coronis Fusion 6MP' }))
    expect(onSaved).toHaveBeenCalled()
  })
})
