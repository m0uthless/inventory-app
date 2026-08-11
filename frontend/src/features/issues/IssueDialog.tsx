import * as React from 'react'
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import {
  PRIORITY_META,
  STATUS_META,
  WAITING_REASON_META,
  issueInventoryLabel,
  type CategoryOption,
  type CustomerOption,
  type IssueFormData,
  type IssueRow,
  type UserOption,
  type InventoryOption,
} from './types'

type SiteOption = { id: number; label: string }

type IssueDialogProps = {
  open: boolean
  editIssue: IssueRow | null
  form: IssueFormData
  saving: boolean
  errors: Record<string, string>
  customerInput: string
  customerOptions: CustomerOption[]
  customerLoading: boolean
  siteOptions: SiteOption[]
  categories: CategoryOption[]
  users: UserOption[]
  pendingInventory?: InventoryOption | null
  onClose: () => void
  onSave: () => void
  onOpenLinkInventory: () => void
  onCustomerInputChange: (value: string) => void
  onFormChange: React.Dispatch<React.SetStateAction<IssueFormData>>
}

export default function IssueDialog({
  open,
  editIssue,
  form,
  saving,
  errors,
  customerInput,
  customerOptions,
  customerLoading,
  siteOptions,
  categories,
  users,
  pendingInventory,
  onClose,
  onSave,
  onOpenLinkInventory,
  onCustomerInputChange,
  onFormChange,
}: IssueDialogProps) {
  const isClosed = editIssue?.status === 'closed'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {editIssue ? `Modifica issue #${editIssue.id}` : 'Nuova issue'}
        {editIssue ? (
          <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
            · {editIssue.customer_name}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        {isClosed && (
          <Alert severity="warning" icon={false} sx={{ mb: 2 }}>
            Questa issue è <strong>chiusa</strong> e non può essere modificata. Lo stato
            «Chiusa» viene impostato automaticamente 48 ore dopo la risoluzione.
          </Alert>
        )}
        <Stack
          spacing={2}
          sx={{
            pt: 0.5,
            ...(isClosed ? { opacity: 0.55, pointerEvents: 'none', userSelect: 'none' } : {}),
          }}
        >
          <TextField
            label="Titolo *"
            size="small"
            fullWidth
            value={form.title}
            onChange={(e) => onFormChange((f) => ({ ...f, title: e.target.value }))}
            error={Boolean(errors.title)}
            helperText={errors.title}
          />

          {form.useCustomerPlaceholder ? (
            <TextField
              label="Cliente (testo libero) *"
              size="small"
              fullWidth
              value={form.customerPlaceholder}
              onChange={(e) => onFormChange((f) => ({ ...f, customerPlaceholder: e.target.value }))}
              error={Boolean(errors.customer_placeholder || errors.customer)}
              helperText={
                errors.customer_placeholder || errors.customer ||
                'Cliente non ancora presente in anagrafica: verrà collegato in un secondo momento.'
              }
              placeholder="Nome del cliente"
            />
          ) : (
            <Autocomplete
              size="small"
              value={form.customer}
              inputValue={customerInput}
              onInputChange={(_, value) => onCustomerInputChange(value)}
              onChange={(_, value) => onFormChange((f) => ({ ...f, customer: value, site_id: '' }))}
              options={customerOptions}
              loading={customerLoading}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cliente *"
                  size="small"
                  error={Boolean(errors.customer)}
                  helperText={errors.customer}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {customerLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          <FormControlLabel
            sx={{ mt: -1, ml: 0 }}
            control={
              <Checkbox
                size="small"
                checked={form.useCustomerPlaceholder}
                onChange={(e) => {
                  const checked = e.target.checked
                  onFormChange((f) => ({
                    ...f,
                    useCustomerPlaceholder: checked,
                    // Passando al testo libero azzeriamo cliente/sito (non applicabili);
                    // tornando all'anagrafica azzeriamo il testo libero.
                    customer: checked ? null : f.customer,
                    site_id: checked ? '' : f.site_id,
                    customerPlaceholder: checked ? f.customerPlaceholder : '',
                  }))
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Cliente non presente in DB
              </Typography>
            }
          />

          {!form.useCustomerPlaceholder && siteOptions.length > 0 ? (
            <FormControl size="small" fullWidth>
              <InputLabel>Sito</InputLabel>
              <Select
                value={form.site_id}
                label="Sito"
                onChange={(e) => onFormChange((f) => ({ ...f, site_id: e.target.value as number | '' }))}
              >
                <MenuItem value="">
                  <em>Nessuno</em>
                </MenuItem>
                {siteOptions.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Priorità</InputLabel>
              <Select
                value={form.priority}
                label="Priorità"
                onChange={(e) => onFormChange((f) => ({ ...f, priority: e.target.value }))}
              >
                {Object.entries(PRIORITY_META).map(([key, value]) => (
                  <MenuItem key={key} value={key}>
                    {value.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Stato</InputLabel>
              <Select
                value={form.status}
                label="Stato"
                onChange={(e) =>
                  onFormChange((f) => ({
                    ...f,
                    status: e.target.value,
                    // La causale ha senso solo con stato "In attesa": la
                    // azzeriamo cambiando stato per evitare valori stantii
                    // che poi il backend rifiuterebbe/ignorerebbe comunque.
                    waiting_reason: e.target.value === 'waiting' ? f.waiting_reason : '',
                  }))
                }
              >
                {Object.entries(STATUS_META)
                  .filter(([key]) => key !== 'closed')
                  .map(([key, value]) => (
                    <MenuItem key={key} value={key}>
                      {value.label}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>

          {form.status === 'waiting' ? (
            <FormControl size="small" fullWidth error={Boolean(errors.waiting_reason)}>
              <InputLabel>In attesa di *</InputLabel>
              <Select
                value={form.waiting_reason}
                label="In attesa di *"
                onChange={(e) => onFormChange((f) => ({ ...f, waiting_reason: e.target.value }))}
              >
                <MenuItem value="">
                  <em>Seleziona</em>
                </MenuItem>
                {Object.entries(WAITING_REASON_META).map(([key, value]) => (
                  <MenuItem key={key} value={key}>
                    {value.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.waiting_reason ? (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {errors.waiting_reason}
                </Typography>
              ) : null}
            </FormControl>
          ) : null}

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Categoria</InputLabel>
              <Select
                value={form.category_id}
                label="Categoria"
                onChange={(e) => onFormChange((f) => ({ ...f, category_id: e.target.value as number | '' }))}
              >
                <MenuItem value="">
                  <em>Nessuna</em>
                </MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Assegnato a</InputLabel>
              <Select
                value={form.assigned_to_id}
                label="Assegnato a"
                onChange={(e) => onFormChange((f) => ({ ...f, assigned_to_id: e.target.value as number | '' }))}
              >
                <MenuItem value="">
                  <em>Nessuno</em>
                </MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Data apertura"
              size="small"
              fullWidth
              type="date"
              value={form.opened_at}
              onChange={(e) => onFormChange((f) => ({ ...f, opened_at: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              helperText="Precompilata con la data odierna, modificabile se necessario"
            />
            <TextField
              label="Scadenza"
              size="small"
              fullWidth
              type="date"
              value={form.due_date}
              onChange={(e) => onFormChange((f) => ({ ...f, due_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <TextField
            label="Caso ServiceNow"
            size="small"
            fullWidth
            value={form.servicenow_id}
            onChange={(e) => onFormChange((f) => ({ ...f, servicenow_id: e.target.value }))}
            placeholder="INC0012345"
          />

          <TextField
            label="Descrizione"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={form.description}
            onChange={(e) => onFormChange((f) => ({ ...f, description: e.target.value }))}
          />

          {editIssue ? (
            <Alert severity={editIssue.inventory ? 'info' : 'warning'}>
              {editIssue.inventory
                ? `Inventory collegato: ${issueInventoryLabel(editIssue)}`
                : 'Questa issue non è ancora collegata a un inventory.'}
            </Alert>
          ) : pendingInventory ? (
            <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
              <strong>Inventory:</strong>{' '}
              {[pendingInventory.name, pendingInventory.knumber, pendingInventory.hostname]
                .filter(Boolean)
                .join(' · ')}
            </Alert>
          ) : null}

          {errors.non_field_errors ? <Alert severity="error">{errors.non_field_errors}</Alert> : null}
          {errors.inventory ? <Alert severity="error">{errors.inventory}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {editIssue && !isClosed && !editIssue.is_customer_placeholder ? (
          <Button variant="outlined" onClick={onOpenLinkInventory} disabled={saving}>
            Collega a inventory
          </Button>
        ) : null}
        <Button variant="text" onClick={onClose} disabled={saving}>
          {editIssue ? 'Chiudi' : 'Annulla'}
        </Button>
        {!isClosed ? (
          <Button variant="contained" onClick={onSave} disabled={saving} sx={{ minWidth: 140 }}>
            {saving ? <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} /> : null}
            {editIssue ? 'Salva modifiche' : 'Crea issue'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
