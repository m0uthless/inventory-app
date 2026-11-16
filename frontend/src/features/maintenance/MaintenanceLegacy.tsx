/* Dialogo «Modifica scadenza» nello stile precedente (spostato da pages/Maintenance.tsx):
   resta in uso dalle Scadenze finché non viene ridisegnato. */
import * as React from 'react'
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import type { TodoRow } from '../../pages/maintenanceTypes'

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
      toast.success('Scadenza personalizzata salvata')
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
      toast.success('Scadenza ripristinata alla data del piano')
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
