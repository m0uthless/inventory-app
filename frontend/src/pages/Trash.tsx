import * as React from 'react'
import { Box, Button, IconButton, InputBase, Stack, Tooltip, Typography } from '@mui/material'
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined'
import LibraryAddCheckOutlinedIcon from '@mui/icons-material/LibraryAddCheckOutlined'
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'

import { api } from '@shared/api/client'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useToast } from '@shared/ui/toast'
import { emptySelectionModel, selectionToIds } from '@shared/utils/gridSelection'
import EntityListCard from '@shared/ui/EntityListCard'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon, PageHead, ViewTabs } from '../ui/campo'
import {
  TRASH_RESOURCES, agoLabel, canPurgeKind, groupByKind, resourceOf, toRow,
  type TrashInfo, type TrashKind, type TrashRow,
} from '../features/trash/trashModel'
import { PurgeDialog, TrashItemCell, TrashState, TrashWhen } from '../features/trash/trashUi'

type Tab = 'all' | TrashKind
type ApiPage<T> = { count: number; next: string | null; results: T[] }
type Raw = Record<string, unknown>
type InfoResp = Partial<Record<TrashKind, Record<string, TrashInfo>>>

/** Aggiunge alle righe i blocchi e "eliminato da" (GET /trash/info/). */
async function withInfo(rows: TrashRow[]): Promise<TrashRow[]> {
  if (!rows.length) return rows
  const groups = groupByKind(rows)
  const params: Record<string, string> = {}
  ;(Object.keys(groups) as TrashKind[]).forEach((k) => { params[k] = (groups[k] ?? []).join(',') })
  try {
    const { data } = await api.get<InfoResp>('/trash/info/', { params })
    return rows.map((r) => ({ ...r, info: data[r.kind]?.[String(r.id)] }))
  } catch {
    return rows
  }
}

export default function Trash() {
  const toast = useToast()
  const { hasPerm } = useAuth()

  const grid = useServerGrid({
    defaultOrdering: '-deleted_at',
    allowedOrderingFields: ['deleted_at', 'updated_at', 'created_at', 'id'],
    defaultPageSize: 25,
  })
  React.useEffect(() => {
    if (grid.view !== 'deleted') grid.setViewMode('deleted', { keepOpen: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = React.useMemo(() => TRASH_RESOURCES.filter((r) => hasPerm(r.viewPerm)), [hasPerm])
  const [tab, setTab] = React.useState<Tab>('all')
  const [rows, setRows] = React.useState<TrashRow[]>([])
  const [rowCount, setRowCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [counts, setCounts] = React.useState<Partial<Record<TrashKind, number>>>({})
  const [tick, setTick] = React.useState(0)
  const reload = () => setTick((t) => t + 1)
  const [selection, setSelection] = React.useState<GridRowSelectionModel>(emptySelectionModel())
  const [busy, setBusy] = React.useState(false)
  const [purgeRows, setPurgeRows] = React.useState<TrashRow[] | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(Boolean(grid.q))

  // Conteggi per le schede.
  React.useEffect(() => {
    let alive = true
    Promise.all(visible.map((r) => api.get<ApiPage<Raw>>(r.endpoint, { params: { only_deleted: 1, include_deleted: 1, page_size: 1 } })
      .then((x) => [r.key, x.data.count || 0] as const).catch(() => [r.key, 0] as const)))
      .then((list) => { if (alive) setCounts(Object.fromEntries(list)) })
    return () => { alive = false }
  }, [visible, tick])

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering, page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize, onlyDeleted: true,
  }), [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize])

  React.useEffect(() => {
    let alive = true
    const run = async () => {
      setLoading(true)
      try {
        if (tab === 'all') {
          // "Tutto": unione lato client dei tipi visibili, ordinata per data di eliminazione.
          const need = (grid.paginationModel.page + 1) * grid.paginationModel.pageSize
          const resps = await Promise.all(visible.map((r) => api.get<ApiPage<Raw>>(r.endpoint, { params: { ...listParams, page: 1, page_size: need } }).then((x) => ({ r, data: x.data }))))
          let total = 0
          const all: TrashRow[] = []
          resps.forEach(({ r, data }) => { total += data.count || 0; (data.results || []).forEach((raw) => { const row = toRow(r.key, raw); if (row) all.push(row) }) })
          const desc = !String(grid.ordering || '-deleted_at').startsWith('deleted_at')
          all.sort((a, b) => (a.deleted_at ?? '').localeCompare(b.deleted_at ?? '') * (desc ? -1 : 1))
          const start = grid.paginationModel.page * grid.paginationModel.pageSize
          const page = await withInfo(all.slice(start, start + grid.paginationModel.pageSize))
          if (alive) { setRows(page); setRowCount(total) }
        } else {
          const r = resourceOf(tab)
          const { data } = await api.get<ApiPage<Raw>>(r.endpoint, { params: listParams })
          const page = await withInfo((data.results || []).map((raw) => toRow(tab, raw)).filter((x): x is TrashRow => x !== null))
          if (alive) { setRows(page); setRowCount(data.count || 0) }
        }
      } catch (e) {
        if (alive) toast.error(apiErrorToMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    if (tab !== 'all' && !visible.some((r) => r.key === tab)) { setRows([]); setRowCount(0); return }
    void run()
    return () => { alive = false }
  }, [tab, visible, listParams, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, toast, tick])

  React.useEffect(() => { setSelection(emptySelectionModel()) }, [tab, tick])

  // La tabella può descrivere "seleziona tutti" come { type: 'exclude', ids: esclusi }.
  const selModel = selection as unknown as { type?: string; ids?: Set<string | number> }
  const selected = selModel.type === 'exclude'
    ? rows.filter((r) => !selModel.ids?.has(r.rid))
    : rows.filter((r) => new Set(selectionToIds(selection).map(String)).has(r.rid))
  const selectedIds = new Set(selected.map((r) => r.rid))
  const canPurgeAny = visible.some((r) => canPurgeKind(r, hasPerm))
  // La colonna delle caselle compare solo con una selezione in corso (tasto destro → Seleziona).
  const selecting = selected.length > 0
  const clearSelection = () => setSelection(emptySelectionModel())
  const setSelectedIds = (ids: string[]) => setSelection({ type: 'include', ids: new Set(ids) } as unknown as GridRowSelectionModel)

  // ── Azioni ──
  const restore = async (list: TrashRow[]) => {
    const ok = list.filter((r) => !r.info?.restore_block && hasPerm(resourceOf(r.kind).restorePerm))
    const skipped = list.length - ok.length
    if (!ok.length) { toast.warning('Nessuno degli elementi selezionati si può ripristinare ora.'); return }
    setBusy(true)
    try {
      const groups = groupByKind(ok)
      await Promise.all((Object.keys(groups) as TrashKind[]).map((k) => api.post(resourceOf(k).restoreEndpoint, { ids: groups[k] })))
      toast.success(ok.length === 1 ? `«${ok[0].title}» ripristinato.` : `${ok.length} elementi ripristinati.`)
      if (skipped) toast.warning(`${skipped} ${skipped === 1 ? 'elemento resta' : 'elementi restano'} nel cestino: va ripristinato prima il padre o mancano i permessi.`)
      reload()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const purge = async (list: TrashRow[]) => {
    const ok = list.filter((r) => canPurgeKind(resourceOf(r.kind), hasPerm))
    setBusy(true)
    try {
      const groups = groupByKind(ok)
      let purged = 0; const blocked: string[] = []
      for (const k of Object.keys(groups) as TrashKind[]) {
        const { data } = await api.post<{ count?: number; blocked?: { reason?: string }[] }>(resourceOf(k).purgeEndpoint, { ids: groups[k] })
        purged += data.count ?? 0
        ;(data.blocked ?? []).forEach((b) => blocked.push(b.reason ?? ''))
      }
      if (purged) toast.success(purged === 1 ? 'Elemento eliminato definitivamente.' : `${purged} elementi eliminati definitivamente.`)
      if (blocked.length) toast.warning(`${blocked.length} ${blocked.length === 1 ? 'elemento è rimasto' : 'elementi sono rimasti'} nel cestino. ${blocked[0]}`.trim())
      if (list.length > ok.length) toast.warning(`Saltati ${list.length - ok.length} elementi: permessi mancanti.`)
      setPurgeRows(null)
      reload()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /** "Svuota il cestino": tutti gli elementi dei tipi che l'utente può eliminare. */
  const askEmpty = async () => {
    setBusy(true)
    try {
      const all: TrashRow[] = []
      for (const r of visible.filter((x) => canPurgeKind(x, hasPerm))) {
        for (let page = 1; page < 50; page++) {
          const { data } = await api.get<ApiPage<Raw>>(r.endpoint, { params: { only_deleted: 1, include_deleted: 1, page, page_size: 200 } })
          ;(data.results || []).forEach((raw) => { const row = toRow(r.key, raw); if (row) all.push(row) })
          if (!data.next) break
        }
      }
      if (!all.length) { toast.info('Il cestino è già vuoto.'); return }
      setPurgeRows(await withInfo(all))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // ── Tabella ──
  const actionsCell = (row: TrashRow) => {
    const r = resourceOf(row.kind)
    const canRestore = hasPerm(r.restorePerm)
    const canPurge = canPurgeKind(r, hasPerm)
    const blockedRestore = row.info?.restore_block
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }} onClick={(e) => e.stopPropagation()}>
        <Tooltip title={blockedRestore ?? (canRestore ? '' : 'Permessi mancanti')}>
          <span>
            <Button size="small" variant="outlined" disabled={!canRestore || Boolean(blockedRestore) || busy} onClick={() => void restore([row])}
              startIcon={<CampoIcon name="restore" size={14} />} sx={{ height: 28, fontSize: 12 }}>Ripristina</Button>
          </span>
        </Tooltip>
        <Tooltip title={canPurge ? 'Elimina definitivamente' : 'Permessi mancanti'}>
          <span>
            <IconButton size="small" aria-label={`Elimina definitivamente ${row.title}`} disabled={!canPurge || busy} onClick={() => setPurgeRows([row])}
              sx={{ width: 28, height: 28, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <CampoIcon name="trash" size={15} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    )
  }

  const columns: GridColDef<TrashRow>[] = [
    { field: 'title', headerName: 'Elemento', flex: 1, minWidth: 260, sortable: false, renderCell: (p) => <TrashItemCell row={p.row} /> },
    { field: 'kind', headerName: 'Tipo', width: 110, sortable: false, valueGetter: (_v, row) => resourceOf(row.kind).one,
      renderCell: (p) => <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: '56px' }}>{p.value as string}</Typography> },
    { field: 'deleted_at', headerName: 'Eliminato', width: 180, sortable: true,
      renderCell: (p) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><TrashWhen ago={agoLabel(p.row.deleted_at)} by={p.row.info?.deleted_by} /></Box> },
    { field: 'state', headerName: 'Stato', width: 170, sortable: false, renderCell: (p) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><TrashState row={p.row} /></Box> },
    { field: 'actions', headerName: '', width: 170, sortable: false, disableColumnMenu: true, renderCell: (p) => actionsCell(p.row) },
  ]

  const mobileCard: MobileCardRenderFn<TrashRow> = ({ row }) => (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.25, display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><TrashItemCell row={row} /></Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 'none' }}>{resourceOf(row.kind).one}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><TrashWhen ago={agoLabel(row.deleted_at)} by={row.info?.deleted_by} /></Box>
        <TrashState row={row} />
      </Box>
      {actionsCell(row)}
    </Box>
  )

  const tabs = [
    { key: 'all', label: 'Tutto', count: visible.reduce((s, r) => s + (counts[r.key] ?? 0), 0) },
    ...visible.filter((r) => (counts[r.key] ?? 0) > 0 || tab === r.key).map((r) => ({ key: r.key, label: r.label, count: counts[r.key] ?? 0 })),
  ]

  const bar = (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 49, px: '12px', py: '8px', borderBottom: searchOpen ? 0 : '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
        {selected.length ? (
          <Box role="toolbar" aria-label="Elementi selezionati" sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 650, mr: 0.5 }}>{selected.length} selezionat{selected.length === 1 ? 'o' : 'i'}</Typography>
            <Button size="small" variant="contained" disabled={busy} onClick={() => void restore(selected)} startIcon={<CampoIcon name="restore" size={14} />} sx={{ height: 30 }}>Ripristina</Button>
            <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => setPurgeRows(selected)} startIcon={<CampoIcon name="trash" size={14} />} sx={{ height: 30 }}>Elimina definitivamente</Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="text" onClick={clearSelection}>Annulla selezione</Button>
          </Box>
        ) : (
          <Typography sx={{ flex: 1, fontSize: 12, color: 'text.disabled' }}>Tasto destro su una riga → <b>Seleziona</b> per ripristinare o eliminare più elementi insieme.</Typography>
        )}
        <Tooltip title={searchOpen ? 'Chiudi la ricerca' : 'Cerca nel cestino'}>
          <IconButton aria-label="Cerca nel cestino" aria-pressed={searchOpen} onClick={() => { if (searchOpen) grid.setQ(''); setSearchOpen(!searchOpen) }}
            sx={{ width: 32, height: 32, ...(searchOpen && { bgcolor: 'archie.field', color: 'primary.main' }) }}>
            <CampoIcon name="search" />
          </IconButton>
        </Tooltip>
      </Box>
      {searchOpen ? (
        <Box sx={{ px: '12px', pb: '8px', borderBottom: '1px solid', borderColor: 'divider' }}>
          <InputBase autoFocus fullWidth value={grid.q} onChange={(e) => grid.setQ(e.target.value)} placeholder="Cerca per nome, codice, email…"
            inputProps={{ 'aria-label': 'Cerca nel cestino' }}
            sx={{ height: 34, px: 1.25, fontSize: 13, border: '1px solid', borderColor: 'divider', borderRadius: '6px', bgcolor: 'background.paper' }} />
        </Box>
      ) : null}
    </Box>
  )

  // ── Tasto destro sulla riga: seleziona e azioni ──
  const [ctx, setCtx] = React.useState<{ row: TrashRow; x: number; y: number } | null>(null)
  const ctxItems: RowContextMenuItem[] = (() => {
    if (!ctx) return []
    const row = ctx.row; const r = resourceOf(row.kind)
    const on = selectedIds.has(row.rid); const many = on && selected.length > 1
    const list = many ? selected : [row]
    return [
      { key: 'sel', label: on ? 'Togli dalla selezione' : selected.length ? 'Aggiungi alla selezione' : 'Seleziona', icon: <CheckBoxOutlinedIcon />,
        onClick: () => setSelectedIds(on ? [...selectedIds].filter((id) => id !== row.rid) : [...selectedIds, row.rid]) },
      { key: 'selall', label: 'Seleziona tutti i visibili', icon: <LibraryAddCheckOutlinedIcon />, hidden: selected.length > 0, onClick: () => setSelectedIds(rows.map((x) => x.rid)) },
      { key: 'restore', label: many ? `Ripristina i ${selected.length} selezionati` : 'Ripristina', icon: <CampoIcon name="restore" size={16} />, dividerBefore: true, strong: many,
        disabled: busy || (!many && (!hasPerm(r.restorePerm) || Boolean(row.info?.restore_block))), onClick: () => void restore(list) },
      { key: 'purge', label: many ? `Elimina definitivamente i ${selected.length} selezionati` : 'Elimina definitivamente', icon: <CampoIcon name="trash" size={16} />, tone: 'danger',
        disabled: busy || (!many && !canPurgeKind(r, hasPerm)), onClick: () => setPurgeRows(list) },
    ]
  })()
  // Esc esce dalla selezione (se non c'è un dialogo aperto).
  React.useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !purgeRows && !ctx && !document.querySelector('.MuiModal-root:not(.MuiModal-hidden)')) setSelection(emptySelectionModel()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting, purgeRows, ctx])

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead title="Cestino" actions={canPurgeAny ? (
        <Button variant="outlined" disabled={busy} onClick={() => void askEmpty()} startIcon={<CampoIcon name="trash" size={15} />}>Svuota il cestino</Button>
      ) : null} />
      {!visible.length ? (
        <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Non hai i permessi per vedere nessun tipo di elemento nel cestino.</Typography>
        </Box>
      ) : (
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
          <ViewTabs value={tab} onChange={(k) => { setTab(k as Tab); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }} tabs={tabs} />
          <EntityListCard<TrashRow>
            sx={{ border: 0, borderRadius: 0 }}
            flush
            header={bar}
            mobileCard={mobileCard}
            toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca nel cestino…' }}
            grid={{
              autoHeight: true,
              rows,
              columns,
              loading,
              rowCount,
              rowHeight: 56,
              getRowId: (r: TrashRow) => r.rid,
              columnVisibilityModel: { kind: tab === 'all' },
              emptyState: grid.search.trim()
                ? { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o tipo.' }
                : { title: 'Il cestino è vuoto', subtitle: tab === 'all' ? 'Non ci sono elementi eliminati.' : 'Non ci sono elementi eliminati di questo tipo.' },
              paginationModel: grid.paginationModel,
              onPaginationModelChange: grid.onPaginationModelChange,
              sortModel: grid.sortModel,
              onSortModelChange: grid.onSortModelChange,
              checkboxSelection: selecting,
              onRowContextMenu: (r, e) => setCtx({ row: r, x: e.clientX + 2, y: e.clientY - 6 }),
              rowSelectionModel: selection,
              onRowSelectionModelChange: (m) => setSelection(m as GridRowSelectionModel),
              deletedField: '__none__',
              sx: { '& .MuiDataGrid-row.Mui-selected': { bgcolor: 'archie.field' } },
            }}
          />
        </Box>
      )}
      <RowContextMenu open={Boolean(ctx)} anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined} onClose={() => setCtx(null)} items={ctxItems} />
      <PurgeDialog rows={purgeRows} busy={busy} onClose={() => setPurgeRows(null)} onConfirm={(list) => void purge(list)} />
    </Stack>
  )
}
