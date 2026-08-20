/**
 * ImportHistoricalDialog — import massivo di ServiceNow Case storici da CSV
 * (export tipo "sn_customerservice_case"). Flusso in due passi, stesso
 * pattern già usato per l'estrazione OCR degli screenshot:
 * 1) POST /servicenow-cases/import-historical-preview/ → valida e mappa
 *    TUTTE le righe (categoria, Type, priorità, assegnatario, duplicati)
 *    SENZA scrivere nulla, per farsi controllare dall'utente.
 * 2) Conferma esplicita → POST /servicenow-cases/import-historical-commit/
 *    con lo stesso file → crea i case validi. Righe duplicate/in errore
 *    vengono saltate senza bloccare le altre.
 *
 * Nessuna notifica Teams / modal Philips scatta mai per queste righe: sono
 * case storici, il backend non tocca in alcun modo servicenow.notifications.
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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

// ─── Tipi ──────────────────────────────────────────────────────────────────────

type RowOutcome = 'create' | 'duplicate' | 'error'

type HistoricalRow = {
  line: number
  number: string
  account: string
  category: string | null
  case_type_name: string | null
  priority: string | null
  opened_date: string | null
  opened_time: string | null
  short_description: string
  assigned_to_csv: string
  assigned_to_label: string | null
  outcome: RowOutcome
  error: string | null
  warnings: string[]
}

type Summary = { total: number; to_create: number; duplicates: number; errors: number; warnings: number }

type PreviewResponse = { summary: Summary; rows: HistoricalRow[] }
type CommitResponse = { summary: Summary; created: number; rows: HistoricalRow[] }

const CATEGORY_LABEL: Record<string, string> = { philips: 'Philips', biotron: 'Biotron' }

const OUTCOME_CHIP: Record<RowOutcome, { label: string; color: 'success' | 'default' | 'error' }> = {
  create:    { label: 'Da creare', color: 'success' },
  duplicate: { label: 'Duplicato', color: 'default' },
  error:     { label: 'Errore',    color: 'error' },
}

// ─── Componente ───────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  /** Chiamato dopo un import riuscito (anche parziale), per ricaricare la lista. */
  onImported: () => void
}

export default function ImportHistoricalDialog({ open, onClose, onImported }: Props) {
  const toast = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [file, setFile] = React.useState<File | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [committing, setCommitting] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null)
  const [result, setResult] = React.useState<CommitResponse | null>(null)

  const reset = React.useCallback(() => {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = () => {
    if (previewing || committing) return
    reset()
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    setFile(picked)
    setPreview(null)
    setResult(null)
  }

  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<PreviewResponse>('/servicenow-cases/import-historical-preview/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(res.data)
    } catch (err) {
      toast.error(apiErrorToMessage(err))
    } finally {
      setPreviewing(false)
    }
  }

  const handleCommit = async () => {
    if (!file) return
    setCommitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<CommitResponse>('/servicenow-cases/import-historical-commit/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      if (res.data.created > 0) {
        toast.success(`${res.data.created} case importati`)
        onImported()
      } else {
        toast.error('Nessun case importato: controlla il dettaglio delle righe.')
      }
    } catch (err) {
      toast.error(apiErrorToMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  const busy = previewing || committing
  const rowsToShow = result?.rows ?? preview?.rows ?? []
  const summary = result?.summary ?? preview?.summary ?? null

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5,
            bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <HistoryOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Import storico
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Importa ServiceNow Case da un CSV storico — nessuna notifica Teams viene generata
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={busy} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {/* ── Selezione file ── */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
              disabled={busy || Boolean(result)}
            >
              {file ? 'Cambia file' : 'Scegli file CSV'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={handleFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </Typography>
            )}
          </Stack>

          {/* ── Riepilogo ── */}
          {summary && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`${summary.total} righe totali`} />
              <Chip size="small" color="success" icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                    label={result ? `${result.created} creati` : `${summary.to_create} da creare`} />
              <Chip size="small" label={`${summary.duplicates} duplicati (saltati)`} />
              {summary.errors > 0 && (
                <Chip size="small" color="error" label={`${summary.errors} errori`} />
              )}
              {summary.warnings > 0 && (
                <Chip size="small" color="warning" icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
                      label={`${summary.warnings} avvisi`} />
              )}
            </Stack>
          )}

          {result && (
            <Alert severity={result.created > 0 ? 'success' : 'warning'}>
              Import completato: <strong>{result.created}</strong> case creati su {result.summary.total} righe.
              Le righe duplicate o in errore non sono state toccate.
            </Alert>
          )}

          {/* ── Dettaglio righe ── */}
          {rowsToShow.length > 0 && (
            <TableContainer sx={{ maxHeight: 360, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Riga</TableCell>
                    <TableCell>Numero</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Assegnato a</TableCell>
                    <TableCell>Esito</TableCell>
                    <TableCell>Avvisi</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rowsToShow.map((r) => {
                    const chip = OUTCOME_CHIP[r.outcome]
                    return (
                      <TableRow key={r.line} hover>
                        <TableCell sx={{ color: 'text.secondary' }}>{r.line}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.number || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.account || '—'}
                        </TableCell>
                        <TableCell>{r.category ? CATEGORY_LABEL[r.category] ?? r.category : '—'}</TableCell>
                        <TableCell>{r.case_type_name ?? '—'}</TableCell>
                        <TableCell>{r.assigned_to_label ?? (r.assigned_to_csv || '—')}</TableCell>
                        <TableCell>
                          <Tooltip title={r.error || ''} arrow disableHoverListener={!r.error}>
                            <Chip size="small" color={chip.color} label={chip.label} sx={{ fontWeight: 600 }} />
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {r.warnings.length > 0 && (
                            <Tooltip
                              arrow
                              title={
                                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                  {r.warnings.map((w, i) => (
                                    <li key={i}>
                                      <Typography variant="caption" sx={{ display: 'block' }}>{w}</Typography>
                                    </li>
                                  ))}
                                </Box>
                              }
                            >
                              <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                icon={<WarningAmberRoundedIcon sx={{ fontSize: 14 }} />}
                                label={r.warnings.length > 1 ? `${r.warnings.length} avvisi` : '1 avviso'}
                                sx={{ cursor: 'help', fontWeight: 600 }}
                              />
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button size="small" onClick={handleClose} disabled={busy}>
          {result ? 'Chiudi' : 'Annulla'}
        </Button>
        {!result && !preview && (
          <Button
            size="small"
            variant="contained"
            disabled={!file || busy}
            startIcon={previewing ? <CircularProgress size={14} /> : undefined}
            onClick={handlePreview}
          >
            {previewing ? 'Analisi in corso…' : 'Analizza CSV'}
          </Button>
        )}
        {preview && !result && (
          <>
            <Button size="small" onClick={reset} disabled={busy}>
              Scegli un altro file
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={busy || preview.summary.to_create === 0}
              startIcon={committing ? <CircularProgress size={14} /> : undefined}
              onClick={handleCommit}
            >
              {committing ? 'Import in corso…' : `Importa ${preview.summary.to_create} case`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
