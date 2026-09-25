import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Avatar, Box, Button, Card, Chip, Divider, IconButton, InputBase, MenuItem, Select,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
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
import {
  PRIORITY_META, STATUS_META, STATUS_ORDER, personInitials,
  type AreaTaskRow, type TaskStatus,
} from '../features/areatasks/types'

type AreaOption = { id: number; label: string }

// Ciclo rapido dall'icona di stato: "In attesa" si imposta dal dialog di modifica.
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  da_fare: 'in_corso',
  in_corso: 'completato',
  in_attesa: 'in_corso',
  completato: 'da_fare',
}

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

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{
        px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <GroupsRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700} noWrap>Task di area</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button component={RouterLink} to="/tasks" size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Vedi tutti
          </Button>
          <Select
            size="small"
            value={selectedArea ?? ''}
            onChange={(e) => setSelectedArea(e.target.value ? Number(e.target.value) : null)}
            displayEmpty
            sx={{ fontSize: '0.78rem', minWidth: 140, '& .MuiSelect-select': { py: 0.5 } }}
          >
            {areas.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.82rem' }}>
                {a.label}{a.id === myAreaId ? ' (mia)' : ''}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Box>

      {readOnly && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.disabled">Sola lettura — non fai parte di quest'area</Typography>
        </Box>
      )}

      {!myAreaId && !isSuperuser && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'warning.light', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>
            Nessuna area assegnata al tuo profilo: contatta un amministratore per poter creare task.
          </Typography>
        </Box>
      )}

      {!readOnly && (
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.75,
          borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
        }}>
          <InputBase
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addTask() }}
            placeholder={`Aggiungi un task per ${isOwnArea ? (myAreaLabel ?? 'la tua area') : (areas.find((a) => a.id === selectedArea)?.label ?? 'quest\'area')}...`}
            sx={{ flex: 1, fontSize: '0.82rem', color: 'text.primary' }}
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            type="date" size="small" value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150, '& input': { fontSize: '0.78rem', py: 0.5 } }}
          />
          <IconButton size="small" onClick={() => void addTask()} disabled={!input.trim() || saving} sx={{ color: 'primary.main' }}>
            <AddRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">Caricamento...</Typography>
          </Box>
        ) : tasks.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <GroupsRoundedIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="caption" color="text.disabled" display="block">
              {selectedArea ? 'Nessun task per quest\'area' : 'Seleziona un\'area'}
            </Typography>
          </Box>
        ) : (
          <Stack>
            {grouped.map(({ status, items }, gi) => (
              items.length === 0 ? null : (
                <Box key={status}>
                  {gi > 0 && (
                    <Box sx={{ px: 2, py: 0.5, bgcolor: 'action.hover', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {STATUS_META[status].label}
                      </Typography>
                    </Box>
                  )}
                  {items.map((task, i) => (
                    <Box key={task.id}>
                      <TaskRow
                        task={task}
                        readOnly={readOnly}
                        onCycle={cycleStatus}
                        onDelete={deleteTask}
                        onOpen={(t) => setOpenId(t.id)}
                      />
                      {i < items.length - 1 && <Divider />}
                    </Box>
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
    </Card>
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
      spacing={1.25}
      sx={{
        px: 2, py: 1,
        '&:hover .task-actions': { opacity: canAct ? 1 : 0 },
        '&:focus-within .task-actions': { opacity: canAct ? 1 : 0 },
        transition: 'background 0.12s',
        '&:hover': { bgcolor: 'action.hover' },
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
            fontWeight: 600, fontSize: '0.82rem',
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
          <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'primary.main' }}>
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
