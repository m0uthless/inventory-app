import { describe, expect, it } from 'vitest'
import type { AdminGroupRow, AdminUserRow } from '../../types/adminUsers'
import { USER_VIEWS, levelSource, matchUser, roleTags } from './usersModel'

const rwd = (r: boolean, w = false, d = false) => ({ r, w, d })
const user = (over: Partial<AdminUserRow> = {}): AdminUserRow => ({
  id: 1, username: 'n.spazzoli', email: 'n@b.it', first_name: 'Nicole', last_name: 'Spazzoli', is_active: true, is_staff: false, is_superuser: false,
  date_joined: '', last_login: null, groups: [{ id: 1, name: 'Tecnici' }],
  group_permissions: { modules: { crm: rwd(true, true) }, extra_permissions: ['core.access_archie'] },
  direct_permissions: { modules: {}, extra_permissions: [] }, has_portal_access: false, portal_profile: null,
  profile: { avatar: null, is_philips: false, is_functional_account: false, is_leave_coordinator: false, leave_area: null, leave_area_name: null, is_expense_secretary: false, birth_date: null, gender: null },
  ...over,
})
const groups: AdminGroupRow[] = [{ id: 1, name: 'Tecnici', user_count: 1, permissions_state: { modules: { crm: rwd(true, true) }, extra_permissions: [] } }]

describe('usersModel', () => {
  it('levelSource', () => {
    const u = user()
    expect(levelSource(u, groups, 'crm', {})).toEqual({ level: 'read_write', floor: 'read_write', from: 'gruppo Tecnici' })
    expect(levelSource(u, groups, 'crm', { crm: rwd(true, true, true) })).toMatchObject({ level: 'full', from: 'assegnato a mano' })
    expect(levelSource(u, groups, 'wiki', {})).toEqual({ level: 'none', floor: 'none', from: '' })
    expect(levelSource(user({ is_superuser: true }), groups, 'wiki', {})).toMatchObject({ level: 'full', from: 'superuser' })
  })
  it('views', () => {
    const portal = user({ has_portal_access: true, group_permissions: { modules: {}, extra_permissions: [] } })
    const view = (k: string) => USER_VIEWS.find((v) => v.key === k)!.match
    expect(view('active')(user())).toBe(true)
    expect(view('portal')(portal)).toBe(true)
    expect(view('active')(portal)).toBe(false)
    expect(view('off')(user({ is_active: false }))).toBe(true)
  })
  it('roleTags and search', () => {
    expect(roleTags(user()).map((t) => t.label)).toEqual([])
    expect(roleTags(user({ profile: { ...user().profile, is_philips: true } })).map((t) => t.label)).not.toContain('Philips')
    expect(roleTags(user({ profile: { ...user().profile, is_leave_coordinator: true } })).map((t) => t.label)).toEqual(['Coordinatore ferie'])
    expect(matchUser(user(), 'spazz')).toBe(true)
    expect(matchUser(user(), 'rossi')).toBe(false)
  })
})
