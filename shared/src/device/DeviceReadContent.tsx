/**
 * DeviceReadContent — contenuto read-only del drawer Device.
 *
 * Renderizza le tab Dettagli / RIS-PACS / WiFi a partire da un DeviceReadDetail.
 * Nessuna dipendenza auslbo-specifica: riusabile in qualsiasi frontend ARCHIE.
 *
 * Usato in:
 *  - frontend-auslbo (AuslBoDeviceDrawer)
 *  - frontend (futuro)
 */

import * as React from 'react'
import { IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { DrawerSection, DrawerFieldList } from '../ui/DrawerParts'
import type { DeviceReadDetail, WifiDetail } from './deviceTypes'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // noop
  }
}

// ─── WifiTab (interno) ────────────────────────────────────────────────────────

function WifiTab({ wifiDetail }: { wifiDetail: WifiDetail }) {
  const [showPass, setShowPass] = React.useState(false)

  return (
    <DrawerSection
      icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
      title="WiFi"
    >
      <DrawerFieldList
        rows={[
          { label: 'IP WiFi', value: wifiDetail.ip, mono: true, copy: true },
          { label: 'MAC Address', value: wifiDetail.mac_address, mono: true, copy: true },
          { label: 'Scad. cert.', value: wifiDetail.scad_certificato, mono: true },
        ]}
        onCopy={(value) => void copyToClipboard(value)}
      />

      {wifiDetail.pass_certificato ? (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ py: 0.75 }}
        >
          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>
            Password cert.
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontFamily: 'monospace',
                fontSize: 12,
                letterSpacing: showPass ? 'normal' : '0.15em',
              }}
            >
              {showPass ? wifiDetail.pass_certificato : '••••••••'}
            </Typography>
            <Tooltip title={showPass ? 'Nascondi' : 'Mostra'}>
              <IconButton size="small" onClick={() => setShowPass((v) => !v)}>
                {showPass ? (
                  <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} />
                ) : (
                  <VisibilityOutlinedIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
            {showPass ? (
              <Tooltip title="Copia">
                <IconButton
                  size="small"
                  onClick={() => {
                    void navigator.clipboard.writeText(wifiDetail.pass_certificato!)
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </Stack>
      ) : null}

      {wifiDetail.certificato_url ? (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ py: 0.75 }}
        >
          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>
            Certificato
          </Typography>
          <Typography
            component="a"
            href={wifiDetail.certificato_url}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Scarica .p12
          </Typography>
        </Stack>
      ) : null}
    </DrawerSection>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DeviceReadContentProps {
  detail: DeviceReadDetail
  tabValue: number
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DeviceReadContent({ detail, tabValue }: DeviceReadContentProps) {
  const hasRispacs = (detail.rispacs_links?.length ?? 0) > 0
  const hasWifi = !!detail.wifi_detail

  return (
    <>
      {/* ── Tab 0: Dettagli ─────────────────────────────────────────────── */}
      {tabValue === 0 ? (
        <>
          <DrawerSection
            icon={<FingerprintIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
            title="Identificazione"
          >
            <DrawerFieldList
              rows={[
                { label: 'AE Title', value: detail.aetitle, mono: true, copy: true },
                { label: 'Seriale', value: detail.serial_number, mono: true, copy: true },
                { label: 'Inventario', value: detail.inventario, mono: true, copy: true },
                { label: 'Reparto', value: detail.reparto },
                { label: 'Stanza/Sala', value: detail.room },
                { label: 'Posizione', value: detail.location },
                { label: 'Sede', value: detail.site_display_name || detail.site_name },
              ]}
              onCopy={(value) => void copyToClipboard(value)}
            />
          </DrawerSection>

          {detail.ip ? (
            <DrawerSection
              icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
              title="Rete"
            >
              <DrawerFieldList
                rows={[{ label: 'IP cablato', value: detail.ip, mono: true, copy: true }]}
                onCopy={(value) => void copyToClipboard(value)}
              />
            </DrawerSection>
          ) : null}

          {detail.manufacturer_name || detail.model || detail.type_name ? (
            <DrawerSection
              icon={<MemoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
              title="Hardware"
            >
              <DrawerFieldList
                rows={[
                  { label: 'Produttore', value: detail.manufacturer_name },
                  { label: 'Modello', value: detail.model },
                  { label: 'Tipo', value: detail.type_name },
                ]}
              />
            </DrawerSection>
          ) : null}

          {detail.note ? (
            <DrawerSection title="Note" variant="muted">
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
              >
                {detail.note}
              </Typography>
            </DrawerSection>
          ) : null}

          {detail.custom_fields &&
          Object.entries(detail.custom_fields).filter(
            ([, v]) => v != null && v !== '',
          ).length > 0 ? (
            <DrawerSection title="Informazioni aggiuntive" variant="muted">
              <DrawerFieldList
                rows={Object.entries(detail.custom_fields)
                  .filter(([, v]) => v != null && v !== '')
                  .map(([key, v]) => ({ label: key, value: String(v) }))}
              />
            </DrawerSection>
          ) : null}
        </>
      ) : null}

      {/* ── Tab 1: RIS/PACS (solo se presente) ──────────────────────────── */}
      {tabValue === 1 && hasRispacs ? (
        <Stack spacing={1.5}>
          {detail.rispacs_links.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ color: 'text.disabled', fontStyle: 'italic', py: 1 }}
            >
              Nessun sistema RIS/PACS collegato.
            </Typography>
          ) : null}
          {detail.rispacs_links.map((link) => (
            <DrawerSection
              key={link.id}
              icon={
                <MedicalServicesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              }
              title={link.rispacs_name ?? `RIS/PACS #${link.rispacs}`}
            >
              <DrawerFieldList
                rows={[
                  { label: 'IP', value: link.rispacs_ip, mono: true, copy: true },
                  {
                    label: 'Porta',
                    value: link.rispacs_port != null ? String(link.rispacs_port) : null,
                    mono: true,
                  },
                  { label: 'AE Title', value: link.rispacs_aetitle, mono: true, copy: true },
                ]}
                onCopy={(value) => void copyToClipboard(value)}
              />
            </DrawerSection>
          ))}
        </Stack>
      ) : null}

      {/* ── Tab WiFi (indice dinamico: 2 se c'è PACS, 1 altrimenti) ─────── */}
      {((tabValue === 2 && hasRispacs) || (tabValue === 1 && !hasRispacs)) && hasWifi ? (
        detail.wifi_detail ? (
          <WifiTab wifiDetail={detail.wifi_detail} />
        ) : (
          <Typography
            variant="body2"
            sx={{ color: 'text.disabled', fontStyle: 'italic', py: 1 }}
          >
            Nessun dato WiFi ancora configurato.
          </Typography>
        )
      ) : null}
    </>
  )
}
