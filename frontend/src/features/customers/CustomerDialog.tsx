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
} from '@mui/material'

import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import type { CustomerForm, LookupItem } from './types'

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

type CustomerDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  errors: Record<string, string>
  statuses: LookupItem[]
  form: CustomerForm
  onClose: () => void
  onSave: () => void
  onFormChange: React.Dispatch<React.SetStateAction<CustomerForm>>
  onFieldErrorsChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export default function CustomerDialog({
  open,
  mode,
  saving,
  errors,
  statuses,
  form,
  onClose,
  onSave,
  onFormChange,
  onFieldErrorsChange,
}: CustomerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Nuovo cliente' : 'Modifica cliente'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <FormControl size="small" fullWidth error={Boolean(errors.status)}>
            <InputLabel>Stato</InputLabel>
            <Select
              label="Stato"
              value={form.status}
              onChange={(e) => onFormChange((f) => ({ ...f, status: asId(e.target.value) }))}
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
            onChange={(e) => {
              onFormChange((f) => ({ ...f, name: e.target.value }))
              onFieldErrorsChange((er) => {
                const next = { ...er }
                delete next.name
                return next
              })
            }}
            error={Boolean(errors.name)}
            helperText={errors.name || ' '}
            fullWidth
          />

          <TextField
            size="small"
            label="Nome visualizzato"
            value={form.display_name}
            onChange={(e) => {
              onFormChange((f) => ({ ...f, display_name: e.target.value }))
              onFieldErrorsChange((er) => {
                const next = { ...er }
                delete next.display_name
                return next
              })
            }}
            error={Boolean(errors.display_name)}
            helperText={errors.display_name || 'Se vuoto, verrà usato Nome.'}
            fullWidth
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="P.IVA"
              value={form.vat_number}
              onChange={(e) => {
                onFormChange((f) => ({ ...f, vat_number: e.target.value }))
                onFieldErrorsChange((er) => {
                  const next = { ...er }
                  delete next.vat_number
                  return next
                })
              }}
              error={Boolean(errors.vat_number)}
              helperText={errors.vat_number || ' '}
              fullWidth
            />
            <TextField
              size="small"
              label="Codice fiscale"
              value={form.tax_code}
              onChange={(e) => {
                onFormChange((f) => ({ ...f, tax_code: e.target.value }))
                onFieldErrorsChange((er) => {
                  const next = { ...er }
                  delete next.tax_code
                  return next
                })
              }}
              error={Boolean(errors.tax_code)}
              helperText={errors.tax_code || ' '}
              fullWidth
            />
          </Stack>

          <CustomFieldsEditor
            entity="customer"
            value={form.custom_fields}
            onChange={(v) => onFormChange((f) => ({ ...f, custom_fields: v }))}
            mode="accordion"
          />

          <TextField
            size="small"
            label="Note"
            value={form.notes}
            onChange={(e) => onFormChange((f) => ({ ...f, notes: e.target.value }))}
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
