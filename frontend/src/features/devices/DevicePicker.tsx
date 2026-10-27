import * as React from 'react'
import { Autocomplete, Box, Button, Stack, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
import DeviceDialog from './DeviceDialog'
import { deviceLabel, type DeviceDetail, type DeviceListItem } from './types'

type Option = { id: number; label: string }

export type DevicePickerProps = {
  /** Cliente di cui mostrare i device. `null` = nessun cliente scelto (picker disabilitato). */
  customerId: number | null
  value: number[]
  onChange: (ids: number[]) => void
  /** Mostra il pulsante "Nuovo device" (se l'utente ha `device.add_device`). */
  allowCreate?: boolean
  label?: string
  error?: boolean
  helperText?: string
  disabled?: boolean
}

/**
 * Selezione multipla dei device di un cliente (`/api/devices/?customer=`).
 * La selezione è opzionale: un contratto può non avere device collegati.
 */
export default function DevicePicker({
  customerId,
  value,
  onChange,
  allowCreate = false,
  label = 'Device collegati',
  error,
  helperText,
  disabled,
}: DevicePickerProps) {
  const toast = useToast()
  const { hasPerm } = useAuth()
  const canCreate = allowCreate && hasPerm(PERMS.device.device.add)

  const [devices, setDevices] = React.useState<Option[]>([])
  const [loading, setLoading] = React.useState(false)
  const [dlgOpen, setDlgOpen] = React.useState(false)

  React.useEffect(() => {
    if (customerId == null) {
      setDevices([])
      return
    }
    let cancelled = false
    setLoading(true)
    api
      .get('/devices/', { params: { customer: customerId, page_size: 500, ordering: 'type__name' } })
      .then((r) => {
        if (cancelled) return
        const data: unknown = r.data
        const rows = Array.isArray(data) ? data : ((data as { results?: unknown })?.results ?? [])
        setDevices((rows as DeviceListItem[]).map((d) => ({ id: d.id, label: deviceLabel(d) })))
      })
      .catch((e) => {
        if (!cancelled) toast.error(apiErrorToMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId, toast])

  const selected = React.useMemo<Option[]>(() => {
    const byId = new Map(devices.map((d) => [d.id, d]))
    return value.map((id) => byId.get(id) ?? { id, label: `Device #${id}` })
  }, [devices, value])

  const handleCreated = (d: DeviceDetail) => {
    setDlgOpen(false)
    setDevices((prev) => [...prev.filter((x) => x.id !== d.id), { id: d.id, label: deviceLabel(d) }])
    if (!value.includes(d.id)) onChange([...value, d.id])
  }

  return (
    <Stack spacing={0.75}>
      <Autocomplete
        multiple
        size="small"
        options={devices}
        value={selected}
        loading={loading}
        disabled={disabled || customerId == null}
        filterSelectedOptions
        onChange={(_, v) => onChange(v.map((o) => o.id))}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText={customerId == null ? 'Seleziona prima un cliente' : 'Nessun device per questo cliente'}
        renderInput={(p) => (
          <TextField
            {...p}
            label={label}
            placeholder={selected.length ? undefined : 'Nessun device (opzionale)'}
            error={error}
            helperText={helperText}
          />
        )}
      />
      {canCreate && customerId != null ? (
        <Box>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setDlgOpen(true)} disabled={disabled}>
            Nuovo device
          </Button>
        </Box>
      ) : null}
      {customerId != null ? (
        <DeviceDialog
          open={dlgOpen}
          customerId={customerId}
          onClose={() => setDlgOpen(false)}
          onSaved={handleCreated}
        />
      ) : null}
    </Stack>
  )
}
