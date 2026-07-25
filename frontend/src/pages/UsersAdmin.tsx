import * as React from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tabs,
  Tab,
  TextField,
  Tooltip,
  Typography,
  Autocomplete,
} from '@mui/material'
import type { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'

import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LockResetIcon from '@mui/icons-material/LockReset'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection } from '@shared/ui/DrawerParts'
import { useAuth } from '../auth/AuthProvider'
import {
  RWD_LEVEL_OPTIONS,
  LEVEL_TO_RWD,
  rwdToLevel,
  rwdLevelIndex,
  type AdminUserRow,
  type AdminGroupRow,
  type PermissionModule,
  type ModuleRwd,
  type RwdLevel,
  type ResetPasswordResponse,
} from '../types/adminUsers'

const TEAL = '#0f766e'

type LeaveAreaOption = { id: number; label: string }
type CustomerOption = { id: number; label: string }
type UserTabId = 'anagrafica' | 'permessi'
const USER_TAB_IDS: UserTabId[] = ['anagrafica', 'permessi']

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fullName(u: { first_name?: string; last_name?: string; username: string }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
}

function initials(u: { first_name?: string; last_name?: string; username: string }) {
  const fi = (u.first_name?.[0] || '') + (u.last_name?.[0] || '')
  return (fi || u.username?.[0] || 'U').toUpperCase()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function toIdLabel(v: unknown, labelKeys: string[]): { id: number; label: string } | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  for (const k of labelKeys) {
    const val = v[k]
    if (typeof val === 'string' && val.trim()) return { id, label: val }
  }
  return { id, label: String(id) }
}

// Stesso criterio del backend (auslbo/permissions.py::_can_access_archie):
// superuser, oppure permesso core.access_archie da gruppo o diretto.
function hasArchieAccess(u: AdminUserRow): boolean {
  if (u.is_superuser) return true
  const codename = 'core.access_archie'
  return (
    u.group_permissions.extra_permissions.includes(codename) ||
    u.direct_permissions.extra_permissions.includes(codename)
  )
}

// ─── Griglia locale (ricerca + ordinamento + paginazione lato client) ──────
// Gli endpoint /admin-users/ e /admin-groups/ non sono paginati lato server
// (dataset piccolo): la UI resta identica alle liste server-side esistenti,
// ma la paginazione/ordinamento/ricerca vengono fatti qui in locale.
function useLocalGrid<T extends Record<string, unknown>>(rows: T[], searchableFields: (keyof T)[]) {
  const [q, setQ] = React.useState('')
  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({ page: 0, pageSize: 25 })
  const [sortModel, setSortModel] = React.useState<GridSortModel>([])

  React.useEffect(() => {
    setPaginationModel((p) => ({ ...p, page: 0 }))
  }, [q])

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      searchableFields.some((f) => String(r[f] ?? '').toLowerCase().includes(needle)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q])

  const sorted = React.useMemo(() => {
    const s = sortModel[0]
    if (!s?.field) return filtered
    const dir = s.sort === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      const av = a[s.field]
      const bv = b[s.field]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
    })
  }, [filtered, sortModel])

  const paged = React.useMemo(() => {
    const start = paginationModel.page * paginationModel.pageSize
    return sorted.slice(start, start + paginationModel.pageSize)
  }, [sorted, paginationModel])

  return {
    q, setQ,
    paginationModel, onPaginationModelChange: setPaginationModel,
    sortModel, onSortModelChange: setSortModel,
    rows: paged,
    rowCount: sorted.length,
  }
}

// ─── Riga modulo: menu a tendina a 4 livelli (None/R/RW/RWD) ───────────────
// I livelli sono cumulativi (RW include R, RWD include RW). Se il gruppo
// garantisce già un livello, non è possibile scendere sotto quella soglia
// (i permessi diretti sono additivi rispetto al gruppo in Django).
const RWD_LEVEL_SHORT_LABEL: Record<RwdLevel, string> = {
  none: 'Nessuno',
  read: 'Lettura',
  read_write: 'Lettura+Scrittura',
  full: 'Completo (R/W/D)',
}

function ModuleRwdSelect(props: {
  label: string
  value: RwdLevel
  floorLevel?: RwdLevel
  onChange: (level: RwdLevel) => void
  disabled?: boolean
}) {
  const { label, value, floorLevel, onChange, disabled } = props
  const floorIdx = floorLevel ? rwdLevelIndex(floorLevel) : 0
  const displayValue = floorLevel && floorIdx > rwdLevelIndex(value) ? floorLevel : value

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ py: 0.6 }}>
      <Typography sx={{ fontSize: 12.5, flex: 1, minWidth: 0, color: disabled ? 'text.disabled' : 'text.primary' }}>{label}</Typography>
      <FormControl size="small" sx={{ minWidth: 172, flexShrink: 0 }} disabled={disabled}>
        <Select<RwdLevel>
          value={displayValue}
          onChange={(e) => onChange(e.target.value as RwdLevel)}
          renderValue={(v) => RWD_LEVEL_SHORT_LABEL[v]}
          sx={{ fontSize: 12.5 }}
        >
          {RWD_LEVEL_OPTIONS.map((opt) => {
            const optDisabled = rwdLevelIndex(opt.key) < floorIdx
            return (
              <MenuItem key={opt.key} value={opt.key} disabled={optDisabled} sx={{ fontSize: 12.5 }}>
                {opt.label}
                {optDisabled ? ' (dal gruppo)' : ''}
              </MenuItem>
            )
          })}
        </Select>
      </FormControl>
    </Stack>
  )
}

// ─── Matrice permessi per modulo ────────────────────────────────────────────
// Usata sia per l'utente (2 livelli: gruppo/diretto, con floor dal gruppo)
// sia per il gruppo (1 livello, nessun floor).
function PermissionMatrix(props: {
  modules: PermissionModule[]
  groupState?: Record<string, ModuleRwd>
  value: Record<string, ModuleRwd>
  onChange: (appLabel: string, level: RwdLevel) => void
  extraGroupSet?: Set<string>
  extraValueSet: Set<string>
  onToggleExtra: (codename: string, checked: boolean) => void
  sectionTitle?: string
  disabled?: boolean
}) {
  const { modules, groupState, value, onChange, extraGroupSet, extraValueSet, onToggleExtra, sectionTitle, disabled } = props
  const modulesWithExtras = modules.filter((m) => m.extra_permissions.length > 0)

  return (
    <Stack spacing={2}>
      <DrawerSection title={sectionTitle || 'Permessi per modulo'}>
        <Stack divider={<Divider sx={{ borderColor: 'grey.100' }} />}>
          {modules.map((m) => (
            <ModuleRwdSelect
              key={m.app_label}
              label={m.label}
              value={rwdToLevel(value[m.app_label])}
              floorLevel={groupState ? rwdToLevel(groupState[m.app_label]) : undefined}
              onChange={(level) => onChange(m.app_label, level)}
              disabled={disabled}
            />
          ))}
        </Stack>
      </DrawerSection>

      {modulesWithExtras.length > 0 && (
        <DrawerSection title="Permessi extra" variant="muted">
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
            Permessi speciali che non rientrano nello schema standard: vanno assegnati singolarmente.
          </Typography>
          <Stack spacing={0.5}>
            {modulesWithExtras.map((m) => (
              <Box key={m.app_label}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.disabled', mt: 1 }}>{m.label}</Typography>
                {m.extra_permissions.map((p) => {
                  const fromGroup = Boolean(extraGroupSet?.has(p.codename))
                  const direct = extraValueSet.has(p.codename)
                  const locked = fromGroup || disabled
                  return (
                    <FormControlLabel
                      key={p.codename}
                      sx={{ display: 'flex', ml: 0 }}
                      control={
                        <Tooltip title={fromGroup ? 'Concesso dal gruppo' : ''}>
                          <span>
                            <input
                              type="checkbox"
                              checked={fromGroup || direct}
                              disabled={locked}
                              onChange={(e) => onToggleExtra(p.codename, e.target.checked)}
                              style={{ width: 15, height: 15, cursor: locked ? 'not-allowed' : 'pointer', accentColor: TEAL, marginRight: 8 }}
                            />
                          </span>
                        </Tooltip>
                      }
                      label={<Typography sx={{ fontSize: 12.5, color: disabled ? 'text.disabled' : 'text.primary' }}>{p.name}</Typography>}
                    />
                  )
                })}
              </Box>
            ))}
          </Stack>
        </DrawerSection>
      )}
    </Stack>
  )
}

// ─── Dialog risultato reset password (one-shot) ────────────────────────────
function ResetPasswordResultDialog({ result, onClose }: { result: ResetPasswordResponse; onClose: () => void }) {
  const toast = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.password)
      toast.success('Password copiata negli appunti.')
    } catch {
      /* silenzioso */
    }
  }
  return (
    <Box
      sx={{ position: 'fixed', inset: 0, zIndex: 2000, bgcolor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
      onClick={onClose}
    >
      <Box onClick={(e) => e.stopPropagation()} sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 3, maxWidth: 420, width: '100%', boxShadow: 8 }}>
        <Typography sx={{ fontWeight: 800, mb: 1 }}>Password reimpostata</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
          Questa password viene mostrata una sola volta: comunicala all'utente e chiedigli di cambiarla al primo accesso.
        </Typography>
        <TextField
          value={result.password}
          fullWidth
          size="small"
          InputProps={{
            readOnly: true,
            sx: { fontFamily: 'monospace', fontSize: 14 },
            endAdornment: (
              <IconButton size="small" onClick={copy}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
        {!result.email_sent && (
          <Alert severity="warning" sx={{ mt: 2, fontSize: 12 }}>
            Email non inviata (SMTP non ancora configurato). Comunica la password manualmente.
          </Alert>
        )}
        {result.email_sent && (
          <Alert severity="success" sx={{ mt: 2, fontSize: 12 }}>
            Email inviata all'utente.
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={onClose} variant="contained" size="small">
            Chiuso
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Drawer utente ──────────────────────────────────────────────────────────
function UserDrawer(props: {
  open: boolean
  user: AdminUserRow | null
  groups: AdminGroupRow[]
  modules: PermissionModule[]
  leaveAreas: LeaveAreaOption[]
  onClose: () => void
  onSaved: (updated: AdminUserRow) => void
}) {
  const { open, user, groups, modules, leaveAreas, onClose, onSaved } = props
  const toast = useToast()
  const [tab, setTab] = React.useState<UserTabId>('anagrafica')
  const [saving, setSaving] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [resettingPw, setResettingPw] = React.useState(false)
  const [pwResult, setPwResult] = React.useState<ResetPasswordResponse | null>(null)

  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [groupIds, setGroupIds] = React.useState<number[]>([])

  const [isPhilips, setIsPhilips] = React.useState(false)
  const [isTechnician, setIsTechnician] = React.useState(true)
  const [isLeaveCoordinator, setIsLeaveCoordinator] = React.useState(false)
  const [isExpenseSecretary, setIsExpenseSecretary] = React.useState(false)
  const [leaveArea, setLeaveArea] = React.useState<number | ''>('')

  const [moduleDirect, setModuleDirect] = React.useState<Record<string, ModuleRwd>>({})
  const [extraDirect, setExtraDirect] = React.useState<Set<string>>(new Set())

  const [auslboLevel, setAuslboLevel] = React.useState<RwdLevel>('none')
  const [auslboCustomer, setAuslboCustomer] = React.useState<CustomerOption | null>(null)
  const [customerInput, setCustomerInput] = React.useState('')
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([])
  const [customerLoading, setCustomerLoading] = React.useState(false)

  React.useEffect(() => {
    if (!user) return
    setTab('anagrafica')
    setFirstName(user.first_name || '')
    setLastName(user.last_name || '')
    setEmail(user.email || '')
    setIsActive(user.is_active)
    setGroupIds(user.groups.map((g) => g.id))
    setModuleDirect(user.direct_permissions.modules)
    setExtraDirect(new Set(user.direct_permissions.extra_permissions))
    setIsPhilips(user.profile.is_philips)
    setIsTechnician(user.profile.is_servicenow_technician)
    setIsLeaveCoordinator(user.profile.is_leave_coordinator)
    setIsExpenseSecretary(user.profile.is_expense_secretary)
    setLeaveArea(user.profile.leave_area ?? '')
    setAuslboLevel(rwdToLevel(user.direct_permissions.modules['auslbo']))
    setAuslboCustomer(
      user.auslbo_profile ? { id: user.auslbo_profile.customer_id, label: user.auslbo_profile.customer_name } : null,
    )
    setCustomerInput('')
  }, [user])

  // Ricerca cliente per l'Autocomplete "Cliente collegato" (debounce 300ms).
  React.useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      setCustomerLoading(true)
      try {
        const res = await api.get('/customers/', { params: { search: customerInput || undefined, page_size: 25 } })
        const payload: unknown = res.data
        const list: unknown[] = Array.isArray(payload)
          ? payload
          : isRecord(payload) && Array.isArray(payload['results'])
            ? (payload['results'] as unknown[])
            : []
        if (alive) {
          setCustomerOptions(
            list
              .map((c) => toIdLabel(c, ['display_name', 'name']))
              .filter((x): x is CustomerOption => Boolean(x)),
          )
        }
      } catch {
        /* silenzioso */
      } finally {
        if (alive) setCustomerLoading(false)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [customerInput])

  const extraIdByCodename = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const m of modules) for (const p of m.extra_permissions) map.set(p.codename, p.id)
    return map
  }, [modules])

  const extraGroupSet = React.useMemo(
    () => (user ? new Set(user.group_permissions.extra_permissions) : new Set<string>()),
    [user],
  )

  const archieModules = React.useMemo(() => modules.filter((m) => !m.is_auslbo_dedicated), [modules])
  // "auslbo" non è mostrato come riga separata: è rappresentato dal controllo "Accesso AUSL BO".
  const auslboModules = React.useMemo(
    () => modules.filter((m) => m.is_auslbo_dedicated && m.app_label !== 'auslbo'),
    [modules],
  )

  if (!user) return null

  const auslboGroupFloor = rwdToLevel(user.group_permissions.modules['auslbo'])

  // Un utente Philips è un profilo circoscritto esclusivamente all'app
  // ServiceNow: diventa automaticamente tecnico, e gruppo/permessi Archie/
  // AUSL BO vengono azzerati e bloccati (enforced anche lato backend).
  const handlePhilipsChange = (checked: boolean) => {
    setIsPhilips(checked)
    if (checked) {
      setIsTechnician(true)
      setIsLeaveCoordinator(false)
      setIsExpenseSecretary(false)
      setLeaveArea('')
      setGroupIds([])
      setModuleDirect({})
      setExtraDirect(new Set())
      setAuslboLevel('none')
      setAuslboCustomer(null)
    }
  }

  const saveAnagrafica = async () => {
    setSaving(true)
    try {
      const res = await api.patch(`/admin-users/${user.id}/`, {
        first_name: firstName,
        last_name: lastName,
        email,
        is_active: isActive,
        group_ids: groupIds,
        profile: {
          is_philips: isPhilips,
          is_servicenow_technician: isTechnician,
          is_leave_coordinator: isLeaveCoordinator,
          is_expense_secretary: isExpenseSecretary,
          leave_area: leaveArea === '' ? null : leaveArea,
        },
      })
      onSaved(res.data as AdminUserRow)
      toast.success('Anagrafica aggiornata.')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const savePermessi = async () => {
    if (auslboLevel !== 'none' && !auslboCustomer) {
      toast.error("Seleziona un cliente per abilitare l'accesso AUSL BO.")
      return
    }
    setSaving(true)
    try {
      const extra_permission_ids = Array.from(extraDirect)
        .map((cn) => extraIdByCodename.get(cn))
        .filter((id): id is number => typeof id === 'number')
      const res = await api.patch(`/admin-users/${user.id}/`, {
        module_permissions: moduleDirect,
        extra_permission_ids,
        auslbo_access: { level: auslboLevel, customer_id: auslboCustomer?.id ?? null },
      })
      onSaved(res.data as AdminUserRow)
      toast.success('Permessi aggiornati.')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const doResetPassword = async () => {
    setResettingPw(true)
    try {
      const res = await api.post(`/admin-users/${user.id}/reset-password/`)
      setPwResult(res.data as ResetPasswordResponse)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setResettingPw(false)
    }
  }

  const doResetToGroup = async () => {
    setResetting(true)
    try {
      const res = await api.post(`/admin-users/${user.id}/reset-permissions-to-group/`)
      onSaved(res.data as AdminUserRow)
      toast.success("Permessi diretti azzerati: l'utente eredita ora solo dal gruppo.")
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setResetting(false)
    }
  }

  const hasDirectGrants = Object.values(moduleDirect).some((v) => v.r || v.w || v.d) || extraDirect.size > 0

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      gradient="teal"
      width={420}
      icon={
        <Avatar src={user.profile.avatar || undefined} sx={{ width: 38, height: 38, fontSize: 14, fontWeight: 800, bgcolor: 'rgba(255,255,255,0.22)', color: '#fff' }}>
          {!user.profile.avatar && initials(user)}
        </Avatar>
      }
      iconBare
      title={fullName(user)}
      tabs={['Anagrafica', 'Permessi']}
      tabValue={USER_TAB_IDS.indexOf(tab)}
      onTabChange={(v) => setTab(USER_TAB_IDS[v])}
    >
      {pwResult && <ResetPasswordResultDialog result={pwResult} onClose={() => setPwResult(null)} />}

      {tab === 'anagrafica' && (
        <Stack spacing={2}>
          <DrawerSection title="Dati utente">
            <Stack spacing={1.75}>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth size="small" />
                <TextField label="Cognome" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth size="small" />
              </Stack>
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth size="small" />
              <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Utente attivo" />
            </Stack>
          </DrawerSection>

          <DrawerSection title="Configurazioni">
            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch checked={isTechnician} disabled={isPhilips} onChange={(e) => setIsTechnician(e.target.checked)} />}
                label="Tecnico ServiceNow (assegnabile ai case)"
              />
              <FormControlLabel control={<Switch checked={isPhilips} onChange={(e) => handlePhilipsChange(e.target.checked)} />} label="Philips (altrimenti: Biotron)" />
              {isPhilips && (
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', ml: 5.5, mt: -0.5 }}>
                  Profilo circoscritto a ServiceNow: tecnico attivato in automatico; coordinatore ferie, segreteria
                  rimborsi, area ferie, gruppo e permessi Archie/AUSL BO bloccati a "Nessuno".
                </Typography>
              )}
              <FormControlLabel
                control={<Switch checked={isLeaveCoordinator} disabled={isPhilips} onChange={(e) => setIsLeaveCoordinator(e.target.checked)} />}
                label="Coordinatore piano ferie"
              />
              <FormControlLabel
                control={<Switch checked={isExpenseSecretary} disabled={isPhilips} onChange={(e) => setIsExpenseSecretary(e.target.checked)} />}
                label="Segreteria rimborsi spese"
              />
              <FormControl size="small" fullWidth sx={{ mt: 1 }} disabled={isPhilips}>
                <InputLabel id="leave-area-label">Area piano ferie</InputLabel>
                <Select<number | ''>
                  labelId="leave-area-label"
                  label="Area piano ferie"
                  value={leaveArea}
                  onChange={(e) => setLeaveArea(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <MenuItem value="">— Nessuna —</MenuItem>
                  {leaveAreas.map((la) => (
                    <MenuItem key={la.id} value={la.id}>
                      {la.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DrawerSection>

          <DrawerSection title="Gruppo">
            <Autocomplete
              multiple
              size="small"
              disabled={isPhilips}
              options={groups}
              getOptionLabel={(g) => g.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={groups.filter((g) => groupIds.includes(g.id))}
              onChange={(_, v) => setGroupIds(v.map((g) => g.id))}
              renderInput={(params) => <TextField {...params} label="Gruppi" placeholder="Seleziona gruppo/i" />}
            />
          </DrawerSection>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={saveAnagrafica} disabled={saving} size="small">
              Salva anagrafica
            </Button>
          </Box>

          <DrawerSection title="Password" variant="muted">
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.25 }}>
              Genera una nuova password casuale, mostrata una sola volta. Se l'utente ha un'email verrà anche
              inviata via posta (se la posta non è configurata, comunicala manualmente).
            </Typography>
            <Button variant="outlined" startIcon={<LockResetIcon />} onClick={doResetPassword} disabled={resettingPw} size="small">
              Reimposta password
            </Button>
          </DrawerSection>
        </Stack>
      )}

      {tab === 'permessi' && (
        <Stack spacing={2}>
          {isPhilips && (
            <Alert severity="info" sx={{ fontSize: 12 }}>
              Profilo Philips: circoscritto a ServiceNow. Permessi Archie e accesso AUSL BO bloccati a "Nessuno".
            </Alert>
          )}

          <PermissionMatrix
            modules={archieModules}
            groupState={user.group_permissions.modules}
            value={moduleDirect}
            onChange={(app, level) => setModuleDirect((prev) => ({ ...prev, [app]: LEVEL_TO_RWD[level] }))}
            extraGroupSet={extraGroupSet}
            extraValueSet={extraDirect}
            onToggleExtra={(codename, checked) =>
              setExtraDirect((prev) => {
                const next = new Set(prev)
                if (checked) next.add(codename)
                else next.delete(codename)
                return next
              })
            }
            sectionTitle="Permessi ARCHIE"
            disabled={isPhilips}
          />

          <DrawerSection title="Accesso AUSL BO">
            <ModuleRwdSelect
              label="Livello di accesso"
              value={auslboLevel}
              floorLevel={auslboGroupFloor}
              onChange={setAuslboLevel}
              disabled={isPhilips}
            />
            {auslboLevel !== 'none' && (
              <Autocomplete
                sx={{ mt: 1.5 }}
                size="small"
                options={customerOptions}
                loading={customerLoading}
                inputValue={customerInput}
                onInputChange={(_, v) => setCustomerInput(v)}
                value={auslboCustomer}
                onChange={(_, v) => setAuslboCustomer(v)}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                filterOptions={(x) => x}
                renderInput={(params) => (
                  <TextField {...params} label="Cliente collegato" placeholder="Cerca cliente…" required error={!auslboCustomer} />
                )}
              />
            )}
          </DrawerSection>

          {auslboLevel !== 'none' && auslboModules.length > 0 && (
            <PermissionMatrix
              modules={auslboModules}
              groupState={user.group_permissions.modules}
              value={moduleDirect}
              onChange={(app, level) => setModuleDirect((prev) => ({ ...prev, [app]: LEVEL_TO_RWD[level] }))}
              extraGroupSet={extraGroupSet}
              extraValueSet={extraDirect}
              onToggleExtra={(codename, checked) =>
                setExtraDirect((prev) => {
                  const next = new Set(prev)
                  if (checked) next.add(codename)
                  else next.delete(codename)
                  return next
                })
              }
              sectionTitle="AUSL BO — moduli dedicati"
            />
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Tooltip title="Azzera i permessi assegnati direttamente a questo utente: tornerà a ereditare solo quelli del/dei gruppo/i.">
              <span>
                <Button variant="text" color="warning" startIcon={<RestartAltIcon />} onClick={doResetToGroup} disabled={resetting || !hasDirectGrants} size="small">
                  Reset su gruppo
                </Button>
              </span>
            </Tooltip>
            <Button variant="contained" onClick={savePermessi} disabled={saving} size="small">
              Salva permessi
            </Button>
          </Stack>
        </Stack>
      )}
    </DrawerShell>
  )
}

// ─── Drawer gruppo ──────────────────────────────────────────────────────────
function GroupDrawer(props: {
  open: boolean
  group: AdminGroupRow | null
  modules: PermissionModule[]
  onClose: () => void
  onSaved: (updated: AdminGroupRow) => void
}) {
  const { open, group, modules, onClose, onSaved } = props
  const toast = useToast()
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState('')
  const [moduleValue, setModuleValue] = React.useState<Record<string, ModuleRwd>>({})
  const [extraValue, setExtraValue] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!group) return
    setName(group.name)
    setModuleValue(group.permissions_state.modules)
    setExtraValue(new Set(group.permissions_state.extra_permissions))
  }, [group])

  const extraIdByCodename = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const m of modules) for (const p of m.extra_permissions) map.set(p.codename, p.id)
    return map
  }, [modules])

  if (!group) return null

  const save = async () => {
    setSaving(true)
    try {
      const extra_permission_ids = Array.from(extraValue)
        .map((cn) => extraIdByCodename.get(cn))
        .filter((id): id is number => typeof id === 'number')
      const res = await api.patch(`/admin-groups/${group.id}/`, { name, module_permissions: moduleValue, extra_permission_ids })
      onSaved(res.data as AdminGroupRow)
      toast.success('Gruppo aggiornato.')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      gradient="blue"
      width={420}
      icon={<GroupOutlinedIcon />}
      title={group.name}
      subtitle={`${group.user_count} utente/i`}
    >
      <Stack spacing={2}>
        <DrawerSection title="Nome gruppo">
          <TextField value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
        </DrawerSection>

        <PermissionMatrix
          modules={modules}
          value={moduleValue}
          onChange={(app, level) => setModuleValue((prev) => ({ ...prev, [app]: LEVEL_TO_RWD[level] }))}
          extraValueSet={extraValue}
          onToggleExtra={(codename, checked) =>
            setExtraValue((prev) => {
              const next = new Set(prev)
              if (checked) next.add(codename)
              else next.delete(codename)
              return next
            })
          }
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={save} disabled={saving} size="small">
            Salva gruppo
          </Button>
        </Box>
      </Stack>
    </DrawerShell>
  )
}

// ─── Pagina principale ──────────────────────────────────────────────────────
const GRID_ZEBRA_SX = {
  '--DataGrid-rowHeight': '32px',
  '--DataGrid-headerHeight': '35px',
  '& .MuiDataGrid-cell': { py: 0.25 },
  '& .MuiDataGrid-columnHeader': { py: 0.75 },
  '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
  '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
  '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(69,127,121,0.10) !important' },
  '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(69,127,121,0.14) !important' },
} as const

export default function UsersAdmin() {
  const { me } = useAuth()
  const toast = useToast()
  const [mainTab, setMainTab] = React.useState<'utenti' | 'gruppi'>('utenti')
  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<AdminUserRow[]>([])
  const [groups, setGroups] = React.useState<AdminGroupRow[]>([])
  const [modules, setModules] = React.useState<PermissionModule[]>([])
  const [leaveAreas, setLeaveAreas] = React.useState<LeaveAreaOption[]>([])
  const [selectedUser, setSelectedUser] = React.useState<AdminUserRow | null>(null)
  const [selectedGroup, setSelectedGroup] = React.useState<AdminGroupRow | null>(null)

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

  const usersGrid = useLocalGrid<AdminUserRow>(users, ['username', 'first_name', 'last_name', 'email'])
  const groupsGrid = useLocalGrid<AdminGroupRow>(groups, ['name'])

  const userColumns: GridColDef<AdminUserRow>[] = [
    {
      field: 'username',
      headerName: 'Utente',
      flex: 1.3,
      minWidth: 200,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Tooltip title={`@${p.row.username}`}>
            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName(p.row)}
            </span>
          </Tooltip>
          {(p.row.is_staff || p.row.is_superuser) && (
            <Tooltip title={p.row.is_superuser ? 'Superuser' : 'Staff (accesso Django Admin)'}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>👑</span>
            </Tooltip>
          )}
        </Stack>
      ),
    },
    { field: 'email', headerName: 'Email', flex: 1.1, minWidth: 180 },
    {
      field: 'is_philips',
      headerName: 'Azienda',
      width: 100,
      sortable: false,
      valueGetter: (_v, row) => row.profile.is_philips,
      renderCell: (p) => (
        <Chip
          label={p.row.profile.is_philips ? 'PHILIPS' : 'BIOTRON'}
          size="small"
          sx={{
            fontSize: 10.5, height: 22, fontWeight: 700,
            bgcolor: p.row.profile.is_philips ? '#E0F2FE' : '#E2E8F0',
            color: p.row.profile.is_philips ? '#075985' : '#334155',
          }}
        />
      ),
    },
    {
      field: 'leave_area',
      headerName: 'Area',
      width: 140,
      sortable: false,
      valueGetter: (_v, row) => row.profile.leave_area_name,
      renderCell: (p) => {
        if (p.row.profile.is_philips || !p.row.profile.leave_area_name) {
          return <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>—</span>
        }
        return <Chip label={p.row.profile.leave_area_name} size="small" sx={{ fontSize: 11, height: 20 }} />
      },
    },
    {
      field: 'groups',
      headerName: 'Gruppi',
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          {p.row.groups.length === 0 ? (
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>—</span>
          ) : (
            p.row.groups.map((g) => <Chip key={g.id} label={g.name} size="small" sx={{ fontSize: 11, height: 20 }} />)
          )}
        </Stack>
      ),
    },
    {
      field: 'is_servicenow_technician',
      headerName: 'Tecnico SN',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      valueGetter: (_v, row) => row.profile.is_servicenow_technician,
      renderCell: (p) =>
        p.row.profile.is_servicenow_technician ? (
          <Tooltip title="Tecnico ServiceNow">
            <CheckCircleIcon sx={{ fontSize: 18, color: '#16A34A' }} />
          </Tooltip>
        ) : null,
    },
    {
      field: 'has_archie_access',
      headerName: 'ARCHIE',
      width: 90,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      valueGetter: (_v, row) => hasArchieAccess(row),
      renderCell: (p) =>
        hasArchieAccess(p.row) ? (
          <Tooltip title="Ha accesso al frontend Archie">
            <CheckCircleIcon sx={{ fontSize: 18, color: '#16A34A' }} />
          </Tooltip>
        ) : null,
    },
    {
      field: 'has_auslbo_access',
      headerName: 'AUSL BO',
      width: 90,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (p) =>
        p.row.has_auslbo_access ? (
          <Tooltip title="Ha accesso al portal AUSL BO">
            <CheckCircleIcon sx={{ fontSize: 18, color: '#16A34A' }} />
          </Tooltip>
        ) : null,
    },
    {
      field: 'is_active',
      headerName: 'Stato',
      width: 110,
      renderCell: (p) => (
        <Chip
          label={p.row.is_active ? 'Attivo' : 'Disattivo'}
          size="small"
          sx={{
            fontSize: 11, height: 22,
            bgcolor: p.row.is_active ? '#DCFCE7' : '#FEE2E2',
            color: p.row.is_active ? '#166534' : '#991B1B',
            border: '1px solid transparent',
          }}
        />
      ),
    },
    { field: 'last_login', headerName: 'Ultimo accesso', width: 160, valueGetter: (_v, row) => fmtDateTime(row.last_login) },
  ]

  const groupColumns: GridColDef<AdminGroupRow>[] = [
    { field: 'name', headerName: 'Gruppo', flex: 1, minWidth: 200 },
    { field: 'user_count', headerName: 'Utenti', width: 90 },
    {
      field: 'modules',
      headerName: 'Moduli con accesso',
      flex: 2,
      minWidth: 260,
      sortable: false,
      renderCell: (p) => {
        const active = Object.entries(p.row.permissions_state.modules)
          .filter(([, v]) => v.r || v.w || v.d)
          .map(([app]) => modules.find((m) => m.app_label === app)?.label || app)
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {active.length === 0 ? (
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Nessuno</span>
            ) : (
              <>
                {active.slice(0, 4).map((label) => (
                  <Chip key={label} label={label} size="small" sx={{ fontSize: 11, height: 20 }} />
                ))}
                {active.length > 4 && <Chip label={`+${active.length - 4}`} size="small" sx={{ fontSize: 11, height: 20 }} />}
              </>
            )}
          </Stack>
        )
      },
    },
  ]

  return (
    <Stack spacing={1.5} sx={{ height: '100%' }}>
      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ minHeight: 0, flexShrink: 0 }}>
        <Tab value="utenti" label="Utenti" icon={<PersonOutlineIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 0, py: 1, fontSize: 12.5 }} />
        <Tab value="gruppi" label="Gruppi" icon={<GroupOutlinedIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 0, py: 1, fontSize: 12.5 }} />
      </Tabs>

      {mainTab === 'utenti' ? (
        <EntityListCard
          toolbar={{ q: usersGrid.q, onQChange: usersGrid.setQ, compact: true, searchLabel: 'Cerca utente' }}
          grid={{
            pageKey: 'admin-users',
            username: me?.username,
            rows: usersGrid.rows,
            columns: userColumns,
            loading,
            rowCount: usersGrid.rowCount,
            paginationModel: usersGrid.paginationModel,
            onPaginationModelChange: usersGrid.onPaginationModelChange,
            sortModel: usersGrid.sortModel,
            onSortModelChange: usersGrid.onSortModelChange,
            onRowClick: (id) => setSelectedUser(users.find((u) => u.id === id) || null),
            sx: GRID_ZEBRA_SX,
          }}
        />
      ) : (
        <EntityListCard
          toolbar={{ q: groupsGrid.q, onQChange: groupsGrid.setQ, compact: true, searchLabel: 'Cerca gruppo' }}
          grid={{
            pageKey: 'admin-groups',
            username: me?.username,
            rows: groupsGrid.rows,
            columns: groupColumns,
            loading,
            rowCount: groupsGrid.rowCount,
            paginationModel: groupsGrid.paginationModel,
            onPaginationModelChange: groupsGrid.onPaginationModelChange,
            sortModel: groupsGrid.sortModel,
            onSortModelChange: groupsGrid.onSortModelChange,
            onRowClick: (id) => setSelectedGroup(groups.find((g) => g.id === id) || null),
            sx: GRID_ZEBRA_SX,
          }}
        />
      )}

      <UserDrawer
        open={Boolean(selectedUser)}
        user={selectedUser}
        groups={groups}
        modules={modules}
        leaveAreas={leaveAreas}
        onClose={() => setSelectedUser(null)}
        onSaved={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
          setSelectedUser(updated)
        }}
      />

      <GroupDrawer
        open={Boolean(selectedGroup)}
        group={selectedGroup}
        modules={modules}
        onClose={() => setSelectedGroup(null)}
        onSaved={(updated) => {
          setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
          setSelectedGroup(updated)
        }}
      />
    </Stack>
  )
}
