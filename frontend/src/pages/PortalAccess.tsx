import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon, FilterOptionList, PageHead, TableBar, ViewTabs, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import { rwdToLevel, type AdminGroupRow, type AdminUserRow, type PermissionModule, type RwdLevel } from '../types/adminUsers'
import { agoLabel } from '../utils/agoLabel'
import UserDetailCard from '../features/users/UserDetailCard'
import { LEVEL_LABEL, fullName, hasArchieAccess, maxLevel, type LeaveAreaOption } from '../features/users/usersModel'
import { UserAvatar } from '../features/users/usersUi'
import { useLocalGrid } from '../features/users/useLocalGrid'

type Row = AdminUserRow & { _customers: string; _level: RwdLevel; _suspended: boolean }
type View = 'all' | 'active' | 'suspended' | 'both'
const VIEWS: { key: View; label: string; match: (r: Row) => boolean; alert?: boolean }[] = [
  { key: 'all', label: 'Tutti', match: () => true },
  { key: 'active', label: 'Attivi', match: (r) => !r._suspended && r.is_active },
  { key: 'suspended', label: 'Sospesi', match: (r) => r._suspended || !r.is_active, alert: true },
  { key: 'both', label: 'Anche in Archie', match: (r) => hasArchieAccess(r) },
]
const LEVEL_TINT: Record<RwdLevel, 'sky' | 'mint' | 'sand' | null> = { none: null, read: 'sky', read_write: 'mint', full: 'sand' }
const cell = { display: 'flex', alignItems: 'center', height: '100%', minWidth: 0, gap: 0.5 } as const
const chip = { display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '11px', border: '1px solid', borderColor: 'divider', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' } as const

/** Accesso Portal: chi entra nel Portale clienti, con quale livello e su quali clienti. */
export default function PortalAccess() {
  const toast = useToast()
  const navigate = useNavigate()
  const { me } = useAuth()
  const [sp, setSp] = useSearchParams()
  const view: View = VIEWS.find((v) => v.key === sp.get('vista'))?.key ?? 'all'
  const customer = Number(sp.get('cliente')) || null
  const openId = Number(sp.get('open')) || null
  const setParam = (k: string, v: string | null) => setSp((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })

  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<AdminUserRow[]>([])
  const [groups, setGroups] = React.useState<AdminGroupRow[]>([])
  const [modules, setModules] = React.useState<PermissionModule[]>([])
  const [leaveAreas, setLeaveAreas] = React.useState<LeaveAreaOption[]>([])
  React.useEffect(() => {
    Promise.all([api.get<AdminUserRow[]>('/admin-users/'), api.get<AdminGroupRow[]>('/admin-groups/'), api.get<PermissionModule[]>('/admin/permission-modules/'), api.get<{ id: number; label: string }[]>('/leave-areas/')])
      .then(([u, g, m, la]) => { setUsers(u.data); setGroups(g.data); setModules(m.data); setLeaveAreas(la.data.map((x) => ({ id: x.id, label: x.label }))) })
      .catch((e) => toast.error(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
  }, [toast])

  const rows: Row[] = React.useMemo(() => users.filter((u) => u.has_portal_access).map((u) => ({
    ...u,
    _customers: (u.portal_profile?.customers ?? []).map((c) => c.name).join(' '),
    _level: maxLevel(rwdToLevel(u.direct_permissions.modules.portal), rwdToLevel(u.group_permissions.modules.portal)),
    // Il cliente predefinito non è più tra quelli assegnati: l'utente resta fuori dal Portale.
    _suspended: u.portal_profile != null && !u.portal_profile.is_active,
  })), [users])
  const customers = React.useMemo(() => {
    const m = new Map<number, string>()
    rows.forEach((r) => r.portal_profile?.customers.forEach((c) => m.set(c.id, c.name)))
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])
  const visible = React.useMemo(() => rows.filter(VIEWS.find((v) => v.key === view)!.match).filter((r) => !customer || r.portal_profile?.customers.some((c) => c.id === customer)), [rows, view, customer])
  const grid = useLocalGrid<Row>(visible, ['username', 'first_name', 'last_name', 'email', '_customers'])
  const current = openId ? users.find((u) => u.id === openId) ?? null : null
  const idx = current ? grid.rows.findIndex((r) => r.id === current.id) : -1

  const customerName = customers.find((c) => c.id === customer)?.name
  const activeFilters: ActiveFilter[] = customer ? [{ key: 'cliente', label: 'Cliente', values: customerName ?? `#${customer}` }] : []
  const filterConfig: Record<string, ColumnFilterConfig> = {
    customers: {
      value: customer ? String(customer) : '', label: 'Filtra cliente', onSet: (v) => setParam('cliente', String(v)), onReset: () => setParam('cliente', null),
      children: <FilterOptionList label="Cliente" single searchable selected={customer ? [String(customer)] : []} options={customers.map((c) => ({ value: String(c.id), label: c.name }))} onChange={(v) => setParam('cliente', v[0] ?? null)} />,
    },
  }

  const levelBadge = (r: Row) => {
    if (r._suspended || !r.is_active) {
      return (
        <Tooltip title={!r.is_active ? 'Utente disattivato' : "Il cliente predefinito non è più tra quelli assegnati: l'utente resta fuori dal Portale."}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 600, bgcolor: 'error.light', color: 'error.main' }}>
            <CampoIcon name="lock" size={12} />{!r.is_active ? 'Disattivato' : 'Sospeso'}
          </Box>
        </Tooltip>
      )
    }
    const t = LEVEL_TINT[r._level]
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 600,
        bgcolor: (th) => (t ? th.palette.archie.tints[t].bg : th.palette.archie.neutralBg), color: (th) => (t ? th.palette.archie.tints[t].ink : th.palette.text.secondary) }}>{LEVEL_LABEL[r._level]}</Box>
    )
  }
  const otherCustomers = (r: Row) => (r.portal_profile?.customers ?? []).filter((c) => c.id !== r.portal_profile?.customer_id)

  const columns: GridColDef<Row>[] = [
    { field: 'last_name', headerName: 'Utente', flex: 1.1, minWidth: 220, renderCell: (p) => (
      <Box sx={{ ...cell, gap: 1.25 }}>
        <UserAvatar u={p.row} />
        <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.3 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{fullName(p.row)}</Typography>
          <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{p.row.email || `@${p.row.username}`}</Typography>
        </Box>
      </Box>
    ) },
    { field: '_level', headerName: 'Livello', width: 130, sortable: false, renderCell: (p) => <Box sx={cell}>{levelBadge(p.row)}</Box> },
    { field: 'customers', headerName: 'Cliente predefinito', flex: 1, minWidth: 200, sortable: false, renderCell: (p) => (
      <Box sx={cell}>
        <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="building" size={15} /></Box>
        <Typography noWrap sx={{ fontSize: 13, ml: 0.5 }}>{p.row.portal_profile?.customer_name ?? '—'}</Typography>
      </Box>
    ) },
    { field: 'others', headerName: 'Altri clienti', flex: 1, minWidth: 200, sortable: false, renderCell: (p) => {
      const o = otherCustomers(p.row)
      return (
        <Box sx={cell}>
          {!o.length ? <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography> : <>
            {o.slice(0, 2).map((c) => <Box key={c.id} component="span" sx={chip} title={c.name}>{c.name}</Box>)}
            {o.length > 2 ? <Tooltip title={o.slice(2).map((c) => c.name).join(', ')}><Box component="span" sx={{ ...chip, bgcolor: 'archie.neutralBg' }}>+{o.length - 2}</Box></Tooltip> : null}
          </>}
        </Box>
      )
    } },
    { field: 'archie', headerName: 'Archie', width: 90, sortable: false, renderCell: (p) => (
      <Box sx={cell}>{hasArchieAccess(p.row) ? <Tooltip title="Entra anche in Archie"><Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main' }}>Sì</Box></Tooltip> : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>}</Box>
    ) },
    { field: 'last_login', headerName: 'Ultimo accesso', width: 140, renderCell: (p) => <Box sx={{ ...cell, fontSize: 12.5, color: 'text.secondary' }}>{p.row.last_login ? agoLabel(p.row.last_login) : 'mai'}</Box> },
  ]

  const mobileCard: MobileCardRenderFn<Row> = ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.25, display: 'grid', gap: 0.75, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <UserAvatar u={row} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>{fullName(row)}</Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{row.portal_profile?.customer_name ?? '—'}{otherCustomers(row).length ? ` +${otherCustomers(row).length}` : ''}</Typography>
        </Box>
        {levelBadge(row)}
      </Box>
    </Box>
  )

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead title="Accesso Portal" actions={
        <Button variant="outlined" startIcon={<CampoIcon name="users" size={15} />} onClick={() => navigate('/utenti')}>Concedi da Utenti e gruppi</Button>
      } />
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs value={view} onChange={(k) => setParam('vista', k === 'all' ? null : k)}
          tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, count: loading ? null : rows.filter(v.match).length, tone: v.alert ? 'alert' : 'default' }))} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={mobileCard}
          header={<TableBar filters={activeFilters} onRemoveFilter={() => setParam('cliente', null)} onClearFilters={() => setParam('cliente', null)} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca utente, email o cliente…" />}
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca utenti o clienti…' }}
          grid={{
            autoHeight: true,
            username: me?.username,
            filterConfig,
            rows: grid.rows,
            columns,
            loading,
            rowCount: grid.rowCount,
            rowHeight: 54,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            emptyState: rows.length ? { title: 'Nessun utente', subtitle: 'Nessuno corrisponde a vista, ricerca o filtro.' } : { title: 'Nessuno entra nel Portale', subtitle: "L'accesso si concede dalla scheda dell'utente in Utenti e gruppi." },
            onRowClick: (id) => setParam('open', String(id)),
            getRowClassName: (row) => (row.id === openId ? 'Mui-selected' : undefined),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>
      {current ? (
        <UserDetailCard user={current} groups={groups} modules={modules} leaveAreas={leaveAreas} currentUserId={me?.id} currentUserIsSuperuser={Boolean(me?.is_superuser)} initialTab="permessi" portalFirst
          position={idx >= 0 ? `${idx + 1} di ${grid.rows.length}` : undefined}
          onPrev={idx > 0 ? () => setParam('open', String(grid.rows[idx - 1].id)) : undefined}
          onNext={idx >= 0 && idx < grid.rows.length - 1 ? () => setParam('open', String(grid.rows[idx + 1].id)) : undefined}
          onClose={() => setParam('open', null)}
          onSaved={(u) => setUsers((l) => l.map((x) => (x.id === u.id ? u : x)))}
          onDeleted={(id) => { setUsers((l) => l.filter((u) => u.id !== id)); setParam('open', null) }} />
      ) : null}
    </Stack>
  )
}
