import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ModuleGate } from './ModuleGate'

const auth = vi.hoisted(() => ({ me: null as null | { is_superuser: boolean; disabled_modules: string[] } }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('../pages/NotFound', () => ({ default: () => <div>pagina 404</div> }))

const at = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><ModuleGate><div>contenuto</div></ModuleGate></MemoryRouter>,
)

describe('ModuleGate', () => {
  beforeEach(() => { auth.me = { is_superuser: false, disabled_modules: ['leave'] } })

  it('chi non è superuser trova la 404 sulle pagine di un modulo spento', () => {
    at('/piano-ferie')
    expect(screen.getByText('pagina 404')).toBeInTheDocument()
    expect(screen.queryByText('contenuto')).not.toBeInTheDocument()
  })

  it('le altre pagine restano', () => {
    at('/customers')
    expect(screen.getByText('contenuto')).toBeInTheDocument()
  })

  it('il superuser vede la pagina con il banner', () => {
    auth.me = { is_superuser: true, disabled_modules: ['leave'] }
    at('/piano-ferie')
    expect(screen.getByText('contenuto')).toBeInTheDocument()
    expect(screen.getByText('Piano ferie è spento')).toBeInTheDocument()
  })
})
