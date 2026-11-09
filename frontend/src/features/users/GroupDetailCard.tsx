import * as React from 'react'
import { Box, Button, ButtonBase, TextField, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useToast } from '@shared/ui/toast'
import { DetailSection, FloatingDetail } from '../../ui/campo'
import type { AdminGroupRow, AdminUserRow, ModuleRwd, PermissionModule, RwdLevel } from '../../types/adminUsers'
import { LEVEL_TO_RWD, rwdToLevel } from '../../types/adminUsers'
import { archieModules, fullName, portalModules } from './usersModel'
import { ExtraPermissions, ModuleLevels, UserAvatar } from './usersUi'

/** Scheda gruppo: nome, permessi per modulo (Archie e Portal), permessi speciali, membri. */
export default function GroupDetailCard({ group, modules, users, onClose, onSaved, onDeleted, onOpenUser }: {
  group: AdminGroupRow; modules: PermissionModule[]; users: AdminUserRow[]
  onClose: () => void; onSaved: (g: AdminGroupRow) => void; onDeleted: (id: number) => void; onOpenUser: (id: number) => void
}) {
  const toast = useToast()
  const [name, setName] = React.useState(group.name)
  const [mods, setMods] = React.useState<Record<string, ModuleRwd>>(group.permissions_state.modules)
  const [extra, setExtra] = React.useState<Set<string>>(new Set(group.permissions_state.extra_permissions))
  const [busy, setBusy] = React.useState(false)
  const [del, setDel] = React.useState(false)
  React.useEffect(() => { setName(group.name); setMods(group.permissions_state.modules); setExtra(new Set(group.permissions_state.extra_permissions)) }, [group])
  const members = users.filter((u) => u.groups.some((g) => g.id === group.id))
  const get = (app: string) => ({ level: rwdToLevel(mods[app]) })
  const set = (app: string, l: RwdLevel) => setMods((m) => ({ ...m, [app]: LEVEL_TO_RWD[l] }))
  const save = async () => {
    const ids = new Map<string, number>()
    modules.forEach((m) => m.extra_permissions.forEach((p) => ids.set(p.codename, p.id)))
    setBusy(true)
    try {
      const { data } = await api.patch<AdminGroupRow>(`/admin-groups/${group.id}/`, { name: name.trim(), module_permissions: mods, extra_permission_ids: [...extra].map((c) => ids.get(c)).filter((x): x is number => typeof x === 'number') })
      onSaved(data); toast.success('Gruppo salvato.')
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const doDelete = async () => {
    setBusy(true)
    try { await api.delete(`/admin-groups/${group.id}/`); toast.success('Gruppo eliminato.'); setDel(false); onDeleted(group.id) } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  return (
    <FloatingDetail open onClose={onClose} ariaLabel="Dettaglio gruppo" idLabel="Gruppo" title={group.name}
      subtitle={`${members.length} ${members.length === 1 ? 'utente' : 'utenti'}`}
      footer={<>
        <Button variant="outlined" color="error" disabled={busy} onClick={() => setDel(true)}>Elimina gruppo</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" disabled={busy || !name.trim()} onClick={() => void save()}>Salva</Button>
      </>}>
      <Box sx={{ display: 'grid', gap: 2.25 }}>
        <TextField label="Nome del gruppo" value={name} onChange={(e) => setName(e.target.value)} />
        <DetailSection title="Archie"><ModuleLevels modules={archieModules(modules)} get={get} onChange={set} /></DetailSection>
        <DetailSection title="Permessi speciali">
          <ExtraPermissions modules={archieModules(modules)} value={extra} onToggle={(c, on) => setExtra((s) => { const n = new Set(s); if (on) n.add(c); else n.delete(c); return n })} />
        </DetailSection>
        <DetailSection title="Portal">
          <ModuleLevels modules={modules.filter((m) => m.app_label === 'portal').map((m) => ({ ...m, label: 'Accesso al Portal' })).concat(portalModules(modules))} get={get} onChange={set} />
        </DetailSection>
        <DetailSection title="Utenti">
          {!members.length ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Nessuno. Si aggiungono dalla scheda di ogni utente.</Typography> : (
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {members.map((u) => (
                <ButtonBase key={u.id} onClick={() => onOpenUser(u.id)} sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.25, p: '7px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'left', '&:hover': { borderColor: 'text.disabled' } }}>
                  <UserAvatar u={u} size={26} />
                  <Box sx={{ flex: 1, minWidth: 0, display: 'grid', lineHeight: 1.3 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{fullName(u)}</Typography>
                    <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{u.email || `@${u.username}`}</Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Box>
          )}
        </DetailSection>
      </Box>
      <ConfirmDeleteDialog open={del} busy={busy} title={`Eliminare il gruppo «${group.name}»?`}
        description={members.length ? `L'eliminazione è definitiva: ${members.length} ${members.length === 1 ? 'utente perde' : 'utenti perdono'} i permessi che arrivano da questo gruppo.` : "L'eliminazione è definitiva."}
        confirmText="Elimina" onClose={() => setDel(false)} onConfirm={() => void doDelete()} />
    </FloatingDetail>
  )
}
