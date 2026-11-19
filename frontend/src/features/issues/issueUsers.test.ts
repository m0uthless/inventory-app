import { describe, expect, it } from 'vitest'
import { issueAssignees, toUserOption } from './issueUsers'

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
})
