import * as React from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import type { LocationGroup, CustomerRow, InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON } from './style'
import { RADIUS, LABEL_COLOR, plural } from './tokens'
import { SignalChip } from './primitives'
import { CustomerCard } from './CustomerCard'

// ─── ProvinceSection ────────────────────────────────────────────────────────
// Rinominato da CitySection: il Site Repository raggruppa i clienti per
// provincia (Customer.province, campo strutturato — vedi
// crm/migrations/0010_customer_province.py), non più per città.
// Aggiornato per essere agnostico rispetto al criterio di raggruppamento:
// riceve un LocationGroup generico (group.label), che a monte (SiteRepository.tsx)
// può essere costruito raggruppando per provincia o per città, a seconda del
// toggle nella toolbar.

type ProvinceSectionProps = {
  group: LocationGroup
  searchQuery: string
  statusFilter: StatusFilter
  counts: Record<number, { assets: number | null; sites: number | null }>
  issueCounts: Record<number, number>
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
  refreshToken: number
}

export type ProvinceSectionHandle = { open: () => void; close: () => void; scrollIntoView: () => void }

export const ProvinceSection = React.forwardRef<ProvinceSectionHandle, ProvinceSectionProps>(
  function ProvinceSection({
    group, searchQuery, statusFilter, counts, issueCounts, onOpenDrawer, onOpenVpn,
    onOpenCustomer, onOpenSite, onOpenCustomerContacts, onOpenSiteContacts, canViewCustomer, canViewSite,
    canChangeSite, onEditSite,
    onCustomerContextMenu, onSiteContextMenu, onInventoryContextMenu,
    refreshToken,
  }, ref) {
    const theme = useTheme()
    const [open, setOpen] = React.useState(false)
    // "Senza provincia/città" segnala un dato mancante, non un luogo: resa attenuata.
    const isUnassigned = group.label === 'Senza provincia' || group.label === 'Senza città'
    const contentId = React.useId()
    const rootRef = React.useRef<HTMLDivElement>(null)

    // Auto-open se c'è una ricerca attiva
    React.useEffect(() => {
      if (searchQuery) setOpen(true)
    }, [searchQuery])

    React.useImperativeHandle(ref, () => ({
      open:  () => setOpen(true),
      close: () => setOpen(false),
      // Usato dalla cartina Italia (ItalyRegionMap): dopo aver selezionato una
      // provincia, apre e scrolla la sezione corrispondente in vista.
      scrollIntoView: () => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    }))

    return (
      <Box ref={rootRef} sx={{
        mb: 2,
        border: '1px solid',
        borderColor: open ? alpha(theme.palette.primary.main, 0.35) : 'divider',
        borderRadius: RADIUS,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        bgcolor: 'background.paper',
      }}>
        {/* Header provincia: etichetta di sezione chiara. Prima era a fondo teal
            pieno e pesava più dei dati che contiene (hostname, IP). */}
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
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            py: 1.125, px: 2,
            cursor: 'pointer',
            bgcolor: open ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
            borderBottom: open ? '1px solid' : 'none',
            borderColor: alpha(theme.palette.primary.main, 0.2),
            transition: 'background 0.2s',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, open ? 0.09 : 0.04) },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: theme.palette.primary.main,
              outlineOffset: -2,
            },
          }}
        >
          <PlaceOutlinedIcon sx={{ fontSize: ICON.feature, color: isUnassigned ? 'text.disabled' : 'primary.main', flexShrink: 0 }} />

          <Typography fontWeight={700} sx={{
            fontSize: FS.section,
            color: isUnassigned ? 'text.secondary' : open ? 'primary.dark' : 'text.primary',
            fontStyle: isUnassigned ? 'italic' : 'normal',
          }}>
            {group.label}
          </Typography>
          <Typography sx={{ fontSize: FS.body, color: LABEL_COLOR }}>
            {plural(group.customers.length, 'cliente', 'clienti')}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Issue attive nel gruppo — "segnale", sempre visibile quando presenti */}
          {group.issueCount > 0 && (
            <SignalChip
              tone="error"
              icon={<WarningAmberRoundedIcon />}
              label={`${group.issueCount} issue attiv${group.issueCount === 1 ? 'a' : 'e'}`}
            />
          )}

          <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ ml: 0.25, color: 'grey.700' }}>
            {open ? <ExpandLessIcon sx={{ fontSize: ICON.action }} /> : <ExpandMoreIcon sx={{ fontSize: ICON.action }} />}
          </IconButton>
        </Box>

        {/* Lista clienti — zebra, no gap */}
        <Collapse in={open} unmountOnExit>
          <Box id={contentId}>
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
                onOpenCustomerContacts={onOpenCustomerContacts}
                onOpenSiteContacts={onOpenSiteContacts}
                canViewCustomer={canViewCustomer}
                canViewSite={canViewSite}
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
