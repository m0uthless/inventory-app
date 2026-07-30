import * as React from 'react'
import {
  Box, Card, Chip, Divider, IconButton, InputBase, MenuItem, Select,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'da_fare' | 'in_corso' | 'completato'

type AreaAoption = { id: number; label: string }

type AreaTask = {
  id: number
  area: number
  area_label: string
  title: string
  description: string
  status: Status
  due_date: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
  completed_at: string | null
  can_edit: boolean
}

const STATUS_ORDER: Status[] = ['da_fare', 'in_corso', 'completato']
const STATUS_LABEL: Record<Status, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  completato: 'Completato',
}
// Ciclo di avanzamento: click sull'icona di stato → passa allo stato successivo.
const NEXT_STATUS: Record<Status, Status> = {
  da_fare: 'in_corso',
  in_corso: 'completato',
  completato: 'da_fare',
}

function StatusIcon({ status, sx }: { status: Status; sx?: object }) {
  if (status === 'completato') return <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main', ...sx }} />
  if (status === 'in_corso') return <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18, color: 'warning.main', ...sx }} />
  return <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: 'text.disabled', ...sx }} />
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

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function AreaTaskCard() {
  const { me } = useAuth()
  const toast = useToast()

  const myAreaId = me?.profile?.leave_area ?? null
  const myAreaLabel = me?.profile?.leave_area_label ?? null

  const [areas, setAreas] = React.useState<AreaAoption[]>([])
  const [selectedArea, setSelectedArea] = React.useState<number | null>(null)
  const [tasks, setTasks] = React.useState<AreaTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [input, setInput] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Aree per il selettore (sola lettura sulle aree diverse dalla propria).
  React.useEffect(() => {
    api.get<{ results: AreaAoption[] } | AreaAoption[]>('/leave-areas/', { params: { page_size: 100 } })
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data.results
        setAreas(list)
      })
      .catch(() => {})
  }, [])

  // Default: la propria area appena nota da /me/.
  React.useEffect(() => {
    if (myAreaId && selectedArea === null) setSelectedArea(myAreaId)
  }, [myAreaId, selectedArea])

  const load = React.useCallback((areaId: number | null) => {
    if (!areaId) { setTasks([]); setLoading(false); return }
    setLoading(true)
    api.get<{ results: AreaTask[] } | AreaTask[]>('/area-tasks/', { params: { area: areaId, page_size: 100 } })
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data.results
        setTasks(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load(selectedArea) }, [selectedArea, load])

  const isOwnArea = selectedArea !== null && selectedArea === myAreaId
  const readOnly = !isOwnArea

  const addTask = async () => {
    const title = input.trim()
    if (!title || saving || readOnly) return
    setSaving(true)
    try {
      const r = await api.post<AreaTask>('/area-tasks/', {
        title,
        due_date: dueDate || null,
      })
      setTasks(prev => [r.data, ...prev])
      setInput('')
      setDueDate('')
      inputRef.current?.focus()
      window.dispatchEvent(new Event('area-task-changed'))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (task: AreaTask) => {
    if (readOnly || !task.can_edit) return
    const nextStatus = NEXT_STATUS[task.status]
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      await api.patch(`/area-tasks/${task.id}/`, { status: nextStatus })
      window.dispatchEvent(new Event('area-task-changed'))
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      toast.error(apiErrorToMessage(e))
    }
  }

  const deleteTask = async (id: number) => {
    if (readOnly) return
    setTasks(prev => prev.filter(t => t.id !== id))
    try { await api.delete(`/area-tasks/${id}/`); window.dispatchEvent(new Event('area-task-changed')) }
    catch (e) { toast.error(apiErrorToMessage(e)); load(selectedArea) }
  }

  const grouped = STATUS_ORDER.map(status => ({
    status,
    items: tasks.filter(t => t.status === status),
  }))

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <GroupsRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700} noWrap>Task di area</Typography>
        </Stack>
        <Select
          size="small"
          value={selectedArea ?? ''}
          onChange={e => setSelectedArea(e.target.value ? Number(e.target.value) : null)}
          displayEmpty
          sx={{ fontSize: '0.78rem', minWidth: 140, '& .MuiSelect-select': { py: 0.5 } }}
        >
          {areas.map(a => (
            <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.82rem' }}>
              {a.label}{a.id === myAreaId ? ' (mia)' : ''}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {readOnly && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.disabled">
            Sola lettura — non fai parte di quest'area
          </Typography>
        </Box>
      )}

      {!myAreaId && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'warning.light', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>
            Nessuna area assegnata al tuo profilo: contatta un amministratore per poter creare task.
          </Typography>
        </Box>
      )}

      {/* Input aggiunta */}
      {!readOnly && (
        <Box sx={{
          px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 0.75,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'action.hover',
        }}>
          <InputBase
            inputRef={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTask() }}
            placeholder={`Aggiungi un task per ${myAreaLabel ?? 'la tua area'}...`}
            sx={{ flex: 1, fontSize: '0.82rem', color: 'text.primary' }}
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            type="date"
            size="small"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150, '& input': { fontSize: '0.78rem', py: 0.5 } }}
          />
          <IconButton
            size="small"
            onClick={addTask}
            disabled={!input.trim() || saving}
            sx={{ color: 'primary.main' }}
          >
            <AddRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      {/* Lista task */}
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
                        {STATUS_LABEL[status]}
                      </Typography>
                    </Box>
                  )}
                  {items.map((task, i) => (
                    <Box key={task.id}>
                      <TaskRow task={task} readOnly={readOnly} onCycle={cycleStatus} onDelete={deleteTask} />
                      {i < items.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )
            ))}
          </Stack>
        )}
      </Box>
    </Card>
  )
}

// ─── Singola riga task ────────────────────────────────────────────────────────
function TaskRow({
  task,
  readOnly,
  onCycle,
  onDelete,
}: {
  task: AreaTask
  readOnly: boolean
  onCycle: (t: AreaTask) => void
  onDelete: (id: number) => void
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        px: 2, py: 1,
        '&:hover .task-delete': { opacity: readOnly ? 0 : 1 },
        transition: 'background 0.12s',
        '&:hover': { bgcolor: readOnly ? 'transparent' : 'action.hover' },
      }}
    >
      <Tooltip title={readOnly ? '' : `Segna come "${STATUS_LABEL[NEXT_STATUS[task.status]]}"`}>
        <Box
          onClick={() => onCycle(task)}
          sx={{ cursor: readOnly ? 'default' : 'pointer', display: 'flex', flexShrink: 0 }}
        >
          <StatusIcon status={task.status} />
        </Box>
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: 0 }}>
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
        {task.created_by_name && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
            {task.created_by_name}
          </Typography>
        )}
      </Box>

      {dueChip(task.due_date)}

      {!readOnly && (
        <IconButton
          size="small"
          className="task-delete"
          onClick={() => onDelete(task.id)}
          sx={{ opacity: 0, transition: 'opacity 0.12s', color: 'text.disabled', '&:hover': { color: 'error.main' } }}
        >
          <DeleteRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      )}
    </Stack>
  )
}
