import { describe, expect, it } from 'vitest'
import { afterSaveOutcome, assigneesForArea, issueAssignees, issueScopeParam, toUserOption } from './issueUsers'

describe('issueUsers', () => {
  it('toUserOption legge is_issue_assignee (assente = false)', () => {
    expect(toUserOption({ id: 1, username: 'a', full_name: 'Anna', is_issue_assignee: true })).toMatchObject({ id: 1, label: 'Anna', is_issue_assignee: true })
    expect(toUserOption({ id: 2, username: 'b' })).toMatchObject({ id: 2, label: 'b', is_issue_assignee: false })
    expect(toUserOption({ username: 'x' })).toBeNull()
  })
  it('gli assegnatari sono solo quelli col permesso, non i tecnici ServiceNow', () => {
    const users = [
      toUserOption({ id: 1, username: 'ass', is_issue_assignee: true }),
      toUserOption({ id: 2, username: 'sn', is_servicenow_technician: true, is_issue_assignee: false }),
      toUserOption({ id: 3, username: 'philips', is_philips: true, is_issue_assignee: true }),
    ].filter((u) => u !== null)
    expect(issueAssignees(users).map((u) => u.id)).toEqual([1, 3])
  })
  it('toUserOption legge l\'area del profilo', () => {
    expect(toUserOption({ id: 1, username: 'a', leave_area: 4 })).toMatchObject({ leave_area: 4 })
    expect(toUserOption({ id: 2, username: 'b' })).toMatchObject({ leave_area: null })
  })
  it('con un\'area si propongono solo i suoi membri, senza area tutti', () => {
    const users = [
      { id: 1, label: 'A', username: 'a', is_issue_assignee: true, leave_area: 4 },
      { id: 2, label: 'B', username: 'b', is_issue_assignee: true, leave_area: 5 },
      { id: 3, label: 'C', username: 'c', is_issue_assignee: true, leave_area: null },
    ]
    expect(assigneesForArea(users, 4).map((u) => u.id)).toEqual([1])
    expect(assigneesForArea(users, '').map((u) => u.id)).toEqual([1, 2, 3])
  })
  it('issueScopeParam: «Tutte le aree» spento restringe solo chi può vedere tutto', () => {
    expect(issueScopeParam(true, false, 4)).toBe('mine')
    expect(issueScopeParam(true, true, 4)).toBeUndefined()
    expect(issueScopeParam(false, false, 4)).toBeUndefined()
    expect(issueScopeParam(false, true, 4)).toBeUndefined()
    expect(issueScopeParam(true, false, null)).toBeUndefined()
  })
  it('afterSaveOutcome: dopo aver spostato la issue fuori dalla propria area l\'annulla non è possibile', () => {
    expect(afterSaveOutcome({ area: 4, can_edit: true }, false, 4)).toBe('ok')
    expect(afterSaveOutcome({ area: null, can_edit: true }, false, 4)).toBe('ok')
    // Può vedere tutte le aree: la vede ancora, ma in sola lettura.
    expect(afterSaveOutcome({ area: 5, can_edit: false }, true, 4)).toBe('readonly')
    // Non può vedere le altre aree: la issue sparisce.
    expect(afterSaveOutcome({ area: 5, can_edit: false }, false, 4)).toBe('hidden')
    // Senza area nel profilo vede tutto: al più sola lettura.
    expect(afterSaveOutcome({ area: 5, can_edit: false }, false, null)).toBe('readonly')
  })
})
