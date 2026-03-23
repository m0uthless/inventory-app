import * as React from 'react'
import { Box, Card, Divider, IconButton, InputBase, Stack, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import { api } from '../api/client'

type Task = {
  id: number
  text: string
  done: boolean
  created_at: string
}

export default function TodoCard() {
  const [tasks,   setTasks]   = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)
  const [input,   setInput]   = React.useState('')
  const [saving,  setSaving]  = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(() => {
    api.get<{ results: Task[] }>('/user-tasks/', { params: { page_size: 50 } })
      .then(r => setTasks(r.data.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const addTask = async () => {
    const text = input.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      const r = await api.post<Task>('/user-tasks/', { text })
      setTasks(prev => [r.data, ...prev])
      setInput('')
      inputRef.current?.focus()
    } catch {} finally { setSaving(false) }
  }

  const toggleDone = async (task: Task) => {
    // Ottimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
    try {
      await api.patch(`/user-tasks/${task.id}/`, { done: !task.done })
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: task.done } : t))
    }
  }

  const deleteTask = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    try { await api.delete(`/user-tasks/${id}/`) }
    catch { load() }
  }

  const todo = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ChecklistRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>I miei task</Typography>
        </Stack>
        {tasks.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {done.length} / {tasks.length}
          </Typography>
        )}
      </Box>

      {/* Input aggiunta */}
      <Box sx={{
        px: 2, py: 1,
        display: 'flex', alignItems: 'center', gap: 0.5,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'action.hover',
      }}>
        <InputBase
          inputRef={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTask() }}
          placeholder="Aggiungi un task..."
          sx={{ flex: 1, fontSize: '0.82rem', color: 'text.primary' }}
          inputProps={{ maxLength: 200 }}
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

      {/* Lista task */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">Caricamento...</Typography>
          </Box>
        ) : tasks.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <ChecklistRoundedIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="caption" color="text.disabled" display="block">
              Nessun task — aggiungine uno!
            </Typography>
          </Box>
        ) : (
          <Stack>
            {/* Da fare */}
            {todo.map((task, i) => (
              <Box key={task.id}>
                <TaskRow task={task} onToggle={toggleDone} onDelete={deleteTask} />
                {i < todo.length - 1 && <Divider />}
              </Box>
            ))}

            {/* Separatore completati */}
            {done.length > 0 && todo.length > 0 && (
              <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Completati
                </Typography>
              </Box>
            )}

            {/* Completati */}
            {done.map((task, i) => (
              <Box key={task.id}>
                <TaskRow task={task} onToggle={toggleDone} onDelete={deleteTask} />
                {i < done.length - 1 && <Divider />}
              </Box>
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
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (t: Task) => void
  onDelete: (id: number) => void
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        px: 2, py: 1,
        '&:hover .task-delete': { opacity: 1 },
        transition: 'background 0.12s',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Checkbox circolare */}
      <Box
        onClick={() => onToggle(task)}
        sx={{
          width: 18, height: 18,
          borderRadius: '50%',
          border: task.done ? 'none' : '1.5px solid',
          borderColor: 'divider',
          bgcolor: task.done ? 'success.main' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 0.15s',
          '&:hover': { borderColor: task.done ? 'success.main' : 'primary.main' },
        }}
      >
        {task.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </Box>

      {/* Testo */}
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontSize: '0.82rem',
          color: task.done ? 'text.disabled' : 'text.primary',
          textDecoration: task.done ? 'line-through' : 'none',
          lineHeight: 1.4,
          transition: 'all 0.15s',
        }}
      >
        {task.text}
      </Typography>

      {/* Delete — visibile solo al hover */}
      <Tooltip title="Elimina">
        <IconButton
          className="task-delete"
          size="small"
          onClick={() => onDelete(task.id)}
          sx={{
            opacity: 0, transition: 'opacity 0.15s',
            color: 'text.disabled',
            width: 22, height: 22,
            '&:hover': { color: 'error.main' },
          }}
        >
          <DeleteRoundedIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
