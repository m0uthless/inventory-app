import * as React from 'react'
import { Box, Chip, Stack, Typography } from '@mui/material'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerAddressSection, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
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
  onCopy?: (text: string) => void | Promise<void>
  sitesTabContent: React.ReactNode
  inventoriesTabContent: React.ReactNode
  driveTabContent: React.ReactNode
  activityTabContent: React.ReactNode
}

export default function CustomerDrawer({
  open, detail, detailLoading, selectedId, drawerTab,
  sitesCount, inventoriesCount, driveCount, address,
  canChange, canDelete, deleteBusy, restoreBusy,
  onClose, onEdit, onDelete, onRestore, onTabChange, onCopy,
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
                <Chip size="small" label={detail.primary_contact_phone} sx={{ bgcolor: 'success.light', color: (theme) => theme.palette.primary.main, border: '1px solid', borderColor: 'success.main', fontWeight: 600, fontSize: 11 }} />
              ) : null}
            </Stack>
          </DrawerSection>

          <DrawerSection icon={<MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Informazioni">
            <DrawerFieldList
              rows={[
                ...(detail.vat_number ? [{ label: 'P.IVA', value: detail.vat_number, mono: true, copy: true }] : []),
                ...(detail.custom_fields && typeof detail.custom_fields === 'object'
                  ? Object.entries(detail.custom_fields)
                      .filter(([k, v]) => v !== '' && v !== null && v !== undefined && k.trim().toLowerCase() !== 'indirizzo')
                      .map(([k, v]) => ({ label: k, value: String(v) }))
                  : []),
              ]}
              onCopy={onCopy ? (v) => void onCopy(v) : undefined}
            />
          </DrawerSection>

          {address ? (
            <DrawerAddressSection address={address} mapSlot={<LeafletMap address={address} height={320} zoom={15} />} />
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

      {detailLoading ? <DrawerLoadingState /> : null}
    </DrawerShell>
  )
}
