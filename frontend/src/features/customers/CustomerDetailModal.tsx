import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import {
  BandChip, BandStat, CampoIcon, RecordEmpty, RecordInput, RecordLoader as Loader, RecordModal, RecordNotes, RecordReadOnly, RecordRow, RecordRows,
  RecordSection, RecordSelect, SectionCount, SoftTag, bandButtonSx, bandSolidSx, recordMono as mono, useList, useRecordDraft, useShownWhenReady,
} from '../../ui/campo'
import LeafletMap from '../../ui/LeafletMap'
import DeviceDialog from '../devices/DeviceDialog'
import { deviceLabel, type DeviceListItem } from '../devices/types'
import type { ContractListItem } from '../contracts/types'
import { AuditFeedPanel } from './CustomerTabs'
import { ACTIVE_ISSUES } from '../records/linkedShared'
import { useOpenRecord } from '../records/recordStack'
import { Anchor, InventoriesSection, IssuesSection, PeopleList, WhereBlock, type LinkedInventory as InvRow, type LinkedIssue as IssueRow, type LinkedPerson as Contact } from '../records/linked'
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

type Vpn = { applicativo?: string | null; utenza?: string | null; password?: string | null; remote_address?: string | null; porta?: string | null }
type SiteRow = { id: number; name?: string | null; display_name?: string | null; city?: string | null; address_line1?: string | null; province?: string | null; status_label?: string | null }
type DriveRow = { id: number; name: string; updated_at: string; size_human?: string }


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

export function CustomerWindow(p: CustomerDetailModalProps & { detail: CustomerModalDetail }) {
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
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(d, () => toDraft(d))
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
  const blocked = () => { if (changed.length) { toast.error('Salva o annulla le modifiche prima di aprire un altro record.'); return true } return false }
  const go = (path: string) => { if (!blocked()) navigate(path) }
  // Siti e contatti si aprono nella stessa finestra, sopra il cliente («‹ Cliente» per tornare).
  const openRec = useOpenRecord(blocked, navigate)

  // ── Testata ─────────────────────────────────────────────────────
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const vendorLabel = p.statuses.find((s) => String(s.id) === draft.status)?.label ?? d.status_label ?? ''
  const nextContract = (contracts ?? []).map((c) => ({ c, n: daysTo(c.end_date) })).filter((x) => x.n >= 0).sort((a, b) => a.n - b.n)[0]
  const soon = nextContract && nextContract.n <= EXPIRING_DAYS ? nextContract : null
  const scrollTo = (id: string) => document.getElementById(`cust-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const stat = (id: string, n: number | null, one: string, many: string, warn?: string) => <BandStat key={id} n={n} one={one} many={many} warn={warn} onClick={() => scrollTo(id)} />

  const [editingDevice, setEditingDevice] = React.useState<DeviceListItem | null>(null)
  // Con ‹ › la finestra resta aperta (niente nuova animazione): lo stato locale riparte col nuovo cliente.
  React.useEffect(() => { setMenu(null); setPwShown(false); setEditingDevice(null) }, [d.id])

  const siteStats = React.useMemo(() => {
    const inv = new Map<number, number>(); (invs ?? []).forEach((i) => { if (i.site) inv.set(i.site, (inv.get(i.site) ?? 0) + 1) })
    const iss = new Map<number, number>(); (issues ?? []).forEach((i) => { if (i.site) iss.set(i.site, (iss.get(i.site) ?? 0) + 1) })
    return { inv, iss }
  }, [invs, issues])

  const field = (label: React.ReactNode, k: keyof Draft, opts: { mono?: boolean; placeholder?: string; missing?: boolean; max?: number } = {}) => (
    <RecordInput label={label} ariaLabel={typeof label === 'string' ? label : k} value={draft[k]} onChange={set(k)} dirty={isDirty(k)} disabled={!editable} {...opts} />
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
  const shown = useShownWhenReady(Boolean(issues && sites && invs && contacts && files && (!p.showContracts || contracts)))

  return (
    <RecordModal open={shown} onClose={p.onClose} ariaLabel={`Cliente ${d.display_name || d.name}`} compact
      title={draft.display_name.trim() || d.display_name || d.name}
      status={<>
        {vendorLabel ? <BandChip><Box component="i" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.vendorColor(vendorLabel) }} />{vendorLabel}</BandChip> : null}
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
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
          ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : <Button variant="outlined" onClick={p.onNewIssue} startIcon={<CampoIcon name="plus" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Nuova issue</Button>}
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
      dirtyCount={editable ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={reset}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale: i record collegati ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Anchor id="cust-iss"><IssuesSection issues={issues} go={go} onNew={!deleted ? p.onNewIssue : undefined} /></Anchor>

          <Anchor id="cust-sites">
            <RecordSection title={<>Siti<SectionCount n={sites?.length} /></>} end={<Button size="small" onClick={() => go(`/sites${buildQuery({ customer: d.id })}`)}>Apri elenco</Button>}>
              {!sites ? <Loader /> : sites.length ? (
                <RecordRows>
                  {sites.map((s) => {
                    const ni = siteStats.inv.get(s.id) ?? 0; const nx = siteStats.iss.get(s.id) ?? 0
                    return (
                      <RecordRow key={s.id} title={s.display_name || s.name}
                        sub={[s.address_line1, s.city].filter(Boolean).join(', ') || s.province || undefined}
                        end={<>{nx ? <SoftTag tone="info">{nx} issue</SoftTag> : null}<span>{ni} {ni === 1 ? 'inventario' : 'inventari'}</span></>}
                        onClick={() => openRec({ kind: 'site', id: s.id, label: s.display_name || s.name || 'Sito' })} />
                    )
                  })}
                </RecordRows>
              ) : <RecordEmpty>Nessun sito per questo cliente.</RecordEmpty>}
            </RecordSection>
          </Anchor>

          <Anchor id="cust-inv"><InventoriesSection invs={invs} go={go} emptyText="Nessun inventario per questo cliente." onOpen={(i) => openRec({ kind: 'inventory', id: i.id, label: i.name || i.hostname || `Inventario #${i.id}` })} resetKey={d.id} /></Anchor>

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

          <Anchor id="cust-doc">
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
          </Anchor>
        </Box>

        {/* ── Colonna laterale: anagrafica e contesto ── */}
        <Box component="aside" aria-label="Cliente" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Anagrafica">
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              {field('Ragione sociale', 'name')}
              {field(<>Nome breve <Box component="span" sx={{ fontWeight: 400, color: 'text.disabled' }}>come compare negli elenchi</Box></>, 'display_name', { placeholder: draft.name })}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                <RecordSelect label="Vendor" value={draft.status} onChange={set('status')} dirty={isDirty('status')} disabled={!editable}
                  options={p.statuses.map((st) => ({ value: String(st.id), label: st.label, mark: <Box component="i" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.vendorColor(st.label) }} /> }))} />
                <RecordReadOnly label="Codice"><Box component="span" sx={{ ...mono, color: 'text.primary' }}>{d.code}</Box></RecordReadOnly>
              </Box>
              {field('P.IVA', 'vat_number', { mono: true, placeholder: '11 cifre', missing: true })}
              {field('Codice fiscale', 'tax_code', { mono: true })}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                <Tooltip title="Sta nei campi personalizzati: si cambia da «Modifica tutti i campi»"><Box><RecordReadOnly label="Città">{d.city || '—'}</RecordReadOnly></Box></Tooltip>
                {field('Provincia', 'province', { placeholder: 'es. BO', max: 2 })}
              </Box>
            </Box>
          </RecordSection>

          <RecordSection title={<>Referenti<SectionCount n={people?.length} /></>} end={<Button size="small" onClick={() => go(`/contacts${buildQuery({ customer: d.id })}`)}>Tutti i contatti</Button>}>
            {!people ? <Loader /> : people.length ? (
              <PeopleList people={people} primaryId={primary?.id ?? null} go={go} onOpen={(id) => openRec({ kind: 'contact', id, label: people.find((x) => x.id === id)?.name ?? 'Contatto' })} />
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
              <WhereBlock address={p.address} line1={street || p.address} line2={[cityPart, d.province ? `(${d.province})` : null].filter(Boolean).join(' ') || undefined}
                map={<LeafletMap address={p.address} height={150} zoom={15} quiet />} />
            </RecordSection>
          ) : null}

          <RecordSection title="Note">
            <RecordNotes value={draft.notes} onChange={set('notes')} dirty={isDirty('notes')} disabled={!editable} placeholder="Note interne sul cliente" />
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
