import * as React from 'react'
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
import { alpha } from '@mui/material/styles'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'
import VpnModal from '../features/customers/VpnModal'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import StatusChip from '@shared/ui/StatusChip'
import { getInventoryTypeIcon, INVENTORY_TYPE_ICON_COLOR } from '@shared/ui/inventoryTypeIcon'
import InventoryDrawer from '../features/inventory/InventoryDrawer'
import type { InventoryDetail } from '../features/inventory/types'
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
  status_label?: string | null
  has_vpn?: boolean | null
  tags?: string[] | null
  notes?: string | null
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
  hasIssues?: boolean
}

type StatusFilter = 'all' | 'attivo' | 'manutenzione' | 'inattivo'

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL      = '#0d9488'
const TEAL_DARK = '#0f766e'



const ISSUE_PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#64748b',
}

const STATUS_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  in_use:      { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', border: 'rgba(16,185,129,0.28)' },
  maintenance: { bg: 'rgba(245,158,11,0.10)',  fg: '#92400e', border: 'rgba(245,158,11,0.28)' },
  repair:      { bg: 'rgba(239,68,68,0.10)',   fg: '#991b1b', border: 'rgba(239,68,68,0.28)'  },
  spare:       { bg: 'rgba(99,102,241,0.10)',  fg: '#3730a3', border: 'rgba(99,102,241,0.28)' },
  retired:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
  storage:     { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
}

const COL_GRID = '160px 180px 180px 110px 150px 130px 130px 130px'

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

// ─── IpCell ───────────────────────────────────────────────────────────────────

function IpCell({ ip }: { ip?: string | null }) {
  if (!ip) return <Typography variant="body2" color="text.disabled">—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{ip}</Typography>
      <Tooltip title="Copia IP">
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); void copyText(ip) }}
          sx={{ opacity: 0.35, '&:hover': { opacity: 1 }, p: 0.25 }}>
          <ContentCopyIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

// ─── ActiveIssueIcon ──────────────────────────────────────────────────────────

function ActiveIssueIcon({ priority }: { priority?: string | null }) {
  const color = ISSUE_PRIORITY_COLOR[priority ?? ''] ?? ISSUE_PRIORITY_COLOR.medium
  const label = priority === 'critical' ? 'Issue critica aperta'
    : priority === 'high'   ? 'Issue alta priorità aperta'
    : priority === 'low'    ? 'Issue a bassa priorità aperta'
    : "C'è almeno una issue aperta."
  return (
    <Tooltip title={label}>
      <WarningAmberRoundedIcon sx={{ color, fontSize: 15, flexShrink: 0 }} />
    </Tooltip>
  )
}

// ─── InventoryInlineList ──────────────────────────────────────────────────────

function InventoryInlineList({
  rows,
  onOpenDrawer,
}: {
  rows: InventoryRow[]
  onOpenDrawer: (id: number) => void
}) {
  if (!rows.length) return (
    <Box sx={{ px: 3, py: 1.5 }}>
      <Typography variant="body2" color="text.secondary">Nessun asset in questo sito.</Typography>
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
          <Typography key={h} variant="caption"
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
            {h}
          </Typography>
        ))}
      </Box>

      {rows.map((row, idx) => {
        const TypeIcon  = getInventoryTypeIcon(row.type_key)
        const typeLabel = row.type_label ?? ''
        const sc = STATUS_COLOR[row.status_key ?? ''] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }
        const zebraBg = idx % 2 === 0 ? 'background.paper' : 'grey.50'

        return (
          <Box
            key={row.id}
            onClick={() => onOpenDrawer(row.id)}
            sx={{
              display: 'grid',
              gridTemplateColumns: COL_GRID,
              px: 3, py: 0.75,
              alignItems: 'center',
              borderBottom: idx < rows.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              cursor: 'pointer',
              bgcolor: zebraBg,
              transition: 'background 0.12s',
              '&:hover': { bgcolor: alpha(TEAL, 0.06) },
            }}
          >
            {/* Tipo */}
            <Box>
              {typeLabel ? (
                <Chip
                  size="small"
                  icon={<TypeIcon sx={{ color: `${INVENTORY_TYPE_ICON_COLOR} !important`, fontSize: '13px !important' }} />}
                  label={typeLabel}
                  sx={{
                    height: 22, fontSize: '0.72rem', fontWeight: 600,
                    bgcolor: 'rgba(15,118,110,0.08)', color: 'text.primary',
                    border: '1px solid rgba(15,118,110,0.18)',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.disabled">—</Typography>
              )}
            </Box>

            {/* Nome */}
            <Typography variant="body2" sx={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem',
            }}>
              {row.name || '—'}
            </Typography>

            {/* Hostname */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
              {row.has_active_issue && <ActiveIssueIcon priority={row.active_issue_priority} />}
              <Typography variant="body2" fontWeight={500} sx={{
                color: TEAL, fontSize: '0.82rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' },
              }}>
                {row.hostname || '—'}
              </Typography>
            </Box>

            {/* K# */}
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'text.secondary' }}>
              {row.knumber || '—'}
            </Typography>

            {/* Seriale */}
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'text.secondary',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.serial_number || '—'}
            </Typography>

            {/* Stato */}
            <Box>
              {row.status_label ? (
                <Chip
                  size="small"
                  label={row.status_label}
                  sx={{
                    height: 22, fontSize: '0.72rem', fontWeight: 600,
                    bgcolor: sc.bg, color: sc.fg,
                    border: `1px solid ${sc.border}`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.disabled">—</Typography>
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

// ─── MiniKpi ─────────────────────────────────────────────────────────────────

type MiniKpiProps = {
  value: string | number
  label?: string
  color: string
  bg: string
  border: string
  isText?: boolean   // se true usa font più piccolo per testo lungo (es. tag tipo)
}

function MiniKpi({ value, label, color, bg, border, isText }: MiniKpiProps) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: 44, height: 44, borderRadius: '8px', flexShrink: 0,
      bgcolor: bg, border: `1px solid ${border}`,
    }}>
      <Typography sx={{
        fontWeight: 800, lineHeight: 1,
        fontSize: isText ? '0.62rem' : '1rem',
        color,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 40, textAlign: 'center',
        letterSpacing: isText ? '0.02em' : 'normal',
      }}>
        {value}
      </Typography>
      {label && (
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color, opacity: 0.75, lineHeight: 1.2, letterSpacing: '0.04em' }}>
          {label}
        </Typography>
      )}
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
  isLast: boolean
  rowIndex: number
  forceOpen?: boolean
  matchedAssetIds?: Set<number>
}

// Palette stato siti (uguale a Sites.tsx)
const SITE_STATUS_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  active:      { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', border: 'rgba(16,185,129,0.28)' },
  maintenance: { bg: 'rgba(245,158,11,0.10)',  fg: '#92400e', border: 'rgba(245,158,11,0.28)' },
  inactive:    { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
}

const SITE_COL = '1fr 120px 80px 200px 140px'
const SITE_HEADERS = ['SITO', 'CITTÀ', 'CAP', 'CONTATTO', 'STATO']

function CollapsibleSiteRow({
  site, allInventory, searchQuery, statusFilter, onOpenDrawer, isLast, rowIndex,
  forceOpen, matchedAssetIds,
}: CollapsibleSiteRowProps) {
  const [open, setOpen] = React.useState(false)

  // Auto-open quando c'è una ricerca attiva
  React.useEffect(() => {
    if (forceOpen) setOpen(true)
    else setOpen(false)
  }, [forceOpen])

  const totalCount = React.useMemo(
    () => allInventory.filter((inv) => inv.site === site.id).length,
    [allInventory, site.id],
  )

  const siteAssets = React.useMemo(
    () => allInventory.filter((inv) => {
      if (inv.site !== site.id) return false
      if (!matchesStatusFilter(statusFilter, inv.status_label)) return false
      // Se c'è un set di asset matchanti, mostra solo quelli
      if (matchedAssetIds && matchedAssetIds.size > 0) return matchedAssetIds.has(inv.id)
      // Altrimenti filtra per searchQuery normalmente
      if (!matchesSearch(searchQuery, inv.hostname, inv.name, inv.local_ip, inv.srsa_ip)) return false
      return true
    }),
    [allInventory, site.id, searchQuery, statusFilter, matchedAssetIds],
  )

  const sc = SITE_STATUS_COLOR[site.status_label?.toLowerCase() ?? '']
    ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }

  const contactLabel = site.primary_contact_name || site.primary_contact_email || site.primary_contact_phone || ''
  const contactTooltip = [site.primary_contact_email, site.primary_contact_phone].filter(Boolean).join(' · ')

  return (
    <Box sx={{ borderBottom: isLast ? 'none' : '1px solid', borderColor: 'divider' }}>
      {/* Riga sito — stile Sites.tsx */}
      <Box
        onClick={() => setOpen((p) => !p)}
        sx={{
          display: 'grid',
          gridTemplateColumns: SITE_COL,
          alignItems: 'center',
          px: 2, py: 0.9,
          cursor: 'pointer',
          bgcolor: open ? alpha(TEAL, 0.04) : (rowIndex % 2 === 1 ? 'grey.50' : 'background.paper'),
          transition: 'background 0.12s',
          '&:hover': { bgcolor: alpha(TEAL, 0.05) },
          gap: 1,
        }}
      >
        {/* Sito — nome + expand icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <IconButton size="small" sx={{ flexShrink: 0, p: 0.25 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} sx={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {site.display_name || site.name}
            </Typography>
            {site.address_line1 && (
              <Typography variant="caption" color="text.secondary" sx={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              }}>
                {site.address_line1}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Città */}
        <Typography variant="body2" color="text.secondary" sx={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {site.city || '—'}
        </Typography>

        {/* CAP */}
        <Typography variant="body2" color="text.secondary">
          {site.postal_code || '—'}
        </Typography>

        {/* Contatto */}
        {!contactLabel ? (
          <Chip
            size="small"
            icon={<WarningAmberRoundedIcon sx={{ fontSize: '0.95rem !important' }} />}
            label="Nessun contatto"
            sx={{
              height: 22, fontSize: '0.7rem', fontWeight: 600,
              bgcolor: 'rgba(245,158,11,0.12)', color: '#9a6700',
              border: '1px solid rgba(245,158,11,0.18)',
              '& .MuiChip-icon': { color: '#d97706' },
            }}
          />
        ) : contactTooltip ? (
          <Tooltip title={contactTooltip} arrow>
            <Typography variant="body2" sx={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default',
            }}>
              {contactLabel}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="body2" sx={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {contactLabel}
          </Typography>
        )}

        {/* Stato */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {site.status_label ? (
            <Chip
              size="small"
              label={site.status_label}
              sx={{
                height: 22, fontSize: '0.72rem', fontWeight: 600,
                bgcolor: sc.bg, color: sc.fg,
                border: `1px solid ${sc.border}`,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          )}
          <Chip
            label={`${totalCount}`}
            size="small"
            sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700, bgcolor: alpha(TEAL, 0.08), color: TEAL, ml: 'auto' }}
          />
        </Box>
      </Box>

      {/* Lista asset */}
      <Collapse in={open} unmountOnExit>
        <InventoryInlineList rows={siteAssets} onOpenDrawer={onOpenDrawer} />
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
  preloadedSites?: SiteRow[]
  preloadedInventory?: InventoryRow[]
}

function SitesWithInventoryTab({
  customerId, searchQuery, statusFilter, onOpenDrawer,
  preloadedSites, preloadedInventory,
}: SitesWithInventoryTabProps) {
  const [sites, setSites]         = React.useState<SiteRow[]>(preloadedSites ?? [])
  const [inventory, setInventory] = React.useState<InventoryRow[]>(preloadedInventory ?? [])
  const [loading, setLoading]     = React.useState(!preloadedSites)

  React.useEffect(() => {
    // Se abbiamo dati precaricati aggiornati, usali direttamente
    if (preloadedSites && preloadedInventory) {
      setSites(preloadedSites.filter((s) => s.customer === customerId))
      setInventory(preloadedInventory.filter((i) => i.customer === customerId))
      setLoading(false)
      return
    }
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
  }, [customerId, preloadedSites, preloadedInventory])

  if (loading) return (
    <Box sx={{ py: 2, px: 2 }}>
      {[1, 2].map((i) => <Skeleton key={i} height={44} sx={{ mb: 0.5 }} />)}
    </Box>
  )

  if (!sites.length) return (
    <Box sx={{ py: 2, px: 2 }}>
      <Typography variant="body2" color="text.secondary">Nessun sito registrato.</Typography>
    </Box>
  )

  const orphans = inventory.filter((inv) => !inv.site)

  // Calcola asset matchanti per la ricerca puntuale
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

  const hasSearch = Boolean(searchQuery)

  return (
    <Box>
      {/* Header colonne stile Sites.tsx */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: SITE_COL,
        px: 2, py: 0.625,
        bgcolor: 'grey.50',
        borderBottom: '1px solid', borderColor: 'divider',
        gap: 1,
      }}>
        {SITE_HEADERS.map((h) => (
          <Typography key={h} variant="caption"
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
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
              <Typography variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
                ASSET SENZA SITO
              </Typography>
            </Box>
            <InventoryInlineList rows={filteredOrphans} onOpenDrawer={onOpenDrawer} />
          </>
        ) : null
      })()}

      {/* Nessun risultato */}
      {visibleSites.length === 0 && !orphans.length && searchQuery && (
        <Box sx={{ py: 2, px: 2 }}>
          <Typography variant="body2" color="text.secondary">Nessun sito o asset corrisponde alla ricerca.</Typography>
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
  preloadedInventory?: InventoryRow[]
}

function InventoryFlatTab({ customerId, searchQuery, statusFilter, onOpenDrawer, preloadedInventory }: InventoryTabProps) {
  const [rows, setRows]       = React.useState<InventoryRow[]>(preloadedInventory ?? [])
  const [loading, setLoading] = React.useState(!preloadedInventory)

  React.useEffect(() => {
    if (preloadedInventory) {
      setRows(preloadedInventory.filter((i) => i.customer === customerId))
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    api.get('/inventories/', { params: { customer: customerId, page_size: 200 } })
      .then((res) => { if (!cancelled) setRows(res.data?.results ?? []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customerId, preloadedInventory])

  if (loading) return (
    <Box sx={{ py: 2, px: 2 }}>
      {[1, 2, 3].map((i) => <Skeleton key={i} height={36} sx={{ mb: 0.5 }} />)}
    </Box>
  )

  const filtered = React.useMemo(() => {
    if (!searchQuery) return rows.filter((r) => matchesStatusFilter(statusFilter, r.status_label))
    return rows.filter((r) =>
      matchesStatusFilter(statusFilter, r.status_label) &&
      matchesSearch(searchQuery, r.hostname, r.name, r.local_ip, r.srsa_ip, r.site_name, r.serial_number, r.knumber)
    )
  }, [rows, searchQuery, statusFilter])

  if (!filtered.length) return (
    <Box sx={{ py: 2, px: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {rows.length ? 'Nessun asset corrisponde ai filtri.' : 'Nessun asset registrato.'}
      </Typography>
    </Box>
  )

  return <InventoryInlineList rows={filtered} onOpenDrawer={onOpenDrawer} />
}


// ─── CustomerCard ─────────────────────────────────────────────────────────────

type CustomerCardProps = {
  customer: CustomerRow
  searchQuery: string
  statusFilter: StatusFilter
  assetCount: number | null
  siteCount: number | null
  onOpenDrawer: (id: number) => void
  onOpenVpn: (customer: CustomerRow) => void
  rowIndex: number
  isLast: boolean
  allInventory: InventoryRow[]
  allSites: SiteRow[]
}

function CustomerCard({
  customer, searchQuery, statusFilter, assetCount, siteCount, onOpenDrawer, onOpenVpn, rowIndex, isLast, allInventory, allSites,
}: CustomerCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [tab, setTab] = React.useState(0)

  // Auto-open se c'è una ricerca attiva
  React.useEffect(() => {
    if (searchQuery) setExpanded(true)
    else setExpanded(false)
  }, [searchQuery])


  const zebraBg = rowIndex % 2 === 0 ? 'background.paper' : alpha(TEAL, 0.025)

  return (
    <Box sx={{
      borderBottom: isLast ? 'none' : '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
      bgcolor: expanded ? alpha(TEAL, 0.04) : zebraBg,
      transition: 'background 0.15s',
    }}>
      <Box
        onClick={() => setExpanded((p) => !p)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.25, cursor: 'pointer',
          bgcolor: 'transparent',
          '&:hover': { bgcolor: alpha(TEAL, 0.05) },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="body1" fontWeight={600} sx={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {customer.display_name || customer.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', flexShrink: 0 }}>
              {customer.code}
            </Typography>
          </Box>
          {customer.primary_contact_name && (
            <Typography variant="caption" color="text.secondary">
              {customer.primary_contact_name}
              {customer.primary_contact_phone ? ` · ${customer.primary_contact_phone}` : ''}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>

          <StatusChip statusId={customer.status ?? undefined} label={customer.status_label} size="small" />

          {/* 1. Customer type — primo tag */}
          {(customer.tags ?? []).length > 0 && (
            <MiniKpi
              value={(customer.tags ?? [])[0]}
              color="#0284c7"
              bg="rgba(2,132,199,0.09)"
              border="rgba(2,132,199,0.22)"
              isText
            />
          )}

          {/* 2. Note — solo icona, tooltip con testo */}
          {customer.notes && customer.notes.trim().length > 0 && (
            <Tooltip title={customer.notes.length > 120 ? customer.notes.slice(0, 120) + '…' : customer.notes} arrow>
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: '8px', flexShrink: 0,
                bgcolor: 'rgba(245,158,11,0.09)',
                border: '1px solid rgba(245,158,11,0.25)',
                cursor: 'default',
              }}>
                <NoteAltOutlinedIcon sx={{ fontSize: 20, color: '#d97706' }} />
              </Box>
            </Tooltip>
          )}

          {/* 3. VPN — solo icona, click apre VpnModal */}
          {customer.has_vpn && (
            <Tooltip title="Visualizza VPN" arrow>
              <Box
                onClick={(e) => { e.stopPropagation(); onOpenVpn(customer) }}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: '8px', flexShrink: 0,
                  bgcolor: 'rgba(16,185,129,0.09)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: 'rgba(16,185,129,0.18)' },
                }}
              >
                <VpnLockIcon sx={{ fontSize: 20, color: '#059669' }} />
              </Box>
            </Tooltip>
          )}

          {/* 4. Siti — click espande + vai a tab Siti */}
          <Tooltip title="Vai ai siti" arrow>
            <Box
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setTab(0) }}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: '8px', flexShrink: 0,
                bgcolor: alpha(TEAL, 0.10), border: `1px solid ${alpha(TEAL, 0.20)}`,
                cursor: 'pointer', transition: 'background 0.15s',
                '&:hover': { bgcolor: alpha(TEAL, 0.18) },
              }}
            >
              <Typography sx={{ fontWeight: 800, lineHeight: 1, fontSize: '1rem', color: TEAL }}>
                {siteCount ?? '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: TEAL, opacity: 0.75, lineHeight: 1.2, letterSpacing: '0.04em' }}>
                siti
              </Typography>
            </Box>
          </Tooltip>

          {/* 5. Asset — click espande + vai a tab Inventario */}
          <Tooltip title="Vai agli asset" arrow>
            <Box
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setTab(siteCount ? 1 : 0) }}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: '8px', flexShrink: 0,
                bgcolor: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)',
                cursor: 'pointer', transition: 'background 0.15s',
                '&:hover': { bgcolor: 'rgba(99,102,241,0.18)' },
              }}
            >
              <Typography sx={{ fontWeight: 800, lineHeight: 1, fontSize: '1rem', color: '#4f46e5' }}>
                {assetCount ?? '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#4f46e5', opacity: 0.75, lineHeight: 1.2, letterSpacing: '0.04em' }}>
                asset
              </Typography>
            </Box>
          </Tooltip>

          <IconButton size="small" sx={{ ml: 0.25 }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
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
              preloadedInventory={allInventory.filter((i) => i.customer === customer.id)}
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
                    minHeight: 36, fontSize: '0.72rem', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', py: 0,
                  },
                  '& .Mui-selected': { color: `${TEAL} !important` },
                  '& .MuiTabs-indicator': { backgroundColor: TEAL },
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
                  preloadedSites={allSites.filter((s) => s.customer === customer.id)}
                  preloadedInventory={allInventory.filter((i) => i.customer === customer.id)}
                />
              )}
              {tab === 1 && (
                <InventoryFlatTab
                  customerId={customer.id}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  onOpenDrawer={onOpenDrawer}
                  preloadedInventory={allInventory.filter((i) => i.customer === customer.id)}
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
  onOpenDrawer: (id: number) => void
  onOpenVpn: (customer: CustomerRow) => void
  allInventory: InventoryRow[]
  allSites: SiteRow[]
}

type CitySectionHandle = { open: () => void; close: () => void }

const CitySection = React.forwardRef<CitySectionHandle, CitySectionProps>(
  function CitySection({ group, searchQuery, statusFilter, counts, onOpenDrawer, onOpenVpn, allInventory, allSites }, ref) {
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
        borderColor: open ? TEAL_DARK : 'divider',
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 0.2s, border-width 0.1s',
        bgcolor: 'background.paper',
      }}>
        {/* Header città */}
        <Box
          onClick={() => setOpen((p) => !p)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            py: 1.125, px: 2,
            cursor: 'pointer',
            bgcolor: open ? TEAL_DARK : 'background.paper',
            transition: 'background 0.2s',
            '&:hover': { bgcolor: open ? '#155e50' : 'grey.50' },
          }}
        >
          <PlaceOutlinedIcon sx={{ fontSize: 18, color: open ? 'rgba(255,255,255,0.75)' : TEAL, flexShrink: 0 }} />

          <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '0.975rem', color: open ? '#fff' : 'text.primary' }}>
            {group.city}
          </Typography>
          {group.province && (
            <Typography variant="caption" sx={{ color: open ? 'rgba(255,255,255,0.6)' : 'text.secondary', mt: '1px' }}>
              {group.province}
            </Typography>
          )}

          <Box sx={{ flex: 1 }} />

          {group.hasIssues && !open && (
            <Chip
              icon={<WarningAmberRoundedIcon />}
              label="Issue attive"
              size="small"
              sx={{
                fontSize: '0.68rem', height: 22, fontWeight: 600,
                bgcolor: 'rgba(239,68,68,0.08)', color: '#b91c1c',
                border: '1px solid rgba(239,68,68,0.25)',
                '& .MuiChip-icon': { fontSize: 13, color: '#dc2626' },
              }}
            />
          )}

          <Chip
            label={`${group.customers.length} client${group.customers.length !== 1 ? 'i' : 'e'}`}
            size="small"
            sx={{
              fontSize: '0.72rem', height: 22, fontWeight: 700,
              bgcolor: open ? 'rgba(255,255,255,0.18)' : alpha(TEAL, 0.09),
              color:   open ? '#fff' : TEAL,
              border: '1px solid',
              borderColor: open ? 'rgba(255,255,255,0.28)' : alpha(TEAL, 0.22),
            }}
          />

          <IconButton size="small" sx={{ ml: 0.25, color: open ? '#fff' : 'text.secondary' }}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
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
                onOpenDrawer={onOpenDrawer}
                onOpenVpn={onOpenVpn}
                rowIndex={idx}
                isLast={idx === group.customers.length - 1}
                allInventory={allInventory}
                allSites={allSites}
              />
            ))}
          </Box>
        </Collapse>
      </Box>
    )
  }
)

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SiteRepositoryV2() {
  const { hasPerm } = useAuth()
  const toast = useToast()
  const { searchQuery, registerHandle, unregisterHandle, setTotals } = useSiteRepoV2()

  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets)
  const canChange      = hasPerm(PERMS.inventory.inventory.change)
  const canDelete      = hasPerm(PERMS.inventory.inventory.delete)

  const [customers, setCustomers]               = React.useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = React.useState(true)
  const [counts, setCounts]                     = React.useState<Record<number, { assets: number | null; sites: number | null }>>({})
  const [allInventory, setAllInventory]         = React.useState<InventoryRow[]>([])
  const [allSites, setAllSites]                 = React.useState<SiteRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    setCustomersLoading(true)

    // Carica in parallelo: clienti + tutti gli inventory + tutti i siti
    Promise.all([
      api.get('/customers/',    { params: { page_size: 500, ordering: 'name' } }),
      api.get('/inventories/',  { params: { page_size: 2000 } }),
      api.get('/sites/',        { params: { page_size: 1000 } }),
    ]).then(([custRes, invRes, siteRes]) => {
      if (cancelled) return
      const rows: CustomerRow[]  = custRes.data?.results  ?? []
      const invRows: InventoryRow[] = invRes.data?.results  ?? []
      const siteRows: SiteRow[]  = siteRes.data?.results ?? []

      setCustomers(rows)
      setAllInventory(invRows)
      setAllSites(siteRows)

      // Calcola contatori dai dati già in memoria — zero chiamate extra
      const newCounts: Record<number, { assets: number; sites: number }> = {}
      rows.forEach((c) => {
        newCounts[c.id] = {
          assets: invRows.filter((i) => i.customer === c.id).length,
          sites:  siteRows.filter((s) => s.customer === c.id).length,
        }
      })
      setCounts(newCounts)
    })
      .catch((e: unknown) => { if (!cancelled) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (!cancelled) setCustomersLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusFilter: StatusFilter = 'all'

  const filteredCustomers = React.useMemo(() => {
    if (!searchQuery) return customers.filter((c) => matchesStatusFilter(statusFilter, c.status_label))
    const q = searchQuery.toLowerCase()
    // Indice rapido: per ogni cliente, set di stringhe cercabili da inventory e siti
    const invByCustomer = new Map<number, string>()
    allInventory.forEach((i) => {
      if (!i.customer) return
      const existing = invByCustomer.get(i.customer) ?? ''
      invByCustomer.set(i.customer, existing + ' ' + [i.hostname, i.name, i.local_ip, i.srsa_ip, i.serial_number, i.knumber].filter(Boolean).join(' '))
    })
    const siteByCustomer = new Map<number, string>()
    allSites.forEach((s) => {
      if (!s.customer) return
      const existing = siteByCustomer.get(s.customer) ?? ''
      siteByCustomer.set(s.customer, existing + ' ' + [s.name, s.display_name, s.city, s.address_line1].filter(Boolean).join(' '))
    })
    return customers.filter((c) => {
      if (!matchesStatusFilter(statusFilter, c.status_label)) return false
      // Cerca nei campi diretti del cliente
      if (matchesSearch(q, c.name, c.display_name, c.code, c.city, c.primary_contact_name)) return true
      // Cerca negli asset del cliente
      if ((invByCustomer.get(c.id) ?? '').toLowerCase().includes(q)) return true
      // Cerca nei siti del cliente
      if ((siteByCustomer.get(c.id) ?? '').toLowerCase().includes(q)) return true
      return false
    })
  }, [customers, allInventory, allSites, searchQuery, statusFilter])

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
        // hasIssues: in futuro derivabile dai dati
      }))
      .sort((a, b) => {
        if (a.city === 'Senza città') return 1
        if (b.city === 'Senza città') return -1
        return a.city.localeCompare(b.city, 'it')
      })
  }, [filteredCustomers])

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
              onOpenDrawer={openDrawer}
              onOpenVpn={openVpnModal}
              allInventory={allInventory}
              allSites={allSites}
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
    </Stack>
  )
}
