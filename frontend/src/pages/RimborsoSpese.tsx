import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import {
  MONTH_NAMES_IT,
  STATUS_LABELS,
  formatEuro,
  type ExpenseReportRow,
  type ExpenseReportStatus,
} from '../features/expenses/expensesShared'
import { useStatusTokens } from '../theme/AppThemeProvider'

type Meta = { is_secretary: boolean; user_id: number; km_rate: string | null }

const STATUS_FILTERS: Array<{ value: ExpenseReportStatus | ''; label: string }> = [
  { value: '', label: 'Tutte' },
  { value: 'inviata', label: 'Da validare' },
  { value: 'validata', label: 'Validate' },
  { value: 'rifiutata', label: 'Rifiutate' },
  { value: 'bozza', label: 'Bozze' },
]

function nowYearMonth(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function RimborsoSpese() {
  const statusTokens = useStatusTokens()
  const toast = useToast()
  const navigate = useNavigate()

  const [meta, setMeta] = React.useState<Meta | null>(null)
  const [scope, setScope] = React.useState<'mine' | 'all'>('mine')
  const [statusFilter, setStatusFilter] = React.useState<ExpenseReportStatus | ''>('')

  const [rows, setRows] = React.useState<ExpenseReportRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createYear, setCreateYear] = React.useState(nowYearMonth().year)
  const [createMonth, setCreateMonth] = React.useState(nowYearMonth().month)
  const [creating, setCreating] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<ExpenseReportRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    api.get<Meta>('/expense-reports/meta/')
      .then((r) => setMeta(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (scope === 'mine' && meta) params.user = meta.user_id
      if (statusFilter) params.status = statusFilter
      const res = await api.get<ExpenseReportRow[]>('/expense-reports/', { params })
      setRows(res.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [scope, statusFilter, meta, toast])

  React.useEffect(() => {
    if (meta) void load()
  }, [meta, load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await api.post<ExpenseReportRow>('/expense-reports/', {
        year: createYear, month: createMonth,
      })
      toast.success('Nota spese creata.')
      setCreateOpen(false)
      navigate(`/rimborso-spese/${res.data.id}`)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/expense-reports/${deleteTarget.id}/`)
      toast.success('Nota spese eliminata.')
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  const yearOptions = React.useMemo(() => {
    const y = nowYearMonth().year
    return [y, y - 1, y - 2]
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h6" fontWeight={800}>Rimborso Spese</Typography>
          {meta?.is_secretary ? (
            <ToggleButtonGroup
              size="small" exclusive value={scope}
              onChange={(_, v) => v && setScope(v)}
            >
              <ToggleButton value="mine">Le mie note</ToggleButton>
              <ToggleButton value="all">Tutte (segreteria)</ToggleButton>
            </ToggleButtonGroup>
          ) : null}
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Nuova nota spese
        </Button>
      </Stack>

      {scope === 'all' ? (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value || 'all'}
              label={f.label}
              size="small"
              color={statusFilter === f.value ? 'primary' : 'default'}
              onClick={() => setStatusFilter(f.value)}
            />
          ))}
        </Stack>
      ) : null}

      <Card variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 6, color: 'text.secondary' }}>
            <ReceiptLongOutlinedIcon sx={{ fontSize: 40, opacity: 0.4 }} />
            <Typography variant="body2">Nessuna nota spese.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N.</TableCell>
                <TableCell>Mese</TableCell>
                {scope === 'all' ? <TableCell>Dipendente</TableCell> : null}
                <TableCell>Stato</TableCell>
                <TableCell align="right">Totale da rendere</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const colors = statusTokens.expenseReport[row.status]
                return (
                  <TableRow
                    key={row.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/rimborso-spese/${row.id}`)}
                  >
                    <TableCell>{row.number}</TableCell>
                    <TableCell>{row.month_label} {row.year}</TableCell>
                    {scope === 'all' ? <TableCell>{row.user_name}</TableCell> : null}
                    <TableCell>
                      <Chip
                        size="small" label={STATUS_LABELS[row.status]}
                        sx={{ bgcolor: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell align="right">{formatEuro(row.total_due)}</TableCell>
                    <TableCell align="right">
                      {row.status === 'bozza' && row.user === meta?.user_id ? (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nuova nota spese</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <TextField select label="Mese" fullWidth value={createMonth} onChange={(e) => setCreateMonth(Number(e.target.value))}>
              {MONTH_NAMES_IT.slice(1).map((label, idx) => (
                <MenuItem key={idx + 1} value={idx + 1}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Anno" fullWidth value={createYear} onChange={(e) => setCreateYear(Number(e.target.value))}>
              {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? <CircularProgress size={18} /> : 'Crea'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Eliminare la nota spese?"
        description={deleteTarget ? `${deleteTarget.month_label} ${deleteTarget.year} — questa azione la sposta nel cestino.` : ''}
      />
    </Box>
  )
}
