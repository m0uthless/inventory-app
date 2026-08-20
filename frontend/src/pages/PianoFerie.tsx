import * as React from 'react'
import { useTheme, alpha } from '@mui/material/styles'
import {
  Box, Stack, Typography, IconButton, CircularProgress, Tooltip,
  Collapse, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, Paper, Chip,
  Avatar, ToggleButton, ToggleButtonGroup, LinearProgress,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'

import { useStatusTokens } from '../theme/AppThemeProvider'
import { committenteColor, type ColorTriple } from '../theme/statusTokens'

import {
  type AbsenceRow, type AbsenceReason, type AbsenceStatus, type DayPart,
  type RosterRow, type RosterResponse, type HolidayRow,
  ABSENCE_REASONS, ABSENCE_STATUSES, DAY_PARTS, LEGEND,
  swatchFor, toISODate, daysInMonth, isWeekend, holidaysForArea,
  indexAbsences, cellKey, MONTH_LABELS_IT, WEEKDAY_SHORT_IT, initialsOf, todayISO,
} from '../features/pianoferie/pianoFerieShared'

const AREA_OPEN_KEY = 'pianoferie_area_open'

type BulkDayPart = DayPart | 'entrambe'

type EditorTarget = {
  userId: number
  userName: string
  date: string
  dayPart: DayPart
  existing: AbsenceRow | null
  canValidate: boolean
  editableReason: boolean
}

type BulkTarget = {
  userId: number
  userName: string
  dayPart: BulkDayPart
  dates: string[]
  editableReason: boolean
}

// Selezione trascinamento: memorizza QUALI fasce sono state effettivamente
// toccate (solo mattina, solo pomeriggio, o entrambe se il trascinamento
// passa dall'una all'altra) — non forza mai la giornata intera.
type DragState = {
  userId: number
  areaId: number | null
  initialPart: DayPart
  from: string
  to: string
  touchedMattina: boolean
  touchedPomeriggio: boolean
}

// ─── Editor cella singola ────────────────────────────────────────────────────

function CellEditorDialog({ target, onClose, onSaved }: {
  target: EditorTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [reason, setReason] = React.useState<AbsenceReason>('ferie')
  const [status, setStatus] = React.useState<AbsenceStatus>('proposta')
  const [note, setNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!target) return
    const e = target.existing
    setReason(e ? e.reason : 'ferie')
    setStatus(e ? e.status : (target.canValidate ? 'validata' : 'proposta'))
    setNote(e ? e.note : '')
  }, [target])

  if (!target) return null
  const { userName, date, dayPart, existing, canValidate, editableReason } = target
  const dayPartLabel = DAY_PARTS.find((d) => d.value === dayPart)?.label ?? dayPart
  const prettyDate = new Date(`${date}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const save = async () => {
    const payload: Record<string, unknown> = {
      user: target.userId, date, day_part: dayPart,
      reason: editableReason ? reason : 'ferie', note,
    }
    if (editableReason) payload.status = status
    setSaving(true)
    try {
      if (existing) await api.patch(`/absences/${existing.id}/`, payload)
      else await api.post('/absences/', payload)
      toast.success('Salvato')
      onSaved(); onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally { setSaving(false) }
  }

  const quick = async (action: 'validate' | 'reject') => {
    if (!existing) return
    setBusy(true)
    try {
      await api.post(`/absences/${existing.id}/${action}/`)
      toast.success(action === 'validate' ? 'Validata' : 'Rifiutata')
      onSaved(); onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await api.delete(`/absences/${existing.id}/`)
      toast.success('Rimossa')
      onSaved(); onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontWeight: 700 }}>{userName}</Typography>
        <Typography variant="caption" color="text.secondary">{prettyDate} · {dayPartLabel}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select label="Motivo" size="small" value={reason}
            onChange={(e) => setReason(e.target.value as AbsenceReason)}
            disabled={!editableReason}
            helperText={!editableReason ? 'Puoi proporre solo ferie.' : undefined}
          >
            {ABSENCE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          {editableReason && (
            <TextField
              select label="Stato" size="small" value={status}
              onChange={(e) => setStatus(e.target.value as AbsenceStatus)}
            >
              {ABSENCE_STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Nota" size="small" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          {existing && existing.validated_by_name && (
            <Typography variant="caption" color="text.secondary">{existing.status_label} da {existing.validated_by_name}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        {existing && (
          <Button color="error" size="small" startIcon={<DeleteOutlineIcon />} onClick={remove} disabled={busy || saving}>Elimina</Button>
        )}
        <Box sx={{ flex: 1 }} />
        {existing && canValidate && existing.status !== 'validata' && (
          <Button size="small" color="success" startIcon={<CheckCircleOutlineIcon />} onClick={() => quick('validate')} disabled={busy || saving}>Valida</Button>
        )}
        {existing && canValidate && existing.status !== 'rifiutata' && (
          <Button size="small" color="warning" startIcon={<HighlightOffIcon />} onClick={() => quick('reject')} disabled={busy || saving}>Rifiuta</Button>
        )}
        <Button onClick={onClose} disabled={saving || busy}>Annulla</Button>
        <Button variant="contained" onClick={save} disabled={saving || busy}>{saving ? '…' : 'Salva'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Editor selezione multipla (una fascia o giornata intera, su più giorni) ─

function BulkEditorDialog({ target, onClose, onSaved }: {
  target: BulkTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [reason, setReason] = React.useState<AbsenceReason>('ferie')
  const [status, setStatus] = React.useState<AbsenceStatus>('proposta')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!target) return
    setReason('ferie')
    setStatus(target.editableReason ? 'validata' : 'proposta')
    setNote('')
  }, [target])

  if (!target) return null
  const { userName, dayPart, dates, editableReason } = target
  const dayPartLabel = dayPart === 'entrambe' ? 'Giornata intera' : (DAY_PARTS.find((d) => d.value === dayPart)?.label ?? dayPart)

  const apply = async (action: 'set' | 'clear') => {
    const payload: Record<string, unknown> = {
      user: target.userId, day_part: dayPart, dates, action,
      reason: editableReason ? reason : 'ferie', note,
    }
    if (editableReason) payload.status = status
    setBusy(true)
    try {
      const r = await api.post('/absences/bulk/', payload)
      const d = r.data as { created: number; updated: number; cleared: number; skipped: number }
      const parts: string[] = []
      if (d.created) parts.push(`${d.created} create`)
      if (d.updated) parts.push(`${d.updated} aggiornate`)
      if (d.cleared) parts.push(`${d.cleared} svuotate`)
      if (d.skipped) parts.push(`${d.skipped} saltate`)
      toast.success(parts.length ? parts.join(', ') : 'Fatto')
      onSaved(); onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontWeight: 700 }}>{userName}</Typography>
        <Typography variant="caption" color="text.secondary">{dates.length} giorni · {dayPartLabel}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select label="Motivo" size="small" value={reason}
            onChange={(e) => setReason(e.target.value as AbsenceReason)}
            disabled={!editableReason}
            helperText={!editableReason ? 'Puoi proporre solo ferie.' : undefined}
          >
            {ABSENCE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          {editableReason && (
            <TextField
              select label="Stato" size="small" value={status}
              onChange={(e) => setStatus(e.target.value as AbsenceStatus)}
            >
              {ABSENCE_STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Nota" size="small" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button color="error" size="small" startIcon={<DeleteOutlineIcon />} onClick={() => apply('clear')} disabled={busy}>Svuota</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" onClick={() => apply('set')} disabled={busy}>{busy ? '…' : 'Applica'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Cella giorno (MAT sopra / POM sotto) ────────────────────────────────────

function DayCell({ userId, iso, index, editable, blocked, isPartSelected, onDown, onEnter, cellW, cellH }: {
  userId: number
  iso: string
  index: Map<string, AbsenceRow>
  editable: boolean
  blocked: boolean
  isPartSelected: (part: DayPart) => boolean
  onDown: (part: DayPart, existing: AbsenceRow | null) => void
  onEnter: (part: DayPart) => void
  cellW: number
  cellH: number
}) {
  return (
    <Box sx={{ width: cellW, display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {DAY_PARTS.map((dp) => {
        const row = index.get(cellKey(userId, iso, dp.value)) ?? null
        const sw = row ? swatchFor(row.reason, row.status) : null
        const dashed = row && row.status === 'proposta'
        const selected = isPartSelected(dp.value)
        return (
          <Tooltip
            key={dp.value}
            title={row ? `${dp.label}: ${row.reason_label} (${row.status_label})${row.note ? ' — ' + row.note : ''}` : ''}
            disableHoverListener={!row}
            arrow
          >
            <Box
              onMouseDown={editable && !blocked ? (e) => { e.preventDefault(); onDown(dp.value, row) } : undefined}
              onMouseEnter={editable && !blocked ? () => onEnter(dp.value) : undefined}
              sx={{
                height: cellH,
                bgcolor: blocked ? 'action.disabledBackground' : sw ? sw.bg : 'transparent',
                border: dashed ? '1px dashed' : '1px solid',
                borderColor: selected ? 'primary.main' : sw ? sw.fg : 'divider',
                outline: selected ? '2px solid' : 'none',
                outlineColor: 'primary.main',
                borderRadius: '3px',
                cursor: editable && !blocked ? 'pointer' : 'default',
                opacity: blocked ? 0.35 : row && row.status === 'rifiutata' ? 0.5 : 1,
                position: 'relative', zIndex: 2,
                transition: 'background-color .12s',
              }}
            />
          </Tooltip>
        )
      })}
    </Box>
  )
}

// ─── Riga persona (avatar + nome + celle giorno) ─────────────────────────────
// Condivisa fra la vista "Team" (dentro AreaGroup) e la vista "Persona"
// (lista piatta, vedi FlatPersonList) — stessa cella, stesso comportamento
// di click/drag, cambia solo il contenitore attorno.

const NAME_COL_W = 190

function PersonRow({
  u, days, index, editable, isPartSelected, onCellDown, onCellEnter, onHoverDay,
  cellW, cellH, getBlockedSet, clientChipPalette,
}: {
  u: RosterRow
  days: Date[]
  index: Map<string, AbsenceRow>
  editable: boolean
  isPartSelected: (userId: number, iso: string, part: DayPart) => boolean
  onCellDown: (u: RosterRow, iso: string, part: DayPart, existing: AbsenceRow | null) => void
  onCellEnter: (u: RosterRow, iso: string, part: DayPart) => void
  onHoverDay: (iso: string | null) => void
  cellW: number
  cellH: number
  getBlockedSet: (areaId: number | null) => Set<string>
  clientChipPalette: ColorTriple[]
}) {
  const theme = useTheme()
  const [hovered, setHovered] = React.useState(false)
  const ROW_HOVER_BG = alpha(theme.palette.primary.main, 0.07)
  const blockedSet = getBlockedSet(u.area_id)
  const avatarColor = committenteColor(u.name, clientChipPalette)
  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{ display: 'flex', alignItems: 'stretch', gap: '2px' }}
    >
      <Box sx={{
        position: 'sticky', left: 0, zIndex: 1, width: NAME_COL_W, minWidth: NAME_COL_W,
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1,
        bgcolor: hovered ? ROW_HOVER_BG : 'background.paper',
        borderRight: '1px solid', borderColor: 'divider',
      }}>
        <Avatar sx={{
          width: 24, height: 24, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
          bgcolor: avatarColor.bg, color: avatarColor.color, border: `1px solid ${avatarColor.border}`,
        }}>
          {initialsOf(u.name)}
        </Avatar>
        <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{u.name}</Typography>
      </Box>
      {days.map((d) => {
        const iso = toISODate(d)
        const blocked = blockedSet.has(iso)
        return (
          <Box
            key={iso}
            onMouseEnter={() => onHoverDay(iso)}
            onMouseLeave={() => onHoverDay(null)}
            sx={{
              py: '1px',
              bgcolor: hovered ? ROW_HOVER_BG : (isWeekend(d) ? 'action.hover' : 'transparent'),
            }}
          >
            <DayCell
              userId={u.id} iso={iso} index={index}
              editable={editable} blocked={blocked}
              isPartSelected={(part) => isPartSelected(u.id, iso, part)}
              onDown={(part, existing) => onCellDown(u, iso, part, existing)}
              onEnter={(part) => onCellEnter(u, iso, part)}
              cellW={cellW} cellH={cellH}
            />
          </Box>
        )
      })}
    </Box>
  )
}

// ─── Gruppo area (vista "Team") ───────────────────────────────────────────────

function AreaGroup({
  areaLabel, users, days, getBlockedSet, index, canEditRow, open, onToggle,
  onCellDown, onCellEnter, isPartSelected, onHoverDay, cellW, cellH,
  clientChipPalette,
}: {
  areaLabel: string
  users: RosterRow[]
  days: Date[]
  getBlockedSet: (areaId: number | null) => Set<string>
  index: Map<string, AbsenceRow>
  canEditRow: (userId: number) => boolean
  open: boolean
  onToggle: () => void
  onCellDown: (u: RosterRow, iso: string, part: DayPart, existing: AbsenceRow | null) => void
  onCellEnter: (u: RosterRow, iso: string, part: DayPart) => void
  isPartSelected: (userId: number, iso: string, part: DayPart) => boolean
  onHoverDay: (iso: string | null) => void
  cellW: number
  cellH: number
  clientChipPalette: ColorTriple[]
}) {
  return (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={onToggle}
        sx={{
          position: 'sticky', left: 0, zIndex: 2, width: 'fit-content',
          display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
          px: 1, py: 0.5, mb: 0.5, borderRadius: 1, bgcolor: 'action.hover',
        }}
      >
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{areaLabel}</Typography>
        <Typography variant="caption" color="text.secondary">({users.length})</Typography>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Stack spacing="2px">
          {users.map((u) => (
            <PersonRow
              key={u.id} u={u} days={days} index={index}
              editable={canEditRow(u.id)} isPartSelected={isPartSelected}
              onCellDown={onCellDown} onCellEnter={onCellEnter} onHoverDay={onHoverDay}
              cellW={cellW} cellH={cellH} getBlockedSet={getBlockedSet}
              clientChipPalette={clientChipPalette}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  )
}

// ─── Lista piatta (vista "Persona") — stesse righe, senza raggruppamento ─────

function FlatPersonList({
  users, days, getBlockedSet, index, canEditRow,
  onCellDown, onCellEnter, isPartSelected, onHoverDay, cellW, cellH,
  clientChipPalette,
}: {
  users: RosterRow[]
  days: Date[]
  getBlockedSet: (areaId: number | null) => Set<string>
  index: Map<string, AbsenceRow>
  canEditRow: (userId: number) => boolean
  onCellDown: (u: RosterRow, iso: string, part: DayPart, existing: AbsenceRow | null) => void
  onCellEnter: (u: RosterRow, iso: string, part: DayPart) => void
  isPartSelected: (userId: number, iso: string, part: DayPart) => boolean
  onHoverDay: (iso: string | null) => void
  cellW: number
  cellH: number
  clientChipPalette: ColorTriple[]
}) {
  return (
    <Stack spacing="2px" sx={{ mb: 1 }}>
      {users.map((u) => (
        <PersonRow
          key={u.id} u={u} days={days} index={index}
          editable={canEditRow(u.id)} isPartSelected={isPartSelected}
          onCellDown={onCellDown} onCellEnter={onCellEnter} onHoverDay={onHoverDay}
          cellW={cellW} cellH={cellH} getBlockedSet={getBlockedSet}
          clientChipPalette={clientChipPalette}
        />
      ))}
    </Stack>
  )
}

// ─── Pannello riepilogo (spazio a destra) ────────────────────────────────────

type PendingGroup = {
  key: string
  requestGroup: string | null
  userId: number
  ids: number[]
  dates: string[]
  dayParts: DayPart[]
  reasonLabel: string
}

function formatDateRange(dates: string[]): string {
  const sorted = [...dates].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const fmt = (iso: string, withMonth: boolean) => {
    const d = new Date(`${iso}T00:00:00`)
    return withMonth
      ? d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
      : d.toLocaleDateString('it-IT', { day: '2-digit' })
  }
  if (first === last) return fmt(first, true)
  const sameMonth = first.slice(0, 7) === last.slice(0, 7)
  return sameMonth ? `${fmt(first, false)}–${fmt(last, true)}` : `${fmt(first, true)} – ${fmt(last, true)}`
}

function SummaryPanel({ periodLabel, areaLabel, absences, pendingAbsences, roster, canEditAll, onOpenPending, onGroupResolved }: {
  periodLabel: string
  areaLabel: string | null
  absences: AbsenceRow[]
  pendingAbsences: AbsenceRow[]
  roster: RosterRow[]
  canEditAll: boolean
  onOpenPending: (row: AbsenceRow) => void
  onGroupResolved: () => void
}) {
  const toast = useToast()
  const [busyKey, setBusyKey] = React.useState<string | null>(null)

  const stats = React.useMemo(() => {
    let validataFerieHalf = 0
    let propostaFerieHalf = 0
    let altreValidate = 0
    for (const a of absences) {
      if (a.status === 'rifiutata') continue
      if (a.reason === 'ferie') {
        if (a.status === 'validata') validataFerieHalf += 1
        else if (a.status === 'proposta') propostaFerieHalf += 1
      } else if (a.status === 'validata') {
        altreValidate += 1
      }
    }
    return {
      ferieValidateGiorni: validataFerieHalf / 2,
      ferieProposteGiorni: propostaFerieHalf / 2,
      altreValidate,
    }
  }, [absences])

  // Ripartizione % delle ferie validate per area (solo ferie, solo
  // validate — coerente con "Ferie validate" sopra). Mostrata solo se ci
  // sono almeno 2 aree diverse rappresentate, altrimenti sarebbe sempre
  // al 100% e non aggiungerebbe informazione.
  const areaBreakdown = React.useMemo(() => {
    const userArea = new Map<number, string>()
    for (const u of roster) userArea.set(u.id, u.area_label || 'Senza area')
    const half = new Map<string, number>()
    for (const a of absences) {
      if (a.reason !== 'ferie' || a.status !== 'validata') continue
      const label = userArea.get(a.user) ?? 'Senza area'
      half.set(label, (half.get(label) ?? 0) + 1)
    }
    const total = Array.from(half.values()).reduce((s, v) => s + v, 0)
    if (total === 0) return []
    return Array.from(half.entries())
      .map(([label, h]) => ({ label, pct: Math.round((h / total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
  }, [absences, roster])

  // Raggruppa le proposte per request_group: una selezione (click o
  // trascinamento) = UNA voce, validabile/rifiutabile con un solo click,
  // invece di una riga per ogni singola mezza giornata.
  // NB: usa `pendingAbsences` (tutte le proposte in attesa, su qualunque
  // mese) e non `absences` (che è limitato al mese attualmente in vista),
  // così il coordinatore può validare ferie richieste per un mese diverso
  // da quello visualizzato nel calendario.
  const pendingGroups = React.useMemo((): PendingGroup[] => {
    const map = new Map<string, PendingGroup>()
    for (const a of pendingAbsences) {
      if (a.status !== 'proposta') continue
      const key = a.request_group ? `g:${a.request_group}` : `id:${a.id}`
      let g = map.get(key)
      if (!g) {
        g = { key, requestGroup: a.request_group, userId: a.user, ids: [], dates: [], dayParts: [], reasonLabel: a.reason_label }
        map.set(key, g)
      }
      g.ids.push(a.id)
      g.dates.push(a.date)
      g.dayParts.push(a.day_part)
    }
    return Array.from(map.values())
      .sort((a, b) => Math.min(...a.dates.map(Date.parse)) - Math.min(...b.dates.map(Date.parse)))
      .slice(0, 12)
  }, [pendingAbsences])

  const nameFor = React.useCallback((userId: number) => {
    return roster.find((u) => u.id === userId)?.name ?? `#${userId}`
  }, [roster])

  const fasciaLabel = (g: PendingGroup): string => {
    const uniqueDates = new Set(g.dates)
    const hasMattina = g.dayParts.includes('mattina')
    const hasPomeriggio = g.dayParts.includes('pomeriggio')
    const fascia = hasMattina && hasPomeriggio ? 'Giornata intera' : hasMattina ? 'Mattina' : 'Pomeriggio'
    return uniqueDates.size > 1 ? `${uniqueDates.size} giorni · ${fascia}` : fascia
  }

  const resolveGroup = async (g: PendingGroup, action: 'validate' | 'reject') => {
    setBusyKey(g.key)
    try {
      if (g.requestGroup) {
        await api.post(`/absences/${action}-group/`, { request_group: g.requestGroup })
      } else {
        // Riga singola senza request_group (dato storico): endpoint per-id.
        await Promise.all(g.ids.map((id) => api.post(`/absences/${id}/${action}/`)))
      }
      toast.success(action === 'validate' ? 'Validato' : 'Rifiutato')
      onGroupResolved()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }}>
        Riepilogo · {periodLabel}
      </Typography>
      {areaLabel && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          Area: {areaLabel}
        </Typography>
      )}
      <Stack spacing={1} sx={{ mb: 2, mt: areaLabel ? 0 : 1.25 }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">Ferie validate</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{stats.ferieValidateGiorni} gg</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">Ferie in attesa</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: stats.ferieProposteGiorni ? 'warning.main' : 'text.primary' }}>
            {stats.ferieProposteGiorni} gg
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">Altre attività</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{stats.altreValidate}</Typography>
        </Stack>
      </Stack>

      {areaBreakdown.length > 1 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {areaBreakdown.map((row) => (
            <Box key={row.label}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{row.pct}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={row.pct} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          ))}
        </Stack>
      )}

      {canEditAll && (
        <>
          <Divider sx={{ mb: 1.5 }} />
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
            <HourglassEmptyIcon fontSize="small" color="warning" />
            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Da validare</Typography>
            {pendingGroups.length > 0 && <Chip label={pendingGroups.length} size="small" color="warning" sx={{ height: 18, fontSize: '0.68rem' }} />}
          </Stack>
          {pendingGroups.length === 0 ? (
            <Typography variant="caption" color="text.secondary">Nessuna proposta in attesa.</Typography>
          ) : (
            <Stack spacing={0.5}>
              {pendingGroups.map((g) => {
                const busy = busyKey === g.key
                return (
                  <Stack
                    key={g.key}
                    direction="row" alignItems="center"
                    sx={{ px: 1, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <Box
                      onClick={() => {
                        const row = pendingAbsences.find((a) => a.id === g.ids[0])
                        if (row) onOpenPending(row)
                      }}
                      sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>{nameFor(g.userId)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRange(g.dates)} · {fasciaLabel(g)} · {g.reasonLabel}
                      </Typography>
                    </Box>
                    <Tooltip title="Valida tutto il periodo" arrow>
                      <span>
                        <IconButton size="small" color="success" disabled={busy} onClick={() => resolveGroup(g, 'validate')}>
                          <CheckCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Rifiuta tutto il periodo" arrow>
                      <span>
                        <IconButton size="small" color="warning" disabled={busy} onClick={() => resolveGroup(g, 'reject')}>
                          <HighlightOffIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                )
              })}
            </Stack>
          )}
        </>
      )}
    </Paper>
  )
}

// ─── Card "Assenti di oggi" ────────────────────────────────────────────────
// Letta dalle `absences` del mese già caricate: visibile solo quando il
// mese mostrato in griglia è quello corrente (altrimenti i dati di "oggi"
// non sono in memoria) — non introduce nessuna chiamata API in più.

function TodayAbsencesCard({ absences, clientChipPalette }: {
  absences: AbsenceRow[]
  clientChipPalette: ColorTriple[]
}) {
  const iso = todayISO()
  const entries = React.useMemo(() => {
    const byUser = new Map<number, AbsenceRow>()
    for (const a of absences) {
      if (a.date !== iso) continue
      if (a.status !== 'validata' && a.status !== 'proposta') continue
      const cur = byUser.get(a.user)
      // Se un utente ha sia mattina che pomeriggio, tiene una sola voce;
      // preferisce quella validata se presente.
      if (!cur || (cur.status !== 'validata' && a.status === 'validata')) byUser.set(a.user, a)
    }
    return Array.from(byUser.values()).sort((a, b) => a.user_name.localeCompare(b.user_name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absences])

  if (entries.length === 0) return null

  const dateLabel = new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1.25 }}>
        Assenti di oggi · {dateLabel}
      </Typography>
      <Stack spacing={1}>
        {entries.map((a) => {
          const c = committenteColor(a.user_name, clientChipPalette)
          const label = a.status === 'proposta' ? `${a.reason_label} (proposta)` : a.reason_label
          return (
            <Stack key={a.user} direction="row" alignItems="center" spacing={1}>
              <Avatar sx={{
                width: 22, height: 22, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0,
                bgcolor: c.bg, color: c.color, border: `1px solid ${c.border}`,
              }}>
                {initialsOf(a.user_name)}
              </Avatar>
              <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 600 }}>{a.user_name}</Typography>
              <Typography variant="caption" color={a.status === 'proposta' ? 'warning.main' : 'text.secondary'}>
                {label}
              </Typography>
            </Stack>
          )
        })}
      </Stack>
    </Paper>
  )
}

// ─── Card "Prossime festività" ─────────────────────────────────────────────

function UpcomingHolidaysCard({ holidays }: { holidays: HolidayRow[] }) {
  if (holidays.length === 0) return null
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1.25 }}>Prossime festività</Typography>
      <Stack spacing={1}>
        {holidays.map((h) => (
          <Stack key={h.id} direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">{h.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(`${h.date}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}

// ─── "+ Nuova richiesta" — step 1 (persona + intervallo date + fascia) ──────
// Step 2 riusa il BulkEditorDialog già esistente e invariato: questo dialog
// si limita a costruire un BulkTarget e a passarlo al genitore.

function NewRequestDialog({ open, onClose, roster, canEditAll, currentUserId, getBlockedSet, onNext }: {
  open: boolean
  onClose: () => void
  roster: RosterRow[]
  canEditAll: boolean
  currentUserId: number | null
  getBlockedSet: (areaId: number | null) => Set<string>
  onNext: (target: BulkTarget) => void
}) {
  const toast = useToast()
  const [userId, setUserId] = React.useState<number | ''>('')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [dayPart, setDayPart] = React.useState<BulkDayPart>('entrambe')

  React.useEffect(() => {
    if (!open) return
    setUserId(canEditAll ? '' : (currentUserId ?? ''))
    setDateFrom(''); setDateTo(''); setDayPart('entrambe')
  }, [open, canEditAll, currentUserId])

  const sortedRoster = React.useMemo(
    () => [...roster].sort((a, b) => a.name.localeCompare(b.name)),
    [roster],
  )

  const submit = () => {
    if (!userId) { toast.error('Seleziona una persona'); return }
    if (!dateFrom || !dateTo) { toast.error('Seleziona un intervallo di date'); return }
    if (dateTo < dateFrom) { toast.error('La data di fine è precedente a quella di inizio'); return }
    const u = roster.find((r) => r.id === userId)
    if (!u) return
    const blocked = getBlockedSet(u.area_id)
    const dates: string[] = []
    const cursor = new Date(`${dateFrom}T00:00:00`)
    const end = new Date(`${dateTo}T00:00:00`)
    while (cursor <= end) {
      const iso = toISODate(cursor)
      if (!blocked.has(iso)) dates.push(iso)
      cursor.setDate(cursor.getDate() + 1)
    }
    if (dates.length === 0) { toast.error('Nessun giorno selezionabile nell\'intervallo (weekend/festività)'); return }
    onNext({ userId: u.id, userName: u.name, dayPart, dates, editableReason: canEditAll })
    onClose()
  }

  const currentUserName = roster.find((r) => r.id === currentUserId)?.name ?? ''

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Nuova richiesta</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {canEditAll ? (
            <TextField
              select label="Persona" size="small" value={userId}
              onChange={(e) => setUserId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              {sortedRoster.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
          ) : (
            <TextField label="Persona" size="small" value={currentUserName} disabled />
          )}
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Dal" type="date" size="small" fullWidth value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Al" type="date" size="small" fullWidth value={dateTo}
              onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <TextField
            select label="Fascia" size="small" value={dayPart}
            onChange={(e) => setDayPart(e.target.value as BulkDayPart)}
          >
            <MenuItem value="entrambe">Giornata intera</MenuItem>
            <MenuItem value="mattina">Mattina</MenuItem>
            <MenuItem value="pomeriggio">Pomeriggio</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="contained" onClick={submit}>Avanti</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Pagina ──────────────────────────────────────────────────────────────────

export default function PianoFerie() {
  const toast = useToast()
  const theme = useTheme()
  const statusTokens = useStatusTokens()

  const today = new Date()
  const [year, setYear] = React.useState(today.getFullYear())
  const [month, setMonth] = React.useState(today.getMonth())
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const [roster, setRoster] = React.useState<RosterRow[]>([])
  const [canEditAll, setCanEditAll] = React.useState(false)
  const [isFullAccess, setIsFullAccess] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null)
  const [currentUserAreaId, setCurrentUserAreaId] = React.useState<number | null>(null)
  const [absences, setAbsences] = React.useState<AbsenceRow[]>([])
  const [pendingAbsences, setPendingAbsences] = React.useState<AbsenceRow[]>([])
  const [holidayRows, setHolidayRows] = React.useState<HolidayRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const [editorTarget, setEditorTarget] = React.useState<EditorTarget | null>(null)
  const [bulkTarget, setBulkTarget] = React.useState<BulkTarget | null>(null)
  const [newRequestOpen, setNewRequestOpen] = React.useState(false)

  // Vista Team (raggruppata per area) vs Persona (lista piatta, senza
  // raggruppamento).
  const [viewMode, setViewMode] = React.useState<'team' | 'persona'>('team')

  // Festività "vere" (anno reale corrente, non l'anno del mese in vista nel
  // calendario) per la card "Prossime festività": caricate una volta sola,
  // indipendenti dalla navigazione mese/anno che pilota `holidayRows`.
  const [upcomingHolidays, setUpcomingHolidays] = React.useState<HolidayRow[]>([])
  React.useEffect(() => {
    const y = today.getFullYear()
    const years = today.getMonth() >= 9 ? [y, y + 1] : [y]
    Promise.all(years.map((yy) => api.get<HolidayRow[]>('/leave-holidays/', { params: { year: yy } })))
      .then((results) => setUpcomingHolidays(results.flatMap((r) => r.data)))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [areaOpen, setAreaOpen] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(AREA_OPEN_KEY) || '{}') } catch { return {} }
  })
  React.useEffect(() => { localStorage.setItem(AREA_OPEN_KEY, JSON.stringify(areaOpen)) }, [areaOpen])

  React.useEffect(() => {
    api.get<RosterResponse>('/absences/roster/')
      .then((r) => {
        setRoster(r.data.rows)
        setCanEditAll(r.data.can_edit_all)
        setIsFullAccess(r.data.is_full_access)
        setCurrentUserId(r.data.current_user_id)
        setCurrentUserAreaId(r.data.current_user_area_id)
      })
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Festività dell'anno corrente (nazionali + locali per area).
  React.useEffect(() => {
    api.get<HolidayRow[]>('/leave-holidays/', { params: { year } })
      .then((r) => setHolidayRows(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const range = React.useMemo(() => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    return { from: toISODate(first), to: toISODate(last) }
  }, [year, month])

  const reload = React.useCallback(() => {
    setLoading(true)
    api.get<AbsenceRow[]>('/absences/', { params: { date_from: range.from, date_to: range.to } })
      .then((r) => setAbsences(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to])

  React.useEffect(() => { reload() }, [reload])

  // Proposte in attesa di validazione: caricate SENZA filtro di data, così
  // il pannello "Da validare" mostra sempre tutte le richieste pendenti
  // (es. ferie chieste a settembre mentre si sta guardando agosto), non
  // solo quelle del mese attualmente in vista nel calendario. Caricato solo
  // per chi può validare (canEditAll); altrimenti resta vuoto.
  const reloadPending = React.useCallback(() => {
    if (!canEditAll) { setPendingAbsences([]); return }
    api.get<AbsenceRow[]>('/absences/', { params: { status: 'proposta' } })
      .then((r) => setPendingAbsences(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditAll])

  React.useEffect(() => { reloadPending() }, [reloadPending])

  // Ricarica sia la vista del mese corrente sia l'elenco completo delle
  // proposte pendenti: da usare ovunque una modifica possa cambiare lo
  // stato di una richiesta (validazione, rifiuto, modifica, cancellazione).
  const reloadAll = React.useCallback(() => {
    reload()
    reloadPending()
  }, [reload, reloadPending])

  const index = React.useMemo(() => indexAbsences(absences), [absences])

  const groups = React.useMemo(() => {
    const map = new Map<string, RosterRow[]>()
    for (const u of roster) {
      const key = u.area_label || 'Senza area'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(u)
    }
    return Array.from(map.entries())
  }, [roster])

  // Vista "Persona": stessa lista, ma piatta (nessun header di gruppo),
  // ordinata per nome.
  const flatUsers = React.useMemo(
    () => [...roster].sort((a, b) => a.name.localeCompare(b.name)),
    [roster],
  )

  const nextHolidays = React.useMemo(() => {
    const iso = toISODate(today)
    return [...upcomingHolidays]
      .filter((h) => h.date >= iso)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingHolidays])

  // Pannello statistiche: un coordinatore "puro" (non staff/superuser) vede
  // solo la propria area; chi ha anche accesso full (staff/superuser) vede
  // tutte le aree, come chiunque non sia coordinatore.
  const userAreaMap = React.useMemo(() => {
    const m = new Map<number, number | null>()
    for (const u of roster) m.set(u.id, u.area_id)
    return m
  }, [roster])

  const statsScopedToOwnArea = canEditAll && !isFullAccess && currentUserAreaId != null
  const currentUserAreaLabel = React.useMemo(() => {
    if (!statsScopedToOwnArea) return null
    return roster.find((u) => u.area_id === currentUserAreaId)?.area_label ?? null
  }, [statsScopedToOwnArea, roster, currentUserAreaId])

  const absencesForPanel = React.useMemo(() => {
    if (!statsScopedToOwnArea) return absences
    return absences.filter((a) => userAreaMap.get(a.user) === currentUserAreaId)
  }, [absences, statsScopedToOwnArea, userAreaMap, currentUserAreaId])

  const pendingAbsencesForPanel = React.useMemo(() => {
    if (!statsScopedToOwnArea) return pendingAbsences
    return pendingAbsences.filter((a) => userAreaMap.get(a.user) === currentUserAreaId)
  }, [pendingAbsences, statsScopedToOwnArea, userAreaMap, currentUserAreaId])

  const canEditRow = React.useCallback((userId: number) => {
    if (canEditAll) return true
    return currentUserId === userId
  }, [canEditAll, currentUserId])

  const days = daysInMonth(year, month)
  const dayIndexMap = React.useMemo(() => {
    const m = new Map<string, number>()
    days.forEach((d, i) => m.set(toISODate(d), i))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  // Giorni bloccati (weekend + festività) calcolati PER AREA: una festività
  // può valere per tutte le aree o solo per alcune (patrono locale, ecc.).
  const blockedByArea = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    const areaIds = new Set<number | null>(roster.map((u) => u.area_id))
    areaIds.add(null)
    areaIds.forEach((areaId) => {
      const holMap = holidaysForArea(holidayRows, areaId)
      const s = new Set<string>()
      for (const d of days) {
        const iso = toISODate(d)
        if (isWeekend(d) || holMap.has(iso)) s.add(iso)
      }
      map.set(String(areaId), s)
    })
    return map
  }, [roster, holidayRows, days])

  const getBlockedSet = React.useCallback((areaId: number | null) => {
    return blockedByArea.get(String(areaId)) ?? new Set<string>()
  }, [blockedByArea])

  // Festività da mostrare in intestazione (qualunque area): informativo.
  const headerHolidays = React.useMemo(() => {
    const m = new Map<string, string[]>()
    for (const h of holidayRows) {
      const arr = m.get(h.date) ?? []
      arr.push(h.label)
      m.set(h.date, arr)
    }
    return m
  }, [holidayRows])

  // Colonna del giorno sotto hover, per l'evidenziazione trasversale a tutti
  // i tecnici (header + ogni riga).
  const [hoveredIso, setHoveredIso] = React.useState<string | null>(null)
  const hoveredDayIndex = hoveredIso != null ? dayIndexMap.get(hoveredIso) ?? null : null

  // Colonna del giorno odierno, evidenziata in modo permanente (solo quando
  // il mese/anno mostrato è quello corrente).
  const todayIso = toISODate(today)
  const todayDayIndex = (year === today.getFullYear() && month === today.getMonth())
    ? dayIndexMap.get(todayIso) ?? null
    : null

  // ── Drag: seleziona esattamente le fasce toccate (solo MAT, solo POM, o
  // entrambe se il trascinamento passa dall'una all'altra) su più giorni ────
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const draggingRef = React.useRef(false)
  const movedRef = React.useRef(false)
  const dragRef = React.useRef<DragState | null>(null)
  dragRef.current = drag

  const openCell = React.useCallback((u: RosterRow, iso: string, dayPart: DayPart, existing: AbsenceRow | null) => {
    setEditorTarget({ userId: u.id, userName: u.name, date: iso, dayPart, existing, canValidate: canEditAll, editableReason: canEditAll })
  }, [canEditAll])

  const openPendingFromSummary = React.useCallback((row: AbsenceRow) => {
    const u = roster.find((r) => r.id === row.user)
    if (!u) return
    openCell(u, row.date, row.day_part, row)
  }, [roster, openCell])

  const onCellDown = React.useCallback((u: RosterRow, iso: string, part: DayPart) => {
    draggingRef.current = true
    movedRef.current = false
    setDrag({
      userId: u.id, areaId: u.area_id, initialPart: part, from: iso, to: iso,
      touchedMattina: part === 'mattina', touchedPomeriggio: part === 'pomeriggio',
    })
  }, [])

  const onCellEnter = React.useCallback((u: RosterRow, iso: string, part: DayPart) => {
    if (!draggingRef.current) return
    movedRef.current = true
    setDrag((prev) => (prev && prev.userId === u.id ? {
      ...prev, to: iso,
      touchedMattina: prev.touchedMattina || part === 'mattina',
      touchedPomeriggio: prev.touchedPomeriggio || part === 'pomeriggio',
    } : prev))
  }, [])

  // Range di date (indice min→max), robusto anche se il mouse "salta" celle
  // durante un trascinamento veloce; esclude i giorni bloccati per l'area.
  const rangeDates = React.useCallback((d: DragState): string[] => {
    const i1 = dayIndexMap.get(d.from); const i2 = dayIndexMap.get(d.to)
    if (i1 == null || i2 == null) return []
    const [lo, hi] = i1 <= i2 ? [i1, i2] : [i2, i1]
    const blocked = getBlockedSet(d.areaId)
    const out: string[] = []
    for (let i = lo; i <= hi; i++) {
      const iso = toISODate(days[i])
      if (!blocked.has(iso)) out.push(iso)
    }
    return out
  }, [dayIndexMap, days, getBlockedSet])

  const isPartSelected = React.useCallback((userId: number, iso: string, part: DayPart) => {
    const d = drag
    if (!d || d.userId !== userId) return false
    if (part === 'mattina' && !d.touchedMattina) return false
    if (part === 'pomeriggio' && !d.touchedPomeriggio) return false
    const i = dayIndexMap.get(iso); const iF = dayIndexMap.get(d.from); const iT = dayIndexMap.get(d.to)
    if (i == null || iF == null || iT == null) return false
    const [lo, hi] = iF <= iT ? [iF, iT] : [iT, iF]
    if (i < lo || i > hi) return false
    return !getBlockedSet(d.areaId).has(iso)
  }, [drag, dayIndexMap, getBlockedSet])

  // fine drag: click semplice (nessun movimento) → editor mezza giornata;
  // trascinamento → editor bulk sulla/e fascia/e effettivamente toccata/e.
  React.useEffect(() => {
    const up = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const d = dragRef.current
      const moved = movedRef.current
      setDrag(null)
      if (!d) return
      const dates = rangeDates(d)
      const u = roster.find((r) => r.id === d.userId)
      if (!u || dates.length === 0) return

      if (!moved && dates.length === 1) {
        const iso = dates[0]
        const existing = index.get(cellKey(u.id, iso, d.initialPart)) ?? null
        openCell(u, iso, d.initialPart, existing)
        return
      }

      const bothTouched = d.touchedMattina && d.touchedPomeriggio
      const dayPart: BulkDayPart = bothTouched ? 'entrambe' : (d.touchedMattina ? 'mattina' : 'pomeriggio')
      setBulkTarget({ userId: u.id, userName: u.name, dayPart, dates, editableReason: canEditAll })
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [rangeDates, roster, index, openCell, canEditAll])

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  const goNext = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  const periodLabel = `${MONTH_LABELS_IT[month]} ${year}`
  const cellW = 26
  const cellH = 12

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, pt: { xs: 1, md: 1.25 }, userSelect: drag ? 'none' : 'auto' }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
        <Box sx={{ flexShrink: 0, minWidth: 0, maxWidth: '100%', width: { xs: '100%', lg: 'auto' } }}>
          {/* Card bianca — filtro mese + legenda. A destra (fuori dalla
              card): vista Team/Persona, Esporta (placeholder), Nuova
              richiesta. */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" rowGap={1}>
            <Paper variant="outlined" sx={{ px: 1.5, py: 0.75 }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" rowGap={1}>
                <IconButton size="small" onClick={goPrev}><ChevronLeftIcon /></IconButton>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{periodLabel}</Typography>
                <IconButton size="small" onClick={goNext}><ChevronRightIcon /></IconButton>
                <IconButton size="small" onClick={goToday} title="Oggi"><TodayIcon fontSize="small" /></IconButton>
                <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
                {LEGEND.map((l) => (
                  <Stack key={l.label} direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: l.swatch.bg, border: '1px solid', borderColor: l.swatch.fg }} />
                    <Typography variant="caption" color="text.secondary">{l.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* Toggle Team/Persona in stile "segmented pill": contenitore
                  grigio arrotondato, opzione attiva = pillola bianca con
                  ombra leggera — come nel mockup. */}
              <ToggleButtonGroup
                size="small" exclusive value={viewMode}
                onChange={(_, v) => { if (v) setViewMode(v) }}
                sx={{
                  bgcolor: 'action.hover', borderRadius: 999, p: '3px', gap: '3px',
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 0,
                    borderRadius: '999px !important',
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    px: 1.5,
                    py: 0.4,
                    minHeight: 0,
                    color: 'text.secondary',
                  },
                  '& .Mui-selected': {
                    bgcolor: 'background.paper !important',
                    color: 'text.primary',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  },
                }}
              >
                <ToggleButton value="team">Team</ToggleButton>
                <ToggleButton value="persona">Persona</ToggleButton>
              </ToggleButtonGroup>
              <Tooltip title="In arrivo" arrow>
                <span>
                  <Button
                    size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
                    disabled sx={{ fontSize: '0.72rem', py: 0.4, px: 1.25, minHeight: 0 }}
                  >
                    Esporta
                  </Button>
                </span>
              </Tooltip>
              <Button
                size="small" variant="contained" color="primary" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => setNewRequestOpen(true)}
                sx={{ fontSize: '0.72rem', py: 0.4, px: 1.25, minHeight: 0 }}
              >
                Nuova richiesta
              </Button>
            </Stack>
          </Stack>

          {/* Card bianca — SOLO il calendario (header giorni + righe). */}
          <Paper variant="outlined" sx={{ p: 2 }}>
          {loading && roster.length === 0 ? (
            <Stack alignItems="center" py={6}><CircularProgress size={22} /></Stack>
          ) : (
            <Box sx={{ overflowX: 'auto', pb: 1 }}>
              <Box sx={{ position: 'relative' }}>
                {/* Colonna di oggi: overlay verticale permanente (sotto al
                    fascio luminoso dell'hover), visibile solo quando il mese
                    mostrato è quello corrente. */}
                {todayDayIndex != null && (
                  <Box sx={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${192 + todayDayIndex * (cellW + 2)}px`, width: cellW,
                    bgcolor: alpha(theme.palette.primary.main, 0.09),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                    borderRadius: '4px', pointerEvents: 'none', zIndex: 0,
                  }} />
                )}
                {/* Fascio luminoso: un unico overlay verticale sopra l'intera
                    colonna (header + tutte le righe), invece di bordi sulle
                    singole celle. */}
                {hoveredDayIndex != null && (
                  <Box sx={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${192 + hoveredDayIndex * (cellW + 2)}px`, width: cellW,
                    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.20)} 0%, ${alpha(theme.palette.primary.main, 0.07)} 100%)`,
                    boxShadow: `0 0 12px 1px ${alpha(theme.palette.primary.main, 0.25)}`,
                    borderRadius: '4px', pointerEvents: 'none', zIndex: 1,
                  }} />
                )}
                <Box sx={{ display: 'flex', gap: '2px', pl: '192px', mb: '2px', position: 'relative', zIndex: 2 }}>
                  {days.map((d) => {
                    const iso = toISODate(d)
                    const labels = headerHolidays.get(iso)
                    const weekend = isWeekend(d)
                    const isToday = iso === todayIso
                    return (
                      <Tooltip key={iso} title={labels ? labels.join(', ') : ''} arrow disableHoverListener={!labels}>
                        <Box
                          onMouseEnter={() => setHoveredIso(iso)}
                          onMouseLeave={() => setHoveredIso(null)}
                          sx={{ width: cellW, textAlign: 'center' }}
                        >
                          <Typography sx={{
                            fontSize: '0.6rem', fontWeight: 700, lineHeight: 1.2,
                            color: (weekend || labels) ? 'error.main' : isToday ? 'primary.main' : 'text.secondary',
                          }}>
                            {d.getDate()}
                          </Typography>
                          <Typography sx={{
                            fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1.2,
                            color: (weekend || labels) ? 'error.main' : isToday ? 'primary.main' : 'text.disabled',
                          }}>
                            {WEEKDAY_SHORT_IT[d.getDay()]}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )
                  })}
                </Box>
                {viewMode === 'team' ? (
                  groups.map(([label, users]) => (
                    <AreaGroup
                      key={label}
                      areaLabel={label}
                      users={users} days={days} getBlockedSet={getBlockedSet} index={index}
                      canEditRow={canEditRow}
                      open={areaOpen[label] !== false}
                      onToggle={() => setAreaOpen((s) => ({ ...s, [label]: s[label] === false }))}
                      onCellDown={onCellDown} onCellEnter={onCellEnter} isPartSelected={isPartSelected}
                      onHoverDay={setHoveredIso}
                      cellW={cellW} cellH={cellH}
                      clientChipPalette={statusTokens.clientChipPalette}
                    />
                  ))
                ) : (
                  <FlatPersonList
                    users={flatUsers} days={days} getBlockedSet={getBlockedSet} index={index}
                    canEditRow={canEditRow}
                    onCellDown={onCellDown} onCellEnter={onCellEnter} isPartSelected={isPartSelected}
                    onHoverDay={setHoveredIso}
                    cellW={cellW} cellH={cellH}
                    clientChipPalette={statusTokens.clientChipPalette}
                  />
                )}
              </Box>
            </Box>
          )}
          </Paper>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'left' }}>
            Click = ½ giornata · trascina lungo MAT (o POM) = solo quella fascia su più giorni · trascina toccando entrambe = giornata intera
          </Typography>
        </Box>

        <Box sx={{ width: { xs: '100%', lg: 'auto' }, flex: { lg: '1 1 320px' }, minWidth: { lg: 300 }, maxWidth: { lg: 440 } }}>
          <SummaryPanel
            periodLabel={periodLabel} areaLabel={currentUserAreaLabel}
            absences={absencesForPanel} pendingAbsences={pendingAbsencesForPanel} roster={roster}
            canEditAll={canEditAll} onOpenPending={openPendingFromSummary}
            onGroupResolved={reloadAll}
          />
          {isCurrentMonth && (
            <TodayAbsencesCard absences={absences} clientChipPalette={statusTokens.clientChipPalette} />
          )}
          <UpcomingHolidaysCard holidays={nextHolidays} />
        </Box>
      </Stack>

      <CellEditorDialog target={editorTarget} onClose={() => setEditorTarget(null)} onSaved={reloadAll} />
      <BulkEditorDialog target={bulkTarget} onClose={() => setBulkTarget(null)} onSaved={reloadAll} />
      <NewRequestDialog
        open={newRequestOpen} onClose={() => setNewRequestOpen(false)}
        roster={roster} canEditAll={canEditAll} currentUserId={currentUserId}
        getBlockedSet={getBlockedSet}
        onNext={(target) => setBulkTarget(target)}
      />
    </Box>
  )
}

