import * as React from 'react'
import {
  Box,
  Button,
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
import { useLocation, useNavigate } from 'react-router-dom'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import CloseIcon from '@mui/icons-material/Close'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import { buildQuery } from '../../utils/nav'
import { getInventoryTypeIcon } from '../../ui/inventoryTypeIcon'
import AuditEventsTab from '../../ui/AuditEventsTab'
import { isRecord } from '../../utils/guards'
import { useToast } from '../../ui/toast'
import { ActionIconButton } from '../../ui/ActionIconButton'

import type { InventoryDetail } from './types'

type InventoryDrawerProps = {
  open: boolean
  detail: InventoryDetail | null
  detailLoading: boolean
  selectedId: number | null
  canViewSecrets: boolean
  canChange: boolean
  canDelete: boolean
  drawerTab: number
  deleteBusy: boolean
  restoreBusy: boolean
  onClose: () => void
  onTabChange: (value: number) => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
}

async function copyToClipboard(text: string) {
  if (!text) return
  await navigator.clipboard.writeText(text)
}

function KNumberPlate(props: { knumber: string; digits?: number }) {
  const { knumber, digits = 9 } = props
  const clean = (knumber ?? '').replace(/\D/g, '')
  const padded = clean.slice(-digits).padStart(digits, '0')
  const blue = '#1e56ff'
  const strokeW = 6
  const leftPad = 22
  const topPad = 18
  const gap = 10
  const boxW = 74
  const boxH = 74
  const rowW = digits * boxW + (digits - 1) * gap
  const frameW = leftPad * 2 + rowW
  const brandGap = 34
  const brandSize = 36
  const boxesAreaH = topPad + boxH + 18
  const brandY = boxesAreaH + brandGap
  const frameH = brandY + 28

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${frameW} ${frameH}`}
      role="img"
      aria-label={`K-Number ${padded}`}
      style={{ display: 'block', maxWidth: 980 }}
    >
      <rect
        x={strokeW / 2}
        y={strokeW / 2}
        width={frameW - strokeW}
        height={boxesAreaH - strokeW}
        rx="6"
        fill="white"
        stroke={blue}
        strokeWidth={strokeW}
      />
      {Array.from({ length: digits }).map((_, i) => {
        const x = leftPad + i * (boxW + gap)
        const digit = padded[i] ?? ' '
        return (
          <g key={i}>
            <rect
              x={x}
              y={topPad}
              width={boxW}
              height={boxH}
              fill="white"
              stroke="black"
              strokeWidth="4"
            />
            <text
              x={x + boxW / 2}
              y={topPad + boxH / 2 + 18}
              textAnchor="middle"
              fontSize="52"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight="800"
              fill="black"
            >
              {digit}
            </text>
          </g>
        )
      })}
      <text
        x={leftPad}
        y={brandY}
        fontSize={brandSize}
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fill={blue}
      >
        PHILIPS
      </text>
    </svg>
  )
}

function SecretRow(props: { label: string; value?: string | null; onCopy?: () => void }) {
  const { label, value, onCopy } = props
  const [show, setShow] = React.useState(false)
  const v = value ?? ''
  const timerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!show) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }
    if (v) {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setShow(false), 30_000)
    }
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [show, v])

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 120, opacity: 0.7 }}>
        <Typography variant="body2">{label}</Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            wordBreak: 'break-word',
          }}
        >
          {v ? (show ? v : '•'.repeat(Math.min(v.length, 12))) : '—'}
        </Typography>
      </Box>
      {v ? (
        <Stack direction="row" spacing={0.5}>
          <ActionIconButton
            label={show ? 'Nascondi' : 'Mostra (30s)'}
            size="small"
            onClick={() => setShow((s) => !s)}
          >
            {show ? (
              <VisibilityOffIcon fontSize="inherit" />
            ) : (
              <VisibilityIcon fontSize="inherit" />
            )}
          </ActionIconButton>
          <ActionIconButton label="Copia" size="small" onClick={onCopy} disabled={!onCopy}>
            <ContentCopyIcon fontSize="inherit" />
          </ActionIconButton>
        </Stack>
      ) : (
        <Box sx={{ width: 68 }} />
      )}
    </Stack>
  )
}


function InventoryTypeBadgeIcon(props: { typeKey?: string | null }) {
  const Icon = getInventoryTypeIcon(props.typeKey)
  return <Icon sx={{ fontSize: 26, color: 'rgba(255,255,255,0.9)' }} />
}

export default function InventoryDrawer({
  open,
  detail,
  detailLoading,
  selectedId,
  canViewSecrets,
  canChange,
  canDelete,
  drawerTab,
  deleteBusy,
  restoreBusy,
  onClose,
  onTabChange,
  onEdit,
  onDelete,
  onRestore,
}: InventoryDrawerProps) {
  const navigate = useNavigate()
  const loc = useLocation()
  const toast = useToast()

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}>
      <Stack sx={{ height: '100%', overflow: 'hidden' }}>
        <Box
          sx={{
            background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
            px: 2.5,
            pt: 2.25,
            pb: 2.25,
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -44,
              right: -44,
              width: 130,
              height: 130,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -26,
              left: 52,
              width: 90,
              height: 90,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
            <Chip
              size="small"
              label={`● ${detail?.status_label ?? '—'}`}
              sx={{
                bgcolor: 'rgba(20,255,180,0.18)',
                color: '#a7f3d0',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.07em',
                border: '1px solid rgba(167,243,208,0.3)',
                height: 22,
              }}
            />
            <Stack direction="row" spacing={0.75}>
              {canChange ? (
                detail?.deleted_at ? (
                  <ActionIconButton
                    label="Ripristina"
                    size="small"
                    onClick={onRestore}
                    disabled={!detail || restoreBusy}
                    sx={{
                      color: 'rgba(255,255,255,0.85)',
                      bgcolor: 'rgba(255,255,255,0.12)',
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  >
                    <RestoreFromTrashIcon fontSize="small" />
                  </ActionIconButton>
                ) : (
                  <ActionIconButton
                    label="Modifica"
                    size="small"
                    onClick={onEdit}
                    disabled={!detail}
                    sx={{
                      color: 'rgba(255,255,255,0.85)',
                      bgcolor: 'rgba(255,255,255,0.12)',
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </ActionIconButton>
                )
              ) : null}
              {canDelete && !detail?.deleted_at ? (
                <ActionIconButton
                  label="Elimina"
                  size="small"
                  onClick={onDelete}
                  disabled={!detail || deleteBusy}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </ActionIconButton>
              ) : null}
              <ActionIconButton
                label="Chiudi"
                size="small"
                onClick={onClose}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                }}
              >
                <CloseIcon fontSize="small" />
              </ActionIconButton>
            </Stack>
          </Stack>

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {detail?.deleted_at ? <Chip size="small" color="error" label="Eliminato" sx={{ mb: 0.75, height: 20, fontSize: 10 }} /> : null}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  flexShrink: 0,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <InventoryTypeBadgeIcon typeKey={detail?.type_key} />
              </Box>
              <Typography sx={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
                {detail?.hostname || detail?.name || detail?.knumber || (selectedId ? `Inventario #${selectedId}` : 'Inventario')}
              </Typography>
            </Stack>
            {detail?.name && detail?.hostname && detail.name !== detail.hostname ? (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.70)', mt: 0.25 }}>
                {detail.name}
              </Typography>
            ) : null}
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
              {[detail?.customer_name, detail?.site_display_name || detail?.site_name].filter(Boolean).join(' · ') || ' '}
            </Typography>
            {detail?.type_label ? (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mt: 0.25 }}>
                {detail.type_label}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {detailLoading ? <LinearProgress sx={{ height: 2 }} /> : null}

        <Tabs value={drawerTab} onChange={(_, value) => onTabChange(value)} sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, px: 1 }}>
          <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
          <Tab label="Attività" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
        </Tabs>

        {drawerTab === 0 ? (
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {detailLoading ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Caricamento…
                </Typography>
              </Stack>
            ) : detail ? (
              <>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      navigate(
                        `/customers${buildQuery({ open: detail.customer, return: loc.pathname + loc.search })}`,
                      )
                    }
                  >
                    Apri cliente
                  </Button>
                  {detail.site ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        navigate(
                          `/sites${buildQuery({
                            customer: detail.customer,
                            open: detail.site,
                            return: loc.pathname + loc.search,
                          })}`,
                        )
                      }
                    >
                      Apri sito
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer, site: detail.site ?? '' })}`)}
                  >
                    Lista filtrata
                  </Button>
                </Stack>

                {detail.has_active_issue ? (
                  <Box sx={{ bgcolor: 'rgba(239, 68, 68, 0.10)', border: '1px solid', borderColor: 'rgba(239, 68, 68, 0.28)', borderRadius: 2, p: 1.75 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <WarningAmberRoundedIcon sx={{ color: 'error.main', mt: '2px' }} />
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: 'error.main', lineHeight: 1.2 }}>
                          Attenzione! C'è una issue collegata al sistema attualmente aperta.
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ) : null}

                {detail.knumber ? (
                  <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                      K-Number
                    </Typography>
                    <KNumberPlate knumber={detail.knumber} digits={9} />
                  </Box>
                ) : null}

                {[detail.name, detail.knumber, detail.serial_number, detail.site_display_name || detail.site_name].some(Boolean) ? (
                  <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <FingerprintIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Identificazione
                    </Typography>
                    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                      {[
                        { label: 'Nome', value: detail.name, mono: false, copy: true },
                        { label: 'Sito', value: detail.site_display_name || detail.site_name, mono: false, copy: false },
                        { label: 'K-number', value: detail.knumber, mono: true, copy: true },
                        { label: 'Seriale', value: detail.serial_number, mono: true, copy: true },
                      ]
                        .filter((row): row is typeof row & { value: string } => Boolean(row.value))
                        .map((row) => (
                          <Stack key={row.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 80 }}>
                              {row.label}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: row.mono ? 'monospace' : undefined, fontSize: row.mono ? 12 : undefined }}>
                                {row.value}
                              </Typography>
                              {row.copy && row.value ? (
                                <Tooltip title="Copia">
                                  <IconButton
                                    aria-label="Copia"
                                    size="small"
                                    onClick={async () => {
                                      await copyToClipboard(row.value)
                                      toast.success('Copiato ✅')
                                    }}
                                  >
                                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </Stack>
                          </Stack>
                        ))}
                    </Stack>
                  </Box>
                ) : null}

                {[detail.hostname, detail.local_ip, detail.srsa_ip].some(Boolean) ? (
                  <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Rete
                    </Typography>
                    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                      {[
                        { label: 'Hostname', value: detail.hostname },
                        { label: 'IP locale', value: detail.local_ip },
                        { label: 'IP SRSA', value: detail.srsa_ip },
                      ]
                        .filter((row): row is typeof row & { value: string } => Boolean(row.value))
                        .map((row) => (
                          <Stack key={row.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 80 }}>
                              {row.label}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                                {row.value}
                              </Typography>
                              <Tooltip title="Copia">
                                <IconButton
                                  aria-label="Copia"
                                  size="small"
                                  onClick={async () => {
                                    await copyToClipboard(row.value)
                                    toast.success('Copiato ✅')
                                  }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        ))}
                    </Stack>
                  </Box>
                ) : null}

                {(canViewSecrets ? [detail.os_user, detail.os_pwd, detail.app_usr, detail.app_pwd, detail.vnc_pwd] : [detail.os_user, detail.app_usr]).some(Boolean) ? (
                  <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <LockOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Credenziali
                    </Typography>
                    {!canViewSecrets ? (
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', mb: 0.5 }}>
                        Password non visibili (permessi insufficienti)
                      </Typography>
                    ) : null}
                    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                      {detail.os_user ? (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 100 }}>
                            Utente OS
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                              {detail.os_user}
                            </Typography>
                            <Tooltip title="Copia">
                              <IconButton
                                aria-label="Copia"
                                size="small"
                                onClick={async () => {
                                  if (!detail.os_user) return
                                  await copyToClipboard(detail.os_user)
                                  toast.success('Copiato ✅')
                                }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      ) : null}
                      {canViewSecrets && detail.os_pwd ? (
                        <Box sx={{ py: 0.75 }}>
                          <SecretRow
                            label="Password OS"
                            value={detail.os_pwd}
                            onCopy={async () => {
                              if (!detail.os_pwd) return
                              await copyToClipboard(detail.os_pwd)
                              toast.success('Copiato ✅')
                            }}
                          />
                        </Box>
                      ) : null}
                      {detail.app_usr ? (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 100 }}>
                            Utente App
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                              {detail.app_usr}
                            </Typography>
                            <Tooltip title="Copia">
                              <IconButton
                                aria-label="Copia"
                                size="small"
                                onClick={async () => {
                                  if (!detail.app_usr) return
                                  await copyToClipboard(detail.app_usr)
                                  toast.success('Copiato ✅')
                                }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      ) : null}
                      {canViewSecrets && detail.app_pwd ? (
                        <Box sx={{ py: 0.75 }}>
                          <SecretRow
                            label="Password App"
                            value={detail.app_pwd}
                            onCopy={async () => {
                              if (!detail.app_pwd) return
                              await copyToClipboard(detail.app_pwd)
                              toast.success('Copiato ✅')
                            }}
                          />
                        </Box>
                      ) : null}
                      {canViewSecrets && detail.vnc_pwd ? (
                        <Box sx={{ py: 0.75 }}>
                          <SecretRow
                            label="Password VNC"
                            value={detail.vnc_pwd}
                            onCopy={async () => {
                              if (!detail.vnc_pwd) return
                              await copyToClipboard(detail.vnc_pwd)
                              toast.success('Copiato ✅')
                            }}
                          />
                        </Box>
                      ) : null}
                    </Stack>
                  </Box>
                ) : null}

                {[detail.manufacturer, detail.model, detail.warranty_end_date, ...Object.values(detail.custom_fields ?? {})].some((value) => value !== '' && value !== null && value !== undefined) ? (
                  <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <MemoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Hardware
                    </Typography>
                    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                      {[
                        { label: 'Produttore', value: detail.manufacturer },
                        { label: 'Modello', value: detail.model },
                        { label: 'Fine garanzia', value: detail.warranty_end_date, mono: true },
                      ]
                        .filter((row): row is typeof row & { value: string } => Boolean(row.value))
                        .map((row) => (
                          <Stack key={row.label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 100 }}>
                              {row.label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: row.mono ? 'monospace' : undefined, fontSize: row.mono ? 12 : undefined }}>
                              {row.value}
                            </Typography>
                          </Stack>
                        ))}
                      {detail.custom_fields && isRecord(detail.custom_fields)
                        ? Object.entries(detail.custom_fields)
                            .filter(([, value]) => value !== '' && value !== null && value !== undefined)
                            .map(([key, value]) => (
                              <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                                <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 100 }}>
                                  {key}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 220, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {String(value)}
                                </Typography>
                              </Stack>
                            ))
                        : null}
                    </Stack>
                  </Box>
                ) : null}

                {detail.notes ? (
                  <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                      <NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Note
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {detail.notes}
                    </Typography>
                  </Box>
                ) : null}

                {detail.tags && detail.tags.length > 0 ? (
                  <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>
                      Tag
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" spacing={0.5}>
                      {detail.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Nessun dettaglio disponibile.
              </Typography>
            )}
          </Box>
        ) : null}

        {drawerTab === 1 && selectedId ? (
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
            <AuditEventsTab appLabel="inventory" model="inventory" objectId={selectedId} />
          </Box>
        ) : null}
      </Stack>
    </Drawer>
  )
}
