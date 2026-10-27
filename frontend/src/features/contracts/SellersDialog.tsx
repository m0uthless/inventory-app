import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { api } from '@shared/api/client'
import { apiErrorToFormFeedback, apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../../auth/AuthProvider'
import type { Seller } from './types'

type UserOption = { id: number; label: string }
type RawUser = { id: number; full_name?: string; username?: string }

type SellerForm = {
  name: string
  email: string
  phone: string
  user: UserOption | null
  is_active: boolean
}

const emptyForm: SellerForm = { name: '', email: '', phone: '', user: null, is_active: true }

function listOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const results = (data as { results?: unknown } | null)?.results
  return Array.isArray(results) ? (results as T[]) : []
}

type Props = { open: boolean; onClose: () => void }

export default function SellersDialog({ open, onClose }: Props) {
  const toast = useToast()
  const { hasPerm } = useAuth()
  const canAdd = hasPerm('contracts.add_seller')
  const canChange = hasPerm('contracts.change_seller')

  const [sellers, setSellers] = React.useState<Seller[]>([])
  const [users, setUsers] = React.useState<UserOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  // null = lista; 'new' = creazione; Seller = modifica
  const [editing, setEditing] = React.useState<Seller | 'new' | null>(null)
  const [form, setForm] = React.useState<SellerForm>(emptyForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/sellers/', { params: { page_size: 200, ordering: 'name' } })
      setSellers(listOf<Seller>(r.data))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    if (!open) return
    setEditing(null)
    void load()
    api
      .get('/users/', { params: { page_size: 200 } })
      .then((r) =>
        setUsers(
          listOf<RawUser>(r.data).map((u) => ({
            id: u.id,
            label: u.full_name || u.username || String(u.id),
          })),
        ),
      )
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startEdit = (s: Seller | 'new') => {
    setErrors({})
    if (s === 'new') {
      setForm(emptyForm)
    } else {
      const u = s.user != null ? (users.find((x) => x.id === s.user) ?? { id: s.user, label: s.user_username ?? String(s.user) }) : null
      setForm({ name: s.name, email: s.email, phone: s.phone, user: u, is_active: s.is_active })
    }
    setEditing(s)
  }

  const save = async () => {
    if (saving || !editing) return
    if (!form.name.trim()) {
      setErrors({ name: 'Il nome è obbligatorio.' })
      return
    }
    setSaving(true)
    setErrors({})
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      user: form.user?.id ?? null,
      is_active: form.is_active,
    }
    try {
      if (editing === 'new') await api.post('/sellers/', payload)
      else await api.patch(`/sellers/${editing.id}/`, payload)
      toast.success('Venditore salvato.')
      setEditing(null)
      await load()
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

  const toggleActive = async (s: Seller) => {
    try {
      await api.patch(`/sellers/${s.id}/`, { is_active: !s.is_active })
      await load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {editing === null ? 'Venditori' : editing === 'new' ? 'Nuovo venditore' : 'Modifica venditore'}
      </DialogTitle>
      <DialogContent dividers>
        {editing === null ? (
          <Stack spacing={1}>
            {!loading && sellers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nessun venditore presente.
              </Typography>
            ) : null}
            {sellers.map((s) => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: s.is_active ? 1 : 0.6 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {s.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {[s.email, s.phone, s.user_username ? `utente: ${s.user_username}` : ''].filter(Boolean).join(' · ') || '—'}
                  </Typography>
                </Box>
                {!s.is_active ? <Chip size="small" label="Disattivato" /> : null}
                {canChange ? (
                  <>
                    <Tooltip title={s.is_active ? 'Disattiva' : 'Riattiva'}>
                      <Switch size="small" checked={s.is_active} onChange={() => void toggleActive(s)} />
                    </Tooltip>
                    <Tooltip title="Modifica">
                      <IconButton size="small" onClick={() => startEdit(s)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : null}
              </Box>
            ))}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              required
              size="small"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={Boolean(errors.name)}
              helperText={errors.name}
            />
            <TextField
              label="Email"
              size="small"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={Boolean(errors.email)}
              helperText={errors.email}
            />
            <TextField
              label="Telefono"
              size="small"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              error={Boolean(errors.phone)}
              helperText={errors.phone}
            />
            <Autocomplete
              size="small"
              options={users}
              value={form.user}
              onChange={(_, v) => setForm((f) => ({ ...f, user: v }))}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(p) => (
                <TextField {...p} label="Utente collegato (opzionale)" error={Boolean(errors.user)} helperText={errors.user} />
              )}
            />
            <FormControlLabel
              control={
                <Switch checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              }
              label="Attivo"
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {editing === null ? (
          <>
            {canAdd ? (
              <Button onClick={() => startEdit('new')} sx={{ mr: 'auto' }}>
                Nuovo venditore
              </Button>
            ) : null}
            <Button onClick={onClose}>Chiudi</Button>
          </>
        ) : (
          <>
            <Button onClick={() => setEditing(null)} disabled={saving}>
              Annulla
            </Button>
            <Button variant="contained" onClick={() => void save()} disabled={saving}>
              Salva
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
