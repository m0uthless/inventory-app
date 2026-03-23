import * as React from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import LanOutlinedIcon from '@mui/icons-material/LanOutlined'
import { api } from '../../api/client'
import { useToast } from '../../ui/toast'
import { apiErrorToMessage } from '../../api/error'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VpnAccess = {
  id: number
  customer: number
  applicativo: string | null
  utenza: string | null
  password: string | null
  remote_address: string | null
  porta: string | null
  note: string | null
  created_at: string | null
  updated_at: string | null
}

type VpnForm = {
  applicativo: string
  utenza: string
  password_input: string
  remote_address: string
  porta: string
  note: string
}

const emptyForm = (): VpnForm => ({
  applicativo: '',
  utenza: '',
  password_input: '',
  remote_address: '',
  porta: '',
  note: '',
})

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  customerId: number
  customerName: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string | null | undefined }) {
  const toast = useToast()
  if (!value) return null
  return (
    <Tooltip title="Copia">
      <IconButton
        size="small"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => toast.success('Copiato'))
        }}
        sx={{ p: 0.5 }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  )
}

function ReadField({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  copyable?: boolean
}) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: mono ? 'monospace' : undefined,
            fontSize: mono ? '0.78rem' : '0.875rem',
            color: value ? 'text.primary' : 'text.disabled',
            bgcolor: mono && value ? 'action.hover' : undefined,
            px: mono && value ? 0.75 : 0,
            py: mono && value ? 0.25 : 0,
            borderRadius: 0.75,
            border: mono && value ? '0.5px solid' : undefined,
            borderColor: 'divider',
          }}
        >
          {value || '—'}
        </Typography>
        {copyable && <CopyButton value={value} />}
      </Box>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VpnModal({ open, onClose, customerId, customerName }: Props) {
  const toast = useToast()
  const { hasPerm } = useAuth()

  const canViewSecrets = hasPerm(PERMS.crm.vpn.view_secrets)
  const canChange = hasPerm(PERMS.crm.vpn.change)
  const canDelete = hasPerm(PERMS.crm.vpn.delete)

  // ── State ──
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [vpn, setVpn] = React.useState<VpnAccess | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [mode, setMode] = React.useState<'view' | 'edit'>('view')
  const [form, setForm] = React.useState<VpnForm>(emptyForm())
  const [showPassword, setShowPassword] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  // ── Fetch on open ──
  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setNotFound(false)
    setVpn(null)
    setMode('view')
    setConfirmDelete(false)

    api
      .get<VpnAccess>(`/customers/${customerId}/vpn/`)
      .then((r) => {
        setVpn(r.data)
        setNotFound(false)
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setNotFound(true)
          // Switch directly to create form
          setForm(emptyForm())
          setMode('edit')
        } else {
          toast.error(apiErrorToMessage(err))
          onClose()
        }
      })
      .finally(() => setLoading(false))
  }, [open, customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Populate form when entering edit ──
  const enterEdit = () => {
    setForm({
      applicativo: vpn?.applicativo ?? '',
      utenza: vpn?.utenza ?? '',
      password_input: '',
      remote_address: vpn?.remote_address ?? '',
      porta: vpn?.porta ?? '',
      note: vpn?.note ?? '',
    })
    setShowPassword(false)
    setMode('edit')
  }

  // ── Save (create or update) ──
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        applicativo: form.applicativo,
        utenza: form.utenza,
        remote_address: form.remote_address,
        porta: form.porta,
        note: form.note,
      }
      if (form.password_input) payload.password_input = form.password_input

      let updated: VpnAccess
      if (notFound || !vpn) {
        const res = await api.post<VpnAccess>(`/customers/${customerId}/vpn/`, payload)
        updated = res.data
        setNotFound(false)
      } else {
        const res = await api.patch<VpnAccess>(`/customers/${customerId}/vpn/`, payload)
        updated = res.data
      }
      setVpn(updated)
      setMode('view')
      toast.success('Accesso VPN salvato')
    } catch (err) {
      toast.error(apiErrorToMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/customers/${customerId}/vpn/`)
      toast.success('Accesso VPN eliminato')
      onClose()
    } catch (err) {
      toast.error(apiErrorToMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──
  const title = notFound ? 'Configura accesso VPN' : 'Accesso VPN'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5,
            bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LanOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {customerName}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : mode === 'view' && vpn ? (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <ReadField label="Applicativo" value={vpn.applicativo} />
              <ReadField label="Utenza" value={vpn.utenza} mono copyable />
            </Box>

            {/* Password row */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
                Password
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                {canViewSecrets && vpn.password ? (
                  <>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace', fontSize: '0.78rem',
                        bgcolor: 'action.hover', px: 0.75, py: 0.25,
                        borderRadius: 0.75, border: '0.5px solid', borderColor: 'divider',
                        letterSpacing: showPassword ? undefined : '3px',
                      }}
                    >
                      {showPassword ? vpn.password : '••••••••'}
                    </Typography>
                    <Tooltip title={showPassword ? 'Nascondi' : 'Mostra'}>
                      <IconButton size="small" sx={{ p: 0.5 }} onClick={() => setShowPassword((p) => !p)}>
                        {showPassword ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                    {showPassword && <CopyButton value={vpn.password} />}
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: vpn.password ? 'text.secondary' : 'text.disabled', letterSpacing: vpn.password ? '3px' : undefined, fontSize: '0.75rem' }}>
                    {vpn.password ? '••••••••' : '—'}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2 }}>
              <ReadField label="Remote Address" value={vpn.remote_address} mono copyable />
              <ReadField label="Porta" value={vpn.porta} mono />
            </Box>
            <ReadField label="Note" value={vpn.note} />
          </Stack>
        ) : mode === 'edit' ? (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Applicativo"
                value={form.applicativo}
                onChange={(e) => setForm((f) => ({ ...f, applicativo: e.target.value }))}
                size="small"
                fullWidth
                placeholder="es. FortiClient, AnyConnect…"
              />
              <TextField
                label="Utenza"
                value={form.utenza}
                onChange={(e) => setForm((f) => ({ ...f, utenza: e.target.value }))}
                size="small"
                fullWidth
                inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
              />
            </Box>

            <TextField
              label={notFound ? 'Password' : 'Nuova password (lascia vuoto per non cambiare)'}
              value={form.password_input}
              onChange={(e) => setForm((f) => ({ ...f, password_input: e.target.value }))}
              size="small"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" edge="end" onClick={() => setShowPassword((p) => !p)}>
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, alignItems: 'start' }}>
              <TextField
                label="Remote Address"
                value={form.remote_address}
                onChange={(e) => setForm((f) => ({ ...f, remote_address: e.target.value }))}
                size="small"
                fullWidth
                inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                placeholder="hostname o indirizzo IP"
              />
              <TextField
                label="Porta"
                value={form.porta}
                onChange={(e) => setForm((f) => ({ ...f, porta: e.target.value }))}
                size="small"
                sx={{ width: 100 }}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                placeholder="443"
              />
            </Box>

            <TextField
              label="Note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="Note aggiuntive…"
            />
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        {/* Delete confirm inline */}
        {confirmDelete ? (
          <>
            <Typography variant="body2" sx={{ color: 'error.main', flex: 1, fontSize: '0.8rem' }}>
              Confermi l&apos;eliminazione?
            </Typography>
            <Button size="small" onClick={() => setConfirmDelete(false)}>
              Annulla
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <CircularProgress size={14} color="inherit" /> : 'Elimina'}
            </Button>
          </>
        ) : mode === 'view' && vpn ? (
          <>
            {canDelete && (
              <Button size="small" color="error" onClick={() => setConfirmDelete(true)} sx={{ mr: 'auto' }}>
                Elimina
              </Button>
            )}
            <Button size="small" onClick={onClose}>
              Chiudi
            </Button>
            {canChange && (
              <Button
                size="small"
                variant="contained"
                startIcon={<EditIcon fontSize="small" />}
                onClick={enterEdit}
              >
                Modifica
              </Button>
            )}
          </>
        ) : mode === 'edit' ? (
          <>
            <Button
              size="small"
              onClick={() => {
                if (notFound) {
                  onClose()
                } else {
                  setMode('view')
                }
              }}
            >
              Annulla
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? <CircularProgress size={14} color="inherit" /> : 'Salva'}
            </Button>
          </>
        ) : (
          <Button size="small" onClick={onClose}>
            Chiudi
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
