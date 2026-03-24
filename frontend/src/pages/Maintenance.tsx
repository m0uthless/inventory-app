/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid'

import AttachFileIcon from '@mui/icons-material/AttachFile'
import BlockIcon from '@mui/icons-material/Block'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import Portal from '@mui/material/Portal'
import { alpha, useTheme } from '@mui/material/styles'
import { api } from '../api/client'
import { apiErrorToMessage } from '../api/error'
import { Can } from '../auth/Can'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { useDrfList } from '../hooks/useDrfList'
import { useServerGrid } from '../hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '../hooks/useUrlParam'
import EntityListCard from '../ui/EntityListCard'
import FilterChip from '../ui/FilterChip'
import RowContextMenu, { type RowContextMenuItem } from '../ui/RowContextMenu'
import { compactExportButtonSx, compactResetButtonSx } from '../ui/toolbarStyles'
import { useToast } from '../ui/toast'
import { useExportCsv } from '../ui/useExportCsv'
import type { PlanRow, EventRow, TodoRow, RapportinoContext } from './maintenanceTypes'

// ─── Local types ──────────────────────────────────────────────────────────────

type CustomerItem = { id: number; code: string; name: string; display_name?: string }
type SiteItem = { id: number; name: string; display_name?: string | null }
type InventoryItem = { id: number; name: string; hostname?: string | null; knumber?: string | null }

type EventForm = {
  plan: number | ''
  inventory: number | ''
  performed_at: string
  result: 'ok' | 'ko' | 'partial' | ''
  tech: number | ''
  notes: string
  pdf_file: File | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIT_IT: Record<string, string> = { days: 'giorni', weeks: 'settimane', months: 'mesi', years: 'anni' }

function formatSchedule(row: Pick<PlanRow, 'schedule_type' | 'interval_value' | 'interval_unit' | 'fixed_month' | 'fixed_day'>) {
  if (row.schedule_type === 'interval' && row.interval_value && row.interval_unit)
    return `ogni ${row.interval_value} ${UNIT_IT[row.interval_unit] ?? row.interval_unit}`
  if (row.schedule_type === 'fixed_date' && row.fixed_day && row.fixed_month)
    return `${String(row.fixed_day).padStart(2, '0')}/${String(row.fixed_month).padStart(2, '0')} ogni anno`
  return row.schedule_type
}

function dueDiffDays(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

function DueBadge({ dateStr }: { dateStr: string }) {
  const diff = dueDiffDays(dateStr)
  if (diff < 0) return <Chip size="small" icon={<WarningAmberRoundedIcon sx={{ fontSize: '14px !important' }} />} label={`${Math.abs(diff)} gg fa`} color="error" sx={{ height: 22, fontWeight: 600, fontSize: '0.72rem' }} />
  if (diff === 0) return <Chip size="small" label="Oggi" color="error" sx={{ height: 22, fontWeight: 700, fontSize: '0.72rem' }} />
  if (diff <= 30) return <Chip size="small" label={`${diff} gg`} color="warning" variant="outlined" sx={{ height: 22, fontWeight: 600, fontSize: '0.72rem' }} />
  const [y, m, d] = dateStr.split('-')
  return <Chip size="small" label={`${d}/${m}/${y}`} color="default" variant="outlined" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, borderRadius: 1.5 }} />
}

const RESULT_COLOR: Record<string, 'success' | 'error' | 'warning' | 'default'> = { ok: 'success', ko: 'error', partial: 'warning', not_planned: 'default' }
const RESULT_LABEL: Record<string, string> = { ok: 'OK', ko: 'KO', partial: 'Parziale', not_planned: 'Non prevista' }

const GRID_SX = {
  '--DataGrid-rowHeight': '24px',
  '--DataGrid-headerHeight': '35px',
  '& .MuiDataGrid-cell': { py: 0.25 },
  '& .MuiDataGrid-columnHeader': { py: 0.75 },
  '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(69,127,121,0.03)' },
  '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(69,127,121,0.06)' },
  '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(69,127,121,0.10) !important' },
  '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(69,127,121,0.14) !important' },
  '& .row-overdue': { bgcolor: 'rgba(239,68,68,0.04) !important' },
  '& .row-overdue:hover': { bgcolor: 'rgba(239,68,68,0.08) !important' },
} as const

const DW = { xs: '100%', sm: 416 } as const

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, sublabel, accent, icon: Icon }: {
  value: number | null; label: string; sublabel?: string
  accent: string
  icon: React.ElementType
}) {
  const theme = useTheme()
  return (
    <Card
      elevation={0}
      sx={{
        flex: '1 1 0', minWidth: 0,
        position: 'relative', overflow: 'hidden',
        borderRadius: 1,
        color: theme.palette.common.white,
        backgroundImage: `linear-gradient(135deg, ${alpha(accent, 0.72)} 0%, ${alpha(accent, 0.94)} 100%)`,
        border: `1px solid ${alpha(accent, 0.22)}`,
        boxShadow: `0 10px 28px ${alpha(accent, 0.22)}`,
        '&::before': {
          content: '""', position: 'absolute',
          width: 110, height: 110, borderRadius: '50%',
          right: -24, top: -22,
          backgroundColor: alpha(theme.palette.common.white, 0.13),
        },
        '&::after': {
          content: '""', position: 'absolute',
          width: 130, height: 130, borderRadius: '50%',
          right: 24, bottom: -72,
          backgroundColor: alpha(theme.palette.common.white, 0.10),
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, px: 2.5, py: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', color: alpha(theme.palette.common.white, 0.9), letterSpacing: 0.4, fontSize: 11, fontWeight: 700, textTransform: 'none', lineHeight: 1.2 }}>
              Manutenzione
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 700, lineHeight: 1.15, color: theme.palette.common.white }}>
              {label}
            </Typography>
          </Box>
          <Box sx={{ width: 40, height: 40, borderRadius: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(theme.palette.common.white, 0.16), border: `1px solid ${alpha(theme.palette.common.white, 0.22)}` }}>
            <Icon sx={{ fontSize: 22, color: theme.palette.common.white }} />
          </Box>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, letterSpacing: -1.4, color: theme.palette.common.white, textShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.12)}` }}>
          {value != null ? value.toLocaleString('it-IT') : '—'}
        </Typography>
        {sublabel && (
          <Typography variant="body2" sx={{ mt: 1.25, color: alpha(theme.palette.common.white, 0.88), fontWeight: 600 }}>
            {sublabel}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

// ─── TealDrawerHeader ─────────────────────────────────────────────────────────

function TealDrawerHeader({ title, subtitle, status, onClose, actions, children }: {
  title: string; subtitle?: string; status?: string
  onClose: () => void; actions?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <Box sx={{ background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)', px: 2.5, pt: 2.25, pb: 2.25, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
        {status ? <Chip size="small" label={status} sx={{ bgcolor: 'rgba(20,255,180,0.18)', color: '#a7f3d0', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(167,243,208,0.3)', height: 22 }} /> : <Box />}
        <Stack direction="row" spacing={0.75}>
          {actions}
          <Tooltip title="Chiudi"><IconButton aria-label="Chiudi" size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}><CloseIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>
      <Box sx={{ position: 'relative', zIndex: 1, mb: children ? 1.5 : 0 }}>
        <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.15, mb: 0.25 }}>{title}</Typography>
        {subtitle && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>{subtitle}</Typography>}
      </Box>
      {children && <Box sx={{ position: 'relative', zIndex: 1 }}>{children}</Box>}
    </Box>
  )
}

const tealBtn = { color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }
const tealDelBtn = { color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' } }

// ─── DueDateOverrideDialog ────────────────────────────────────────────────────

export function DueDateOverrideDialog({ open, row, onClose, onSaved }: {
  open: boolean
  row: TodoRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [date, setDate] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || !row) return
    // Pre-compila con l'override esistente o la data del piano
    setDate(row.due_date_override ?? row.next_due_date ?? '')
  }, [open, row])

  const hasOverride = Boolean(row?.due_date_override)
  const planDate = row?.plan_next_due_date ?? row?.next_due_date ?? ''

  const save = async () => {
    if (!row || !date) return
    setSaving(true)
    try {
      if (row.plan_inventory_id) {
        // Record pivot già esistente → PATCH
        await api.patch(`/maintenance-plan-inventories/${row.plan_inventory_id}/`, {
          due_date_override: date,
        })
      } else {
        // Record pivot non ancora esistente → POST (crea + imposta override)
        await api.post('/maintenance-plan-inventories/', {
          plan: row.plan_id,
          inventory: row.inventory_id,
          due_date_override: date,
        })
      }
      toast.success('Scadenza personalizzata salvata ✅')
      window.dispatchEvent(new CustomEvent('maintenance-due-date-changed'))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const resetOverride = async () => {
    if (!row?.plan_inventory_id) return
    setSaving(true)
    try {
      await api.post(`/maintenance-plan-inventories/${row.plan_inventory_id}/reset-override/`)
      toast.success('Scadenza ripristinata alla data del piano ✅')
      window.dispatchEvent(new CustomEvent('maintenance-due-date-changed'))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarMonthIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        Modifica scadenza
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Contesto */}
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.5, py: 1.25, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
              Inventory
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{row?.inventory_name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Piano: {row?.plan_title} · {row?.customer_name}
            </Typography>
          </Box>

          {/* Data del piano (reference) */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 110 }}>
              Data del piano
            </Typography>
            {planDate ? (() => {
              const [y, m, d] = planDate.split('-')
              return (
                <Chip
                  size="small"
                  label={`${d}/${m}/${y}`}
                  variant="outlined"
                  sx={{ fontFamily: 'ui-monospace,monospace', fontSize: '0.75rem', height: 22 }}
                />
              )
            })() : <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>}
            {hasOverride && (
              <Chip size="small" label="Override attivo" color="warning" sx={{ height: 20, fontSize: '0.68rem' }} />
            )}
          </Stack>

          {/* Input data override */}
          <TextField
            size="small"
            label="Nuova scadenza *"
            type="date"
            fullWidth
            value={date}
            InputLabelProps={{ shrink: true }}
            onChange={e => setDate(e.target.value)}
            helperText="Lascia vuoto per usare la data del piano"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: 'space-between' }}>
        {/* Reset override — visibile solo se già presente */}
        {hasOverride ? (
          <Tooltip title={`Riporta alla data del piano (${planDate ? (() => { const [y,m,d] = planDate.split('-'); return `${d}/${m}/${y}` })() : '—'})`}>
            <span>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={resetOverride}
                disabled={saving}
                startIcon={<RestartAltIcon />}
              >
                Ripristina piano
              </Button>
            </span>
          </Tooltip>
        ) : <Box />}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={saving}>Annulla</Button>
          <Button variant="contained" onClick={save} disabled={saving || !date}>
            {saving ? <><CircularProgress size={14} sx={{ mr: 1, color: 'inherit' }} />Salvataggio…</> : 'Salva'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

// ─── RapportinoDialog (exported for reuse) ────────────────────────────────────

const EVENT0: EventForm = { plan: '', inventory: '', performed_at: new Date().toISOString().slice(0, 10), result: '', tech: '', notes: '', pdf_file: null }

export function RapportinoDialog({ open, context, techs, onClose, onSaved }: {
  open: boolean; context?: RapportinoContext
  techs: { id: number; full_name: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const pdfInputRef = React.useRef<HTMLInputElement>(null)
  const pdfFileRef = React.useRef<File | null>(null)  // File stored in ref, never in React state
  const [pdfFileName, setPdfFileName] = React.useState<string | null>(null)
  const isContextual = Boolean(context)
  const [form, setForm] = React.useState<EventForm>(EVENT0)
  const ff = (p: Partial<EventForm>) => setForm(x => ({ ...x, ...p }))
  const [saving, setSaving] = React.useState(false)
  const [bulkMode, setBulkMode] = React.useState(false)
  const [freeCustomerId, setFreeCustomerId] = React.useState<number | ''>('')
  const [freeSiteId, setFreeSiteId] = React.useState<number | ''>('')
  const [freeSites, setFreeSites] = React.useState<SiteItem[]>([])
  const [freePlans, setFreePlans] = React.useState<{ id: number; title: string }[]>([])
  const [freeInventories, setFreeInventories] = React.useState<InventoryItem[]>([])
  const { rows: customers } = useDrfList<CustomerItem>('/customers/', { ordering: 'display_name', page_size: 500 })

  // Usa ref per context — evita che un cambio di referenza di context resetti il form
  // dopo che l'utente ha già iniziato a compilare (es. selezionato un PDF)
  const contextRef = React.useRef(context)
  React.useEffect(() => {
    contextRef.current = context
  })
  React.useEffect(() => {
    if (!open) return
    setBulkMode(false)
    const ctx = contextRef.current
    pdfFileRef.current = null; setPdfFileName(null)
    if (ctx) setForm({ ...EVENT0, plan: ctx.plan_id, inventory: ctx.inventory_id, performed_at: new Date().toISOString().slice(0, 10) })
    else { setForm({ ...EVENT0, performed_at: new Date().toISOString().slice(0, 10) }); setFreeCustomerId(''); setFreeSiteId('') }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!freeCustomerId) { setFreeSites([]); setFreeSiteId(''); return }
    api.get<{ results: SiteItem[] }>('/sites/', { params: { customer: freeCustomerId, ordering: 'name', page_size: 500 } }).then(r => setFreeSites(r.data.results ?? [])).catch(() => {})
  }, [freeCustomerId])

  React.useEffect(() => {
    if (!freeCustomerId) { setFreePlans([]); return }
    api.get<{ results: { id: number; title: string }[] }>('/maintenance-plans/', { params: { customer: freeCustomerId, ordering: 'title', page_size: 500, is_active: 'true' } }).then(r => setFreePlans(r.data.results ?? [])).catch(() => {})
  }, [freeCustomerId])

  React.useEffect(() => {
    if (!freeCustomerId) { setFreeInventories([]); return }
    const params: Record<string, any> = { customer: freeCustomerId, ordering: 'name', page_size: 500 }
    if (freeSiteId) params.site = freeSiteId
    api.get<{ results: InventoryItem[] }>('/inventories/', { params }).then(r => setFreeInventories(r.data.results ?? [])).catch(() => {})
  }, [freeCustomerId, freeSiteId])

  const validate = () => {
    // In multi-row context, plan/inventory come from context.rows — skip field check
    const isMulti = isContextual && Boolean(context) && (context?.rows.length ?? 0) > 1
    if (!isMulti) {
      if (!form.plan) { toast.warning('Piano richiesto.'); return false }
      if (!form.inventory) { toast.warning('Inventory richiesto.'); return false }
    }
    if (!form.performed_at) { toast.warning('Data richiesta.'); return false }
    if (!form.result) { toast.warning('Risultato richiesto.'); return false }
    if (!form.tech) { toast.warning('Tecnico richiesto.'); return false }
    return true
  }

  const buildFd = (inventoryId: number) => {
    const fd = new FormData()
    fd.append('plan', String(Number(form.plan)))
    fd.append('inventory', String(inventoryId))
    fd.append('performed_at', form.performed_at)
    fd.append('result', form.result)
    fd.append('tech', String(Number(form.tech)))
    if (form.notes.trim()) fd.append('notes', form.notes.trim())
    if (pdfFileRef.current) fd.append('pdf_file', pdfFileRef.current)
    return fd
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (bulkMode && context && context.siblingOverdue.length > 0) {
        const results = await Promise.allSettled(context.siblingOverdue.map(row => api.post('/maintenance-events/', buildFd(row.inventory_id))))
        const ok = results.filter(r => r.status === 'fulfilled').length
        const fail = results.filter(r => r.status === 'rejected').length
        if (fail === 0) toast.success(`${ok} rapportini creati ✅`)
        else toast.warning(`${ok} creati, ${fail} falliti`)
      } else if (isContextual && context && context.rows.length > 1) {
        // Multi-selezione: stesso form per tutti gli inventory selezionati
        const results = await Promise.allSettled(
          context.rows.map(row => {
            const fd = buildFd(row.inventory_id)
            // override plan per ogni riga (potrebbero avere piani diversi)
            fd.set('plan', String(row.plan_id))
            return api.post('/maintenance-events/', fd)
          })
        )
        const ok = results.filter(r => r.status === 'fulfilled').length
        const fail = results.filter(r => r.status === 'rejected').length
        if (fail === 0) toast.success(`${ok} rapportini creati ✅`)
        else toast.warning(`${ok} creati, ${fail} falliti`)
      } else {
        await api.post('/maintenance-events/', buildFd(Number(form.inventory)))
        toast.success('Rapportino creato ✅')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setSaving(false) }
  }

  const siblingsCount = context?.siblingOverdue.length ?? 0

  return (
    <>
      <Portal>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none', position: 'fixed', top: -9999 }}
          onChange={e => {
            const file = e.target.files?.[0] ?? null
            pdfFileRef.current = file
            setPdfFileName(file ? file.name : null)
            e.target.value = ''
          }}
        />
      </Portal>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{isContextual ? 'Carica rapportino' : 'Nuovo rapportino'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {isContextual && context && (
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.5, py: 1.25, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>
                Contesto pre-compilato {context.rows.length > 1 ? `— ${context.rows.length} inventory selezionati` : ''}
              </Typography>
              {context.rows.length === 1 ? (
                <Stack direction="row" spacing={3} flexWrap="wrap" rowGap={0.5}>
                  <Box><Typography variant="caption" sx={{ color: 'text.secondary' }}>Piano</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{context.plan_title}</Typography></Box>
                  <Box><Typography variant="caption" sx={{ color: 'text.secondary' }}>Cliente</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{context.customer_name}</Typography></Box>
                  <Box><Typography variant="caption" sx={{ color: 'text.secondary' }}>Inventory</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{context.inventory_name}</Typography></Box>
                </Stack>
              ) : (
                <Stack spacing={0.5}>
                  {context.rows.map(row => (
                    <Stack key={`${row.plan_id}-${row.inventory_id}`} direction="row" spacing={2} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 120 }} noWrap>{row.inventory_name}</Typography>
                      {row.knumber && <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'ui-monospace,monospace' }}>{row.knumber}</Typography>}
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>{row.customer_name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>{row.plan_title}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          )}
          {!isContextual && (
            <>
              <FormControl size="small" fullWidth required>
                <InputLabel>Cliente *</InputLabel>
                <Select label="Cliente *" value={freeCustomerId === '' ? '' : String(freeCustomerId)} onChange={e => { const v = e.target.value === '' ? '' : Number(e.target.value); setFreeCustomerId(v); setFreeSiteId(''); ff({ plan: '', inventory: '' }) }}>
                  <MenuItem value="">—</MenuItem>{customers.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth disabled={!freeCustomerId}>
                <InputLabel>Sito (facoltativo)</InputLabel>
                <Select label="Sito (facoltativo)" value={freeSiteId === '' ? '' : String(freeSiteId)} onChange={e => { setFreeSiteId(e.target.value === '' ? '' : Number(e.target.value)); ff({ inventory: '' }) }}>
                  <MenuItem value="">Tutti i siti</MenuItem>{freeSites.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.display_name || s.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth required disabled={!freeCustomerId}>
                <InputLabel>Piano *</InputLabel>
                <Select label="Piano *" value={form.plan === '' ? '' : String(form.plan)} onChange={e => ff({ plan: e.target.value === '' ? '' : Number(e.target.value), inventory: '' })}>
                  <MenuItem value="">—</MenuItem>{freePlans.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.title}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth required disabled={!freeCustomerId}>
                <InputLabel>Inventory *</InputLabel>
                <Select label="Inventory *" value={form.inventory === '' ? '' : String(form.inventory)} onChange={e => ff({ inventory: e.target.value === '' ? '' : Number(e.target.value) })}>
                  <MenuItem value="">—</MenuItem>{freeInventories.map(i => <MenuItem key={i.id} value={String(i.id)}>{i.name}{i.hostname ? ` · ${i.hostname}` : ''}{i.knumber ? ` · ${i.knumber}` : ''}</MenuItem>)}
                </Select>
              </FormControl>
            </>
          )}
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Data esecuzione *" type="date" fullWidth value={form.performed_at} InputLabelProps={{ shrink: true }} onChange={e => ff({ performed_at: e.target.value })} />
            <FormControl size="small" fullWidth required>
              <InputLabel>Risultato *</InputLabel>
              <Select label="Risultato *" value={form.result} onChange={e => ff({ result: e.target.value as any })}>
                <MenuItem value="">—</MenuItem><MenuItem value="ok">OK</MenuItem><MenuItem value="ko">KO</MenuItem><MenuItem value="partial">Parziale</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <FormControl size="small" fullWidth required>
            <InputLabel>Tecnico *</InputLabel>
            <Select label="Tecnico *" value={form.tech === '' ? '' : String(form.tech)} onChange={e => ff({ tech: e.target.value === '' ? '' : Number(e.target.value) })}>
              <MenuItem value="">—</MenuItem>{techs.map(t => <MenuItem key={t.id} value={String(t.id)}>{t.full_name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Note" value={form.notes} fullWidth multiline minRows={2} onChange={e => ff({ notes: e.target.value })} />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => pdfInputRef.current?.click()}
            >
              {pdfFileName ?? 'Allega PDF'}
            </Button>
            {pdfFileName && (
              <Tooltip title="Rimuovi"><IconButton aria-label="Rimuovi" size="small" onClick={() => { pdfFileRef.current = null; setPdfFileName(null); if (pdfInputRef.current) pdfInputRef.current.value = '' }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
            )}
          </Stack>
          {isContextual && siblingsCount > 1 && (
            <Box sx={{ bgcolor: bulkMode ? 'rgba(15,118,110,0.06)' : 'action.hover', borderRadius: 1.5, px: 1.5, py: 1.25, border: '1px solid', borderColor: bulkMode ? 'primary.main' : 'divider', transition: 'all 140ms ease' }}>
              <FormControlLabel
                control={<Checkbox checked={bulkMode} onChange={e => setBulkMode(e.target.checked)} size="small" color="primary" />}
                label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Applica a tutti gli inventory scaduti di questo piano{' '}<Chip size="small" label={`${siblingsCount} items`} color="primary" sx={{ height: 20, fontSize: '0.72rem', ml: 0.5 }} /></Typography>}
              />
              {bulkMode && (
                <Stack spacing={0.25} sx={{ mt: 1, pl: 3.5 }}>
                  {context!.siblingOverdue.map(row => (
                    <Typography key={row.inventory_id} variant="caption" sx={{ color: 'text.secondary' }}>· {row.inventory_name}{row.hostname ? ` (${row.hostname})` : ''}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Annulla</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? <><CircularProgress size={14} sx={{ mr: 1, color: 'inherit' }} />Salvataggio…</> : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  )
}

// ─── PlanDrawer (exported for reuse) ─────────────────────────────────────────

export function PlanDrawer({ open, planId, onClose, onEdit, onDelete, onRestore }: {
  open: boolean; planId: number | null; onClose: () => void
  onEdit?: (plan: PlanRow) => void; onDelete?: (plan: PlanRow) => void; onRestore?: (plan: PlanRow) => void
}) {
  const [detail, setDetail] = React.useState<PlanRow | null>(null)
  const [events, setEvents] = React.useState<EventRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const toast = useToast()

  React.useEffect(() => {
    if (!planId) { setDetail(null); setEvents([]); return }
    setLoading(true)
    Promise.all([
      api.get<PlanRow>(`/maintenance-plans/${planId}/`),
      api.get<{ results: EventRow[] }>('/maintenance-events/', { params: { plan: planId, ordering: '-performed_at', page_size: 200 } }),
    ]).then(([p, e]) => { setDetail(p.data); setEvents(e.data.results ?? []) })
      .catch(e => toast.error(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
  }, [planId]) // eslint-disable-line react-hooks/exhaustive-deps

  const { executedThisCycle, totalInv } = React.useMemo(() => {
    const coveredCount = detail?.covered_count ?? 0
    if (!detail?.next_due_date) return { executedThisCycle: 0, totalInv: coveredCount }

    const d = new Date(detail.next_due_date)
    const prev = new Date(d)
    if (detail.interval_unit === 'months' && detail.interval_value) prev.setMonth(prev.getMonth() - detail.interval_value)
    else if (detail.interval_unit === 'years' && detail.interval_value) prev.setFullYear(prev.getFullYear() - detail.interval_value)
    else prev.setFullYear(prev.getFullYear() - 1)

    const inCycle = events.filter(ev => {
      const evDate = new Date(ev.performed_at)
      return evDate >= prev && evDate <= d
    })

    // Inventory segnati "non previsti" nel ciclo → esclusi dal denominatore
    const notPlannedIds = new Set(
      inCycle.filter(ev => ev.result === 'not_planned').map(ev => ev.inventory)
    )
    const adjustedTotal = Math.max(0, coveredCount - notPlannedIds.size)

    // Numeratore: eventi nel ciclo escluse le not_planned
    const executed = inCycle.filter(ev => ev.result !== 'not_planned').length

    return { executedThisCycle: executed, totalInv: adjustedTotal }
  }, [detail, events])

  const coveragePct = totalInv > 0 ? Math.round((executedThisCycle / totalInv) * 100) : 0

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: DW } }}>
      <Stack sx={{ height: '100%', overflow: 'hidden' }}>
        <TealDrawerHeader
          title={detail?.title ?? (planId ? `Piano #${planId}` : 'Piano')}
          subtitle={detail ? `${detail.customer_code} — ${detail.customer_name}` : ''}
          status={detail?.is_active ? '● Attivo' : detail?.deleted_at ? '● Eliminato' : '● Non attivo'}
          onClose={onClose}
          actions={<>
            {detail?.deleted_at ? (
              onRestore && <Can perm={PERMS.maintenance.plan.change}><Tooltip title="Ripristina"><span><IconButton aria-label="Ripristina" size="small" onClick={() => detail && onRestore(detail)} sx={tealBtn}><RestoreFromTrashIcon fontSize="small" /></IconButton></span></Tooltip></Can>
            ) : (<>
              {onEdit && <Can perm={PERMS.maintenance.plan.change}><Tooltip title="Modifica"><span><IconButton aria-label="Modifica" size="small" onClick={() => detail && onEdit(detail)} disabled={!detail} sx={tealBtn}><EditIcon fontSize="small" /></IconButton></span></Tooltip></Can>}
              {onDelete && <Can perm={PERMS.maintenance.plan.delete}><Tooltip title="Elimina"><span><IconButton aria-label="Elimina" size="small" onClick={() => detail && onDelete(detail)} disabled={!detail} sx={tealDelBtn}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip></Can>}
            </>)}
          </>}
        >
          {detail && (
            <Stack direction="row" spacing={1}>
              {[{ label: 'Prossima scad.', value: detail.next_due_date }, { label: 'Ultima eseguita', value: detail.last_done_date ?? '—' }, { label: 'Cadenza', value: formatSchedule(detail) }].map(s => (
                <Box key={s.label} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block' }}>{s.label}</Typography>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.78rem' }}>{s.value}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </TealDrawerHeader>
        {loading && <LinearProgress sx={{ height: 2 }} />}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {!detail && !loading && <Typography variant="body2" sx={{ opacity: 0.6 }}>Nessun dettaglio disponibile.</Typography>}
          {detail && (
            <>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                  <BuildOutlinedIcon sx={{ fontSize: 13 }} /> Copertura inventari
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{executedThisCycle} / {totalInv} eseguiti nel ciclo corrente</Typography>
                  {totalInv > 0 && <Chip size="small" label={`${coveragePct}%`} color={coveragePct === 100 ? 'success' : coveragePct > 50 ? 'warning' : 'error'} sx={{ height: 20, fontSize: '0.7rem' }} />}
                </Stack>
                <Box sx={{ height: 6, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${coveragePct}%`, bgcolor: coveragePct === 100 ? 'success.main' : coveragePct > 50 ? 'warning.main' : 'error.main', borderRadius: 3, transition: 'width 0.4s ease' }} />
                </Box>
              </Box>
              {(detail.inventory_type_labels ?? []).length > 0 && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 130 }}>Tipi inventario</Typography>
                  <Typography variant="body2">{(detail.inventory_type_labels ?? []).join(', ')}</Typography>
                </Stack>
              )}
              {detail.notes && (
                <>
                  <Divider />
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>{detail.notes}</Typography>
                </>
              )}
              {events.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', mt: 0.5 }}>Ultimi rapportini</Typography>
                  <Stack spacing={0.75}>
                    {events.map(ev => (
                      <Box key={ev.id} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: 0.6, flexShrink: 0, bgcolor: RESULT_COLOR[ev.result] === 'success' ? 'success.main' : RESULT_COLOR[ev.result] === 'error' ? 'error.main' : 'warning.main' }} />
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              {(() => { const [ey, em, ed] = ev.performed_at.split('-'); return <Typography variant="body2" sx={{ fontWeight: 600 }}>{`${ed}/${em}/${ey}`}</Typography> })()}
                              {(ev.inventory_knumber || ev.inventory_hostname) && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'ui-monospace,monospace', fontSize: '0.7rem' }}>{ev.inventory_knumber || ev.inventory_hostname}</Typography>
                              )}
                              <Chip size="small" label={RESULT_LABEL[ev.result] ?? ev.result} color={RESULT_COLOR[ev.result] ?? 'default'} sx={{ height: 18, fontSize: '0.68rem' }} />
                              {ev.pdf_url && (
                                <Chip
                                  size="small"
                                  icon={<PictureAsPdfOutlinedIcon sx={{ fontSize: '13px !important', color: 'error.main !important' }} />}
                                  label="PDF"
                                  variant="outlined"
                                  clickable
                                  onClick={e => { e.stopPropagation(); window.open(ev.pdf_url!, '_blank', 'noopener,noreferrer') }}
                                  sx={{ height: 18, fontSize: '0.68rem', borderColor: 'error.light', color: 'error.main', cursor: 'pointer' }}
                                />
                              )}
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{ev.tech_name ?? ''}</Typography>
                          </Stack>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </>
          )}
        </Box>

      </Stack>
    </Drawer>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Maintenance() {
  const { me } = useAuth()
  const toast = useToast()
  const { exporting, exportCsv } = useExportCsv()
  const { rows: allTechs } = useDrfList<{ id: number; full_name: string }>('/techs/', { ordering: 'last_name', page_size: 500, is_active: 'true' })

  // ── URL filters ────────────────────────────────────────────────────────────
  const [customerF, setCustomerF] = useUrlNumberParam('m_customer')
  const [dueFilter, setDueFilter] = useUrlStringParam('m_due')
  const [siteF, setSiteF] = useUrlStringParam('m_site')
  const [yearFilter, setYearFilter] = useUrlStringParam('m_year')
  const [planF, setPlanF] = useUrlNumberParam('m_plan')

  // Label del piano filtrato — caricata una volta sola quando planF è valorizzato
  const [planFLabel, setPlanFLabel] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!planF) { setPlanFLabel(null); return }
    api.get<{ title: string; customer_name?: string }>(`/maintenance-plans/${planF}/`)
      .then(r => setPlanFLabel(`${r.data.title}${r.data.customer_name ? ` — ${r.data.customer_name}` : ''}`))
      .catch(() => setPlanFLabel(String(planF)))
  }, [planF]) // eslint-disable-line react-hooks/exhaustive-deps

  const { rows: customers } = useDrfList<CustomerItem>('/customers/', { ordering: 'display_name', page_size: 500 })
  const [filterSites, setFilterSites] = React.useState<SiteItem[]>([])

  React.useEffect(() => {
    if (!customerF) { setFilterSites([]); setSiteF(''); return }
    api.get<{ results: SiteItem[] }>('/sites/', { params: { customer: customerF, ordering: 'name', page_size: 500 } })
      .then(r => setFilterSites(r.data.results ?? [])).catch(() => {})
  }, [customerF]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Server grid (todo endpoint now paginated) ──────────────────────────────
  const grid = useServerGrid({
    defaultOrdering: 'next_due_date',
    allowedOrderingFields: ['next_due_date', 'customer_name'],
    defaultPageSize: 25,
  })

  const today = new Date().toISOString().slice(0, 10)
  const in30  = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

  const listParams = React.useMemo(() => {
    const p: Record<string, any> = {
      page:      grid.paginationModel.page + 1,
      page_size: grid.paginationModel.pageSize,
      ordering:  grid.ordering || 'next_due_date',
    }
    if (grid.search.trim()) p.search = grid.search.trim()
    if (customerF) p.customer = customerF
    if (siteF)     p.site     = siteF
    if (planF)     p.plan     = planF
    if (dueFilter === 'overdue')  { p.due_before = today }
    if (dueFilter === 'next30')   { p.due_from = today; p.due_to = in30 }
    const yr = yearFilter.trim()
    if (yr.length === 4 && /^\d{4}$/.test(yr)) p.year = yr
    return p
  }, [grid.paginationModel, grid.ordering, grid.search, customerF, siteF, dueFilter, yearFilter, planF, today, in30])

  const { rows: rawRows, rowCount, loading, reload: load } = useDrfList<TodoRow & { id: string }>(
    '/maintenance-plans/todo/', listParams, e => toast.error(apiErrorToMessage(e))
  )

  // Add stable string id for MUI DataGrid
  const pagedRows = React.useMemo(() =>
    rawRows.map(r => ({ ...r, id: `${r.plan_id}-${r.inventory_id}` })),
    [rawRows]
  )

  // KPI: separate lightweight request for unfiltered counts
  const [kpiCounts, setKpiCounts] = React.useState({ overdue: 0, next30: 0, total: 0 })
  React.useEffect(() => {
    // Fetch KPI counts: one lightweight request without filters, page_size=1 just to get count,
    // then fetch a full no-filter list for overdue/next30 split.
    // We reuse the same endpoint with no filters and page_size=500 for KPI accuracy.
    api.get<{ count: number; results: { next_due_date: string }[] }>(
      '/maintenance-plans/todo/', { params: { page: 1, page_size: 500 } }
    ).then(r => {
      const all = r.data.results ?? []
      const total = r.data.count ?? all.length
      setKpiCounts({
        overdue: all.filter(x => x.next_due_date < today).length,
        next30:  all.filter(x => x.next_due_date >= today && x.next_due_date <= in30).length,
        total,
      })
    }).catch(() => {})
  }, [today, in30]) // eslint-disable-line react-hooks/exhaustive-deps

  const overdueCount = kpiCounts.overdue
  const next30Count  = kpiCounts.next30

  // ── Multi-selection (manual Set — independent of MUI selectionModel) ───────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const selectedCount = selectedIds.size
  const allPageSelected = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id))
  const toggleRow = React.useCallback((id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }), [])
  const togglePage = React.useCallback(() =>
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (allPageSelected) pagedRows.forEach(r => s.delete(r.id))
      else pagedRows.forEach(r => s.add(r.id))
      return s
    }), [pagedRows, allPageSelected])
  const clearSelection = React.useCallback(() => setSelectedIds(new Set()), [])

  // Clear selection on filter/page change
  React.useEffect(() => { clearSelection() }, [listParams]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Drawer ─────────────────────────────────────────────────────────────────
  const [drawerPlanId, setDrawerPlanId] = React.useState<number | null>(null)

  // ── Rapportino dialog ──────────────────────────────────────────────────────
  const [rapportinoCtx, setRapportinoCtx] = React.useState<RapportinoContext | undefined>()
  const [rapportinoOpen, setRapportinoOpen] = React.useState(false)

  // ── Due date override dialog ───────────────────────────────────────────────
  const [overrideRow, setOverrideRow] = React.useState<TodoRow | null>(null)
  const [overrideOpen, setOverrideOpen] = React.useState(false)

  const openRapportino = React.useCallback((row: TodoRow, multiRows?: TodoRow[]) => {
    const siblingOverdue = pagedRows.filter(r => r.plan_id === row.plan_id && r.next_due_date < today)
    const rows = multiRows && multiRows.length > 1 ? multiRows : [row]
    setRapportinoCtx({ rows, plan_id: row.plan_id, plan_title: row.plan_title, inventory_id: row.inventory_id, inventory_name: row.inventory_name, customer_id: row.customer_id, customer_name: row.customer_name, siblingOverdue })
    setRapportinoOpen(true)
  }, [pagedRows, today])

  // ── Context menu ───────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = React.useState<{
    row: TodoRow; mouseX: number; mouseY: number
    snapshot: TodoRow[]
  } | null>(null)

  const handleRowContextMenu = React.useCallback((row: TodoRow, event: React.MouseEvent<HTMLElement>) => {
    // Snapshot selection at right-click time — avoids stale closure issues
    const id = `${row.plan_id}-${row.inventory_id}`
    const curSelected = Array.from(selectedIds)
    const inSel = curSelected.includes(id) && curSelected.length > 1
    const snapshot = inSel
      ? pagedRows.filter(r => curSelected.includes(`${r.plan_id}-${r.inventory_id}`))
      : [row]
    setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6, snapshot })
  }, [selectedIds, pagedRows])

  const saveNonPrevista = React.useCallback(async (row: TodoRow) => {
    try {
      await api.post('/maintenance-events/', {
        plan:         row.plan_id,
        inventory:    row.inventory_id,
        performed_at: new Date().toISOString().slice(0, 10),
        result:       'not_planned',
        tech:         null,
      })
      toast.success('Segnata come "Non prevista" ✅')
      load()
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    const targets = contextMenu.snapshot
    const isMulti = targets.length > 1
    return [
      ...(!isMulti ? [{
        key: 'open-plan',
        label: 'Apri Piano Manutenzioni',
        icon: <BuildOutlinedIcon fontSize="small" />,
        onClick: () => setDrawerPlanId(row.plan_id),
      }] : []),
      {
        key: 'rapportino',
        label: isMulti ? `Carica Rapportino (${targets.length})` : 'Carica Rapportino',
        icon: <CheckCircleOutlineIcon fontSize="small" />,
        onClick: () => openRapportino(row, targets),
      },
      {
        key: 'non-prevista',
        label: isMulti ? `Non prevista PM (${targets.length})` : 'Non prevista PM',
        icon: <BlockIcon fontSize="small" />,
        onClick: async () => {
          await Promise.allSettled(targets.map(r => saveNonPrevista(r)))
          if (isMulti) clearSelection()
        },
      },
      ...(!isMulti ? [{
        key: 'override-date',
        label: row.due_date_override ? 'Modifica scadenza ⚠️' : 'Modifica scadenza',
        icon: <CalendarMonthIcon fontSize="small" />,
        onClick: () => { setOverrideRow(row); setOverrideOpen(true) },
      }] : []),
    ]
  }, [contextMenu, openRapportino, saveNonPrevista, clearSelection])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: GridColDef<TodoRow>[] = React.useMemo(() => [
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
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Checkbox
            size="small"
            checked={selectedIds.has(`${p.row.plan_id}-${p.row.inventory_id}`)}
            onChange={() => toggleRow(`${p.row.plan_id}-${p.row.inventory_id}`)}
            onClick={e => e.stopPropagation()}
            sx={{ p: 0.5 }}
          />
        </Box>
      ),
    },
    {
      field: 'next_due_date',
      headerName: 'Scadenza',
      width: 150,
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0.5 }}>
          <DueBadge dateStr={p.value as string} />
          {p.row.due_date_override && (
            <Tooltip title={`Override attivo · piano: ${p.row.plan_next_due_date ?? '—'}`}>
              <CalendarMonthIcon sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0 }} />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'customer_name',
      headerName: 'Cliente',
      width: 180,
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.value as string}</Typography>
          {p.row.site_name && <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>{p.row.site_name}</Typography>}
        </Box>
      ),
    },
    {
      field: 'type_label',
      headerName: 'Tipo',
      width: 100,
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {p.value
            ? <Chip size="small" label={p.value as string} sx={{ fontSize: '0.72rem', height: 22 }} />
            : <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>}
        </Box>
      ),
    },
    {
      field: 'inventory_name',
      headerName: 'Inventory',
      flex: 1,
      minWidth: 140,
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" noWrap>{p.value as string}</Typography>
        </Box>
      ),
    },
    {
      field: 'knumber',
      headerName: 'KNumber',
      width: 130,
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ color: p.value ? 'text.primary' : 'text.disabled' }} noWrap>
            {(p.value as string) || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'plan_title',
      headerName: 'Piano',
      width: 210,
      renderCell: (p: GridRenderCellParams<TodoRow>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>{p.value as string}</Typography>
        </Box>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedIds, allPageSelected, toggleRow, togglePage])
  const fcnt = [customerF, dueFilter, siteF, yearFilter, planF].filter(Boolean).length

  return (
    <Stack spacing={2}>
      {/* KPI */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <StatCard value={overdueCount} label="Scaduti" sublabel={overdueCount === 1 ? 'Scadenza in ritardo' : 'Scadenze in ritardo'} accent="#ef4444" icon={WarningAmberRoundedIcon} />
        <StatCard value={next30Count} label="Prossimi 30 gg" sublabel="In scadenza a breve" accent="#f59e0b" icon={CheckCircleOutlineIcon} />
        <StatCard value={kpiCounts.total} label="Totale scadenze" sublabel="Da completare" accent="#0f766e" icon={BuildOutlinedIcon} />
      </Box>

      {/* Grid stile Customers */}
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
                onReset={fcnt > 0 ? () => { setCustomerF(''); setDueFilter(''); setSiteF(''); setPlanF('') } : undefined}
              >
                {planF && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.25, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📋 {planFLabel ?? `Piano #${planF}`}
                    </Typography>
                    <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setPlanF('')}>
                      <CloseIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    </IconButton>
                  </Box>
                )}
                <FormControl size="small" fullWidth>
                  <InputLabel>Cliente</InputLabel>
                  <Select label="Cliente" value={customerF === '' ? '' : String(customerF)} onChange={e => setCustomerF(e.target.value === '' ? '' : Number(e.target.value))}>
                    <MenuItem value="">Tutti</MenuItem>
                    {customers.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.display_name || c.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth disabled={!customerF}>
                  <InputLabel>Sito</InputLabel>
                  <Select label="Sito" value={siteF} onChange={e => setSiteF(e.target.value)}>
                    <MenuItem value="">Tutti</MenuItem>
                    {filterSites.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.display_name || s.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Scadenza</InputLabel>
                  <Select label="Scadenza" value={dueFilter} onChange={e => setDueFilter(e.target.value)}>
                    <MenuItem value="">Tutte</MenuItem>
                    <MenuItem value="overdue">Scaduti</MenuItem>
                    <MenuItem value="next30">Prossimi 30 gg</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Anno"
                  placeholder="es. 2025"
                  value={yearFilter}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setYearFilter(v)
                  }}
                  inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                  fullWidth
                />
              </FilterChip>

              <Tooltip title="Reimposta" arrow>
                <span>
                  <Button size="small" variant="contained" onClick={() => { setCustomerF(''); setDueFilter(''); setSiteF(''); setYearFilter(''); setPlanF(''); grid.reset(['m_customer', 'm_due', 'm_site', 'm_year', 'm_plan']) }} sx={compactResetButtonSx}>
                    <RestartAltIcon />
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={exporting ? 'Esportazione…' : 'Esporta CSV'} arrow>
                <span>
                  <Button size="small" variant="contained" disabled={exporting}
                    onClick={() => exportCsv({
                      url: '/maintenance-plans/todo/',
                      params: { ...(customerF ? { customer: customerF } : {}), ...(siteF ? { site: siteF } : {}) },
                      filename: 'scadenze_manutenzione',
                      columns: [
                        { label: 'Scadenza', getValue: (r: any) => r.next_due_date },
                        { label: 'Cliente', getValue: (r: any) => r.customer_name },
                        { label: 'Tipo', getValue: (r: any) => r.type_label },
                        { label: 'Inventory', getValue: (r: any) => r.inventory_name },
                        { label: 'KNumber', getValue: (r: any) => r.knumber },
                        { label: 'Piano', getValue: (r: any) => r.plan_title },
                      ],
                    })}
                    sx={compactExportButtonSx}>
                    <FileDownloadOutlinedIcon />
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ),
        }}
        grid={{
          pageKey: 'maintenance-todo',
          username: me?.username,
          emptyState: {
            title: 'Hai finito tutte le manutenzioni programmate! 🎉',
            subtitle: 'Nessuna scadenza in lista. Ottimo lavoro!',
          },
          rows: pagedRows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowContextMenu: handleRowContextMenu,
          getRowId: (row) => (row as any).id,
          height: 420,
          sx: {
            ...GRID_SX,
            '& .MuiDataGrid-row.row-overdue': { bgcolor: 'rgba(239,68,68,0.04) !important' },
          },
        }}
      />

      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={() => setContextMenu(null)}
        items={contextMenuItems}
      />

      <PlanDrawer
        open={Boolean(drawerPlanId)}
        planId={drawerPlanId}
        onClose={() => setDrawerPlanId(null)}
      />

      <RapportinoDialog
        open={rapportinoOpen}
        context={rapportinoCtx}
        techs={allTechs}
        onClose={() => { setRapportinoOpen(false); setRapportinoCtx(undefined) }}
        onSaved={load}
      />

      <DueDateOverrideDialog
        open={overrideOpen}
        row={overrideRow}
        onClose={() => { setOverrideOpen(false); setOverrideRow(null) }}
        onSaved={load}
      />
    </Stack>
  )
}
