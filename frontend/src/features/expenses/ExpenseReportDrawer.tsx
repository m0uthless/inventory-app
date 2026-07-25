/**
 * ExpenseReportDrawer — dettaglio/compilazione di una nota spese.
 *
 * Strategia di sincronizzazione: dopo OGNI mutazione (PATCH voce, upload
 * scontrino, aggiunta/rimozione trasferta km, submit/validate/reject) si
 * ricarica l'intero report con una GET. Più chiamate di quante servirebbero
 * con uno stato locale fine-grained, ma molto più semplice da tenere
 * corretto per un'entità di queste dimensioni (12 righe + sotto-liste).
 */
import * as React from 'react'
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
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import AddIcon from '@mui/icons-material/Add'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'

import { DrawerShell } from '@shared/ui/DrawerShell'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import {
  CATEGORY_ORDER,
  STATUS_LABELS,
  formatEuro,
  formatItDate,
  isReportEditable,
  todayISO,
  type ExpenseItemRow,
  type ExpenseReportRow,
} from './expensesShared'

export interface ExpenseReportDrawerProps {
  open: boolean
  onClose: () => void
  reportId: number | null
  isSecretary: boolean
  currentUserId: number | null
  /** Chiamato dopo submit/validate/reject/delete: la lista in pagina va ricaricata. */
  onChanged: () => void
}

type ExtractResponse = { amount: string | null; date: string | null; warnings: string[] }

export default function ExpenseReportDrawer({
  open, onClose, reportId, isSecretary, currentUserId, onChanged,
}: ExpenseReportDrawerProps) {
  const toast = useToast()

  const [report, setReport] = React.useState<ExpenseReportRow | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState('')

  const load = React.useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const res = await api.get<ExpenseReportRow>(`/expense-reports/${reportId}/`)
      setReport(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [reportId, toast])

  React.useEffect(() => {
    if (open && reportId) void load()
    if (!open) setReport(null)
  }, [open, reportId, load])

  const isOwner = report != null && currentUserId != null && report.user === currentUserId
  const editable = report != null && isOwner && isReportEditable(report) && !isSecretary
  const canSubmit = report != null && isOwner && isReportEditable(report)
  const canValidateReject = report != null && isSecretary && report.status === 'inviata'

  const items = React.useMemo(() => {
    if (!report) return []
    return [...report.items].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    )
  }, [report])

  // ── Note / anticipi (report-level) ────────────────────────────────────────
  const [noteDraft, setNoteDraft] = React.useState('')
  const [advancesDraft, setAdvancesDraft] = React.useState('0')
  React.useEffect(() => {
    if (report) {
      setNoteDraft(report.note)
      setAdvancesDraft(report.advances_total)
    }
  }, [report])

  const saveReportFields = async () => {
    if (!report || !editable) return
    try {
      await api.patch(`/expense-reports/${report.id}/`, {
        note: noteDraft,
        advances_total: advancesDraft || '0',
      })
      await load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  // ── Voci (categoria) ───────────────────────────────────────────────────────
  const patchItem = async (item: ExpenseItemRow, patch: Partial<Pick<ExpenseItemRow, 'description' | 'amount' | 'date'>>) => {
    try {
      await api.patch(`/expense-items/${item.id}/`, patch)
      await load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  // ── Trasferte km ───────────────────────────────────────────────────────────
  const [tripDate, setTripDate] = React.useState(todayISO())
  const [tripDest, setTripDest] = React.useState('')
  const [tripKm, setTripKm] = React.useState('')

  const addTrip = async (itemId: number) => {
    if (!tripDest.trim() || !tripKm) {
      toast.warning('Compila destinazione e km.')
      return
    }
    setBusy(true)
    try {
      await api.post('/expense-km-trips/', {
        item: itemId, date: tripDate, destination: tripDest.trim(), km: Number(tripKm),
      })
      setTripDest('')
      setTripKm('')
      await load()
      toast.success('Trasferta aggiunta.')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const removeTrip = async (tripId: number) => {
    setBusy(true)
    try {
      await api.delete(`/expense-km-trips/${tripId}/`)
      await load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // ── Scontrini + OCR ─────────────────────────────────────────────────────────
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

      // Estrazione OCR (solo immagini): suggerimento separato, non salva nulla.
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
        } catch {
          // L'estrazione è solo un aiuto: se fallisce, l'upload resta comunque valido.
        } finally {
          setExtracting(null)
        }
      }
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
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
    try {
      await api.delete(`/expense-receipts/${receiptId}/`)
      await load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // ── Azioni workflow ──────────────────────────────────────────────────────
  const doSubmit = async () => {
    if (!report) return
    setBusy(true)
    try {
      await api.post(`/expense-reports/${report.id}/submit/`)
      toast.success('Nota spese inviata alla segreteria.')
      await load()
      onChanged()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doValidate = async () => {
    if (!report) return
    setBusy(true)
    try {
      await api.post(`/expense-reports/${report.id}/validate/`)
      toast.success('Nota spese validata.')
      await load()
      onChanged()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doReject = async () => {
    if (!report || !rejectReason.trim()) return
    setBusy(true)
    try {
      await api.post(`/expense-reports/${report.id}/reject/`, { reason: rejectReason.trim() })
      toast.success('Nota spese rifiutata.')
      setRejectOpen(false)
      setRejectReason('')
      await load()
      onChanged()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const exportPdf = () => {
    if (!report) return
    window.open(`/api/expense-reports/${report.id}/export-pdf/`, '_blank')
  }

  if (!report) {
    return (
      <DrawerShell
        open={open} onClose={onClose} gradient="teal" width={520}
        title="Nota spese" loading={loading}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : null}
      </DrawerShell>
    )
  }

  return (
    <>
      <DrawerShell
        open={open}
        onClose={onClose}
        gradient="teal"
        width={560}
        loading={loading || busy}
        statusLabel={STATUS_LABELS[report.status]}
        title={`Nota spese ${report.number}`}
        subtitle={`${report.month_label} ${report.year} · ${report.user_name}`}
        icon={<ReceiptLongOutlinedIcon />}
        actions={
          <Stack direction="row" spacing={0.75}>
            <Tooltip title="Esporta PDF">
              <IconButton size="small" onClick={exportPdf} sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)' }}>
                <DownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      >
        <Stack spacing={2}>
          {report.status === 'rifiutata' && report.rejection_reason ? (
            <Alert severity="warning">Rifiutata: {report.rejection_reason}</Alert>
          ) : null}
          {report.status === 'validata' && report.validated_by_name ? (
            <Alert severity="success">
              Validata da {report.validated_by_name}
              {report.validated_at ? ` il ${formatItDate(report.validated_at.slice(0, 10))}` : ''}
            </Alert>
          ) : null}

          {/* ── Griglia categorie ─────────────────────────────────────────── */}
          <Stack spacing={1}>
            {items.map((item) => (
              <ExpenseItemRowView
                key={item.id}
                item={item}
                editable={editable}
                extracting={extracting === item.id}
                suggestion={suggestion?.itemId === item.id ? suggestion : null}
                tripDate={tripDate} tripDest={tripDest} tripKm={tripKm}
                onTripDateChange={setTripDate} onTripDestChange={setTripDest} onTripKmChange={setTripKm}
                onAddTrip={() => addTrip(item.id)}
                onRemoveTrip={removeTrip}
                onPatch={(patch) => patchItem(item, patch)}
                onApplySuggestion={() => applySuggestion(item)}
                onDismissSuggestion={() => setSuggestion(null)}
                onUploadClick={() => fileInputsRef.current[item.id]?.click()}
                onRemoveReceipt={removeReceipt}
                fileInputRef={(el) => { fileInputsRef.current[item.id] = el }}
                onFileSelected={(f) => uploadReceipt(item, f)}
              />
            ))}
          </Stack>

          <Divider />

          {/* ── Totali / anticipi / note ─────────────────────────────────── */}
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Totale spese</Typography>
              <Typography variant="body2" fontWeight={700}>{formatEuro(report.total_expenses)}</Typography>
            </Stack>
            <TextField
              label="Totale anticipi ricevuti"
              size="small"
              value={advancesDraft}
              onChange={(e) => setAdvancesDraft(e.target.value)}
              onBlur={saveReportFields}
              disabled={!editable}
              inputProps={{ inputMode: 'decimal' }}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle2">Totale da rendere</Typography>
              <Typography variant="subtitle1" fontWeight={800}>{formatEuro(report.total_due)}</Typography>
            </Stack>
            <TextField
              label="Note"
              size="small"
              multiline
              minRows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveReportFields}
              disabled={!editable}
            />
          </Stack>

          {/* ── Azioni workflow ──────────────────────────────────────────── */}
          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            {canSubmit ? (
              <Button
                variant="contained" size="small" startIcon={<SendOutlinedIcon />}
                onClick={doSubmit} disabled={busy}
              >
                Invia alla segreteria
              </Button>
            ) : null}
            {canValidateReject ? (
              <>
                <Button
                  variant="contained" color="success" size="small" startIcon={<CheckCircleOutlineIcon />}
                  onClick={doValidate} disabled={busy}
                >
                  Valida
                </Button>
                <Button
                  variant="outlined" color="error" size="small" startIcon={<CancelOutlinedIcon />}
                  onClick={() => setRejectOpen(true)} disabled={busy}
                >
                  Rifiuta
                </Button>
              </>
            ) : null}
          </Stack>
        </Stack>
      </DrawerShell>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Motivo del rifiuto</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            placeholder="Es. manca lo scontrino del pernottamento…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Annulla</Button>
          <Button variant="contained" color="error" disabled={!rejectReason.trim() || busy} onClick={doReject}>
            Rifiuta nota spese
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// ─── Riga categoria (con eventuale sotto-tabella trasferte km) ────────────────

function ExpenseItemRowView({
  item, editable, extracting, suggestion,
  tripDate, tripDest, tripKm, onTripDateChange, onTripDestChange, onTripKmChange, onAddTrip, onRemoveTrip,
  onPatch, onApplySuggestion, onDismissSuggestion,
  onUploadClick, onRemoveReceipt, fileInputRef, onFileSelected,
}: {
  item: ExpenseItemRow
  editable: boolean
  extracting: boolean
  suggestion: { amount: string | null; date: string | null } | null
  tripDate: string; tripDest: string; tripKm: string
  onTripDateChange: (v: string) => void; onTripDestChange: (v: string) => void; onTripKmChange: (v: string) => void
  onAddTrip: () => void
  onRemoveTrip: (tripId: number) => void
  onPatch: (patch: Partial<Pick<ExpenseItemRow, 'description' | 'amount' | 'date'>>) => void
  onApplySuggestion: () => void
  onDismissSuggestion: () => void
  onUploadClick: () => void
  onRemoveReceipt: (receiptId: number) => void
  fileInputRef: (el: HTMLInputElement | null) => void
  onFileSelected: (file: File) => void
}) {
  const [description, setDescription] = React.useState(item.description)
  const [amount, setAmount] = React.useState(item.amount)
  React.useEffect(() => { setDescription(item.description) }, [item.description])
  React.useEffect(() => { setAmount(item.amount) }, [item.amount])

  const totalKm = item.km_trips.reduce((sum, t) => sum + t.km, 0)

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block' }}>
            {item.category_label}
          </Typography>
          <TextField
            variant="standard"
            placeholder="Note"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== item.description && onPatch({ description })}
            disabled={!editable}
          />
        </Box>
        <TextField
          variant="standard"
          size="small"
          sx={{ width: 96 }}
          value={item.is_km_category ? formatEuro(item.amount) : amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => !item.is_km_category && amount !== item.amount && onPatch({ amount })}
          disabled={!editable || item.is_km_category}
          inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
        />
      </Stack>

      {/* ── Sotto-tabella trasferte km ──────────────────────────────────── */}
      {item.is_km_category ? (
        <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
          {item.km_trips.map((trip) => (
            <Stack key={trip.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
              <Typography variant="caption" sx={{ width: 70 }}>{formatItDate(trip.date)}</Typography>
              <Typography variant="caption" sx={{ flex: 1 }}>{trip.destination}</Typography>
              <Typography variant="caption" sx={{ width: 50, textAlign: 'right' }}>{trip.km} km</Typography>
              {editable ? (
                <IconButton size="small" onClick={() => onRemoveTrip(trip.id)}>
                  <DeleteOutlineIcon fontSize="inherit" />
                </IconButton>
              ) : null}
            </Stack>
          ))}
          {item.km_trips.length > 0 ? (
            <Typography variant="caption" color="text.secondary">Totale: {totalKm} km</Typography>
          ) : null}
          {editable ? (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
              <TextField
                type="date" size="small" variant="standard" sx={{ width: 110 }}
                value={tripDate} onChange={(e) => onTripDateChange(e.target.value)}
              />
              <TextField
                size="small" variant="standard" placeholder="Destinazione" sx={{ flex: 1 }}
                value={tripDest} onChange={(e) => onTripDestChange(e.target.value)}
              />
              <TextField
                size="small" variant="standard" placeholder="Km" sx={{ width: 60 }}
                value={tripKm} onChange={(e) => onTripKmChange(e.target.value)}
                inputProps={{ inputMode: 'numeric' }}
              />
              <IconButton size="small" onClick={onAddTrip}><AddIcon fontSize="small" /></IconButton>
            </Stack>
          ) : null}
        </Box>
      ) : null}

      {/* ── Scontrini ────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.75 }}>
        {item.receipts.map((r) => (
          <Chip
            key={r.id}
            size="small"
            icon={<InsertDriveFileOutlinedIcon fontSize="small" />}
            label={r.file_name || 'Scontrino'}
            onClick={() => r.file_url && window.open(r.file_url, '_blank')}
            onDelete={editable ? () => onRemoveReceipt(r.id) : undefined}
          />
        ))}
        {editable ? (
          <>
            <Button
              size="small" startIcon={extracting ? <CircularProgress size={12} /> : <UploadFileOutlinedIcon fontSize="small" />}
              onClick={onUploadClick} disabled={extracting}
            >
              Scontrino
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                if (f) onFileSelected(f)
              }}
            />
          </>
        ) : null}
      </Stack>

      {suggestion ? (
        <Alert
          severity="info" sx={{ mt: 0.75, py: 0 }}
          action={
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={onApplySuggestion}>Applica</Button>
              <Button size="small" onClick={onDismissSuggestion}>Ignora</Button>
            </Stack>
          }
        >
          Letto dallo scontrino{suggestion.amount ? ` — importo ${suggestion.amount} €` : ''}
          {suggestion.date ? ` — data ${formatItDate(suggestion.date)}` : ''}. Controlla prima di applicare.
        </Alert>
      ) : null}
    </Box>
  )
}
