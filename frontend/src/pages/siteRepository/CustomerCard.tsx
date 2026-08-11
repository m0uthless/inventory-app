import * as React from 'react'
import { Box, Collapse, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import StatusChip from '@shared/ui/StatusChip'

import type { CustomerRow, InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON, MonoField } from './style'
import { MetaTag, ActionButton, CountStat } from './primitives'
import { SitesWithInventoryTab } from './SitesWithInventoryTab'
import { InventoryFlatTab } from './InventoryFlatTab'

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
  canChangeSite: boolean
  onEditSite: (id: number) => void
  onCustomerContextMenu: (customer: CustomerRow, e: React.MouseEvent) => void
  onSiteContextMenu: (site: SiteRow, e: React.MouseEvent) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  rowIndex: number
  isLast: boolean
  refreshToken: number
}

export function CustomerCard({
  customer, searchQuery, statusFilter, assetCount, siteCount, issueCount, onOpenDrawer, onOpenVpn,
  onOpenCustomer, onOpenSite, canViewCustomer, canViewSite,
  canChangeSite, onEditSite,
  onCustomerContextMenu, onSiteContextMenu, onInventoryContextMenu,
  rowIndex, isLast, refreshToken,
}: CustomerCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = React.useState(false)
  const [tab, setTab] = React.useState(0)
  const [noteModalOpen, setNoteModalOpen] = React.useState(false)
  const contentId = React.useId()

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
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((p) => !p)
          }
        }}
        onContextMenu={(e) => { e.preventDefault(); onCustomerContextMenu(customer, e) }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.25, cursor: 'pointer',
          bgcolor: 'transparent',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: theme.palette.primary.main,
            outlineOffset: -2,
          },
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
            {/* Note — solo icona, click apre modal con il testo completo (niente più tooltip handover) */}
            {customer.notes && customer.notes.trim().length > 0 && (
              <Tooltip title="Note cliente" arrow>
                <Box
                  onClick={(e) => { e.stopPropagation(); setNoteModalOpen(true) }}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                    bgcolor: alpha(theme.palette.warning.main, 0.10),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.20) },
                  }}
                >
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

          <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ ml: 0.25 }}>
            {expanded ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box id={contentId} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
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

      {/* Modal note cliente — sostituisce il vecchio tooltip handover: testo
          completo, non troncato a 120 caratteri come nel tooltip. */}
      <Dialog open={noteModalOpen} onClose={() => setNoteModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <NoteAltOutlinedIcon sx={{ fontSize: 20, color: theme.palette.warning.dark }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Note — {customer.display_name || customer.name}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setNoteModalOpen(false)} aria-label="Chiudi">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {customer.notes}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
