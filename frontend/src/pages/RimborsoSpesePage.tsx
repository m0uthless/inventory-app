/**
 * RimborsoSpesePage — /rimborso-spese/:id
 *
 * Nota spese (restyle "Campo sterile", variante A · Foglio di
 * design-previews/ns-base.html): le 12 categorie come righe del modello
 * Excel, trasferte km sotto il rimborso chilometraggio, riepilogo a destra.
 * Dopo ogni modifica si ricarica l'intera nota (totali calcolati dal backend).
 */
import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Button, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon } from '../ui/campo'
import { useOwnPageHeader } from '../layout/PageHeaderContext'
import { formatEuro, isReportEditable, type ExpenseItemRow, type ExpenseReceiptRow, type ExpenseReportRow } from '../features/expenses/expensesShared'
import { MONTHS_LC, agoLabel, dShort, monthTitle, rateLabel, reportNumber } from '../features/expenses/nsModel'
import { ExpenseStatusBadge } from '../features/expenses/nsUi'
import ExpenseSheet, { type ItemPatch, type Suggestion } from '../features/expenses/ExpenseSheet'
import ExpenseSummary from '../features/expenses/ExpenseSummary'
import { ReceiptDialog, RejectDialog } from '../features/expenses/ExpenseDialogs'

type ExtractResponse = { amount: string | null; date: string | null; warnings: string[] }
type Meta = { is_secretary: boolean; user_id: number; km_rate: string | null }

function Banner({ tone, icon, title, children }: { tone: 'error' | 'success' | 'info'; icon: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Box role="status" sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', p: '10px 14px', borderRadius: '8px', mb: 1.75, fontSize: 13, bgcolor: `${tone}.light`, color: `${tone}.main` }}>
      <Box sx={{ mt: '2px', display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Box component="b" sx={{ display: 'block', fontWeight: 600 }}>{title}</Box>
        {children ? <Box component="span" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>{children}</Box> : null}
      </Box>
    </Box>
  )
}

export default function RimborsoSpesePage() {
  useOwnPageHeader()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { me } = useAuth()

  const [report, setReport] = React.useState<ExpenseReportRow | null>(null)
  const [meta, setMeta] = React.useState<Meta | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [receipt, setReceipt] = React.useState<{ r: ExpenseReceiptRow; item: ExpenseItemRow } | null>(null)
  const [extracting, setExtracting] = React.useState<number | null>(null)
  const [suggestion, setSuggestion] = React.useState<Suggestion | null>(null)

  const load = React.useCallback(async () => {
    if (!id) return
    try {
      const res = await api.get<ExpenseReportRow>(`/expense-reports/${id}/`)
      setReport(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id, toast])
  React.useEffect(() => { setLoading(true); void load() }, [load])
  React.useEffect(() => {
    api.get<Meta>('/expense-reports/meta/').then((r) => setMeta(r.data)).catch(() => {})
  }, [])

  const isOwner = report != null && me != null && report.user === me.id
  const editable = report != null && isOwner && isReportEditable(report)
  const secretary = Boolean(meta?.is_secretary)
  const canValidate = report != null && secretary && report.status === 'inviata'

  // ── Mutazioni ──
  const run = async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => {
    setBusy(true)
    try { await fn(); if (ok) toast.success(ok); await load(); return true }
    catch (e) { toast.error(apiErrorToMessage(e)); return false }
    finally { setBusy(false) }
  }
  const patchItem = (item: ExpenseItemRow, patch: ItemPatch) => run(() => api.patch(`/expense-items/${item.id}/`, patch))
  const patchReport = (patch: Partial<Pick<ExpenseReportRow, 'note' | 'advances_total'>>) => report ? run(() => api.patch(`/expense-reports/${report.id}/`, patch)) : Promise.resolve(false)
  const addTrip = async (t: { date: string; destination: string; km: number }) => {
    const km = report?.items.find((i) => i.is_km_category)
    if (!km) return false
    return run(() => api.post('/expense-km-trips/', { item: km.id, ...t }))
  }
  const removeTrip = (tripId: number) => void run(() => api.delete(`/expense-km-trips/${tripId}/`))
  const removeReceipt = (rid: number) => void run(() => api.delete(`/expense-receipts/${rid}/`), 'Scontrino rimosso.')

  const uploadReceipt = async (item: ExpenseItemRow, file: File) => {
    const fd = new FormData()
    fd.append('item', String(item.id))
    fd.append('file', file)
    const ok = await run(() => api.post('/expense-receipts/', fd, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Scontrino caricato.')
    if (!ok || !file.type.startsWith('image/')) return
    setExtracting(item.id)
    try {
      const fd2 = new FormData()
      fd2.append('file', file)
      const res = await api.post<ExtractResponse>('/expense-receipts/extract/', fd2, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data.amount || res.data.date) setSuggestion({ itemId: item.id, amount: res.data.amount, date: res.data.date })
      else if (res.data.warnings?.length) toast.info('Importo e data non letti dallo scontrino: inseriscili a mano.')
    } catch { /* suggerimento facoltativo */ } finally { setExtracting(null) }
  }
  const applySuggestion = async (item: ExpenseItemRow) => {
    if (!suggestion || suggestion.itemId !== item.id) return
    const patch: ItemPatch = {}
    if (suggestion.amount) patch.amount = suggestion.amount
    if (suggestion.date) patch.date = suggestion.date
    if (await patchItem(item, patch)) setSuggestion(null)
  }

  const submit = () => report && void run(() => api.post(`/expense-reports/${report.id}/submit/`), `Nota di ${MONTHS_LC[report.month]} inviata alla segreteria.`)
  const validate = async () => {
    if (!report) return
    if (await run(() => api.post(`/expense-reports/${report.id}/validate/`), `Nota di ${report.user_name} validata · ${formatEuro(report.total_due)}.`)) navigate('/rimborso-spese')
  }
  const remove = async () => {
    if (!report) return
    if (await run(() => api.delete(`/expense-reports/${report.id}/`), 'Nota spese spostata nel cestino.')) navigate('/rimborso-spese')
  }
  const exportPdf = () => report && window.open(`/api/expense-reports/${report.id}/export-pdf/`, '_blank', 'noopener')

  if (loading && !report) return <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
  if (!report) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ mb: 2, color: 'text.secondary' }}>Nota spese non trovata.</Typography>
        <Button variant="outlined" onClick={() => navigate('/rimborso-spese')}>Torna alle note spese</Button>
      </Box>
    )
  }

  const rate = rateLabel(report.km_rate)
  const sentAt = report.submitted_at ?? report.updated_at
  return (
    <Box sx={{ pb: 6 }}>
      <ButtonBase onClick={() => navigate('/rimborso-spese')} sx={{ gap: 0.25, mb: 0.75, fontSize: 12, fontWeight: 550, color: 'text.secondary', borderRadius: '4px', '&:hover': { color: 'text.primary' } }}>
        <CampoIcon name="chevL" size={14} />Rimborso spese
      </ButtonBase>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'grid', gap: '2px', minWidth: 0 }}>
          <Typography variant="h4" component="h1">Nota spese di {MONTHS_LC[report.month]} {report.year}</Typography>
          <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            <Box component="span" sx={{ fontFamily: 'var(--font-mono, "Geist Mono", monospace)' }}>N. {reportNumber(report)}</Box> · {report.user_name}{rate ? ` · ${rate}` : ''}
          </Typography>
        </Box>
        <Box sx={{ mt: '6px' }}><ExpenseStatusBadge status={report.status} secretary={secretary && !isOwner} /></Box>
        {busy ? <CircularProgress size={16} sx={{ mt: '8px' }} /> : null}
        <Box sx={{ ml: { sm: 'auto' }, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {isOwner && report.status === 'bozza' ? (
            <Tooltip title="Elimina la nota"><IconButton aria-label="Elimina la nota" onClick={() => setDeleteOpen(true)} disabled={busy}><CampoIcon name="trash" size={16} /></IconButton></Tooltip>
          ) : null}
          <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="download" size={15} />} onClick={exportPdf}>Esporta PDF</Button>
          {editable ? <Button variant="contained" startIcon={<CampoIcon name="arrowR" size={15} />} onClick={submit} disabled={busy}>{report.status === 'rifiutata' ? 'Reinvia alla segreteria' : 'Invia alla segreteria'}</Button> : null}
          {canValidate ? (
            <>
              <Button variant="outlined" color="error" sx={{ color: "error.main", "&:hover": { borderColor: "error.main", bgcolor: "error.light" } }} onClick={() => setRejectOpen(true)} disabled={busy}>Rifiuta</Button>
              <Button variant="contained" startIcon={<CheckIcon sx={{ fontSize: 16 }} />} onClick={validate} disabled={busy}>Valida</Button>
            </>
          ) : null}
        </Box>
      </Box>

      {report.status === 'rifiutata' ? (
        <Banner tone="error" icon={<CampoIcon name="alert" size={16} />} title={`Rifiutata${report.validated_by_name ? ` da ${report.validated_by_name}` : ''}${report.validated_at ? ` il ${dShort(report.validated_at)}` : ''}`}>
          {report.rejection_reason || 'Correggi e reinvia.'}
        </Banner>
      ) : null}
      {report.status === 'validata' ? (
        <Banner tone="success" icon={<CheckIcon sx={{ fontSize: 16 }} />} title={`Validata${report.validated_by_name ? ` da ${report.validated_by_name}` : ''}${report.validated_at ? ` il ${dShort(report.validated_at, true)}` : ''}`}>
          La nota non è più modificabile.
        </Banner>
      ) : null}
      {report.status === 'inviata' && !canValidate ? (
        <Banner tone="info" icon={<CampoIcon name="clock" size={16} />} title={`Inviata il ${dShort(sentAt)}`}>
          In attesa della segreteria. Finché non viene validata o rifiutata non è modificabile.
        </Banner>
      ) : null}
      {canValidate ? (
        <Banner tone="info" icon={<CampoIcon name="clock" size={16} />} title={`Inviata da ${report.user_name} il ${dShort(sentAt)} · ${agoLabel(sentAt)}`}>
          Controlla le voci e gli scontrini, poi valida o rifiuta con un motivo.
        </Banner>
      ) : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1fr) 300px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <ExpenseSheet report={report} editable={editable} busy={busy} extractingId={extracting} suggestion={suggestion}
            onPatch={patchItem} onUpload={(it, f) => void uploadReceipt(it, f)} onRemoveReceipt={removeReceipt}
            onOpenReceipt={(r, item) => setReceipt({ r, item })} onApplySuggestion={(it) => void applySuggestion(it)} onDismissSuggestion={() => setSuggestion(null)}
            onAddTrip={addTrip} onRemoveTrip={removeTrip} />
        </Box>
        <ExpenseSummary report={report} editable={editable} canValidate={canValidate} busy={busy}
          onAdvances={(v) => patchReport({ advances_total: v })} onNote={(v) => patchReport({ note: v })}
          onSubmit={submit} onValidate={() => void validate()} onReject={() => setRejectOpen(true)} />
      </Box>

      <RejectDialog report={rejectOpen ? report : null} onClose={() => setRejectOpen(false)} onDone={() => { setRejectOpen(false); navigate('/rimborso-spese') }} />
      <ReceiptDialog receipt={receipt?.r ?? null} item={receipt?.item ?? null} onClose={() => setReceipt(null)} />
      <ConfirmDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => void remove()} busy={busy}
        title="Eliminare la nota spese?" description={`${monthTitle(report)}: la nota va nel cestino.`} />
    </Box>
  )
}
