import * as React from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { buildDevicePayload } from './devicePayload'
import {
  EMPTY_DEVICE_FORM,
  deviceToForm,
  type DeviceBaseForm,
  type DeviceDetail,
  type DeviceListItem,
  type DeviceLookup,
} from './types'

type SiteOption = { id: number; name?: string | null; display_name?: string | null }

function listOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const results = (data as { results?: unknown } | null)?.results
  return Array.isArray(results) ? (results as T[]) : []
}

const asId = (v: unknown): number | '' => {
  const s = String(v ?? '')
  return s === '' ? '' : Number(s)
}

export type DeviceDialogProps = {
  open: boolean
  customerId: number
  /** Se presente il dialog è in modifica (PATCH), altrimenti in creazione (POST). */
  device?: Pick<DeviceListItem, 'id'> | null
  onClose: () => void
  onSaved: (device: DeviceDetail) => void
}

/**
 * Creazione/modifica di un device da Archie — SOLO campi base
 * (vedi DEVICE_BASE_FIELDS). IP, AE Title, reparto, stanza, posizione, flag
 * VLAN/DoseSR/WiFi/RIS-PACS restano gestiti dal Portal e non vengono inviati.
 */
export default function DeviceDialog({ open, customerId, device, onClose, onSaved }: DeviceDialogProps) {
  const toast = useToast()
  const mode: 'create' | 'edit' = device ? 'edit' : 'create'
  const deviceId = device?.id ?? null

  const [form, setForm] = React.useState<DeviceBaseForm>(EMPTY_DEVICE_FORM)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const [sites, setSites] = React.useState<SiteOption[]>([])
  const [types, setTypes] = React.useState<DeviceLookup[]>([])
  const [statuses, setStatuses] = React.useState<DeviceLookup[]>([])
  const [manufacturers, setManufacturers] = React.useState<DeviceLookup[]>([])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setErrors({})
    setForm(EMPTY_DEVICE_FORM)
    setLoading(true)

    const lookups = Promise.all([
      api.get('/sites/', { params: { customer: customerId, page_size: 500, ordering: 'name' } }),
      api.get('/device-types/', { params: { page_size: 500 } }),
      api.get('/device-statuses/', { params: { page_size: 500 } }),
      api.get('/device-manufacturers/', { params: { page_size: 500 } }),
    ]).then(([s, t, st, m]) => {
      if (cancelled) return
      setSites(listOf<SiteOption>(s.data))
      setTypes(listOf<DeviceLookup>(t.data))
      setStatuses(listOf<DeviceLookup>(st.data))
      setManufacturers(listOf<DeviceLookup>(m.data))
    })

    const detail =
      deviceId != null
        ? api.get<DeviceDetail>(`/devices/${deviceId}/`).then((r) => {
            if (!cancelled) setForm(deviceToForm(r.data))
          })
        : Promise.resolve()

    Promise.all([lookups, detail])
      .catch((e) => {
        if (!cancelled) toast.error(apiErrorToMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, customerId, deviceId, toast])

  const save = async () => {
    if (saving) return
    const missing: Record<string, string> = {}
    if (form.site === '') missing.site = 'Campo obbligatorio.'
    if (form.type === '') missing.type = 'Campo obbligatorio.'
    if (form.status === '') missing.status = 'Campo obbligatorio.'
    if (Object.keys(missing).length) {
      setErrors(missing)
      return
    }

    setSaving(true)
    setErrors({})
    const payload = buildDevicePayload(form, mode, customerId)
    try {
      const res =
        mode === 'create'
          ? await api.post<DeviceDetail>('/devices/', payload)
          : await api.patch<DeviceDetail>(`/devices/${deviceId}/`, payload)
      toast.success(mode === 'create' ? 'Device creato.' : 'Device aggiornato.')
      onSaved(res.data)
    } catch (e) {
      const fb = apiErrorToFormFeedback(e)
      if (fb.hasFieldErrors) {
        setErrors(fb.fieldErrors)
        toast.warning(fb.message)
      } else {
        toast.error(fb.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof DeviceBaseForm>(key: K, value: DeviceBaseForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const selectField = (
    key: 'site' | 'type' | 'status' | 'manufacturer',
    label: string,
    options: { id: number; label: string }[],
    required: boolean,
  ) => (
    <TextField
      select
      size="small"
      fullWidth
      required={required}
      label={label}
      value={form[key]}
      onChange={(e) => set(key, asId(e.target.value))}
      error={Boolean(errors[key])}
      helperText={errors[key] || ''}
      disabled={loading}
    >
      {!required ? (
        <MenuItem value="">
          <em>Nessuno</em>
        </MenuItem>
      ) : null}
      {options.map((o) => (
        <MenuItem key={o.id} value={o.id}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  )

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Nuovo device' : 'Modifica device'}</DialogTitle>
      <DialogContent dividers>
        {errors._error || errors.non_field_errors || errors.customer ? (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {errors._error || errors.non_field_errors || errors.customer}
          </Typography>
        ) : null}
        <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
          Da Archie si gestiscono solo i dati anagrafici del device. IP, AE Title, reparto, WiFi e RIS/PACS si
          gestiscono dal Portal.
        </Alert>
        <Stack spacing={1.5}>
          {selectField(
            'site',
            'Sito',
            sites.map((s) => ({ id: s.id, label: s.display_name || s.name || `Sito #${s.id}` })),
            true,
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {selectField('type', 'Tipo', types.map((t) => ({ id: t.id, label: t.name })), true)}
            {selectField('status', 'Stato', statuses.map((t) => ({ id: t.id, label: t.name })), true)}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {selectField('manufacturer', 'Produttore', manufacturers.map((t) => ({ id: t.id, label: t.name })), false)}
            <TextField
              size="small"
              fullWidth
              label="Modello"
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
              error={Boolean(errors.model)}
              helperText={errors.model || ''}
              disabled={loading}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              fullWidth
              label="Numero seriale"
              value={form.serial_number}
              onChange={(e) => set('serial_number', e.target.value)}
              error={Boolean(errors.serial_number)}
              helperText={errors.serial_number || ''}
              disabled={loading}
            />
            <TextField
              size="small"
              fullWidth
              label="Inventario"
              value={form.inventario}
              onChange={(e) => set('inventario', e.target.value)}
              error={Boolean(errors.inventario)}
              helperText={errors.inventario || ''}
              disabled={loading}
            />
          </Stack>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            label="Note"
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            error={Boolean(errors.note)}
            helperText={errors.note || ''}
            disabled={loading}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || loading}>
          Salva
        </Button>
      </DialogActions>
    </Dialog>
  )
}
