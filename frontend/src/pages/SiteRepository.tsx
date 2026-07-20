import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'
import VpnModal from '../features/customers/VpnModal'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditIcon from '@mui/icons-material/Edit'
import StatusChip from '@shared/ui/StatusChip'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { getInventoryTypeIcon, getInventoryTypeFamily } from '@shared/ui/inventoryTypeIcon'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import LeafletMap from '../ui/LeafletMap'
import { isRecord } from '@shared/utils/guards'
import { buildQuery } from '@shared/utils/nav'
import InventoryDrawer from '../features/inventory/InventoryDrawer'
import type { InventoryDetail } from '../features/inventory/types'
import type { CustomerDetail } from '../features/customers/types'
import type { SiteDetail } from '../features/sites/types'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { useSiteRepoV2 } from '../features/siterepov2/SiteRepoV2Context'
import type { SiteRepoV2Handle } from '../features/siterepov2/SiteRepoV2Context'

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerRow = {
  id: number
  code: string
  name: string
  display_name: string
  city?: string | null
  primary_contact_name?: string | null
  primary_contact_phone?: string | null
  status?: number | null
  status_key?: string | null
  status_label?: string | null
  has_vpn?: boolean | null
  tags?: string[] | null
  notes?: string | null
  // Contatori annotati dal backend (crm/api.py, _count_subquery).
  assets_count?: number
  sites_count?: number
  active_issue_count?: number
}

type SiteRow = {
  id: number
  name: string
  display_name?: string | null
  city?: string | null
  postal_code?: string | null
  address_line1?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  status?: number | null
  status_label?: string | null
  customer?: number | null
}

type InventoryRow = {
  id: number
  hostname?: string | null
  name: string
  local_ip?: string | null
  srsa_ip?: string | null
  type_key?: string | null
  type_label?: string | null
  status_key?: string | null
  status_label?: string | null
  customer?: number | null
  site?: number | null
  site_name?: string | null
  knumber?: string | null
  serial_number?: string | null
  has_active_issue?: boolean
  active_issue_priority?: string | null
  deleted_at?: string | null
}

type CityGroup = {
  city: string
  province?: string | null
  customers: CustomerRow[]
  issueCount: number
}

type StatusFilter = 'all' | 'attivo' | 'manutenzione' | 'inattivo'

// ─── Palette semantica (derivata dal tema) ─────────────────────────────────────
//
// I badge della pagina si dividono in due famiglie di peso visivo, non in una
// lista piatta di colori:
//
//  · "segnale" (SignalChip)  → stato operativo o criticità: Attivo/In uso/
//    Manutenzione, issue aperte. Peso alto: fondo saturo, bordo colorato,
//    testo bold. Sono le uniche informazioni che devono "saltare all'occhio".
//
//  · "meta"    (MetaTag / CountStat) → informazione strutturale o di conteggio:
//    tipo asset, tag cliente, contatori siti/asset. Peso basso: outline neutro
//    o pura tipografia, nessun fondo saturo.
//
// Tutti i colori derivano da theme.palette (nessun hex ad-hoc).

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

function toneColors(theme: Theme, tone: Tone) {
  if (tone === 'neutral') {
    return {
      bg: theme.palette.grey[100],
      fg: theme.palette.text.secondary,
      border: theme.palette.divider,
      solid: theme.palette.text.secondary,
    }
  }
  const p = theme.palette[tone]
  return {
    bg: alpha(p.main, 0.12),
    fg: p.dark,
    border: alpha(p.main, 0.3),
    solid: p.main,
  }
}

function inventoryStatusTone(statusKey?: string | null): Tone {
  switch (statusKey) {
    case 'in_use':      return 'success'
    case 'maintenance': return 'warning'
    case 'repair':      return 'error'
    case 'spare':        return 'info'
    default:              return 'neutral' // retired, storage, sconosciuto
  }
}

function siteStatusTone(label?: string | null): Tone {
  const l = (label ?? '').toLowerCase()
  if (l === 'attivo' || l === 'active')            return 'success'
  if (l === 'manutenzione' || l === 'maintenance') return 'warning'
  return 'neutral' // inattivo, sconosciuto
}

function issuePriorityTone(priority?: string | null): Tone {
  switch (priority) {
    case 'critical': return 'error'
    case 'high':      return 'error'
    case 'medium':    return 'warning'
    default:           return 'neutral' // low
  }
}

const COL_GRID = '160px 180px 180px 110px 150px 130px 130px 130px'

// ─── Scala tipografica ──────────────────────────────────────────────────────────
//
// Prima ogni testo aveva un fontSize scelto a mano (0.6/0.68/0.72/0.78/0.82/
// 0.975/1rem...), senza relazione tra loro né con le variant del tema — con il
// risultato che elementi con lo stesso ruolo (es. nome sito vs nome asset)
// finivano a dimensioni diverse. Un'unica scala a 5 livelli, usata ovunque:
//
//   micro   10px  intestazioni colonna, didascalie sotto i contatori
//   label   11px  badge/chip, tab
//   body    12px  testo di riga: nomi, indirizzi, contatti — E campi tecnici
//                 monospace (K#, Seriale, IP, codice cliente): stessa taglia,
//                 stesso peso, per allineamento visivo nella riga
//   title   13px  enfasi di riga: nome cliente, valore dei contatori
//   section 15px  titolo di sezione: nome città

const FS = {
  micro:   '0.625rem',
  label:   '0.6875rem',
  body:    '0.75rem',
  title:   '0.8125rem',
  section: '0.9375rem',
} as const

// Scala icone — 3 livelli invece di 6 valori sparsi (12/13/14/15/16/18px)
const ICON = {
  inline: 14, // icone dentro badge/celle (copia IP, tipo asset, warning issue)
  action: 16, // controlli espandi/comprimi
  feature: 18, // icone di funzione autonome (nota, VPN, pin città)
} as const

// Stile condiviso per tutti i campi tecnici monospace (K#, Seriale, IP, codice
// cliente): un'unica fonte di verità così restano sempre identici tra loro.
const monoFieldSx = {
  fontFamily: 'monospace',
  fontSize: FS.body,
  color: 'text.secondary',
  overflow: 'hidden' as const,
  textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
}

function MonoField({ value, sx }: { value?: string | null; sx?: object }) {
  return (
    <Typography sx={{ ...monoFieldSx, ...sx }}>
      {value || '—'}
    </Typography>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCity(city?: string | null): string {
  return (city ?? 'Senza città').trim() || 'Senza città'
}

function matchesSearch(q: string, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true
  const lq = q.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(lq))
}

function matchesStatusFilter(filter: StatusFilter, statusLabel?: string | null): boolean {
  if (filter === 'all') return true
  const lbl = (statusLabel ?? '').toLowerCase()
  if (filter === 'attivo')       return lbl === 'attivo'
  if (filter === 'manutenzione') return lbl === 'manutenzione'
  if (filter === 'inattivo')     return lbl === 'inattivo'
  return true
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

// ─── SignalChip — badge "segnale" ──────────────────────────────────────────────

function SignalChip({
  label, tone, icon, inverse, sx,
}: {
  label: React.ReactNode
  tone: Tone
  icon?: React.ReactElement
  inverse?: boolean
  sx?: object
}) {
  const theme = useTheme()
  const c = toneColors(theme, tone)
  if (inverse) {
    // Variante per header a fondo pieno (es. sezione città aperta): outline chiaro su fondo scuro
    return (
      <Chip
        size="small"
        icon={icon}
        label={label}
        sx={{
          height: 22, fontSize: FS.label, fontWeight: 700,
          bgcolor: 'rgba(255,255,255,0.16)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.32)',
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: '#fff', fontSize: ICON.inline, ml: '4px' },
          ...sx,
        }}
      />
    )
  }
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        height: 22, fontSize: FS.label, fontWeight: 700,
        bgcolor: c.bg, color: c.fg,
        border: `1px solid ${c.border}`,
        '& .MuiChip-label': { px: 0.75 },
        '& .MuiChip-icon': { color: c.fg, fontSize: ICON.inline, ml: '4px' },
        ...sx,
      }}
    />
  )
}

// ─── MetaTag — badge "meta tray" ────────────────────────────────────────────────

function MetaTag({
  label, icon, inverse, onClick, sx,
}: {
  label: React.ReactNode
  icon?: React.ReactElement
  inverse?: boolean
  onClick?: (e: React.MouseEvent) => void
  sx?: object
}) {
  if (inverse) {
    return (
      <Chip
        size="small"
        icon={icon}
        label={label}
        variant="outlined"
        onClick={onClick}
        sx={{
          height: 22, fontSize: FS.label, fontWeight: 700,
          bgcolor: 'transparent', color: 'rgba(255,255,255,0.92)',
          borderColor: 'rgba(255,255,255,0.32)',
          cursor: onClick ? 'pointer' : 'default',
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { color: 'rgba(255,255,255,0.85)', fontSize: ICON.inline, ml: '4px' },
          ...(onClick ? { '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' } } : {}),
          ...sx,
        }}
      />
    )
  }
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      variant="outlined"
      onClick={onClick}
      sx={{
        height: 22, fontSize: FS.label, fontWeight: 600,
        bgcolor: 'background.paper', color: 'text.secondary',
        borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        '& .MuiChip-label': { px: 0.75 },
        '& .MuiChip-icon': { color: 'text.secondary', fontSize: ICON.inline, ml: '4px' },
        ...(onClick ? { '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', color: 'primary.main' } } : {}),
        ...sx,
      }}
    />
  )
}

// ─── ActionButton — pulsante quadrato Info/Modifica ─────────────────────────────

function ActionButton({
  icon, tone = 'neutral', onClick, ariaLabel, title,
}: {
  icon: React.ReactElement
  tone?: 'info' | 'neutral' | 'success' | 'danger'
  onClick?: (e: React.MouseEvent) => void
  ariaLabel: string
  title?: string
}) {
  const theme = useTheme()
  const paletteColor = {
    info: theme.palette.info,
    success: theme.palette.success,
    danger: theme.palette.error,
  }[tone as 'info' | 'success' | 'danger']
  const isNeutral = tone === 'neutral'
  const btn = (
    <IconButton
      size="small"
      aria-label={ariaLabel}
      onClick={onClick}
      sx={{
        width: 32, height: 32, p: 0, borderRadius: '8px', flexShrink: 0,
        border: '1px solid',
        borderColor: isNeutral ? alpha(theme.palette.text.secondary, 0.28) : alpha(paletteColor.main, 0.28),
        bgcolor: isNeutral ? 'background.paper' : alpha(paletteColor.main, 0.10),
        color: isNeutral ? 'text.secondary' : paletteColor.dark,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? {
          bgcolor: isNeutral ? 'action.hover' : alpha(paletteColor.main, 0.20),
          borderColor: isNeutral ? 'text.secondary' : paletteColor.main,
          color: isNeutral ? 'primary.main' : paletteColor.dark,
        } : {},
        '& svg': { fontSize: ICON.feature },
      }}
    >
      {icon}
    </IconButton>
  )
  return title ? <Tooltip title={title} arrow>{btn}</Tooltip> : btn
}

// ─── CountStat — metrica numerica silenziosa (siti/asset) ──────────────────────
// Il grado più leggero della gerarchia "meta": nessun contenitore, solo peso
// tipografico. Riservato a contatori puramente informativi.

function CountStat({
  value, label, tooltip, onClick,
}: {
  value: number | string
  label: string
  tooltip: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <Tooltip title={tooltip} arrow>
      <Box
        onClick={onClick}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: 42, px: 0.5, py: 0.25, borderRadius: '6px',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'background 0.15s',
          '&:hover': onClick ? { bgcolor: 'action.hover' } : undefined,
        }}
      >
        <Typography sx={{ fontWeight: 800, lineHeight: 1, fontSize: FS.title, color: 'text.primary' }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: FS.micro, fontWeight: 700, color: 'text.secondary', opacity: 0.85, lineHeight: 1.3, letterSpacing: '0.05em' }}>
          {label.toUpperCase()}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ─── IpCell ───────────────────────────────────────────────────────────────────
// Stessa taglia/fontFamily dei campi K#/Seriale (monoFieldSx): l'IP è un campo
// tecnico come gli altri, deve avere lo stesso peso visivo in riga.

function IpCell({ ip }: { ip?: string | null }) {
  if (!ip) return <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <MonoField value={ip} sx={{ color: 'text.primary' }} />
      <Tooltip title="Copia IP">
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); void copyText(ip) }}
          sx={{ opacity: 0.35, '&:hover': { opacity: 1 }, p: 0.25 }}>
          <ContentCopyIcon sx={{ fontSize: ICON.inline }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

// ─── ActiveIssueIcon ──────────────────────────────────────────────────────────

function ActiveIssueIcon({ priority }: { priority?: string | null }) {
  const theme = useTheme()
  const c = toneColors(theme, issuePriorityTone(priority))
  const label = priority === 'critical' ? 'Issue critica aperta'
    : priority === 'high'   ? 'Issue alta priorità aperta'
    : priority === 'low'    ? 'Issue a bassa priorità aperta'
    : "C'è almeno una issue aperta."
  return (
    <Tooltip title={label}>
      <WarningAmberRoundedIcon sx={{ color: c.solid, fontSize: ICON.inline, flexShrink: 0 }} />
    </Tooltip>
  )
}

// ─── InventoryInlineList ──────────────────────────────────────────────────────

function InventoryInlineList({
  rows,
  onOpenDrawer,
  onRowContextMenu,
}: {
  rows: InventoryRow[]
  onOpenDrawer: (id: number) => void
  onRowContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
}) {
  const theme = useTheme()

  if (!rows.length) return (
    <Box sx={{ px: 3, py: 1.5 }}>
      <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>Nessun asset in questo sito.</Typography>
    </Box>
  )

  return (
    <Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: COL_GRID,
        px: 3, py: 0.625,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        {['TIPO', 'NOME', 'HOSTNAME', 'K#', 'SERIALE', 'STATO', 'IP LOCALE', 'IP SRSA'].map((h) => (
          <Typography key={h}
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: FS.micro }}>
            {h}
          </Typography>
        ))}
      </Box>

      {rows.map((row, idx) => {
        const TypeIcon  = getInventoryTypeIcon(row.type_key)
        const typeLabel = row.type_label ?? ''
        const typeFamily = getInventoryTypeFamily(row.type_key)
        const zebraBg = idx % 2 === 0 ? 'background.paper' : 'grey.50'
        const issueColor = row.has_active_issue ? toneColors(theme, issuePriorityTone(row.active_issue_priority)) : null

        return (
          <Box
            key={row.id}
            onClick={() => onOpenDrawer(row.id)}
            onContextMenu={(e) => { e.preventDefault(); onRowContextMenu(row, e) }}
            sx={{
              display: 'grid',
              gridTemplateColumns: COL_GRID,
              px: 3, py: 0.75,
              alignItems: 'center',
              borderBottom: idx < rows.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              cursor: 'pointer',
              bgcolor: zebraBg,
              // Indicatore "segnale" per asset con issue attiva: barra inset, nessuno shift di layout
              boxShadow: issueColor ? `inset 3px 0 0 ${issueColor.solid}` : 'none',
              transition: 'background 0.12s',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
            }}
          >
            {/* Tipo — badge a sfondo pieno per famiglia, larghezza fissa per coerenza in colonna */}
            <Box>
              {typeLabel ? (
                <Tooltip title={`${typeLabel} — ${typeFamily.label}`} arrow>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    width: 132, height: 22, px: 1, borderRadius: '6px',
                    bgcolor: typeFamily.color,
                    color: '#fff',
                  }}>
                    <TypeIcon sx={{ fontSize: `${ICON.inline}px !important`, color: '#fff', flexShrink: 0 }} />
                    <Typography sx={{
                      fontSize: FS.micro, fontWeight: 600, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {typeLabel}
                    </Typography>
                  </Box>
                </Tooltip>
              ) : (
                <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
              )}
            </Box>

            {/* Nome */}
            <Typography sx={{
              fontSize: FS.body,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.name || '—'}
            </Typography>

            {/* Hostname */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
              {row.has_active_issue && <ActiveIssueIcon priority={row.active_issue_priority} />}
              <Typography fontWeight={500} sx={{
                color: 'primary.main', fontSize: FS.body,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' },
              }}>
                {row.hostname || '—'}
              </Typography>
            </Box>

            {/* K# */}
            <MonoField value={row.knumber} />

            {/* Seriale */}
            <MonoField value={row.serial_number} />

            {/* Stato — badge "segnale": è lo stato operativo dell'asset */}
            <Box>
              {row.status_label ? (
                <SignalChip label={row.status_label} tone={inventoryStatusTone(row.status_key)} />
              ) : (
                <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
              )}
            </Box>

            {/* IP Locale */}
            <IpCell ip={row.local_ip} />

            {/* IP SRSA */}
            <IpCell ip={row.srsa_ip} />
          </Box>
        )
      })}
    </Box>
  )
}

// ─── CollapsibleSiteRow ───────────────────────────────────────────────────────

type CollapsibleSiteRowProps = {
  site: SiteRow
  allInventory: InventoryRow[]
  searchQuery: string
  statusFilter: StatusFilter
  onOpenDrawer: (id: number) => void
  onOpenSite: (id: number) => void
  canViewSite: boolean
  canChangeSite: boolean
  onEditSite: (id: number) => void
  onSiteContextMenu: (site: SiteRow, e: React.MouseEvent) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  isLast: boolean
  rowIndex: number
  forceOpen?: boolean
  matchedAssetIds?: Set<number>
}

const SITE_COL = '1fr 120px 80px 200px 140px'
const SITE_HEADERS = ['SITO', 'CITTÀ', 'CAP', 'CONTATTO', 'STATO']

function CollapsibleSiteRow({
  site, allInventory, searchQuery, statusFilter, onOpenDrawer, onOpenSite, canViewSite,
  canChangeSite, onEditSite,
  onSiteContextMenu, onInventoryContextMenu, isLast, rowIndex,
  forceOpen, matchedAssetIds,
}: CollapsibleSiteRowProps) {
  const theme = useTheme()
  const [open, setOpen] = React.useState(false)

  // Auto-open quando c'è una ricerca attiva
  React.useEffect(() => {
    if (forceOpen) setOpen(true)
    else setOpen(false)
  }, [forceOpen])

  const siteInventory = React.useMemo(
    () => allInventory.filter((inv) => inv.site === site.id),
    [allInventory, site.id],
  )
  const totalCount = siteInventory.length
  const issueCount = React.useMemo(
    () => siteInventory.filter((inv) => inv.has_active_issue).length,
    [siteInventory],
  )

  const siteAssets = React.useMemo(
    () => siteInventory.filter((inv) => {
      if (!matchesStatusFilter(statusFilter, inv.status_label)) return false
      // Se c'è un set di asset matchanti, mostra solo quelli
      if (matchedAssetIds && matchedAssetIds.size > 0) return matchedAssetIds.has(inv.id)
      // Altrimenti filtra per searchQuery normalmente
      if (!matchesSearch(searchQuery, inv.hostname, inv.name, inv.local_ip, inv.srsa_ip)) return false
      return true
    }),
    [siteInventory, searchQuery, statusFilter, matchedAssetIds],
  )

  const contactLabel = site.primary_contact_name || site.primary_contact_email || site.primary_contact_phone || ''
  const contactTooltip = [site.primary_contact_email, site.primary_contact_phone].filter(Boolean).join(' · ')

  return (
    <Box sx={{ borderBottom: isLast ? 'none' : '1px solid', borderColor: 'divider' }}>
      {/* Riga sito */}
      <Box
        onClick={() => setOpen((p) => !p)}
        onContextMenu={(e) => { e.preventDefault(); onSiteContextMenu(site, e) }}
        sx={{
          display: 'grid',
          gridTemplateColumns: SITE_COL,
          alignItems: 'center',
          px: 2, py: 0.9,
          cursor: 'pointer',
          bgcolor: open ? alpha(theme.palette.primary.main, 0.04) : (rowIndex % 2 === 1 ? 'grey.50' : 'background.paper'),
          transition: 'background 0.12s',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
          gap: 1,
        }}
      >
        {/* Sito — nome + expand icon + chip info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <IconButton size="small" sx={{ flexShrink: 0, p: 0.25 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={600} sx={{
              fontSize: FS.body,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {site.display_name || site.name}
            </Typography>
            {site.address_line1 && (
              <Typography color="text.secondary" sx={{
                fontSize: FS.micro,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              }}>
                {site.address_line1}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0 }}>
            {canViewSite && (
              <Tooltip title="Apri scheda sito" arrow>
                <ActionButton
                  tone="info"
                  icon={<InfoOutlinedIcon />}
                  ariaLabel="Info sito"
                  onClick={(e) => { e.stopPropagation(); onOpenSite(site.id) }}
                />
              </Tooltip>
            )}
            {canChangeSite && (
              <Tooltip title="Modifica sito" arrow>
                <ActionButton
                  tone="neutral"
                  icon={<EditIcon />}
                  ariaLabel="Modifica sito"
                  onClick={(e) => { e.stopPropagation(); onEditSite(site.id) }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Città */}
        <Typography color="text.secondary" sx={{
          fontSize: FS.body,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {site.city || '—'}
        </Typography>

        {/* CAP */}
        <Typography color="text.secondary" sx={{ fontSize: FS.body }}>
          {site.postal_code || '—'}
        </Typography>

        {/* Contatto — cliccabile: apre la scheda sito (stessa sorgente del chip Info) */}
        {!contactLabel ? (
          <SignalChip
            tone="warning"
            icon={<WarningAmberRoundedIcon />}
            label="Nessun contatto"
          />
        ) : contactTooltip ? (
          <Tooltip title={contactTooltip} arrow>
            <Typography
              onClick={canViewSite ? (e) => { e.stopPropagation(); onOpenSite(site.id) } : undefined}
              sx={{
                fontSize: FS.body,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: canViewSite ? 'pointer' : 'default',
                ...(canViewSite ? { color: 'primary.main', '&:hover': { textDecoration: 'underline' } } : {}),
              }}
            >
              {contactLabel}
            </Typography>
          </Tooltip>
        ) : (
          <Typography
            onClick={canViewSite ? (e) => { e.stopPropagation(); onOpenSite(site.id) } : undefined}
            sx={{
              fontSize: FS.body,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: canViewSite ? 'pointer' : 'default',
              ...(canViewSite ? { color: 'primary.main', '&:hover': { textDecoration: 'underline' } } : {}),
            }}
          >
            {contactLabel}
          </Typography>
        )}

        {/* Stato + contatore */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {site.status_label ? (
            <SignalChip label={site.status_label} tone={siteStatusTone(site.status_label)} />
          ) : (
            <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
          )}
          {/* Contatore: "segnale" (rosso, issue·totale) se ci sono issue attive, altrimenti "meta" neutro */}
          {issueCount > 0 ? (
            <SignalChip
              tone="error"
              icon={<WarningAmberRoundedIcon />}
              label={`${issueCount}·${totalCount}`}
              sx={{ ml: 'auto' }}
            />
          ) : (
            <MetaTag label={`${totalCount}`} sx={{ ml: 'auto' }} />
          )}
        </Box>
      </Box>

      {/* Lista asset */}
      <Collapse in={open} unmountOnExit>
        <InventoryInlineList rows={siteAssets} onOpenDrawer={onOpenDrawer} onRowContextMenu={onInventoryContextMenu} />
      </Collapse>
    </Box>
  )
}

// ─── SitesWithInventoryTab ────────────────────────────────────────────────────

type SitesWithInventoryTabProps = {
  customerId: number
  searchQuery: string
  statusFilter: StatusFilter
  onOpenDrawer: (id: number) => void
  onOpenSite: (id: number) => void
  canViewSite: boolean
  canChangeSite: boolean
  onEditSite: (id: number) => void
  onSiteContextMenu: (site: SiteRow, e: React.MouseEvent) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  // Cambia dopo un delete nel Site Repository: forza il refetch dei dati del
  // cliente (prima arrivava implicitamente via le prop preloaded* globali).
  refreshToken: number
}

function SitesWithInventoryTab({
  customerId, searchQuery, statusFilter, onOpenDrawer, onOpenSite, canViewSite,
  canChangeSite, onEditSite,
  onSiteContextMenu, onInventoryContextMenu, refreshToken,
}: SitesWithInventoryTabProps) {
  const [sites, setSites]         = React.useState<SiteRow[]>([])
  const [inventory, setInventory] = React.useState<InventoryRow[]>([])
  const [loading, setLoading]     = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/sites/',       { params: { customer: customerId, page_size: 100 } }),
      api.get('/inventories/', { params: { customer: customerId, page_size: 200 } }),
    ]).then(([sRes, iRes]) => {
      if (cancelled) return
      setSites(sRes.data?.results ?? [])
      setInventory(iRes.data?.results ?? [])
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customerId, refreshToken])

  // Gli hook devono stare PRIMA di qualsiasi return condizionale (regole degli
  // hook): con loading iniziale a true, un early-return prima di questi useMemo
  // farebbe girare un numero di hook diverso tra i render → React error #310.
  const matchedAssetIds = React.useMemo(() => {
    if (!searchQuery) return null
    const ids = new Set<number>()
    inventory.forEach((inv) => {
      if (matchesSearch(searchQuery, inv.hostname, inv.name, inv.local_ip, inv.srsa_ip, inv.serial_number, inv.knumber))
        ids.add(inv.id)
    })
    return ids
  }, [inventory, searchQuery])

  // Siti visibili: quelli che matchano per nome/città OPPURE hanno asset matchanti
  const visibleSites = React.useMemo(() => {
    if (!searchQuery) return sites
    return sites.filter((s) => {
      if (matchesSearch(searchQuery, s.name, s.display_name, s.city, s.address_line1)) return true
      if (matchedAssetIds && inventory.some((inv) => inv.site === s.id && matchedAssetIds.has(inv.id))) return true
      return false
    })
  }, [sites, searchQuery, matchedAssetIds, inventory])

  // Set di asset matchanti per sito specifico (null = mostra tutti)
  const assetIdsForSite = React.useMemo(() => {
    if (!searchQuery || !matchedAssetIds) return null
    return matchedAssetIds
  }, [searchQuery, matchedAssetIds])

  if (loading) return (
    <Box sx={{ py: 2, px: 2 }}>
      {[1, 2].map((i) => <Skeleton key={i} height={44} sx={{ mb: 0.5 }} />)}
    </Box>
  )

  if (!sites.length) return (
    <Box sx={{ py: 2, px: 2 }}>
      <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>Nessun sito registrato.</Typography>
    </Box>
  )

  const orphans = inventory.filter((inv) => !inv.site)

  const hasSearch = Boolean(searchQuery)

  return (
    <Box>
      {/* Header colonne */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: SITE_COL,
        px: 2, py: 0.625,
        bgcolor: 'grey.50',
        borderBottom: '1px solid', borderColor: 'divider',
        gap: 1,
      }}>
        {SITE_HEADERS.map((h) => (
          <Typography key={h}
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: FS.micro }}>
            {h}
          </Typography>
        ))}
      </Box>

      {visibleSites.map((site, idx) => (
        <CollapsibleSiteRow
          key={site.id}
          site={site}
          allInventory={inventory}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onOpenDrawer={onOpenDrawer}
          onOpenSite={onOpenSite}
          canViewSite={canViewSite}
          canChangeSite={canChangeSite}
          onEditSite={onEditSite}
          onSiteContextMenu={onSiteContextMenu}
          onInventoryContextMenu={onInventoryContextMenu}
          isLast={idx === visibleSites.length - 1 && orphans.length === 0}
          rowIndex={idx}
          forceOpen={hasSearch}
          matchedAssetIds={assetIdsForSite ?? undefined}
        />
      ))}

      {orphans.length > 0 && (() => {
        const filteredOrphans = orphans.filter((r) =>
          matchesStatusFilter(statusFilter, r.status_label) &&
          matchesSearch(searchQuery, r.hostname, r.name, r.local_ip, r.srsa_ip)
        )
        return filteredOrphans.length > 0 ? (
          <>
            <Box sx={{ px: 2, py: 0.75, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography
                sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: FS.micro }}>
                ASSET SENZA SITO
              </Typography>
            </Box>
            <InventoryInlineList rows={filteredOrphans} onOpenDrawer={onOpenDrawer} onRowContextMenu={onInventoryContextMenu} />
          </>
        ) : null
      })()}

      {/* Nessun risultato */}
      {visibleSites.length === 0 && !orphans.length && searchQuery && (
        <Box sx={{ py: 2, px: 2 }}>
          <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>Nessun sito o asset corrisponde alla ricerca.</Typography>
        </Box>
      )}
    </Box>
  )
}

// ─── InventoryFlatTab ─────────────────────────────────────────────────────────

type InventoryTabProps = {
  customerId: number
  searchQuery: string
  statusFilter: StatusFilter
  onOpenDrawer: (id: number) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  refreshToken: number
}

function InventoryFlatTab({ customerId, searchQuery, statusFilter, onOpenDrawer, onInventoryContextMenu, refreshToken }: InventoryTabProps) {
  const [rows, setRows]       = React.useState<InventoryRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/inventories/', { params: { customer: customerId, page_size: 200 } })
      .then((res) => { if (!cancelled) setRows(res.data?.results ?? []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customerId, refreshToken])

  // useMemo prima dell'early-return su loading: stesso vincolo di
  // SitesWithInventoryTab (React error #310 con loading iniziale a true).
  const filtered = React.useMemo(() => {
    if (!searchQuery) return rows.filter((r) => matchesStatusFilter(statusFilter, r.status_label))
    return rows.filter((r) =>
      matchesStatusFilter(statusFilter, r.status_label) &&
      matchesSearch(searchQuery, r.hostname, r.name, r.local_ip, r.srsa_ip, r.site_name, r.serial_number, r.knumber)
    )
  }, [rows, searchQuery, statusFilter])

  if (loading) return (
    <Box sx={{ py: 2, px: 2 }}>
      {[1, 2, 3].map((i) => <Skeleton key={i} height={36} sx={{ mb: 0.5 }} />)}
    </Box>
  )

  if (!filtered.length) return (
    <Box sx={{ py: 2, px: 2 }}>
      <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>
        {rows.length ? 'Nessun asset corrisponde ai filtri.' : 'Nessun asset registrato.'}
      </Typography>
    </Box>
  )

  return <InventoryInlineList rows={filtered} onOpenDrawer={onOpenDrawer} onRowContextMenu={onInventoryContextMenu} />
}


// ─── CustomerCard ─────────────────────────────────────────────────────────────

type CustomerCardProps = {
  customer: CustomerRow
  searchQuery: string
  statusFilter: StatusFilter
  assetCount: number | null
  siteCount: number | null
  issueCount: number
  onOpenDrawer: (id: number) => void
  onOpenVpn: (customer: CustomerRow) => void
  onOpenCustomer: (id: number) => void
  onOpenSite: (id: number) => void
  canViewCustomer: boolean
  canViewSite: boolean
  canChangeCustomer: boolean
  onEditCustomer: (id: number) => void
  canChangeSite: boolean
  onEditSite: (id: number) => void
  onCustomerContextMenu: (customer: CustomerRow, e: React.MouseEvent) => void
  onSiteContextMenu: (site: SiteRow, e: React.MouseEvent) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  rowIndex: number
  isLast: boolean
  refreshToken: number
}

function CustomerCard({
  customer, searchQuery, statusFilter, assetCount, siteCount, issueCount, onOpenDrawer, onOpenVpn,
  onOpenCustomer, onOpenSite, canViewCustomer, canViewSite,
  canChangeCustomer, onEditCustomer, canChangeSite, onEditSite,
  onCustomerContextMenu, onSiteContextMenu, onInventoryContextMenu,
  rowIndex, isLast, refreshToken,
}: CustomerCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = React.useState(false)
  const [tab, setTab] = React.useState(0)

  // Auto-open se c'è una ricerca attiva
  React.useEffect(() => {
    if (searchQuery) setExpanded(true)
    else setExpanded(false)
  }, [searchQuery])

  const zebraBg = rowIndex % 2 === 0 ? 'background.paper' : alpha(theme.palette.primary.main, 0.025)

  return (
    <Box sx={{
      borderBottom: isLast ? 'none' : '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
      bgcolor: expanded ? alpha(theme.palette.primary.main, 0.04) : zebraBg,
      transition: 'background 0.15s',
    }}>
      <Box
        onClick={() => setExpanded((p) => !p)}
        onContextMenu={(e) => { e.preventDefault(); onCustomerContextMenu(customer, e) }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.25, cursor: 'pointer',
          bgcolor: 'transparent',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography fontWeight={600} sx={{
              fontSize: FS.title,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {customer.display_name || customer.name}
            </Typography>
            <MonoField value={customer.code} sx={{ flexShrink: 0 }} />
            {(customer.tags ?? []).length > 0 && (
              <MetaTag label={(customer.tags ?? [])[0]} sx={{ flexShrink: 0 }} />
            )}
            <StatusChip statusId={customer.status ?? undefined} label={customer.status_label} size="small" sx={{ flexShrink: 0 }} />
          </Box>
          {customer.primary_contact_name && (
            <Typography
              onClick={canViewCustomer ? (e) => { e.stopPropagation(); onOpenCustomer(customer.id) } : undefined}
              sx={{
                fontSize: FS.micro,
                color: canViewCustomer ? 'primary.main' : 'text.secondary',
                cursor: canViewCustomer ? 'pointer' : 'default',
                width: 'fit-content',
                ...(canViewCustomer ? { '&:hover': { textDecoration: 'underline' } } : {}),
              }}
            >
              {customer.primary_contact_name}
              {customer.primary_contact_phone ? ` · ${customer.primary_contact_phone}` : ''}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>

          {/* Pulsanti azione — stessa dimensione, raggruppati */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {canViewCustomer && (
              <Tooltip title="Apri scheda cliente" arrow>
                <ActionButton
                  tone="info"
                  icon={<InfoOutlinedIcon />}
                  ariaLabel="Info cliente"
                  onClick={(e) => { e.stopPropagation(); onOpenCustomer(customer.id) }}
                />
              </Tooltip>
            )}
            {canChangeCustomer && (
              <Tooltip title="Modifica cliente" arrow>
                <ActionButton
                  tone="neutral"
                  icon={<EditIcon />}
                  ariaLabel="Modifica cliente"
                  onClick={(e) => { e.stopPropagation(); onEditCustomer(customer.id) }}
                />
              </Tooltip>
            )}

            {/* Note — solo icona, tooltip con testo. Segnalazione soft (warning) */}
            {customer.notes && customer.notes.trim().length > 0 && (
              <Tooltip title={customer.notes.length > 120 ? customer.notes.slice(0, 120) + '…' : customer.notes} arrow>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                  bgcolor: alpha(theme.palette.warning.main, 0.10),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`,
                  cursor: 'default',
                }}>
                  <NoteAltOutlinedIcon sx={{ fontSize: ICON.feature, color: theme.palette.warning.dark }} />
                </Box>
              </Tooltip>
            )}

            {/* VPN — solo icona, click apre VpnModal */}
            {customer.has_vpn && (
              <Tooltip title="Visualizza VPN" arrow>
                <Box
                  onClick={(e) => { e.stopPropagation(); onOpenVpn(customer) }}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                    bgcolor: alpha(theme.palette.success.main, 0.10),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.28)}`,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.20) },
                  }}
                >
                  <VpnLockIcon sx={{ fontSize: ICON.feature, color: theme.palette.success.dark }} />
                </Box>
              </Tooltip>
            )}
          </Box>

          {/* Issue attive — pulsante quadrato, conteggio solo in tooltip */}
          {issueCount > 0 && (
            <ActionButton
              tone="danger"
              icon={<WarningAmberRoundedIcon />}
              ariaLabel={`${issueCount} issue attive`}
              title={`${issueCount} issue attiv${issueCount === 1 ? 'a' : 'e'}`}
              onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            />
          )}

          {/* Contatori siti/asset — spinti tutto a destra, subito prima dell'expand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexShrink: 0 }}>
            <CountStat
              value={siteCount ?? '—'}
              label="siti"
              tooltip="Vai ai siti"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setTab(0) }}
            />
            <CountStat
              value={assetCount ?? '—'}
              label="asset"
              tooltip="Vai agli asset"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setTab(siteCount ? 1 : 0) }}
            />
          </Box>

          <IconButton size="small" sx={{ ml: 0.25 }}>
            {expanded ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {/* Se il cliente non ha siti: mostra direttamente l'inventario flat, senza tab */}
          {(siteCount === 0 || siteCount === null) ? (
            <InventoryFlatTab
              customerId={customer.id}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onOpenDrawer={onOpenDrawer}
              onInventoryContextMenu={onInventoryContextMenu}
              refreshToken={refreshToken}
            />
          ) : (
            <>
              <Tabs
                value={tab}
                onChange={(_, v: number) => setTab(v)}
                sx={{
                  px: 2, minHeight: 36,
                  borderBottom: '1px solid', borderColor: 'divider',
                  '& .MuiTab-root': {
                    minHeight: 36, fontSize: FS.label, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', py: 0,
                  },
                }}
              >
                <Tab label={`Siti ${siteCount}`} />
                <Tab label={`Inventario${assetCount != null ? ` ${assetCount}` : ''}`} />
              </Tabs>

              {tab === 0 && (
                <SitesWithInventoryTab
                  customerId={customer.id}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  onOpenDrawer={onOpenDrawer}
                  onOpenSite={onOpenSite}
                  canViewSite={canViewSite}
                  canChangeSite={canChangeSite}
                  onEditSite={onEditSite}
                  onSiteContextMenu={onSiteContextMenu}
                  onInventoryContextMenu={onInventoryContextMenu}
                  refreshToken={refreshToken}
                />
              )}
              {tab === 1 && (
                <InventoryFlatTab
                  customerId={customer.id}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  onOpenDrawer={onOpenDrawer}
                  onInventoryContextMenu={onInventoryContextMenu}
                  refreshToken={refreshToken}
                />
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

// ─── CitySection ──────────────────────────────────────────────────────────────

type CitySectionProps = {
  group: CityGroup
  searchQuery: string
  statusFilter: StatusFilter
  counts: Record<number, { assets: number | null; sites: number | null }>
  issueCounts: Record<number, number>
  onOpenDrawer: (id: number) => void
  onOpenVpn: (customer: CustomerRow) => void
  onOpenCustomer: (id: number) => void
  onOpenSite: (id: number) => void
  canViewCustomer: boolean
  canViewSite: boolean
  canChangeCustomer: boolean
  onEditCustomer: (id: number) => void
  canChangeSite: boolean
  onEditSite: (id: number) => void
  onCustomerContextMenu: (customer: CustomerRow, e: React.MouseEvent) => void
  onSiteContextMenu: (site: SiteRow, e: React.MouseEvent) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  refreshToken: number
}

type CitySectionHandle = { open: () => void; close: () => void }

const CitySection = React.forwardRef<CitySectionHandle, CitySectionProps>(
  function CitySection({
    group, searchQuery, statusFilter, counts, issueCounts, onOpenDrawer, onOpenVpn,
    onOpenCustomer, onOpenSite, canViewCustomer, canViewSite,
    canChangeCustomer, onEditCustomer, canChangeSite, onEditSite,
    onCustomerContextMenu, onSiteContextMenu, onInventoryContextMenu,
    refreshToken,
  }, ref) {
    const theme = useTheme()
    const [open, setOpen] = React.useState(false)

    // Auto-open se c'è una ricerca attiva
    React.useEffect(() => {
      if (searchQuery) setOpen(true)
    }, [searchQuery])

    React.useImperativeHandle(ref, () => ({
      open:  () => setOpen(true),
      close: () => setOpen(false),
    }))

    return (
      <Box sx={{
        mb: 2,
        border: '1px solid',
        borderColor: open ? theme.palette.primary.dark : 'divider',
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 0.2s, border-width 0.1s',
        bgcolor: 'background.paper',
      }}>
        {/* Header città — unico elemento a fondo pieno della pagina: massima densità informativa (elevazione) */}
        <Box
          onClick={() => setOpen((p) => !p)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            py: 1.125, px: 2,
            cursor: 'pointer',
            bgcolor: open ? theme.palette.primary.dark : 'background.paper',
            transition: 'background 0.2s',
            '&:hover': { bgcolor: open ? theme.palette.primary.dark : 'grey.50' },
          }}
        >
          <PlaceOutlinedIcon sx={{ fontSize: ICON.feature, color: open ? 'rgba(255,255,255,0.75)' : 'primary.main', flexShrink: 0 }} />

          <Typography fontWeight={700} sx={{ fontSize: FS.section, color: open ? '#fff' : 'text.primary' }}>
            {group.city}
          </Typography>
          {group.province && (
            <Typography sx={{ fontSize: FS.micro, color: open ? 'rgba(255,255,255,0.6)' : 'text.secondary', mt: '1px' }}>
              {group.province}
            </Typography>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Issue attive in città — "segnale", sempre visibile quando presenti */}
          {group.issueCount > 0 && (
            <SignalChip
              tone="error"
              inverse={open}
              icon={<WarningAmberRoundedIcon />}
              label={`${group.issueCount} issue attiv${group.issueCount === 1 ? 'a' : 'e'}`}
            />
          )}

          {/* Numero clienti — "meta": è un conteggio strutturale, non uno stato */}
          <MetaTag
            inverse={open}
            label={`${group.customers.length} client${group.customers.length !== 1 ? 'i' : 'e'}`}
          />

          <IconButton size="small" sx={{ ml: 0.25, color: open ? '#fff' : 'text.secondary' }}>
            {open ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
        </Box>

        {/* Lista clienti — zebra, no gap */}
        <Collapse in={open} unmountOnExit>
          <Box>
            {group.customers.map((c, idx) => (
              <CustomerCard
                key={c.id}
                customer={c}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                assetCount={counts[c.id]?.assets ?? null}
                siteCount={counts[c.id]?.sites ?? null}
                issueCount={issueCounts[c.id] ?? 0}
                onOpenDrawer={onOpenDrawer}
                onOpenVpn={onOpenVpn}
                onOpenCustomer={onOpenCustomer}
                onOpenSite={onOpenSite}
                canViewCustomer={canViewCustomer}
                canViewSite={canViewSite}
                canChangeCustomer={canChangeCustomer}
                onEditCustomer={onEditCustomer}
                canChangeSite={canChangeSite}
                onEditSite={onEditSite}
                onCustomerContextMenu={onCustomerContextMenu}
                onSiteContextMenu={onSiteContextMenu}
                onInventoryContextMenu={onInventoryContextMenu}
                rowIndex={idx}
                isLast={idx === group.customers.length - 1}
                refreshToken={refreshToken}
              />
            ))}
          </Box>
        </Collapse>
      </Box>
    )
  }
)

// ─── CustomerInfoDrawer / SiteInfoDrawer ───────────────────────────────────────
//
// Quick-view read-only, aperta senza lasciare Site Repository (a differenza dei
// drawer completi di /customers e /sites, qui non c'è tab Siti/Inventari: sono
// già visibili inline nella pagina stessa, quindi sarebbero ridondanti). Stessi
// componenti condivisi (DrawerShell/DrawerSection/DrawerFieldList) dei drawer
// "ufficiali", per coerenza visiva — ma nessuna azione di modifica/eliminazione:
// quelle restano di competenza delle pagine Clienti/Siti.

function customerAddressFromDetail(detail: CustomerDetail | null): string | null {
  const cf = detail?.custom_fields ?? null
  if (!isRecord(cf)) return null
  const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === 'indirizzo')
  if (!key) return null
  const v = cf[key]
  if (typeof v !== 'string' || !v.trim()) return null
  const parts = [v.trim(), detail?.city?.trim()].filter(Boolean)
  return parts.join(', ')
}

function CustomerInfoDrawer({
  open, detail, detailLoading, selectedId, onClose,
}: {
  open: boolean
  detail: CustomerDetail | null
  detailLoading: boolean
  selectedId: number | null
  onClose: () => void
}) {
  const address = React.useMemo(() => customerAddressFromDetail(detail), [detail])

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      title={detail?.display_name || detail?.name || (selectedId ? `Cliente #${selectedId}` : 'Cliente')}
      subtitle={detail?.city || undefined}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : !detail ? <DrawerEmptyState /> : (
        <>
          <DrawerSection icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Contatto primario">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{detail.primary_contact_name || '—'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{detail.primary_contact_email || ''}</Typography>
              </Box>
              {detail.primary_contact_phone ? (
                <Chip size="small" label={detail.primary_contact_phone} sx={{ bgcolor: '#f0fdf4', color: '#0f766e', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: 11 }} />
              ) : null}
            </Stack>
          </DrawerSection>

          <DrawerSection icon={<MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Informazioni">
            <DrawerFieldList rows={[
              { label: 'Codice', value: detail.code, mono: true, copy: true },
              ...(detail.vat_number ? [{ label: 'P.IVA', value: detail.vat_number, mono: true }] : []),
              ...(detail.tax_code ? [{ label: 'Cod. fiscale', value: detail.tax_code, mono: true }] : []),
            ]} />
          </DrawerSection>

          {(detail.tags ?? []).length > 0 && (
            <DrawerSection icon={<LocalOfferOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Tag">
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {(detail.tags ?? []).map((t) => <Chip key={t} size="small" label={t} variant="outlined" />)}
              </Stack>
            </DrawerSection>
          )}

          {detail.has_vpn ? (
            <DrawerSection icon={<VpnLockIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="VPN" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Cliente con accesso VPN configurato.</Typography>
            </DrawerSection>
          ) : null}

          {address ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{address}</Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                <LeafletMap address={address} height={280} zoom={15} />
              </Box>
            </Box>
          ) : null}

          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes || '—'}</Typography>
          </DrawerSection>
        </>
      )}
    </DrawerShell>
  )
}

function siteCustomerLabel(site: SiteDetail | null) {
  return site?.customer_display_name || site?.customer_name || site?.customer_code || ''
}

function SiteInfoDrawer({
  open, detail, detailLoading, selectedId, onClose,
}: {
  open: boolean
  detail: SiteDetail | null
  detailLoading: boolean
  selectedId: number | null
  onClose: () => void
}) {
  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

  const subtitle = detail?.city
    ? `${detail.city}${detail.postal_code ? ` ${detail.postal_code}` : ''}`
    : undefined

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      title={detail?.display_name || detail?.name || (selectedId ? `Sito #${selectedId}` : 'Sito')}
      subtitle={subtitle}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : !detail ? <DrawerEmptyState /> : (
        <>
          <DrawerSection icon={<BusinessOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Identificazione">
            <DrawerFieldList rows={[
              { label: 'Nome', value: detail.name, copy: true },
              ...(detail.display_name && detail.display_name !== detail.name ? [{ label: 'Nome visualizzato', value: detail.display_name }] : []),
              { label: 'Cliente', value: siteCustomerLabel(detail) },
            ]} />
          </DrawerSection>

          <DrawerSection icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Contatto primario">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{detail.primary_contact_name || '—'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{detail.primary_contact_email || ''}</Typography>
              </Box>
              {detail.primary_contact_phone ? (
                <Chip size="small" label={detail.primary_contact_phone} sx={{ bgcolor: '#f0fdf4', color: '#0f766e', border: '1px solid #bbf7d0', fontWeight: 600, fontSize: 11 }} />
              ) : null}
            </Stack>
          </DrawerSection>

          {siteAddress ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{siteAddress}</Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                <LeafletMap address={siteAddress} height={280} zoom={15} />
              </Box>
            </Box>
          ) : null}

          {detail.notes ? (
            <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes}</Typography>
            </DrawerSection>
          ) : null}
        </>
      )}
    </DrawerShell>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SiteRepository() {
  const { hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { searchQuery, registerHandle, unregisterHandle, setTotals } = useSiteRepoV2()

  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets)
  const canChange      = hasPerm(PERMS.inventory.inventory.change)
  const canDelete      = hasPerm(PERMS.inventory.inventory.delete)
  const canViewCustomer   = hasPerm(PERMS.crm.customer.view)
  const canViewSite        = hasPerm(PERMS.crm.site.view)
  const canChangeCustomer = hasPerm(PERMS.crm.customer.change)
  const canDeleteCustomer = hasPerm(PERMS.crm.customer.delete)
  const canChangeSite      = hasPerm(PERMS.crm.site.change)
  const canDeleteSite      = hasPerm(PERMS.crm.site.delete)
  const canAddIssue        = hasPerm(PERMS.issues.issue.add)

  // Quick-view Cliente/Sito: drawer di sola lettura aperto senza lasciare la
  // pagina (i tab Siti/Inventari dei drawer "ufficiali" sarebbero ridondanti
  // qui, dato che sono già visibili inline).
  const [customerDrawerOpen, setCustomerDrawerOpen]       = React.useState(false)
  const [customerDrawerId, setCustomerDrawerId]           = React.useState<number | null>(null)
  const [customerDrawerDetail, setCustomerDrawerDetail]   = React.useState<CustomerDetail | null>(null)
  const [customerDrawerLoading, setCustomerDrawerLoading] = React.useState(false)

  const [siteDrawerOpen, setSiteDrawerOpen]       = React.useState(false)
  const [siteDrawerId, setSiteDrawerId]           = React.useState<number | null>(null)
  const [siteDrawerDetail, setSiteDrawerDetail]   = React.useState<SiteDetail | null>(null)
  const [siteDrawerLoading, setSiteDrawerLoading] = React.useState(false)

  const openCustomerDetail = React.useCallback((id: number) => {
    setCustomerDrawerId(id); setCustomerDrawerOpen(true)
    setCustomerDrawerLoading(true); setCustomerDrawerDetail(null)
    api.get(`/customers/${id}/`)
      .then((res) => setCustomerDrawerDetail(res.data as CustomerDetail))
      .catch((e: unknown) => toast.error(apiErrorToMessage(e)))
      .finally(() => setCustomerDrawerLoading(false))
  }, [toast])

  const openSiteDetail = React.useCallback((id: number) => {
    setSiteDrawerId(id); setSiteDrawerOpen(true)
    setSiteDrawerLoading(true); setSiteDrawerDetail(null)
    api.get(`/sites/${id}/`)
      .then((res) => setSiteDrawerDetail(res.data as SiteDetail))
      .catch((e: unknown) => toast.error(apiErrorToMessage(e)))
      .finally(() => setSiteDrawerLoading(false))
  }, [toast])

  const closeCustomerDrawer = React.useCallback(() => setCustomerDrawerOpen(false), [])
  const closeSiteDrawer     = React.useCallback(() => setSiteDrawerOpen(false), [])

  // Deep-link a /customers, /sites, /inventory per la modifica: il form di
  // modifica è privato di quelle pagine (validazioni, campi custom, dropdown
  // dipendenti) — riprodurlo qui duplicherebbe centinaia di righe. "return"
  // riporta su Site Repository alla chiusura del drawer.
  const editCustomerElsewhere = React.useCallback((id: number) => {
    navigate(`/customers${buildQuery({ open: id, return: location.pathname + location.search })}`)
  }, [navigate, location])
  const editSiteElsewhere = React.useCallback((id: number) => {
    navigate(`/sites${buildQuery({ open: id, return: location.pathname + location.search })}`)
  }, [navigate, location])
  const editInventoryElsewhere = React.useCallback((id: number) => {
    navigate(`/inventory${buildQuery({ open: id, return: location.pathname + location.search })}`)
  }, [navigate, location])

  const openIssueFromInventory = React.useCallback((row: InventoryRow, customerName: string) => {
    navigate('/issues', {
      state: {
        createFromInventory: {
          inventoryId: row.id,
          inventoryName: row.name || row.hostname || row.knumber || `Inventory #${row.id}`,
          inventoryKnumber: row.knumber ?? null,
          inventorySerialNumber: row.serial_number ?? null,
          inventoryHostname: row.hostname ?? null,
          customerId: row.customer,
          customerName,
          siteId: row.site ?? null,
        },
      },
    })
  }, [navigate])

  // Menu contestuale (tasto destro) — stesso set di azioni della vecchia
  // pagina Site Repository (che incorporava le griglie di Clienti/Siti/
  // Inventari, ciascuna con il proprio menu). "Apri" e "VPN" restano inline;
  // "Modifica" apre la pagina dedicata (vedi sopra); "Elimina" chiede conferma
  // e aggiorna la lista qui senza ricaricare tutto.
  type CtxMenuState =
    | { kind: 'inventory'; row: InventoryRow; mouseX: number; mouseY: number }
    | { kind: 'site'; row: SiteRow; mouseX: number; mouseY: number }
    | { kind: 'customer'; row: CustomerRow; mouseX: number; mouseY: number }
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenuState | null>(null)

  const handleInventoryContextMenu = React.useCallback((row: InventoryRow, e: React.MouseEvent) => {
    setCtxMenu({ kind: 'inventory', row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })
  }, [])
  const handleSiteContextMenu = React.useCallback((row: SiteRow, e: React.MouseEvent) => {
    setCtxMenu({ kind: 'site', row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })
  }, [])
  const handleCustomerContextMenu = React.useCallback((row: CustomerRow, e: React.MouseEvent) => {
    setCtxMenu({ kind: 'customer', row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })
  }, [])
  const closeCtxMenu = React.useCallback(() => setCtxMenu(null), [])

  const [customers, setCustomers]               = React.useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = React.useState(true)

  // Bump per forzare il refetch dei figli espansi (siti/asset) dopo un delete,
  // ora che i loro dati non sono più derivati da liste globali in memoria.
  const [refreshToken, setRefreshToken] = React.useState(0)

  // La ricerca ora gira sul server (?search=), quindi va sfasata rispetto alla
  // digitazione per non emettere una richiesta per ogni tasto premuto.
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery)
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  // Un'unica chiamata: i clienti. I contatori (assets_count, sites_count,
  // active_issue_count) sono annotati dal backend.
  //
  // Prima questa pagina scaricava in parallelo TUTTI gli inventory e TUTTI i
  // siti (page_size 2000/1000) per contarli e cercarci dentro lato client. Due
  // problemi: il conteggio era sbagliato non appena i record superavano la
  // pagina, e la ricerca vedeva solo la porzione scaricata. Ora conteggio e
  // ricerca li fa il DB, che è l'unico che vede tutti i dati.
  const loadCustomers = React.useCallback(() => {
    let cancelled = false
    setCustomersLoading(true)

    api.get('/customers/', {
      params: {
        page_size: 200,
        ordering: 'name',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      },
    })
      .then((custRes) => {
        if (cancelled) return
        setCustomers(custRes.data?.results ?? [])
      })
      .catch((e: unknown) => { if (!cancelled) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (!cancelled) setCustomersLoading(false) })

    return () => { cancelled = true }
  }, [debouncedSearch, toast])

  React.useEffect(() => loadCustomers(), [loadCustomers])

  const [deleteTarget, setDeleteTarget] = React.useState<CtxMenuState | null>(null)
  const [deleteRowBusy, setDeleteRowBusy] = React.useState(false)

  const confirmDeleteRow = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleteRowBusy(true)
    try {
      if (deleteTarget.kind === 'inventory') {
        await api.delete(`/inventories/${deleteTarget.row.id}/`)
        toast.success('Asset eliminato.')
        // Refetch clienti (aggiorna assets_count) + forza il refetch delle tab
        // espanse, che non condividono più una lista globale.
        loadCustomers()
        setRefreshToken((t) => t + 1)
      } else if (deleteTarget.kind === 'site') {
        await api.delete(`/sites/${deleteTarget.row.id}/`)
        toast.success('Sito eliminato.')
        loadCustomers()
        setRefreshToken((t) => t + 1)
      } else {
        await api.delete(`/customers/${deleteTarget.row.id}/`)
        setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.row.id))
        toast.success('Cliente eliminato.')
      }
      setDeleteTarget(null)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteRowBusy(false)
    }
  }, [deleteTarget, toast, loadCustomers])

  const statusFilter: StatusFilter = 'all'

  // Contatori letti dalle annotazioni del backend (niente più derivazione da
  // liste in memoria).
  const counts = React.useMemo(() => {
    const map: Record<number, { assets: number | null; sites: number | null }> = {}
    customers.forEach((c) => {
      map[c.id] = { assets: c.assets_count ?? 0, sites: c.sites_count ?? 0 }
    })
    return map
  }, [customers])

  // Badge "segnale": numero di asset del cliente con almeno una issue attiva.
  const issueCountsByCustomer = React.useMemo(() => {
    const map: Record<number, number> = {}
    customers.forEach((c) => {
      if (c.active_issue_count) map[c.id] = c.active_issue_count
    })
    return map
  }, [customers])

  // Il filtro per ricerca lo applica già il backend: qui resta solo il filtro
  // di stato, che è puramente client-side.
  const filteredCustomers = React.useMemo(
    () => customers.filter((c) => matchesStatusFilter(statusFilter, c.status_label)),
    [customers, statusFilter],
  )

  const cityGroups = React.useMemo<CityGroup[]>(() => {
    const map = new Map<string, CustomerRow[]>()
    filteredCustomers.forEach((c) => {
      const city = normalizeCity(c.city)
      if (!map.has(city)) map.set(city, [])
      map.get(city)!.push(c)
    })
    return Array.from(map.entries())
      .map(([city, custs]) => ({
        city,
        customers: custs,
        // Somma delle issue attive di tutti i clienti della città
        issueCount: custs.reduce((sum, c) => sum + (issueCountsByCustomer[c.id] ?? 0), 0),
      }))
      .sort((a, b) => {
        if (a.city === 'Senza città') return 1
        if (b.city === 'Senza città') return -1
        return a.city.localeCompare(b.city, 'it')
      })
  }, [filteredCustomers, issueCountsByCustomer])

  // Refs per Comprimi / Espandi tutto
  const sectionRefs = React.useRef<Map<string, CitySectionHandle>>(new Map())

  // Registra handle nel context (per toolbar in AppLayout)
  React.useEffect(() => {
    const h: SiteRepoV2Handle = {
      collapseAll: () => sectionRefs.current.forEach((ref) => ref.close()),
      expandAll:   () => sectionRefs.current.forEach((ref) => ref.open()),
    }
    registerHandle(h)
    return () => unregisterHandle()
  }, [registerHandle, unregisterHandle])

  // Aggiorna contatori nella toolbar
  React.useEffect(() => {
    setTotals(filteredCustomers.length, cityGroups.length)
  }, [filteredCustomers.length, cityGroups.length, setTotals])

  // VPN modal
  const [vpnModalOpen, setVpnModalOpen] = React.useState(false)
  const [vpnModalCustomer, setVpnModalCustomer] = React.useState<CustomerRow | null>(null)
  const openVpnModal = React.useCallback((c: CustomerRow) => { setVpnModalCustomer(c); setVpnModalOpen(true) }, [])

  const [drawerOpen, setDrawerOpen]       = React.useState(false)
  const [selectedId, setSelectedId]       = React.useState<number | null>(null)
  const [detail, setDetail]               = React.useState<InventoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [drawerTab, setDrawerTab]         = React.useState(0)
  const [deleteBusy, setDeleteBusy]       = React.useState(false)
  const [restoreBusy, setRestoreBusy]     = React.useState(false)

  const openDrawer = React.useCallback(async (id: number) => {
    setSelectedId(id); setDrawerTab(0); setDrawerOpen(true)
    setDetailLoading(true); setDetail(null)
    try {
      const res = await api.get(`/inventories/${id}/`)
      setDetail(res.data as InventoryDetail)
    } catch (e) { toast.error(apiErrorToMessage(e)) }
    finally    { setDetailLoading(false) }
  }, [toast])

  const closeDrawer   = React.useCallback(() => setDrawerOpen(false), [])
  const handleEdit    = React.useCallback(() => { /* gestito nella pagina Inventory */ }, [])

  const handleDelete = React.useCallback(async () => {
    if (!selectedId) return
    setDeleteBusy(true)
    try { await api.delete(`/inventories/${selectedId}/`); toast.success('Asset eliminato.'); closeDrawer() }
    catch (e) { toast.error(apiErrorToMessage(e)) }
    finally   { setDeleteBusy(false) }
  }, [selectedId, closeDrawer, toast])

  const handleRestore = React.useCallback(async () => {
    if (!selectedId) return
    setRestoreBusy(true)
    try { await api.post(`/inventories/${selectedId}/restore/`); toast.success('Asset ripristinato.'); closeDrawer() }
    catch (e) { toast.error(apiErrorToMessage(e)) }
    finally   { setRestoreBusy(false) }
  }, [selectedId, closeDrawer, toast])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    if (!ctxMenu) return []

    if (ctxMenu.kind === 'inventory') {
      const row = ctxMenu.row
      const items: RowContextMenuItem[] = [
        { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDrawer(row.id) },
      ]
      if (canChange) items.push({ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => editInventoryElsewhere(row.id) })
      if (canAddIssue) items.push({
        key: 'open-issue', label: 'Apri issue', icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
        onClick: () => {
          const cust = customers.find((c) => c.id === row.customer)
          openIssueFromInventory(row, cust?.display_name || cust?.name || `Cliente #${row.customer}`)
        },
      })
      if (canDelete) items.push({ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(ctxMenu), tone: 'danger' })
      return items
    }

    if (ctxMenu.kind === 'site') {
      const row = ctxMenu.row
      const items: RowContextMenuItem[] = []
      if (canViewSite) items.push({ key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openSiteDetail(row.id) })
      if (canChangeSite) items.push({ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => editSiteElsewhere(row.id) })
      if (canDeleteSite) items.push({ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(ctxMenu), tone: 'danger' })
      return items
    }

    // customer
    const row = ctxMenu.row
    const items: RowContextMenuItem[] = []
    if (canViewCustomer) items.push({ key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openCustomerDetail(row.id) })
    if (canChangeCustomer) items.push({ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => editCustomerElsewhere(row.id) })
    if (row.has_vpn) items.push({ key: 'vpn', label: 'VPN', icon: <VpnLockIcon fontSize="small" sx={{ color: 'primary.main' }} />, onClick: () => openVpnModal(row), badge: 'configurata', badgeTone: 'success' })
    if (canDeleteCustomer) items.push({ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(ctxMenu), tone: 'danger' })
    return items
  }, [
    ctxMenu, canChange, canDelete, canAddIssue, canViewSite, canChangeSite, canDeleteSite,
    canViewCustomer, canChangeCustomer, canDeleteCustomer, customers,
    openDrawer, editInventoryElsewhere, openIssueFromInventory,
    openSiteDetail, editSiteElsewhere, openCustomerDetail, editCustomerElsewhere, openVpnModal,
  ])

  const deleteDialogCopy = React.useMemo(() => {
    if (!deleteTarget) return { title: 'Confermi eliminazione?', description: undefined as string | undefined }
    if (deleteTarget.kind === 'inventory') return {
      title: 'Confermi eliminazione?',
      description: 'L’asset verrà spostato nel cestino e potrà essere ripristinato dalla pagina Inventari.',
    }
    if (deleteTarget.kind === 'site') return {
      title: 'Confermi eliminazione del sito?',
      description: 'Il sito verrà spostato nel cestino e potrà essere ripristinato dalla pagina Siti.',
    }
    return {
      title: 'Confermi eliminazione del cliente?',
      description: 'Il cliente verrà spostato nel cestino e potrà essere ripristinato dalla pagina Clienti.',
    }
  }, [deleteTarget])

  return (
    <Stack spacing={2}>
      {customersLoading? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 2 }}>
              <Skeleton width={200} height={28} />
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {[1, 2].map((j) => <Skeleton key={j} height={52} />)}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : cityGroups.length === 0 ? (
        <Alert severity="info">
          {customers.length === 0 ? 'Nessun cliente trovato.' : 'Nessun risultato per i filtri selezionati.'}
        </Alert>
      ) : (
        <Stack spacing={0} sx={{ gap: 0 }}>
          {cityGroups.map((group) => (
            <CitySection
              key={group.city}
              group={group}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              counts={counts}
              issueCounts={issueCountsByCustomer}
              onOpenDrawer={openDrawer}
              onOpenVpn={openVpnModal}
              onOpenCustomer={openCustomerDetail}
              onOpenSite={openSiteDetail}
              canViewCustomer={canViewCustomer}
              canViewSite={canViewSite}
              canChangeCustomer={canChangeCustomer}
              onEditCustomer={editCustomerElsewhere}
              canChangeSite={canChangeSite}
              onEditSite={editSiteElsewhere}
              onCustomerContextMenu={handleCustomerContextMenu}
              onSiteContextMenu={handleSiteContextMenu}
              onInventoryContextMenu={handleInventoryContextMenu}
              refreshToken={refreshToken}
              ref={(el) => {
                if (el) sectionRefs.current.set(group.city, el)
                else sectionRefs.current.delete(group.city)
              }}
            />
          ))}
        </Stack>
      )}

      {/* VPN Modal */}
      {vpnModalCustomer && (
        <VpnModal
          open={vpnModalOpen}
          onClose={() => setVpnModalOpen(false)}
          customerId={vpnModalCustomer.id}
          customerName={vpnModalCustomer.display_name || vpnModalCustomer.name}
        />
      )}

      <InventoryDrawer
        open={drawerOpen}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
        canViewSecrets={canViewSecrets}
        canChange={canChange}
        canDelete={canDelete}
        drawerTab={drawerTab}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        onClose={closeDrawer}
        onTabChange={setDrawerTab}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <CustomerInfoDrawer
        open={customerDrawerOpen}
        detail={customerDrawerDetail}
        detailLoading={customerDrawerLoading}
        selectedId={customerDrawerId}
        onClose={closeCustomerDrawer}
      />

      <SiteInfoDrawer
        open={siteDrawerOpen}
        detail={siteDrawerDetail}
        detailLoading={siteDrawerLoading}
        selectedId={siteDrawerId}
        onClose={closeSiteDrawer}
      />

      {/* Menu contestuale (tasto destro) — Cliente/Sito/Asset */}
      <RowContextMenu
        open={Boolean(ctxMenu)}
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        onClose={closeCtxMenu}
        items={contextMenuItems}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        busy={deleteRowBusy}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRow}
      />
    </Stack>
  )
}
