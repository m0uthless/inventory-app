import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { keyframes } from '@mui/material/styles'
import { Box, Button, ButtonBase, IconButton, InputBase, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import {
  BandChip, BandEditing, BandStat, CampoIcon, RecordLink, RecordValue, RecordEmpty, RecordInput, RecordLoader, RecordModal, RecordNotes, RecordRow, RecordRows, RecordSection, RecordSelect,
  SectionCount, SoftTag, bandButtonSx, bandSolidSx, recordMono as mono, useList, useRecordDraft, useShownWhenReady,
} from '../../ui/campo'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { useOpenRecord } from '../records/recordStack'
import { disabledFieldsFor, InventoryStatusBadge, isHardwareType, KNumberPlate, type InventoryFieldName } from './inventoryUi'
import { InventoryMaintenancePanel, maintenanceDue, useInventoryMaintenance } from './InventoryMaintenancePanel'

/*
 * Finestra dell'inventario (DESIGN.md › Record window, anteprima design-previews/inv-base.html, variante A
 * «Accesso in primo piano», seconda versione 18/11): al centro accesso (rete e credenziali con lo spazio per
 * il logo), issue aperte e storico delle chiuse, manutenzione e monitor; a lato identità con la targa
 * K-Number, dove si trova, note e attività. I dati si leggono come testo; «Modifica» nel ⋯ (permesso di
 * scrittura) li trasforma tutti in campi, credenziali comprese, con un solo salvataggio.
 */

export type InventoryModalDetail = {
  id: number
  customer: number
  customer_name?: string
  site?: number | null
  site_name?: string
  site_display_name?: string | null
  name: string
  knumber?: string | null
  serial_number?: string | null
  hostname?: string | null
  local_ip?: string | null
  srsa_ip?: string | null
  location?: string | null
  telefono?: string | null
  type?: number | null
  type_key?: string | null
  type_label?: string | null
  status: number
  status_key?: string | null
  status_label?: string | null
  os_user?: string | null
  os_pwd?: string | null
  app_usr?: string | null
  app_pwd?: string | null
  vnc_pwd?: string | null
  manufacturer?: string | null
  model?: string | null
  warranty_end_date?: string | null
  notes?: string | null
  tags?: string[] | null
  deleted_at?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
  monitors?: { id: number; produttore?: string | null; modello?: string | null; seriale?: string | null; tipo_label?: string | null; stato_label?: string | null }[]
}
type Lookup = { id: number; label: string; key?: string }
type SiteOpt = { id: number; name: string; display_name?: string | null }
type IssueRow = { id: number; title: string; status: string; status_label?: string; priority?: string | null; assigned_to_full_name?: string | null; opened_at?: string | null; closed_at?: string | null; resolved_at?: string | null; updated_at?: string | null }

type Draft = {
  name: string; type: string; status: string; knumber: string; serial_number: string; manufacturer: string; model: string; warranty_end_date: string
  site: string; location: string; telefono: string; hostname: string; local_ip: string; srsa_ip: string
  os_user: string; os_pwd: string; app_usr: string; app_pwd: string; vnc_pwd: string; notes: string
}
const SECRET: (keyof Draft)[] = ['os_pwd', 'app_pwd', 'vnc_pwd']
const toDraft = (d: InventoryModalDetail): Draft => ({
  name: d.name ?? '', type: d.type ? String(d.type) : '', status: d.status ? String(d.status) : '', knumber: d.knumber ?? '', serial_number: d.serial_number ?? '',
  manufacturer: d.manufacturer ?? '', model: d.model ?? '', warranty_end_date: d.warranty_end_date ?? '', site: d.site ? String(d.site) : '', location: d.location ?? '',
  telefono: d.telefono ?? '', hostname: d.hostname ?? '', local_ip: d.local_ip ?? '', srsa_ip: d.srsa_ip ?? '', os_user: d.os_user ?? '', os_pwd: d.os_pwd ?? '',
  app_usr: d.app_usr ?? '', app_pwd: d.app_pwd ?? '', vnc_pwd: d.vnc_pwd ?? '', notes: d.notes ?? '',
})
const dIt = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '')
const CLOSED_PREVIEW = 5
const countdown = keyframes({ from: { width: '100%' }, to: { width: '0%' } })

export type InventoryDetailModalProps = {
  detail: InventoryModalDetail | null
  statuses: Lookup[]
  types: Lookup[]
  canChange: boolean
  canDelete: boolean
  canViewSecrets: boolean
  canViewMaintenance?: boolean
  canUploadReports?: boolean
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  /** Dopo un salvataggio: ricarica il dettaglio e l'elenco. */
  onSaved: () => void
  /** Modulo completo (tag e campi personalizzati). */
  onEditAll: () => void
  onDelete: () => void
  onRestore: () => void
  onCopy: (v: string) => void
  onNewIssue: () => void
}

export default function InventoryDetailModal(p: InventoryDetailModalProps) {
  // La pagina monta la finestra solo con l'inventario già caricato (niente finestra di attesa).
  return p.detail ? <InventoryWindow {...p} detail={p.detail} /> : null
}

/** Logo dell'applicazione a destra delle credenziali (public/logos/<nome>.png); senza file resta lo spazio vuoto. */
function LogoSlot({ name, alt }: { name: string; alt: string }) {
  const [ok, setOk] = React.useState(true)
  return (
    <Box sx={{ width: 64, flex: 'none', display: 'grid', placeItems: 'center', borderLeft: '1px solid', borderColor: 'divider', p: 1 }}>
      {ok ? <Box component="img" src={`/logos/${name}.png`} alt={alt} onError={() => setOk(false)} sx={{ maxWidth: 44, maxHeight: 44, objectFit: 'contain' }} /> : null}
    </Box>
  )
}

export function InventoryWindow(p: InventoryDetailModalProps & { detail: InventoryModalDetail }) {
  const d = p.detail
  const toast = useToast()
  const navigate = useNavigate()
  const deleted = Boolean(d.deleted_at)
  const canEdit = p.canChange && !deleted
  const off = disabledFieldsFor(d.type_key)
  const has = (f: InventoryFieldName) => !off.has(f)
  const locked = !p.canViewSecrets

  // ── Dati collegati ──────────────────────────────────────────────
  const open = useList<IssueRow>('/issues/', { inventory: d.id, status: ['open', 'in_progress', 'waiting'], page_size: 100, ordering: '-opened_at' })
  const closed = useList<IssueRow>('/issues/', { inventory: d.id, status: ['resolved', 'closed'], page_size: 500, ordering: '-opened_at' })
  const sites = useList<SiteOpt>('/sites/', { customer: d.customer, page_size: 200, ordering: 'name' })
  const [maintKey, setMaintKey] = React.useState(0)
  const maint = useInventoryMaintenance(d.id, Boolean(p.canViewMaintenance) && !deleted, maintKey)

  // ── Modifica: «Modifica» nel ⋯ trasforma i dati in campi; un solo salvataggio ──
  const [editing, setEditing] = React.useState(false)
  const { draft, changed: allChanged, set, isDirty, reset } = useRecordDraft<Draft>(d, () => toDraft(d))
  const changed = allChanged.filter((k) => !(locked && SECRET.includes(k)))
  const [busy, setBusy] = React.useState(false)
  const v = editing ? draft : toDraft(d)
  const save = async () => {
    if (!draft.name.trim()) { toast.error('Il nome è obbligatorio.'); return }
    if (!draft.status) { toast.error('Scegli lo stato.'); return }
    setBusy(true)
    try {
      const t = (x: string) => x.trim() || null
      const value: Record<keyof Draft, unknown> = {
        name: draft.name.trim(), type: draft.type ? Number(draft.type) : null, status: Number(draft.status), knumber: t(draft.knumber), serial_number: t(draft.serial_number),
        manufacturer: t(draft.manufacturer), model: t(draft.model), warranty_end_date: t(draft.warranty_end_date), site: draft.site ? Number(draft.site) : null,
        location: t(draft.location), telefono: t(draft.telefono), hostname: t(draft.hostname), local_ip: t(draft.local_ip), srsa_ip: t(draft.srsa_ip),
        os_user: t(draft.os_user), os_pwd: t(draft.os_pwd), app_usr: t(draft.app_usr), app_pwd: t(draft.app_pwd), vnc_pwd: t(draft.vnc_pwd), notes: draft.notes,
      }
      await api.patch(`/inventories/${d.id}/`, Object.fromEntries(changed.map((k) => [k, value[k]])))
      toast.success('Inventario salvato.')
      setEditing(false)
      p.onSaved()
    } catch (e) { toast.error(apiErrorToFormFeedback(e).message) } finally { setBusy(false) }
  }
  const stopEditing = () => { reset(); setEditing(false); setShown({}) }

  const blocked = () => { if (editing && changed.length) { toast.error('Salva o annulla le modifiche prima di aprire un altro record.'); return true } return false }
  const go = (path: string) => { if (!blocked()) navigate(path) }
  const openRec = useOpenRecord(blocked, navigate)
  const openCustomer = () => openRec({ kind: 'customer', id: d.customer, label: d.customer_name || 'Cliente' })
  const openSite = (id: number, label: string) => openRec({ kind: 'site', id, label })

  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [shown, setShown] = React.useState<Record<string, boolean>>({})
  const [allClosed, setAllClosed] = React.useState(false)
  // Con ‹ › la finestra resta aperta: lo stato locale riparte col nuovo inventario.
  React.useEffect(() => { setMenu(null); setEditing(false); setShown({}); setAllClosed(false) }, [d.id])

  const status = p.statuses.find((s) => String(s.id) === v.status)
  const statusKey = status?.key ?? d.status_key
  const typeLabel = p.types.find((t) => String(t.id) === v.type)?.label ?? d.type_label ?? ''
  const siteId = v.site ? Number(v.site) : null
  const siteLabel = sites?.find((s) => s.id === siteId)?.display_name || sites?.find((s) => s.id === siteId)?.name || (siteId === d.site ? d.site_display_name || d.site_name : '') || ''
  const scrollTo = (id: string) => document.getElementById(`inv-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const warrantyOver = Boolean(d.warranty_end_date && d.warranty_end_date.slice(0, 10) < new Date().toISOString().slice(0, 10))
  // Manutenzione: per l'hardware; gli applicativi la mostrano solo se hanno già piani o interventi.
  const showMaint = maint !== undefined && (isHardwareType(d.type_key) || Boolean(maint && (maint.plans.length || maint.events.length)))
  const shown_ = useShownWhenReady(Boolean(open && closed && sites && maint !== null))

  // ── Campi: testo in lettura, campo in modifica ──────────────────
  const field = (label: string, k: keyof Draft, opts: { monoText?: boolean; wide?: boolean; placeholder?: string; type?: 'date'; show?: (x: string) => React.ReactNode } = {}) => (
    editing ? (
      <Box sx={{ gridColumn: opts.wide ? '1 / -1' : undefined, minWidth: 0 }}>
        {opts.type === 'date' ? (
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            <Typography component="label" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>{label}</Typography>
            <InputBase type="date" value={draft[k]} onChange={(e) => set(k)(e.target.value)} inputProps={{ 'aria-label': label }}
              sx={(t) => ({ height: 34, px: 1.25, fontSize: 13, borderRadius: '6px', border: '1px solid', bgcolor: 'background.paper', borderColor: isDirty(k) ? 'warning.main' : 'divider', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: t.palette.archie.focusRing } })} />
          </Box>
        ) : <RecordInput label={label} value={draft[k]} onChange={set(k)} dirty={isDirty(k)} mono={opts.monoText} placeholder={opts.placeholder} />}
      </Box>
    ) : <RecordValue label={label} wide={opts.wide} mono={opts.monoText}>{v[k] ? (opts.show ? opts.show(v[k]) : v[k]) : null}</RecordValue>
  )
  const copyBtn = (value: string, label: string) => (
    <Tooltip title="Copia"><IconButton size="small" aria-label={label} onClick={() => p.onCopy(value)} sx={{ width: 28, height: 28 }}><CampoIcon name="copy" size={14} /></IconButton></Tooltip>
  )

  // ── Accesso: rete e credenziali ─────────────────────────────────
  const net = ([['hostname', 'Hostname'], ['local_ip', 'IP locale'], ['srsa_ip', 'IP SRSA']] as const).filter(([f]) => has(f) && (editing || v[f]))
  const credRow = (label: string, k: keyof Draft, secret?: boolean) => {
    const value = v[k]
    const isShown = Boolean(shown[k])
    return (
      <Box key={k} sx={{ position: 'relative', display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) auto', alignItems: 'center', gap: 1, minHeight: 40, pl: 1.5, pr: 0.5, '& + &': { borderTop: '1px solid', borderColor: 'divider' }, ...(isShown && !editing ? { bgcolor: 'warning.light' } : {}) }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
        {secret && locked ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{editing ? 'Serve il permesso Credenziali per cambiarla' : 'Serve il permesso Credenziali'}</Typography>
          : editing ? (
            <InputBase value={draft[k]} type={secret && !isShown ? 'password' : 'text'} onChange={(e) => set(k)(e.target.value)} autoComplete="new-password" inputProps={{ 'aria-label': `${label} ${k}` }}
              sx={(t) => ({ height: 30, px: 1, fontSize: 12.5, borderRadius: '6px', border: '1px solid', bgcolor: 'background.paper', borderColor: isDirty(k) ? 'warning.main' : 'divider', '& input': mono, '&.Mui-focused': { borderColor: 'primary.main', boxShadow: t.palette.archie.focusRing } })} />
          ) : (
            <Box sx={{ ...mono, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'text.primary' : 'text.disabled' }}>
              {!value ? '—' : secret && !isShown ? <Box component="span" sx={{ letterSpacing: '.12em', color: 'text.secondary' }}>••••••••</Box> : value}
            </Box>
          )}
        <Box sx={{ display: 'inline-flex' }}>
          {secret && !locked && (editing || value) ? (
            <Tooltip title={isShown ? 'Nascondi' : editing ? 'Mostra' : 'Mostra · si nasconde dopo 30 secondi'}>
              <IconButton size="small" aria-pressed={isShown} aria-label={`${isShown ? 'Nascondi' : 'Mostra'} la password`} onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))} sx={{ width: 28, height: 28, color: isShown ? 'warning.main' : undefined }}>
                <CampoIcon name={isShown ? 'eyeOff' : 'eye'} size={14} />
              </IconButton>
            </Tooltip>
          ) : null}
          {!editing && value && !(secret && locked) ? copyBtn(value, `Copia ${secret ? 'la password' : "l'utente"}`) : null}
        </Box>
        {isShown && !editing ? <Box aria-hidden sx={{ position: 'absolute', left: 0, bottom: 0, height: 2, bgcolor: 'warning.main', animation: `${countdown} 30s linear forwards`, '@media (prefers-reduced-motion: reduce)': { animation: 'none', width: '100%' } }} /> : null}
      </Box>
    )
  }
  // La password mostrata si nasconde da sola dopo 30 secondi (non in modifica).
  React.useEffect(() => {
    if (editing || !Object.values(shown).some(Boolean)) return
    const t = window.setTimeout(() => setShown({}), 30000)
    return () => window.clearTimeout(t)
  }, [shown, editing])

  type Group = { key: string; title: string; logo: string; rows: React.ReactNode[] }
  const groups: Group[] = []
  const anyOf = (...ks: (keyof Draft)[]) => editing || ks.some((k) => v[k])
  if ((has('os_user') || has('os_pwd')) && anyOf('os_user', 'os_pwd')) groups.push({ key: 'os', title: 'Sistema operativo', logo: 'os', rows: [has('os_user') ? credRow('Utente', 'os_user') : null, has('os_pwd') ? credRow('Password', 'os_pwd', true) : null] })
  if ((has('app_usr') || has('app_pwd')) && anyOf('app_usr', 'app_pwd')) groups.push({ key: 'app', title: 'Applicazione', logo: 'app', rows: [has('app_usr') ? credRow('Utente', 'app_usr') : null, has('app_pwd') ? credRow('Password', 'app_pwd', true) : null] })
  if (has('vnc_pwd') && anyOf('vnc_pwd')) groups.push({ key: 'vnc', title: 'Accesso remoto VNC', logo: 'vnc', rows: [credRow('Password', 'vnc_pwd', true)] })

  // ── Issue: aperte, poi lo storico delle chiuse ──────────────────
  const issueRow = (i: IssueRow, done?: boolean) => (
    <RecordRow key={i.id} lead={<Box component="span" sx={{ ...mono, fontSize: 12 }}>#{i.id}</Box>} leadWidth={52}
      title={<Box component="span" sx={done ? { fontWeight: 500, color: 'text.secondary' } : undefined}>{i.title}</Box>}
      sub={[i.assigned_to_full_name, i.opened_at ? `aperta il ${dIt(i.opened_at)}` : null].filter(Boolean).join(' · ') || undefined}
      end={<SoftTag tone={done ? 'neutral' : i.status === 'in_progress' ? 'warning' : i.status === 'waiting' ? 'neutral' : 'info'}>{i.status_label ?? i.status}</SoftTag>}
      onClick={() => go(`/issues${buildQuery({ open: i.id })}`)} />
  )
  const closedShown = closed ? (allClosed ? closed : closed.slice(0, CLOSED_PREVIEW)) : null

  return (
    <RecordModal open={shown_} onClose={p.onClose} ariaLabel={`Inventario ${d.name}`} compact
      title={v.name.trim() || d.name}
      status={<>
        {typeLabel ? <BandChip>{typeLabel}</BandChip> : null}
        {status && statusKey !== 'in_use' ? <BandChip>{status.label}</BandChip> : !status && d.status_label && d.status_key !== 'in_use' ? <BandChip>{d.status_label}</BandChip> : null}
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>
        {d.hostname ? <><Box component="span" sx={{ ...mono, fontSize: 12 }}>{d.hostname}</Box> · </> : null}
        <BandLink onClick={openCustomer}>{d.customer_name || 'Cliente'}</BandLink>
        {d.site ? <> · <BandLink onClick={() => openSite(d.site!, d.site_display_name || d.site_name || 'Sito')}>{d.site_display_name || d.site_name || 'Sito'}</BandLink></> : ' · senza sito'}
        {d.knumber ? <> · <Box component="span" sx={{ ...mono, fontSize: 12 }}>{d.knumber}</Box></> : null}
      </>}
      tags={<>
        <BandStat n={open?.length ?? null} one=" issue aperta" many=" issue aperte" warn={open && open.length ? 'Issue aperte su questo sistema' : undefined} onClick={() => scrollTo('iss')} />
        {closed && closed.length ? <BandStat n={closed.length} one=" chiusa" many=" chiuse" onClick={() => scrollTo('iss')} /> : null}
        {maint && maintenanceDue(maint) ? <BandStat n={maint.plans.length} one=" piano in scadenza" many=" piani · manutenzione in scadenza" warn="Manutenzione scaduta o in scadenza" onClick={() => scrollTo('man')} /> : null}
        {d.monitors && d.monitors.length ? <BandStat n={d.monitors.length} one=" monitor" many=" monitor" onClick={() => scrollTo('mon')} /> : null}
        {warrantyOver ? <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', bgcolor: 'rgb(224 164 58 / .28)', color: '#fde9c4' }}>garanzia scaduta il {dIt(d.warranty_end_date)}</Box> : null}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : !editing ? <Button variant="outlined" onClick={p.onNewIssue} startIcon={<CampoIcon name="plus" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Nuova issue</Button> : null}
        {!deleted ? <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip> : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!canEdit || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          <MenuItem disabled={!canEdit} onClick={() => { setMenu(null); p.onEditAll() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tag e campi personalizzati…</MenuItem>
          {d.hostname ? <MenuItem onClick={() => { setMenu(null); p.onCopy(d.hostname!) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia l'hostname</MenuItem> : null}
          {d.local_ip ? <MenuItem onClick={() => { setMenu(null); p.onCopy(d.local_ip!) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia l'IP locale</MenuItem> : null}
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={stopEditing}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="lock" size={14} />Accesso</Box>}
            end={<Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.875, py: '1px' }}>credenziali solo qui</Box>}>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {net.length ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${net.length}, minmax(0,1fr))` }, gap: 1 }}>
                  {net.map(([f, l]) => (
                    <Box key={f} sx={{ position: 'relative', display: 'grid', gap: '2px', minWidth: 0, p: editing ? '8px 10px' : '10px 36px 10px 12px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                      {editing ? <RecordInput label={l} value={draft[f]} onChange={set(f)} dirty={isDirty(f)} mono /> : (
                        <>
                          <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{l}</Typography>
                          <Box component="span" sx={{ ...mono, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v[f]}</Box>
                          <Box sx={{ position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%)' }}>{copyBtn(v[f], `Copia ${l}`)}</Box>
                        </>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : null}
              {groups.length ? groups.map((g) => (
                <Box key={g.key} sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{g.title}</Typography>
                  <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>{g.rows}</Box>
                    <LogoSlot name={g.logo} alt={g.title} />
                  </Box>
                </Box>
              )) : <RecordEmpty>Nessuna credenziale registrata per questo sistema.</RecordEmpty>}
              <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', fontSize: 11, color: 'text.disabled', lineHeight: 1.45, '& svg': { flex: 'none', mt: '2px' } }}>
                <CampoIcon name="lock" size={12} />Le password si vedono solo con il permesso Credenziali e si nascondono da sole dopo 30 secondi.
              </Typography>
            </Box>
          </RecordSection>

          <Box id="inv-iss" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Issue{open && closed ? <Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{open.length} aperte · {closed.length} chiuse</Box> : null}</>}
              end={!deleted ? <Button size="small" onClick={p.onNewIssue}>+ Nuova issue</Button> : undefined}>
              {!open ? <RecordLoader /> : open.length ? <RecordRows>{open.map((i) => issueRow(i))}</RecordRows> : <RecordEmpty>Nessuna issue aperta.</RecordEmpty>}
              <Typography component="h4" sx={{ mt: 2, mb: 0.5, fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                Storico · chiuse{closed ? <Box component="span" sx={{ ml: 0.75, fontWeight: 400 }}>{closed.length}</Box> : null}
              </Typography>
              {!closedShown ? <RecordLoader /> : closedShown.length ? (
                <>
                  <RecordRows>{closedShown.map((i) => issueRow(i, true))}</RecordRows>
                  {closed && closed.length > CLOSED_PREVIEW ? <Button size="small" sx={{ mt: 1 }} onClick={() => setAllClosed((x) => !x)}>{allClosed ? 'Mostra meno' : `Mostra tutte le ${closed.length}`}</Button> : null}
                </>
              ) : <RecordEmpty>Nessuna issue chiusa.</RecordEmpty>}
            </RecordSection>
          </Box>

          {showMaint ? (
            <Box id="inv-man" sx={{ scrollMarginTop: 16 }}>
              <RecordSection title="Manutenzione">
                <InventoryMaintenancePanel data={maint} canUpload={Boolean(p.canUploadReports)} onChanged={() => setMaintKey((k) => k + 1)} onOpenModule={() => go('/maintenance')} />
              </RecordSection>
            </Box>
          ) : null}

          {d.monitors && d.monitors.length ? (
            <Box id="inv-mon" sx={{ scrollMarginTop: 16 }}>
              <RecordSection title={<>Monitor<SectionCount n={d.monitors.length} /></>}>
                <RecordRows>
                  {d.monitors.map((m) => (
                    <RecordRow key={m.id} lead={<CampoIcon name="monitor" size={18} />} title={[m.produttore, m.modello].filter(Boolean).join(' ') || `Monitor #${m.id}`}
                      sub={<>{m.tipo_label}{m.seriale ? <> · <Box component="span" sx={mono}>{m.seriale}</Box></> : null}</>} end={m.stato_label ?? undefined} />
                  ))}
                </RecordRows>
              </RecordSection>
            </Box>
          ) : null}
        </Box>

        {/* ── Colonna laterale ── */}
        <Box component="aside" aria-label="Inventario" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Identità">
            {v.knumber && /\d/.test(v.knumber) ? <Box sx={{ mb: 1.75 }}><KNumberPlate knumber={v.knumber} maxWidth={284} /></Box> : null}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              {field('Nome', 'name', { wide: true })}
              {editing ? <RecordSelect label="Tipo" value={draft.type} onChange={set('type')} dirty={isDirty('type')} options={[{ value: '', label: '—' }, ...p.types.map((t) => ({ value: String(t.id), label: t.label }))]} />
                : <RecordValue label="Tipo">{typeLabel || null}</RecordValue>}
              {editing ? <RecordSelect label="Stato" value={draft.status} onChange={set('status')} dirty={isDirty('status')} options={p.statuses.map((s) => ({ value: String(s.id), label: s.label }))} />
                : <RecordValue label="Stato">{d.status_label ? <InventoryStatusBadge statusKey={d.status_key} label={d.status_label} /> : null}</RecordValue>}
              {field('K-Number', 'knumber', { monoText: true, placeholder: 'K-000000' })}
              {field('Seriale', 'serial_number', { monoText: true })}
              {has('manufacturer') ? field('Produttore', 'manufacturer') : null}
              {has('model') ? field('Modello', 'model') : null}
              {has('warranty_end_date') ? field('Fine garanzia', 'warranty_end_date', { type: 'date', show: dIt }) : null}
            </Box>
          </RecordSection>

          <RecordSection title="Dove si trova">
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <RecordValue label="Cliente"><RecordLink onClick={openCustomer}>{d.customer_name || 'Cliente'}</RecordLink></RecordValue>
              {editing ? (
                <RecordSelect label="Sito" value={draft.site} onChange={set('site')} dirty={isDirty('site')}
                  options={[{ value: '', label: 'Nessun sito' }, ...(sites ?? []).map((s) => ({ value: String(s.id), label: s.display_name || s.name }))]} />
              ) : <RecordValue label="Sito">{siteId ? <RecordLink onClick={() => openSite(siteId, siteLabel || 'Sito')}>{siteLabel || 'Sito'}</RecordLink> : <Box component="span" sx={{ color: 'warning.main', fontWeight: 550 }}>Nessun sito</Box>}</RecordValue>}
              {has('location') ? field('Posizione', 'location', { wide: true, placeholder: 'es. Sala server, piano 2' }) : null}
              {has('telefono') ? field('Telefono', 'telefono', { monoText: true, placeholder: 'Interno o diretto' }) : null}
            </Box>
          </RecordSection>

          <RecordSection title="Note">
            {editing ? <RecordNotes value={draft.notes} onChange={set('notes')} dirty={isDirty('notes')} placeholder="Note interne sul sistema" />
              : d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <RecordEmpty>Nessuna nota.</RecordEmpty>}
            {d.tags && d.tags.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.25 }}>
                {d.tags.map((t) => <Box key={t} component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.75, borderRadius: '4px', bgcolor: 'archie.neutralBg', color: 'text.secondary' }}>{t}</Box>)}
              </Box>
            ) : null}
          </RecordSection>

          <RecordSection title="Attività recente">
            <AuditFeedPanel appLabel="inventory" model="inventory" objectId={d.id} fields={INVENTORY_FIELDS} noun="l'inventario" limit={5} reloadKey={d} />
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}

/** Collegamento nel sottotitolo della testata. */
function BandLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} sx={{ font: 'inherit', color: '#fff', fontWeight: 600, verticalAlign: 'baseline', textDecoration: 'underline', textDecorationColor: 'rgb(255 255 255 / .4)', textUnderlineOffset: '3px', '&:hover': { textDecorationColor: '#fff' }, '&.Mui-focusVisible': { outline: '2px solid rgb(255 255 255 / .6)', borderRadius: '3px' } }}>{children}</ButtonBase>
  )
}

const INVENTORY_FIELDS: Record<string, string> = {
  name: 'il nome', hostname: "l'hostname", local_ip: "l'IP locale", srsa_ip: "l'IP SRSA", knumber: 'il K-Number', serial_number: 'il seriale', status: 'lo stato', type: 'il tipo',
  site: 'il sito', location: 'la posizione', telefono: 'il telefono', manufacturer: 'il produttore', model: 'il modello', warranty_end_date: 'la fine garanzia', notes: 'le note',
  os_user: "l'utente OS", app_usr: "l'utente app", os_pwd: 'la password OS', app_pwd: 'la password app', vnc_pwd: 'la password VNC', tags: 'i tag', custom_fields: 'i campi personalizzati',
}

