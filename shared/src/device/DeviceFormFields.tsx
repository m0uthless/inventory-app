/**
 * DeviceFormFields — form body condiviso per create/edit Device.
 *
 * Gestisce tutti i campi del DeviceFormState: dati base, flag (VLAN/WiFi/PACS/DoseSR),
 * sezione RIS/PACS (Autocomplete multi), sezione WiFi (IP, MAC, cert).
 * Nessuna dipendenza auslbo-specifica.
 *
 * Usato in:
 *  - frontend-auslbo (AuslBoNewDeviceDrawer, Device.tsx)
 *  - frontend (futuro)
 */

import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import type {
  DeviceFormState,
  DeviceTypeItem,
  LookupItem,
  ManufacturerItem,
  RispacsItem,
  SiteItem,
} from './deviceTypes'

// ─── FormField helper interno ─────────────────────────────────────────────────

function FormField({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <Box sx={flex ? { flex: 1, minWidth: 0 } : undefined}>
      <Typography
        variant="caption"
        sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DeviceFormFieldsProps {
  form: DeviceFormState
  setForm: React.Dispatch<React.SetStateAction<DeviceFormState>>
  sites: SiteItem[]
  types: DeviceTypeItem[]
  statuses: LookupItem[]
  manufacturers: ManufacturerItem[]
  rispacsList: RispacsItem[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
  showLocation?: boolean
  showWifiCertificate?: boolean
  requireModel?: boolean
  requireInventario?: boolean
  requireReparto?: boolean
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DeviceFormFields({
  form,
  setForm,
  sites,
  types,
  statuses,
  manufacturers,
  rispacsList,
  saving,
  onSave,
  onCancel,
  saveLabel = 'Salva',
  showLocation = true,
  showWifiCertificate = true,
  requireModel = false,
  requireInventario = false,
  requireReparto = false,
}: DeviceFormFieldsProps) {
  const set =
    (k: keyof DeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))
  const setSelect =
    (k: keyof DeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: Number(e.target.value) || '' }))
  const setBool =
    (k: keyof DeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.checked }))

  const selectedRispacs = rispacsList.filter((r) => (form.rispacs_ids ?? []).includes(r.id))
  const isSm = { size: 'small' as const, fullWidth: true }

  return (
    <Stack spacing={1.25}>
      <FormField label="Produttore *">
        <TextField
          {...isSm}
          select
          value={form.manufacturer}
          onChange={setSelect('manufacturer')}
          error={!form.manufacturer}
        >
          <MenuItem value=""><em>Seleziona produttore</em></MenuItem>
          {manufacturers.map((m) => (
            <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
          ))}
        </TextField>
      </FormField>

      <Stack direction="row" spacing={1}>
        <FormField label="Tipo *" flex>
          <TextField {...isSm} select value={form.type} onChange={setSelect('type')} error={!form.type}>
            <MenuItem value=""><em>Tipo</em></MenuItem>
            {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
        </FormField>
        <FormField label="Stato *" flex>
          <TextField {...isSm} select value={form.status} onChange={setSelect('status')} error={!form.status}>
            <MenuItem value=""><em>Stato</em></MenuItem>
            {statuses.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </FormField>
      </Stack>

      <FormField label={requireModel ? 'Modello *' : 'Modello'}>
        <TextField
          {...isSm}
          value={form.model}
          onChange={set('model')}
          placeholder="es. DR 600"
          error={requireModel && !form.model}
        />
      </FormField>

      <Stack direction="row" spacing={1}>
        <FormField label={requireInventario ? 'Inventario *' : 'Inventario'} flex>
          <TextField
            {...isSm}
            value={form.inventario}
            onChange={set('inventario')}
            error={requireInventario && !form.inventario}
          />
        </FormField>
        <FormField label="Seriale" flex>
          <TextField {...isSm} value={form.serial_number} onChange={set('serial_number')} />
        </FormField>
      </Stack>

      <FormField label="Sede *">
        <TextField {...isSm} select value={form.site} onChange={setSelect('site')} error={!form.site}>
          <MenuItem value=""><em>Seleziona sede</em></MenuItem>
          {sites.map((s) => (
            <MenuItem key={s.id} value={s.id}>{s.display_name || s.name}</MenuItem>
          ))}
        </TextField>
      </FormField>

      <Stack direction="row" spacing={1}>
        <FormField label={requireReparto ? 'Reparto *' : 'Reparto'} flex>
          <TextField
            {...isSm}
            value={form.reparto}
            onChange={set('reparto')}
            placeholder="es. Radiologia"
            error={requireReparto && !form.reparto}
          />
        </FormField>
        <FormField label="Sala" flex>
          <TextField {...isSm} value={form.room} onChange={set('room')} placeholder="es. Sala 3" />
        </FormField>
      </Stack>

      {showLocation ? (
        <FormField label="Posizione">
          <TextField
            {...isSm}
            value={form.location}
            onChange={set('location')}
            placeholder="es. Piano 2, Stanza 14"
          />
        </FormField>
      ) : null}

      <FormField label="Indirizzo IP">
        <TextField
          {...isSm}
          value={form.ip}
          onChange={set('ip')}
          inputProps={{ style: { fontFamily: 'monospace' } }}
        />
      </FormField>

      <FormField label="AE Title">
        <TextField
          {...isSm}
          value={form.aetitle}
          onChange={set('aetitle')}
          inputProps={{ style: { fontFamily: 'monospace' } }}
        />
      </FormField>

      <FormField label="Note">
        <TextField {...isSm} multiline minRows={2} value={form.note} onChange={set('note')} />
      </FormField>

      {/* ── Flag ────────────────────────────────────────────────────────── */}
      <Box>
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}
        >
          Flag
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <FormControlLabel
            control={<Switch size="small" checked={form.vlan} onChange={setBool('vlan')} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>VLAN</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={form.wifi} onChange={setBool('wifi')} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>WiFi</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={form.rispacs} onChange={setBool('rispacs')} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>PACS</Typography>}
          />
          {types.find((t) => t.id === form.type)?.dose_sr ? (
            <FormControlLabel
              control={<Switch size="small" checked={form.dose} onChange={setBool('dose')} />}
              label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>DoseSR</Typography>}
            />
          ) : null}
        </Stack>
      </Box>

      {/* ── RIS/PACS ────────────────────────────────────────────────────── */}
      {form.rispacs ? (
        <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid rgba(26,107,181,0.18)', borderRadius: 1, p: 1.5 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}
          >
            <MedicalServicesOutlinedIcon sx={{ fontSize: 14 }} />Sistemi RIS/PACS
          </Typography>
          <Autocomplete
            multiple
            size="small"
            options={rispacsList}
            value={selectedRispacs}
            getOptionLabel={(o) =>
              `${o.name}${o.ip ? ` (${o.ip})` : ''}${o.aetitle ? ` — ${o.aetitle}` : ''}`
            }
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, val) =>
              setForm((f) => ({ ...f, rispacs_ids: val.map((v) => v.id) }))
            }
            renderInput={(params) => (
              <TextField {...params} placeholder="Cerca sistema RIS/PACS…" />
            )}
            renderTags={(val, getTagProps) =>
              val.map((opt, idx) => (
                <Chip
                  {...getTagProps({ index: idx })}
                  key={opt.id}
                  label={opt.name}
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              ))
            }
            noOptionsText="Nessun sistema trovato"
          />
        </Box>
      ) : null}

      {/* ── WiFi ────────────────────────────────────────────────────────── */}
      {form.wifi ? (
        <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid rgba(26,107,181,0.18)', borderRadius: 1, p: 1.5 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}
          >
            <WifiOutlinedIcon sx={{ fontSize: 14 }} />WiFi
          </Typography>
          <Stack spacing={1.5}>
            <FormField label="IP WiFi">
              <TextField
                {...isSm}
                value={form.wifi_ip}
                onChange={set('wifi_ip')}
                inputProps={{ style: { fontFamily: 'monospace' } }}
              />
            </FormField>
            <FormField label="MAC Address">
              <TextField
                {...isSm}
                value={form.wifi_mac}
                onChange={set('wifi_mac')}
                inputProps={{ style: { fontFamily: 'monospace' }, maxLength: 17 }}
              />
            </FormField>
            <FormField label="Password certificato">
              <TextField
                {...isSm}
                type="password"
                value={form.wifi_pass}
                onChange={set('wifi_pass')}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Scadenza certificato">
              <TextField
                {...isSm}
                type="date"
                value={form.wifi_scad}
                onChange={set('wifi_scad')}
                InputLabelProps={{ shrink: true }}
              />
            </FormField>
            {showWifiCertificate ? (
              <FormField label="Certificato (.p12)">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    component="label"
                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {form.wifi_cert_file ? 'Cambia file' : 'Seleziona file'}
                    <input
                      hidden
                      type="file"
                      accept=".p12,.pfx"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setForm((f) => ({ ...f, wifi_cert_file: file }))
                      }}
                    />
                  </Button>
                  {form.wifi_cert_file ? (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {form.wifi_cert_file.name}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                      Nessun file selezionato
                    </Typography>
                  )}
                </Box>
              </FormField>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      <Divider />

      {/* ── Azioni ──────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="text" size="small" onClick={onCancel} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={
            saving ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <SaveOutlinedIcon sx={{ fontSize: 16 }} />
            )
          }
          onClick={onSave}
          disabled={saving || !form.manufacturer || !form.site || !form.type || !form.status}
        >
          {saveLabel}
        </Button>
      </Stack>
    </Stack>
  )
}
