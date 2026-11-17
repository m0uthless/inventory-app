import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import GroupDetailModal from './GroupDetailModal'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import type { AdminGroupRow, AdminUserRow, PermissionModule } from '../../types/adminUsers'

const theme = THEME_REGISTRY.default.build('light')
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@shared/api/client', () => ({ api }))
vi.mock('@shared/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const R = { r: true, w: false, d: false }
const RW = { r: true, w: true, d: false }
const modules: PermissionModule[] = [
  { app_label: 'issues', label: 'Issue', extra_permissions: [], is_portal_dedicated: false },
  { app_label: 'wiki', label: 'Wiki', extra_permissions: [], is_portal_dedicated: false },
]
const group: AdminGroupRow = { id: 1, name: 'Tecnici', user_count: 2, permissions_state: { modules: { issues: R, wiki: R }, extra_permissions: [] } }
let uid = 0
const user = (first: string, extra: Partial<AdminUserRow> = {}): AdminUserRow => ({
  id: ++uid, username: first.toLowerCase(), email: `${first.toLowerCase()}@biotron.it`, first_name: first, last_name: 'Test',
  is_active: true, is_staff: false, is_superuser: false, date_joined: '2022-09-01T08:00:00Z', last_login: null,
  groups: [], group_permissions: { modules: {}, extra_permissions: [] }, direct_permissions: { modules: {}, extra_permissions: [] },
  has_portal_access: false, portal_profile: null,
  profile: { avatar: null, is_philips: false, is_servicenow_technician: false, is_functional_account: false, is_leave_coordinator: false, leave_area: null, leave_area_name: null, is_expense_secretary: false, birth_date: null, gender: null },
  ...extra,
})
const inGroup = { groups: [{ id: 1, name: 'Tecnici' }] }
const nicole = user('Nicole', { ...inGroup, direct_permissions: { modules: { wiki: RW }, extra_permissions: [] } })
const marco = user('Marco', inGroup)
const admin = user('Admin', { ...inGroup, is_staff: true })
const giulia = user('Giulia')
const users = [nicole, marco, admin, giulia]

const show = (props: Partial<React.ComponentProps<typeof GroupDetailModal>> = {}) => {
  const onSaved = vi.fn()
  render(<ThemeProvider theme={theme}>
    <GroupDetailModal group={group} modules={modules} users={users} currentUserIsSuperuser={false} onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} onDuplicate={vi.fn()} onOpenUser={vi.fn()} {...props} />
  </ThemeProvider>)
  return { onSaved }
}

describe('GroupDetailModal', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.patch.mockResolvedValue({ data: group }) })

  it('segnala chi ha di più a mano', () => {
    show()
    expect(screen.getByText('+1 a mano')).toBeInTheDocument()
  })

  it('un salvataggio invia permessi e membri, e la barra dice quante persone tocca', async () => {
    const { onSaved } = show()
    fireEvent.click(screen.getByRole('radio', { name: 'Issue: Scrittura' }))
    fireEvent.click(screen.getByRole('button', { name: 'Togli Marco Test' }))
    expect(screen.getByText(/2 modifiche da salvare/)).toBeInTheDocument()
    expect(screen.getByText(/riguarda 3 persone/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    const [url, body] = api.patch.mock.calls[0]
    expect(url).toBe('/admin-groups/1/')
    expect(body.module_permissions.issues).toEqual({ r: true, w: true, d: false })
    expect(new Set(body.user_ids)).toEqual(new Set([nicole.id, admin.id]))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('senza cambiare i membri non manda user_ids', async () => {
    show()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Tecnici BO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva le modifiche' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty('user_ids')
  })

  it("chi non è superuser non può togliere un amministratore", () => {
    show()
    expect(screen.queryByRole('button', { name: 'Togli Admin Test' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Togli Nicole Test' })).toBeInTheDocument()
  })
})
