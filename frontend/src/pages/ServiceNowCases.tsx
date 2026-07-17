import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'
import CloseIcon from '@mui/icons-material/Close'

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
import { type AbsenceRow, ABSENCE_REASONS, todayISO, formatItDate, formatItTime } from '../features/servicenow/absenceShared'

// "Aperto il" per card mobile / dettaglio: combina data e ora se entrambe presenti.
export function formatOpenedAt(row: { opened_date: string | null; opened_time: string | null }): string | null {
  if (!row.opened_date) return null
  const time = row.opened_time ? ` · ${formatItTime(row.opened_time)}` : ''
  return `${formatItDate(row.opened_date)}${time}`
}
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import ServiceNowCaseDrawer from '../features/servicenow/ServiceNowCaseDrawer'
import ServiceNowCaseFormDrawer, { type ServiceNowCaseForm } from '../features/servicenow/ServiceNowCaseFormDrawer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type ServiceNowCaseRow = {
  id: number
  number: string
  account: string
  short_description: string
  priority: string
  priority_label: string
  category: string
  category_label: string
  case_type: number
  case_type_label: string
  opened_date: string | null
  opened_time: string | null
  screenshot_url: string | null
  status: string
  status_label: string
  assigned_to: number | null
  assigned_to_username: string | null
  assigned_to_full_name: string | null
  assigned_to_avatar: string | null
  external_url: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const SERVICENOW_CASES_PATH = '/servicenow-cases/' as const satisfies CollectionPath

// ─── Chip priorità / stato ─────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  '1': { bg: 'rgba(239,68,68,0.10)',  fg: '#991b1b', border: 'rgba(239,68,68,0.28)' },  // Critical
  '2': { bg: 'rgba(245,158,11,0.10)', fg: '#92400e', border: 'rgba(245,158,11,0.28)' }, // High
  '3': { bg: 'rgba(59,130,246,0.10)', fg: '#1e40af', border: 'rgba(59,130,246,0.28)' }, // Moderate
  '4': { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' }, // Low
}

// Colore semantico del tema (coerente con Issues.tsx: Chip standard MUI,
// palette pastello definita centralmente in theme.ts). Usato per i chip
// nella DataGrid desktop; le mappe rgba sopra restano per i badge compatti
// della mobile card.
const PRIORITY_SEMANTIC: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  '1': 'error',   // Critical
  '2': 'warning', // High
  '3': 'info',    // Moderate
  '4': 'default', // Low
}

function SemanticChip({ label, color }: { label: string; color: 'error' | 'warning' | 'info' | 'success' | 'default' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <Chip size="small" label={label} color={color} variant={color === 'default' ? 'outlined' : 'filled'} />
    </Box>
  )
}

// ─── Pannello Triage (casi di oggi per categoria/tecnico) ────────────────────

type TriageTechnician = { id: number | null; name: string; count: number; absent?: boolean; absence_reason?: string | null }
type TriageCategoryData = { total: number; technicians: TriageTechnician[] }
type TriageResponse = { date: string; categories: Record<string, TriageCategoryData> }

const TRIAGE_CATEGORIES = [
  { value: 'philips', label: 'Philips', accent: '#0f766e', tint: 'rgba(15,118,110,0.08)' },
  { value: 'biotron', label: 'Biotron', accent: '#0ea5e9', tint: 'rgba(14,165,233,0.08)' },
] as const

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function TriageTechnicianRow({ t, accent, canManage, onManage }: {
  t: TriageTechnician; accent: string; canManage: boolean; onManage: (t: TriageTechnician) => void
}) {
  const free = t.count === 0 && !t.absent
  return (
    <Stack
      direction="row" alignItems="center" spacing={1}
      sx={{
        px: 0.75, py: 0.5, borderRadius: 1.5,
        bgcolor: t.absent ? 'rgba(239,68,68,0.05)' : free ? 'transparent' : 'action.hover',
        transition: 'background-color 0.15s',
        '&:hover .triage-manage-btn': { opacity: 1 },
      }}
    >
      <Box sx={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6rem', fontWeight: 700,
        bgcolor: t.absent ? 'rgba(239,68,68,0.12)' : free ? 'action.selected' : `${accent}26`,
        color: t.absent ? 'error.main' : free ? 'text.disabled' : accent,
      }}>
        {t.id === null ? '—' : initialsOf(t.name)}
      </Box>
      <Typography sx={{ fontSize: '0.8rem', color: t.absent || free ? 'text.disabled' : 'text.primary', flex: 1, minWidth: 0 }} noWrap>
        {t.name}
      </Typography>
      {t.absent ? (
        <Chip
          size="small" label={t.absence_reason ?? 'Assente'}
          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(239,68,68,0.12)', color: 'error.main' }}
        />
      ) : free ? (
        <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 600, flexShrink: 0 }}>
          Libero
        </Typography>
      ) : (
        <Box sx={{
          minWidth: 22, px: 0.6, py: 0.05, borderRadius: 10, textAlign: 'center', flexShrink: 0,
          bgcolor: accent, color: '#fff', fontSize: '0.72rem', fontWeight: 700,
        }}>
          {t.count}
        </Box>
      )}
      {canManage && t.id !== null && (
        <IconButton
          size="small"
          className="triage-manage-btn"
          onClick={() => onManage(t)}
          sx={{ p: 0.3, opacity: { xs: 1, sm: 0.35 }, transition: 'opacity 0.15s', flexShrink: 0 }}
          title="Gestisci assenze"
        >
          <EventBusyOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Stack>
  )
}

function TriageCategoryCard({ label, accent, tint, data, canManage, onManage }: {
  label: string; accent: string; tint: string; data: TriageCategoryData | undefined
  canManage: boolean; onManage: (t: TriageTechnician) => void
}) {
  const total = data?.total ?? 0
  const technicians = data?.technicians ?? []
  return (
    <Box sx={{
      flex: 1, minWidth: 240, borderRadius: 1.5, overflow: 'hidden',
      border: '0.5px solid', borderColor: 'divider',
    }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.25, py: 1, bgcolor: tint, borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Box sx={{ width: 5, height: 30, borderRadius: 4, bgcolor: accent, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>{label}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>casi di oggi</Typography>
        </Box>
        <Typography sx={{ fontSize: '1.7rem', fontWeight: 800, color: accent, lineHeight: 1 }}>{total}</Typography>
      </Stack>
      <Stack spacing={0.25} sx={{ p: 0.75 }}>
        {technicians.length === 0 ? (
          <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', fontStyle: 'italic', px: 0.75, py: 0.5 }}>
            Nessun tecnico in questa categoria
          </Typography>
        ) : (
          technicians.map((t) => (
            <TriageTechnicianRow key={t.id ?? 'unassigned'} t={t} accent={accent} canManage={canManage} onManage={onManage} />
          ))
        )}
      </Stack>
    </Box>
  )
}

// ─── Modal gestione assenze tecnico ──────────────────────────────────────────

function TechnicianAbsenceDialog({ open, technician, onClose, onSaved }: {
  open: boolean
  technician: TriageTechnician | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [absences, setAbsences] = React.useState<AbsenceRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [dateFrom, setDateFrom] = React.useState(todayISO())
  const [dateTo, setDateTo] = React.useState(todayISO())
  const [reason, setReason] = React.useState<string>('ferie')
  const [note, setNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)

  const reload = React.useCallback(() => {
    if (!technician?.id) return
    setLoading(true)
    api.get<AbsenceRow[]>('/technician-absences/', { params: { user: technician.id } })
      .then((r) => setAbsences(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
  }, [technician?.id, toast])

  React.useEffect(() => {
    if (open) {
      setDateFrom(todayISO()); setDateTo(todayISO()); setReason('ferie'); setNote('')
      reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, technician?.id])

  const handleAdd = async () => {
    if (!technician?.id) return
    if (dateTo < dateFrom) {
      toast.error('La data di fine non può precedere quella di inizio')
      return
    }
    setSaving(true)
    try {
      await api.post('/technician-absences/', {
        user: technician.id, date_from: dateFrom, date_to: dateTo, reason, note,
      })
      toast.success('Assenza registrata ✅')
      setDateFrom(todayISO()); setDateTo(todayISO()); setReason('ferie'); setNote('')
      reload()
      onSaved()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await api.delete(`/technician-absences/${id}/`)
      toast.success('Assenza rimossa ✅')
      reload()
      onSaved()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        Assenze — {technician?.name}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>Nuova assenza</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Dal" type="date" size="small" fullWidth
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Al" type="date" size="small" fullWidth
                value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <TextField
              select label="Motivo" size="small" value={reason}
              onChange={(e) => setReason(e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              {ABSENCE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
            <TextField
              label="Nota (opzionale)" size="small" value={note}
              onChange={(e) => setNote(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" size="small" onClick={handleAdd} disabled={saving}>
              {saving ? <CircularProgress size={16} color="inherit" /> : 'Aggiungi assenza'}
            </Button>
          </Stack>

          <Stack spacing={0.75}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>Assenze programmate</Typography>
            {loading ? (
              <Stack alignItems="center" py={2}><CircularProgress size={18} /></Stack>
            ) : absences.length === 0 ? (
              <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', fontStyle: 'italic' }}>Nessuna assenza registrata</Typography>
            ) : (
              absences.map((a) => (
                <Stack key={a.id} direction="row" alignItems="center" spacing={1} sx={{
                  px: 1, py: 0.6, borderRadius: 1, bgcolor: 'action.hover',
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      {a.date_from === a.date_to ? formatItDate(a.date_from) : `${formatItDate(a.date_from)} → ${formatItDate(a.date_to)}`}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                      {a.reason_label}{a.note ? ` · ${a.note}` : ''}
                    </Typography>
                  </Box>
                  <IconButton size="small" disabled={deletingId === a.id} onClick={() => handleDelete(a.id)}>
                    {deletingId === a.id ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Stack>
              ))
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  )
}

function TriagePanel({ refreshKey, canManage }: { refreshKey: number; canManage: boolean }) {
  const [data, setData] = React.useState<TriageResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [absenceTarget, setAbsenceTarget] = React.useState<TriageTechnician | null>(null)

  const reload = React.useCallback(() => {
    setLoading(true)
    api.get<TriageResponse>('/servicenow-cases/triage/')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { reload() }, [refreshKey, reload])

  const todayLabel = React.useMemo(() => {
    const d = data?.date ? new Date(`${data.date}T00:00:00`) : new Date()
    const label = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [data?.date])

  return (
    <Box sx={{
      bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5,
      backgroundImage: 'linear-gradient(135deg, rgba(15,118,110,0.03), rgba(14,165,233,0.03))',
    }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Triage</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>{todayLabel}</Typography>
      </Stack>
      {loading ? (
        <Stack alignItems="center" justifyContent="center" minHeight={64}>
          <CircularProgress size={20} />
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          {TRIAGE_CATEGORIES.map((c) => (
            <TriageCategoryCard
              key={c.value} label={c.label} accent={c.accent} tint={c.tint} data={data?.categories[c.value]}
              canManage={canManage} onManage={setAbsenceTarget}
            />
          ))}
        </Stack>
      )}

      <TechnicianAbsenceDialog
        open={absenceTarget !== null}
        technician={absenceTarget}
        onClose={() => setAbsenceTarget(null)}
        onSaved={reload}
      />
    </Box>
  )
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

const renderServiceNowCaseCard: MobileCardRenderFn<ServiceNowCaseRow> = ({ row, onOpen }) => {
  const pc = PRIORITY_COLOR[row.priority]
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
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, fontFamily: 'monospace' }}>
            {row.number}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.account}
          </Typography>
        </Box>
        {row.external_url && (
          <IconButton
            size="small"
            component="a"
            href={row.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{ flexShrink: 0 }}
          >
            <OpenInNewIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {row.short_description || '—'}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {[
          { label: 'Type', value: `${row.category_label} · ${row.case_type_label}` },
          { label: 'Priorità', value: row.priority_label },
          { label: 'Aperto il', value: formatOpenedAt(row) },
          { label: 'Assegnato a', value: row.assigned_to_full_name },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.3 }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
      {pc && (
        <Box sx={{ alignSelf: 'flex-start', fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20, bgcolor: pc.bg, color: pc.fg, border: `0.5px solid ${pc.border}` }}>
          {row.priority_label}
        </Box>
      )}
    </Box>
  )
}

// ─── Colonne DataGrid ─────────────────────────────────────────────────────────

const COLUMNS: GridColDef<ServiceNowCaseRow>[] = [
  { field: 'number',  headerName: 'Numero', width: 130, renderCell: ({ value }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{value as string}</Box>
  ) },
  { field: 'account', headerName: 'Account', flex: 1, minWidth: 180 },
  { field: 'category_label', headerName: 'Categoria', width: 100 },
  { field: 'case_type_label', headerName: 'Type', width: 100 },
  {
    field: 'priority_label',
    headerName: 'Priorità',
    width: 130,
    renderCell: ({ row }) => <SemanticChip label={row.priority_label} color={PRIORITY_SEMANTIC[row.priority] ?? 'default'} />,
  },
  {
    field: 'opened_date', headerName: 'Aperto il', width: 150,
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{formatOpenedAt(row) ?? '—'}</Box>
    ),
  },
  {
    field: 'external_url',
    headerName: 'Link',
    width: 70,
    sortable: false,
    filterable: false,
    renderCell: ({ row }) => row.external_url ? (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <IconButton
          size="small"
          component="a"
          href={row.external_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    ) : null,
  },
  { field: 'assigned_to_full_name', headerName: 'Assegnato a', width: 160 },
  { field: 'short_description', headerName: 'Descrizione', flex: 1.4, minWidth: 200 },
]

const ALLOWED_ORDERING = ['number', 'account', 'priority', 'category', 'case_type__name', 'opened_date', 'created_at', 'updated_at', 'deleted_at'] as const

// ─── Pagina ServiceNow Case ───────────────────────────────────────────────────

export default function ServiceNowCases() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()

  const canChange = hasPerm(PERMS.servicenow.case.change)
  const canDelete  = hasPerm(PERMS.servicenow.case.delete)
  const canCreateIssue = hasPerm(PERMS.issues.issue.add)

  const grid = useServerGrid({
    defaultOrdering: '-created_at',
    allowedOrderingFields: ALLOWED_ORDERING,
  })

  // ── Triage (pannello riepilogo casi di oggi) ────────────────────────────────
  const [triageRefreshKey, setTriageRefreshKey] = React.useState(0)

  // ── Lista ─────────────────────────────────────────────────────────────────
  const listParams = React.useMemo(() => buildDrfListParams({
    search:         grid.search,
    ordering:       grid.ordering,
    page0:          grid.paginationModel.page,
    pageSize:       grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted,
    onlyDeleted:    grid.onlyDeleted,
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted])

  const { rows, rowCount, loading, reload: reloadList } = useDrfList<ServiceNowCaseRow>(
    SERVICENOW_CASES_PATH,
    listParams,
    (e) => toast.error(apiErrorToMessage(e)),
  )

  // ── Detail drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen]       = React.useState(false)
  const [drawerTab, setDrawerTab]         = React.useState(0)
  const [selectedId, setSelectedId]       = React.useState<number | null>(null)
  const [detail, setDetail]               = React.useState<ServiceNowCaseRow | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const loadDetail = React.useCallback(async (id: number, forceIncludeDeleted?: boolean) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const inc = forceIncludeDeleted ?? grid.includeDeleted
      const incParams = includeDeletedParams(inc)
      const res = await api.get<ServiceNowCaseRow>(
        itemPath(SERVICENOW_CASES_PATH, id),
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
  const [formTarget, setFormTarget] = React.useState<ServiceNowCaseRow | null>(null)
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

  const handleSave = async (form: ServiceNowCaseForm, screenshotFile: File | null) => {
    setFormSaving(true)
    try {
      const fd = new FormData()
      fd.append('number', form.number)
      fd.append('account', form.account)
      fd.append('priority', form.priority)
      fd.append('category', form.category)
      if (form.case_type !== '') fd.append('case_type', String(form.case_type))
      if (form.opened_date) fd.append('opened_date', form.opened_date)
      if (form.opened_time) fd.append('opened_time', form.opened_time)
      fd.append('short_description', form.short_description)
      if (form.assigned_to !== null) fd.append('assigned_to', String(form.assigned_to))
      fd.append('external_url', form.external_url)
      if (screenshotFile) fd.append('screenshot', screenshotFile)

      if (formTarget) {
        await api.patch(itemPath(SERVICENOW_CASES_PATH, formTarget.id), fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('ServiceNow Case aggiornato ✅')
        if (selectedId === formTarget.id) await loadDetail(formTarget.id)
        reloadList()
        setTriageRefreshKey((k) => k + 1)
      } else {
        const res = await api.post<ServiceNowCaseRow>(SERVICENOW_CASES_PATH, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('ServiceNow Case creato ✅')
        reloadList()
        setTriageRefreshKey((k) => k + 1)
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
      await api.delete(itemPath(SERVICENOW_CASES_PATH, detail.id))
      toast.success('ServiceNow Case eliminato ✅')
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
      await api.post(itemActionPath(SERVICENOW_CASES_PATH, detail.id, 'restore'))
      toast.success('ServiceNow Case ripristinato ✅')
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
    row: ServiceNowCaseRow; mouseX: number; mouseY: number
  } | null>(null)

  const handleRowContextMenu = React.useCallback(
    (row: ServiceNowCaseRow, event: React.MouseEvent<HTMLElement>) => {
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
              await api.post(itemActionPath(SERVICENOW_CASES_PATH, row.id, 'restore'))
              toast.success('ServiceNow Case ripristinato ✅')
              reloadList()
            } catch (e) { toast.error(apiErrorToMessage(e)) }
            finally { setRestoreBusy(false) }
          },
        },
      ]
    }
    return [
      { key: 'open',   label: 'Apri',     icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => { openDrawer(row.id); setContextMenu(null) } },
      {
        key: 'createIssue', label: 'Crea Issue', icon: <BugReportOutlinedIcon fontSize="small" />,
        hidden: !canCreateIssue,
        onClick: () => {
          setContextMenu(null)
          navigate('/issues', {
            state: {
              openCreate: true,
              createFromServiceNowCase: {
                number: row.number,
                account: row.account,
                shortDescription: row.short_description,
              },
            },
          })
        },
      },
      { key: 'edit',   label: 'Modifica', icon: <EditIcon fontSize="small" />,               hidden: !canChange, onClick: () => { setFormTarget(row); setFormOpen(true); setContextMenu(null) } },
      { key: 'delete', label: 'Elimina',  icon: <DeleteOutlineIcon fontSize="small" />,      hidden: !canDelete, tone: 'danger' as const, onClick: () => { openDelete(row.id); setContextMenu(null) } },
    ]
  }, [contextMenu, canChange, canDelete, canCreateIssue, restoreBusy, openDrawer, reloadList, toast, navigate])

  // ── Empty state ───────────────────────────────────────────────────────────
  const emptyState = React.useMemo(() => {
    if (grid.view === 'deleted' && !grid.search.trim())
      return { title: 'Cestino vuoto', subtitle: 'Non ci sono ServiceNow Case eliminati.' }
    if (!grid.search.trim())
      return { title: 'Nessun ServiceNow Case', subtitle: 'Crea un nuovo case da uno screenshot.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.view, grid.search])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={2} sx={{ height: '100%' }}>

      <TriagePanel refreshKey={triageRefreshKey} canManage={canChange} />

      <EntityListCard
        mobileCard={renderServiceNowCaseCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
        }}
        grid={{
          pageKey: 'servicenow-cases',
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
      <ServiceNowCaseDrawer
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
      />

      {/* ── Form drawer create/edit ── */}
      <ServiceNowCaseFormDrawer
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
        description="Il ServiceNow Case verrà spostato nel cestino e potrà essere ripristinato."
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
