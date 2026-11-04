import * as React from 'react'
import { Box, Button, CircularProgress, IconButton, Link, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import { FloatingDetail, DetailSection, Properties } from '../../ui/campo'
import { Committente, PoStatusBadge } from './PoBadges'
import {
  DOCUMENT_SLOT_LABEL, STATUS_LABEL, STATUS_ORDER, formatEuro, nextStatus, prevStatus,
  type DocumentSlot, type PurchaseOrderDetail, type PurchaseOrderKind,
} from './types'

export type PoPatch = Partial<{ kind: PurchaseOrderKind; offer_date: string; purchase_order: string; invoice_number: string; costs_incurred: string | null }>

type Props = {
  detail: PurchaseOrderDetail | null
  loading: boolean
  committenteColor: string
  canChange: boolean
  canDelete: boolean
  tab: 'det' | 'doc'
  onTab: (t: 'det' | 'doc') => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onCopy: (v: string) => void
  onPatch: (patch: PoPatch, label: string) => void
  onAdvance: () => void
  onRevert: () => void
  uploadingSlot: DocumentSlot | null
  deletingDocId: number | null
  onUploadDocument: (slot: DocumentSlot, file: File) => void
  onDeleteDocument: (docId: number) => void
}

const SLOTS: DocumentSlot[] = ['offer', 'po', 'invoice']
const NEXT_LABEL: Record<string, string> = { inviato: 'Segna come inviato', ricevuto: 'Registra PO ricevuto', fatturato: 'Registra fattura' }
// Soglie "da sollecitare" (decise per il restyle): giorni fermi nello stato corrente.
const SOLLECITO: Record<string, number> = { inserito: 7, inviato: 21, ricevuto: 14 }
const DAY = 864e5

const dIt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const num = (v?: string | null) => (v == null || v === '' ? null : Number(v))

export default function PurchaseOrderDetailCard(p: Props) {
  const d = p.detail
  const fileRefs = React.useRef<Partial<Record<DocumentSlot, HTMLInputElement | null>>>({})
  const [now] = React.useState(() => Date.now())
  if (!d) {
    return p.loading ? (
      <FloatingDetail open onClose={p.onClose} title="Caricamento…" ariaLabel="Dettaglio Purchase Order">
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={22} /></Box>
      </FloatingDetail>
    ) : null
  }

  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const docsBy = (slot: DocumentSlot) => d.documents.filter((x) => x.kind === slot)
  const idx = STATUS_ORDER.indexOf(d.status)
  const stepDate: Record<string, string | null | undefined> = { inserito: d.offer_date, inviato: d.sent_at, ricevuto: d.received_at, fatturato: d.invoiced_at }
  const since = stepDate[d.status] ? Math.max(0, Math.round((now - new Date(stepDate[d.status]!).getTime()) / DAY)) : null
  const cycle = d.status === 'fatturato' && d.invoiced_at ? Math.max(0, Math.round((new Date(d.invoiced_at).getTime() - new Date(d.offer_date).getTime()) / DAY)) : null
  const waitLabel = { inserito: 'Offerta da inviare da', inviato: 'In attesa del PO da', ricevuto: 'Fattura da emettere da', fatturato: 'Ciclo completato in' }[d.status]
  const late = since != null && SOLLECITO[d.status] != null && since > SOLLECITO[d.status]
  const amount = num(d.amount) ?? 0
  const costs = num(d.costs_incurred)
  const margin = costs != null ? amount - costs : null
  const cust = d.customer_name || d.customer_code || d.customer_placeholder || ''
  const next = nextStatus(d.status)
  const prev = prevStatus(d.status)

  const steps = [
    { s: 'inserito', label: 'Offerta inserita', date: d.offer_date, slot: 'offer' as DocumentSlot },
    { s: 'inviato', label: 'Offerta inviata', date: d.sent_at, slot: null },
    { s: 'ricevuto', label: 'PO ricevuto', date: d.received_at, slot: 'po' as DocumentSlot, code: d.purchase_order },
    { s: 'fatturato', label: 'Fatturato', date: d.invoiced_at, slot: 'invoice' as DocumentSlot, code: d.invoice_number },
  ]

  const props = [
    {
      key: 'kind', label: 'Tipo', current: d.kind, disabled: !editable,
      options: [{ value: 'ordinario', label: 'Ordinario' }, { value: 'extra', label: 'Extra' }],
      display: d.kind_label || d.kind,
      onChange: (v: string) => p.onPatch({ kind: v as PurchaseOrderKind }, 'Tipo aggiornato'),
    },
    {
      key: 'offer', label: 'Data offerta', disabled: !editable,
      text: { value: d.offer_date, type: 'date' as const },
      display: dIt(d.offer_date),
      onChange: (v: string) => { if (v) p.onPatch({ offer_date: v }, 'Data offerta aggiornata') },
    },
    {
      key: 'po', label: 'PO', disabled: !editable,
      text: { value: d.purchase_order ?? '', placeholder: 'es. 4500213377', mono: true },
      display: d.purchase_order || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>—</Box>,
      onChange: (v: string) => p.onPatch({ purchase_order: v.trim() }, 'Purchase Order aggiornato'),
    },
    {
      key: 'inv', label: 'N. fattura', disabled: !editable,
      text: { value: d.invoice_number ?? '', placeholder: 'es. FT 2026/1103', mono: true },
      display: d.invoice_number || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>—</Box>,
      onChange: (v: string) => p.onPatch({ invoice_number: v.trim() }, 'Numero fattura aggiornato'),
    },
    {
      key: 'costs', label: 'Costi', disabled: !editable, full: true,
      text: { value: d.costs_incurred ?? '', placeholder: '0,00' },
      display: costs != null ? formatEuro(costs) : <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>—</Box>,
      onChange: (v: string) => {
        const t = v.trim().replace(/\./g, '').replace(',', '.')
        p.onPatch({ costs_incurred: t === '' ? null : t }, 'Costi aggiornati')
      },
    },
  ]

  const footer = p.tab === 'det' ? (
    deleted ? (
      <>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nel cestino</Typography>
        <Box sx={{ flex: 1 }} />
        {p.canChange ? <Button variant="contained" startIcon={<RestoreFromTrashIcon />} onClick={p.onRestore}>Ripristina</Button> : null}
      </>
    ) : (
      <>
        {editable && prev ? <Button variant="outlined" startIcon={<ChevronLeftIcon />} onClick={p.onRevert}>Torna a {STATUS_LABEL[prev]}</Button> : null}
        <Box sx={{ flex: 1 }} />
        {editable && next ? (
          <Button variant="contained" startIcon={<ArrowForwardIcon />} onClick={p.onAdvance}>{NEXT_LABEL[next]}</Button>
        ) : d.status === 'fatturato' ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <CheckIcon sx={{ fontSize: 15, color: 'success.main' }} />Completato il {dIt(d.invoiced_at)}
          </Typography>
        ) : null}
      </>
    )
  ) : (
    <>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>I PDF si possono caricare anche dopo il cambio di stato.</Typography>
    </>
  )

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio Purchase Order"
      idLabel={`#${d.id}`}
      status={<PoStatusBadge status={d.status} onDark />}
      title={d.description}
      subtitle={<>{d.client_name}{cust && cust !== d.client_name ? <> <ArrowForwardIcon sx={{ fontSize: 12, opacity: 0.7 }} /> {cust}</> : null}</>}
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'doc', label: 'Documenti', count: d.documents.length }]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as 'det' | 'doc')}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !p.canChange },
        ...(d.purchase_order ? [{ label: 'Copia numero PO', icon: <ContentCopyIcon />, onClick: () => p.onCopy(d.purchase_order!) }] : []),
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? (
        <>
          <Properties
            storageKey="po-props-open"
            props={props}
            summary={<><Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{d.kind_label || d.kind}</Box><Committente name={d.client_name} color={p.committenteColor} /></>}
          />

          <Box component="section" aria-label="Flusso">
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
              <Box>
                <Typography component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>{waitLabel}</Typography>
                <Typography component="b" sx={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                  {(() => { const n = d.status === 'fatturato' ? cycle : since; return n == null ? '—' : `${n} ${n === 1 ? 'giorno' : 'giorni'}` })()}
                </Typography>
              </Box>
              {d.status !== 'fatturato' && since != null ? (
                <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.75, py: '1px', borderRadius: '5px', bgcolor: late ? 'warning.light' : 'archie.neutralBg', color: late ? 'warning.main' : 'text.secondary' }}>
                  {late ? 'Da sollecitare' : 'Nei tempi'}
                </Box>
              ) : null}
            </Box>
            {steps.map((st, j) => {
              const done = j <= idx
              const cur = j === idx + 1
              const docs = st.slot ? docsBy(st.slot) : []
              return (
                <Box key={st.s} sx={{
                  display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 1.25, position: 'relative', pb: j < 3 ? 1.5 : 0,
                  '&::before': j < 3 ? { content: '""', position: 'absolute', left: 10, top: 22, bottom: 0, width: 2, bgcolor: j < idx ? 'primary.main' : 'divider' } : undefined,
                }}>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', zIndex: 1, fontSize: 10, fontWeight: 700,
                    bgcolor: done ? 'primary.main' : 'background.paper', color: done ? 'primary.contrastText' : cur ? 'primary.main' : 'text.secondary',
                    boxShadow: (t) => done ? 'none' : cur ? `inset 0 0 0 2px ${t.palette.primary.main}, 0 0 0 4px ${t.palette.archie.field}` : `inset 0 0 0 2px ${t.palette.archie.borderStrong}`,
                  }}>{done ? <CheckIcon sx={{ fontSize: 13 }} /> : j + 1}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: done || cur ? 600 : 500, color: done || cur ? 'text.primary' : 'text.secondary', lineHeight: '22px' }}>{st.label}</Typography>
                    <Typography sx={{ fontSize: 11, color: cur ? 'primary.main' : 'text.secondary', fontWeight: cur ? 600 : 400 }}>
                      {done ? <>{dIt(st.date)}{st.code ? <> · <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace' }}>{st.code}</Box></> : null}</> : cur ? 'prossimo passo' : 'da fare'}
                    </Typography>
                  </Box>
                  {st.slot && done ? (
                    <Button size="small" variant="outlined" onClick={() => p.onTab('doc')} startIcon={<DescriptionOutlinedIcon />}
                      sx={{ alignSelf: 'start', minHeight: 22, height: 22, px: 0.75, fontSize: 11, ...(docs.length ? { bgcolor: 'archie.field', color: 'primary.main', borderColor: 'archie.fieldLine' } : { borderStyle: 'dashed', color: 'text.secondary' }) }}>
                      {docs.length ? `${DOCUMENT_SLOT_LABEL[st.slot]}${docs.length > 1 ? ` · ${docs.length}` : ''}` : `${DOCUMENT_SLOT_LABEL[st.slot]} mancante`}
                    </Button>
                  ) : <span />}
                </Box>
              )
            })}
          </Box>

          <DetailSection title="Importo" end={!d.is_editable ? (
            <Tooltip title="Descrizione e importo si modificano solo in stato Inserito: riporta il PO indietro per cambiarli.">
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, color: 'text.secondary' }}><LockOutlinedIcon sx={{ fontSize: 13 }} />Bloccato dopo l'invio</Box>
            </Tooltip>
          ) : null}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap', mb: 1 }}>
              <Typography component="b" sx={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(amount)}</Typography>
              <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {d.amount_mode === 'giornate' && d.days && d.daily_rate ? `${Number(d.days).toLocaleString('it-IT')} giornate × ${formatEuro(d.daily_rate)}` : 'valore fisso'}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', '& > div + div': { borderLeft: '1px solid', borderColor: 'divider' } }}>
              {[
                ['Costi sostenuti', costs != null ? formatEuro(costs) : '—', null],
                ['Margine', margin != null ? formatEuro(margin) : '—', margin == null ? null : margin >= 0 ? 'success.main' : 'error.main'],
                ['Margine %', margin != null && amount ? `${Math.round((margin / amount) * 100)}%` : '—', null],
              ].map(([l, v, c]) => (
                <Box key={l as string} sx={{ px: 1.25, py: 0.875 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{l}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: (c as string) || 'text.primary' }}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </DetailSection>

          {d.notes ? (
            <DetailSection title="Note">
              <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography>
            </DetailSection>
          ) : null}
          {cust ? (
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
              Cliente collegato: {cust}{d.is_customer_placeholder ? ' (non in anagrafica)' : ''}{d.created_by_username ? ` · creato da ${d.created_by_username}` : ''}
            </Typography>
          ) : null}
        </>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {SLOTS.map((slot) => {
            const docs = docsBy(slot)
            return (
              <DetailSection key={slot} title={<>{DOCUMENT_SLOT_LABEL[slot]} <Box component="span" sx={{ ml: 0.5, px: 0.75, borderRadius: '5px', bgcolor: 'archie.neutralBg', fontSize: 11 }}>{docs.length}</Box></>}
                end={editable ? (
                  <>
                    <input type="file" accept="application/pdf" hidden ref={(el) => { fileRefs.current[slot] = el }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onUploadDocument(slot, f); e.target.value = '' }} />
                    <Button size="small" variant="outlined" startIcon={p.uploadingSlot === slot ? <CircularProgress size={12} /> : <UploadFileOutlinedIcon />}
                      disabled={p.uploadingSlot != null} onClick={() => fileRefs.current[slot]?.click()}>Aggiungi PDF</Button>
                  </>
                ) : null}>
                {docs.length ? (
                  <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {docs.map((doc) => (
                      <Box component="li" key={doc.id} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ width: 32, height: 36, borderRadius: '6px', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 650, fontFamily: '"Geist Mono", monospace', bgcolor: 'error.light', color: 'error.main' }}>PDF</Box>
                        <Box sx={{ minWidth: 0 }}>
                          {doc.url ? (
                            <Link href={doc.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ display: 'block', fontWeight: 550, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename || 'documento.pdf'}</Link>
                          ) : <Typography sx={{ fontWeight: 550, fontSize: 13 }}>{doc.filename || 'documento.pdf'}</Typography>}
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{dIt(doc.uploaded_at)}{doc.uploaded_by_username ? ` · ${doc.uploaded_by_username}` : ''}</Typography>
                        </Box>
                        {editable ? (
                          <Tooltip title="Elimina documento">
                            <IconButton size="small" aria-label={`Elimina ${doc.filename || 'documento'}`} onClick={() => p.onDeleteDocument(doc.id)} disabled={p.deletingDocId === doc.id}>
                              {p.deletingDocId === doc.id ? <CircularProgress size={14} /> : <DeleteOutlineIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        ) : <span />}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ fontSize: 12, color: 'text.disabled', px: 1.25, py: 1, border: '1px dashed', borderColor: 'archie.borderStrong', borderRadius: '8px' }}>Nessun PDF</Box>
                )}
              </DetailSection>
            )
          })}
        </Box>
      )}
    </FloatingDetail>
  )
}
