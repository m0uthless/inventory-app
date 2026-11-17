import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon, PageHead, TableBar, ViewTabs } from '../ui/campo'
import type { AdminGroupRow, AdminUserRow, PermissionModule, RwdLevel } from '../types/adminUsers'
import { rwdToLevel } from '../types/adminUsers'
import { agoLabel } from '../utils/agoLabel'
import { USER_VIEWS, archieModules, fullName, openModules, roleTags, type LeaveAreaOption, type UserView } from '../features/users/usersModel'
import { CreateGroupDialog, CreateUserDialog, GroupTag, RoleChip, UserAvatar } from '../features/users/usersUi'
import { useLocalGrid } from '../features/users/useLocalGrid'
import UserDetailModal from '../features/users/UserDetailModal'
import GroupDetailModal from '../features/users/GroupDetailModal'
import { GroupCardMenu, UserRowMenu, type MenuAnchor } from '../features/users/usersMenus'

type Section = 'users' | 'groups'
const HEAT: Record<RwdLevel, (t: import('@mui/material').Theme) => string> = {
  none: (t) => t.palette.archie.neutralBg,
  read: (t) => t.palette.archie.tints.sky.bg,
  read_write: (t) => t.palette.archie.tints.mint.mid,
  full: (t) => t.palette.archie.tints.mint.ink,
}

/** Utenti e gruppi (anteprima up-base, variante A): tabella con viste e scheda flottante; gruppi come schede. */
export default function UsersAdmin() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const section: Section = sp.get('sezione') === 'gruppi' ? 'groups' : 'users'
  const view: UserView = (USER_VIEWS.find((v) => v.key === sp.get('vista'))?.key ?? 'active')
  const openUserId = Number(sp.get('open')) || null
  const openGroupId = Number(sp.get('gruppo')) || null
  const setParams = (patch: Record<string, string | null>) => setSp((p) => { const n = new URLSearchParams(p); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); return n }, { replace: true })

  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<AdminUserRow[]>([])
  const [groups, setGroups] = React.useState<AdminGroupRow[]>([])
  const [modules, setModules] = React.useState<PermissionModule[]>([])
  const [leaveAreas, setLeaveAreas] = React.useState<LeaveAreaOption[]>([])
  const [newUser, setNewUser] = React.useState(false)
  const [newGroup, setNewGroup] = React.useState(false)
  const [dupGroup, setDupGroup] = React.useState<AdminGroupRow | null>(null)
  const [userMenu, setUserMenu] = React.useState<MenuAnchor<AdminUserRow>>(null)
  const [groupMenu, setGroupMenu] = React.useState<MenuAnchor<AdminGroupRow>>(null)
  const anchor = <T,>(row: T, e: React.MouseEvent) => ({ row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [u, g, m, la] = await Promise.all([api.get<AdminUserRow[]>('/admin-users/'), api.get<AdminGroupRow[]>('/admin-groups/'), api.get<PermissionModule[]>('/admin/permission-modules/'), api.get<{ id: number; label: string }[]>('/leave-areas/')])
      setUsers(u.data); setGroups(g.data); setModules(m.data); setLeaveAreas(la.data.map((x) => ({ id: x.id, label: x.label })))
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setLoading(false) }
  }, [toast])
  React.useEffect(() => { void load() }, [load])

  const reloadGroups = () => api.get<AdminGroupRow[]>('/admin-groups/').then((r) => setGroups(r.data)).catch(() => {})
  const onUserSaved = (u: AdminUserRow) => { setUsers((list) => list.map((x) => (x.id === u.id ? u : x))); void reloadGroups() }

  const viewRows = React.useMemo(() => users.filter(USER_VIEWS.find((v) => v.key === view)!.match), [users, view])
  const grid = useLocalGrid<AdminUserRow>(viewRows, ['username', 'first_name', 'last_name', 'email'])
  const current = openUserId ? users.find((u) => u.id === openUserId) ?? null : null
  const idx = current ? grid.rows.findIndex((r) => r.id === current.id) : -1
  const currentGroup = openGroupId ? groups.find((g) => g.id === openGroupId) ?? null : null
  const gIdx = currentGroup ? groups.findIndex((g) => g.id === currentGroup.id) : -1

  const columns: GridColDef<AdminUserRow>[] = [
    { field: 'last_name', headerName: 'Utente', flex: 1.2, minWidth: 240, renderCell: (p) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, height: '100%', minWidth: 0 }}>
        <UserAvatar u={p.row} />
        <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.3 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{fullName(p.row)}</Typography>
          <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{p.row.email || `@${p.row.username}`}</Typography>
        </Box>
      </Box>
    ) },
    { field: 'groups', headerName: 'Gruppi', flex: 1, minWidth: 180, sortable: false, renderCell: (p) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden' }}>
        {p.row.groups.length ? p.row.groups.map((g) => <GroupTag key={g.id} name={g.name} />)
          : p.row.portal_profile ? <Typography noWrap sx={{ fontSize: 12, color: (t) => t.palette.archie.tints.sky.ink }}>Portal · {p.row.portal_profile.customer_name}</Typography>
            : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>}
      </Box>
    ) },
    { field: 'roles', headerName: 'Ruoli', flex: 1.1, minWidth: 200, sortable: false, renderCell: (p) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden' }}>{roleTags(p.row).map((t) => <RoleChip key={t.label} tag={t} />)}</Box>
    ) },
    { field: 'last_login', headerName: 'Ultimo accesso', width: 140, renderCell: (p) => <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: '54px' }}>{p.row.last_login ? agoLabel(p.row.last_login) : 'mai'}</Typography> },
    { field: 'is_active', headerName: 'Stato', width: 110, renderCell: (p) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, ...(p.row.is_active ? { bgcolor: 'success.light', color: 'success.main' } : { bgcolor: 'archie.neutralBg', color: 'text.secondary' }) }}>{p.row.is_active ? 'Attivo' : 'Disattivato'}</Box>
      </Box>
    ) },
  ]

  const mobileCard: MobileCardRenderFn<AdminUserRow> = ({ row, onOpen, onContextMenu }) => (
    <Box onClick={() => onOpen(row.id)} onContextMenu={(e) => { e.preventDefault(); onContextMenu(row, e) }} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.25, display: 'grid', gap: 0.75, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <UserAvatar u={row} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>{fullName(row)}</Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{row.groups.map((g) => g.name).join(', ') || row.email}</Typography>
        </Box>
        {!row.is_active ? <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Disattivato</Typography> : null}
      </Box>
      {roleTags(row).length ? <Box>{roleTags(row).map((t) => <RoleChip key={t.label} tag={t} />)}</Box> : null}
    </Box>
  )

  const switcher = (
    <Box role="tablist" aria-label="Utenti o gruppi" sx={{ display: 'inline-flex', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '9px', bgcolor: 'background.paper' }}>
      {([['users', 'Utenti', users.length], ['groups', 'Gruppi', groups.length]] as [Section, string, number][]).map(([k, l, n]) => {
        const on = k === section
        return (
          <ButtonBase key={k} role="tab" aria-selected={on} onClick={() => setParams({ sezione: k === 'groups' ? 'gruppi' : null, open: null, gruppo: null })} sx={{
            height: 28, px: 1.5, borderRadius: '6px', fontSize: 13, fontWeight: 550, gap: 0.5, color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent',
            '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>{l}<Box component="span" sx={{ fontSize: 11, fontWeight: 600 }}>{n}</Box></ButtonBase>
        )
      })}
    </Box>
  )

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead title="Utenti e gruppi" inline={switcher} actions={
        <Button variant="contained" startIcon={<CampoIcon name="plus" size={15} />} onClick={() => (section === 'users' ? setNewUser(true) : setNewGroup(true))}>
          {section === 'users' ? 'Nuovo utente' : 'Nuovo gruppo'}
        </Button>
      } />

      {section === 'users' ? (
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
          <ViewTabs value={view} onChange={(k) => setParams({ vista: k === 'active' ? null : k })}
            tabs={USER_VIEWS.map((v) => ({ key: v.key, label: v.label, count: loading ? null : users.filter(v.match).length }))} />
          <EntityListCard
            sx={{ border: 0, borderRadius: 0 }}
            flush
            mobileCard={mobileCard}
            header={<TableBar filters={[]} onRemoveFilter={() => {}} onClearFilters={() => {}} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca nome, nome utente, email…" />}
            toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca utenti…' }}
            grid={{
              autoHeight: true,
              rows: grid.rows,
              columns,
              loading,
              rowCount: grid.rowCount,
              rowHeight: 54,
              paginationModel: grid.paginationModel,
              onPaginationModelChange: grid.onPaginationModelChange,
              sortModel: grid.sortModel,
              onSortModelChange: grid.onSortModelChange,
              emptyState: grid.q.trim() ? { title: 'Nessun risultato', subtitle: 'Prova con un altro nome.' } : { title: 'Nessun utente in questa vista', subtitle: '' },
              onRowClick: (id) => setParams({ open: String(id) }),
              onRowContextMenu: (row, e) => { e.preventDefault(); setUserMenu(anchor(row, e)) },
              getRowClassName: (row) => (row.id === openUserId ? 'Mui-selected' : undefined),
              sx: { cursor: 'pointer' },
            }}
          />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5 }}>
            {groups.map((g) => {
              const members = users.filter((u) => u.groups.some((x) => x.id === g.id))
              const mods = archieModules(modules)
              return (
                <ButtonBase key={g.id} onClick={() => setParams({ gruppo: String(g.id) })} onContextMenu={(e) => { e.preventDefault(); setGroupMenu(anchor(g, e)) }} sx={{
                  display: 'grid', gap: 1, justifyContent: 'stretch', justifyItems: 'stretch', alignItems: 'start', textAlign: 'left', p: 1.75, border: '1px solid', borderRadius: '10px', bgcolor: 'background.paper',
                  borderColor: g.id === openGroupId ? 'archie.fieldLine' : 'divider', boxShadow: g.id === openGroupId ? (t) => `inset 0 0 0 1px ${t.palette.archie.fieldLine}` : 'none',
                  '&:hover': { borderColor: g.id === openGroupId ? 'archie.fieldLine' : 'text.disabled' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 650 }}>{g.name}</Typography>
                    <Box sx={{ display: 'flex', '& > *:not(:first-of-type)': { ml: '-6px' } }}>
                      {members.slice(0, 4).map((u) => <Box key={u.id} sx={{ borderRadius: '50%', border: '2px solid', borderColor: 'background.paper', display: 'inline-flex' }}><UserAvatar u={u} size={22} /></Box>)}
                    </Box>
                    {members.length > 4 ? <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>+{members.length - 4}</Typography> : null}
                  </Box>
                  <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, mods.length)}, 1fr)`, gap: '3px' }}>
                    {mods.map((m) => {
                      const lv = rwdToLevel(g.permissions_state.modules[m.app_label])
                      return <Box key={m.app_label} title={`${m.label}`} sx={{ height: 12, borderRadius: '3px', bgcolor: HEAT[lv], boxShadow: lv === 'read' ? (t) => `inset 0 0 0 1px ${t.palette.archie.tints.sky.mid}` : 'none' }} />
                    })}
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{members.length} {members.length === 1 ? 'utente' : 'utenti'} · {openModules(g, modules)} moduli</Typography>
                </ButtonBase>
              )
            })}
          </Box>
          {groups.length ? (
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
              {(['none', 'read', 'read_write', 'full'] as RwdLevel[]).map((l) => (
                <Box key={l} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 11.5, color: 'text.secondary' }}>
                  <Box sx={{ width: 14, height: 12, borderRadius: '3px', bgcolor: HEAT[l], boxShadow: (t) => (l === 'read' ? `inset 0 0 0 1px ${t.palette.archie.tints.sky.mid}` : l === 'none' ? `inset 0 0 0 1px ${t.palette.divider}` : 'none') }} />
                  {{ none: 'Nessuno', read: 'Lettura', read_write: 'Scrittura', full: 'Completo' }[l]}
                </Box>
              ))}
            </Box>
          ) : !loading ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Nessun gruppo: creane uno per assegnare i permessi in blocco.</Typography> : null}
        </>
      )}

      {section === 'users' && current ? (
        <UserDetailModal user={current} allUsers={users} groups={groups} modules={modules} leaveAreas={leaveAreas} currentUserId={me?.id} currentUserIsSuperuser={Boolean(me?.is_superuser)}
          position={idx >= 0 ? `${idx + 1} di ${grid.rows.length}` : undefined}
          onPrev={idx > 0 ? () => setParams({ open: String(grid.rows[idx - 1].id) }) : undefined}
          onNext={idx >= 0 && idx < grid.rows.length - 1 ? () => setParams({ open: String(grid.rows[idx + 1].id) }) : undefined}
          onClose={() => setParams({ open: null })}
          onSaved={onUserSaved}
          onDeleted={(id) => { setUsers((l) => l.filter((u) => u.id !== id)); setParams({ open: null }); void reloadGroups() }} />
      ) : null}
      {section === 'groups' && currentGroup ? (
        <GroupDetailModal group={currentGroup} modules={modules} users={users} currentUserIsSuperuser={Boolean(me?.is_superuser)}
          position={gIdx >= 0 ? `${gIdx + 1} di ${groups.length}` : undefined}
          onPrev={gIdx > 0 ? () => setParams({ gruppo: String(groups[gIdx - 1].id) }) : undefined}
          onNext={gIdx >= 0 && gIdx < groups.length - 1 ? () => setParams({ gruppo: String(groups[gIdx + 1].id) }) : undefined}
          onDuplicate={setDupGroup}
          onClose={() => setParams({ gruppo: null })}
          onSaved={(g) => { setGroups((l) => l.map((x) => (x.id === g.id ? g : x))); void load() }}
          onDeleted={(id) => { setGroups((l) => l.filter((g) => g.id !== id)); setParams({ gruppo: null }); void load() }}
          onOpenUser={(id) => setParams({ sezione: null, gruppo: null, open: String(id) })} />
      ) : null}

      <UserRowMenu anchor={userMenu} onClose={() => setUserMenu(null)} groups={groups} currentUserId={me?.id} currentUserIsSuperuser={Boolean(me?.is_superuser)}
        canAudit={hasPerm('audit.view_auditevent')} onOpen={(id) => setParams({ open: String(id) })} onSaved={onUserSaved}
        onDeleted={(id) => { setUsers((l) => l.filter((u) => u.id !== id)); if (openUserId === id) setParams({ open: null }); void reloadGroups() }} />
      <GroupCardMenu anchor={groupMenu} onClose={() => setGroupMenu(null)} users={users}
        onOpen={(id) => setParams({ gruppo: String(id) })} onDuplicate={setDupGroup}
        onDeleted={(id) => { setGroups((l) => l.filter((g) => g.id !== id)); if (openGroupId === id) setParams({ gruppo: null }); void load() }} />

      <CreateUserDialog open={newUser} groups={groups} onClose={() => setNewUser(false)}
        onCreated={(u) => { setNewUser(false); setUsers((l) => [...l, u]); setParams({ vista: null, open: String(u.id) }) }} />
      <CreateGroupDialog open={newGroup || Boolean(dupGroup)} copyFrom={dupGroup} modules={modules} onClose={() => { setNewGroup(false); setDupGroup(null) }}
        onCreated={(g) => { setNewGroup(false); setDupGroup(null); setGroups((l) => [...l, g]); setParams({ gruppo: String(g.id) }) }} />
    </Stack>
  )
}
