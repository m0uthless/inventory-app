import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { CampoIcon } from '../../ui/campo'
import type { AbsenceReason, RosterRow } from './pianoFerieShared'
import {
  PART_LABEL, REASON_LABEL, ddmm, gg, rangeLabel, swatchKey, wdShort, workDates,
  type HalfCell, type OffCalendar, type PfPart, type PfRequest,
} from './pfModel'
import { Ava, NameSub, Swatch } from './pfUi'

export type PfDialogTarget =
  | { kind: 'new'; userId: number | null; from: string; to: string; part: PfPart }
  | { kind: 'edit'; req: PfRequest }

type Props = {
  target: PfDialogTarget | null
  roster: RosterRow[]
  canEditAll: boolean
  currentUserId: number | null
  cal: OffCalendar
  cells: Map<string, HalfCell>
  onClose: () => void
  onSaved: (message: string) => void
}

const REASONS: AbsenceReason[] = ['ferie', 'malattia', 'permesso_104', 'training', 'trasferta', 'altro']
const PARTS: Exclude<PfPart, 'mixed'>[] = ['all', 'mat', 'pom']
const PART_API = { all: 'entrambe', mat: 'mattina', pom: 'pomeriggio' } as const

/** Dialogo Nuova richiesta / Modifica (anteprima pf-base): persona, date, fascia, motivo a tessere, nota e riepilogo dei giorni lavorativi. */
export default function PfRequestDialog({ target, roster, canEditAll, currentUserId, cal, cells, onClose, onSaved }: Props) {
  const [userId, setUserId] = React.useState<number | ''>('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [part, setPart] = React.useState<Exclude<PfPart, 'mixed'>>('all')
  const [reason, setReason] = React.useState<AbsenceReason>('ferie')
  const [note, setNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!target) return
    setError(''); setSaving(false)
    if (target.kind === 'edit') {
      const r = target.req
      setUserId(r.user); setFrom(r.from); setTo(r.to); setPart(r.part === 'mixed' ? 'all' : r.part); setReason(r.reason); setNote(r.note)
    } else {
      setUserId(target.userId ?? (canEditAll ? '' : currentUserId ?? '')); setFrom(target.from); setTo(target.to)
      setPart(target.part === 'mixed' ? 'all' : target.part); setReason('ferie'); setNote('')
    }
  }, [target, canEditAll, currentUserId])

  const editing = target?.kind === 'edit' ? target.req : null
  const person = roster.find((p) => p.id === userId) ?? null
  const dates = person ? workDates(from, to, person.area_id, cal) : []
  const n = dates.length * (part === 'all' ? 1 : 0.5)
  const valid = Boolean(person && from && to && to >= from && dates.length)
  // Mezze giornate già segnate (di altre richieste) che verrebbero sovrascritte.
  const overlap = person ? dates.reduce((acc, d) => {
    const c = cells.get(`${person.id}|${d}`)
    const hits = [part !== 'pom' ? c?.mat : null, part !== 'mat' ? c?.pom : null]
      .filter((x) => x && x.status !== 'rifiutata' && !editing?.ids.includes(x.id))
    return acc + hits.length
  }, 0) : 0
  const reasons = canEditAll ? REASONS : (['ferie'] as AbsenceReason[])
  const sorted = React.useMemo(() => [...roster].sort((a, b) => (a.area_sort - b.area_sort) || a.name.localeCompare(b.name)), [roster])

  const save = async () => {
    if (!valid || !person) return
    setSaving(true); setError('')
    try {
      const status = !canEditAll ? 'proposta' : editing ? editing.status : 'validata'
      await api.post('/absences/bulk/', { user: person.id, day_part: PART_API[part], dates, action: 'set', reason: canEditAll ? reason : 'ferie', status, note: note.trim() })
      if (editing) {
        const keep = new Set(dates.flatMap((d) => (part === 'all' ? ['mattina', 'pomeriggio'] : [part === 'mat' ? 'mattina' : 'pomeriggio']).map((p) => `${person.id}|${d}|${p}`)))
        const stale = editing.rows.filter((r) => !keep.has(`${r.user}|${r.date}|${r.day_part}`))
        await Promise.all(stale.map((r) => api.delete(`/absences/${r.id}/`)))
      }
      onSaved(editing ? 'Richiesta modificata' : canEditAll ? `Inserita · ${person.name}, ${rangeLabel(from, to)}` : 'Richiesta inviata')
    } catch (e) {
      setError(apiErrorToMessage(e))
      setSaving(false)
    }
  }

  const summary = !from || !to || to < from
    ? <Sum err icon="alert">La data di fine viene prima di quella di inizio</Sum>
    : !person ? <Sum err icon="alert">Scegli la persona</Sum>
      : !dates.length ? <Sum err icon="alert">Nel periodo non ci sono giorni lavorativi</Sum>
        : (
          <Sum icon="calendar">
            <b>{gg(n)} lavorativ{n === 1 ? 'o' : 'i'}</b>
            {from === to ? `${wdShort(from)} ${ddmm(from)}` : `da ${wdShort(from)} ${ddmm(from)} a ${wdShort(to)} ${ddmm(to)}`}
            {part !== 'all' ? ` · ${PART_LABEL[part]}` : ''}
            {overlap ? <Box component="span" sx={{ flexBasis: '100%', fontSize: 12, color: 'warning.main', fontWeight: 550 }}>Sostituisce {overlap} mezz{overlap === 1 ? 'a giornata già segnata' : 'e giornate già segnate'}</Box> : null}
          </Sum>
        )

  const sub = editing ? 'Le modifiche sostituiscono la richiesta attuale.'
    : canEditAll ? 'Inserita dal coordinatore: è già validata.' : 'Resta proposta finché il coordinatore non la autorizza.'

  return (
    <Dialog open={Boolean(target)} onClose={saving ? undefined : onClose} fullWidth maxWidth={false} PaperProps={{ sx: { width: 'min(520px, calc(100% - 32px))', m: 2 } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        {editing ? 'Modifica richiesta' : 'Nuova richiesta'}
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>{sub}</Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.75, pt: '12px !important' }}>
        {canEditAll ? (
          <TextField select size="small" label="Persona" value={userId} onChange={(e) => setUserId(Number(e.target.value))} disabled={Boolean(editing)}>
            {sorted.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}{p.area_label ? ` · ${p.area_label}` : ''}</MenuItem>)}
          </TextField>
        ) : person ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px', borderRadius: '8px', bgcolor: 'archie.surface2' }}>
            <Ava name={person.name} size={30} /><NameSub name={person.name} sub={person.area_label ?? 'Senza area'} />
          </Box>
        ) : null}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
          <TextField size="small" type="date" label="Dal" value={from} InputLabelProps={{ shrink: true }}
            onChange={(e) => { const v = e.target.value; setFrom(v); if (to && v > to) setTo(v) }} />
          <TextField size="small" type="date" label="Al" value={to} InputLabelProps={{ shrink: true }} onChange={(e) => setTo(e.target.value)} />
        </Box>
        <Field label="Fascia">
          <Box role="radiogroup" aria-label="Fascia" sx={{ display: 'flex', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '7px', bgcolor: 'archie.surface2' }}>
            {PARTS.map((k) => {
              const on = k === part
              return (
                <ButtonBase key={k} role="radio" aria-checked={on} onClick={() => setPart(k)} sx={{
                  flex: 1, height: 28, borderRadius: '5px', fontSize: 12, fontWeight: 550, color: on ? 'text.primary' : 'text.secondary',
                  bgcolor: on ? 'background.paper' : 'transparent', boxShadow: on ? (t) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` : 'none',
                  '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>{PART_LABEL[k][0].toUpperCase() + PART_LABEL[k].slice(1)}</ButtonBase>
              )
            })}
          </Box>
        </Field>
        <Field label="Motivo">
          <Box role="radiogroup" aria-label="Motivo" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 0.75 }}>
            {reasons.map((k) => {
              const on = k === reason
              return (
                <ButtonBase key={k} role="radio" aria-checked={on} onClick={() => setReason(k)} sx={{
                  justifyContent: 'flex-start', gap: 1, height: 36, px: 1.25, minWidth: 0, border: '1px solid', borderRadius: '8px', fontSize: 13,
                  borderColor: on ? 'archie.fieldLine' : 'divider', bgcolor: on ? 'archie.field' : 'background.paper', fontWeight: on ? 600 : 400,
                  boxShadow: on ? (t) => `inset 0 0 0 1px ${t.palette.archie.fieldLine}` : 'none',
                  '&:hover': { borderColor: on ? 'archie.fieldLine' : 'archie.borderStrong' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                  <Swatch k={swatchKey(k, canEditAll ? 'validata' : 'proposta')} />
                  <Box component="span" sx={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{REASON_LABEL[k]}</Box>
                </ButtonBase>
              )
            })}
          </Box>
        </Field>
        <TextField size="small" label="Nota (facoltativa)" placeholder="es. viaggio, visita medica" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 255 }} />
        <Box sx={{ minHeight: 36 }}>{summary}</Box>
        {error ? <Typography role="alert" sx={{ fontSize: 13, color: 'error.main' }}>{error}</Typography> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Box component="span" sx={{ mr: 'auto', display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: 0.75, fontSize: 11, color: 'text.secondary' }}>
          <CampoIcon name="lock" size={12} />Weekend e festività dell'area non contano
        </Box>
        <Button onClick={onClose} disabled={saving} color="inherit">Annulla</Button>
        <Button variant="contained" onClick={() => void save()} disabled={!valid || saving} startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}>
          {editing ? 'Salva' : canEditAll ? 'Inserisci' : 'Invia richiesta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography component="span" sx={{ display: 'block', fontSize: 12, fontWeight: 550, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      {children}
    </Box>
  )
}

function Sum({ err, icon, children }: { err?: boolean; icon: 'alert' | 'calendar'; children: React.ReactNode }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', p: '9px 12px', borderRadius: '8px', fontSize: 13,
      bgcolor: err ? 'warning.light' : 'archie.field', color: err ? 'warning.main' : 'text.primary', fontWeight: err ? 550 : 400,
      '& b': { fontWeight: 650 }, '& > svg': { color: err ? 'warning.main' : 'primary.main', flex: 'none' },
    }}>
      <CampoIcon name={icon} size={15} />{children}
    </Box>
  )
}
