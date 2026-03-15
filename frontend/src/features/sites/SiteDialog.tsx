import * as React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import type { CustomerItem, LookupItem, SiteForm } from './types'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  form: SiteForm
  setForm: React.Dispatch<React.SetStateAction<SiteForm>>
  customers: CustomerItem[]
  statuses: LookupItem[]
  onClose: () => void
  onSave: () => void
}

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

export default function SiteDialog(props: Props) {
  const { open, mode, saving, errors, form, setForm, customers, statuses, onClose, onSave } = props

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Nuovo sito' : 'Modifica sito'}</DialogTitle>
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
              onChange={(e) => setForm((f) => ({ ...f, customer: asId(e.target.value) }))}
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

          <FormControl size="small" fullWidth error={Boolean(errors.status)}>
            <InputLabel>Stato</InputLabel>
            <Select
              label="Stato"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: asId(e.target.value) }))}
            >
              <MenuItem value="">Seleziona…</MenuItem>
              {statuses.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
            {errors.status ? <FormHelperText>{errors.status}</FormHelperText> : null}
          </FormControl>

          <TextField
            size="small"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={Boolean(errors.name)}
            helperText={errors.name || ''}
            fullWidth
          />
          <TextField
            size="small"
            label="Nome visualizzato"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            error={Boolean(errors.display_name)}
            helperText={errors.display_name || 'Se vuoto, verrà usato Nome.'}
            fullWidth
          />

          <TextField
            size="small"
            label="Indirizzo"
            value={form.address_line1}
            onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
            error={Boolean(errors.address_line1)}
            helperText={errors.address_line1 || ''}
            fullWidth
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Città"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              error={Boolean(errors.city)}
              helperText={errors.city || ''}
              fullWidth
            />
            <TextField
              size="small"
              label="CAP"
              value={form.postal_code}
              onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              error={Boolean(errors.postal_code)}
              helperText={errors.postal_code || ''}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Provincia"
              value={form.province}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              error={Boolean(errors.province)}
              helperText={errors.province || ''}
              fullWidth
            />
            <TextField
              size="small"
              label="Paese"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              error={Boolean(errors.country)}
              helperText={errors.country || ''}
              fullWidth
            />
          </Stack>

          <CustomFieldsEditor
            entity="site"
            value={form.custom_fields}
            onChange={(v) => setForm((f) => ({ ...f, custom_fields: v }))}
            mode="accordion"
          />
          {errors.custom_fields ? (
            <Typography variant="caption" color="error">
              {errors.custom_fields}
            </Typography>
          ) : null}

          <TextField
            size="small"
            label="Note"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
