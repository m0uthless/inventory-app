import * as React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'

import type { ContactForm, CustomerItem, SiteItem } from './types'

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

type ContactDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  customers: CustomerItem[]
  sites: SiteItem[]
  form: ContactForm
  onClose: () => void
  onSave: () => void
  onFormChange: React.Dispatch<React.SetStateAction<ContactForm>>
  onCustomerChange: (customer: number | '') => Promise<void>
}

export default function ContactDialog({
  open,
  mode,
  saving,
  errors,
  customers,
  sites,
  form,
  onClose,
  onSave,
  onFormChange,
  onCustomerChange,
}: ContactDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Nuovo contatto' : 'Modifica contatto'}</DialogTitle>
      <DialogContent>
        {errors._error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errors._error}
          </Typography>
        ) : null}
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <FormControl size="small" fullWidth error={Boolean(errors.customer)}>
            <InputLabel>Cliente</InputLabel>
            <Select
              label="Cliente"
              value={form.customer}
              onChange={async (e) => {
                const v = asId(e.target.value)
                onFormChange((f) => ({ ...f, customer: v, site: '' }))
                await onCustomerChange(v)
              }}
            >
              <MenuItem value="">Seleziona…</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.display_name || c.name || c.code || `Cliente #${c.id}`}
                </MenuItem>
              ))}
            </Select>
            {errors.customer ? <FormHelperText>{errors.customer}</FormHelperText> : null}
          </FormControl>

          <FormControl
            size="small"
            fullWidth
            disabled={form.customer === ''}
            error={Boolean(errors.site)}
          >
            <InputLabel>Sito</InputLabel>
            <Select
              label="Sito"
              value={form.site}
              onChange={(e) => onFormChange((f) => ({ ...f, site: asId(e.target.value) }))}
            >
              <MenuItem value="">(nessuno)</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.display_name || s.name}
                </MenuItem>
              ))}
            </Select>
            {errors.site ? <FormHelperText>{errors.site}</FormHelperText> : null}
          </FormControl>

          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => onFormChange((f) => ({ ...f, name: e.target.value }))}
            error={Boolean(errors.name)}
            helperText={errors.name || ''}
            fullWidth
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Email"
              value={form.email}
              onChange={(e) => onFormChange((f) => ({ ...f, email: e.target.value }))}
              error={Boolean(errors.email)}
              helperText={errors.email || ''}
              fullWidth
            />
            <TextField
              size="small"
              label="Telefono"
              value={form.phone}
              onChange={(e) => onFormChange((f) => ({ ...f, phone: e.target.value }))}
              error={Boolean(errors.phone)}
              helperText={errors.phone || ''}
              fullWidth
            />
          </Stack>

          <TextField
            size="small"
            label="Reparto"
            value={form.department}
            onChange={(e) => onFormChange((f) => ({ ...f, department: e.target.value }))}
            error={Boolean(errors.department)}
            helperText={errors.department || ''}
            fullWidth
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.is_primary}
                onChange={(e) => onFormChange((f) => ({ ...f, is_primary: e.target.checked }))}
              />
            }
            label="Contatto primario"
          />
          {errors.is_primary ? (
            <Typography variant="caption" color="error">
              {errors.is_primary}
            </Typography>
          ) : null}

          <TextField
            size="small"
            label="Note"
            value={form.notes}
            onChange={(e) => onFormChange((f) => ({ ...f, notes: e.target.value }))}
            error={Boolean(errors.notes)}
            helperText={errors.notes || ''}
            fullWidth
            multiline
            minRows={4}
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
