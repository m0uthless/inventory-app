import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, IconButton, InputBase, ListItemIcon, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import {
  CampoIcon, RecordEmpty, RecordModal, RecordRow, RecordRows, RecordSection, SectionCount, SoftTag, bandButtonSx, useList,
} from '../../ui/campo'
import LeafletMap from '../../ui/LeafletMap'
import DeviceDialog from '../devices/DeviceDialog'
import { deviceLabel, type DeviceListItem } from '../devices/types'
import type { ContractListItem } from '../contracts/types'
import { AuditFeedPanel } from './CustomerTabs'
import { daysTo, dIt, EXPIRING_DAYS } from './customerUi'

/*
 * Finestra del cliente (DESIGN.md › Record window, anteprima design-previews/core-base.html,
 * variante A «Tutto in vista»): testata snella con conteggi che portano alla sezione; al centro
 * issue aperte, siti, inventari (e device), contratti e documenti; a lato anagrafica modificabile,
 * referenti, accesso remoto, dove, note e ultime modifiche. Un solo salvataggio per anagrafica e note.
 */

export type CustomerModalDetail = {
  id: number
  code: string
  name: string
  display_name: string
  city?: string | null
  province?: string | null
  primary_contact_id?: number | null
  vat_number?: string | null
  tax_code?: string | null
  status?: number | null
  status_label?: string | null
  notes?: string | null
  has_vpn?: boolean | null
  deleted_at?: string | null
}

type Contact = { id: number; name: string; email?: string | null; phone?: string | null; department?: string | null; is_primary?: boolean; site?: number | null; site_name?: string | null; site_display_name?: string | null }
type Vpn = { applicativo?: string | null; utenza?: string | null; password?: string | null; remote_address?: string | null; porta?: string | null }
type SiteRow = { id: number; name?: string | null; display_name?: string | null; city?: string | null; address_line1?: string | null; province?: string | null; status_label?: string | null }
type InvRow = { id: number; site?: number | null; site_name?: string | null; site_display_name?: string | null; name?: string | null; hostname?: string | null; knumber?: string | null; type_label?: string | null; local_ip?: string | null; has_active_issue?: boolean }
type IssueRow = { id: number; title: string; status: string; status_label: string; site?: number | null; site_name?: string | null; inventory_name?: string | null }
type DriveRow = { id: number; name: string; updated_at: string; size_human?: string }

const ACTIVE_ISSUES = ['open', 'in_progress', 'waiting']
const INV_PREVIEW = 6
const mono = { fontFamily: '"Geist Mono", ui-monospace, monospace' }
const issueTone = (s: string): 'warning' | 'neutral' | 'info' => (s === 'in_progress' ? 'warning' : s === 'waiting' ? 'neutral' : 'info')
const typeTone = (t?: string | null) => { const k = (t || '').toLowerCase(); return (/server|storage|nas/.test(k) ? 'sky' : /modal|ct|rm|ecograf|mammo|dr\b/.test(k) ? 'mint' : /rete|router|switch|firewall|vpn/.test(k) ? 'sand' : 'neutral') as 'sky' | 'mint' | 'sand' | 'neutral' }

type Draft = { name: string; display_name: string; status: string; vat_number: string; tax_code: string; province: string; notes: string }
const toDraft = (d: CustomerModalDetail): Draft => ({
  name: d.name ?? '', display_name: d.display_name ?? '', status: d.status ? String(d.status) : '', vat_number: d.vat_number ?? '',
  tax_code: d.tax_code ?? '', province: d.province ?? '', notes: d.notes ?? '',
})

export type CustomerDetailModalProps = {
  detail: CustomerModalDetail | null
  loading: boolean
  statuses: { id: number; label: string }[]
  vendorColor: (label: string) => string
  canChange: boolean
  canDelete: boolean
  canEditVpn: boolean
  showContracts: boolean
  showDevices: boolean
  canEditDevices: boolean
  /** Indirizzo dai campi personalizzati ("via, civico, città"), per la mappa. */
  address: string | null
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  /** Dopo un salvataggio: ricarica il dettaglio e l'elenco. */
  onSaved: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onCopy: (v: string) => void
  onEditVpn: () => void
  onNewIssue: () => void
  /** Ricarica VPN e contatti (dopo il modulo VPN). */
  reloadKey?: unknown
}

export default function CustomerDetailModal(p: CustomerDetailModalProps) {
  // La pagina monta la finestra solo con il cliente già caricato (niente finestra di attesa).
  return p.detail ? <CustomerWindow {...p} detail={p.detail} /> : null
}

function CustomerWindow(p: CustomerDetailModalProps & { detail: CustomerModalDetail }) {
  const d = p.detail
  const toast = useToast()
  const navigate = useNavigate()
  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted

  // ── Dati collegati ──────────────────────────────────────────────
  const issues = useList<IssueRow>('/issues/', { customer: d.id, status: ACTIVE_ISSUES, page_size: 100, ordering: '-created_at' })
  const sites = useList<SiteRow>('/sites/', { customer: d.id, page_size: 200, ordering: 'name' })
  const invs = useList<InvRow>('/inventories/', { customer: d.id, page_size: 500, ordering: 'site__name' })
  const [devReload, setDevReload] = React.useState(0)
  const devices = useList<DeviceListItem>('/devices/', p.showDevices ? { customer: d.id, page_size: 200 } : null, devReload)
  const contracts = useList<ContractListItem>('/contracts/', p.showContracts ? { customer: d.id, page_size: 50, ordering: 'end_date' } : null)
  const files = useList<DriveRow>('/drive-files/', { customer: d.id, page_size: 5, ordering: '-updated_at' })
  const contacts = useList<Contact>('/contacts/', { customer: d.id, page_size: 100, ordering: 'name' }, p.reloadKey)
  const [vpn, setVpn] = React.useState<Vpn | null>(null)
  React.useEffect(() => {
    setVpn(null)
    if (!d.has_vpn) return
    let alive = true
    api.get<Vpn>(`/customers/${d.id}/vpn/`).then((r) => { if (alive) setVpn(r.data) }).catch(() => { if (alive) setVpn(null) })
    return () => { alive = false }
  }, [d.id, d.has_vpn, p.reloadKey])
  const [pwShown, setPwShown] = React.useState(false)
  React.useEffect(() => { if (!pwShown) return; const t = window.setTimeout(() => setPwShown(false), 30000); return () => window.clearTimeout(t) }, [pwShown])

  // ── Anagrafica e note: modifiche locali, un solo salvataggio ────
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(d))
  React.useEffect(() => { setDraft(toDraft(d)) }, [d])
  const orig = toDraft(d)
  const changed = (Object.keys(orig) as (keyof Draft)[]).filter((k) => draft[k].trim() !== orig[k].trim())
  const set = (k: keyof Draft) => (v: string) => setDraft((x) => ({ ...x, [k]: v }))
  const [busy, setBusy] = React.useState(false)
  const save = async () => {
    if (!draft.name.trim()) { toast.error('La ragione sociale è obbligatoria.'); return }
    setBusy(true)
    try {
      // Solo i campi cambiati: un campo vuoto mai toccato resta com'era (es. nome breve null).
      const value: Record<keyof Draft, unknown> = {
        name: draft.name.trim(), display_name: draft.display_name.trim() || draft.name.trim(), status: draft.status ? Number(draft.status) : null,
        vat_number: draft.vat_number.trim() || null, tax_code: draft.tax_code.trim() || null, province: draft.province.trim().toUpperCase() || null, notes: draft.notes,
      }
      await api.patch(`/customers/${d.id}/`, Object.fromEntries(changed.map((k) => [k, value[k]])))
      toast.success('Cliente salvato.')
      p.onSaved()
    } catch (e) { toast.error(apiErrorToFormFeedback(e).message) } finally { setBusy(false) }
  }
  // Uscire verso un'altra pagina con modifiche in sospeso le perderebbe: prima si salva o si annulla.
  const go = (path: string) => { if (changed.length) { toast.error('Salva o annulla le modifiche prima di aprire un altro record.'); return } navigate(path) }

  // ── Testata ─────────────────────────────────────────────────────
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const vendorLabel = p.statuses.find((s) => String(s.id) === draft.status)?.label ?? d.status_label ?? ''
  const nextContract = (contracts ?? []).map((c) => ({ c, n: daysTo(c.end_date) })).filter((x) => x.n >= 0).sort((a, b) => a.n - b.n)[0]
  const soon = nextContract && nextContract.n <= EXPIRING_DAYS ? nextContract : null
  const scrollTo = (id: string) => document.getElementById(`cust-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const stat = (id: string, n: number | null, one: string, many: string, warn?: string) => (
    <ButtonBase key={id} onClick={() => scrollTo(id)} title={warn} sx={{
      height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee',
      '&:hover': { bgcolor: warn ? 'rgb(224 164 58 / .4)' : 'rgb(255 255 255 / .22)', color: '#fff' }, '& b': { fontWeight: 700, color: '#fff', mr: 0.5 },
      '&.Mui-focusVisible': { boxShadow: '0 0 0 2px rgb(255 255 255 / .6)' },
    }}><b>{n ?? '…'}</b>{n === 1 ? one : many}</ButtonBase>
  )
  const solidBand = { bgcolor: '#fff', color: 'archie.band', borderColor: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#e9f3f0', borderColor: '#e9f3f0' } } as const

  // ── Inventari: filtro per tipo, i primi sei ─────────────────────
  const [invType, setInvType] = React.useState('')
  const [invAll, setInvAll] = React.useState(false)
  const types = [...new Set((invs ?? []).map((i) => i.type_label).filter((x): x is string => Boolean(x)))].sort()
  const invFiltered = (invs ?? []).filter((i) => !invType || i.type_label === invType)
  const invShown = invAll ? invFiltered : invFiltered.slice(0, INV_PREVIEW)
  const [editingDevice, setEditingDevice] = React.useState<DeviceListItem | null>(null)
  // Con ‹ › la finestra resta aperta (niente nuova animazione): lo stato locale riparte col nuovo cliente.
  React.useEffect(() => { setMenu(null); setPwShown(false); setInvType(''); setInvAll(false); setEditingDevice(null) }, [d.id])

  const siteStats = React.useMemo(() => {
    const inv = new Map<number, number>(); (invs ?? []).forEach((i) => { if (i.site) inv.set(i.site, (inv.get(i.site) ?? 0) + 1) })
    const iss = new Map<number, number>(); (issues ?? []).forEach((i) => { if (i.site) iss.set(i.site, (iss.get(i.site) ?? 0) + 1) })
    return { inv, iss }
  }, [invs, issues])

  const field = (label: React.ReactNode, k: keyof Draft, opts: { mono?: boolean; placeholder?: string; missing?: boolean; max?: number } = {}) => {
    const dirty = draft[k].trim() !== orig[k].trim()
    const miss = opts.missing && !draft[k].trim()
    return (
      <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
        <Typography component="label" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>
          {label}{miss ? <Box component="span" sx={{ ml: 0.75, color: 'warning.main', fontWeight: 600 }}>manca</Box> : null}
        </Typography>
        <InputBase value={draft[k]} disabled={!editable} placeholder={opts.placeholder} onChange={(e) => set(k)(e.target.value)}
          inputProps={{ 'aria-label': typeof label === 'string' ? label : k, maxLength: opts.max }}
          sx={(t) => ({
            height: 34, px: 1.25, fontSize: 13, borderRadius: '6px', border: '1px solid', bgcolor: 'background.paper',
            borderColor: dirty ? 'warning.main' : miss ? 'warning.light' : 'divider', ...(opts.mono ? { '& input': { ...mono, fontSize: 12.5 } } : {}),
            '&.Mui-focused': { borderColor: 'primary.main', boxShadow: t.palette.archie.focusRing },
          })} />
      </Box>
    )
  }
  const readOnly = (label: string, value: React.ReactNode) => (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ height: 34, display: 'flex', alignItems: 'center', px: 1.25, borderRadius: '6px', bgcolor: 'archie.surface2', fontSize: 13, color: 'text.secondary', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{value}</Box>
    </Box>
  )

  const copyBtn = (v: string, label: string) => (
    <Tooltip title="Copia"><IconButton size="small" aria-label={label} onClick={() => p.onCopy(v)} sx={{ width: 28, height: 28 }}><CampoIcon name="copy" size={14} /></IconButton></Tooltip>
  )
  const credRow = (label: string, value: React.ReactNode, actions: React.ReactNode) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) auto', alignItems: 'center', gap: 1, minHeight: 38, pl: 1.5, pr: 0.5, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...mono }}>{value}</Box>
      <Box sx={{ display: 'inline-flex' }}>{actions}</Box>
    </Box>
  )

  const addr = (p.address ?? '').split(', ')
  const cityPart = addr.length > 1 ? addr.pop()! : ''
  const street = addr.join(', ')
  const primary = contacts?.find((c) => c.id === d.primary_contact_id || c.is_primary)
  const people = contacts ? [...(primary ? [primary] : []), ...contacts.filter((c) => c !== primary)] : null

  // La prima apertura aspetta i dati principali (al massimo 700 ms): la finestra compare già piena,
  // senza sezioni che si riempiono una alla volta. Dopo, con ‹ ›, resta aperta.
  const listsReady = Boolean(issues && sites && invs && contacts && files && (!p.showContracts || contracts))
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => { if (listsReady) setShown(true) }, [listsReady])
  React.useEffect(() => { const t = window.setTimeout(() => setShown(true), 700); return () => window.clearTimeout(t) }, [])
  const help = { fontSize: 12, color: 'text.secondary' } as const

  return (
    <RecordModal open={shown} onClose={p.onClose} ariaLabel={`Cliente ${d.display_name || d.name}`} compact
      title={draft.display_name.trim() || d.display_name || d.name}
      status={<>
        {vendorLabel ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 11.5, fontWeight: 600, px: 1, py: '2px', borderRadius: '5px', bgcolor: 'rgb(255 255 255 / .16)' }}><Box component="i" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.vendorColor(vendorLabel) }} />{vendorLabel}</Box> : null}
        {deleted ? <Box component="span" sx={{ fontSize: 11.5, fontWeight: 600, px: 1, py: '2px', borderRadius: '5px', bgcolor: 'rgb(255 255 255 / .16)' }}>Nel cestino</Box> : null}
      </>}
      subtitle={<><Box component="span" sx={{ ...mono, fontSize: 12 }}>{d.code}</Box> · {draft.name || d.name}{d.city ? ` · ${d.city}${draft.province ? ` (${draft.province.toUpperCase()})` : ''}` : ''} · {draft.vat_number ? <>P.IVA <Box component="span" sx={{ ...mono, fontSize: 12 }}>{draft.vat_number}</Box></> : 'P.IVA mancante'}</>}
      tags={<>
        {stat('sites', sites?.length ?? null, ' sito', ' siti')}
        {stat('inv', invs?.length ?? null, ' inventario', ' inventari')}
        {stat('iss', issues?.length ?? null, ' issue aperta', ' issue aperte')}
        {p.showContracts ? stat('doc', contracts?.length ?? null, ' contratto', ' contratti', soon ? `${soon.c.title} scade il ${dIt(soon.c.end_date)}` : undefined) : null}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted
          ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...solidBand }}>Ripristina</Button> : null)
          : <Button variant="outlined" onClick={p.onNewIssue} startIcon={<CampoIcon name="plus" size={15} />} sx={{ ...bandButtonSx, ...solidBand }}>Nuova issue</Button>}
        {!deleted ? (
          <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        ) : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!p.canChange} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica tutti i campi</MenuItem>
          <MenuItem onClick={() => { setMenu(null); p.onCopy(d.code) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il codice cliente</MenuItem>
          {d.vat_number ? <MenuItem onClick={() => { setMenu(null); p.onCopy(d.vat_number!) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia la P.IVA</MenuItem> : null}
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      dirtyCount={editable ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={() => setDraft(toDraft(d))}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale: i record collegati ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Box id="cust-iss" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Issue aperte<SectionCount n={issues?.length} /></>} end={!deleted ? <Button size="small" onClick={p.onNewIssue}>+ Nuova issue</Button> : undefined}>
              {!issues ? <Loader /> : issues.length ? (
                <RecordRows>
                  {issues.map((i) => (
                    <RecordRow key={i.id} lead={<Box component="span" sx={{ ...mono, fontSize: 12 }}>#{i.id}</Box>} leadWidth={52}
                      title={i.title} sub={[i.site_name, i.inventory_name].filter(Boolean).join(' · ') || undefined}
                      end={<SoftTag tone={issueTone(i.status)}>{i.status_label}</SoftTag>}
                      onClick={() => go(`/issues${buildQuery({ open: i.id })}`)} />
                  ))}
                </RecordRows>
              ) : <RecordEmpty>Nessuna issue aperta.</RecordEmpty>}
            </RecordSection>
          </Box>

          <Box id="cust-sites" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Siti<SectionCount n={sites?.length} /></>} end={<Button size="small" onClick={() => go(`/sites${buildQuery({ customer: d.id })}`)}>Apri elenco</Button>}>
              {!sites ? <Loader /> : sites.length ? (
                <RecordRows>
                  {sites.map((s) => {
                    const ni = siteStats.inv.get(s.id) ?? 0; const nx = siteStats.iss.get(s.id) ?? 0
                    return (
                      <RecordRow key={s.id} title={s.display_name || s.name}
                        sub={[s.address_line1, s.city].filter(Boolean).join(', ') || s.province || undefined}
                        end={<>{nx ? <SoftTag tone="info">{nx} issue</SoftTag> : null}<span>{ni} {ni === 1 ? 'inventario' : 'inventari'}</span></>}
                        onClick={() => go(`/sites${buildQuery({ open: s.id })}`)} />
                    )
                  })}
                </RecordRows>
              ) : <RecordEmpty>Nessun sito per questo cliente.</RecordEmpty>}
            </RecordSection>
          </Box>

          <Box id="cust-inv" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Inventari<SectionCount n={invs?.length} /></>}
              end={types.length > 1 ? (
                <Box role="group" aria-label="Tipo di inventario" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', p: '2px', borderRadius: '7px', bgcolor: 'archie.neutralBg' }}>
                  {['', ...types].map((t) => (
                    <ButtonBase key={t || 'all'} aria-pressed={invType === t} onClick={() => { setInvType(t); setInvAll(false) }} sx={{
                      height: 24, px: 1, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, color: invType === t ? 'text.primary' : 'text.secondary',
                      bgcolor: invType === t ? 'background.paper' : 'transparent', boxShadow: invType === t ? (th) => `0 1px 2px rgb(16 40 34 / .12), inset 0 0 0 1px ${th.palette.divider}` : 'none',
                    }}>{t || 'Tutti'}</ButtonBase>
                  ))}
                </Box>
              ) : undefined}>
              {!invs ? <Loader /> : invShown.length ? (
                <>
                  <RecordRows>
                    {invShown.map((i) => (
                      <RecordRow key={i.id} lead={<SoftTag tone={typeTone(i.type_label)}>{i.type_label || 'Inventario'}</SoftTag>} leadWidth={96}
                        title={i.name || i.hostname || i.knumber || `Inventario #${i.id}`}
                        sub={[i.hostname && i.hostname !== i.name ? i.hostname : null, i.local_ip].filter(Boolean).join(' · ') || undefined}
                        end={<>{i.has_active_issue ? <Tooltip title="Ha issue aperte"><Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'info.main' }} /></Tooltip> : null}<span>{i.site_display_name || i.site_name || ''}</span></>}
                        onClick={() => go(`/inventory${buildQuery({ open: i.id })}`)} />
                    ))}
                  </RecordRows>
                  {invFiltered.length > INV_PREVIEW ? (
                    <Button size="small" sx={{ mt: 1 }} onClick={() => setInvAll((v) => !v)}>{invAll ? 'Mostra meno' : `Mostra tutti i ${invFiltered.length}`}</Button>
                  ) : null}
                </>
              ) : <RecordEmpty>{invType ? 'Nessun inventario di questo tipo.' : 'Nessun inventario per questo cliente.'}</RecordEmpty>}
            </RecordSection>
          </Box>

          {p.showDevices && devices && devices.length ? (
            <RecordSection title={<>Device<SectionCount n={devices.length} /></>} hint="Gestiti dal Portal; da qui si modificano i campi base.">
              <RecordRows>
                {devices.map((dv) => (
                  <RecordRow key={dv.id} title={deviceLabel(dv)}
                    sub={[dv.site_display_name || dv.site_name, dv.inventario ? `Inv. ${dv.inventario}` : null].filter(Boolean).join(' · ') || undefined}
                    end={dv.status_name ?? undefined} onClick={p.canEditDevices ? () => setEditingDevice(dv) : undefined} />
                ))}
              </RecordRows>
            </RecordSection>
          ) : null}

          <Box id="cust-doc" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title="Contratti e documenti" end={<Button size="small" onClick={() => go('/drive')}>Apri nel Drive</Button>}>
              {(p.showContracts && !contracts) || !files ? <Loader /> : (contracts?.length || files.length) ? (
                <RecordRows>
                  {(contracts ?? []).map((c) => {
                    const n = daysTo(c.end_date)
                    const tag = c.expiry_state === 'expired' || n < 0 ? <SoftTag tone="neutral">scaduto</SoftTag>
                      : n <= EXPIRING_DAYS || c.expiry_state === 'notice' || c.expiry_state === 'expiring' ? <SoftTag tone="warning">tra {n} {n === 1 ? 'giorno' : 'giorni'}</SoftTag>
                        : <SoftTag tone="success">in corso</SoftTag>
                    return (
                      <RecordRow key={`c${c.id}`} lead={<CampoIcon name="receipt" size={18} />} title={c.title}
                        sub={<><Box component="span" sx={mono}>{c.code}</Box> · scade il {dIt(c.end_date)}</>} end={tag}
                        onClick={() => go(`/contracts${buildQuery({ customer: d.id, open: c.id })}`)} />
                    )
                  })}
                  {files.map((f) => (
                    <RecordRow key={`f${f.id}`} lead={<CampoIcon name="file" size={18} />} title={f.name} sub={[dIt(f.updated_at), f.size_human].filter(Boolean).join(' · ')}
                      end={<Tooltip title="Scarica"><IconButton size="small" aria-label={`Scarica ${f.name}`} onClick={() => window.open(`/api/drive-files/${f.id}/download/`, '_blank')} sx={{ width: 28, height: 28 }}><CampoIcon name="download" size={14} /></IconButton></Tooltip>} />
                  ))}
                </RecordRows>
              ) : <RecordEmpty>Nessun contratto né documento.</RecordEmpty>}
            </RecordSection>
          </Box>
        </Box>

        {/* ── Colonna laterale: anagrafica e contesto ── */}
        <Box component="aside" aria-label="Cliente" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Anagrafica">
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              {field('Ragione sociale', 'name')}
              {field(<>Nome breve <Box component="span" sx={{ fontWeight: 400, color: 'text.disabled' }}>come compare negli elenchi</Box></>, 'display_name', { placeholder: draft.name })}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
                  <Typography component="label" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>Vendor</Typography>
                  <TextField select size="small" value={draft.status} disabled={!editable} onChange={(e) => set('status')(e.target.value)}
                    slotProps={{ htmlInput: { 'aria-label': 'Vendor' } }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 34, fontSize: 13 }, '& fieldset': { borderColor: draft.status !== orig.status ? 'warning.main' : undefined } }}>
                    {p.statuses.map((s) => (
                      <MenuItem key={s.id} value={String(s.id)}><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><Box component="i" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.vendorColor(s.label) }} />{s.label}</Box></MenuItem>
                    ))}
                  </TextField>
                </Box>
                {readOnly('Codice', <Box component="span" sx={{ ...mono, color: 'text.primary' }}>{d.code}</Box>)}
              </Box>
              {field('P.IVA', 'vat_number', { mono: true, placeholder: '11 cifre', missing: true })}
              {field('Codice fiscale', 'tax_code', { mono: true })}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                <Tooltip title="Sta nei campi personalizzati: si cambia da «Modifica tutti i campi»">{readOnly('Città', d.city || '—')}</Tooltip>
                {field('Provincia', 'province', { placeholder: 'es. BO', max: 2 })}
              </Box>
            </Box>
          </RecordSection>

          <RecordSection title={<>Referenti<SectionCount n={people?.length} /></>} end={<Button size="small" onClick={() => go(`/contacts${buildQuery({ customer: d.id })}`)}>Tutti i contatti</Button>}>
            {!people ? <Loader /> : people.length ? (
              <Box sx={{ display: 'grid', gap: '2px' }}>
                {people.map((c) => (
                  <Box key={c.id} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <ButtonBase onClick={() => go(`/contacts${buildQuery({ open: c.id })}`)} sx={{ display: 'grid', justifyItems: 'start', justifyContent: 'stretch', textAlign: 'left', minWidth: 0, lineHeight: 1.3, '&:hover .rr-title': { color: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing, borderRadius: '4px' } }}>
                      <Typography className="rr-title" noWrap component="span" sx={{ fontSize: 13, fontWeight: 550, maxWidth: '100%', display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        {c.name}{c === primary ? <Box component="span" sx={{ fontSize: 10.5, fontWeight: 600, px: 0.75, borderRadius: '4px', bgcolor: 'archie.field', color: 'primary.main' }}>primario</Box> : null}
                      </Typography>
                      <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary', maxWidth: '100%' }}>
                        {[c.department, c.site_display_name || c.site_name, c.phone].filter(Boolean).join(' · ') || '—'}
                      </Typography>
                    </ButtonBase>
                    <Box sx={{ display: 'inline-flex' }}>
                      {c.phone ? <Tooltip title={c.phone}><IconButton size="small" component="a" href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label={`Chiama ${c.name}`} sx={{ width: 28, height: 28 }}><CampoIcon name="phone" size={15} /></IconButton></Tooltip> : null}
                      {c.email ? <Tooltip title={c.email}><IconButton size="small" component="a" href={`mailto:${c.email}`} aria-label={`Scrivi a ${c.name}`} sx={{ width: 28, height: 28 }}><CampoIcon name="mail" size={15} /></IconButton></Tooltip> : null}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : <RecordEmpty>Nessun referente registrato.</RecordEmpty>}
          </RecordSection>

          <RecordSection title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="lock" size={13} />Accesso remoto{d.has_vpn && vpn?.applicativo ? <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: 'text.secondary', ml: 0.5 }}>{vpn.applicativo}</Box> : null}</Box>}
            end={d.has_vpn && p.canEditVpn && !deleted ? <Button size="small" onClick={p.onEditVpn}>Modifica</Button> : undefined}>
            {d.has_vpn ? (vpn ? (
              <>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                  {credRow('Indirizzo', vpn.remote_address ? <>{vpn.remote_address}{vpn.porta ? <Box component="span" sx={{ color: 'text.secondary' }}>:{vpn.porta}</Box> : null}</> : '—',
                    vpn.remote_address ? copyBtn(vpn.porta ? `${vpn.remote_address}:${vpn.porta}` : vpn.remote_address, "Copia l'indirizzo") : null)}
                  {credRow('Utenza', vpn.utenza || '—', vpn.utenza ? copyBtn(vpn.utenza, "Copia l'utenza") : null)}
                  {credRow('Password',
                    vpn.password ? <Box component="span" sx={pwShown ? { bgcolor: 'warning.light', color: 'text.primary', borderRadius: '4px', px: 0.5 } : { letterSpacing: '.08em', color: 'text.secondary' }}>{pwShown ? vpn.password : '••••••••'}</Box>
                      : <Box component="span" sx={{ fontFamily: 'inherit', color: 'text.secondary' }}>{'password' in vpn ? '—' : 'Serve il permesso Credenziali VPN'}</Box>,
                    vpn.password ? (
                      <>
                        <Tooltip title={pwShown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}>
                          <IconButton size="small" aria-pressed={pwShown} aria-label={pwShown ? 'Nascondi la password VPN' : 'Mostra la password VPN'} onClick={() => setPwShown((v) => !v)} sx={{ width: 28, height: 28, color: pwShown ? 'warning.main' : undefined }}>
                            <CampoIcon name={pwShown ? 'eyeOff' : 'eye'} size={14} />
                          </IconButton>
                        </Tooltip>
                        {copyBtn(vpn.password, 'Copia la password VPN')}
                      </>
                    ) : null)}
                </Box>
                <Typography sx={{ mt: 0.75, fontSize: 11, color: 'text.disabled' }}>La password è visibile solo con il permesso Credenziali VPN.</Typography>
              </>
            ) : <Loader />) : (
              <RecordEmpty>Nessun accesso remoto.{p.canEditVpn && !deleted ? <> <Button size="small" onClick={p.onEditVpn} sx={{ ml: 0.5 }}>Registra VPN e credenziali</Button></> : null}</RecordEmpty>
            )}
          </RecordSection>

          {p.address ? (
            <RecordSection title="Dove">
              <Box sx={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}><LeafletMap address={p.address} height={150} zoom={15} quiet /></Box>
              <Typography sx={{ mt: 1.25, fontSize: 12.5, fontWeight: 550 }}>{street || p.address}</Typography>
              <Typography sx={help}>
                {[cityPart, d.province ? `(${d.province})` : null].filter(Boolean).join(' ')}{cityPart ? ' · ' : ''}
                <Box component="a" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(p.address)}`} target="_blank" rel="noreferrer" sx={{ color: 'primary.main' }}>Apri nelle mappe</Box>
              </Typography>
            </RecordSection>
          ) : null}

          <RecordSection title="Note">
            <InputBase multiline minRows={3} value={draft.notes} disabled={!editable} placeholder="Note interne sul cliente" onChange={(e) => set('notes')(e.target.value)}
              inputProps={{ 'aria-label': 'Note' }}
              sx={(t) => ({ width: '100%', p: '8px 10px', fontSize: 13, lineHeight: 1.5, borderRadius: '6px', border: '1px solid', borderColor: draft.notes.trim() !== orig.notes.trim() ? 'warning.main' : 'divider', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: t.palette.archie.focusRing } })} />
          </RecordSection>

          <RecordSection title="Attività recente">
            <AuditFeedPanel appLabel="crm" model="customer" objectId={d.id} fields={CUSTOMER_FIELDS} noun="il cliente" limit={5} reloadKey={d} />
          </RecordSection>
        </Box>
      </Box>

      {editingDevice ? (
        <DeviceDialog open customerId={d.id} device={editingDevice} onClose={() => setEditingDevice(null)} onSaved={() => { setEditingDevice(null); setDevReload((n) => n + 1) }} />
      ) : null}
    </RecordModal>
  )
}

const CUSTOMER_FIELDS: Record<string, string> = {
  name: 'la ragione sociale', display_name: 'il nome breve', status: 'il vendor', vat_number: 'la P.IVA', tax_code: 'il codice fiscale',
  province: 'la provincia', notes: 'le note', tags: 'i tag', custom_fields: 'i campi personalizzati', code: 'il codice',
}

/** Sezione in arrivo: spazio fermo e vuoto, niente spinner. */
function Loader() {
  return <Box aria-busy="true" sx={{ minHeight: 48 }} />
}
