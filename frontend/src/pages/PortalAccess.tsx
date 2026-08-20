import * as React from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import SearchIcon from '@mui/icons-material/Search'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import {
  rwdToLevel,
  RWD_LEVEL_OPTIONS,
  type AdminUserRow,
  type AdminGroupRow,
  type PermissionModule,
} from '../types/adminUsers'
import { UserDrawer, type LeaveAreaOption } from './UsersAdmin'

const LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  RWD_LEVEL_OPTIONS.map((o) => [o.key, o.label]),
)

function fullName(u: AdminUserRow): string {
  const n = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return n || u.username
}

export default function PortalAccess() {
  const toast = useToast()
  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<AdminUserRow[]>([])
  const [groups, setGroups] = React.useState<AdminGroupRow[]>([])
  const [modules, setModules] = React.useState<PermissionModule[]>([])
  const [leaveAreas, setLeaveAreas] = React.useState<LeaveAreaOption[]>([])
  const [selectedUser, setSelectedUser] = React.useState<AdminUserRow | null>(null)

  const [search, setSearch] = React.useState('')
  const [customerFilter, setCustomerFilter] = React.useState<number | ''>('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, groupsRes, modulesRes, leaveAreasRes] = await Promise.all([
        api.get('/admin-users/'),
        api.get('/admin-groups/'),
        api.get('/admin/permission-modules/'),
        api.get('/leave-areas/'),
      ])
      setUsers(usersRes.data as AdminUserRow[])
      setGroups(groupsRes.data as AdminGroupRow[])
      setModules(modulesRes.data as PermissionModule[])
      const leaveAreasData = leaveAreasRes.data as { id: number; label: string }[]
      setLeaveAreas(leaveAreasData.map((la) => ({ id: la.id, label: la.label })))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  const portalUsers = React.useMemo(() => users.filter((u) => u.has_portal_access), [users])

  // Elenco distinto dei clienti che compaiono in almeno un profilo Portal,
  // per popolare il filtro (non è un catalogo di TUTTI i clienti dell'app).
  const customerOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const u of portalUsers) {
      for (const c of u.portal_profile?.customers ?? []) {
        map.set(c.id, c.name)
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [portalUsers])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return portalUsers.filter((u) => {
      if (customerFilter !== '' && !u.portal_profile?.customers.some((c) => c.id === customerFilter)) {
        return false
      }
      if (!q) return true
      return (
        u.username.toLowerCase().includes(q) ||
        fullName(u).toLowerCase().includes(q) ||
        u.portal_profile?.customer_name.toLowerCase().includes(q)
      )
    })
  }, [portalUsers, search, customerFilter])

  const handleSaved = (updated: AdminUserRow) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setSelectedUser(updated)
  }

  const handleDeleted = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setSelectedUser(null)
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Cerca utente o cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <SearchIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} /> } }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label="Cliente"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value === '' ? '' : Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Tutti i clienti</MenuItem>
          {customerOptions.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {portalUsers.length === 0
              ? 'Nessun utente ha ancora accesso al Portal.'
              : 'Nessun utente corrisponde ai filtri.'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Utente</TableCell>
                <TableCell>Livello</TableCell>
                <TableCell>Cliente di default</TableCell>
                <TableCell>Altri clienti</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u) => {
                const profile = u.portal_profile
                const level = rwdToLevel(u.direct_permissions.modules['portal'])
                const blocked = profile != null && !profile.is_active
                const others = (profile?.customers ?? []).filter((c) => c.id !== profile?.customer_id)
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{fullName(u)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {blocked ? (
                        <Tooltip title="Il cliente di default non è più tra quelli assegnati: l'utente è bloccato fuori dal Portal.">
                          <Chip
                            size="small"
                            icon={<BlockOutlinedIcon sx={{ fontSize: 14 }} />}
                            label="Sospeso"
                            color="error"
                            variant="outlined"
                          />
                        </Tooltip>
                      ) : (
                        <Chip size="small" label={LEVEL_LABEL[level] || level} variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{profile?.customer_name ?? '—'}</TableCell>
                    <TableCell>
                      {others.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      ) : others.length <= 2 ? (
                        others.map((c) => (
                          <Chip key={c.id} size="small" label={c.name} sx={{ mr: 0.5, fontSize: 11 }} />
                        ))
                      ) : (
                        <>
                          <Chip size="small" label={others[0].name} sx={{ mr: 0.5, fontSize: 11 }} />
                          <Tooltip title={others.slice(1).map((c) => c.name).join(', ')}>
                            <Chip size="small" label={`+${others.length - 1}`} sx={{ fontSize: 11 }} />
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifica accesso Portal">
                        <IconButton size="small" onClick={() => setSelectedUser(u)}>
                          <EditOutlinedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <UserDrawer
        open={!!selectedUser}
        user={selectedUser}
        groups={groups}
        modules={modules}
        leaveAreas={leaveAreas}
        initialTab="permessi"
        onClose={() => setSelectedUser(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </Box>
  )
}
