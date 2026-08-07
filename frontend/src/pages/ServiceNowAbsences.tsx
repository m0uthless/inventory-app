import * as React from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
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
import { theme } from '../theme'
import {
  type AbsenceRow, type AbsenceTechnician, type AbsenceReason, type DayPart,
  ABSENCE_REASONS, ABSENCE_REASON_COLORS, ABSENCE_HOURLY_COLOR, DAY_PART_OPTIONS,
  formatItTime, startOfWeek, addDays, toISODate, findAbsence,
  validateAbsencePayload,
} from '../features/servicenow/absenceShared'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven']

const CATEGORY_SECTIONS = [
  { value: 'philips' as const, label: 'Philips', accent: theme.palette.primary.main, tint: 'rgba(15,118,110,0.06)' },
  { value: 'biotron' as const, label: 'Biotron', accent: theme.palette.secondary.main, tint: 'rgba(14,165,233,0.06)' },
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Dialog aggiunta/modifica assenza (una riga = utente × giorno × fascia) ──

type EditorTarget = {
  technician: AbsenceTechnician
  date: string          // giorno cliccato (ISO)
  dayPart: DayPart      // fascia cliccata
  existing: AbsenceRow | null
}

function AbsenceEditorDialog({ target, absences, onClose, onSaved }: {
  target: EditorTarget | null
  absences: AbsenceRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [reason, setReason] = React.useState<AbsenceReason>('ferie')
  const [note, setNote] = React.useState('')
  const [hourly, setHourly] = React.useState(false)
  const [timeFrom, setTimeFrom] = React.useState('09:00')
  const [timeTo, setTimeTo] = React.useState('11:00')
  const [fullDay, setFullDay] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (!target) return
    const e = target.existing
    if (e) {
      setReason(e.reason); setNote(e.note)
      setHourly(e.is_hourly)
      setTimeFrom(formatItTime(e.time_from) || '09:00')
      setTimeTo(formatItTime(e.time_to) || '11:00')
      setFullDay(false)
    } else {
      setReason('ferie'); setNote('')
      setHourly(false)
      setTimeFrom('09:00'); setTimeTo('11:00')
      setFullDay(false)
    }
  }, [target])

  if (!target) return null
  const { technician, date, dayPart, existing } = target

  const otherPart: DayPart = dayPart === 'mattina' ? 'pomeriggio' : 'mattina'
  const otherPartLabel = DAY_PART_OPTIONS.find((d) => d.value === otherPart)!.label
  const otherPartOccupied = !existing && findAbsence(absences, technician.id, date, otherPart) !== null
  const dayPartLabel = DAY_PART_OPTIONS.find((d) => d.value === dayPart)!.label

  const handleSave = async () => {
    const err = validateAbsencePayload({
      timeFrom: hourly && !fullDay ? timeFrom : null,
      timeTo: hourly && !fullDay ? timeTo : null,
    })
    if (err) { toast.error(err); return }

    setSaving(true)
    try {
      if (existing) {
        await api.patch(`/servicenow-technician-absences/${existing.id}/`, {
          user: technician.id, date, reason, note,
          time_from: hourly ? timeFrom : null, time_to: hourly ? timeTo : null,
        })
      } else if (fullDay) {
        // Endpoint atomico dedicato: crea mattina+pomeriggio in un'unica
        // transazione, tutto o niente (niente scritture parziali/500 se una
        // delle due fasce è già occupata).
        await api.post('/servicenow-technician-absences/full-day/', { user: technician.id, date, reason, note })
      } else {
        await api.post('/servicenow-technician-absences/', {
          user: technician.id, date, day_part: dayPart, reason, note,
          time_from: hourly ? timeFrom : null, time_to: hourly ? timeTo : null,
        })
      }
      toast.success(existing ? 'Assenza aggiornata ✅' : 'Assenza registrata ✅')
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
      await api.delete(`/servicenow-technician-absences/${existing.id}/`)
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
          <TextField
            label="Giorno" value={`${date} — ${fullDay ? 'Giornata intera' : dayPartLabel}`}
            size="small" fullWidth disabled InputLabelProps={{ shrink: true }}
          />

          {!existing && (
            <Tooltip title={otherPartOccupied ? `${otherPartLabel} già occupata da un'altra voce` : ''}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small" checked={fullDay} disabled={otherPartOccupied}
                    onChange={(e) => { setFullDay(e.target.checked); if (e.target.checked) setHourly(false) }}
                  />
                }
                label={<Typography variant="body2">Giornata intera (mattina + pomeriggio)</Typography>}
              />
            </Tooltip>
          )}

          {!fullDay && (
            <FormControlLabel
              control={<Checkbox size="small" checked={hourly} onChange={(e) => setHourly(e.target.checked)} />}
              label={<Typography variant="body2">Permesso orario (entro la fascia)</Typography>}
            />
          )}

          {hourly && !fullDay && (
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

// ─── Cella calendario (una per ciascuna fascia MAT/POM) ──────────────────────

function DayPartPill({ dayPart, absence, canManage, onAdd, onEdit }: {
  dayPart: DayPart
  absence: AbsenceRow | null
  canManage: boolean
  onAdd: () => void
  onEdit: (a: AbsenceRow) => void
}) {
  const short = DAY_PART_OPTIONS.find((d) => d.value === dayPart)!.short

  if (!absence) {
    return (
      <Box
        onClick={canManage ? onAdd : undefined}
        sx={{
          minHeight: 20, borderRadius: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: canManage ? 'pointer' : 'default',
          border: canManage ? '1px dashed transparent' : 'none',
          color: 'text.disabled', gap: 0.3,
          '&:hover': canManage ? { border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' } : undefined,
        }}
      >
        <Typography variant="caption" sx={{ fontSize: '0.62rem', opacity: 0.4 }}>{short}</Typography>
        {canManage && <AddIcon sx={{ fontSize: 12, opacity: 0.35 }} />}
      </Box>
    )
  }

  const colors = absence.is_hourly ? ABSENCE_HOURLY_COLOR : ABSENCE_REASON_COLORS[absence.reason]
  const label = absence.is_hourly
    ? `${formatItTime(absence.time_from)}-${formatItTime(absence.time_to)}`
    : absence.reason_label

  return (
    <Box
      onClick={canManage ? () => onEdit(absence) : undefined}
      title={`${DAY_PART_OPTIONS.find((d) => d.value === dayPart)!.label}: ${absence.note || label}`}
      sx={{
        fontSize: '0.66rem', fontWeight: 600, textAlign: 'center', borderRadius: 0.75,
        px: 0.5, py: 0.25, bgcolor: colors.bg, color: colors.fg,
        cursor: canManage ? 'pointer' : 'default',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {short}·{label}
    </Box>
  )
}

// ─── Sezione categoria (Philips / Biotron) ───────────────────────────────────

function CategorySection({ label, accent, tint, technicians, absences, weekDays, canManage, onCell }: {
  label: string; accent: string; tint: string
  technicians: AbsenceTechnician[]
  absences: AbsenceRow[]
  weekDays: Date[]
  canManage: boolean
  onCell: (tech: AbsenceTechnician, dayISO: string, dayPart: DayPart, existing: AbsenceRow | null) => void
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
                  <Stack key={dayISO} spacing={0.3} sx={{ bgcolor: 'background.paper', p: 0.4, justifyContent: 'center' }}>
                    {DAY_PART_OPTIONS.map((dp) => {
                      const existing = findAbsence(techAbsences, t.id, dayISO, dp.value)
                      return (
                        <DayPartPill
                          key={dp.value}
                          dayPart={dp.value}
                          absence={existing}
                          canManage={canManage}
                          onAdd={() => onCell(t, dayISO, dp.value, null)}
                          onEdit={(a) => onCell(t, dayISO, dp.value, a)}
                        />
                      )
                    })}
                  </Stack>
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
    api.get<AbsenceTechnician[]>('/servicenow-technician-absences/technicians/')
      .then((r) => setTechnicians(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reload = React.useCallback(() => {
    setLoading(true)
    api.get<AbsenceRow[]>('/servicenow-technician-absences/', {
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
              onCell={(tech, dayISO, dayPart, existing) => setEditorTarget({ technician: tech, date: dayISO, dayPart, existing })}
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
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>M = Mattina · P = Pomeriggio</Typography>
      </Stack>

      <AbsenceEditorDialog
        target={editorTarget}
        absences={absences}
        onClose={() => setEditorTarget(null)}
        onSaved={reload}
      />
    </Box>
  )
}
