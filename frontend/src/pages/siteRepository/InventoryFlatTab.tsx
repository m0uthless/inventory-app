import * as React from 'react'
import { Box, Skeleton, Typography } from '@mui/material'

import { api } from '@shared/api/client'

import type { InventoryRow, StatusFilter } from './types'
import { FS, matchesSearch, matchesStatusFilter } from './style'
import { InventoryInlineList } from './InventoryInlineList'

// ─── InventoryFlatTab ─────────────────────────────────────────────────────────

type InventoryTabProps = {
  customerId: number
  searchQuery: string
  statusFilter: StatusFilter
  onOpenDrawer: (id: number) => void
  onInventoryContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  refreshToken: number
}

export function InventoryFlatTab({ customerId, searchQuery, statusFilter, onOpenDrawer, onInventoryContextMenu, refreshToken }: InventoryTabProps) {
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
