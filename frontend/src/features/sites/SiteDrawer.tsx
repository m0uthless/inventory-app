import * as React from 'react'
import { Typography } from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'

import LeafletMap from '../../ui/LeafletMap'
import AuditEventsTab from '../../ui/AuditEventsTab'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerAddressSection, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { SiteDetail } from './types'

type Props = {
  open: boolean
  detail: SiteDetail | null
  selectedId: number | null
  detailLoading: boolean
  drawerTab: number
  contactCount: number | null
  invCount: number | null
  contactsTabContent: React.ReactNode
  inventoriesTabContent: React.ReactNode
  onClose: () => void
  onTabChange: (value: number) => void
  onRestore: () => void
  onEdit: () => void
  onDeleteRequest: () => void
  canChange: boolean
  canDelete: boolean
  restoreBusy: boolean
  deleteBusy: boolean
  onCopy: (text: string) => void | Promise<void>
}

function customerLabel(site: SiteDetail | null) {
  return site?.customer_display_name || site?.customer_name || site?.customer_code || ''
}

export default function SiteDrawer(props: Props) {
  const {
    open, detail, selectedId, detailLoading, drawerTab,
    contactCount, invCount, contactsTabContent, inventoriesTabContent,
    onClose, onTabChange, onRestore, onEdit, onDeleteRequest,
    canChange, canDelete, restoreBusy, deleteBusy, onCopy,
  } = props

  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

  const subtitle = detail?.city
    ? `${detail.city}${detail.postal_code ? ` ${detail.postal_code}` : ''}`
    : undefined

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDeleteRequest} onRestore={onRestore}
      title={detail?.display_name || detail?.name || (selectedId ? `Sito #${selectedId}` : 'Sito')}
      subtitle={subtitle}
      loading={detailLoading}
      tabs={['Dettagli', contactCount != null ? `Contatti (${contactCount})` : 'Contatti', invCount != null ? `Inventari (${invCount})` : 'Inventari', 'Attività']}
      tabValue={drawerTab} onTabChange={onTabChange}
    >
      {detailLoading ? <DrawerLoadingState /> : detail ? (
        <>
          {drawerTab === 0 && (
            <>
              <DrawerSection icon={<BusinessOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Identificazione">
                <DrawerFieldList
                  rows={[
                    { label: 'Nome', value: detail.name, copy: true },
                    ...(detail.display_name && detail.display_name !== detail.name ? [{ label: 'Nome visualizzato', value: detail.display_name }] : []),
                    { label: 'Cliente', value: customerLabel(detail) },
                  ]}
                  onCopy={(v) => void onCopy(v)}
                />
              </DrawerSection>
              {siteAddress ? (
                <DrawerAddressSection address={siteAddress} mapSlot={<LeafletMap address={siteAddress} height={320} zoom={15} />} />
              ) : null}
              {detail.notes ? (
                <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes}</Typography>
                </DrawerSection>
              ) : null}
            </>
          )}
          {drawerTab === 1 && contactsTabContent}
          {drawerTab === 2 && inventoriesTabContent}
          {drawerTab === 3 && <AuditEventsTab appLabel="crm" model="site" objectId={detail.id} />}
        </>
      ) : <DrawerEmptyState />}
    </DrawerShell>
  )
}
