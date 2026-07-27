import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

// ─── WiFi Quick Dialog ────────────────────────────────────────────────────────

interface WifiQuickDialogProps {
  deviceId: number | null
  onClose: () => void
  onSaved: () => void
}

export default function WifiQuickDialog({ deviceId, onClose, onSaved }: WifiQuickDialogProps) {
  const toast = useToast()
  const [ip, setIp] = React.useState('')
  const [mac, setMac] = React.useState('')
  const [scad, setScad] = React.useState('')
  const [certFile, setCertFile] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const certInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (deviceId) { setIp(''); setMac(''); setScad(''); setCertFile(null); setError(null) }
  }, [deviceId])

  const handleSave = async () => {
    if (!deviceId) return
    setError(null)
    setSaving(true)
    try {
      // Prima attiva il flag wifi sul device (PATCH)
      await api.patch(`/devices/${deviceId}/`, { wifi: true })

      // Poi crea/aggiorna il record DeviceWifi via multipart
      const fd = new FormData()
      if (ip) fd.append('ip', ip)
      if (mac) fd.append('mac_address', mac)
      if (scad) fd.append('scad_certificato', scad)
      if (certFile) fd.append('certificato', certFile)

      // Prova PUT su device-wifi esistente, altrimenti POST
      try {
        await api.put(`/device-wifi/${deviceId}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } catch {
        await api.post('/device-wifi/', (() => {
          fd.append('device', String(deviceId))
          return fd
        })(), { headers: { 'Content-Type': 'multipart/form-data' } })
      }

      toast.success('Configurazione WiFi salvata.')
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
    <Dialog open={!!deviceId} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>
        Imposta WiFi
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}
          <TextField
            label="Indirizzo IP WiFi"
            size="small"
            fullWidth
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="es. 192.168.10.20"
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
          <TextField
            label="MAC Address"
            size="small"
            fullWidth
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            placeholder="es. AA:BB:CC:DD:EE:FF"
            inputProps={{ style: { fontFamily: 'monospace' }, maxLength: 17 }}
          />
          <TextField
            label="Scadenza certificato"
            size="small"
            fullWidth
            type="date"
            value={scad}
            onChange={(e) => setScad(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Certificato (.p12)
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => certInputRef.current?.click()} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {certFile ? 'Cambia file' : 'Seleziona file'}
              </Button>
              <input
                hidden
                ref={certInputRef}
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              <Typography variant="caption" sx={{ color: certFile ? 'text.secondary' : 'text.disabled', fontStyle: certFile ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {certFile ? certFile.name : 'Nessun file selezionato'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small">Annulla</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small">
          {saving && <CircularProgress size={14} sx={{ mr: 1 }} color="inherit" />}
          Salva
        </Button>
      </DialogActions>
    </Dialog>
  )
}
