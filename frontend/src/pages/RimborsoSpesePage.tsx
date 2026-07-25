/**
 * RimborsoSpesePage — /rimborso-spese/:id
 *
 * Pagina intera (non drawer): layout a tabella che rispecchia il modello
 * Excel. `table-layout: fixed` + `<colgroup>` su ogni tabella per garantire
 * che le colonne restino allineate riga per riga (senza, il browser
 * ridimensiona le colonne in base al contenuto e le righe "scivolano").
 *
 * Stessa strategia di sincronizzazione del drawer precedente: dopo ogni
 * mutazione si ricarica l'intero report con una GET.
 */
import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import AddIcon from '@mui/icons-material/Add'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import {
  CATEGORY_ORDER,
  STATUS_COLORS,
  STATUS_LABELS,
  formatEuro,
  formatItDate,
  isReportEditable,
  todayISO,
  type ExpenseItemRow,
  type ExpenseReportRow,
} from '../features/expenses/expensesShared'

type ExtractResponse = { amount: string | null; date: string | null; warnings: string[] }
type Meta = { is_secretary: boolean; user_id: number; km_rate: string | null }

// ─── Stile "foglio" — bordi sottili neri come una griglia Excel ─────────────

const sheetBorder = '1px solid #333'
const cellSx = { border: sheetBorder, px: 1, py: 0.5, verticalAlign: 'middle' as const, overflow: 'hidden' as const }
const headCellSx = { ...cellSx, fontWeight: 700, fontSize: 11, letterSpacing: '0.03em', bgcolor: '#f3f4f6' }
// Celle dove il tecnico può scrivere: piccolo highlight teal (coerente col tema) per segnalarlo a colpo d'occhio.
const editableCellSx = { bgcolor: 'rgba(94, 234, 212, 0.14)' }
const tableSx = { width: '100%', tableLayout: 'fixed' as const, borderCollapse: 'collapse' as const, bgcolor: '#fff', fontSize: 13 }

function euroOrBlank(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  if (!Number.isFinite(n) || n === 0) return ''
  return formatEuro(value)
}

function CellInput({
  value, onChange, onBlur, disabled, align = 'left', placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  disabled?: boolean
  align?: 'left' | 'right'
  placeholder?: string
}) {
  return (
    <TextField
      variant="standard"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      InputProps={{ disableUnderline: true }}
      inputProps={{ style: { padding: 0, fontSize: 13, textAlign: align } }}
    />
  )
}

export default function RimborsoSpesePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { me } = useAuth()

  const [report, setReport] = React.useState<ExpenseReportRow | null>(null)
  const [meta, setMeta] = React.useState<Meta | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState('')

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await api.get<ExpenseReportRow>(`/expense-reports/${id}/`)
      setReport(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    api.get<Meta>('/expense-reports/meta/').then((r) => setMeta(r.data)).catch(() => {})
  }, [])

  const isOwner = report != null && me != null && report.user === me.id
  const editable = report != null && isOwner && isReportEditable(report)
  const canSubmit = report != null && isOwner && isReportEditable(report)
  const canValidateReject = report != null && Boolean(meta?.is_secretary) && report.status === 'inviata'

  const items = React.useMemo(() => {
    if (!report) return []
    return [...report.items].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    )
  }, [report])

  const kmItem = items.find((i) => i.is_km_category) ?? null

  // ── Note / anticipi ────────────────────────────────────────────────────
  const [noteDraft, setNoteDraft] = React.useState('')
  const [advancesDraft, setAdvancesDraft] = React.useState('')
  React.useEffect(() => {
    if (report) {
      setNoteDraft(report.note)
      const n = parseFloat(report.advances_total)
      setAdvancesDraft(Number.isFinite(n) && n === 0 ? '' : report.advances_total)
    }
  }, [report])

  const saveReportFields = async () => {
    if (!report || !editable) return
    try {
      await api.patch(`/expense-reports/${report.id}/`, { note: noteDraft, advances_total: advancesDraft || '0' })
      await load()
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }

  // ── Voci categoria ─────────────────────────────────────────────────────
  const patchItem = async (item: ExpenseItemRow, patch: Partial<Pick<ExpenseItemRow, 'description' | 'amount' | 'date'>>) => {
    try {
      await api.patch(`/expense-items/${item.id}/`, patch)
      await load()
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }

  // ── Trasferte km ───────────────────────────────────────────────────────
  const [tripDate, setTripDate] = React.useState(todayISO())
  const [tripDest, setTripDest] = React.useState('')
  const [tripKm, setTripKm] = React.useState('')

  const addTrip = async () => {
    if (!kmItem) return
    if (!tripDest.trim() || !tripKm) { toast.warning('Compila destinazione e km.'); return }
    setBusy(true)
    try {
      await api.post('/expense-km-trips/', { item: kmItem.id, date: tripDate, destination: tripDest.trim(), km: Number(tripKm) })
      setTripDest(''); setTripKm('')
      await load()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const removeTrip = async (tripId: number) => {
    setBusy(true)
    try { await api.delete(`/expense-km-trips/${tripId}/`); await load() }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  // ── Scontrini + OCR ─────────────────────────────────────────────────────
  const [extracting, setExtracting] = React.useState<number | null>(null)
  const [suggestion, setSuggestion] = React.useState<{ itemId: number; amount: string | null; date: string | null } | null>(null)
  const fileInputsRef = React.useRef<Record<number, HTMLInputElement | null>>({})

  const uploadReceipt = async (item: ExpenseItemRow, file: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('item', String(item.id))
      fd.append('file', file)
      await api.post('/expense-receipts/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
      toast.success('Scontrino caricato.')

      if (file.type.startsWith('image/')) {
        setExtracting(item.id)
        try {
          const fd2 = new FormData()
          fd2.append('file', file)
          const res = await api.post<ExtractResponse>('/expense-receipts/extract/', fd2, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (res.data.amount || res.data.date) {
            setSuggestion({ itemId: item.id, amount: res.data.amount, date: res.data.date })
          } else if (res.data.warnings?.length) {
            toast.info('Estrazione automatica non riuscita: inserisci importo/data manualmente.')
          }
        } catch { /* suggerimento opzionale */ } finally { setExtracting(null) }
      }
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const applySuggestion = async (item: ExpenseItemRow) => {
    if (!suggestion || suggestion.itemId !== item.id) return
    const patch: Partial<Pick<ExpenseItemRow, 'amount' | 'date'>> = {}
    if (suggestion.amount && !item.is_km_category) patch.amount = suggestion.amount
    if (suggestion.date) patch.date = suggestion.date
    await patchItem(item, patch)
    setSuggestion(null)
  }

  const removeReceipt = async (receiptId: number) => {
    setBusy(true)
    try { await api.delete(`/expense-receipts/${receiptId}/`); await load() }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  // ── Workflow ─────────────────────────────────────────────────────────────
  const doSubmit = async () => {
    if (!report) return
    setBusy(true)
    try { await api.post(`/expense-reports/${report.id}/submit/`); toast.success('Nota spese inviata.'); await load() }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const doValidate = async () => {
    if (!report) return
    setBusy(true)
    try { await api.post(`/expense-reports/${report.id}/validate/`); toast.success('Validata.'); await load() }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const doReject = async () => {
    if (!report || !rejectReason.trim()) return
    setBusy(true)
    try {
      await api.post(`/expense-reports/${report.id}/reject/`, { reason: rejectReason.trim() })
      toast.success('Rifiutata.')
      setRejectOpen(false); setRejectReason('')
      await load()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const exportPdf = () => report && window.open(`/api/expense-reports/${report.id}/export-pdf/`, '_blank')

  if (loading && !report) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }
  if (!report) return null

  const colors = STATUS_COLORS[report.status]
  const totalKm = kmItem ? kmItem.km_trips.reduce((s, t) => s + t.km, 0) : 0

  return (
    <Box sx={{ width: '100%', pb: 6 }}>
      {/* ── Barra superiore ────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" onClick={() => navigate('/rimborso-spese')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h6" fontWeight={800}>Nota spese {report.number}</Typography>
          <Chip
            size="small" label={STATUS_LABELS[report.status]}
            sx={{ bgcolor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`, fontWeight: 700 }}
          />
          {busy || loading ? <CircularProgress size={16} /> : null}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={exportPdf}>
            Esporta PDF
          </Button>
          {canSubmit ? (
            <Button size="small" variant="contained" startIcon={<SendOutlinedIcon />} onClick={doSubmit} disabled={busy}>
              Invia alla segreteria
            </Button>
          ) : null}
          {canValidateReject ? (
            <>
              <Button size="small" variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />} onClick={doValidate} disabled={busy}>
                Valida
              </Button>
              <Button size="small" variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setRejectOpen(true)} disabled={busy}>
                Rifiuta
              </Button>
            </>
          ) : null}
        </Stack>
      </Stack>

      {report.status === 'rifiutata' && report.rejection_reason ? (
        <Alert severity="warning" sx={{ mb: 2 }}>Rifiutata: {report.rejection_reason}</Alert>
      ) : null}
      {report.status === 'validata' && report.validated_by_name ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Validata da {report.validated_by_name}{report.validated_at ? ` il ${formatItDate(report.validated_at.slice(0, 10))}` : ''}
        </Alert>
      ) : null}

      {editable ? (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, ...editableCellSx, border: sheetBorder }} />
          <Typography variant="caption" color="text.secondary">Celle compilabili</Typography>
        </Stack>
      ) : null}

      {/* ── Foglio: intestazione + griglia categorie ─────────────────────── */}
      <Box component="table" sx={tableSx}>
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '58%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <tbody>
          <tr>
            <Box component="td" colSpan={3} sx={{ ...cellSx, textAlign: 'center', fontWeight: 800, py: 1, fontSize: 14 }}>
              BIOTRON S.P.A. · VIA AVATI, 43 · 40054 BUDRIO (BO)
            </Box>
          </tr>
          <tr>
            <Box component="td" sx={headCellSx}>NOTA SPESE N. {report.number}</Box>
            <Box component="td" sx={headCellSx}>MESE DI {report.month_label.toUpperCase()} {report.year}</Box>
            <Box component="td" sx={headCellSx}>SIG. {report.user_name}</Box>
          </tr>
          <tr>
            <Box component="td" colSpan={2} sx={headCellSx}>DESCRIZIONE</Box>
            <Box component="td" sx={{ ...headCellSx, textAlign: 'right' }}>TOTALI GENERALI</Box>
          </tr>

          {items.map((item) => (
            <tr key={item.id}>
              <Box component="td" sx={{ ...cellSx, fontWeight: 600, fontSize: 12 }}>
                {item.category_label}
              </Box>
              <Box component="td" sx={{ ...cellSx, ...(editable ? editableCellSx : {}) }}>
                <ItemNoteCell
                  item={item} editable={editable}
                  extracting={extracting === item.id}
                  suggestion={suggestion?.itemId === item.id ? suggestion : null}
                  onPatch={(patch) => patchItem(item, patch)}
                  onApplySuggestion={() => applySuggestion(item)}
                  onDismissSuggestion={() => setSuggestion(null)}
                  onUploadClick={() => fileInputsRef.current[item.id]?.click()}
                  onRemoveReceipt={removeReceipt}
                  fileInputRef={(el) => { fileInputsRef.current[item.id] = el }}
                  onFileSelected={(f) => uploadReceipt(item, f)}
                />
              </Box>
              <Box component="td" sx={{ ...cellSx, ...(editable && !item.is_km_category ? editableCellSx : {}) }}>
                {item.is_km_category ? (
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{euroOrBlank(item.amount)}</Typography>
                ) : (
                  <AmountCell
                    value={item.amount}
                    disabled={!editable}
                    onCommit={(v) => v !== item.amount && patchItem(item, { amount: v })}
                  />
                )}
              </Box>
            </tr>
          ))}
        </tbody>
      </Box>

      {/* ── Foglio: log trasferte km + totali/anticipi/note ──────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ mt: 3 }} alignItems="flex-start">
        {/* Log trasferte km — più stretto per lasciare spazio prima dei totali */}
        <Box component="table" sx={{ ...tableSx, width: '55%', flex: '0 0 auto' }}>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '56%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <tbody>
            <tr>
              <Box component="td" sx={headCellSx}>DATA</Box>
              <Box component="td" sx={headCellSx}>LUOGO DI DESTINAZIONE</Box>
              <Box component="td" sx={{ ...headCellSx, textAlign: 'right' }}>KM PERCORSI</Box>
            </tr>
            {kmItem?.km_trips.map((trip) => (
              <tr key={trip.id}>
                <Box component="td" sx={cellSx}>{formatItDate(trip.date)}</Box>
                <Box component="td" sx={cellSx}>{trip.destination}</Box>
                <Box component="td" sx={{ ...cellSx, textAlign: 'right' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                    {trip.km}
                    {editable ? (
                      <IconButton size="small" onClick={() => removeTrip(trip.id)} sx={{ p: 0.25 }}>
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    ) : null}
                  </Stack>
                </Box>
              </tr>
            ))}
            {editable && kmItem ? (
              <tr>
                <Box component="td" sx={{ ...cellSx, ...editableCellSx }}>
                  <TextField
                    type="date" variant="standard" size="small" fullWidth value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                    InputProps={{ disableUnderline: true }} inputProps={{ style: { padding: 0, fontSize: 12.5 } }}
                  />
                </Box>
                <Box component="td" sx={{ ...cellSx, ...editableCellSx }}>
                  <CellInput value={tripDest} onChange={setTripDest} onBlur={() => {}} placeholder="Destinazione" />
                </Box>
                <Box component="td" sx={{ ...cellSx, ...editableCellSx, textAlign: 'right' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                    <TextField
                      variant="standard" size="small" placeholder="km" value={tripKm}
                      onChange={(e) => setTripKm(e.target.value)}
                      InputProps={{ disableUnderline: true }}
                      inputProps={{ style: { padding: 0, fontSize: 12.5, width: 36, textAlign: 'right' } }}
                    />
                    <IconButton size="small" onClick={addTrip} sx={{ p: 0.25 }}><AddIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Stack>
                </Box>
              </tr>
            ) : null}
            <tr>
              <Box component="td" colSpan={2} sx={{ ...cellSx, fontWeight: 700 }}>TOTALE KM</Box>
              <Box component="td" sx={{ ...cellSx, fontWeight: 700, textAlign: 'right' }}>{totalKm || ''}</Box>
            </tr>
          </tbody>
        </Box>

        {/* Spazio vuoto fra le due tabelle */}
        <Box sx={{ width: '5%', flex: '0 0 auto' }} />

        {/* Anticipi / totali / note — colonna importo allineata con "TOTALI GENERALI" sopra (18% pagina) */}
        <Box component="table" sx={{ ...tableSx, width: '40%', flex: '0 0 auto' }}>
          <colgroup>
            <col style={{ width: '55%' }} />
            <col style={{ width: '45%' }} />
          </colgroup>
          <tbody>
            <tr>
              <Box component="td" sx={headCellSx}>TOT. ANTICIPI</Box>
              <Box component="td" sx={{ ...cellSx, ...(editable ? editableCellSx : {}), textAlign: 'right' }}>
                <AmountCell value={advancesDraft || '0'} disabled={!editable} onCommit={(v) => { setAdvancesDraft(v); void saveReportFields() }} />
              </Box>
            </tr>
            <tr>
              <Box component="td" sx={{ ...headCellSx, fontSize: 12.5 }}>TOT. DA RENDERE</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'right', fontWeight: 800 }}>{euroOrBlank(report.total_due)}</Box>
            </tr>
            <tr>
              <Box component="td" colSpan={2} sx={{ ...cellSx, ...(editable ? editableCellSx : {}) }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>Note</Typography>
                <TextField
                  variant="standard" fullWidth multiline minRows={2}
                  value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={saveReportFields}
                  disabled={!editable}
                  InputProps={{ disableUnderline: true }} inputProps={{ style: { fontSize: 12.5 } }}
                />
              </Box>
            </tr>
          </tbody>
        </Box>
      </Stack>

      {/* ── Note a piè di pagina (come nel modello) ──────────────────────── */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        * Voce "Rimborso chilometraggio" spuntata dalle trasferte sopra, calcolata automaticamente in base alla tua
        tariffa €/km. ** "Varie automezzi" = lavaggio, parcheggi e piccole manutenzioni fino a 50€. *** "Pasti" =
        consumazioni al ristorante o al bar.
      </Typography>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Motivo del rifiuto</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            placeholder="Es. manca lo scontrino del pernottamento…"
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Annulla</Button>
          <Button variant="contained" color="error" disabled={!rejectReason.trim() || busy} onClick={doReject}>
            Rifiuta nota spese
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ─── Cella importo (allineata a destra, vuota se zero) ───────────────────────

function AmountCell({ value, disabled, onCommit }: { value: string; disabled: boolean; onCommit: (v: string) => void }) {
  const [draft, setDraft] = React.useState('')
  React.useEffect(() => {
    const n = parseFloat(value)
    setDraft(Number.isFinite(n) && n === 0 ? '' : value)
  }, [value])
  return (
    <TextField
      variant="standard" fullWidth
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft === '' ? '0' : draft)}
      disabled={disabled}
      InputProps={{ disableUnderline: true }}
      inputProps={{ inputMode: 'decimal', style: { padding: 0, fontSize: 13, textAlign: 'right' } }}
    />
  )
}

// ─── Cella nota + scontrini per una riga di categoria ────────────────────────

function ItemNoteCell({
  item, editable, extracting, suggestion, onPatch, onApplySuggestion, onDismissSuggestion,
  onUploadClick, onRemoveReceipt, fileInputRef, onFileSelected,
}: {
  item: ExpenseItemRow
  editable: boolean
  extracting: boolean
  suggestion: { amount: string | null; date: string | null } | null
  onPatch: (patch: Partial<Pick<ExpenseItemRow, 'description' | 'amount' | 'date'>>) => void
  onApplySuggestion: () => void
  onDismissSuggestion: () => void
  onUploadClick: () => void
  onRemoveReceipt: (receiptId: number) => void
  fileInputRef: (el: HTMLInputElement | null) => void
  onFileSelected: (file: File) => void
}) {
  const [description, setDescription] = React.useState(item.description)
  React.useEffect(() => setDescription(item.description), [item.description])

  return (
    <Box>
      <CellInput
        value={description} onChange={setDescription}
        onBlur={() => description !== item.description && onPatch({ description })}
        disabled={!editable}
        placeholder="Note"
      />
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" sx={{ mt: 0.25 }}>
        {item.receipts.map((r) => (
          <Chip
            key={r.id} size="small" sx={{ height: 20, fontSize: 10.5 }}
            icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 13 }} />}
            label={r.file_name || 'Scontrino'}
            onClick={() => r.file_url && window.open(r.file_url, '_blank')}
            onDelete={editable ? () => onRemoveReceipt(r.id) : undefined}
          />
        ))}
        {editable ? (
          <>
            <Tooltip title="Carica scontrino">
              <IconButton size="small" onClick={onUploadClick} disabled={extracting} sx={{ p: 0.25 }}>
                {extracting ? <CircularProgress size={12} /> : <UploadFileOutlinedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            <input
              ref={fileInputRef} type="file" accept="image/*,application/pdf" hidden
              onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) onFileSelected(f) }}
            />
          </>
        ) : null}
      </Stack>
      {suggestion ? (
        <Alert
          severity="info" sx={{ mt: 0.5, py: 0, fontSize: 11 }}
          action={
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={onApplySuggestion} sx={{ fontSize: 10.5, minWidth: 0 }}>Applica</Button>
              <Button size="small" onClick={onDismissSuggestion} sx={{ fontSize: 10.5, minWidth: 0 }}>Ignora</Button>
            </Stack>
          }
        >
          Da scontrino{suggestion.amount ? `: ${suggestion.amount} €` : ''}{suggestion.date ? ` — ${formatItDate(suggestion.date)}` : ''}
        </Alert>
      ) : null}
    </Box>
  )
}
