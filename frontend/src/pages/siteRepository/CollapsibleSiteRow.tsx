import * as React from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Tooltip } from '@mui/material'
import StatusChip from '@shared/ui/StatusChip'

import type { InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON, matchesSearch, matchesStatusFilter } from './style'
import { ActionButton, CountStat } from './primitives'
import { InventoryInlineList } from './InventoryInlineList'
import { ContactsListModal } from './ContactsListModal'

// ─── CollapsibleSiteRow ───────────────────────────────────────────────────────

export type CollapsibleSiteRowProps = {
  site: SiteRow
  allInventory: InventoryRow[]
  searchQuery: string
  statusFilter: StatusFilter
  onOpenDrawer: (id: number, typeKeyHint?: string | null) => void
  onOpenSite: (id: number) => void
  onOpenSiteContacts: () => void
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

export const SITE_COL = '1fr 170px'
export const SITE_HEADERS = ['SITO', '']

export function CollapsibleSiteRow({
  site, allInventory, searchQuery, statusFilter, onOpenDrawer, onOpenSite, onOpenSiteContacts, canViewSite,
  onSiteContextMenu, onInventoryContextMenu, isLast, rowIndex,
  forceOpen, matchedAssetIds,
}: CollapsibleSiteRowProps) {
  const theme = useTheme()
  const [open, setOpen] = React.useState(false)
  const [contactsModalOpen, setContactsModalOpen] = React.useState(false)
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

  const contactLabel = site.primary_contact_name || ''
  const addressLine = [site.address_line1, site.postal_code, site.city].filter(Boolean).join(' - ')

  return (
    <Box sx={{
      borderBottom: isLast ? 'none' : '1px solid',
      borderColor: 'divider',
      bgcolor: open ? alpha(theme.palette.primary.main, 0.08) : (rowIndex % 2 === 1 ? 'grey.50' : 'background.paper'),
      // Evidenziazione più marcata del sito aperto: oltre allo sfondo più
      // pieno, una barra inset a sinistra nel colore primario — stesso
      // pattern già in uso per il "segnale" issue in InventoryInlineList.
      boxShadow: open ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
      transition: 'background 0.15s, box-shadow 0.15s',
    }}>
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
          bgcolor: 'transparent',
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
        {/* Sito — nome + stato + contatto inline, indirizzo sotto (come CustomerCard) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ flexShrink: 0, p: 0.25 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
              <Typography fontWeight={open ? 700 : 600} sx={{
                fontSize: FS.body,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {site.display_name || site.name}
              </Typography>
              {site.status_label ? (
                <StatusChip statusId={site.status ?? undefined} label={site.status_label} size="small" sx={{ flexShrink: 0, fontWeight: 700 }} />
              ) : null}
              {contactLabel && (
                <Typography
                  onClick={canViewSite ? (e) => { e.stopPropagation(); onOpenSite(site.id) } : undefined}
                  sx={{
                    fontSize: FS.micro,
                    color: canViewSite ? 'primary.main' : 'text.secondary',
                    cursor: canViewSite ? 'pointer' : 'default',
                    minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    ...(canViewSite ? { '&:hover': { textDecoration: 'underline' } } : {}),
                  }}
                >
                  {contactLabel}
                  {site.primary_contact_phone ? ` · ${site.primary_contact_phone}` : ''}
                </Typography>
              )}
            </Box>
            {addressLine && (
              <Typography color="text.secondary" sx={{
                fontSize: FS.micro,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              }}>
                {addressLine}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Conteggio asset — Info e Contatti spostati qui accanto (come CustomerCard) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
          {issueCount > 0 && (
            <ActionButton
              tone="danger"
              icon={<WarningAmberRoundedIcon />}
              ariaLabel={`${issueCount} issue attive`}
              title={`${issueCount} issue attiv${issueCount === 1 ? 'a' : 'e'}`}
              onClick={(e) => { e.stopPropagation(); setOpen(true) }}
            />
          )}
          <CountStat
            value={totalCount}
            label="asset"
            tooltip="Vai agli asset"
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          />
          {(site.contacts_count ?? 0) > 1 && (
            <Tooltip title="Contatti collegati" arrow>
              <ActionButton
                tone="neutral"
                icon={<GroupsOutlinedIcon />}
                ariaLabel="Contatti sito"
                onClick={(e) => { e.stopPropagation(); setContactsModalOpen(true) }}
              />
            </Tooltip>
          )}
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
        </Box>
      </Box>

      {/* Lista asset */}
      <Collapse in={open} unmountOnExit>
        <Box id={contentId}>
          <InventoryInlineList rows={siteAssets} onOpenDrawer={onOpenDrawer} onRowContextMenu={onInventoryContextMenu} />
        </Box>
      </Collapse>

      <ContactsListModal
        open={contactsModalOpen}
        onClose={() => setContactsModalOpen(false)}
        title={`Contatti — ${site.display_name || site.name}`}
        customerId={site.customer ?? 0}
        siteId={site.id}
        onViewAll={() => { setContactsModalOpen(false); onOpenSiteContacts() }}
      />
    </Box>
  )
}
