import * as React from 'react'
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerEmptyState } from '@shared/ui/DrawerParts'
import LeafletMap from '../../ui/LeafletMap'
import type { CustomerDetail } from './types'

type CustomerDrawerProps = {
  open: boolean
  detail: CustomerDetail | null
  detailLoading: boolean
  selectedId: number | null
  drawerTab: number
  sitesCount: number | null
  inventoriesCount: number | null
  driveCount: number | null
  address: string | null
  canChange: boolean
  canDelete: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onTabChange: (value: number) => void
  sitesTabContent: React.ReactNode
  inventoriesTabContent: React.ReactNode
  driveTabContent: React.ReactNode
  activityTabContent: React.ReactNode
}

export default function CustomerDrawer({
  open, detail, detailLoading, selectedId, drawerTab,
  sitesCount, inventoriesCount, driveCount, address,
  canChange, canDelete, deleteBusy, restoreBusy,
  onClose, onEdit, onDelete, onRestore, onTabChange,
  sitesTabContent, inventoriesTabContent, driveTabContent, activityTabContent,
}: CustomerDrawerProps) {
  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      title={detail?.display_name || (selectedId ? `Cliente #${selectedId}` : 'Cliente')}
      subtitle={detail?.city || undefined}
      loading={detailLoading}
      tabs={['Dettagli', sitesCount != null ? `Siti (${sitesCount})` : 'Siti', inventoriesCount != null ? `Inventari (${inventoriesCount})` : 'Inventari', driveCount != null ? `Drive (${driveCount})` : 'Drive', 'Attività']}
      tabValue={drawerTab} onTabChange={onTabChange}
    >
      {!detail && !detailLoading ? <DrawerEmptyState /> : null}

      {drawerTab === 0 && detail ? (
        <>
          <DrawerSection icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Contatto primario">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{detail.primary_contact_name || '—'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{detail.primary_contact_email || ''}</Typography>
              </Box>
              {detail.primary_contact_phone ? (
                <Chip size="small" label={detail.primary_contact_phone} sx={{ bgcolor: '#f0fdf4', color: '#0f766e', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: 11 }} />
              ) : null}
            </Stack>
          </DrawerSection>

          <DrawerSection icon={<MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Informazioni">
            <DrawerFieldList rows={[
              ...(detail.vat_number ? [{ label: 'P.IVA', value: detail.vat_number, mono: true }] : []),
              ...(detail.custom_fields && typeof detail.custom_fields === 'object'
                ? Object.entries(detail.custom_fields)
                    .filter(([k, v]) => v !== '' && v !== null && v !== undefined && k.trim().toLowerCase() !== 'indirizzo')
                    .map(([k, v]) => ({ label: k, value: String(v) }))
                : []),
            ]} />
          </DrawerSection>

          {address ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{address}</Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                <LeafletMap address={address} height={320} zoom={15} />
              </Box>
            </Box>
          ) : null}

          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes || '—'}</Typography>
          </DrawerSection>
        </>
      ) : null}

      {drawerTab === 1 ? sitesTabContent : null}
      {drawerTab === 2 ? inventoriesTabContent : null}
      {drawerTab === 3 ? driveTabContent : null}
      {drawerTab === 4 ? activityTabContent : null}

      {detailLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
        </Stack>
      ) : null}
    </DrawerShell>
  )
}
