import { isRecord } from '@shared/utils/guards'

import type { UserOption } from './types'

/** Riga di `/api/users/` → opzione per i selettori delle issue. */
export function toUserOption(v: unknown): UserOption | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  const username = typeof v['username'] === 'string' ? v['username'] : ''
  const fullName = typeof v['full_name'] === 'string' ? v['full_name'] : ''
  const label = (fullName || username || String(id)).trim()
  return { id, label, username, is_philips: v['is_philips'] === true, is_issue_assignee: v['is_issue_assignee'] === true }
}

/** Assegnabili alle issue: chi ha il permesso di gruppo «Può essere assegnatario delle issue». */
export const issueAssignees = (users: UserOption[]): UserOption[] => users.filter((u) => u.is_issue_assignee)
