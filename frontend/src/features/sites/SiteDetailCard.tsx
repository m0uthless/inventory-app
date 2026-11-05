import * as React from 'react'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import AddIcon from '@mui/icons-material/Add'
import { api } from '@shared/api/client'
import { CampoIcon, ContactsBlock, DetailSection, FloatingDetail, MapBlock, Properties, StatRow } from '../../ui/campo'
import { SiteStatusBadge } from './siteUi'

export type SiteCardDetail = {
  id: number
  name: string
  display_name?: string | null
  customer?: number | null
  customer_name?: string | null
  customer_display_name?: string | null
  status?: number | null
  status_key?: string | null
  status_label?: string | null
  address_line1?: string | null
  city?: string | null
  postal_code?: string | null
  province?: string | null
  country?: string | null
  primary_contact_id?: number | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  contacts_count?: number
  assets_count?: number
  open_issues_count?: number
  notes?: string | null
  deleted_at?: string | null
}

export type SitePatch = Partial<Pick<SiteCardDetail, 'status' | 'name' | 'display_name' | 'address_line1' | 'city' | 'postal_code' | 'province'>>
export type SiteTab = 'det' | 'inv' | 'con' | 'iss' | 'att'

type Contact = { id: number; name: string; email?: string | null; phone?: string | null; department?: string | null }

type Props = {
  detail: SiteCardDetail | null
  loading: boolean
  statuses: { id: number; label: string; key?: string }[]
  canChange: boolean
  canDelete: boolean
  tab: SiteTab
  onTab: (t: SiteTab) => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onPatch: (patch: SitePatch, label: string) => void
  onCopy: (v: string) => void
  onNewIssue: () => void
  onOpenCustomer: () => void
  onAllContacts: () => void
  inventoriesTab: React.ReactNode
  contactsTab: React.ReactNode
  issuesTab: React.ReactNode
  activityTab: React.ReactNode
}

const none = (t = '—') => <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{t}</Box>
const missing = (t: string) => <Box component="span" sx={{ color: 'warning.main', fontWeight: 550, fontSize: 12 }}>{t}</Box>

function useSiteContacts(id: number | null) {
  const [rows, setRows] = React.useState<Contact[] | null>(null)
  React.useEffect(() => {
    if (!id) { setRows(null); return }
    let alive = true
    api.get('/contacts/', { params: { site: id, page_size: 100, ordering: 'name' } })
      .then((r) => { const d = r.data as { results?: Contact[] } | Contact[]; if (alive) setRows(Array.isArray(d) ? d : d.results ?? []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [id])
  return rows
}

/** Scheda flottante del sito (DESIGN.md › Detail card), come Clienti, Issue e PO. */
export default function SiteDetailCard(p: Props) {
  const d = p.detail
  const contacts = useSiteContacts(d?.id ?? null)

  if (!d) {
    return (
      <FloatingDetail open onClose={p.onClose} title="Caricamento…" ariaLabel="Dettaglio sito">
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{p.loading ? <CircularProgress size={22} /> : <Typography sx={{ color: 'text.secondary' }}>Sito non trovato.</Typography>}</Box>
      </FloatingDetail>
    )
  }

  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const customer = d.customer_display_name || d.customer_name || ''
  const primary = contacts?.find((c) => c.id === d.primary_contact_id) ?? null
  const others = (contacts ?? []).filter((c) => c.id !== d.primary_contact_id)
  const place = [[d.postal_code, d.city].filter(Boolean).join(' '), d.province ? `(${d.province})` : ''].filter(Boolean).join(' ')

  const props = [
    {
      key: 'st', label: 'Stato', disabled: !editable, current: d.status ? String(d.status) : '',
      options: p.statuses.map((s) => ({ value: String(s.id), label: <SiteStatusBadge statusKey={s.key} label={s.label} /> })),
      display: <SiteStatusBadge statusKey={d.status_key} label={d.status_label} />,
      onChange: (v: string) => p.onPatch({ status: Number(v) }, 'Stato aggiornato'),
    },
    {
      key: 'cust', label: 'Cliente', disabled: true,
      display: customer ? <Box component="span" sx={{ fontWeight: 550 }}>{customer}</Box> : none(),
    },
    {
      key: 'name', label: 'Nome', full: true, disabled: !editable,
      text: { value: d.name, placeholder: 'Nome del sito' }, display: d.name,
      onChange: (v: string) => { if (v.trim()) p.onPatch({ name: v.trim() }, 'Nome aggiornato') },
    },
    {
      key: 'dn', label: 'Nome breve', full: true, disabled: !editable,
      text: { value: d.display_name ?? '', placeholder: 'Come compare negli elenchi' }, display: d.display_name || none(),
      onChange: (v: string) => p.onPatch({ display_name: v.trim() || d.name }, 'Nome breve aggiornato'),
    },
    {
      key: 'addr', label: 'Indirizzo', full: true, disabled: !editable,
      text: { value: d.address_line1 ?? '', placeholder: 'Via e civico' }, display: d.address_line1 || missing('Manca'),
      onChange: (v: string) => p.onPatch({ address_line1: v.trim() || null }, 'Indirizzo aggiornato'),
    },
    {
      key: 'cap', label: 'CAP', disabled: !editable,
      text: { value: d.postal_code ?? '', mono: true }, display: d.postal_code || none(),
      onChange: (v: string) => p.onPatch({ postal_code: v.trim() || null }, 'CAP aggiornato'),
    },
    {
      key: 'city', label: 'Città', disabled: !editable,
      text: { value: d.city ?? '' }, display: d.city || none(),
      onChange: (v: string) => p.onPatch({ city: v.trim() || null }, 'Città aggiornata'),
    },
    {
      key: 'prov', label: 'Provincia', disabled: !editable,
      text: { value: d.province ?? '', placeholder: 'es. BO' }, display: d.province || none(),
      onChange: (v: string) => p.onPatch({ province: v.trim().toUpperCase() || null }, 'Provincia aggiornata'),
    },
  ]

  const details = (
    <>
      <Properties
        storageKey="site-props-open"
        props={props}
        summary={<><SiteStatusBadge statusKey={d.status_key} label={d.status_label} />{customer ? <Box component="span" sx={{ color: 'text.secondary' }}>{customer}</Box> : null}</>}
      />

      <StatRow items={[
        { label: 'Inventari', value: d.assets_count ?? '—', onClick: () => p.onTab('inv') },
        { label: 'Issue aperte', value: d.open_issues_count ?? 0, onClick: () => p.onTab('iss') },
        { label: 'Contatti', value: d.contacts_count ?? contacts?.length ?? '—', onClick: () => p.onTab('con') },
      ]} />

      <ContactsBlock
        loaded={Boolean(contacts)}
        primary={d.primary_contact_id ? { name: d.primary_contact_name || '—', role: primary?.department, phone: d.primary_contact_phone, email: d.primary_contact_email } : null}
        others={others.map((c) => ({ id: c.id, name: c.name, role: c.department, phone: c.phone, email: c.email }))}
        onAll={p.onAllContacts}
        onCopy={p.onCopy}
        othersEmptySub="Sceglilo tra i contatti del sito qui sotto, dalla pagina Contatti"
        emptySub="Aggiungi il referente del sito dalla pagina Contatti"
      />

      {d.address_line1 ? (
        <MapBlock street={d.address_line1} place={place} query={[d.address_line1, d.city].filter(Boolean).join(', ')} />
      ) : (
        <DetailSection title="Sede">
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Indirizzo non indicato{editable ? ': aggiungilo dalle Proprietà per vedere la mappa.' : '.'}
          </Typography>
        </DetailSection>
      )}

      <DetailSection title="Note">
        {d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna nota.</Typography>}
      </DetailSection>
    </>
  )

  const footer = p.tab === 'det' ? (
    deleted ? (
      <>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nel cestino</Typography>
        <Box sx={{ flex: 1 }} />
        {p.canChange ? <Button variant="contained" startIcon={<RestoreFromTrashIcon />} onClick={p.onRestore}>Ripristina</Button> : null}
      </>
    ) : (
      <>
        {p.canChange ? <Button variant="outlined" startIcon={<EditIcon />} onClick={p.onEdit}>Modifica</Button> : null}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={p.onNewIssue}>Nuova issue</Button>
      </>
    )
  ) : undefined

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio sito"
      status={<SiteStatusBadge statusKey={d.status_key} label={d.status_label} onDark />}
      title={d.display_name || d.name}
      subtitle={[customer || null, d.display_name && d.display_name !== d.name ? d.name : null, place || null].filter(Boolean).join(' · ') || undefined}
      tabs={[
        { key: 'det', label: 'Dettagli' },
        { key: 'inv', label: 'Inventari', count: d.assets_count ?? null },
        { key: 'con', label: 'Contatti', count: d.contacts_count ?? null },
        { key: 'iss', label: 'Issue', count: d.open_issues_count ?? null },
        { key: 'att', label: 'Attività' },
      ]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as SiteTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !p.canChange },
        ...(d.customer ? [{ label: 'Apri il cliente', icon: <CampoIcon name="building" />, onClick: p.onOpenCustomer }] : []),
        ...(d.address_line1 ? [{ label: "Copia l'indirizzo", icon: <CampoIcon name="copy" />, onClick: () => p.onCopy([d.address_line1, place].filter(Boolean).join(', ')) }] : []),
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? details
        : p.tab === 'inv' ? p.inventoriesTab
        : p.tab === 'con' ? p.contactsTab
        : p.tab === 'iss' ? p.issuesTab
        : p.activityTab}
    </FloatingDetail>
  )
}
