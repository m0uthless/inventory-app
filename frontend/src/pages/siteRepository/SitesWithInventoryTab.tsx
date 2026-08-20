import * as React from 'react'
import { Box, Skeleton, Typography } from '@mui/material'

import { api } from '@shared/api/client'

import type { InventoryRow, SiteRow, StatusFilter } from './types'
import { FS, matchesSearch, matchesStatusFilter } from './style'
import { SITE_COL, SITE_HEADERS, CollapsibleSiteRow } from './CollapsibleSiteRow'
import { InventoryInlineList } from './InventoryInlineList'

// ─── SitesWithInventoryTab ────────────────────────────────────────────────────

type SitesWithInventoryTabProps = {
  customerId: number
  searchQuery: string
  statusFilter: StatusFilter
  onOpenDrawer: (id: number, typeKeyHint?: string | null) => void
  onOpenSite: (id: number) => void
  onOpenSiteContacts: (siteId: number) => void
  canViewSite: boolean
  canChangeSite: boolean
  onEditSite: (id: number) => void
  onSiteContextMenu: (site: SiteRow, e: React.MouseEvent) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  // Cambia dopo un delete nel Site Repository: forza il refetch dei dati del
  // cliente (prima arrivava implicitamente via le prop preloaded* globali).
  refreshToken: number
}

export function SitesWithInventoryTab({
  customerId, searchQuery, statusFilter, onOpenDrawer, onOpenSite, onOpenSiteContacts, canViewSite,
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

  // Siti con almeno un asset collegato: un sito senza asset non viene mostrato
  // nel Site Repository (richiesta: nascondere i siti "vuoti").
  const sitesWithAssets = React.useMemo(
    () => sites.filter((s) => inventory.some((inv) => inv.site === s.id)),
    [sites, inventory],
  )

  // Siti visibili: quelli che matchano per nome/città OPPURE hanno asset matchanti
  const visibleSites = React.useMemo(() => {
    if (!searchQuery) return sitesWithAssets
    return sitesWithAssets.filter((s) => {
      if (matchesSearch(searchQuery, s.name, s.display_name, s.city, s.address_line1)) return true
      if (matchedAssetIds && inventory.some((inv) => inv.site === s.id && matchedAssetIds.has(inv.id))) return true
      return false
    })
  }, [sitesWithAssets, searchQuery, matchedAssetIds, inventory])

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
          onOpenSiteContacts={() => onOpenSiteContacts(site.id)}
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

      {/* Tutti i siti del cliente sono privi di asset collegati */}
      {visibleSites.length === 0 && !orphans.length && !searchQuery && (
        <Box sx={{ py: 2, px: 2 }}>
          <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>Nessun sito con asset collegati.</Typography>
        </Box>
      )}
    </Box>
  )
}
