import * as React from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { GridColDef } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'

import { api } from '@shared/api/client'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { useExportCsv } from '@shared/ui/useExportCsv'

import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon, FilterOptionList, KpiStrip, KpiTile, Meter, PageHead, TableBar, ViewTabs, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import SectionNav from '../features/maintenance/MaintenanceNav'
import PlanDialog from '../features/maintenance/PlanDialog'
import PlanDetailCard, { type PlanTab } from '../features/maintenance/PlanDetailCard'
import { generatePlanPdf } from '../features/maintenance/planPdf'
import { planStateOf, scheduleText } from '../features/maintenance/mtModel'
import { DueCell, PlanStateBadge } from '../features/maintenance/mtUi'
import type { PlanRow } from './maintenanceTypes'

type View = 'active' | 'overdue' | 'completed' | 'archived'
const VIEWS: View[] = ['active', 'overdue', 'completed', 'archived']
type PlanStats = { active: number; customers: number; covered: number; done: number; with_overdue: number; completed: number; archived: number }
type Customer = { id: number; name: string; display_name?: string | null }
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

function usePlanStats(reloadKey: unknown, customer: number | '') {
  const [data, setData] = React.useState<PlanStats | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<PlanStats>('/maintenance-plans/plan-stats/', { params: customer !== '' ? { customer } : {} })
      .then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey, customer])
  return data
}

function Coverage({ p }: { p: PlanRow }) {
  const covered = p.covered_count ?? 0
  const done = covered - Math.min(p.todo_count ?? 0, covered)
  const over = p.overdue_count ?? 0
  const pct = covered ? Math.round((done / covered) * 100) : 0
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '84px auto', alignItems: 'center', gap: 1, fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'archie.neutralBg', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 3, bgcolor: pct === 100 ? 'success.main' : over ? 'error.main' : (t) => t.palette.archie.seq[2] }} />
      </Box>
      <span>{covered ? `${done}/${covered}` : '—'}{over ? <Box component="b" sx={{ color: 'error.main', fontWeight: 600 }}> · {over} scadut{over === 1 ? 'a' : 'e'}</Box> : null}</span>
    </Box>
  )
}

/** Manutenzione › Piani (restyle "Campo sterile", anteprima design-previews/mt-base.html). */
export default function MaintenancePlans() {
  const theme = useTheme()
  const navigate = useNavigate()
  const toast = useToast()
  const { me, hasPerm } = useAuth()
  const canAdd = hasPerm(PERMS.maintenance.plan.add)
  const canChange = hasPerm(PERMS.maintenance.plan.change)
  const canDelete = hasPerm(PERMS.maintenance.plan.delete)
  const { exporting, exportCsv } = useExportCsv()

  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: View = VIEWS.includes(viewRaw as View) ? (viewRaw as View) : 'active'
  const [customerF, setCustomerF] = useUrlNumberParam('p_customer')
  const opts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const setView = (v: string) => setViewRaw(v === 'active' ? '' : v, opts)

  const grid = useServerGrid({ defaultOrdering: 'next_due_date', allowedOrderingFields: ['next_due_date', 'title', 'updated_at'], defaultPageSize: 25 })
  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering, page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted,
    extra: { state: view, ...(customerF !== '' ? { customer: customerF } : {}) },
  }), [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted, view, customerF])
  const { rows, rowCount, loading, reload } = useDrfList<PlanRow>('/maintenance-plans/', listParams, (e) => toast.error(apiErrorToMessage(e)))
  const [statsKey, setStatsKey] = React.useState(0)
  const stats = usePlanStats(statsKey, customerF)
  const reloadAll = React.useCallback(() => { reload(); setStatsKey((n) => n + 1) }, [reload])
  const { rows: customers } = useDrfList<Customer>('/customers/', { ordering: 'display_name', page_size: 500 })

  // ── Scheda e dialoghi ──
  const [openId, setOpenId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<PlanRow | null>(null)
  const [tab, setTab] = React.useState<PlanTab>('det')
  const [dlg, setDlg] = React.useState<{ plan: PlanRow | null } | null>(null)
  const [delPlan, setDelPlan] = React.useState<PlanRow | null>(null)
  const [delBusy, setDelBusy] = React.useState(false)
  const [cardReload, setCardReload] = React.useState(0)
  React.useEffect(() => {
    // La riga dell'elenco ha anche i conteggi; se non c'è (es. dopo il salvataggio) si legge il dettaglio.
    if (openId == null) { setDetail(null); return }
    const row = rows.find((r) => r.id === openId)
    if (row) { setDetail(row); return }
    api.get<PlanRow>(`/maintenance-plans/${openId}/`).then((r) => setDetail(r.data)).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [openId, rows, toast])
  const openPlan = (id: number) => { setTab((t) => (openId === id ? t : 'det')); setOpenId(id) }
  // Link diretto: /maintenance/plans?apri=<id> (es. «Apri il piano» dalle Scadenze).
  const [apri, setApri] = useUrlNumberParam('apri')
  React.useEffect(() => { if (apri !== '') { setOpenId(apri); setApri('', { replace: true }) } }, [apri, setApri])

  const doDelete = async () => {
    if (!delPlan) return
    setDelBusy(true)
    try { await api.delete(`/maintenance-plans/${delPlan.id}/`); toast.success('Piano spostato nel cestino'); setDelPlan(null); setOpenId(null); reloadAll() }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDelBusy(false) }
  }
  const doRestore = async (p: PlanRow) => {
    try { await api.post(`/maintenance-plans/${p.id}/restore/`); toast.success('Piano ripristinato'); reloadAll(); setCardReload((n) => n + 1) }
    catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  const pdf = (p: PlanRow) => void generatePlanPdf(p, theme, () => toast.warning('Popup bloccato dal browser. Abilita i popup per questo sito.'))

  // ── Colonne, filtri, esportazione ──
  const columns = React.useMemo<GridColDef<PlanRow>[]>(() => [
    { field: 'title', headerName: 'Piano', flex: 1, minWidth: 220, renderCell: (p) => <Box component="span" sx={{ fontWeight: 550, ...ellipsis }}>{p.row.title}</Box> },
    { field: 'customer_name', headerName: 'Cliente', width: 190, sortable: false, renderCell: (p) => <Box component="span" sx={ellipsis}>{p.row.customer_name}</Box> },
    {
      field: 'inventory_type_labels', headerName: 'Tipi', width: 200, sortable: false,
      renderCell: (p) => <Box sx={{ display: 'flex', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>{(p.row.inventory_type_labels ?? []).map((t) => <Box key={t} component="span" sx={{ fontSize: 11.5, fontWeight: 550, px: 0.75, lineHeight: '20px', borderRadius: '4px', bgcolor: 'archie.neutralBg', color: 'text.secondary', whiteSpace: 'nowrap' }}>{t}</Box>)}</Box>,
    },
    {
      field: 'schedule_type', headerName: 'Cadenza', width: 190, sortable: false,
      renderCell: (p) => <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, whiteSpace: 'nowrap', '& svg': { color: 'text.secondary' } }}><CampoIcon name={p.row.schedule_type === 'fixed_date' ? 'calendar' : 'restore'} size={14} />{scheduleText(p.row)}</Box>,
    },
    { field: 'covered_count', headerName: 'Copertura', width: 190, sortable: false, renderCell: (p) => <Coverage p={p.row} /> },
    { field: 'next_due_date', headerName: 'Prossima scadenza', width: 150, renderCell: (p) => (planStateOf(p.row) === 'arch' || !p.row.next_due_date ? <Box component="span" sx={{ color: 'text.disabled' }}>—</Box> : <DueCell due={p.row.next_due_date} />) },
    { field: 'is_active', headerName: 'Stato', width: 130, sortable: false, renderCell: (p) => <PlanStateBadge state={planStateOf(p.row)} /> },
  ], [])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_name: {
      value: customerF === '' ? '' : String(customerF), label: 'Filtra cliente',
      onSet: (v) => setCustomerF(v === '' ? '' : Number(v), opts), onReset: () => setCustomerF('', opts),
      children: <FilterOptionList label="Cliente" single searchable options={customers.map((c) => ({ value: String(c.id), label: c.display_name || c.name }))}
        selected={customerF === '' ? [] : [String(customerF)]} onChange={(v) => setCustomerF(v[0] ? Number(v[0]) : '', opts)} />,
    },
  }), [customerF, setCustomerF, customers, opts])
  const activeFilters: ActiveFilter[] = customerF !== '' ? [{ key: 'customer', label: 'Cliente', values: customers.find((c) => c.id === customerF)?.display_name || customers.find((c) => c.id === customerF)?.name || `#${customerF}` }] : []

  const exportVisible = () => {
    const { page: _p, page_size: _s, ...params } = listParams as Record<string, unknown>
    void _p; void _s
    void exportCsv<PlanRow>({
      url: '/maintenance-plans/', params, filename: 'piani_manutenzione',
      columns: [
        { label: 'Piano', getValue: (r) => r.title },
        { label: 'Cliente', getValue: (r) => r.customer_name ?? '' },
        { label: 'Tipi', getValue: (r) => (r.inventory_type_labels ?? []).join(', ') },
        { label: 'Cadenza', getValue: (r) => scheduleText(r) },
        { label: 'Inventari coperti', getValue: (r) => String(r.covered_count ?? '') },
        { label: 'Da fare', getValue: (r) => String(r.todo_count ?? '') },
        { label: 'Scadute', getValue: (r) => String(r.overdue_count ?? '') },
        { label: 'Prossima scadenza', getValue: (r) => r.next_due_date ?? '' },
        { label: 'Attivo', getValue: (r) => (r.is_active ? 'sì' : 'no') },
      ],
    })
  }

  const mobileCard = React.useMemo<MobileCardRenderFn<PlanRow>>(() => ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, display: 'grid', gap: 0.75, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{row.title}</Typography>
        <PlanStateBadge state={planStateOf(row)} />
      </Box>
      <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>{row.customer_name} · {scheduleText(row)}</Typography>
      <Coverage p={row} />
    </Box>
  ), [])

  const pct = stats && stats.covered ? Math.round((stats.done / stats.covered) * 100) : 0
  const idx = openId != null ? rows.findIndex((r) => r.id === openId) : -1

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Manutenzione"
        inline={<SectionNav current="plans" />}
        actions={canAdd ? <Button variant="contained" startIcon={<CampoIcon name="plus" size={16} />} onClick={() => setDlg({ plan: null })}>Nuovo piano</Button> : null}
      />
      <KpiStrip label="Indicatori piani">
        <KpiTile label="Piani in corso" value={stats ? stats.active : '—'} unit={stats ? `${stats.customers} clienti` : undefined} sub={stats ? <><b>{stats.covered}</b>&nbsp;inventari coperti</> : null} />
        <KpiTile label="Completati nel ciclo" active={view === 'completed'} onClick={() => setView(view === 'completed' ? 'active' : 'completed')}
          value={stats ? stats.completed : '—'} unit={stats ? `di ${stats.active}` : undefined} sub={stats ? <><b>{stats.done}</b>&nbsp;manutenzioni eseguite su {stats.covered}</> : null} />
        <KpiTile label="Con scadute" active={view === 'overdue'} onClick={() => setView(view === 'overdue' ? 'active' : 'overdue')}
          value={stats ? stats.with_overdue : '—'} sub="piani con almeno un inventario in ritardo" />
        <KpiTile label="Copertura complessiva" value={stats ? `${pct}%` : '—'} sub="eseguite sul totale del ciclo corrente">
          {stats ? <Meter value={pct} label="Copertura complessiva" /> : null}
        </KpiTile>
      </KpiStrip>

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs value={view} onChange={setView} tabs={[
          { key: 'active', label: 'In corso', count: stats?.active },
          { key: 'overdue', label: 'Con scadute', count: stats?.with_overdue },
          { key: 'completed', label: 'Completati', count: stats?.completed },
          { key: 'archived', label: 'Archiviati', count: stats?.archived },
        ]} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={mobileCard}
          header={<TableBar filters={activeFilters} onRemoveFilter={() => setCustomerF('', opts)} onClearFilters={() => setCustomerF('', opts)} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca piano, cliente, tipo…" onExport={exportVisible} exporting={exporting} />}
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca piani…' }}
          grid={{
            pageKey: 'maintenance-plans-v2',
            autoHeight: true,
            rowHeight: 54,
            username: me?.username,
            filterConfig,
            emptyState: view === 'overdue' ? { title: 'Nessun piano con scadute', subtitle: 'Tutti i piani sono in regola.' } : view === 'completed' ? { title: 'Nessun piano completato', subtitle: 'I piani compaiono qui quando tutti gli inventari del ciclo sono registrati.' } : { title: 'Nessun piano', subtitle: 'Crea un piano per programmare le manutenzioni di un cliente.' },
            rows, columns, loading, rowCount,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: openPlan,
            getRowClassName: (r) => (openId === r.id ? 'Mui-selected' : ''),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>

      {detail ? (
        <PlanDetailCard
          plan={detail}
          tab={tab}
          onTab={setTab}
          reloadKey={cardReload}
          position={idx >= 0 ? `${idx + 1} di ${rows.length}` : undefined}
          onPrev={idx > 0 ? () => openPlan(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => openPlan(rows[idx + 1].id) : undefined}
          onClose={() => setOpenId(null)}
          canChange={canChange}
          canDelete={canDelete}
          onEdit={() => setDlg({ plan: detail })}
          onDelete={() => setDelPlan(detail)}
          onRestore={() => void doRestore(detail)}
          onPdf={() => pdf(detail)}
          onTodo={() => navigate(`/maintenance?m_plan=${detail.id}`)}
        />
      ) : null}

      <PlanDialog open={dlg !== null} plan={dlg?.plan ?? null} customers={customers} onClose={() => setDlg(null)}
        onSaved={(id) => { setDlg(null); reloadAll(); setCardReload((n) => n + 1); setOpenId(id) }} />
      <ConfirmDeleteDialog open={Boolean(delPlan)} busy={delBusy} title="Spostare il piano nel cestino?" description={`«${delPlan?.title ?? ''}» verrà spostato nel cestino e potrà essere ripristinato.`} onClose={() => setDelPlan(null)} onConfirm={() => void doDelete()} />
    </Stack>
  )
}
