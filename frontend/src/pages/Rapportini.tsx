import * as React from 'react'
import { Box, Button, Checkbox, Stack, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
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
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { useExportCsv } from '@shared/ui/useExportCsv'

import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon, FilterOptionList, KpiStrip, KpiTile, PageHead, TableBar, ViewTabs, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import { daysLabel, dShort } from '../features/contracts/contractModel'
import SectionNav from '../features/maintenance/MaintenanceNav'
import EventDetailCard from '../features/maintenance/EventDetailCard'
import RapportinoDialog from '../features/maintenance/RapportinoDialog'
import { RESULT_LABEL, type Result } from '../features/maintenance/mtModel'
import { ResultBadge } from '../features/maintenance/mtUi'
import type { EventRow } from './maintenanceTypes'

type View = 'all' | 'follow' | 'nopdf' | 'np'
const VIEWS: View[] = ['all', 'follow', 'nopdf', 'np']
const VIEW_PARAMS: Record<View, Record<string, string>> = { all: {}, follow: { results: 'ko,partial' }, nopdf: { has_pdf: 'false' }, np: { result: 'not_planned' } }
type EvStats = { total: number; month: number; month_ok: number; follow_up: number; no_pdf: number; not_planned: number; by_tech: { id: number; name: string; count: number }[] }
type Lookup = { id: number; name: string }
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
const MONTH = () => new Date().toLocaleDateString('it-IT', { month: 'long' })

function useEvStats(reloadKey: unknown, customer: number | '') {
  const [data, setData] = React.useState<EvStats | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<EvStats>('/maintenance-events/stats/', { params: customer !== '' ? { customer } : {} })
      .then((r) => { if (alive) setData(r.data) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey, customer])
  return data
}

/** Manutenzione › Rapportini (restyle "Campo sterile", anteprima design-previews/mt-base.html). */
export default function Rapportini() {
  const toast = useToast()
  const navigate = useNavigate()
  const { me, hasPerm } = useAuth()
  const canAdd = hasPerm(PERMS.maintenance.event.add)
  const canChange = hasPerm(PERMS.maintenance.event.change)
  const canReset = hasPerm(PERMS.maintenance.event.delete)
  const canAddIssue = hasPerm(PERMS.issues.issue.add)
  const { exporting, exportCsv } = useExportCsv()
  const { rows: techs } = useDrfList<{ id: number; full_name: string }>('/techs/', { ordering: 'last_name', page_size: 500, is_active: 'true' })
  const { rows: customers } = useDrfList<{ id: number; name: string; display_name?: string | null }>('/customers/', { ordering: 'display_name', page_size: 500 })
  const { rows: plans } = useDrfList<{ id: number; title: string }>('/maintenance-plans/', { ordering: 'title', page_size: 500 })

  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: View = VIEWS.includes(viewRaw as View) ? (viewRaw as View) : 'all'
  const [customerF, setCustomerF] = useUrlNumberParam('ev_customer')
  const [planF, setPlanF] = useUrlNumberParam('ev_plan')
  const [techF, setTechF] = useUrlNumberParam('ev_tech')
  const [resultF, setResultF] = useUrlStringParam('ev_result')
  const opts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const setView = (v: string) => setViewRaw(v === 'all' ? '' : v, opts)

  const grid = useServerGrid({ defaultOrdering: '-performed_at', allowedOrderingFields: ['performed_at', 'updated_at'], defaultPageSize: 25 })
  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering, page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted,
    extra: {
      ...(customerF !== '' ? { customer: customerF } : {}), ...(planF !== '' ? { plan: planF } : {}), ...(techF !== '' ? { tech: techF } : {}),
      ...(resultF ? { result: resultF } : {}), ...VIEW_PARAMS[view],
    },
  }), [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, grid.includeDeleted, grid.onlyDeleted, customerF, planF, techF, resultF, view])
  const { rows, rowCount, loading, reload } = useDrfList<EventRow>('/maintenance-events/', listParams, (e) => toast.error(apiErrorToMessage(e)))
  const [statsKey, setStatsKey] = React.useState(0)
  const stats = useEvStats(statsKey, customerF)
  const reloadAll = React.useCallback(() => { reload(); setStatsKey((n) => n + 1) }, [reload])

  // ── Selezione, scheda, dialoghi ──
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const [openId, setOpenId] = React.useState<number | null>(null)
  // Clic sulla riga: la evidenzia; doppio clic o Invio: apre la finestra.
  const [focusId, setFocusId] = React.useState<number | null>(null)
  // La scheda resta aperta anche se il rapportino esce dalla vista (es. dopo il caricamento del PDF).
  const [open, setOpen] = React.useState<EventRow | null>(null)
  React.useEffect(() => {
    if (openId == null) { setOpen(null); return }
    const row = rows.find((r) => r.id === openId)
    if (row) { setOpen(row); return }
    api.get<EventRow>(`/maintenance-events/${openId}/`).then((r) => setOpen(r.data)).catch(() => setOpen(null))
  }, [openId, rows, statsKey])
  const [rpOpen, setRpOpen] = React.useState(false)
  const [resetIds, setResetIds] = React.useState<number[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const bulkPdfRef = React.useRef<HTMLInputElement | null>(null)

  const uploadPdf = async (ids: number[], file: File) => {
    setBusy(true)
    const res = await Promise.allSettled(ids.map((id) => { const fd = new FormData(); fd.append('pdf_file', file); return api.post(`/maintenance-events/${id}/upload-pdf/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }) }))
    setBusy(false)
    const fail = res.filter((x) => x.status === 'rejected')
    if (!fail.length) toast.success(ids.length === 1 ? 'PDF caricato' : `PDF caricato su ${ids.length} rapportini`)
    else toast.error(`${ids.length - fail.length} riusciti, ${fail.length} non caricati: ${apiErrorToMessage((fail[0] as PromiseRejectedResult).reason)}`)
    reloadAll()
  }
  const deletePdf = async (id: number) => {
    setBusy(true)
    try { await api.delete(`/maintenance-events/${id}/delete-pdf/`); toast.success('PDF rimosso'); reloadAll() } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const notPlanned = async (id: number) => {
    try { await api.patch(`/maintenance-events/${id}/set-not-planned/`); toast.success('Segnato come non previsto'); reloadAll() } catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  const doReset = async () => {
    if (!resetIds) return
    setBusy(true)
    const res = await Promise.allSettled(resetIds.map((id) => api.post(`/maintenance-events/${id}/reset/`)))
    setBusy(false)
    const ok = res.filter((x) => x.status === 'fulfilled').length
    if (ok === resetIds.length) toast.success(ok === 1 ? 'Rapportino eliminato: la manutenzione torna nelle scadenze' : `${ok} rapportini eliminati`)
    else toast.warning(`${ok} eliminati, ${resetIds.length - ok} non eliminati`)
    setResetIds(null); setSelected(new Set()); setOpenId(null); reloadAll()
  }
  const openIssue = async (ev: EventRow) => {
    try {
      await api.post('/issues/', { title: `${ev.result === 'ko' ? 'KO' : 'Parziale'} manutenzione: ${ev.plan_title} — ${ev.inventory_name}`, description: ev.notes ?? '', customer: ev.customer_id, site: ev.site_id ?? null, inventory: ev.inventory })
      toast.success('Issue aperta')
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }

  // ── Tasto destro sulla riga ──
  const [ctx, setCtx] = React.useState<{ row: EventRow; x: number; y: number } | null>(null)
  const rowPdfRef = React.useRef<HTMLInputElement | null>(null)
  const [pdfTarget, setPdfTarget] = React.useState<number | null>(null)
  const ctxItems: RowContextMenuItem[] = (() => {
    const r = ctx?.row
    if (!r) return []
    const np = r.result === 'not_planned'
    const bad = r.result === 'ko' || r.result === 'partial'
    const on = selected.has(r.id)
    return [
      { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => { setFocusId(r.id); setOpenId(r.id) } },
      { key: 'sel', label: on ? 'Togli dalla selezione' : selected.size ? 'Aggiungi alla selezione' : 'Seleziona', icon: <CheckBoxOutlinedIcon fontSize="small" />, onClick: () => toggle(r.id) },
      { key: 'pdf-up', label: r.pdf_url ? 'Sostituisci il PDF' : 'Carica il PDF', icon: <UploadFileOutlinedIcon fontSize="small" />, hidden: np || !canChange, disabled: busy, dividerBefore: true, onClick: () => { setPdfTarget(r.id); rowPdfRef.current?.click() } },
      { key: 'pdf-open', label: 'Apri il PDF', icon: <PictureAsPdfOutlinedIcon fontSize="small" />, hidden: !r.pdf_url, onClick: () => { window.open(r.pdf_url ?? '', '_blank', 'noopener') } },
      { key: 'issue', label: 'Apri issue', icon: <ReportProblemOutlinedIcon fontSize="small" />, hidden: !bad || !canAddIssue, onClick: () => void openIssue(r) },
      { key: 'np', label: 'Segna come non prevista', icon: <CloseIcon fontSize="small" />, hidden: np || !canChange, onClick: () => void notPlanned(r.id) },
      { key: 'plan', label: 'Apri il piano', icon: <BuildOutlinedIcon fontSize="small" />, dividerBefore: true, onClick: () => navigate(`/maintenance/plans?apri=${r.plan}`) },
      { key: 'reset', label: 'Elimina il rapportino', icon: <DeleteOutlineIcon fontSize="small" />, hidden: !canReset, dividerBefore: true, tone: 'danger', onClick: () => setResetIds([r.id]) },
    ]
  })()

  // ── Colonne, filtri, esportazione ──
  const columns = React.useMemo<GridColDef<EventRow>[]>(() => [
    {
      field: '__sel', headerName: '', width: 52, sortable: false, disableColumnMenu: true,
      renderHeader: () => { const all = rows.length > 0 && rows.every((r) => selected.has(r.id)); return <Checkbox size="small" checked={all} indeterminate={!all && rows.some((r) => selected.has(r.id))} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} slotProps={{ input: { 'aria-label': 'Seleziona la pagina' } }} /> },
      renderCell: (p) => <Checkbox size="small" checked={selected.has(p.row.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(p.row.id)} slotProps={{ input: { 'aria-label': `Seleziona il rapportino di ${p.row.inventory_name}` } }} />,
    },
    { field: 'performed_at', headerName: 'Data', width: 128, renderCell: (p) => <Box sx={{ lineHeight: 1.25, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dShort(p.row.performed_at)}<Box sx={{ fontSize: 12, color: 'text.secondary' }}>{daysLabel(p.row.performed_at)}</Box></Box> },
    { field: 'result', headerName: 'Esito', width: 132, sortable: false, renderCell: (p) => <ResultBadge result={p.row.result as Result} /> },
    { field: 'customer_name', headerName: 'Cliente · sito', width: 200, sortable: false, renderCell: (p) => <Box sx={{ minWidth: 0, lineHeight: 1.25 }}><Box sx={{ fontWeight: 550, ...ellipsis }}>{p.row.customer_name}</Box><Box sx={{ fontSize: 12, color: 'text.secondary', ...ellipsis }}>{p.row.site_name || '—'}</Box></Box> },
    { field: 'inventory_name', headerName: 'Inventario', flex: 1, minWidth: 190, sortable: false, renderCell: (p) => <Box sx={{ minWidth: 0, lineHeight: 1.25 }}><Box sx={{ fontWeight: 550, ...ellipsis }}>{p.row.inventory_name}</Box><Box sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, color: 'text.secondary', ...ellipsis }}>{p.row.inventory_knumber || p.row.inventory_hostname || '—'}</Box></Box> },
    { field: 'plan_title', headerName: 'Piano', flex: 1, minWidth: 180, sortable: false, renderCell: (p) => <Box component="span" sx={{ fontSize: 13, ...ellipsis }}>{p.row.plan_title}</Box> },
    { field: 'tech_name', headerName: 'Tecnico', width: 160, sortable: false, renderCell: (p) => (p.row.result === 'not_planned' || !p.row.tech_name ? <Box component="span" sx={{ color: 'text.disabled' }}>—</Box> : <Box component="span" sx={ellipsis}>{p.row.tech_name}</Box>) },
    {
      field: 'pdf_url', headerName: 'PDF', width: 76, sortable: false,
      renderCell: (p) => (p.row.result === 'not_planned' ? null : p.row.pdf_url
        ? <Box component="span" sx={{ fontSize: 11, fontWeight: 700, color: '#d93a2e' }}>PDF</Box>
        : <Box component="span" sx={{ fontSize: 11.5, color: 'text.disabled' }}>manca</Box>),
    },
  ], [rows, selected])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => ({
    customer_name: {
      value: customerF === '' ? '' : String(customerF), label: 'Filtra cliente', onSet: (v) => setCustomerF(v === '' ? '' : Number(v), opts), onReset: () => setCustomerF('', opts),
      children: <FilterOptionList label="Cliente" single searchable options={customers.map((c) => ({ value: String(c.id), label: c.display_name || c.name }))} selected={customerF === '' ? [] : [String(customerF)]} onChange={(v) => setCustomerF(v[0] ? Number(v[0]) : '', opts)} />,
    },
    plan_title: {
      value: planF === '' ? '' : String(planF), label: 'Filtra piano', onSet: (v) => setPlanF(v === '' ? '' : Number(v), opts), onReset: () => setPlanF('', opts),
      children: <FilterOptionList label="Piano" single searchable options={plans.map((p) => ({ value: String(p.id), label: p.title }))} selected={planF === '' ? [] : [String(planF)]} onChange={(v) => setPlanF(v[0] ? Number(v[0]) : '', opts)} />,
    },
    tech_name: {
      value: techF === '' ? '' : String(techF), label: 'Filtra tecnico', onSet: (v) => setTechF(v === '' ? '' : Number(v), opts), onReset: () => setTechF('', opts),
      children: <FilterOptionList label="Tecnico" single options={techs.map((t) => ({ value: String(t.id), label: t.full_name }))} selected={techF === '' ? [] : [String(techF)]} onChange={(v) => setTechF(v[0] ? Number(v[0]) : '', opts)} />,
    },
    result: {
      value: resultF, label: 'Filtra esito', onSet: (v) => setResultF(String(v), opts), onReset: () => setResultF('', opts),
      children: <FilterOptionList label="Esito" single options={(Object.keys(RESULT_LABEL) as Result[]).map((k) => ({ value: k, label: RESULT_LABEL[k] }))} selected={resultF ? [resultF] : []} onChange={(v) => setResultF(v[0] ?? '', opts)} />,
    },
  }), [customerF, setCustomerF, customers, planF, setPlanF, plans, techF, setTechF, techs, resultF, setResultF, opts])
  const nameOf = (list: Lookup[], id: number | '') => list.find((x) => x.id === id)?.name ?? `#${id}`
  const activeFilters: ActiveFilter[] = [
    customerF !== '' ? { key: 'customer', label: 'Cliente', values: nameOf(customers.map((c) => ({ id: c.id, name: c.display_name || c.name })), customerF) } : null,
    planF !== '' ? { key: 'plan', label: 'Piano', values: nameOf(plans.map((p) => ({ id: p.id, name: p.title })), planF) } : null,
    techF !== '' ? { key: 'tech', label: 'Tecnico', values: nameOf(techs.map((t) => ({ id: t.id, name: t.full_name })), techF) } : null,
    resultF ? { key: 'result', label: 'Esito', values: RESULT_LABEL[resultF as Result] ?? resultF } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (k: string) => { if (k === 'customer') setCustomerF('', opts); if (k === 'plan') setPlanF('', opts); if (k === 'tech') setTechF('', opts); if (k === 'result') setResultF('', opts) }
  const resetFilters = () => setCustomerF('', { patch: { page: 1, ev_plan: '', ev_tech: '', ev_result: '' }, keepOpen: true })

  const exportVisible = () => {
    const { page: _p, page_size: _s, ...params } = listParams as Record<string, unknown>
    void _p; void _s
    void exportCsv<EventRow>({
      url: '/maintenance-events/', params, filename: 'rapportini',
      columns: [
        { label: 'Data', getValue: (r) => r.performed_at },
        { label: 'Esito', getValue: (r) => RESULT_LABEL[r.result as Result] ?? r.result },
        { label: 'Cliente', getValue: (r) => r.customer_name ?? '' },
        { label: 'Sito', getValue: (r) => r.site_name ?? '' },
        { label: 'Inventario', getValue: (r) => r.inventory_name ?? '' },
        { label: 'KNumber', getValue: (r) => r.inventory_knumber ?? '' },
        { label: 'Piano', getValue: (r) => r.plan_title ?? '' },
        { label: 'Tecnico', getValue: (r) => r.tech_name ?? '' },
        { label: 'PDF', getValue: (r) => (r.pdf_url ? 'sì' : 'no') },
        { label: 'Note', getValue: (r) => r.notes ?? '' },
      ],
    })
  }

  const mobileCard = React.useMemo<MobileCardRenderFn<EventRow>>(() => ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.5, display: 'grid', gap: 0.75, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{row.inventory_name}</Typography>
        <ResultBadge result={row.result as Result} />
      </Box>
      <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>{dShort(row.performed_at)} · {row.customer_name} · {row.plan_title}</Typography>
    </Box>
  ), [])

  const maxTech = Math.max(1, ...(stats?.by_tech ?? []).map((t) => t.count))
  const idx = openId != null ? rows.findIndex((r) => r.id === openId) : -1
  const sel = [...selected]

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Manutenzione"
        inline={<SectionNav current="events" />}
        actions={canAdd ? <Button variant="contained" startIcon={<CampoIcon name="plus" size={16} />} onClick={() => setRpOpen(true)}>Registra rapportino</Button> : null}
      />
      <KpiStrip label="Indicatori rapportini">
        <KpiTile label={`Rapportini a ${MONTH()}`} value={stats ? stats.month : '—'} sub={stats ? <><b>{stats.month_ok}</b>&nbsp;OK · <b>{stats.month - stats.month_ok}</b>&nbsp;con esito diverso</> : null} />
        <KpiTile label="KO e parziali" active={view === 'follow'} onClick={() => setView(view === 'follow' ? 'all' : 'follow')} value={stats ? stats.follow_up : '—'} sub="interventi da completare o ripassare" />
        <KpiTile label="Senza PDF" active={view === 'nopdf'} onClick={() => setView(view === 'nopdf' ? 'all' : 'nopdf')} value={stats ? stats.no_pdf : '—'} sub="rapportino firmato da allegare" />
        <KpiTile label="Per tecnico · ultimi 90 giorni" wide>
          <Box sx={{ display: 'grid', gap: 0.5, mt: 0.5 }}>
            {(stats?.by_tech ?? []).slice(0, 4).map((t) => (
              <Box key={t.id} component="button" type="button" onClick={() => setTechF(techF === t.id ? '' : t.id, opts)} sx={{
                display: 'grid', gridTemplateColumns: 'minmax(0,140px) 1fr 28px', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', border: 0, bgcolor: 'transparent', p: '1px 4px', mx: -0.5, borderRadius: '4px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
                '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: 'none', boxShadow: (th) => th.palette.archie.focusRing },
              }}>
                <Box component="span" sx={ellipsis}>{t.name}</Box>
                <Box component="span" sx={{ height: 6, borderRadius: 3, bgcolor: 'archie.neutralBg', overflow: 'hidden' }}><Box component="span" sx={{ display: 'block', height: '100%', width: `${(t.count / maxTech) * 100}%`, borderRadius: 3, bgcolor: (th) => th.palette.archie.seq[2] }} /></Box>
                <Box component="b" sx={{ color: 'text.primary', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.count}</Box>
              </Box>
            ))}
            {stats && !stats.by_tech.length ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessun rapportino negli ultimi 90 giorni.</Typography> : null}
          </Box>
        </KpiTile>
      </KpiStrip>

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs value={view} onChange={setView} tabs={[
          { key: 'all', label: 'Tutti', count: stats?.total },
          { key: 'follow', label: 'KO e parziali', count: stats?.follow_up },
          { key: 'nopdf', label: 'Senza PDF', count: stats?.no_pdf },
          { key: 'np', label: 'Non previste', count: stats?.not_planned },
        ]} />
        {selected.size ? (
          <Box role="toolbar" aria-label="Rapportini selezionati" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', p: '8px 14px', bgcolor: 'archie.field', borderBottom: '1px solid', borderColor: 'archie.fieldLine' }}>
            <Typography component="b" sx={{ fontWeight: 600, mr: 0.5 }}>{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</Typography>
            {canChange ? <Button size="small" variant="contained" disabled={busy} startIcon={<CampoIcon name="upload" size={14} />} onClick={() => bulkPdfRef.current?.click()}>Carica un PDF per tutti</Button> : null}
            {canReset ? <Button size="small" variant="outlined" color="inherit" sx={{ bgcolor: 'background.paper' }} startIcon={<CampoIcon name="trash" size={14} />} onClick={() => setResetIds(sel)}>Elimina</Button> : null}
            <Box sx={{ flex: 1 }} />
            <Button size="small" color="inherit" onClick={() => setSelected(new Set())}>Annulla selezione</Button>
            <input ref={bulkPdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadPdf(sel, f).then(() => setSelected(new Set())) }} />
          </Box>
        ) : null}
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={mobileCard}
          header={<TableBar filters={activeFilters} onRemoveFilter={removeFilter} onClearFilters={resetFilters} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca inventario, KNumber, piano, tecnico, note…" onExport={exportVisible} exporting={exporting} />}
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca rapportini…' }}
          grid={{
            pageKey: 'maintenance-events-v2',
            autoHeight: true,
            rowHeight: 54,
            username: me?.username,
            filterConfig,
            emptyState: view === 'follow' ? { title: 'Nessun KO o parziale', subtitle: 'Tutti gli interventi sono andati a buon fine.' } : view === 'nopdf' ? { title: 'Tutti i PDF sono allegati', subtitle: 'Nessun rapportino in attesa del firmato.' } : { title: 'Nessun rapportino', subtitle: 'I rapportini compaiono qui quando registri una manutenzione.' },
            rows, columns, loading, rowCount,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: setFocusId,
            onRowOpen: (id) => { setFocusId(id); setOpenId(id) },
            onRowContextMenu: (r, e) => { setFocusId(r.id); setCtx({ row: r, x: e.clientX + 2, y: e.clientY - 6 }) },
            getRowClassName: (r) => [(openId ?? focusId) === r.id ? 'Mui-selected' : '', selected.has(r.id) ? 'is-checked' : ''].join(' '),
            sx: { ...headerFilterGridSx, cursor: 'pointer', '& .is-checked': { bgcolor: (t) => `${t.palette.archie.field} !important` } },
          }}
        />
      </Box>

      {open ? (
        <EventDetailCard
          ev={open}
          position={idx >= 0 ? `${idx + 1} di ${rows.length}` : undefined}
          onPrev={idx > 0 ? () => setOpenId(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => setOpenId(rows[idx + 1].id) : undefined}
          onClose={() => setOpenId(null)}
          canChange={canChange}
          canReset={canReset}
          canAddIssue={canAddIssue}
          pdfBusy={busy}
          onUploadPdf={(f) => void uploadPdf([open.id], f)}
          onDeletePdf={() => void deletePdf(open.id)}
          onNotPlanned={() => void notPlanned(open.id)}
          onReset={() => setResetIds([open.id])}
          onOpenIssue={() => void openIssue(open)}
        />
      ) : null}

      <RowContextMenu open={Boolean(ctx)} anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined} onClose={() => setCtx(null)} items={ctxItems} />
      <input ref={rowPdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && pdfTarget != null) void uploadPdf([pdfTarget], f); setPdfTarget(null) }} />
      <RapportinoDialog open={rpOpen} rows={[]} techs={techs} customers={customers.map((c) => ({ id: c.id, name: c.display_name || c.name }))} canAddIssue={canAddIssue} onClose={() => setRpOpen(false)} onSaved={reloadAll} />
      <ConfirmDeleteDialog open={Boolean(resetIds)} busy={busy} title={resetIds && resetIds.length > 1 ? `Eliminare ${resetIds.length} rapportini?` : 'Eliminare il rapportino?'}
        description="L'eliminazione è definitiva, PDF compreso: la manutenzione torna nelle scadenze da fare." confirmText="Elimina"
        onClose={() => setResetIds(null)} onConfirm={() => void doReset()} />
    </Stack>
  )
}
