import * as React from 'react'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import { CampoIcon, DetailSection, DirectLink, EmptyAction, FloatingDetail, Properties } from '../../ui/campo'
import { Empty, Group, Loading, mono, Row, Rows, Tile, useList } from '../../ui/campo/ListRows'

export type ContactCardDetail = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  department?: string | null
  is_primary: boolean
  customer?: number | null
  customer_name?: string | null
  customer_display_name?: string | null
  site?: number | null
  site_name?: string | null
  site_display_name?: string | null
  notes?: string | null
  deleted_at?: string | null
}

export type ContactPatch = Partial<Pick<ContactCardDetail, 'name' | 'email' | 'phone' | 'department' | 'is_primary' | 'site'>>
export type ContactTab = 'det' | 'att'

type SiteOpt = { id: number; name: string; display_name?: string | null; address_line1?: string | null; city?: string | null; province?: string | null }
type Colleague = { id: number; name: string; department?: string | null; phone?: string | null; email?: string | null; is_primary?: boolean }

type Props = {
  detail: ContactCardDetail | null
  loading: boolean
  canChange: boolean
  canDelete: boolean
  tab: ContactTab
  onTab: (t: ContactTab) => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onPatch: (patch: ContactPatch, label: string) => void
  onCopy: (v: string) => void
  onOpenCustomer: () => void
  onOpenSite: () => void
  onOpenContact: (id: number) => void
  activityTab: React.ReactNode
}

const none = (t = '—') => <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{t}</Box>
const missing = (t: string) => <Box component="span" sx={{ color: 'warning.main', fontWeight: 550, fontSize: 12 }}>{t}</Box>
const tel = (p: string) => p.replace(/\s+/g, '')

/** Scheda flottante del contatto: prima i recapiti, poi dove lavora e i colleghi. */
export default function ContactDetailCard(p: Props) {
  const d = p.detail
  const sites = useList<SiteOpt>('/sites/', d?.customer ? { customer: d.customer, page_size: 200, ordering: 'name' } : null)
  const colleagues = useList<Colleague>('/contacts/', d?.customer ? { customer: d.customer, ...(d.site ? { site: d.site } : { has_site: 'false' }), page_size: 50 } : null)

  if (!d) {
    return (
      <FloatingDetail open onClose={p.onClose} title="Caricamento…" ariaLabel="Dettaglio contatto">
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{p.loading ? <CircularProgress size={22} /> : <Typography sx={{ color: 'text.secondary' }}>Contatto non trovato.</Typography>}</Box>
      </FloatingDetail>
    )
  }

  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const customer = d.customer_display_name || d.customer_name || ''
  const siteName = d.site_display_name || d.site_name || ''
  const site = sites?.find((s) => s.id === d.site) ?? null
  const others = (colleagues ?? []).filter((c) => c.id !== d.id)

  const props = [
    {
      key: 'name', label: 'Nome', full: true, disabled: !editable,
      text: { value: d.name, placeholder: 'Nome e cognome' }, display: d.name,
      onChange: (v: string) => { if (v.trim()) p.onPatch({ name: v.trim() }, 'Nome aggiornato') },
    },
    {
      key: 'dep', label: 'Reparto', full: true, disabled: !editable,
      text: { value: d.department ?? '', placeholder: 'Reparto o ruolo' }, display: d.department || none(),
      onChange: (v: string) => p.onPatch({ department: v.trim() || null }, 'Reparto aggiornato'),
    },
    {
      key: 'phone', label: 'Telefono', disabled: !editable,
      text: { value: d.phone ?? '', placeholder: 'es. 051 6584 210', mono: Boolean(d.phone) },
      display: d.phone ? <Box component="span" sx={mono}>{d.phone}</Box> : missing('Manca'),
      onChange: (v: string) => p.onPatch({ phone: v.trim() || null }, 'Telefono aggiornato'),
    },
    {
      key: 'pri', label: 'Primario', disabled: !editable, current: d.is_primary ? 'si' : 'no',
      options: [{ value: 'si', label: d.site ? 'Sì, referente del sito' : 'Sì, referente del cliente' }, { value: 'no', label: 'No' }],
      display: d.is_primary ? <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>Sì</Box> : 'No',
      onChange: (v: string) => p.onPatch({ is_primary: v === 'si' }, v === 'si' ? 'Impostato come primario' : 'Non più primario'),
    },
    {
      key: 'email', label: 'Email', full: true, disabled: !editable,
      text: { value: d.email ?? '', placeholder: 'nome@dominio.it' }, display: d.email || missing('Manca'),
      onChange: (v: string) => p.onPatch({ email: v.trim() || null }, 'Email aggiornata'),
    },
    {
      key: 'site', label: 'Sito', full: true, disabled: !editable || !sites, current: d.site ? String(d.site) : '',
      options: [{ value: '', label: 'Nessun sito (sede del cliente)' }, ...(sites ?? []).map((s) => ({ value: String(s.id), label: s.display_name || s.name }))],
      display: siteName || none('Nessun sito'),
      onChange: (v: string) => p.onPatch({ site: v ? Number(v) : null }, 'Sito aggiornato'),
    },
  ]

  const details = (
    <>
      <DetailSection title="Recapiti">
        {d.phone || d.email ? (
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 20px' }}>
            {d.phone ? <DirectLink href={`tel:${tel(d.phone)}`} icon="phone" text={d.phone} monoText onCopy={() => p.onCopy(d.phone!)} copyLabel="Copia il telefono" /> : null}
            {d.email ? <DirectLink href={`mailto:${d.email}`} icon="mail" text={d.email} onCopy={() => p.onCopy(d.email!)} copyLabel="Copia l'email" /> : null}
          </Box>
        ) : (
          <EmptyAction icon="phone" title="Nessun recapito" sub="Aggiungi telefono o email dalle Proprietà" disabled={!editable} />
        )}
      </DetailSection>

      <Properties
        storageKey="contact-props-open"
        props={props}
        summary={<>{d.department ? <Box component="span" sx={{ color: 'text.primary' }}>{d.department}</Box> : null}{d.is_primary ? <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>Primario</Box> : <Box component="span">Non primario</Box>}</>}
      />

      <Group title="Dove lavora">
        <Rows>
          <Row tile={<Tile icon="building" tone="brand" />} title={customer || '—'} sub="Cliente" chevron={Boolean(d.customer)} onClick={d.customer ? p.onOpenCustomer : undefined} />
          {d.site ? (
            <Row tile={<Tile icon="pin" tone="brand" />} title={siteName} sub={[site?.address_line1, site?.city].filter(Boolean).join(', ') || 'Sito'} chevron onClick={p.onOpenSite} />
          ) : (
            <Row tile={<Tile icon="pin" />} title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>Nessun sito</Box>} sub="Lavora per il cliente, non per un sito specifico" />
          )}
        </Rows>
      </Group>

      <Group title={d.site ? 'Colleghi nello stesso sito' : 'Altri contatti del cliente'} count={colleagues ? others.length : null}>
        {!colleagues ? <Loading /> : others.length ? (
          <Rows>
            {others.slice(0, 5).map((c) => (
              <Row key={c.id} tile={<Tile icon="user" tone={c.is_primary ? 'brand' : 'neutral'} />} chevron
                title={c.name} sub={c.department || c.email || '—'}
                end={c.phone ? (
                  <Box component="a" href={`tel:${tel(c.phone)}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} title={`Chiama ${c.name}`}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 550, color: 'text.primary', textDecoration: 'none', whiteSpace: 'nowrap', '& svg': { color: 'primary.main' }, '&:hover': { color: 'primary.main' } }}>
                    <CampoIcon name="phone" size={14} bold /><Box component="span" sx={mono}>{c.phone}</Box>
                  </Box>
                ) : null}
                onClick={() => p.onOpenContact(c.id)} />
            ))}
          </Rows>
        ) : <Empty text="Nessun altro contatto." />}
      </Group>

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
        {d.phone ? (
          <Button variant="contained" component="a" href={`tel:${tel(d.phone)}`} startIcon={<CampoIcon name="phone" size={16} bold />}>Chiama</Button>
        ) : d.email ? (
          <Button variant="contained" component="a" href={`mailto:${d.email}`} startIcon={<CampoIcon name="mail" size={16} bold />}>Scrivi</Button>
        ) : null}
      </>
    )
  ) : undefined

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio contatto"
      status={d.is_primary ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.875, py: '2px', borderRadius: '5px', bgcolor: 'rgb(255 255 255 / .16)', color: '#fff' }}>Primario</Box> : undefined}
      title={d.name}
      subtitle={[d.department, customer, siteName].filter(Boolean).join(' · ') || undefined}
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'att', label: 'Attività' }]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as ContactTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !p.canChange },
        ...(d.phone ? [{ label: 'Copia il telefono', icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.phone!) }] : []),
        ...(d.email ? [{ label: "Copia l'email", icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.email!) }] : []),
        ...(d.customer ? [{ label: 'Apri il cliente', icon: <CampoIcon name="building" />, onClick: p.onOpenCustomer }] : []),
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? details : p.activityTab}
    </FloatingDetail>
  )
}
