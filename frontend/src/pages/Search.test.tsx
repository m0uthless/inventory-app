import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import Search from './Search'
import { THEME_REGISTRY } from '../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')

const navigate = vi.fn()
const errorToast = vi.fn()
const apiGet = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('@shared/api/client', () => ({ api: { get: (...args: unknown[]) => apiGet(...args) } }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ error: errorToast, success: vi.fn() }) }))

describe('Search page', () => {
  beforeEach(() => {
    navigate.mockReset()
    errorToast.mockReset()
    apiGet.mockReset()
  })

  it('loads results from the query string and navigates to the correct module', async () => {
    apiGet.mockResolvedValue({
      data: {
        q: 'Alpha',
        results: [{ kind: 'customer', id: 42, title: 'C-000042 Alpha Industries', subtitle: 'Cliente' }],
      },
    })

    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/search?search=Alpha']}>
          <Search />
        </MemoryRouter>
      </ThemeProvider>,
    )

    // Il titolo è spezzato dall'evidenziazione di "Alpha": cerco il pulsante del risultato.
    const hit = await screen.findByRole('button', { name: /C-000042 Alpha Industries/ })
    expect(screen.getByText('Alpha', { selector: 'mark' })).toBeTruthy()
    fireEvent.click(hit)
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(String(navigate.mock.calls[0][0])).toContain('/customers')
    expect(String(navigate.mock.calls[0][0])).toContain('open=42')
  })
})
