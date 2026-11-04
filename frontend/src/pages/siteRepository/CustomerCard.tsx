import * as React from 'react'
import { Box, Collapse, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import StatusChip from '@shared/ui/StatusChip'
import { isRecord } from '@shared/utils/guards'

import type { CustomerRow, InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON, Highlight, MonoField } from './style'
import { MetaTag, ActionButton, CountStat } from './primitives'
import { SitesWithInventoryTab } from './SitesWithInventoryTab'
import { InventoryFlatTab } from './InventoryFlatTab'
import { ContactsListModal } from './ContactsListModal'

// ─── CustomerCard ─────────────────────────────────────────────────────────────

// Stessa logica di estrazione usata in InfoDrawers.tsx (CustomerInfoDrawer):
// l'indirizzo del cliente non è un campo strutturato ma vive dentro
// custom_fields sotto la chiave "indirizzo" (case-insensitive).
function customerAddressFromRow(customer: CustomerRow): string | null {
  const cf = customer.custom_fields ?? null
  if (!isRecord(cf)) return null
  const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === 'indirizzo')
  if (!key) return null
  const v = cf[key]
  if (typeof v !== 'string' || !v.trim()) return null
  const parts = [v.trim(), customer.city?.trim()].filter(Boolean)
  return parts.join(', ')
}

type CustomerCardProps = {
  customer: CustomerRow
  searchQuery: string
  statusFilter: StatusFilter
  assetCount: number | null
  siteCount: number | null
  issueCount: number
  onOpenDrawer: (id: number, typeKeyHint?: string | null) => void
  onOpenVpn: (customer: CustomerRow) => void
  onOpenCustomer: (id: number) => void
  onOpenSite: (id: number) => void
  onOpenCustomerContacts: (customerId: number) => void
  onOpenSiteContacts: (customerId: number, siteId: number) => void
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
  onOpenCustomer, onOpenSite, onOpenCustomerContacts, onOpenSiteContacts, canViewCustomer, canViewSite,
  canChangeSite, onEditSite,
  onCustomerContextMenu, onSiteContextMenu, onInventoryContextMenu,
  rowIndex, isLast, refreshToken,
}: CustomerCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = React.useState(false)
  const [tab, setTab] = React.useState(0)
  const [noteModalOpen, setNoteModalOpen] = React.useState(false)
  const [contactsModalOpen, setContactsModalOpen] = React.useState(false)
  const contentId = React.useId()

  // Auto-open se c'è una ricerca attiva
  React.useEffect(() => {
    if (searchQuery) setExpanded(true)
    else setExpanded(false)
  }, [searchQuery])

  const zebraBg = rowIndex % 2 === 0 ? 'background.paper' : alpha(theme.palette.primary.main, 0.025)
  const addressLine = React.useMemo(() => customerAddressFromRow(customer), [customer])
  const customerName = customer.display_name || customer.name
  const hasNotes = Boolean(customer.notes && customer.notes.trim().length > 0)

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
        aria-label={`Cliente ${customerName}`}
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((p) => !p)
          }
        }}
        onContextMenu={(e) => { e.preventDefault(); onCustomerContextMenu(customer, e) }}
        sx={{
          // Da md in su: identità a sinistra, contatori e azioni a destra.
          // Sotto md due righe: prima il nome a tutta larghezza (prima a 390px
          // restavano 1-3 lettere), poi contatori e azioni.
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) auto auto' },
          gridTemplateAreas: {
            xs: '"id chevron" "actions actions"',
            md: '"id actions chevron"',
          },
          alignItems: 'center',
          columnGap: 1.5, rowGap: 1,
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
        <Box sx={{ gridArea: 'id', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.5, minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ fontSize: FS.title, minWidth: 0, overflowWrap: 'anywhere' }}>
              <Highlight text={customerName} query={searchQuery} />
            </Typography>
            <MonoField value={customer.code} query={searchQuery} sx={{ flexShrink: 0 }} />
            {(customer.tags ?? []).length > 0 && (
              <MetaTag label={(customer.tags ?? [])[0]} sx={{ flexShrink: 0 }} />
            )}
            {customer.status_label ? (
              <StatusChip statusId={customer.status ?? undefined} label={customer.status_label} size="small" sx={{ flexShrink: 0, fontWeight: 700 }} />
            ) : null}
          </Box>
          {customer.primary_contact_name && (
            <Typography
              component={canViewCustomer ? 'button' : 'span'}
              onClick={canViewCustomer ? (e: React.MouseEvent) => { e.stopPropagation(); onOpenCustomer(customer.id) } : undefined}
              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
              sx={{
                display: 'block', p: 0, border: 0, bgcolor: 'transparent', font: 'inherit', textAlign: 'left',
                fontSize: FS.body,
                color: canViewCustomer ? 'primary.dark' : 'text.secondary',
                cursor: canViewCustomer ? 'pointer' : 'default',
                maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                ...(canViewCustomer ? { '&:hover': { textDecoration: 'underline' } } : {}),
              }}
            >
              {customer.primary_contact_name}
              {customer.primary_contact_phone ? ` · ${customer.primary_contact_phone}` : ''}
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

        <Box sx={{ gridArea: 'actions', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <CountStat
            value={siteCount ?? '—'}
            label={siteCount === 1 ? 'sito' : 'siti'}
            tooltip="Vai ai siti"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setTab(0) }}
          />
          <CountStat
            value={assetCount ?? '—'}
            label="asset"
            tooltip="Vai agli asset"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setTab(siteCount ? 1 : 0) }}
          />
          {/* Larghezza riservata alle azioni: i contatori restano in colonna tra
              clienti con e senza Note/VPN/Contatti (5 bottoni: icona sotto lg, etichetta da lg). */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: { xs: 'flex-start', md: 'flex-end' }, minWidth: { md: 204, lg: 365 } }}>
          {issueCount > 0 && (
            <ActionButton
              tone="danger"
              icon={<WarningAmberRoundedIcon />}
              ariaLabel={`${issueCount} asset con issue attive`}
              title={`${issueCount} asset con issue attiv${issueCount === 1 ? 'a' : 'e'}`}
              onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            />
          )}
          {hasNotes && (
            <ActionButton
              tone="warning"
              icon={<NoteAltOutlinedIcon />}
              ariaLabel="Note del cliente"
              label="Note"
              title="Leggi le note del cliente"
              onClick={(e) => { e.stopPropagation(); setNoteModalOpen(true) }}
            />
          )}
          {customer.has_vpn && (
            <ActionButton
              tone="success"
              icon={<VpnLockIcon />}
              ariaLabel="VPN del cliente"
              label="VPN"
              title="Apri l'accesso VPN"
              onClick={(e) => { e.stopPropagation(); onOpenVpn(customer) }}
            />
          )}
          {(customer.contacts_count ?? 0) > 1 && (
            <ActionButton
              tone="neutral"
              icon={<GroupsOutlinedIcon />}
              ariaLabel="Contatti del cliente"
              label="Contatti"
              title="Contatti collegati al cliente"
              onClick={(e) => { e.stopPropagation(); setContactsModalOpen(true) }}
            />
          )}
          {canViewCustomer && (
            <ActionButton
              tone="neutral"
              icon={<InfoOutlinedIcon />}
              ariaLabel="Scheda del cliente"
              label="Scheda"
              title="Apri la scheda del cliente"
              onClick={(e) => { e.stopPropagation(); onOpenCustomer(customer.id) }}
            />
          )}
          </Box>
        </Box>

        <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ gridArea: 'chevron', alignSelf: { xs: 'start', md: 'center' } }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
        </IconButton>
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
                textColor="primary"
                indicatorColor="primary"
                sx={{
                  px: 2, minHeight: 40,
                  borderBottom: '1px solid', borderColor: 'divider',
                  '& .MuiTab-root': {
                    minHeight: 40, fontSize: FS.label, fontWeight: 700,
                    textTransform: 'none', py: 0,
                    color: 'grey.700',
                  },
                  '& .MuiTab-root.Mui-selected': {
                    color: 'primary.main',
                  },
                  '& .MuiTabs-indicator': {
                    bgcolor: 'primary.main',
                  },
                }}
              >
                <Tab label={`${siteCount === 1 ? 'Sito' : 'Siti'} con asset · ${siteCount}`} />
                <Tab label={`Tutti gli asset${assetCount != null ? ` · ${assetCount}` : ''}`} />
              </Tabs>

              {tab === 0 && (
                <SitesWithInventoryTab
                  customerId={customer.id}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  onOpenDrawer={onOpenDrawer}
                  onOpenSite={onOpenSite}
                  onOpenSiteContacts={(siteId) => onOpenSiteContacts(customer.id, siteId)}
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

      <ContactsListModal
        open={contactsModalOpen}
        onClose={() => setContactsModalOpen(false)}
        title={`Contatti — ${customer.display_name || customer.name}`}
        customerId={customer.id}
        onViewAll={() => { setContactsModalOpen(false); onOpenCustomerContacts(customer.id) }}
      />
    </Box>
  )
}
