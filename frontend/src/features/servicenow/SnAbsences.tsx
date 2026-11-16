import * as React from 'react'
import { Box, Button, ButtonBase, Checkbox, FormControlLabel, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoDialog, CampoIcon } from '../../ui/campo'
import {
  ABSENCE_REASONS, DAY_PART_OPTIONS, addDays, findAbsence, formatItDate, formatItTime, startOfWeek, toISODate, todayISO, validateAbsencePayload,
  type AbsenceReason, type AbsenceRow, type AbsenceTechnician, type DayPart,
} from './absenceShared'
import { REASON_TINT, firstName } from './snModel'

const help = { fontSize: 11.5, color: 'text.secondary' } as const
type Tint = (typeof REASON_TINT)[keyof typeof REASON_TINT]
const tintSx = (t: Tint) => (t === 'neutral'
  ? { bgcolor: 'archie.neutralBg', color: 'text.secondary' }
  : { bgcolor: (th: import('@mui/material').Theme) => `color-mix(in srgb, ${th.palette.archie.tints[t].mid} 32%, ${th.palette.archie.tints[t].bg})`, color: (th: import('@mui/material').Theme) => th.palette.archie.tints[t].ink })
const absenceTint = (a: AbsenceRow): Tint => (a.is_hourly ? REASON_TINT.hourly : REASON_TINT[a.reason] ?? 'neutral')

// ── Una voce: utente × giorno × fascia ─────────────────────────────────────

export type EditorTarget = { technician: { id: number; name: string }; date: string; dayPart: DayPart; existing: AbsenceRow | null }

export function AbsenceEditorDialog({ target, absences, onClose, onSaved }: { target: EditorTarget | null; absences: AbsenceRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [reason, setReason] = React.useState<AbsenceReason>('ferie')
  const [note, setNote] = React.useState('')
  const [hourly, setHourly] = React.useState(false)
  const [from, setFrom] = React.useState('09:00')
  const [to, setTo] = React.useState('11:00')
  const [fullDay, setFullDay] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!target) return
    const e = target.existing
    setReason(e?.reason ?? 'ferie'); setNote(e?.note ?? ''); setHourly(Boolean(e?.is_hourly))
    setFrom(formatItTime(e?.time_from ?? null) || '09:00'); setTo(formatItTime(e?.time_to ?? null) || '11:00'); setFullDay(!e)
  }, [target])
  const t = target
  const other: DayPart = t?.dayPart === 'mattina' ? 'pomeriggio' : 'mattina'
  const otherBusy = Boolean(t && !t.existing && findAbsence(absences, t.technician.id, t.date, other))
  const partLabel = DAY_PART_OPTIONS.find((d) => d.value === t?.dayPart)?.label ?? ''
  const save = async () => {
    if (!t) return
    const err = validateAbsencePayload({ timeFrom: hourly && !fullDay ? from : null, timeTo: hourly && !fullDay ? to : null })
    if (err) { toast.error(err); return }
    setBusy(true)
    try {
      const body = { user: t.technician.id, date: t.date, reason, note, time_from: hourly && !fullDay ? from : null, time_to: hourly && !fullDay ? to : null }
      if (t.existing) await api.patch(`/servicenow-technician-absences/${t.existing.id}/`, body)
      else if (fullDay && !otherBusy) await api.post('/servicenow-technician-absences/full-day/', { user: t.technician.id, date: t.date, reason, note })
      else await api.post('/servicenow-technician-absences/', { ...body, day_part: t.dayPart })
      toast.success(t.existing ? 'Assenza aggiornata.' : 'Assenza registrata.')
      onSaved(); onClose()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!t?.existing) return
    setBusy(true)
    try { await api.delete(`/servicenow-technician-absences/${t.existing.id}/`); toast.success('Assenza tolta.'); onSaved(); onClose() } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  return (
    <CampoDialog open={Boolean(t)} onClose={onClose} busy={busy} labelId="sn-abs-title" width={440}
      title={t ? `${t.existing ? 'Assenza' : 'Nuova assenza'} di ${firstName(t.technician.name)}` : ''}
      sub={t ? `${formatItDate(t.date)} · ${fullDay && !t.existing && !otherBusy ? 'giornata intera' : partLabel.toLowerCase()}` : ''}
      footer={<>
        {t?.existing ? <Button variant="outlined" color="error" disabled={busy} onClick={() => void remove()}>Togli</Button> : null}
        <Box sx={{ flex: 1 }} />
        <Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>Salva</Button>
      </>}>
      {t && !t.existing ? (
        <Tooltip title={otherBusy ? "L'altra metà della giornata ha già un'assenza" : ''}>
          <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={fullDay && !otherBusy} disabled={otherBusy} onChange={(e) => { setFullDay(e.target.checked); if (e.target.checked) setHourly(false) }} />}
            label={<Typography sx={{ fontSize: 13 }}>Giornata intera (mattina e pomeriggio)</Typography>} />
        </Tooltip>
      ) : null}
      {!(fullDay && !otherBusy) || t?.existing ? (
        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={hourly} onChange={(e) => setHourly(e.target.checked)} />}
          label={<Typography sx={{ fontSize: 13 }}>Permesso orario dentro la {partLabel.toLowerCase()}</Typography>} />
      ) : null}
      {hourly && (!(fullDay && !otherBusy) || t?.existing) ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField type="time" label="Dalle" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="time" label="Alle" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
      ) : null}
      <TextField select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value as AbsenceReason)}>
        {ABSENCE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
      </TextField>
      <TextField label="Nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder="facoltativa" />
    </CampoDialog>
  )
}

// ── Elenco e aggiunta per un tecnico (dal riquadro "Oggi") ─────────────────

export function TechnicianAbsencesDialog({ technician, onClose, onSaved }: { technician: { id: number; name: string } | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [rows, setRows] = React.useState<AbsenceRow[] | null>(null)
  const [date, setDate] = React.useState(todayISO())
  const [busy, setBusy] = React.useState(false)
  const [editor, setEditor] = React.useState<EditorTarget | null>(null)
  const load = React.useCallback(() => {
    if (!technician) return
    api.get<AbsenceRow[]>('/servicenow-technician-absences/', { params: { user: technician.id, date_from: todayISO() } })
      .then((r) => setRows(r.data)).catch((e) => { toast.error(apiErrorToMessage(e)); setRows([]) })
  }, [technician, toast])
  React.useEffect(() => { setRows(null); setDate(todayISO()); load() }, [load])
  const remove = async (id: number) => {
    setBusy(true)
    try { await api.delete(`/servicenow-technician-absences/${id}/`); toast.success('Assenza tolta.'); load(); onSaved() } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <CampoDialog open={Boolean(technician) && !editor} onClose={onClose} labelId="sn-tabs-title" width={460}
        title={technician ? `Assenze di ${technician.name}` : ''} sub="Le prossime, a partire da oggi."
        footer={<><Box sx={{ flex: 1 }} /><Button variant="text" onClick={onClose}>Chiudi</Button></>}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField type="date" label="Giorno" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<CampoIcon name="plus" size={15} />} sx={{ height: 40 }} disabled={!date || !technician}
            onClick={() => technician && setEditor({ technician, date, dayPart: 'mattina', existing: null })}>Aggiungi</Button>
        </Box>
        {!rows ? <Typography sx={help}>Caricamento…</Typography> : !rows.length ? <Typography sx={help}>Nessuna assenza in programma.</Typography> : (
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {rows.map((a) => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '7px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                <Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', flex: 'none', ...tintSx(absenceTint(a)) }} />
                <Box sx={{ flex: 1, minWidth: 0, display: 'grid', lineHeight: 1.3 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 550 }}>{formatItDate(a.date)} · {a.day_part_label.toLowerCase()}</Typography>
                  <Typography noWrap sx={help}>{a.reason_label}{a.is_hourly ? ` · ${formatItTime(a.time_from)}–${formatItTime(a.time_to)}` : ''}{a.note ? ` · ${a.note}` : ''}</Typography>
                </Box>
                <IconButton size="small" aria-label="Togli l'assenza" disabled={busy} onClick={() => void remove(a.id)}><CampoIcon name="trash" size={14} /></IconButton>
              </Box>
            ))}
          </Box>
        )}
      </CampoDialog>
      <AbsenceEditorDialog target={editor} absences={rows ?? []} onClose={() => setEditor(null)} onSaved={() => { load(); onSaved() }} />
    </>
  )
}

// ── Settimana (Dashboard casi) ─────────────────────────────────────────────

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven']

export function WeekAbsences({ technicians, canManage, refreshKey, onChanged }: { technicians: AbsenceTechnician[]; canManage: boolean; refreshKey?: number; onChanged?: () => void }) {
  const toast = useToast()
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()))
  const [rows, setRows] = React.useState<AbsenceRow[]>([])
  const [editor, setEditor] = React.useState<EditorTarget | null>(null)
  const days = React.useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const load = React.useCallback(() => {
    api.get<AbsenceRow[]>('/servicenow-technician-absences/', { params: { date_from: toISODate(days[0]), date_to: toISODate(days[4]) } })
      .then((r) => setRows(r.data)).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [days, toast])
  React.useEffect(() => { load() }, [load, refreshKey])
  const today = todayISO()
  const label = `${days[0].getDate()} – ${days[4].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
  const cell = (t: AbsenceTechnician, iso: string, part: DayPart) => {
    const a = findAbsence(rows, t.id, iso, part)
    const text = a ? (a.is_hourly ? `${formatItTime(a.time_from)}–${formatItTime(a.time_to)}` : a.reason_label.slice(0, 3)) : ''
    return (
      <ButtonBase key={part} disabled={!canManage} onClick={() => setEditor({ technician: t, date: iso, dayPart: part, existing: a })}
        aria-label={`${t.name}, ${iso}, ${part}${a ? `: ${a.reason_label}` : ''}`} title={a ? `${a.reason_label}${a.note ? ` · ${a.note}` : ''}` : canManage ? 'Aggiungi un\'assenza' : ''}
        sx={{ flex: 1, minWidth: 0, height: 26, borderRadius: '4px', fontSize: 10.5, fontWeight: 650, overflow: 'hidden', whiteSpace: 'nowrap',
          ...(a ? tintSx(absenceTint(a)) : { bgcolor: 'archie.surface2', '&:hover': canManage ? { boxShadow: (th) => `inset 0 0 0 1px ${th.palette.divider}` } : undefined }) }}>{text}</ButtonBase>
    )
  }
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <IconButton size="small" aria-label="Settimana precedente" onClick={() => setWeekStart((w) => addDays(w, -7))}><CampoIcon name="chevL" size={15} /></IconButton>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, minWidth: 104, textAlign: 'center' }}>{label}</Typography>
        <IconButton size="small" aria-label="Settimana successiva" onClick={() => setWeekStart((w) => addDays(w, 7))}><CampoIcon name="chevR" size={15} /></IconButton>
        <Button size="small" variant="text" onClick={() => setWeekStart(startOfWeek(new Date()))} sx={{ minWidth: 0 }}>Oggi</Button>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 420, '& th, & td': { p: '4px 3px', borderBottom: '1px solid', borderColor: 'divider' } }}>
          <thead>
            <tr>
              <Box component="th" sx={{ width: 92 }} />
              {days.map((d, i) => {
                const on = toISODate(d) === today
                return <Box component="th" key={i} sx={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? 'primary.main' : 'text.secondary', textAlign: 'left' }}>{WEEKDAYS[i]} {d.getDate()}</Box>
              })}
            </tr>
          </thead>
          <tbody>
            {technicians.map((t) => (
              <tr key={t.id}>
                <Box component="th" sx={{ textAlign: 'left', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.name}>{firstName(t.name)}</Box>
                {days.map((d) => {
                  const iso = toISODate(d)
                  return <Box component="td" key={iso} sx={{ bgcolor: iso === today ? 'archie.field' : undefined }}><Box sx={{ display: 'flex', gap: '2px' }}>{cell(t, iso, 'mattina')}{cell(t, iso, 'pomeriggio')}</Box></Box>
                })}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 1.25, fontSize: 11, color: 'text.secondary' }}>
        {[...ABSENCE_REASONS.map((r) => [r.label, REASON_TINT[r.value]] as const), ['Permesso orario', REASON_TINT.hourly] as const].map(([l, tint]) => (
          <Box key={l} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}><Box component="i" sx={{ width: 12, height: 10, borderRadius: '3px', ...tintSx(tint) }} />{l}</Box>
        ))}
        <Box component="span">Ogni giorno: mattina a sinistra, pomeriggio a destra.</Box>
      </Box>
      <AbsenceEditorDialog target={editor} absences={rows} onClose={() => setEditor(null)} onSaved={() => { load(); onChanged?.() }} />
    </Box>
  )
}
