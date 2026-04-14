import * as React from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import { buildQuery } from '@shared/utils/nav'
import AuditEventsTab from '../../ui/AuditEventsTab'
import { useToast } from '@shared/ui/toast'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import InventoryReadContent from '@shared/inventory/InventoryReadContent'
import type { InventoryDetail, InventoryMonitorSummary } from './types'

// ─── Props ────────────────────────────────────────────────────────────────────

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
  /** Apre il MonitorDrawer per il monitor indicato. */
  onOpenMonitor?: (monitorId: number) => void
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  if (!text) return
  await navigator.clipboard.writeText(text)
}

// ─── Colori stato monitor ─────────────────────────────────────────────────────

const MONITOR_STATO_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  in_uso:        { bg: 'rgba(16,185,129,0.10)',  color: '#065f46', border: 'rgba(16,185,129,0.3)' },
  da_installare: { bg: 'rgba(245,158,11,0.10)',  color: '#92400e', border: 'rgba(245,158,11,0.3)' },
  guasto:        { bg: 'rgba(239,68,68,0.10)',   color: '#991b1b', border: 'rgba(239,68,68,0.3)'  },
  rma:           { bg: 'rgba(148,163,184,0.12)', color: '#475569', border: 'rgba(148,163,184,0.3)' },
}

// ─── MonitorCard ──────────────────────────────────────────────────────────────

function MonitorCard({
  monitor,
  onClick,
}: {
  monitor: InventoryMonitorSummary
  onClick?: () => void
}) {
  const sc = MONITOR_STATO_COLOR[monitor.stato] ?? MONITOR_STATO_COLOR.rma
  const label = [monitor.produttore, monitor.modello].filter(Boolean).join(' ')
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 1.5, py: 1.25,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': onClick ? {
          borderColor: '#0d9488',
          boxShadow: '0 0 0 2px rgba(13,148,136,0.12)',
        } : {},
      }}
    >
      <Box sx={{
        width: 34, height: 34, borderRadius: 1, flexShrink: 0,
        bgcolor: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MonitorOutlinedIcon sx={{ fontSize: 18, color: '#0d9488' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {label || `Monitor #${monitor.id}`}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
          {monitor.tipo_label}{monitor.seriale ? ` · ${monitor.seriale}` : ''}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
        <Box sx={{
          px: 0.75, py: 0.2, borderRadius: 0.75,
          bgcolor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
          fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.4,
        }}>
          {monitor.stato_label}
        </Box>
        {monitor.radinet ? (
          <Chip label="Radinet" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(14,116,144,0.1)', color: '#0e7490', border: '1px solid rgba(14,116,144,0.25)', '& .MuiChip-label': { px: 0.75 } }} />
        ) : null}
      </Box>
    </Box>
  )
}

// ─── KNumberPlate ─────────────────────────────────────────────────────────────

function KNumberPlate({ knumber, digits = 9 }: { knumber: string; digits?: number }) {
  const clean = (knumber ?? '').replace(/\D/g, '')
  const padded = clean.slice(-digits).padStart(digits, '0')
  const blue = '#1e56ff'; const strokeW = 6; const leftPad = 22; const topPad = 18; const gap = 10
  const boxW = 74; const boxH = 74; const rowW = digits * boxW + (digits - 1) * gap
  const frameW = leftPad * 2 + rowW; const brandGap = 34; const brandSize = 36
  const boxesAreaH = topPad + boxH + 18; const brandY = boxesAreaH + brandGap; const frameH = brandY + 28
  return (
    <svg width="100%" viewBox={`0 0 ${frameW} ${frameH}`} role="img" aria-label={`K-Number ${padded}`} style={{ display: 'block', maxWidth: 980 }}>
      <rect x={strokeW / 2} y={strokeW / 2} width={frameW - strokeW} height={boxesAreaH - strokeW} rx="6" fill="white" stroke={blue} strokeWidth={strokeW} />
      {Array.from({ length: digits }).map((_, i) => {
        const x = leftPad + i * (boxW + gap)
        return (
          <g key={i}>
            <rect x={x} y={topPad} width={boxW} height={boxH} fill="white" stroke="black" strokeWidth="4" />
            <text x={x + boxW / 2} y={topPad + boxH / 2 + 18} textAnchor="middle" fontSize="52" fontFamily="Arial,Helvetica,sans-serif" fontWeight="800" fill="black">{padded[i] ?? ''}</text>
          </g>
        )
      })}
      <text x={leftPad} y={brandY} fontSize={brandSize} fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fill={blue}>PHILIPS</text>
    </svg>
  )
}

// ─── SecretRow ────────────────────────────────────────────────────────────────

function SecretRow({ label, value, onCopy }: { label: string; value?: string | null; onCopy?: () => void }) {
  const [show, setShow] = React.useState(false)
  const v = value ?? ''
  const timerRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!show) { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }; return }
    if (v) { if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => setShow(false), 30_000) }
    return () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }
  }, [show, v])
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 120, opacity: 0.7 }}><Typography variant="body2">{label}</Typography></Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace', wordBreak: 'break-word' }}>
          {v ? (show ? v : '•'.repeat(Math.min(v.length, 12))) : '—'}
        </Typography>
      </Box>
      {v ? (
        <Stack direction="row" spacing={0.5}>
          <ActionIconButton label={show ? 'Nascondi' : 'Mostra (30s)'} size="small" onClick={() => setShow((s) => !s)}>
            {show ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}
          </ActionIconButton>
          <ActionIconButton label="Copia" size="small" onClick={onCopy} disabled={!onCopy}>
            <ContentCopyIcon fontSize="inherit" />
          </ActionIconButton>
        </Stack>
      ) : <Box sx={{ width: 68 }} />}
    </Stack>
  )
}


// ─── InventoryDrawer ──────────────────────────────────────────────────────────

export default function InventoryDrawer({
  open, detail, detailLoading, selectedId,
  canViewSecrets, canChange, canDelete,
  drawerTab, deleteBusy, restoreBusy,
  onClose, onTabChange, onEdit, onDelete, onRestore,
  onOpenMonitor,
}: InventoryDrawerProps) {
  const navigate = useNavigate()
  const loc = useLocation()
  const toast = useToast()

  const title = detail?.hostname || detail?.name || detail?.knumber || (selectedId ? `Inventario #${selectedId}` : 'Inventario')
  const subtitleParts: string[] = []
  if (detail?.name && detail?.hostname && detail.name !== detail.hostname) subtitleParts.push(detail.name)
  if (detail?.customer_name) subtitleParts.push(detail.customer_name)
  if (detail?.site_display_name || detail?.site_name) subtitleParts.push((detail?.site_display_name || detail?.site_name)!)

  // ── Slot header: nav buttons + issue warning + K-Number ──────────────────
  const header = detail ? (
    <>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button size="small" variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() => navigate(`/customers${buildQuery({ open: detail.customer, return: loc.pathname + loc.search })}`)}>
          Apri cliente
        </Button>
        {detail.site ? (
          <Button size="small" variant="contained"
            sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
            onClick={() => navigate(`/sites${buildQuery({ customer: detail.customer, open: detail.site, return: loc.pathname + loc.search })}`)}>
            Apri sito
          </Button>
        ) : null}
        <Button size="small" variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer, site: detail.site ?? '' })}`)}>
          Lista filtrata
        </Button>
      </Stack>

      {detail.has_active_issue ? (
        <Box sx={{ bgcolor: 'rgba(239,68,68,0.10)', border: '1px solid', borderColor: 'rgba(239,68,68,0.28)', borderRadius: 1, p: 1.75 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <WarningAmberRoundedIcon sx={{ color: 'error.main', mt: '2px' }} />
            <Typography sx={{ fontWeight: 800, color: 'error.main', lineHeight: 1.2 }}>
              Attenzione! C'è una issue collegata al sistema attualmente aperta.
            </Typography>
          </Stack>
        </Box>
      ) : null}

      {detail.knumber ? (
        <DrawerSection title="K-Number">
          <KNumberPlate knumber={detail.knumber} digits={9} />
        </DrawerSection>
      ) : null}
    </>
  ) : null

  // ── Slot credenziali ─────────────────────────────────────────────────────
  const credentialsSlot = detail && (canViewSecrets
    ? [detail.os_user, detail.os_pwd, detail.app_usr, detail.app_pwd, detail.vnc_pwd]
    : [detail.os_user, detail.app_usr]
  ).some(Boolean) ? (
    <DrawerSection icon={<LockOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Credenziali">
      {!canViewSecrets ? (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', mb: 0.5 }}>
          Password non visibili (permessi insufficienti)
        </Typography>
      ) : null}
      <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
        <DrawerFieldList
          rows={[
            { label: 'Utente OS', value: detail.os_user, mono: true, copy: true },
            { label: 'Utente App', value: detail.app_usr, mono: true, copy: true },
          ]}
          onCopy={async (v) => { await copyToClipboard(v); toast.success('Copiato ✅') }}
        />
        {canViewSecrets && detail.os_pwd ? <Box sx={{ py: 0.75 }}><SecretRow label="Password OS" value={detail.os_pwd} onCopy={async () => { await copyToClipboard(detail.os_pwd!); toast.success('Copiato ✅') }} /></Box> : null}
        {canViewSecrets && detail.app_pwd ? <Box sx={{ py: 0.75 }}><SecretRow label="Password App" value={detail.app_pwd} onCopy={async () => { await copyToClipboard(detail.app_pwd!); toast.success('Copiato ✅') }} /></Box> : null}
        {canViewSecrets && detail.vnc_pwd ? <Box sx={{ py: 0.75 }}><SecretRow label="Password VNC" value={detail.vnc_pwd} onCopy={async () => { await copyToClipboard(detail.vnc_pwd!); toast.success('Copiato ✅') }} /></Box> : null}
      </Stack>
    </DrawerSection>
  ) : null

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      canChange={canChange} canDelete={canDelete}
      deleteBusy={deleteBusy} restoreBusy={restoreBusy} deleted={!!detail?.deleted_at}
      onEdit={onEdit} onDelete={onDelete} onRestore={onRestore}
      title={title}
      subtitle={subtitleParts.join(' · ') || undefined}
      caption={detail?.type_label || undefined}
      loading={detailLoading}
      tabs={['Dettagli', 'Attività']}
      tabValue={drawerTab} onTabChange={onTabChange}
    >
      {drawerTab === 0 ? (
        detailLoading ? <DrawerLoadingState /> : detail ? (
          <>
            <InventoryReadContent
              detail={detail}
              onCopied={() => toast.success('Copiato ✅')}
              header={header}
              credentialsSlot={credentialsSlot}
            />
            {detail.monitors && detail.monitors.length > 0 ? (
              <DrawerSection
                icon={<MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                title={`Monitor (${detail.monitors.length})`}
              >
                <Stack spacing={0.75}>
                  {detail.monitors.map((m) => (
                    <MonitorCard
                      key={m.id}
                      monitor={m}
                      onClick={onOpenMonitor ? () => onOpenMonitor(m.id) : undefined}
                    />
                  ))}
                </Stack>
              </DrawerSection>
            ) : null}
          </>
        ) : <DrawerEmptyState />
      ) : null}

      {drawerTab === 1 && selectedId
        ? <AuditEventsTab appLabel="inventory" model="inventory" objectId={selectedId} />
        : null}
    </DrawerShell>
  )
}
