import * as React from 'react'
import { Avatar, Box, Button, ButtonBase, CircularProgress, IconButton, Link, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { useToast } from '@shared/ui/toast'
import {
  BandChip, BandEditing, CampoIcon, RecordEmpty, RecordField, RecordGrid, RecordModal, RecordNotes, RecordSection, RecordSelect, RecordValue,
  bandButtonSx, bandSolidSx, recordMono as mono, useRecordDraft,
} from '../../ui/campo'
import { parseAmount } from '../contracts/contractModel'
import { Committente } from './PoBadges'
import {
  DOCUMENT_SLOT_LABEL, STATUS_LABEL, STATUS_ORDER, formatEuro, nextStatus, prevStatus,
  type DocumentSlot, type PurchaseOrderDetail, type PurchaseOrderKind,
} from './types'
import { fmtNumber } from '@shared/utils/number'

/*
 * Finestra del Purchase Order (DESIGN.md › Record window, anteprima design-previews/pof-base.html): testata con
 * stato, committente → cliente e l'azione principale che fa avanzare il flusso; al centro il flusso a quattro
 * passi con il PDF di ogni passo, l'importo con costi e margine, i documenti per tipo e le note; a lato
 * dettagli (con «Seguito da», che si cambia al volo), tempo e attività. I dati si leggono come testo e
 * «Modifica» nel ⋯ li rende campi; descrizione e importo solo in «Inserito» (regola del server).
 */

export type PoEvent = {
  id: number
  created_at: string
  action: string
  actor_username?: string | null
  changes?: Record<string, { from?: unknown; to?: unknown } | [unknown, unknown]> | null
}

const PO_FIELD: Record<string, string> = {
  status: 'lo stato', kind: 'il tipo', offer_date: "la data dell'offerta", purchase_order: 'il numero PO', invoice_number: 'il numero fattura',
  amount: "l'importo", days: 'le giornate', daily_rate: 'la tariffa', costs_incurred: 'i costi sostenuti', description: 'la descrizione',
  notes: 'le note', client_name: 'il committente', customer: 'il cliente collegato', amount_mode: "la modalità dell'importo", followed_by: 'chi lo segue',
}
const poVal = (k: string, v: unknown) => {
  if (v == null || v === '') return '—'
  if (k === 'status') return STATUS_LABEL[String(v) as keyof typeof STATUS_LABEL] ?? String(v)
  if (['amount', 'daily_rate', 'costs_incurred'].includes(k)) return formatEuro(String(v))
  return String(v)
}
function describePoEvent(e: PoEvent): React.ReactNode {
  if (e.action === 'create') return 'ha creato il Purchase Order'
  if (e.action === 'delete') return 'lo ha spostato nel cestino'
  if (e.action === 'restore') return 'lo ha ripristinato'
  const ch = Object.entries(e.changes ?? {}).filter(([k]) => k !== 'updated_at')
  if (!ch.length) return 'ha modificato il Purchase Order'
  return ch.map(([k, v], i) => {
    const [from, to] = Array.isArray(v) ? v : [v?.from, v?.to]
    let txt: React.ReactNode
    if (k === 'document_added') txt = <>ha caricato <b>{String(to ?? '').replace(/^\w+: /, '')}</b></>
    else if (k === 'document_removed') txt = <>ha eliminato <b>{String(from ?? '').replace(/^\w+: /, '')}</b></>
    else if (/_document$/.test(k)) txt = <>ha caricato <b>{String(to ?? '')}</b></>
    else if (k === 'description' || k === 'notes' || k === 'followed_by') txt = <>ha modificato {PO_FIELD[k]}</>
    else txt = <>ha cambiato {PO_FIELD[k] ?? k} da <b>{poVal(k, from)}</b> a <b>{poVal(k, to)}</b></>
    return <React.Fragment key={k}>{i ? '; ' : ''}{txt}</React.Fragment>
  })
}

export type PoPatch = Partial<{
  kind: PurchaseOrderKind; offer_date: string; purchase_order: string; invoice_number: string; costs_incurred: string | null
  description: string; amount: string; notes: string; followed_by: number | null
}>
export type PoUser = { id: number; label: string }

type Props = {
  detail: PurchaseOrderDetail | null
  loading: boolean
  committenteColor: string
  canChange: boolean
  canDelete: boolean
  /** Eventi di audit (null = permesso mancante). */
  events?: PoEvent[] | null
  /** Persone che possono seguire il PO. */
  users: PoUser[]
  meId?: number | null
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onCopy: (v: string) => void
  onPatch: (patch: PoPatch, label: string) => Promise<void> | void
  onAdvance: () => void
  onRevert: () => void
  onOpenCustomer?: () => void
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
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

type Draft = { description: string; kind: string; offer_date: string; purchase_order: string; invoice_number: string; amount: string; costs_incurred: string; notes: string }
const toDraft = (d: PurchaseOrderDetail): Draft => ({
  description: d.description ?? '', kind: d.kind, offer_date: d.offer_date ?? '', purchase_order: d.purchase_order ?? '', invoice_number: d.invoice_number ?? '',
  amount: d.amount ?? '', costs_incurred: d.costs_incurred ?? '', notes: d.notes ?? '',
})

export default function PurchaseOrderDetailCard(p: Props) {
  // La pagina monta la finestra solo con il PO già caricato (niente finestra di attesa).
  return p.detail ? <PoWindow {...p} detail={p.detail} /> : null
}

function PoWindow(p: Props & { detail: PurchaseOrderDetail }) {
  const d = p.detail
  const toast = useToast()
  const fileRefs = React.useRef<Partial<Record<DocumentSlot, HTMLInputElement | null>>>({})
  const [now] = React.useState(() => Date.now())
  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted
  const lockedMoney = !d.is_editable

  // ── Modifica ────────────────────────────────────────────────────
  const [editing, setEditing] = React.useState(false)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(d, () => toDraft(d))
  const v = editing ? draft : toDraft(d)
  const [busy, setBusy] = React.useState(false)
  const save = async () => {
    if (!draft.description.trim()) { toast.error('La descrizione è obbligatoria.'); return }
    const amount = draft.amount.trim() ? parseAmount(draft.amount) : null
    const costs = draft.costs_incurred.trim() ? parseAmount(draft.costs_incurred) : null
    if ((amount != null && !Number.isFinite(amount)) || (costs != null && !Number.isFinite(costs))) { toast.error('Importo o costi non validi.'); return }
    const value: Record<keyof Draft, unknown> = {
      description: draft.description.trim(), kind: draft.kind, offer_date: draft.offer_date, purchase_order: draft.purchase_order.trim(), invoice_number: draft.invoice_number.trim(),
      amount: amount != null ? amount.toFixed(2) : '0.00', costs_incurred: costs != null ? costs.toFixed(2) : null, notes: draft.notes,
    }
    setBusy(true)
    try { await p.onPatch(Object.fromEntries(changed.map((k) => [k, value[k]])) as PoPatch, 'Purchase Order aggiornato'); setEditing(false) } finally { setBusy(false) }
  }
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [whoEl, setWhoEl] = React.useState<HTMLElement | null>(null)
  const [allEvents, setAllEvents] = React.useState(false)
  React.useEffect(() => { setMenu(null); setEditing(false); setAllEvents(false) }, [d.id])

  // ── Flusso e tempi ──────────────────────────────────────────────
  const docsBy = (slot: DocumentSlot) => d.documents.filter((x) => x.kind === slot)
  const idx = STATUS_ORDER.indexOf(d.status)
  const next = nextStatus(d.status)
  const prev = prevStatus(d.status)
  const stepDate: Record<string, string | null | undefined> = { inserito: d.offer_date, inviato: d.sent_at, ricevuto: d.received_at, fatturato: d.invoiced_at }
  const since = stepDate[d.status] ? Math.max(0, Math.round((now - new Date(stepDate[d.status]!).getTime()) / DAY)) : null
  const cycle = d.status === 'fatturato' && d.invoiced_at ? Math.max(0, Math.round((new Date(d.invoiced_at).getTime() - new Date(d.offer_date).getTime()) / DAY)) : null
  const waitLabel = { inserito: 'Offerta da inviare da', inviato: 'In attesa del PO da', ricevuto: 'Fattura da emettere da', fatturato: 'Ciclo completato in' }[d.status]
  const late = since != null && SOLLECITO[d.status] != null && since > SOLLECITO[d.status]
  const amount = num(d.amount) ?? 0
  const costs = num(d.costs_incurred)
  const margin = costs != null ? amount - costs : null
  const cust = d.customer_name || d.customer_placeholder || ''
  const steps = [
    { s: 'inserito', label: 'Offerta inserita', date: d.offer_date, slot: 'offer' as DocumentSlot, code: '' },
    { s: 'inviato', label: 'Offerta inviata', date: d.sent_at, slot: null, code: '' },
    { s: 'ricevuto', label: 'PO ricevuto', date: d.received_at, slot: 'po' as DocumentSlot, code: d.purchase_order },
    { s: 'fatturato', label: 'Fatturato', date: d.invoiced_at, slot: 'invoice' as DocumentSlot, code: d.invoice_number },
  ]
  const scrollTo = (id: string) => document.getElementById(`po-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const chip = (txt: React.ReactNode, warn?: boolean, onClick?: () => void) => (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick} sx={{
      height: 20, px: 0.9, border: 0, font: 'inherit', borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 },
      '&:hover': onClick ? { bgcolor: 'rgb(255 255 255 / .22)' } : undefined,
    }}>{txt}</Box>
  )
  const follower = d.followed_by_name
    ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Avatar sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{initials(d.followed_by_name)}</Avatar>{d.followed_by_name}</Box>
    : <Box component="span" sx={{ color: d.status === 'fatturato' ? 'text.secondary' : 'warning.main', fontWeight: 550 }}>Nessuno</Box>
  const events = p.events ?? []
  const shownEvents = allEvents ? events : events.slice(0, 5)

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Purchase Order ${d.id}`} compact
      title={<><Box component="span" sx={{ ...mono, fontSize: 15, fontWeight: 500, opacity: 0.75 }}>#{d.id}</Box>{v.description.trim() || d.description}</>}
      status={<>
        <BandChip>{STATUS_LABEL[d.status]}</BandChip>
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>
        {d.client_name}{cust && cust !== d.client_name ? <> → {d.customer && p.onOpenCustomer
          ? <Box component="button" type="button" onClick={p.onOpenCustomer} sx={{ border: 0, background: 'none', p: 0, font: 'inherit', color: '#fff', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgb(255 255 255 / .4)', textUnderlineOffset: '3px' }}>{cust}</Box>
          : cust}</> : null}
        {' · '}{d.kind_label || d.kind}
        {d.purchase_order ? <> · PO <Box component="span" sx={{ ...mono, fontSize: 12 }}>{d.purchase_order}</Box></> : null}
        {d.invoice_number ? <> · fattura <Box component="span" sx={{ ...mono, fontSize: 12 }}>{d.invoice_number}</Box></> : null}
      </>}
      tags={<>
        {chip(<b>{formatEuro(amount)}</b>)}
        {margin != null && amount ? chip(<>margine <b>{Math.round((margin / amount) * 100)}%</b></>) : null}
        {chip(d.followed_by_name ? <>seguito da <b>{d.followed_by_name}</b></> : 'nessuno lo segue', !d.followed_by && d.status !== 'fatturato')}
        {late && d.status !== 'fatturato' ? chip(<>da sollecitare · <b>{since}</b> giorni</>, true) : null}
        {chip(<><b>{d.documents.length}</b> {d.documents.length === 1 ? 'documento' : 'documenti'}</>, false, () => scrollTo('doc'))}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : !editing && editable && next ? <Button variant="outlined" startIcon={<CampoIcon name="arrowR" size={15} />} onClick={p.onAdvance} sx={{ ...bandButtonSx, ...bandSolidSx }}>{NEXT_LABEL[next]}</Button> : null}
        {!deleted ? <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip> : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!editable || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          {editable && prev ? <MenuItem onClick={() => { setMenu(null); p.onRevert() }}><ListItemIcon><CampoIcon name="chevL" size={16} /></ListItemIcon>Torna a {STATUS_LABEL[prev]}</MenuItem> : null}
          <MenuItem disabled={!editable} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tutti i campi (cliente, giornate)…</MenuItem>
          {d.purchase_order ? <MenuItem onClick={() => { setMenu(null); p.onCopy(d.purchase_order!) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il numero PO</MenuItem> : null}
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={() => { reset(); setEditing(false) }}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Flusso" end={d.status === 'fatturato' ? <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.75, py: '1px', borderRadius: '5px', bgcolor: 'success.light', color: 'success.main' }}>Completato il {dIt(d.invoiced_at)}</Box> : undefined}>
            {steps.map((st, j) => {
              const done = j <= idx
              const cur = j === idx + 1
              const docs = st.slot ? docsBy(st.slot) : []
              return (
                <Box key={st.s} sx={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1.5, position: 'relative', pb: j < 3 ? 1.75 : 0,
                  '&::before': j < 3 ? { content: '""', position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, bgcolor: j < idx ? 'primary.main' : 'divider' } : undefined,
                }}>
                  <Box sx={{
                    width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', zIndex: 1, fontSize: 11, fontWeight: 700,
                    bgcolor: done ? 'primary.main' : 'background.paper', color: done ? 'primary.contrastText' : cur ? 'primary.main' : 'text.secondary',
                    boxShadow: (t) => done ? 'none' : cur ? `inset 0 0 0 2px ${t.palette.primary.main}, 0 0 0 4px ${t.palette.archie.field}` : `inset 0 0 0 2px ${t.palette.archie.borderStrong}`,
                  }}>{done ? <CheckIcon sx={{ fontSize: 14 }} /> : j + 1}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: done || cur ? 600 : 500, color: done || cur ? 'text.primary' : 'text.secondary', lineHeight: '24px' }}>{st.label}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: cur ? 'primary.main' : 'text.secondary', fontWeight: cur ? 600 : 400 }}>
                      {done ? <>{dIt(st.date)}{st.code ? <> · <Box component="span" sx={mono}>{st.code}</Box></> : null}</> : cur ? 'prossimo passo' : 'da fare'}
                    </Typography>
                  </Box>
                  {st.slot && done ? (
                    <Button size="small" variant="outlined" onClick={() => scrollTo('doc')} startIcon={<CampoIcon name={docs.length ? 'file' : 'upload'} size={13} />}
                      sx={{ alignSelf: 'start', minHeight: 24, height: 24, px: 1, fontSize: 11.5, ...(docs.length ? { bgcolor: 'archie.field', color: 'primary.main', borderColor: 'archie.fieldLine' } : { borderStyle: 'dashed', color: 'text.secondary' }) }}>
                      {docs.length ? `${DOCUMENT_SLOT_LABEL[st.slot]}${docs.length > 1 ? ` · ${docs.length}` : ''}` : `${DOCUMENT_SLOT_LABEL[st.slot]} mancante`}
                    </Button>
                  ) : <span />}
                </Box>
              )
            })}
          </RecordSection>

          <RecordSection title="Importo" end={lockedMoney ? (
            <Tooltip title="Descrizione e importo si modificano solo in stato Inserito: riporta il PO indietro dal ⋯ per cambiarli.">
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.875, py: '1px' }}><CampoIcon name="lock" size={11} />Bloccato dopo l'invio</Box>
            </Tooltip>
          ) : undefined}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap', mb: 1.25 }}>
              <Typography component="b" sx={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(amount)}</Typography>
              <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {d.amount_mode === 'giornate' && d.days && d.daily_rate ? `${fmtNumber(Number(d.days))} giornate × ${formatEuro(d.daily_rate)}` : 'valore fisso'}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', '& > div + div': { borderLeft: '1px solid', borderColor: 'divider' } }}>
              {[
                ['Costi sostenuti', costs != null ? formatEuro(costs) : '—', null],
                ['Margine', margin != null ? formatEuro(margin) : '—', margin == null ? null : margin >= 0 ? 'success.main' : 'error.main'],
                ['Margine %', margin != null && amount ? `${Math.round((margin / amount) * 100)}%` : '—', null],
              ].map(([l, x, c]) => (
                <Box key={l as string} sx={{ px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{l}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: (c as string) || 'text.primary' }}>{x}</Typography>
                </Box>
              ))}
            </Box>
          </RecordSection>

          <Box id="po-doc" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Documenti<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{d.documents.length}</Box></>}>
              <Box sx={{ display: 'grid', gap: 2 }}>
                {SLOTS.map((slot) => {
                  const docs = docsBy(slot)
                  return (
                    <Box key={slot}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography component="h4" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{DOCUMENT_SLOT_LABEL[slot]}<Box component="span" sx={{ ml: 0.75, fontWeight: 400 }}>{docs.length}</Box></Typography>
                        {editable ? (
                          <>
                            <input type="file" accept="application/pdf" hidden ref={(el) => { fileRefs.current[slot] = el }}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onUploadDocument(slot, f); e.target.value = '' }} />
                            <Button size="small" sx={{ ml: 'auto' }} startIcon={p.uploadingSlot === slot ? <CircularProgress size={12} /> : <CampoIcon name="upload" size={14} />}
                              disabled={p.uploadingSlot != null} onClick={() => fileRefs.current[slot]?.click()}>Aggiungi PDF</Button>
                          </>
                        ) : null}
                      </Box>
                      {docs.length ? (
                        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                          {docs.map((doc) => (
                            <Box component="li" key={doc.id} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 0.75, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                              <Box sx={{ width: 32, height: 32, borderRadius: '7px', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 650, ...mono, bgcolor: 'error.light', color: 'error.main' }}>PDF</Box>
                              <Box sx={{ minWidth: 0 }}>
                                {doc.url ? <Link href={doc.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ display: 'block', fontWeight: 550, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename || 'documento.pdf'}</Link>
                                  : <Typography sx={{ fontWeight: 550, fontSize: 13 }}>{doc.filename || 'documento.pdf'}</Typography>}
                                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{dIt(doc.uploaded_at)}{doc.uploaded_by_username ? ` · ${doc.uploaded_by_username}` : ''}</Typography>
                              </Box>
                              {editable ? (
                                <Tooltip title="Elimina documento">
                                  <span><IconButton size="small" aria-label={`Elimina ${doc.filename || 'documento'}`} onClick={() => p.onDeleteDocument(doc.id)} disabled={p.deletingDocId === doc.id}>
                                    {p.deletingDocId === doc.id ? <CircularProgress size={14} /> : <CampoIcon name="trash" size={15} />}
                                  </IconButton></span>
                                </Tooltip>
                              ) : <span />}
                            </Box>
                          ))}
                        </Box>
                      ) : <RecordEmpty>Nessun PDF.</RecordEmpty>}
                    </Box>
                  )
                })}
              </Box>
              <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 1.25, fontSize: 11, color: 'text.disabled' }}><CampoIcon name="file" size={12} />I PDF si possono caricare anche dopo il cambio di stato.</Typography>
            </RecordSection>
          </Box>

          <RecordSection title="Note">
            {editing ? <RecordNotes value={draft.notes} onChange={set('notes')} dirty={isDirty('notes')} placeholder="Note interne sul Purchase Order" />
              : d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <RecordEmpty>Nessuna nota.</RecordEmpty>}
          </RecordSection>
        </Box>

        {/* ── Colonna laterale ── */}
        <Box component="aside" aria-label="Purchase Order" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Dettagli">
            <RecordGrid>
              {editing ? (lockedMoney ? <RecordValue label="Descrizione · bloccata" wide>{d.description}</RecordValue>
                : <RecordField editing label="Descrizione" value={draft.description} onChange={set('description')} dirty={isDirty('description')} wide />) : null}
              {/* Seguito da: si cambia al volo, in qualunque stato. */}
              <Box sx={{ display: 'grid', gap: '3px', minWidth: 0, gridColumn: '1 / -1' }}>
                <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>Seguito da</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, minHeight: 22 }}>
                  <ButtonBase disabled={!editable} aria-haspopup="menu" aria-label="Seguito da: cambia" onClick={(e) => setWhoEl(e.currentTarget)} sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13, borderRadius: '6px', pr: 0.5, py: '1px',
                    '&:hover': { bgcolor: 'archie.surface2', boxShadow: (t) => `0 0 0 4px ${t.palette.archie.surface2}` }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                  }}>
                    {follower}{editable ? <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><CampoIcon name="chevD" size={13} /></Box> : null}
                  </ButtonBase>
                  {!d.followed_by && editable && p.meId != null ? <Button size="small" onClick={() => void p.onPatch({ followed_by: p.meId! }, 'Lo segui tu')} sx={{ minWidth: 0, px: 0.5 }}>Lo seguo io</Button> : null}
                </Box>
                <Menu anchorEl={whoEl} open={Boolean(whoEl)} onClose={() => setWhoEl(null)}>
                  <MenuItem selected={!d.followed_by} onClick={() => { setWhoEl(null); void p.onPatch({ followed_by: null }, 'Nessuno lo segue') }} sx={{ fontSize: 13, color: 'text.secondary' }}>Nessuno</MenuItem>
                  {p.users.map((u) => (
                    <MenuItem key={u.id} selected={d.followed_by === u.id} onClick={() => { setWhoEl(null); void p.onPatch({ followed_by: u.id }, `Seguito da ${u.label}`) }} sx={{ fontSize: 13 }}>{u.label}</MenuItem>
                  ))}
                </Menu>
              </Box>
              <RecordValue label="Committente"><Committente name={d.client_name} color={p.committenteColor} /></RecordValue>
              <RecordValue label="Cliente">{cust || null}</RecordValue>
              {editing ? <RecordSelect label="Tipo" value={draft.kind} onChange={set('kind')} dirty={isDirty('kind')} options={[{ value: 'ordinario', label: 'Ordinario' }, { value: 'extra', label: 'Extra' }]} />
                : <RecordValue label="Tipo">{d.kind_label || d.kind}</RecordValue>}
              <RecordField editing={editing} type="date" label="Data offerta" value={v.offer_date} onChange={set('offer_date')} dirty={isDirty('offer_date')} show={dIt} />
              <RecordField editing={editing} label="Numero PO" value={v.purchase_order} onChange={set('purchase_order')} dirty={isDirty('purchase_order')} mono />
              <RecordField editing={editing} label="Numero fattura" value={v.invoice_number} onChange={set('invoice_number')} dirty={isDirty('invoice_number')} mono />
              {editing && !lockedMoney && d.amount_mode === 'fisso'
                ? <RecordField editing label="Importo" value={draft.amount} onChange={set('amount')} dirty={isDirty('amount')} mono placeholder="0,00" />
                : <RecordValue label={editing ? 'Importo · bloccato' : 'Importo'} mono>{formatEuro(amount)}</RecordValue>}
              <RecordField editing={editing} label="Costi sostenuti" value={v.costs_incurred} onChange={set('costs_incurred')} dirty={isDirty('costs_incurred')} mono placeholder="0,00" show={(x) => formatEuro(x)} />
            </RecordGrid>
            {editing && (lockedMoney || d.amount_mode === 'giornate') ? (
              <Typography sx={{ mt: 1.25, fontSize: 11.5, color: 'text.secondary' }}>
                {lockedMoney ? 'Descrizione e importo si modificano solo in «Inserito»: riporta il PO indietro dal ⋯.' : 'Giornate e tariffa si cambiano da «Tutti i campi…»: l\'importo è calcolato.'}
              </Typography>
            ) : null}
          </RecordSection>

          <RecordSection title="Tempo">
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
              <Box>
                <Typography component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>{waitLabel}</Typography>
                <Typography component="b" sx={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                  {(() => { const n = d.status === 'fatturato' ? cycle : since; return n == null ? '—' : `${n} ${n === 1 ? 'giorno' : 'giorni'}` })()}
                </Typography>
              </Box>
              <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.75, py: '1px', borderRadius: '5px', ...(d.status === 'fatturato' ? { bgcolor: 'success.light', color: 'success.main' } : late ? { bgcolor: 'warning.light', color: 'warning.main' } : { bgcolor: 'archie.neutralBg', color: 'text.secondary' }) }}>
                {d.status === 'fatturato' ? 'Completato' : late ? 'Da sollecitare' : 'Nei tempi'}
              </Box>
            </Box>
          </RecordSection>

          {p.events ? (
            <RecordSection title="Attività recente">
              {events.length === 0 ? <RecordEmpty>Nessuna attività registrata.</RecordEmpty> : (
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  {shownEvents.map((e) => (
                    <Box key={e.id} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr', columnGap: 1, fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
                      <Box sx={{ color: 'text.disabled', pt: '2px' }}><CampoIcon name={e.action === 'create' ? 'plus' : 'history'} size={13} /></Box>
                      <span><b>{e.actor_username || 'Sistema'}</b> {describePoEvent(e)}</span>
                      <span />
                      <Box component="time" sx={{ fontSize: 11 }}>{new Date(e.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Box>
                    </Box>
                  ))}
                  {events.length > 5 ? <Button size="small" sx={{ justifySelf: 'start', px: 0.5, minWidth: 0 }} onClick={() => setAllEvents((x) => !x)}>{allEvents ? 'Mostra meno' : `Mostra tutte (${events.length})`}</Button> : null}
                </Box>
              )}
            </RecordSection>
          ) : null}
        </Box>
      </Box>
    </RecordModal>
  )
}
