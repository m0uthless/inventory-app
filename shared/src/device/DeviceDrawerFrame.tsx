/**
 * DeviceDrawerFrame — shell drawer condivisa per l'entità Device.
 *
 * Usata in:
 *  - frontend-auslbo (AuslBoDeviceDrawer, Device.tsx)
 *  - frontend (futuro: gestione device sul portale principale)
 *
 * Gestisce:
 *  - Hero banner blu con icona router, badge status, alert scadenza certificato
 *  - Chip feature (VLAN / WiFi / RIS-PACS) accanto alle tab
 *  - Banner logo produttore sotto l'hero
 *  - Azioni edit / close configurabili
 */

import * as React from 'react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import { DrawerShell, FEATURE_CHIP_SX, HERO_ICON_BTN_SX } from '../ui/DrawerShell'

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type DeviceDrawerFrameDetail = {
  status_name?: string | null
  wifi_detail?: { scad_certificato: string | null } | null
  vlan?: boolean | null
  wifi?: boolean | null
  rispacs?: boolean | null
  manufacturer_logo_url?: string | null
  manufacturer_name?: string | null
}

export interface DeviceDrawerFrameProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  detail?: DeviceDrawerFrameDetail | null
  loading?: boolean
  tabs?: (string | null)[]
  tabValue?: number
  onTabChange?: (value: number) => void
  showEditAction?: boolean
  onEdit?: () => void
  width?: number
  bodySx?: SxProps<Theme>
  children: React.ReactNode
}

// ─── Helper: alert scadenza certificato WiFi ───────────────────────────────────

export function deviceCertExpiryAlert(
  scad: string | null | undefined,
): 'error' | 'warning' | null {
  if (!scad) return null
  const days = Math.ceil((new Date(scad).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'error'
  if (days < 60) return 'warning'
  return null
}

// ─── Helper: tab bar condizionale ─────────────────────────────────────────────

export function getDeviceDrawerTabs(
  hasRispacs: boolean,
  hasWifi: boolean,
): (string | null)[] {
  return ['Dettagli', hasRispacs ? 'RIS/PACS' : null, hasWifi ? 'WiFi' : null]
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DeviceDrawerFrame({
  open,
  onClose,
  title,
  subtitle,
  detail,
  loading,
  tabs,
  tabValue = 0,
  onTabChange,
  showEditAction = false,
  onEdit,
  width = 420,
  bodySx,
  children,
}: DeviceDrawerFrameProps) {
  const certAlert = deviceCertExpiryAlert(detail?.wifi_detail?.scad_certificato)

  const statusSlot = (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Tooltip title="Chiudi">
        <IconButton size="small" onClick={onClose} sx={HERO_ICON_BTN_SX}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {detail?.status_name ? (
        <Box
          sx={{
            bgcolor: 'rgba(93,174,240,0.20)',
            color: '#93C9F8',
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: '0.07em',
            border: '1px solid rgba(147,201,248,0.3)',
            borderRadius: '4px',
            px: 1,
            py: 0.25,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          ● {detail.status_name}
        </Box>
      ) : null}
      {certAlert ? (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            bgcolor:
              certAlert === 'error'
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(245,158,11,0.25)',
            border: `1px solid ${
              certAlert === 'error'
                ? 'rgba(239,68,68,0.5)'
                : 'rgba(245,158,11,0.5)'
            }`,
            borderRadius: 1,
            px: 0.75,
            py: 0.15,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.63rem',
              fontWeight: 700,
              color: certAlert === 'error' ? '#fca5a5' : '#fcd34d',
            }}
          >
            {certAlert === 'error' ? '⚠ Certificato scaduto' : '⚠ Cert. in scadenza'}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  )

  const actions = (
    <>
      {showEditAction ? (
        <Tooltip title="Modifica">
          <IconButton size="small" onClick={onEdit} sx={HERO_ICON_BTN_SX}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title="Chiudi">
        <IconButton size="small" onClick={onClose} sx={HERO_ICON_BTN_SX}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  )

  const extraChips = (
    <>
      {detail?.vlan ? <Chip size="small" label="VLAN" sx={FEATURE_CHIP_SX} /> : null}
      {detail?.wifi ? <Chip size="small" label="WiFi" sx={FEATURE_CHIP_SX} /> : null}
      {detail?.rispacs ? <Chip size="small" label="RIS/PACS" sx={FEATURE_CHIP_SX} /> : null}
    </>
  )

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width={width}
      gradient="blue"
      statusSlot={statusSlot}
      actions={actions}
      icon={<RouterOutlinedIcon sx={{ fontSize: 26, color: 'rgba(255,255,255,0.9)' }} />}
      title={title}
      subtitle={subtitle}
      loading={loading}
      tabs={tabs}
      tabValue={tabValue}
      onTabChange={onTabChange}
      extraChips={extraChips}
      bodySx={bodySx}
    >
      {detail?.manufacturer_logo_url ? (
        <Box
          sx={{
            mx: -2.5,
            mt: -2,
            mb: 0,
            px: 2.5,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            component="img"
            src={detail.manufacturer_logo_url}
            alt={detail.manufacturer_name ?? 'Logo produttore'}
            sx={{
              height: 32,
              maxWidth: 140,
              objectFit: 'contain',
              objectPosition: 'left center',
              display: 'block',
            }}
          />
        </Box>
      ) : null}
      {children}
    </DrawerShell>
  )
}
