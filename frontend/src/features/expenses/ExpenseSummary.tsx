import * as React from 'react'
import { Box, Button, CircularProgress, InputBase, TextField, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { CampoIcon } from '../../ui/campo'
import { formatEuro, type ExpenseReportRow } from './expensesShared'
import { CATEGORY_META, amountInput, filledItems, kmTotal, missingReceipts, parseEuroInput, rateLabel, toNum, tripCount } from './nsModel'

type Props = {
  report: ExpenseReportRow
  editable: boolean
  canValidate: boolean
  busy: boolean
  onAdvances: (v: string) => Promise<boolean>
  onNote: (v: string) => Promise<boolean>
  onSubmit: () => void
  onValidate: () => void
  onReject: () => void
}

/** Riepilogo laterale della nota: totale per categoria, anticipi, da rendere, controlli e invio. */
export default function ExpenseSummary({ report, editable, canValidate, busy, onAdvances, onNote, onSubmit, onValidate, onReject }: Props) {
  const parts = filledItems(report).map((i) => ({ i, v: toNum(i.amount) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
  const miss = missingReceipts(report)
  const trips = tripCount(report)
  const rate = rateLabel(report.km_rate)
  const [adv, setAdv] = React.useState(amountInput(report.advances_total))
  const [advBad, setAdvBad] = React.useState(false)
  const [note, setNote] = React.useState(report.note)
  React.useEffect(() => { setAdv(amountInput(report.advances_total)); setAdvBad(false) }, [report.advances_total])
  React.useEffect(() => { setNote(report.note) }, [report.note])
  const canSend = parts.length > 0 || toNum(report.advances_total) > 0

  const checks: { tone: 'warn' | 'ok'; title: string; sub: string }[] = []
  if (miss.length) checks.push({ tone: 'warn', title: `${miss.length} ${miss.length === 1 ? 'voce' : 'voci'} senza scontrino`, sub: miss.map((i) => CATEGORY_META[i.category].label).join(', ') })
  if (trips) checks.push(rate ? { tone: 'ok', title: `${kmTotal(report).toLocaleString('it-IT')} km in ${trips} ${trips === 1 ? 'trasferta' : 'trasferte'}`, sub: `${formatEuro(report.items.find((i) => i.is_km_category)?.amount ?? 0)} a ${rate}` }
    : { tone: 'warn', title: 'Tariffa km non impostata', sub: 'Il rimborso chilometraggio resta a zero: chiedi alla segreteria di impostarla' })
  if (editable && !canSend) checks.push({ tone: 'warn', title: 'Nessuna spesa inserita', sub: 'Compila almeno una voce prima di inviare' })

  return (
    <Box component="aside" aria-label="Riepilogo della nota" sx={{
      position: { lg: 'sticky' }, top: 0, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: '14px', display: 'grid', gap: 1.75,
    }}>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary' }}>Totale spese</Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(report.total_expenses)}</Typography>
        <Box aria-hidden sx={{ display: 'flex', gap: '2px', height: 8, borderRadius: '4px', overflow: 'hidden', my: 1, bgcolor: 'archie.neutralBg' }}>
          {parts.map(({ i, v }) => <Tooltip key={i.id} title={`${CATEGORY_META[i.category].label}: ${formatEuro(v)}`}><Box sx={{ flex: v, minWidth: 3, bgcolor: CATEGORY_META[i.category].color }} /></Tooltip>)}
        </Box>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: '3px', fontSize: 12 }}>
          {parts.map(({ i, v }) => (
            <Box component="li" key={i.id} sx={{ display: 'grid', gridTemplateColumns: '8px minmax(0,1fr) auto', gap: 1, alignItems: 'center', color: 'text.secondary' }}>
              <Box component="i" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: CATEGORY_META[i.category].color }} />
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CATEGORY_META[i.category].label}</Box>
              <Box component="b" sx={{ color: 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(v)}</Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', alignItems: 'center', pt: 1.5, borderTop: '1px solid', borderColor: 'divider', fontSize: 13,
        '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}>
        <dt><label htmlFor="ns-adv">Anticipi ricevuti</label></dt>
        <dd>
          {editable ? (
            <InputBase id="ns-adv" value={adv} placeholder="0,00" onChange={(e) => setAdv(e.target.value)}
              onBlur={async () => { if (adv === amountInput(report.advances_total)) return; const n = parseEuroInput(adv); if (n == null || n < 0) { setAdvBad(true); return } setAdvBad(false); if (!(await onAdvances(String(n)))) setAdv(amountInput(report.advances_total)) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              inputProps={{ inputMode: 'decimal', 'aria-invalid': advBad || undefined }}
              sx={{ width: 112, height: 30, px: 1, border: '1px solid', borderColor: advBad ? 'error.main' : 'divider', borderRadius: '6px', fontSize: 13, '& input': { textAlign: 'right' }, '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing } }} />
          ) : toNum(report.advances_total) ? `− ${formatEuro(report.advances_total)}` : '—'}
        </dd>
        <Box component="dt" sx={{ color: 'text.primary !important', fontWeight: 600 }}>Da rendere</Box>
        <Box component="dd" sx={{ fontSize: 17, fontWeight: 650 }}>{formatEuro(report.total_due)}</Box>
      </Box>

      {checks.length ? (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}>
          {checks.map((c) => (
            <Box component="li" key={c.title} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', fontSize: 12, p: '7px 9px', borderRadius: '6px',
              bgcolor: c.tone === 'warn' ? 'warning.light' : 'archie.surface2', color: c.tone === 'warn' ? 'warning.main' : 'success.main' }}>
              {c.tone === 'warn' ? <CampoIcon name="alert" size={14} /> : <CheckIcon sx={{ fontSize: 14, mt: '2px' }} />}
              <Box sx={{ minWidth: 0 }}>
                <Box component="b" sx={{ display: 'block', fontWeight: 600, color: 'text.primary' }}>{c.title}</Box>
                <Box component="small" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{c.sub}</Box>
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      <Box>
        <Typography component="label" htmlFor="ns-note" sx={{ display: 'block', fontSize: 12, fontWeight: 550, mb: 0.75 }}>Note per la segreteria</Typography>
        {editable ? (
          <TextField id="ns-note" fullWidth multiline minRows={2} maxRows={6} placeholder="Facoltative" value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={async () => { if (note !== report.note && !(await onNote(note))) setNote(report.note) }} />
        ) : <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', color: report.note ? 'text.primary' : 'text.disabled' }}>{report.note || 'Nessuna nota.'}</Typography>}
      </Box>

      {editable ? (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Button variant="contained" size="large" onClick={onSubmit} disabled={busy || !canSend} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <CampoIcon name="arrowR" size={15} />}>
            {report.status === 'rifiutata' ? 'Reinvia alla segreteria' : 'Invia alla segreteria'}
          </Button>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Dopo l'invio la nota non è più modificabile, a meno che la segreteria non la rifiuti.</Typography>
        </Box>
      ) : null}
      {canValidate ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1 }}>
          <Button variant="outlined" color="error" sx={{ color: "error.main", "&:hover": { borderColor: "error.main", bgcolor: "error.light" } }} onClick={onReject} disabled={busy}>Rifiuta</Button>
          <Button variant="contained" onClick={onValidate} disabled={busy} startIcon={<CheckIcon sx={{ fontSize: 16 }} />}>Valida {formatEuro(report.total_due)}</Button>
        </Box>
      ) : null}
    </Box>
  )
}
