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
  const leave_area = typeof v['leave_area'] === 'number' ? v['leave_area'] : null
  return { id, label, username, is_philips: v['is_philips'] === true, is_issue_assignee: v['is_issue_assignee'] === true, leave_area }
}

/** Assegnabili alle issue: chi ha il permesso di gruppo «Può essere assegnatario delle issue». */
export const issueAssignees = (users: UserOption[]): UserOption[] => users.filter((u) => u.is_issue_assignee)

/** Scelta del menu «Area» della pagina Issue (per chi vede tutte le aree). */
export type AreaChoice = 'all' | 'mine' | 'none' | number

/** Parametri dell'elenco e del riepilogo (`/issues/summary/?area=`) per la scelta del menu. */
export function areaChoiceParams(choice: AreaChoice): { list: Record<string, string | number | boolean>; summaryArea: string | undefined } {
  if (choice === 'mine') return { list: { scope: 'mine' }, summaryArea: 'mine' }
  if (choice === 'none') return { list: { no_area: true }, summaryArea: 'none' }
  if (typeof choice === 'number') return { list: { area: choice }, summaryArea: String(choice) }
  return { list: {}, summaryArea: undefined }
}

/** Si parte dalla propria area se c'è, altrimenti da tutte (come nei Task di area). */
export const defaultAreaChoice = (myArea: number | null): AreaChoice => (myArea != null ? myArea : 'all')

/** Dopo un salvataggio dalla finestra: `ok` (si può annullare), `readonly` (la issue è
 *  passata a un'altra area: si vede ma non si modifica più, quindi niente annulla),
 *  `hidden` (l'utente non vede le altre aree: la issue sparisce, si chiude la finestra). */
export function afterSaveOutcome(updated: { area: number | null; can_edit: boolean }, canSeeAll: boolean, myArea: number | null): 'ok' | 'readonly' | 'hidden' {
  if (updated.can_edit !== false) return 'ok'
  return !canSeeAll && myArea != null && updated.area != null && updated.area !== myArea ? 'hidden' : 'readonly'
}

const sameArea = (u: UserOption, areaId: number | '' | null | undefined) => areaId === '' || areaId == null || u.leave_area === areaId

/** Scelte del selettore «Assegnata a» (`users` = tutti gli utenti): gli assegnabili
 *  dell'area più l'assegnatario attuale, anche se è fuori area o ha perso il permesso,
 *  così il selettore non resta vuoto. */
export function assigneeChoices(users: UserOption[], areaId: number | '' | null | undefined, currentId: number | '' | null | undefined, currentLabel?: string | null): UserOption[] {
  const choices = users.filter((u) => u.is_issue_assignee && sameArea(u, areaId))
  if (currentId === '' || currentId == null || choices.some((u) => u.id === currentId)) return choices
  const current = users.find((u) => u.id === currentId)
  return [...choices, current ?? { id: currentId, label: currentLabel || `#${currentId}`, username: '', is_issue_assignee: false, leave_area: null }]
}

/** Cambiando area l'assegnatario resta se ne fa parte (come controlla il backend,
 *  che sul solo cambio d'area non ricontrolla il permesso). */
export function keepsAssignee(users: UserOption[], assigneeId: number | '' | null | undefined, areaId: number | '' | null | undefined): boolean {
  if (assigneeId === '' || assigneeId == null || areaId === '' || areaId == null) return true
  return users.find((u) => u.id === assigneeId)?.leave_area === areaId
}

/** «Assegna a me» solo a chi è assegnabile nell'area della issue. */
export function canSelfAssign(users: UserOption[], meId: number | null | undefined, areaId: number | '' | null | undefined): boolean {
  if (meId == null) return false
  const me = users.find((u) => u.id === meId)
  return Boolean(me?.is_issue_assignee && sameArea(me, areaId))
}
