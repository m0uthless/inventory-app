import * as React from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

import type { CustomerItem, PurchaseOrderForm } from './types'
import { computeGiornateAmount, formatEuro } from './types'

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

type PurchaseOrderDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  customers: CustomerItem[]
  form: PurchaseOrderForm
  isEditable: boolean
  onClose: () => void
  onSave: () => void
  onFormChange: React.Dispatch<React.SetStateAction<PurchaseOrderForm>>
}

export default function PurchaseOrderDialog({
  open,
  mode,
  saving,
  errors,
  customers,
  form,
  isEditable,
  onClose,
  onSave,
  onFormChange,
}: PurchaseOrderDialogProps) {
  const previewAmount = form.amount_mode === 'giornate' ? computeGiornateAmount(form.days, form.daily_rate) : form.amount

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Nuovo Purchase Order' : 'Modifica Purchase Order'}</DialogTitle>
      <DialogContent>
        {errors._error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errors._error}
          </Typography>
        ) : null}
        {!isEditable ? (
          <Alert severity="info" sx={{ mt: 1, fontSize: 13 }}>
            Descrizione e importo non sono modificabili con lo stato attuale. Riporta il Purchase Order in stato
            "Inserito" (menu contestuale in griglia) per modificarli.
          </Alert>
        ) : null}
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Data offerta"
              type="date"
              value={form.offer_date}
              onChange={(e) => onFormChange((f) => ({ ...f, offer_date: e.target.value }))}
              error={Boolean(errors.offer_date)}
              helperText={errors.offer_date || ''}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={form.kind}
                onChange={(e) => onFormChange((f) => ({ ...f, kind: e.target.value as PurchaseOrderForm['kind'] }))}
              >
                <MenuItem value="ordinario">Ordinario</MenuItem>
                <MenuItem value="extra">Extra</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <TextField
            size="small"
            label="Committente"
            value={form.client_name}
            onChange={(e) => onFormChange((f) => ({ ...f, client_name: e.target.value }))}
            error={Boolean(errors.client_name)}
            helperText={errors.client_name || 'Testo libero'}
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Cliente collegato (opzionale)</InputLabel>
            <Select
              label="Cliente collegato (opzionale)"
              value={form.customer}
              onChange={(e) => onFormChange((f) => ({ ...f, customer: asId(e.target.value) }))}
            >
              <MenuItem value="">(nessuno)</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.display_name || c.name || c.code || `Cliente #${c.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Descrizione"
            value={form.description}
            onChange={(e) => onFormChange((f) => ({ ...f, description: e.target.value }))}
            error={Boolean(errors.description)}
            helperText={errors.description || ''}
            disabled={!isEditable}
            fullWidth
            multiline
            minRows={2}
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Purchase Order"
              value={form.purchase_order}
              onChange={(e) => onFormChange((f) => ({ ...f, purchase_order: e.target.value }))}
              error={Boolean(errors.purchase_order)}
              helperText={errors.purchase_order || ''}
              fullWidth
            />
            <TextField
              size="small"
              label="N. Fattura"
              value={form.invoice_number}
              onChange={(e) => onFormChange((f) => ({ ...f, invoice_number: e.target.value }))}
              error={Boolean(errors.invoice_number)}
              helperText={errors.invoice_number || 'Vuoto = non ancora fatturato'}
              fullWidth
            />
          </Stack>

          <Stack spacing={1} sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Calcolo importo
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              disabled={!isEditable}
              value={form.amount_mode}
              onChange={(_e, value) => {
                if (!value) return
                onFormChange((f) => ({ ...f, amount_mode: value as PurchaseOrderForm['amount_mode'] }))
              }}
            >
              <ToggleButton value="fisso">Valore fisso</ToggleButton>
              <ToggleButton value="giornate">Giornate × tariffa</ToggleButton>
            </ToggleButtonGroup>

            {form.amount_mode === 'fisso' ? (
              <TextField
                size="small"
                label="Importo"
                type="number"
                value={form.amount}
                onChange={(e) => onFormChange((f) => ({ ...f, amount: e.target.value }))}
                error={Boolean(errors.amount)}
                helperText={errors.amount || ''}
                disabled={!isEditable}
                InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                fullWidth
              />
            ) : (
              <>
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    size="small"
                    label="Giornate"
                    type="number"
                    value={form.days}
                    onChange={(e) => onFormChange((f) => ({ ...f, days: e.target.value }))}
                    error={Boolean(errors.days)}
                    helperText={errors.days || ''}
                    disabled={!isEditable}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Tariffa/giorno"
                    type="number"
                    value={form.daily_rate}
                    onChange={(e) => onFormChange((f) => ({ ...f, daily_rate: e.target.value }))}
                    error={Boolean(errors.daily_rate)}
                    helperText={errors.daily_rate || ''}
                    disabled={!isEditable}
                    InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                    fullWidth
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Importo calcolato: <strong>{formatEuro(previewAmount || 0)}</strong>
                </Typography>
              </>
            )}
          </Stack>

          <TextField
            size="small"
            label="Costi sostenuti (opzionale)"
            type="number"
            value={form.costs_incurred}
            onChange={(e) => onFormChange((f) => ({ ...f, costs_incurred: e.target.value }))}
            error={Boolean(errors.costs_incurred)}
            helperText={errors.costs_incurred || ''}
            InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
            fullWidth
          />

          <TextField
            size="small"
            label="Note"
            value={form.notes}
            onChange={(e) => onFormChange((f) => ({ ...f, notes: e.target.value }))}
            error={Boolean(errors.notes)}
            helperText={errors.notes || ''}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
