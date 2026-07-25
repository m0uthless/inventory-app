import * as React from 'react'
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'

import type { PurchaseOrderStatus } from './types'
import { STATUS_DOCUMENT_LABEL, STATUS_LABEL } from './types'

export type TransitionExtraFields = { purchase_order?: string; invoice_number?: string }

type PurchaseOrderTransitionDialogProps = {
  open: boolean
  direction: 'advance' | 'revert'
  fromStatus: PurchaseOrderStatus
  toStatus: PurchaseOrderStatus
  initialPurchaseOrder?: string
  initialInvoiceNumber?: string
  busy: boolean
  onClose: () => void
  onConfirm: (file: File | null, extra: TransitionExtraFields) => void
}

export default function PurchaseOrderTransitionDialog({
  open,
  direction,
  fromStatus,
  toStatus,
  initialPurchaseOrder,
  initialInvoiceNumber,
  busy,
  onClose,
  onConfirm,
}: PurchaseOrderTransitionDialogProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [poNumber, setPoNumber] = React.useState('')
  const [invoiceNumber, setInvoiceNumber] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (open) {
      setFile(null)
      setPoNumber(initialPurchaseOrder || '')
      setInvoiceNumber(initialInvoiceNumber || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const documentLabel = STATUS_DOCUMENT_LABEL[toStatus]
  const isAdvance = direction === 'advance'
  const askPoNumber = isAdvance && toStatus === 'ricevuto'
  const askInvoiceNumber = isAdvance && toStatus === 'fatturato'

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {isAdvance ? `Segna come "${STATUS_LABEL[toStatus]}"` : `Riporta a "${STATUS_LABEL[toStatus]}"`}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {isAdvance ? (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Da "{STATUS_LABEL[fromStatus]}" a "{STATUS_LABEL[toStatus]}".
              </Typography>

              {askPoNumber ? (
                <TextField
                  size="small"
                  label="Numero PO"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  fullWidth
                />
              ) : null}

              {askInvoiceNumber ? (
                <TextField
                  size="small"
                  label="Numero Fattura"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  fullWidth
                />
              ) : null}

              {documentLabel ? (
                <Stack spacing={0.75}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {documentLabel} (opzionale — puoi caricarlo anche più tardi)
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {file ? (
                      <Chip
                        size="small"
                        icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 14 }} />}
                        label={file.name}
                        onDelete={() => setFile(null)}
                      />
                    ) : null}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UploadFileOutlinedIcon />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {file ? 'Sostituisci PDF' : 'Carica PDF'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.target.value = ''
                        if (f) setFile(f)
                      }}
                    />
                  </Stack>
                </Stack>
              ) : null}
            </>
          ) : (
            <Alert severity="warning" sx={{ fontSize: 13 }}>
              {toStatus === 'inserito'
                ? 'Descrizione e importo torneranno modificabili.'
                : `Lo stato tornerà a "${STATUS_LABEL[toStatus]}".`}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(file, { purchase_order: poNumber, invoice_number: invoiceNumber })}
          disabled={busy}
        >
          {busy ? 'Attendere…' : 'Conferma'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
