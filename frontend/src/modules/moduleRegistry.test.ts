import { describe, expect, it } from 'vitest'

import { MODULES, WIDGET_MODULE, moduleForPath, moduleForPerm } from './moduleRegistry'

describe('moduleForPath', () => {
  it.each([
    ['/piano-ferie', 'leave'],
    ['/issues', 'issues'],
    ['/wiki/12', 'wiki'],
    ['/wiki/queries', 'wiki'],
    ['/servicenow-dashboard', 'servicenow'],
    ['/maintenance/rapportini', 'maintenance'],
    ['/customers', null],
    ['/', null],
    ['/issuesx', null],
  ])('%s → %s', (path, key) => {
    expect(moduleForPath(path)).toBe(key)
  })
})

describe('moduleForPerm', () => {
  it.each([
    ['issues.add_issue', 'issues'],
    ['contracts.view_contract', 'contracts'],
    ['purchaseorders.view_purchaseorderentry', 'purchase_orders'],
    ['attendance.view_absence', 'leave'],
    ['attendance.view_leavearea', null],
    ['core.change_areatask', 'area_tasks'],
    ['core.manage_users', null],
    ['inventory.view_monitor', 'monitors'],
    ['inventory.view_inventory', null],
    ['crm.view_customer', null],
  ])('%s → %s', (perm, key) => {
    expect(moduleForPerm(perm)).toBe(key)
  })
})

it('le chiavi coincidono con il backend (core/modules.py)', () => {
  expect(MODULES.map((m) => m.key).sort()).toEqual([
    'area_tasks', 'contracts', 'drive', 'expenses', 'feedback', 'issues',
    'leave', 'maintenance', 'monitors', 'purchase_orders', 'servicenow', 'wiki',
  ])
  for (const key of Object.values(WIDGET_MODULE)) expect(MODULES.some((m) => m.key === key)).toBe(true)
})
