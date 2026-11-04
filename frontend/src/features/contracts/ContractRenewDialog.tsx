import * as React from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { formatItDate } from '../purchaseorders/types'
import { proposeRenewal } from './renew'
import type { ContractDetail } from './types'

export type ContractRenewDialogProps = {
  open: boolean
  contract: ContractDetail | null
  onClose: () => void
  onRenewed: (c: ContractDetail) => void
}

/**
 * Rinnovo manuale: propone il periodo successivo (stessa durata, a partire dal
 * giorno dopo la fine attuale); alla conferma aggiorna `start_date`/`end_date`
 * del contratto con una PATCH. `auto_renew` non ha alcun effetto qui.
 */
export default function ContractRenewDialog({ open, contract, onClose, onRenewed }: ContractRenewDialogProps) {
  const toast = useToast()
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || !contract) return
    setErrors({})
    try {
      const p = proposeRenewal(contract.start_date, contract.end_date)
      setStart(p.start_date)
      setEnd(p.end_date)
    } catch {
      setStart('')
      setEnd('')
    }
  }, [open, contract])

  const confirm = async () => {
    if (!contract) return
    const clientErrors: Record<string, string> = {}
    if (!start) clientErrors.start_date = 'La data di inizio è obbligatoria.'
    if (!end) clientErrors.end_date = 'La data di fine è obbligatoria.'
    if (start && end && end < start) clientErrors.end_date = 'La data di fine non può precedere la data di inizio.'
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setSaving(true)
    try {
      const res = await api.patch<ContractDetail>(`/contracts/${contract.id}/`, { start_date: start, end_date: end })
      toast.success('Contratto rinnovato')
      onRenewed(res.data)
    } catch (e) {
      const feedback = apiErrorToFormFeedback(e)
      if (feedback.hasFieldErrors) {
        setErrors(feedback.fieldErrors)
        toast.warning(feedback.message)
      } else {
        toast.error(feedback.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rinnova contratto</DialogTitle>
      <DialogContent>
        {contract ? (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Periodo attuale: {formatItDate(contract.start_date)} – {formatItDate(contract.end_date)}
            </Typography>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              Il nuovo periodo è proposto con la stessa durata del precedente. Puoi modificarlo prima di confermare.
            </Alert>
            <TextField
              size="small"
              type="date"
              label="Nuovo inizio"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              error={!!errors.start_date}
              helperText={errors.start_date}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="Nuova fine"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              error={!!errors.end_date}
              helperText={errors.end_date}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button variant="contained" onClick={() => void confirm()} disabled={saving || !contract}>
          {saving ? 'Rinnovo…' : 'Conferma rinnovo'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
