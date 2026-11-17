import * as React from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { CampoDialog, CampoIcon } from '../../ui/campo'
import type { AdminGroupRow, AdminUserRow, ResetPasswordResponse } from '../../types/adminUsers'
import { fullName } from './usersModel'
import { ResetPasswordResultDialog } from './usersUi'

export type MenuAnchor<T> = { row: T; mouseX: number; mouseY: number } | null

const icon = (name: Parameters<typeof CampoIcon>[0]['name']) => <CampoIcon name={name} />

/**
 * Menu del tasto destro su una riga utente: voci rapide senza aprire la finestra.
 * Le voci di modifica seguono le stesse regole della finestra: account amministratori
 * bloccati per chi non è superuser, il proprio account non si disattiva né si elimina.
 */
export function UserRowMenu({ anchor, onClose, groups, currentUserId, currentUserIsSuperuser, canAudit, onOpen, onSaved, onDeleted }: {
  anchor: MenuAnchor<AdminUserRow>
  onClose: () => void
  groups: AdminGroupRow[]
  currentUserId?: number
  currentUserIsSuperuser: boolean
  canAudit: boolean
  onOpen: (id: number) => void
  onSaved: (u: AdminUserRow) => void
  onDeleted: (id: number) => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  // L'utente su cui si agisce resta anche dopo la chiusura del menu (per i dialoghi).
  const [target, setTarget] = React.useState<AdminUserRow | null>(null)
  const [groupMenu, setGroupMenu] = React.useState<MenuAnchor<AdminUserRow>>(null)
  const [confirmPw, setConfirmPw] = React.useState(false)
  const [pw, setPw] = React.useState<ResetPasswordResponse | null>(null)
  const [del, setDel] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const patch = async (u: AdminUserRow, body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try { const { data } = await api.patch<AdminUserRow>(`/admin-users/${u.id}/`, body); onSaved(data); toast.success(ok) }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const copy = async (text: string, what: string) => { await copyToClipboard(text); toast.success(`${what} copiato`) }
  const resetPassword = async () => {
    if (!target) return
    setBusy(true)
    try { const { data } = await api.post<ResetPasswordResponse>(`/admin-users/${target.id}/reset-password/`); setConfirmPw(false); setPw(data) }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const doDelete = async () => {
    if (!target) return
    setBusy(true)
    try { await api.delete(`/admin-users/${target.id}/`); toast.success('Utente eliminato.'); setDel(false); onDeleted(target.id) }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const u = anchor?.row
  const items: RowContextMenuItem[] = (() => {
    if (!u) return []
    const locked = (u.is_superuser || u.is_staff) && !currentUserIsSuperuser
    const self = u.id === currentUserId
    const freeGroups = groups.filter((g) => !u.groups.some((x) => x.id === g.id))
    return [
      { key: 'open', label: 'Apri', icon: icon('eye'), strong: true, onClick: () => onOpen(u.id) },
      { key: 'pw', label: 'Reimposta password…', icon: icon('key'), hidden: locked, onClick: () => { setTarget(u); setConfirmPw(true) } },
      { key: 'group', label: 'Aggiungi a un gruppo…', icon: icon('users'), hidden: locked || u.profile.is_philips || !freeGroups.length, onClick: () => { if (anchor) setGroupMenu(anchor) } },
      { key: 'email', label: "Copia l'email", icon: icon('copy'), dividerBefore: true, hidden: !u.email, onClick: () => copy(u.email, 'Email') },
      { key: 'username', label: 'Copia lo username', icon: icon('copy'), onClick: () => copy(u.username, 'Username') },
      { key: 'audit', label: "Vedi l'attività", icon: icon('history'), hidden: !canAudit, onClick: () => navigate(`/audit?actor=${u.id}`) },
      u.is_active
        ? { key: 'off', label: 'Disattiva', icon: icon('lock'), dividerBefore: true, hidden: locked || self, disabled: busy, onClick: () => patch(u, { is_active: false }, 'Utente disattivato.') }
        : { key: 'on', label: 'Riattiva', icon: icon('restore'), dividerBefore: true, hidden: locked || self, disabled: busy, onClick: () => patch(u, { is_active: true }, 'Utente riattivato.') },
      { key: 'delete', label: 'Elimina…', icon: icon('trash'), tone: 'danger', hidden: u.is_superuser || locked || self, onClick: () => { setTarget(u); setDel(true) } },
    ]
  })()

  const g = groupMenu?.row
  const groupItems: RowContextMenuItem[] = g
    ? groups.filter((x) => !g.groups.some((y) => y.id === x.id)).map((x) => ({
      key: String(x.id), label: x.name, onClick: () => patch(g, { group_ids: [...g.groups.map((y) => y.id), x.id] }, `Aggiunto a «${x.name}».`),
    }))
    : []

  return (
    <>
      <RowContextMenu open={Boolean(anchor)} onClose={onClose} items={items}
        anchorPosition={anchor ? { top: anchor.mouseY, left: anchor.mouseX } : undefined}
        title={u ? fullName(u) : undefined} subtitle={u ? `@${u.username}` : undefined} />
      <RowContextMenu open={Boolean(groupMenu)} onClose={() => setGroupMenu(null)} items={groupItems}
        anchorPosition={groupMenu ? { top: groupMenu.mouseY, left: groupMenu.mouseX } : undefined}
        title="Aggiungi a un gruppo" subtitle={g ? fullName(g) : undefined} />

      <CampoDialog open={confirmPw} onClose={() => setConfirmPw(false)} busy={busy} labelId="pw-confirm-title" width={420}
        title={target ? `Reimpostare la password di ${fullName(target)}?` : ''} sub="Quella attuale smette subito di funzionare."
        footer={<><Box sx={{ flex: 1 }} /><Button variant="text" onClick={() => setConfirmPw(false)} disabled={busy}>Annulla</Button><Button variant="contained" disabled={busy} onClick={() => void resetPassword()}>Reimposta</Button></>}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>La nuova password compare una sola volta: comunicala all'utente.</Typography>
      </CampoDialog>
      <ResetPasswordResultDialog result={pw} onClose={() => setPw(null)} />
      <ConfirmDeleteDialog open={del} busy={busy} title={target ? `Eliminare l'utente ${target.username}?` : ''}
        description="L'eliminazione è definitiva: non finisce nel Cestino. Se vuoi solo togliergli l'accesso, disattivalo." confirmText="Elimina"
        onClose={() => setDel(false)} onConfirm={() => void doDelete()} />
    </>
  )
}

/** Menu del tasto destro su una scheda gruppo. */
export function GroupCardMenu({ anchor, onClose, users, onOpen, onDuplicate, onDeleted }: {
  anchor: MenuAnchor<AdminGroupRow>
  onClose: () => void
  users: AdminUserRow[]
  onOpen: (id: number) => void
  onDuplicate: (g: AdminGroupRow) => void
  onDeleted: (id: number) => void
}) {
  const toast = useToast()
  const [target, setTarget] = React.useState<AdminGroupRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const membersOf = (g: AdminGroupRow) => users.filter((u) => u.groups.some((x) => x.id === g.id))

  const g = anchor?.row
  const members = g ? membersOf(g) : []
  const items: RowContextMenuItem[] = g ? [
    { key: 'open', label: 'Apri', icon: icon('eye'), strong: true, onClick: () => onOpen(g.id) },
    { key: 'dup', label: 'Duplica…', icon: icon('layers'), onClick: () => onDuplicate(g) },
    { key: 'names', label: 'Copia i nomi dei membri', icon: icon('copy'), disabled: !members.length, onClick: async () => { await copyToClipboard(members.map(fullName).join(', ')); toast.success(`${members.length} ${members.length === 1 ? 'nome copiato' : 'nomi copiati'}`) } },
    { key: 'delete', label: 'Elimina…', icon: icon('trash'), tone: 'danger', dividerBefore: true, onClick: () => setTarget(g) },
  ] : []

  const n = target ? membersOf(target).length : 0
  const doDelete = async () => {
    if (!target) return
    setBusy(true)
    try { await api.delete(`/admin-groups/${target.id}/`); toast.success('Gruppo eliminato.'); onDeleted(target.id); setTarget(null) }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <RowContextMenu open={Boolean(anchor)} onClose={onClose} items={items}
        anchorPosition={anchor ? { top: anchor.mouseY, left: anchor.mouseX } : undefined}
        title={g?.name} subtitle={g ? `${members.length} ${members.length === 1 ? 'utente' : 'utenti'}` : undefined} />
      <ConfirmDeleteDialog open={Boolean(target)} busy={busy} title={target ? `Eliminare il gruppo «${target.name}»?` : ''}
        description={n ? `L'eliminazione è definitiva: ${n} ${n === 1 ? 'utente perde' : 'utenti perdono'} i permessi che arrivano da questo gruppo.` : "L'eliminazione è definitiva."}
        confirmText="Elimina" onClose={() => setTarget(null)} onConfirm={() => void doDelete()} />
    </>
  )
}
