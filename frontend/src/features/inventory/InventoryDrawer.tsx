/**
 * InventoryDrawer — drawer di dettaglio workstation/inventory.
 *
 * Restyle "Bold Float" (proposta B):
 *  - Hero teal senza badge status
 *  - Floating card bianca che emerge dall'hero: banda K-Number + bottoni nav
 *  - Body con sfondo tinted leggermente teal
 *  - Sezioni con icona accent teal nel header
 *  - Credenziali con riga sfondo teal-tinted
 */
import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import { buildQuery } from '@shared/utils/nav'
import AuditEventsTab from '../../ui/AuditEventsTab'
import { useToast } from '@shared/ui/toast'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import { isRecord } from '@shared/utils/guards'
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
  onOpenMonitor?: (monitorId: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  if (!text) return
  try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  try { return new Date(iso).toLocaleDateString('it-IT') } catch { return iso }
}

// ─── Colori stato monitor ─────────────────────────────────────────────────────

const MONITOR_STATO_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  in_uso:        { bg: 'rgba(16,185,129,0.10)',  color: '#065f46', border: 'rgba(16,185,129,0.3)' },
  da_installare: { bg: 'rgba(245,158,11,0.10)',  color: '#92400e', border: 'rgba(245,158,11,0.3)' },
  guasto:        { bg: 'rgba(239,68,68,0.10)',   color: '#991b1b', border: 'rgba(239,68,68,0.3)'  },
  rma:           { bg: 'rgba(148,163,184,0.12)', color: '#475569', border: 'rgba(148,163,184,0.3)' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Sezione con header accent teal + icona */
function BSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: 1.5, border: '0.5px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{ px: 1.75, py: 1, borderBottom: '0.5px solid', borderColor: 'grey.100' }}
      >
        <Box sx={{ width: 20, height: 20, borderRadius: 0.75, bgcolor: 'rgba(13,148,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Stack>
      <Box sx={{ px: 1.75, py: 1.25 }}>
        {children}
      </Box>
    </Box>
  )
}

/** Riga campo label → valore con copia opzionale */
function BRow({
  label,
  value,
  mono = false,
  copy = false,
  onCopy,
}: {
  label: string
  value?: string | null
  mono?: boolean
  copy?: boolean
  onCopy?: () => void
}) {
  if (!value) return null
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.6 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90, flexShrink: 0 }}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontFamily: mono ? 'ui-monospace,SFMono-Regular,monospace' : undefined,
            fontSize: mono ? 12 : undefined,
            textAlign: 'right',
          }}
        >
          {value}
        </Typography>
        {copy && value ? (
          <Tooltip title="Copia">
            <IconButton size="small" onClick={onCopy} sx={{ p: 0.25 }}>
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    </Stack>
  )
}

/** Riga credenziale con sfondo tinted */
function CredRow({ label, value, secret = false }: { label: string; value?: string | null; secret?: boolean }) {
  const [show, setShow] = React.useState(false)
  const toast = useToast()
  if (!value) return null
  const display = secret ? (show ? value : '•'.repeat(Math.min(value.length, 12))) : value
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ bgcolor: 'rgba(13,148,136,0.05)', borderRadius: 0.75, px: 1.25, py: 0.75 }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 80, flexShrink: 0 }}>{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'ui-monospace,SFMono-Regular,monospace', fontSize: 12 }}>
          {display}
        </Typography>
        {secret ? (
          <IconButton size="small" onClick={() => setShow(s => !s)} sx={{ p: 0.25 }}>
            {show ? <VisibilityOffIcon sx={{ fontSize: 13 }} /> : <VisibilityIcon sx={{ fontSize: 13 }} />}
          </IconButton>
        ) : null}
        <Tooltip title="Copia">
          <IconButton size="small" onClick={async () => { await copyToClipboard(value); toast.success('Copiato ✅') }} sx={{ p: 0.25 }}>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  )
}

/** K-Number SVG plate (stile originale: caselle + logo Philips blu) */
function KnumberBand({ knumber }: { knumber: string }) {
  const digits = 9
  const clean = (knumber ?? '').replace(/\D/g, '')
  const padded = clean.slice(-digits).padStart(digits, '0')
  const blue = '#1e56ff'
  const strokeW = 5; const leftPad = 18; const topPad = 14; const gap = 8
  const boxW = 62; const boxH = 62; const rowW = digits * boxW + (digits - 1) * gap
  const frameW = leftPad * 2 + rowW
  const boxesAreaH = topPad + boxH + 14
  const brandGap = 26; const brandSize = 28
  const brandY = boxesAreaH + brandGap; const frameH = brandY + 22
  return (
    <Box sx={{ px: 1.5, py: 1.25 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', fontSize: 9, mb: 0.75 }}>
        K-Number
      </Typography>
      <svg width="100%" viewBox={`0 0 ${frameW} ${frameH}`} role="img" aria-label={`K-Number ${padded}`} style={{ display: 'block', maxWidth: 560 }}>
        <rect x={strokeW / 2} y={strokeW / 2} width={frameW - strokeW} height={boxesAreaH - strokeW} rx="5" fill="white" stroke={blue} strokeWidth={strokeW} />
        {Array.from({ length: digits }).map((_, i) => {
          const x = leftPad + i * (boxW + gap)
          return (
            <g key={i}>
              <rect x={x} y={topPad} width={boxW} height={boxH} fill="white" stroke="black" strokeWidth="3.5" />
              <text x={x + boxW / 2} y={topPad + boxH / 2 + 15} textAnchor="middle" fontSize="42" fontFamily="Arial,Helvetica,sans-serif" fontWeight="800" fill="black">{padded[i] ?? ''}</text>
            </g>
          )
        })}
        <text x={leftPad} y={brandY} fontSize={brandSize} fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fill={blue}>PHILIPS</text>
      </svg>
    </Box>
  )
}

/** Monitor card */
function MonitorCard({ monitor, onClick }: { monitor: InventoryMonitorSummary; onClick?: () => void }) {
  const sc = MONITOR_STATO_COLOR[monitor.stato] ?? MONITOR_STATO_COLOR.rma
  const label = [monitor.produttore, monitor.modello].filter(Boolean).join(' ')
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 1.5, py: 1.25, borderRadius: 1.5,
        border: '0.5px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': onClick ? { borderColor: '#0d9488', boxShadow: '0 0 0 2px rgba(13,148,136,0.12)' } : {},
      }}
    >
      <Box sx={{ width: 34, height: 34, borderRadius: 1, flexShrink: 0, bgcolor: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <Box sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, bgcolor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.4 }}>
          {monitor.stato_label}
        </Box>
        {monitor.radinet ? (
          <Chip label="Radinet" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(14,116,144,0.1)', color: '#0e7490', border: '1px solid rgba(14,116,144,0.25)', '& .MuiChip-label': { px: 0.75 } }} />
        ) : null}
      </Box>
    </Box>
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

  // ── Floating card: K-Number band + nav buttons ────────────────────────────
  const floatCard = detail ? (
    <Box
      sx={{
        mx: 1.5,
        mt: '-22px',
        mb: 0,
        bgcolor: '#fff',
        borderRadius: 2,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {detail.knumber ? <KnumberBand knumber={detail.knumber} /> : null}
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', px: 1.5, pb: 1.25, pt: 0.75, justifyContent: 'center' }}>
        <Button
          size="small"
          variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, fontSize: '0.72rem', minHeight: 0, py: 0.6, px: 1.5, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() => navigate(`/customers${buildQuery({ open: detail.customer, return: loc.pathname + loc.search })}`)}
        >
          Apri cliente
        </Button>
        {detail.site ? (
          <Button
            size="small"
            variant="contained"
            sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, fontSize: '0.72rem', minHeight: 0, py: 0.6, px: 1.5, '&:hover': { bgcolor: '#0f766e' } }}
            onClick={() => navigate(`/sites${buildQuery({ customer: detail.customer, open: detail.site, return: loc.pathname + loc.search })}`)}
          >
            Apri sito
          </Button>
        ) : null}
        <Button
          size="small"
          variant="contained"
          sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 600, fontSize: '0.72rem', minHeight: 0, py: 0.6, px: 1.5, '&:hover': { bgcolor: '#0f766e' } }}
          onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer, site: detail.site ?? '' })}`)}
        >
          Lista filtrata
        </Button>
      </Stack>
    </Box>
  ) : null

  // ── Alert issue attiva ────────────────────────────────────────────────────
  const issueAlert = detail?.has_active_issue ? (
    <Box sx={{ position: 'relative', mt: 1, mb: 0.5 }}>
      {/* Triangolo giallo SVG che fuoriesce in alto a destra */}
      <Box sx={{ position: 'absolute', top: -28, right: 16, zIndex: 4, pointerEvents: 'none' }}>
        <svg width="56" height="52" viewBox="0 0 56 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Ombra triangolo */}
          <path d="M28 4L53 48H3L28 4Z" fill="rgba(0,0,0,0.10)" transform="translate(1,3)" />
          {/* Triangolo giallo */}
          <path d="M28 4L53 48H3L28 4Z" fill="#FBBF24" />
          {/* Bordo triangolo più scuro */}
          <path d="M28 4L53 48H3L28 4Z" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
          {/* Punto esclamativo — stanghetta */}
          <rect x="25.5" y="20" width="5" height="16" rx="2.5" fill="#1a1a1a" />
          {/* Punto esclamativo — pallino */}
          <circle cx="28" cy="42" r="3" fill="#1a1a1a" />
        </svg>
      </Box>
      {/* Card rossa */}
      <Box sx={{
        bgcolor: '#dc2626',
        borderRadius: 2,
        p: 1.75,
        pr: 9,
        boxShadow: '0 4px 20px rgba(220,38,38,0.30)',
        overflow: 'visible',
      }}>
        <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: 14, lineHeight: 1.2, mb: 0.5 }}>
          Issue aperta!
        </Typography>
        <Typography sx={{ fontWeight: 400, color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.5 }}>
          C'è una issue collegata a questo sistema attualmente aperta.
        </Typography>
      </Box>
    </Box>
  ) : null

  // ── Contenuto tab Dettagli ────────────────────────────────────────────────
  const detailContent = detail ? (
    <Stack spacing={1.5}>
      {issueAlert}

      {/* Identificazione */}
      {[detail.name, detail.site_display_name || detail.site_name, detail.knumber, detail.serial_number].some(Boolean) ? (
        <BSection icon={<FingerprintIcon sx={{ fontSize: 12, color: '#0d9488' }} />} title="Identificazione">
          <Stack divider={<Box sx={{ borderBottom: '0.5px solid', borderColor: 'grey.50' }} />}>
            <BRow label="Nome" value={detail.name} />
            <BRow label="Sede" value={detail.site_display_name || detail.site_name} />
            <BRow label="K-number" value={detail.knumber} mono copy onCopy={async () => { await copyToClipboard(detail.knumber!); toast.success('Copiato ✅') }} />
            <BRow label="Seriale" value={detail.serial_number} mono copy onCopy={async () => { await copyToClipboard(detail.serial_number!); toast.success('Copiato ✅') }} />
          </Stack>
        </BSection>
      ) : null}

      {/* Rete */}
      {[detail.hostname, detail.local_ip, detail.srsa_ip].some(Boolean) ? (
        <BSection icon={<WifiOutlinedIcon sx={{ fontSize: 12, color: '#0d9488' }} />} title="Rete">
          <Stack divider={<Box sx={{ borderBottom: '0.5px solid', borderColor: 'grey.50' }} />}>
            <BRow label="Hostname" value={detail.hostname} mono copy onCopy={async () => { await copyToClipboard(detail.hostname!); toast.success('Copiato ✅') }} />
            <BRow label="IP locale" value={detail.local_ip} mono copy onCopy={async () => { await copyToClipboard(detail.local_ip!); toast.success('Copiato ✅') }} />
            <BRow label="IP SRSA" value={detail.srsa_ip} mono copy onCopy={async () => { await copyToClipboard(detail.srsa_ip!); toast.success('Copiato ✅') }} />
          </Stack>
        </BSection>
      ) : null}

      {/* Credenziali */}
      {canViewSecrets || [detail.os_user, detail.app_usr].some(Boolean) ? (
        <BSection icon={<LockOutlinedIcon sx={{ fontSize: 12, color: '#0d9488' }} />} title="Credenziali">
          {!canViewSecrets ? (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', mb: 0.75 }}>
              Password non visibili (permessi insufficienti)
            </Typography>
          ) : null}
          <Stack spacing={0.75}>
            {detail.os_user ? <CredRow label="Utente OS" value={detail.os_user} /> : null}
            {canViewSecrets && detail.os_pwd ? <CredRow label="Password OS" value={detail.os_pwd} secret /> : null}
            {detail.app_usr ? <CredRow label="Utente App" value={detail.app_usr} /> : null}
            {canViewSecrets && detail.app_pwd ? <CredRow label="Password App" value={detail.app_pwd} secret /> : null}
            {canViewSecrets && detail.vnc_pwd ? <CredRow label="Password VNC" value={detail.vnc_pwd} secret /> : null}
          </Stack>
        </BSection>
      ) : null}

      {/* Hardware */}
      {[detail.manufacturer, detail.model, detail.warranty_end_date, ...Object.values(detail.custom_fields ?? {})].some(v => v != null && v !== '') ? (
        <BSection icon={<MemoryOutlinedIcon sx={{ fontSize: 12, color: '#0d9488' }} />} title="Hardware">
          <Stack divider={<Box sx={{ borderBottom: '0.5px solid', borderColor: 'grey.50' }} />}>
            <BRow label="Produttore" value={detail.manufacturer} />
            <BRow label="Modello" value={detail.model} />
            <BRow label="Fine garanzia" value={fmtDate(detail.warranty_end_date)} />
            {detail.custom_fields && isRecord(detail.custom_fields)
              ? Object.entries(detail.custom_fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                  <BRow key={k} label={k} value={String(v)} />
                ))
              : null}
          </Stack>
        </BSection>
      ) : null}

      {/* Note */}
      {detail.notes ? (
        <BSection icon={<NotesOutlinedIcon sx={{ fontSize: 12, color: '#0d9488' }} />} title="Note">
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {detail.notes}
          </Typography>
        </BSection>
      ) : null}

      {/* Tag */}
      {detail.tags && detail.tags.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" spacing={0.5}>
          {detail.tags.map(t => <Chip key={t} label={t} size="small" variant="outlined" />)}
        </Stack>
      ) : null}

      {/* Monitor collegati */}
      {detail.monitors && detail.monitors.length > 0 ? (
        <BSection icon={<MonitorOutlinedIcon sx={{ fontSize: 12, color: '#0d9488' }} />} title={`Monitor (${detail.monitors.length})`}>
          <Stack spacing={0.75}>
            {detail.monitors.map(m => (
              <MonitorCard key={m.id} monitor={m} onClick={onOpenMonitor ? () => onOpenMonitor(m.id) : undefined} />
            ))}
          </Stack>
        </BSection>
      ) : null}
    </Stack>
  ) : null

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      gradient="teal"
      canChange={canChange}
      canDelete={canDelete}
      deleteBusy={deleteBusy}
      restoreBusy={restoreBusy}
      deleted={!!detail?.deleted_at}
      onEdit={onEdit}
      onDelete={onDelete}
      onRestore={onRestore}
      title={title}
      subtitle={subtitleParts.join(' · ') || undefined}
      caption={detail?.type_label || undefined}
      loading={detailLoading}
      tabs={['Dettagli', 'Attività']}
      tabValue={drawerTab}
      onTabChange={onTabChange}
      preBody={floatCard}
      bodySx={{ bgcolor: 'rgba(240,253,250,0.6)' }}
    >
      {drawerTab === 0 ? (
        detailLoading ? (
          <Box sx={{ pt: 2 }}><DrawerLoadingState /></Box>
        ) : detail ? (
          <Box sx={{ px: 2, py: 2 }}>
            {detailContent}
          </Box>
        ) : <DrawerEmptyState />
      ) : null}

      {drawerTab === 1 && selectedId
        ? <AuditEventsTab appLabel="inventory" model="inventory" objectId={selectedId} />
        : null}
    </DrawerShell>
  )
}
