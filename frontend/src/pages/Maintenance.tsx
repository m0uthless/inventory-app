import * as React from 'react'
import { Box, Button, ButtonBase, Checkbox, Stack, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined'
import LibraryAddCheckOutlinedIcon from '@mui/icons-material/LibraryAddCheckOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import type { GridColDef } from '@mui/x-data-grid'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useExportCsv } from '@shared/ui/useExportCsv'

import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon, FilterOptionList, PageHead, TableBar, ViewTabs, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import { dShort } from '../features/contracts/contractModel'
import MaintenanceKpis, { useTodoStats } from '../features/maintenance/MaintenanceKpis'
import MaintenanceCalendar from '../features/maintenance/MaintenanceCalendar'
import RapportinoDialog from '../features/maintenance/RapportinoDialog'
import TodoDetailCard, { type TodoTab } from '../features/maintenance/TodoDetailCard'
import SectionNav from '../features/maintenance/MaintenanceNav'
import { DueDateOverrideDialog } from '../features/maintenance/MaintenanceLegacy'
import { useNavigate } from 'react-router-dom'
import { overrideTipOf, rowKey, todayIso, type Result } from '../features/maintenance/mtModel'
import { DueCell, PlanCell, ResultBadge } from '../features/maintenance/mtUi'
import type { TodoRow } from './maintenanceTypes'

type View = 'all' | 'over' | 'soon' | 'later' | 'ovr'
const VIEWS: View[] = ['all', 'over', 'soon', 'later', 'ovr']
const VIEW_DUE: Record<View, string | null> = { all: null, over: 'overdue', soon: 'next30', later: 'later', ovr: 'override' }
// Vecchio parametro ?m_due= (link esistenti) → vista
const LEGACY_DUE: Record<string, View> = { overdue: 'over', next30: 'soon' }
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

function ModeSwitch({ mode, onMode }: { mode: 'list' | 'cal'; onMode: (m: 'list' | 'cal') => void }) {
  return (
    <Box role="group" aria-label="Vista" sx={{ display: 'inline-flex', gap: '2px', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper' }}>
      {([['list', 'Elenco', 'menu'], ['cal', 'Calendario', 'calendar']] as const).map(([k, l, i]) => (
        <ButtonBase key={k} onClick={() => onMode(k)} aria-pressed={mode === k} sx={{
          height: 30, px: 1.25, gap: 0.75, borderRadius: '6px', fontSize: 13, fontWeight: 550,
          color: mode === k ? 'primary.main' : 'text.secondary', bgcolor: mode === k ? 'archie.field' : 'transparent',
          '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
        }}><CampoIcon name={i} size={15} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{l}</Box></ButtonBase>
      ))}
    </Box>
  )
}

/** Manutenzione › Scadenze (restyle "Campo sterile", anteprima design-previews/mt-base.html). */
export default function Maintenance() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const canRegister = hasPerm(PERMS.maintenance.event.add)
  const canEditDue = hasPerm(PERMS.maintenance.plan.change)
  const canAddIssue = hasPerm(PERMS.issues.issue.add)
  const { exporting, exportCsv } = useExportCsv()
  const { rows: techs } = useDrfList<{ id: number; full_name: string }>('/techs/', { ordering: 'last_name', page_size: 500, is_active: 'true' })

  // ── Vista, modalità e filtri (URL) ──
  const [modeRaw, setModeRaw] = useUrlStringParam('modo')
  const mode: 'list' | 'cal' = modeRaw === 'calendario' ? 'cal' : 'list'
  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const [legacyDue, setLegacyDue] = useUrlStringParam('m_due')
  const view: View = VIEWS.includes(viewRaw as View) ? (viewRaw as View) : LEGACY_DUE[legacyDue] ?? 'all'
  const [customerF, setCustomerF] = useUrlNumberParam('m_customer')
  const [planF, setPlanF] = useUrlNumberParam('m_plan')
  const [typeF, setTypeF] = useUrlStringParam('m_type')
  const opts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const setView = (v: string) => { if (legacyDue) setLegacyDue('', opts); setViewRaw(v === 'all' ? '' : v, opts) }
  const setMode = (m: 'list' | 'cal') => setModeRaw(m === 'cal' ? 'calendario' : '', opts)

  const grid = useServerGrid({ defaultOrdering: 'next_due_date', allowedOrderingFields: ['next_due_date', 'customer_name'], defaultPageSize: 25 })

  const scope = React.useMemo(() => ({
    ...(customerF !== '' ? { customer: customerF } : {}),
    ...(planF !== '' ? { plan: planF } : {}),
    ...(typeF ? { type: typeF } : {}),
    ...(grid.search.trim() ? { search: grid.search.trim() } : {}),
  }), [customerF, planF, typeF, grid.search])
  const listParams = React.useMemo(() => ({
    ...scope,
    page: grid.paginationModel.page + 1,
    page_size: grid.paginationModel.pageSize,
    ordering: grid.ordering || 'next_due_date',
    ...(VIEW_DUE[view] ? { due: VIEW_DUE[view] } : {}),
  }), [scope, grid.paginationModel, grid.ordering, view])

  const { rows: rawRows, rowCount, loading, reload } = useDrfList<TodoRow>('/maintenance-plans/todo/', listParams, (e) => toast.error(apiErrorToMessage(e)))
  // La griglia vuole id numerici: piano e inventario in un solo numero; la selezione usa rowKey.
  const rows = React.useMemo(() => rawRows.map((r) => ({ ...r, id: r.plan_id * 1_000_000 + r.inventory_id })), [rawRows])
  const [statsKey, setStatsKey] = React.useState(0)
  const stats = useTodoStats(statsKey, { ...(customerF !== '' ? { customer: customerF } : {}), ...(planF !== '' ? { plan: planF } : {}) })
  const reloadAll = React.useCallback(() => { reload(); setStatsKey((n) => n + 1) }, [reload])

  // ── Selezione (anche tra pagine e tra elenco e calendario) ──
  const [selected, setSelected] = React.useState<Map<string, TodoRow>>(new Map())
  const checked = React.useMemo(() => new Set(selected.keys()), [selected])
  const toggle = React.useCallback((r: TodoRow) => setSelected((m) => { const n = new Map(m); if (n.has(rowKey(r))) n.delete(rowKey(r)); else n.set(rowKey(r), r); return n }), [])
  const toggleMany = React.useCallback((list: TodoRow[]) => setSelected((m) => {
    const n = new Map(m); const all = list.every((r) => n.has(rowKey(r)))
    list.forEach((r) => (all ? n.delete(rowKey(r)) : n.set(rowKey(r), r))); return n
  }), [])
  const clearSel = () => setSelected(new Map())

  // ── Scheda, dialoghi ──
  const [open, setOpen] = React.useState<TodoRow | null>(null)
  const [tab, setTab] = React.useState<TodoTab>('det')
  const [rpRows, setRpRows] = React.useState<TodoRow[] | null>(null)
  const [overrideRow, setOverrideRow] = React.useState<TodoRow | null>(null)
  const [cardReload, setCardReload] = React.useState(0)
  const openRow = (r: TodoRow) => { setTab((t) => (open && rowKey(open) === rowKey(r) ? t : 'det')); setOpen(r) }
  const afterSave = () => { reloadAll(); clearSel(); setCardReload((n) => n + 1); setOpen(null) }

  const markNotPlanned = async (list: TodoRow[]) => {
    const res = await Promise.allSettled(list.map((r) => api.post('/maintenance-events/', { plan: r.plan_id, inventory: r.inventory_id, performed_at: todayIso(), result: 'not_planned', tech: null })))
    const ok = res.filter((x) => x.status === 'fulfilled').length
    if (ok === list.length) toast.success(ok === 1 ? 'Segnata come non prevista' : `${ok} segnate come non previste`)
    else toast.warning(`${ok} segnate, ${list.length - ok} non salvate`)
    afterSave()
  }

  // ── Colonne e filtri da intestazione ──
  // La colonna delle caselle compare solo con una selezione in corso (si entra dal tasto destro → Seleziona).
  const selecting = selected.size > 0
  const columns = React.useMemo<GridColDef<TodoRow & { id: number }>[]>(() => [
    ...(selecting ? [{
      field: '__sel', headerName: '', width: 52, sortable: false, disableColumnMenu: true,
      renderHeader: () => {
        const all = rows.length > 0 && rows.every((r) => checked.has(rowKey(r)))
        return <Checkbox size="small" checked={all} indeterminate={!all && rows.some((r) => checked.has(rowKey(r)))} onChange={() => toggleMany(rows)} slotProps={{ input: { 'aria-label': 'Seleziona la pagina' } }} />
      },
      renderCell: (p) => <Checkbox size="small" checked={checked.has(rowKey(p.row))} onClick={(e) => e.stopPropagation()} onChange={() => toggle(p.row)} slotProps={{ input: { 'aria-label': `Seleziona ${p.row.inventory_name}` } }} />,
    } satisfies GridColDef<TodoRow & { id: number }>] : []),
    { field: 'next_due_date', headerName: 'Scadenza', width: 128, renderCell: (p) => <DueCell due={p.row.next_due_date} /> },
    {
      field: 'customer_name', headerName: 'Cliente · sito', width: 200,
      renderCell: (p) => <Box sx={{ minWidth: 0, lineHeight: 1.25 }}><Box sx={{ fontWeight: 550, ...ellipsis }}>{p.row.customer_name}</Box><Box sx={{ fontSize: 12, color: 'text.secondary', ...ellipsis }}>{p.row.site_name || '—'}</Box></Box>,
    },
    {
      field: 'inventory_name', headerName: 'Inventario', flex: 1, minWidth: 200, sortable: false,
      renderCell: (p) => <Box sx={{ minWidth: 0, lineHeight: 1.25 }}><Box sx={{ fontWeight: 550, ...ellipsis }}>{p.row.inventory_name}</Box><Box sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, color: 'text.secondary', ...ellipsis }}>{[p.row.knumber, p.row.hostname].filter(Boolean).join(' · ') || '—'}</Box></Box>,
    },
    { field: 'type_label', headerName: 'Tipo', width: 120, sortable: false, renderCell: (p) => (p.row.type_label ? <Box component="span" sx={{ fontSize: 11.5, fontWeight: 550, px: 0.75, lineHeight: '20px', borderRadius: '4px', bgcolor: 'archie.neutralBg', color: 'text.secondary' }}>{p.row.type_label}</Box> : '—') },
    { field: 'plan_title', headerName: 'Piano', flex: 1, minWidth: 200, sortable: false, renderCell: (p) => <PlanCell title={p.row.plan_title} override={p.row.due_date_override} planDue={p.row.plan_next_due_date} /> },
    {
      field: 'last_date', headerName: 'Ultima esecuzione', width: 180, sortable: false,
      renderCell: (p) => (p.row.last_result ? <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}><ResultBadge result={p.row.last_result as Result} />{dShort(p.row.last_date)}</Box> : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>),
    },
    ...(canRegister ? [{
      field: '__act', headerName: '', width: 112, sortable: false, disableColumnMenu: true, align: 'right', headerAlign: 'right',
      renderCell: (p) => <Button className="row-act" size="small" variant="outlined" color="inherit" startIcon={<CheckIcon sx={{ fontSize: 15 }} />} onClick={(e) => { e.stopPropagation(); setRpRows([p.row]) }}>Registra</Button>,
    } satisfies GridColDef<TodoRow & { id: number }>] : []),
  ], [rows, checked, toggle, toggleMany, canRegister, selecting])

  const custName = (id: number | '') => stats?.customers.find((c) => c.id === id)?.name ?? `#${id}`
  const planName = (id: number | '') => stats?.plans.find((p) => p.id === id)?.title ?? `Piano #${id}`
  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_name: {
      value: customerF === '' ? '' : String(customerF), label: 'Filtra cliente',
      onSet: (v) => setCustomerF(v === '' ? '' : Number(v), opts), onReset: () => setCustomerF('', opts),
      children: <FilterOptionList label="Cliente" single searchable options={(stats?.customers ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        selected={customerF === '' ? [] : [String(customerF)]} onChange={(v) => setCustomerF(v[0] ? Number(v[0]) : '', opts)} />,
    },
    type_label: {
      value: typeF, label: 'Filtra tipo', onSet: (v) => setTypeF(String(v), opts), onReset: () => setTypeF('', opts),
      children: <FilterOptionList label="Tipo" single options={(stats?.types ?? []).map((t) => ({ value: t, label: t }))} selected={typeF ? [typeF] : []} onChange={(v) => setTypeF(v[0] ?? '', opts)} />,
    },
    plan_title: {
      value: planF === '' ? '' : String(planF), label: 'Filtra piano',
      onSet: (v) => setPlanF(v === '' ? '' : Number(v), opts), onReset: () => setPlanF('', opts),
      children: <FilterOptionList label="Piano" single searchable options={(stats?.plans ?? []).map((p) => ({ value: String(p.id), label: p.title }))}
        selected={planF === '' ? [] : [String(planF)]} onChange={(v) => setPlanF(v[0] ? Number(v[0]) : '', opts)} />,
    },
  }), [customerF, setCustomerF, typeF, setTypeF, planF, setPlanF, stats, opts])
  const activeFilters: ActiveFilter[] = [
    customerF !== '' ? { key: 'customer', label: 'Cliente', values: custName(customerF) } : null,
    planF !== '' ? { key: 'plan', label: 'Piano', values: planName(planF) } : null,
    typeF ? { key: 'type', label: 'Tipo', values: typeF } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (k: string) => { if (k === 'customer') setCustomerF('', opts); if (k === 'plan') setPlanF('', opts); if (k === 'type') setTypeF('', opts) }
  const resetFilters = () => setCustomerF('', { patch: { page: 1, m_plan: '', m_type: '' }, keepOpen: true })

  const exportVisible = () => {
    const { page: _p, page_size: _s, ...params } = listParams as Record<string, unknown>
    void _p; void _s
    void exportCsv<TodoRow>({
      url: '/maintenance-plans/todo/', params, filename: 'scadenze_manutenzione',
      columns: [
        { label: 'Scadenza', getValue: (r) => r.next_due_date },
        { label: 'Scadenza modificata', getValue: (r) => (r.due_date_override ? 'sì' : '') },
        { label: 'Cliente', getValue: (r) => r.customer_name },
        { label: 'Sito', getValue: (r) => r.site_name ?? '' },
        { label: 'Inventario', getValue: (r) => r.inventory_name },
        { label: 'KNumber', getValue: (r) => r.knumber ?? '' },
        { label: 'Hostname', getValue: (r) => r.hostname ?? '' },
        { label: 'Tipo', getValue: (r) => r.type_label ?? '' },
        { label: 'Piano', getValue: (r) => r.plan_title },
        { label: 'Ultima esecuzione', getValue: (r) => (r.last_date ? `${r.last_date} ${r.last_result ?? ''}` : '') },
      ],
    })
  }

  const mobileCard = React.useMemo<MobileCardRenderFn<TodoRow>>(() => ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.plan_id * 1_000_000 + row.inventory_id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, display: 'grid', gap: 0.75, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{row.inventory_name}</Typography>
        <DueCell due={row.next_due_date} overrideTip={overrideTipOf(row.due_date_override, row.plan_next_due_date)} />
      </Box>
      <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>{row.customer_name}{row.site_name ? ` · ${row.site_name}` : ''} · {row.plan_title}</Typography>
      {canRegister ? <Button size="small" variant="outlined" color="inherit" startIcon={<CheckIcon />} onClick={(e) => { e.stopPropagation(); setRpRows([row]) }} sx={{ justifySelf: 'start', minHeight: 36 }}>Registra rapportino</Button> : null}
    </Box>
  ), [canRegister])

  const emptyState = view === 'over'
    ? { title: 'Nessuna manutenzione scaduta', subtitle: 'Tutto in regola.' }
    : activeFilters.length || grid.search.trim() || view !== 'all'
      ? { title: 'Nessuna manutenzione', subtitle: 'Nessuna manutenzione corrisponde: prova a modificare la ricerca, la vista o i filtri.' }
      : { title: 'Nessuna manutenzione da fare', subtitle: 'Tutte le manutenzioni programmate sono state registrate.' }

  const idx = open ? rows.findIndex((r) => rowKey(r) === rowKey(open)) : -1
  const selectedList = [...selected.values()]

  // ── Tasto destro sulla riga: seleziona e azioni ──
  const [ctx, setCtx] = React.useState<{ row: TodoRow; x: number; y: number } | null>(null)
  const ctxItems: RowContextMenuItem[] = (() => {
    if (!ctx) return []
    const r = ctx.row; const on = checked.has(rowKey(r)); const many = on && selected.size > 1
    return [
      { key: 'sel', label: on ? 'Togli dalla selezione' : selected.size ? 'Aggiungi alla selezione' : 'Seleziona', icon: <CheckBoxOutlinedIcon />, onClick: () => toggle(r) },
      { key: 'selall', label: 'Seleziona tutte le visibili', icon: <LibraryAddCheckOutlinedIcon />, hidden: selected.size > 0, onClick: () => toggleMany(rows) },
      { key: 'rp', label: many ? `Registra rapportino per le ${selected.size} selezionate` : 'Registra rapportino', icon: <CheckIcon />, hidden: !canRegister, dividerBefore: true, strong: many, onClick: () => setRpRows(many ? selectedList : [r]) },
      { key: 'np', label: many ? `Non prevista per le ${selected.size} selezionate` : 'Non prevista', icon: <CloseIcon />, hidden: !canRegister, onClick: () => void markNotPlanned(many ? selectedList : [r]) },
      { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon />, dividerBefore: true, onClick: () => openRow(r) },
      { key: 'plan', label: 'Apri il piano', icon: <BuildOutlinedIcon />, onClick: () => navigate(`/maintenance/plans?apri=${r.plan_id}`) },
    ]
  })()
  // Esc esce dalla selezione (se non c'è una scheda o un dialogo aperto).
  React.useEffect(() => {
    if (!selected.size) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !open && rpRows === null && !overrideRow && !ctx && !document.querySelector('.MuiModal-root:not(.MuiModal-hidden)')) setSelected(new Map()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected.size, open, rpRows, overrideRow, ctx])

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Manutenzione"
        inline={<SectionNav current="due" />}
        actions={
          <>
            <ModeSwitch mode={mode} onMode={setMode} />
            {canRegister ? <Button variant="contained" startIcon={<CampoIcon name="plus" size={16} />} onClick={() => setRpRows(selectedList.length ? selectedList : [])}>Registra rapportino</Button> : null}
          </>
        }
      />
      <MaintenanceKpis stats={stats} view={view} onView={(v) => { setView(v); setMode('list') }} onCustomer={(id) => setCustomerF(customerF === id ? '' : id, opts)} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        {selected.size ? (
          <Box role="toolbar" aria-label="Manutenzioni selezionate" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', p: '8px 14px', bgcolor: 'archie.field', borderBottom: '1px solid', borderColor: 'archie.fieldLine' }}>
            <Typography component="b" sx={{ fontWeight: 600, mr: 0.5 }}>{selected.size} selezionat{selected.size === 1 ? 'a' : 'e'}</Typography>
            {canRegister ? <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={() => setRpRows(selectedList)}>Registra rapportino</Button> : null}
            {canRegister ? <Button size="small" variant="outlined" color="inherit" sx={{ bgcolor: 'background.paper' }} onClick={() => void markNotPlanned(selectedList)}>Non prevista</Button> : null}
            <Box sx={{ flex: 1 }} />
            <Button size="small" color="inherit" onClick={clearSel}>Annulla selezione</Button>
          </Box>
        ) : null}

        {mode === 'cal' ? (
          <>
            {activeFilters.length ? <TableBar filters={activeFilters} onRemoveFilter={removeFilter} onClearFilters={resetFilters} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca inventario, KNumber, cliente, piano…" /> : null}
            <MaintenanceCalendar stats={stats} params={scope} reloadKey={statsKey} checked={checked} onToggle={toggle} onToggleMany={toggleMany} onRegister={(list) => setRpRows(list)} onOpen={openRow} />
          </>
        ) : (
          <>
            <ViewTabs
              value={view}
              onChange={setView}
              tabs={[
                { key: 'all', label: 'Tutte', count: stats?.total },
                { key: 'over', label: 'Scadute', count: stats?.overdue },
                { key: 'soon', label: 'Prossimi 30 giorni', count: stats?.next30 },
                { key: 'later', label: 'Più avanti', count: stats?.later },
                { key: 'ovr', label: 'Scadenza modificata', count: stats?.override },
              ]}
            />
            <EntityListCard
              sx={{ border: 0, borderRadius: 0 }}
              flush
              mobileCard={mobileCard}
              header={<TableBar filters={activeFilters} onRemoveFilter={removeFilter} onClearFilters={resetFilters} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca inventario, KNumber, cliente, piano…" onExport={exportVisible} exporting={exporting} />}
              toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca scadenze…' }}
              grid={{
                pageKey: 'maintenance-todo-v2',
                rowHeight: 54,
                autoHeight: true,
                username: me?.username,
                filterConfig,
                emptyState,
                rows,
                columns,
                loading,
                rowCount,
                getRowId: (r) => (r as TodoRow & { id: number }).id,
                paginationModel: grid.paginationModel,
                onPaginationModelChange: grid.onPaginationModelChange,
                sortModel: grid.sortModel,
                onSortModelChange: grid.onSortModelChange,
                onRowClick: (id) => { const r = rows.find((x) => x.id === id); if (r) openRow(r) },
                onRowContextMenu: (r, e) => setCtx({ row: r, x: e.clientX + 2, y: e.clientY - 6 }),
                getRowClassName: (r) => [open && rowKey(r) === rowKey(open) ? 'Mui-selected' : '', checked.has(rowKey(r)) ? 'is-checked' : ''].join(' '),
                sx: {
                  ...headerFilterGridSx, cursor: 'pointer',
                  '& .is-checked': { bgcolor: (t) => `${t.palette.archie.field} !important` },
                  '& .row-act': { opacity: 0, transition: 'opacity .12s' },
                  '& .MuiDataGrid-row:hover .row-act, & .MuiDataGrid-row.Mui-selected .row-act, & .row-act:focus-visible': { opacity: 1 },
                },
              }}
            />
            {canRegister && !selected.size ? (
              <Typography sx={{ display: { xs: 'none', md: 'block' }, px: 1.75, py: 0.75, fontSize: 12, color: 'text.disabled', borderTop: '1px solid', borderColor: 'divider' }}>
                Tasto destro su una riga → <b>Seleziona</b> per registrarne più di una insieme.
              </Typography>
            ) : null}
          </>
        )}
      </Box>

      {open ? (
        <TodoDetailCard
          row={open}
          tab={tab}
          onTab={setTab}
          reloadKey={cardReload}
          position={idx >= 0 ? `${idx + 1} di ${rows.length}` : undefined}
          onPrev={idx > 0 ? () => openRow(rows[idx - 1]) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => openRow(rows[idx + 1]) : undefined}
          onClose={() => setOpen(null)}
          canRegister={canRegister}
          canEditDue={canEditDue}
          onRegister={() => setRpRows([open])}
          onNotPlanned={() => void markNotPlanned([open])}
          onEditDue={() => setOverrideRow(open)}
          onOpenPlan={() => navigate(`/maintenance/plans?apri=${open.plan_id}`)}
        />
      ) : null}

      <RowContextMenu open={Boolean(ctx)} anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined} onClose={() => setCtx(null)} items={ctxItems}
        title={ctx?.row.inventory_name} subtitle={ctx ? [ctx.row.customer_name, ctx.row.site_name].filter(Boolean).join(' · ') : undefined} />
      <RapportinoDialog open={rpRows !== null} rows={rpRows ?? []} techs={techs} customers={stats?.customers ?? []} canAddIssue={canAddIssue} onClose={() => setRpRows(null)} onSaved={afterSave} />
      <DueDateOverrideDialog open={Boolean(overrideRow)} row={overrideRow} onClose={() => setOverrideRow(null)} onSaved={() => { reloadAll(); setOpen(null) }} />
    </Stack>
  )
}
