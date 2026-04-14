/**
 * MonitorFormDrawer — form create/edit monitor in DrawerShell.
 * Sostituisce il vecchio MonitorDialog (MUI Dialog).
 */
import * as React from 'react'
import {
  Box,
  Button,
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

import { DrawerShell } from '@shared/ui/DrawerShell'
import { useDrfList } from '@shared/hooks/useDrfList'
import type { MonitorRow } from '../../pages/Monitor'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type MonitorForm = {
  inventory: number | null
  produttore: string
  modello: string
  seriale: string
  stato: string
  tipo: string
  radinet: boolean
}

type InventoryOption = { id: number; name: string; site_name?: string | null }

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

const EMPTY_FORM: MonitorForm = {
  inventory:  null,
  produttore: 'Eizo',
  modello:    '',
  seriale:    '',
  stato:      'in_uso',
  tipo:       'diagnostico',
  radinet:    false,
}

// ─── Helper campo ─────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MonitorFormDrawerProps {
  open: boolean
  onClose: () => void
  onSave: (form: MonitorForm) => Promise<void>
  /** Se presente → modalità modifica, altrimenti creazione. */
  initial: MonitorRow | null
  saving: boolean
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function MonitorFormDrawer({ open, onClose, onSave, initial, saving }: MonitorFormDrawerProps) {
  const isEdit = initial !== null
  const [form, setForm] = React.useState<MonitorForm>(EMPTY_FORM)

  // Reset form all'apertura
  React.useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        inventory:  initial.inventory ?? null,
        produttore: initial.produttore,
        modello:    initial.modello ?? '',
        seriale:    initial.seriale ?? '',
        stato:      initial.stato,
        tipo:       initial.tipo,
        radinet:    initial.radinet,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, initial])

  // Lista workstation per il select
  const { rows: inventoryRows } = useDrfList<InventoryOption>(
    '/inventories/',
    React.useMemo(() => ({ page_size: 500, ordering: 'name', type_key: 'workstation' }), []),
  )

  const set = <K extends keyof MonitorForm>(k: K, v: MonitorForm[K]) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v }
      if (k === 'tipo' && v !== 'diagnostico') next.radinet = false
      return next
    })

  const isSm = { size: 'small' as const, fullWidth: true }

  const title    = isEdit ? `${initial!.produttore}${initial!.modello ? ` ${initial!.modello}` : ''}` : 'Nuovo monitor'
  const subtitle = isEdit ? (initial!.site_name ?? undefined) : undefined

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width={420}
      gradient="teal"
      title={title}
      subtitle={subtitle}
      statusLabel={isEdit ? '● Modifica' : '● Nuovo'}
    >
      <Stack spacing={1.5}>

          {/* Workstation */}
          <FormField label="Workstation (opzionale)">
            <TextField
              {...isSm}
              select
              value={form.inventory ?? ''}
              onChange={(e) => set('inventory', e.target.value === '' ? null : Number(e.target.value))}
            >
              <MenuItem value=""><em>Nessuna</em></MenuItem>
              {inventoryRows.map((inv) => (
                <MenuItem key={inv.id} value={inv.id}>
                  <Box>
                    <Typography variant="body2">{inv.name}</Typography>
                    {inv.site_name && (
                      <Typography variant="caption" color="text.secondary">{inv.site_name}</Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </FormField>

          {/* Produttore */}
          <FormField label="Produttore *">
            <TextField
              {...isSm}
              value={form.produttore}
              onChange={(e) => set('produttore', e.target.value)}
              error={!form.produttore}
              placeholder="es. Eizo"
            />
          </FormField>

          {/* Modello + Seriale */}
          <Stack direction="row" spacing={1}>
            <FormField label="Modello">
              <TextField {...isSm} value={form.modello} onChange={(e) => set('modello', e.target.value)} placeholder="es. CX271" />
            </FormField>
            <FormField label="Seriale">
              <TextField {...isSm} value={form.seriale} onChange={(e) => set('seriale', e.target.value)} inputProps={{ style: { fontFamily: 'monospace' } }} />
            </FormField>
          </Stack>

          {/* Tipo + Stato */}
          <Stack direction="row" spacing={1}>
            <FormField label="Tipo *">
              <TextField {...isSm} select value={form.tipo} onChange={(e) => set('tipo', e.target.value)} error={!form.tipo}>
                {TIPO_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </FormField>
            <FormField label="Stato *">
              <TextField {...isSm} select value={form.stato} onChange={(e) => set('stato', e.target.value)} error={!form.stato}>
                {STATO_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </FormField>
          </Stack>

          {/* Radinet */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={form.radinet}
                onChange={(e) => set('radinet', e.target.checked)}
                disabled={form.tipo !== 'diagnostico'}
              />
            }
            label={
              <Typography variant="body2" color={form.tipo !== 'diagnostico' ? 'text.disabled' : 'text.primary'}>
                Radinet
              </Typography>
            }
          />

          <Divider />

          {/* Azioni */}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="text" size="small" onClick={onClose} disabled={saving}>
              Annulla
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={() => void onSave(form)}
              disabled={saving || !form.produttore || !form.tipo || !form.stato}
            >
              {isEdit ? 'Salva modifiche' : 'Crea monitor'}
            </Button>
          </Stack>

        </Stack>
    </DrawerShell>
  )
}
