import * as React from 'react'
import { Autocomplete, Box, ButtonBase, InputAdornment, MenuItem, Switch, TextField, Typography } from '@mui/material'
import { CampoIcon } from '../../ui/campo'
import { FileIcon } from '../drive/DriveIcons'
import { formatEuro } from '../purchaseorders/types'
import { daysLabel, dShort } from './contractModel'
import { PeriodBar } from './contractUi'
import {
  DURATIONS, NOTICE_PRESETS, TYPE_CARDS, addDays, endOf, invoiceCount, isIsoDate, monthsBetween, parseMoney,
  type ContractForm, type FormErrors,
} from './contractForm'
import { BILLING_FREQ_OPTIONS, CONTRACT_STATUS_OPTIONS, type CompanyOption, type CustomerOption, type ExpiryState, type Seller } from './types'

export type PartProps = {
  f: ContractForm
  set: <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => void
  errors: FormErrors
}


const lbl = { fontSize: 12, fontWeight: 550, color: 'text.primary', mb: 0.75, display: 'block' } as const
const help = (t?: string, error?: boolean) => (t ? <Typography sx={{ mt: 0.5, fontSize: 11.5, color: error ? 'error.main' : 'text.secondary' }}>{t}</Typography> : null)

/** Etichetta di campo nello stile del modulo. */
export function FieldLabel({ children, required, optional, htmlFor }: { children: React.ReactNode; required?: boolean; optional?: boolean; htmlFor?: string }) {
  return (
    <Box component={htmlFor ? 'label' : 'span'} htmlFor={htmlFor} sx={lbl}>
      {children}{required ? <Box component="span" sx={{ color: 'error.main' }}> *</Box> : null}
      {optional ? <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}> · facoltativo</Box> : null}
    </Box>
  )
}

/** Scelta singola a pastiglie (durata, preavviso, tipo, stato). */
export function ChoiceChips<T extends string | number>({ options, value, onChange, label, square }: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]
  value: T | null
  onChange: (v: T) => void
  label: string
  square?: boolean
}) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <ButtonBase key={String(o.value)} role="radio" aria-checked={on} onClick={() => onChange(o.value)} sx={{
            height: 30, px: 1.25, gap: 0.75, borderRadius: square ? '6px' : '15px', fontSize: 12.5, fontWeight: 550,
            border: '1px solid', borderColor: on ? 'archie.fieldLine' : 'divider', bgcolor: on ? 'archie.field' : 'background.paper',
            color: on ? 'primary.main' : 'text.secondary', '&:hover': { borderColor: on ? 'archie.fieldLine' : 'archie.borderStrong', color: on ? 'primary.main' : 'text.primary' },
            '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>
            {o.icon}{o.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

/** Gruppo numerato del modulo («Scheda unica»). */
export function Group({ n, title, aside, children, first }: { n: number; title: string; aside?: string; children: React.ReactNode; first?: boolean }) {
  return (
    <Box component="section" sx={{ display: 'grid', gap: 1.5, ...(first ? {} : { mt: 2.25, pt: 2, borderTop: '1px solid', borderColor: 'divider' }) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 650 }}>
        <Box component="span" sx={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'archie.field', color: 'primary.main', fontSize: 11, fontWeight: 700 }}>{n}</Box>
        {title}
        {aside ? <Box component="span" sx={{ ml: 'auto', fontWeight: 400, fontSize: 11.5, color: 'text.secondary' }}>{aside}</Box> : null}
      </Box>
      {children}
    </Box>
  )
}

const custLabel = (c: CustomerOption) => c.display_name || c.name || c.code || `#${c.id}`

export function CustomerField({ f, set, errors, customers, fallbackName, autoFocus, disabled }: PartProps & { customers: CustomerOption[]; fallbackName?: string; autoFocus?: boolean; disabled?: boolean }) {
  const options = React.useMemo(() => (f.customer == null || customers.some((c) => c.id === f.customer) ? customers : [...customers, { id: f.customer, name: fallbackName ?? `Cliente #${f.customer}` }]), [customers, f.customer, fallbackName])
  return (
    <Box>
      <FieldLabel required htmlFor="ct-customer">Cliente</FieldLabel>
      <Autocomplete
        id="ct-customer" size="small" options={options} disabled={disabled}
        value={options.find((c) => c.id === f.customer) ?? null}
        onChange={(_e, c) => { set('customer', c?.id ?? null); set('company', null); set('devices', []) }}
        getOptionLabel={custLabel} isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="Nessun cliente"
        renderOption={(props, c) => <li {...props} key={c.id}><Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'text.secondary' }}><CampoIcon name="building" size={15} /></Box>{custLabel(c)}</li>}
        renderInput={(p) => <TextField {...p} autoFocus={autoFocus} placeholder="Cerca il cliente…" error={Boolean(errors.customer)} />}
      />
      {help(errors.customer, true)}
    </Box>
  )
}

/** Tipo come quattro schede descritte («Passi»). */
export function TypeCards({ f, set, errors }: PartProps) {
  return (
    <Box>
      <FieldLabel required>Che contratto è?</FieldLabel>
      <Box role="radiogroup" aria-label="Tipo di contratto" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0,1fr))' }, gap: 1 }}>
        {TYPE_CARDS.map((t) => {
          const on = f.contract_type === t.value
          return (
            <ButtonBase key={t.value} role="radio" aria-checked={on} onClick={() => set('contract_type', t.value)} sx={{
              display: 'grid', justifyItems: 'start', alignContent: 'start', gap: 0.75, p: 1.25, borderRadius: '10px', textAlign: 'left',
              border: '1px solid', borderColor: on ? 'archie.fieldLine' : errors.contract_type ? 'error.main' : 'divider',
              bgcolor: on ? 'archie.field' : 'background.paper', boxShadow: (th) => (on ? `inset 0 0 0 1px ${th.palette.archie.fieldLine}` : 'none'),
              '&:hover': { borderColor: on ? 'archie.fieldLine' : 'archie.borderStrong' }, '&.Mui-focusVisible': { boxShadow: (th) => th.palette.archie.focusRing },
            }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: on ? 'primary.main' : 'archie.neutralBg', color: on ? 'primary.contrastText' : 'text.secondary' }}><CampoIcon name={t.icon} size={16} /></Box>
              <Box component="b" sx={{ fontSize: 13, fontWeight: 600 }}>{t.label}</Box>
              <Box component="small" sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>{t.hint}</Box>
            </ButtonBase>
          )
        })}
      </Box>
      {help(errors.contract_type, true)}
    </Box>
  )
}

/** Tipo come pastiglie («Scheda unica»). */
export function TypeChips({ f, set, errors }: PartProps) {
  return (
    <Box>
      <FieldLabel required>Tipo</FieldLabel>
      <ChoiceChips label="Tipo di contratto" value={f.contract_type || null} onChange={(v) => set('contract_type', v)}
        options={TYPE_CARDS.map((t) => ({ value: t.value, label: t.label, icon: <CampoIcon name={t.icon} size={14} /> }))} />
      {help(errors.contract_type, true)}
    </Box>
  )
}

export function StatusChips({ f, set }: PartProps) {
  return (
    <Box>
      <FieldLabel>Stato</FieldLabel>
      <ChoiceChips label="Stato del contratto" value={f.status} onChange={(v) => set('status', v)} options={CONTRACT_STATUS_OPTIONS} />
    </Box>
  )
}

export function SellerCompany({ f, set, errors, sellers, companies, customers }: PartProps & { sellers: Seller[]; companies: CompanyOption[]; customers: CustomerOption[] }) {
  const sellerOptions = sellers.filter((s) => s.is_active || s.id === f.seller)
  const proposed = customers.find((c) => c.id === f.customer)?.status ?? null
  const company = f.company ?? proposed
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, alignItems: 'start' }}>
      <Box>
        <FieldLabel htmlFor="ct-seller">Venditore</FieldLabel>
        <TextField id="ct-seller" select size="small" fullWidth value={f.seller ?? ''} onChange={(e) => set('seller', e.target.value === '' ? null : Number(e.target.value))} error={Boolean(errors.seller)}
          slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Nessuno</MenuItem>
          {sellerOptions.map((s) => <MenuItem key={s.id} value={s.id}>{s.is_active ? s.name : `${s.name} (non attivo)`}</MenuItem>)}
        </TextField>
        {help(errors.seller, true)}
      </Box>
      <Box>
        <FieldLabel htmlFor="ct-company">Società</FieldLabel>
        <TextField id="ct-company" select size="small" fullWidth value={company ?? ''} onChange={(e) => set('company', e.target.value === '' ? null : Number(e.target.value))} error={Boolean(errors.company)}
          slotProps={{ select: { displayEmpty: true, renderValue: (v) => (v === '' ? <Box component="span" sx={{ color: 'text.secondary' }}>Dal cliente</Box> : companies.find((c) => c.id === v)?.label ?? '') } }}>
          {companies.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
        </TextField>
        {errors.company ? help(errors.company, true) : f.company == null && proposed != null ? help('Proposta dal cliente') : null}
      </Box>
    </Box>
  )
}

export function CodeTitle({ f, set, errors, title, autoTitle }: PartProps & { title: string; autoTitle: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, gap: 1.25, alignItems: 'start' }}>
      <Box>
        <FieldLabel required htmlFor="ct-code">Codice</FieldLabel>
        <TextField id="ct-code" size="small" fullWidth value={f.code} onChange={(e) => set('code', e.target.value)} error={Boolean(errors.code)}
          slotProps={{ htmlInput: { style: { fontFamily: '"Geist Mono", monospace', fontSize: 12.5 } } }} />
        {errors.code ? help(errors.code, true) : help('Proposto, modificabile')}
      </Box>
      <Box>
        <FieldLabel required htmlFor="ct-title">Titolo</FieldLabel>
        <TextField id="ct-title" size="small" fullWidth value={title} placeholder="es. Assistenza full-risk — AUSL Bologna" error={Boolean(errors.title)}
          onChange={(e) => { set('title', e.target.value); set('titleTouched', true) }} />
        {errors.title ? help(errors.title, true) : !f.titleTouched && autoTitle ? help('Composto da tipo e cliente') : null}
      </Box>
    </Box>
  )
}

export function PeriodFields({ f, set, errors }: PartProps) {
  const [customNotice, setCustomNotice] = React.useState(!NOTICE_PRESETS.includes(f.notice_days))
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, alignItems: 'start' }}>
        <Box>
          <FieldLabel required htmlFor="ct-start">Inizio</FieldLabel>
          <TextField id="ct-start" type="date" size="small" fullWidth value={f.start_date} error={Boolean(errors.start_date)}
            onChange={(e) => { set('start_date', e.target.value); if (!f.end_date && isIsoDate(e.target.value)) set('end_date', addDays(e.target.value, 364)) }} />
          {help(errors.start_date, true)}
        </Box>
        {f.duration ? null : (
          <Box>
            <FieldLabel required htmlFor="ct-end">Fine</FieldLabel>
            <TextField id="ct-end" type="date" size="small" fullWidth value={f.end_date} onChange={(e) => set('end_date', e.target.value)} error={Boolean(errors.end_date)} />
            {help(errors.end_date, true)}
          </Box>
        )}
      </Box>
      <Box>
        <FieldLabel>Durata</FieldLabel>
        <ChoiceChips label="Durata" value={f.duration} onChange={(m) => { if (!m && !f.end_date) set('end_date', endOf(f)); set('duration', m) }}
          options={[...DURATIONS.map((m) => ({ value: m, label: m === 12 ? '1 anno' : `${m / 12} anni` })), { value: 0, label: 'Fino al…', icon: <CampoIcon name="calendar" size={13} /> }]} />
        {f.duration && errors.end_date ? help(errors.end_date, true) : null}
      </Box>
      <Box>
        <FieldLabel>Preavviso di disdetta</FieldLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
          <ChoiceChips label="Preavviso di disdetta" value={customNotice ? -1 : f.notice_days}
            onChange={(n) => { if (n === -1) { setCustomNotice(true); return } setCustomNotice(false); set('notice_days', n) }}
            options={[...NOTICE_PRESETS.map((n) => ({ value: n, label: `${n} giorni` })), { value: -1, label: 'Altro' }]} />
          {customNotice ? (
            <TextField size="small" type="number" value={Number.isFinite(f.notice_days) ? f.notice_days : ''} onChange={(e) => set('notice_days', e.target.value === '' ? NaN : Number(e.target.value))}
              error={Boolean(errors.notice_days)} sx={{ width: 120 }} slotProps={{ htmlInput: { min: 0, max: 3650, 'aria-label': 'Giorni di preavviso' }, input: { endAdornment: <InputAdornment position="end">giorni</InputAdornment> } }} />
          ) : null}
        </Box>
        {help(errors.notice_days, true)}
      </Box>
      <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', width: 'fit-content' }}>
        <Switch size="small" checked={f.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} />
        <Box>
          <Typography sx={{ fontSize: 13 }}>Rinnovo automatico</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Solo promemoria: il rinnovo in Archie resta manuale</Typography>
        </Box>
      </Box>
    </>
  )
}

export function ValueBilling({ f, set, errors, canViewValue }: PartProps & { canViewValue: boolean }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: canViewValue ? { xs: '1fr', sm: '170px 1fr' } : '1fr', gap: 1.25, alignItems: 'start' }}>
      {canViewValue ? (
        <Box>
          <FieldLabel htmlFor="ct-value">Valore totale</FieldLabel>
          <TextField id="ct-value" size="small" fullWidth value={f.total_value} onChange={(e) => set('total_value', e.target.value)} placeholder="0,00" error={Boolean(errors.total_value)}
            slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }} />
          {errors.total_value ? help(errors.total_value, true) : help('Visibile solo a chi vede i valori')}
        </Box>
      ) : null}
      <Box>
        <FieldLabel>Fatturazione</FieldLabel>
        <ChoiceChips square label="Fatturazione" value={f.billing_freq} onChange={(v) => set('billing_freq', v)} options={BILLING_FREQ_OPTIONS} />
      </Box>
    </Box>
  )
}

export function PdfField({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const ref = React.useRef<HTMLInputElement | null>(null)
  const [over, setOver] = React.useState(false)
  return (
    <Box>
      <FieldLabel optional>PDF del contratto</FieldLabel>
      <ButtonBase onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const x = e.dataTransfer.files?.[0]; if (x) onFile(x) }}
        sx={{
          width: '100%', justifyContent: 'flex-start', gap: 1.25, p: '9px 12px', borderRadius: '8px', textAlign: 'left',
          border: '1px', borderStyle: file ? 'solid' : 'dashed', borderColor: over ? 'primary.main' : file ? 'divider' : 'archie.borderStrong',
          color: over ? 'primary.main' : 'text.secondary', fontSize: 12.5, '&:hover': { borderColor: 'primary.main' },
          '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
        }}>
        {file ? <FileIcon kind="pdf" size={26} /> : <CampoIcon name="upload" size={16} />}
        <span>{file ? <><Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{file.name}</Box> · clic per cambiarlo</> : <><Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>Trascina qui il PDF</Box> o sfoglia</>}</span>
        {file ? <Box component="span" role="button" tabIndex={0} aria-label="Togli il PDF" onClick={(e) => { e.stopPropagation(); onFile(null) }} sx={{ ml: 'auto', display: 'inline-flex', p: 0.5, borderRadius: '5px', '&:hover': { bgcolor: 'action.hover' } }}><CampoIcon name="x" size={14} /></Box> : null}
      </ButtonBase>
      <input ref={ref} type="file" accept="application/pdf" hidden onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) onFile(x) }} />
    </Box>
  )
}

export function NotesField({ f, set, errors }: PartProps) {
  return (
    <Box>
      <FieldLabel optional htmlFor="ct-notes">Note</FieldLabel>
      <TextField id="ct-notes" size="small" fullWidth multiline minRows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Condizioni particolari, referenti, SLA…" error={Boolean(errors.notes)} />
      {help(errors.notes, true)}
    </Box>
  )
}

// ── Riepiloghi ────────────────────────────────────────────────────

const DAY = 86_400_000
function stateFor(f: ContractForm, end: string): ExpiryState {
  if (f.status !== 'attivo' || !isIsoDate(end)) return 'none'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const toEnd = Math.round((new Date(`${end}T00:00:00`).getTime() - today.getTime()) / DAY)
  if (toEnd < 0) return 'expired'
  if (toEnd <= 30) return 'expiring'
  return new Date(`${addDays(end, -f.notice_days)}T00:00:00`) <= today ? 'notice' : 'ok'
}

/** Linea del periodo con disdetta e la frase che la spiega. */
export function PeriodPreview({ f, narrow }: { f: ContractForm; narrow?: boolean }) {
  const end = endOf(f)
  if (!isIsoDate(f.start_date) || !isIsoDate(end) || end < f.start_date) {
    return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Indica inizio e durata per vedere il periodo.</Typography>
  }
  const notice = Number.isFinite(f.notice_days) ? addDays(end, -f.notice_days) : null
  const m = monthsBetween(f.start_date, end)
  const state = stateFor(f, end)
  const late = notice != null && f.status === 'attivo' && new Date(`${notice}T00:00:00`) < new Date(new Date().toDateString())
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <PeriodBar start={f.start_date} end={end} notice={notice} state={state === 'none' ? 'ok' : state} endsOnly={narrow} />
      <Typography sx={{ fontSize: 11.5, lineHeight: 1.45, color: late ? 'warning.main' : 'text.secondary', '& b': { color: late ? 'warning.main' : 'text.primary', fontWeight: 600 } }}>
        {late
          ? <>Il termine di disdetta ({dShort(notice)}) è già passato: il contratto nascerà in <b>Preavviso</b>.</>
          : <>{m} {m === 1 ? 'mese' : 'mesi'}{notice ? <> · disdetta possibile fino al <b>{dShort(notice)}</b> ({daysLabel(notice)})</> : null}{f.auto_renew ? ' · rinnovo automatico' : ''}.</>}
      </Typography>
    </Box>
  )
}

/** Valore ripartito: al mese, all'anno, numero e importo delle fatture. */
export function AmountPreview({ f, compact }: { f: ContractForm; compact?: boolean }) {
  const end = endOf(f)
  const m = isIsoDate(f.start_date) && isIsoDate(end) && end >= f.start_date ? monthsBetween(f.start_date, end) : 12
  const n = invoiceCount(f.billing_freq, m)
  const v = parseMoney(f.total_value)
  const ok = v != null && !Number.isNaN(v) && v > 0
  const freq = BILLING_FREQ_OPTIONS.find((o) => o.value === f.billing_freq)?.label ?? ''
  if (compact) {
    return <Typography sx={{ fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
      {ok ? <>{n} {n === 1 ? 'fattura' : 'fatture'} da <b>{formatEuro(v / n)}</b> · {formatEuro((v / m) * 12)} all'anno</> : 'Il valore si può lasciare vuoto e aggiungere dopo.'}
    </Typography>
  }
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{ok ? formatEuro(v) : '—'}</Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontWeight: 550, fontVariantNumeric: 'tabular-nums' } }}>
        <dt>Al mese</dt><dd>{ok ? formatEuro(v / m) : '—'}</dd>
        <dt>All'anno</dt><dd>{ok ? formatEuro((v / m) * 12) : '—'}</dd>
        <dt>{freq}</dt><dd>{n} {n === 1 ? 'fattura' : 'fatture'}{ok ? ` da ${formatEuro(v / n)}` : ''}</dd>
      </Box>
      <Box aria-hidden sx={{ display: 'flex', gap: '2px', height: 20 }}>
        {Array.from({ length: Math.min(n, 60) }, (_, i) => <Box key={i} sx={{ flex: 1, borderRadius: '3px', bgcolor: 'archie.field', border: n > 12 ? 0 : '1px solid', borderColor: 'archie.fieldLine', opacity: n > 12 ? 1 : 0.7 }} />)}
      </Box>
    </Box>
  )
}

