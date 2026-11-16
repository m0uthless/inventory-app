import * as React from 'react'
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { CampoIcon, DetailSection, FloatingDetail, Properties } from '../../ui/campo'
import { Empty, mono, Row, Rows, Tile } from '../../ui/campo/ListRows'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { FileIcon } from '../drive/DriveIcons'
import { formatEuro } from '../purchaseorders/types'
import { daysLabel, dShort, expiryHint } from './contractModel'
import { ContractStatusBadge, ExpiryBadge, PeriodBar } from './contractUi'
import {
  BILLING_FREQ_OPTIONS, CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS,
  type CompanyOption, type ContractDetail, type Seller,
} from './types'

export type ContractPatch = Partial<Pick<ContractDetail,
  'status' | 'contract_type' | 'seller' | 'company' | 'billing_freq' | 'start_date' | 'end_date' | 'notice_days' | 'auto_renew' | 'total_value' | 'code' | 'title'>>
export type ContractTab = 'det' | 'dev' | 'att'

type Props = {
  detail: ContractDetail | null
  loading: boolean
  sellers: Seller[]
  companies: CompanyOption[]
  canChange: boolean
  canDelete: boolean
  canViewValue: boolean
  documentBusy: boolean
  tab: ContractTab
  onTab: (t: ContractTab) => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onRenew: () => void
  onPatch: (patch: ContractPatch, label: string) => void
  onCopy: (v: string) => void
  onOpenCustomer: () => void
  onUploadDocument: (file: File) => void
  onDeleteDocument: () => void
}

const none = (t = '—') => <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{t}</Box>
const FIELDS: Record<string, string> = {
  code: 'il codice', title: 'il titolo', customer: 'il cliente', contract_type: 'il tipo', seller: 'il venditore', company: 'la società',
  start_date: "l'inizio", end_date: 'la fine', auto_renew: 'il rinnovo automatico', notice_days: 'il preavviso', billing_freq: 'la fatturazione',
  status: 'lo stato', devices: 'i device', notes: 'le note', document: 'il documento',
}

/** Mesi interi (arrotondati) tra due date ISO. */
const monthsBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / (30.44 * 86_400_000)))

/** Scheda flottante del contratto (DESIGN.md › Detail card), come Siti e PO. */
export default function ContractDetailCard(p: Props) {
  const d = p.detail
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  if (!d) {
    return (
      <FloatingDetail open onClose={p.onClose} title="Caricamento…" ariaLabel="Dettaglio contratto">
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{p.loading ? <CircularProgress size={22} /> : <Typography sx={{ color: 'text.secondary' }}>Contratto non trovato.</Typography>}</Box>
      </FloatingDetail>
    )
  }

  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const months = monthsBetween(d.start_date, d.end_date)
  const value = d.total_value !== undefined ? Number(d.total_value) : null
  const perYear = value != null ? (value / months) * 12 : null
  const opt = <T extends string>(list: { value: T; label: string }[]) => list.map((o) => ({ value: o.value, label: o.label }))
  const needsAction = d.expiry_state === 'expired' || d.expiry_state === 'expiring' || d.expiry_state === 'notice'

  const props = [
    {
      key: 'st', label: 'Stato', disabled: !editable, current: d.status,
      options: CONTRACT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: <ContractStatusBadge status={o.value} label={o.label} /> })),
      display: <ContractStatusBadge status={d.status} label={d.status_label} />,
      onChange: (v: string) => p.onPatch({ status: v as ContractDetail['status'] }, 'Stato aggiornato'),
    },
    {
      key: 'type', label: 'Tipo', disabled: !editable, current: d.contract_type, options: opt(CONTRACT_TYPE_OPTIONS),
      display: d.contract_type_label, onChange: (v: string) => p.onPatch({ contract_type: v as ContractDetail['contract_type'] }, 'Tipo aggiornato'),
    },
    {
      key: 'cust', label: 'Cliente', disabled: true,
      display: <Box component="span" sx={{ fontWeight: 550 }}>{d.customer_name}</Box>,
    },
    {
      key: 'seller', label: 'Venditore', disabled: !editable || !p.sellers.length, current: d.seller ? String(d.seller) : '',
      options: [{ value: '', label: 'Nessuno' }, ...p.sellers.filter((s) => s.is_active || s.id === d.seller).map((s) => ({ value: String(s.id), label: s.name }))],
      display: d.seller_name || none(), onChange: (v: string) => p.onPatch({ seller: v ? Number(v) : null }, 'Venditore aggiornato'),
    },
    {
      key: 'company', label: 'Società', disabled: !editable, current: d.company ? String(d.company) : '',
      options: p.companies.map((c) => ({ value: String(c.id), label: c.label })),
      display: d.company_label || none(), onChange: (v: string) => p.onPatch({ company: v ? Number(v) : null }, 'Società aggiornata'),
    },
    {
      key: 'bill', label: 'Fatturazione', disabled: !editable, current: d.billing_freq, options: opt(BILLING_FREQ_OPTIONS),
      display: d.billing_freq_label, onChange: (v: string) => p.onPatch({ billing_freq: v as ContractDetail['billing_freq'] }, 'Fatturazione aggiornata'),
    },
    {
      key: 'start', label: 'Inizio', disabled: !editable, text: { value: d.start_date, type: 'date' as const }, display: dShort(d.start_date),
      onChange: (v: string) => { if (v) p.onPatch({ start_date: v }, 'Inizio aggiornato') },
    },
    {
      key: 'end', label: 'Fine', disabled: !editable, text: { value: d.end_date, type: 'date' as const }, display: dShort(d.end_date),
      onChange: (v: string) => { if (v) p.onPatch({ end_date: v }, 'Fine aggiornata') },
    },
    {
      key: 'notice', label: 'Preavviso', disabled: !editable, text: { value: String(d.notice_days), placeholder: 'giorni' }, display: `${d.notice_days} giorni`,
      onChange: (v: string) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) p.onPatch({ notice_days: n }, 'Preavviso aggiornato') },
    },
    {
      key: 'renew', label: 'Rinnovo automatico', disabled: !editable, current: d.auto_renew ? '1' : '0',
      options: [{ value: '1', label: 'Sì (solo promemoria)' }, { value: '0', label: 'No' }],
      display: d.auto_renew ? 'Sì' : 'No', onChange: (v: string) => p.onPatch({ auto_renew: v === '1' }, 'Rinnovo automatico aggiornato'),
    },
    ...(p.canViewValue ? [{
      key: 'value', label: 'Valore totale', disabled: !editable, text: { value: d.total_value ?? '', placeholder: '0,00', mono: true },
      display: value != null ? formatEuro(value) : none(),
      onChange: (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); if (Number.isFinite(n) && n >= 0) p.onPatch({ total_value: n.toFixed(2) }, 'Valore aggiornato') },
    }] : []),
    {
      key: 'code', label: 'Codice', full: true, disabled: !editable, text: { value: d.code, mono: true }, display: <Box component="span" sx={mono}>{d.code}</Box>,
      onChange: (v: string) => { if (v.trim()) p.onPatch({ code: v.trim() }, 'Codice aggiornato') },
    },
    {
      key: 'title', label: 'Titolo', full: true, disabled: !editable, text: { value: d.title }, display: d.title,
      onChange: (v: string) => { if (v.trim()) p.onPatch({ title: v.trim() }, 'Titolo aggiornato') },
    },
  ]

  const details = (
    <>
      <Properties
        storageKey="contract-props-open"
        props={props}
        summary={<><Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{d.contract_type_label}</Box><Box component="span" sx={{ color: 'text.secondary' }}>{[d.seller_name, d.company_label].filter(Boolean).join(' · ')}</Box></>}
      />

      <DetailSection title="Periodo" end={<ExpiryBadge state={d.expiry_state} end={d.end_date} notice={d.notice_deadline} />}>
        <PeriodBar start={d.start_date} end={d.end_date} notice={d.notice_deadline} state={d.expiry_state} />
        <Box sx={{
          mt: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px', borderRadius: '8px',
          bgcolor: needsAction ? (d.expiry_state === 'expired' ? 'error.light' : 'warning.light') : 'archie.neutralBg',
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: needsAction ? (d.expiry_state === 'expired' ? 'error.main' : 'warning.main') : 'text.primary' }}>
              {d.status !== 'attivo' ? `Contratto ${d.status_label.toLowerCase()}` : d.expiry_state === 'expired' ? `Scaduto il ${dShort(d.end_date)}` : `Finisce ${daysLabel(d.end_date)}`}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {expiryHint(d.expiry_state, d.end_date, d.notice_deadline)}{d.auto_renew ? ' Rinnovo automatico indicato nel contratto.' : ''}
            </Typography>
          </Box>
        </Box>
      </DetailSection>

      {p.canViewValue ? (
        <DetailSection title="Importo">
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap', mb: 1 }}>
            <Typography component="b" sx={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{value != null ? formatEuro(value) : '—'}</Typography>
            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>su {months} {months === 1 ? 'mese' : 'mesi'} · fatturazione {d.billing_freq_label.toLowerCase()}</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', '& > div + div': { borderLeft: '1px solid', borderColor: 'divider' } }}>
            {[
              ['Al mese', value != null ? formatEuro(value / months) : '—'],
              ["All'anno", perYear != null ? formatEuro(perYear) : '—'],
            ].map(([l, v]) => (
              <Box key={l} sx={{ px: 1.25, py: 0.875 }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{l}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ mt: 0.75, fontSize: 11, color: 'text.disabled' }}>Ripartizione lineare sul periodo del contratto.</Typography>
        </DetailSection>
      ) : null}

      {/* Il PDF riporta di norma il prezzo: visibile solo con il permesso sui valori. */}
      {p.canViewValue ? (
        <DetailSection title="Documento">
          {d.document_url ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
              <FileIcon kind="pdf" size={30} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{d.document_filename || 'contratto.pdf'}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>PDF del contratto</Typography>
              </Box>
              <Tooltip title="Apri il PDF"><IconButton size="small" aria-label="Apri documento" onClick={() => d.document_url && window.open(d.document_url, '_blank', 'noopener')}><CampoIcon name="eye" size={16} /></IconButton></Tooltip>
              {editable ? <Tooltip title="Sostituisci"><IconButton size="small" aria-label="Sostituisci documento" disabled={p.documentBusy} onClick={() => fileRef.current?.click()}><CampoIcon name="upload" size={16} /></IconButton></Tooltip> : null}
              {editable ? <Tooltip title="Rimuovi"><IconButton size="small" aria-label="Rimuovi documento" disabled={p.documentBusy} onClick={p.onDeleteDocument}>{p.documentBusy ? <CircularProgress size={14} /> : <CampoIcon name="trash" size={16} />}</IconButton></Tooltip> : null}
            </Box>
          ) : editable ? (
            <Box component="button" type="button" disabled={p.documentBusy} onClick={() => fileRef.current?.click()} sx={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 12px', borderRadius: '8px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
              border: '1px dashed', borderColor: 'archie.borderStrong', bgcolor: 'transparent', color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' }, '&:focus-visible': { outline: 'none', boxShadow: (t) => t.palette.archie.focusRing },
            }}>
              {p.documentBusy ? <CircularProgress size={16} /> : <CampoIcon name="upload" size={18} />}
              <Box><Box component="b" sx={{ display: 'block', fontSize: 13, color: 'text.primary', fontWeight: 600 }}>Carica il PDF del contratto</Box><Box component="span" sx={{ fontSize: 12 }}>Un solo file, visibile a chi vede i valori</Box></Box>
            </Box>
          ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessun documento caricato.</Typography>}
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onUploadDocument(f) }} />
        </DetailSection>
      ) : null}

      <DetailSection title="Note">
        {d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna nota.</Typography>}
      </DetailSection>
    </>
  )

  const devices = d.devices_detail.length ? (
    <Rows>
      {d.devices_detail.map((x) => (
        <Row key={x.id} tile={<Tile icon="monitor" />} title={x.label} sub={x.serial_number ? <Box component="span" sx={mono}>S/N {x.serial_number}</Box> : undefined} />
      ))}
    </Rows>
  ) : <Empty text={editable ? 'Nessun device collegato: aggiungili da «Modifica tutti i campi».' : 'Nessun device collegato.'} />

  const footer = p.tab === 'det' ? (
    deleted ? (
      <>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nel cestino</Typography>
        <Box sx={{ flex: 1 }} />
        {p.canChange ? <Button variant="contained" startIcon={<RestoreFromTrashIcon />} onClick={p.onRestore}>Ripristina</Button> : null}
      </>
    ) : p.canChange ? (
      <>
        <Button variant="outlined" startIcon={<EditIcon />} onClick={p.onEdit}>Modifica</Button>
        <Box sx={{ flex: 1 }} />
        {d.status === 'attivo' ? <Button variant="contained" startIcon={<AutorenewIcon />} onClick={p.onRenew}>Rinnova</Button> : null}
      </>
    ) : undefined
  ) : undefined

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio contratto"
      idLabel={<Box component="span" sx={mono}>{d.code}</Box>}
      status={<ContractStatusBadge status={d.status} label={d.status_label} onDark />}
      title={d.title}
      subtitle={[d.customer_name, d.contract_type_label, `${dShort(d.start_date)} → ${dShort(d.end_date)}`].join(' · ')}
      tabs={[
        { key: 'det', label: 'Dettagli' },
        { key: 'dev', label: 'Device', count: d.devices_detail.length },
        { key: 'att', label: 'Attività' },
      ]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as ContractTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !p.canChange },
        { label: 'Apri il cliente', icon: <CampoIcon name="building" />, onClick: p.onOpenCustomer },
        { label: 'Copia il codice', icon: <CampoIcon name="copy" />, onClick: () => p.onCopy(d.code) },
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? details
        : p.tab === 'dev' ? devices
        : <AuditFeedPanel appLabel="contracts" model="contract" objectId={d.id} fields={FIELDS} noun="il contratto" />}
    </FloatingDetail>
  )
}
