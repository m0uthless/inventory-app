import * as React from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'

// ─── Types ────────────────────────────────────────────────────────────────────

type RispacsLink = {
  id: number
  device: number
  rispacs: number
  rispacs_name: string | null
  rispacs_ip: string | null
  rispacs_port: number | null
  rispacs_aetitle: string | null
}

type WifiDetail = {
  id: number
  ip: string | null
  mac_address: string | null
  certificato_url: string | null
  pass_certificato: string | null
  scad_certificato: string | null
}

export type AuslBoDeviceDetail = {
  id: number
  model: string | null
  aetitle: string | null
  serial_number: string | null
  inventario: string | null
  reparto: string | null
  room: string | null
  ip: string | null
  location: string | null
  note: string | null
  site_name: string | null
  site_display_name: string | null
  type_name: string | null
  status_name: string | null
  manufacturer_name: string | null
  manufacturer_logo_url: string | null
  vlan: boolean
  wifi: boolean
  rispacs: boolean
  dose: boolean
  custom_fields: Record<string, unknown> | null
  rispacs_links: RispacsLink[]
  wifi_detail: WifiDetail | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
}

function certExpiryAlert(scad: string | null | undefined): 'error' | 'warning' | null {
  if (!scad) return null
  const days = Math.ceil((new Date(scad).getTime() - Date.now()) / 86400000)
  if (days < 0)  return 'error'
  if (days < 60) return 'warning'
  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        {icon}{title}
      </Typography>
      <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
        {children}
      </Stack>
    </Box>
  )
}

function DetailRow({ label, value, mono = false, copy = false, minW = 90 }: {
  label: string
  value: string | null | undefined
  mono?: boolean
  copy?: boolean
  minW?: number
}) {
  if (!value) return null
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: minW }}>{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 12 : undefined }}>
          {value}
        </Typography>
        {copy && (
          <Tooltip title="Copia">
            <IconButton aria-label="Copia" size="small" onClick={() => copyToClipboard(value)}>
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  )
}

function WifiTab({ wifiDetail }: { wifiDetail: WifiDetail }) {
  const [showPass, setShowPass] = React.useState(false)

  return (
    <SectionCard icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="WiFi">
      <DetailRow label="IP WiFi"     value={wifiDetail.ip}               mono copy />
      <DetailRow label="MAC Address" value={wifiDetail.mac_address}      mono copy />
      <DetailRow label="Scad. cert." value={wifiDetail.scad_certificato} mono />

      {wifiDetail.pass_certificato && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>Password cert.</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12, letterSpacing: showPass ? 'normal' : '0.15em' }}>
              {showPass ? wifiDetail.pass_certificato : '••••••••'}
            </Typography>
            <Tooltip title={showPass ? 'Nascondi' : 'Mostra'}>
              <IconButton size="small" onClick={() => setShowPass((v) => !v)}>
                {showPass
                  ? <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} />
                  : <VisibilityOutlinedIcon    sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            {showPass && (
              <Tooltip title="Copia">
                <IconButton size="small" onClick={() => { void navigator.clipboard.writeText(wifiDetail.pass_certificato!) }}>
                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      )}

      {wifiDetail.certificato_url && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>Certificato</Typography>
          <Typography
            component="a"
            href={wifiDetail.certificato_url}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Scarica .p12
          </Typography>
        </Stack>
      )}
    </SectionCard>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface AuslBoDeviceDrawerProps {
  /** ID del device da caricare. null = drawer chiuso */
  id: number | null
  onClose: () => void
}

export default function AuslBoDeviceDrawer({ id, onClose }: AuslBoDeviceDrawerProps) {
  const open = id !== null
  const [drawerTab, setDrawerTab] = React.useState(0)
  const [detail, setDetail] = React.useState<AuslBoDeviceDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    setDetail(null)
    setError(null)
    setLoading(true)
    setDrawerTab(0)
    api.get<AuslBoDeviceDetail>(`/devices/${id}/`)
      .then((res) => setDetail(res.data))
      .catch((e) => setError(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const handleClose = () => {
    onClose()
    setTimeout(() => { setDetail(null); setError(null) }, 300)
  }

  const hasRispacs = (detail?.rispacs_links?.length ?? 0) > 0
  const hasWifi    = !!detail?.wifi_detail

  const certAlert = certExpiryAlert(detail?.wifi_detail?.scad_certificato)

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      <Stack sx={{ height: '100%', overflow: 'hidden' }}>

        {/* ── Hero banner blu AUSL BO ── */}
        <Box sx={{
          background: 'linear-gradient(140deg, #0B3D6B 0%, #1A6BB5 55%, #4A90D9 100%)',
          px: 2.5, pt: 2.25, pb: 2.25, position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

          {/* Row 1: close buttons */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
            <Tooltip title="Chiudi">
              <IconButton size="small" onClick={handleClose}
                sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Chiudi">
              <IconButton size="small" onClick={handleClose}
                sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Row 2: icona + titolo + badge */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 1, flexShrink: 0, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RouterOutlinedIcon sx={{ fontSize: 26, color: 'rgba(255,255,255,0.9)' }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {detail?.model || detail?.type_name || (id ? `Device #${id}` : '—')}
                </Typography>
                {detail?.status_name && (
                  <Chip size="small" label={`● ${detail.status_name}`}
                    sx={{ mt: 0.4, bgcolor: 'rgba(93,174,240,0.20)', color: '#93C9F8', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(147,201,248,0.3)', height: 20 }} />
                )}
                {certAlert && (() => {
                  const isErr = certAlert === 'error'
                  return (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', mt: 0.4,
                      bgcolor: isErr ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
                      border: `1px solid ${isErr ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`,
                      borderRadius: 1, px: 0.75, py: 0.15 }}>
                      <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: isErr ? '#fca5a5' : '#fcd34d' }}>
                        {isErr ? '⚠ Certificato scaduto' : '⚠ Cert. in scadenza'}
                      </Typography>
                    </Box>
                  )
                })()}
              </Box>
            </Stack>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
              {detail?.site_display_name || detail?.site_name || ' '}
            </Typography>
          </Box>

          {/* Row 3: chip features (sx) + tabs (dx) */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 1, position: 'relative', zIndex: 2 }}>
            <Stack direction="row" spacing={0.5}>
              {detail?.vlan    && <Chip size="small" label="VLAN"     sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', '& .MuiChip-label': { px: 0.6 } }} />}
              {detail?.wifi    && <Chip size="small" label="WiFi"     sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', '& .MuiChip-label': { px: 0.6 } }} />}
              {detail?.rispacs && <Chip size="small" label="RIS/PACS" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', '& .MuiChip-label': { px: 0.6 } }} />}
            </Stack>
            <Tabs
              value={drawerTab}
              onChange={(_, v: number) => setDrawerTab(v)}
              sx={{
                minHeight: 0,
                '& .MuiTabs-indicator': { bgcolor: 'rgba(255,255,255,0.9)', height: 2, borderRadius: 1 },
                '& .MuiTab-root': {
                  minHeight: 0, minWidth: 0, px: 1.25, py: 0.5,
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
                  color: 'rgba(255,255,255,0.55)',
                  '&.Mui-selected': { color: '#fff' },
                },
              }}
            >
              <Tab label="Dettagli" />
              {hasRispacs && <Tab label="RIS/PACS" />}
              {hasWifi    && <Tab label="WiFi" />}
            </Tabs>
          </Box>
        </Box>

        {/* Logo produttore */}
        {detail?.manufacturer_logo_url && (
          <Box sx={{ px: 2.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Box
              component="img"
              src={detail.manufacturer_logo_url}
              alt={detail.manufacturer_name ?? 'Logo produttore'}
              sx={{ height: 32, maxWidth: 140, objectFit: 'contain', objectPosition: 'left center', display: 'block' }}
            />
          </Box>
        )}

        {loading && <LinearProgress sx={{ height: 2 }} />}

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
            </Stack>
          )}

          {error && !loading && (
            <Typography variant="body2" color="error">{error}</Typography>
          )}

          {!loading && detail && (
            <>
              {/* TAB 0 — Dettagli */}
              {drawerTab === 0 && (
                <>
                  <SectionCard icon={<FingerprintIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Identificazione">
                    <DetailRow label="AE Title"    value={detail.aetitle}       mono copy />
                    <DetailRow label="Seriale"     value={detail.serial_number} mono copy />
                    <DetailRow label="Inventario"  value={detail.inventario}    mono copy />
                    <DetailRow label="Reparto"     value={detail.reparto} />
                    <DetailRow label="Stanza/Sala" value={detail.room} />
                    <DetailRow label="Posizione"   value={detail.location} />
                    <DetailRow label="Sede"        value={detail.site_display_name || detail.site_name} />
                  </SectionCard>

                  {detail.ip && (
                    <SectionCard icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Rete">
                      <DetailRow label="IP cablato" value={detail.ip} mono copy />
                    </SectionCard>
                  )}

                  {(detail.manufacturer_name || detail.model || detail.type_name) && (
                    <SectionCard icon={<MemoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Hardware">
                      <DetailRow label="Produttore" value={detail.manufacturer_name} />
                      <DetailRow label="Modello"    value={detail.model} />
                      <DetailRow label="Tipo"       value={detail.type_name} />
                    </SectionCard>
                  )}

                  {detail.note && (
                    <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>Note</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.note}</Typography>
                    </Box>
                  )}

                  {detail.custom_fields && Object.entries(detail.custom_fields).filter(([, v]) => v != null && v !== '').length > 0 && (
                    <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>
                        Informazioni aggiuntive
                      </Typography>
                      <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                        {Object.entries(detail.custom_fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                          <Stack key={k} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>{k}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(v)}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </>
              )}

              {/* TAB 1 — RIS/PACS */}
              {drawerTab === 1 && hasRispacs && (
                <Stack spacing={1.5}>
                  {detail.rispacs_links.length === 0 && (
                    <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', py: 1 }}>
                      Nessun sistema RIS/PACS collegato.
                    </Typography>
                  )}
                  {detail.rispacs_links.map((link) => (
                    <SectionCard
                      key={link.id}
                      icon={<MedicalServicesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                      title={link.rispacs_name ?? `RIS/PACS #${link.rispacs}`}
                    >
                      <DetailRow label="IP"       value={link.rispacs_ip}     mono copy />
                      <DetailRow label="Porta"    value={link.rispacs_port != null ? String(link.rispacs_port) : null} mono />
                      <DetailRow label="AE Title" value={link.rispacs_aetitle} mono copy />
                    </SectionCard>
                  ))}
                </Stack>
              )}

              {/* TAB WiFi */}
              {((drawerTab === 1 && !hasRispacs) || (drawerTab === 2 && hasRispacs)) && hasWifi && detail.wifi_detail && (
                <WifiTab wifiDetail={detail.wifi_detail} />
              )}
            </>
          )}

          {!loading && !detail && !error && (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Nessun dettaglio disponibile.</Typography>
          )}
        </Box>
      </Stack>
    </Drawer>
  )
}
