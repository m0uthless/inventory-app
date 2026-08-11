import * as React from 'react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import { getInventoryTypeIcon, getInventoryTypeGradient } from '@shared/ui/inventoryTypeIcon'
import AuditEventsTab from '../../ui/AuditEventsTab'
import { isRecord } from '@shared/utils/guards'
import { useToast } from '@shared/ui/toast'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerFieldRow, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'

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
      <Box sx={{ minWidth: 100, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>{label}</Typography>
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
  return React.createElement(getInventoryTypeIcon(props.typeKey), {
    sx: { fontSize: 26, color: 'rgba(255,255,255,0.9)' },
  })
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

  const toast = useToast()

  const handleCopy = async (value: string) => {
    if (!value) return
    await copyToClipboard(value)
    toast.success('Copiato ✅')
  }

  // Riga secondaria sotto al titolo: nome (se diverso dall'hostname mostrato
  // in titolo) + cliente/sito, sullo stesso pattern a una riga di
  // Customer/Site/Monitor Drawer (subtitle singolo, niente righe multiple ad hoc).
  const secondaryName = detail?.name && detail?.hostname && detail.name !== detail.hostname ? detail.name : null
  const customerSite = [detail?.customer_name, detail?.site_display_name || detail?.site_name].filter(Boolean).join(' · ')
  const subtitle = [secondaryName, customerSite].filter(Boolean).join(' · ') || undefined

  const hasHardwareInfo = [detail?.manufacturer, detail?.model, detail?.warranty_end_date, ...Object.values(detail?.custom_fields ?? {})]
    .some((value) => value !== '' && value !== null && value !== undefined)

  const bareCloseButton = (
    <Tooltip title="Chiudi">
      <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.85)' }}>
        <ArrowBackIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient={getInventoryTypeGradient(detail?.type_key)}
      statusSlot={bareCloseButton}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      icon={<InventoryTypeBadgeIcon typeKey={detail?.type_key} />}
      iconBare
      heroWatermark={detail?.type_label ?? undefined}
      title={detail?.hostname || detail?.name || detail?.knumber || (selectedId ? `Inventario #${selectedId}` : 'Inventario')}
      subtitle={subtitle}
      loading={detailLoading}
      tabs={['Dettagli', 'Attività']}
      tabValue={drawerTab} onTabChange={onTabChange}
    >
      {drawerTab === 0 ? (
        detailLoading ? <DrawerLoadingState /> :
        !detail ? <DrawerEmptyState /> : (
          <>
            {detail.has_active_issue ? (
              <Box sx={{ bgcolor: 'rgba(239, 68, 68, 0.10)', border: '1px solid', borderColor: 'rgba(239, 68, 68, 0.28)', borderRadius: 1, p: 1.75 }}>
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
              <DrawerSection title="K-Number">
                <KNumberPlate knumber={detail.knumber} digits={9} />
              </DrawerSection>
            ) : null}

            {[detail.name, detail.knumber, detail.serial_number, detail.site_display_name || detail.site_name].some(Boolean) ? (
              <DrawerSection accent="info" icon={<FingerprintIcon sx={{ fontSize: 14, color: 'info.main' }} />} title="Identificazione">
                <DrawerFieldList
                  rows={[
                    { label: 'Nome', value: detail.name, copy: true },
                    { label: 'Sito', value: detail.site_display_name || detail.site_name },
                    { label: 'K-number', value: detail.knumber, mono: true, copy: true },
                    { label: 'Seriale', value: detail.serial_number, mono: true, copy: true },
                  ]}
                  onCopy={handleCopy}
                />
              </DrawerSection>
            ) : null}

            {[detail.hostname, detail.local_ip, detail.srsa_ip].some(Boolean) ? (
              <DrawerSection accent="secondary" icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'secondary.main' }} />} title="Rete">
                <DrawerFieldList
                  rows={[
                    { label: 'Hostname', value: detail.hostname, mono: true, copy: true },
                    { label: 'IP locale', value: detail.local_ip, mono: true, copy: true },
                    { label: 'IP SRSA', value: detail.srsa_ip, mono: true, copy: true },
                  ]}
                  onCopy={handleCopy}
                />
              </DrawerSection>
            ) : null}

            {(canViewSecrets ? [detail.os_user, detail.os_pwd, detail.app_usr, detail.app_pwd, detail.vnc_pwd] : [detail.os_user, detail.app_usr]).some(Boolean) ? (
              <DrawerSection accent="warning" icon={<LockOutlinedIcon sx={{ fontSize: 14, color: 'warning.main' }} />} title="Credenziali">
                {!canViewSecrets ? (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', mb: 0.5 }}>
                    Password non visibili (permessi insufficienti)
                  </Typography>
                ) : null}
                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                  <DrawerFieldRow label="Utente OS" value={detail.os_user} mono copy onCopy={handleCopy} labelMinWidth={100} />
                  {canViewSecrets && detail.os_pwd ? (
                    <Box sx={{ py: 0.75 }}>
                      <SecretRow label="Password OS" value={detail.os_pwd} onCopy={() => void handleCopy(detail.os_pwd ?? '')} />
                    </Box>
                  ) : null}
                  <DrawerFieldRow label="Utente App" value={detail.app_usr} mono copy onCopy={handleCopy} labelMinWidth={100} />
                  {canViewSecrets && detail.app_pwd ? (
                    <Box sx={{ py: 0.75 }}>
                      <SecretRow label="Password App" value={detail.app_pwd} onCopy={() => void handleCopy(detail.app_pwd ?? '')} />
                    </Box>
                  ) : null}
                  {canViewSecrets && detail.vnc_pwd ? (
                    <Box sx={{ py: 0.75 }}>
                      <SecretRow label="Password VNC" value={detail.vnc_pwd} onCopy={() => void handleCopy(detail.vnc_pwd ?? '')} />
                    </Box>
                  ) : null}
                </Stack>
              </DrawerSection>
            ) : null}

            {hasHardwareInfo ? (
              <DrawerSection accent="success" icon={<MemoryOutlinedIcon sx={{ fontSize: 14, color: 'success.main' }} />} title="Hardware">
                <DrawerFieldList
                  rows={[
                    { label: 'Produttore', value: detail.manufacturer },
                    { label: 'Modello', value: detail.model },
                    { label: 'Fine garanzia', value: detail.warranty_end_date, mono: true },
                    ...(detail.custom_fields && isRecord(detail.custom_fields)
                      ? Object.entries(detail.custom_fields)
                          .filter(([, value]) => value !== '' && value !== null && value !== undefined)
                          .map(([key, value]) => ({ label: key, value: String(value) }))
                      : []),
                  ]}
                />
              </DrawerSection>
            ) : null}

            {detail.notes ? (
              <DrawerSection accent="neutral" icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />} title="Note">
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {detail.notes}
                </Typography>
              </DrawerSection>
            ) : null}

            {detail.tags && detail.tags.length > 0 ? (
              <DrawerSection title="Tag" variant="muted">
                <Stack direction="row" flexWrap="wrap" spacing={0.5}>
                  {detail.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              </DrawerSection>
            ) : null}
          </>
        )
      ) : null}

      {drawerTab === 1 && selectedId ? (
        <AuditEventsTab appLabel="inventory" model="inventory" objectId={selectedId} />
      ) : null}
    </DrawerShell>
  )
}
