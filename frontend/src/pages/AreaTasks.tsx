import * as React from 'react'
import {
  Box, Button, Checkbox, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
  Stack, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditIcon from '@mui/icons-material/Edit'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { GridColDef } from '@mui/x-data-grid'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { buildDrfListParams, type DrfParams } from '@shared/api/drf'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { useDataGridZebraSx } from '../theme/AppThemeProvider'
import AreaTaskDetail from '../features/areatasks/AreaTaskDetail'
import AreaTaskDialog from '../features/areatasks/AreaTaskDialog'
import ConvertToIssueDialog from '../features/areatasks/ConvertToIssueDialog'
import {
  NEXT_STATUS, PRIORITY_META, PRIORITY_ORDER, STATUS_META,
  createEmptyTaskForm, extractFieldErrors, fmtTaskDate, formToPayload, taskToForm,
  type AreaTaskRow, type AreaUser, type TaskFormData, type TaskPriority, type TaskStatus,
} from '../features/areatasks/types'

type AreaOption = { id: number; label: string }
type RawUser = { id: number; full_name?: string; username?: string }
type StatusView = 'open' | 'done' | 'all'

const OPEN_STATUSES: TaskStatus[] = ['da_fare', 'in_corso', 'in_attesa']

function priorityColor(p: TaskPriority): 'error' | 'warning' | 'default' {
  if (p === 'critical') return 'error'
  if (p === 'high') return 'warning'
  return 'default'
}

function statusColor(s: TaskStatus): 'success' | 'warning' | 'info' | 'default' {
  if (s === 'completato') return 'success'
  if (s === 'in_corso') return 'warning'
  if (s === 'in_attesa') return 'info'
  return 'default'
}

function StatusViewChipBar({ value, onChange }: { value: StatusView; onChange: (v: StatusView) => void }) {
  const options: { key: StatusView; label: string }[] = [
    { key: 'open', label: 'Aperti' },
    { key: 'done', label: 'Chiusi' },
    { key: 'all', label: 'Tutti' },
  ]
  return (
    <Stack direction="row" spacing={1}>
      {options.map((o) => {
        const selected = value === o.key
        return (
          <Chip
            key={o.key}
            size="small"
            label={o.label}
            clickable
            onClick={() => onChange(o.key)}
            color={selected ? (o.key === 'open' ? 'error' : o.key === 'done' ? 'default' : 'primary') : 'default'}
            variant={selected ? 'filled' : 'outlined'}
          />
        )
      })}
    </Stack>
  )
}

export default function AreaTasks() {
  const zebraSx = useDataGridZebraSx()
  const { me, hasPerm } = useAuth()
  const toast = useToast()

  const myAreaId = me?.profile?.leave_area ?? null
  const myAreaLabel = me?.profile?.leave_area_label ?? null
  const isSuperuser = Boolean(me?.is_superuser)

  const grid = useServerGrid({
    defaultOrdering: 'due_date',
    allowedOrderingFields: ['due_date', 'status', 'title', 'created_at', 'updated_at'],
  })

  // ── Filtri ────────────────────────────────────────────────────────────────
  const [areas, setAreas] = React.useState<AreaOption[]>([])
  const [areaFilter, setAreaFilter] = React.useState<number | ''>(myAreaId ?? '')
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | ''>('')
  const [onlyMine, setOnlyMine] = React.useState(false)
  const [statusView, setStatusView] = React.useState<StatusView>('open')
  const [assigneeFilter, setAssigneeFilter] = React.useState<number | ''>('')
  const [overdue, setOverdue] = React.useState(false)
  const [filterUsers, setFilterUsers] = React.useState<AreaUser[]>([])

  React.useEffect(() => {
    api.get<{ results: AreaOption[] } | AreaOption[]>('/leave-areas/', { params: { page_size: 100 } })
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : r.data.results))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const areaOptions = React.useMemo(
    () =>
      myAreaId !== null && myAreaLabel && !areas.some((a) => a.id === myAreaId)
        ? [{ id: myAreaId, label: myAreaLabel }, ...areas]
        : areas,
    [areas, myAreaId, myAreaLabel],
  )

  React.useEffect(() => {
    let cancelled = false
    const params: Record<string, number> = { page_size: 200 }
    if (areaFilter !== '') params.leave_area = areaFilter
    api.get<RawUser[]>('/users/', { params })
      .then((r) => {
        if (cancelled) return
        const list = Array.isArray(r.data) ? r.data : []
        setFilterUsers(list.map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
      })
      .catch((e) => { if (!cancelled) toast.error(apiErrorToMessage(e)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaFilter])

  const firstPage = () => grid.syncUrl({ page: 1 }, { keepOpen: true })
  const changeArea = (v: number | '') => { setAreaFilter(v); setAssigneeFilter(''); firstPage() }
  const changeAssignee = (v: number | '') => { setAssigneeFilter(v); firstPage() }
  const changeOverdue = (v: boolean) => { setOverdue(v); firstPage() }
  const changePriority = (v: TaskPriority | '') => { setPriorityFilter(v); firstPage() }
  const changeOnlyMine = (v: boolean) => { setOnlyMine(v); firstPage() }
  const changeStatusView = (v: StatusView) => { setStatusView(v); firstPage() }

  const activeFilterCount = [
    areaFilter !== (myAreaId ?? '') ? 'area' : '',
    priorityFilter,
    onlyMine ? 'mine' : '',
    assigneeFilter !== '' ? 'assignee' : '',
    overdue ? 'overdue' : '',
    statusView !== 'open' ? statusView : '',
  ].filter(Boolean).length

  const extra = React.useMemo(() => {
    const p: DrfParams = { include_hidden: 1 }
    if (areaFilter !== '') p.area = areaFilter
    if (priorityFilter) p.priority = priorityFilter
    if (onlyMine) p.mine = 'true'
    if (assigneeFilter !== '') p.assigned_to = assigneeFilter
    if (overdue) {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const pad = (n: number) => String(n).padStart(2, '0')
      p.due_before = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      p.status = OPEN_STATUSES
    } else if (statusView === 'open') p.status = OPEN_STATUSES
    else if (statusView === 'done') p.status = 'completato'
    return p
  }, [areaFilter, priorityFilter, onlyMine, statusView, assigneeFilter, overdue])

  // La pagina in URL si aggiorna in modo asincrono dopo un cambio filtro:
  // finché non ha "raggiunto" i nuovi filtri, la richiesta usa la pagina 0
  // (altrimenti partirebbe filtro nuovo + pagina vecchia, con 404 DRF).
  const filterKey = JSON.stringify(extra)
  const [trustedKey, setTrustedKey] = React.useState(filterKey)
  const urlPage = grid.paginationModel.page
  const page0 = trustedKey === filterKey ? urlPage : 0
  React.useEffect(() => {
    if (trustedKey !== filterKey && urlPage === 0) setTrustedKey(filterKey)
  }, [trustedKey, filterKey, urlPage])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        page0,
        pageSize: grid.paginationModel.pageSize,
        ordering: grid.ordering,
        search: grid.search,
        extra,
      }),
    [page0, grid.paginationModel.pageSize, grid.ordering, grid.search, extra],
  )

  const { rows, rowCount, loading, reload } = useDrfList<AreaTaskRow>('/area-tasks/', listParams, (e) =>
    toast.error(apiErrorToMessage(e)),
  )

  // ── Dettaglio ─────────────────────────────────────────────────────────────
  const [openTask, setOpenTask] = React.useState<AreaTaskRow | null>(null)
  const [openTaskInitialTab, setOpenTaskInitialTab] = React.useState(0)

  const openDetail = React.useCallback((row: AreaTaskRow, tab = 0) => {
    setOpenTaskInitialTab(tab)
    setOpenTask(row)
  }, [])

  // ── Creazione / modifica ──────────────────────────────────────────────────
  // Un solo dialog per crea e modifica: `editingTask` non-null discrimina la
  // modifica (task={editingTask}, PATCH) dalla creazione (task=null, POST).
  const createAreaId: number | null = isSuperuser ? (areaFilter !== '' ? areaFilter : myAreaId) : myAreaId
  const createAreaLabel =
    areas.find((a) => a.id === createAreaId)?.label ?? (createAreaId === myAreaId ? myAreaLabel : null) ?? ''

  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<AreaTaskRow | null>(null)
  const [form, setForm] = React.useState<TaskFormData>(createEmptyTaskForm)
  const [users, setUsers] = React.useState<AreaUser[]>([])
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const openCreate = async () => {
    if (createAreaId === null) return
    setEditingTask(null)
    setForm(createEmptyTaskForm())
    setErrors({})
    setUsers([])
    setTaskDialogOpen(true)
    try {
      const r = await api.get<RawUser[]>('/users/', { params: { leave_area: createAreaId, page_size: 200 } })
      const list = Array.isArray(r.data) ? r.data : []
      setUsers(list.map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const openEditTask = async (row: AreaTaskRow) => {
    setEditingTask(row)
    setForm(taskToForm(row))
    setErrors({})
    setUsers([])
    setTaskDialogOpen(true)
    try {
      const r = await api.get<RawUser[]>('/users/', { params: { leave_area: row.area, page_size: 200 } })
      const list = Array.isArray(r.data) ? r.data : []
      setUsers(list.map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const saveTask = async () => {
    if (saving) return
    setSaving(true)
    setErrors({})
    try {
      if (editingTask) {
        await api.patch<AreaTaskRow>(`/area-tasks/${editingTask.id}/`, formToPayload(form))
        toast.success('Task aggiornato.')
      } else {
        if (createAreaId === null) { setSaving(false); return }
        await api.post<AreaTaskRow>('/area-tasks/', { ...formToPayload(form), area: createAreaId })
        toast.success('Task creato.')
      }
      setTaskDialogOpen(false)
      setEditingTask(null)
      reload()
    } catch (e) {
      const fields = extractFieldErrors(e)
      if (Object.keys(fields).length > 0) setErrors(fields)
      else toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Elimina ───────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<AreaTaskRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const handleDeleteTask = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/area-tasks/${deleteTarget.id}/`)
      toast.success('Task eliminato.')
      setDeleteTarget(null)
      reload()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  // ── Trasforma in issue ───────────────────────────────────────────────────
  const [convertTarget, setConvertTarget] = React.useState<AreaTaskRow | null>(null)

  // ── Menu contestuale ──────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = React.useState<{
    row: AreaTaskRow
    mouseX: number
    mouseY: number
  } | null>(null)

  const handleRowContextMenu = React.useCallback(
    (row: AreaTaskRow, event: React.MouseEvent<HTMLElement>) => {
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    },
    [],
  )

  const handleMarkNextStatus = React.useCallback(
    async (row: AreaTaskRow) => {
      const next = NEXT_STATUS[row.status]
      try {
        await api.patch<AreaTaskRow>(`/area-tasks/${row.id}/`, { status: next })
        reload()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      }
    },
    [reload, toast],
  )

  const contextMenuItems: RowContextMenuItem[] = (() => {
    const row = contextMenu?.row
    if (!row) return []

    const canEdit = row.can_edit
    const next = NEXT_STATUS[row.status]
    const convertedToIssue = row.converted_to_issue

    return [
      {
        key: 'open',
        label: 'Apri dettaglio',
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => openDetail(row, 0),
      },
      {
        key: 'edit',
        label: 'Modifica',
        icon: <EditIcon fontSize="small" />,
        onClick: () => { void openEditTask(row) },
        disabled: !canEdit,
      },
      {
        key: 'comment',
        label: 'Commenta',
        icon: <ChatBubbleOutlineIcon fontSize="small" />,
        onClick: () => openDetail(row, 1),
        disabled: !canEdit,
      },
      {
        key: 'next_status',
        label: `Segna come ${STATUS_META[next].label}`,
        icon: <AutorenewRoundedIcon fontSize="small" />,
        onClick: () => { void handleMarkNextStatus(row) },
        disabled: !canEdit,
      },
      {
        key: 'convert',
        label: 'Trasforma in issue',
        icon: <SwapHorizIcon fontSize="small" />,
        onClick: () => setConvertTarget(row),
        hidden: Boolean(convertedToIssue) || !hasPerm(PERMS.issues.issue.add),
        disabled: !canEdit,
      },
      {
        key: 'delete',
        label: 'Elimina',
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: () => setDeleteTarget(row),
        tone: 'danger',
        disabled: !canEdit,
      },
    ]
  })()

  // ── Colonne ───────────────────────────────────────────────────────────────
  const columns: GridColDef<AreaTaskRow>[] = [
    {
      field: 'priority',
      headerName: 'Priorità',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={PRIORITY_META[row.priority].label}
          color={priorityColor(row.priority)}
          variant={row.priority === 'high' || row.priority === 'critical' ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Stato',
      width: 130,
      renderCell: ({ row }) => (
        <Chip size="small" label={STATUS_META[row.status].label} color={statusColor(row.status)} variant="outlined" />
      ),
    },
    {
      field: 'title',
      headerName: 'Titolo',
      flex: 1,
      minWidth: 220,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%', minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ textDecoration: row.status === 'completato' ? 'line-through' : 'none' }}>
            {row.title}
          </Typography>
          {row.comments_count > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled', flexShrink: 0 }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">{row.comments_count}</Typography>
            </Stack>
          ) : null}
          {row.drive_files_detail.length > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled', flexShrink: 0 }}>
              <AttachFileIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">{row.drive_files_detail.length}</Typography>
            </Stack>
          ) : null}
        </Box>
      ),
    },
    { field: 'area_label', headerName: 'Area', width: 150, sortable: false },
    {
      field: 'assigned_to_name',
      headerName: 'Assegnato a',
      width: 170,
      sortable: false,
      valueGetter: (_value, row) => row.assigned_to_name ?? '',
    },
    {
      field: 'due_date',
      headerName: 'Scadenza',
      width: 120,
      renderCell: ({ row }) => {
        const label = fmtTaskDate(row.due_date)
        const overdue = row.due_date && row.status !== 'completato' && new Date(`${row.due_date}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0))
        return (
          <Typography variant="body2" sx={{ color: overdue ? 'error.main' : 'text.primary', fontWeight: overdue ? 600 : 400 }}>
            {label ?? '—'}
          </Typography>
        )
      },
    },
  ]

  const emptyState = React.useMemo(
    () =>
      grid.search.trim() || activeFilterCount > 0
        ? { title: 'Nessun risultato', subtitle: 'Prova a cambiare ricerca o filtri.' }
        : { title: 'Nessun task', subtitle: 'Non ci sono task per questa area.' },
    [grid.search, activeFilterCount],
  )

  const canCreate = createAreaId !== null

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          alignRightActions: true,
          rightActions: (
            <Tooltip title={canCreate ? '' : isSuperuser ? "Seleziona un'area" : 'Nessuna area assegnata al tuo profilo'}>
              <span>
                <Button startIcon={<AddIcon />} variant="contained" disabled={!canCreate} onClick={() => { void openCreate() }}>
                  Nuovo task
                </Button>
              </span>
            </Tooltip>
          ),
        }}
        grid={{
          pageKey: 'area-tasks',
          username: me?.username,
          rows,
          emptyState,
          rowCount,
          loading,
          columns,
          paginationModel: { page: page0, pageSize: grid.paginationModel.pageSize },
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => {
            const found = rows.find((r) => r.id === id)
            if (found) openDetail(found, 0)
          },
          onRowContextMenu: handleRowContextMenu,
          getRowClassName: (r) => (r.status === 'completato' ? 'row-done-task' : undefined),
          sx: {
            cursor: 'pointer',
            ...zebraSx,
            '& .row-done-task': { opacity: 0.55 },
            '& .row-done-task:hover': { opacity: 0.85 },
          },
        }}
        belowToolbar={
        // Tutti i filtri extra (Area, Priorità, Assegnatario, Scaduti, Assegnati a me)
        // in un'unica area sotto la toolbar — prima erano divisi tra qui e i
        // children di EntityListCard, incongruenza interna segnalata in revisione.
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 0.5, py: 1 }}>
          <Select
            size="small"
            displayEmpty
            value={areaFilter}
            onChange={(e) => { const v = e.target.value as number | string; changeArea(v === '' ? '' : Number(v)) }}
            SelectDisplayProps={{ 'aria-label': 'Area' }}
            sx={{ minWidth: 170, height: 32, fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.5 } }}
          >
            <MenuItem value="">Tutte le aree</MenuItem>
            {areaOptions.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.label}{a.id === myAreaId ? ' (mia)' : ''}</MenuItem>
            ))}
          </Select>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="priority-filter-label">Priorità</InputLabel>
            <Select
              labelId="priority-filter-label"
              label="Priorità"
              value={priorityFilter}
              onChange={(e) => changePriority(e.target.value as TaskPriority | '')}
            >
              <MenuItem value="">Tutte</MenuItem>
              {PRIORITY_ORDER.map((p) => (
                <MenuItem key={p} value={p}>{PRIORITY_META[p].label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="assignee-filter-label">Assegnatario</InputLabel>
            <Select
              labelId="assignee-filter-label"
              label="Assegnatario"
              value={assigneeFilter === '' || filterUsers.some((u) => u.id === assigneeFilter) ? assigneeFilter : ''}
              onChange={(e) => { const v = e.target.value as number | string; changeAssignee(v === '' ? '' : Number(v)) }}
            >
              <MenuItem value="">Tutti</MenuItem>
              {filterUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox size="small" checked={overdue} onChange={(e) => changeOverdue(e.target.checked)} />}
            label="Scaduti"
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={onlyMine} onChange={(e) => changeOnlyMine(e.target.checked)} />}
            label="Assegnati a me"
          />
        </Stack>
        }
      >
        <StatusViewChipBar value={statusView} onChange={changeStatusView} />
      </EntityListCard>

      <AreaTaskDetail
        task={openTask}
        initialTab={openTaskInitialTab}
        onClose={() => setOpenTask(null)}
        onChanged={(next) => { setOpenTask(next); reload() }}
        onDeleted={() => { setOpenTask(null); reload() }}
      />

      <AreaTaskDialog
        open={taskDialogOpen}
        task={editingTask}
        areaLabel={editingTask ? editingTask.area_label : createAreaLabel}
        form={form}
        users={users}
        saving={saving}
        errors={errors}
        onFormChange={setForm}
        onSave={() => { void saveTask() }}
        onClose={() => { setTaskDialogOpen(false); setEditingTask(null) }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        busy={deleting}
        title="Eliminare il task?"
        description={`Il task «${deleteTarget?.title ?? ''}» verrà spostato nel cestino.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { void handleDeleteTask() }}
      />

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={() => setContextMenu(null)}
        items={contextMenuItems}
      />

      <ConvertToIssueDialog
        open={Boolean(convertTarget)}
        task={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConverted={(result) => {
          toast.success(`Task trasformato in issue #${result.issue.id}.`)
          setOpenTask((current) => (current?.id === result.task.id ? result.task : current))
          setConvertTarget(null)
          reload()
        }}
      />
    </Stack>
  )
}
