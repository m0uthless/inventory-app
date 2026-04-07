import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import CloseIcon from '@mui/icons-material/Close'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import {
  emptyDeviceForm,
  type DeviceTypeItem,
  type LookupItem,
  type ManufacturerItem,
  type NewDeviceFormState,
  type RispacsItem,
  type SiteItem,
} from './deviceForm'

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface AuslBoNewDeviceDrawerProps {
  /** Se non null, il drawer è aperto con questo form precompilato */
  initialForm: NewDeviceFormState | null
  customerId: number
  onClose: () => void
  onSaved: (deviceId: number) => void
}

export default function AuslBoNewDeviceDrawer({
  initialForm,
  customerId,
  onClose,
  onSaved,
}: AuslBoNewDeviceDrawerProps) {
  const toast = useToast()
  const open = initialForm !== null

  const [form, setForm] = React.useState<NewDeviceFormState>(emptyDeviceForm())
  const [saving, setSaving] = React.useState(false)

  // Lookup data
  const [sites,         setSites]         = React.useState<SiteItem[]>([])
  const [types,         setTypes]         = React.useState<DeviceTypeItem[]>([])
  const [statuses,      setStatuses]      = React.useState<LookupItem[]>([])
  const [manufacturers, setManufacturers] = React.useState<ManufacturerItem[]>([])
  const [rispacsList,   setRispacsList]   = React.useState<RispacsItem[]>([])
  const [loadingLookups, setLoadingLookups] = React.useState(false)

  // Quando si apre, carica i lookup e applica il form iniziale
  React.useEffect(() => {
    if (!open || !customerId) return
    setForm(initialForm!)
    setSaving(false)
    setLoadingLookups(true)

    Promise.all([
      api.get<{ results: SiteItem[] }>('/sites/', { params: { customer: customerId, page_size: 200 } }),
      api.get<{ results: DeviceTypeItem[] }>('/device-types/', { params: { page_size: 200 } }),
      api.get<{ results: LookupItem[] }>('/device-statuses/', { params: { page_size: 200 } }),
      api.get<{ results: ManufacturerItem[] }>('/device-manufacturers/', { params: { page_size: 200 } }),
      api.get<{ results: RispacsItem[] }>('/rispacs/', { params: { page_size: 200 } }),
    ])
      .then(([s, t, st, m, r]) => {
        setSites(s.data.results)
        setTypes(t.data.results)
        setStatuses(st.data.results)
        setManufacturers(m.data.results)
        setRispacsList(r.data.results)
        // Precompila "In Uso" come status di default se non già impostato
        const inUso = st.data.results.find(
          (s) => s.name.toLowerCase().trim() === 'in uso'
        )
        if (inUso) {
          setForm((f) => ({ ...f, status: f.status || inUso.id }))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLookups(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])

  const set = (k: keyof NewDeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const setSelect = (k: keyof NewDeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) || '' }))
  const setBool = (k: keyof NewDeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }))

  const selectedRispacs = rispacsList.filter((r) => (form.rispacs_ids ?? []).includes(r.id))

  const isSm = { size: 'small' as const, fullWidth: true }

  const handleSave = async () => {
    if (!customerId) return
    setSaving(true)
    try {
      const payload = {
        customer:      customerId,
        site:          form.site         || undefined,
        type:          form.type         || undefined,
        status:        form.status       || undefined,
        manufacturer:  form.manufacturer || null,
        model:         form.model        || null,
        serial_number: form.serial_number || null,
        inventario:    form.inventario   || null,
        reparto:       form.reparto      || null,
        room:          form.room         || null,
        ip:            form.ip           || null,
        note:          form.note         || null,
        location:      form.location     || null,
        aetitle:       form.aetitle      || null,
        vlan:          form.vlan,
        wifi:          form.wifi,
        rispacs:       form.rispacs,
        dose:          form.dose,
      }

      const res = await api.post<{ id: number }>('/devices/', payload)
      const savedId = res.data.id

      // Sincronizza RIS/PACS
      if (form.rispacs && form.rispacs_ids.length > 0) {
        await Promise.all(
          form.rispacs_ids.map((rid) =>
            api.post('/device-rispacs/', { device: savedId, rispacs: rid })
          )
        )
      }

      // Sincronizza WiFi
      if (form.wifi) {
        const fd = new FormData()
        fd.append('device', String(savedId))
        if (form.wifi_ip)   fd.append('ip', form.wifi_ip)
        if (form.wifi_mac)  fd.append('mac_address', form.wifi_mac)
        if (form.wifi_scad) fd.append('scad_certificato', form.wifi_scad)
        if (form.wifi_pass) fd.append('pass_certificato', form.wifi_pass)
        if (form.wifi_cert_file) fd.append('certificato', form.wifi_cert_file)
        await api.post('/device-wifi/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }

      toast.success('Device creato con successo.')
      onSaved(savedId)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      <Stack sx={{ height: '100%', overflow: 'hidden' }}>

        {/* Hero */}
        <Box sx={{
          background: 'linear-gradient(140deg, #0B3D6B 0%, #1A6BB5 55%, #4A90D9 100%)',
          px: 2.5, pt: 2.25, pb: 2.25, position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RouterOutlinedIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }} />
              <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Nuovo Device</Typography>
            </Stack>
            <Button
              size="small"
              onClick={onClose}
              sx={{ color: 'rgba(255,255,255,0.85)', minWidth: 0, p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </Button>
          </Stack>
          <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, position: 'relative', zIndex: 1 }}>
            {form.ip && <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#93C9F8' }}>{form.ip}</span>}
            {form.ip && form.aetitle && ' — '}
            {form.aetitle && <span style={{ fontFamily: 'monospace' }}>{form.aetitle}</span>}
          </Typography>
        </Box>

        {loadingLookups && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Form body */}
        {!loadingLookups && (
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <Stack spacing={1.25} sx={{ px: 2, py: 1.75 }}>

              <FormField label="Produttore *">
                <TextField {...isSm} select value={form.manufacturer} onChange={setSelect('manufacturer')} error={!form.manufacturer}>
                  <MenuItem value=""><em>Seleziona produttore</em></MenuItem>
                  {manufacturers.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                </TextField>
              </FormField>

              <Stack direction="row" spacing={1}>
                <FormField label="Tipo *">
                  <TextField {...isSm} select value={form.type} onChange={setSelect('type')} error={!form.type}>
                    <MenuItem value=""><em>Tipo</em></MenuItem>
                    {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </TextField>
                </FormField>
                <FormField label="Stato *">
                  <TextField {...isSm} select value={form.status} onChange={setSelect('status')} error={!form.status}>
                    <MenuItem value=""><em>Stato</em></MenuItem>
                    {statuses.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </TextField>
                </FormField>
              </Stack>

              <FormField label="Modello">
                <TextField {...isSm} value={form.model} onChange={set('model')} placeholder="es. DR 600" />
              </FormField>

              <Stack direction="row" spacing={1}>
                <FormField label="Inventario">
                  <TextField {...isSm} value={form.inventario} onChange={set('inventario')} />
                </FormField>
                <FormField label="Seriale">
                  <TextField {...isSm} value={form.serial_number} onChange={set('serial_number')} />
                </FormField>
              </Stack>

              <FormField label="Sede *">
                <TextField {...isSm} select value={form.site} onChange={setSelect('site')} error={!form.site}>
                  <MenuItem value=""><em>Seleziona sede</em></MenuItem>
                  {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.display_name || s.name}</MenuItem>)}
                </TextField>
              </FormField>

              <Stack direction="row" spacing={1}>
                <FormField label="Reparto">
                  <TextField {...isSm} value={form.reparto} onChange={set('reparto')} placeholder="es. Radiologia" />
                </FormField>
                <FormField label="Sala">
                  <TextField {...isSm} value={form.room} onChange={set('room')} placeholder="es. Sala 3" />
                </FormField>
              </Stack>

              <FormField label="Indirizzo IP">
                <TextField {...isSm} value={form.ip} onChange={set('ip')} inputProps={{ style: { fontFamily: 'monospace' } }} />
              </FormField>

              <FormField label="AE Title">
                <TextField {...isSm} value={form.aetitle} onChange={set('aetitle')} inputProps={{ style: { fontFamily: 'monospace' } }} />
              </FormField>

              <FormField label="Note">
                <TextField {...isSm} multiline minRows={2} value={form.note} onChange={set('note')} />
              </FormField>

              {/* Flag */}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>Flag</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <FormControlLabel control={<Switch size="small" checked={form.vlan} onChange={setBool('vlan')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>VLAN</Typography>} />
                  <FormControlLabel control={<Switch size="small" checked={form.wifi} onChange={setBool('wifi')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>WiFi</Typography>} />
                  <FormControlLabel control={<Switch size="small" checked={form.rispacs} onChange={setBool('rispacs')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>PACS</Typography>} />
                  {types.find((t) => t.id === form.type)?.dose_sr && (
                    <FormControlLabel control={<Switch size="small" checked={form.dose} onChange={setBool('dose')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>DoseSR</Typography>} />
                  )}
                </Stack>
              </Box>

              {/* RIS/PACS */}
              {form.rispacs && (
                <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid rgba(26,107,181,0.18)', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    <MedicalServicesOutlinedIcon sx={{ fontSize: 14 }} />Sistemi RIS/PACS
                  </Typography>
                  <Autocomplete
                    multiple size="small"
                    options={rispacsList}
                    value={selectedRispacs}
                    getOptionLabel={(o) => `${o.name}${o.ip ? ` (${o.ip})` : ''}${o.aetitle ? ` — ${o.aetitle}` : ''}`}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    onChange={(_e, val) => setForm((f) => ({ ...f, rispacs_ids: val.map((v) => v.id) }))}
                    renderInput={(params) => <TextField {...params} placeholder="Cerca sistema RIS/PACS…" />}
                    renderTags={(val, getTagProps) =>
                      val.map((opt, idx) => (
                        <Chip {...getTagProps({ index: idx })} key={opt.id} label={opt.name} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      ))
                    }
                    noOptionsText="Nessun sistema trovato"
                  />
                </Box>
              )}

              {/* WiFi */}
              {form.wifi && (
                <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid rgba(26,107,181,0.18)', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    <WifiOutlinedIcon sx={{ fontSize: 14 }} />WiFi
                  </Typography>
                  <Stack spacing={1.5}>
                    <FormField label="IP WiFi">
                      <TextField {...isSm} value={form.wifi_ip} onChange={set('wifi_ip')} inputProps={{ style: { fontFamily: 'monospace' } }} />
                    </FormField>
                    <FormField label="MAC Address">
                      <TextField {...isSm} value={form.wifi_mac} onChange={set('wifi_mac')} inputProps={{ style: { fontFamily: 'monospace' }, maxLength: 17 }} />
                    </FormField>
                    <FormField label="Password certificato">
                      <TextField {...isSm} type="password" value={form.wifi_pass} onChange={set('wifi_pass')} autoComplete="new-password" />
                    </FormField>
                    <FormField label="Scadenza certificato">
                      <TextField {...isSm} type="date" value={form.wifi_scad} onChange={set('wifi_scad')} InputLabelProps={{ shrink: true }} />
                    </FormField>
                  </Stack>
                </Box>
              )}

              <Divider />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="text" size="small" onClick={onClose} disabled={saving}>
                  Annulla
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon sx={{ fontSize: 16 }} />}
                  onClick={handleSave}
                  disabled={saving || !form.manufacturer || !form.site || !form.type || !form.status}
                >
                  Salva device
                </Button>
              </Stack>

            </Stack>
          </Box>
        )}
      </Stack>
    </Drawer>
  )
}
