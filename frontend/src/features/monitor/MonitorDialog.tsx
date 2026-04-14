import * as React from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'

export type MonitorForm = {
  inventory: number | ''
  produttore: string
  modello: string
  seriale: string
  stato: string
  tipo: string
  radinet: boolean
}

export type InventoryOption = { id: number; name: string; site_name?: string | null }

type Props = {
  open: boolean
  onClose: () => void
  onSave: (form: MonitorForm) => Promise<void>
  initial?: Partial<MonitorForm>
  inventories: InventoryOption[]
  errors?: Record<string, string>
  loading?: boolean
  title?: string
}

const STATO_OPTIONS = [
  { value: 'in_uso',        label: 'In uso' },
  { value: 'da_installare', label: 'Da installare' },
  { value: 'guasto',        label: 'Guasto' },
  { value: 'rma',           label: 'RMA' },
]

const TIPO_OPTIONS = [
  { value: 'diagnostico',    label: 'Diagnostico' },
  { value: 'amministrativo', label: 'Amministrativo' },
]

const EMPTY: MonitorForm = {
  inventory:  '',
  produttore: 'Eizo',
  modello:    '',
  seriale:    '',
  stato:      'in_uso',
  tipo:       'diagnostico',
  radinet:    false,
}

export default function MonitorDialog({
  open, onClose, onSave, initial, inventories, errors = {}, loading = false, title,
}: Props) {
  const [form, setForm] = React.useState<MonitorForm>({ ...EMPTY, ...initial })

  React.useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial })
  }, [open, initial])

  const set = <K extends keyof MonitorForm>(k: K, v: MonitorForm[K]) =>
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // se il tipo cambia ad amministrativo, resetta radinet
      if (k === 'tipo' && v !== 'diagnostico') next.radinet = false
      return next
    })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title ?? 'Nuovo monitor'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>

          {/* Inventory — opzionale */}
          <FormControl size="small" fullWidth error={!!errors.inventory}>
            <InputLabel>Workstation (opzionale)</InputLabel>
            <Select
              label="Workstation (opzionale)"
              value={form.inventory}
              onChange={(e: SelectChangeEvent<number | ''>) =>
                set('inventory', e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <MenuItem value=""><em>Nessuna</em></MenuItem>
              {inventories.map(inv => (
                <MenuItem key={inv.id} value={inv.id}>
                  <Box>
                    <Typography variant="body2">{inv.name}</Typography>
                    {inv.site_name && (
                      <Typography variant="caption" color="text.secondary">{inv.site_name}</Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.inventory && <FormHelperText>{errors.inventory}</FormHelperText>}
          </FormControl>

          {/* Produttore */}
          <TextField
            size="small"
            label="Produttore"
            required
            value={form.produttore}
            onChange={e => set('produttore', e.target.value)}
            error={!!errors.produttore}
            helperText={errors.produttore}
            fullWidth
          />

          {/* Modello */}
          <TextField
            size="small"
            label="Modello"
            value={form.modello}
            onChange={e => set('modello', e.target.value)}
            error={!!errors.modello}
            helperText={errors.modello}
            fullWidth
          />

          {/* Seriale */}
          <TextField
            size="small"
            label="Seriale"
            value={form.seriale}
            onChange={e => set('seriale', e.target.value)}
            error={!!errors.seriale}
            helperText={errors.seriale}
            fullWidth
          />

          {/* Tipo + Stato */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth error={!!errors.tipo} required>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={e => set('tipo', e.target.value)}
              >
                {TIPO_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
              {errors.tipo && <FormHelperText>{errors.tipo}</FormHelperText>}
            </FormControl>

            <FormControl size="small" fullWidth error={!!errors.stato} required>
              <InputLabel>Stato</InputLabel>
              <Select
                label="Stato"
                value={form.stato}
                onChange={e => set('stato', e.target.value)}
              >
                {STATO_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
              {errors.stato && <FormHelperText>{errors.stato}</FormHelperText>}
            </FormControl>
          </Stack>

          {/* Radinet — sempre visibile, cliccabile solo se diagnostico */}
          <FormControlLabel
            control={
              <Switch
                checked={form.radinet}
                onChange={e => set('radinet', e.target.checked)}
                disabled={form.tipo !== 'diagnostico'}
                color="primary"
              />
            }
            label={
              <Typography
                variant="body2"
                color={form.tipo !== 'diagnostico' ? 'text.disabled' : 'text.primary'}
              >
                Radinet
              </Typography>
            }
          />
          {errors.radinet && <FormHelperText error>{errors.radinet}</FormHelperText>}

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Annulla</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={loading}>
          {loading ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
