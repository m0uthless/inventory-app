import * as React from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

import CustomFieldsEditor from '../../ui/CustomFieldsEditor'
import type {
  CustomerItem,
  InventoryFieldName,
  InventoryForm,
  LookupItem,
  SiteItem,
} from './types'

const asId = (v: unknown): number | '' => {
  const s = String(v)
  return s === '' ? '' : Number(s)
}

function PasswordField(props: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  helperText?: string
}) {
  const { label, value, onChange, disabled, helperText } = props
  const [show, setShow] = React.useState(false)

  return (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      disabled={disabled}
      helperText={helperText}
      type={show ? 'text' : 'password'}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={show ? 'Nascondi' : 'Mostra'}
              edge="end"
              onClick={() => setShow((s) => !s)}
              size="small"
            >
              {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}

type InventoryDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  saving: boolean
  canViewSecrets: boolean
  errors: Record<string, string | undefined>
  customers: CustomerItem[]
  sites: SiteItem[]
  statuses: LookupItem[]
  types: LookupItem[]
  form: InventoryForm
  tagInput: string
  onClose: () => void
  onSave: () => void
  onTagInputChange: (value: string) => void
  onFormChange: React.Dispatch<React.SetStateAction<InventoryForm>>
  onErrorsChange: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
  onCustomerChange: (customer: number | '') => Promise<void>
  isFieldDisabled: (field: InventoryFieldName) => boolean
  fieldHelpText: (field: InventoryFieldName) => string | undefined
}

export default function InventoryDialog({
  open,
  mode,
  saving,
  canViewSecrets,
  errors,
  customers,
  sites,
  statuses,
  types,
  form,
  tagInput,
  onClose,
  onSave,
  onTagInputChange,
  onFormChange,
  onErrorsChange,
  onCustomerChange,
  isFieldDisabled,
  fieldHelpText,
}: InventoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{mode === 'create' ? 'Nuovo inventario' : 'Modifica inventario'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <FormControl size="small" fullWidth required error={Boolean(errors.customer)}>
              <InputLabel required>Cliente</InputLabel>
              <Select
                label="Cliente"
                value={form.customer}
                onChange={async (e) => {
                  const value = asId(e.target.value)
                  onFormChange((prev) => ({ ...prev, customer: value, site: '' }))
                  onErrorsChange((prev) => ({ ...prev, customer: undefined }))
                  await onCustomerChange(value)
                }}
              >
                <MenuItem value="">Seleziona…</MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.code} — {customer.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.customer ? <FormHelperText>{errors.customer}</FormHelperText> : null}
            </FormControl>

            <FormControl size="small" fullWidth disabled={form.customer === ''}>
              <InputLabel>Sito</InputLabel>
              <Select
                label="Sito"
                value={form.site}
                onChange={(e) => onFormChange((prev) => ({ ...prev, site: asId(e.target.value) }))}
              >
                <MenuItem value="">(nessuno)</MenuItem>
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.display_name || site.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <FormControl size="small" fullWidth required error={Boolean(errors.status)}>
              <InputLabel required>Stato</InputLabel>
              <Select
                label="Stato"
                value={form.status}
                onChange={(e) => {
                  const value = asId(e.target.value)
                  onFormChange((prev) => ({ ...prev, status: value }))
                  onErrorsChange((prev) => ({ ...prev, status: undefined }))
                }}
              >
                <MenuItem value="">Seleziona…</MenuItem>
                {statuses.map((status) => (
                  <MenuItem key={status.id} value={status.id}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.status ? <FormHelperText>{errors.status}</FormHelperText> : null}
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={form.type}
                onChange={(e) => onFormChange((prev) => ({ ...prev, type: asId(e.target.value) }))}
              >
                <MenuItem value="">(nessuno)</MenuItem>
                {types.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <TextField
            size="small"
            label="Nome / Descrizione"
            required
            value={form.name}
            onChange={(e) => {
              onFormChange((prev) => ({ ...prev, name: e.target.value }))
              onErrorsChange((prev) => ({ ...prev, name: undefined }))
            }}
            error={Boolean(errors.name)}
            helperText={
              errors.name ||
              'Breve descrizione per identificare l\'apparecchio (es. "Server principale sala CED")'
            }
            fullWidth
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="K-number"
              value={form.knumber}
              onChange={(e) => {
                onFormChange((prev) => ({ ...prev, knumber: e.target.value }))
                onErrorsChange((prev) => ({ ...prev, knumber: undefined }))
              }}
              error={Boolean(errors.knumber)}
              helperText={errors.knumber ?? ' '}
              fullWidth
            />
            <TextField
              size="small"
              label="Seriale"
              value={form.serial_number}
              onChange={(e) => {
                onFormChange((prev) => ({ ...prev, serial_number: e.target.value }))
                onErrorsChange((prev) => ({ ...prev, serial_number: undefined }))
              }}
              error={Boolean(errors.serial_number)}
              helperText={errors.serial_number ?? ' '}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Hostname"
              value={form.hostname}
              onChange={(e) => onFormChange((prev) => ({ ...prev, hostname: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('hostname')}
              helperText={fieldHelpText('hostname')}
            />
            <TextField
              size="small"
              label="IP locale"
              value={form.local_ip}
              onChange={(e) => onFormChange((prev) => ({ ...prev, local_ip: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('local_ip')}
              helperText={fieldHelpText('local_ip')}
            />
            <TextField
              size="small"
              label="SRSA IP"
              value={form.srsa_ip}
              onChange={(e) => onFormChange((prev) => ({ ...prev, srsa_ip: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('srsa_ip')}
              helperText={fieldHelpText('srsa_ip')}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Utente OS"
              value={form.os_user}
              onChange={(e) => onFormChange((prev) => ({ ...prev, os_user: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('os_user')}
              helperText={fieldHelpText('os_user')}
            />
            {canViewSecrets ? (
              <PasswordField
                label="Password OS"
                value={form.os_pwd}
                onChange={(value) => onFormChange((prev) => ({ ...prev, os_pwd: value }))}
                disabled={isFieldDisabled('os_pwd')}
                helperText={fieldHelpText('os_pwd')}
              />
            ) : (
              <TextField size="small" label="Password OS" value="" fullWidth disabled helperText="Non autorizzato" />
            )}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Utente App"
              value={form.app_usr}
              onChange={(e) => onFormChange((prev) => ({ ...prev, app_usr: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('app_usr')}
              helperText={fieldHelpText('app_usr')}
            />
            {canViewSecrets ? (
              <PasswordField
                label="Password App"
                value={form.app_pwd}
                onChange={(value) => onFormChange((prev) => ({ ...prev, app_pwd: value }))}
                disabled={isFieldDisabled('app_pwd')}
                helperText={fieldHelpText('app_pwd')}
              />
            ) : (
              <TextField size="small" label="Password App" value="" fullWidth disabled helperText="Non autorizzato" />
            )}
            {canViewSecrets ? (
              <PasswordField
                label="Password VNC"
                value={form.vnc_pwd}
                onChange={(value) => onFormChange((prev) => ({ ...prev, vnc_pwd: value }))}
                disabled={isFieldDisabled('vnc_pwd')}
                helperText={fieldHelpText('vnc_pwd')}
              />
            ) : (
              <TextField size="small" label="Password VNC" value="" fullWidth disabled helperText="Non autorizzato" />
            )}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Produttore"
              value={form.manufacturer}
              onChange={(e) => onFormChange((prev) => ({ ...prev, manufacturer: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('manufacturer')}
              helperText={fieldHelpText('manufacturer')}
            />
            <TextField
              size="small"
              label="Modello"
              value={form.model}
              onChange={(e) => onFormChange((prev) => ({ ...prev, model: e.target.value }))}
              fullWidth
              disabled={isFieldDisabled('model')}
              helperText={fieldHelpText('model')}
            />
            <TextField
              size="small"
              label="Fine garanzia (YYYY-MM-DD)"
              value={form.warranty_end_date}
              onChange={(e) =>
                onFormChange((prev) => ({ ...prev, warranty_end_date: e.target.value }))
              }
              fullWidth
              disabled={isFieldDisabled('warranty_end_date')}
              helperText={fieldHelpText('warranty_end_date')}
            />
          </Stack>

          <CustomFieldsEditor
            entity="inventory"
            value={form.custom_fields}
            onChange={(value) => onFormChange((prev) => ({ ...prev, custom_fields: value }))}
            mode="accordion"
          />

          <TextField
            size="small"
            label="Note"
            value={form.notes}
            onChange={(e) => onFormChange((prev) => ({ ...prev, notes: e.target.value }))}
            fullWidth
            multiline
            minRows={4}
          />

          <Box>
            <TextField
              size="small"
              fullWidth
              label="Tag (premi Invio per aggiungere)"
              value={tagInput}
              onChange={(e) => onTagInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  e.preventDefault()
                  const tag = tagInput.trim().toLowerCase()
                  if (!form.tags.includes(tag)) {
                    onFormChange((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
                  }
                  onTagInputChange('')
                }
              }}
            />
            {form.tags.length > 0 ? (
              <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.75 }}>
                {form.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() =>
                      onFormChange((prev) => ({
                        ...prev,
                        tags: prev.tags.filter((item) => item !== tag),
                      }))
                    }
                  />
                ))}
              </Stack>
            ) : null}
          </Box>
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
