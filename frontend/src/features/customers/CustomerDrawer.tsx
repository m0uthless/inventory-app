import * as React from 'react'
import { Box, Button, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerAddressSection, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import LeafletMap from '../../ui/LeafletMap'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
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
  devicesCount?: number | null
  contractsCount?: number | null
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
  devicesTabContent?: React.ReactNode
  contractsTabContent?: React.ReactNode
  activityTabContent: React.ReactNode
}

/**
 * Indici LOGICI delle tab (stabili, usati da `drawerTab`/`onTabChange`).
 * Device e Contratti sono condizionali ai permessi: quando nascoste, l'indice
 * logico non cambia (Attività resta 6); la conversione logico ↔ posizione
 * visibile avviene solo qui, verso DrawerShell.
 */
export const CUSTOMER_TAB = {
  details: 0,
  sites: 1,
  inventories: 2,
  drive: 3,
  devices: 4,
  contracts: 5,
  activity: 6,
} as const

const withCount = (label: string, n: number | null | undefined) => (n != null ? `${label} (${n})` : label)

/** Etichette leggibili per le chiavi dei custom field ("cap" → "CAP", "citta" → "Città"). */
const CUSTOM_FIELD_LABELS: Record<string, string> = {
  cap: 'CAP',
  citta: 'Città',
  'città': 'Città',
  city: 'Città',
  provincia: 'Provincia',
  telefono: 'Telefono',
  email: 'Email',
  pec: 'PEC',
}

function humanizeFieldKey(key: string): string {
  const k = key.trim()
  const known = CUSTOM_FIELD_LABELS[k.toLowerCase()]
  if (known) return known
  const spaced = k.replace(/[_-]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export default function CustomerDrawer({
  open, detail, detailLoading, selectedId, drawerTab,
  sitesCount, inventoriesCount, driveCount, devicesCount, contractsCount, address,
  canChange, canDelete, deleteBusy, restoreBusy,
  onClose, onEdit, onDelete, onRestore, onTabChange, onCopy,
  sitesTabContent, inventoriesTabContent, driveTabContent, devicesTabContent, contractsTabContent, activityTabContent,
}: CustomerDrawerProps) {
  const { hasPerm } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const showDevices = hasPerm(PERMS.device.device.view)
  const showContracts = hasPerm(PERMS.contracts.contract.view)

  const visibleTabs = React.useMemo(
    () =>
      [
        { index: CUSTOMER_TAB.details, label: 'Dettagli', visible: true },
        { index: CUSTOMER_TAB.sites, label: withCount('Siti', sitesCount), visible: true },
        { index: CUSTOMER_TAB.inventories, label: withCount('Inventari', inventoriesCount), visible: true },
        { index: CUSTOMER_TAB.drive, label: withCount('Drive', driveCount), visible: true },
        { index: CUSTOMER_TAB.devices, label: withCount('Device', devicesCount), visible: showDevices },
        { index: CUSTOMER_TAB.contracts, label: withCount('Contratti', contractsCount), visible: showContracts },
        { index: CUSTOMER_TAB.activity, label: 'Attività', visible: true },
      ].filter((t) => t.visible),
    [sitesCount, inventoriesCount, driveCount, devicesCount, contractsCount, showDevices, showContracts],
  )
  const visiblePos = Math.max(0, visibleTabs.findIndex((t) => t.index === drawerTab))
  const activeTab = visibleTabs[visiblePos]?.index ?? CUSTOMER_TAB.details
  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      // Lo "stato" del cliente è in realtà il vendor: badge neutro, non semaforico.
      statusLabelSecondary={detail?.status_label || undefined}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      title={detail?.display_name || (selectedId ? `Cliente #${selectedId}` : 'Cliente')}
      subtitle={detail?.city || undefined}
      loading={detailLoading}
      tabs={visibleTabs.map((t) => t.label)}
      tabValue={visiblePos} onTabChange={(pos) => onTabChange(visibleTabs[pos]?.index ?? CUSTOMER_TAB.details)}
    >
      {!detail && !detailLoading ? <DrawerEmptyState /> : null}

      {activeTab === CUSTOMER_TAB.details && detail ? (
        <>
          <DrawerSection icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Contatto primario">
            {detail.primary_contact_name || detail.primary_contact_email || detail.primary_contact_phone ? (
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap" useFlexGap>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{detail.primary_contact_name || '—'}</Typography>
                  {detail.primary_contact_email ? (
                    <Typography
                      component="a"
                      href={`mailto:${detail.primary_contact_email}`}
                      variant="caption"
                      sx={{ color: 'text.secondary', textDecoration: 'underline', textUnderlineOffset: 2, textDecorationColor: 'divider', '&:hover': { color: 'primary.main' } }}
                    >
                      {detail.primary_contact_email}
                    </Typography>
                  ) : null}
                </Box>
                {detail.primary_contact_phone ? (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Button
                      href={`tel:${detail.primary_contact_phone.replace(/\s+/g, '')}`}
                      size="small"
                      variant="outlined"
                      startIcon={<PhoneOutlinedIcon fontSize="small" />}
                      aria-label={`Chiama ${detail.primary_contact_phone}`}
                      sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600, minHeight: { xs: 44, sm: 32 }, textTransform: 'none' }}
                    >
                      {detail.primary_contact_phone}
                    </Button>
                    {onCopy ? (
                      <Tooltip title="Copia numero">
                        <IconButton
                          size="small"
                          aria-label="Copia numero"
                          onClick={() => void onCopy(detail.primary_contact_phone ?? '')}
                          sx={{ width: { xs: 44, sm: 32 }, height: { xs: 44, sm: 32 } }}
                        >
                          <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Nessun contatto primario. Aggiungilo dalla pagina Contatti.
              </Typography>
            )}
          </DrawerSection>

          <DrawerSection icon={<MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Informazioni">
            <DrawerFieldList
              rows={[
                ...(detail.vat_number ? [{ label: 'P.IVA', value: detail.vat_number, mono: true, copy: true }] : []),
                ...(detail.custom_fields && typeof detail.custom_fields === 'object'
                  ? Object.entries(detail.custom_fields)
                      .filter(([k, v]) => v !== '' && v !== null && v !== undefined && k.trim().toLowerCase() !== 'indirizzo')
                      .map(([k, v]) => ({ label: humanizeFieldKey(k), value: String(v) }))
                  : []),
              ]}
              onCopy={onCopy ? (v) => void onCopy(v) : undefined}
            />
          </DrawerSection>

          {address ? (
            <DrawerAddressSection address={address} mapSlot={<LeafletMap address={address} height={isMobile ? 180 : 240} zoom={15} />} />
          ) : null}

          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes || '—'}</Typography>
          </DrawerSection>
        </>
      ) : null}

      {activeTab === CUSTOMER_TAB.sites ? sitesTabContent : null}
      {activeTab === CUSTOMER_TAB.inventories ? inventoriesTabContent : null}
      {activeTab === CUSTOMER_TAB.drive ? driveTabContent : null}
      {activeTab === CUSTOMER_TAB.devices ? devicesTabContent : null}
      {activeTab === CUSTOMER_TAB.contracts ? contractsTabContent : null}
      {activeTab === CUSTOMER_TAB.activity ? activityTabContent : null}

      {detailLoading ? <DrawerLoadingState /> : null}
    </DrawerShell>
  )
}
