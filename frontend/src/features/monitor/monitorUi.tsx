import * as React from 'react'
import { Autocomplete, Box, Button, ButtonBase, CircularProgress, FormControlLabel, IconButton, Switch, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { CampoDialog, CampoIcon, DetailSection, FloatingDetail } from '../../ui/campo'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import {
  MONO, STATI, STATO_META, TIPO_LABEL, monitorTitle, setFormField, wsWhere,
  type MonitorForm, type MonitorRow, type MonitorStato, type MonitorTipo,
} from './monitorModel'

const TONE = {
  success: { bgcolor: 'success.light', color: 'success.main' },
  warning: { bgcolor: 'warning.light', color: 'warning.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
  neutral: { bgcolor: 'archie.neutralBg', color: 'text.secondary' },
} as const
const badge = { display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap' } as const
const mono = MONO

export function StatoBadge({ stato, onDark }: { stato: MonitorStato; onDark?: boolean }) {
  const m = STATO_META[stato] ?? STATO_META.rma
  return <Box component="span" sx={{ ...badge, ...TONE[m.tone], ...(onDark && m.tone === 'neutral' ? { bgcolor: 'rgba(255,255,255,.14)', color: '#fff' } : {}) }}>{m.label}</Box>
}

export function RadinetTag() {
  return <Box component="span" title="Radinet attivo" sx={{ display: 'inline-flex', alignItems: 'center', height: 18, px: 0.75, borderRadius: '4px', fontSize: 11, fontWeight: 650, bgcolor: (t) => t.palette.archie.tints.lilac.bg, color: (t) => t.palette.archie.tints.lilac.ink }}>Radinet</Box>
}

export function TipoCell({ m }: { m: Pick<MonitorRow, 'tipo' | 'radinet'> }) {
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap', fontSize: 13 }}>{TIPO_LABEL[m.tipo] ?? m.tipo}{m.radinet ? <RadinetTag /> : null}</Box>
}

/** Due righe: titolo e sottotitolo (con icona facoltativa). */
export function TwoLine({ icon, title, sub }: { icon?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, height: '100%' }}>
      {icon ? <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex', flex: 'none' }}>{icon}</Box> : null}
      <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.3 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{title}</Typography>
        {sub ? <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{sub}</Typography> : null}
      </Box>
    </Box>
  )
}

const MONITOR_FIELDS: Record<string, string> = { produttore: 'il produttore', modello: 'il modello', seriale: 'il seriale', stato: 'lo stato', tipo: 'il tipo', radinet: 'Radinet', inventory: 'la workstation' }

// ── Scheda di dettaglio ────────────────────────────────────────────────────

export function MonitorDetailCard({ m, canChange, canDelete, canAudit, busy, position, onPrev, onNext, onClose, onStato, onEdit, onDelete, onRestore, onOpenInventory, onOpenMonitor }: {
  m: MonitorRow; canChange: boolean; canDelete: boolean; canAudit: boolean; busy: boolean
  position?: string; onPrev?: () => void; onNext?: () => void; onClose: () => void
  onStato: (s: MonitorStato) => void; onEdit: () => void; onDelete: () => void; onRestore: () => void
  onOpenInventory: (id: number) => void; onOpenMonitor: (id: number) => void
}) {
  const [siblings, setSiblings] = React.useState<MonitorRow[]>([])
  React.useEffect(() => {
    if (!m.inventory) { setSiblings([]); return }
    let alive = true
    api.get<{ results?: MonitorRow[] }>('/monitors/', { params: { inventory: m.inventory, page_size: 50 } })
      .then((r) => { if (alive) setSiblings((r.data.results ?? []).filter((x) => x.id !== m.id)) }).catch(() => { if (alive) setSiblings([]) })
    return () => { alive = false }
  }, [m.inventory, m.id])
  const deleted = Boolean(m.deleted_at)
  const copy = () => { if (m.seriale) void navigator.clipboard?.writeText(m.seriale) }
  const row = (label: string, value: React.ReactNode) => (
    <>
      <Typography component="dt" sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Box component="dd" sx={{ m: 0, display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, fontSize: 13 }}>{value}</Box>
    </>
  )
  return (
    <FloatingDetail open onClose={onClose} ariaLabel="Dettaglio monitor"
      idLabel={<Box component="span" sx={mono}>Monitor #{m.id}</Box>}
      status={deleted ? <Box component="span" sx={{ ...badge, bgcolor: 'rgba(255,255,255,.14)', color: '#fff' }}>Nel cestino</Box> : <StatoBadge stato={m.stato} onDark />}
      title={monitorTitle(m)} subtitle={[TIPO_LABEL[m.tipo], m.seriale ? `S/N ${m.seriale}` : null].filter(Boolean).join(' · ')}
      position={position} onPrev={onPrev} onNext={onNext}
      footer={deleted ? (
        <><Box sx={{ flex: 1 }} />{canChange ? <Button variant="contained" disabled={busy} onClick={onRestore} startIcon={<CampoIcon name="restore" size={15} />}>Ripristina</Button> : null}</>
      ) : (
        <>
          {canDelete ? <Button variant="outlined" disabled={busy} onClick={onDelete} startIcon={<CampoIcon name="trash" size={15} />}>Elimina</Button> : null}
          <Box sx={{ flex: 1 }} />
          {canChange ? <Button variant="contained" disabled={busy} onClick={onEdit}>Modifica</Button> : null}
        </>
      )}>
      <Box sx={{ display: 'grid', gap: 2.25 }}>
        <DetailSection title="Dati">
          <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '8px 12px', m: 0, alignItems: 'center' }}>
            {row('Produttore', m.produttore || '—')}
            {row('Modello', m.modello || '—')}
            {row('Seriale', m.seriale ? (
              <><Box component="span" sx={mono}>{m.seriale}</Box>
                <Tooltip title="Copia il seriale"><IconButton size="small" aria-label="Copia il seriale" onClick={copy} sx={{ width: 24, height: 24 }}><CampoIcon name="copy" size={13} /></IconButton></Tooltip></>
            ) : '—')}
            {row('Tipo', TIPO_LABEL[m.tipo] ?? m.tipo)}
            {row('Radinet', m.radinet ? 'Attivo' : m.tipo === 'diagnostico' ? 'Non attivo' : <Box component="span" sx={{ color: 'text.secondary' }}>solo per i diagnostici</Box>)}
            {row('Stato', canChange && !deleted ? (
              <Box role="group" aria-label="Stato" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5 }}>
                {STATI.map((s) => {
                  const on = s === m.stato
                  return (
                    <ButtonBase key={s} aria-pressed={on} disabled={busy} onClick={() => { if (!on) onStato(s) }} sx={{
                      height: 24, px: 1, borderRadius: '5px', fontSize: 12, border: '1px solid', borderColor: on ? 'transparent' : 'divider',
                      ...(on ? { ...TONE[STATO_META[s].tone], fontWeight: 600 } : { color: 'text.secondary', bgcolor: 'background.paper', '&:hover': { color: 'text.primary' } }),
                    }}>{STATO_META[s].label}</ButtonBase>
                  )
                })}
              </Box>
            ) : <StatoBadge stato={m.stato} />)}
          </Box>
        </DetailSection>
        <DetailSection title="Workstation">
          {m.inventory ? (
            <ButtonBase onClick={() => onOpenInventory(m.inventory!)} sx={{ display: 'flex', width: '100%', justifyContent: 'flex-start', gap: 1.25, p: '10px 12px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'left', '&:hover': { borderColor: 'text.disabled' } }}>
              <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="server" size={17} /></Box>
              <Box sx={{ flex: 1, display: 'grid', lineHeight: 1.3, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{m.inventory_name}</Typography>
                {wsWhere(m) ? <Typography noWrap component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{wsWhere(m)}</Typography> : null}
              </Box>
              <CampoIcon name="arrowR" size={15} />
            </ButtonBase>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: 'text.secondary' }}>
              Non assegnato a una workstation.{canChange && !deleted ? <Button size="small" variant="text" onClick={onEdit}>Assegna</Button> : null}
            </Box>
          )}
        </DetailSection>
        {siblings.length ? (
          <DetailSection title="Sulla stessa workstation">
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {siblings.map((x) => (
                <ButtonBase key={x.id} onClick={() => onOpenMonitor(x.id)} sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.25, p: '8px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'left', '&:hover': { borderColor: 'text.disabled' } }}>
                  <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="monitor" size={16} /></Box>
                  <Box sx={{ flex: 1, display: 'grid', lineHeight: 1.3, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{monitorTitle(x)}</Typography>
                    {x.seriale ? <Typography noWrap component="span" sx={{ ...mono, fontSize: 11.5, color: 'text.secondary' }}>{x.seriale}</Typography> : null}
                  </Box>
                  <StatoBadge stato={x.stato} />
                </ButtonBase>
              ))}
            </Box>
          </DetailSection>
        ) : null}
        {canAudit ? (
          <DetailSection title="Storia">
            <AuditFeedPanel appLabel="inventory" model="monitor" objectId={m.id} fields={MONITOR_FIELDS} noun="il monitor" />
          </DetailSection>
        ) : null}
      </Box>
    </FloatingDetail>
  )
}

// ── Dialogo nuovo / modifica ───────────────────────────────────────────────

type WsOption = { id: number; name: string; site_name?: string | null; customer_name?: string | null }

function WorkstationPicker({ value, initialLabel, onChange }: { value: number | null; initialLabel?: WsOption | null; onChange: (v: WsOption | null) => void }) {
  const [q, setQ] = React.useState('')
  const [opts, setOpts] = React.useState<WsOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [sel, setSel] = React.useState<WsOption | null>(initialLabel ?? null)
  React.useEffect(() => {
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      api.get<{ results?: WsOption[] }>('/inventories/', { params: { type_key: 'workstation', search: q || undefined, ordering: 'name', page_size: 30 } })
        .then((r) => { if (alive) setOpts(r.data.results ?? []) }).catch(() => { if (alive) setOpts([]) }).finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q])
  return (
    <Autocomplete<WsOption>
      value={value == null ? null : sel}
      options={opts}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onInputChange={(_e, v, reason) => { if (reason === 'input') setQ(v) }}
      onChange={(_e, v) => { setSel(v); onChange(v) }}
      noOptionsText="Nessuna workstation"
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          <Box sx={{ display: 'grid', lineHeight: 1.3 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 550 }}>{o.name}</Typography>
            <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{[o.customer_name, o.site_name].filter(Boolean).join(' · ')}</Typography>
          </Box>
        </li>
      )}
      renderInput={(p) => (
        <TextField {...p} label="Workstation" placeholder="Cerca per nome o sito"
          slotProps={{ input: { ...p.InputProps, endAdornment: <>{loading ? <CircularProgress size={14} /> : null}{p.InputProps.endAdornment}</> } }} />
      )}
    />
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>{label}</Typography>
      <Box role="radiogroup" aria-label={label} sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
        {options.map((o) => {
          const on = o.value === value
          return (
            <ButtonBase key={o.value} role="radio" aria-checked={on} onClick={() => onChange(o.value)} sx={{
              height: 28, px: 1.25, borderRadius: '5px', fontSize: 12.5, fontWeight: 550, color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent',
              '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
            }}>{o.label}</ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}

export function MonitorDialog({ open, initial, form, onForm, busy, onClose, onSave }: {
  open: boolean; initial: MonitorRow | null; form: MonitorForm; onForm: (f: MonitorForm) => void; busy: boolean; onClose: () => void; onSave: () => void
}) {
  const set = <K extends keyof MonitorForm>(k: K, v: MonitorForm[K]) => onForm(setFormField(form, k, v))
  const ok = Boolean(form.produttore.trim())
  const initialWs = initial?.inventory ? { id: initial.inventory, name: initial.inventory_name ?? `#${initial.inventory}`, site_name: initial.site_name, customer_name: initial.customer_name } : null
  return (
    <CampoDialog open={open} onClose={onClose} busy={busy} labelId="monitor-dialog-title"
      title={initial ? `Modifica ${monitorTitle(initial)}` : 'Nuovo monitor'}
      footer={<>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" onClick={onSave} disabled={busy || !ok}>{initial ? 'Salva' : 'Crea monitor'}</Button>
      </>}>
      <WorkstationPicker key={open ? `ws-${initial?.id ?? 'new'}` : 'closed'} value={form.inventory} initialLabel={initialWs} onChange={(v) => set('inventory', v?.id ?? null)} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField label="Produttore" required value={form.produttore} onChange={(e) => set('produttore', e.target.value)} placeholder="es. Eizo" />
        <TextField label="Modello" value={form.modello} onChange={(e) => set('modello', e.target.value)} placeholder="es. RadiForce RX660" />
      </Box>
      <TextField label="Seriale" value={form.seriale} onChange={(e) => set('seriale', e.target.value)} slotProps={{ htmlInput: { style: mono } }} />
      <Segmented<MonitorTipo> label="Tipo" value={form.tipo} onChange={(v) => set('tipo', v)} options={[{ value: 'diagnostico', label: 'Diagnostico' }, { value: 'amministrativo', label: 'Amministrativo' }]} />
      <Segmented<MonitorStato> label="Stato" value={form.stato} onChange={(v) => set('stato', v)} options={STATI.map((s) => ({ value: s, label: STATO_META[s].label }))} />
      <FormControlLabel sx={{ m: 0 }} disabled={form.tipo !== 'diagnostico'}
        control={<Switch size="small" checked={form.radinet} onChange={(e) => set('radinet', e.target.checked)} />}
        label={<Typography sx={{ fontSize: 13 }}>Radinet {form.tipo !== 'diagnostico' ? <Box component="span" sx={{ color: 'text.secondary' }}>· solo per i diagnostici</Box> : null}</Typography>} />
    </CampoDialog>
  )
}
