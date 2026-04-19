import * as React from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

import { type SxProps, type Theme } from '@mui/material/styles'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { isRecord } from '@shared/utils/guards'
import { useToast } from '@shared/ui/toast'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { useAuth, type AuslBoMe } from '../auth/AuthProvider'

// ─── Palette blu AUSL BO ──────────────────────────────────────────────────────
const BLUE       = '#1A6BB5'
const BLUE_DARK  = '#0B3D6B'
const BLUE_LIGHT = '#5DAEF0'

const COMPACT_TEXTFIELD_SX: SxProps<Theme> = {
  '& .MuiInputLabel-root': { fontSize: 12 },
  '& .MuiInputBase-input': { fontSize: 12, py: '6px' },
}

type NavSection = 'profilo' | 'sicurezza' | 'accesso'

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ReactElement }[] = [
  { id: 'profilo',   label: 'Profilo',   icon: <PersonOutlineIcon fontSize="small" /> },
  { id: 'sicurezza', label: 'Sicurezza', icon: <LockOutlinedIcon fontSize="small" /> },
  { id: 'accesso',   label: 'Accesso',   icon: <ShieldOutlinedIcon fontSize="small" /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: BLUE }}>
        {children}
      </Typography>
      <Box sx={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(26,107,181,0.25), transparent)' }} />
    </Box>
  )
}

function PasswordField({
  label, value, onChange, error, disabled, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void
  error?: string; disabled?: boolean; autoComplete?: string
}) {
  const [show, setShow] = React.useState(false)
  return (
    <TextField
      label={label} value={value} onChange={(e) => onChange(e.target.value)}
      fullWidth size="small" type={show ? 'text' : 'password'}
      error={Boolean(error)} helperText={error}
      disabled={disabled} autoComplete={autoComplete}
      sx={COMPACT_TEXTFIELD_SX}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setShow((v) => !v)} edge="end" tabIndex={-1}>
              {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}

// ─── SEZIONE: Profilo ─────────────────────────────────────────────────────────

function SezioneProfilo({ me, onSaved }: { me: AuslBoMe; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [email, setEmail]         = React.useState(me.user.email || '')
  const [firstName, setFirstName] = React.useState(me.user.first_name || '')
  const [lastName, setLastName]   = React.useState(me.user.last_name || '')
  const [saving, setSaving]       = React.useState(false)
  const [avatarUploading, setAvatarUploading] = React.useState(false)

  React.useEffect(() => {
    setEmail(me.user.email || '')
    setFirstName(me.user.first_name || '')
    setLastName(me.user.last_name || '')
  }, [me])

  const avatarSrc = me.user.avatar || undefined
  const initials  = ((me.user.first_name?.[0] || '') + (me.user.last_name?.[0] || '')).toUpperCase()
                  || me.user.username?.[0]?.toUpperCase() || '?'

  const onSave = async () => {
    setSaving(true)
    try {
      await api.patch('/me/', { email, first_name: firstName, last_name: lastName })
      await onSaved()
      toast.success('Profilo aggiornato.')
    } catch { toast.error('Errore durante il salvataggio.') } finally { setSaving(false) }
  }

  const onAvatarChange = async (file: File) => {
    const fd = new FormData(); fd.append('avatar', file); setAvatarUploading(true)
    try { await api.patch('/me/', fd); await onSaved(); toast.success('Avatar aggiornato.') }
    catch { toast.error('Errore durante upload avatar.') } finally { setAvatarUploading(false) }
  }

  const onRemoveAvatar = async () => {
    setSaving(true)
    try { await api.patch('/me/', { avatar: '' }); await onSaved(); toast.success('Avatar rimosso.') }
    catch { toast.error('Errore durante rimozione avatar.') } finally { setSaving(false) }
  }

  return (
    <Box>
      <SectionTitle>Dati personali</SectionTitle>

      {/* Avatar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, mb: 2.5, borderRadius: 1, bgcolor: `rgba(26,107,181,0.04)`, border: `1px solid rgba(26,107,181,0.12)` }}>
        <Avatar src={avatarSrc} sx={{ width: 56, height: 56, bgcolor: BLUE, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
          {!avatarSrc && initials}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.25 }}>Foto profilo</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1 }}>JPG, PNG o WEBP · max 2 MB · 1024×1024 px</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" component="label" startIcon={<PhotoCameraOutlinedIcon />}
              disabled={saving || avatarUploading} sx={{ fontSize: '0.72rem' }}>
              {avatarUploading ? 'Caricamento…' : 'Carica foto'}
              <input hidden type="file" accept="image/*" onChange={(e) => {
                const f = e.currentTarget.files?.[0]; if (f) onAvatarChange(f); e.currentTarget.value = ''
              }} />
            </Button>
            {me.user.avatar && (
              <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineIcon />}
                disabled={saving || avatarUploading} onClick={onRemoveAvatar} sx={{ fontSize: '0.72rem' }}>
                Rimuovi
              </Button>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Campi */}
      <Stack spacing={2.5}>
        <TextField label="Username" value={me.user.username} disabled fullWidth size="small"
          helperText="Il nome utente non può essere modificato." sx={COMPACT_TEXTFIELD_SX} />
        <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          fullWidth size="small" type="email" sx={COMPACT_TEXTFIELD_SX} />
        <Stack direction="row" spacing={1.5}>
          <TextField label="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)}
            fullWidth size="small" sx={COMPACT_TEXTFIELD_SX} />
          <TextField label="Cognome" value={lastName} onChange={(e) => setLastName(e.target.value)}
            fullWidth size="small" sx={COMPACT_TEXTFIELD_SX} />
        </Stack>

        {/* Info cliente (read-only) */}
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1 }}>
            Organizzazione
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {me.customer.display_name || me.customer.name}
          </Typography>
          {me.customer.code && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Codice: {me.customer.code}</Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
          <Button variant="contained" onClick={onSave} disabled={saving || avatarUploading} sx={{ minWidth: 160 }}>
            {saving ? <><CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />Salvataggio…</> : 'Salva modifiche'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

// ─── SEZIONE: Sicurezza ───────────────────────────────────────────────────────

function SezioneSicurezza() {
  const toast = useToast()
  const [oldPwd, setOldPwd]   = React.useState('')
  const [newPwd, setNewPwd]   = React.useState('')
  const [newPwd2, setNewPwd2] = React.useState('')
  const [saving, setSaving]   = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [successMsg, setSuccessMsg]   = React.useState<string | null>(null)

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {}
    if (!oldPwd) errs.old_password = 'La password attuale è obbligatoria.'
    if (!newPwd) errs.new_password = 'La nuova password è obbligatoria.'
    else if (newPwd.length < 8) errs.new_password = 'Minimo 8 caratteri.'
    else if (newPwd === oldPwd) errs.new_password = 'Deve essere diversa dalla password attuale.'
    if (newPwd && !newPwd2) errs.new_password2 = 'Conferma la nuova password.'
    else if (newPwd && newPwd2 && newPwd !== newPwd2) errs.new_password2 = 'Le password non coincidono.'
    return errs
  }

  const handleSubmit = async () => {
    setSuccessMsg(null)
    const clientErrors = validate()
    if (Object.keys(clientErrors).length) { setFieldErrors(clientErrors); return }
    setFieldErrors({}); setSaving(true)
    try {
      await api.post('/me/change-password/', { old_password: oldPwd, new_password: newPwd, new_password2: newPwd2 })
      setOldPwd(''); setNewPwd(''); setNewPwd2('')
      setSuccessMsg('Password aggiornata con successo.'); toast.success('Password aggiornata ✅')
    } catch (e: unknown) {
      const mapped: Record<string, string> = {}
      if (isRecord(e)) {
        const resp = e['response']
        if (isRecord(resp)) {
          const data = resp['data']
          if (isRecord(data)) {
            const pick = (k: string) => { const v = data[k]; if (typeof v === 'string') return v; if (Array.isArray(v) && typeof v[0] === 'string') return v[0]; return undefined }
            const oldP = pick('old_password'); const newP = pick('new_password'); const newP2 = pick('new_password2')
            if (oldP) mapped.old_password = oldP; if (newP) mapped.new_password = newP; if (newP2) mapped.new_password2 = newP2
          }
        }
      }
      if (Object.keys(mapped).length) { setFieldErrors(mapped); return }
      toast.error(apiErrorToMessage(e))
    } finally { setSaving(false) }
  }

  const hasValues = oldPwd || newPwd || newPwd2

  return (
    <Box>
      <SectionTitle>Cambio password</SectionTitle>
      <Box sx={{ p: 2, mb: 3, borderRadius: 1, bgcolor: 'rgba(26,107,181,0.04)', border: '1px solid rgba(26,107,181,0.12)' }}>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.7 }}>
          Scegli una password di almeno <strong>8 caratteri</strong>. Dopo il cambio non verrai disconnesso dalla sessione corrente.
        </Typography>
      </Box>
      {successMsg && <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
      <Stack spacing={2.5}>
        <PasswordField label="Password attuale" value={oldPwd}
          onChange={(v) => { setOldPwd(v); setFieldErrors((e) => ({ ...e, old_password: '' })); setSuccessMsg(null) }}
          error={fieldErrors.old_password} disabled={saving} autoComplete="current-password" />
        <PasswordField label="Nuova password" value={newPwd}
          onChange={(v) => { setNewPwd(v); setFieldErrors((e) => ({ ...e, new_password: '' })); setSuccessMsg(null) }}
          error={fieldErrors.new_password} disabled={saving} autoComplete="new-password" />
        <PasswordField label="Conferma nuova password" value={newPwd2}
          onChange={(v) => { setNewPwd2(v); setFieldErrors((e) => ({ ...e, new_password2: '' })); setSuccessMsg(null) }}
          error={fieldErrors.new_password2} disabled={saving} autoComplete="new-password" />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 1 }}>
          {hasValues && (
            <Button variant="text" disabled={saving}
              onClick={() => { setOldPwd(''); setNewPwd(''); setNewPwd2(''); setFieldErrors({}); setSuccessMsg(null) }}>
              Annulla
            </Button>
          )}
          <Button variant="contained" onClick={handleSubmit} disabled={saving || !hasValues} sx={{ minWidth: 180 }}>
            {saving ? <><CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />Aggiornamento…</> : 'Aggiorna password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

// ─── SEZIONE: Accesso ─────────────────────────────────────────────────────────

function SezioneAccesso({ me }: { me: AuslBoMe }) {
  const [showAll, setShowAll] = React.useState(false)
  const perms = me.auslbo.permissions ?? []
  const visible = showAll ? perms : perms.slice(0, 12)

  return (
    <Box>
      <SectionTitle>Accesso & Permessi</SectionTitle>

      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>
          Stato account
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={me.auslbo.is_active ? '● Attivo' : '● Inattivo'}
            size="small"
            sx={{
              bgcolor: me.auslbo.is_active ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
              color:   me.auslbo.is_active ? '#065f46' : '#991b1b',
              border:  `1px solid ${me.auslbo.is_active ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)'}`,
              fontWeight: 700, fontSize: '0.72rem',
            }}
          />
          {me.auslbo.can_edit_devices && (
            <Chip label="Modifica device" size="small"
              sx={{ bgcolor: 'rgba(26,107,181,0.08)', color: BLUE, border: '1px solid rgba(26,107,181,0.2)', fontWeight: 600, fontSize: '0.72rem' }} />
          )}
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>
          Permessi ({perms.length})
        </Typography>
        {perms.length === 0 ? (
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Nessun permesso assegnato.</Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {visible.map((p) => {
                const [, ...rest] = p.split('.')
                return (
                  <Tooltip key={p} title={p} placement="top">
                    <Chip label={rest.join('.')} size="small"
                      sx={{ fontSize: '0.7rem', fontWeight: 500, bgcolor: 'rgba(0,0,0,0.04)', color: 'text.secondary', border: '1px solid rgba(0,0,0,0.08)', '& .MuiChip-label': { px: 1 } }} />
                  </Tooltip>
                )
              })}
            </Box>
            {perms.length > 12 && (
              <Button size="small" onClick={() => setShowAll((s) => !s)} sx={{ mt: 1.5, fontSize: '0.75rem' }}>
                {showAll ? 'Mostra meno' : `Mostra tutti i ${perms.length} permessi`}
              </Button>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

// ─── ProfileDrawer ────────────────────────────────────────────────────────────

export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, refreshMe } = useAuth()
  const [section, setSection] = React.useState<NavSection>('profilo')

  if (!me) return null

  const fullName = [me.user.first_name, me.user.last_name].filter(Boolean).join(' ') || me.user.username
  const initials = ((me.user.first_name?.[0] || '') + (me.user.last_name?.[0] || '')).toUpperCase()
                 || me.user.username?.[0]?.toUpperCase() || '?'
  const avatarSrc = me.user.avatar || undefined
  const tabIndex  = NAV_ITEMS.findIndex((item) => item.id === section)

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100vw', sm: 440 }, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
    >
      {/* ── Hero ── */}
      <Box
        sx={{
          background: `linear-gradient(140deg, ${BLUE_DARK} 0%, ${BLUE} 55%, ${BLUE_LIGHT} 100%)`,
          px: 2.5, pt: 2.25, pb: 2.25,
          position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}
      >
        <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, position: 'relative', zIndex: 2 }}>
          <Chip
            size="small"
            label={me.auslbo.can_edit_devices ? '● Editor' : '● Utente'}
            sx={{ bgcolor: 'rgba(93,174,240,0.22)', color: '#D1EAFE', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(209,234,254,0.3)', height: 22 }}
          />
          <ActionIconButton
            label="Chiudi"
            icon={<CloseIcon fontSize="small" />}
            size="small"
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}
          />
        </Stack>

        {/* Avatar + nome */}
        <Stack direction="row" alignItems="center" gap={2} sx={{ position: 'relative', zIndex: 1, mb: 1.5 }}>
          <Avatar src={avatarSrc} sx={{ width: 52, height: 52, bgcolor: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
            {!avatarSrc && initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, mb: 0.25 }}>
              {fullName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
              @{me.user.username} · {me.customer.display_name || me.customer.name}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* ── Tab bar ── */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2.5, flexShrink: 0 }}>
        <Tabs value={tabIndex} onChange={(_, idx) => setSection(NAV_ITEMS[idx].id)}>
          {NAV_ITEMS.map((item) => (
            <Tab key={item.id} label={item.label} sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
          ))}
        </Tabs>
      </Box>

      {/* ── Contenuto scrollabile ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {section === 'profilo'   && <SezioneProfilo  me={me} onSaved={refreshMe} />}
        {section === 'sicurezza' && <SezioneSicurezza />}
        {section === 'accesso'   && <SezioneAccesso   me={me} />}
      </Box>
    </Drawer>
  )
}
