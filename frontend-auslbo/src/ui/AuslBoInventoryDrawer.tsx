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
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { getInventoryTypeIcon } from '@shared/ui/inventoryTypeIcon'
import { isRecord } from '@shared/utils/guards'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuslBoInventoryDetail = {
  id: number
  name: string
  hostname: string | null
  knumber: string | null
  serial_number: string | null
  local_ip: string | null
  srsa_ip: string | null
  customer_name: string | null
  site_name: string | null
  site_display_name: string | null
  status_label: string | null
  status_key: string | null
  type_label: string | null
  type_key: string | null
  deleted_at: string | null
  manufacturer: string | null
  model: string | null
  warranty_end_date: string | null
  notes: string | null
  tags: string[] | null
  custom_fields: Record<string, unknown> | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface AuslBoInventoryDrawerProps {
  /** ID dell'inventory da caricare. null = drawer chiuso */
  id: number | null
  onClose: () => void
}

export default function AuslBoInventoryDrawer({ id, onClose }: AuslBoInventoryDrawerProps) {
  const open = id !== null
  const [drawerTab, setDrawerTab] = React.useState(0)
  const [detail, setDetail] = React.useState<AuslBoInventoryDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    setDetail(null)
    setError(null)
    setLoading(true)
    setDrawerTab(0)
    api.get<AuslBoInventoryDetail>(`/inventories/${id}/`)
      .then((res) => setDetail(res.data))
      .catch((e) => setError(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const handleClose = () => {
    onClose()
    // reset dopo animazione chiusura
    setTimeout(() => { setDetail(null); setError(null) }, 300)
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 368 } } }}
    >
      <Stack sx={{ height: '100%', overflow: 'hidden' }}>

        {/* ── Hero banner blu AUSL BO ── */}
        <Box sx={{
          background: 'linear-gradient(140deg, #0B3D6B 0%, #1A6BB5 55%, #4A90D9 100%)',
          px: 2.5, pt: 2.25, pb: 2.25, position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

          {/* Row 1: back + status chip + close */}
          <Stack direction="row" alignItems="center" justifyContent="space-between"
            sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
            <Tooltip title="Chiudi">
              <IconButton aria-label="Chiudi" size="small" onClick={handleClose}
                sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Chip
              size="small"
              label={`● ${detail?.status_label ?? '—'}`}
              sx={{ bgcolor: 'rgba(93,174,240,0.20)', color: '#93C9F8', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(147,201,248,0.3)', height: 22 }}
            />
            <Tooltip title="Chiudi">
              <IconButton aria-label="Chiudi" size="small" onClick={handleClose}
                sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Row 2: type icon + titolo */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 1, flexShrink: 0,
                bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                {React.createElement(getInventoryTypeIcon(detail?.type_key), {
                  sx: { fontSize: 26, color: 'rgba(255,255,255,0.9)' },
                })}
              </Box>
              <Typography sx={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
                {detail?.hostname || detail?.name || detail?.knumber || (id ? `#${id}` : '—')}
              </Typography>
            </Stack>
            {detail?.name && detail?.hostname && detail.name !== detail.hostname && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.70)', mt: 0.25 }}>{detail.name}</Typography>
            )}
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
              {[detail?.customer_name, detail?.site_display_name || detail?.site_name].filter(Boolean).join(' · ') || ' '}
            </Typography>
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ height: 2 }} />}

        {/* Tabs */}
        <Tabs value={drawerTab} onChange={(_, v: number) => setDrawerTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, px: 1 }}>
          <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
        </Tabs>

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
              {/* Identificazione */}
              {[detail.name, detail.knumber, detail.serial_number, detail.site_display_name || detail.site_name].some(Boolean) && (
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <FingerprintIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Identificazione
                  </Typography>
                  <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                    {[
                      { label: 'Nome',     value: detail.name,                                  mono: false, copy: false },
                      { label: 'Sede',     value: detail.site_display_name || detail.site_name, mono: false, copy: false },
                      { label: 'K-number', value: detail.knumber,                               mono: true,  copy: true  },
                      { label: 'Seriale',  value: detail.serial_number,                         mono: true,  copy: true  },
                    ].filter((r) => r.value).map((r) => (
                      <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 80 }}>{r.label}</Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: r.mono ? 'monospace' : undefined, fontSize: r.mono ? 12 : undefined }}>
                            {r.value}
                          </Typography>
                          {r.copy && r.value && (
                            <Tooltip title="Copia">
                              <IconButton aria-label="Copia" size="small" onClick={() => copyToClipboard(r.value!)}>
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Rete */}
              {[detail.hostname, detail.local_ip, detail.srsa_ip].some(Boolean) && (
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Rete
                  </Typography>
                  <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                    {[
                      { label: 'Hostname',  value: detail.hostname  },
                      { label: 'IP locale', value: detail.local_ip  },
                      { label: 'IP SRSA',   value: detail.srsa_ip   },
                    ].filter((r) => r.value).map((r) => (
                      <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 80 }}>{r.label}</Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{r.value}</Typography>
                          <Tooltip title="Copia">
                            <IconButton aria-label="Copia" size="small" onClick={() => copyToClipboard(r.value!)}>
                              <ContentCopyIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Hardware */}
              {[detail.manufacturer, detail.model, detail.warranty_end_date,
                ...Object.values(detail.custom_fields ?? {})].some((v) => v != null && v !== '') && (
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <MemoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Hardware
                  </Typography>
                  <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                    {[
                      { label: 'Produttore',    value: detail.manufacturer,      mono: false },
                      { label: 'Modello',       value: detail.model,             mono: false },
                      { label: 'Fine garanzia', value: detail.warranty_end_date, mono: true  },
                    ].filter((r) => r.value).map((r) => (
                      <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 100 }}>{r.label}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: r.mono ? 'monospace' : undefined, fontSize: r.mono ? 12 : undefined }}>{r.value}</Typography>
                      </Stack>
                    ))}
                    {detail.custom_fields && isRecord(detail.custom_fields) &&
                      Object.entries(detail.custom_fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                        <Stack key={k} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 100 }}>{k}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(v)}</Typography>
                        </Stack>
                      ))}
                  </Stack>
                </Box>
              )}

              {/* Note */}
              {detail.notes && (
                <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Note
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes}</Typography>
                </Box>
              )}

              {/* Tags */}
              {detail.tags && detail.tags.length > 0 && (
                <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>Tag</Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={0.5}>
                    {detail.tags.map((t) => <Chip key={t} label={t} size="small" variant="outlined" />)}
                  </Stack>
                </Box>
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
