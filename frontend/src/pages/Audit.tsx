import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SearchIcon from '@mui/icons-material/Search'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CloseIcon from '@mui/icons-material/Close'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'

import type { GridColDef } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import { buildDrfListParams } from '../api/drf'
import { apiErrorToMessage } from '../api/error'
import { useServerGrid } from '../hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '../hooks/useUrlParam'
import { useDrfList } from '../hooks/useDrfList'
import ServerDataGrid from '../ui/ServerDataGrid'
import { useToast } from '../ui/toast'
import AuditActionChip, { type AuditAction } from '../ui/AuditActionChip'
import AuditDiffTable from '../ui/AuditDiffTable'
import FilterChip from '../ui/FilterChip'
import { compactResetButtonSx } from '../ui/toolbarStyles'
import { buildQuery } from '../utils/nav'
import { isRecord, isString } from '../utils/guards'

type AuditEvent = {
  id: number
  created_at: string
  action: AuditAction
  actor: number | null
  actor_username?: string | null
  actor_email?: string | null
  content_type_app?: string
  content_type_model?: string
  object_id?: string
  object_repr?: string
  subject?: string
  changes?: unknown
  entity_path?: string | null
  path?: string | null
  method?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata_summary?: Record<string, unknown> | null
}

type AuditEntity = { app_label: string; model: string }

type AuditActor = {
  id: number
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  label: string
}

const ENTITY_LABELS: Record<string, string> = {
  'crm.customer': 'Clienti',
  'crm.site': 'Siti',
  'crm.contact': 'Contatti',
  'inventory.inventory': 'Inventari',
  'issues.issue': 'Issue',
  'maintenance.tech': 'Tecnici',
  'maintenance.maintenanceplan': 'Piani di manutenzione',
  'maintenance.maintenancetemplate': 'Template di manutenzione',
  'maintenance.maintenanceevent': 'Eventi di manutenzione',
  'maintenance.maintenancenotification': 'Notifiche di manutenzione',
  'wiki.wikipage': 'Pagine wiki',
  'wiki.wikicategory': 'Categorie wiki',
  'wiki.wikiattachment': 'Allegati wiki',
  'wiki.wikilink': 'Link wiki',
  'wiki.wikiquery': 'Query',
  'feedback.reportrequest': 'Feedback',
  'drive.drivefolder': 'Cartelle drive',
  'drive.drivefile': 'File drive',
  'custom_fields.customfielddefinition': 'Definizioni campi custom',
  'auth.user': 'Utenti',
}

function fmt(ts?: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

async function copyToClipboard(text: string) {
  if (!text) return
  await navigator.clipboard.writeText(text)
}

function openEntityPath(ev: AuditEvent) {
  if (ev.entity_path) return ev.entity_path

  const app = (ev.content_type_app || '').toLowerCase()
  const model = (ev.content_type_model || '').toLowerCase()
  const oid = ev.object_id ? Number(ev.object_id) : NaN
  if (!Number.isFinite(oid)) return null

  if (app === 'crm' && model === 'customer') return `/customers${buildQuery({ open: oid })}`
  if (app === 'crm' && model === 'site') return `/sites${buildQuery({ open: oid })}`
  if (app === 'crm' && model === 'contact') return `/contacts${buildQuery({ open: oid })}`
  if (app === 'inventory' && model === 'inventory') return `/inventory${buildQuery({ open: oid })}`
  if (app === 'maintenance' && model === 'maintenanceplan') return `/maintenance${buildQuery({ tab: 'plans', open: oid })}`
  if (app === 'maintenance' && model === 'maintenanceevent') return `/maintenance${buildQuery({ tab: 'events', open: oid })}`
  if (app === 'maintenance' && model === 'maintenancenotification') return `/maintenance${buildQuery({ tab: 'notifications', open: oid })}`
  if (app === 'maintenance' && model === 'tech') return `/maintenance${buildQuery({ tab: 'techs', open: oid })}`
  if (app === 'issues' && model === 'issue') return `/issues${buildQuery({ open: oid })}`
  if (app === 'wiki' && model === 'wikipage') return `/wiki/${oid}`
  if (app === 'drive' && (model === 'drivefolder' || model === 'drivefile')) return '/drive'
  return null
}

function entityKey(app?: string, model?: string): string {
  const a = (app || '').toLowerCase()
  const m = (model || '').toLowerCase()
  if (!a || !m) return ''
  return `${a}.${m}`
}

function entityLabel(key: string): string {
  return ENTITY_LABELS[key] || key || '—'
}

function entityLabelForEvent(ev: Pick<AuditEvent, 'content_type_app' | 'content_type_model' | 'action'>): string {
  const key = entityKey(ev.content_type_app, ev.content_type_model)
  if (key) return entityLabel(key)

  const action = String(ev.action || '').toLowerCase()
  if (action === 'login' || action === 'login_failed' || action === 'logout') {
    return 'Autenticazione'
  }

  return 'Sistema'
}
function isAuditChanges(v: unknown): v is Record<string, { from: unknown; to: unknown }> {
  if (!isRecord(v)) return false
  const entries = Object.entries(v)
  if (!entries.length) return false
  // Heuristic: at least one entry contains {from,to}.
  return entries.some(([, ch]) => isRecord(ch) && 'from' in ch && 'to' in ch)
}

function toComparableAuditValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (v === '') return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return `${typeof v}:${String(v)}`
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const hasId = typeof obj.id === 'number' || typeof obj.id === 'string'
    const hasRepr = typeof obj.repr === 'string'
    if (hasId || hasRepr) {
      return `id:${hasId ? String(obj.id) : ''}|repr:${hasRepr ? String(obj.repr) : ''}`
    }
    try {
      return `json:${JSON.stringify(v)}`
    } catch {
      return `obj:${String(v)}`
    }
  }
  return `other:${String(v)}`
}

function hasVisibleAuditDiffs(v: unknown): boolean {
  if (!isAuditChanges(v)) return false
  return Object.values(v).some((ch) => toComparableAuditValue(ch?.from) !== toComparableAuditValue(ch?.to))
}

function fmtMetaValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function isMetadataSummary(v: unknown): v is Record<string, unknown> {
  return isRecord(v) && Object.keys(v).length > 0
}


const cols: GridColDef<AuditEvent>[] = [
  {
    field: 'created_at',
    headerName: 'Quando',
    width: 190,
    sortable: true,
    valueGetter: (v) => v,
    renderCell: (p) => <span>{fmt(isString(p.value) ? p.value : null)}</span>,
  },
  {
    field: 'action',
    headerName: 'Azione',
    width: 140,
    sortable: true,
    renderCell: (p) => <AuditActionChip action={String(p.value || '')} />,
  },
  {
    field: 'subject',
    headerName: 'Oggetto',
    flex: 1,
    minWidth: 280,
    sortable: false,
    valueGetter: (_v, row) => row.subject || row.object_repr || row.object_id || '—',
  },
  {
    field: 'actor_username',
    headerName: 'Utente',
    width: 180,
    sortable: false,
    valueGetter: (_v, row) => row.actor_username || '—',
  },
  {
    field: 'content_type_model',
    headerName: 'Tipo',
    width: 200,
    sortable: false,
    valueGetter: (_v, row) => entityLabelForEvent(row),
  },
]

// prettier-ignore
export default function Audit() {
  const toast = useToast()
  const nav = useNavigate()

  const grid = useServerGrid({
    defaultOrdering: '-created_at',
    allowedOrderingFields: ['created_at', 'action'],
    defaultPageSize: 25,
  })

  // filters
  const [action, setAction] = useUrlStringParam('action')
  const [appLabel, setAppLabel] = useUrlStringParam('app_label')
  const [model, setModel] = useUrlStringParam('model')
  const [objectId, setObjectId] = useUrlStringParam('object_id')
  const [actor, setActor] = useUrlNumberParam('actor')
  const [createdAfter, setCreatedAfter] = useUrlStringParam('created_after')
  const [createdBefore, setCreatedBefore] = useUrlStringParam('created_before')

  // entities (for dropdown)
  const [entities, setEntities] = React.useState<AuditEntity[]>([])
  const [entitiesLoading, setEntitiesLoading] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      setEntitiesLoading(true)
      try {
        const res = await api.get<AuditEntity[]>('/audit-events/entities/')
        if (!alive) return
        const raw = Array.isArray(res.data) ? res.data : []
        // stable sorting: known entities first (by label), then by key
        const sorted = [...raw].sort((a, b) => {
          const ka = entityKey(a.app_label, a.model)
          const kb = entityKey(b.app_label, b.model)
          const la = ENTITY_LABELS[ka] ? 0 : 1
          const lb = ENTITY_LABELS[kb] ? 0 : 1
          if (la !== lb) return la - lb
          const na = entityLabel(ka).toLowerCase()
          const nb = entityLabel(kb).toLowerCase()
          if (na !== nb) return na.localeCompare(nb)
          return ka.localeCompare(kb)
        })
        setEntities(sorted)
      } catch {
        // non-blocking
      } finally {
        if (alive) setEntitiesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // actors autocomplete
  const [actorOptions, setActorOptions] = React.useState<AuditActor[]>([])
  const [actorInput, setActorInput] = React.useState('')
  const [actorsLoading, setActorsLoading] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    const t = window.setTimeout(async () => {
      setActorsLoading(true)
      try {
        const res = await api.get<AuditActor[]>('/audit-events/actors/', {
          params: actorInput.trim() ? { q: actorInput.trim() } : {},
        })
        if (!alive) return
        setActorOptions(Array.isArray(res.data) ? res.data : [])
      } catch {
        if (alive) setActorOptions([])
      } finally {
        if (alive) setActorsLoading(false)
      }
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [actorInput])

  // ensure the selected actor is present in options (so the label is nice)
  React.useEffect(() => {
    let alive = true
    ;(async () => {
      if (actor === '') return
      if (actorOptions.some((o) => o.id === actor)) return
      try {
        const res = await api.get<AuditActor[]>('/audit-events/actors/', { params: { id: actor } })
        if (!alive) return
        const arr = Array.isArray(res.data) ? res.data : []
        if (arr.length) setActorOptions((prev) => [...arr, ...prev])
      } catch {
        // ignore
      }
    })()
    return () => {
      alive = false
    }
  }, [actor, actorOptions])

  const selectedActor = React.useMemo(() => {
    if (actor === '') return null
    return actorOptions.find((o) => o.id === actor) || { id: actor, label: `#${actor}` }
  }, [actor, actorOptions])

  const selectedEntityKey = React.useMemo(() => entityKey(appLabel, model), [appLabel, model])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        extra: {
          ...(action.trim() ? { action: action.trim() } : {}),
          ...(appLabel.trim() ? { app_label: appLabel.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(objectId.trim() ? { object_id: objectId.trim() } : {}),
          ...(actor !== '' ? { actor } : {}),
          ...(createdAfter.trim() ? { created_after: createdAfter.trim() } : {}),
          ...(createdBefore.trim() ? { created_before: createdBefore.trim() } : {}),
        },
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      action,
      appLabel,
      model,
      objectId,
      actor,
      createdAfter,
      createdBefore,
    ],
  )

  const { rows, rowCount, loading } = useDrfList<AuditEvent>(
    '/audit-events/',
    listParams,
    (e: unknown) => toast.error(apiErrorToMessage(e)),
  )

  // drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<AuditEvent | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const loadDetail = React.useCallback(
    async (id: number) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const res = await api.get<AuditEvent>(`/audit-events/${id}/`)
        setDetail(res.data)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  // open drawer from URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id)
  }, [grid.openId, loadDetail])

  const openDrawer = (id: number) => {
    setSelectedId(id)
    setDrawerOpen(true)
    loadDetail(id)
    grid.setOpenId(id)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    grid.setOpenId(null)
  }

  const resetFilters = () => {
    // Clear URL-managed filters + reset grid state (search/page/ordering).
    grid.reset([
      'action',
      'app_label',
      'model',
      'object_id',
      'actor',
      'created_after',
      'created_before',
    ])
  }

  // quanti filtri nel chip sono attivi
  const chipActiveCount =
    (action.trim() ? 1 : 0) +
    (selectedEntityKey ? 1 : 0) +
    (actor !== '' ? 1 : 0) +
    (objectId.trim() ? 1 : 0)

  // sx riutilizzabile per i TextField piccoli della toolbar
  const inputSx = {
    '& .MuiInputLabel-root': { fontSize: 12 },
    '& .MuiInputBase-input': { fontSize: 12, py: 0 },
    '& .MuiOutlinedInput-root': {
      fontSize: 12,
      height: 40,
      borderRadius: 1,
    },
  } as const

  const selectSx = {
    '& .MuiInputLabel-root': { fontSize: 12 },
    '& .MuiSelect-select': {
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
    },
    '& .MuiOutlinedInput-root': {
      fontSize: 12,
      height: 40,
      borderRadius: 1,
    },
  } as const

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ pt: 1.5, pb: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1.5}>
            {/* ── Toolbar principale ─────────────────────────────────────── */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
              flexWrap="wrap"
            >
              {/* Cerca — uguale a ListToolbar / Customers */}
              <TextField
                size="small"
                label="Cerca"
                placeholder="Cerca"
                value={grid.q}
                onChange={(e) => grid.setQ(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0, ...inputSx }}
              />

              {/* Da */}
              <TextField
                size="small"
                label="Da"
                type="datetime-local"
                value={createdAfter}
                onChange={(e) =>
                  setCreatedAfter(e.target.value, { patch: { page: 1 }, keepOpen: true })
                }
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0, ...inputSx }}
              />

              {/* A */}
              <TextField
                size="small"
                label="A"
                type="datetime-local"
                value={createdBefore}
                onChange={(e) =>
                  setCreatedBefore(e.target.value, { patch: { page: 1 }, keepOpen: true })
                }
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0, ...inputSx }}
              />

              {/* FilterChip — tutti gli altri filtri */}
              <FilterChip
                compact
                activeCount={chipActiveCount}
                onReset={() => {
                  setAction('', { patch: { page: 1 }, keepOpen: true })
                  setAppLabel('', { patch: { page: 1 }, keepOpen: true })
                  setModel('', { patch: { page: 1 }, keepOpen: true })
                  setObjectId('', { patch: { page: 1 }, keepOpen: true })
                  setActor('', { patch: { page: 1 }, keepOpen: true })
                }}
              >
                {/* Azione */}
                <FormControl size="small" fullWidth sx={selectSx}>
                  <InputLabel>Azione</InputLabel>
                  <Select
                    label="Azione"
                    value={action}
                    onChange={(e) =>
                      setAction(String(e.target.value), { patch: { page: 1 }, keepOpen: true })
                    }
                  >
                    <MenuItem value="">Tutte</MenuItem>
                    <MenuItem value="create">Creato</MenuItem>
                    <MenuItem value="update">Modificato</MenuItem>
                    <MenuItem value="delete">Eliminato</MenuItem>
                    <MenuItem value="restore">Ripristinato</MenuItem>
                    <MenuItem value="login">Login</MenuItem>
                    <MenuItem value="login_failed">Login fallito</MenuItem>
                    <MenuItem value="logout">Logout</MenuItem>
                  </Select>
                </FormControl>

                {/* Entità */}
                <FormControl size="small" fullWidth sx={selectSx}>
                  <InputLabel>Entità</InputLabel>
                  <Select
                    label="Entità"
                    value={selectedEntityKey}
                    onChange={(e) => {
                      const v = String(e.target.value)
                      if (!v) {
                        setAppLabel('', { patch: { page: 1 }, keepOpen: true })
                        setModel('', { patch: { page: 1 }, keepOpen: true })
                        return
                      }
                      const [a, m] = v.split('.')
                      setAppLabel(a || '', { patch: { page: 1 }, keepOpen: true })
                      setModel(m || '', { patch: { page: 1 }, keepOpen: true })
                    }}
                  >
                    <MenuItem value="">Tutte</MenuItem>
                    {entitiesLoading ? (
                      <MenuItem value="" disabled>
                        Caricamento…
                      </MenuItem>
                    ) : (
                      entities.map((e) => {
                        const k = entityKey(e.app_label, e.model)
                        return (
                          <MenuItem key={k} value={k}>
                            {entityLabel(k)}
                          </MenuItem>
                        )
                      })
                    )}
                  </Select>
                </FormControl>

                {/* Utente */}
                <Autocomplete<AuditActor>
                  options={actorOptions}
                  loading={actorsLoading}
                  value={selectedActor}
                  onChange={(_e, v) =>
                    setActor(v ? v.id : '', { patch: { page: 1 }, keepOpen: true })
                  }
                  inputValue={actorInput}
                  onInputChange={(_e, v) => setActorInput(v)}
                  getOptionLabel={(o) => o.label}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} sx={{ fontSize: 12, minHeight: 36 }}>
                      {option.label}
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Utente"
                      placeholder="Cerca…"
                      sx={inputSx}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {actorsLoading ? <CircularProgress size={14} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  fullWidth
                />

                {/* Object ID */}
                <TextField
                  size="small"
                  label="Object ID"
                  value={objectId}
                  onChange={(e) =>
                    setObjectId(e.target.value, { patch: { page: 1 }, keepOpen: true })
                  }
                  sx={inputSx}
                  fullWidth
                />
              </FilterChip>

              {/* Reset — tutto a destra */}
              <Box sx={{ ml: { md: 'auto' }, display: 'flex' }}>
                <Tooltip title="Reimposta" arrow>
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={resetFilters}
                      sx={compactResetButtonSx}
                    >
                      <RestartAltIcon />
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Stack>

            <Divider />

            <ServerDataGrid
              rows={rows}
              columns={cols}
              loading={loading}
              rowCount={rowCount}
              paginationModel={grid.paginationModel}
              onPaginationModelChange={grid.onPaginationModelChange}
              sortModel={grid.sortModel}
              onSortModelChange={grid.onSortModelChange}
              onRowClick={openDrawer}
              height={680}
              pageSizeOptions={[25]}
              deletedField="__never__"
              showGridToolbar={false}
              footerLabel="Eventi"
              emptyState={
                grid.search.trim() || action || appLabel || model || actor || createdAfter || createdBefore
                  ? { title: 'Nessun risultato', subtitle: 'Nessun evento corrisponde ai filtri selezionati.' }
                  : { title: 'Nessun evento audit', subtitle: 'Gli eventi vengono registrati automaticamente al primo utilizzo.' }
              }
              sx={
                {
                  '--DataGrid-rowHeight': '24px',
                  '--DataGrid-headerHeight': '35px',
                  '& .MuiDataGrid-cell': { py: 0.25 },
                  '& .MuiDataGrid-columnHeader': { py: 0.75 },
                  '& .MuiDataGrid-row:nth-of-type(even)': {
                    backgroundColor: 'rgba(69,127,121,0.03)',
                  },
                  '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
                  '& .MuiDataGrid-row.Mui-selected': {
                    backgroundColor: 'rgba(69,127,121,0.10) !important',
                  },
                  '& .MuiDataGrid-row.Mui-selected:hover': {
                    backgroundColor: 'rgba(69,127,121,0.14) !important',
                  },
                }
              }
            />
          </Stack>
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, display: 'flex', flexDirection: 'column' } }}
      >
        {detailLoading ? <Box sx={{ height: 2 }} /> : null}

        {detail ? (
          <>
            <Box
              sx={{
                px: 2.5,
                pt: 2.25,
                pb: 2.1,
                background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.18,
                  background:
                    'radial-gradient(circle at top right, rgba(255,255,255,0.26), transparent 36%), radial-gradient(circle at bottom left, rgba(255,255,255,0.16), transparent 30%)',
                }}
              />

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}
              >
                <AuditActionChip action={detail.action} size="medium" />
                <Stack direction="row" spacing={0.75}>
                  <Tooltip title="Copia ID">
                    <span>
                      <IconButton
                        aria-label="Copia ID"
                        size="small"
                        onClick={() => copyToClipboard(String(detail.id))}
                        sx={{
                          color: 'rgba(255,255,255,0.85)',
                          bgcolor: 'rgba(255,255,255,0.12)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {openEntityPath(detail) ? (
                    <Tooltip title="Apri oggetto">
                      <span>
                        <IconButton
                          aria-label="Apri oggetto"
                          size="small"
                          onClick={() => nav(openEntityPath(detail) as string)}
                          sx={{
                            color: 'rgba(255,255,255,0.85)',
                            bgcolor: 'rgba(255,255,255,0.12)',
                            borderRadius: 1.5,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                          }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                  <Tooltip title="Chiudi">
                    <IconButton
                      aria-label="Chiudi"
                      size="small"
                      onClick={closeDrawer}
                      sx={{
                        color: 'rgba(255,255,255,0.85)',
                        bgcolor: 'rgba(255,255,255,0.12)',
                        borderRadius: 1.5,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography
                  sx={{
                    color: '#fff',
                    fontSize: 26,
                    fontWeight: 900,
                    letterSpacing: '-0.025em',
                    lineHeight: 1.1,
                    mb: 0.5,
                    wordBreak: 'break-word',
                  }}
                >
                  {detail.subject || detail.object_repr || (selectedId ? `Evento #${selectedId}` : 'Evento')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                  {entityLabelForEvent(detail)}
                  {detail.created_at ? ` • ${fmt(detail.created_at)}` : ''}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                px: 2.5,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <HistoryEduOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  Evento
                </Typography>
                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Tipo
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                      {entityLabelForEvent(detail)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      ID evento
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                      {detail.id}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Oggetto
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', maxWidth: 300, wordBreak: 'break-word' }}>
                      {detail.subject || detail.object_repr || '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Quando
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                      {fmt(detail.created_at)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  Utente
                </Typography>
                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Username
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>
                      {detail.actor_username || '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Email
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>
                      {detail.actor_email || '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }} spacing={2}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      IP
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                      {detail.ip_address || '—'}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

              {isMetadataSummary(detail.metadata_summary) ? (
                <Box
                  sx={{
                    bgcolor: '#fff',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ px: 1.75, pt: 1.5, pb: 1.0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: 'text.disabled',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                      }}
                    >
                      <HistoryEduOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Metadati
                    </Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100', px: 1.75, py: 1.25 }}>
                    <Stack spacing={1}>
                      {Object.entries(detail.metadata_summary).map(([key, value]) => (
                        <Stack key={key} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            {key}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, textAlign: 'right', maxWidth: 320, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                          >
                            {fmtMetaValue(value)}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              ) : null}

              {detail.action === 'update' && hasVisibleAuditDiffs(detail.changes) ? (
                <Box
                  sx={{
                    bgcolor: '#fff',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ px: 1.75, pt: 1.5, pb: 1.0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: 'text.disabled',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                      }}
                    >
                      <NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Modifiche
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      borderTop: '1px solid',
                      borderColor: 'grey.100',
                      px: 1.75,
                      py: 1.25,
                      '& .MuiTableCell-root': {
                        fontSize: 13,
                        borderColor: 'grey.100',
                        verticalAlign: 'top',
                        fontFamily: 'inherit',
                      },
                      '& .MuiTableHead-root .MuiTableCell-root': {
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'text.disabled',
                        bgcolor: '#f8fafc',
                      },
                      '& .MuiTableBody-root .MuiTableCell-root:first-of-type': {
                        fontWeight: 700,
                        color: 'text.primary',
                      },
                      '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
                        bgcolor: 'rgba(15,118,110,0.03)',
                      },
                    }}
                  >
                    <AuditDiffTable
                      changes={detail.changes as Record<string, { from: unknown; to: unknown }>}
                      emptyLabel="Nessuna differenza registrata."
                    />
                  </Box>
                </Box>
              ) : null}
            </Box>
          </>
        ) : detailLoading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2, px: 2.5 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Caricamento…
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ opacity: 0.7, px: 2.5, py: 2 }}>
            —
          </Typography>
        )}
      </Drawer>
    </Stack>
  )
}
