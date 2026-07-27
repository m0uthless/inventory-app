import * as React from 'react'
import {
  Box,
  Chip,
  Fab,
  Stack,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useDrfList } from '@shared/hooks/useDrfList'
import { buildDrfListParams } from '@shared/api/drf'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import { useListUrlNumberParam, useListUrlStringParam } from '@shared/hooks/useListUrlParam'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import WifiPasswordIcon from '@mui/icons-material/WifiPassword'
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined'

import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useAuth } from '../auth/AuthProvider'
import AuslBoDeviceDrawer from '../ui/AuslBoDeviceDrawer'
import AuslBoDevicePageDrawer from '../ui/AuslBoDevicePageDrawer'

import {
  emptyDeviceForm,
  type DeviceFormState,
  type DeviceTypeItem,
  type LookupItem,
  type ManufacturerItem,
  type RispacsItem,
  type SiteItem,
} from '@shared/device/deviceTypes'

import {
  type DeviceRow,
  type DeviceDetail,
  deviceGridColumns,
  renderDeviceCard,
} from './device/deviceGrid'
import WifiQuickDialog from './device/WifiQuickDialog'
import RepartoChart from './device/RepartoChart'
import MiniGridFilter from './device/MiniGridFilter'
import KpiCard from './device/KpiCard'

export default function Device() {
  const toast  = useToast()
  const { me } = useAuth()

  // ── Filtri URL ────────────────────────────────────────────────────────────
  const [typeId,         setTypeId]         = useListUrlNumberParam('type')
  const [siteId,         setSiteId]         = useListUrlNumberParam('site')
  const [manufacturerId, setManufacturerId] = useListUrlNumberParam('manufacturer')
  const [repartoF,       setRepartoF]       = useListUrlStringParam('reparto')
  const [wifiF,          setWifiF]          = useListUrlStringParam('wifi')
  const [pacsF,          setPacsF]          = useListUrlStringParam('rispacs')
  const [vlanF,          setVlanF]          = useListUrlStringParam('vlan')
  const [doseF,          setDoseF]          = useListUrlStringParam('dose')

  // ── List ──────────────────────────────────────────────────────────────────

  const grid = useServerGrid({
    defaultOrdering: '-updated_at',
    allowedOrderingFields: ['inventario', 'type_name', 'manufacturer_name', 'model', 'site_display_name', 'reparto', 'room', 'status_name', 'updated_at'],
    defaultPageSize: 25,
  })

  const listParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { type_name: 'type__name', status_name: 'status__name', manufacturer_name: 'manufacturer__name', site_display_name: 'site__name' },
      page0: grid.paginationModel.page,
      pageSize: grid.paginationModel.pageSize,
      extra: {
        ...(typeId         !== '' ? { type: typeId }               : {}),
        ...(siteId         !== '' ? { site: siteId }               : {}),
        ...(manufacturerId !== '' ? { manufacturer: manufacturerId }: {}),
        ...(repartoF               ? { reparto: repartoF }          : {}),
        ...(wifiF   === 'true'     ? { wifi: true }                 : {}),
        ...(pacsF   === 'true'     ? { rispacs: true }              : {}),
        ...(vlanF   === 'true'     ? { vlan: true }                 : {}),
        ...(doseF   === 'true'     ? { dose: true }                 : {}),
      },
    }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize,
     typeId, siteId, manufacturerId, repartoF, wifiF, pacsF, vlanF, doseF],
  )

  const { rows, rowCount, loading, reload } = useDrfList<DeviceRow>(
    '/devices/', listParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // Params per il grafico a torta: stessi filtri tranne reparto, pagina unica grande
  const chartParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { type_name: 'type__name', status_name: 'status__name', manufacturer_name: 'manufacturer__name', site_display_name: 'site__name' },
      page0: 0,
      pageSize: 500,
      extra: {
        ...(typeId         !== '' ? { type: typeId }                : {}),
        ...(siteId         !== '' ? { site: siteId }                : {}),
        ...(manufacturerId !== '' ? { manufacturer: manufacturerId } : {}),
        ...(wifiF   === 'true'    ? { wifi: true }                  : {}),
        ...(pacsF   === 'true'    ? { rispacs: true }               : {}),
        ...(vlanF   === 'true'    ? { vlan: true }                  : {}),
        ...(doseF   === 'true'    ? { dose: true }                  : {}),
      },
    }),
    [grid.search, grid.ordering, typeId, siteId, manufacturerId, wifiF, pacsF, vlanF, doseF],
  )

  const { rows: chartRows } = useDrfList<DeviceRow>(
    '/devices/', chartParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // ── Lookup data ───────────────────────────────────────────────────────────

  const customerId = me?.customer?.id
  const canEdit = me?.auslbo?.can_edit_devices ?? false
  const [sites,         setSites]         = React.useState<SiteItem[]>([])
  const [types,         setTypes]         = React.useState<DeviceTypeItem[]>([])
  const [statuses,      setStatuses]      = React.useState<LookupItem[]>([])
  const [manufacturers, setManufacturers] = React.useState<ManufacturerItem[]>([])
  const [rispacsList,   setRispacsList]   = React.useState<RispacsItem[]>([])

  React.useEffect(() => {
    if (!customerId) return
    void api.get<{ results: SiteItem[] }>('/sites/', { params: { customer: customerId, page_size: 200 } })
      .then((r) => setSites(r.data.results ?? []))
    void api.get<{ results: DeviceTypeItem[] }>('/device-types/', { params: { page_size: 200 } }).then((r) => setTypes(r.data.results ?? []))
    void api.get<{ results: LookupItem[] }>('/device-statuses/',     { params: { page_size: 200 } }).then((r) => setStatuses(r.data.results ?? []))
    void api.get<{ results: ManufacturerItem[] }>('/device-manufacturers/', { params: { page_size: 200 } }).then((r) => setManufacturers(r.data.results ?? []))
    void api.get<{ results: RispacsItem[] }>('/rispacs/',            { params: { page_size: 500 } }).then((r) => setRispacsList(r.data.results ?? []))
  }, [customerId])

  // ── Drawer state ──────────────────────────────────────────────────────────

  // Read-only drawer (usa AuslBoDeviceDrawer standalone)
  const [readDrawerId,   setReadDrawerId]   = React.useState<number | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = React.useState<{ row: DeviceRow; mouseX: number; mouseY: number } | null>(null)

  // WiFi quick dialog
  const [wifiDialogId, setWifiDialogId] = React.useState<number | null>(null)

  // Create/Edit drawer (nativo con form)
  const [drawerOpen,     setDrawerOpen]     = React.useState(false)
  const [drawerTab,      setDrawerTab]      = React.useState(0)
  const [selectedId,     setSelectedId]     = React.useState<number | null>(null)
  const [detail,         setDetail]         = React.useState<DeviceDetail | null>(null)
  const [detailLoading,  setDetailLoading]  = React.useState(false)
  const [editMode,       setEditMode]       = React.useState(false)
  const [isNew,          setIsNew]          = React.useState(false)
  const [form,           setForm]           = React.useState<DeviceFormState>(emptyDeviceForm())
  const [saving,         setSaving]         = React.useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  const detailToForm = (d: DeviceDetail): DeviceFormState => ({
    site:          d.site         ?? '',
    type:          d.type         ?? '',
    status:        d.status       ?? '',
    manufacturer:  d.manufacturer ?? '',
    model:         d.model        ?? '',
    aetitle:       d.aetitle       ?? '',
    serial_number: d.serial_number ?? '',
    inventario:    d.inventario   ?? '',
    reparto:       d.reparto      ?? '',
    room:          d.room         ?? '',
    ip:            d.ip           ?? '',
    note:          d.note          ?? '',
    location:      d.location      ?? '',
    vlan:          d.vlan,
    wifi:          d.wifi,
    rispacs:       d.rispacs,
    dose:          d.dose,
    rispacs_ids:   d.rispacs_links.map((l) => l.rispacs),
    wifi_ip:       d.wifi_detail?.ip ?? '',
    wifi_mac:      d.wifi_detail?.mac_address ?? '',
    wifi_pass:     d.wifi_detail?.pass_certificato ?? '',
    wifi_scad:     d.wifi_detail?.scad_certificato ?? '',
    wifi_cert_file: null,
  })

  const fetchDetail = React.useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await api.get<DeviceDetail>(`/devices/${id}/`)
      setDetail(res.data)
      return res.data
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      return null
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  const openDrawer = React.useCallback((id: number) => {
    setReadDrawerId(id)
    grid.setOpenId(id)
  }, [grid])

  const openCreate = React.useCallback(() => {
    setSelectedId(null)
    setDetail(null)
    setForm(emptyDeviceForm())
    setEditMode(true)
    setIsNew(true)
    setDrawerTab(0)
    setDrawerOpen(true)
    grid.setOpenId(null)
  }, [grid])

  const closeDrawer = React.useCallback(() => {
    setReadDrawerId(null)
    setDrawerOpen(false)
    setSelectedId(null)
    setDetail(null)
    setEditMode(false)
    setIsNew(false)
    grid.setOpenId(null)
  }, [grid])

  // ── Context menu ──────────────────────────────────────────────────────────

  const handleRowContextMenu = React.useCallback(
    (row: DeviceRow, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault()
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    },
    [],
  )

  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    return [
      {
        key: 'open',
        label: 'Apri dettaglio',
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: () => { setReadDrawerId(row.id); grid.setOpenId(row.id) },
      },
      {
        key: 'wifi',
        label: 'Imposta WiFi',
        icon: <WifiPasswordIcon fontSize="small" />,
        onClick: () => setWifiDialogId(row.id),
        hidden: !canEdit,
      },
      {
        key: 'dismiss',
        label: 'Richiedi dismissione',
        icon: <DeleteForeverOutlinedIcon fontSize="small" />,
        onClick: () => toast.info('Funzione non ancora disponibile.'),
        disabled: true,
      },
    ]
  }, [contextMenu, canEdit, grid, toast])

  const startEdit = React.useCallback(() => {
    if (!detail) return
    setForm(detailToForm(detail))
    setEditMode(true)
  }, [detail])

  const cancelEdit = React.useCallback(() => {
    if (isNew) { closeDrawer(); return }
    setEditMode(false)
  }, [isNew, closeDrawer])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = React.useCallback(async () => {
    if (!customerId) return
    setSaving(true)
    try {
      const payload = {
        customer:      customerId,
        site:          form.site      || undefined,
        type:          form.type      || undefined,
        status:        form.status    || undefined,
        manufacturer:  form.manufacturer || null,
        model:         form.model        || null,
        serial_number: form.serial_number || null,
        inventario:    form.inventario    || null,
        reparto:       form.reparto       || null,
        room:          form.room          || null,
        ip:            form.ip            || null,
        note:          form.note          || null,
        location:      form.location      || null,
        vlan:          form.vlan,
        wifi:          form.wifi,
        rispacs:       form.rispacs,
        dose:          form.dose,
      }

      let savedId: number
      if (isNew) {
        const res = await api.post<DeviceDetail>('/devices/', payload)
        savedId = res.data.id
      } else {
        await api.patch(`/devices/${selectedId!}/`, payload)
        savedId = selectedId!
      }

      // Sincronizza i link RIS/PACS se il flag è attivo
      if (form.rispacs) {
        // Recupera i link attuali
        const linksRes = await api.get<{ results: { id: number; rispacs: number }[] }>(
          '/device-rispacs/', { params: { device: savedId, page_size: 200 } }
        )
        const existing = linksRes.data.results ?? []
        const existingIds  = existing.map((l) => l.rispacs)
        const toAdd    = form.rispacs_ids.filter((id) => !existingIds.includes(id))
        const toRemove = existing.filter((l) => !form.rispacs_ids.includes(l.rispacs))

        await Promise.all([
          ...toAdd.map((rid) => api.post('/device-rispacs/', { device: savedId, rispacs: rid })),
          ...toRemove.map((l) => api.delete(`/device-rispacs/${l.id}/`)),
        ])
      }

      // Sincronizza WiFi se il flag è attivo
      if (form.wifi) {
        const freshDetail = await api.get<DeviceDetail>(`/devices/${savedId}/`)
        const wifiDetail = freshDetail.data.wifi_detail

        // Usa FormData per supportare l'upload del certificato .p12
        const fd = new FormData()
        fd.append('device', String(savedId))
        if (form.wifi_ip)   fd.append('ip', form.wifi_ip)
        if (form.wifi_mac)  fd.append('mac_address', form.wifi_mac)
        if (form.wifi_scad) fd.append('scad_certificato', form.wifi_scad)
        if (form.wifi_pass) fd.append('pass_certificato', form.wifi_pass)
        if (form.wifi_cert_file) fd.append('certificato', form.wifi_cert_file)

        if (wifiDetail) {
          await api.patch(`/device-wifi/${wifiDetail.id}/`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } else {
          await api.post('/device-wifi/', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }
      }

      toast.success(isNew ? 'Device creato con successo.' : 'Device aggiornato.')
      reload()

      // Ricarica il dettaglio e torna in read mode
      const updated = await fetchDetail(savedId)
      if (updated) {
        setSelectedId(savedId)
        setDetail(updated)
      }
      setEditMode(false)
      setIsNew(false)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }, [customerId, form, isNew, selectedId, reload, fetchDetail, toast])

  // ── URL open ──────────────────────────────────────────────────────────────

  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    void openDrawer(id)
  }, [grid.openId, openDrawer])

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const columns = React.useMemo(() => deviceGridColumns, [])

  // ── KPI ───────────────────────────────────────────────────────────────────
  const totalDevices = rowCount
  const pacsCount    = rows.filter((r) => r.rispacs).length
  const pacsPercent  = totalDevices > 0 ? Math.round((pacsCount / totalDevices) * 100) : 0

  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) return { title: 'Nessun risultato', subtitle: 'Nessun risultato secondo i filtri applicati.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.search])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack spacing={1.5} sx={{ height: '100%' }}>

      {/* ── Riga superiore: 3 mini-grid + colonna KPI (2 impilate) + placeholder ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 1.5, alignItems: 'stretch' }}>

        <MiniGridFilter
          title="Sedi"
          items={sites.map((s) => ({ id: s.id, name: s.display_name || s.name }))}
          activeId={siteId}
          onChange={setSiteId}
        />

        <MiniGridFilter
          title="Tipi"
          items={types.map((t) => ({ id: t.id, name: t.name }))}
          activeId={typeId}
          onChange={setTypeId}
        />

        <MiniGridFilter
          title="Produttori"
          items={manufacturers.map((m) => ({ id: m.id, name: m.name }))}
          activeId={manufacturerId}
          onChange={setManufacturerId}
        />

        {/* Colonna KPI: 2 card impilate, ognuna alta metà della mini-grid */}
        <Stack spacing={1} sx={{ height: '100%' }}>
          <KpiCard
            label="Totale Device"
            value={loading ? '…' : totalDevices}
            sub="nel tuo ente"
            accent="#1A6BB5"
          />
          <KpiCard
            label="Device con PACS"
            value={loading ? '…' : `${pacsPercent}%`}
            sub={loading ? '' : `${pacsCount} su ${totalDevices}`}
            accent="#6366f1"
          />
        </Stack>

        {/* Grafico torta Reparto */}
        <RepartoChart rows={chartRows} repartoF={repartoF} onSelect={setRepartoF} />
      </Box>

      <EntityListCard
        mobileCard={renderDeviceCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          rightActions: (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {([
                { key: 'wifi', label: 'WiFi',   val: wifiF, set: setWifiF },
                { key: 'pacs', label: 'PACS',   val: pacsF, set: setPacsF },
                { key: 'vlan', label: 'VLAN',   val: vlanF, set: setVlanF },
                { key: 'dose', label: 'DoseSR', val: doseF, set: setDoseF },
              ] as { key: string; label: string; val: string; set: (v: string) => void }[]).map(({ key, label, val, set }) => (
                <Chip
                  key={key}
                  size="small"
                  label={label}
                  onClick={() => set(val === 'true' ? '' : 'true')}
                  sx={{
                    height: 24, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                    bgcolor: val === 'true' ? 'rgba(26,107,181,0.18)' : 'transparent',
                    color: val === 'true' ? 'primary.main' : 'text.disabled',
                    border: '1px solid',
                    borderColor: val === 'true' ? 'rgba(26,107,181,0.40)' : 'divider',
                    '& .MuiChip-label': { px: 0.75 },
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </Stack>
          ),
        }}
        grid={{
          pageKey: 'auslbo-device',
          emptyState,
          rows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          onRowContextMenu: handleRowContextMenu,
          sx: {
            '--DataGrid-rowHeight': '36px',
            '--DataGrid-headerHeight': '35px',
            '& .MuiDataGrid-cell': { py: 0.25 },
            '& .MuiDataGrid-columnHeader': { py: 0.75 },
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(26,107,181,0.02)' },
            '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(26,107,181,0.06)' },
            '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(26,107,181,0.10) !important' },
            '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(26,107,181,0.14) !important' },
          },
        }}
      />

      {/* FAB — solo per utenti con permesso edit */}
      {canEdit && <Fab
        color="primary"
        aria-label="Nuovo device"
        onClick={openCreate}
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 24 },
          bottom: { xs: 16, md: 20 },
          zIndex: (t) => t.zIndex.appBar - 1,
          width: 52,
          height: 52,
          boxShadow: '0 8px 24px rgba(26,107,181,0.35)',
          display: { xs: 'none', md: 'inline-flex' },
        }}
      >
        <AddIcon sx={{ fontSize: 26 }} />
      </Fab>}

      {/* Read-only drawer (standalone) */}
      <AuslBoDeviceDrawer
        id={readDrawerId}
        onClose={() => { setReadDrawerId(null); grid.setOpenId(null) }}
      />

      {/* Context menu tasto destro */}
      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {/* WiFi quick dialog */}
      <WifiQuickDialog
        deviceId={wifiDialogId}
        onClose={() => setWifiDialogId(null)}
        onSaved={() => { setWifiDialogId(null); reload() }}
      />

      {/* Detail / Edit Drawer */}
      <AuslBoDevicePageDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        detail={detail}
        selectedId={selectedId}
        detailLoading={detailLoading}
        editMode={editMode}
        canEdit={canEdit}
        drawerTab={drawerTab}
        onTabChange={setDrawerTab}
        onEdit={startEdit}
        form={form}
        setForm={setForm}
        sites={sites}
        types={types}
        statuses={statuses}
        manufacturers={manufacturers}
        rispacsList={rispacsList}
        saving={saving}
        onSave={handleSave}
        onCancel={cancelEdit}
      />
    </Stack>
  )
}
