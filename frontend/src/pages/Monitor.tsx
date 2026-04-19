import * as React from 'react'
import {
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'

import { useAuth } from '../auth/AuthProvider'
import { useLocation, useNavigate } from 'react-router-dom'
import { isRecord } from '@shared/utils/guards'
import type { GridColDef } from '@mui/x-data-grid'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { api } from '@shared/api/client'
import { buildDrfListParams, includeDeletedParams } from '@shared/api/drf'
import { itemPath, itemActionPath, type CollectionPath } from '@shared/api/apiPaths'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { PERMS } from '../auth/perms'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import MonitorDrawer from '../features/monitor/MonitorDrawer'
import MonitorFormDrawer, { type MonitorForm } from '../features/monitor/MonitorFormDrawer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type MonitorRow = {
  id: number
  inventory: number | null
  inventory_name: string | null
  site_name: string | null
  produttore: string
  modello: string | null
  seriale: string | null
  stato: string
  stato_label: string
  tipo: string
  tipo_label: string
  radinet: boolean
  updated_at: string | null
  deleted_at: string | null
}

const MONITORS_PATH = '/monitors/' as const satisfies CollectionPath

// ─── Chip stato ───────────────────────────────────────────────────────────────

const STATO_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  in_uso:        { bg: 'rgba(16,185,129,0.10)',  fg: '#065f46', border: 'rgba(16,185,129,0.28)' },
  da_installare: { bg: 'rgba(245,158,11,0.10)',  fg: '#92400e', border: 'rgba(245,158,11,0.28)' },
  guasto:        { bg: 'rgba(239,68,68,0.10)',   fg: '#991b1b', border: 'rgba(239,68,68,0.28)'  },
  rma:           { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' },
}

function StatoChip({ stato, label }: { stato: string; label: string }) {
  const c = STATO_COLOR[stato] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <Chip
        size="small"
        label={label}
        sx={{
          height: 22, fontSize: '0.72rem', fontWeight: 600,
          bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Box>
  )
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

const renderMonitorCard: MobileCardRenderFn<MonitorRow> = ({ row, onOpen }) => {
  const c = STATO_COLOR[row.stato] ?? { bg: 'rgba(100,116,139,0.08)', fg: '#475569', border: 'rgba(100,116,139,0.20)' }
  return (
    <Box
      onClick={() => onOpen(row.id)}
      sx={{
        bgcolor: 'background.paper',
        border: '0.5px solid', borderColor: 'divider', borderRadius: 1,
        p: 1.25, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.75,
        '&:active': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.produttore}{row.modello ? ` ${row.modello}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">{row.tipo_label}</Typography>
        </Box>
        <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20, bgcolor: c.bg, color: c.fg, border: `0.5px solid ${c.border}`, whiteSpace: 'nowrap' }}>
          {row.stato_label}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {[
          { label: 'Workstation', value: row.inventory_name },
          { label: 'Sede',        value: row.site_name },
          { label: 'Seriale',     value: row.seriale, mono: true },
          { label: 'Radinet',     value: row.radinet ? 'Sì' : null },
        ].map(({ label, value, mono }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled', fontStyle: value ? 'normal' : 'italic', fontFamily: mono && value ? 'monospace' : 'inherit', lineHeight: 1.3 }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Colonne DataGrid ─────────────────────────────────────────────────────────

const COLUMNS: GridColDef<MonitorRow>[] = [
  { field: 'produttore',     headerName: 'Produttore',  width: 140 },
  { field: 'modello',        headerName: 'Modello',     flex: 1, minWidth: 130 },
  { field: 'seriale',        headerName: 'Seriale',     width: 150 },
  { field: 'inventory_name', headerName: 'Workstation', flex: 1.2, minWidth: 160 },
  { field: 'site_name',      headerName: 'Sede',        width: 150 },
  {
    field: 'tipo_label',
    headerName: 'Tipo',
    width: 140,
    renderCell: ({ value }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <Chip size="small" label={value as string} variant="outlined"
          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, '& .MuiChip-label': { px: 0.75 } }} />
      </Box>
    ),
  },
  {
    field: 'stato_label',
    headerName: 'Stato',
    width: 150,
    renderCell: ({ row }) => <StatoChip stato={row.stato} label={row.stato_label} />,
  },
  {
    field: 'radinet',
    headerName: 'Radinet',
    width: 90,
    renderCell: (p) => p.value
      ? (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip label="Sì" size="small" color="info" variant="outlined"
            sx={{ height: 22, fontSize: '0.72rem', '& .MuiChip-label': { px: 0.75 } }} />
        </Box>
      )
      : null,
  },
]

const ALLOWED_ORDERING = ['produttore', 'modello', 'seriale', 'stato', 'tipo', 'created_at', 'updated_at', 'deleted_at'] as const

// ─── Pagina Monitor ───────────────────────────────────────────────────────────

export default function Monitor() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const canChange = hasPerm(PERMS.inventory.monitor.change)
  const canDelete  = hasPerm(PERMS.inventory.monitor.delete)

  const grid = useServerGrid({
    defaultOrdering: 'produttore',
    allowedOrderingFields: ALLOWED_ORDERING,
  })

  // ── Lista ─────────────────────────────────────────────────────────────────
  const listParams = React.useMemo(() => buildDrfListParams({
    search:         grid.search,
    ordering:       grid.ordering,
    page0:          grid.paginationModel.page,
    pageSize:       grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted,
    onlyDeleted:    grid.onlyDeleted,
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted])

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<MonitorRow>(
    MONITORS_PATH,
    listParams,
    (e) => toast.error(apiErrorToMessage(e)),
  )

  // ── Detail drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen]       = React.useState(false)
  const [drawerTab, setDrawerTab]         = React.useState(0)
  const [selectedId, setSelectedId]       = React.useState<number | null>(null)
  const [detail, setDetail]               = React.useState<MonitorRow | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted
      const incParams = includeDeletedParams(inc)
      const res = await api.get<MonitorRow>(
        itemPath(MONITORS_PATH, id),
        incParams ? { params: incParams } : undefined,
      )
      setDetail(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }, [toast, grid.includeDeleted])

  // Apertura drawer da URL (?open=ID)
  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) { lastOpenRef.current = null; return }
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    setSelectedId(id); setDrawerOpen(true); setDrawerTab(0)
    void loadDetail(id)
  }, [grid.openId, loadDetail])

  const openDrawer = React.useCallback((id: number) => {
    lastOpenRef.current = id
    setSelectedId(id); setDrawerOpen(true); setDrawerTab(0)
    void loadDetail(id)
    grid.setOpenId(id)
  }, [grid, loadDetail])

  const closeDrawer = () => {
    lastOpenRef.current = null
    setDrawerOpen(false)
    grid.setOpenId(null)
  }

  // ── Form drawer create/edit ───────────────────────────────────────────────
  const [formOpen, setFormOpen]     = React.useState(false)
  const [formTarget, setFormTarget] = React.useState<MonitorRow | null>(null)
  const [formSaving, setFormSaving] = React.useState(false)

  const openEdit     = () => { if (detail) { setFormTarget(detail); setFormOpen(true) } }
  const openCreate   = React.useCallback(() => { setFormTarget(null); setFormOpen(true) }, [])

  // Apri form create se navigato con state { openCreate: true } (da SpeedDial / mobile nav)
  const openCreateOnceRef = React.useRef(false)
  React.useEffect(() => {
    const st = loc.state as unknown
    if (!isRecord(st) || st['openCreate'] !== true) { openCreateOnceRef.current = false; return }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    navigate(loc.pathname, { replace: true, state: {} })
    openCreate()
  }, [loc, navigate, openCreate])

  const handleSave = async (form: MonitorForm) => {
    setFormSaving(true)
    try {
      if (formTarget) {
        await api.patch(itemPath(MONITORS_PATH, formTarget.id), form)
        toast.success('Monitor aggiornato ✅')
        if (selectedId === formTarget.id) await loadDetail(formTarget.id)
        reloadList()
      } else {
        const res = await api.post<MonitorRow>(MONITORS_PATH, form)
        toast.success('Monitor creato ✅')
        reloadList()
        openDrawer(res.data.id)
      }
      setFormOpen(false)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setFormSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteDlgOpen, setDeleteDlgOpen] = React.useState(false)
  const [deleteBusy, setDeleteBusy]       = React.useState(false)

  const openDelete = (id: number) => {
    if (selectedId !== id) {
      void loadDetail(id)
      setSelectedId(id); setDrawerOpen(true)
    }
    setDeleteDlgOpen(true)
  }

  const doDelete = async () => {
    if (!detail) return
    setDeleteBusy(true)
    try {
      await api.delete(itemPath(MONITORS_PATH, detail.id))
      toast.success('Monitor eliminato ✅')
      grid.setViewMode('all', { keepOpen: true })
      reloadList()
      await loadDetail(detail.id, true)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
      setDeleteDlgOpen(false)
    }
  }

  // ── Restore ───────────────────────────────────────────────────────────────
  const [restoreBusy, setRestoreBusy] = React.useState(false)

  const doRestore = async () => {
    if (!detail) return
    setRestoreBusy(true)
    try {
      await api.post(itemActionPath(MONITORS_PATH, detail.id, 'restore'))
      toast.success('Monitor ripristinato ✅')
      reloadList()
      await loadDetail(detail.id)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoreBusy(false)
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = React.useState<{
    row: MonitorRow; mouseX: number; mouseY: number
  } | null>(null)

  const handleRowContextMenu = React.useCallback(
    (row: MonitorRow, event: React.MouseEvent<HTMLElement>) => {
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    }, [],
  )

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    if (row.deleted_at) {
      return [
        {
          key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />,
          onClick: () => { openDrawer(row.id); setContextMenu(null) },
        },
        {
          key: 'restore', label: 'Ripristina', icon: <RestoreFromTrashIcon fontSize="small" />,
          disabled: restoreBusy,
          onClick: async () => {
            setContextMenu(null)
            setRestoreBusy(true)
            try {
              await api.post(itemActionPath(MONITORS_PATH, row.id, 'restore'))
              toast.success('Monitor ripristinato ✅')
              reloadList()
            } catch (e) { toast.error(apiErrorToMessage(e)) }
            finally { setRestoreBusy(false) }
          },
        },
      ]
    }
    return [
      { key: 'open',   label: 'Apri',     icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => { openDrawer(row.id); setContextMenu(null) } },
      { key: 'edit',   label: 'Modifica', icon: <EditIcon fontSize="small" />,               hidden: !canChange, onClick: () => { setFormTarget(row); setFormOpen(true); setContextMenu(null) } },
      { key: 'delete', label: 'Elimina',  icon: <DeleteOutlineIcon fontSize="small" />,      hidden: !canDelete, tone: 'danger' as const, onClick: () => { openDelete(row.id); setContextMenu(null) } },
    ]
  }, [contextMenu, canChange, canDelete, restoreBusy, openDrawer, reloadList, toast])

  // ── Empty state ───────────────────────────────────────────────────────────
  const emptyState = React.useMemo(() => {
    if (grid.view === 'deleted' && !grid.search.trim())
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono monitor eliminati.' }
    if (!grid.search.trim())
      return { title: 'Nessun monitor', subtitle: 'Crea un nuovo monitor.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.view, grid.search])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={2} sx={{ height: '100%' }}>

      <EntityListCard
        mobileCard={renderMonitorCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
        }}
        grid={{
          pageKey: 'monitors',
          username: me?.username,
          emptyState,
          rows,
          columns: COLUMNS,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          onRowContextMenu: handleRowContextMenu,
          sx: {
            '--DataGrid-rowHeight': '24px',
            '--DataGrid-headerHeight': '35px',
            '& .MuiDataGrid-cell': { py: 0.25 },
            '& .MuiDataGrid-columnHeader': { py: 0.75 },
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
            '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
          },
        }}
      />

      {/* ── Drawer dettaglio ── */}
      <MonitorDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        detail={detail}
        detailLoading={detailLoading}
        selectedId={selectedId}
        drawerTab={drawerTab}
        onTabChange={setDrawerTab}
        canChange={canChange}
        canDelete={canDelete}
        deleteBusy={deleteBusy}
        restoreBusy={restoreBusy}
        onEdit={openEdit}
        onDelete={() => setDeleteDlgOpen(true)}
        onRestore={doRestore}
        onNavigateToInventory={(inventoryId) =>
          navigate(`/inventory?open=${inventoryId}&return=${encodeURIComponent(loc.pathname + loc.search)}`)
        }
      />

      {/* ── Form drawer create/edit ── */}
      <MonitorFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={formTarget}
        saving={formSaving}
      />

      {/* ── Conferma eliminazione ── */}
      <ConfirmDeleteDialog
        open={deleteDlgOpen}
        busy={deleteBusy}
        title="Confermi eliminazione?"
        description="Il monitor verrà spostato nel cestino e potrà essere ripristinato."
        onClose={() => setDeleteDlgOpen(false)}
        onConfirm={doDelete}
      />

      {/* ── Context menu ── */}
      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={() => setContextMenu(null)}
        items={contextMenuItems}
      />

    </Stack>
  )
}
