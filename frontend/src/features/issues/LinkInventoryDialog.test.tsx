import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import LinkInventoryDialog from './LinkInventoryDialog'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const OPTS = [
  { id: 1, name: 'PACS Vergato', knumber: '103000170', hostname: 'pacs01', site_name: 'Ospedale di Vergato', type_label: 'Server' },
  { id: 2, name: 'Storage immagini', knumber: '103000409', hostname: 'ara03stor', site_name: 'Ospedale Marecchia', type_label: 'Storage' },
  { id: 3, name: 'Workstation 1', hostname: 'wkr01', site_name: 'Ospedale Marecchia', type_label: 'Workstation' },
]
const show = (over: Partial<React.ComponentProps<typeof LinkInventoryDialog>> = {}) => {
  const onLink = vi.fn()
  render(<ThemeProvider theme={theme}><LinkInventoryDialog open customerName="AUSL Romagna" siteName="Ospedale Marecchia" options={OPTS} loading={false}
    currentId={null} saving={false} onClose={vi.fn()} onLink={onLink} {...over} /></ThemeProvider>)
  return { onLink }
}

describe('LinkInventoryDialog', () => {
  it('prima gli inventari del sito della issue, poi gli altri del cliente', () => {
    show()
    expect(screen.getByRole('dialog', { name: 'Collega un inventario' })).toBeInTheDocument()
    const names = screen.getAllByRole('option').map((o) => o.querySelector('b')?.textContent)
    expect(names).toEqual(['Storage immagini', 'Workstation 1', 'PACS Vergato'])
    expect(screen.getByText('Nel sito della issue')).toBeInTheDocument()
    expect(screen.getByText('Altri siti del cliente')).toBeInTheDocument()
  })

  it('cerca per nome, K-number o hostname, sceglie e collega', () => {
    const { onLink } = show()
    fireEvent.change(screen.getByLabelText('Cerca inventario'), { target: { value: 'pacs01' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.click(screen.getByRole('option', { name: /PACS Vergato/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Collega' }))
    expect(onLink).toHaveBeenCalledWith(OPTS[0])
  })

  it('quello già collegato è segnato; «Scollega» toglie il collegamento', () => {
    const { onLink } = show({ currentId: 2 })
    expect(screen.getByRole('option', { name: /Storage immagini/ })).toHaveTextContent('collegato')
    expect(screen.getByRole('button', { name: 'Collega' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Scollega' }))
    expect(onLink).toHaveBeenCalledWith(null)
  })

  it('senza inventari lo dice', () => {
    show({ options: [] })
    expect(screen.getByText('Nessun inventario per questo cliente.')).toBeInTheDocument()
  })
})
