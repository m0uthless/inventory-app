import * as React from 'react'
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material'
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER,
  type AreaTaskRow, type AreaUser, type TaskFormData, type TaskPriority, type TaskStatus,
} from './types'

export type AreaTaskDialogProps = {
  open: boolean
  task: AreaTaskRow | null
  areaLabel: string
  form: TaskFormData
  users: AreaUser[]
  saving: boolean
  errors: Record<string, string>
  onFormChange: React.Dispatch<React.SetStateAction<TaskFormData>>
  onSave: () => void
  onClose: () => void
}

export default function AreaTaskDialog({
  open, task, areaLabel, form, users, saving, errors, onFormChange, onSave, onClose,
}: AreaTaskDialogProps) {
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {task ? `Modifica task #${task.id}` : 'Nuovo task'}
        <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
          · {areaLabel}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Titolo *" size="small" fullWidth
            value={form.title}
            onChange={(e) => onFormChange((f) => ({ ...f, title: e.target.value }))}
            error={Boolean(errors.title)} helperText={errors.title}
            inputProps={{ maxLength: 200 }}
          />

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Stato</InputLabel>
              <Select
                value={form.status} label="Stato"
                onChange={(e) => onFormChange((f) => ({ ...f, status: e.target.value as TaskStatus }))}
              >
                {STATUS_ORDER.map((s) => (
                  <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Priorità</InputLabel>
              <Select
                value={form.priority} label="Priorità"
                onChange={(e) => onFormChange((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              >
                {PRIORITY_ORDER.map((p) => (
                  <MenuItem key={p} value={p}>{PRIORITY_META[p].label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth error={Boolean(errors.assigned_to)}>
              <InputLabel>Assegnato a</InputLabel>
              <Select
                value={form.assigned_to_id} label="Assegnato a"
                onChange={(e) => onFormChange((f) => ({ ...f, assigned_to_id: e.target.value as number | '' }))}
              >
                <MenuItem value=""><em>Nessuno</em></MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.label}</MenuItem>
                ))}
              </Select>
              {errors.assigned_to ? (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.assigned_to}</Typography>
              ) : null}
            </FormControl>
            <TextField
              label="Scadenza" size="small" fullWidth type="date"
              value={form.due_date}
              onChange={(e) => onFormChange((f) => ({ ...f, due_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.due_date)} helperText={errors.due_date}
            />
          </Stack>

          <TextField
            label="Descrizione" size="small" fullWidth multiline rows={3}
            value={form.description}
            onChange={(e) => onFormChange((f) => ({ ...f, description: e.target.value }))}
          />

          {errors.non_field_errors || errors.detail ? (
            <Alert severity="error">{errors.non_field_errors || errors.detail}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !form.title.trim()} sx={{ minWidth: 140 }}>
          {saving ? <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} /> : null}
          {task ? 'Salva modifiche' : 'Crea task'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
