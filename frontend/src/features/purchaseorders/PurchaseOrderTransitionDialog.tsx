import * as React from 'react'
import { Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material'

import { CampoDialog, CampoIcon } from '../../ui/campo'
import type { PurchaseOrderStatus } from './types'
import { STATUS_DOCUMENT_LABEL, STATUS_LABEL } from './types'

export type TransitionExtraFields = { purchase_order?: string; invoice_number?: string; date?: string }

type Props = {
  open: boolean
  direction: 'advance' | 'revert'
  fromStatus: PurchaseOrderStatus
  toStatus: PurchaseOrderStatus
  /** Riga sotto il titolo: «#77 · descrizione». */
  entryId?: number
  description?: string
  initialPurchaseOrder?: string
  initialInvoiceNumber?: string
  busy: boolean
  onClose: () => void
  onConfirm: (file: File | null, extra: TransitionExtraFields) => void
}

/** Per ogni passo: azione (titolo e pulsante), numero da chiedere ed etichetta della data. */
const STEP: Partial<Record<PurchaseOrderStatus, { label: string; number?: 'purchase_order' | 'invoice_number'; numberLabel?: string; placeholder?: string; dateLabel: string }>> = {
  inviato: { label: 'Segna come inviato', dateLabel: 'Data invio offerta' },
  ricevuto: { label: 'Registra PO ricevuto', number: 'purchase_order', numberLabel: 'Numero Purchase Order', placeholder: 'es. 4500213377', dateLabel: 'Data ricezione' },
  fatturato: { label: 'Registra fattura', number: 'invoice_number', numberLabel: 'Numero fattura', placeholder: 'es. FT 2026/1103', dateLabel: 'Data fattura' },
}

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const mono = { '& input': { fontFamily: '"Geist Mono", monospace' } }

/**
 * Avanzamento o ritorno di stato di un PO (anteprima design-previews/po-base.html): chiede solo ciò che serve
 * a quel passo — numero (PO o fattura), data del passo, PDF facoltativo — e avvisa del blocco dopo l'invio.
 */
export default function PurchaseOrderTransitionDialog({
  open, direction, fromStatus, toStatus, entryId, description, initialPurchaseOrder, initialInvoiceNumber, busy, onClose, onConfirm,
}: Props) {
  const [file, setFile] = React.useState<File | null>(null)
  const [number, setNumber] = React.useState('')
  const [date, setDate] = React.useState(todayIso())
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const isAdvance = direction === 'advance'
  const step = isAdvance ? STEP[toStatus] : undefined

  React.useEffect(() => {
    if (!open) return
    setFile(null)
    setDate(todayIso())
    setNumber(step?.number === 'purchase_order' ? initialPurchaseOrder || '' : step?.number === 'invoice_number' ? initialInvoiceNumber || '' : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, toStatus])

  const title = isAdvance ? step?.label ?? `Segna come ${STATUS_LABEL[toStatus]}` : `Riporta a ${STATUS_LABEL[toStatus]}`
  const documentLabel = STATUS_DOCUMENT_LABEL[toStatus]
  const dateOk = !isAdvance || (Boolean(date) && date <= todayIso())
  const confirm = () => {
    if (!dateOk) return
    onConfirm(file, {
      purchase_order: step?.number === 'purchase_order' ? number.trim() : '',
      invoice_number: step?.number === 'invoice_number' ? number.trim() : '',
      ...(isAdvance ? { date } : {}),
    })
  }

  return (
    <CampoDialog open={open} onClose={onClose} busy={busy} width={460} labelId="po-transition-title" title={title}
      sub={entryId ? `#${entryId}${description ? ` · ${description}` : ''}` : undefined}
      footer={<>
        <Button onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" color={isAdvance ? 'primary' : 'warning'} onClick={confirm} disabled={busy || !dateOk}>{busy ? 'Attendere…' : title}</Button>
      </>}>
      {isAdvance ? (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); confirm() }} sx={{ display: 'grid', gap: 1.75 }}>
          {step?.number ? (
            <TextField size="small" autoFocus label={step.numberLabel} placeholder={step.placeholder} value={number} onChange={(e) => setNumber(e.target.value)}
              helperText="Facoltativo: si può aggiungere anche dopo." sx={mono} />
          ) : null}
          <TextField size="small" type="date" label={step?.dateLabel ?? 'Data'} value={date} onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIso() } }}
            error={!dateOk} helperText={!dateOk ? 'La data non può essere nel futuro.' : undefined} />
          {documentLabel ? (
            <Box>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 0.75 }}>{documentLabel} <Box component="span" sx={{ color: 'text.disabled' }}>· facoltativo</Box></Typography>
              {file ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 8px 6px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                  <CampoIcon name="file" size={16} />
                  <Typography noWrap sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>{file.name}</Typography>
                  <Tooltip title="Togli"><IconButton size="small" aria-label={`Togli ${file.name}`} onClick={() => setFile(null)}><CampoIcon name="x" size={14} /></IconButton></Tooltip>
                </Box>
              ) : (
                <Button size="small" variant="outlined" startIcon={<CampoIcon name="upload" size={15} />} onClick={() => fileInputRef.current?.click()}>Carica PDF</Button>
              )}
              <input ref={fileInputRef} type="file" accept="application/pdf" hidden aria-label={documentLabel}
                onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) setFile(f) }} />
            </Box>
          ) : null}
          {toStatus === 'inviato' ? (
            <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'center', fontSize: 12.5, color: 'text.secondary' }}>
              <CampoIcon name="lock" size={13} />Dopo l'invio descrizione e importo non sono più modificabili.
            </Typography>
          ) : null}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13.5 }}>
          {toStatus === 'inserito' ? 'Descrizione e importo torneranno modificabili.' : `Lo stato torna da «${STATUS_LABEL[fromStatus]}» a «${STATUS_LABEL[toStatus]}».`}
        </Typography>
      )}
    </CampoDialog>
  )
}
