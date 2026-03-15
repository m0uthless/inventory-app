import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import CloseIcon from '@mui/icons-material/Close'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { apiErrorToMessage } from '../api/error'
import { buildDrfListParams, type DrfParams } from '../api/drf'
import { useDrfList } from '../hooks/useDrfList'
import { useServerGrid } from '../hooks/useServerGrid'
import EntityListCard from '../ui/EntityListCard'
import FilterChip from '../ui/FilterChip'
import RowContextMenu, { type RowContextMenuItem } from '../ui/RowContextMenu'
import { compactResetButtonSx } from '../ui/toolbarStyles'
import { useToast } from '../ui/toast'
import type { SelectChangeEvent } from '@mui/material/Select'

const SECTION_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'site_repository', label: 'Site Repository' },
  { value: 'customers', label: 'Customers' },
  { value: 'sites', label: 'Sites' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'issues', label: 'Issues' },
  { value: 'audit', label: 'Audit' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'drive', label: 'Drive' },
  { value: 'wiki', label: 'Wiki' },
  { value: 'search', label: 'Ricerca' },
  { value: 'profile', label: 'Profilo' },
  { value: 'trash', label: 'Cestino' },
  { value: 'other', label: 'Altro' },
] as const

type ReportKind = 'bug' | 'feature'
type ReportStatus = 'open' | 'resolved'

type ReportRow = {
  id: number
  kind: ReportKind
  kind_label: string
  status: ReportStatus
  status_label: string
  section: string
  section_label: string
  description: string
  screenshot_url?: string | null
  can_upload_screenshot?: boolean
  can_resolve?: boolean
  created_by?: number | null
  created_by_username?: string | null
  created_by_full_name?: string | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
  resolved_by_username?: string | null
  resolved_by_full_name?: string | null
}


type OpenCreateState = { openCreate?: boolean }

type FormState = {
  kind: ReportKind
  section: string
  description: string
  screenshot: File | null
}

type ContextMenuState = {
  row: ReportRow
  mouseX: number
  mouseY: number
}

const EMPTY_FORM: FormState = {
  kind: 'feature',
  section: 'inventory',
  description: '',
  screenshot: null,
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function excerpt(text: string, limit = 120) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized || '—'
  return `${normalized.slice(0, limit - 1)}…`
}

function computeGridHeight(visibleRows: number) {
  if (visibleRows <= 0) return 240
  const header = 45
  const footer = 62
  const rowHeight = 38
  const frame = 10
  return Math.min(760, header + footer + visibleRows * rowHeight + frame)
}

function KindChip({ kind }: { kind: ReportKind }) {
  const isBug = kind === 'bug'
  return (
    <Chip
      size="small"
      icon={isBug ? <BugReportOutlinedIcon sx={{ fontSize: 16 }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
      label={isBug ? 'Bug' : 'Feature'}
      color={isBug ? 'error' : 'success'}
      variant="filled"
      sx={{ fontWeight: 700 }}
    />
  )
}

function StatusChip({ status }: { status: ReportStatus }) {
  const isResolved = status === 'resolved'
  return (
    <Chip
      size="small"
      icon={isResolved ? <DoneAllIcon sx={{ fontSize: 15 }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
      label={isResolved ? 'Risolta' : 'Aperta'}
      variant={isResolved ? 'filled' : 'outlined'}
      color={isResolved ? 'default' : 'primary'}
      sx={
        isResolved
          ? { fontWeight: 700, bgcolor: 'rgba(15,23,42,0.08)', color: 'text.primary' }
          : { fontWeight: 700 }
      }
    />
  )
}


export default function BugFeaturePage() {
  const loc = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const { me } = useAuth()
  const isResolvedPage = loc.pathname === '/bug-feature/resolved' || loc.pathname.startsWith('/bug-feature/resolved/')

  const grid = useServerGrid({
    defaultOrdering: isResolvedPage ? '-resolved_at' : '-created_at',
    allowedOrderingFields: ['created_at', 'updated_at', 'kind', 'section', 'resolved_at'],
  })

  const [filterKind, setFilterKind] = React.useState('')
  const [filterSection, setFilterSection] = React.useState('')
  const [filterScreenshot, setFilterScreenshot] = React.useState('')
  const [filterMine, setFilterMine] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [submitBusy, setSubmitBusy] = React.useState(false)
  const [actionBusyId, setActionBusyId] = React.useState<number | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [selected, setSelected] = React.useState<ReportRow | null>(null)
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)

  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const pendingUploadRowRef = React.useRef<ReportRow | null>(null)

  const activeFilterCount = [filterKind, filterSection, filterScreenshot, filterMine].filter(Boolean).length

  const resetFilters = React.useCallback(() => {
    setFilterKind('')
    setFilterSection('')
    setFilterScreenshot('')
    setFilterMine(false)
    grid.reset(['kind', 'section', 'has_screenshot', 'created_by'])
  }, [grid])

  const commonExtraParams = React.useMemo(() => {
    const params: DrfParams = {}
    if (filterKind) params.kind = filterKind
    if (filterSection) params.section = filterSection
    if (filterScreenshot === 'with') params.has_screenshot = true
    if (filterScreenshot === 'without') params.has_screenshot = false
    if (filterMine && me?.id) params.created_by = me.id
    return params
  }, [filterKind, filterMine, filterScreenshot, filterSection, me?.id])

  const listParams = React.useMemo(
    () =>
      buildDrfListParams({
        page0: grid.paginationModel.page,
        pageSize: grid.paginationModel.pageSize,
        ordering: grid.ordering,
        search: grid.search,
        extra: { ...commonExtraParams, status: isResolvedPage ? 'resolved' : 'open' },
      }),
    [grid.paginationModel, grid.ordering, grid.search, commonExtraParams, isResolvedPage],
  )

  const { rows, rowCount, loading, reload } = useDrfList<ReportRow>(
    '/feedback-items/',
    listParams,
    (e) => toast.error(apiErrorToMessage(e)),
  )


  const loadItem = React.useCallback(async (id: number) => {
    const { data } = await api.get<ReportRow>(`/feedback-items/${id}/`)
    return data
  }, [])

  const openDrawer = React.useCallback(
    async (id: number, fallback?: ReportRow | null) => {
      if (fallback) setSelected(fallback)
      try {
        const data = await loadItem(id)
        setSelected(data)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      }
    },
    [loadItem, toast],
  )

  const openCreate = React.useCallback(() => {
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }, [])

  const openCreateOnceRef = React.useRef(false)
  React.useEffect(() => {
    const st = loc.state as OpenCreateState | null
    if (!st?.openCreate) {
      openCreateOnceRef.current = false
      return
    }
    if (openCreateOnceRef.current) return
    openCreateOnceRef.current = true
    openCreate()
    navigate(loc.pathname + loc.search, { replace: true, state: null })
  }, [loc, navigate, openCreate])

  const handleKindChange = (_event: React.MouseEvent<HTMLElement>, next: ReportKind | null) => {
    if (!next) return
    setForm((current) => ({ ...current, kind: next }))
  }

  const handleSectionChange = (event: SelectChangeEvent<string>) => {
    setForm((current) => ({ ...current, section: event.target.value }))
  }

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, description: event.target.value }))
  }

  const handleScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setForm((current) => ({ ...current, screenshot: file }))
    event.target.value = ''
  }

  const handleSubmit = async () => {
    const description = form.description.trim()
    if (!description) {
      toast.error('Inserisci una descrizione.')
      return
    }

    const body = new FormData()
    body.append('kind', form.kind)
    body.append('section', form.section)
    body.append('description', description)
    if (form.screenshot) body.append('screenshot', form.screenshot)

    setSubmitBusy(true)
    try {
      await api.post('/feedback-items/', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(form.kind === 'bug' ? 'Bug segnalato.' : 'Richiesta funzionalità registrata.')
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      if (isResolvedPage) {
        navigate('/bug-feature')
      } else {
        reload()
      }
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSubmitBusy(false)
    }
  }

  const handleRowContextMenu = React.useCallback((row: ReportRow, event: React.MouseEvent<HTMLElement>) => {
    setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
  }, [])

  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  const handleOpenContext = React.useCallback(async () => {
    const row = contextMenu?.row
    if (!row) return
    await openDrawer(row.id, row)
  }, [contextMenu, openDrawer])

  const handleResolve = React.useCallback(
    async (row: ReportRow) => {
      setActionBusyId(row.id)
      try {
        await api.patch(`/feedback-items/${row.id}/`, { status: 'resolved' })
        toast.success('Segnalazione spostata in Resolved.')
        if (selected?.id === row.id) {
          const fresh = await loadItem(row.id)
          setSelected(fresh)
        }
        reload()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setActionBusyId(null)
      }
    },
    [loadItem, reload, selected, toast],
  )

  const triggerUploadForRow = React.useCallback((row: ReportRow) => {
    pendingUploadRowRef.current = row
    uploadInputRef.current?.click()
  }, [])

  const handleInlineScreenshotUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      const row = pendingUploadRowRef.current
      event.target.value = ''
      if (!file || !row) return

      setActionBusyId(row.id)
      try {
        const body = new FormData()
        body.append('screenshot', file)
        const { data } = await api.patch<ReportRow>(`/feedback-items/${row.id}/`, body, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('Screenshot caricato.')
        if (selected?.id === row.id) setSelected(data)
        reload()
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        pendingUploadRowRef.current = null
        setActionBusyId(null)
      }
    },
    [reload, selected, toast],
  )

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []

    const items: RowContextMenuItem[] = [
      {
        key: 'open',
        label: 'Apri',
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => handleOpenContext(),
      },
      {
        key: 'upload-screenshot',
        label: 'Carica screen',
        icon: <UploadFileOutlinedIcon fontSize="small" />,
        onClick: () => triggerUploadForRow(row),
        disabled: !row.can_upload_screenshot || actionBusyId === row.id,
      },
    ]

    if (!isResolvedPage && row.can_resolve) {
      items.push({
        key: 'resolve',
        label: 'Chiudi',
        icon: <DoneAllIcon fontSize="small" />,
        onClick: () => handleResolve(row),
        disabled: row.status === 'resolved' || actionBusyId === row.id,
      })
    }

    return items
  }, [actionBusyId, contextMenu, handleOpenContext, handleResolve, isResolvedPage, triggerUploadForRow])

  const baseColumns = React.useMemo<GridColDef<ReportRow>[]>(
    () => [
      {
        field: 'created_at',
        headerName: 'Data',
        minWidth: 164,
        flex: 0.82,
        sortable: true,
        renderCell: (params) => (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2">{formatDateTime(String(params.row.created_at ?? ''))}</Typography>
          </Box>
        ),
      },
      {
        field: 'kind',
        headerName: 'Tipo',
        minWidth: 138,
        flex: 0.56,
        sortable: true,
        renderCell: (params: GridRenderCellParams<ReportRow, ReportKind>) => (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <KindChip kind={params.row.kind} />
          </Box>
        ),
      },
      {
        field: 'section_label',
        headerName: 'Sezione',
        minWidth: 160,
        flex: 0.72,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <Chip size="small" label={params.row.section_label} variant="outlined" sx={{ fontWeight: 600 }} />
          </Box>
        ),
      },
      {
        field: 'description',
        headerName: 'Descrizione',
        minWidth: 340,
        flex: 1.85,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              {excerpt(String(params.value ?? ''))}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'created_by_full_name',
        headerName: 'Creato da',
        minWidth: 160,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {params.row.created_by_full_name || params.row.created_by_username || '—'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'screenshot_url',
        headerName: 'Screenshot',
        minWidth: 118,
        flex: 0.52,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            {params.row.screenshot_url ? (
              <Button
                size="small"
                variant="text"
                startIcon={<ImageOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={(event) => {
                  event.stopPropagation()
                  window.open(params.row.screenshot_url || '', '_blank', 'noopener,noreferrer')
                }}
                sx={{ minWidth: 0, textTransform: 'none' }}
              >
                Apri
              </Button>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                —
              </Typography>
            )}
          </Box>
        ),
      },
    ],
    [],
  )

  const columns = React.useMemo<GridColDef<ReportRow>[]>(() => {
    if (!isResolvedPage) return baseColumns
    const next = [...baseColumns]
    next.splice(1, 0, {
      field: 'resolved_at',
      headerName: 'Chiusa il',
      minWidth: 164,
      flex: 0.82,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2">{formatDateTime(params.row.resolved_at)}</Typography>
        </Box>
      ),
    })
    return next
  }, [baseColumns, isResolvedPage])

  const sharedGridSx = {
    '--DataGrid-rowHeight': '36px',
    '--DataGrid-headerHeight': '44px',
    '& .MuiDataGrid-cell': {
      py: 0.25,
      display: 'flex',
      alignItems: 'center',
    },
    '& .MuiDataGrid-columnHeader': { py: 0.75 },
    '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 700 },
    '& .MuiDataGrid-virtualScrollerContent': { pb: 1 },
    '& .MuiDataGrid-footerContainer': {
      minHeight: 60,
      borderTop: '1px solid',
      borderColor: 'divider',
      px: 0.5,
    },
    '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
    '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
    '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(69,127,121,0.10) !important' },
    '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(69,127,121,0.14) !important' },
  } as const

  const emptyState = isResolvedPage
    ? {
        title: 'Nessuna segnalazione resolved',
        subtitle: 'Le voci chiuse compariranno qui.',
      }
    : {
        title: 'Ancora nessuna segnalazione aperta',
        subtitle: 'Usa il FAB per inviare un bug o una richiesta funzionalità.',
        action: (
          <Button variant="contained" onClick={openCreate}>
            Apri modulo
          </Button>
        ),
      }

  return (
    <Stack spacing={2}>
      <EntityListCard<ReportRow>
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          searchLabel: isResolvedPage ? 'Cerca segnalazioni resolved' : 'Cerca segnalazioni',
          rightActions: (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Reimposta" arrow>
                <span>
                  <Button size="small" variant="contained" onClick={resetFilters} sx={compactResetButtonSx}>
                    <RestartAltIcon />
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ),
        }}
        grid={{
          rows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: (id) => {
            const row = rows.find((item) => item.id === id) || null
            if (row) void openDrawer(id, row)
          },
          onRowContextMenu: handleRowContextMenu,
          pageKey: isResolvedPage ? 'bug-feature-resolved' : 'bug-feature-open',
          height: computeGridHeight(rows.length),
          sx: sharedGridSx,
          showGridToolbar: false,
          emptyState,
        }}
      >
        <FilterChip compact activeCount={activeFilterCount} onReset={resetFilters} tooltip="Filtra segnalazioni">
          <FormControl size="small" fullWidth>
            <InputLabel id="bug-feature-filter-kind">Tipo</InputLabel>
            <Select
              labelId="bug-feature-filter-kind"
              value={filterKind}
              label="Tipo"
              onChange={(event) => setFilterKind(event.target.value)}
            >
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="bug">Bug</MenuItem>
              <MenuItem value="feature">Feature request</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="bug-feature-filter-section">Sezione</InputLabel>
            <Select
              labelId="bug-feature-filter-section"
              value={filterSection}
              label="Sezione"
              onChange={(event) => setFilterSection(event.target.value)}
            >
              <MenuItem value="">Tutte</MenuItem>
              {SECTION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="bug-feature-filter-screenshot">Screenshot</InputLabel>
            <Select
              labelId="bug-feature-filter-screenshot"
              value={filterScreenshot}
              label="Screenshot"
              onChange={(event) => setFilterScreenshot(event.target.value)}
            >
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="with">Con screenshot</MenuItem>
              <MenuItem value="without">Senza screenshot</MenuItem>
            </Select>
          </FormControl>

          <Button
            size="small"
            variant={filterMine ? 'contained' : 'outlined'}
            onClick={() => setFilterMine((current) => !current)}
            sx={{ width: '100%', textTransform: 'none', justifyContent: 'center' }}
          >
            Solo mie
          </Button>
        </FilterChip>
      </EntityListCard>

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      <input ref={uploadInputRef} hidden type="file" accept="image/*" onChange={handleInlineScreenshotUpload} />

      <Dialog open={dialogOpen} onClose={() => !submitBusy && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Report / Request</DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
          <Alert severity="info" sx={{ borderRadius: 1.5 }}>
            Segnala un bug oppure proponi una nuova funzionalità relativa a inventory-app.
          </Alert>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
              Tipo di segnalazione
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={form.kind}
              onChange={handleKindChange}
              fullWidth
              color="primary"
              sx={{
                '& .MuiToggleButton-root': {
                  py: 1.2,
                  fontWeight: 700,
                  textTransform: 'none',
                },
              }}
            >
              <ToggleButton value="feature">
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />
                  <span>Request feature</span>
                </Stack>
              </ToggleButton>
              <ToggleButton value="bug">
                <Stack direction="row" spacing={1} alignItems="center">
                  <BugReportOutlinedIcon sx={{ fontSize: 18 }} />
                  <span>Report a bug</span>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="report-request-section">Sezione interessata</InputLabel>
            <Select
              labelId="report-request-section"
              label="Sezione interessata"
              value={form.section}
              onChange={handleSectionChange}
            >
              {SECTION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            multiline
            minRows={6}
            label={form.kind === 'bug' ? 'Descrivi il problema' : 'Descrivi la funzionalità desiderata'}
            value={form.description}
            onChange={handleDescriptionChange}
            placeholder={
              form.kind === 'bug'
                ? 'Spiega cosa stavi facendo, cosa ti aspettavi e cosa è successo.'
                : 'Spiega il bisogno, il comportamento atteso e il valore della funzionalità.'
            }
            fullWidth
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Screenshot (opzionale)
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadFileOutlinedIcon />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Carica screenshot
                <input hidden type="file" accept="image/*" onChange={handleScreenshotChange} />
              </Button>
              <Typography variant="body2" sx={{ color: form.screenshot ? 'text.primary' : 'text.secondary' }}>
                {form.screenshot ? form.screenshot.name : 'Nessun file selezionato'}
              </Typography>
              {form.screenshot ? (
                <Button size="small" color="inherit" onClick={() => setForm((current) => ({ ...current, screenshot: null }))}>
                  Rimuovi
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitBusy}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitBusy}>
            {submitBusy ? 'Invio…' : 'Invia'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}
      >
        {selected ? (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                color: '#fff',
                background:
                  selected.kind === 'bug'
                    ? 'linear-gradient(135deg, #b91c1c 0%, #dc2626 60%, #f97316 100%)'
                    : 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #0891b2 100%)',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Stack spacing={1} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <KindChip kind={selected.kind} />
                    <StatusChip status={selected.status} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {selected.section_label}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)' }}>
                    Inserito da {selected.created_by_full_name || selected.created_by_username || '—'} · {formatDateTime(selected.created_at)}
                  </Typography>
                </Stack>
                <IconButton
                  aria-label="Chiudi"
                  color="inherit"
                  onClick={() => setSelected(null)}
                  sx={{
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.24)',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' },
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default', p: 2.5 }}>
              <Stack spacing={2}>
                <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>
                    Descrizione
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                    {selected.description}
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>
                    Dettagli
                  </Typography>
                  <Box
                    sx={{
                      mt: 1.25,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.25,
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Tipo</Typography>
                      <Box sx={{ mt: 0.5 }}><KindChip kind={selected.kind} /></Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Sezione</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{selected.section_label}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Creato da</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{selected.created_by_full_name || selected.created_by_username || '—'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Ultimo aggiornamento</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{formatDateTime(selected.updated_at)}</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>
                    Stato
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                    <Box>
                      <StatusChip status={selected.status} />
                    </Box>
                    {selected.status === 'resolved' ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Chiusa il {formatDateTime(selected.resolved_at)} da {selected.resolved_by_full_name || selected.resolved_by_username || '—'}.
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Segnalazione ancora aperta.
                      </Typography>
                    )}
                    {!isResolvedPage && selected.status === 'open' && selected.can_resolve ? (
                      <Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DoneAllIcon />}
                          onClick={() => void handleResolve(selected)}
                          disabled={actionBusyId === selected.id}
                        >
                          Segna come resolved
                        </Button>
                      </Box>
                    ) : null}
                  </Stack>
                </Box>

                <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>
                    Timeline
                  </Typography>
                  <Stack spacing={0.9} sx={{ mt: 1.25 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Creata il {formatDateTime(selected.created_at)}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Aggiornata il {formatDateTime(selected.updated_at)}</Typography>
                    {selected.resolved_at ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Resolved il {formatDateTime(selected.resolved_at)}</Typography>
                    ) : null}
                  </Stack>
                </Box>

                <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>
                    Allegati
                  </Typography>
                  {selected.screenshot_url ? (
                    <Stack spacing={1.5} sx={{ mt: 1.25 }}>
                      <Box
                        component="img"
                        src={selected.screenshot_url}
                        alt="Screenshot allegato"
                        sx={{
                          width: '100%',
                          maxHeight: 320,
                          objectFit: 'contain',
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: '#fff',
                        }}
                      />
                      <Link
                        href={selected.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, width: 'fit-content' }}
                      >
                        Apri immagine completa <LaunchOutlinedIcon sx={{ fontSize: 16 }} />
                      </Link>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      Nessuno screenshot allegato.
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </Box>
        ) : null}
      </Drawer>
    </Stack>
  )
}
