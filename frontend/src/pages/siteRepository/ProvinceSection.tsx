import * as React from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import type { LocationGroup, CustomerRow, InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, ICON } from './style'
import { SignalChip, MetaTag } from './primitives'
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

export type ProvinceSectionHandle = { open: () => void; close: () => void }

export const ProvinceSection = React.forwardRef<ProvinceSectionHandle, ProvinceSectionProps>(
  function ProvinceSection({
    group, searchQuery, statusFilter, counts, issueCounts, onOpenDrawer, onOpenVpn,
    onOpenCustomer, onOpenSite, canViewCustomer, canViewSite,
    canChangeCustomer, onEditCustomer, canChangeSite, onEditSite,
    onCustomerContextMenu, onSiteContextMenu, onInventoryContextMenu,
    refreshToken,
  }, ref) {
    const theme = useTheme()
    const [open, setOpen] = React.useState(false)
    const contentId = React.useId()

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
        {/* Header provincia — unico elemento a fondo pieno della pagina: massima densità informativa (elevazione) */}
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
            bgcolor: open ? theme.palette.primary.dark : 'background.paper',
            transition: 'background 0.2s',
            '&:hover': { bgcolor: open ? theme.palette.primary.dark : 'grey.50' },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: open ? '#fff' : theme.palette.primary.main,
              outlineOffset: -2,
            },
          }}
        >
          <PlaceOutlinedIcon sx={{ fontSize: ICON.feature, color: open ? 'rgba(255,255,255,0.75)' : 'primary.main', flexShrink: 0 }} />

          <Typography fontWeight={700} sx={{ fontSize: FS.section, color: open ? '#fff' : 'text.primary' }}>
            {group.label}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Issue attive nel gruppo — "segnale", sempre visibile quando presenti */}
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

          <IconButton size="small" tabIndex={-1} aria-hidden="true" sx={{ ml: 0.25, color: open ? '#fff' : 'text.secondary' }}>
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
