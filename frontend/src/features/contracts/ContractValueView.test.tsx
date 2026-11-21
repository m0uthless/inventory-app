import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { api, navigate } = vi.hoisted(() => ({ api: { get: vi.fn() }, navigate: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))

import ContractValueView from './ContractValueView'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const rows = [
  { customer_id: 1, customer_name: 'AUSL Romagna', province: 'RA', value: '400000.00', contracts: 4 },
  { customer_id: 2, customer_name: 'AS Friuli', province: 'UD', value: '300000.00', contracts: 3 },
  { customer_id: 3, customer_name: 'AO Ferrara', province: 'FE', value: '100000.00', contracts: 1 },
]
const show = (scope: 'active' | 'all' = 'active') => render(<ThemeProvider theme={theme}><MemoryRouter><ContractValueView scope={scope} /></MemoryRouter></ThemeProvider>)

describe('ContractValueView', () => {
  beforeEach(() => { api.get.mockReset().mockResolvedValue({ data: { results: rows } }); navigate.mockReset() })

  it('chiede lo scope e mostra totale, classifica e regioni', async () => {
    show('all')
    expect(await screen.findByText('Valore di tutti i contratti')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/contracts/value-by-customer/', { params: { scope: 'all' } })
    expect(screen.getByText('800.000 €')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Emilia-Romagna/ })).toHaveTextContent('500.000 €')
  })

  it('clic su una regione filtra la classifica, di nuovo per toglierlo', async () => {
    show()
    await screen.findByText('AS Friuli')
    fireEvent.click(screen.getByRole('button', { name: /^Friuli-Venezia Giulia/ }))
    expect(screen.getByRole('heading', { name: 'Clienti in Friuli-Venezia Giulia' })).toBeInTheDocument()
    expect(within(screen.getByRole('list')).queryByText('AUSL Romagna')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tutte le regioni' }))
    expect(within(screen.getByRole('list')).getByText('AUSL Romagna')).toBeInTheDocument()
  })

  it('clic su un cliente lo apre', async () => {
    show()
    fireEvent.click((await screen.findByText('AO Ferrara')).closest('button')!)
    expect(navigate).toHaveBeenCalledWith('/customers?open=3')
  })

  it('senza contratti lo dice', async () => {
    api.get.mockResolvedValue({ data: { results: [] } })
    show()
    expect(await screen.findByText('Nessun contratto attivo con un valore.')).toBeInTheDocument()
  })
})
