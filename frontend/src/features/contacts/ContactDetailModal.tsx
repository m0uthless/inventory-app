import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, IconButton, ListItemIcon, Menu, MenuItem, Switch, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import {
  BandChip, BandEditing, CampoIcon, RecordEmpty, RecordField, RecordGrid, RecordLink, RecordLoader, RecordModal, RecordNotes, RecordRow, RecordRows, RecordSection, RecordSelect, RecordValue,
  SectionCount, bandButtonSx, bandSolidSx, recordMono as mono, useList, useRecordDraft, useShownWhenReady,
} from '../../ui/campo'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { PeopleList, type LinkedPerson } from '../records/linked'
import { RecordStackContext } from '../records/recordStack'
import { useOpenRecord } from '../records/recordStack'

/*
 * Finestra del contatto (DESIGN.md › Record window, anteprima design-previews/core-base.html, pagina Contatti):
 * testata con le iniziali, reparto, cliente e sito nel sottotitolo, Chiama e Scrivi; al centro recapiti,
 * dove lavora e gli altri contatti dello stesso sito; a lato anagrafica modificabile, note e ultime modifiche.
 */

export type ContactModalDetail = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  customer?: number | null
  customer_name?: string | null
  customer_display_name?: string | null
  site?: number | null
  site_name?: string | null
  site_display_name?: string | null
  is_primary?: boolean | null
  notes?: string | null
  deleted_at?: string | null
}

type SiteRow = { id: number; name: string; display_name?: string | null; address_line1?: string | null; city?: string | null; assets_count?: number }
type Draft = { name: string; department: string; phone: string; email: string; site: string; is_primary: string; notes: string }
const toDraft = (d: ContactModalDetail): Draft => ({
  name: d.name ?? '', department: d.department ?? '', phone: d.phone ?? '', email: d.email ?? '', site: d.site ? String(d.site) : '',
  is_primary: d.is_primary ? 'true' : '', notes: d.notes ?? '',
})
const initials = (n: string) => n.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

export type ContactDetailModalProps = {
  detail: ContactModalDetail | null
  canChange: boolean
  canDelete: boolean
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
  /** Apre un altro contatto nella stessa pagina. */
  onOpenContact: (id: number) => void
}

export default function ContactDetailModal(p: ContactDetailModalProps) {
  // La pagina monta la finestra solo con il contatto già caricato (niente finestra di attesa).
  return p.detail ? <ContactWindow {...p} detail={p.detail} /> : null
}

export function ContactWindow(p: ContactDetailModalProps & { detail: ContactModalDetail }) {
  const d = p.detail
  const toast = useToast()
  const navigate = useNavigate()
  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted

  // ── Dati collegati: siti del cliente (per la scelta e "Dove lavora") e colleghi ──
  const sites = useList<SiteRow>('/sites/', d.customer ? { customer: d.customer, page_size: 500, ordering: 'name' } : null)
  const all = useList<LinkedPerson>('/contacts/', d.customer ? { customer: d.customer, page_size: 200, ordering: 'name' } : null)

  // ── Anagrafica e note: modifiche locali, un solo salvataggio ────
  // In lettura i dati sono testo; «Modifica» nel ⋯ li trasforma in campi (stesso schema dell'inventario).
  const [editing, setEditing] = React.useState(false)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(d, () => toDraft(d))
  const v = editing ? draft : toDraft(d)
  const stopEditing = () => { reset(); setEditing(false) }
  const [busy, setBusy] = React.useState(false)
  const save = async () => {
    if (!draft.name.trim()) { toast.error('Il nome è obbligatorio.'); return }
    setBusy(true)
    try {
      // Solo i campi cambiati: un campo vuoto mai toccato resta com'era.
      const value: Record<keyof Draft, unknown> = {
        name: draft.name.trim(), department: draft.department.trim() || null, phone: draft.phone.trim() || null, email: draft.email.trim() || null,
        site: draft.site ? Number(draft.site) : null, is_primary: draft.is_primary === 'true', notes: draft.notes,
      }
      await api.patch(`/contacts/${d.id}/`, Object.fromEntries(changed.map((k) => [k, value[k]])))
      toast.success('Contatto salvato.')
      setEditing(false)
      p.onSaved()
    } catch (e) { toast.error(apiErrorToFormFeedback(e).message) } finally { setBusy(false) }
  }
  const blocked = () => { if (editing && changed.length) { toast.error('Salva o annulla le modifiche prima di aprire un altro record.'); return true } return false }
  const go = (path: string) => { if (!blocked()) navigate(path) }
  // Cliente, sito e colleghi si aprono nella stessa finestra, sopra il contatto.
  const openRec = useOpenRecord(blocked, navigate)
  const inStack = React.useContext(RecordStackContext) != null
  const openContact = (id: number) => { if (inStack) openRec({ kind: 'contact', id, label: all?.find((x) => x.id === id)?.name ?? 'Contatto' }); else if (!blocked()) p.onOpenContact(id) }
  const openCustomer = () => { if (d.customer) openRec({ kind: 'customer', id: d.customer, label: d.customer_display_name || d.customer_name || 'Cliente' }) }
  const openSite = (id: number, label: string) => openRec({ kind: 'site', id, label })

  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => { setMenu(null); setEditing(false) }, [d.id])

  const siteId = v.site ? Number(v.site) : null
  const site = sites?.find((s) => s.id === siteId) ?? null
  const siteLabel = site ? site.display_name || site.name : siteId === d.site ? d.site_display_name || d.site_name || '' : ''
  const customerLabel = d.customer_display_name || d.customer_name || 'Cliente'
  // Colleghi: stesso sito (o, senza sito, gli altri della sede del cliente).
  const mates = all ? all.filter((c) => c.id !== d.id && (c.site ?? null) === siteId) : null
  const primary = v.is_primary === 'true'
  const shown = useShownWhenReady(Boolean(sites && all) || !d.customer)

  const field = (label: string, k: keyof Draft, opts: { mono?: boolean; placeholder?: string; wide?: boolean; show?: (x: string) => React.ReactNode } = {}) => (
    <RecordField editing={editing} label={label} value={v[k]} onChange={set(k)} dirty={isDirty(k)} {...opts} />
  )
  const bandLink = (label: string, onClick: () => void) => (
    <ButtonBase onClick={onClick} sx={{ font: 'inherit', color: '#fff', fontWeight: 600, verticalAlign: 'baseline', textDecoration: 'underline', textDecorationColor: 'rgb(255 255 255 / .4)', textUnderlineOffset: '3px', '&:hover': { textDecorationColor: '#fff' }, '&.Mui-focusVisible': { outline: '2px solid rgb(255 255 255 / .6)', borderRadius: '3px' } }}>{label}</ButtonBase>
  )
  const phone = v.phone.trim()
  const email = v.email.trim()
  const reach = (icon: 'phone' | 'mail', label: string, value: string, href: string | null, copyLabel: string) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', alignItems: 'center', columnGap: 1.5, minHeight: 52, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}><CampoIcon name={icon} size={18} /></Box>
      <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.3 }}>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{label}</Typography>
        {value ? (
          <Typography component={href ? 'a' : 'span'} href={href ?? undefined} noWrap sx={{ fontSize: 13.5, fontWeight: 550, color: 'text.primary', textDecoration: 'none', ...(icon === 'phone' ? mono : {}), '&:hover': href ? { color: 'primary.main' } : undefined }}>{value}</Typography>
        ) : <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>non indicato</Typography>}
      </Box>
      {value ? <Tooltip title="Copia"><IconButton size="small" aria-label={copyLabel} onClick={() => p.onCopy(value)} sx={{ width: 28, height: 28 }}><CampoIcon name="copy" size={14} /></IconButton></Tooltip> : <span />}
    </Box>
  )

  return (
    <RecordModal open={shown} onClose={p.onClose} ariaLabel={`Contatto ${d.name}`}
      avatar={<Box aria-hidden sx={{ width: 52, height: 52, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 650, bgcolor: 'rgb(255 255 255 / .16)', boxShadow: '0 0 0 2px rgb(255 255 255 / .22)' }}>{initials(v.name || d.name)}</Box>}
      title={v.name.trim() || d.name}
      status={<>
        {primary ? <BandChip>Contatto primario</BandChip> : null}
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>
        {v.department.trim() || 'Reparto non indicato'} ·{' '}
        {d.customer ? bandLink(customerLabel, openCustomer) : customerLabel}
        {siteId ? <> · {bandLink(siteLabel || 'Sito', () => openSite(siteId, siteLabel || 'Sito'))}</> : null}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null) : (
          <>
            {phone && !editing ? <Button variant="outlined" href={`tel:${phone.replace(/\s/g, '')}`} startIcon={<CampoIcon name="phone" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Chiama</Button> : null}
            {email && !editing ? <Button variant="outlined" href={`mailto:${email}`} startIcon={<CampoIcon name="mail" size={15} />} sx={bandButtonSx}>Scrivi</Button> : null}
            <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
          </>
        )}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!editable || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          <MenuItem disabled={!p.canChange} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tutti i campi (anche il cliente)…</MenuItem>
          {d.phone ? <MenuItem onClick={() => { setMenu(null); p.onCopy(d.phone!) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il telefono</MenuItem> : null}
          {d.email ? <MenuItem onClick={() => { setMenu(null); p.onCopy(d.email!) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia l'email</MenuItem> : null}
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={stopEditing}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Recapiti">
            {reach('phone', 'Telefono', phone, phone ? `tel:${phone.replace(/\s/g, '')}` : null, 'Copia il telefono')}
            {reach('mail', 'Email', email, email ? `mailto:${email}` : null, "Copia l'email")}
          </RecordSection>

          <RecordSection title="Dove lavora">
            <RecordRows>
              {d.customer ? (
                <RecordRow lead={<CampoIcon name="building" size={18} />} title={customerLabel} sub="Cliente"
                  onClick={openCustomer} />
              ) : null}
              {siteId ? (
                <RecordRow lead={<CampoIcon name="pin" size={18} />} title={siteLabel || 'Sito'}
                  sub={['Sito', site ? [site.address_line1, site.city].filter(Boolean).join(', ') : null].filter(Boolean).join(' · ')}
                  end={site?.assets_count != null ? `${site.assets_count} ${site.assets_count === 1 ? 'inventario' : 'inventari'}` : undefined}
                  onClick={() => openSite(siteId, siteLabel || 'Sito')} />
              ) : null}
            </RecordRows>
            {!siteId ? <RecordEmpty>Lavora nella sede del cliente, non su un sito.</RecordEmpty> : null}
          </RecordSection>

          <RecordSection title={<>{siteId ? 'Altri contatti dello stesso sito' : 'Altri contatti della sede'}<SectionCount n={mates?.length} /></>}>
            {!mates ? <RecordLoader /> : mates.length
              ? <PeopleList people={mates} go={go} onOpen={openContact} showSite={false} />
              : <RecordEmpty>Nessun altro contatto.</RecordEmpty>}
          </RecordSection>
        </Box>

        {/* ── Colonna laterale ── */}
        <Box component="aside" aria-label="Contatto" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Anagrafica">
            <RecordGrid>
              {field('Nome e cognome', 'name', { wide: true })}
              {field('Reparto e ruolo', 'department', { wide: true, placeholder: 'es. Radiologia · TSRM' })}
              {field('Telefono', 'phone', { mono: true })}
              {field('Email', 'email', { show: (x) => <Box component="a" href={`mailto:${x}`} sx={{ color: 'primary.main', fontWeight: 550, textDecoration: 'none' }}>{x}</Box> })}
              <RecordValue label="Cliente"><RecordLink onClick={d.customer ? openCustomer : undefined}>{customerLabel}</RecordLink></RecordValue>
              {editing ? (
                <RecordSelect label="Sito" value={draft.site} onChange={set('site')} dirty={isDirty('site')}
                  options={[{ value: '', label: 'Sede del cliente' }, ...(sites ?? []).map((s) => ({ value: String(s.id), label: s.display_name || s.name })),
                    ...(d.site && sites && !sites.some((s) => s.id === d.site) ? [{ value: String(d.site), label: d.site_display_name || d.site_name || `Sito ${d.site}` }] : [])]} />
              ) : <RecordValue label="Sito">{siteId ? <RecordLink onClick={() => openSite(siteId, siteLabel || 'Sito')}>{siteLabel || 'Sito'}</RecordLink> : 'Sede del cliente'}</RecordValue>}
              {editing ? (
                <Box component="label" sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1.5, pt: 0.5, cursor: 'pointer' }}>
                  <Box sx={{ flex: 1, display: 'grid', lineHeight: 1.3 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 550, color: isDirty('is_primary') ? 'warning.main' : 'text.primary' }}>Contatto primario</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{siteId ? 'Compare per primo nel sito' : 'Compare per primo nel cliente'}; prende il posto dell'attuale</Typography>
                  </Box>
                  <Switch size="small" checked={primary} onChange={(e) => set('is_primary')(e.target.checked ? 'true' : '')} slotProps={{ input: { 'aria-label': 'Contatto primario' } }} />
                </Box>
              ) : <RecordValue label="Contatto primario" wide>{primary ? (siteId ? 'Sì, del sito' : 'Sì, del cliente') : 'No'}</RecordValue>}
            </RecordGrid>
          </RecordSection>

          <RecordSection title="Note">
            {editing ? <RecordNotes value={draft.notes} onChange={set('notes')} dirty={isDirty('notes')} placeholder="Note interne sul contatto" />
              : d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <RecordEmpty>Nessuna nota.</RecordEmpty>}
          </RecordSection>

          <RecordSection title="Attività recente">
            <AuditFeedPanel appLabel="crm" model="contact" objectId={d.id} fields={CONTACT_FIELDS} noun="il contatto" limit={5} reloadKey={d} />
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}

const CONTACT_FIELDS: Record<string, string> = {
  name: 'il nome', email: "l'email", phone: 'il telefono', department: 'il reparto', is_primary: 'il flag primario', site: 'il sito', customer: 'il cliente', notes: 'le note',
}
