import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, CircularProgress, InputBase, Skeleton, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'
import { buildQuery } from '@shared/utils/nav'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { useOwnPageHeader } from '../layout/PageHeaderContext'
import { useStatusTokens } from '../theme/AppThemeProvider'
import { CampoIcon } from '../ui/campo'
import { resolveItalianProvince } from '../data/italianProvinces'
import type { RegionId } from '../data/italianRegions'
import VpnModal from '../features/customers/VpnModal'
import { vendorColorOf } from '../features/customers/customerUi'
import InventoryDetailModal, { type InventoryModalDetail as InventoryCardDetail } from '../features/inventory/InventoryDetailModal'
import RecordStackHost from '../features/records/RecordStackHost'
import { AssetTypeIcon } from '../features/inventory/inventoryUi'
import { PROVINCE_NAME, REGION_NAME, RepoMap, regionOf } from '../features/siterepo/RepoMap'
import { AssetHead, AssetRow, Chevron, CustomerBlock, focusInset, Highlight, NameCell, numSx, PrioMark } from '../features/siterepo/RepoTree'
import type { RepoAsset, RepoCustomer, RepoCustomerContent, RepoSite } from '../features/siterepo/types'

// ─── Dati ────────────────────────────────────────────────────────────────────

type Page<T> = { results?: T[]; next?: string | null }
/** Tutte le pagine di una lista (il backend ne restituisce al massimo 200 alla volta). */
async function fetchAll<T>(url: string, params: Record<string, unknown>, cap = 2000): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; out.length < cap; page++) {
    const r = await api.get<Page<T>>(url, { params: { ...params, page, page_size: 200 } })
    out.push(...(r.data.results ?? []))
    if (!r.data.next) break
  }
  return out
}

const provKey = (c: RepoCustomer) => resolveItalianProvince(c.province)?.sigla ?? ''
const PRIO_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
type Lookup = { id: number; label: string; key?: string }
type MenuState =
  | { kind: 'asset'; row: RepoAsset; x: number; y: number }
  | { kind: 'site'; row: RepoSite; x: number; y: number }
  | { kind: 'customer'; row: RepoCustomer; x: number; y: number }

const panelSx = { border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' } as const
const provCols = { display: 'grid', alignItems: 'center', gap: 1.5, gridTemplateColumns: '20px minmax(0,1fr) 70px 56px 60px 76px', '@media (max-width: 760px)': { gridTemplateColumns: '20px minmax(0,1fr) 50px 56px', '& > :nth-of-type(4), & > :nth-of-type(6)': { display: 'none' } } } as const
const groupTitleSx = { fontSize: 11, fontWeight: 600, color: 'text.disabled', display: 'flex', alignItems: 'center', gap: 0.75 } as const
const cntSx = { fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.75, lineHeight: '18px', fontVariantNumeric: 'tabular-nums' } as const

// ─── Pagina ──────────────────────────────────────────────────────────────────

export default function SiteRepository() {
  useOwnPageHeader()
  const { hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const tokens = useStatusTokens()

  const canViewSecrets = hasPerm(PERMS.inventory.inventory.view_secrets)
  const canChange = hasPerm(PERMS.inventory.inventory.change)
  const canDelete = hasPerm(PERMS.inventory.inventory.delete)
  const canAddIssue = hasPerm(PERMS.issues.issue.add)
  const canViewCustomer = hasPerm(PERMS.crm.customer.view)
  const canChangeCustomer = hasPerm(PERMS.crm.customer.change)
  const canDeleteCustomer = hasPerm(PERMS.crm.customer.delete)
  const canViewSite = hasPerm(PERMS.crm.site.view)
  const canChangeSite = hasPerm(PERMS.crm.site.change)
  const canDeleteSite = hasPerm(PERMS.crm.site.delete)
  const returnTo = location.pathname + location.search

  // ── Clienti (tutti: i conteggi per provincia nascono da qui) ──
  const [customers, setCustomers] = React.useState<RepoCustomer[] | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    fetchAll<RepoCustomer>('/customers/', { ordering: 'name' })
      .then((rows) => { if (alive) setCustomers(rows) })
      .catch((e) => { if (alive) { setCustomers([]); toast.error(apiErrorToMessage(e)) } })
    return () => { alive = false }
  }, [reloadKey, toast])

  const [vendors, setVendors] = React.useState<Lookup[]>([])
  const [statuses, setStatuses] = React.useState<Lookup[]>([])
  const [types, setTypes] = React.useState<Lookup[]>([])
  React.useEffect(() => {
    const list = <T,>(d: T[] | Page<T>) => (Array.isArray(d) ? d : d.results ?? [])
    api.get('/customer-statuses/').then((r) => setVendors(list<Lookup>(r.data))).catch(() => {})
    Promise.all([api.get('/inventory-statuses/'), api.get('/inventory-types/')])
      .then(([s, t]) => { setStatuses(list<Lookup>(s.data)); setTypes(list<Lookup>(t.data)) }).catch(() => {})
  }, [])
  const vendorOrder = React.useMemo(() => [...vendors].sort((a, b) => a.id - b.id).map((v) => v.label), [vendors])
  const vendorColor = React.useCallback((l?: string | null) => vendorColorOf(l ?? '', tokens.clientChipPalette, vendorOrder), [tokens.clientChipPalette, vendorOrder])

  // ── Sistemi con issue aperte (riquadro sotto la cartina) ──
  const [hot, setHot] = React.useState<RepoAsset[] | null>(null)
  React.useEffect(() => {
    let alive = true
    fetchAll<RepoAsset>('/inventories/', { has_active_issue: true, ordering: 'name' }, 400)
      .then((rows) => { if (alive) setHot(rows) }).catch(() => { if (alive) setHot([]) })
    return () => { alive = false }
  }, [reloadKey])

  // ── Contenuto dei clienti aperti (siti + asset), caricato al bisogno ──
  const [content, setContent] = React.useState<Record<number, RepoCustomerContent | null>>({})
  const loadCustomer = React.useCallback(async (id: number) => {
    setContent((m) => ({ ...m, [id]: m[id] ?? null }))
    try {
      const [sites, assets] = await Promise.all([
        fetchAll<RepoSite>('/sites/', { customer: id, ordering: 'name' }),
        fetchAll<RepoAsset>('/inventories/', { customer: id, ordering: 'name' }),
      ])
      const bySite = new Map<number | null, RepoAsset[]>()
      assets.forEach((a) => { const k = a.site ?? null; bySite.set(k, [...(bySite.get(k) ?? []), a]) })
      // Solo i siti con almeno un asset, come nel conteggio "siti" dei clienti.
      const withAssets = sites.filter((s) => bySite.has(s.id)).map((s) => ({ ...s, assets: bySite.get(s.id)! }))
      const orphans = bySite.get(null)
      if (orphans?.length) withAssets.push({ id: -id, customer: id, name: 'Senza sito', assets: orphans })
      setContent((m) => ({ ...m, [id]: { sites: withAssets } }))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      setContent((m) => { const n = { ...m }; delete n[id]; return n })
    }
  }, [toast])

  // ── Stato della vista ──
  const [region, setRegion] = React.useState<RegionId | null>(null)
  const [mapProv, setMapProv] = React.useState<string | null>(null)
  const [openProv, setOpenProv] = React.useState<Set<string>>(() => new Set())
  const [openCust, setOpenCust] = React.useState<Set<number>>(() => new Set())
  const [openSite, setOpenSite] = React.useState<Set<number>>(() => new Set())
  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, k: T, force?: boolean) =>
    set((s) => { const n = new Set(s); if (force ?? !n.has(k)) n.add(k); else n.delete(k); return n })

  const toggleCustomer = (id: number) => {
    const willOpen = !openCust.has(id)
    toggle(setOpenCust, id)
    if (willOpen && !(id in content)) void loadCustomer(id)
  }
  const toggleProvince = (p: string) => {
    if (!openProv.has(p)) setMapProv(p || null)
    toggle(setOpenProv, p)
  }

  // ── Ricerca ──
  const [q, setQ] = React.useState('')
  const [dq, setDq] = React.useState('')
  React.useEffect(() => { const t = window.setTimeout(() => setDq(q.trim()), 250); return () => window.clearTimeout(t) }, [q])
  const searchRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault(); searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [found, setFound] = React.useState<{ q: string; assets: RepoAsset[]; sites: (RepoSite & { customer_name?: string })[] } | null>(null)
  React.useEffect(() => {
    if (dq.length < 2) { setFound(null); return }
    let alive = true
    Promise.all([
      api.get<Page<RepoAsset>>('/inventories/', { params: { asset_q: dq, page_size: 50, ordering: 'name' } }),
      api.get<Page<RepoSite & { customer_name?: string }>>('/sites/', { params: { search: dq, page_size: 30, ordering: 'name' } }),
    ]).then(([a, s]) => { if (alive) setFound({ q: dq, assets: a.data.results ?? [], sites: s.data.results ?? [] }) })
      .catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
    return () => { alive = false }
  }, [dq, toast])

  // ── Aggregati ──
  const byId = React.useMemo(() => new Map((customers ?? []).map((c) => [c.id, c])), [customers])
  const provinces = React.useMemo(() => {
    const m = new Map<string, RepoCustomer[]>()
    ;(customers ?? []).forEach((c) => { const k = provKey(c); m.set(k, [...(m.get(k) ?? []), c]) })
    return m
  }, [customers])
  const assetCounts = React.useMemo(() => {
    const m: Record<string, number> = {}
    provinces.forEach((cs, k) => { if (k) m[k] = cs.reduce((n, c) => n + (c.assets_count ?? 0), 0) })
    return m
  }, [provinces])
  const totals = React.useMemo(() => {
    const cs = customers ?? []
    return {
      customers: cs.length,
      sites: cs.reduce((n, c) => n + (c.sites_with_assets_count ?? 0), 0),
      assets: cs.reduce((n, c) => n + (c.assets_count ?? 0), 0),
      provinces: [...provinces.keys()].filter(Boolean).length,
    }
  }, [customers, provinces])
  const list = React.useMemo(() => {
    const ks = [...provinces.keys()].filter((k) => k && (!region || regionOf(k) === region))
      .sort((a, b) => (PROVINCE_NAME[a] ?? a).localeCompare(PROVINCE_NAME[b] ?? b, 'it'))
    if (!region && provinces.has('')) ks.push('')
    return ks
  }, [provinces, region])
  const provStats = (k: string) => {
    const cs = provinces.get(k) ?? []
    return {
      cs, sites: cs.reduce((n, c) => n + (c.sites_with_assets_count ?? 0), 0),
      assets: cs.reduce((n, c) => n + (c.assets_count ?? 0), 0),
      issues: cs.reduce((n, c) => n + (c.active_issue_count ?? 0), 0),
    }
  }
  const hotHere = React.useMemo(() => (hot ?? [])
    .filter((a) => !region || regionOf(provKey(byId.get(a.customer) ?? ({} as RepoCustomer))) === region)
    .sort((x, y) => (PRIO_ORDER[y.active_issue_priority ?? ''] ?? 0) - (PRIO_ORDER[x.active_issue_priority ?? ''] ?? 0) || x.name.localeCompare(y.name, 'it')),
  [hot, region, byId])
  const [hotAll, setHotAll] = React.useState(false)

  // ── Navigazione dalla cartina e dai risultati ──
  const listRef = React.useRef<HTMLDivElement>(null)
  const scrollToProv = (p: string) => window.setTimeout(() => listRef.current?.querySelector(`[data-prov="${p}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50)
  const pickProvince = (p: string) => { setMapProv(p); setRegion(regionOf(p) ?? region); toggle(setOpenProv, p, true); scrollToProv(p) }
  const reveal = (customerId: number, siteId?: number | null) => {
    const c = byId.get(customerId)
    if (!c) return
    const p = provKey(c)
    setQ(''); setDq('')
    setRegion(p ? regionOf(p) : null); setMapProv(p || null)
    toggle(setOpenProv, p, true); toggle(setOpenCust, customerId, true)
    if (siteId) toggle(setOpenSite, siteId, true)
    if (!(customerId in content)) void loadCustomer(customerId)
    scrollToProv(p)
  }

  // ── Pannello dell'asset ──
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<InventoryCardDetail | null>(null)
  const loadDetail = React.useCallback(async (id: number) => {
    try { const r = await api.get<InventoryCardDetail>(`/inventories/${id}/`); setDetail(r.data) }
    catch (e) { toast.error(apiErrorToMessage(e)); setDetail(null) }
  }, [toast])
  const openAsset = (a: RepoAsset | number) => {
    const id = typeof a === 'number' ? a : a.id
    if (id !== selectedId) setDetail(null)
    setSelectedId(id)
    void loadDetail(id)
  }
  const closeAsset = React.useCallback(() => { setSelectedId(null); setDetail(null) }, [])
  const refreshCustomer = (cid: number) => { if (cid in content) void loadCustomer(cid); setReloadKey((k) => k + 1) }

  const openIssueFor = (a: { id: number; name: string; hostname?: string | null; knumber?: string | null; serial_number?: string | null; customer: number; customer_name?: string; site?: number | null }) => {
    navigate('/issues', { state: { createFromInventory: {
      inventoryId: a.id, inventoryName: a.name || a.hostname || a.knumber || `Inventario #${a.id}`,
      inventoryKnumber: a.knumber ?? null, inventorySerialNumber: a.serial_number ?? null, inventoryHostname: a.hostname ?? null,
      customerId: a.customer, customerName: a.customer_name || byId.get(a.customer)?.display_name || `Cliente #${a.customer}`, siteId: a.site ?? null,
    } } })
  }

  // ── Azioni su cliente, sito e asset ──
  const [vpn, setVpn] = React.useState<RepoCustomer | null>(null)
  const exportCustomer = async (c: RepoCustomer) => {
    try {
      const res = await api.get(`/customers/${c.id}/export-site-repository/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = `site_repository_${c.code || c.id}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  const goCustomer = (id: number) => navigate(`/customers${buildQuery({ open: id, return: returnTo })}`)
  const goSite = (id: number) => navigate(`/sites${buildQuery({ open: id, return: returnTo })}`)
  const goInventory = (id: number) => navigate(`/inventory${buildQuery({ open: id, return: returnTo })}`)

  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const [del, setDel] = React.useState<MenuState | null>(null)
  const [delBusy, setDelBusy] = React.useState(false)
  const menuItems = React.useMemo<RowContextMenuItem[]>(() => {
    if (!menu) return []
    if (menu.kind === 'asset') {
      const a = menu.row
      return [
        { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => openAsset(a) },
        ...(canChange ? [{ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => goInventory(a.id) }] : []),
        ...(canAddIssue ? [{ key: 'issue', label: 'Nuova issue', icon: <ConfirmationNumberOutlinedIcon fontSize="small" />, onClick: () => openIssueFor(a) }] : []),
        ...(a.hostname ? [{ key: 'host', label: "Copia l'hostname", icon: <CampoIcon name="copy" />, onClick: async () => { await copyToClipboard(a.hostname!); toast.success('Copiato') } }] : []),
        ...(a.local_ip ? [{ key: 'ip', label: "Copia l'IP locale", icon: <CampoIcon name="copy" />, onClick: async () => { await copyToClipboard(a.local_ip!); toast.success('Copiato') } }] : []),
        ...(canDelete ? [{ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDel(menu), tone: 'danger' as const }] : []),
      ]
    }
    if (menu.kind === 'site') {
      const s = menu.row
      return [
        ...(canViewSite ? [{ key: 'open', label: 'Apri la scheda', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => goSite(s.id) }] : []),
        ...(canChangeSite ? [{ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => goSite(s.id) }] : []),
        ...(canDeleteSite ? [{ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDel(menu), tone: 'danger' as const }] : []),
      ]
    }
    const c = menu.row
    return [
      ...(canViewCustomer ? [{ key: 'open', label: 'Apri la scheda', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => goCustomer(c.id) }] : []),
      ...(canChangeCustomer ? [{ key: 'edit', label: 'Modifica', icon: <EditIcon fontSize="small" />, onClick: () => goCustomer(c.id) }] : []),
      ...(canViewCustomer ? [{ key: 'xls', label: 'Esporta Excel', icon: <GridOnOutlinedIcon fontSize="small" />, onClick: () => void exportCustomer(c) }] : []),
      ...(c.has_vpn ? [{ key: 'vpn', label: 'VPN', icon: <VpnLockIcon fontSize="small" sx={{ color: 'primary.main' }} />, onClick: () => setVpn(c), badge: 'configurata', badgeTone: 'success' as const }] : []),
      ...(canDeleteCustomer ? [{ key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => setDel(menu), tone: 'danger' as const }] : []),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, canChange, canDelete, canAddIssue, canViewSite, canChangeSite, canDeleteSite, canViewCustomer, canChangeCustomer, canDeleteCustomer])

  const confirmDelete = async () => {
    if (!del) return
    setDelBusy(true)
    try {
      if (del.kind === 'asset') { await api.delete(`/inventories/${del.row.id}/`); toast.success('Asset spostato nel cestino'); if (selectedId === del.row.id) closeAsset(); refreshCustomer(del.row.customer) }
      else if (del.kind === 'site') { await api.delete(`/sites/${del.row.id}/`); toast.success('Sito spostato nel cestino'); refreshCustomer(del.row.customer) }
      else { await api.delete(`/customers/${del.row.id}/`); toast.success('Cliente spostato nel cestino'); setReloadKey((k) => k + 1) }
      setDel(null)
    } catch (e) { toast.error(apiErrorToMessage(e)) }
    finally { setDelBusy(false) }
  }
  const deleteCopy = !del ? { title: '', description: '' }
    : del.kind === 'asset' ? { title: "Eliminare l'asset?", description: "L'asset va nel cestino e si può ripristinare dalla pagina Inventari." }
    : del.kind === 'site' ? { title: 'Eliminare il sito?', description: 'Il sito va nel cestino e si può ripristinare dalla pagina Siti.' }
    : { title: 'Eliminare il cliente?', description: 'Il cliente va nel cestino e si può ripristinare dalla pagina Clienti.' }

  const openMenu = (kind: MenuState['kind']) => (row: RepoAsset | RepoSite | RepoCustomer, e: React.MouseEvent) =>
    setMenu({ kind, row, x: e.clientX + 2, y: e.clientY - 6 } as MenuState)

  // ─── Render ────────────────────────────────────────────────────────────────

  const searching = q.trim().length >= 2
  const meta = customers ? (
    <><b>{totals.customers}</b> clienti · <b>{totals.sites}</b> siti · <b>{totals.assets}</b> asset in <b>{totals.provinces}</b> province</>
  ) : null

  return (
    <Box sx={{ pb: 2 }}>
      {/* Testata: titolo e conteggi, ricerca sulla stessa riga */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'grid', gap: '2px', flex: 'none' }}>
          <Typography variant="h4" component="h1">Site Repository</Typography>
          <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', minHeight: 18, '& b': { color: 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }}>{meta}</Typography>
        </Box>
        <Box component="label" sx={{
          flex: '1 1 360px', maxWidth: 560, ml: { md: 1 }, display: 'flex', alignItems: 'center', gap: 1, height: 38, px: 1.25,
          border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px', bgcolor: 'background.paper', color: 'text.secondary',
          '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing },
        }}>
          <CampoIcon name="search" size={16} />
          <InputBase inputRef={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca hostname, IP, K-Number, seriale, cliente o sito"
            inputProps={{ 'aria-label': 'Cerca nel repository' }} sx={{ flex: 1, fontSize: 13, '& input::placeholder': { color: 'text.disabled', opacity: 1 } }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); (e.target as HTMLInputElement).blur() } }} />
          <Box component="kbd" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, px: 0.625, borderRadius: '4px', border: '1px solid', borderColor: 'divider', color: 'text.disabled' }}>/</Box>
        </Box>
      </Box>

      {searching ? (
        <SearchResults q={q.trim()} found={found} customers={customers ?? []} selectedId={selectedId} vendorColor={vendorColor}
          onOpenAsset={openAsset} onReveal={reveal} onClear={() => setQ('')} onAssetMenu={openMenu('asset')} />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0,1fr)' }, gap: 1.5, alignItems: 'start' }}>
          {/* Sinistra: cartina e sistemi con issue aperte */}
          <Box component="aside" sx={{ ...panelSx, p: 1.5, display: 'grid', gap: 1.25, position: { lg: 'sticky' }, top: { lg: 0 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 28, fontSize: 13 }}>
              {region ? (
                <>
                  <ButtonBase onClick={() => { setRegion(null); setMapProv(null) }} sx={[{ height: 26, pl: 0.5, pr: 1, gap: '2px', borderRadius: '6px', border: '1px solid', borderColor: 'divider', fontSize: 12, color: 'text.secondary', '&:hover': { bgcolor: 'archie.surface2' } }, focusInset]}>
                    <CampoIcon name="chevL" size={14} />Italia
                  </ButtonBase>
                  <b>{REGION_NAME[region]}</b>
                </>
              ) : <><b>Italia</b><Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>scegli una regione</Typography></>}
            </Box>
            <Box sx={{ px: 1, py: 0.5, borderRadius: '8px', bgcolor: 'archie.surface2' }}>
              {customers ? <RepoMap counts={assetCounts} region={region} selectedProvince={mapProv} onRegion={(r) => { setRegion(r); setMapProv(null) }} onProvince={pickProvince} />
                : <Skeleton variant="rounded" height={300} />}
            </Box>
            <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 11, color: 'text.secondary', px: '2px' }}>
              <span>meno asset</span>
              <Box sx={(t) => ({ flex: 1, height: 6, borderRadius: '3px', background: `linear-gradient(90deg, color-mix(in oklab, ${t.palette.primary.main} 18%, ${t.palette.archie.surface2}), ${t.palette.primary.main})` })} />
              <span>più asset</span>
            </Box>
            <Box sx={{ display: 'grid', gap: '1px', borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
              <Typography component="h2" sx={{ ...groupTitleSx, p: '8px 4px 2px' }}>
                Sistemi con issue aperte · {region ? REGION_NAME[region] : 'Italia'} <Box component="span" sx={cntSx}>{hot ? hotHere.length : '…'}</Box>
              </Typography>
              {!hot ? <Box sx={{ py: 2, display: 'grid', placeItems: 'center' }}><CircularProgress size={16} /></Box>
                : hotHere.length ? (
                  <>
                    {(hotAll ? hotHere : hotHere.slice(0, 6)).map((a) => {
                      const c = byId.get(a.customer)
                      return (
                        <ButtonBase key={a.id} onClick={() => openAsset(a)} sx={[{
                          display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 1, alignItems: 'center', minHeight: 42, px: 1, py: 0.5,
                          borderRadius: '6px', border: '1px solid transparent', textAlign: 'left', '&:hover': { bgcolor: 'archie.surface2' },
                          ...(a.id === selectedId && { bgcolor: 'archie.field', borderColor: 'archie.fieldLine' }),
                        }, focusInset]}>
                          <AssetTypeIcon typeKey={a.type_key} label={a.type_label} />
                          <NameCell title={<><Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</Box><PrioMark priority={a.active_issue_priority} /></>}
                            sub={[a.customer_name || c?.display_name, a.site_display_name || a.site_name].filter(Boolean).join(' › ')} />
                          <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>{c ? provKey(c) : ''}</Box>
                        </ButtonBase>
                      )
                    })}
                    {hotHere.length > 6 ? (
                      <ButtonBase onClick={() => setHotAll((v) => !v)} sx={[{ justifyContent: 'flex-start', px: 1, py: 0.75, borderRadius: '6px', fontSize: 12, fontWeight: 550, color: 'primary.main', '&:hover': { textDecoration: 'underline' } }, focusInset]}>
                        {hotAll ? 'Mostra meno' : `Mostra tutti (${hotHere.length})`}
                      </ButtonBase>
                    ) : null}
                  </>
                ) : <Typography sx={{ m: 0.5, fontSize: 12, color: 'text.secondary' }}>Nessuna issue aperta sui sistemi di questo territorio.</Typography>}
            </Box>
          </Box>

          {/* Destra: province in ordine alfabetico, si aprono sul posto */}
          <Box sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, px: '2px', pt: 0.5, flexWrap: 'wrap' }}>
              <Box>
                <Typography component="h2" sx={{ fontSize: 18, fontWeight: 650, letterSpacing: '-.01em' }}>{region ? `Province · ${REGION_NAME[region]}` : 'Tutte le province'}</Typography>
                <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{list.filter(Boolean).length} province con clienti, in ordine alfabetico · clic per vedere i clienti</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {openProv.size ? <Button size="small" variant="text" onClick={() => { setOpenProv(new Set()); setOpenCust(new Set()); setOpenSite(new Set()) }}>Chiudi tutte</Button> : null}
                {region ? <Button size="small" variant="text" onClick={() => { setRegion(null); setMapProv(null) }}>Mostra tutte</Button> : null}
              </Box>
            </Box>

            <Box ref={listRef} sx={{ ...panelSx, overflow: 'hidden' }}>
              <Box aria-hidden sx={{ ...provCols, minHeight: 34, px: 1.75, bgcolor: 'archie.surface2', borderBottom: '1px solid', borderColor: 'divider', fontSize: 12, fontWeight: 550, color: 'text.secondary', '& > :nth-of-type(n+3)': { textAlign: 'right' } }}>
                <span /><span>Provincia</span><span>Clienti</span><span>Siti</span><span>Asset</span><span>Con issue</span>
              </Box>
              {!customers ? [0, 1, 2, 3].map((i) => <Box key={i} sx={{ px: 1.75, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}><Skeleton width="40%" /><Skeleton width="20%" /></Box>)
                : !list.length ? <Typography sx={{ p: 3, fontSize: 13, color: 'text.secondary' }}>Nessun cliente in questo territorio.</Typography>
                : list.map((p) => {
                  const st = provStats(p)
                  const open = openProv.has(p)
                  return (
                    <Box key={p || '-'} data-prov={p} sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 }, scrollMarginTop: 12 }}>
                      <ButtonBase onClick={() => toggleProvince(p)} aria-expanded={open} sx={[provCols, {
                        width: '100%', minHeight: 52, px: 1.75, py: 0.75, textAlign: 'left', '&:hover': { bgcolor: 'archie.surface2' }, ...(open && { bgcolor: 'archie.surface2' }),
                      }, focusInset]}>
                        <Chevron open={open} />
                        <NameCell titleSx={open ? { color: 'primary.main' } : undefined}
                          title={p ? <>{PROVINCE_NAME[p] ?? p} <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>{p}</Box></> : <i>Senza provincia</i>}
                          sub={p ? REGION_NAME[regionOf(p) ?? ''] ?? '' : 'clienti senza provincia in anagrafica'} />
                        <Box component="span" sx={numSx}>{st.cs.length}</Box>
                        <Box component="span" sx={numSx}>{st.sites}</Box>
                        <Box component="span" sx={numSx}>{st.assets}</Box>
                        <Box component="span" sx={numSx}>{st.issues ? <Box component="span" sx={{ color: 'info.main', fontWeight: 600 }}>{st.issues}</Box> : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}</Box>
                      </ButtonBase>
                      {open ? (
                        <Box sx={{ display: 'grid', gap: 1, pt: 0.5, pr: 1.5, pb: 1.5, pl: { xs: 1, sm: 4.25 }, bgcolor: 'archie.surface2' }}>
                          {st.cs.map((c) => (
                            <CustomerBlock key={c.id} c={c} vendorColor={vendorColor(c.status_label)} open={openCust.has(c.id)} onToggle={() => toggleCustomer(c.id)}
                              content={content[c.id]} openSites={openSite} onToggleSite={(id) => toggle(setOpenSite, id)} selectedId={selectedId} onOpenAsset={openAsset}
                              actions={{ onVpn: setVpn, onOpenCustomer: (x) => goCustomer(x.id), onExport: (x) => void exportCustomer(x) }}
                              onCustomerMenu={openMenu('customer')} onSiteMenu={openMenu('site')} onAssetMenu={openMenu('asset')} />
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  )
                })}
            </Box>
          </Box>
        </Box>
      )}

      {/* L'inventario si apre nella finestra dei record, con cliente e sito nella stessa finestra. */}
      {selectedId != null && detail ? (
        <RecordStackHost root={{ kind: 'inventory', id: detail.id, label: detail.name }} onClose={closeAsset}>
          <InventoryDetailModal
            detail={detail}
            statuses={statuses}
            types={types}
            canChange={canChange}
            canDelete={canDelete}
            canViewSecrets={canViewSecrets}
            canViewMaintenance={hasPerm(PERMS.maintenance.event.view)}
            canUploadReports={hasPerm(PERMS.maintenance.event.change)}
            onClose={closeAsset}
            onSaved={() => { void loadDetail(detail.id); refreshCustomer(detail.customer) }}
            onEditAll={() => goInventory(selectedId)}
            onDelete={() => setDel({ kind: 'asset', row: detail as RepoAsset, x: 0, y: 0 })}
            onRestore={async () => { try { await api.post(`/inventories/${selectedId}/restore/`); toast.success('Asset ripristinato'); await loadDetail(selectedId); refreshCustomer(detail.customer) } catch (e) { toast.error(apiErrorToMessage(e)) } }}
            onCopy={async (v: string) => { await copyToClipboard(v); toast.success('Copiato') }}
            onNewIssue={() => openIssueFor(detail)}
          />
        </RecordStackHost>
      ) : null}

      {vpn ? <VpnModal open onClose={() => setVpn(null)} customerId={vpn.id} customerName={vpn.display_name || vpn.name} /> : null}

      <RowContextMenu open={Boolean(menu)} anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined} onClose={() => setMenu(null)} items={menuItems} />
      <ConfirmDeleteDialog open={Boolean(del)} busy={delBusy} title={deleteCopy.title} description={deleteCopy.description} onClose={() => setDel(null)} onConfirm={confirmDelete} />
    </Box>
  )
}

// ─── Risultati di ricerca ────────────────────────────────────────────────────

function SearchResults({ q, found, customers, selectedId, vendorColor, onOpenAsset, onReveal, onClear, onAssetMenu }: {
  q: string
  found: { q: string; assets: RepoAsset[]; sites: (RepoSite & { customer_name?: string })[] } | null
  customers: RepoCustomer[]
  selectedId: number | null
  vendorColor: (l?: string | null) => string
  onOpenAsset: (a: RepoAsset) => void
  onReveal: (customerId: number, siteId?: number | null) => void
  onClear: () => void
  onAssetMenu: (a: RepoAsset, e: React.MouseEvent) => void
}) {
  const t = q.toLowerCase()
  const cs = customers.filter((c) => [c.name, c.display_name, c.code, c.city].some((v) => v && v.toLowerCase().includes(t)))
  const byId = new Map(customers.map((c) => [c.id, c]))
  const provOf = (cid: number) => { const c = byId.get(cid); const p = c ? provKey(c) : ''; return p ? PROVINCE_NAME[p] ?? p : '' }
  const path = (parts: (string | null | undefined)[]) => (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
      {parts.filter(Boolean).map((x, i) => <React.Fragment key={i}>{i ? <CampoIcon name="chevR" size={11} /> : null}<span>{x}</span></React.Fragment>)}
    </Box>
  )
  const head = (label: string, n: number) => <Typography component="h3" sx={{ p: '14px 14px 6px', fontSize: 12, fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75 }}>{label}<Box component="span" sx={cntSx}>{n}</Box></Typography>
  const rowSx = [{ width: '100%', display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto auto 14px', gap: 1.5, alignItems: 'center', minHeight: 48, px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'left', '&:hover': { bgcolor: 'archie.surface2' } }, focusInset]
  const stale = !found || found.q !== q
  const total = found ? found.assets.length + found.sites.length + cs.length : 0
  return (
    <Box component="section" aria-label="Risultati della ricerca" sx={{ ...panelSx, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', fontSize: 13, color: 'text.secondary' }}>
        {stale ? <><CircularProgress size={14} /> Cerco «{q}»…</> : <><Box component="b" sx={{ color: 'text.primary' }}>{total}</Box> risultati per «{q}»</>}
        <Button size="small" variant="text" onClick={onClear} sx={{ ml: 'auto' }}>Cancella ricerca</Button>
      </Box>
      {found ? (
        <Box sx={{ opacity: stale ? 0.55 : 1, transition: 'opacity .15s' }}>
          {found.assets.length ? (
            <>
              {head('Sistemi', found.assets.length)}
              <AssetHead />
              {found.assets.map((a) => (
                <Box key={a.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', '& > button': { borderBottom: 0 } }}>
                  <Box sx={{ pt: 1, pl: 6.5, pr: 1.5 }}>{path([provOf(a.customer), a.customer_name, a.site_display_name || a.site_name])}</Box>
                  <AssetRow a={a} q={q} selected={a.id === selectedId} onOpen={onOpenAsset} onContextMenu={onAssetMenu} />
                </Box>
              ))}
            </>
          ) : null}
          {found.sites.length ? (
            <>
              {head('Siti', found.sites.length)}
              {found.sites.map((s) => (
                <ButtonBase key={s.id} onClick={() => onReveal(s.customer, s.id)} sx={rowSx}>
                  <Box component="span" sx={{ color: 'primary.main', display: 'grid', placeItems: 'center' }}><CampoIcon name="pin" size={17} /></Box>
                  <NameCell title={<Highlight text={s.display_name || s.name} q={q} />} sub={[s.address_line1, s.city].filter(Boolean).join(', ') || 'Nessun indirizzo'} />
                  {path([provOf(s.customer), s.customer_name])}
                  <span />
                  <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex' }}><CampoIcon name="chevR" size={14} /></Box>
                </ButtonBase>
              ))}
            </>
          ) : null}
          {cs.length ? (
            <>
              {head('Clienti', cs.length)}
              {cs.map((c) => (
                <ButtonBase key={c.id} onClick={() => onReveal(c.id)} sx={rowSx}>
                  <Box component="span" sx={{ color: 'primary.main', display: 'grid', placeItems: 'center' }}><CampoIcon name="building" size={17} /></Box>
                  <NameCell title={<Highlight text={c.display_name || c.name} q={q} />}
                    sub={c.status_label ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625 }}><Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: vendorColor(c.status_label) }} />{c.status_label}</Box> : undefined} />
                  <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>{provOf(c.id) || 'Senza provincia'}</Box>
                  <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{c.sites_with_assets_count ?? 0} siti · {c.assets_count ?? 0} asset</Box>
                  <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex' }}><CampoIcon name="chevR" size={14} /></Box>
                </ButtonBase>
              ))}
            </>
          ) : null}
          {!total && !stale ? <Typography sx={{ px: 1.75, py: 3, fontSize: 13, color: 'text.secondary' }}>Nessun sistema, sito o cliente corrisponde a «{q}». Prova con parte dell'hostname o dell'IP.</Typography> : null}
        </Box>
      ) : null}
    </Box>
  )
}
