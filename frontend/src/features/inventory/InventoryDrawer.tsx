/**
 * InventoryDrawer — drawer di dettaglio workstation/inventory.
 *
 * Layout "Playful A" (self-contained, non usa DrawerShell).
 *
 * Ordine verticale:
 *   1. HERO teal (top-bar: back + edit/delete · titolo hostname · sottotitolo contesto · caption type)
 *   2. FLOAT CARD bianca (-22px): K-number a "dadi" + 3 nav buttons (Cliente / Sito / Lista filtrata)
 *   3. TABS (Dettagli / Attività)
 *   4. BODY scrollabile su sfondo tinted teal:
 *        - Issue alert drammatico (se has_active_issue)
 *        - Griglia 2-col: Identificazione · Rete · Hardware · Credenziali · Monitor · Note
 */
import * as React from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreIcon from '@mui/icons-material/Restore'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import FilterListIcon from '@mui/icons-material/FilterList'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { buildQuery } from '@shared/utils/nav'
import AuditEventsTab from '../../ui/AuditEventsTab'
import { useToast } from '@shared/ui/toast'
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

// ─── Palette ──────────────────────────────────────────────────────────────────

const TEAL        = '#0d9488'
const TEAL_DEEP   = '#0a524d'
const TEAL_SOFT   = '#ccfbf1'
const BODY_BG     = '#f4fbfa'

const ACCENT_IDENT = TEAL
const ACCENT_NET   = '#0891b2'
const ACCENT_HW    = '#7c3aed'
const ACCENT_CRED  = '#be185d'
const ACCENT_NOTE  = '#475569'

const CRED_BG      = '#fdf4f8'
const CRED_BORDER  = '#f5d5e3'

const DRAWER_WIDTH = 440

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

const MONITOR_STATO_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  in_uso:        { bg: 'rgba(16,185,129,0.10)',  color: '#065f46', border: 'rgba(16,185,129,0.3)',  dot: '#10b981' },
  da_installare: { bg: 'rgba(245,158,11,0.10)',  color: '#92400e', border: 'rgba(245,158,11,0.3)',  dot: '#f59e0b' },
  guasto:        { bg: 'rgba(239,68,68,0.10)',   color: '#991b1b', border: 'rgba(239,68,68,0.3)',   dot: '#ef4444' },
  rma:           { bg: 'rgba(148,163,184,0.12)', color: '#475569', border: 'rgba(148,163,184,0.3)', dot: '#64748b' },
}

// ─── Keyframes globali (iniettati una volta) ─────────────────────────────────

const KEYFRAMES_STYLE = (
  <style>{`
    @keyframes inv-roll   { 0%{transform:translateY(8px); opacity:0} 100%{transform:translateY(0); opacity:1} }
    @keyframes inv-blink  { 0%,50%{opacity:1} 51%,100%{opacity:0.55} }
    @keyframes inv-stripe { 0%{background-position:0 0} 100%{background-position:32px 0} }
  `}</style>
)

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Sezione con header accent colorato + icon-chip */
function BSection({
  icon, title, accent, children,
}: {
  icon: React.ReactNode
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <Box sx={{
      bgcolor: '#fff',
      borderRadius: 1.75,
      border: '1px solid #e6f0ee',
      boxShadow: '0 1px 2px rgba(13,148,136,0.04)',
      overflow: 'hidden',
    }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{
        px: 1.5, py: 1,
        borderBottom: '1px dashed #e6f0ee',
        background: `linear-gradient(90deg, ${accent}14, transparent)`,
      }}>
        <Box sx={{
          width: 22, height: 22, borderRadius: '7px',
          bgcolor: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: `0 2px 6px ${accent}55`, color: '#fff',
        }}>{icon}</Box>
        <Typography variant="caption" sx={{
          fontWeight: 800, color: accent,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          fontSize: '0.66rem',
        }}>{title}</Typography>
      </Stack>
      <Box sx={{ px: 1.5, py: 1.25 }}>{children}</Box>
    </Box>
  )
}

/** Riga KV omogenea (label + valore stesso size), copia opzionale */
function BRow({
  label, value, copy = false, onCopy,
}: {
  label: string
  value?: string | null
  copy?: boolean
  onCopy?: () => void
}) {
  if (!value) return null
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.4, gap: 1.25 }}>
      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.76rem', flexShrink: 0 }}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{
          fontWeight: 600, color: '#0f172a',
          fontSize: '0.76rem',
          textAlign: 'right',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</Typography>
        {copy ? (
          <Tooltip title="Copia">
            <IconButton size="small" onClick={onCopy} sx={{ p: 0.25, color: TEAL }}>
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    </Stack>
  )
}

/** Credenziale come pill pastello fucsia con show/copy inline */
function CredRow({ label, value, secret = false }: { label: string; value?: string | null; secret?: boolean }) {
  const [show, setShow] = React.useState(false)
  const toast = useToast()
  if (!value) return null
  const display = secret ? (show ? value : '•'.repeat(10)) : value
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{
      bgcolor: CRED_BG, border: `1px solid ${CRED_BORDER}`, borderRadius: 1.25,
      px: 1, py: 0.85,
    }}>
      <Typography sx={{
        fontSize: '0.62rem', fontWeight: 700, color: ACCENT_CRED,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        width: 52, flexShrink: 0,
      }}>{label}</Typography>
      <Typography sx={{
        flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#0f172a',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: secret && !show ? '0.14em' : 0,
      }}>{display}</Typography>
      {secret ? (
        <IconButton size="small" onClick={() => setShow(s => !s)} sx={{ p: 0.25, color: ACCENT_CRED }}>
          {show ? <VisibilityOffIcon sx={{ fontSize: 13 }} /> : <VisibilityIcon sx={{ fontSize: 13 }} />}
        </IconButton>
      ) : null}
      <Tooltip title="Copia">
        <IconButton size="small"
          onClick={async () => { await copyToClipboard(value); toast.success('Copiato ✅') }}
          sx={{ p: 0.25, color: ACCENT_CRED }}>
          <ContentCopyIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}

/** K-Number "a dadi": 9 caselle teal, roll-in animato, click per copia */
function KnumberPlate({ knumber, onClick }: { knumber: string; onClick: () => void }) {
  const digits = 9
  const clean = (knumber ?? '').replace(/\D/g, '')
  const padded = clean.slice(-digits).padStart(digits, '0').split('')
  return (
    <Box component="button" onClick={onClick} title="Click per copiare" sx={{
      display: 'flex', gap: '4px',
      width: '100%', border: 0, background: 'transparent',
      cursor: 'pointer', p: 0,
    }}>
      {padded.map((n, i) => (
        <Box key={i} sx={{
          flex: 1, aspectRatio: '1 / 1.1',
          background: 'linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 100%)',
          border: `1.5px solid ${TEAL}`, borderRadius: '7px',
          display: 'grid', placeItems: 'center',
          fontFamily: "'Space Grotesk','JetBrains Mono', monospace",
          fontSize: 22, fontWeight: 800, color: TEAL_DEEP,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 0 rgba(13,148,136,0.15)',
          animation: `inv-roll 0.45s ease-out ${i * 0.04}s both`,
          transition: 'transform 0.15s',
          '&:hover': { transform: 'translateY(-2px)' },
        }}>{n}</Box>
      ))}
    </Box>
  )
}

/** Nav button compatto per la float card */
function NavBtn({
  icon, children, outline = false, onClick,
}: { icon: React.ReactNode; children: React.ReactNode; outline?: boolean; onClick: () => void }) {
  return (
    <Box component="button" onClick={onClick} sx={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0.5, px: 1.25, py: 0.85,
      borderRadius: 1.25,
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.01em',
      cursor: 'pointer', transition: 'transform 0.15s',
      bgcolor: outline ? '#fff' : TEAL,
      color: outline ? TEAL_DEEP : '#fff',
      border: `1.5px solid ${outline ? TEAL_SOFT : TEAL}`,
      fontFamily: 'inherit',
      '&:hover': { transform: 'translateY(-1px)' },
    }}>
      {icon}
      {children}
    </Box>
  )
}

/** Monitor mini-tile (stripe top colorata + mini LED) */
function MonitorTile({ monitor, onClick }: { monitor: InventoryMonitorSummary; onClick?: () => void }) {
  const sc = MONITOR_STATO_COLOR[monitor.stato] ?? MONITOR_STATO_COLOR.rma
  const label = [monitor.produttore, monitor.modello].filter(Boolean).join(' ')
  return (
    <Box onClick={onClick} sx={{
      bgcolor: '#fff', border: '1px solid #e6f0ee', borderRadius: 1.25,
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.15s',
      '&:hover': onClick ? {
        borderColor: TEAL, boxShadow: '0 4px 12px rgba(13,148,136,0.12)',
      } : {},
    }}>
      <Box sx={{ height: '4px', bgcolor: sc.dot }} />
      <Box sx={{ p: 1.1 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{
            width: 28, height: 20, borderRadius: '3px',
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: sc.dot }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{
              fontSize: '0.72rem', fontWeight: 700, color: '#0f172a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{label || `Monitor #${monitor.id}`}</Typography>
            <Typography sx={{
              fontSize: '0.62rem', color: '#64748b',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{monitor.tipo_label}{monitor.seriale ? ` · ${monitor.seriale}` : ''}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75 }}>
          <Box sx={{
            fontSize: '0.62rem', fontWeight: 700,
            color: sc.color, bgcolor: sc.bg,
            px: 0.75, py: '2px', borderRadius: '4px',
            border: `1px solid ${sc.border}`,
          }}>{monitor.stato_label}</Box>
          {monitor.radinet ? (
            <Box sx={{
              fontSize: '0.56rem', fontWeight: 700,
              color: '#0e7490', bgcolor: '#ecfeff',
              px: 0.6, py: '2px', borderRadius: '4px',
              border: '1px solid #a5f3fc',
              letterSpacing: '0.05em',
            }}>RN</Box>
          ) : null}
        </Stack>
      </Box>
    </Box>
  )
}

/** Issue alert "terminal-style": hazard stripes animate + SLA bar */
function IssueAlert({ issueCode, slaLabel }: { issueCode?: string; slaLabel?: string }) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', mb: 1.5, borderRadius: 1.5,
      bgcolor: '#fff5f5', border: '1px solid #fecaca',
      boxShadow: '0 8px 24px rgba(220,38,38,0.14), inset 0 0 30px rgba(239,68,68,0.04)',
    }}>
      <Box sx={{
        height: '6px',
        backgroundImage: 'repeating-linear-gradient(45deg, #ef4444 0 8px, #fff5f5 8px 16px)',
        animation: 'inv-stripe 0.8s linear infinite',
      }} />
      <Box sx={{ position: 'relative', pl: '50px', pr: 1.5, py: 1.25 }}>
        <Box sx={{
          position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
          width: 28, height: 28, borderRadius: '6px',
          bgcolor: '#ef4444',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 0 0 3px rgba(239,68,68,0.18), 0 0 14px rgba(239,68,68,0.4)',
          animation: 'inv-blink 0.9s infinite',
          color: '#fff',
        }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{
          fontSize: '0.66rem', color: '#b91c1c',
          letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800,
        }}>Alert · Issue aperta</Typography>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#7f1d1d', mt: 0.25 }}>
          {issueCode ? <>Ticket <Box component="span" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>{issueCode}</Box></> : 'Issue collegata al sistema'}
          {slaLabel ? <> · SLA {slaLabel}</> : null}
        </Typography>
        <Box sx={{ mt: 0.75, height: '3px', bgcolor: '#fecaca', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%',
            background: 'linear-gradient(90deg, #ef4444, #fbbf24)',
          }} />
        </Box>
      </Box>
    </Box>
  )
}

/** Hero teal con pattern a pallini + onda inferiore */
function Hero({
  title, subtitle, caption, canChange, canDelete, deleted, deleteBusy, restoreBusy,
  onClose, onEdit, onDelete, onRestore,
}: {
  title: string
  subtitle?: string
  caption?: string
  canChange: boolean
  canDelete: boolean
  deleted: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  onClose: () => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
}) {
  const HeroBtn = ({ children, onClick, danger, title: t, disabled }: {
    children: React.ReactNode; onClick?: () => void; danger?: boolean; title?: string; disabled?: boolean;
  }) => (
    <IconButton
      size="small"
      onClick={onClick}
      disabled={disabled}
      title={t}
      sx={{
        width: 30, height: 30, borderRadius: '9px',
        bgcolor: danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.16)',
        color: '#fff',
        backdropFilter: 'blur(6px)',
        '&:hover': {
          bgcolor: danger ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.28)',
        },
        '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)' },
      }}
    >
      {children}
    </IconButton>
  )

  return (
    <Box sx={{
      position: 'relative',
      background: 'linear-gradient(135deg, #134e4a 0%, #0d9488 70%, #14b8a6 100%)',
      color: '#fff',
      px: 2, pt: 1.75, pb: '46px',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* decorative dots */}
      <Box component="svg" viewBox="0 0 220 160" sx={{
        position: 'absolute', top: 0, right: -30,
        width: 220, height: 160, opacity: 0.25, pointerEvents: 'none',
      }}>
        <circle cx="180" cy="30"  r="3" fill="#a7f3d0" />
        <circle cx="200" cy="70"  r="2" fill="#a7f3d0" />
        <circle cx="160" cy="90"  r="4" fill="#5eead4" />
        <circle cx="130" cy="40"  r="2" fill="#ccfbf1" />
        <circle cx="190" cy="120" r="3" fill="#5eead4" />
        <circle cx="100" cy="20"  r="2" fill="#ccfbf1" />
      </Box>
      {/* wavy bottom */}
      <Box component="svg" viewBox="0 0 440 30" preserveAspectRatio="none" sx={{
        position: 'absolute', bottom: -1, left: 0, right: 0, width: '100%', height: 30,
      }}>
        <path d="M0,30 L0,14 C73,2 146,26 220,14 C293,2 366,24 440,14 L440,30 Z" fill="#fff" />
      </Box>

      {/* Top bar */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ position: 'relative', zIndex: 2 }}>
        <HeroBtn onClick={onClose} title="Chiudi">
          <ArrowBackIcon sx={{ fontSize: 16 }} />
        </HeroBtn>
        <Box sx={{ flex: 1 }} />
        {canChange && !deleted ? (
          <HeroBtn onClick={onEdit} title="Modifica">
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </HeroBtn>
        ) : null}
        {deleted && canDelete ? (
          <HeroBtn onClick={onRestore} disabled={restoreBusy} title="Ripristina">
            <RestoreIcon sx={{ fontSize: 16 }} />
          </HeroBtn>
        ) : canDelete ? (
          <HeroBtn onClick={onDelete} disabled={deleteBusy} danger title="Elimina">
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </HeroBtn>
        ) : null}
      </Stack>

      {/* Title block */}
      <Box sx={{ mt: 1.75, position: 'relative', zIndex: 2 }}>
        {caption ? (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.6, opacity: 0.9 }}>
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: '#ccfbf1',
            }}>{caption}</Typography>
          </Stack>
        ) : null}
        <Typography component="h2" sx={{
          fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15,
          fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
        }}>{title}</Typography>
        {subtitle ? (
          <Typography sx={{
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', mt: 0.4,
          }}>{subtitle}</Typography>
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

  // ── Flag sezioni (mostra solo se c'è dato vero) ──────────────────────────
  const hasIdent = !!(detail?.name || detail?.site_display_name || detail?.site_name || detail?.serial_number)
  const hasNet   = !!(detail?.hostname || detail?.local_ip || detail?.srsa_ip)
  const customFieldsHasContent = detail?.custom_fields && isRecord(detail.custom_fields)
    ? Object.values(detail.custom_fields).some(v => v != null && v !== '')
    : false
  const hasHw    = !!(detail?.manufacturer || detail?.model || detail?.warranty_end_date || customFieldsHasContent)
  const hasCreds = !!(detail?.os_user || detail?.app_usr
    || (canViewSecrets && (detail?.os_pwd || detail?.app_pwd || detail?.vnc_pwd)))
  const hasMonitors = !!(detail?.monitors && detail.monitors.length > 0)
  const hasNotes = !!(detail?.notes || (detail?.tags && detail.tags.length > 0))

  // ── Body: tab Dettagli ───────────────────────────────────────────────────
  const detailContent = detail ? (
    <>
      {detail.has_active_issue ? <IssueAlert /> : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
        {hasIdent ? (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <BSection icon={<FingerprintIcon sx={{ fontSize: 13 }} />} title="Identificazione" accent={ACCENT_IDENT}>
              <BRow label="Nome" value={detail.name} />
              <BRow label="Sede" value={detail.site_display_name || detail.site_name} />
              <BRow label="Seriale" value={detail.serial_number} copy
                onCopy={async () => { await copyToClipboard(detail.serial_number!); toast.success('Seriale copiato ✅') }}
              />
            </BSection>
          </Box>
        ) : null}

        {hasNet ? (
          <BSection icon={<WifiOutlinedIcon sx={{ fontSize: 13 }} />} title="Rete" accent={ACCENT_NET}>
            <BRow label="Hostname" value={detail.hostname} copy
              onCopy={async () => { await copyToClipboard(detail.hostname!); toast.success('Copiato ✅') }} />
            <BRow label="IP locale" value={detail.local_ip} copy
              onCopy={async () => { await copyToClipboard(detail.local_ip!); toast.success('Copiato ✅') }} />
            <BRow label="IP SRSA" value={detail.srsa_ip} copy
              onCopy={async () => { await copyToClipboard(detail.srsa_ip!); toast.success('Copiato ✅') }} />
          </BSection>
        ) : null}

        {hasHw ? (
          <BSection icon={<MemoryOutlinedIcon sx={{ fontSize: 13 }} />} title="Hardware" accent={ACCENT_HW}>
            <BRow label="Produttore" value={detail.manufacturer} />
            <BRow label="Modello" value={detail.model} />
            <BRow label="Garanzia" value={fmtDate(detail.warranty_end_date)} />
            {detail.custom_fields && isRecord(detail.custom_fields)
              ? Object.entries(detail.custom_fields)
                  .filter(([, v]) => v != null && v !== '')
                  .map(([k, v]) => <BRow key={k} label={k} value={String(v)} />)
              : null}
          </BSection>
        ) : null}

        {hasCreds ? (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <BSection icon={<LockOutlinedIcon sx={{ fontSize: 13 }} />} title="Credenziali" accent={ACCENT_CRED}>
              {!canViewSecrets ? (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', mb: 0.75 }}>
                  Password non visibili (permessi insufficienti)
                </Typography>
              ) : null}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                {detail.os_user ? <CredRow label="OS user" value={detail.os_user} /> : null}
                {canViewSecrets && detail.os_pwd ? <CredRow label="OS pwd" value={detail.os_pwd} secret /> : null}
                {detail.app_usr ? <CredRow label="App user" value={detail.app_usr} /> : null}
                {canViewSecrets && detail.app_pwd ? <CredRow label="App pwd" value={detail.app_pwd} secret /> : null}
                {canViewSecrets && detail.vnc_pwd ? (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <CredRow label="VNC pwd" value={detail.vnc_pwd} secret />
                  </Box>
                ) : null}
              </Box>
            </BSection>
          </Box>
        ) : null}

        {hasMonitors ? (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <BSection icon={<MonitorOutlinedIcon sx={{ fontSize: 13 }} />}
              title={`Monitor collegati · ${detail.monitors!.length}`} accent={ACCENT_IDENT}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {detail.monitors!.map(m => (
                  <MonitorTile key={m.id} monitor={m}
                    onClick={onOpenMonitor ? () => onOpenMonitor(m.id) : undefined} />
                ))}
              </Box>
            </BSection>
          </Box>
        ) : null}

        {hasNotes ? (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <BSection icon={<NotesOutlinedIcon sx={{ fontSize: 13 }} />} title="Note" accent={ACCENT_NOTE}>
              {detail.notes ? (
                <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {detail.notes}
                </Typography>
              ) : null}
              {detail.tags && detail.tags.length > 0 ? (
                <Stack direction="row" flexWrap="wrap" spacing={0.75} sx={{ mt: detail.notes ? 1.25 : 0 }}>
                  {detail.tags.map(t => (
                    <Chip key={t} label={`#${t}`} size="small" sx={{
                      height: 22, fontSize: '0.68rem', fontWeight: 600,
                      bgcolor: '#fff', border: '1px solid #e6f0ee',
                      color: TEAL_DEEP, letterSpacing: '0.01em',
                      '& .MuiChip-label': { px: 1 },
                    }} />
                  ))}
                </Stack>
              ) : null}
            </BSection>
          </Box>
        ) : null}
      </Box>
    </>
  ) : null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: DRAWER_WIDTH },
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: '#fff',
        },
      }}
    >
      {KEYFRAMES_STYLE}

      {/* 1. HERO */}
      <Hero
        title={title}
        subtitle={subtitleParts.join(' · ') || undefined}
        caption={detail?.type_label || undefined}
        canChange={canChange}
        canDelete={canDelete}
        deleted={!!detail?.deleted_at}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        onClose={onClose}
        onEdit={onEdit}
        onDelete={onDelete}
        onRestore={onRestore}
      />

      {/* 2. FLOAT CARD K-number (si sovrappone all'hero con mt negativo) */}
      {detail ? (
        <Box sx={{
          mx: 1.75,
          mt: '-22px',
          bgcolor: '#fff',
          borderRadius: 2,
          boxShadow: '0 12px 40px rgba(13,148,136,0.18), 0 2px 6px rgba(13,148,136,0.08)',
          border: '1px solid rgba(13,148,136,0.08)',
          px: 1.5, pt: 1.25, pb: 1.25,
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
        }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 12, color: TEAL }} />
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.17em',
              color: TEAL, textTransform: 'uppercase',
            }}>K-Number identificativo</Typography>
          </Stack>

          {detail.knumber ? (
            <KnumberPlate
              knumber={detail.knumber}
              onClick={async () => {
                await copyToClipboard(detail.knumber!)
                toast.success('K-number copiato ✅')
              }}
            />
          ) : null}

          <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
            <NavBtn
              icon={<BusinessOutlinedIcon sx={{ fontSize: 13 }} />}
              onClick={() => navigate(`/customers${buildQuery({ open: detail.customer, return: loc.pathname + loc.search })}`)}
            >Cliente</NavBtn>
            {detail.site ? (
              <NavBtn
                icon={<PlaceOutlinedIcon sx={{ fontSize: 13 }} />}
                onClick={() => navigate(`/sites${buildQuery({ customer: detail.customer, open: detail.site, return: loc.pathname + loc.search })}`)}
              >Sito</NavBtn>
            ) : null}
            <NavBtn
              outline
              icon={<FilterListIcon sx={{ fontSize: 13 }} />}
              onClick={() => navigate(`/inventory${buildQuery({ customer: detail.customer, site: detail.site ?? '' })}`)}
            >Lista filtrata</NavBtn>
          </Stack>
        </Box>
      ) : null}

      {/* 3. TABS (sotto la float card, sopra il body) */}
      <Box sx={{
        flexShrink: 0,
        px: 2, pt: 1.25,
        bgcolor: BODY_BG,
      }}>
        <Tabs
          value={drawerTab}
          onChange={(_, v) => onTabChange(v)}
          sx={{
            minHeight: 32,
            '& .MuiTab-root': {
              minHeight: 32, py: 0.5, px: 1.5,
              fontSize: '0.72rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#94a3b8',
            },
            '& .Mui-selected': { color: TEAL_DEEP + ' !important' },
            '& .MuiTabs-indicator': { backgroundColor: TEAL, height: 2 },
          }}
        >
          <Tab label="Dettagli" />
          <Tab label="Attività" />
        </Tabs>
      </Box>

      {/* 4. BODY scrollabile */}
      <Box sx={{
        flex: 1, overflow: 'auto',
        bgcolor: BODY_BG,
        px: 2, pt: 1.5, pb: 2.5,
      }}>
        {drawerTab === 0 ? (
          detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <DrawerLoadingState />
            </Box>
          ) : detail ? (
            detailContent
          ) : (
            <DrawerEmptyState />
          )
        ) : null}

        {drawerTab === 1 && selectedId ? (
          <Box sx={{ bgcolor: '#fff', borderRadius: 1.75, border: '1px solid #e6f0ee', p: 1.5 }}>
            <AuditEventsTab appLabel="inventory" model="inventory" objectId={selectedId} />
          </Box>
        ) : null}

        {detailLoading && detail ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={16} sx={{ color: TEAL }} />
          </Box>
        ) : null}
      </Box>
    </Drawer>
  )
}
