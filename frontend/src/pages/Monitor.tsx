import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Stack, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'

import { api } from '@shared/api/client'
import { buildDrfListParams } from '@shared/api/drf'
import { itemActionPath, itemPath } from '@shared/api/apiPaths'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlStringParam } from '@shared/hooks/useUrlParam'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon, FilterOptionList, PageHead, TableBar, ViewTabs, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import {
  MONO, TIPO_LABEL, VIEWS, formFrom, monitorTitle, viewCount, viewParams, wsWhere,
  type MonitorForm, type MonitorRow, type MonitorStats, type MonitorStato, type MonitorView,
} from '../features/monitor/monitorModel'
import { MonitorDetailCard, MonitorDialog, StatoBadge, TipoCell, TwoLine } from '../features/monitor/monitorUi'

const PATH = '/monitors/' as const

export default function Monitor() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const canAdd = hasPerm(PERMS.inventory.monitor.add)
  const canChange = hasPerm(PERMS.inventory.monitor.change)
  const canDelete = hasPerm(PERMS.inventory.monitor.delete)
  const canAudit = hasPerm(PERMS.audit.view)

  const grid = useServerGrid({ defaultOrdering: 'produttore', allowedOrderingFields: ['produttore', 'modello', 'seriale', 'stato', 'tipo', 'inventory__name', 'updated_at'] })
  const opts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const [vista, setVista] = useUrlStringParam('vista')
  const [tipo, setTipo] = useUrlStringParam('tipo')
  const view: MonitorView = VIEWS.find((v) => v.key === vista)?.key ?? 'all'

  const [tick, setTick] = React.useState(0)
  const [stats, setStats] = React.useState<MonitorStats | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<MonitorStats>(`${PATH}stats/`).then((r) => { if (alive) setStats(r.data) }).catch(() => {})
    return () => { alive = false }
  }, [tick])

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering, page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    extra: { ...viewParams(view), ...(tipo ? { tipo } : {}) },
  }), [grid.search, grid.ordering, grid.paginationModel, view, tipo])
  const { rows, rowCount, loading, reload } = useDrfList<MonitorRow>(PATH, listParams, (e) => toast.error(apiErrorToMessage(e)))
  const reloadAll = React.useCallback(() => { reload(); setTick((t) => t + 1) }, [reload])

  // ── Dettaglio ──
  const [detail, setDetail] = React.useState<MonitorRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const openId = grid.openId
  React.useEffect(() => {
    if (!openId) { setDetail(null); return }
    let alive = true
    const fromList = rows.find((r) => r.id === openId)
    if (fromList) setDetail(fromList)
    api.get<MonitorRow>(itemPath(PATH, openId), { params: { include_deleted: 1 } })
      .then((r) => { if (alive) setDetail(r.data) })
      .catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, tick])
  const idx = detail ? rows.findIndex((r) => r.id === detail.id) : -1
  // Clic sulla riga: la seleziona; doppio clic o Invio: apre la finestra.
  const [focusId, setFocusId] = React.useState<number | null>(null)

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok); reloadAll(); return true } catch (e) { toast.error(apiErrorToMessage(e)); return false } finally { setBusy(false) }
  }
  const setStato = (m: MonitorRow, s: MonitorStato) => void act(() => api.patch(itemPath(PATH, m.id), { stato: s }), 'Stato aggiornato.')
  const remove = (m: MonitorRow) => void act(() => api.delete(itemPath(PATH, m.id)), 'Monitor spostato nel cestino.')
  const restore = (m: MonitorRow) => void act(() => api.post(itemActionPath(PATH, m.id, 'restore')), 'Monitor ripristinato.')

  // ── Nuovo / modifica ──
  const [dlg, setDlg] = React.useState<{ initial: MonitorRow | null } | null>(null)
  const [form, setForm] = React.useState<MonitorForm>(formFrom(null))
  const openForm = React.useCallback((m: MonitorRow | null) => { setForm(formFrom(m)); setDlg({ initial: m }) }, [])
  const save = async () => {
    if (!dlg) return
    setBusy(true)
    try {
      const body = { ...form, produttore: form.produttore.trim() }
      if (dlg.initial) {
        await api.patch(itemPath(PATH, dlg.initial.id), body)
        toast.success('Monitor aggiornato.')
      } else {
        const { data } = await api.post<MonitorRow>(PATH, body)
        toast.success('Monitor creato.')
        grid.setOpenId(data.id)
      }
      setDlg(null)
      reloadAll()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }
  // "Nuovo monitor" da altre parti dell'app (pulsante rapido, barra in basso).
  React.useEffect(() => {
    const st = loc.state as unknown
    if (isRecord(st) && st['openCreate'] === true) { navigate(loc.pathname + loc.search, { replace: true, state: {} }); openForm(null) }
  }, [loc, navigate, openForm])

  // ── Filtri ──
  const activeFilters: ActiveFilter[] = tipo ? [{ key: 'tipo', label: 'Tipo', values: TIPO_LABEL[tipo as keyof typeof TIPO_LABEL] ?? tipo }] : []
  const filterConfig: Record<string, ColumnFilterConfig> = {
    tipo: {
      value: tipo, label: 'Filtra tipo', onSet: (v) => setTipo(String(v), opts), onReset: () => setTipo('', opts),
      children: <FilterOptionList label="Tipo" single selected={tipo ? [tipo] : []} options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))} onChange={(v) => setTipo(v[0] ?? '', opts)} />,
    },
  }

  const columns: GridColDef<MonitorRow>[] = [
    { field: 'produttore', headerName: 'Monitor', flex: 1.1, minWidth: 220, renderCell: (p) => <TwoLine icon={<CampoIcon name="monitor" size={17} />} title={monitorTitle(p.row)} /> },
    { field: 'seriale', headerName: 'Seriale', width: 140, renderCell: (p) => <Box component="span" sx={{ ...MONO, display: 'flex', alignItems: 'center', height: '100%' }}>{p.row.seriale || '—'}</Box> },
    { field: 'tipo', headerName: 'Tipo', width: 180, renderCell: (p) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><TipoCell m={p.row} /></Box> },
    { field: 'inventory__name', headerName: 'Workstation', flex: 1.2, minWidth: 220,
      renderCell: (p) => p.row.inventory ? <TwoLine title={p.row.inventory_name} sub={wsWhere(p.row)} /> : <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', color: 'text.secondary', fontSize: 13 }}>Non assegnato</Box> },
    { field: 'stato', headerName: 'Stato', width: 140, renderCell: (p) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><StatoBadge stato={p.row.stato} /></Box> },
  ]

  const mobileCard: MobileCardRenderFn<MonitorRow> = ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.25, display: 'grid', gap: 0.75, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><TwoLine icon={<CampoIcon name="monitor" size={17} />} title={monitorTitle(row)} sub={row.seriale ? `S/N ${row.seriale}` : undefined} /></Box>
        <StatoBadge stato={row.stato} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
        <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', minWidth: 0 }}>{row.inventory ? [row.inventory_name, wsWhere(row)].filter(Boolean).join(' · ') : 'Non assegnato'}</Typography>
        <TipoCell m={row} />
      </Box>
    </Box>
  )

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead title="Monitor" actions={canAdd ? <Button variant="contained" startIcon={<CampoIcon name="plus" size={15} />} onClick={() => openForm(null)}>Nuovo monitor</Button> : null} />
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs value={view} onChange={(k) => setVista(k === 'all' ? '' : k, opts)}
          tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, count: viewCount(v.key, stats), tone: v.alert ? 'alert' : 'default' }))} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={mobileCard}
          header={<TableBar filters={activeFilters} onRemoveFilter={() => setTipo('', opts)} onClearFilters={() => setTipo('', opts)} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca modello, seriale, workstation, sito…" />}
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca monitor…' }}
          grid={{
            pageKey: 'monitors',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState: grid.search.trim() || tipo
              ? { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
              : { title: view === 'all' ? 'Nessun monitor' : 'Nessun monitor in questa vista', subtitle: view === 'all' ? 'Crea un nuovo monitor.' : '' },
            rows,
            columns,
            loading,
            rowCount,
            rowHeight: 52,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: setFocusId,
            onRowOpen: (id) => { setFocusId(id); grid.setOpenId(id) },
            getRowClassName: (row) => ((openId ?? focusId) === row.id ? 'Mui-selected' : undefined),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>

      {/* Con ‹ › la finestra resta quella di prima finché arriva il nuovo monitor. */}
      {openId && detail ? (
        <MonitorDetailCard m={detail} canChange={canChange} canDelete={canDelete} canAudit={canAudit} busy={busy}
          position={idx >= 0 ? `${idx + 1} di ${rows.length}` : undefined}
          onPrev={idx > 0 ? () => grid.setOpenId(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => grid.setOpenId(rows[idx + 1].id) : undefined}
          onClose={() => grid.setOpenId(null)}
          onStato={(s) => setStato(detail, s)}
          onSaved={reloadAll}
          onDelete={() => remove(detail)}
          onRestore={() => restore(detail)}
          onOpenInventory={(id) => navigate(`/inventory?open=${id}&return=${encodeURIComponent(loc.pathname + loc.search)}`)}
          onOpenMonitor={(id) => grid.setOpenId(id)}
        />
      ) : null}
      <MonitorDialog open={dlg !== null} initial={dlg?.initial ?? null} form={form} onForm={setForm} busy={busy} onClose={() => setDlg(null)} onSave={() => void save()} />
    </Stack>
  )
}
