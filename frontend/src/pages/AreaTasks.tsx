import * as React from 'react'
import { Box, Button, ButtonBase, Stack, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import type { GridColDef } from '@mui/x-data-grid'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { buildDrfListParams } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlArrayParam, useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import EntityListCard from '@shared/ui/EntityListCard'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { useExportCsv } from '@shared/ui/useExportCsv'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { PageHead, ViewTabs, FilterOptionList, TableBar, CampoIcon, useSavedViews, SaveViewDialog, headerFilterGridSx, useUndoToast, type ActiveFilter } from '../ui/campo'
import { IssuePriorityMark } from '../features/issues/IssueBadges'
import AreaTaskDetail from '../features/areatasks/AreaTaskDetail'
import AreaTaskDialog from '../features/areatasks/AreaTaskDialog'
import ConvertToIssueDialog from '../features/areatasks/ConvertToIssueDialog'
import AreaTaskKpis, { useAreaTaskStats } from '../features/areatasks/AreaTaskKpis'
import { TaskDue, TaskStatusBadge, ddmmyyyy } from '../features/areatasks/taskUi'
import {
  NEXT_STATUS, PRIORITY_META, STATUS_META,
  createEmptyTaskForm, extractFieldErrors, formToPayload,
  type AreaTaskRow, type AreaUser, type TaskFormData,
} from '../features/areatasks/types'

type AreaOption = { id: number; label: string }
type RawUser = { id: number; full_name?: string; username?: string }
type TaskView = 'open' | 'mine' | 'late' | 'nobody' | 'done' | 'all'
const VIEWS: TaskView[] = ['open', 'mine', 'late', 'nobody', 'done', 'all']
type ColQ = { title: string; assigned: string }
const EMPTY_COLQ: ColQ = { title: '', assigned: '' }
type ViewState = { view: TaskView; area: string; priority: string[]; status: string[] }

const VIEW_PARAMS: Record<TaskView, Record<string, string>> = {
  open: { is_open: 'true' },
  mine: { is_open: 'true', mine: 'true' },
  late: { overdue: 'true' },
  nobody: { is_open: 'true', unassigned: 'true' },
  done: { is_open: 'false' },
  all: {},
}

const commentChip = (n: number) => (
  <Box component="span" title={`${n} ${n === 1 ? 'commento' : 'commenti'}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: 20, px: '6px', ml: 1, flex: 'none', borderRadius: '5px', fontSize: 11, fontWeight: 600, bgcolor: 'archie.field', color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
    <CampoIcon name="chat" size={12} />{n > 99 ? '99+' : n}
  </Box>
)

const renderTaskCard: MobileCardRenderFn<AreaTaskRow> = ({ row, onOpen }) => (
  <Box role="button" tabIndex={0} onClick={() => onOpen(row.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row.id) }}
    sx={{ display: 'grid', gap: 0.5, p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', cursor: 'pointer' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'text.secondary' }}>#{row.id}</Typography>
      <TaskStatusBadge status={row.status} />
      <IssuePriorityMark priority={row.priority} compact />
      {row.comments_count ? commentChip(row.comments_count) : null}
      <Box sx={{ ml: 'auto', fontSize: 12 }}><TaskDue task={row} /></Box>
    </Box>
    <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{row.title}</Typography>
    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{[row.area_label, row.assigned_to_name || 'Da assegnare'].join(' · ')}</Typography>
  </Box>
)

export default function AreaTasks() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const undoToast = useUndoToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const myAreaId: number | null = me?.profile?.leave_area ?? null
  const myAreaLabel: string | null = me?.profile?.leave_area_label ?? null
  const isSuperuser = Boolean(me?.is_superuser)
  const canAddIssue = hasPerm(PERMS.issues.issue.add)

  const grid = useServerGrid({
    defaultOrdering: 'due_date',
    allowedOrderingFields: ['due_date', 'status', 'title', 'created_at', 'updated_at'],
    defaultPageSize: 25,
  })

  // ── Area: la propria di default, le altre in sola lettura ─────────────────
  const [areas, setAreas] = React.useState<AreaOption[]>([])
  React.useEffect(() => {
    api.get<{ results: AreaOption[] } | AreaOption[]>('/leave-areas/', { params: { page_size: 100 } })
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : r.data.results))
      .catch((e) => toast.error(apiErrorToMessage(e)))
  }, [toast])
  const [areaRaw, setAreaRaw] = useUrlStringParam('area')
  const area: number | '' = areaRaw === 'all' ? '' : areaRaw && /^\d+$/.test(areaRaw) ? Number(areaRaw) : (myAreaId ?? '')
  const areaKey = area === '' ? 'all' : String(area)
  const areaOptions = React.useMemo(() => {
    const list = myAreaId !== null && myAreaLabel && !areas.some((a) => a.id === myAreaId) ? [{ id: myAreaId, label: myAreaLabel }, ...areas] : areas
    return [...list].sort((a, b) => (a.id === myAreaId ? -1 : b.id === myAreaId ? 1 : a.label.localeCompare(b.label, 'it')))
  }, [areas, myAreaId, myAreaLabel])
  const areaLabel = (id: number | '') => (id === '' ? 'Tutte le aree' : areaOptions.find((a) => a.id === id)?.label ?? String(id))
  const readOnlyArea = area !== myAreaId && !isSuperuser

  // ── Vista, filtri da intestazione, ricerca per colonna ────────────────────
  const filterOpts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])
  const [viewRaw, setViewRaw] = useUrlStringParam('vista')
  const view: TaskView = VIEWS.includes(viewRaw as TaskView) ? (viewRaw as TaskView) : 'open'
  const [fPriority, setFPriority] = useUrlArrayParam('priorita')
  const [fStatus, setFStatus] = useUrlArrayParam('stato')
  const [fAssigned, setFAssigned] = useUrlNumberParam('assegnato')
  const [colSearchOpen, setColSearchOpen] = React.useState(false)
  const [colQ, setColQ] = React.useState<ColQ>(EMPTY_COLQ)
  const colQActive = Object.values(colQ).some(Boolean)
  const setCol = (k: keyof ColQ) => (v: string) => { setColQ((c) => ({ ...c, [k]: v })); grid.onPaginationModelChange({ ...grid.paginationModel, page: 0 }) }
  const hasActiveFilters = fPriority.length > 0 || fStatus.length > 0 || fAssigned !== ''
  const resetFilters = React.useCallback(() => { setFPriority([], { patch: { page: 1, stato: '', assegnato: '' }, keepOpen: true }) }, [setFPriority])

  const saved = useSavedViews<ViewState>('area-tasks', me?.username)
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const setView = (v: string) => { setSavedId(null); setViewRaw(v === 'open' ? '' : v, filterOpts) }
  const setArea = (k: string) => { setSavedId(null); setAreaRaw(k === String(myAreaId) ? '' : k, { patch: { page: 1, assegnato: '' }, keepOpen: false }) }
  const applySaved = (id: string) => {
    const v = saved.views.find((x) => x.id === id); if (!v) return
    setSavedId(id)
    setViewRaw(v.state.view === 'open' ? '' : v.state.view, { patch: { page: 1, area: v.state.area, priorita: v.state.priority.join(','), stato: v.state.status.join(',') }, keepOpen: false })
  }

  // ── Lista e indicatori ─────────────────────────────────────────────────────
  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search,
    ordering: grid.ordering,
    page0: grid.paginationModel.page,
    pageSize: grid.paginationModel.pageSize,
    extra: {
      ...(area !== '' ? { area } : {}),
      ...VIEW_PARAMS[view],
      ...(fPriority.length ? { priority: fPriority } : {}),
      ...(fStatus.length ? { status: fStatus } : {}),
      ...(fAssigned !== '' ? { assigned_to: fAssigned } : {}),
      ...(colQ.title ? { title_q: colQ.title } : {}),
      ...(colQ.assigned ? { assigned_q: colQ.assigned } : {}),
    },
  }), [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, area, view, fPriority, fStatus, fAssigned, colQ])

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<AreaTaskRow>('/area-tasks/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))
  const [kpiReload, setKpiReload] = React.useState(0)
  const stats = useAreaTaskStats(area, kpiReload)
  const reloadAll = React.useCallback(() => { reloadList(); setKpiReload((n) => n + 1) }, [reloadList])

  // Persone dell'area (filtro "Assegnato a" e nuovo task).
  const [areaUsers, setAreaUsers] = React.useState<AreaUser[]>([])
  React.useEffect(() => {
    let alive = true
    api.get<RawUser[]>('/users/', { params: { page_size: 200, ...(area !== '' ? { leave_area: area } : {}) } })
      .then((r) => { if (alive) setAreaUsers((Array.isArray(r.data) ? r.data : []).map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) }))) })
      .catch(() => { if (alive) setAreaUsers([]) })
    return () => { alive = false }
  }, [area])

  // ── Pannello ───────────────────────────────────────────────────────────────
  const [openTask, setOpenTask] = React.useState<AreaTaskRow | null>(null)
  const [openTab, setOpenTab] = React.useState(0)
  // Clic sulla riga: seleziona; doppio clic o Invio: apre (come nelle altre pagine).
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const openDetail = React.useCallback((row: AreaTaskRow, tab = 0) => { setOpenTab(tab); setOpenTask(row); setSelectedId(row.id); grid.setOpenId(row.id) }, [grid])
  const closeDetail = React.useCallback(() => { setOpenTask(null); grid.setOpenId(null) }, [grid])
  // Apertura da URL (?open=): anche per un task fuori dalla pagina corrente.
  // Si reagisce solo a un id nuovo: chiudendo, `?open=` sparisce dall'URL un attimo
  // dopo il task aperto, e senza questo controllo la finestra si riaprirebbe (Esc
  // andava premuto due volte).
  const handledOpenId = React.useRef<number | null>(null)
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows
  const openTaskIdRef = React.useRef<number | null>(null)
  openTaskIdRef.current = openTask?.id ?? null
  React.useEffect(() => {
    const id = grid.openId
    if (id === handledOpenId.current) return
    handledOpenId.current = id
    if (!id || openTaskIdRef.current === id) return
    const found = rowsRef.current.find((r) => r.id === id)
    if (found) { setOpenTask(found); return }
    let alive = true
    api.get<AreaTaskRow>(`/area-tasks/${id}/`).then((r) => { if (alive) setOpenTask(r.data) }).catch(() => {})
    return () => { alive = false }
  }, [grid.openId])
  const openIndex = openTask ? rows.findIndex((r) => r.id === openTask.id) : -1

  // ── Nuovo task ─────────────────────────────────────────────────────────────
  const createAreaId: number | null = isSuperuser ? (area !== '' ? area : myAreaId) : myAreaId
  const createAreaLabel = areaOptions.find((a) => a.id === createAreaId)?.label ?? myAreaLabel ?? ''
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [form, setForm] = React.useState<TaskFormData>(createEmptyTaskForm)
  const [createUsers, setCreateUsers] = React.useState<AreaUser[]>([])
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const openCreate = async (prefill?: Partial<TaskFormData>) => {
    if (createAreaId === null) return
    setForm({ ...createEmptyTaskForm(), ...prefill }); setErrors({}); setCreateUsers([]); setDlgOpen(true)
    try {
      const r = await api.get<RawUser[]>('/users/', { params: { leave_area: createAreaId, page_size: 200 } })
      setCreateUsers((Array.isArray(r.data) ? r.data : []).map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  // "Crea task" da un caso ServiceNow: il dialogo si apre già compilato. Se manca l'area
  // (superuser senza area) i dati restano in attesa finché non se ne sceglie una.
  const pendingPrefillRef = React.useRef<{ title: string; description: string } | null>(null)
  React.useEffect(() => {
    const st = loc.state as { createTaskPrefill?: { title: string; description: string } } | null
    if (!st?.createTaskPrefill) return
    pendingPrefillRef.current = st.createTaskPrefill
    navigate(loc.pathname + loc.search, { replace: true, state: {} })
    if (createAreaId === null) {
      if (isSuperuser) toast.info("Scegli l'area del task: il modulo si apre con i dati del caso.")
      else { toast.warning("Per creare un task serve un'area del piano ferie nel tuo profilo."); pendingPrefillRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state])
  React.useEffect(() => {
    if (!pendingPrefillRef.current || createAreaId === null) return
    const prefill = pendingPrefillRef.current
    pendingPrefillRef.current = null
    void openCreate(prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createAreaId, loc.state])

  const saveNew = async () => {
    if (saving || createAreaId === null) return
    setSaving(true); setErrors({})
    try {
      const r = await api.post<AreaTaskRow>('/area-tasks/', { ...formToPayload(form), area: createAreaId })
      toast.success('Task creato')
      setDlgOpen(false)
      reloadAll()
      openDetail(r.data)
    } catch (e) {
      const fields = extractFieldErrors(e)
      if (Object.keys(fields).length) setErrors(fields); else toast.error(apiErrorToMessage(e))
    } finally { setSaving(false) }
  }

  // ── Menu della riga ────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = React.useState<{ row: AreaTaskRow; mouseX: number; mouseY: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<AreaTaskRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [convertTarget, setConvertTarget] = React.useState<AreaTaskRow | null>(null)

  const setStatusFromRow = React.useCallback(async (row: AreaTaskRow) => {
    const next = NEXT_STATUS[row.status]
    try {
      await api.patch(`/area-tasks/${row.id}/`, { status: next })
      reloadAll()
      undoToast.show(`Stato: ${STATUS_META[next].label} · salvato`, async () => {
        try { await api.patch(`/area-tasks/${row.id}/`, { status: row.status }); reloadAll() } catch (e) { toast.error(apiErrorToMessage(e)) }
      })
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [reloadAll, toast, undoToast])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    const edit = row.can_edit
    return [
      { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDetail(row, 0) },
      { key: 'comment', label: 'Commenta', icon: <ChatBubbleOutlineIcon fontSize="small" />, onClick: () => openDetail(row, 1), disabled: !edit },
      { key: 'next', label: `Segna come ${STATUS_META[NEXT_STATUS[row.status]].label}`, icon: <EditIcon fontSize="small" />, onClick: () => void setStatusFromRow(row), disabled: !edit, hidden: Boolean(row.converted_to_issue) },
      row.converted_to_issue && !row.converted_to_issue_deleted
        ? { key: 'issue', label: `Apri la issue #${row.converted_to_issue}`, icon: <CampoIcon name="alert" />, onClick: () => navigate(`/issues${buildQuery({ open: row.converted_to_issue })}`) }
        : { key: 'convert', label: 'Trasforma in issue', icon: <CampoIcon name="alert" />, onClick: () => setConvertTarget(row), disabled: !edit, hidden: !canAddIssue },
      { key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(row), tone: 'danger' as const, disabled: !edit },
    ]
  }, [contextMenu, openDetail, setStatusFromRow, navigate, canAddIssue])

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/area-tasks/${deleteTarget.id}/`)
      toast.success('Task spostato nel cestino')
      if (openTask?.id === deleteTarget.id) closeDetail()
      setDeleteTarget(null)
      reloadAll()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDeleting(false) }
  }

  // ── Colonne: stessa resa delle Issue ───────────────────────────────────────
  const columns = React.useMemo<GridColDef<AreaTaskRow>[]>(() => [
    { field: 'id', headerName: 'ID', width: 62, sortable: false, renderCell: ({ row }) => <Typography component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'text.secondary' }}>#{row.id}</Typography> },
    { field: 'priority', headerName: 'Priorità', width: 91, sortable: false, renderCell: ({ row }) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><IssuePriorityMark priority={row.priority} /></Box> },
    { field: 'status', headerName: 'Stato', width: 132, renderCell: ({ row }) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><TaskStatusBadge status={row.status} /></Box> },
    {
      field: 'title', headerName: 'Titolo', flex: 1, minWidth: 240,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{row.title}</Typography>
          {row.comments_count ? commentChip(row.comments_count) : null}
          {row.converted_to_issue ? (
            <Tooltip title={row.converted_to_issue_deleted ? `La issue #${row.converted_to_issue} è nel cestino: il task si può trasformare di nuovo` : `Diventato la issue #${row.converted_to_issue}`}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', ml: 1, flex: 'none', fontSize: 11, fontWeight: 600, color: row.converted_to_issue_deleted ? 'text.secondary' : 'info.main' }}><CampoIcon name="arrowR" size={12} />Issue #{row.converted_to_issue}{row.converted_to_issue_deleted ? ' nel cestino' : ''}</Box>
            </Tooltip>
          ) : null}
        </Box>
      ),
    },
    { field: 'area_label', headerName: 'Area', width: 120, sortable: false, renderCell: ({ row }) => <Typography noWrap sx={{ fontSize: 13 }}>{row.area_label}</Typography> },
    {
      field: 'assigned_to_name', headerName: 'Assegnato a', width: 140, sortable: false,
      renderCell: ({ row }) => row.assigned_to_name ? <Typography noWrap sx={{ fontSize: 13 }}>{row.assigned_to_name}</Typography> : <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>Da assegnare</Typography>,
    },
    { field: 'due_date', headerName: 'Scadenza', width: 123, renderCell: ({ row }) => <Typography variant="body2" component="span"><TaskDue task={row} /></Typography> },
    { field: 'created_at', headerName: 'Creato', width: 110, renderCell: ({ row }) => <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{ddmmyyyy(row.created_at)}</Typography> },
  ], [])

  const filterConfig = React.useMemo<Record<string, ColumnFilterConfig>>(() => {
    const make = (label: string, sel: string[], set: (v: string[]) => void, options: { value: string; label: string }[], opts?: { single?: boolean; searchable?: boolean }) => ({
      value: sel.join(','),
      label: `Filtra ${label.toLowerCase()}`,
      onSet: (v: string | number | '') => set(v === '' ? [] : String(v).split(',')),
      onReset: () => set([]),
      children: <FilterOptionList label={label} options={options} selected={sel} onChange={set} single={opts?.single} searchable={opts?.searchable} />,
    })
    const cfg: Record<string, ColumnFilterConfig> = {
      priority: make('Priorità', fPriority, (v) => setFPriority(v, filterOpts), ['critical', 'high', 'medium', 'low'].map((k) => ({ value: k, label: PRIORITY_META[k as keyof typeof PRIORITY_META].label }))),
      status: make('Stato', fStatus, (v) => setFStatus(v, filterOpts), Object.entries(STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))),
    }
    if (view !== 'mine' && view !== 'nobody') {
      cfg.assigned_to_name = make('Assegnato a', fAssigned === '' ? [] : [String(fAssigned)], (v) => setFAssigned(v[0] ? Number(v[0]) : '', filterOpts),
        areaUsers.map((u) => ({ value: String(u.id), label: u.label })), { single: true, searchable: true })
    }
    return cfg
  }, [fPriority, fStatus, fAssigned, setFPriority, setFStatus, setFAssigned, areaUsers, view, filterOpts])

  const activeFilters: ActiveFilter[] = [
    fPriority.length ? { key: 'priority', label: 'Priorità', values: fPriority.map((k) => PRIORITY_META[k as keyof typeof PRIORITY_META]?.label ?? k).join(', ') } : null,
    fStatus.length ? { key: 'status', label: 'Stato', values: fStatus.map((k) => STATUS_META[k as keyof typeof STATUS_META]?.label ?? k).join(', ') } : null,
    fAssigned !== '' ? { key: 'assigned', label: 'Assegnato a', values: areaUsers.find((u) => u.id === fAssigned)?.label ?? String(fAssigned) } : null,
  ].filter((x): x is ActiveFilter => Boolean(x))
  const removeFilter = (key: string) => {
    if (key === 'priority') setFPriority([], filterOpts)
    if (key === 'status') setFStatus([], filterOpts)
    if (key === 'assigned') setFAssigned('', filterOpts)
  }

  const emptyState = React.useMemo(() => {
    const searching = Boolean(grid.search.trim()) || colQActive
    if (searching || hasActiveFilters) {
      return {
        title: 'Nessun risultato', subtitle: 'Nessun task corrisponde: prova a modificare la ricerca, la vista o i filtri.',
        action: (
          <Stack direction="row" spacing={1} justifyContent="center">
            {searching ? <Button variant="outlined" onClick={() => { grid.setQ(''); setColQ(EMPTY_COLQ) }}>Cancella ricerca</Button> : null}
            {hasActiveFilters ? <Button variant="outlined" onClick={resetFilters}>Azzera filtri</Button> : null}
          </Stack>
        ),
      }
    }
    if (view === 'late') return { title: 'Nessun task scaduto', subtitle: 'Tutti i task aperti sono nei tempi.' }
    if (view === 'mine') return { title: 'Nessun task assegnato a te', subtitle: 'Quando qualcuno ti assegna un task lo trovi qui.' }
    if (view === 'nobody') return { title: 'Nessun task da assegnare', subtitle: 'Ogni task aperto ha qualcuno che lo segue.' }
    if (view === 'done') return { title: 'Nessun task completato di recente', subtitle: 'I completati restano in elenco per 3 giorni dalla chiusura.' }
    return { title: 'Nessun task', subtitle: area === '' ? 'Non ci sono task aperti.' : `Non ci sono task aperti nell'area ${areaLabel(area)}.` }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, colQActive, hasActiveFilters, resetFilters, view, area, areaOptions])

  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<AreaTaskRow>({
      url: '/area-tasks/', params, filename: 'task-di-area',
      columns: [
        { label: 'ID', getValue: (r) => String(r.id) },
        { label: 'Titolo', getValue: (r) => r.title },
        { label: 'Area', getValue: (r) => r.area_label },
        { label: 'Stato', getValue: (r) => STATUS_META[r.status].label },
        { label: 'Priorità', getValue: (r) => PRIORITY_META[r.priority].label },
        { label: 'Assegnato a', getValue: (r) => r.assigned_to_name ?? '' },
        { label: 'Scadenza', getValue: (r) => ddmmyyyy(r.due_date) },
        { label: 'Creato', getValue: (r) => ddmmyyyy(r.created_at) },
        { label: 'Issue', getValue: (r) => (r.converted_to_issue ? `#${r.converted_to_issue}` : '') },
      ],
    })
  }

  const openColumnsRef = React.useRef<((el: HTMLElement) => void) | null>(null)
  const canCreate = createAreaId !== null && (area === '' || area === createAreaId)
  const createHint = createAreaId === null ? (isSuperuser ? "Seleziona un'area" : 'Nessuna area assegnata al tuo profilo') : !canCreate ? `Puoi creare task solo nell'area ${createAreaLabel}` : ''

  const areaSwitch = (
    <Box role="group" aria-label="Area" sx={{ display: 'inline-flex', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'archie.surface2' }}>
      {[...areaOptions.map((a) => ({ key: String(a.id), label: a.label, mine: a.id === myAreaId })), { key: 'all', label: 'Tutte', mine: false }].map((o) => {
        const on = o.key === areaKey
        return (
          <ButtonBase key={o.key} aria-pressed={on} onClick={() => setArea(o.key)} sx={{
            height: 28, px: 1.25, gap: 0.75, borderRadius: '6px', fontSize: 13, fontWeight: 550, color: on ? 'text.primary' : 'text.secondary',
            bgcolor: on ? 'background.paper' : 'transparent', boxShadow: on ? (t) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` : 'none',
            '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>
            {o.label}
            {o.mine ? <Box component="small" sx={{ fontSize: 10, fontWeight: 600, color: 'primary.main', bgcolor: 'archie.field', borderRadius: '4px', px: 0.625 }}>la tua</Box> : null}
          </ButtonBase>
        )
      })}
    </Box>
  )

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead
        title="Task di area"
        inline={areaSwitch}
        meta={stats ? <><b>{stats.open}</b> aperti · <Box component="b" sx={{ color: stats.overdue ? 'error.main' : undefined }}>{stats.overdue}</Box> scaduti · <b>{stats.mine}</b> assegnati a te</> : undefined}
        actions={
          <Tooltip title={createHint}>
            <span><Button startIcon={<AddIcon />} variant="contained" disabled={!canCreate} onClick={() => void openCreate()}>Nuovo task</Button></span>
          </Tooltip>
        }
      />
      <AreaTaskKpis s={stats} view={view} onView={setView} statusPick={fStatus}
        onStatusPick={(k) => { setSavedId(null); setViewRaw('', { patch: { page: 1, stato: fStatus.length === 1 && fStatus[0] === k ? '' : k }, keepOpen: true }) }} />

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs
          value={savedId ? `saved:${savedId}` : view}
          onChange={(k) => { if (k.startsWith('saved:')) { applySaved(k.slice(6)); return } setView(k) }}
          tabs={[
            { key: 'open', label: 'Aperti', count: stats?.open },
            { key: 'mine', label: 'I miei', count: stats?.mine },
            { key: 'late', label: 'Scaduti', count: stats?.overdue, tone: stats?.overdue ? 'alert' : undefined },
            { key: 'nobody', label: 'Da assegnare', count: stats?.unassigned },
            { key: 'done', label: 'Completati', count: stats?.done_recent },
            { key: 'all', label: 'Tutti', count: stats ? stats.open + stats.done_recent : undefined },
            ...saved.views.map((v) => ({ key: `saved:${v.id}`, label: v.name, onRemove: () => { saved.remove(v.id); setSavedId(null) } })),
          ]}
          end={
            <Button size="small" onClick={() => setSaveOpen(true)} startIcon={<CampoIcon name="plus" size={14} />}
              sx={{ color: 'primary.main', fontWeight: 550, display: { xs: 'none', sm: 'inline-flex' } }}>
              Salva vista
            </Button>
          }
        />
        <SaveViewDialog open={saveOpen} onClose={() => setSaveOpen(false)}
          onSave={(name) => { const v = saved.add(name, { view, area: areaRaw, priority: fPriority, status: fStatus }); setSavedId(v.id) }} />
        {readOnlyArea ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
            <CampoIcon name="lock" size={14} />
            {area === ''
              ? <span>Stai vedendo tutte le aree: i task delle altre aree sono in <b>sola lettura</b>.</span>
              : <span>Area <b>{areaLabel(area)}</b> · sola lettura. Puoi leggere task, commenti e allegati; li modifica chi fa parte dell'area.</span>}
          </Box>
        ) : null}
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={renderTaskCard}
          openColumnsRef={openColumnsRef}
          header={
            <TableBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearFilters={resetFilters}
              q={grid.q}
              onQChange={grid.setQ}
              searchPlaceholder="Cerca titolo o descrizione…"
              onExport={exportVisible}
              exporting={exporting}
              onColumns={(el) => openColumnsRef.current?.(el)}
              columnSearch={{ open: colSearchOpen, active: colQActive, onToggle: () => { if (colSearchOpen) setColQ(EMPTY_COLQ); setColSearchOpen((v) => !v) } }}
            />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca task…' }}
          grid={{
            pageKey: 'area-tasks',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            defaultHiddenColumns: area === '' ? [] : ['area_label'],
            columnSearch: {
              open: colSearchOpen,
              fields: {
                title: { value: colQ.title, onChange: setCol('title'), placeholder: 'Titolo' },
                assigned_to_name: { value: colQ.assigned, onChange: setCol('assigned'), placeholder: 'Nome' },
              },
            },
            rows,
            columns,
            loading,
            rowCount,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: setSelectedId,
            onRowOpen: (id) => { const r = rows.find((x) => x.id === id); if (r) openDetail(r) },
            onRowContextMenu: (row, e) => setContextMenu({ row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 }),
            getRowClassName: (row) => (selectedId === row.id ? 'Mui-selected' : undefined),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>

      <AreaTaskDetail
        task={openTask}
        initialTab={openTab}
        position={openIndex >= 0 ? `${openIndex + 1} di ${rows.length}` : undefined}
        onPrev={openIndex > 0 ? () => openDetail(rows[openIndex - 1]) : undefined}
        onNext={openIndex >= 0 && openIndex < rows.length - 1 ? () => openDetail(rows[openIndex + 1]) : undefined}
        onClose={closeDetail}
        onChanged={(next) => { setOpenTask(next); reloadAll() }}
        onDeleted={() => { closeDetail(); reloadAll() }}
      />

      <AreaTaskDialog
        open={dlgOpen}
        task={null}
        areaLabel={createAreaLabel}
        form={form}
        users={createUsers}
        saving={saving}
        errors={errors}
        onFormChange={setForm}
        onSave={() => { void saveNew() }}
        onClose={() => setDlgOpen(false)}
      />

      <ConvertToIssueDialog
        open={Boolean(convertTarget)}
        task={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConverted={(result) => {
          toast.success(`Task trasformato nella issue #${result.issue.id}.`)
          setOpenTask((cur) => (cur?.id === result.task.id ? result.task : cur))
          setConvertTarget(null)
          reloadAll()
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        busy={deleting}
        title="Eliminare il task?"
        description={`Il task «${deleteTarget?.title ?? ''}» verrà spostato nel cestino.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { void doDelete() }}
      />

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={() => setContextMenu(null)}
        items={contextMenuItems}
      />
    </Stack>
  )
}
