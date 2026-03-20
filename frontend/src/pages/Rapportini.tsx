/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react'
import {
  Box,
  Checkbox,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid'

import AddIcon from '@mui/icons-material/Add'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import BlockIcon from '@mui/icons-material/Block'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

import { api } from '../api/client'
import { apiErrorToMessage } from '../api/error'
import { buildDrfListParams } from '../api/drf'
import { useAuth } from '../auth/AuthProvider'
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog'
import { Can } from '../auth/Can'
import { PERMS } from '../auth/perms'
import type { EventRow } from './maintenanceTypes'
import { useDrfList } from '../hooks/useDrfList'
import { useServerGrid } from '../hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '../hooks/useUrlParam'
import EntityListCard from '../ui/EntityListCard'
import FilterChip from '../ui/FilterChip'
import RowContextMenu, { type RowContextMenuItem } from '../ui/RowContextMenu'
import { compactCreateButtonSx, compactExportButtonSx, compactResetButtonSx } from '../ui/toolbarStyles'
import { useToast } from '../ui/toast'
import { useExportCsv } from '../ui/useExportCsv'

import { RapportinoDialog } from './Maintenance'

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerItem = { id: number; code: string; name: string; display_name?: string }
type TechItem = { id: number; full_name: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESULT_COLOR: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  ok: 'success', ko: 'error', partial: 'warning', not_planned: 'default',
}
const RESULT_LABEL: Record<string, string> = {
  ok: 'OK', ko: 'KO', partial: 'Parziale', not_planned: 'Non prevista',
}

const GRID_SX = {
  '--DataGrid-rowHeight': '36px',
  '--DataGrid-headerHeight': '44px',
  '& .MuiDataGrid-cell': { py: 0.25 },
  '& .MuiDataGrid-columnHeader': { py: 0.75 },
  '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
  '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
  '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(69,127,121,0.10) !important' },
  '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(69,127,121,0.14) !important' },
  '& .row-actions': { opacity: 0, pointerEvents: 'none', transition: 'opacity 140ms ease' },
  '& .MuiDataGrid-row:hover .row-actions': { opacity: 1, pointerEvents: 'auto' },
  '@media (hover: none), (pointer: coarse)': { '& .row-actions': { opacity: 1, pointerEvents: 'auto' } },
} as const

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Rapportini() {
  const toast = useToast()
  const { me, hasPerm } = useAuth()
  const { exporting, exportCsv } = useExportCsv()

  // useServerGrid senza view mode (niente Attivi/Tutti/Cestino)
  const grid = useServerGrid({
    defaultOrdering: '-performed_at',
    allowedOrderingFields: ['performed_at', 'updated_at'],
  })

  // Lookup data
  const { rows: customers } = useDrfList<CustomerItem>('/customers/', { ordering: 'name', page_size: 500 })
  const { rows: allTechs } = useDrfList<TechItem>('/techs/', { ordering: 'last_name', page_size: 500 })
  const [filterPlans, setFilterPlans] = React.useState<{ id: number; title: string }[]>([])

  // URL filters
  const [customerF, setCustomerF] = useUrlNumberParam('ev_customer')
  const [resultF, setResultF] = useUrlStringParam('ev_result')
  const [planF, setPlanF] = useUrlNumberParam('ev_plan')
  const [techF, setTechF] = useUrlNumberParam('ev_tech')
  const [yearF, setYearF] = useUrlStringParam('ev_year')

  // Load plans when customer changes
  React.useEffect(() => {
    if (!customerF) { setFilterPlans([]); setPlanF(''); return }
    api.get<{ results: { id: number; title: string }[] }>('/maintenance-plans/', {
      params: { customer: customerF, ordering: 'title', page_size: 500, is_active: 'true' },
    }).then(r => setFilterPlans(r.data.results ?? [])).catch(() => {})
  }, [customerF]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build server params — no includeDeleted/onlyDeleted (no cestino)
  const listParams = React.useMemo(() => {
    const extra: Record<string, any> = {}
    if (customerF) extra['plan__customer'] = customerF
    if (resultF)   extra['result'] = resultF
    if (planF)     extra['plan'] = planF
    if (techF)     extra['tech'] = techF
    if (yearF.trim().length === 4 && /^\d{4}$/.test(yearF.trim())) {
      extra['performed_at__year'] = yearF.trim()
    }
    return buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      page0: grid.paginationModel.page,
      pageSize: grid.paginationModel.pageSize,
      includeDeleted: false,
      onlyDeleted: false,
      extra,
    })
  }, [grid.search, grid.ordering, grid.paginationModel, customerF, resultF, planF, techF, yearF])

  const { rows, rowCount, loading, reload } = useDrfList<EventRow>(
    '/maintenance-events/', listParams, e => toast.error(apiErrorToMessage(e))
  )

  // ── Multi-selection (manual Set — independent of MUI selectionModel) ───────
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const selectedCount = selectedIds.size
  const allPageSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id))
  const toggleRow = React.useCallback((id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }), [])
  const togglePage = React.useCallback(() =>
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (allPageSelected) rows.forEach(r => s.delete(r.id))
      else rows.forEach(r => s.add(r.id))
      return s
    }), [rows, allPageSelected])
  const clearSelection = React.useCallback(() => setSelectedIds(new Set()), [])
  // Ref always up-to-date for use inside async callbacks
  const selectedIdsRef = React.useRef<Set<number>>(new Set())
  React.useEffect(() => { selectedIdsRef.current = selectedIds })

  // Clear selection on filter/page change
  React.useEffect(() => { clearSelection() }, [listParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context menu ────────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = React.useState<{
    row: EventRow; mouseX: number; mouseY: number
    snapshot: EventRow[]   // rows selected at right-click time
  } | null>(null)

  const handleRowContextMenu = React.useCallback(
    (row: EventRow, event: React.MouseEvent<HTMLElement>) => {
      // Snapshot selection at right-click time — avoids stale closure issues
      const curIds = selectedIdsRef.current
      const inSel = curIds.has(row.id) && curIds.size > 1
      const snapshot = inSel
        ? rows.filter(r => curIds.has(r.id))
        : [row]
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6, snapshot })
    }, [rows] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Upload PDF — opens file picker, then PATCHes the event
  const pdfInputRef = React.useRef<HTMLInputElement>(null)
  const pendingPdfEventRef = React.useRef<EventRow | null>(null)
  const pendingMultiRef = React.useRef<EventRow[]>([])

  const handlePdfFileChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const ev = pendingPdfEventRef.current
    if (!file || !ev) return
    e.target.value = ''
    const fd = new FormData()
    fd.append('pdf_file', file)
    try {
      await api.post(`/maintenance-events/${ev.id}/upload-pdf/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('PDF caricato ✅')
      reload()
    } catch (err) { toast.error(apiErrorToMessage(err)) }
    pendingPdfEventRef.current = null
  }, [reload, toast])

  const deletePdf = React.useCallback(async (ev: EventRow) => {
    try {
      await api.delete(`/maintenance-events/${ev.id}/delete-pdf/`)
      toast.success('PDF eliminato ✅')
      reload()
    } catch (err) { toast.error(apiErrorToMessage(err)) }
  }, [reload, toast])

  const setNotPlanned = React.useCallback(async (ev: EventRow) => {
    try {
      await api.patch(`/maintenance-events/${ev.id}/set-not-planned/`)
      toast.success('Segnato come "Non prevista" ✅')
      reload()
    } catch (err) { toast.error(apiErrorToMessage(err)) }
  }, [reload, toast])

  const [resetDlg, setResetDlg] = React.useState<EventRow | null>(null)
  const [resetMulti, setResetMulti] = React.useState<EventRow[] | null>(null)
  const [resetBusy, setResetBusy] = React.useState(false)

  const doReset = React.useCallback(async () => {
    const targets = resetMulti ?? (resetDlg ? [resetDlg] : [])
    if (targets.length === 0) return
    setResetBusy(true)
    try {
      const results = await Promise.allSettled(targets.map(ev => api.post(`/maintenance-events/${ev.id}/reset/`)))
      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.filter(r => r.status === 'rejected').length
      if (fail === 0) toast.success(ok === 1 ? 'Manutenzione resettata ✅' : `${ok} manutenzioni resettate ✅`)
      else toast.warning(`${ok} riuscite, ${fail} fallite`)
      setResetDlg(null)
      setResetMulti(null)
      if (targets.length > 1) clearSelection()
      reload()
    } catch (err) { toast.error(apiErrorToMessage(err)) }
    finally { setResetBusy(false) }
  }, [resetDlg, resetMulti, clearSelection, reload, toast])

  const canDeletePdf = React.useCallback((ev: EventRow) => {
    if (!ev.pdf_url) return false
    return me?.is_superuser || ev.created_by_username === me?.username
  }, [me])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    const targets = contextMenu.snapshot   // snapshot taken at right-click time
    const isMulti = targets.length > 1
    const n = targets.length
    const items: RowContextMenuItem[] = [
      {
        key: 'upload-pdf',
        label: isMulti ? `Carica PDF (${n})` : 'Carica rapportino PDF',
        icon: <AttachFileIcon fontSize="small" />,
        onClick: () => {
          if (isMulti) {
            // store targets in ref, trigger bulk input
            pendingMultiRef.current = targets
            bulkPdfInputRef.current?.click()
          } else {
            pendingPdfEventRef.current = row
            pdfInputRef.current?.click()
          }
        },
      },
    ]
    const deletablePdf = isMulti
      ? targets.filter(r => r.pdf_url && canDeletePdf(r))
      : (row.pdf_url ? [row] : [])
    if (deletablePdf.length > 0 || (!isMulti && row.pdf_url)) {
      items.push({
        key: 'delete-pdf',
        label: isMulti ? `Cancella PDF caricati (${deletablePdf.length})` : 'Cancella PDF caricato',
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: async () => {
          if (isMulti) {
            await Promise.allSettled(deletablePdf.map(r => deletePdf(r)))
          } else {
            deletePdf(row)
          }
        },
        disabled: isMulti ? deletablePdf.length === 0 : !canDeletePdf(row),
        tone: 'danger',
      })
    }
    if (targets.some(r => r.result !== 'not_planned')) {
      items.push({
        key: 'not-planned',
        label: isMulti ? `Non prevista (${n})` : 'Non prevista',
        icon: <BlockIcon fontSize="small" />,
        onClick: async () => {
          await Promise.allSettled(targets.filter(r => r.result !== 'not_planned').map(r => setNotPlanned(r)))
          if (isMulti) clearSelection()
        },
        tone: 'danger',
      })
    }
    if (hasPerm(PERMS.maintenance.event.delete)) {
      items.push({
        key: 'reset',
        label: isMulti ? `Reset Manutenzione (${n})` : 'Reset Manutenzione',
        icon: <RotateLeftIcon fontSize="small" />,
        onClick: () => {
          if (isMulti) { setResetDlg(null); setResetMulti(targets) }
          else { setResetMulti(null); setResetDlg(row) }
        },
        tone: 'danger',
      })
    }
    return items
  }, [contextMenu, canDeletePdf, deletePdf, setNotPlanned, hasPerm, clearSelection])

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: GridColDef<EventRow>[] = React.useMemo(() => [
    {
      field: '__select',
      headerName: '',
      width: 48,
      sortable: false,
      renderHeader: () => (
        <Checkbox
          size="small"
          checked={allPageSelected}
          indeterminate={selectedCount > 0 && !allPageSelected}
          onChange={togglePage}
          sx={{ p: 0.5 }}
        />
      ),
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Checkbox
            size="small"
            checked={selectedIds.has(p.row.id)}
            onChange={() => toggleRow(p.row.id)}
            onClick={e => e.stopPropagation()}
            sx={{ p: 0.5 }}
          />
        </Box>
      ),
    },
    {
      field: 'performed_at',
      headerName: 'Data',
      width: 120,
      renderCell: (p: GridRenderCellParams<EventRow>) => {
        const raw = p.value as string | null
        if (!raw) return <Box />
        const [y, m, d] = raw.split('-')
        const label = `${d}/${m}/${y}`
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              size="small"
              label={label}
              variant="outlined"
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, borderRadius: 1.5 }}
            />
          </Box>
        )
      },
    },
    {
      field: 'result',
      headerName: 'Risultato',
      width: 110,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            size="small"
            label={RESULT_LABEL[p.value as string] ?? p.value}
            color={RESULT_COLOR[p.value as string] ?? 'default'}
            sx={{ height: 22, fontSize: '0.72rem' }}
          />
        </Box>
      ),
    },
    {
      field: 'pdf_url',
      headerName: '',
      width: 40,
      sortable: false,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {p.value ? (
            <Tooltip title="Apri PDF">
              <PictureAsPdfOutlinedIcon sx={{ fontSize: 18, color: 'error.main' }} />
            </Tooltip>
          ) : null}
        </Box>
      ),
    },
    {
      field: 'customer_name',
      headerName: 'Cliente',
      width: 180,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.value as string}</Typography>
          {p.row.site_name && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>{p.row.site_name}</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'plan_title',
      headerName: 'Piano',
      flex: 1,
      minWidth: 180,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" noWrap>{(p.value as string) ?? '—'}</Typography>
        </Box>
      ),
    },
    {
      field: 'inventory_hostname',
      headerName: 'Inventory',
      width: 180,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {(p.value as string) || p.row.inventory_name || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'inventory_knumber',
      headerName: 'KNumber',
      width: 130,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ color: p.value ? 'text.primary' : 'text.disabled' }} noWrap>
            {(p.value as string) || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'tech_name',
      headerName: 'Tecnico',
      width: 170,
      renderCell: (p: GridRenderCellParams<EventRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ color: p.value ? 'text.primary' : 'text.disabled' }} noWrap>
            {(p.value as string) || '—'}
          </Typography>
        </Box>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedIds, allPageSelected, toggleRow, togglePage])

  // ── Filters ─────────────────────────────────────────────────────────────────
  const fcnt = [customerF, resultF, planF, techF, yearF].filter(Boolean).length

  const resetAll = React.useCallback(() => {
    setCustomerF('')
    setResultF('')
    setPlanF('')
    setTechF('')
    setYearF('')
    grid.reset(['ev_customer', 'ev_result', 'ev_plan', 'ev_tech', 'ev_year'])
  }, [setCustomerF, setResultF, setPlanF, setTechF, setYearF, grid])

  // ── Rapportino dialog ───────────────────────────────────────────────────────
  const [rapportinoOpen, setRapportinoOpen] = React.useState(false)


  // Hidden file input for bulk PDF upload
  const bulkPdfInputRef = React.useRef<HTMLInputElement>(null)

  const handleBulkPdfChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // pendingMultiRef is set when triggered from context menu multi-action
    // otherwise fall back to selectedIdsRef (banner button)
    const fromCtx = pendingMultiRef.current.length > 0
    const ids = fromCtx
      ? pendingMultiRef.current.map(r => r.id)
      : Array.from(selectedIdsRef.current)
    pendingMultiRef.current = []
    if (!file || ids.length === 0) return
    e.target.value = ''
    try {
      const results = await Promise.allSettled(
        ids.map(id => {
          const fd = new FormData()
          fd.append('pdf_file', file)
          return api.post(`/maintenance-events/${id}/upload-pdf/`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        })
      )
      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.filter(r => r.status === 'rejected').length
      if (fail === 0) toast.success(`PDF caricato su ${ok} rapportini ✅`)
      else toast.warning(`${ok} riusciti, ${fail} falliti`)
      if (!fromCtx) clearSelection()
      reload()
    } catch (err) { toast.error(apiErrorToMessage(err)) }
  }, [clearSelection, reload, toast])
  const [pdfViewer, setPdfViewer] = React.useState<{ url: string; knumber: string } | null>(null)

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={bulkPdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleBulkPdfChange}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfFileChange}
      />

      <EntityListCard
        toolbar={{
          q: grid.q,
          onQChange: grid.setQ,
          compact: true,
          rightActions: (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterChip
                compact
                activeCount={fcnt}
                onReset={fcnt > 0 ? resetAll : undefined}
              >
                <FormControl size="small" fullWidth>
                  <InputLabel>Cliente</InputLabel>
                  <Select
                    label="Cliente"
                    value={customerF === '' ? '' : String(customerF)}
                    onChange={e => setCustomerF(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <MenuItem value="">Tutti</MenuItem>
                    {customers.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Risultato</InputLabel>
                  <Select label="Risultato" value={resultF} onChange={e => setResultF(e.target.value)}>
                    <MenuItem value="">Tutti</MenuItem>
                    <MenuItem value="ok">OK</MenuItem>
                    <MenuItem value="ko">KO</MenuItem>
                    <MenuItem value="partial">Parziale</MenuItem>
                    <MenuItem value="not_planned">Non prevista</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth disabled={!customerF}>
                  <InputLabel>Piano</InputLabel>
                  <Select
                    label="Piano"
                    value={planF === '' ? '' : String(planF)}
                    onChange={e => setPlanF(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <MenuItem value="">Tutti</MenuItem>
                    {filterPlans.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.title}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Tecnico</InputLabel>
                  <Select
                    label="Tecnico"
                    value={techF === '' ? '' : String(techF)}
                    onChange={e => setTechF(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <MenuItem value="">Tutti</MenuItem>
                    {allTechs.map(t => <MenuItem key={t.id} value={String(t.id)}>{t.full_name}</MenuItem>)}
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  label="Anno"
                  placeholder="es. 2025"
                  value={yearF}
                  onChange={e => setYearF(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                  fullWidth
                />
              </FilterChip>

              <Tooltip title="Reimposta" arrow>
                <span>
                  <Button size="small" variant="contained" onClick={resetAll} sx={compactResetButtonSx}>
                    <RestartAltIcon />
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={exporting ? 'Esportazione…' : 'Esporta CSV'} arrow>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={exporting}
                    onClick={() => exportCsv({
                      url: '/maintenance-events/',
                      params: {
                        search: grid.search,
                        ordering: grid.ordering,
                        ...(customerF ? { plan__customer: customerF } : {}),
                        ...(resultF ? { result: resultF } : {}),
                        ...(planF ? { plan: planF } : {}),
                        ...(techF ? { tech: techF } : {}),
                        ...(yearF.trim().length === 4 ? { performed_at__year: yearF.trim() } : {}),
                      },
                      filename: 'rapportini_manutenzione',
                      columns: [
                        { label: 'Data', getValue: (r: any) => r.performed_at },
                        { label: 'Risultato', getValue: (r: any) => RESULT_LABEL[r.result] ?? r.result },
                        { label: 'Cliente', getValue: (r: any) => r.customer_name },
                        { label: 'Piano', getValue: (r: any) => r.plan_title },
                        { label: 'Inventory', getValue: (r: any) => r.inventory_hostname || r.inventory_name },
                        { label: 'KNumber', getValue: (r: any) => r.inventory_knumber },
                        { label: 'Tecnico', getValue: (r: any) => r.tech_name },
                      ],
                    })}
                    sx={compactExportButtonSx}
                  >
                    <FileDownloadOutlinedIcon />
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ),
        }}
        grid={{
          pageKey: 'maintenance-events',
          rows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowContextMenu: handleRowContextMenu,
          onRowClick: (id) => {
            const row = rows.find(r => r.id === id)
            if (row?.pdf_url) setPdfViewer({ url: row.pdf_url, knumber: row.inventory_knumber ?? row.inventory_hostname ?? String(row.id) })
          },
          sx: GRID_SX,
        }}
      >
        <Can perm={PERMS.maintenance.event.add}>
          <Tooltip title="Nuovo rapportino" arrow>
            <span>
              <Button size="small" variant="contained" onClick={() => setRapportinoOpen(true)} sx={compactCreateButtonSx}>
                <AddIcon />
              </Button>
            </span>
          </Tooltip>
        </Can>
      </EntityListCard>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={() => setContextMenu(null)}
        items={contextMenuItems}
      />

      <RapportinoDialog
        open={rapportinoOpen}
        techs={allTechs}
        onClose={() => setRapportinoOpen(false)}
        onSaved={reload}
      />

      <ConfirmDeleteDialog
        open={Boolean(resetDlg) || Boolean(resetMulti)}
        title="Reset Manutenzione"
        description={resetMulti
          ? `Eliminare definitivamente ${resetMulti.length} rapportini (inclusi i PDF)? Gli inventory torneranno in lista scadenze.`
          : `Il rapportino del ${resetDlg?.performed_at ?? ''} per "${resetDlg?.inventory_hostname || resetDlg?.inventory_name || ''}" verrà eliminato definitivamente (incluso il PDF). L'inventory tornerà nella lista scadenze.`
        }
        busy={resetBusy}
        onConfirm={doReset}
        onClose={() => { setResetDlg(null); setResetMulti(null) }}
      />

      {/* PDF viewer dialog */}
      <Dialog
        open={Boolean(pdfViewer)}
        onClose={() => setPdfViewer(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {pdfViewer ? `${pdfViewer.knumber} - Rapportino PDF` : 'Rapportino PDF'}
          <Button size="small" href={pdfViewer?.url ?? ''} target="_blank" rel="noopener noreferrer" component="a">
            Apri in nuova scheda
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {pdfViewer && (
            <Box
              component="iframe"
              src={pdfViewer.url}
              sx={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
              title="Rapportino PDF"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
