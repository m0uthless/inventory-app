/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid'

import AddIcon from '@mui/icons-material/Add'
import AssignmentLateOutlinedIcon from '@mui/icons-material/AssignmentLateOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import { api } from '../api/client'
import type { PlanRow } from './maintenanceTypes'
import { buildDrfListParams } from '../api/drf'
import { apiErrorToFieldErrors, apiErrorToMessage } from '../api/error'
import { Can } from '../auth/Can'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { useDrfList } from '../hooks/useDrfList'
import { useServerGrid } from '../hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '../hooks/useUrlParam'
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog'
import CustomFieldsEditor from '../ui/CustomFieldsEditor'
import EntityListCard from '../ui/EntityListCard'
import FilterChip from '../ui/FilterChip'
import { compactCreateButtonSx, compactExportButtonSx, compactResetButtonSx } from '../ui/toolbarStyles'
import { useToast } from '../ui/toast'
import { useExportCsv } from '../ui/useExportCsv'

import { useNavigate } from 'react-router-dom'
import RowContextMenu, { type RowContextMenuItem } from '../ui/RowContextMenu'
import { PlanDrawer, RapportinoDialog } from './Maintenance'

// ─── Types ───────────────────────────────────────────────────────────────────

type LookupItem = { id: number; label: string }
type CustomerItem = { id: number; code: string; name: string; display_name?: string }

type PlanForm = {
  customer: number | ''
  inventory_types: number[]
  title: string
  schedule_type: 'interval' | 'fixed_date'
  interval_value: number | ''
  interval_unit: 'days' | 'weeks' | 'months' | 'years' | ''
  fixed_month: number | ''
  fixed_day: number | ''
  next_due_date: string
  next_due_date_auto: boolean
  alert_days_before: number | ''
  is_active: boolean
  notes: string
  custom_fields: Record<string, any>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIT_IT: Record<string, string> = { days: 'giorni', weeks: 'settimane', months: 'mesi', years: 'anni' }

function dueDiffDays(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

function DueBadge({ dateStr }: { dateStr: string }) {
  const diff = dueDiffDays(dateStr)
  if (diff < 0) return <Chip size="small" icon={<WarningAmberRoundedIcon sx={{ fontSize: '14px !important' }} />} label={`${Math.abs(diff)} gg fa`} color="error" sx={{ height: 22, fontWeight: 600, fontSize: '0.72rem' }} />
  if (diff === 0) return <Chip size="small" label="Oggi" color="error" sx={{ height: 22, fontWeight: 700, fontSize: '0.72rem' }} />
  if (diff <= 30) return <Chip size="small" label={`${diff} gg`} color="warning" variant="outlined" sx={{ height: 22, fontWeight: 600, fontSize: '0.72rem' }} />
  return <Chip size="small" label={dateStr} color="default" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
}

const GRID_SX = {
  '--DataGrid-rowHeight': '24px',
  '--DataGrid-headerHeight': '35px',
  '& .MuiDataGrid-cell': { py: 0.25 },
  '& .MuiDataGrid-columnHeader': { py: 0.75 },
  '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
  '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
  '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(69,127,121,0.10) !important' },
  '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(69,127,121,0.14) !important' },

} as const

async function fetchComputedDueDate(scheduleType: string, intervalValue: number | '', intervalUnit: string, fixedMonth: number | '', fixedDay: number | ''): Promise<string | null> {
  try {
    const params: Record<string, any> = { schedule_type: scheduleType }
    if (scheduleType === 'interval') { if (!intervalValue || !intervalUnit) return null; params.interval_value = intervalValue; params.interval_unit = intervalUnit }
    else { if (!fixedMonth || !fixedDay) return null; params.fixed_month = fixedMonth; params.fixed_day = fixedDay }
    const res = await api.get<{ next_due_date: string }>('/maintenance-plans/compute-due-date/', { params })
    return res.data.next_due_date ?? null
  } catch { return null }
}

const PLAN0: PlanForm = { customer: '', inventory_types: [], title: '', schedule_type: 'interval', interval_value: '', interval_unit: 'months', fixed_month: '', fixed_day: '', next_due_date: '', next_due_date_auto: true, alert_days_before: 14, is_active: true, notes: '', custom_fields: {} }

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MaintenancePlans() {
  const { me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { exporting, exportCsv } = useExportCsv()
  const grid = useServerGrid({ defaultOrdering: 'next_due_date', allowedOrderingFields: ['next_due_date', 'title', 'updated_at'] })
  const { rows: allTechs } = useDrfList<{ id: number; full_name: string }>('/techs/', { ordering: 'last_name', page_size: 500, is_active: 'true' })

  const [customerF, setCustomerF] = useUrlNumberParam('p_customer')
  const [dueFilter, setDue] = useUrlStringParam('p_due')
  const [actFilter, setAct] = useUrlStringParam('p_active')
  const [_hideArchivedStr, _setHideArchivedStr] = useUrlStringParam('p_hide_archived', { defaultValue: '1' })
  const hideArchived = _hideArchivedStr !== '0'
  const setHideArchived = (v: boolean) => _setHideArchivedStr(v ? '1' : '0')

  // Un piano è "archiviato" se next_due_date è antecedente al 1° gennaio dell'anno corrente
  const currentYearStart = `${new Date().getFullYear()}-01-01`

  const { rows: customers } = useDrfList<CustomerItem>('/customers/', { ordering: 'display_name', page_size: 500 })
  const [invTypes, setInvTypes] = React.useState<LookupItem[]>([])
  React.useEffect(() => {
    api.get('/inventory-types/', { params: { ordering: 'label', is_hw: 'true' } }).then(r => setInvTypes(Array.isArray(r.data) ? r.data : (r.data?.results ?? []))).catch(() => {})
  }, [])

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering,
    page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted,
    extra: { ...(customerF ? { customer: customerF } : {}), ...(dueFilter ? { due: dueFilter } : {}), ...(actFilter ? { is_active: actFilter } : {}) },
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted, customerF, dueFilter, actFilter])

  const { rows: rawRows, rowCount, loading, reload } = useDrfList<PlanRow>('/maintenance-plans/', listParams, e => toast.error(apiErrorToMessage(e)))
  const rows = React.useMemo(() =>
    hideArchived ? rawRows.filter(r => !r.next_due_date || r.next_due_date >= currentYearStart) : rawRows,
  [rawRows, hideArchived, currentYearStart])

  // Drawer
  const [drawerPlanId, setDrawerPlanId] = React.useState<number | null>(null)
  const [rapportinoOpen, setRapportinoOpen] = React.useState(false)

  // Context menu
  const [contextMenu, setContextMenu] = React.useState<{ row: PlanRow; mouseX: number; mouseY: number } | null>(null)
  const handleRowContextMenu = React.useCallback((row: PlanRow, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
  }, [])
  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  // Dialog CRUD
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<'create' | 'edit'>('create')
  const [dlgId, setDlgId] = React.useState<number | null>(null)
  const [dlgSave, setDlgSave] = React.useState(false)
  const [dlgErrors, setDlgErrors] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<PlanForm>(PLAN0)
  const ff = (p: Partial<PlanForm>) => setForm(x => ({ ...x, ...p }))
  const [delDlg, setDelDlg] = React.useState<PlanRow | null>(null)
  const [delBusy, setDelBusy] = React.useState(false)
  const [computing, setComputing] = React.useState(false)
  const prevKey = React.useRef('')

  const autoCompute = React.useCallback(async (f: PlanForm) => {
    if (!f.next_due_date_auto) return
    setComputing(true)
    const d = await fetchComputedDueDate(f.schedule_type, f.interval_value, f.interval_unit, f.fixed_month, f.fixed_day)
    setComputing(false)
    if (d) setForm(x => ({ ...x, next_due_date: d }))
  }, [])

  const scheduleKey = `${form.schedule_type}|${form.interval_value}|${form.interval_unit}|${form.fixed_month}|${form.fixed_day}`
  React.useEffect(() => {
    if (prevKey.current === scheduleKey) return
    prevKey.current = scheduleKey
    if (form.next_due_date_auto) void autoCompute(form)
  }, [scheduleKey, form.next_due_date_auto, autoCompute])

  const openCreate = () => { setDlgMode('create'); setDlgId(null); setDlgErrors({}); setForm(PLAN0); prevKey.current = ''; setDlgOpen(true) }
  const openEdit = (plan: PlanRow) => {
    setDlgMode('edit'); setDlgId(plan.id); setDlgErrors({})
    const f: PlanForm = { customer: plan.customer ?? '', inventory_types: plan.inventory_types ?? [], title: plan.title ?? '', schedule_type: (plan.schedule_type as any) ?? 'interval', interval_value: plan.interval_value ?? '', interval_unit: (plan.interval_unit as any) ?? 'months', fixed_month: plan.fixed_month ?? '', fixed_day: plan.fixed_day ?? '', next_due_date: plan.next_due_date ?? '', next_due_date_auto: false, alert_days_before: plan.alert_days_before ?? 14, is_active: plan.is_active ?? true, notes: plan.notes ?? '', custom_fields: (plan.custom_fields as any) ?? {} }
    setForm(f); prevKey.current = `${f.schedule_type}|${f.interval_value}|${f.interval_unit}|${f.fixed_month}|${f.fixed_day}`; setDlgOpen(true)
  }

  const save = async () => {
    if (!form.customer) { toast.warning('Seleziona un cliente.'); return }
    if (!form.inventory_types.length) { toast.warning('Seleziona almeno un tipo di inventario.'); return }
    if (!form.title.trim()) { toast.warning('Inserisci un titolo.'); return }
    if (!form.next_due_date) { toast.warning('La data prevista è obbligatoria.'); return }
    if (form.schedule_type === 'interval' && (!form.interval_value || !form.interval_unit)) { toast.warning("Specifica valore e unità dell'intervallo."); return }
    if (form.schedule_type === 'fixed_date' && (!form.fixed_month || !form.fixed_day)) { toast.warning('Specifica giorno e mese.'); return }
    const payload: any = { customer: Number(form.customer), inventory_types: form.inventory_types, title: form.title.trim(), schedule_type: form.schedule_type, interval_value: form.schedule_type === 'interval' ? Number(form.interval_value) || null : null, interval_unit: form.schedule_type === 'interval' ? form.interval_unit || null : null, fixed_month: form.schedule_type === 'fixed_date' ? Number(form.fixed_month) || null : null, fixed_day: form.schedule_type === 'fixed_date' ? Number(form.fixed_day) || null : null, next_due_date: form.next_due_date, alert_days_before: Number(form.alert_days_before) || 14, is_active: form.is_active, notes: form.notes.trim() || null, custom_fields: Object.keys(form.custom_fields).length ? form.custom_fields : null }
    setDlgSave(true); setDlgErrors({})
    try {
      let id: number
      if (dlgMode === 'create') { const r = await api.post<PlanRow>('/maintenance-plans/', payload); id = r.data.id; toast.success('Piano creato ✅') }
      else { const r = await api.patch<PlanRow>(`/maintenance-plans/${dlgId}/`, payload); id = r.data.id; toast.success('Piano aggiornato ✅') }
      setDlgOpen(false); reload(); setDrawerPlanId(id)
    } catch (e) {
      const fe = apiErrorToFieldErrors(e)
      if (Object.keys(fe).length) { setDlgErrors(fe); toast.error(fe._error || 'Controlla i campi.') }
      else toast.error(apiErrorToMessage(e))
    } finally { setDlgSave(false) }
  }

  const doDelete = async () => {
    if (!delDlg) return; setDelBusy(true)
    try { await api.delete(`/maintenance-plans/${delDlg.id}/`); toast.success('Piano eliminato ✅'); setDelDlg(null); reload() }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDelBusy(false) }
  }

  const doRestore = async (plan: PlanRow) => {
    try { await api.post(`/maintenance-plans/${plan.id}/restore/`); toast.success('Piano ripristinato ✅'); reload() }
    catch (e) { toast.error(apiErrorToMessage(e)) }
  }

  const selectedTypeLabels = invTypes.filter(t => form.inventory_types.includes(t.id)).map(t => t.label)
  const fcnt = [customerF, dueFilter, actFilter].filter(Boolean).length

  // ── PDF report ─────────────────────────────────────────────────────────────
  const generatePlanPdf = React.useCallback(async (plan: PlanRow) => {
    // 1. Rapportini del piano
    let events: any[] = []
    try {
      const r = await api.get('/maintenance-events/', { params: { plan: plan.id, ordering: '-performed_at', page_size: 500 } })
      events = r.data.results ?? []
    } catch { /* non bloccante */ }

    // 2. Inventory filtrati per i tipi previsti dal piano (campo `type` del filterset)
    let inventories: any[] = []
    try {
      const typeIds: number[] = plan.inventory_types ?? []
      if (typeIds.length > 0) {
        // Una chiamata per tipo (il filterset accetta un solo `type` per chiamata)
        const results = await Promise.all(
          typeIds.map(tid =>
            api.get('/inventories/', {
              params: { customer: plan.customer, type: tid, ordering: 'knumber', page_size: 500 },
            }).then(r => r.data.results ?? [])
          )
        )
        inventories = results.flat()
      }
    } catch { /* non bloccante */ }

    const RESULT_IT: Record<string, string> = { ok: 'OK', ko: 'KO', partial: 'Parziale', not_planned: 'Non previsto' }
    type ResultKey = 'ok' | 'ko' | 'partial' | 'not_planned'
    const RESULT_STYLE: Record<ResultKey, string> = {
      ok:          'background:#dcfce7;color:#166534',
      ko:          'background:#fee2e2;color:#991b1b',
      partial:     'background:#fef9c3;color:#854d0e',
      not_planned: 'background:#f3f4f6;color:#6b7280',
    }

    // Mappa inventory_id → rapportino più recente
    const eventByInv: Record<number, any> = {}
    for (const ev of events) {
      if (!eventByInv[ev.inventory] || ev.performed_at > eventByInv[ev.inventory].performed_at)
        eventByInv[ev.inventory] = ev
    }

    // Ordina per KNumber (numerico poi alfa)
    const sortedInv = [...inventories].sort((a, b) => {
      const ka = a.knumber ?? a.hostname ?? ''
      const kb = b.knumber ?? b.hostname ?? ''
      const na = parseInt(ka.replace(/\D/g, ''), 10)
      const nb = parseInt(kb.replace(/\D/g, ''), 10)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return ka.localeCompare(kb)
    })

    const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }

    const invRows = sortedInv.map((inv: any) => {
      const ev       = eventByInv[inv.id]
      const result   = ev?.result as ResultKey | undefined
      const styleCss = result ? (RESULT_STYLE[result] ?? RESULT_STYLE.not_planned) : ''
      const badge    = result
        ? `<span style="${styleCss};padding:2px 7px;border-radius:3px;font-size:9.5px;font-weight:700">${RESULT_IT[result] ?? result}</span>`
        : `<span style="background:#fff3e0;color:#b45309;padding:2px 7px;border-radius:3px;font-size:9.5px;font-weight:700">—</span>`
      const siteName = inv.site_name ?? inv.site_display_name ?? '—'
      return `<tr>
        <td class="mono">${inv.knumber ?? '—'}</td>
        <td>${inv.name ?? '—'}</td>
        <td class="muted">${siteName}</td>
        <td class="muted">${inv.type_label ?? '—'}</td>
        <td class="center">${ev ? fmtDate(ev.performed_at) : '—'}</td>
        <td class="muted">${ev?.tech_name ?? '—'}</td>
        <td class="center">${badge}</td>
        <td class="muted small">${ev?.notes ?? ''}</td>
      </tr>`
    }).join('')

    const coveredCount   = plan.covered_count  ?? inventories.length
    const completedCount = plan.completed_count ?? 0
    const missing        = Math.max(0, coveredCount - completedCount)
    const pct            = coveredCount > 0 ? Math.round(completedCount / coveredCount * 100) : 0
    const isCompleted    = coveredCount > 0 && completedCount >= coveredCount
    const barColor       = pct === 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'

    const scheduleLabel = plan.schedule_type === 'interval'
      ? `Ogni ${plan.interval_value ?? ''} ${plan.interval_unit ?? ''}`
      : `${plan.fixed_day ?? ''}/${plan.fixed_month ?? ''} ogni anno`

    const now = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/>
<title>Report — ${plan.title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff}
  .page{padding:22px 26px 18px}

  /* ── Header ── */
  .hdr{background:linear-gradient(135deg,#0f766e,#134e4a);color:#fff;
       padding:16px 20px;border-radius:8px;margin-bottom:14px;
       display:flex;justify-content:space-between;align-items:flex-start}
  .hdr-left h1{font-size:16px;font-weight:800;letter-spacing:-.02em;margin-bottom:2px}
  .hdr-left .sub{font-size:10px;opacity:.65;margin-bottom:8px}
  .hdr-left .tags{display:flex;flex-wrap:wrap;gap:5px}
  .tag{background:rgba(255,255,255,.18);color:#fff;padding:2px 8px;
       border-radius:4px;font-size:9.5px;font-weight:600}
  .hdr-right{text-align:right;font-size:9px;opacity:.55;line-height:1.7;white-space:nowrap;padding-left:16px}
  .status-ok  {background:#dcfce7;color:#166534;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700}
  .status-wip {background:#fef9c3;color:#854d0e;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700}

  /* ── KPI strip ── */
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px}
  .kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:3px}
  .kpi-val{font-size:20px;font-weight:800;line-height:1;color:#0f172a}
  .kpi-sub{font-size:9px;color:#94a3b8;margin-top:2px}

  /* ── Progress ── */
  .prog{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
        padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:14px}
  .prog-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;white-space:nowrap}
  .prog-bar-bg{flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}
  .prog-bar-fill{height:100%;border-radius:4px}
  .prog-pct{font-size:13px;font-weight:800;white-space:nowrap}

  /* ── Notes ── */
  .notes{background:#f0fdf4;border-left:3px solid #0f766e;padding:7px 12px;
         border-radius:0 5px 5px 0;margin-bottom:12px;font-size:10px;color:#374151;white-space:pre-wrap}

  /* ── Section title ── */
  .sec{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
       color:#64748b;margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .sec::before{content:'';display:inline-block;width:3px;height:12px;
               background:#0f766e;border-radius:2px;flex-shrink:0}

  /* ── Table ── */
  table{width:100%;border-collapse:collapse}
  thead th{background:#0f766e;color:#fff;padding:6px 8px;
           font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left}
  thead th:first-child{border-radius:5px 0 0 0}
  thead th:last-child {border-radius:0 5px 0 0}
  tbody tr:nth-child(even) td{background:#f8fafc}
  td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:10.5px}
  td.mono{font-family:ui-monospace,monospace;font-weight:600;font-size:10px}
  td.muted{color:#6b7280}
  td.center{text-align:center}
  td.small{font-size:9.5px}

  /* ── Footer ── */
  .footer{margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;
          display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}

  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .page{padding:14px 18px 12px}
    @page{size:A4 portrait;margin:8mm 7mm}
  }
</style></head>
<body><div class="page">

  <div class="hdr">
    <div class="hdr-left">
      <div class="sub">${plan.customer_code ?? ''} &nbsp;·&nbsp; ${plan.customer_name ?? ''}</div>
      <h1>${plan.title}</h1>
      <div class="tags" style="margin-top:8px">
        <span class="${isCompleted ? 'status-ok' : 'status-wip'}">${isCompleted ? '✓ Completato' : '◑ In corso'}</span>
        <span class="tag">${scheduleLabel}</span>
        <span class="tag">Scad. ${plan.next_due_date ?? '—'}</span>
        ${plan.last_done_date ? `<span class="tag">Ultima eseg. ${plan.last_done_date}</span>` : ''}
        <span class="tag">${(plan.inventory_type_labels ?? []).join(', ') || '—'}</span>
      </div>
    </div>
    <div class="hdr-right">inventory-app<br/>Report Piano #${plan.id}<br/>${now}</div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-lbl">Inventory coperti</div>
      <div class="kpi-val">${coveredCount}</div>
      <div class="kpi-sub">nel piano</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Eseguiti</div>
      <div class="kpi-val" style="color:#16a34a">${completedCount}</div>
      <div class="kpi-sub">ciclo corrente</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Mancanti</div>
      <div class="kpi-val" style="color:${missing > 0 ? '#dc2626' : '#16a34a'}">${missing}</div>
      <div class="kpi-sub">da completare</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Copertura</div>
      <div class="kpi-val" style="color:${barColor}">${pct}%</div>
      <div class="kpi-sub">del ciclo</div>
    </div>
  </div>

  <div class="prog">
    <span class="prog-label">Avanzamento</span>
    <div class="prog-bar-bg">
      <div class="prog-bar-fill" style="width:${pct}%;background:${barColor}"></div>
    </div>
    <span class="prog-pct" style="color:${barColor}">${completedCount} / ${coveredCount}</span>
  </div>

  ${plan.notes ? `<div class="notes">${plan.notes}</div>` : ''}

  <div class="sec">Inventory — ${sortedInv.length} dispositivi ordinati per KNumber</div>
  ${sortedInv.length === 0
    ? '<p style="color:#94a3b8;font-style:italic;font-size:10px;margin-bottom:10px">Nessun inventory trovato per i tipi previsti da questo piano.</p>'
    : `<table>
        <thead><tr>
          <th>KNumber</th><th>Nome</th><th>Sito</th><th>Tipo</th>
          <th style="text-align:center">Data</th><th>Tecnico</th>
          <th style="text-align:center">Risultato</th><th>Note</th>
        </tr></thead>
        <tbody>${invRows}</tbody>
      </table>`
  }

  <div class="footer">
    <span>Piano #${plan.id} &nbsp;·&nbsp; ${plan.customer_name ?? ''} &nbsp;·&nbsp; ${scheduleLabel}</span>
    <span>inventory-app &nbsp;·&nbsp; ${now}</span>
  </div>

</div>
<script>window.onload=()=>{ setTimeout(()=>window.print(), 350) }</script>
</body></html>`

    const w = window.open('', '_blank', 'width=820,height=1000')
    if (w) { w.document.write(html); w.document.close() }
    else toast.warning('Popup bloccato dal browser. Abilita i popup per questo sito.')
  }, [api, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context menu items ─────────────────────────────────────────────────────
  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    if (row.deleted_at) {
      return [
        { key: 'restore', label: 'Ripristina', icon: <EditIcon fontSize="small" />, onClick: () => doRestore(row) },
      ]
    }
    return [
      { key: 'edit',    label: 'Modifica piano',             icon: <EditIcon fontSize="small" />,                    onClick: () => openEdit(row) },
      { key: 'delete',  label: 'Elimina piano',              icon: <DeleteOutlineIcon fontSize="small" />,           onClick: () => setDelDlg(row), tone: 'danger' },
      { key: 'missing', label: 'Vedi manutenzioni mancanti', icon: <AssignmentLateOutlinedIcon fontSize="small" />,  onClick: () => navigate(`/maintenance?m_plan=${row.id}`) },
      { key: 'pdf',     label: 'Crea report PDF',            icon: <PictureAsPdfOutlinedIcon fontSize="small" />,    onClick: () => generatePlanPdf(row) },
    ]
  }, [contextMenu, doRestore, generatePlanPdf, navigate, openEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns: GridColDef<PlanRow>[] = React.useMemo(() => [
    {
      field: '_stato', headerName: 'Stato', width: 112, sortable: false,
      renderCell: (p: GridRenderCellParams<PlanRow>) => {
        const coveredCount   = p.row.covered_count ?? 0
        const completedCount = p.row.completed_count ?? 0
        // Completato: tutti gli inventory coperti hanno un rapportino nel ciclo corrente
        const isArchived  = Boolean(p.row.next_due_date && p.row.next_due_date < currentYearStart)
        const isCompleted = !isArchived && coveredCount > 0 && completedCount >= coveredCount
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              size="small"
              label={isArchived ? 'Archiviato' : isCompleted ? 'Completato' : 'In corso'}
              sx={{
                height: 22, fontSize: '0.72rem', fontWeight: 600,
                ...(isArchived
                  ? { bgcolor: 'rgba(148,163,184,0.15)', color: '#64748b', border: '1px solid rgba(148,163,184,0.35)' }
                  : isCompleted
                  ? { bgcolor: 'rgba(34,197,94,0.12)',   color: '#15803d', border: '1px solid rgba(34,197,94,0.35)' }
                  : { bgcolor: 'rgba(234,179,8,0.12)',   color: '#a16207', border: '1px solid rgba(234,179,8,0.35)' }),
              }}
            />
          </Box>
        )
      },
    },
    {
      field: '_progress', headerName: 'Copertura', width: 150, sortable: false,
      renderCell: (p: GridRenderCellParams<PlanRow>) => {
        const total     = p.row.covered_count  ?? 0
        const completed = p.row.completed_count ?? 0
        const pct       = total > 0 ? Math.round(completed / total * 100) : 0
        const color     = pct === 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
        const trackClr  = pct === 100 ? 'rgba(34,197,94,0.15)' : pct >= 50 ? 'rgba(234,179,8,0.15)' : 'rgba(220,38,38,0.12)'
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', height: '100%' }}>
            <Box sx={{ flex: 1, height: 6, bgcolor: trackClr, borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: String(pct) + '%', bgcolor: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color, minWidth: 32, textAlign: 'right' }}>
              {total > 0 ? `${completed}/${total}` : '—'}
            </Typography>
          </Box>
        )
      },
    },
    {
      field: 'customer_name', headerName: 'Cliente', width: 190,
      renderCell: (p: GridRenderCellParams<PlanRow>) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.value as string}</Typography>
        </Box>
      ),
    },
    { field: 'inventory_type_labels', headerName: 'Tipi', flex: 1, minWidth: 140, valueGetter: (_v: any, row: PlanRow) => (row.inventory_type_labels ?? []).join(', ') || '—' },
    { field: 'title', headerName: 'Piano', width: 230 },
    {
      field: 'next_due_date', headerName: 'Prossima scad.', width: 145,
      renderCell: (p: GridRenderCellParams<PlanRow>) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><DueBadge dateStr={p.value as string} /></Box>,
    },
    {
      field: 'last_done_date', headerName: 'Ultima eseg.', width: 115,
      renderCell: (p: GridRenderCellParams<PlanRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{(p.value as string) ?? '—'}</Typography>
        </Box>
      ),
    },
    {
      field: 'is_active', headerName: 'Attivo', width: 72,
      renderCell: (p: GridRenderCellParams<PlanRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip size="small" label={p.row.is_active ? 'Sì' : 'No'} color={p.row.is_active ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
      ),
    },
  ], []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <EntityListCard
        toolbar={{
          q: grid.q, onQChange: grid.setQ, compact: true,
          rightActions: (
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterChip compact activeCount={fcnt} onReset={fcnt > 0 ? () => { setCustomerF(''); setDue(''); setAct('') } : undefined}>
                <FormControl size="small" fullWidth><InputLabel>Cliente</InputLabel>
                  <Select label="Cliente" value={customerF === '' ? '' : String(customerF)} onChange={e => setCustomerF(e.target.value === '' ? '' : Number(e.target.value))}>
                    <MenuItem value="">Tutti</MenuItem>{customers.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth><InputLabel>Scadenza</InputLabel>
                  <Select label="Scadenza" value={dueFilter} onChange={e => setDue(e.target.value)}>
                    <MenuItem value="">Tutte</MenuItem><MenuItem value="overdue">Scaduti</MenuItem><MenuItem value="next7">Prossimi 7 gg</MenuItem><MenuItem value="next30">Prossimi 30 gg</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth><InputLabel>Stato</InputLabel>
                  <Select label="Stato" value={actFilter} onChange={e => setAct(e.target.value)}>
                    <MenuItem value="">Tutti</MenuItem><MenuItem value="true">Attivi</MenuItem><MenuItem value="false">Non attivi</MenuItem>
                  </Select>
                </FormControl>
              </FilterChip>
              <Tooltip title="Reimposta" arrow><span><Button size="small" variant="contained" onClick={() => { grid.reset(['p_customer', 'p_due', 'p_active', 'p_hide_archived']); setCustomerF(''); setDue(''); setAct(''); setHideArchived(true) }} sx={compactResetButtonSx}><RestartAltIcon /></Button></span></Tooltip>
              <Tooltip title={exporting ? 'Esportazione…' : 'Esporta CSV'} arrow><span>
                <Button size="small" variant="contained" disabled={exporting}
                  onClick={() => exportCsv({ url: '/maintenance-plans/', params: { search: grid.search, ordering: grid.ordering, ...(customerF ? { customer: customerF } : {}), ...(dueFilter ? { due: dueFilter } : {}), ...(actFilter ? { is_active: actFilter } : {}) }, filename: 'piani_manutenzione', columns: [{ label: 'ID', getValue: (r: any) => r.id }, { label: 'Cliente', getValue: (r: any) => r.customer_name }, { label: 'Tipi', getValue: (r: any) => (r.inventory_type_labels ?? []).join(', ') }, { label: 'Piano', getValue: (r: any) => r.title }, { label: 'Inv.', getValue: (r: any) => r.covered_count }, { label: 'Prossima scad.', getValue: (r: any) => r.next_due_date }, { label: 'Ultima eseg.', getValue: (r: any) => r.last_done_date }, { label: 'Attivo', getValue: (r: any) => r.is_active ? 'Sì' : 'No' }] })}
                  sx={compactExportButtonSx}><FileDownloadOutlinedIcon /></Button>
              </span></Tooltip>
              <FormControlLabel
                control={<Switch size="small" checked={hideArchived} onChange={e => setHideArchived(e.target.checked)} color="primary" />}
                label={<Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', userSelect: 'none', whiteSpace: 'nowrap' }}>Nascondi archiviati</Typography>}
                sx={{ m: 0, ml: 0.5, gap: 0.5 }}
              />
            </Stack>
          ),
        }}
        grid={{
          pageKey: 'maintenance-plans',
          username: me?.username,
          rows, columns, loading, rowCount,
          paginationModel: grid.paginationModel, onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel, onSortModelChange: grid.onSortModelChange,
          onRowClick: id => setDrawerPlanId(id),
          onRowContextMenu: handleRowContextMenu,
          sx: GRID_SX,
        }}
      >
        <Can perm={PERMS.maintenance.plan.add}>
          <Tooltip title="Nuovo piano" arrow><span><Button size="small" variant="contained" onClick={openCreate} sx={compactCreateButtonSx}><AddIcon /></Button></span></Tooltip>
        </Can>
      </EntityListCard>

      <PlanDrawer
        open={Boolean(drawerPlanId)} planId={drawerPlanId} onClose={() => setDrawerPlanId(null)}
        onEdit={openEdit} onDelete={p => setDelDlg(p)} onRestore={doRestore}
      />

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      <RapportinoDialog open={rapportinoOpen} techs={allTechs} onClose={() => setRapportinoOpen(false)} onSaved={reload} />

      {/* Dialog crea/modifica piano */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dlgMode === 'create' ? 'Nuovo piano' : 'Modifica piano'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <FormControl size="small" fullWidth required>
              <InputLabel>Cliente *</InputLabel>
              <Select label="Cliente *" value={form.customer === '' ? '' : String(form.customer)} onChange={e => ff({ customer: e.target.value === '' ? '' : Number(e.target.value) })}>
                <MenuItem value="">—</MenuItem>{customers.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth required>
              <InputLabel>Tipi inventario *</InputLabel>
              <Select multiple label="Tipi inventario *" value={form.inventory_types}
                onChange={e => { const v = e.target.value; ff({ inventory_types: typeof v === 'string' ? v.split(',').map(Number) : (v as number[]) }) }}
                input={<OutlinedInput label="Tipi inventario *" />} renderValue={() => selectedTypeLabels.join(', ')}>
                {invTypes.map(t => <MenuItem key={t.id} value={t.id}><Checkbox checked={form.inventory_types.includes(t.id)} size="small" /><ListItemText primary={t.label} /></MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Titolo *" value={form.title} fullWidth onChange={e => ff({ title: e.target.value })} />
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo pianificazione</InputLabel>
              <Select label="Tipo pianificazione" value={form.schedule_type} onChange={e => ff({ schedule_type: e.target.value as any })}>
                <MenuItem value="interval">Intervallo</MenuItem><MenuItem value="fixed_date">Data fissa</MenuItem>
              </Select>
            </FormControl>
            {form.schedule_type === 'interval' && (
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Ogni *" type="number" inputProps={{ min: 1 }} value={form.interval_value} onChange={e => ff({ interval_value: e.target.value === '' ? '' : Number(e.target.value) })} sx={{ flex: 1 }} />
                <FormControl size="small" sx={{ flex: 2 }}>
                  <InputLabel>Unità *</InputLabel>
                  <Select label="Unità *" value={form.interval_unit} onChange={e => ff({ interval_unit: e.target.value as any })}>
                    {Object.entries(UNIT_IT).map(([k, v]) => <MenuItem key={k} value={k}>{v.charAt(0).toUpperCase() + v.slice(1)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            )}
            {form.schedule_type === 'fixed_date' && (
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Giorno *" type="number" inputProps={{ min: 1, max: 31 }} value={form.fixed_day} onChange={e => ff({ fixed_day: e.target.value === '' ? '' : Number(e.target.value) })} sx={{ flex: 1 }} />
                <TextField size="small" label="Mese *" type="number" inputProps={{ min: 1, max: 12 }} value={form.fixed_month} onChange={e => ff({ fixed_month: e.target.value === '' ? '' : Number(e.target.value) })} sx={{ flex: 1 }} />
              </Stack>
            )}
            <Box>
              <FormControlLabel
                control={<Switch size="small" checked={form.next_due_date_auto} onChange={e => { ff({ next_due_date_auto: e.target.checked }); if (e.target.checked) void autoCompute({ ...form, next_due_date_auto: true }) }} />}
                label={<Typography variant="body2">Calcola data automaticamente{computing && <CircularProgress size={10} sx={{ ml: 0.75 }} />}</Typography>}
              />
              <TextField size="small" label="Data prevista *" type="date" fullWidth sx={{ mt: 1.5 }} value={form.next_due_date} InputLabelProps={{ shrink: true }} disabled={form.next_due_date_auto && Boolean(form.next_due_date)} onChange={e => ff({ next_due_date: e.target.value, next_due_date_auto: false })} helperText={form.next_due_date_auto ? 'Calcolata automaticamente' : 'Inserita manualmente'} />
            </Box>
            <TextField size="small" label="Giorni allerta" type="number" inputProps={{ min: 0 }} value={form.alert_days_before} fullWidth onChange={e => ff({ alert_days_before: e.target.value === '' ? '' : Number(e.target.value) })} />
            <FormControlLabel control={<Switch checked={form.is_active} onChange={e => ff({ is_active: e.target.checked })} />} label="Attivo" />
            <TextField size="small" label="Note" value={form.notes} fullWidth multiline minRows={2} onChange={e => ff({ notes: e.target.value })} />
            <CustomFieldsEditor entity="maintenance_plan" value={form.custom_fields} onChange={v => ff({ custom_fields: v })}
              errors={Object.fromEntries(Object.entries(dlgErrors).filter(([k]) => k.startsWith('custom_fields.')).map(([k, v]) => [k.slice('custom_fields.'.length), v]))}
              formError={dlgErrors.custom_fields}
              onClearFieldError={key => setDlgErrors(prev => { const next = { ...prev }; delete next.custom_fields; delete next[`custom_fields.${key}`]; return next })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDlgOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={save} disabled={dlgSave || computing}>{dlgSave ? 'Salvataggio…' : 'Salva'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog open={Boolean(delDlg)} title="Elimina piano" description={`Eliminare il piano "${delDlg?.title}"? L'operazione è reversibile dal cestino.`} busy={delBusy} onConfirm={doDelete} onClose={() => setDelDlg(null)} />
    </>
  )
}
