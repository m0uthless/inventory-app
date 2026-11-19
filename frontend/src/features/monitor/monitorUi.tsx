import * as React from 'react'
import { Autocomplete, Box, Button, ButtonBase, CircularProgress, FormControlLabel, IconButton, ListItemIcon, Menu, MenuItem, Switch, TextField, Tooltip, Typography } from '@mui/material'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { api } from '@shared/api/client'
import {
  BandChip, BandEditing, CampoDialog, CampoIcon, QuickPick, RecordField, RecordGrid, RecordModal, RecordSection, RecordSelect, RecordValue,
  bandButtonSx, bandSolidSx, useRecordDraft,
} from '../../ui/campo'
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

// ── Finestra del monitor ───────────────────────────────────────────────────

type Draft = { produttore: string; modello: string; seriale: string; tipo: string; radinet: string; stato: string; inventory: string }
const toDraft = (m: MonitorRow): Draft => ({ produttore: m.produttore ?? '', modello: m.modello ?? '', seriale: m.seriale ?? '', tipo: m.tipo, radinet: m.radinet ? '1' : '', stato: m.stato, inventory: m.inventory ? String(m.inventory) : '' })

/*
 * Finestra del monitor (anteprima design-previews/rst-base.html › Monitor): «Apri la workstation» come azione
 * principale; lo stato si cambia sul posto; al centro workstation, monitor sulla stessa workstation e storia;
 * a lato i dati, che «Modifica» (⋯) trasforma in campi con un solo salvataggio.
 */
export function MonitorDetailCard({ m, canChange, canDelete, canAudit, busy, position, onPrev, onNext, onClose, onStato, onDelete, onRestore, onOpenInventory, onOpenMonitor, onSaved }: {
  m: MonitorRow; canChange: boolean; canDelete: boolean; canAudit: boolean; busy: boolean
  position?: string; onPrev?: () => void; onNext?: () => void; onClose: () => void
  onStato: (s: MonitorStato) => void; onDelete: () => void; onRestore: () => void
  onOpenInventory: (id: number) => void; onOpenMonitor: (id: number) => void; onSaved: () => void
}) {
  const toast = useToast()
  const [siblings, setSiblings] = React.useState<MonitorRow[]>([])
  React.useEffect(() => {
    if (!m.inventory) { setSiblings([]); return }
    let alive = true
    api.get<{ results?: MonitorRow[] }>('/monitors/', { params: { inventory: m.inventory, page_size: 50 } })
      .then((r) => { if (alive) setSiblings((r.data.results ?? []).filter((x) => x.id !== m.id)) }).catch(() => { if (alive) setSiblings([]) })
    return () => { alive = false }
  }, [m.inventory, m.id])
  const deleted = Boolean(m.deleted_at)
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [ws, setWs] = React.useState<WsOption | null>(null)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(m, () => toDraft(m))
  React.useEffect(() => { setEditing(false); setMenu(null); setWs(null) }, [m.id])
  const v = editing ? draft : toDraft(m)
  const copy = (x: string, ok: string) => { void copyToClipboard(x).then(() => toast.success(ok)) }
  const save = async () => {
    if (!draft.produttore.trim()) { toast.error('Il produttore è obbligatorio.'); return }
    setSaving(true)
    try {
      const t = (x: string) => x.trim() || null
      const value: Record<keyof Draft, unknown> = {
        produttore: draft.produttore.trim(), modello: t(draft.modello), seriale: t(draft.seriale), tipo: draft.tipo,
        radinet: draft.tipo === 'diagnostico' && draft.radinet === '1', stato: draft.stato, inventory: draft.inventory ? Number(draft.inventory) : null,
      }
      const keys = changed.includes('tipo') && draft.tipo !== 'diagnostico' ? [...new Set([...changed, 'radinet' as const])] : changed
      await api.patch(`/monitors/${m.id}/`, Object.fromEntries(keys.map((k) => [k, value[k]])))
      toast.success('Monitor aggiornato.')
      setEditing(false)
      onSaved()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setSaving(false) }
  }
  const stopEditing = () => { reset(); setWs(null); setEditing(false) }
  const chip = (txt: React.ReactNode, warn?: boolean) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const initialWs: WsOption | null = m.inventory ? { id: m.inventory, name: m.inventory_name ?? `#${m.inventory}`, site_name: m.site_name, customer_name: m.customer_name } : null
  const wsShown = editing && isDirty('inventory') ? ws : m.inventory ? { id: m.inventory, name: m.inventory_name ?? '', site_name: m.site_name, customer_name: m.customer_name } : null

  return (
    <RecordModal open onClose={onClose} ariaLabel={`Monitor ${monitorTitle(m)}`} compact
      title={monitorTitle(m)}
      status={<>
        <StatoBadge stato={m.stato} onDark />
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>{TIPO_LABEL[m.tipo] ?? m.tipo}{m.seriale ? <> · S/N <Box component="span" sx={{ ...mono, fontSize: 12 }}>{m.seriale}</Box></> : null}</>}
      tags={<>
        {m.radinet ? chip(<><b>Radinet</b> attivo</>) : null}
        {m.inventory ? chip(<>su <b>{m.inventory_name}</b></>) : chip(<b>non assegnato</b>, true)}
      </>}
      position={position} onPrev={onPrev} onNext={onNext}
      actions={<>
        {deleted ? (canChange ? <Button variant="outlined" disabled={busy} onClick={onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : m.inventory && !editing ? <Button variant="outlined" onClick={() => onOpenInventory(m.inventory!)} startIcon={<CampoIcon name="server" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Apri la workstation</Button> : null}
        {!deleted ? <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" disabled={editing} onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip> : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!canChange} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          {m.seriale ? <MenuItem onClick={() => { setMenu(null); copy(m.seriale!, 'Seriale copiato') }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il seriale</MenuItem> : null}
          <MenuItem disabled={!canDelete} onClick={() => { setMenu(null); onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={saving} onSave={() => void save()} onDiscard={stopEditing}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Workstation">
            {editing ? (
              <Box sx={isDirty('inventory') ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main', borderWidth: 2 } } : undefined}>
                <WorkstationPicker value={draft.inventory ? Number(draft.inventory) : null} initialLabel={isDirty('inventory') ? ws : initialWs} onChange={(o) => { setWs(o); set('inventory')(o ? String(o.id) : '') }} />
              </Box>
            ) : wsShown ? (
              <ButtonBase onClick={() => onOpenInventory(wsShown.id)} sx={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) 16px', width: '100%', gap: 1.5, alignItems: 'center', p: '12px 14px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'left', '&:hover': { borderColor: 'archie.borderStrong' } }}>
                <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="server" size={18} /></Box>
                <Box sx={{ display: 'grid', lineHeight: 1.35, minWidth: 0 }}>
                  <Typography noWrap sx={{ ...mono, fontSize: 13.5, fontWeight: 600 }}>{wsShown.name}</Typography>
                  {wsWhere(m) ? <Typography noWrap component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{wsWhere(m)}</Typography> : null}
                </Box>
                <CampoIcon name="arrowR" size={15} />
              </ButtonBase>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: 'text.secondary' }}>
                Non assegnato a una workstation.{canChange && !deleted ? <Button size="small" variant="text" onClick={() => setEditing(true)}>Assegna</Button> : null}
              </Box>
            )}
          </RecordSection>
          {siblings.length ? (
            <RecordSection title={<>Sulla stessa workstation<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{siblings.length}</Box></>}>
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {siblings.map((x) => (
                  <ButtonBase key={x.id} onClick={() => onOpenMonitor(x.id)} disabled={editing} sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) auto', gap: 1.5, alignItems: 'center', p: '9px 12px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'left', '&:hover': { borderColor: 'archie.borderStrong' } }}>
                    <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="monitor" size={16} /></Box>
                    <Box sx={{ display: 'grid', lineHeight: 1.3, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{monitorTitle(x)}</Typography>
                      {x.seriale ? <Typography noWrap component="span" sx={{ ...mono, fontSize: 11.5, color: 'text.secondary' }}>{x.seriale}</Typography> : null}
                    </Box>
                    <StatoBadge stato={x.stato} />
                  </ButtonBase>
                ))}
              </Box>
            </RecordSection>
          ) : null}
          {canAudit ? (
            <RecordSection title="Storia">
              <AuditFeedPanel appLabel="inventory" model="monitor" objectId={m.id} fields={MONITOR_FIELDS} noun="il monitor" />
            </RecordSection>
          ) : null}
        </Box>

        <Box component="aside" aria-label="Dati del monitor" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Dati">
            <RecordGrid>
              <RecordField editing={editing} label="Produttore" value={v.produttore} onChange={set('produttore')} dirty={isDirty('produttore')} missing />
              <RecordField editing={editing} label="Modello" value={v.modello} onChange={set('modello')} dirty={isDirty('modello')} />
              {editing ? <RecordField editing label="Seriale" value={v.seriale} onChange={set('seriale')} dirty={isDirty('seriale')} mono wide />
                : <RecordValue label="Seriale" wide mono={Boolean(m.seriale)}>{m.seriale ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>{m.seriale}
                  <Tooltip title="Copia il seriale"><IconButton size="small" aria-label="Copia il seriale" onClick={() => copy(m.seriale!, 'Seriale copiato')} sx={{ width: 22, height: 22 }}><CampoIcon name="copy" size={13} /></IconButton></Tooltip></Box> : null}</RecordValue>}
              {editing ? <RecordSelect label="Tipo" value={draft.tipo} onChange={set('tipo')} dirty={isDirty('tipo')} options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))} />
                : <RecordValue label="Tipo">{TIPO_LABEL[m.tipo] ?? m.tipo}</RecordValue>}
              {editing ? <RecordSelect label="Radinet" value={draft.tipo === 'diagnostico' ? draft.radinet : ''} onChange={set('radinet')} dirty={isDirty('radinet')} disabled={draft.tipo !== 'diagnostico'} options={[{ value: '1', label: 'Attivo' }, { value: '', label: 'Non attivo' }]} />
                : <RecordValue label="Radinet">{m.radinet ? 'Attivo' : m.tipo === 'diagnostico' ? 'Non attivo' : <Box component="span" sx={{ color: 'text.secondary' }}>solo per i diagnostici</Box>}</RecordValue>}
              {editing ? <RecordSelect label="Stato" value={draft.stato} onChange={set('stato')} dirty={isDirty('stato')} options={STATI.map((x) => ({ value: x, label: STATO_META[x].label }))} />
                : <QuickPick label="Stato" disabled={!canChange || deleted || busy} value={<StatoBadge stato={m.stato} />}
                  options={STATI.map((x) => ({ value: x, label: <StatoBadge stato={x} />, selected: x === m.stato }))} onPick={(x) => { if (x !== m.stato) onStato(x as MonitorStato) }} />}
            </RecordGrid>
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
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
