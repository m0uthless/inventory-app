import * as React from 'react'
import { Box, Button, ButtonBase, Checkbox, CircularProgress, Collapse, Dialog, FormControlLabel, IconButton, InputBase, Popover, Typography, type Theme } from '@mui/material'
import type { SystemStyleObject } from '@mui/system'
import { quickFieldSx } from './quickFieldSx'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

/*
 * Inserimento rapido (anteprima design-previews/fm-base.html, variante C · Rapido, scelta da Fede):
 * titolo grande, descrizione, le proprietà come pillole che aprono un selettore con ricerca,
 * i campi rari in "Altri campi". Ctrl+Invio salva. Stessa forma per creare e per modificare.
 */

// ── Contenitore ─────────────────────────────────────────────────────

type QuickFormProps = {
  open: boolean
  onClose: () => void
  /** Briciola in alto: modulo (con icona) e, facoltativo, un dettaglio (es. l'area). */
  crumb: { icon?: React.ReactNode; label: string; extra?: React.ReactNode }
  mode: 'create' | 'edit'
  /** Nome del dialogo per i lettori di schermo (es. "Nuovo task", "Modifica task #7"). */
  dialogLabel: string
  title: { value: string; onChange: (v: string) => void; placeholder: string; error?: string; maxLength?: number; label?: string; /** Bloccato (es. PO già inviato) senza bloccare il resto. */ readOnly?: boolean }
  /** Testo lungo sotto il titolo (descrizione o note). */
  description?: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }
  pills: React.ReactNode
  /** Campi rari: compaiono aprendo "Altri campi". */
  more?: { hint?: string; children: React.ReactNode; defaultOpen?: boolean }
  /** Errori da mostrare sotto le pillole (dal server o di validazione). */
  errors?: string[]
  submitLabel?: string
  onSubmit: () => void
  saving?: boolean
  canSubmit?: boolean
  /** Avviso in cima (es. "issue chiusa"). */
  notice?: React.ReactNode
  /** Sola lettura: niente salvataggio, campi non modificabili. */
  readOnly?: boolean
  cancelLabel?: string
  /** Incolla nel modulo (es. uno screenshot). */
  onPaste?: (e: React.ClipboardEvent) => void
  /** Azione secondaria a sinistra nel piede. */
  footerStart?: React.ReactNode
  /** "Creane un'altra" (solo in creazione, se il chiamante lo gestisce). */
  another?: { checked: boolean; onChange: (v: boolean) => void; label: string }
}

export function QuickForm(p: QuickFormProps) {
  const [moreOpen, setMoreOpen] = React.useState(Boolean(p.more?.defaultOpen))
  React.useEffect(() => { if (p.open) setMoreOpen(Boolean(p.more?.defaultOpen)) }, [p.open, p.more?.defaultOpen])
  const submit = () => { if (!p.saving && !p.readOnly && p.canSubmit !== false) p.onSubmit() }
  const label = p.submitLabel ?? (p.mode === 'create' ? 'Crea' : 'Salva modifiche')
  return (
    <Dialog
      open={p.open} onClose={p.saving ? undefined : p.onClose} fullWidth maxWidth={false} scroll="body"
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }}
      slotProps={{ paper: { 'aria-label': p.dialogLabel, sx: { width: 'min(720px, calc(100% - 32px))', m: { xs: 0, sm: '12vh auto 24px' }, verticalAlign: 'top', borderRadius: { xs: 0, sm: '12px' }, overflow: 'visible' } } }}
    >
      <Box sx={{ px: 2.25, pt: 1.5 }} onPaste={p.onPaste}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, py: '2px', borderRadius: '6px', bgcolor: 'archie.field', color: 'primary.main', fontWeight: 600, '& svg': { fontSize: 14 } }}>
            {p.crumb.icon}{p.crumb.label}
          </Box>
          <ChevronRightRoundedIcon sx={{ fontSize: 15 }} />
          <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{p.mode === 'create' ? 'Nuovo' : 'Modifica'}</Box>
          {p.crumb.extra ? <Box component="span" sx={{ ml: 0.5 }}>{p.crumb.extra}</Box> : null}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" aria-label="Chiudi" onClick={p.onClose} disabled={p.saving} sx={{ width: 30, height: 30 }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
        {p.notice ? <Box sx={{ mt: 1.25, px: 1.5, py: 1, borderRadius: '8px', bgcolor: 'warning.light', color: 'text.primary', fontSize: 12.5 }}>{p.notice}</Box> : null}
        <Box sx={p.readOnly ? { opacity: 0.6, pointerEvents: 'none', userSelect: 'none' } : undefined} aria-disabled={p.readOnly || undefined}>
        <InputBase
          autoFocus={!p.readOnly && !p.title.readOnly} readOnly={p.readOnly || p.title.readOnly} fullWidth value={p.title.value} onChange={(e) => p.title.onChange(e.target.value)} placeholder={p.title.placeholder}
          inputProps={{ 'aria-label': p.title.label ?? p.title.placeholder, maxLength: p.title.maxLength, 'aria-invalid': Boolean(p.title.error) }}
          sx={{ mt: 1.25, fontSize: 21, fontWeight: 650, letterSpacing: '-0.01em', '& input::placeholder': { color: p.title.error ? 'error.main' : 'archie.textFaint', opacity: 1 } }}
        />
        {p.description ? (
          <InputBase
            fullWidth multiline minRows={3} maxRows={10} value={p.description.value} onChange={(e) => p.description!.onChange(e.target.value)} placeholder={p.description.placeholder}
            inputProps={{ 'aria-label': p.description.label ?? p.description.placeholder }}
            sx={{ mt: 0.5, mb: 1, fontSize: 14, lineHeight: 1.55, alignItems: 'flex-start', '& textarea::placeholder': { color: 'archie.textFaint', opacity: 1 } }}
          />
        ) : <Box sx={{ height: 12 }} />}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{p.pills}</Box>
        {p.more ? (
          <Box sx={{ pb: 1.25 }}>
            <ButtonBase onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} sx={{ gap: 0.5, py: 0.5, borderRadius: '6px', fontSize: 12.5, fontWeight: 600, color: 'primary.main', '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
              {moreOpen ? <ExpandMoreRoundedIcon sx={{ fontSize: 17 }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 17 }} />}Altri campi
              {p.more.hint && !moreOpen ? <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 0.5 }}>{p.more.hint}</Box> : null}
            </ButtonBase>
            <Collapse in={moreOpen} unmountOnExit><Box sx={{ pt: 1.25, display: 'grid', gap: 1.5 }}>{p.more.children}</Box></Collapse>
          </Box>
        ) : null}
        </Box>
        {p.errors?.length ? (
          <Box role="alert" sx={{ display: 'grid', gap: 0.25, pb: 1.25 }}>
            {p.errors.map((e) => <Typography key={e} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, color: 'error.main' }}><ErrorOutlineRoundedIcon sx={{ fontSize: 15 }} />{e}</Typography>)}
          </Box>
        ) : null}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.25, py: 1.25, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2', borderRadius: { xs: 0, sm: '0 0 12px 12px' } }}>
        {p.footerStart}
        {p.another && p.mode === 'create' ? (
          <FormControlLabel control={<Checkbox size="small" checked={p.another.checked} onChange={(e) => p.another!.onChange(e.target.checked)} />} label={p.another.label} sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12.5, color: 'text.secondary' } }} />
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Box component="span" sx={{ display: { xs: 'none', sm: p.readOnly ? 'none' : 'inline-flex' }, gap: 0.5, '& kbd': { font: '500 10.5px "Geist Mono", monospace', px: 0.6, border: '1px solid', borderColor: 'divider', borderBottomWidth: 2, borderRadius: '4px', bgcolor: 'background.paper', color: 'text.secondary' } }}><kbd>Ctrl</kbd><kbd>Invio</kbd></Box>
        <Button variant="text" color="inherit" onClick={p.onClose} disabled={p.saving}>{p.cancelLabel ?? (p.readOnly ? 'Chiudi' : 'Annulla')}</Button>
        {p.readOnly ? null : (
          <Button variant="contained" onClick={submit} disabled={p.saving || p.canSubmit === false}>
            {p.saving ? <CircularProgress size={15} sx={{ mr: 1, color: 'inherit' }} /> : null}{label}
          </Button>
        )}
      </Box>
    </Dialog>
  )
}

// ── Pillola base ────────────────────────────────────────────────────

const pillSx = (set: boolean, error: boolean): SystemStyleObject<Theme> => ({
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 30, px: 1.25, maxWidth: 300, borderRadius: '7px', fontSize: 12.5, whiteSpace: 'nowrap',
  border: '1px', borderStyle: set ? 'solid' : 'dashed', borderColor: error ? 'error.main' : set ? 'divider' : 'archie.borderStrong',
  bgcolor: set ? 'archie.surface2' : 'background.paper', color: error ? 'error.main' : set ? 'text.primary' : 'text.secondary',
  '& > svg': { fontSize: 16, flex: 'none', color: error ? 'error.main' : set ? 'text.secondary' : 'inherit' },
  '&:hover': { borderColor: error ? 'error.main' : 'primary.main', color: error ? 'error.main' : set ? 'text.primary' : 'primary.main' },
  '&.Mui-focusVisible': { boxShadow: (t: Theme) => t.palette.archie.focusRing },
  '&.Mui-disabled': { opacity: 0.5 },
})

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } as const

export function Pill({ icon, label, placeholder, error = false, disabled, onClick, title, required }: {
  icon?: React.ReactNode; label?: React.ReactNode; placeholder: string; error?: boolean; disabled?: boolean; required?: boolean
  onClick: (e: React.MouseEvent<HTMLElement>) => void; title?: string
}) {
  const set = label != null && label !== ''
  return (
    <ButtonBase onClick={onClick} disabled={disabled} title={title} aria-label={set ? `${placeholder}: ${typeof label === 'string' ? label : ''}` : placeholder} sx={pillSx(set, error)}>
      {icon}<Box component="span" sx={ellipsis}>{set ? label : placeholder}</Box>
      {required && !set ? <Box component="span" sx={{ color: 'error.main', ml: -0.25 }}>*</Box> : null}
    </ButtonBase>
  )
}

/** Pillola solo da leggere (un dato già fissato, es. l'inventario da cui si crea la issue). */
export function StaticPill({ icon, label, title }: { icon?: React.ReactNode; label: React.ReactNode; title?: string }) {
  return <Box component="span" title={title} sx={[pillSx(true, false), { '&:hover': {} }]}>{icon}<Box component="span" sx={ellipsis}>{label}</Box></Box>
}

// ── Pillola con scelta da elenco ────────────────────────────────────

export type PillOption<V> = { value: V; label: string; sub?: string; node?: React.ReactNode }

export function SelectPill<V extends string | number>({ icon, placeholder, title, value, options, onChange, emptyLabel, error, disabled, required, render, disabledHint, onSearch, loading, action, current: currentProp }: {
  icon?: React.ReactNode; placeholder: string; title?: string; value: V | ''; options: PillOption<V>[]; onChange: (v: V | '') => void
  /** Voce per togliere la scelta (es. "Nessuno"); assente = scelta obbligatoria. */
  emptyLabel?: string; error?: boolean; disabled?: boolean; required?: boolean
  /** Come mostrare il valore scelto nella pillola (default: l'etichetta). */
  render?: (o: PillOption<V>) => React.ReactNode
  disabledHint?: string
  /** Ricerca sul server: il selettore non filtra da sé e mostra le opzioni ricevute. */
  onSearch?: (q: string) => void
  loading?: boolean
  /** Azione in fondo al selettore (es. "Non è in anagrafica? Scrivi il nome"). */
  action?: { label: string; onClick: () => void }
  /** Valore scelto da mostrare quando non è tra le opzioni (es. risultati di ricerca). */
  current?: PillOption<V> | null
}) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const current = options.find((o) => o.value === value) ?? (currentProp && currentProp.value === value ? currentProp : undefined)
  return (
    <>
      <Pill icon={icon} placeholder={placeholder} label={current ? (render ? render(current) : current.label) : undefined} error={error} disabled={disabled} required={required}
        title={disabled ? disabledHint : undefined} onClick={(e) => setAnchor(e.currentTarget)} />
      <PickerPopover anchor={anchor} onClose={() => setAnchor(null)} title={title ?? placeholder}
        items={[...(emptyLabel ? [{ value: '' as V | '', label: emptyLabel }] : []), ...options] as PillOption<V | ''>[]}
        selected={value} onPick={(v) => { setAnchor(null); onChange(v) }} onSearch={onSearch} loading={loading}
        action={action ? { label: action.label, onClick: () => { setAnchor(null); action.onClick() } } : undefined} />
    </>
  )
}

function PickerPopover<V extends string | number>({ anchor, onClose, title, items, selected, onPick, onSearch, loading, action }: {
  anchor: HTMLElement | null; onClose: () => void; title: string; items: PillOption<V>[]; selected: V; onPick: (v: V) => void
  onSearch?: (q: string) => void; loading?: boolean; action?: { label: string; onClick: () => void }
}) {
  const [q, setQ] = React.useState('')
  const [active, setActive] = React.useState(0)
  React.useEffect(() => { if (anchor) { setQ(''); onSearch?.(''); setActive(Math.max(0, items.findIndex((i) => i.value === selected))) } }, [anchor]) // eslint-disable-line react-hooks/exhaustive-deps
  const searchable = Boolean(onSearch) || items.length > 7
  const list = q && !onSearch ? items.filter((i) => `${i.label} ${i.sub ?? ''}`.toLowerCase().includes(q.toLowerCase())) : items
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && list[active]) { e.preventDefault(); e.stopPropagation(); onPick(list[active].value) }
  }
  return (
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: -6, horizontal: 'left' }}
      slotProps={{ paper: { onKeyDown: onKey, sx: { width: 290, p: 0.75, borderRadius: '10px', display: 'flex', flexDirection: 'column', maxHeight: 360 } } }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary', px: 0.75, pt: 0.5, pb: 0.75 }}>{title}</Typography>
      {searchable ? (
        <InputBase autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); onSearch?.(e.target.value) }} placeholder="Cerca…" inputProps={{ 'aria-label': `Cerca ${title}` }}
          sx={{ height: 32, px: 1, mb: 0.5, fontSize: 13, border: '1px solid', borderColor: 'divider', borderRadius: '7px', '&.Mui-focused': { borderColor: 'primary.main' } }} />
      ) : null}
      <Box ref={listRef} role="listbox" aria-label={title} tabIndex={searchable ? -1 : 0} autoFocus={!searchable} sx={{ overflowY: 'auto', display: 'grid', gap: '1px', outline: 'none' }}>
        {list.map((o, i) => (
          <ButtonBase key={String(o.value)} data-i={i} role="option" aria-selected={o.value === selected} onMouseEnter={() => setActive(i)} onClick={() => onPick(o.value)}
            sx={{ justifyContent: 'flex-start', gap: 1, minHeight: 32, px: 1, borderRadius: '6px', fontSize: 13, textAlign: 'left', fontWeight: o.value === selected ? 600 : 400, bgcolor: i === active ? 'archie.surface2' : 'transparent' }}>
            <Box component="span" sx={{ ...ellipsis, display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>{o.node ?? o.label}</Box>
            {o.sub ? <Box component="span" sx={{ ml: 'auto', fontSize: 11, color: 'archie.textFaint', whiteSpace: 'nowrap' }}>{o.sub}</Box> : null}
            {o.value === selected ? <CheckRoundedIcon sx={{ fontSize: 15, color: 'primary.main', ml: o.sub ? 0.5 : 'auto' }} /> : null}
          </ButtonBase>
        ))}
        {!list.length ? <Typography sx={{ p: 1, fontSize: 12, color: 'text.secondary' }}>{loading ? 'Ricerca…' : 'Nessun risultato'}</Typography> : null}
      </Box>
      {action ? (
        <ButtonBase onClick={action.onClick} sx={{ justifyContent: 'flex-start', mt: 0.5, px: 1, pt: 1, pb: 0.5, borderTop: '1px solid', borderColor: 'divider', fontSize: 12, fontWeight: 550, color: 'primary.main', textAlign: 'left' }}>{action.label}</ButtonBase>
      ) : null}
    </Popover>
  )
}

// ── Pillola scrivibile ──────────────────────────────────────────────

export function TextPill({ icon, placeholder, value, onChange, error, disabled, mono, title, type = 'text', inputMode, prefix, suffix }: {
  icon?: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; error?: boolean; disabled?: boolean
  /** Etichetta corta prima del valore (es. «Importo») e unità dopo (es. «€»), visibili quando c'è un valore. */
  prefix?: string; suffix?: string
  mono?: boolean; /** Ignorata: la pillola cresce col testo. */ width?: number; title?: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  const set = value.trim() !== ''
  return (
    <Box component="label" title={title} sx={[pillSx(set, Boolean(error)), { cursor: disabled ? 'not-allowed' : 'text', opacity: disabled ? 0.5 : 1, '&:focus-within': { borderColor: 'primary.main', borderStyle: 'solid', bgcolor: 'background.paper' } }]}>
      {icon}
      {prefix && set ? <Box component="span" sx={{ color: 'text.secondary' }}>{prefix}</Box> : null}
      <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} type={type}
        inputProps={{ 'aria-label': placeholder, inputMode }}
        sx={{ fontSize: 12.5, color: 'inherit', fontFamily: mono ? '"Geist Mono", monospace' : undefined, width: 'auto', maxWidth: 260, '& input': { p: 0, width: `${Math.min(Math.max(placeholder.length, value.length, 3) + 1, 34)}ch` }, '& input::placeholder': { color: 'inherit', opacity: 1, fontFamily: 'Geist, system-ui, sans-serif' } }} />
      {suffix && set ? <Box component="span" sx={{ color: 'text.secondary' }}>{suffix}</Box> : null}
    </Box>
  )
}

// ── Pillola data ────────────────────────────────────────────────────

const isoPlus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtDay = (s: string) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function DatePill({ icon, placeholder, value, onChange, error, disabled, quick = [[1, 'Domani'], [7, 'Tra una settimana'], [30, 'Tra un mese']], clearLabel = 'Nessuna', clearable = true }: {
  icon?: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; error?: boolean; disabled?: boolean
  quick?: [number, string][]; clearLabel?: string; clearable?: boolean
}) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const pick = (v: string) => { setAnchor(null); onChange(v) }
  return (
    <>
      <Pill icon={icon} placeholder={placeholder} label={value ? fmtDay(value) : undefined} error={error} disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)} />
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: -6, horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 270, p: 0.75, borderRadius: '10px' } } }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary', px: 0.75, pt: 0.5, pb: 0.75 }}>{placeholder}</Typography>
        <Box sx={{ display: 'grid', gap: '1px' }}>
          {[...(clearable ? [['', clearLabel] as [string, string]] : []), ...quick.map(([n, l]) => [isoPlus(n), l] as [string, string])].map(([v, l]) => (
            <ButtonBase key={l} onClick={() => pick(v)} sx={{ justifyContent: 'flex-start', gap: 1, minHeight: 32, px: 1, borderRadius: '6px', fontSize: 13, fontWeight: v === value ? 600 : 400, '&:hover': { bgcolor: 'archie.surface2' } }}>
              {l}<Box component="span" sx={{ ml: 'auto', fontSize: 11, color: 'archie.textFaint' }}>{fmtDay(v)}</Box>
            </ButtonBase>
          ))}
        </Box>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.5, px: 1, pt: 1, pb: 0.25, borderTop: '1px solid', borderColor: 'divider', fontSize: 12, color: 'text.secondary' }}>
          Altra data
          <InputBase type="date" value={value} onChange={(e) => pick(e.target.value)} inputProps={{ 'aria-label': `${placeholder}: altra data` }}
            sx={{ fontSize: 12, height: 28, px: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: '6px' }} />
        </Box>
      </Popover>
    </>
  )
}

// ── Pillola sì/no ───────────────────────────────────────────────────

export function TogglePill({ icon, label, checked, onChange, error }: { icon?: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  return (
    <ButtonBase role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      sx={[pillSx(checked, Boolean(error)), checked ? { bgcolor: 'archie.field', borderColor: 'archie.fieldLine', color: 'primary.main', fontWeight: 600, '& > svg': { color: 'primary.main' } } : {}]}>
      {icon}{label}{checked ? <CheckRoundedIcon /> : null}
    </ButtonBase>
  )
}

// ── Campi di "Altri campi" (etichetta sopra) ────────────────────────

export function QuickFields({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, minmax(0, 1fr))` }, alignItems: 'start', gap: 1.5 }}>{children}</Box>
}

export function QuickGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ display: 'grid', gap: 1 }}>
      <Typography component="h3" sx={{ fontSize: 12, fontWeight: 650, color: 'primary.main' }}>{title}</Typography>
      {children}
    </Box>
  )
}


export function QuickField({ label, value, onChange, error, help, disabled, mono, multiline, type = 'text', secret, span, placeholder, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; help?: string; disabled?: boolean; mono?: boolean
  multiline?: boolean; type?: string; secret?: boolean; span?: number; placeholder?: string; autoComplete?: string
}) {
  const [show, setShow] = React.useState(false)
  const id = React.useId()
  return (
    <Box sx={{ display: 'grid', alignContent: 'start', gap: 0.6, minWidth: 0, gridColumn: span ? `span ${span}` : undefined }}>
      <Typography component="label" htmlFor={id} sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
      <InputBase id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} multiline={multiline} minRows={multiline ? 3 : undefined}
        type={secret && !show ? 'password' : type} placeholder={placeholder} autoComplete={autoComplete ?? (secret ? 'new-password' : undefined)}
        inputProps={{ 'aria-invalid': Boolean(error) }}
        endAdornment={secret ? (
          <IconButton size="small" aria-label={show ? `Nascondi ${label}` : `Mostra ${label}`} onClick={() => setShow((s) => !s)} disabled={disabled} sx={{ width: 26, height: 26, mr: -0.5 }}>
            {show ? <VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        ) : undefined}
        sx={[quickFieldSx(Boolean(error)), mono ? { fontFamily: '"Geist Mono", monospace', fontSize: 13 } : {}]} />
      {error ? <Typography sx={{ fontSize: 12, color: 'error.main' }}>{error}</Typography> : help ? <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{help}</Typography> : null}
    </Box>
  )
}
