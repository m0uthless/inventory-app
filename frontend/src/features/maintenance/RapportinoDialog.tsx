import * as React from 'react'
import { Box, Button, ButtonBase, Dialog, IconButton, MenuItem, Switch, TextField, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon } from '../../ui/campo'
import { FileIcon } from '../drive/DriveIcons'
import { ChoiceChips, FieldLabel } from '../contracts/ContractFormParts'
import { dShort } from '../contracts/contractModel'
import type { TodoRow } from '../../pages/maintenanceTypes'
import { dueStateOf, isoOf, nextDueAfter, rowKey, scheduleText, todayIso, type Result } from './mtModel'
import { fetchAll } from '../../api/fetchAll'

type Tech = { id: number; full_name: string }
type Props = {
  open: boolean
  /** Manutenzioni da registrare; vuoto = si scelgono dal cliente. */
  rows: TodoRow[]
  techs: Tech[]
  customers: { id: number; name: string }[]
  /** `issues.add_issue`: propone di aprire una issue per i KO. */
  canAddIssue: boolean
  onClose: () => void
  onSaved: () => void
}

const OUTCOMES: { value: Result; label: string; hint: string; tone: 'success' | 'warning' | 'error' | 'neutral'; icon: React.ReactNode }[] = [
  { value: 'ok', label: 'OK', hint: 'Eseguita, tutto regolare', tone: 'success', icon: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /> },
  { value: 'partial', label: 'Parziale', hint: 'Eseguita in parte', tone: 'warning', icon: <><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" /></> },
  { value: 'ko', label: 'KO', hint: 'Problemi da risolvere', tone: 'error', icon: <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /> },
  { value: 'not_planned', label: 'Non prevista', hint: 'Salta questo ciclo', tone: 'neutral', icon: <path d="M6 12h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /> },
]
const TECH_KEY = 'archie-rapportino-tech'
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoOf(d) }

/** Registra rapportino: un esito, data, tecnico, note e PDF per tutte le manutenzioni scelte. */
export default function RapportinoDialog({ open, rows, techs, customers, canAddIssue, onClose, onSaved }: Props) {
  const toast = useToast()
  const theme = useTheme()
  const narrow = useMediaQuery(theme.breakpoints.down('sm'))
  const [targets, setTargets] = React.useState<TodoRow[]>([])
  const [free, setFree] = React.useState(false)
  const [freeCustomer, setFreeCustomer] = React.useState<number | ''>('')
  const [freeRows, setFreeRows] = React.useState<TodoRow[]>([])
  const [res, setRes] = React.useState<Result>('ok')
  const [date, setDate] = React.useState(todayIso())
  const [tech, setTech] = React.useState<number | ''>('')
  const [notes, setNotes] = React.useState('')
  const [issue, setIssue] = React.useState(true)
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [errors, setErrors] = React.useState<{ notes?: boolean; tech?: boolean; targets?: boolean }>({})
  const [saving, setSaving] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    setTargets(rows); setFree(rows.length === 0); setFreeCustomer(''); setFreeRows([])
    setRes('ok'); setDate(todayIso()); setNotes(''); setIssue(true); setPdf(null); setErrors({})
    let saved: number | '' = ''
    try { const v = Number(localStorage.getItem(TECH_KEY)); if (v) saved = v } catch { /* niente */ }
    setTech(saved)
    // Reinizializza solo all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  React.useEffect(() => { if (open && tech === '' && techs.length === 1) setTech(techs[0].id) }, [open, tech, techs])

  React.useEffect(() => {
    if (!freeCustomer) { setFreeRows([]); return }
    fetchAll<TodoRow>('/maintenance-plans/todo/', { customer: freeCustomer })
      .then(setFreeRows).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [freeCustomer, toast])

  const needNote = res === 'ko' || res === 'partial'
  const np = res === 'not_planned'
  const overdue = targets.filter((r) => dueStateOf(r.next_due_date) === 'overdue').length
  const plans = [...new Map(targets.map((r) => [r.plan_id, r])).values()]

  const save = async () => {
    const e = { targets: !targets.length, notes: needNote && !notes.trim(), tech: !np && tech === '' }
    if (e.targets || e.notes || e.tech) { setErrors(e); return }
    setSaving(true)
    try { if (tech !== '') localStorage.setItem(TECH_KEY, String(tech)) } catch { /* niente */ }
    const results = await Promise.allSettled(targets.map((r) => {
      const fd = new FormData()
      fd.append('plan', String(r.plan_id)); fd.append('inventory', String(r.inventory_id))
      fd.append('performed_at', np ? todayIso() : date); fd.append('result', res)
      if (!np && tech !== '') fd.append('tech', String(tech))
      if (notes.trim()) fd.append('notes', notes.trim())
      if (!np && pdf) fd.append('pdf_file', pdf)
      return api.post('/maintenance-events/', fd)
    }))
    const failed = results.filter((x) => x.status === 'rejected')
    const ok = results.length - failed.length
    let issues = 0
    if (res === 'ko' && issue && canAddIssue) {
      const done = targets.filter((_, i) => results[i].status === 'fulfilled')
      const out = await Promise.allSettled(done.map((r) => api.post('/issues/', {
        title: `KO manutenzione: ${r.plan_title} — ${r.inventory_name}`,
        description: notes.trim(), customer: r.customer_id, site: r.site_id ?? null, inventory: r.inventory_id,
      })))
      issues = out.filter((x) => x.status === 'fulfilled').length
      if (issues < out.length) toast.warning('Rapportini registrati, ma alcune issue non sono state aperte.')
    }
    setSaving(false)
    if (failed.length) {
      toast.error(`${ok} registrati, ${failed.length} non salvati: ${apiErrorToMessage((failed[0] as PromiseRejectedResult).reason)}`)
      if (!ok) return
    } else {
      toast.success(`${np ? (ok === 1 ? 'Segnata come non prevista' : `${ok} segnate come non previste`) : ok === 1 ? 'Rapportino registrato' : `${ok} rapportini registrati`}${issues ? ` · ${issues} issue aperte` : ''}`)
    }
    onSaved(); onClose()
  }

  const nextNote = (() => {
    if (!targets.length) return null
    if (np) return <>Non prevista: la manutenzione esce dalle scadenze di questo ciclo. Prossima: <b>{dShort(nextDueAfter(plans[0], plans[0].next_due_date))}</b>.</>
    if (plans.length === 1) return <>Dopo la registrazione la prossima scadenza sarà il <b>{dShort(nextDueAfter(plans[0], plans[0].next_due_date))}</b> ({scheduleText(plans[0]).toLowerCase()}).</>
    return <>Le prossime scadenze si ricalcolano per piano: {plans.map((p, i) => <React.Fragment key={p.plan_id}>{i ? ' · ' : ''}{p.plan_title} → <b>{dShort(nextDueAfter(p, p.next_due_date))}</b></React.Fragment>)}.</>
  })()

  const toggleTarget = (r: TodoRow) => setTargets((cur) => (cur.some((x) => rowKey(x) === rowKey(r)) ? cur.filter((x) => rowKey(x) !== rowKey(r)) : [...cur, r]))

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen={narrow} aria-labelledby="rp-title"
      slotProps={{ paper: { sx: { width: 580, maxWidth: narrow ? '100vw' : 'calc(100vw - 32px)', maxHeight: narrow ? '100vh' : 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: narrow ? 0 : '12px' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '16px 18px 12px', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" id="rp-title" sx={{ fontSize: 16, fontWeight: 650 }}>Registra rapportino</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{targets.length > 1 ? 'Stesso esito, data e tecnico per tutte le manutenzioni selezionate.' : "Esito dell'intervento e rapportino firmato."}</Typography>
        </Box>
        <IconButton size="small" aria-label="Chiudi" onClick={onClose} disabled={saving} sx={{ mt: -0.5, mr: -0.75 }}><CampoIcon name="x" size={16} /></IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: '16px 18px 18px', display: 'grid', gap: 1.75, alignContent: 'start' }}>
        {free ? (
          <>
            <Box>
              <FieldLabel htmlFor="rp-cust">Cliente</FieldLabel>
              <TextField id="rp-cust" select size="small" fullWidth value={freeCustomer} onChange={(e) => { setFreeCustomer(e.target.value === '' ? '' : Number(e.target.value)); setTargets([]) }}
                slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Scegli il cliente…</MenuItem>
                {customers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Box>
            {freeCustomer ? (
              <Box>
                <FieldLabel>Manutenzioni da registrare</FieldLabel>
                {freeRows.length ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {freeRows.map((r) => { const on = targets.some((x) => rowKey(x) === rowKey(r)); return (
                      <ButtonBase key={rowKey(r)} onClick={() => toggleTarget(r)} aria-pressed={on} sx={{
                        height: 30, px: 1.25, gap: 0.75, borderRadius: '6px', fontSize: 12.5, fontWeight: 550, border: '1px solid',
                        borderColor: on ? 'archie.fieldLine' : 'divider', bgcolor: on ? 'archie.field' : 'background.paper', color: on ? 'primary.main' : 'text.secondary',
                        '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                      }}>{on ? <CheckIcon sx={{ fontSize: 14 }} /> : null}{r.inventory_name}<Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>· {r.plan_title}</Box></ButtonBase>
                    ) })}
                  </Box>
                ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna manutenzione da fare per questo cliente.</Typography>}
                {errors.targets ? <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'error.main' }}>Scegli almeno una manutenzione.</Typography> : null}
              </Box>
            ) : null}
          </>
        ) : (
          <Box sx={{ p: '8px 10px', borderRadius: '8px', bgcolor: 'archie.surface2', border: '1px solid', borderColor: 'divider', display: 'grid', gap: 0.5, fontSize: 12 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography component="b" sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{targets.length === 1 ? targets[0].inventory_name : `${targets.length} manutenzioni`}</Typography>
              {overdue ? <Box component="span" sx={{ fontSize: 12, fontWeight: 600, px: 1, borderRadius: '5px', lineHeight: '22px', bgcolor: 'error.light', color: 'error.main' }}>{overdue} scadut{overdue === 1 ? 'a' : 'e'}</Box> : null}
            </Box>
            <Box sx={{ color: 'text.secondary' }}>{[...new Set(targets.map((r) => r.customer_name))].join(', ')} · {plans.map((p) => p.plan_title).join(', ')}</Box>
            {targets.length > 1 ? (
              <Box component="ul" sx={{ m: '2px 0 0', p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {targets.map((r) => <Box component="li" key={rowKey(r)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '5px', px: 0.75, lineHeight: '20px', fontSize: 11.5 }}>{r.inventory_name}</Box>)}
              </Box>
            ) : null}
          </Box>
        )}

        <Box>
          <FieldLabel>Esito</FieldLabel>
          <Box role="radiogroup" aria-label="Esito" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0,1fr))' }, gap: 1 }}>
            {OUTCOMES.map((o) => {
              const on = res === o.value
              const main = o.tone === 'neutral' ? 'text.secondary' : `${o.tone}.main`
              return (
                <ButtonBase key={o.value} role="radio" aria-checked={on} onClick={() => setRes(o.value)} sx={{
                  display: 'grid', justifyItems: 'center', gap: 0.5, p: '10px 6px', borderRadius: '10px', border: '1px solid',
                  borderColor: on ? main : 'divider', bgcolor: on ? (o.tone === 'neutral' ? 'archie.neutralBg' : `${o.tone}.light`) : 'background.paper',
                  boxShadow: (t) => (on ? `inset 0 0 0 1px ${o.tone === 'neutral' ? t.palette.text.secondary : t.palette[o.tone].main}` : 'none'),
                  '&:hover': { borderColor: on ? main : 'archie.borderStrong' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: on ? main : 'archie.neutralBg', color: on ? 'common.white' : 'text.secondary' }}>
                    <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: 16, height: 16 }}>{o.icon}</Box>
                  </Box>
                  <Box component="b" sx={{ fontSize: 13, fontWeight: 600 }}>{o.label}</Box>
                  <Box component="small" sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center', lineHeight: 1.25 }}>{o.hint}</Box>
                </ButtonBase>
              )
            })}
          </Box>
        </Box>

        {np ? null : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, gap: 1.25, alignItems: 'end' }}>
              <Box>
                <FieldLabel>Data dell'intervento</FieldLabel>
                <ChoiceChips label="Data dell'intervento" value={date === todayIso() ? 'oggi' : date === yesterday() ? 'ieri' : null}
                  onChange={(v) => setDate(v === 'oggi' ? todayIso() : yesterday())} options={[{ value: 'oggi', label: 'Oggi' }, { value: 'ieri', label: 'Ieri' }]} />
              </Box>
              <TextField type="date" size="small" fullWidth value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ htmlInput: { 'aria-label': "Data dell'intervento", max: todayIso() } }} />
            </Box>
            <Box>
              <FieldLabel required htmlFor="rp-tech">Tecnico</FieldLabel>
              <TextField id="rp-tech" select size="small" fullWidth value={tech} error={errors.tech} onChange={(e) => { setTech(e.target.value === '' ? '' : Number(e.target.value)); setErrors((x) => ({ ...x, tech: false })) }}
                slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Scegli il tecnico…</MenuItem>
                {techs.map((t) => <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>)}
              </TextField>
              {errors.tech ? <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'error.main' }}>Indica il tecnico.</Typography> : null}
            </Box>
          </>
        )}

        <Box>
          <FieldLabel required={needNote} optional={!needNote} htmlFor="rp-notes">Note</FieldLabel>
          <TextField id="rp-notes" size="small" fullWidth multiline minRows={3} value={notes} error={errors.notes}
            onChange={(e) => { setNotes(e.target.value); setErrors((x) => ({ ...x, notes: false })) }}
            placeholder={needNote ? 'Cosa resta da fare? Ricambi ordinati, prossimo passaggio…' : "Osservazioni sull'intervento"} />
          {errors.notes ? <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'error.main' }}>Per KO e parziale scrivi cosa resta da fare.</Typography> : null}
        </Box>

        {res === 'ko' && canAddIssue ? (
          <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', width: 'fit-content' }}>
            <Switch size="small" checked={issue} onChange={(e) => setIssue(e.target.checked)} />
            <Box>
              <Typography sx={{ fontSize: 13 }}>Apri una issue per il problema</Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Collegata {targets.length > 1 ? 'agli inventari' : "all'inventario"}, così il ripasso non si perde</Typography>
            </Box>
          </Box>
        ) : null}

        {np ? null : (
          <Box>
            <FieldLabel optional>PDF del rapportino firmato</FieldLabel>
            <ButtonBase onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setPdf(f) }}
              sx={{
                width: '100%', justifyContent: 'flex-start', gap: 1.25, p: '9px 12px', borderRadius: '8px', textAlign: 'left',
                border: '1px', borderStyle: pdf ? 'solid' : 'dashed', borderColor: pdf ? 'divider' : 'archie.borderStrong', color: 'text.secondary', fontSize: 12.5,
                '&:hover': { borderColor: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>
              {pdf ? <FileIcon kind="pdf" size={26} /> : <CampoIcon name="upload" size={16} />}
              <span>{pdf ? <><Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{pdf.name}</Box> · clic per cambiarlo</> : <><Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>Trascina qui il PDF</Box> o sfoglia · si può allegare anche dopo</>}</span>
            </ButtonBase>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPdf(f) }} />
          </Box>
        )}

        {nextNote ? <Box sx={{ fontSize: 12, color: 'text.secondary', p: '8px 10px', borderRadius: '8px', bgcolor: np ? 'warning.light' : 'archie.field', '& b': { color: np ? 'warning.main' : 'primary.main', fontWeight: 650 } }}>{nextNote}</Box> : null}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '12px 18px', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{targets.length > 1 ? `${targets.length} rapportini` : ''}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button variant="contained" startIcon={<CheckIcon />} disabled={saving || !targets.length} onClick={() => void save()}>
          {saving ? 'Salvataggio…' : np ? 'Segna non prevista' : targets.length > 1 ? `Registra ${targets.length} rapportini` : 'Registra'}
        </Button>
      </Box>
    </Dialog>
  )
}
