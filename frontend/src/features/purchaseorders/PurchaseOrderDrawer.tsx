import * as React from 'react'
import {
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { DocumentSlot, PurchaseOrderDetail } from './types'
import { DOCUMENT_SLOT_LABEL, STATUS_LABEL, formatEuro, formatItDate } from './types'
import { committenteColor } from '../../theme/statusTokens'
import { useStatusTokens } from '../../theme/AppThemeProvider'

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
  deletingDocId: number | null
  onClose: () => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onCopy: (text: string) => void | Promise<void>
  onUploadDocument: (slot: DocumentSlot, file: File) => void
  onDeleteDocument: (docId: number) => void
}

function customerLabel(d: PurchaseOrderDetail | null) {
  const label = d?.customer_name || d?.customer_code || ''
  if (label && d?.is_customer_placeholder) return `${label} (non in anagrafica)`
  return label
}

const DOCUMENT_SLOTS: DocumentSlot[] = ['offer', 'po', 'invoice']

export default function PurchaseOrderDrawer({
  open, detail, detailLoading, selectedId,
  canChange, canDelete, deleteBusy, restoreBusy, uploadingSlot, deletingDocId,
  onClose, onEdit, onDelete, onRestore, onCopy, onUploadDocument, onDeleteDocument,
}: PurchaseOrderDrawerProps) {
  const statusTokens = useStatusTokens()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploadType, setUploadType] = React.useState<DocumentSlot | ''>('')

  // Punto 9: 0..N documenti per slot, ordinati dal più recente (già ordinati
  // così dal backend — vedi PurchaseOrderDocument.Meta.ordering).
  const documentsBySlot = (slot: DocumentSlot) =>
    (detail?.documents ?? []).filter((d) => d.kind === slot)

  const hasAnyDocument = (detail?.documents ?? []).length > 0

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
                  bgcolor: committenteColor(detail.client_name, statusTokens.clientChipPalette).bg,
                  color: committenteColor(detail.client_name, statusTokens.clientChipPalette).color,
                  border: `0.5px solid ${committenteColor(detail.client_name, statusTokens.clientChipPalette).border}`,
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
              onCopy={(v) => void onCopy(v)}
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
              onCopy={(v) => void onCopy(v)}
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
              onCopy={(v) => void onCopy(v)}
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
            <Stack spacing={1.25}>
              {hasAnyDocument ? (
                DOCUMENT_SLOTS.filter((slot) => documentsBySlot(slot).length > 0).map((slot) => (
                  <Stack key={slot} spacing={0.5}>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {DOCUMENT_SLOT_LABEL[slot]}
                    </Typography>
                    <Stack spacing={0.5}>
                      {documentsBySlot(slot).map((doc) => (
                        <Stack
                          key={doc.id}
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          sx={{
                            border: '0.5px solid', borderColor: 'divider', borderRadius: 1,
                            px: 1, py: 0.5, bgcolor: 'background.paper',
                          }}
                        >
                          <InsertDriveFileOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
                          <Stack
                            spacing={0}
                            sx={{ flex: 1, minWidth: 0, cursor: doc.url ? 'pointer' : 'default' }}
                            onClick={() => doc.url && window.open(doc.url, '_blank')}
                          >
                            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.filename || 'documento.pdf'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              {formatItDate(doc.uploaded_at.slice(0, 10))}
                              {doc.uploaded_by_username ? ` · ${doc.uploaded_by_username}` : ''}
                            </Typography>
                          </Stack>
                          {canChange ? (
                            <IconButton
                              size="small"
                              aria-label="Elimina documento"
                              disabled={deletingDocId === doc.id}
                              onClick={() => onDeleteDocument(doc.id)}
                            >
                              {deletingDocId === doc.id ? (
                                <CircularProgress size={14} />
                              ) : (
                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                          ) : null}
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                ))
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
