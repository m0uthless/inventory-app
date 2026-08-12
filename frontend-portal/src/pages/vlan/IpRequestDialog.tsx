import * as React from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { apiGet } from '@shared/api/client'
import type { IpPoolEntry, VlanRow } from '../../api/vlanApi'
import {
  createVlanIpRequest,
  MODALITA_OPTIONS,
  type RispacsLite,
  type RequestModalita,
} from '../../api/vlanRequestApi'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RispacsRow {
  rispacs: RispacsLite | null
  etichetta: RequestModalita
}

type DeviceTypeLite   = { id: number; name: string }
type ManufacturerLite = { id: number; name: string }

export interface IpRequestDialogProps {
  entry: IpPoolEntry | null
  vlan: VlanRow | null
  customerId: number
  onClose: () => void
  onSaved: () => void
}

// ─── IpRequestDialog — richiesta nuova modalità su IP libero ─────────────────

export default function IpRequestDialog({ entry, vlan, customerId, onClose, onSaved }: IpRequestDialogProps) {
  const toast = useToast()
  const [rispacsList, setRispacsList] = React.useState<RispacsLite[]>([])
  const [rispacsRows, setRispacsRows] = React.useState<RispacsRow[]>([])
  const [modalita, setModalita] = React.useState<string>('')
  const [aetitle, setAetitle] = React.useState('')
  const [note, setNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [loadingRispacs, setLoadingRispacs] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Nuovi campi
  const [siteId, setSiteId]               = React.useState<number | ''>('')
  const [reparto, setReparto]             = React.useState('')
  const [deviceTypeId, setDeviceTypeId]   = React.useState<number | ''>('')
  const [manufacturerId, setManufacturerId] = React.useState<number | ''>('')
  const [deviceTypes, setDeviceTypes]     = React.useState<DeviceTypeLite[]>([])
  const [manufacturers, setManufacturers] = React.useState<ManufacturerLite[]>([])
  const [loadingLookups, setLoadingLookups] = React.useState(false)

  React.useEffect(() => {
    if (!entry) return
    setRispacsRows([])
    setModalita('')
    setAetitle('')
    setNote('')
    // Preimposta la sede dalla VLAN
    setSiteId(vlan?.site ?? '')
    setReparto('')
    setDeviceTypeId('')
    setManufacturerId('')
    setError(null)

    setLoadingRispacs(true)
    setLoadingLookups(true)

    apiGet<{ results: RispacsLite[] }>('/rispacs/', { params: { page_size: 200 } })
      .then((res) => setRispacsList(res.results))
      .catch(() => setRispacsList([]))
      .finally(() => setLoadingRispacs(false))

    Promise.all([
      apiGet<{ results: DeviceTypeLite[] }>('/device-types/', { params: { page_size: 200 } }),
      apiGet<{ results: ManufacturerLite[] }>('/device-manufacturers/', { params: { page_size: 200 } }),
    ])
      .then(([t, m]) => {
        setDeviceTypes(t.results)
        setManufacturers(m.results)
      })
      .catch(() => {})
      .finally(() => setLoadingLookups(false))
  }, [entry, customerId, vlan])

  const addRow = () =>
    setRispacsRows((rows) => [...rows, { rispacs: null, etichetta: 'pacs' }])

  const removeRow = (i: number) =>
    setRispacsRows((rows) => rows.filter((_, idx) => idx !== i))

  const updateRow = (i: number, patch: Partial<RispacsRow>) =>
    setRispacsRows((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const handleSave = async () => {
    if (!entry || !vlan) return
    setError(null)
    setSaving(true)
    try {
      const config = rispacsRows
        .filter((r) => r.rispacs !== null)
        .map((r) => ({ rispacs_id: r.rispacs!.id, etichetta: r.etichetta }))

      await createVlanIpRequest({
        customer: customerId,
        vlan: vlan.id,
        ip: entry.ip,
        aetitle: aetitle.trim() || null,
        modalita: modalita.trim() as RequestModalita || 'altro',
        rispacs: config.map((c) => c.rispacs_id),
        rispacs_config: config,
        site: siteId || null,
        reparto: reparto.trim() || null,
        device_type: deviceTypeId || null,
        manufacturer: manufacturerId || null,
        note: note.trim() || null,
      })
      toast.success(`Richiesta per ${entry.ip} inviata.`)
      onSaved()
    } catch (e: unknown) {
      const data = (e as { response?: { data?: unknown } })?.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.values(data as Record<string, unknown>)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .join(' ')
        setError(msgs)
      } else {
        setError(apiErrorToMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!entry} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>
        Richiesta nuova modalità
        {entry && (
          <Typography component="span" sx={{ ml: 1, fontSize: 12, color: 'text.secondary', fontWeight: 400 }}>
            IP: <strong style={{ fontFamily: 'monospace' }}>{entry.ip}</strong>
            {vlan && ` — ${vlan.name}`}
          </Typography>
        )}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

          <TextField
            label="Modalità"
            size="small"
            fullWidth
            value={modalita}
            onChange={(e) => setModalita(e.target.value as RequestModalita)}
            placeholder="es. PACS, Worklist, Altro..."
          />

          <TextField
            select
            label="Tipo Device"
            size="small"
            fullWidth
            value={deviceTypeId}
            onChange={(e) => setDeviceTypeId(Number(e.target.value) || '')}
            disabled={loadingLookups}
          >
            <MenuItem value=""><em>— Nessuno —</em></MenuItem>
            {deviceTypes.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Produttore"
            size="small"
            fullWidth
            value={manufacturerId}
            onChange={(e) => setManufacturerId(Number(e.target.value) || '')}
            disabled={loadingLookups}
          >
            <MenuItem value=""><em>— Nessuno —</em></MenuItem>
            {manufacturers.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Reparto"
            size="small"
            fullWidth
            value={reparto}
            onChange={(e) => setReparto(e.target.value)}
            placeholder="es. Radiologia"
          />

          <TextField
            label="AETitle"
            size="small"
            fullWidth
            value={aetitle}
            onChange={(e) => setAetitle(e.target.value)}
            placeholder="es. PACS_STATION_01"
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
                Sistemi RIS/PACS
              </Typography>
              <Tooltip title="Aggiungi sistema">
                <IconButton
                  size="small"
                  aria-label="Aggiungi sistema"
                  onClick={addRow}
                  disabled={loadingRispacs}
                  sx={{ bgcolor: 'rgba(26,107,181,0.08)', color: 'primary.main', '&:hover': { bgcolor: 'rgba(26,107,181,0.16)' } }}
                >
                  <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {rispacsRows.length === 0 && (
              <Typography sx={{ fontSize: 12, color: 'text.disabled', fontStyle: 'italic' }}>
                Nessun sistema aggiunto — clicca + per aggiungerne uno.
              </Typography>
            )}

            <Stack spacing={1}>
              {rispacsRows.map((row, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Autocomplete
                    size="small"
                    sx={{ flex: 2 }}
                    options={rispacsList}
                    loading={loadingRispacs}
                    value={row.rispacs}
                    getOptionLabel={(o) => `${o.name}${o.ip ? ` (${o.ip})` : ''}`}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    onChange={(_e, val) => updateRow(i, { rispacs: val })}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Cerca sistema..." />
                    )}
                    noOptionsText="Nessun sistema disponibile"
                  />
                  <TextField
                    select
                    size="small"
                    sx={{ flex: 1 }}
                    value={row.etichetta}
                    onChange={(e) => updateRow(i, { etichetta: e.target.value as RequestModalita })}
                  >
                    {MODALITA_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </TextField>
                  <IconButton size="small" aria-label="Rimuovi sistema" color="error" onClick={() => removeRow(i)}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <TextField
            label="Note"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small">Annulla</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small">
          {saving && <CircularProgress size={14} sx={{ mr: 1 }} color="inherit" />}
          Invia richiesta
        </Button>
      </DialogActions>
    </Dialog>
  )
}
