import * as React from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import StatusChip from '@shared/ui/StatusChip'

import type { InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON, Highlight, matchesSearch, matchesStatusFilter } from './style'
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

export const SITE_COL = 'minmax(0, 1fr) auto'
export const SITE_HEADERS = ['Sito', '']

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
  const siteName = site.display_name || site.name
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
      {/* Riga sito: da sm in su una griglia nome | azioni; su mobile il nome
          prende tutta la larghezza (prima veniva troncato a 2-3 lettere) e
          contatori/azioni scendono su una seconda riga. */}
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`Sito ${siteName}`}
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
          gridTemplateColumns: { xs: '1fr', sm: SITE_COL },
          alignItems: 'center',
          px: 2, py: 1,
          rowGap: 0.75,
          columnGap: 1.5,
          cursor: 'pointer',
          bgcolor: 'transparent',
          transition: 'background 0.12s',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: theme.palette.primary.main,
            outlineOffset: -2,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, minWidth: 0 }}>
          <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ flexShrink: 0, p: 0.25, mt: '1px' }}>
            {open ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.5, minWidth: 0 }}>
              <Typography fontWeight={open ? 700 : 600} sx={{
                fontSize: FS.title,
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}>
                <Highlight text={siteName} query={searchQuery} />
              </Typography>
              {site.status_label ? (
                <StatusChip statusId={site.status ?? undefined} label={site.status_label} size="small" sx={{ flexShrink: 0, fontWeight: 700 }} />
              ) : null}
            </Box>
            {contactLabel && (
              <Typography
                component={canViewSite ? 'button' : 'span'}
                onClick={canViewSite ? (e: React.MouseEvent) => { e.stopPropagation(); onOpenSite(site.id) } : undefined}
                onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                sx={{
                  display: 'block', p: 0, border: 0, bgcolor: 'transparent', font: 'inherit', textAlign: 'left',
                  fontSize: FS.body,
                  color: canViewSite ? 'primary.dark' : 'text.secondary',
                  cursor: canViewSite ? 'pointer' : 'default',
                  maxWidth: '100%',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  ...(canViewSite ? { '&:hover': { textDecoration: 'underline' } } : {}),
                }}
              >
                {contactLabel}
                {site.primary_contact_phone ? ` · ${site.primary_contact_phone}` : ''}
              </Typography>
            )}
            {addressLine && (
              <Typography color="text.secondary" sx={{
                fontSize: FS.body,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              }}>
                {addressLine}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: { xs: 'flex-start', sm: 'flex-end' }, pl: { xs: 3.5, sm: 0 } }}>
          <CountStat
            value={totalCount}
            label="asset"
            tooltip="Vai agli asset"
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          />
          {/* Larghezza riservata: il contatore asset resta in colonna tra i siti. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: { xs: 'flex-start', sm: 'flex-end' }, minWidth: { sm: 120, lg: 219 } }}>
          {issueCount > 0 && (
            <ActionButton
              tone="danger"
              icon={<WarningAmberRoundedIcon />}
              ariaLabel={`${issueCount} issue attive`}
              title={`${issueCount} issue attiv${issueCount === 1 ? 'a' : 'e'}`}
              onClick={(e) => { e.stopPropagation(); setOpen(true) }}
            />
          )}
          {(site.contacts_count ?? 0) > 1 && (
            <ActionButton
              tone="neutral"
              icon={<GroupsOutlinedIcon />}
              ariaLabel="Contatti del sito"
              label="Contatti"
              title="Contatti collegati al sito"
              onClick={(e) => { e.stopPropagation(); setContactsModalOpen(true) }}
            />
          )}
          {canViewSite && (
            <ActionButton
              tone="neutral"
              icon={<InfoOutlinedIcon />}
              ariaLabel="Scheda del sito"
              label="Scheda"
              title="Apri la scheda del sito"
              onClick={(e) => { e.stopPropagation(); onOpenSite(site.id) }}
            />
          )}
          </Box>
        </Box>
      </Box>

      {/* Lista asset */}
      <Collapse in={open} unmountOnExit>
        <Box id={contentId}>
          <InventoryInlineList rows={siteAssets} searchQuery={searchQuery} onOpenDrawer={onOpenDrawer} onRowContextMenu={onInventoryContextMenu} />
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
