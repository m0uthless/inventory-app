import { Typography } from '@mui/material'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { ContactDetail } from './types'

type ContactDrawerProps = {
  open: boolean
  detail: ContactDetail | null
  detailLoading: boolean
  selectedId: number | null
  canChange: boolean
  canDelete: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  onClose: () => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onCopied: () => void
}

function customerLabel(d: ContactDetail | null) {
  return d?.customer_display_name || d?.customer_name || d?.customer_code || ''
}
function siteLabel(d: ContactDetail | null) {
  return d?.site_display_name || d?.site_name || ''
}

export default function ContactDrawer({
  open, detail, detailLoading, selectedId,
  canChange, canDelete, deleteBusy, restoreBusy,
  onClose, onEdit, onDelete, onRestore, onCopied,
}: ContactDrawerProps) {
  const subtitle = [customerLabel(detail), siteLabel(detail)].filter(Boolean).join(' · ') || undefined

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.is_primary ? '● Primario' : '● Non primario'}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      title={detail?.name || (selectedId ? `Contatto #${selectedId}` : 'Contatto')}
      subtitle={subtitle} caption={detail?.department || undefined}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : detail ? (
        <>
          <DrawerSection title="Dati contatto">
            <DrawerFieldList
              rows={[
                { label: 'Nome', value: detail.name },
                { label: 'Email', value: detail.email, mono: true, copy: true },
                { label: 'Telefono', value: detail.phone, mono: true, copy: true },
                { label: 'Reparto', value: detail.department },
                { label: 'Cliente', value: customerLabel(detail) },
                { label: 'Sito', value: siteLabel(detail) },
              ]}
              onCopy={() => onCopied()}
            />
          </DrawerSection>
          {detail.notes ? (
            <DrawerSection title="Note" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes}</Typography>
            </DrawerSection>
          ) : null}
        </>
      ) : <DrawerEmptyState />}
    </DrawerShell>
  )
}
