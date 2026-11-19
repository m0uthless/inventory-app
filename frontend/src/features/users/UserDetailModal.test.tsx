import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UserDetailModal from './UserDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { AdminGroupRow, AdminUserRow, PermissionModule } from '../../types/adminUsers'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const R = { r: true, w: false, d: false }
const RW = { r: true, w: true, d: false }
const NONE = { r: false, w: false, d: false }
const modules: PermissionModule[] = [
  { app_label: 'issues', label: 'Issue', extra_permissions: [], is_portal_dedicated: false },
  { app_label: 'wiki', label: 'Wiki', extra_permissions: [], is_portal_dedicated: false },
]
const groups: AdminGroupRow[] = [{ id: 1, name: 'Tecnici', user_count: 1, permissions_state: { modules: { issues: RW, wiki: R }, extra_permissions: [] } }]
const user: AdminUserRow = {
  id: 7, username: 'n.spazzoli', email: 'n.spazzoli@biotron.it', first_name: 'Nicole', last_name: 'Spazzoli',
  is_active: true, is_staff: false, is_superuser: false, date_joined: '2022-09-01T08:00:00Z', last_login: null,
  groups: [{ id: 1, name: 'Tecnici' }],
  group_permissions: { modules: { issues: RW, wiki: R }, extra_permissions: [] },
  direct_permissions: { modules: { issues: NONE, wiki: NONE }, extra_permissions: [] },
  has_portal_access: false, portal_profile: null,
  profile: { avatar: null, is_philips: false, is_functional_account: false, is_leave_coordinator: false, leave_area: null, leave_area_name: null, is_expense_secretary: false, birth_date: null, gender: null },
}

const show = (props: Partial<React.ComponentProps<typeof UserDetailModal>> = {}) => {
  const onSaved = vi.fn(); const onClose = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <UserDetailModal user={user} groups={groups} modules={modules} leaveAreas={[]} currentUserIsSuperuser onClose={onClose} onSaved={onSaved} onDeleted={vi.fn()} {...props} />
  </MemoryRouter></ThemeProvider>)
  return { onSaved, onClose }
}

describe('UserDetailModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.get.mockResolvedValue({ data: [] })
    api.patch.mockResolvedValue({ data: user })
  })

  it('una modifica mostra la barra e un solo salvataggio invia anagrafica e permessi', async () => {
    const { onSaved } = show()
    expect(screen.queryByText(/da salvare/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nicol' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Wiki: Completo' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Femmina' }))
    expect(screen.getByText('3 modifiche da salvare')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    const [url, body] = api.patch.mock.calls[0]
    expect(url).toBe('/admin-users/7/')
    expect(body.first_name).toBe('Nicol')
    expect(body.profile.gender).toBe('F')
    expect(body.module_permissions.wiki).toEqual({ r: true, w: true, d: true })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('il ruolo «Tecnico ServiceNow» non è più un interruttore del profilo', () => {
    show()
    expect(screen.queryByText('Tecnico ServiceNow')).not.toBeInTheDocument()
    expect(screen.getByText('Coordinatore ferie')).toBeInTheDocument()
  })

  it('sotto il livello del gruppo non si scende', () => {
    show()
    expect(screen.getByRole('radio', { name: 'Issue: Lettura' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Issue: Scrittura' })).toHaveAttribute('aria-checked', 'true')
  })

  it('chiudere con modifiche in sospeso chiede conferma', async () => {
    const { onClose } = show()
    fireEvent.change(screen.getByLabelText('Cognome'), { target: { value: 'X' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Chiudi' })[0])
    expect(onClose).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: 'Ci sono modifiche non salvate' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Esci senza salvare' }))
    expect(onClose).toHaveBeenCalled()
  })
})
