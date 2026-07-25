import * as React from 'react'
import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { DocumentSlot, PurchaseOrderDetail } from './types'
import { DOCUMENT_SLOT_LABEL, STATUS_LABEL, committenteColor, formatEuro, formatItDate } from './types'

type PurchaseOrderDrawerProps = {
  open: boolean
  detail: PurchaseOrderDetail | null
  detailLoading: boolean
  selectedId: number | null
  canChange: boolean
  canDelete: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  uploadingSlot: DocumentSlot | null
  onClose: () => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onCopied: () => void
  onUploadDocument: (slot: DocumentSlot, file: File) => void
}

function customerLabel(d: PurchaseOrderDetail | null) {
  return d?.customer_name || d?.customer_code || ''
}

const DOCUMENT_SLOTS: DocumentSlot[] = ['offer', 'po', 'invoice']

export default function PurchaseOrderDrawer({
  open, detail, detailLoading, selectedId,
  canChange, canDelete, deleteBusy, restoreBusy, uploadingSlot,
  onClose, onEdit, onDelete, onRestore, onCopied, onUploadDocument,
}: PurchaseOrderDrawerProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploadType, setUploadType] = React.useState<DocumentSlot | ''>('')

  const docInfo = (slot: DocumentSlot): { name?: string | null; url?: string | null } => {
    if (!detail) return {}
    if (slot === 'offer') return { name: detail.offer_document_name, url: detail.offer_document_url }
    if (slot === 'po') return { name: detail.po_document_name, url: detail.po_document_url }
    return { name: detail.invoice_document_name, url: detail.invoice_document_url }
  }

  const hasAnyDocument = DOCUMENT_SLOTS.some((slot) => docInfo(slot).name)

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail ? `● ${STATUS_LABEL[detail.status]}` : undefined}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      title={detail?.description || (selectedId ? `Purchase Order #${selectedId}` : 'Purchase Order')}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : detail ? (
        <>
          <DrawerSection title="Dati commessa">
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 80, flexShrink: 0 }}>Committente</Typography>
              <Chip
                size="small"
                label={detail.client_name}
                sx={{
                  bgcolor: committenteColor(detail.client_name).bg,
                  color: committenteColor(detail.client_name).color,
                  border: `0.5px solid ${committenteColor(detail.client_name).border}`,
                  fontWeight: 600,
                }}
              />
            </Stack>
            <DrawerFieldList
              rows={[
                { label: 'Data offerta', value: formatItDate(detail.offer_date) },
                { label: 'Cliente collegato', value: customerLabel(detail) },
                { label: 'Tipo', value: detail.kind_label },
                { label: 'Purchase Order', value: detail.purchase_order, mono: true, copy: true },
                { label: 'N. Fattura', value: detail.invoice_number, mono: true, copy: true },
              ]}
              onCopy={() => onCopied()}
            />
          </DrawerSection>

          <DrawerSection title="Workflow" variant="muted">
            <DrawerFieldList
              rows={[
                { label: 'Stato', value: STATUS_LABEL[detail.status] },
                { label: 'Inviato il', value: detail.sent_at ? formatItDate(detail.sent_at.slice(0, 10)) : '' },
                { label: 'Ricevuto il', value: detail.received_at ? formatItDate(detail.received_at.slice(0, 10)) : '' },
                { label: 'Fatturato il', value: detail.invoiced_at ? formatItDate(detail.invoiced_at.slice(0, 10)) : '' },
              ]}
              onCopy={() => onCopied()}
            />
          </DrawerSection>

          <DrawerSection title="Importo" variant="muted">
            <DrawerFieldList
              rows={[
                { label: 'Modalità', value: detail.amount_mode_label },
                ...(detail.amount_mode === 'giornate'
                  ? [
                      { label: 'Giornate', value: detail.days ?? '' },
                      { label: 'Tariffa/giorno', value: formatEuro(detail.daily_rate) },
                    ]
                  : []),
                { label: 'Importo', value: formatEuro(detail.amount) },
                { label: 'Costi sostenuti', value: detail.costs_incurred ? formatEuro(detail.costs_incurred) : '—' },
              ]}
              onCopy={() => onCopied()}
            />
          </DrawerSection>

          {detail.notes ? (
            <DrawerSection title="Note" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {detail.notes}
              </Typography>
            </DrawerSection>
          ) : null}

          <DrawerSection title="Allegati">
            <Stack spacing={1}>
              {hasAnyDocument ? (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {DOCUMENT_SLOTS.filter((slot) => docInfo(slot).name).map((slot) => {
                    const { name, url } = docInfo(slot)
                    return (
                      <Chip
                        key={slot}
                        size="small"
                        icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 14 }} />}
                        label={`${DOCUMENT_SLOT_LABEL[slot]}: ${name}`}
                        onClick={() => url && window.open(url, '_blank')}
                      />
                    )
                  })}
                </Stack>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  Nessun allegato caricato
                </Typography>
              )}

              {canChange ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ pt: 0.5 }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Tipo documento</InputLabel>
                    <Select
                      label="Tipo documento"
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value as DocumentSlot | '')}
                    >
                      <MenuItem value="offer">Offerta</MenuItem>
                      <MenuItem value="po">Purchase Order</MenuItem>
                      <MenuItem value="invoice">Fattura</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UploadFileOutlinedIcon />}
                    disabled={!uploadType || uploadingSlot !== null}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingSlot ? 'Caricamento…' : 'Carica PDF'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      e.target.value = ''
                      if (f && uploadType) {
                        onUploadDocument(uploadType, f)
                        setUploadType('')
                      }
                    }}
                  />
                </Stack>
              ) : null}
            </Stack>
          </DrawerSection>
        </>
      ) : <DrawerEmptyState />}
    </DrawerShell>
  )
}
