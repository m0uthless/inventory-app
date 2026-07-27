import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RequireAuslBoPerm } from './RequireAuslBoPerm'
import type { AuslBoMe } from './AuthProvider'

// ─── Mock useAuth ───────────────────────────────────────────────────────────
// Ogni test imposta il valore restituito tramite mockUseAuthReturn.

let mockUseAuthReturn: { me: AuslBoMe | null; loading: boolean } = { me: null, loading: true }

vi.mock('./AuthProvider', () => ({
  useAuth: () => mockUseAuthReturn,
}))

function makeMe(permissions: string[]): AuslBoMe {
  return {
    user: { id: 1, username: 'cliente1', email: '', first_name: '', last_name: '', avatar: null },
    customer: { id: 1, name: 'Cliente Alpha', display_name: 'Cliente Alpha', code: 'C-001' },
    auslbo: { is_active: true, can_edit_devices: false, permissions },
  }
}

function renderGuard(perm: string | string[]) {
  return render(
    <MemoryRouter initialEntries={['/device']}>
      <Routes>
        <Route
          path="/device"
          element={
            <RequireAuslBoPerm perm={perm}>
              <div>Contenuto protetto</div>
            </RequireAuslBoPerm>
          }
        />
        <Route path="/login" element={<div>Pagina di login</div>} />
        <Route path="/403" element={<div>Accesso negato</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuslBoPerm — route guard portale AUSL BO (fix P0 6.6)', () => {
  it('mostra un loader mentre l\u2019autenticazione è in corso', () => {
    mockUseAuthReturn = { me: null, loading: true }
    renderGuard('device.view_device')

    expect(screen.queryByText('Contenuto protetto')).not.toBeInTheDocument()
    expect(screen.queryByText('Pagina di login')).not.toBeInTheDocument()
  })

  it('reindirizza al login se non autenticato', () => {
    mockUseAuthReturn = { me: null, loading: false }
    renderGuard('device.view_device')

    expect(screen.getByText('Pagina di login')).toBeInTheDocument()
  })

  it('reindirizza a /403 se autenticato ma senza il permesso richiesto', () => {
    mockUseAuthReturn = { me: makeMe(['vlan.view_vlan']), loading: false }
    renderGuard('device.view_device')

    expect(screen.getByText('Accesso negato')).toBeInTheDocument()
    expect(screen.queryByText('Contenuto protetto')).not.toBeInTheDocument()
  })

  it('mostra il contenuto se autenticato con il permesso richiesto', () => {
    mockUseAuthReturn = { me: makeMe(['device.view_device']), loading: false }
    renderGuard('device.view_device')

    expect(screen.getByText('Contenuto protetto')).toBeInTheDocument()
  })

  it('con più permessi richiesti basta soddisfarne uno (semantica "any of")', () => {
    mockUseAuthReturn = { me: makeMe(['vlan.view_vlaniprequest']), loading: false }
    renderGuard(['vlan.view_vlan', 'vlan.view_vlaniprequest'])

    expect(screen.getByText('Contenuto protetto')).toBeInTheDocument()
  })
})
