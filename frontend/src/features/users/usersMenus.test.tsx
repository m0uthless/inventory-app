import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GroupCardMenu, UserRowMenu } from './usersMenus'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { AdminGroupRow, AdminUserRow } from '../../types/adminUsers'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const groups: AdminGroupRow[] = [
  { id: 1, name: 'Tecnici', user_count: 1, permissions_state: { modules: {}, extra_permissions: [] } },
  { id: 2, name: 'Segreteria', user_count: 0, permissions_state: { modules: {}, extra_permissions: [] } },
]
const base: AdminUserRow = {
  id: 7, username: 'n.spazzoli', email: 'n.spazzoli@biotron.it', first_name: 'Nicole', last_name: 'Spazzoli',
  is_active: true, is_staff: false, is_superuser: false, date_joined: '2022-09-01T08:00:00Z', last_login: null,
  groups: [{ id: 1, name: 'Tecnici' }],
  group_permissions: { modules: {}, extra_permissions: [] },
  direct_permissions: { modules: {}, extra_permissions: [] },
  has_portal_access: false, portal_profile: null,
  profile: { avatar: null, is_philips: false, is_servicenow_technician: false, is_functional_account: false, is_leave_coordinator: false, leave_area: null, leave_area_name: null, is_expense_secretary: false, birth_date: null, gender: null },
}
const at = <T,>(row: T) => ({ row, mouseX: 10, mouseY: 10 })

const showUser = (u: AdminUserRow, props: Partial<React.ComponentProps<typeof UserRowMenu>> = {}) => {
  const onSaved = vi.fn()
  render(<ThemeProvider theme={theme}><MemoryRouter>
    <UserRowMenu anchor={at(u)} onClose={vi.fn()} groups={groups} currentUserId={1} currentUserIsSuperuser={false} canAudit onOpen={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} {...props} />
  </MemoryRouter></ThemeProvider>)
  return { onSaved }
}

describe('UserRowMenu', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.patch.mockResolvedValue({ data: base }) })

  it('aggiunge a un gruppo tenendo quelli che ha già', async () => {
    const { onSaved } = showUser(base)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Aggiungi a un gruppo…' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Segreteria' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin-users/7/', { group_ids: [1, 2] }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('la password si reimposta solo dopo la conferma', async () => {
    api.post.mockResolvedValue({ data: { username: 'n.spazzoli', password: 'x' } })
    showUser(base)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reimposta password…' }))
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Reimposta' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin-users/7/reset-password/'))
  })

  it('su un amministratore, senza essere superuser, restano solo le voci di lettura', () => {
    showUser({ ...base, is_staff: true })
    expect(screen.getByRole('menuitem', { name: 'Apri' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: "Copia l'email" })).toBeInTheDocument()
    for (const name of ['Reimposta password…', 'Aggiungi a un gruppo…', 'Disattiva', 'Elimina…']) expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument()
  })

  it('il proprio account non si disattiva né si elimina', () => {
    showUser(base, { currentUserId: 7 })
    expect(screen.queryByRole('menuitem', { name: 'Disattiva' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Elimina…' })).not.toBeInTheDocument()
  })
})

describe('GroupCardMenu', () => {
  it('duplica passando il gruppo e chiede conferma prima di eliminare', async () => {
    api.delete.mockResolvedValue({})
    const onDuplicate = vi.fn(); const onDeleted = vi.fn()
    const { rerender } = render(<ThemeProvider theme={theme}><GroupCardMenu anchor={at(groups[0])} onClose={vi.fn()} users={[base]} onOpen={vi.fn()} onDuplicate={onDuplicate} onDeleted={onDeleted} /></ThemeProvider>)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplica…' }))
    expect(onDuplicate).toHaveBeenCalledWith(groups[0])

    rerender(<ThemeProvider theme={theme}><GroupCardMenu anchor={at(groups[0])} onClose={vi.fn()} users={[base]} onOpen={vi.fn()} onDuplicate={onDuplicate} onDeleted={onDeleted} /></ThemeProvider>)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Elimina…' }))
    expect(api.delete).not.toHaveBeenCalled()
    expect(await screen.findByText(/1 utente perde/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1))
  })
})
