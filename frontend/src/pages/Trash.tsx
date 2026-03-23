import * as React from 'react'

import {
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  Stack,
} from '@mui/material'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { api } from '../api/client'
import { collectionActionPath, type CollectionPath } from '../api/apiPaths'
import { buildDrfListParams } from '../api/drf'
import { apiErrorToMessage } from '../api/error'
import { useServerGrid } from '../hooks/useServerGrid'
import { useToast } from '../ui/toast'
import { emptySelectionModel, selectionSize, selectionToIds } from '../utils/gridSelection'
import ServerDataGrid from '../ui/ServerDataGrid'
import ListToolbar from '../ui/ListToolbar'
import { useAuth } from '../auth/AuthProvider'
import ConfirmActionDialog from '../ui/ConfirmActionDialog'
import { PERMS } from '../auth/perms'
import { compactCreateButtonSx } from '../ui/toolbarStyles'

type TrashResourceKey =
  | 'customers'
  | 'sites'
  | 'contacts'
  | 'inventory'
  | 'maintenance-plans'
  | 'techs'
type TrashTypeKey = 'all' | TrashResourceKey

type ResourceCfg = {
  key: TrashResourceKey
  label: string
  collectionPath: CollectionPath
  endpoint: string
  restoreEndpoint: string
  purgeEndpoint: string
  viewPerm: string
  restorePerm: string
  purgePerm: string
  buildTitle: (row: Record<string, unknown>) => string
}

type ResourceCfgInput = Omit<ResourceCfg, 'endpoint' | 'restoreEndpoint' | 'purgeEndpoint'>

function makeResourceCfg(input: ResourceCfgInput): ResourceCfg {
  return {
    ...input,
    endpoint: input.collectionPath,
    restoreEndpoint: collectionActionPath(input.collectionPath, 'bulk_restore'),
    purgeEndpoint: collectionActionPath(input.collectionPath, 'bulk_purge'),
  }
}

type TrashRow = Record<string, unknown> & {
  id: number
  deleted_at?: string | null
  updated_at?: string | null
  __kind?: TrashResourceKey
  __rid?: string
  __title?: string
}

const RESOURCES: ResourceCfg[] = [
  makeResourceCfg({
    key: 'customers',
    label: 'Clienti',
    collectionPath: '/customers/',
    viewPerm: PERMS.crm.customer.view,
    restorePerm: PERMS.crm.customer.change,
    purgePerm: PERMS.crm.customer.delete,
    buildTitle: (r) =>
      `${String(r.code ?? '')} — ${String(r.display_name ?? r.name ?? 'Cliente')}`.trim(),
  }),
  makeResourceCfg({
    key: 'sites',
    label: 'Siti',
    collectionPath: '/sites/',
    viewPerm: PERMS.crm.site.view,
    restorePerm: PERMS.crm.site.change,
    purgePerm: PERMS.crm.site.delete,
    buildTitle: (r) =>
      `${r.customer_code ? String(r.customer_code) + ' · ' : ''}${String(r.display_name ?? r.name ?? 'Sito')}`.trim(),
  }),
  makeResourceCfg({
    key: 'contacts',
    label: 'Contatti',
    collectionPath: '/contacts/',
    viewPerm: PERMS.crm.contact.view,
    restorePerm: PERMS.crm.contact.change,
    purgePerm: PERMS.crm.contact.delete,
    buildTitle: (r) =>
      `${String(r.full_name ?? r.display_name ?? 'Contatto')}${r.email ? ' — ' + String(r.email) : ''}`.trim(),
  }),
  makeResourceCfg({
    key: 'inventory',
    label: 'Inventari',
    collectionPath: '/inventories/',
    viewPerm: PERMS.inventory.inventory.view,
    restorePerm: PERMS.inventory.inventory.change,
    purgePerm: PERMS.inventory.inventory.delete,
    buildTitle: (r) =>
      `${String(r.hostname ?? r.name ?? 'Inventario')}${r.knumber ? ' · ' + String(r.knumber) : ''}`.trim(),
  }),
  makeResourceCfg({
    key: 'maintenance-plans',
    label: 'Piani manutenzione',
    collectionPath: '/maintenance-plans/',
    viewPerm: PERMS.maintenance.plan.view,
    restorePerm: PERMS.maintenance.plan.change,
    purgePerm: PERMS.maintenance.plan.delete,
    buildTitle: (r) =>
      `${r.customer_code ? String(r.customer_code) + ' · ' : ''}${String(r.title ?? 'Piano')}`.trim(),
  }),
  makeResourceCfg({
    key: 'techs',
    label: 'Tecnici',
    collectionPath: '/techs/',
    viewPerm: PERMS.maintenance.tech.view,
    restorePerm: PERMS.maintenance.tech.change,
    purgePerm: PERMS.maintenance.tech.delete,
    buildTitle: (r) => {
      const fn = String(r.first_name ?? '').trim()
      const ln = String(r.last_name ?? '').trim()
      const full = String(r.full_name ?? '').trim() || `${fn} ${ln}`.trim() || 'Tecnico'
      return `${full}${r.email ? ' — ' + String(r.email) : ''}`.trim()
    },
  }),
]

type ApiPage<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

function fmt(ts?: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

export default function Trash() {
  const toast = useToast()
  const { hasPerm } = useAuth()

  const grid = useServerGrid({
    defaultOrdering: '-updated_at',
    allowedOrderingFields: ['updated_at', 'created_at', 'id', 'deleted_at'],
    defaultPageSize: 25,
  })

  const [typeKey, setTypeKey] = React.useState<TrashTypeKey>('all')
  const cfg = React.useMemo(
    () => (typeKey === 'all' ? null : RESOURCES.find((r) => r.key === typeKey)!),
    [typeKey],
  )

  React.useEffect(() => {
    if (grid.view !== 'deleted') grid.setViewMode('deleted', { keepOpen: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [rows, setRows] = React.useState<TrashRow[]>([])
  const [rowCount, setRowCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  const [selectionModel, setSelectionModel] =
    React.useState<GridRowSelectionModel>(emptySelectionModel())

  const [restoreBusy, setRestoreBusy] = React.useState(false)
  const [purgeBusy, setPurgeBusy] = React.useState(false)
  const [bulkRestoreDlgOpen, setBulkRestoreDlgOpen] = React.useState(false)
  const [bulkPurgeDlgOpen, setBulkPurgeDlgOpen] = React.useState(false)

  const visibleResources = React.useMemo(
    () => RESOURCES.filter((r) => hasPerm(r.viewPerm)),
    [hasPerm],
  )

  const selectionToIdStrings = React.useCallback(
    (m: GridRowSelectionModel): string[] => selectionToIds(m).map((v) => String(v)),
    [],
  )

  const selectedByType = React.useMemo(() => {
    const ids = selectionToIdStrings(selectionModel)
    const groups: Record<TrashResourceKey, number[]> = {
      customers: [],
      sites: [],
      contacts: [],
      inventory: [],
      'maintenance-plans': [],
      techs: [],
    }

    if (typeKey !== 'all') {
      for (const s of ids) {
        const n = Number(s)
        if (!Number.isNaN(n)) groups[typeKey].push(n)
      }
      return groups
    }

    for (const s of ids) {
      const [k, idStr] = s.split(':', 2)
      if (!k || !idStr) continue
      if (!Object.prototype.hasOwnProperty.call(groups, k)) continue
      const n = Number(idStr)
      if (!Number.isNaN(n)) groups[k as TrashResourceKey].push(n)
    }
    return groups
  }, [selectionModel, selectionToIdStrings, typeKey])

  const selectedCount = React.useMemo(() => selectionSize(selectionModel), [selectionModel])

  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) {
      return {
        title: 'Cestino vuoto',
        subtitle:
          typeKey === 'all'
            ? 'Non ci sono elementi eliminati.'
            : 'Non ci sono elementi eliminati per questo tipo.',
      }
    }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o tipo.' }
  }, [grid.search, typeKey])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        search: grid.search,
        ordering: grid.ordering,
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        includeDeleted: grid.includeDeleted,
        onlyDeleted: grid.onlyDeleted,
      }),
    [
      grid.search,
      grid.ordering,
      grid.paginationModel.page,
      grid.paginationModel.pageSize,
      grid.includeDeleted,
      grid.onlyDeleted,
    ],
  )

  const load = React.useCallback(async () => {
    // "Tutti" = merge client-side of visible resources.
    if (typeKey === 'all') {
      if (visibleResources.length === 0) {
        setRows([])
        setRowCount(0)
        return
      }

      setLoading(true)
      try {
        // Fetch enough items per resource to cover the current page after merging.
        const need = (grid.paginationModel.page + 1) * grid.paginationModel.pageSize
        const params = {
          ...listParams,
          page: 1,
          page_size: need,
        }

        const resps = await Promise.all(
          visibleResources.map((r) =>
            api
              .get<ApiPage<Record<string, unknown>>>(r.endpoint, { params })
              .then((x) => ({ cfg: r, data: x.data })),
          ),
        )

        const all: TrashRow[] = []
        let total = 0
        for (const rr of resps) {
          total += rr.data.count || 0
          for (const row of rr.data.results || []) {
            const rowId = Number((row as Record<string, unknown>)['id'])
            if (!Number.isFinite(rowId)) continue
            all.push({
              ...row,
              __kind: rr.cfg.key,
              id: rowId,
              __rid: `${rr.cfg.key}:${rowId}`,
              __title: rr.cfg.buildTitle(row),
            })
          }
        }

        // Apply ordering client-side (best-effort)
        const ord = (grid.ordering || '-deleted_at').trim()
        const dir = ord.startsWith('-') ? -1 : 1
        const field = ord.replace(/^[-+]/, '')
        all.sort((a, b) => {
          const av = a[field]
          const bv = b[field]
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1

          const avC = typeof av === 'number' ? av : String(av)
          const bvC = typeof bv === 'number' ? bv : String(bv)
          if (avC < bvC) return -1 * dir
          if (avC > bvC) return 1 * dir
          return 0
        })

        const start = grid.paginationModel.page * grid.paginationModel.pageSize
        const end = start + grid.paginationModel.pageSize
        setRows(all.slice(start, end))
        setRowCount(total)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setLoading(false)
      }
      return
    }

    // Single resource.
    if (!cfg || !hasPerm(cfg.viewPerm)) {
      setRows([])
      setRowCount(0)
      return
    }
    setLoading(true)
    try {
      const res = await api.get<ApiPage<TrashRow>>(cfg.endpoint, { params: listParams })
      setRows((res.data.results || []) as TrashRow[])
      setRowCount(res.data.count || 0)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [
    cfg,
    grid.ordering,
    grid.paginationModel.page,
    grid.paginationModel.pageSize,
    hasPerm,
    listParams,
    toast,
    typeKey,
    visibleResources,
  ])

  React.useEffect(() => {
    setSelectionModel(emptySelectionModel())
    load()
  }, [load, typeKey])

  const canBulkPurge =
    !purgeBusy &&
    grid.view === 'deleted' &&
    selectedCount > 0 &&
    (typeKey === 'all'
      ? RESOURCES.some((r) => hasPerm(r.purgePerm) && selectedByType[r.key].length)
      : cfg != null && hasPerm(cfg.purgePerm))

  const canBulkRestore =
    !restoreBusy &&
    grid.view === 'deleted' &&
    selectedCount > 0 &&
    (typeKey === 'all'
      ? RESOURCES.some((r) => hasPerm(r.restorePerm) && selectedByType[r.key].length)
      : cfg != null && hasPerm(cfg.restorePerm))

  const doBulkRestore = async (): Promise<boolean> => {
    if (!canBulkRestore) return false
    setRestoreBusy(true)
    try {
      if (typeKey === 'all') {
        const calls: Promise<unknown>[] = []
        let restored = 0
        let skipped = 0
        for (const r of RESOURCES) {
          const ids = selectedByType[r.key]
          if (!ids?.length) continue
          if (!hasPerm(r.restorePerm)) {
            skipped += ids.length
            continue
          }
          restored += ids.length
          calls.push(api.post(r.restoreEndpoint, { ids }))
        }
        await Promise.all(calls)
        if (restored > 0) toast.success(`Ripristinati ${restored} elementi ✅`)
        if (skipped > 0) toast.warning(`Saltati ${skipped} elementi (permessi mancanti).`)
      } else {
        const ids = selectedByType[typeKey]
        await api.post(cfg!.restoreEndpoint, { ids })
        toast.success(`Ripristinati ${selectedCount} elementi ✅`)
      }
      setSelectionModel(emptySelectionModel())
      load()
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
    return false
  }

  const doBulkPurge = async (): Promise<boolean> => {
    if (!canBulkPurge) return false
    setPurgeBusy(true)
    try {
      const blockedReasons: string[] = []
      let purged = 0
      let blockedCount = 0
      let skipped = 0

      const handleResp = (data: unknown) => {
        const payload = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {}
        const count = typeof payload.count === 'number' ? payload.count : 0
        purged += count
        const blocked = Array.isArray(payload.blocked) ? payload.blocked : []
        blockedCount += typeof payload.blocked_count === 'number' ? payload.blocked_count : blocked.length
        for (const item of blocked.slice(0, 3)) {
          if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).reason === 'string') {
            blockedReasons.push(String((item as Record<string, unknown>).reason))
          }
        }
      }

      if (typeKey === 'all') {
        for (const r of RESOURCES) {
          const ids = selectedByType[r.key]
          if (!ids?.length) continue
          if (!hasPerm(r.purgePerm)) {
            skipped += ids.length
            continue
          }
          const resp = await api.post(r.purgeEndpoint, { ids })
          handleResp(resp.data)
        }
      } else {
        const ids = selectedByType[typeKey]
        const resp = await api.post(cfg!.purgeEndpoint, { ids })
        handleResp(resp.data)
      }

      if (purged > 0) toast.success(`Eliminati definitivamente ${purged} elementi ✅`)
      if (blockedCount > 0) {
        const extra = blockedReasons.length ? ` ${blockedReasons[0]}` : ''
        toast.warning(`Bloccati ${blockedCount} elementi.${extra}`)
      }
      if (skipped > 0) toast.warning(`Saltati ${skipped} elementi (permessi mancanti).`)
      setSelectionModel(emptySelectionModel())
      load()
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setPurgeBusy(false)
    }
    return false
  }

  const cols: GridColDef<TrashRow>[] = [
    {
      field: '__kind',
      headerName: 'Tipo',
      width: 120,
      sortable: false,
      valueGetter: (_v, row) => {
        const k = row.__kind
        if (!k) return cfg?.label || '—'
        return RESOURCES.find((r) => r.key === k)?.label || k
      },
    },
    {
      field: '__id',
      headerName: 'ID',
      width: 90,
      sortable: false,
      valueGetter: (_v, row) => row.id,
    },
    {
      field: '__title',
      headerName: 'Oggetto',
      flex: 1,
      minWidth: 320,
      sortable: false,
      valueGetter: (_v, row) => row.__title || (cfg ? cfg.buildTitle(row) : '—'),
    },
    {
      field: 'deleted_at',
      headerName: 'Eliminato il',
      width: 190,
      sortable: true,
      valueGetter: (v) => v,
      renderCell: (p) => <span>{fmt(typeof p.value === 'string' ? p.value : null)}</span>,
    },
    {
      field: 'updated_at',
      headerName: 'Aggiornato',
      width: 190,
      sortable: true,
      valueGetter: (v) => v,
      renderCell: (p) => <span>{fmt(typeof p.value === 'string' ? p.value : null)}</span>,
    },
  ]

  return (
    <Stack spacing={2}>
      <ConfirmActionDialog
        open={bulkRestoreDlgOpen}
        busy={restoreBusy}
        title={`Ripristinare ${selectedCount} elementi?`}
        description={
          typeKey === 'all'
            ? `Verranno ripristinati ${selectedCount} elementi dal cestino.`
            : `Verranno ripristinati ${selectedCount} ${cfg!.label.toLowerCase()} dal cestino.`
        }
        confirmText="Ripristina"
        confirmColor="success"
        onClose={() => setBulkRestoreDlgOpen(false)}
        onConfirm={async () => {
          const ok = await doBulkRestore()
          if (ok) setBulkRestoreDlgOpen(false)
        }}
      />

      <ConfirmActionDialog
        open={bulkPurgeDlgOpen}
        busy={purgeBusy}
        title={`Eliminare definitivamente ${selectedCount} elementi?`}
        description={
          typeKey === 'all'
            ? `Gli elementi selezionati verranno rimossi in modo permanente. L'operazione non è reversibile.`
            : `I ${selectedCount} ${cfg!.label.toLowerCase()} selezionati verranno rimossi in modo permanente. L'operazione non è reversibile.`
        }
        confirmText="Elimina definitivamente"
        confirmColor="error"
        confirmStartIcon={<DeleteForeverIcon />}
        onClose={() => setBulkPurgeDlgOpen(false)}
        onConfirm={async () => {
          const ok = await doBulkPurge()
          if (ok) setBulkPurgeDlgOpen(false)
        }}
      />

      <Card>
        <CardContent sx={{ pt: 1.5, pb: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1.5}>
            <ListToolbar
              q={grid.q}
              onQChange={grid.setQ}
              compact
              rightActions={
                <Stack direction="row" spacing={1}>
                  <Tooltip
                    title={
                      canBulkRestore
                        ? 'Ripristina selezionati'
                        : 'Seleziona almeno un elemento da ripristinare'
                    }
                    arrow
                  >
                    <span>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={!canBulkRestore}
                        onClick={() => setBulkRestoreDlgOpen(true)}
                        sx={compactCreateButtonSx}
                      >
                        <RestoreFromTrashIcon />
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip
                    title={
                      canBulkPurge
                        ? 'Elimina definitivamente selezionati'
                        : 'Seleziona almeno un elemento da eliminare definitivamente'
                    }
                    arrow
                  >
                    <span>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!canBulkPurge}
                        onClick={() => setBulkPurgeDlgOpen(true)}
                        sx={[
                          compactCreateButtonSx,
                          (theme) => ({
                            bgcolor: theme.palette.error.main,
                            '&:hover': { bgcolor: theme.palette.error.dark },
                            '&:disabled': { bgcolor: theme.palette.action.disabledBackground },
                          }),
                        ]}
                      >
                        <DeleteForeverIcon />
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              }
            >
              <FormControl
                size="small"
                sx={{
                  width: { xs: '100%', md: 220 },
                  '& .MuiInputBase-root': {
                    height: 40,
                    fontSize: '0.95rem',
                    borderRadius: 1.5,
                  },
                }}
              >
                <InputLabel>Tipo</InputLabel>
                <Select
                  label="Tipo"
                  value={typeKey}
                  onChange={(e) => setTypeKey(e.target.value as TrashTypeKey)}
                >
                  <MenuItem value="all">Tutti</MenuItem>
                  {visibleResources.map((r) => (
                    <MenuItem key={r.key} value={r.key}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListToolbar>

            <Divider />

            {typeKey === 'all' && visibleResources.length === 0 ? (
              <Typography variant="body2" sx={{ opacity: 0.7, px: 0.5 }}>
                Non hai i permessi per visualizzare alcun tipo di dati.
              </Typography>
            ) : typeKey !== 'all' && cfg && !hasPerm(cfg.viewPerm) ? (
              <Typography variant="body2" sx={{ opacity: 0.7, px: 0.5 }}>
                Non hai i permessi per visualizzare questo tipo di dati.
              </Typography>
            ) : (
              <ServerDataGrid
                rows={rows}
                columns={cols}
                loading={loading}
                rowCount={rowCount}
                emptyState={emptyState}
                columnVisibilityModel={{ __kind: typeKey === 'all' }}
                paginationModel={grid.paginationModel}
                onPaginationModelChange={grid.onPaginationModelChange}
                sortModel={grid.sortModel}
                onSortModelChange={grid.onSortModelChange}
                checkboxSelection={grid.view === 'deleted'}
                rowSelectionModel={selectionModel}
                onRowSelectionModelChange={(m) => setSelectionModel(m as GridRowSelectionModel)}
                height={680}
                deletedField="deleted_at"
                getRowId={typeKey === 'all' ? (r: TrashRow) => r.__rid || r.id : undefined}
              />
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
