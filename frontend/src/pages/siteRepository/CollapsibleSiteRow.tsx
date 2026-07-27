import * as React from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import { Tooltip } from '@mui/material'

import type { InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON, matchesSearch, matchesStatusFilter } from './style'
import { SignalChip, MetaTag, ActionButton } from './primitives'
import { InventoryInlineList } from './InventoryInlineList'
import { siteStatusTone } from './style'

// ─── CollapsibleSiteRow ───────────────────────────────────────────────────────

export type CollapsibleSiteRowProps = {
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

export const SITE_COL = '1fr 120px 80px 200px 140px'
export const SITE_HEADERS = ['SITO', 'CITTÀ', 'CAP', 'CONTATTO', 'STATO']

export function CollapsibleSiteRow({
  site, allInventory, searchQuery, statusFilter, onOpenDrawer, onOpenSite, canViewSite,
  canChangeSite, onEditSite,
  onSiteContextMenu, onInventoryContextMenu, isLast, rowIndex,
  forceOpen, matchedAssetIds,
}: CollapsibleSiteRowProps) {
  const theme = useTheme()
  const [open, setOpen] = React.useState(false)
  const contentId = React.useId()

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
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((p) => !p)
          }
        }}
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
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: theme.palette.primary.main,
            outlineOffset: -2,
          },
          gap: 1,
        }}
      >
        {/* Sito — nome + expand icon + chip info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ flexShrink: 0, p: 0.25 }}>
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
        <Box id={contentId}>
          <InventoryInlineList rows={siteAssets} onOpenDrawer={onOpenDrawer} onRowContextMenu={onInventoryContextMenu} />
        </Box>
      </Collapse>
    </Box>
  )
}
