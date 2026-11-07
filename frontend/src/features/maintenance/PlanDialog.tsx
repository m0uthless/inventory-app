import * as React from 'react'
import { Autocomplete, Box, Button, Dialog, IconButton, MenuItem, Switch, TextField, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

import { api } from '@shared/api/client'
import { apiErrorToFieldErrors, apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import { CampoIcon } from '../../ui/campo'
import { ChoiceChips, FieldLabel } from '../contracts/ContractFormParts'
import type { PlanRow } from '../../pages/maintenanceTypes'
import { scheduleText } from './mtModel'

type Customer = { id: number; name: string; display_name?: string | null }
type Lookup = { id: number; label: string; is_hw?: boolean }
type Form = {
  customer: number | null
  inventory_types: number[]
  title: string
  schedule_type: 'interval' | 'fixed_date'
  interval_value: number | ''
  interval_unit: 'days' | 'weeks' | 'months' | 'years'
  fixed_month: number | ''
  fixed_day: number | ''
  next_due_date: string
  auto: boolean
  alert_days_before: number | ''
  is_active: boolean
  notes: string
  custom_fields: Record<string, unknown>
}
type Props = { open: boolean; plan: PlanRow | null; customers: Customer[]; onClose: () => void; onSaved: (id: number) => void }

const EMPTY: Form = { customer: null, inventory_types: [], title: '', schedule_type: 'interval', interval_value: 1, interval_unit: 'years', fixed_month: '', fixed_day: '', next_due_date: '', auto: true, alert_days_before: 14, is_active: true, notes: '', custom_fields: {} }
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const UNITS: { value: Form['interval_unit']; label: string }[] = [{ value: 'days', label: 'giorni' }, { value: 'weeks', label: 'settimane' }, { value: 'months', label: 'mesi' }, { value: 'years', label: 'anni' }]
const err = (t?: string) => (t ? <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'error.main' }}>{t}</Typography> : null)

function fromPlan(p: PlanRow): Form {
  return {
    customer: p.customer, inventory_types: p.inventory_types ?? [], title: p.title ?? '',
    schedule_type: p.schedule_type === 'fixed_date' ? 'fixed_date' : 'interval',
    interval_value: p.interval_value ?? '', interval_unit: (p.interval_unit as Form['interval_unit']) ?? 'months',
    fixed_month: p.fixed_month ?? '', fixed_day: p.fixed_day ?? '', next_due_date: p.next_due_date ?? '', auto: false,
    alert_days_before: p.alert_days_before ?? 14, is_active: p.is_active ?? true, notes: p.notes ?? '',
    custom_fields: (p.custom_fields as Record<string, unknown>) ?? {},
  }
}

/** Crea o modifica un piano di manutenzione (stile "Campo sterile"). */
export default function PlanDialog({ open, plan, customers, onClose, onSaved }: Props) {
  const toast = useToast()
  const theme = useTheme()
  const narrow = useMediaQuery(theme.breakpoints.down('sm'))
  const [f, setF] = React.useState<Form>(EMPTY)
  const [types, setTypes] = React.useState<Lookup[]>([])
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [computing, setComputing] = React.useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: '' } : e)) }

  React.useEffect(() => {
    if (!open) return
    setF(plan ? fromPlan(plan) : EMPTY); setErrors({})
    // Tutti i tipi: si propongono quelli hardware, ma restano visibili quelli già nel piano.
    api.get('/inventory-types/', { params: { ordering: 'label', page_size: 500 } })
      .then((r) => setTypes(Array.isArray(r.data) ? r.data : (r.data?.results ?? []))).catch(() => {})
  }, [open, plan])

  // Prossima scadenza calcolata dal backend sulla base della cadenza.
  const schedKey = `${f.schedule_type}|${f.interval_value}|${f.interval_unit}|${f.fixed_month}|${f.fixed_day}`
  React.useEffect(() => {
    if (!open || !f.auto) return
    const params: Record<string, unknown> = { schedule_type: f.schedule_type }
    if (f.schedule_type === 'interval') { if (!f.interval_value) return; params.interval_value = f.interval_value; params.interval_unit = f.interval_unit }
    else { if (!f.fixed_month || !f.fixed_day) return; params.fixed_month = f.fixed_month; params.fixed_day = f.fixed_day }
    let alive = true
    setComputing(true)
    api.get<{ next_due_date: string }>('/maintenance-plans/compute-due-date/', { params })
      .then((r) => { if (alive && r.data.next_due_date) setF((x) => ({ ...x, next_due_date: r.data.next_due_date })) })
      .catch(() => {}).finally(() => setComputing(false))
    return () => { alive = false; setComputing(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedKey, f.auto, open])

  const save = async () => {
    const e: Record<string, string> = {}
    if (!f.customer) e.customer = 'Scegli il cliente.'
    if (!f.title.trim()) e.title = 'Serve un titolo.'
    if (!f.inventory_types.length) e.inventory_types = 'Scegli almeno un tipo di inventario.'
    if (f.schedule_type === 'interval' && !f.interval_value) e.interval_value = 'Indica ogni quanto.'
    if (f.schedule_type === 'fixed_date' && (!f.fixed_month || !f.fixed_day)) e.fixed_day = 'Indica giorno e mese.'
    if (!f.next_due_date) e.next_due_date = 'Indica la prossima scadenza.'
    if (Object.keys(e).length) { setErrors(e); return }
    const payload = {
      customer: f.customer, inventory_types: f.inventory_types, title: f.title.trim(), schedule_type: f.schedule_type,
      interval_value: f.schedule_type === 'interval' ? Number(f.interval_value) || null : null,
      interval_unit: f.schedule_type === 'interval' ? f.interval_unit : null,
      fixed_month: f.schedule_type === 'fixed_date' ? Number(f.fixed_month) || null : null,
      fixed_day: f.schedule_type === 'fixed_date' ? Number(f.fixed_day) || null : null,
      next_due_date: f.next_due_date, alert_days_before: Number(f.alert_days_before) || 14, is_active: f.is_active,
      notes: f.notes.trim() || null, custom_fields: Object.keys(f.custom_fields).length ? f.custom_fields : null,
    }
    setSaving(true)
    try {
      const r = plan ? await api.patch<PlanRow>(`/maintenance-plans/${plan.id}/`, payload) : await api.post<PlanRow>('/maintenance-plans/', payload)
      toast.success(plan ? 'Piano aggiornato' : 'Piano creato')
      onSaved(r.data.id)
    } catch (ex) {
      const fe = apiErrorToFieldErrors(ex)
      if (Object.keys(fe).length) { setErrors(fe); toast.error(fe._error || 'Controlla i campi.') } else toast.error(apiErrorToMessage(ex))
    } finally { setSaving(false) }
  }

  const custLabel = (c: Customer) => c.display_name || c.name
  const preview = f.schedule_type === 'interval' ? (f.interval_value ? scheduleText({ schedule_type: 'interval', interval_value: Number(f.interval_value), interval_unit: f.interval_unit }) : '') : f.fixed_day && f.fixed_month ? scheduleText({ schedule_type: 'fixed_date', fixed_month: Number(f.fixed_month), fixed_day: Number(f.fixed_day) }) : ''

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen={narrow} aria-labelledby="pl-title"
      slotProps={{ paper: { sx: { width: 640, maxWidth: narrow ? '100vw' : 'calc(100vw - 32px)', maxHeight: narrow ? '100vh' : 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: narrow ? 0 : '12px' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '16px 18px 12px', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1 }}>
          <Typography component="h2" id="pl-title" sx={{ fontSize: 16, fontWeight: 650 }}>{plan ? 'Modifica piano' : 'Nuovo piano'}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>Il piano copre tutti gli inventari attivi del cliente dei tipi scelti.</Typography>
        </Box>
        <IconButton size="small" aria-label="Chiudi" onClick={onClose} disabled={saving} sx={{ mt: -0.5, mr: -0.75 }}><CampoIcon name="x" size={16} /></IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: '16px 18px 18px', display: 'grid', gap: 1.75, alignContent: 'start' }}>
        <Box>
          <FieldLabel required htmlFor="pl-cust">Cliente</FieldLabel>
          <Autocomplete id="pl-cust" size="small" options={customers} value={customers.find((c) => c.id === f.customer) ?? null}
            onChange={(_e, c) => set('customer', c?.id ?? null)} getOptionLabel={custLabel} isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="Nessun cliente"
            renderInput={(p) => <TextField {...p} placeholder="Cerca il cliente…" error={Boolean(errors.customer)} />} />
          {err(errors.customer)}
        </Box>
        <Box>
          <FieldLabel required htmlFor="pl-title-in">Titolo</FieldLabel>
          <TextField id="pl-title-in" size="small" fullWidth value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="es. Verifica sicurezza elettrica" error={Boolean(errors.title)} />
          {err(errors.title)}
        </Box>
        <Box>
          <FieldLabel required htmlFor="pl-types">Tipi di inventario coperti</FieldLabel>
          <Autocomplete id="pl-types" multiple size="small" options={types.filter((t) => t.is_hw || f.inventory_types.includes(t.id))} value={types.filter((t) => f.inventory_types.includes(t.id))}
            onChange={(_e, v) => set('inventory_types', v.map((t) => t.id))} getOptionLabel={(t) => t.label} isOptionEqualToValue={(a, b) => a.id === b.id} disableCloseOnSelect
            renderInput={(p) => <TextField {...p} placeholder={f.inventory_types.length ? '' : 'Workstation, Storage, PACS…'} error={Boolean(errors.inventory_types)} />} />
          {err(errors.inventory_types)}
        </Box>

        <Box>
          <FieldLabel>Cadenza</FieldLabel>
          <ChoiceChips label="Cadenza" value={f.schedule_type} onChange={(v) => set('schedule_type', v)}
            options={[{ value: 'interval', label: 'A intervallo', icon: <CampoIcon name="restore" size={13} /> }, { value: 'fixed_date', label: 'A data fissa', icon: <CampoIcon name="calendar" size={13} /> }]} />
        </Box>
        {f.schedule_type === 'interval' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1.25, alignItems: 'start' }}>
            <Box>
              <FieldLabel required htmlFor="pl-every">Ogni</FieldLabel>
              <TextField id="pl-every" size="small" type="number" fullWidth value={f.interval_value} onChange={(e) => set('interval_value', e.target.value === '' ? '' : Number(e.target.value))} slotProps={{ htmlInput: { min: 1 } }} error={Boolean(errors.interval_value)} />
            </Box>
            <Box>
              <FieldLabel htmlFor="pl-unit">Unità</FieldLabel>
              <TextField id="pl-unit" select size="small" fullWidth value={f.interval_unit} onChange={(e) => set('interval_unit', e.target.value as Form['interval_unit'])}>
                {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
              </TextField>
            </Box>
            {err(errors.interval_value)}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1.25, alignItems: 'start' }}>
            <Box>
              <FieldLabel required htmlFor="pl-day">Giorno</FieldLabel>
              <TextField id="pl-day" size="small" type="number" fullWidth value={f.fixed_day} onChange={(e) => set('fixed_day', e.target.value === '' ? '' : Number(e.target.value))} slotProps={{ htmlInput: { min: 1, max: 31 } }} error={Boolean(errors.fixed_day)} />
            </Box>
            <Box>
              <FieldLabel required htmlFor="pl-month">Mese</FieldLabel>
              <TextField id="pl-month" select size="small" fullWidth value={f.fixed_month} onChange={(e) => set('fixed_month', Number(e.target.value))} error={Boolean(errors.fixed_day)} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Scegli il mese…</MenuItem>
                {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
              </TextField>
            </Box>
            {err(errors.fixed_day)}
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, alignItems: 'start' }}>
          <Box>
            <FieldLabel required htmlFor="pl-due">Prossima scadenza</FieldLabel>
            <TextField id="pl-due" size="small" type="date" fullWidth value={f.next_due_date} disabled={f.auto && computing}
              onChange={(e) => setF((x) => ({ ...x, next_due_date: e.target.value, auto: false }))} error={Boolean(errors.next_due_date)} />
            {errors.next_due_date ? err(errors.next_due_date) : <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'text.secondary' }}>{f.auto ? `Calcolata dalla cadenza${preview ? ` (${preview.toLowerCase()})` : ''}` : 'Scelta a mano'}</Typography>}
          </Box>
          <Box>
            <FieldLabel htmlFor="pl-alert">Avviso</FieldLabel>
            <TextField id="pl-alert" size="small" type="number" fullWidth value={f.alert_days_before} onChange={(e) => set('alert_days_before', e.target.value === '' ? '' : Number(e.target.value))}
              slotProps={{ htmlInput: { min: 0 }, input: { endAdornment: <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>giorni prima</Typography> } }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
            <Switch size="small" checked={f.auto} onChange={(e) => setF((x) => ({ ...x, auto: e.target.checked }))} />
            <Typography sx={{ fontSize: 13 }}>Calcola la scadenza dalla cadenza</Typography>
          </Box>
          <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
            <Switch size="small" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <Typography sx={{ fontSize: 13 }}>Piano attivo</Typography>
          </Box>
        </Box>
        <Box>
          <FieldLabel optional htmlFor="pl-notes">Note</FieldLabel>
          <TextField id="pl-notes" size="small" fullWidth multiline minRows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Box>
        <CustomFieldsEditor entity="maintenance_plan" value={f.custom_fields as Record<string, never>} onChange={(v) => set('custom_fields', v)}
          errors={Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith('custom_fields.')).map(([k, v]) => [k.slice('custom_fields.'.length), v]))}
          formError={errors.custom_fields}
          onClearFieldError={(key) => setErrors((prev) => { const n = { ...prev }; delete n.custom_fields; delete n[`custom_fields.${key}`]; return n })} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '12px 18px', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}><Box component="span" sx={{ color: 'error.main' }}>*</Box> obbligatori</Typography>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button variant="contained" startIcon={<CheckIcon />} disabled={saving || computing} onClick={() => void save()}>{saving ? 'Salvataggio…' : plan ? 'Salva modifiche' : 'Crea piano'}</Button>
      </Box>
    </Dialog>
  )
}
