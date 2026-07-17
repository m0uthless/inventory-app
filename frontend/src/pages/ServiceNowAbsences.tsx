import * as React from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CloseIcon from '@mui/icons-material/Close'

import { useAuth } from '../auth/AuthProvider'
import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { PERMS } from '../auth/perms'
import {
  type AbsenceRow, type AbsenceTechnician, type AbsenceReason,
  ABSENCE_REASONS, ABSENCE_REASON_COLORS, ABSENCE_HOURLY_COLOR,
  formatItTime, startOfWeek, addDays, toISODate, absenceCoversDate,
  validateAbsencePayload,
} from '../features/servicenow/absenceShared'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven']

const CATEGORY_SECTIONS = [
  { value: 'philips' as const, label: 'Philips', accent: '#0f766e', tint: 'rgba(15,118,110,0.06)' },
  { value: 'biotron' as const, label: 'Biotron', accent: '#0ea5e9', tint: 'rgba(14,165,233,0.06)' },
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Dialog aggiunta/modifica assenza ────────────────────────────────────────

type EditorTarget = {
  technician: AbsenceTechnician
  date: string          // giorno cliccato (ISO)
  existing: AbsenceRow | null
}

function AbsenceEditorDialog({ target, onClose, onSaved }: {
  target: EditorTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [mode, setMode] = React.useState<'full' | 'hourly'>('full')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [timeFrom, setTimeFrom] = React.useState('09:00')
  const [timeTo, setTimeTo] = React.useState('11:00')
  const [reason, setReason] = React.useState<AbsenceReason>('ferie')
  const [note, setNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (!target) return
    const e = target.existing
    if (e) {
      setMode(e.is_hourly ? 'hourly' : 'full')
      setDateFrom(e.date_from); setDateTo(e.date_to)
      setTimeFrom(formatItTime(e.time_from) || '09:00')
      setTimeTo(formatItTime(e.time_to) || '11:00')
      setReason(e.reason); setNote(e.note)
    } else {
      setMode('full')
      setDateFrom(target.date); setDateTo(target.date)
      setTimeFrom('09:00'); setTimeTo('11:00')
      setReason('ferie'); setNote('')
    }
  }, [target])

  if (!target) return null
  const { technician, existing } = target

  const handleModeChange = (_: unknown, next: 'full' | 'hourly' | null) => {
    if (!next) return
    setMode(next)
    if (next === 'hourly') setDateTo(dateFrom)
  }

  const handleSave = async () => {
    const payload = {
      user: technician.id,
      date_from: dateFrom,
      date_to: mode === 'hourly' ? dateFrom : dateTo,
      reason,
      note,
      time_from: mode === 'hourly' ? timeFrom : null,
      time_to: mode === 'hourly' ? timeTo : null,
    }
    const err = validateAbsencePayload({
      dateFrom: payload.date_from, dateTo: payload.date_to,
      timeFrom: payload.time_from, timeTo: payload.time_to,
    })
    if (err) { toast.error(err); return }

    setSaving(true)
    try {
      if (existing) {
        await api.patch(`/technician-absences/${existing.id}/`, payload)
        toast.success('Assenza aggiornata ✅')
      } else {
        await api.post('/technician-absences/', payload)
        toast.success('Assenza registrata ✅')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    setDeleting(true)
    try {
      await api.delete(`/technician-absences/${existing.id}/`)
      toast.success('Assenza rimossa ✅')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        {existing ? 'Modifica assenza' : 'Nuova assenza'} — {technician.name}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup
            value={mode} exclusive size="small" onChange={handleModeChange} fullWidth
          >
            <ToggleButton value="full">Giornata intera</ToggleButton>
            <ToggleButton value="hourly">Permesso orario</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Dal" type="date" size="small" fullWidth
              value={dateFrom} onChange={(e) => {
                setDateFrom(e.target.value)
                if (mode === 'hourly') setDateTo(e.target.value)
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Al" type="date" size="small" fullWidth
              value={mode === 'hourly' ? dateFrom : dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={mode === 'hourly'}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {mode === 'hourly' && (
            <Stack direction="row" spacing={1}>
              <TextField
                label="Ora inizio" type="time" size="small" fullWidth
                value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Ora fine" type="time" size="small" fullWidth
                value={timeTo} onChange={(e) => setTimeTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}

          <TextField
            select label="Motivo" size="small" value={reason}
            onChange={(e) => setReason(e.target.value as AbsenceReason)}
            InputLabelProps={{ shrink: true }}
          >
            {ABSENCE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Nota (opzionale)" size="small" value={note}
            onChange={(e) => setNote(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: existing ? 'space-between' : 'flex-end' }}>
        {existing && (
          <Button color="error" startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon />}
            disabled={deleting} onClick={handleDelete}>
            Elimina
          </Button>
        )}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={16} color="inherit" /> : 'Salva'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

// ─── Cella calendario ─────────────────────────────────────────────────────────

function AbsenceCell({ dayISO, absences, canManage, onAdd, onEdit }: {
  dayISO: string
  absences: AbsenceRow[]
  canManage: boolean
  onAdd: () => void
  onEdit: (a: AbsenceRow) => void
}) {
  const dayAbsences = absences.filter((a) => absenceCoversDate(a, dayISO))

  if (dayAbsences.length === 0) {
    return (
      <Box
        onClick={canManage ? onAdd : undefined}
        sx={{
          minHeight: 30, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: canManage ? 'pointer' : 'default',
          border: canManage ? '1px dashed transparent' : 'none',
          color: 'text.disabled',
          '&:hover': canManage ? { border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' } : undefined,
        }}
      >
        {canManage && <AddIcon sx={{ fontSize: 15, opacity: 0.35 }} />}
      </Box>
    )
  }

  return (
    <Stack spacing={0.4}>
      {dayAbsences.map((a) => {
        const colors = a.is_hourly ? ABSENCE_HOURLY_COLOR : ABSENCE_REASON_COLORS[a.reason]
        const label = a.is_hourly ? `${formatItTime(a.time_from)}-${formatItTime(a.time_to)}` : a.reason_label
        return (
          <Box
            key={a.id}
            onClick={canManage ? () => onEdit(a) : undefined}
            title={a.note || label}
            sx={{
              fontSize: '0.68rem', fontWeight: 600, textAlign: 'center', borderRadius: 1,
              px: 0.5, py: 0.3, bgcolor: colors.bg, color: colors.fg,
              cursor: canManage ? 'pointer' : 'default',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Box>
        )
      })}
    </Stack>
  )
}

// ─── Sezione categoria (Philips / Biotron) ───────────────────────────────────

function CategorySection({ label, accent, tint, technicians, absences, weekDays, canManage, onCell }: {
  label: string; accent: string; tint: string
  technicians: AbsenceTechnician[]
  absences: AbsenceRow[]
  weekDays: Date[]
  canManage: boolean
  onCell: (tech: AbsenceTechnician, dayISO: string, existing: AbsenceRow | null) => void
}) {
  if (technicians.length === 0) return null
  return (
    <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: '0.5px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.25, py: 1, bgcolor: tint, borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Box sx={{ width: 5, height: 22, borderRadius: 4, bgcolor: accent, flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>({technicians.length} tecnici)</Typography>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: `160px repeat(${weekDays.length}, minmax(0, 1fr))`, gap: '1px', bgcolor: 'divider' }}>
        <Box sx={{ bgcolor: 'background.paper', p: 0.75 }} />
        {weekDays.map((d) => (
          <Box key={d.toISOString()} sx={{ bgcolor: 'background.paper', p: 0.75, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
              {WEEKDAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
            </Typography>
          </Box>
        ))}

        {technicians.map((t) => {
          const techAbsences = absences.filter((a) => a.user === t.id)
          return (
            <React.Fragment key={t.id}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'background.paper', p: 0.75, minWidth: 0 }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, bgcolor: `${accent}26`, color: accent,
                }}>
                  {initialsOf(t.name)}
                </Box>
                <Typography sx={{ fontSize: '0.78rem' }} noWrap>{t.name}</Typography>
              </Stack>
              {weekDays.map((d) => {
                const dayISO = toISODate(d)
                return (
                  <Box key={dayISO} sx={{ bgcolor: 'background.paper', p: 0.5, display: 'flex', alignItems: 'center' }}>
                    <AbsenceCell
                      dayISO={dayISO}
                      absences={techAbsences}
                      canManage={canManage}
                      onAdd={() => onCell(t, dayISO, null)}
                      onEdit={(a) => onCell(t, dayISO, a)}
                    />
                  </Box>
                )
              })}
            </React.Fragment>
          )
        })}
      </Box>
    </Box>
  )
}

// ─── Pagina ─────────────────────────────────────────────────────────────────

export default function ServiceNowAbsences() {
  const toast = useToast()
  const { hasPerm } = useAuth()
  const canManage = hasPerm(PERMS.servicenow.case.change)

  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()))
  const [technicians, setTechnicians] = React.useState<AbsenceTechnician[]>([])
  const [absences, setAbsences] = React.useState<AbsenceRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editorTarget, setEditorTarget] = React.useState<EditorTarget | null>(null)

  const weekDays = React.useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = weekDays[weekDays.length - 1]

  React.useEffect(() => {
    api.get<AbsenceTechnician[]>('/technician-absences/technicians/')
      .then((r) => setTechnicians(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reload = React.useCallback(() => {
    setLoading(true)
    api.get<AbsenceRow[]>('/technician-absences/', {
      params: { date_from: toISODate(weekStart), date_to: toISODate(weekEnd) },
    })
      .then((r) => setAbsences(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  React.useEffect(() => { reload() }, [reload])

  const weekLabel = `${weekDays[0].toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} – ${weekEnd.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}`

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" rowGap={1}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Assenze tecnici</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton size="small" onClick={() => setWeekStart((w) => addDays(w, -7))}><ChevronLeftIcon /></IconButton>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 170, textAlign: 'center' }}>{weekLabel}</Typography>
          <IconButton size="small" onClick={() => setWeekStart((w) => addDays(w, 7))}><ChevronRightIcon /></IconButton>
          <IconButton size="small" onClick={() => setWeekStart(startOfWeek(new Date()))} title="Settimana corrente">
            <TodayIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {loading && technicians.length === 0 ? (
        <Stack alignItems="center" py={6}><CircularProgress size={22} /></Stack>
      ) : (
        <Stack spacing={2}>
          {CATEGORY_SECTIONS.map((c) => (
            <CategorySection
              key={c.value}
              label={c.label} accent={c.accent} tint={c.tint}
              technicians={technicians.filter((t) => t.category === c.value)}
              absences={absences}
              weekDays={weekDays}
              canManage={canManage}
              onCell={(tech, dayISO, existing) => setEditorTarget({ technician: tech, date: dayISO, existing })}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap' }}>
        {ABSENCE_REASONS.map((r) => (
          <Stack key={r.value} direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: ABSENCE_REASON_COLORS[r.value].bg }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.label}</Typography>
          </Stack>
        ))}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: ABSENCE_HOURLY_COLOR.bg }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Permesso orario</Typography>
        </Stack>
      </Stack>

      <AbsenceEditorDialog
        target={editorTarget}
        onClose={() => setEditorTarget(null)}
        onSaved={reload}
      />
    </Box>
  )
}
