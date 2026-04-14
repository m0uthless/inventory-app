/**
 * AuslBoContactDrawer — drawer read-only per i contatti del portale AUSL BO.
 * Estratto inline da Contacts.tsx per separare orchestrazione UI da componente drawer.
 */
import { Typography } from '@mui/material'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { ContactReadDetail } from '@shared/crm/crmTypes'

export type AuslBoContactDetail = ContactReadDetail

export interface AuslBoContactDrawerProps {
  open: boolean
  onClose: () => void
  detail: AuslBoContactDetail | null
  selectedId: number | null
  detailLoading: boolean
}

export default function AuslBoContactDrawer({
  open,
  onClose,
  detail,
  selectedId,
  detailLoading,
}: AuslBoContactDrawerProps) {
  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      gradient="blue"
      statusLabel={detail?.is_primary ? '● Primario' : '● Non primario'}
      icon={<ContactsOutlinedIcon sx={{ fontSize: 24, color: 'rgba(255,255,255,0.9)' }} />}
      title={detail?.name || (selectedId ? `Contatto #${selectedId}` : 'Contatto')}
      subtitle={detail?.site_display_name || detail?.site_name || undefined}
      caption={detail?.department || undefined}
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
                { label: 'Sede', value: detail.site_display_name || detail.site_name },
              ]}
            />
          </DrawerSection>
          {detail.notes ? (
            <DrawerSection title="Note" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {detail.notes}
              </Typography>
            </DrawerSection>
          ) : null}
        </>
      ) : <DrawerEmptyState />}
    </DrawerShell>
  )
}
