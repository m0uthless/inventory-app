import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, TextField, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon, CampoDialog as NsDialog } from '../../ui/campo'
import { formatEuro, type ExpenseItemRow, type ExpenseReceiptRow, type ExpenseReportRow } from './expensesShared'
import { CATEGORY_META, MONTHS_LC, cap, dShort, firstFreeMonth, missingReceipts, monthTitle, parseEuroInput, statusLabel, toNum } from './nsModel'

const chipSx = {
  minHeight: 28, px: 1.25, py: 0.5, borderRadius: '14px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
  fontSize: 12, fontWeight: 550, color: 'text.secondary', textAlign: 'left',
  '&:hover': { borderColor: 'primary.main', color: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (t: { palette: { archie: { focusRing: string } } }) => t.palette.archie.focusRing },
} as const

// ── Nuova nota spese ────────────────────────────────────────────────────────

export function NewReportDialog({ open, onClose, mine, onCreated }: {
  open: boolean
  onClose: () => void
  /** Note dell'utente: i mesi già usati non si possono scegliere. */
  mine: ExpenseReportRow[]
  onCreated: (id: number) => void
}) {
  const toast = useToast()
  const now = new Date()
  const [year, setYear] = React.useState(now.getFullYear())
  const taken = React.useMemo(() => new Map(mine.filter((r) => r.year === year).map((r) => [r.month, r])), [mine, year])
  const [month, setMonth] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    setYear(now.getFullYear())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  React.useEffect(() => {
    if (!open) return
    setMonth(firstFreeMonth(new Set(taken.keys()), year === now.getFullYear() ? now.getMonth() + 1 : 12))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, year, taken])

  const create = async () => {
    if (!month || busy) return
    setBusy(true)
    try {
      const r = await api.post<ExpenseReportRow>('/expense-reports/', { year, month })
      toast.success(`Nota di ${MONTHS_LC[month]} ${year} creata.`)
      onCreated(r.data.id)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  return (
    <NsDialog open={open} onClose={onClose} busy={busy} labelId="ns-new-t" title="Nuova nota spese" sub="Una nota per mese: parte con le 12 categorie vuote."
      footer={<><Box sx={{ flex: 1 }} /><Button color="inherit" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" onClick={create} disabled={!month || busy} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <CampoIcon name="plus" size={15} />}>
          {month ? `Crea ${MONTHS_LC[month]} ${year}` : 'Crea'}
        </Button></>}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25 }}>
        <IconButton size="small" aria-label="Anno precedente" onClick={() => setYear((y) => y - 1)}><CampoIcon name="chevL" size={16} /></IconButton>
        <Typography component="b" sx={{ fontSize: 15, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{year}</Typography>
        <IconButton size="small" aria-label="Anno successivo" disabled={year >= now.getFullYear()} onClick={() => setYear((y) => y + 1)}><CampoIcon name="chevR" size={16} /></IconButton>
      </Box>
      <Box role="radiogroup" aria-label="Mese" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0,1fr))', sm: 'repeat(4, minmax(0,1fr))' }, gap: 0.75 }}>
        {MONTHS_LC.slice(1).map((m, i) => {
          const n = i + 1
          const have = taken.get(n)
          const future = year === now.getFullYear() && n > now.getMonth() + 2
          const on = month === n
          return (
            <ButtonBase key={n} role="radio" aria-checked={on} disabled={Boolean(have) || future} onClick={() => setMonth(n)} sx={{
              display: 'grid', justifyItems: 'start', gap: '1px', p: '8px 10px', borderRadius: '8px', border: '1px solid', textAlign: 'left',
              borderColor: on ? 'archie.fieldLine' : 'divider', bgcolor: have || future ? 'archie.surface2' : on ? 'archie.field' : 'background.paper',
              boxShadow: on ? (t) => `inset 0 0 0 1px ${t.palette.archie.fieldLine}` : 'none',
              '&:hover:not(:disabled)': { borderColor: on ? 'archie.fieldLine' : 'archie.borderStrong' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
            }}>
              <Box component="b" sx={{ fontSize: 13, fontWeight: have || future ? 500 : 600, color: on ? 'primary.main' : have || future ? 'text.secondary' : 'text.primary' }}>{cap(m)}</Box>
              <Box component="small" sx={{ fontSize: 11, color: 'text.secondary' }}>{have ? statusLabel(have.status, false).toLowerCase() : future ? '—' : 'libero'}</Box>
            </ButtonBase>
          )
        })}
      </Box>
      {!month ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Tutti i mesi di quest'anno hanno già una nota.</Typography> : null}
    </NsDialog>
  )
}

// ── Rifiuto (segreteria) ────────────────────────────────────────────────────

export function RejectDialog({ report, onClose, onDone }: { report: ExpenseReportRow | null; onClose: () => void; onDone: (r: ExpenseReportRow) => void }) {
  const toast = useToast()
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { if (report) setReason('') }, [report])
  if (!report) return null
  const quick = [...missingReceipts(report).map((i) => `Manca lo scontrino di «${CATEGORY_META[i.category].label}».`), 'Importo diverso dallo scontrino.', 'Km da verificare con i rapportini.']
  const go = async () => {
    if (!reason.trim() || busy) return
    setBusy(true)
    try {
      const r = await api.post<ExpenseReportRow>(`/expense-reports/${report.id}/reject/`, { reason: reason.trim() })
      toast.success(`Nota rifiutata: ${report.user_name} riceve il motivo.`)
      onDone(r.data)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  return (
    <NsDialog open onClose={onClose} busy={busy} labelId="ns-rj-t" title={`Rifiuta la nota di ${report.user_name}`}
      sub={`${monthTitle(report)} · ${formatEuro(report.total_due)}. Il motivo arriva al dipendente, che corregge e reinvia.`}
      footer={<><Box sx={{ flex: 1 }} /><Button color="inherit" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" color="error" onClick={go} disabled={!reason.trim() || busy}>Rifiuta la nota</Button></>}>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 550, mb: 0.75 }}>Motivi frequenti</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {quick.map((q) => <ButtonBase key={q} sx={chipSx} onClick={() => setReason((r) => (r.trim() ? `${r.trim()} ${q}` : q))}>{q}</ButtonBase>)}
        </Box>
      </Box>
      <Box>
        <Typography component="label" htmlFor="ns-rj" sx={{ display: 'block', fontSize: 12, fontWeight: 550, mb: 0.75 }}>Motivo <Box component="span" sx={{ color: 'error.main' }}>*</Box></Typography>
        <TextField id="ns-rj" autoFocus fullWidth multiline minRows={3} placeholder="Cosa deve correggere?" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Box>
    </NsDialog>
  )
}

// ── Anteprima scontrino ─────────────────────────────────────────────────────

export function ReceiptDialog({ receipt, item, onClose }: { receipt: ExpenseReceiptRow | null; item: ExpenseItemRow | null; onClose: () => void }) {
  if (!receipt || !item) return null
  const name = receipt.file_name || 'Scontrino'
  const isPdf = /\.pdf$/i.test(name)
  const ocr = receipt.ocr_amount != null ? toNum(receipt.ocr_amount) : null
  const single = item.receipts.length === 1
  const differs = ocr != null && single && Math.abs(ocr - toNum(item.amount)) > 0.009
  return (
    <NsDialog open onClose={onClose} width={720} labelId="ns-lb-t" title={name}
      sub={`${CATEGORY_META[item.category].label} · in nota ${formatEuro(item.amount)}${item.date ? ` del ${dShort(item.date)}` : ''}`}
      footer={<>
        <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="eye" size={15} />} onClick={() => window.open(receipt.file_url ?? '', '_blank', 'noopener')} disabled={!receipt.file_url}>Apri in una nuova scheda</Button>
        <Box sx={{ flex: 1 }} /><Button variant="contained" onClick={onClose}>Chiudi</Button></>}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) 200px' }, gap: 2 }}>
        <Box sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2', overflow: 'hidden', display: 'grid', placeItems: 'center', minHeight: 320 }}>
          {!receipt.file_url ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>File non disponibile.</Typography>
            : isPdf ? <Box component="iframe" title={name} src={`${receipt.file_url}#toolbar=0&view=FitH`} sx={{ width: '100%', height: 440, border: 0 }} />
              : <Box component="img" src={receipt.file_url} alt={`Scontrino ${name}`} sx={{ maxWidth: '100%', maxHeight: 440, objectFit: 'contain', display: 'block' }} />}
        </Box>
        <Box sx={{ display: 'grid', gap: 1, alignContent: 'start', fontSize: 13 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary' }}>In nota</Typography>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontWeight: 550 } }}>
            <dt>Importo</dt><dd>{formatEuro(item.amount)}</dd>
            <dt>Data</dt><dd>{item.date ? dShort(item.date, true) : '—'}</dd>
            <dt>Scontrini</dt><dd>{item.receipts.length}</dd>
            {ocr != null ? <><dt>Letto</dt><dd>{formatEuro(ocr)}{receipt.ocr_date ? ` · ${dShort(receipt.ocr_date)}` : ''}</dd></> : null}
          </Box>
          {differs ? (
            <Box sx={{ display: 'flex', gap: 0.75, fontSize: 12, p: '7px 9px', borderRadius: '6px', bgcolor: 'warning.light', color: 'warning.main' }}><CampoIcon name="alert" size={14} />L'importo in nota è diverso da quello letto.</Box>
          ) : null}
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Confronta importo e data con quanto scritto nella voce.</Typography>
        </Box>
      </Box>
    </NsDialog>
  )
}

// ── Tariffe km (segreteria) ─────────────────────────────────────────────────

type RateRow = { id: number; user: number; user_name: string; rate_per_km: string }
type UserLite = { id: number; full_name?: string; username: string; is_active?: boolean }

export function KmRatesDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [rows, setRows] = React.useState<{ user: number; name: string; rateId: number | null; value: string; orig: string }[] | null>(null)
  const [q, setQ] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    setRows(null); setQ('')
    Promise.all([api.get<RateRow[]>('/expense-km-rates/'), api.get<UserLite[]>('/users/', { params: { page_size: 300 } })])
      .then(([rates, users]) => {
        const byUser = new Map(rates.data.map((r) => [r.user, r]))
        const list = (Array.isArray(users.data) ? users.data : []).filter((u) => u.is_active !== false || byUser.has(u.id)).map((u) => {
          const r = byUser.get(u.id)
          const v = r ? toNum(r.rate_per_km).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : ''
          return { user: u.id, name: u.full_name || u.username, rateId: r?.id ?? null, value: v, orig: v }
        }).sort((a, b) => Number(Boolean(b.rateId)) - Number(Boolean(a.rateId)) || a.name.localeCompare(b.name))
        setRows(list)
      })
      .catch((e) => { toast.error(apiErrorToMessage(e)); setRows([]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const changed = (rows ?? []).filter((r) => r.value !== r.orig && r.value.trim() !== '')
  const invalid = changed.some((r) => { const n = parseEuroInput(r.value); return n == null || n < 0 || n > 99 })
  const save = async () => {
    if (!changed.length || invalid || busy) return
    setBusy(true)
    try {
      for (const r of changed) {
        const rate = String(parseEuroInput(r.value))
        if (r.rateId) await api.patch(`/expense-km-rates/${r.rateId}/`, { rate_per_km: rate })
        else await api.post('/expense-km-rates/', { user: r.user, rate_per_km: rate })
      }
      toast.success(changed.length === 1 ? 'Tariffa aggiornata.' : `${changed.length} tariffe aggiornate.`)
      onSaved(); onClose()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const shown = (rows ?? []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <NsDialog open={open} onClose={onClose} busy={busy} labelId="ns-km-t" title="Tariffe km" sub="Euro al km per persona: il rimborso chilometraggio si calcola con la tariffa del dipendente. Vale per le trasferte inserite o modificate da qui in avanti."
      footer={<><Typography sx={{ fontSize: 12, color: invalid ? 'error.main' : 'text.secondary' }}>{invalid ? 'Controlla i valori: es. 0,42' : changed.length ? `${changed.length} da salvare` : ''}</Typography><Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" onClick={save} disabled={!changed.length || invalid || busy}>Salva</Button></>}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 34, px: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: '6px' }}>
        <CampoIcon name="search" size={15} />
        <InputBase fullWidth placeholder="Cerca una persona" value={q} onChange={(e) => setQ(e.target.value)} inputProps={{ 'aria-label': 'Cerca una persona' }} sx={{ fontSize: 13 }} />
      </Box>
      {!rows ? <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={22} /></Box> : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
          {shown.map((r) => (
            <Box component="li" key={r.user} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: r.rateId ? 550 : 400, color: r.rateId ? 'text.primary' : 'text.secondary' }}>{r.name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <InputBase value={r.value} placeholder="—" inputProps={{ inputMode: 'decimal', 'aria-label': `Tariffa €/km di ${r.name}` }}
                  onChange={(e) => setRows((rs) => rs!.map((x) => (x.user === r.user ? { ...x, value: e.target.value } : x)))}
                  sx={{ flex: 1, height: 30, px: 1, border: '1px solid', borderColor: r.value !== r.orig ? 'archie.fieldLine' : 'divider', borderRadius: '6px', fontSize: 13, '& input': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }} />
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>€/km</Box>
              </Box>
            </Box>
          ))}
          {!shown.length ? <Typography sx={{ py: 2, fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>Nessuna persona trovata.</Typography> : null}
        </Box>
      )}
    </NsDialog>
  )
}
