import * as React from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { GridColDef } from '@mui/x-data-grid'

import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useDrfList } from '@shared/hooks/useDrfList'
import { buildDrfListParams } from '@shared/api/drf'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactRow = {
  id: number
  name: string
  email: string | null
  phone: string | null
  department: string | null
  site_name: string | null
  site_display_name: string | null
  is_primary: boolean
  deleted_at: string | null
}

type ContactDetail = ContactRow & {
  notes: string | null
}

// ─── Columns (identical to frontend) ─────────────────────────────────────────

const cols: GridColDef<ContactRow>[] = [
  { field: 'name', headerName: 'Nome', flex: 1, minWidth: 220 },
  { field: 'email', headerName: 'Email', width: 240 },
  { field: 'phone', headerName: 'Telefono', width: 160 },
  {
    field: 'site_display_name',
    headerName: 'Sede',
    width: 220,
    valueGetter: (_v, row) => row.site_display_name || row.site_name || '—',
  },
  {
    field: 'is_primary',
    headerName: 'Primario',
    width: 120,
    renderCell: (p) =>
      p.value ? (
        <Chip size="small" label="Sì" />
      ) : (
        <Chip size="small" variant="outlined" label="No" />
      ),
  },
]

// ─── Mobile card renderer ─────────────────────────────────────────────────────

const renderContactCard: MobileCardRenderFn<ContactRow> = ({ row, onOpen }) => {
  const meta: { label: string; value: string | null | undefined }[] = [
    { label: 'Sede',     value: row.site_display_name || row.site_name },
    { label: 'Email',    value: row.email },
    { label: 'Telefono', value: row.phone },
    { label: 'Reparto',  value: row.department },
  ]

  return (
    <Box onClick={() => onOpen(row.id)} sx={{
      bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider',
      borderRadius: 1, p: 1.25, cursor: 'pointer', display: 'flex',
      flexDirection: 'column', gap: 0.75, '&:active': { bgcolor: 'action.hover' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </Typography>
          {row.department && (
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.department}
            </Typography>
          )}
        </Box>
        {row.is_primary && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20,
            bgcolor: 'rgba(16,185,129,0.10)', color: '#065f46', border: '0.5px solid rgba(16,185,129,0.28)', whiteSpace: 'nowrap' }}>
            Primario
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled',
              fontStyle: value ? 'normal' : 'italic', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// prettier-ignore
export default function Contacts() {
  const toast = useToast()

  const grid = useServerGrid({
    defaultOrdering: 'name',
    allowedOrderingFields: ['name', 'email', 'phone', 'site_display_name', 'is_primary'],
    defaultPageSize: 25,
  })

  const listParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { site_display_name: 'site__name' },
      page0: grid.paginationModel.page,
      pageSize: grid.paginationModel.pageSize,
    }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize],
  )

  const { rows, rowCount, loading } = useDrfList<ContactRow>(
    '/contacts/', listParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // Drawer
  const [drawerOpen, setDrawerOpen]       = React.useState(false)
  const [selectedId, setSelectedId]       = React.useState<number | null>(null)
  const [detail, setDetail]               = React.useState<ContactDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const openDrawer = React.useCallback(async (id: number) => {
    setSelectedId(id)
    setDrawerOpen(true)
    setDetail(null)
    setDetailLoading(true)
    grid.setOpenId(id)
    try {
      const res = await api.get<ContactDetail>(`/contacts/${id}/`)
      setDetail(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }, [grid, toast])

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
    setSelectedId(null)
    setDetail(null)
    grid.setOpenId(null)
  }, [grid])

  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    void openDrawer(id)
  }, [grid.openId, openDrawer])

  const columns = React.useMemo(() => cols, [])

  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) return { title: 'Nessun contatto', subtitle: 'Non ci sono contatti associati al tuo ente.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.search])

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <EntityListCard
        mobileCard={renderContactCard}
        toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ }}
        grid={{
          pageKey: 'auslbo-contacts',
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

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 368 } } }}>
        <Stack sx={{ height: '100%', overflow: 'hidden' }}>
          {/* Hero banner */}
          <Box sx={{
            background: 'linear-gradient(140deg, #0B3D6B 0%, #1A6BB5 55%, #4A90D9 100%)',
            px: 2.5, pt: 2.25, pb: 2.25, position: 'relative', overflow: 'hidden', flexShrink: 0,
          }}>
            <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between"
              sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
              <Tooltip title="Chiudi">
                <IconButton aria-label="Chiudi" size="small" onClick={closeDrawer}
                  sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Chip size="small" label={detail?.is_primary ? '● Primario' : '● Non primario'}
                sx={{ bgcolor: 'rgba(93,174,240,0.20)', color: '#93C9F8', fontWeight: 700,
                  fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(147,201,248,0.3)', height: 22 }} />
              <Tooltip title="Chiudi">
                <IconButton aria-label="Chiudi" size="small" onClick={closeDrawer}
                  sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography sx={{ color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.1, mb: 0.5 }}>
                {detail?.name || (selectedId ? `Contatto #${selectedId}` : 'Contatto')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                {detail?.department || ' '}
              </Typography>
              {(detail?.site_display_name || detail?.site_name) && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mt: 0.25 }}>
                  {detail.site_display_name || detail.site_name}
                </Typography>
              )}
            </Box>
          </Box>

          {detailLoading && <LinearProgress sx={{ height: 2 }} />}

          {/* Body */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {detailLoading ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
              </Stack>
            ) : detail ? (
              <>
                <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                    Dati contatto
                  </Typography>
                  <Stack spacing={0.75}>
                    {([
                      { label: 'Nome',     value: detail.name,    mono: false },
                      { label: 'Email',    value: detail.email,   mono: true  },
                      { label: 'Telefono', value: detail.phone,   mono: true  },
                      { label: 'Reparto',  value: detail.department, mono: false },
                      { label: 'Sede',     value: detail.site_display_name || detail.site_name, mono: false },
                    ] as { label: string; value?: string | null; mono: boolean }[])
                      .filter((r) => r.value)
                      .map((r) => (
                        <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 70 }}>{r.label}</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: r.mono ? 'monospace' : undefined }}>
                              {r.value}
                            </Typography>
                            {r.mono && r.value && (
                              <Tooltip title="Copia">
                                <IconButton aria-label="Copia" size="small" onClick={() => copyToClipboard(r.value!)}>
                                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </Stack>
                      ))}
                  </Stack>
                </Box>

                {detail.notes && (
                  <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>
                      Note
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {detail.notes}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>Nessun dettaglio disponibile.</Typography>
            )}
          </Box>
        </Stack>
      </Drawer>
    </Stack>
  )
}
