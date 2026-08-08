import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Alert, Box, Skeleton, Stack } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'
import VpnModal from '../features/customers/VpnModal'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { buildQuery } from '@shared/utils/nav'
import InventoryDrawer from '../features/inventory/InventoryDrawer'
import type { InventoryDetail } from '../features/inventory/types'
import type { CustomerDetail } from '../features/customers/types'
import type { SiteDetail } from '../features/sites/types'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { useSiteRepoV2 } from '../features/siterepov2/SiteRepoV2Context'
import type { SiteRepoV2Handle } from '../features/siterepov2/SiteRepoV2Context'

import type { CustomerRow, SiteRow, InventoryRow, ProvinceGroup, StatusFilter } from './siteRepository/types'
import { normalizeProvince, matchesStatusFilter } from './siteRepository/style'
import { ProvinceSection, type ProvinceSectionHandle } from './siteRepository/ProvinceSection'
import { CustomerInfoDrawer, SiteInfoDrawer } from './siteRepository/InfoDrawers'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SiteRepository() {
  const { hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { searchQuery, registerHandle, unregisterHandle, setTotals } = useSiteRepoV2()

  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets)
  const canChange      = hasPerm(PERMS.inventory.inventory.change)
  const canDelete      = hasPerm(PERMS.inventory.inventory.delete)
  const canViewCustomer   = hasPerm(PERMS.crm.customer.view)
  const canViewSite        = hasPerm(PERMS.crm.site.view)
  const canChangeCustomer = hasPerm(PERMS.crm.customer.change)
  const canDeleteCustomer = hasPerm(PERMS.crm.customer.delete)
  const canChangeSite      = hasPerm(PERMS.crm.site.change)
  const canDeleteSite      = hasPerm(PERMS.crm.site.delete)
  const canAddIssue        = hasPerm(PERMS.issues.issue.add)

  // Quick-view Cliente/Sito: drawer di sola lettura aperto senza lasciare la
  // pagina (i tab Siti/Inventari dei drawer "ufficiali" sarebbero ridondanti
  // qui, dato che sono già visibili inline).
  const [customerDrawerOpen, setCustomerDrawerOpen]       = React.useState(false)
  const [customerDrawerId, setCustomerDrawerId]           = React.useState<number | null>(null)
  const [customerDrawerDetail, setCustomerDrawerDetail]   = React.useState<CustomerDetail | null>(null)
  const [customerDrawerLoading, setCustomerDrawerLoading] = React.useState(false)

  const [siteDrawerOpen, setSiteDrawerOpen]       = React.useState(false)
  const [siteDrawerId, setSiteDrawerId]           = React.useState<number | null>(null)
  const [siteDrawerDetail, setSiteDrawerDetail]   = React.useState<SiteDetail | null>(null)
  const [siteDrawerLoading, setSiteDrawerLoading] = React.useState(false)

  const openCustomerDetail = React.useCallback((id: number) => {
    setCustomerDrawerId(id); setCustomerDrawerOpen(true)
    setCustomerDrawerLoading(true); setCustomerDrawerDetail(null)
    api.get(`/customers/${id}/`)
      .then((res) => setCustomerDrawerDetail(res.data as CustomerDetail))
      .catch((e: unknown) => toast.error(apiErrorToMessage(e)))
      .finally(() => setCustomerDrawerLoading(false))
  }, [toast])

  const openSiteDetail = React.useCallback((id: number) => {
    setSiteDrawerId(id); setSiteDrawerOpen(true)
    setSiteDrawerLoading(true); setSiteDrawerDetail(null)
    api.get(`/sites/${id}/`)
      .then((res) => setSiteDrawerDetail(res.data as SiteDetail))
      .catch((e: unknown) => toast.error(apiErrorToMessage(e)))
      .finally(() => setSiteDrawerLoading(false))
  }, [toast])

  const closeCustomerDrawer = React.useCallback(() => setCustomerDrawerOpen(false), [])
  const closeSiteDrawer     = React.useCallback(() => setSiteDrawerOpen(false), [])

  // Deep-link a /customers, /sites, /inventory per la modifica: il form di
  // modifica è privato di quelle pagine (validazioni, campi custom, dropdown
  // dipendenti) — riprodurlo qui duplicherebbe centinaia di righe. "return"
  // riporta su Site Repository alla chiusura del drawer.
  const editCustomerElsewhere = React.useCallback((id: number) => {
    navigate(`/customers${buildQuery({ open: id, return: location.pathname + location.search })}`)
  }, [navigate, location])
  const editSiteElsewhere = React.useCallback((id: number) => {
    navigate(`/sites${buildQuery({ open: id, return: location.pathname + location.search })}`)
  }, [navigate, location])
  const editInventoryElsewhere = React.useCallback((id: number) => {
    navigate(`/inventory${buildQuery({ open: id, return: location.pathname + location.search })}`)
  }, [navigate, location])

  const openIssueFromInventory = React.useCallback((row: InventoryRow, customerName: string) => {
    navigate('/issues', {
      state: {
        createFromInventory: {
          inventoryId: row.id,
          inventoryName: row.name || row.hostname || row.knumber || `Inventory #${row.id}`,
          inventoryKnumber: row.knumber ?? null,
          inventorySerialNumber: row.serial_number ?? null,
          inventoryHostname: row.hostname ?? null,
          customerId: row.customer,
          customerName,
          siteId: row.site ?? null,
        },
      },
    })
  }, [navigate])

  // Menu contestuale (tasto destro) — stesso set di azioni della vecchia
  // pagina Site Repository (che incorporava le griglie di Clienti/Siti/
  // Inventari, ciascuna con il proprio menu). "Apri" e "VPN" restano inline;
  // "Modifica" apre la pagina dedicata (vedi sopra); "Elimina" chiede conferma
  // e aggiorna la lista qui senza ricaricare tutto.
  type CtxMenuState =
    | { kind: 'inventory'; row: InventoryRow; mouseX: number; mouseY: number }
    | { kind: 'site'; row: SiteRow; mouseX: number; mouseY: number }
    | { kind: 'customer'; row: CustomerRow; mouseX: number; mouseY: number }
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenuState | null>(null)

  const handleInventoryContextMenu = React.useCallback((row: InventoryRow, e: React.MouseEvent) => {
    setCtxMenu({ kind: 'inventory', row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })
  }, [])
  const handleSiteContextMenu = React.useCallback((row: SiteRow, e: React.MouseEvent) => {
    setCtxMenu({ kind: 'site', row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })
  }, [])
  const handleCustomerContextMenu = React.useCallback((row: CustomerRow, e: React.MouseEvent) => {
    setCtxMenu({ kind: 'customer', row, mouseX: e.clientX + 2, mouseY: e.clientY - 6 })
  }, [])
  const closeCtxMenu = React.useCallback(() => setCtxMenu(null), [])

  const [customers, setCustomers]               = React.useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = React.useState(true)

  // Bump per forzare il refetch dei figli espansi (siti/asset) dopo un delete,
  // ora che i loro dati non sono più derivati da liste globali in memoria.
  const [refreshToken, setRefreshToken] = React.useState(0)

  // La ricerca ora gira sul server (?search=), quindi va sfasata rispetto alla
  // digitazione per non emettere una richiesta per ogni tasto premuto.
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery)
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  // Un'unica chiamata: i clienti. I contatori (assets_count, sites_count,
  // active_issue_count) sono annotati dal backend.
  //
  // Prima questa pagina scaricava in parallelo TUTTI gli inventory e TUTTI i
  // siti (page_size 2000/1000) per contarli e cercarci dentro lato client. Due
  // problemi: il conteggio era sbagliato non appena i record superavano la
  // pagina, e la ricerca vedeva solo la porzione scaricata. Ora conteggio e
  // ricerca li fa il DB, che è l'unico che vede tutti i dati.
  const loadCustomers = React.useCallback(() => {
    let cancelled = false
    setCustomersLoading(true)

    api.get('/customers/', {
      params: {
        page_size: 200,
        ordering: 'name',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      },
    })
      .then((custRes) => {
        if (cancelled) return
        setCustomers(custRes.data?.results ?? [])
      })
      .catch((e: unknown) => { if (!cancelled) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (!cancelled) setCustomersLoading(false) })

    return () => { cancelled = true }
  }, [debouncedSearch, toast])

  React.useEffect(() => loadCustomers(), [loadCustomers])

  const [deleteTarget, setDeleteTarget] = React.useState<CtxMenuState | null>(null)
  const [deleteRowBusy, setDeleteRowBusy] = React.useState(false)

  const confirmDeleteRow = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleteRowBusy(true)
    try {
      if (deleteTarget.kind === 'inventory') {
        await api.delete(`/inventories/${deleteTarget.row.id}/`)
        toast.success('Asset eliminato.')
        // Refetch clienti (aggiorna assets_count) + forza il refetch delle tab
        // espanse, che non condividono più una lista globale.
        loadCustomers()
        setRefreshToken((t) => t + 1)
      } else if (deleteTarget.kind === 'site') {
        await api.delete(`/sites/${deleteTarget.row.id}/`)
        toast.success('Sito eliminato.')
        loadCustomers()
        setRefreshToken((t) => t + 1)
      } else {
        await api.delete(`/customers/${deleteTarget.row.id}/`)
        setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.row.id))
        toast.success('Cliente eliminato.')
      }
      setDeleteTarget(null)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteRowBusy(false)
    }
  }, [deleteTarget, toast, loadCustomers])

  const statusFilter: StatusFilter = 'all'

  // Contatori letti dalle annotazioni del backend (niente più derivazione da
  // liste in memoria).
  const counts = React.useMemo(() => {
    const map: Record<number, { assets: number | null; sites: number | null }> = {}
    customers.forEach((c) => {
      // "sites" alimenta il badge "siti": deve contare solo i siti con asset
      // collegati, coerentemente con i siti effettivamente visibili nella tab
      // (SitesWithInventoryTab nasconde i siti senza asset).
      map[c.id] = { assets: c.assets_count ?? 0, sites: c.sites_with_assets_count ?? 0 }
    })
    return map
  }, [customers])

  // Badge "segnale": numero di asset del cliente con almeno una issue attiva.
  const issueCountsByCustomer = React.useMemo(() => {
    const map: Record<number, number> = {}
    customers.forEach((c) => {
      if (c.active_issue_count) map[c.id] = c.active_issue_count
    })
    return map
  }, [customers])

  // Il filtro per ricerca lo applica già il backend: qui resta solo il filtro
  // di stato, che è puramente client-side.
  const filteredCustomers = React.useMemo(
    () => customers.filter((c) => matchesStatusFilter(statusFilter, c.status_label)),
    [customers, statusFilter],
  )

  const provinceGroups = React.useMemo<ProvinceGroup[]>(() => {
    const map = new Map<string, CustomerRow[]>()
    filteredCustomers.forEach((c) => {
      const province = normalizeProvince(c.province)
      if (!map.has(province)) map.set(province, [])
      map.get(province)!.push(c)
    })
    return Array.from(map.entries())
      .map(([province, custs]) => ({
        province,
        customers: custs,
        // Somma delle issue attive di tutti i clienti della provincia
        issueCount: custs.reduce((sum, c) => sum + (issueCountsByCustomer[c.id] ?? 0), 0),
      }))
      .sort((a, b) => {
        if (a.province === 'Senza provincia') return 1
        if (b.province === 'Senza provincia') return -1
        return a.province.localeCompare(b.province, 'it')
      })
  }, [filteredCustomers, issueCountsByCustomer])

  // Refs per Comprimi / Espandi tutto
  const sectionRefs = React.useRef<Map<string, ProvinceSectionHandle>>(new Map())

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
    setTotals(filteredCustomers.length, provinceGroups.length)
  }, [filteredCustomers.length, provinceGroups.length, setTotals])

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

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    if (!ctxMenu) return []

    if (ctxMenu.kind === 'inventory') {
      const row = ctxMenu.row
      const items: RowContextMenuItem[] = [
        { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openDrawer(row.id) },
      ]
      if (canChange) items.push({ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => editInventoryElsewhere(row.id) })
      if (canAddIssue) items.push({
        key: 'open-issue', label: 'Apri issue', icon: <ConfirmationNumberOutlinedIcon fontSize="small" />,
        onClick: () => {
          const cust = customers.find((c) => c.id === row.customer)
          openIssueFromInventory(row, cust?.display_name || cust?.name || `Cliente #${row.customer}`)
        },
      })
      if (canDelete) items.push({ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(ctxMenu), tone: 'danger' })
      return items
    }

    if (ctxMenu.kind === 'site') {
      const row = ctxMenu.row
      const items: RowContextMenuItem[] = []
      if (canViewSite) items.push({ key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openSiteDetail(row.id) })
      if (canChangeSite) items.push({ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => editSiteElsewhere(row.id) })
      if (canDeleteSite) items.push({ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(ctxMenu), tone: 'danger' })
      return items
    }

    // customer
    const row = ctxMenu.row
    const items: RowContextMenuItem[] = []
    if (canViewCustomer) items.push({ key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openCustomerDetail(row.id) })
    if (canChangeCustomer) items.push({ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => editCustomerElsewhere(row.id) })
    if (row.has_vpn) items.push({ key: 'vpn', label: 'VPN', icon: <VpnLockIcon fontSize="small" sx={{ color: 'primary.main' }} />, onClick: () => openVpnModal(row), badge: 'configurata', badgeTone: 'success' })
    if (canDeleteCustomer) items.push({ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDeleteTarget(ctxMenu), tone: 'danger' })
    return items
  }, [
    ctxMenu, canChange, canDelete, canAddIssue, canViewSite, canChangeSite, canDeleteSite,
    canViewCustomer, canChangeCustomer, canDeleteCustomer, customers,
    openDrawer, editInventoryElsewhere, openIssueFromInventory,
    openSiteDetail, editSiteElsewhere, openCustomerDetail, editCustomerElsewhere, openVpnModal,
  ])

  const deleteDialogCopy = React.useMemo(() => {
    if (!deleteTarget) return { title: 'Confermi eliminazione?', description: undefined as string | undefined }
    if (deleteTarget.kind === 'inventory') return {
      title: 'Confermi eliminazione?',
      description: 'L’asset verrà spostato nel cestino e potrà essere ripristinato dalla pagina Inventari.',
    }
    if (deleteTarget.kind === 'site') return {
      title: 'Confermi eliminazione del sito?',
      description: 'Il sito verrà spostato nel cestino e potrà essere ripristinato dalla pagina Siti.',
    }
    return {
      title: 'Confermi eliminazione del cliente?',
      description: 'Il cliente verrà spostato nel cestino e potrà essere ripristinato dalla pagina Clienti.',
    }
  }, [deleteTarget])

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
      ) : provinceGroups.length === 0 ? (
        <Alert severity="info">
          {customers.length === 0 ? 'Nessun cliente trovato.' : 'Nessun risultato per i filtri selezionati.'}
        </Alert>
      ) : (
        <Stack spacing={0} sx={{ gap: 0 }}>
          {provinceGroups.map((group) => (
            <ProvinceSection
              key={group.province}
              group={group}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              counts={counts}
              issueCounts={issueCountsByCustomer}
              onOpenDrawer={openDrawer}
              onOpenVpn={openVpnModal}
              onOpenCustomer={openCustomerDetail}
              onOpenSite={openSiteDetail}
              canViewCustomer={canViewCustomer}
              canViewSite={canViewSite}
              canChangeCustomer={canChangeCustomer}
              onEditCustomer={editCustomerElsewhere}
              canChangeSite={canChangeSite}
              onEditSite={editSiteElsewhere}
              onCustomerContextMenu={handleCustomerContextMenu}
              onSiteContextMenu={handleSiteContextMenu}
              onInventoryContextMenu={handleInventoryContextMenu}
              refreshToken={refreshToken}
              ref={(el) => {
                if (el) sectionRefs.current.set(group.province, el)
                else sectionRefs.current.delete(group.province)
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

      <CustomerInfoDrawer
        open={customerDrawerOpen}
        detail={customerDrawerDetail}
        detailLoading={customerDrawerLoading}
        selectedId={customerDrawerId}
        onClose={closeCustomerDrawer}
      />

      <SiteInfoDrawer
        open={siteDrawerOpen}
        detail={siteDrawerDetail}
        detailLoading={siteDrawerLoading}
        selectedId={siteDrawerId}
        onClose={closeSiteDrawer}
      />

      {/* Menu contestuale (tasto destro) — Cliente/Sito/Asset */}
      <RowContextMenu
        open={Boolean(ctxMenu)}
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        onClose={closeCtxMenu}
        items={contextMenuItems}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        busy={deleteRowBusy}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRow}
      />
    </Stack>
  )
}
