import * as React from 'react'
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { api } from '@shared/api/client'
import { apiErrorToFormFeedback } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import DevicePicker from '../devices/DevicePicker'
import {
  BILLING_FREQ_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  type BillingFrequency,
  type ContractDetail,
  type ContractStatus,
  type ContractType,
  type CustomerOption,
  type Seller,
} from './types'

type ContractForm = {
  code: string
  title: string
  customer: number | null
  contract_type: ContractType
  seller: number | null
  start_date: string
  end_date: string
  notice_days: string
  auto_renew: boolean
  total_value: string
  billing_freq: BillingFrequency
  status: ContractStatus
  devices: number[]
  notes: string
}

function emptyForm(customer: number | null): ContractForm {
  return {
    code: '',
    title: '',
    customer,
    contract_type: 'assistenza',
    seller: null,
    start_date: '',
    end_date: '',
    notice_days: '90',
    auto_renew: false,
    total_value: '',
    billing_freq: 'annuale',
    status: 'bozza',
    devices: [],
    notes: '',
  }
}

function formFromContract(c: ContractDetail): ContractForm {
  return {
    code: c.code,
    title: c.title,
    customer: c.customer,
    contract_type: c.contract_type,
    seller: c.seller,
    start_date: c.start_date,
    end_date: c.end_date,
    notice_days: String(c.notice_days ?? ''),
    auto_renew: c.auto_renew,
    total_value: c.total_value ?? '',
    billing_freq: c.billing_freq,
    status: c.status,
    devices: c.devices ?? [],
    notes: c.notes ?? '',
  }
}

export type ContractDialogProps = {
  open: boolean
  /** Contratto da modificare; `null` = creazione. */
  contract: ContractDetail | null
  /** Cliente preimpostato in creazione (es. filtro cliente attivo). */
  initialCustomer?: number | null
  customers: CustomerOption[]
  sellers: Seller[]
  /** `contracts.view_contract_value`: senza, il valore non è né mostrato né inviato. */
  canViewValue: boolean
  onClose: () => void
  onSaved: (c: ContractDetail) => void
}

export default function ContractDialog({
  open,
  contract,
  initialCustomer = null,
  customers,
  sellers,
  canViewValue,
  onClose,
  onSaved,
}: ContractDialogProps) {
  const toast = useToast()
  const mode = contract ? 'edit' : 'create'
  const [form, setForm] = React.useState<ContractForm>(() => emptyForm(initialCustomer))
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setForm(contract ? formFromContract(contract) : emptyForm(initialCustomer))
    setErrors({})
    // Reinizializza solo all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof ContractForm>(key: K, value: ContractForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const customerOptions = React.useMemo(() => {
    if (form.customer == null || customers.some((c) => c.id === form.customer)) return customers
    // Cliente del contratto non presente nella lista caricata: lo si mostra comunque.
    return [...customers, { id: form.customer, name: contract?.customer_name ?? `Cliente #${form.customer}` }]
  }, [customers, form.customer, contract])

  // Venditori attivi, più quello già assegnato anche se disattivato.
  const sellerOptions = React.useMemo(
    () => sellers.filter((s) => s.is_active || s.id === form.seller),
    [sellers, form.seller],
  )

  const customerLabel = (c: CustomerOption) => c.display_name || c.name || c.code || `#${c.id}`
  const selectedCustomer = customerOptions.find((c) => c.id === form.customer) ?? null
  const selectedSeller = sellerOptions.find((s) => s.id === form.seller) ?? null

  const save = async () => {
    const clientErrors: Record<string, string> = {}
    if (!form.code.trim()) clientErrors.code = 'Il codice è obbligatorio.'
    if (!form.title.trim()) clientErrors.title = 'Il titolo è obbligatorio.'
    if (form.customer == null) clientErrors.customer = 'Seleziona un cliente.'
    if (!form.start_date) clientErrors.start_date = 'La data di inizio è obbligatoria.'
    if (!form.end_date) clientErrors.end_date = 'La data di fine è obbligatoria.'
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      clientErrors.end_date = 'La data di fine non può precedere la data di inizio.'
    const notice = form.notice_days.trim() === '' ? 0 : Number(form.notice_days)
    if (!Number.isInteger(notice) || notice < 0) clientErrors.notice_days = 'Giorni di preavviso non validi.'
    if (canViewValue && form.total_value.trim() !== '' && !Number.isFinite(Number(form.total_value)))
      clientErrors.total_value = 'Valore non valido.'
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setErrors({})

    const payload: Record<string, unknown> = {
      code: form.code.trim(),
      title: form.title.trim(),
      customer: form.customer,
      contract_type: form.contract_type,
      seller: form.seller,
      start_date: form.start_date,
      end_date: form.end_date,
      notice_days: notice,
      auto_renew: form.auto_renew,
      billing_freq: form.billing_freq,
      status: form.status,
      // Opzionale: lista vuota = nessun device collegato.
      devices: form.devices,
      notes: form.notes.trim(),
    }
    if (canViewValue) payload.total_value = form.total_value.trim() === '' ? '0' : form.total_value.trim()

    setSaving(true)
    try {
      const res = contract
        ? await api.patch<ContractDetail>(`/contracts/${contract.id}/`, payload)
        : await api.post<ContractDetail>('/contracts/', payload)
      toast.success(contract ? 'Contratto aggiornato' : 'Contratto creato')
      onSaved(res.data)
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
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{mode === 'create' ? 'Nuovo contratto' : 'Modifica contratto'}</DialogTitle>
      <DialogContent>
        {errors._error || errors.non_field_errors ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errors._error || errors.non_field_errors}
          </Typography>
        ) : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Codice"
              required
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              error={!!errors.code}
              helperText={errors.code}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Titolo"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              error={!!errors.title}
              helperText={errors.title}
              sx={{ flex: 2 }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Autocomplete
              size="small"
              sx={{ flex: 1 }}
              options={customerOptions}
              value={selectedCustomer}
              getOptionLabel={customerLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => {
                const next = v?.id ?? null
                // I device appartengono al cliente: al cambio cliente si svuotano.
                setForm((f) => ({ ...f, customer: next, devices: next === f.customer ? f.devices : [] }))
              }}
              renderInput={(p) => (
                <TextField {...p} label="Cliente" required error={!!errors.customer} helperText={errors.customer} />
              )}
            />
            <Autocomplete
              size="small"
              sx={{ flex: 1 }}
              options={sellerOptions}
              value={selectedSeller}
              getOptionLabel={(s) => (s.is_active ? s.name : `${s.name} (non attivo)`)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => set('seller', v?.id ?? null)}
              renderInput={(p) => (
                <TextField {...p} label="Venditore" error={!!errors.seller} helperText={errors.seller} />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              size="small"
              label="Tipo"
              value={form.contract_type}
              onChange={(e) => set('contract_type', e.target.value as ContractType)}
              error={!!errors.contract_type}
              helperText={errors.contract_type}
              sx={{ flex: 1 }}
            >
              {CONTRACT_TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Stato"
              value={form.status}
              onChange={(e) => set('status', e.target.value as ContractStatus)}
              error={!!errors.status}
              helperText={errors.status}
              sx={{ flex: 1 }}
            >
              {CONTRACT_STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Fatturazione"
              value={form.billing_freq}
              onChange={(e) => set('billing_freq', e.target.value as BillingFrequency)}
              error={!!errors.billing_freq}
              helperText={errors.billing_freq}
              sx={{ flex: 1 }}
            >
              {BILLING_FREQ_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
            <TextField
              size="small"
              type="date"
              label="Inizio"
              required
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              error={!!errors.start_date}
              helperText={errors.start_date}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="date"
              label="Fine"
              required
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
              error={!!errors.end_date}
              helperText={errors.end_date}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Preavviso (giorni)"
              value={form.notice_days}
              onChange={(e) => set('notice_days', e.target.value)}
              error={!!errors.notice_days}
              helperText={errors.notice_days}
              slotProps={{ htmlInput: { min: 0, max: 3650 } }}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            {canViewValue ? (
              <TextField
                size="small"
                type="number"
                label="Valore totale"
                value={form.total_value}
                onChange={(e) => set('total_value', e.target.value)}
                error={!!errors.total_value}
                helperText={errors.total_value}
                slotProps={{
                  htmlInput: { min: 0, step: '0.01' },
                  input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
                }}
                sx={{ flex: 1 }}
              />
            ) : null}
            <FormControlLabel
              sx={{ flex: 1 }}
              control={<Checkbox checked={form.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} />}
              label="Rinnovo automatico (solo informativo)"
            />
          </Stack>

          <DevicePicker
            customerId={form.customer}
            value={form.devices}
            onChange={(ids) => set('devices', ids)}
            allowCreate
            initialOptions={contract?.devices_detail}
            label="Device collegati (opzionale)"
            error={!!errors.devices}
            helperText={errors.devices}
          />

          <TextField
            size="small"
            label="Note"
            multiline
            minRows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            error={!!errors.notes}
            helperText={errors.notes}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
