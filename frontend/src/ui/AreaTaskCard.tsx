import * as React from 'react'
import {
  Avatar, Box, Chip, IconButton, InputBase, MenuItem, Select,
  Stack, Tooltip, Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import AreaTaskDetail from '../features/areatasks/AreaTaskDetail'
import WidgetShell, { CountPill, WidgetNote } from '../features/dashboard/widgets/WidgetShell'
import { tintVeil } from '../features/dashboard/widgets/tints'
import {
  NEXT_STATUS, PRIORITY_META, STATUS_META, STATUS_ORDER, personInitials,
  type AreaTaskRow, type TaskStatus,
} from '../features/areatasks/types'

type AreaOption = { id: number; label: string }

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'completato') return <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
  if (status === 'in_corso') return <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
  if (status === 'in_attesa') return <PauseCircleOutlineRoundedIcon sx={{ fontSize: 18, color: 'info.main' }} />
  return <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
}

function dueChip(due_date: string | null) {
  if (!due_date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(due_date + 'T00:00:00')
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  const label =
    days < 0 ? `${Math.abs(days)}gg fa`
    : days === 0 ? 'Oggi'
    : days === 1 ? 'Domani'
    : due.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const color = days < 0 ? 'error' : days <= 1 ? 'warning' : 'default'
  return (
    <Chip
      size="small"
      label={label}
      color={color as 'error' | 'warning' | 'default'}
      variant={days <= 1 ? 'filled' : 'outlined'}
      sx={{ fontSize: '0.68rem', height: 20 }}
    />
  )
}

export default function AreaTaskCard() {
  const { me } = useAuth()
  const toast = useToast()

  const myAreaId = me?.profile?.leave_area ?? null
  const myAreaLabel = me?.profile?.leave_area_label ?? null

  const [areas, setAreas] = React.useState<AreaOption[]>([])
  const [selectedArea, setSelectedArea] = React.useState<number | null>(null)
  const [tasks, setTasks] = React.useState<AreaTaskRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [input, setInput] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [openId, setOpenId] = React.useState<number | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    api.get<{ results: AreaOption[] } | AreaOption[]>('/leave-areas/', { params: { page_size: 100 } })
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : r.data.results))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (myAreaId && selectedArea === null) setSelectedArea(myAreaId)
  }, [myAreaId, selectedArea])

  const load = React.useCallback((areaId: number | null) => {
    if (!areaId) { setTasks([]); setLoading(false); return }
    setLoading(true)
    api.get<{ results: AreaTaskRow[] } | AreaTaskRow[]>('/area-tasks/', { params: { area: areaId, page_size: 100 } })
      .then((r) => setTasks(Array.isArray(r.data) ? r.data : r.data.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load(selectedArea) }, [selectedArea, load])

  const notify = () => window.dispatchEvent(new Event('area-task-changed'))

  const isOwnArea = selectedArea !== null && selectedArea === myAreaId
  const isSuperuser = Boolean(me?.is_superuser)
  const readOnly = !isOwnArea && !isSuperuser

  const addTask = async () => {
    const title = input.trim()
    if (!title || saving || readOnly) return
    setSaving(true)
    try {
      const r = await api.post<AreaTaskRow>('/area-tasks/', {
        title,
        due_date: dueDate || null,
        // Rilevante solo per i superuser (possono creare in un'area diversa
        // dalla propria): per gli utenti normali il backend forza la propria area.
        area: selectedArea ?? undefined,
      })
      setTasks((prev) => [r.data, ...prev])
      setInput('')
      setDueDate('')
      inputRef.current?.focus()
      notify()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (task: AreaTaskRow) => {
    if (readOnly || !task.can_edit) return
    const nextStatus = NEXT_STATUS[task.status]
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${task.id}/`, { status: nextStatus })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? r.data : t)))
      notify()
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
      toast.error(apiErrorToMessage(e))
    }
  }

  const deleteTask = async (id: number) => {
    if (readOnly) return
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try { await api.delete(`/area-tasks/${id}/`); notify() }
    catch (e) { toast.error(apiErrorToMessage(e)); load(selectedArea) }
  }

  const grouped = STATUS_ORDER.map((status) => ({ status, items: tasks.filter((t) => t.status === status) }))
  const openTask = tasks.find((t) => t.id === openId) ?? null

  const openCount = tasks.filter((t) => t.status !== 'completato').length
  return (
    <WidgetShell
      tone="salvia"
      look="tint"
      icon={AssignmentTurnedInRoundedIcon}
      title="Task di area"
      extra={selectedArea && !loading ? <CountPill tone="salvia">{openCount} aperti</CountPill> : null}
      link={{ label: 'Vedi tutti', to: '/tasks' }}
      actions={areas.length > 1 || isSuperuser ? (
        <Select
          size="small"
          value={selectedArea ?? ''}
          onChange={(e) => setSelectedArea(e.target.value ? Number(e.target.value) : null)}
          displayEmpty
          inputProps={{ 'aria-label': 'Area' }}
          sx={{ fontSize: 12, height: 26, maxWidth: 140, borderRadius: '7px', bgcolor: 'background.paper', '& fieldset': { border: 0 }, '& .MuiSelect-select': { py: 0.25, pl: 1 } }}
        >
          {areas.map((a) => (
            <MenuItem key={a.id} value={a.id} sx={{ fontSize: 12.5 }}>
              {a.label}{a.id === myAreaId ? ' (mia)' : ''}
            </MenuItem>
          ))}
        </Select>
      ) : null}
      bodySx={{ px: 2, pb: 1.5, gap: 1 }}
    >
      {readOnly && (
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Sola lettura: non fai parte di quest'area</Typography>
      )}
      {!myAreaId && !isSuperuser && (
        <Typography sx={{ fontSize: 11.5, color: 'warning.main' }}>
          Nessuna area assegnata al tuo profilo: contatta un amministratore per poter creare task.
        </Typography>
      )}
      {!readOnly && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 32, pl: 1.25, pr: 0.5, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'transparent', '&:focus-within': { borderColor: 'primary.main' } }}>
          <InputBase
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addTask() }}
            placeholder={`Aggiungi un task per ${isOwnArea ? (myAreaLabel ?? 'la tua area') : (areas.find((a) => a.id === selectedArea)?.label ?? 'quest\'area')}...`}
            sx={{ flex: 1, fontSize: 13, color: 'text.primary' }}
            inputProps={{ maxLength: 200 }}
          />
          <InputBase
            type="date" value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            inputProps={{ 'aria-label': 'Scadenza' }}
            sx={{ width: 122, fontSize: 12, color: dueDate ? 'text.primary' : 'text.secondary' }}
          />
          <IconButton size="small" aria-label="Aggiungi il task" onClick={() => void addTask()} disabled={!input.trim() || saving} sx={{ width: 26, height: 26, color: (t) => t.palette.archie.dash.salvia.ink }}>
            <AddRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mx: -1 }}>
        {loading ? (
          <WidgetNote>Caricamento…</WidgetNote>
        ) : tasks.length === 0 ? (
          <WidgetNote>{selectedArea ? 'Nessun task per quest\'area' : 'Seleziona un\'area'}</WidgetNote>
        ) : (
          <Stack spacing={0.25}>
            {grouped.map(({ status, items }, gi) => (
              items.length === 0 ? null : (
                <Box key={status}>
                  {gi > 0 && (
                    <Typography sx={{ px: 1, pt: 1, pb: 0.25, fontSize: 11.5, fontWeight: 650, color: 'text.secondary' }}>
                      {STATUS_META[status].label}
                    </Typography>
                  )}
                  {items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      readOnly={readOnly}
                      onCycle={cycleStatus}
                      onDelete={deleteTask}
                      onOpen={(t) => setOpenId(t.id)}
                    />
                  ))}
                </Box>
              )
            ))}
          </Stack>
        )}
      </Box>
      <AreaTaskDetail
        task={openTask}
        onClose={() => setOpenId(null)}
        onChanged={(next) => { setTasks((prev) => prev.map((t) => (t.id === next.id ? next : t))); notify() }}
        onDeleted={(id) => { setTasks((prev) => prev.filter((t) => t.id !== id)); notify() }}
      />
    </WidgetShell>
  )
}

function TaskRow({
  task, readOnly, onCycle, onDelete, onOpen,
}: {
  task: AreaTaskRow
  readOnly: boolean
  onCycle: (t: AreaTaskRow) => void
  onDelete: (id: number) => void
  onOpen: (t: AreaTaskRow) => void
}) {
  const canAct = !readOnly && task.can_edit
  const showPriority = task.priority === 'high' || task.priority === 'critical'
  const filesCount = task.drive_files_detail.length
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.1}
      sx={{
        px: 1, py: 0.6, borderRadius: '8px',
        '&:hover .task-actions': { opacity: canAct ? 1 : 0 },
        '&:focus-within .task-actions': { opacity: canAct ? 1 : 0 },
        transition: 'background 0.12s',
        '&:hover': { bgcolor: (t) => tintVeil(t, 'salvia', 30) },
      }}
    >
      <Tooltip title={canAct ? `Segna come "${STATUS_META[NEXT_STATUS[task.status]].label}"` : ''}>
        <Box
          {...(canAct ? { role: 'button', 'aria-label': 'Cambia stato' } : {})}
          tabIndex={canAct ? 0 : -1}
          onClick={() => onCycle(task)}
          onKeyDown={(e) => {
            if (!canAct) return
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCycle(task) }
          }}
          sx={{ cursor: canAct ? 'pointer' : 'default', display: 'flex', flexShrink: 0 }}
        >
          <StatusIcon status={task.status} />
        </Box>
      </Tooltip>

      <Box
        role="button"
        tabIndex={0}
        sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(task) }
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{
            fontWeight: 550, fontSize: 13,
            textDecoration: task.status === 'completato' ? 'line-through' : 'none',
            color: task.status === 'completato' ? 'text.disabled' : 'text.primary',
          }}
        >
          {task.title}
        </Typography>
        {task.description ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }} noWrap display="block">
            {task.description}
          </Typography>
        ) : null}
      </Box>

      {showPriority ? (
        <Chip
          size="small"
          label={PRIORITY_META[task.priority].label}
          color={task.priority === 'critical' ? 'error' : 'warning'}
          sx={{ fontSize: '0.66rem', height: 18 }}
        />
      ) : null}
      {task.comments_count > 0 ? (
        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled' }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{task.comments_count}</Typography>
        </Stack>
      ) : null}
      {filesCount > 0 ? (
        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: 'text.disabled' }}>
          <AttachFileIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{filesCount}</Typography>
        </Stack>
      ) : null}
      {task.assigned_to_name ? (
        <Tooltip title={task.assigned_to_name}>
          <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 700, color: (t) => t.palette.archie.dash.salvia.ink, bgcolor: (t) => tintVeil(t, 'salvia', 26) }}>
            {personInitials(task.assigned_to_name)}
          </Avatar>
        </Tooltip>
      ) : null}

      {dueChip(task.due_date)}

      {canAct && (
        <Stack direction="row" className="task-actions" sx={{ opacity: 0, transition: 'opacity 0.12s' }}>
          <IconButton
            size="small"
            aria-label="Elimina task"
            onClick={() => onDelete(task.id)}
            sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
          >
            <DeleteRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
      )}
    </Stack>
  )
}
