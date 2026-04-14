import * as React from 'react'
import { Box, Typography } from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'

import { Can } from '../../auth/Can'
import { PERMS } from '../../auth/perms'
import LeafletMap from '../../ui/LeafletMap'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { DrawerShell, HERO_ICON_BTN_SX, HERO_ICON_BTN_DELETE_SX } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
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
    restoreBusy, deleteBusy, onCopy,
  } = props

  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

  const subtitle = detail?.city
    ? `${detail.city}${detail.postal_code ? ` ${detail.postal_code}` : ''}`
    : undefined

  // SiteDrawer usa Can per i permessi — override delle azioni auto
  const actions = (
    <>
      <Can perm={PERMS.crm.site.change}>
        {detail?.deleted_at ? (
          <ActionIconButton label="Ripristina" icon={<RestoreFromTrashIcon fontSize="small" />}
            size="small" onClick={onRestore} disabled={!detail || restoreBusy} sx={HERO_ICON_BTN_SX} />
        ) : (
          <ActionIconButton label="Modifica" icon={<EditIcon fontSize="small" />}
            size="small" onClick={onEdit} disabled={!detail} sx={HERO_ICON_BTN_SX} />
        )}
      </Can>
      <Can perm={PERMS.crm.site.delete}>
        {!detail?.deleted_at ? (
          <ActionIconButton label="Elimina" icon={<DeleteOutlineIcon fontSize="small" />}
            size="small" onClick={onDeleteRequest} disabled={!detail || deleteBusy} sx={HERO_ICON_BTN_DELETE_SX} />
        ) : null}
      </Can>
    </>
  )

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      actions={actions}
      deleted={!!detail?.deleted_at}
      title={detail?.display_name || detail?.name || (selectedId ? `Sito #${selectedId}` : 'Sito')}
      subtitle={subtitle}
      loading={detailLoading}
      tabs={['Dettagli', contactCount != null ? `Contatti (${contactCount})` : 'Contatti', invCount != null ? `Inventari (${invCount})` : 'Inventari']}
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
                <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
                  <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{siteAddress}</Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                    <LeafletMap address={siteAddress} height={320} zoom={15} />
                  </Box>
                </Box>
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
        </>
      ) : <DrawerEmptyState />}
    </DrawerShell>
  )
}
