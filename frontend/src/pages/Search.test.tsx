import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Search from './Search'

const navigate = vi.fn()
const errorToast = vi.fn()
const apiGet = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('../api/client', () => ({ api: { get: (...args: unknown[]) => apiGet(...args) } }))
vi.mock('../ui/toast', () => ({ useToast: () => ({ error: errorToast, success: vi.fn() }) }))

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
      <MemoryRouter initialEntries={['/search?search=Alpha']}>
        <Search />
      </MemoryRouter>,
    )

    await screen.findByText('C-000042 Alpha Industries')
    fireEvent.click(screen.getByText('C-000042 Alpha Industries'))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(String(navigate.mock.calls[0][0])).toContain('/customers')
    expect(String(navigate.mock.calls[0][0])).toContain('open=42')
  })
})
