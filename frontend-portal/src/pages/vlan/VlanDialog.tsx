import * as React from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  TextField,
} from '@mui/material'

import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import {
  createVlan,
  updateVlan,
  type VlanRow,
  type VlanPayload,
} from '../../api/vlanApi'

// ─── Dialog VLAN (create / edit) ──────────────────────────────────────────────

export interface VlanDialogProps {
  open: boolean
  vlan: VlanRow | null  // null = create mode
  customerId: number
  sites: Array<{ id: number; name: string; display_name: string | null }>
  onClose: () => void
  onSaved: () => void
}

const EMPTY_FORM: VlanPayload = {
  customer: 0,
  site: 0,
  vlan_id: 0,
  name: '',
  network: '',
  subnet: '',
  gateway: '',
  lan: '',
  note: '',
}

export default function VlanDialog({ open, vlan, customerId, sites, onClose, onSaved }: VlanDialogProps) {
  const toast = useToast()
  const [form, setForm] = React.useState<VlanPayload>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      if (vlan) {
        setForm({
          customer: vlan.customer,
          site: vlan.site,
          vlan_id: vlan.vlan_id,
          name: vlan.name,
          network: vlan.network,
          subnet: vlan.subnet,
          gateway: vlan.gateway,
          lan: vlan.lan ?? '',
          note: vlan.note ?? '',
        })
      } else {
        setForm({ ...EMPTY_FORM, customer: customerId })
      }
      setErrors({})
    }
  }, [open, vlan, customerId])

  const set = (field: keyof VlanPayload, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  const handleSave = async () => {
    // Validazione base
    const errs: Record<string, string> = {}
    if (!form.site) errs.site = 'Campo obbligatorio'
    if (!form.vlan_id) errs.vlan_id = 'Campo obbligatorio'
    if (!form.name.trim()) errs.name = 'Campo obbligatorio'
    if (!form.network.trim()) errs.network = 'Campo obbligatorio'
    if (!form.subnet.trim()) errs.subnet = 'Campo obbligatorio'
    if (!form.gateway.trim()) errs.gateway = 'Campo obbligatorio'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const payload: VlanPayload = {
        ...form,
        lan: form.lan || null,
        note: form.note || null,
      }
      if (vlan) {
        await updateVlan(vlan.id, payload)
        toast.success('VLAN aggiornata.')
      } else {
        await createVlan(payload)
        toast.success('VLAN creata.')
      }
      onSaved()
    } catch (e: unknown) {
      // Provo a estrarre errori di campo dal backend
      const data = (e as { response?: { data?: unknown } })?.response?.data
      if (data && typeof data === 'object') {
        const fieldErrs: Record<string, string> = {}
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          fieldErrs[k] = Array.isArray(v) ? v[0] : String(v)
        }
        setErrors(fieldErrs)
      } else {
        toast.error(apiErrorToMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>
        {vlan ? `Modifica VLAN ${vlan.vlan_id}` : 'Nuova VLAN'}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Sede *"
              fullWidth
              size="small"
              value={form.site || ''}
              onChange={(e) => set('site', Number(e.target.value))}
              error={!!errors.site}
              helperText={errors.site}
            >
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.display_name || s.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="VLAN ID *"
              fullWidth
              size="small"
              type="number"
              value={form.vlan_id || ''}
              onChange={(e) => set('vlan_id', Number(e.target.value))}
              error={!!errors.vlan_id}
              helperText={errors.vlan_id}
              inputProps={{ min: 1, max: 4094 }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Nome / Descrizione *"
              fullWidth
              size="small"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              placeholder="Es. Radiologia Area Blu"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Network (CIDR) *"
              fullWidth
              size="small"
              value={form.network}
              onChange={(e) => set('network', e.target.value)}
              error={!!errors.network}
              helperText={errors.network || 'Es. 10.241.0.64/26'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Subnet mask *"
              fullWidth
              size="small"
              value={form.subnet}
              onChange={(e) => set('subnet', e.target.value)}
              error={!!errors.subnet}
              helperText={errors.subnet || 'Es. 255.255.255.192'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Gateway *"
              fullWidth
              size="small"
              value={form.gateway}
              onChange={(e) => set('gateway', e.target.value)}
              error={!!errors.gateway}
              helperText={errors.gateway || 'Es. 10.241.0.65'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="LAN"
              fullWidth
              size="small"
              value={form.lan ?? ''}
              onChange={(e) => set('lan', e.target.value)}
              error={!!errors.lan}
              helperText={errors.lan || 'Es. 172.26.99.0/24'}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Note"
              fullWidth
              size="small"
              multiline
              minRows={2}
              value={form.note ?? ''}
              onChange={(e) => set('note', e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small">
          Annulla
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small">
          {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          {vlan ? 'Salva modifiche' : 'Crea VLAN'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
