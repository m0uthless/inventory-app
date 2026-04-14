/**
 * AuslBoSiteDrawer — drawer read-only per le sedi del portale AUSL BO.
 * Estratto inline da Sites.tsx per separare orchestrazione UI da componente drawer.
 */
import * as React from 'react'
import { Box, Typography } from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { SiteReadDetail } from '@shared/crm/crmTypes'

export type AuslBoSiteDetail = SiteReadDetail

export interface AuslBoSiteDrawerProps {
  open: boolean
  onClose: () => void
  detail: AuslBoSiteDetail | null
  selectedId: number | null
  detailLoading: boolean
  drawerTab: number
  onTabChange: (value: number) => void
  /** Contenuto tab Contatti (slot iniettato dalla pagina) */
  contactsTabContent: React.ReactNode
  /** Contenuto tab Inventari (slot iniettato dalla pagina) */
  inventoriesTabContent: React.ReactNode
}

export default function AuslBoSiteDrawer({
  open,
  onClose,
  detail,
  selectedId,
  detailLoading,
  drawerTab,
  onTabChange,
  contactsTabContent,
  inventoriesTabContent,
}: AuslBoSiteDrawerProps) {
  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      gradient="blue"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : '● —'}
      icon={<BusinessOutlinedIcon sx={{ fontSize: 24, color: 'rgba(255,255,255,0.9)' }} />}
      title={detail?.display_name || detail?.name || (selectedId ? `Sede #${selectedId}` : 'Sede')}
      subtitle={detail?.city ? `📍 ${detail.city}${detail.postal_code ? ` ${detail.postal_code}` : ''}` : undefined}
      loading={detailLoading}
      tabs={['Dettagli', 'Contatti', 'Inventari']}
      tabValue={drawerTab}
      onTabChange={onTabChange}
    >
      {detailLoading ? <DrawerLoadingState /> : detail ? (
        <>
          {drawerTab === 0 && (
            <>
              <DrawerSection
                icon={<BusinessOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                title="Identificazione"
              >
                <DrawerFieldList
                  rows={[
                    { label: 'Nome', value: detail.name },
                    ...(detail.display_name && detail.display_name !== detail.name
                      ? [{ label: 'Nome visualizzato', value: detail.display_name }]
                      : []),
                    { label: 'Cliente', value: detail.customer_display_name || detail.customer_name },
                  ]}
                />
              </DrawerSection>

              {siteAddress ? (
                <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
                  <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}
                    >
                      <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {siteAddress}
                    </Typography>
                  </Box>
                </Box>
              ) : null}

              {detail.notes ? (
                <DrawerSection
                  icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                  title="Note"
                  variant="muted"
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {detail.notes}
                  </Typography>
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
