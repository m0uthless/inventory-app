import * as React from 'react'
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import AddIcon from '@mui/icons-material/Add'
import { api } from '@shared/api/client'
import { CampoIcon, ContactsBlock, DetailSection, EmptyAction, FloatingDetail, linkBtnSx, MapBlock, Properties, StatRow } from '../../ui/campo'
import { daysTo, dIt, EXPIRING_DAYS, VendorMark } from './customerUi'

export type CustomerCardDetail = {
  id: number
  code: string
  name: string
  display_name: string
  city?: string | null
  province?: string | null
  primary_contact_id?: number | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  vat_number?: string | null
  tax_code?: string | null
  status?: number | null
  status_label?: string | null
  notes?: string | null
  has_vpn?: boolean | null
  sites_count?: number
  assets_count?: number
  open_issues_count?: number
  active_contracts_count?: number
  next_contract_end?: string | null
  next_contract_title?: string | null
  deleted_at?: string | null
}

export type CustomerPatch = Partial<Pick<CustomerCardDetail, 'status' | 'name' | 'display_name' | 'vat_number' | 'tax_code' | 'province'>>
export type CustomerTab = 'det' | 'sites' | 'inv' | 'doc' | 'att'

type Contact = { id: number; name: string; email?: string | null; phone?: string | null; department?: string | null; is_primary?: boolean; site?: number | null; site_name?: string | null; site_display_name?: string | null }
type Vpn = { applicativo?: string | null; utenza?: string | null; password?: string | null; remote_address?: string | null; porta?: string | null }

type Props = {
  detail: CustomerCardDetail | null
  loading: boolean
  statuses: { id: number; label: string }[]
  vendorColor: (label: string) => string
  canChange: boolean
  canDelete: boolean
  canEditVpn: boolean
  tab: CustomerTab
  onTab: (t: CustomerTab) => void
  counts: { sites: number | null; inventories: number | null; drive: number | null; contracts: number | null; devices: number | null }
  address: string | null
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onPatch: (patch: CustomerPatch, label: string) => void
  onCopy: (v: string) => void
  onEditVpn: () => void
  onNewIssue: () => void
  onAllContacts: () => void
  /** Ricarica VPN e contatti (dopo il modulo VPN). */
  reloadKey?: unknown
  sitesTab: React.ReactNode
  inventoriesTab: React.ReactNode
  documentsTab: React.ReactNode
  activityTab: React.ReactNode
}

const none = (t = '—') => <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{t}</Box>
const mono = { fontFamily: '"Geist Mono", monospace' }

function useCustomerContacts(id: number | null, reloadKey: unknown) {
  const [rows, setRows] = React.useState<Contact[] | null>(null)
  React.useEffect(() => {
    if (!id) { setRows(null); return }
    let alive = true
    api.get('/contacts/', { params: { customer: id, page_size: 100, ordering: 'name' } })
      .then((r) => { const d = r.data as { results?: Contact[] } | Contact[]; if (alive) setRows(Array.isArray(d) ? d : d.results ?? []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [id, reloadKey])
  return rows
}

function useCustomerVpn(id: number | null, has: boolean, reloadKey: unknown) {
  const [vpn, setVpn] = React.useState<Vpn | null>(null)
  React.useEffect(() => {
    if (!id || !has) { setVpn(null); return }
    let alive = true
    api.get<Vpn>(`/customers/${id}/vpn/`).then((r) => { if (alive) setVpn(r.data) }).catch(() => { if (alive) setVpn(null) })
    return () => { alive = false }
  }, [id, has, reloadKey])
  return vpn
}

/** Scheda flottante del cliente (DESIGN.md › Detail card), come Issue e Purchase Order. */
export default function CustomerDetailCard(p: Props) {
  const d = p.detail
  const contacts = useCustomerContacts(d?.id ?? null, p.reloadKey)
  const vpn = useCustomerVpn(d?.id ?? null, Boolean(d?.has_vpn), p.reloadKey)
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => { setShown(false) }, [d?.id])
  React.useEffect(() => { if (!shown) return; const t = window.setTimeout(() => setShown(false), 30000); return () => window.clearTimeout(t) }, [shown])

  if (!d) {
    return (
      <FloatingDetail open onClose={p.onClose} title="Caricamento…" ariaLabel="Dettaglio cliente">
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{p.loading ? <CircularProgress size={22} /> : <Typography sx={{ color: 'text.secondary' }}>Cliente non trovato.</Typography>}</Box>
      </FloatingDetail>
    )
  }

  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const vColor = p.vendorColor(d.status_label || '')
  const next = d.next_contract_end ? daysTo(d.next_contract_end) : null
  const soon = next != null && next <= EXPIRING_DAYS
  const primary = contacts?.find((c) => c.id === d.primary_contact_id) ?? null
  const others = (contacts ?? []).filter((c) => c.id !== d.primary_contact_id)
  
  const props = [
    {
      key: 'ven', label: 'Vendor', disabled: !editable, current: d.status ? String(d.status) : '',
      options: p.statuses.map((s) => ({ value: String(s.id), label: <VendorMark label={s.label} color={p.vendorColor(s.label)} /> })),
      display: <VendorMark label={d.status_label} color={vColor} />,
      onChange: (v: string) => p.onPatch({ status: Number(v) }, 'Vendor aggiornato'),
    },
    { key: 'code', label: 'Codice', disabled: true, display: <Box component="span" sx={mono}>{d.code}</Box> },
    {
      key: 'name', label: 'Ragione sociale', full: true, disabled: !editable,
      text: { value: d.name, placeholder: 'Ragione sociale' }, display: d.name,
      onChange: (v: string) => { if (v.trim()) p.onPatch({ name: v.trim() }, 'Ragione sociale aggiornata') },
    },
    {
      key: 'dn', label: 'Nome breve', full: true, disabled: !editable,
      text: { value: d.display_name, placeholder: 'Come compare negli elenchi' }, display: d.display_name || none(),
      onChange: (v: string) => p.onPatch({ display_name: v.trim() || d.name }, 'Nome aggiornato'),
    },
    {
      key: 'vat', label: 'P.IVA', disabled: !editable,
      text: { value: d.vat_number ?? '', placeholder: '11 cifre', mono: Boolean(d.vat_number) },
      display: d.vat_number ? <Box component="span" sx={mono}>{d.vat_number}</Box> : <Box component="span" sx={{ color: 'warning.main', fontWeight: 550, fontSize: 12 }}>Manca</Box>,
      onChange: (v: string) => p.onPatch({ vat_number: v.trim() || null }, 'P.IVA aggiornata'),
    },
    {
      key: 'tax', label: 'Codice fiscale', disabled: !editable,
      text: { value: d.tax_code ?? '', mono: true },
      display: d.tax_code ? <Box component="span" sx={mono}>{d.tax_code}</Box> : none(),
      onChange: (v: string) => p.onPatch({ tax_code: v.trim() || null }, 'Codice fiscale aggiornato'),
    },
    {
      key: 'prov', label: 'Provincia', disabled: !editable,
      text: { value: d.province ?? '', placeholder: 'es. BO' },
      display: d.province || none(),
      onChange: (v: string) => p.onPatch({ province: v.trim().toUpperCase() || null }, 'Provincia aggiornata'),
    },
    { key: 'city', label: 'Città', disabled: true, display: d.city || none() },
  ]

  const credRow = (label: string, value: React.ReactNode, actions: React.ReactNode) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) auto', alignItems: 'center', gap: 1, minHeight: 38, pl: 1.5, pr: 0.5, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...mono }}>{value}</Box>
      <Box sx={{ display: 'inline-flex' }}>{actions}</Box>
    </Box>
  )
  const copyBtn = (v: string, label: string) => (
    <Tooltip title="Copia"><IconButton size="small" aria-label={label} onClick={() => p.onCopy(v)} sx={{ width: 28, height: 28 }}><CampoIcon name="copy" size={14} /></IconButton></Tooltip>
  )

  // L'indirizzo arriva come "via, civico, città": l'ultima parte è la città.
  const addrParts = (p.address ?? '').split(', ')
  const cityPart = addrParts.length > 1 ? addrParts.pop()! : ''
  const street = addrParts.join(', ')
  const rest = cityPart ? [cityPart] : []

  const details = (
    <>
      <Properties
        storageKey="customer-props-open"
        props={props}
        summary={<><VendorMark label={d.status_label} color={vColor} />{d.vat_number ? <Box component="span" sx={{ ...mono, color: 'text.secondary' }}>{d.vat_number}</Box> : <Box component="span" sx={{ color: 'warning.main', fontWeight: 550 }}>P.IVA mancante</Box>}</>}
      />

      <StatRow items={[
        { label: 'Siti', value: d.sites_count ?? p.counts.sites ?? '—', onClick: () => p.onTab('sites') },
        { label: 'Inventari', value: d.assets_count ?? p.counts.inventories ?? '—', onClick: () => p.onTab('inv') },
        { label: 'Issue aperte', value: d.open_issues_count ?? 0, onClick: () => p.onTab('sites') },
        { label: 'Contratti', value: d.active_contracts_count ?? p.counts.contracts ?? '—', onClick: () => p.onTab('doc'), warn: soon,
          tip: d.next_contract_end ? `${d.next_contract_title ? d.next_contract_title + ' · ' : ''}${soon ? 'scade' : 'prossima scadenza'} il ${dIt(d.next_contract_end)}` : undefined },
      ]} />

      <ContactsBlock
        loaded={Boolean(contacts)}
        primary={d.primary_contact_id ? { name: d.primary_contact_name || '—', role: primary?.department, phone: d.primary_contact_phone, email: d.primary_contact_email } : null}
        others={others.map((c) => ({ id: c.id, name: c.name, role: c.department, where: c.site_display_name || c.site_name || 'Nessun sito', phone: c.phone, email: c.email }))}
        onAll={p.onAllContacts}
        onCopy={p.onCopy}
      />

      <DetailSection title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="lock" size={13} />Accesso remoto</Box>}
        end={d.has_vpn ? (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {vpn?.applicativo ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.875, py: '1px' }}>{vpn.applicativo}</Box> : null}
            {p.canEditVpn && !deleted ? <Button size="small" sx={linkBtnSx} onClick={p.onEditVpn}>Modifica</Button> : null}
          </Box>
        ) : undefined}>
        {d.has_vpn ? (
          vpn ? (
            <>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper' }}>
                {credRow('Indirizzo', vpn.remote_address ? <>{vpn.remote_address}{vpn.porta ? <Box component="span" sx={{ color: 'text.secondary' }}>:{vpn.porta}</Box> : null}</> : none(),
                  vpn.remote_address ? copyBtn(vpn.porta ? `${vpn.remote_address}:${vpn.porta}` : vpn.remote_address, "Copia l'indirizzo") : null)}
                {credRow('Utenza', vpn.utenza || none(), vpn.utenza ? copyBtn(vpn.utenza, "Copia l'utenza") : null)}
                {credRow('Password',
                  vpn.password ? (
                    <Box component="span" sx={shown ? { bgcolor: 'warning.light', color: 'text.primary', borderRadius: '4px', px: 0.5 } : { letterSpacing: '.08em', color: 'text.secondary' }}>{shown ? vpn.password : '••••••••'}</Box>
                  ) : <Box component="span" sx={{ fontFamily: 'inherit', fontSize: 12, color: 'text.secondary' }}>{'password' in vpn ? '—' : 'Serve il permesso Credenziali VPN'}</Box>,
                  vpn.password ? (
                    <>
                      <Tooltip title={shown ? 'Nascondi' : 'Mostra · si nasconde dopo 30 secondi'}>
                        <IconButton size="small" aria-pressed={shown} aria-label={shown ? 'Nascondi la password VPN' : 'Mostra la password VPN'} onClick={() => setShown((v) => !v)} sx={{ width: 28, height: 28, color: shown ? 'warning.main' : undefined }}>
                          <CampoIcon name={shown ? 'eyeOff' : 'eye'} size={14} />
                        </IconButton>
                      </Tooltip>
                      {copyBtn(vpn.password, 'Copia la password VPN')}
                    </>
                  ) : null)}
              </Box>
              <Typography sx={{ mt: 0.75, fontSize: 11, color: 'text.disabled' }}>La password è visibile solo con il permesso Credenziali VPN.</Typography>
            </>
          ) : <Box sx={{ py: 1 }}><CircularProgress size={16} /></Box>
        ) : (
          <EmptyAction icon="lock" title="Nessun accesso remoto" sub="Registra VPN, utenza e password del cliente" onClick={p.canEditVpn && !deleted ? p.onEditVpn : undefined} />
        )}
      </DetailSection>

      {p.address ? <MapBlock street={street} place={`${rest.join(', ')}${d.province ? ` (${d.province})` : ''}`} query={p.address} /> : null}

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

  const docCount = (p.counts.contracts ?? 0) + (p.counts.drive ?? 0)
  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio cliente"
      idLabel={<Box component="span" sx={mono}>{d.code}</Box>}
      status={d.status_label ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.875, py: '2px', borderRadius: '5px', bgcolor: 'rgb(255 255 255 / .16)', color: '#fff' }}>{d.status_label}</Box> : undefined}
      title={d.display_name || d.name}
      subtitle={[d.name !== d.display_name ? d.name : null, d.city ? `${d.city}${d.province ? ` (${d.province})` : ''}` : d.province].filter(Boolean).join(' · ')}
      tabs={[
        { key: 'det', label: 'Dettagli' },
        { key: 'sites', label: 'Siti', count: p.counts.sites },
        { key: 'inv', label: 'Inventari', count: p.counts.inventories },
        { key: 'doc', label: 'Documenti', count: p.counts.contracts == null && p.counts.drive == null ? null : docCount },
        { key: 'att', label: 'Attività' },
      ]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as CustomerTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !p.canChange },
        { label: 'Copia codice cliente', icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.code) },
        ...(d.vat_number ? [{ label: 'Copia P.IVA', icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.vat_number!) }] : []),
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? details
        : p.tab === 'sites' ? p.sitesTab
        : p.tab === 'inv' ? p.inventoriesTab
        : p.tab === 'doc' ? p.documentsTab
        : p.activityTab}
    </FloatingDetail>
  )
}
