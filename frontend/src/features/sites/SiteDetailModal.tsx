import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import {
  BandChip, BandEditing, BandStat, CampoIcon, RecordEmpty, RecordField, RecordGrid, RecordLink, RecordLoader, RecordModal, RecordNotes, RecordSection, RecordSelect, RecordValue,
  SectionCount, bandButtonSx, bandSolidSx, useList, useRecordDraft, useShownWhenReady,
} from '../../ui/campo'
import AddressMap from '../../ui/AddressMap'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { Anchor, InventoriesSection, IssuesSection, PeopleList, WhereBlock, type LinkedInventory, type LinkedIssue, type LinkedPerson } from '../records/linked'
import { ACTIVE_ISSUES } from '../records/linkedShared'
import { useOpenRecord } from '../records/recordStack'

/*
 * Finestra del sito (DESIGN.md › Record window, anteprima design-previews/core-base.html, pagina Siti):
 * testata snella con il cliente nel sottotitolo e i conteggi; al centro issue aperte, inventari e
 * contatti del sito; a lato anagrafica modificabile, dove, note e ultime modifiche. Un solo salvataggio.
 */

export type SiteModalDetail = {
  id: number
  name: string
  display_name?: string | null
  customer?: number | null
  customer_code?: string | null
  customer_name?: string | null
  customer_display_name?: string | null
  status?: number | null
  status_key?: string | null
  status_label?: string | null
  address_line1?: string | null
  city?: string | null
  postal_code?: string | null
  province?: string | null
  primary_contact_id?: number | null
  notes?: string | null
  deleted_at?: string | null
}

type Draft = { name: string; display_name: string; status: string; address_line1: string; postal_code: string; city: string; province: string; notes: string }
const toDraft = (d: SiteModalDetail): Draft => ({
  name: d.name ?? '', display_name: d.display_name ?? '', status: d.status ? String(d.status) : '', address_line1: d.address_line1 ?? '',
  postal_code: d.postal_code ?? '', city: d.city ?? '', province: d.province ?? '', notes: d.notes ?? '',
})

/** Segno dello stato del sito (stesso linguaggio di SiteStatusBadge): pieno, anello, trattino. */
function StatusMark({ k, color }: { k?: string | null; color?: string }) {
  return (
    <Box component="svg" viewBox="0 0 12 12" aria-hidden sx={{ width: 10, height: 10, flex: 'none', color }}>
      {k === 'active' ? <circle cx="6" cy="6" r="4" fill="currentColor" />
        : k === 'temporarily_closed' ? <circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          : <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </Box>
  )
}
const markColor = (k?: string | null) => (k === 'active' ? 'success.main' : k === 'temporarily_closed' ? 'warning.main' : 'text.secondary')

export type SiteDetailModalProps = {
  detail: SiteModalDetail | null
  statuses: { id: number; label: string; key?: string }[]
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
  onNewIssue: () => void
}

export default function SiteDetailModal(p: SiteDetailModalProps) {
  // La pagina monta la finestra solo con il sito già caricato (niente finestra di attesa).
  return p.detail ? <SiteWindow {...p} detail={p.detail} /> : null
}

export function SiteWindow(p: SiteDetailModalProps & { detail: SiteModalDetail }) {
  const d = p.detail
  const toast = useToast()
  const navigate = useNavigate()
  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted

  // ── Dati collegati ──────────────────────────────────────────────
  const issues = useList<LinkedIssue>('/issues/', { site: d.id, status: ACTIVE_ISSUES, page_size: 100, ordering: '-created_at' })
  const invs = useList<LinkedInventory>('/inventories/', { site: d.id, page_size: 500, ordering: 'name' })
  const contacts = useList<LinkedPerson>('/contacts/', { site: d.id, page_size: 100, ordering: 'name' })

  // ── Anagrafica e note: modifiche locali, un solo salvataggio ────
  // In lettura i dati sono testo; «Modifica» nel ⋯ li trasforma in campi (stesso schema dell'inventario).
  const [editing, setEditing] = React.useState(false)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(d, () => toDraft(d))
  const v = editing ? draft : toDraft(d)
  const stopEditing = () => { reset(); setEditing(false) }
  const [busy, setBusy] = React.useState(false)
  const save = async () => {
    if (!draft.name.trim()) { toast.error('Il nome del sito è obbligatorio.'); return }
    setBusy(true)
    try {
      // Solo i campi cambiati: un campo vuoto mai toccato resta com'era.
      const value: Record<keyof Draft, unknown> = {
        name: draft.name.trim(), display_name: draft.display_name.trim() || draft.name.trim(), status: draft.status ? Number(draft.status) : null,
        address_line1: draft.address_line1.trim() || null, postal_code: draft.postal_code.trim() || null, city: draft.city.trim() || null,
        province: draft.province.trim().toUpperCase() || null, notes: draft.notes,
      }
      await api.patch(`/sites/${d.id}/`, Object.fromEntries(changed.map((k) => [k, value[k]])))
      toast.success('Sito salvato.')
      setEditing(false)
      p.onSaved()
    } catch (e) { toast.error(apiErrorToFormFeedback(e).message) } finally { setBusy(false) }
  }
  // Uscire verso un'altra pagina con modifiche in sospeso le perderebbe: prima si salva o si annulla.
  const blocked = () => { if (editing && changed.length) { toast.error('Salva o annulla le modifiche prima di aprire un altro record.'); return true } return false }
  const go = (path: string) => { if (!blocked()) navigate(path) }
  // Cliente e contatti si aprono nella stessa finestra, sopra il sito.
  const openRec = useOpenRecord(blocked, navigate)
  const openCustomer = () => { if (d.customer) openRec({ kind: 'customer', id: d.customer, label: d.customer_display_name || d.customer_name || 'Cliente' }) }

  // ── Testata ─────────────────────────────────────────────────────
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => { setMenu(null); setEditing(false) }, [d.id])
  const status = p.statuses.find((s) => String(s.id) === v.status)
  const statusKey = status?.key ?? d.status_key
  const statusLabel = status?.label ?? d.status_label ?? ''
  const customerLabel = d.customer_display_name || d.customer_name || 'cliente'
  const scrollTo = (id: string) => document.getElementById(`site-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const placeLine = [v.postal_code.trim(), v.city.trim(), v.province.trim() ? `(${v.province.trim().toUpperCase()})` : ''].filter(Boolean).join(' ')
  const fullAddress = [v.address_line1.trim(), placeLine].filter(Boolean).join(', ')
  // La mappa segue l'indirizzo salvato, non quello che si sta scrivendo.
  const savedAddress = [d.address_line1, [d.postal_code, d.city].filter(Boolean).join(' '), d.province].filter((x) => x && String(x).trim()).join(', ')

  const primary = contacts?.find((c) => c.id === d.primary_contact_id || c.is_primary)
  const people = contacts ? [...(primary ? [primary] : []), ...contacts.filter((c) => c !== primary)] : null
  const shown = useShownWhenReady(Boolean(issues && invs && contacts))

  const field = (label: string, k: keyof Draft, opts: { mono?: boolean; placeholder?: string; max?: number; missing?: boolean; wide?: boolean } = {}) => (
    <RecordField editing={editing} label={label} value={v[k]} onChange={set(k)} dirty={isDirty(k)} {...opts} />
  )

  return (
    <RecordModal open={shown} onClose={p.onClose} ariaLabel={`Sito ${d.display_name || d.name}`} compact
      title={v.display_name.trim() || v.name.trim() || d.name}
      status={<>
        {statusLabel && statusKey !== 'active' ? <BandChip><StatusMark k={statusKey} />{statusLabel}</BandChip> : null}
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>
        Sito di{' '}
        {d.customer ? (
          <ButtonBase onClick={openCustomer} sx={{ font: 'inherit', color: '#fff', fontWeight: 600, verticalAlign: 'baseline', textDecoration: 'underline', textDecorationColor: 'rgb(255 255 255 / .4)', textUnderlineOffset: '3px', '&:hover': { textDecorationColor: '#fff' }, '&.Mui-focusVisible': { outline: '2px solid rgb(255 255 255 / .6)', borderRadius: '3px' } }}>{customerLabel}</ButtonBase>
        ) : customerLabel}
        {fullAddress ? ` · ${fullAddress}` : ' · indirizzo mancante'}
      </>}
      tags={<>
        <BandStat n={invs?.length ?? null} one=" inventario" many=" inventari" onClick={() => scrollTo('inv')} />
        <BandStat n={issues?.length ?? null} one=" issue aperta" many=" issue aperte" onClick={() => scrollTo('iss')} />
        <BandStat n={contacts?.length ?? null} one=" contatto" many=" contatti" onClick={() => scrollTo('con')} />
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted
          ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : editing ? null : <Button variant="outlined" onClick={p.onNewIssue} startIcon={<CampoIcon name="plus" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Nuova issue</Button>}
        {!deleted ? (
          <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        ) : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!editable || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          <MenuItem disabled={!p.canChange} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tutti i campi (cliente, campi personalizzati)…</MenuItem>
          {savedAddress ? <MenuItem onClick={() => { setMenu(null); p.onCopy(savedAddress) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia l'indirizzo</MenuItem> : null}
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={stopEditing}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale: i record collegati ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Anchor id="site-iss"><IssuesSection issues={issues} go={go} onNew={!deleted ? p.onNewIssue : undefined} showSite={false} /></Anchor>
          <Anchor id="site-inv"><InventoriesSection invs={invs} go={go} showSite={false} emptyText="Nessun inventario in questo sito." onOpen={(i) => openRec({ kind: 'inventory', id: i.id, label: i.name || i.hostname || `Inventario #${i.id}` })} resetKey={d.id} /></Anchor>
          <Anchor id="site-con">
            <RecordSection title={<>Contatti del sito<SectionCount n={people?.length} /></>}
              end={<Button size="small" onClick={() => go(`/contacts${buildQuery({ customer: d.customer ?? undefined, site: d.id })}`)}>Apri elenco</Button>}>
              {!people ? <RecordLoader /> : people.length ? <PeopleList people={people} primaryId={primary?.id ?? null} go={go} onOpen={(id) => openRec({ kind: 'contact', id, label: people.find((x) => x.id === id)?.name ?? 'Contatto' })} showSite={false} />
                : <RecordEmpty>Nessun contatto in questo sito.</RecordEmpty>}
            </RecordSection>
          </Anchor>
        </Box>

        {/* ── Colonna laterale: anagrafica e contesto ── */}
        <Box component="aside" aria-label="Sito" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Anagrafica">
            <RecordGrid>
              {field('Nome', 'name', { wide: true })}
              {field('Nome breve', 'display_name', { wide: true, placeholder: draft.name })}
              <RecordValue label="Cliente"><RecordLink onClick={d.customer ? openCustomer : undefined}>{customerLabel}</RecordLink></RecordValue>
              {editing ? (
                <RecordSelect label="Stato" value={draft.status} onChange={set('status')} dirty={isDirty('status')}
                  options={p.statuses.map((s) => ({ value: String(s.id), label: s.label, mark: <StatusMark k={s.key} color={markColor(s.key)} /> }))} />
              ) : <RecordValue label="Stato">{statusLabel ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><StatusMark k={statusKey} color={markColor(statusKey)} />{statusLabel}</Box> : null}</RecordValue>}
              {field('Indirizzo', 'address_line1', { wide: true, placeholder: 'Via e numero civico', missing: true })}
              {field('CAP', 'postal_code', { mono: true, max: 5 })}
              {field('Città', 'city')}
              {field('Provincia', 'province', { max: 2, placeholder: 'BO' })}
            </RecordGrid>
          </RecordSection>

          {savedAddress ? (
            <RecordSection title="Dove">
              <WhereBlock address={savedAddress} line1={d.address_line1 || savedAddress} line2={[d.postal_code, d.city, d.province ? `(${d.province})` : null].filter(Boolean).join(' ') || undefined}
                map={<AddressMap address={savedAddress} height={150} zoom={15} quiet title={d.name} />} />
            </RecordSection>
          ) : null}

          <RecordSection title="Note">
            {editing ? <RecordNotes value={draft.notes} onChange={set('notes')} dirty={isDirty('notes')} placeholder="Note interne sul sito" />
              : d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <RecordEmpty>Nessuna nota.</RecordEmpty>}
          </RecordSection>

          <RecordSection title="Attività recente">
            <AuditFeedPanel appLabel="crm" model="site" objectId={d.id} fields={SITE_FIELDS} noun="il sito" limit={5} reloadKey={d} />
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}

const SITE_FIELDS: Record<string, string> = {
  name: 'il nome', display_name: 'il nome breve', status: 'lo stato', address_line1: "l'indirizzo", postal_code: 'il CAP', city: 'la città',
  province: 'la provincia', country: 'il paese', notes: 'le note', custom_fields: 'i campi personalizzati', customer: 'il cliente',
}
