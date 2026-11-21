import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { alpha } from '@mui/material/styles'
import { useToast } from '@shared/ui/toast'
import {
  BandChip, BandEditing, CampoIcon, RecordEmpty, RecordField, RecordGrid, RecordLink, RecordModal, RecordNotes, RecordRow, RecordRows,
  RecordSection, RecordSelect, RecordValue, bandButtonSx, bandSolidSx, recordMono as mono, useRecordDraft,
} from '../../ui/campo'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { FileIcon } from '../drive/DriveIcons'
import { formatEuro } from '../purchaseorders/types'
import { daysLabel, dShort, expiryHint, EXPIRY_TONE, parseAmount } from './contractModel'
import { amountSummary, eurFull, todayIso } from './contractAmount'
import ContractReminders from './ContractReminders'
import { REMINDER_PRESETS, addDays, isIsoDate } from './contractForm'
import { ExpiryBadge, PeriodBar } from './contractUi'
import {
  BILLING_FREQ_OPTIONS, CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS,
  type CompanyOption, type ContractDetail, type Seller,
} from './types'

/*
 * Finestra del contratto (DESIGN.md › Record window, anteprima design-previews/ctr-base.html): testata con
 * codice, titolo, stato di scadenza, cliente e «Rinnova…»; al centro il periodo con l'avviso di rinnovo e
 * oggi, i promemoria di rinnovo (anteprima ctr2-base), l'importo (al mese, all'anno, per fattura), i device e le note; a lato dettagli, PDF e attività.
 * I dati si leggono come testo e «Modifica» nel ⋯ li trasforma in campi, con un solo salvataggio.
 * Importo, valore e PDF solo con il permesso sui valori (il PDF riporta il prezzo).
 */

export type ContractPatch = Partial<Pick<ContractDetail,
  'status' | 'contract_type' | 'seller' | 'company' | 'billing_freq' | 'start_date' | 'end_date' | 'reminder_days' | 'total_value' | 'code' | 'title' | 'notes'>>

type Props = {
  detail: ContractDetail | null
  loading: boolean
  sellers: Seller[]
  companies: CompanyOption[]
  canChange: boolean
  canDelete: boolean
  canViewValue: boolean
  documentBusy: boolean
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  /** Modulo completo (device e cliente). */
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onRenew: () => void
  onPatch: (patch: ContractPatch, label: string) => Promise<void> | void
  onCopy: (v: string) => void
  onOpenCustomer: () => void
  onUploadDocument: (file: File) => void
  onDeleteDocument: () => void
}

const FIELDS: Record<string, string> = {
  code: 'il codice', title: 'il titolo', customer: 'il cliente', contract_type: 'il tipo', seller: 'il venditore', company: 'la società',
  start_date: "l'inizio", end_date: 'la fine', reminder_days: "l'avviso di rinnovo", billing_freq: 'la fatturazione',
  status: 'lo stato', devices: 'i device', notes: 'le note', document: 'il documento', total_value: 'il valore',
}

/** Mesi interi (arrotondati) tra due date ISO. */
const dIt = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '')

type Draft = {
  code: string; title: string; contract_type: string; status: string; seller: string; company: string; billing_freq: string
  start_date: string; end_date: string; reminder_days: string; total_value: string; notes: string
}
const toDraft = (d: ContractDetail): Draft => ({
  code: d.code ?? '', title: d.title ?? '', contract_type: d.contract_type, status: d.status, seller: d.seller ? String(d.seller) : '', company: d.company ? String(d.company) : '',
  billing_freq: d.billing_freq, start_date: d.start_date ?? '', end_date: d.end_date ?? '', reminder_days: String(d.reminder_days ?? ''),
  total_value: d.total_value ?? '', notes: d.notes ?? '',
})

export default function ContractDetailCard(p: Props) {
  // La pagina monta la finestra solo con il contratto già caricato (niente finestra di attesa).
  return p.detail ? <ContractWindow {...p} detail={p.detail} /> : null
}

function ContractWindow(p: Props & { detail: ContractDetail }) {
  const d = p.detail
  const toast = useToast()
  const fileRef = React.useRef<HTMLInputElement | null>(null)
  const deleted = Boolean(d.deleted_at)
  const editable = p.canChange && !deleted

  // ── Modifica ────────────────────────────────────────────────────
  const [editing, setEditing] = React.useState(false)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(d, () => toDraft(d))
  const v = editing ? draft : toDraft(d)
  const [busy, setBusy] = React.useState(false)
  const save = async () => {
    if (!draft.code.trim() || !draft.title.trim()) { toast.error('Codice e titolo sono obbligatori.'); return }
    const lead = Number(draft.reminder_days)
    if (!Number.isInteger(lead) || lead < 1 || lead > 365) { toast.error("L'avviso va da 1 a 365 giorni prima della fine."); return }
    const total = draft.total_value.trim() ? parseAmount(draft.total_value) : null
    if (total != null && (!Number.isFinite(total) || total < 0)) { toast.error('Il valore non è un importo valido.'); return }
    const value: Record<keyof Draft, unknown> = {
      code: draft.code.trim(), title: draft.title.trim(), contract_type: draft.contract_type, status: draft.status, seller: draft.seller ? Number(draft.seller) : null,
      company: draft.company ? Number(draft.company) : null, billing_freq: draft.billing_freq, start_date: draft.start_date, end_date: draft.end_date,
      reminder_days: lead, total_value: total != null ? total.toFixed(2) : null, notes: draft.notes,
    }
    setBusy(true)
    try { await p.onPatch(Object.fromEntries(changed.map((k) => [k, value[k]])) as ContractPatch, 'Contratto aggiornato'); setEditing(false) } finally { setBusy(false) }
  }
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => { setMenu(null); setEditing(false) }, [d.id])

  // ── Testata ─────────────────────────────────────────────────────
  const value = d.total_value !== undefined && d.total_value !== null ? Number(d.total_value) : null
  const active = d.status === 'attivo'
  const exp = d.expiry_state
  const nextReminder = d.reminders?.dates.find((x) => x.state === 'next')?.date ?? null
  const warnExp = exp === 'expired'
  const needsAction = exp === 'expired' || exp === 'renew'
  const scrollTo = (id: string) => document.getElementById(`ctr-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const chip = (txt: React.ReactNode, warn?: boolean, onClick?: () => void) => (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick} sx={{
      height: 20, px: 0.9, border: 0, font: 'inherit', borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 },
      '&:hover': onClick ? { bgcolor: 'rgb(255 255 255 / .22)' } : undefined,
    }}>{txt}</Box>
  )
  const sellerOptions = [{ value: '', label: 'Nessuno' }, ...p.sellers.filter((s) => s.is_active || s.id === d.seller).map((s) => ({ value: String(s.id), label: s.name }))]

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Contratto ${d.code}`} compact
      title={<><Box component="span" sx={{ ...mono, fontSize: 14, fontWeight: 500, opacity: 0.75 }}>{v.code || d.code}</Box>{v.title.trim() || d.title}</>}
      status={<>
        {active ? (exp !== 'none' ? (
          <Box component="span" sx={{ fontSize: 11.5, fontWeight: 650, px: 1, py: '2px', borderRadius: '5px', ...(exp === 'ok' ? { bgcolor: 'rgb(255 255 255 / .16)' } : exp === 'expired' ? { bgcolor: '#f2b8b0', color: '#5a1410' } : { bgcolor: '#e0a43a', color: '#2b1d00' }) }}>{EXPIRY_TONE[exp].label}</Box>
        ) : null) : <BandChip>{d.status_label}</BandChip>}
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>
        <Box component="button" type="button" onClick={p.onOpenCustomer} sx={{ border: 0, background: 'none', p: 0, font: 'inherit', color: '#fff', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgb(255 255 255 / .4)', textUnderlineOffset: '3px', '&:hover': { textDecorationColor: '#fff' } }}>{d.customer_name}</Box>
        {' · '}{d.contract_type_label}{d.company_label ? ` · ${d.company_label}` : ''}{d.seller_name ? ` · venditore ${d.seller_name}` : ''}
      </>}
      tags={<>
        {active ? <>
          {chip(exp === 'expired' ? <>scaduto il <b>{dIt(d.end_date)}</b></> : <>finisce il <b>{dIt(d.end_date)}</b></>, warnExp)}
          {d.reminder_date && exp !== 'expired' ? chip(<>avviso di rinnovo {exp === 'renew' ? 'dal' : 'il'} <b>{dIt(d.reminder_date)}</b></>, exp === 'renew') : null}
          {nextReminder ? chip(<>prossimo promemoria <b>{dIt(nextReminder)}</b></>, false, () => scrollTo('rem')) : null}
        </> : chip(<>finito il <b>{dIt(d.end_date)}</b></>)}
        {p.canViewValue && value != null ? chip(<b>{formatEuro(value)}</b>) : null}
        {chip(<><b>{d.devices_detail.length}</b> device</>, false, () => scrollTo('dev'))}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : !editing && active && p.canChange ? <Button variant="outlined" startIcon={<AutorenewIcon sx={{ fontSize: 17 }} />} onClick={p.onRenew} sx={{ ...bandButtonSx, ...bandSolidSx }}>Rinnova…</Button> : null}
        {!deleted ? <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip> : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!editable || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          <MenuItem disabled={!editable} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tutti i campi (cliente, device)…</MenuItem>
          {active && editable ? <MenuItem onClick={() => { setMenu(null); void p.onPatch({ status: 'chiuso' }, 'Contratto segnato come chiuso') }}><ListItemIcon><CampoIcon name="x" size={16} /></ListItemIcon>Segna come chiuso</MenuItem> : null}
          <MenuItem onClick={() => { setMenu(null); p.onCopy(d.code) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il codice</MenuItem>
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={() => { reset(); setEditing(false) }}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Periodo" end={<ExpiryBadge state={d.expiry_state} end={d.end_date} reminder={d.reminder_date} />}>
            <PeriodBar start={d.start_date} end={d.end_date} reminder={d.reminder_date} state={d.expiry_state} />
            <Box sx={{ mt: 1.5, p: '9px 12px', borderRadius: '8px', bgcolor: needsAction && active ? (exp === 'expired' ? 'error.light' : 'warning.light') : 'archie.neutralBg' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: needsAction && active ? (exp === 'expired' ? 'error.main' : 'warning.main') : 'text.primary' }}>
                {!active ? `Contratto ${d.status_label.toLowerCase()}` : exp === 'expired' ? `Scaduto il ${dShort(d.end_date)}` : `Finisce ${daysLabel(d.end_date)}`}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {active ? expiryHint(d.expiry_state, d.end_date, d.reminder_date, nextReminder) : 'Non manda più promemoria.'}
              </Typography>
            </Box>
          </RecordSection>

          {d.reminders ? (
            <Box id="ctr-rem" sx={{ scrollMarginTop: 16 }}>
              <RecordSection title="Promemoria di rinnovo">
                <ContractReminders reminders={d.reminders} sellerName={d.seller_name ?? ''} active={active} endDate={d.end_date} />
              </RecordSection>
            </Box>
          ) : null}

          {p.canViewValue ? (
            <RecordSection title="Importo">
              {value != null ? (() => {
                const am = amountSummary(value, d.billing_freq, d.start_date, d.end_date, todayIso())
                const pct = Math.round(am.elapsed * 100)
                const tile = (label: string, amount: number, sub?: React.ReactNode) => (
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: '10px 12px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'baseline', columnGap: 1.25 }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{eurFull(amount)}</Typography>
                    {sub ? <Typography sx={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'text.secondary', mt: 0.25 }}>{sub}</Typography> : null}
                  </Box>
                )
                return (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,1.25fr) minmax(0,1fr)' }, gap: 1.5 }}>
                    <Box sx={{ bgcolor: 'archie.field', borderRadius: '10px', p: '16px 18px', display: 'grid', gap: 1.25, alignContent: 'start' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '.06em' }}>Valore totale</Typography>
                      <Typography sx={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{eurFull(value)}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{am.months} {am.months === 1 ? 'mese' : 'mesi'} · fatturazione {d.billing_freq_label.toLowerCase()}</Typography>
                      <Box>
                        <Box role="img" aria-label={`Maturato ${pct}%`} sx={{ height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: (t) => alpha(t.palette.primary.main, 0.16) }}>
                          <Box sx={{ height: '100%', width: `${am.elapsed * 100}%`, bgcolor: 'primary.main', borderRadius: 4 }} />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, fontSize: 12, color: 'text.secondary' }}>
                          <span>maturato <Box component="b" sx={{ color: 'text.primary' }}>{pct}%</Box></span><span>{dShort(d.end_date)}</span>
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'grid', gap: 1, alignContent: 'start' }}>
                      {tile('Al mese', am.perMonth)}
                      {tile("All'anno", am.perYear)}
                      {tile('Per fattura', am.perBill, <>{am.bills} {am.bills === 1 ? 'fattura' : 'fatture'}{am.nextBill && d.status === 'attivo' ? <> · prossima il {dShort(am.nextBill)}</> : null}</>)}
                    </Box>
                  </Box>
                )
              })() : <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Valore non indicato: si aggiunge da Modifica.</Typography>}
            </RecordSection>
          ) : null}

          <Box id="ctr-dev" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Device<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{d.devices_detail.length}</Box></>}
              end={editable ? <Button size="small" onClick={p.onEdit}>Gestisci</Button> : undefined}>
              {d.devices_detail.length ? (
                <RecordRows>
                  {d.devices_detail.map((x) => (
                    <RecordRow key={x.id} lead={<CampoIcon name="monitor" size={18} />} title={x.label} sub={x.serial_number ? <>S/N <Box component="span" sx={mono}>{x.serial_number}</Box></> : undefined} />
                  ))}
                </RecordRows>
              ) : <RecordEmpty>Nessun device collegato.</RecordEmpty>}
            </RecordSection>
          </Box>

          <RecordSection title="Note">
            {editing ? <RecordNotes value={draft.notes} onChange={set('notes')} dirty={isDirty('notes')} placeholder="Note interne sul contratto" />
              : d.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.notes}</Typography> : <RecordEmpty>Nessuna nota.</RecordEmpty>}
          </RecordSection>
        </Box>

        {/* ── Colonna laterale ── */}
        <Box component="aside" aria-label="Contratto" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Dettagli">
            <RecordGrid>
              {editing ? <>
                <RecordField editing label="Codice" value={draft.code} onChange={set('code')} dirty={isDirty('code')} mono />
                <RecordField editing label="Titolo" value={draft.title} onChange={set('title')} dirty={isDirty('title')} wide />
              </> : null}
              <RecordValue label="Cliente" wide><RecordLink onClick={p.onOpenCustomer}>{d.customer_name}</RecordLink></RecordValue>
              {editing ? <>
                <RecordSelect label="Tipo" value={draft.contract_type} onChange={set('contract_type')} dirty={isDirty('contract_type')} options={CONTRACT_TYPE_OPTIONS} />
                <RecordSelect label="Stato" value={draft.status} onChange={set('status')} dirty={isDirty('status')} options={CONTRACT_STATUS_OPTIONS} />
                <RecordSelect label="Venditore" value={draft.seller} onChange={set('seller')} dirty={isDirty('seller')} options={sellerOptions} />
                <RecordSelect label="Società" value={draft.company} onChange={set('company')} dirty={isDirty('company')} options={[{ value: '', label: '—' }, ...p.companies.map((c) => ({ value: String(c.id), label: c.label }))]} />
              </> : <>
                <RecordValue label="Tipo">{d.contract_type_label}</RecordValue>
                <RecordValue label="Stato">{d.status_label}</RecordValue>
                <RecordValue label="Venditore">{d.seller_name || null}</RecordValue>
                <RecordValue label="Società">{d.company_label || null}</RecordValue>
              </>}
              <RecordField editing={editing} type="date" label="Inizio" value={v.start_date} onChange={set('start_date')} dirty={isDirty('start_date')} show={dIt} />
              <RecordField editing={editing} type="date" label="Fine" value={v.end_date} onChange={set('end_date')} dirty={isDirty('end_date')} show={dIt} />
              {editing ? <ReminderLeadField value={draft.reminder_days} end={draft.end_date} dirty={isDirty('reminder_days')} onChange={set('reminder_days')} />
                : <RecordValue label="Avviso di rinnovo">{d.reminder_days ? `${d.reminder_days} giorni prima` : null}</RecordValue>}
              {editing ? <RecordSelect label="Fatturazione" value={draft.billing_freq} onChange={set('billing_freq')} dirty={isDirty('billing_freq')} options={BILLING_FREQ_OPTIONS} />
                : <RecordValue label="Fatturazione">{d.billing_freq_label}</RecordValue>}
              {p.canViewValue ? <RecordField editing={editing} label="Valore totale" value={v.total_value} onChange={set('total_value')} dirty={isDirty('total_value')} mono placeholder="0,00"
                show={(x) => (Number.isFinite(Number(x)) ? formatEuro(Number(x)) : x)} /> : null}
              {editing ? null : <RecordValue label="Codice" mono>{d.code}</RecordValue>}
            </RecordGrid>
          </RecordSection>

          {/* Il PDF riporta di norma il prezzo: visibile solo con il permesso sui valori. */}
          {p.canViewValue ? (
            <RecordSection title="Documento">
              {d.document_url ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', alignItems: 'center', gap: 1.25 }}>
                  <FileIcon kind="pdf" size={30} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{d.document_filename || 'contratto.pdf'}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>PDF del contratto</Typography>
                  </Box>
                  <Box sx={{ display: 'inline-flex' }}>
                    <Tooltip title="Apri il PDF"><IconButton size="small" aria-label="Apri documento" onClick={() => d.document_url && window.open(d.document_url, '_blank', 'noopener')}><CampoIcon name="eye" size={16} /></IconButton></Tooltip>
                    {editable ? <Tooltip title="Sostituisci"><IconButton size="small" aria-label="Sostituisci documento" disabled={p.documentBusy} onClick={() => fileRef.current?.click()}><CampoIcon name="upload" size={16} /></IconButton></Tooltip> : null}
                    {editable ? <Tooltip title="Rimuovi"><IconButton size="small" aria-label="Rimuovi documento" disabled={p.documentBusy} onClick={p.onDeleteDocument}>{p.documentBusy ? <CircularProgress size={14} /> : <CampoIcon name="trash" size={16} />}</IconButton></Tooltip> : null}
                  </Box>
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
              ) : <RecordEmpty>Nessun documento caricato.</RecordEmpty>}
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onUploadDocument(f) }} />
            </RecordSection>
          ) : null}

          <RecordSection title="Attività recente">
            <AuditFeedPanel appLabel="contracts" model="contract" objectId={d.id} fields={FIELDS} noun="il contratto" limit={5} reloadKey={d} />
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}

/** «Avviso di rinnovo» in modifica: pastiglie 30/60/90/180 o un numero, con la data che ne risulta. */
function ReminderLeadField({ value, end, dirty, onChange }: { value: string; end: string; dirty: boolean; onChange: (v: string) => void }) {
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1 && n <= 365
  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'grid', gap: 0.75 }}>
      <Typography id="lbl-reminder-days" sx={{ fontSize: 12, color: 'text.secondary' }}>Avviso di rinnovo</Typography>
      <Box role="group" aria-labelledby="lbl-reminder-days" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
        {REMINDER_PRESETS.map((p) => {
          const on = n === p
          return (
            <ButtonBase key={p} aria-pressed={on} onClick={() => onChange(String(p))} sx={{
              height: 28, px: 1.25, borderRadius: 999, fontSize: 12.5, border: '1px solid', borderColor: on ? 'archie.fieldLine' : 'archie.borderStrong',
              bgcolor: on ? 'archie.field' : 'background.paper', fontWeight: on ? 600 : 400, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
            }}>{p} giorni</ButtonBase>
          )
        })}
        <TextField size="small" type="number" value={value} onChange={(e) => onChange(e.target.value)} error={!valid}
          sx={{ width: 84, ...(dirty ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.light' } } : null) }}
          slotProps={{ htmlInput: { min: 1, max: 365, 'aria-label': 'Giorni prima della fine' } }} />
      </Box>
      <Typography sx={{ fontSize: 11.5, color: valid ? 'text.secondary' : 'error.main' }}>
        {valid ? (isIsoDate(end) ? `prima della fine · avviso il ${dShort(addDays(end, -n))}` : 'prima della fine') : 'Da 1 a 365 giorni.'}
      </Typography>
    </Box>
  )
}
