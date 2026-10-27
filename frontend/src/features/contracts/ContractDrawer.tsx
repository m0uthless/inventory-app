import * as React from 'react'
import { Box, Button, Chip, CircularProgress, IconButton, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import { formatEuro, formatItDate } from '../purchaseorders/types'
import { EXPIRY_CHIP, type ContractDetail } from './types'

type ContractDrawerProps = {
  open: boolean
  detail: ContractDetail | null
  detailLoading: boolean
  selectedId: number | null
  canChange: boolean
  canDelete: boolean
  canViewValue: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  documentBusy: boolean
  onClose: () => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onRenew: () => void
  onCopy: (text: string) => void | Promise<void>
  onUploadDocument: (file: File) => void
  onDeleteDocument: () => void
}

export default function ContractDrawer({
  open, detail, detailLoading, selectedId,
  canChange, canDelete, canViewValue, deleteBusy, restoreBusy, documentBusy,
  onClose, onEdit, onDelete, onRestore, onRenew, onCopy, onUploadDocument, onDeleteDocument,
}: ContractDrawerProps) {
  const theme = useTheme()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const deleted = !!detail?.deleted_at
  const expiry = detail ? (EXPIRY_CHIP[detail.expiry_state] ?? EXPIRY_CHIP.none) : null

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="blue"
      statusLabel={detail ? `● ${detail.status_label}` : undefined}
      statusLabelSecondary={detail?.auto_renew ? 'Rinnovo automatico' : undefined}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={deleted}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      title={detail?.title || (selectedId ? `Contratto #${selectedId}` : 'Contratto')}
      subtitle={detail ? `${detail.code} · ${detail.customer_name}` : undefined}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : detail ? (
        <>
          <DrawerSection title="Dati contratto">
            <DrawerFieldList
              rows={[
                { label: 'Codice', value: detail.code, mono: true, copy: true },
                { label: 'Cliente', value: detail.customer_name },
                { label: 'Tipo', value: detail.contract_type_label },
                { label: 'Venditore', value: detail.seller_name ?? '' },
                { label: 'Fatturazione', value: detail.billing_freq_label },
                ...(canViewValue && detail.total_value !== undefined
                  ? [{ label: 'Valore totale', value: formatEuro(detail.total_value) }]
                  : []),
              ]}
              onCopy={(v) => void onCopy(v)}
            />
          </DrawerSection>

          <DrawerSection title="Periodo" variant="muted">
            <Stack spacing={1}>
              <DrawerFieldList
                rows={[
                  { label: 'Inizio', value: formatItDate(detail.start_date) },
                  { label: 'Fine', value: formatItDate(detail.end_date) },
                  { label: 'Preavviso', value: `${detail.notice_days} giorni` },
                  { label: 'Disdetta entro', value: formatItDate(detail.notice_deadline) },
                ]}
              />
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                {expiry && detail.expiry_state !== 'none' ? (
                  <Chip size="small" color={expiry.color} label={expiry.label} />
                ) : null}
                <Box sx={{ flex: 1 }} />
                {canChange && !deleted ? (
                  <Button size="small" variant="outlined" startIcon={<AutorenewIcon />} onClick={onRenew}>
                    Rinnova
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </DrawerSection>

          <DrawerSection title="Device collegati">
            {detail.devices_detail.length ? (
              <Stack spacing={0.5}>
                {detail.devices_detail.map((d) => (
                  <Stack
                    key={d.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{
                      border: '0.5px solid', borderColor: 'divider', borderRadius: 1,
                      px: 1, py: 0.5, bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.label}
                    </Typography>
                    {d.serial_number ? (
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', flexShrink: 0 }}>
                        S/N {d.serial_number}
                      </Typography>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                Nessun device collegato
              </Typography>
            )}
          </DrawerSection>

          {detail.notes ? (
            <DrawerSection title="Note" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {detail.notes}
              </Typography>
            </DrawerSection>
          ) : null}

          <DrawerSection title="Documento PDF">
            <Stack spacing={1}>
              {detail.document_url ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    border: '0.5px solid', borderColor: 'divider', borderRadius: 1,
                    px: 1, py: 0.5, bgcolor: 'background.paper',
                  }}
                >
                  <PictureAsPdfOutlinedIcon sx={{ fontSize: 16, color: theme.palette.error.main, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {detail.document_filename || 'contratto.pdf'}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Apri documento"
                    onClick={() => detail.document_url && window.open(detail.document_url, '_blank', 'noopener')}
                  >
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  {canChange && !deleted ? (
                    <IconButton
                      size="small"
                      aria-label="Rimuovi documento"
                      disabled={documentBusy}
                      onClick={onDeleteDocument}
                    >
                      {documentBusy ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  ) : null}
                </Stack>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  Nessun documento caricato
                </Typography>
              )}

              {canChange && !deleted ? (
                <Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UploadFileOutlinedIcon />}
                    disabled={documentBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {documentBusy ? 'Caricamento…' : detail.document_url ? 'Sostituisci PDF' : 'Carica PDF'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      e.target.value = ''
                      if (f) onUploadDocument(f)
                    }}
                  />
                </Box>
              ) : null}
            </Stack>
          </DrawerSection>
        </>
      ) : <DrawerEmptyState />}
    </DrawerShell>
  )
}
