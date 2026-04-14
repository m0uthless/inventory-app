import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

import type { GridColDef } from '@mui/x-data-grid'

import { api } from '@shared/api/client'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import { useDrfList } from '@shared/hooks/useDrfList'
import ServerDataGrid from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import AuditActionChip, { type AuditAction } from '../ui/AuditActionChip'
import AuditEventDrawer from '../features/audit/AuditEventDrawer'
import FilterChip from '@shared/ui/FilterChip'
import { compactResetButtonSx } from '@shared/ui/toolbarStyles'
import { isString } from '@shared/utils/guards'

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
  'crm.customervpnaccess': 'VPN cliente',
  'inventory.inventory': 'Inventari',
  'issues.issue': 'Issue',
  'maintenance.tech': 'Tecnici',
  'maintenance.maintenanceplan': 'Piani di manutenzione',
  'maintenance.maintenanceplaninventory': 'Piani di manutenzione',
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

      <AuditEventDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
      />
    </Stack>
  )
}
