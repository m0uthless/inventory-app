import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, Tooltip } from '@mui/material'
import { CampoIcon } from '../../ui/campo'
import { formatEuro, todayISO, type ExpenseItemRow, type ExpenseReceiptRow, type ExpenseReportRow } from './expensesShared'
import { CATEGORY_META, amountInput, dShort, kmItemOf, kmTotal, parseEuroInput, rateLabel, sortedItems, toNum } from './nsModel'
import { CategoryIcon, MissingTag, ReceiptChip } from './nsUi'
import { fmtNumber } from '@shared/utils/number'

export type ItemPatch = Partial<Pick<ExpenseItemRow, 'description' | 'amount' | 'date'>>
export type Suggestion = { itemId: number; amount: string | null; date: string | null }

type Props = {
  report: ExpenseReportRow
  editable: boolean
  busy: boolean
  extractingId: number | null
  suggestion: Suggestion | null
  onPatch: (item: ExpenseItemRow, patch: ItemPatch) => Promise<boolean>
  onUpload: (item: ExpenseItemRow, file: File) => void
  onRemoveReceipt: (id: number) => void
  onOpenReceipt: (r: ExpenseReceiptRow, item: ExpenseItemRow) => void
  onApplySuggestion: (item: ExpenseItemRow) => void
  onDismissSuggestion: () => void
  onAddTrip: (t: { date: string; destination: string; km: number }) => Promise<boolean>
  onRemoveTrip: (id: number) => void
}

const cellInputSx = {
  width: '100%', height: 30, px: '7px', borderRadius: '5px', border: '1px solid transparent', fontSize: 13,
  '&:hover': { borderColor: 'divider', bgcolor: 'background.paper' },
  '&.Mui-focused': { borderColor: 'primary.main', bgcolor: 'background.paper', boxShadow: (t: { palette: { archie: { focusRing: string } } }) => t.palette.archie.focusRing },
  '& input::placeholder': { color: 'archie.textFaint', opacity: 1 },
} as const

/** Campo testo che salva all'uscita, solo se cambiato. */
function CommitInput({ value, onCommit, label, type, placeholder, amount }: { value: string; onCommit: (v: string) => Promise<boolean> | void; label: string; type?: string; placeholder?: string; amount?: boolean }) {
  const [draft, setDraft] = React.useState(value)
  const [bad, setBad] = React.useState(false)
  React.useEffect(() => { setDraft(value); setBad(false) }, [value])
  const commit = async () => {
    if (draft === value) return
    if (amount && parseEuroInput(draft) == null) { setBad(true); return }
    setBad(false)
    const ok = await onCommit(draft)
    if (ok === false) setDraft(value)
  }
  return (
    <InputBase value={draft} type={type} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(value); setBad(false) } }}
      inputProps={{ 'aria-label': label, 'aria-invalid': bad || undefined, ...(amount ? { inputMode: 'decimal' } : {}) }}
      sx={[cellInputSx, amount ? { '& input': { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 550 } } : {}, bad ? { borderColor: 'error.main' } : {}]} className={amount ? 'amt' : undefined} />
  )
}

function UploadButton({ item, onUpload, busy, extracting }: { item: ExpenseItemRow; onUpload: Props['onUpload']; busy: boolean; extracting: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <Tooltip title="Carica uno scontrino">
        <span>
          <IconButton size="small" aria-label={`Carica uno scontrino per ${CATEGORY_META[item.category].label}`} disabled={busy || extracting} onClick={() => ref.current?.click()} sx={{ width: 26, height: 26 }}>
            {extracting ? <CircularProgress size={13} /> : <CampoIcon name="upload" size={14} />}
          </IconButton>
        </span>
      </Tooltip>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(item, f) }} />
    </>
  )
}

function Trips({ report, editable, busy, onAddTrip, onRemoveTrip }: Pick<Props, 'report' | 'editable' | 'busy' | 'onAddTrip' | 'onRemoveTrip'>) {
  const km = kmItemOf(report)
  const trips = km?.km_trips ?? []
  const [date, setDate] = React.useState(todayISO())
  const [dest, setDest] = React.useState('')
  const [kmv, setKmv] = React.useState('')
  const destRef = React.useRef<HTMLInputElement>(null)
  const known = new Map<string, number>()
  trips.forEach((t) => known.set(t.destination, t.km))
  const add = async () => {
    const n = parseInt(kmv, 10)
    if (!dest.trim()) { destRef.current?.focus(); return }
    if (!n || n < 0) return
    if (await onAddTrip({ date, destination: dest.trim(), km: n })) { setDest(''); setKmv(''); destRef.current?.focus() }
  }
  const rate = rateLabel(report.km_rate)
  return (
    <Box className="trips">
      <table>
        <thead><tr><th className="d">Data</th><th>Destinazione</th><th className="n">Km</th>{editable ? <th className="x" aria-label="Azioni" /> : null}</tr></thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id}>
              <td className="d">{dShort(t.date)}</td><td>{t.destination}</td><td className="n">{t.km}</td>
              {editable ? <td className="x"><IconButton size="small" aria-label={`Rimuovi la trasferta a ${t.destination}`} disabled={busy} onClick={() => onRemoveTrip(t.id)} sx={{ width: 26, height: 26 }}><CampoIcon name="trash" size={14} /></IconButton></td> : null}
            </tr>
          ))}
          {!trips.length && !editable ? <tr><td colSpan={3} style={{ color: 'inherit', opacity: 0.6 }}>Nessuna trasferta.</td></tr> : null}
          {editable ? (
            <tr className="add">
              <td className="d"><InputBase type="date" value={date} onChange={(e) => setDate(e.target.value)} inputProps={{ 'aria-label': 'Data della trasferta' }} /></td>
              <td><InputBase inputRef={destRef} value={dest} placeholder="Dove sei andato" inputProps={{ 'aria-label': 'Destinazione', list: `ns-dest-${report.id}` }}
                onChange={(e) => { setDest(e.target.value); const k = known.get(e.target.value); if (k && !kmv) setKmv(String(k)) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }} /></td>
              <td className="n"><InputBase value={kmv} placeholder="km" inputProps={{ 'aria-label': 'Km percorsi', inputMode: 'numeric' }}
                onChange={(e) => setKmv(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }} /></td>
              <td className="x"><Tooltip title="Aggiungi la trasferta"><span><IconButton size="small" aria-label="Aggiungi la trasferta" disabled={busy || !dest.trim() || !kmv} onClick={() => void add()} sx={{ width: 26, height: 26 }}><CampoIcon name="plus" size={15} /></IconButton></span></Tooltip></td>
            </tr>
          ) : null}
        </tbody>
        <tfoot><tr><td colSpan={2}>{fmtNumber(kmTotal(report))} km × {rate ?? 'tariffa non impostata'}</td><td className="n"><b>{formatEuro(km?.amount ?? 0)}</b></td>{editable ? <td /> : null}</tr></tfoot>
      </table>
      <datalist id={`ns-dest-${report.id}`}>{[...known.keys()].map((d) => <option key={d} value={d} />)}</datalist>
    </Box>
  )
}

/** Variante A · Foglio: le 12 categorie come righe del modello Excel, trasferte sotto il rimborso km. */
export default function ExpenseSheet(p: Props) {
  const { report, editable } = p
  const [kmOpen, setKmOpen] = React.useState(true)
  const items = sortedItems(report)
  return (
    <Box sx={sheetSx}>
      <table className="sheet">
        <thead><tr><th className="c">Categoria</th><th>Descrizione</th><th className="dt">Data</th><th className="rc">Scontrini</th><th className="n">Importo</th></tr></thead>
        <tbody>
          {items.map((it) => {
            const meta = CATEGORY_META[it.category]
            const km = it.is_km_category
            const v = toNum(it.amount)
            const miss = !km && v > 0 && !it.receipts.length
            const sug = p.suggestion?.itemId === it.id ? p.suggestion : null
            return (
              <React.Fragment key={it.id}>
                <tr className={`${v || (km && it.km_trips.length) ? 'has' : 'zero'}${km ? ' km' : ''}`}>
                  <th scope="row" className="c"><span className="cat"><CategoryIcon category={it.category} /><span>{meta.label}{meta.hint && !km ? <small>{meta.hint}</small> : null}</span></span></th>
                  <td className="ds">
                    {km ? (
                      <ButtonBase className="kmtog" aria-expanded={kmOpen} onClick={() => setKmOpen((o) => !o)}>
                        {it.km_trips.length} {it.km_trips.length === 1 ? 'trasferta' : 'trasferte'} · {fmtNumber(kmTotal(report))} km<CampoIcon name={kmOpen ? 'chevD' : 'chevR'} size={14} />
                      </ButtonBase>
                    ) : editable ? <CommitInput value={it.description} label={`Descrizione ${meta.label}`} placeholder={v ? 'Descrizione' : ''} onCommit={(d) => p.onPatch(it, { description: d })} />
                      : <span className={it.description ? '' : 'none'}>{it.description || '—'}</span>}
                  </td>
                  <td className="dt">
                    {km ? null : editable && v ? <CommitInput type="date" value={it.date ?? ''} label={`Data ${meta.label}`} onCommit={(d) => p.onPatch(it, { date: d || null })} />
                      : it.date && v ? dShort(it.date) : null}
                  </td>
                  <td className="rc">
                    {km ? <span className="none">non serve</span> : (
                      <span className="rchips">
                        {it.receipts.map((r) => <ReceiptChip key={r.id} receipt={r} onOpen={() => p.onOpenReceipt(r, it)} onRemove={editable ? () => p.onRemoveReceipt(r.id) : undefined} disabled={p.busy} />)}
                        {miss ? <MissingTag /> : null}
                        {editable ? <UploadButton item={it} onUpload={p.onUpload} busy={p.busy} extracting={p.extractingId === it.id} /> : null}
                      </span>
                    )}
                  </td>
                  <td className="n">
                    {km ? <b className="calc" title="Calcolato dalle trasferte">{v ? formatEuro(v) : ''}</b>
                      : editable ? <CommitInput amount value={amountInput(it.amount)} label={`Importo ${meta.label}`} onCommit={(a) => p.onPatch(it, { amount: String(parseEuroInput(a) ?? 0) })} />
                        : v ? formatEuro(v) : ''}
                  </td>
                </tr>
                {km && kmOpen ? <tr className="sub"><td colSpan={5}><Trips report={report} editable={editable} busy={p.busy} onAddTrip={p.onAddTrip} onRemoveTrip={p.onRemoveTrip} /></td></tr> : null}
                {sug ? (
                  <tr className="sub"><td colSpan={5}>
                    <Box className="ocr" role="status">
                      <CampoIcon name="eye" size={14} />
                      <span>Dallo scontrino:{sug.amount ? <> <b>{formatEuro(sug.amount)}</b></> : null}{sug.date ? <> del <b>{dShort(sug.date)}</b></> : null}</span>
                      <Button size="small" variant="outlined" color="inherit" onClick={() => p.onApplySuggestion(it)}>Usa questi valori</Button>
                      <Button size="small" color="inherit" onClick={p.onDismissSuggestion}>Ignora</Button>
                    </Box>
                  </td></tr>
                ) : null}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot><tr><th colSpan={4}>Totale spese</th><td className="n"><b>{formatEuro(report.total_expenses)}</b></td></tr></tfoot>
      </table>
    </Box>
  )
}

const sheetSx = {
  bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden',
  '& table.sheet': { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed' },
  '& .sheet > thead > tr > th': { bgcolor: 'archie.surface2', textAlign: 'left', fontSize: 12, fontWeight: 550, color: 'text.secondary', height: 34, px: '10px', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' },
  '& .sheet > thead > tr > th.c': { pl: '14px', width: '25%' },
  '& .sheet > thead > tr > th.dt': { width: 136 },
  '& .sheet > thead > tr > th.rc': { width: '22%' },
  '& .sheet > * > tr > .n': { textAlign: 'right', width: 124, pr: '14px' },
  '& .sheet > tbody > tr > th, & .sheet > tbody > tr > td': { p: '5px 10px', borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'middle', height: 44, textAlign: 'left', fontWeight: 400, overflow: 'hidden' },
  '& .sheet > tbody > tr > th.c': { pl: '14px' },
  '& .sheet > tbody > tr > td.n': { textAlign: 'right', pr: '14px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  '& .cat': { display: 'flex', alignItems: 'center', gap: '9px', color: 'text.secondary' },
  '& .cat > span': { fontWeight: 550, lineHeight: 1.25, minWidth: 0, color: 'text.primary' },
  '& .cat small': { display: 'block', fontSize: 11, fontWeight: 400, color: 'text.secondary' },
  '& tr.zero .cat > span': { color: 'text.secondary', fontWeight: 450 },
  '& tr.zero .cat': { color: 'archie.textFaint' },
  '& tr.has .cat': { color: 'primary.main' },
  '& tr.has .amt': { bgcolor: 'archie.field' },
  '& .none': { color: 'archie.textFaint' },
  '& .rchips': { display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' },
  '& .calc': { fontWeight: 600, pr: 1 },
  '& .kmtog': { gap: 0.5, fontSize: 12.5, fontWeight: 550, color: 'primary.main', borderRadius: '4px', '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' } },
  '& .sheet > tbody > tr.km > th, & .sheet > tbody > tr.km > td': { bgcolor: 'archie.surface2', borderBottomColor: 'transparent' },
  '& .sheet > tbody > tr.sub > td': { height: 'auto', p: '0 14px 10px 40px' },
  '& .sheet > tbody > tr.km + tr.sub > td': { bgcolor: 'archie.surface2' },
  '& .sheet > tfoot th, & .sheet > tfoot td': { height: 44, px: '10px', bgcolor: 'archie.surface2', fontWeight: 600, textAlign: 'right' },
  '& .sheet > tfoot td': { pr: '22px', fontSize: 15, fontVariantNumeric: 'tabular-nums' },
  // Trasferte
  '& .trips': { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: '2px 4px' },
  '& .trips table': { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  '& .trips th': { textAlign: 'left', fontSize: 11, fontWeight: 550, color: 'text.secondary', p: '4px 8px', borderBottom: '1px solid', borderColor: 'divider' },
  '& .trips td': { p: '3px 8px', borderBottom: '1px solid', borderColor: 'divider', height: 34 },
  '& .trips .d': { width: 120 }, '& .trips .n': { width: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }, '& .trips .x': { width: 36, textAlign: 'right' },
  '& .trips tfoot td': { borderBottom: 0, color: 'text.secondary', fontSize: 12 },
  '& .trips tfoot b': { color: 'text.primary', fontWeight: 650 },
  '& .trips tr.add td': { bgcolor: 'archie.surface2' },
  '& .trips .MuiInputBase-root': { width: '100%', height: 28, px: '7px', border: '1px solid', borderColor: 'divider', borderRadius: '5px', bgcolor: 'background.paper', fontSize: 12.5,
    '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (t: { palette: { archie: { focusRing: string } } }) => t.palette.archie.focusRing } },
  '& .trips .n .MuiInputBase-root input': { textAlign: 'right' },
  // Suggerimento dallo scontrino
  '& .ocr': { display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', p: '7px 10px', borderRadius: '6px', bgcolor: 'info.light', color: 'info.main', fontSize: 12,
    '& > span': { color: 'text.primary', flex: 1, minWidth: 160 }, '& .MuiButton-root': { bgcolor: 'background.paper', height: 26 } },
  // Telefono: righe compatte (categoria e importo in alto, descrizione e scontrini sotto)
  '@media (max-width: 760px)': {
    '& table.sheet': { tableLayout: 'auto' },
    '& .sheet > thead, & .sheet .dt': { display: 'none' },
    '& .sheet > tbody, & .sheet > tfoot': { display: 'block' },
    '& .sheet > tbody > tr, & .sheet > tfoot > tr': { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 116px', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', py: '6px' },
    '& .sheet > tbody > tr > th, & .sheet > tbody > tr > td, & .sheet > tfoot > tr > th, & .sheet > tfoot > tr > td': { display: 'block', border: '0 !important', height: 'auto', width: 'auto !important', p: '2px 12px' },
    '& .sheet > tbody > tr > td.n, & .sheet > tfoot > tr > td': { gridColumn: 2, gridRow: 1, pr: '12px' },
    '& .sheet > tbody > tr > td.ds, & .sheet > tbody > tr > td.rc': { gridColumn: '1 / -1' },
    '& .sheet > tbody > tr > td.ds': { pl: '37px' }, '& .sheet > tbody > tr > td.rc': { pl: '42px' },
    '& .sheet > tbody > tr.zero > td.ds, & .sheet > tbody > tr.zero > td.rc, & .sheet > tbody > tr.km > td.rc': { display: 'none' },
    '& .sheet > tbody > tr.sub': { display: 'block', py: 0 },
    '& .sheet > tbody > tr.sub > td': { p: '0 10px 10px !important' },
    '& .sheet > tbody > tr.km': { borderBottom: 0 },
    '& .trips .d': { width: 92 },
  },
} as const
