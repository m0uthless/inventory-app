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
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Autocomplete,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import HistoryIcon from '@mui/icons-material/History'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import { useNavigate } from 'react-router-dom'
import { type SxProps, type Theme } from '@mui/material/styles'
import { api } from '../api/client'
import { apiErrorToMessage } from '../api/error'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../ui/toast'
import AuditActionChip from '../ui/AuditActionChip'
import type { AuditEventRow } from '../types/audit'
import { useDrfList } from '../hooks/useDrfList'
import { buildDrfListParams } from '../api/drf'
import { isRecord } from '../utils/guards'
import { ActionIconButton } from '../ui/ActionIconButton'

// ─── Costanti palette ──────────────────────────────────────────────────────────
const TEAL       = '#0f766e'
const TEAL_LIGHT = '#14b8a6'
const TEAL_DARK  = '#0a4f4a'

const COMPACT_TEXTFIELD_SX: SxProps<Theme> = {
  '& .MuiInputLabel-root': { fontSize: 12 },
  '& .MuiInputBase-input': { fontSize: 12, py: '6px' },
}

type NavSection = 'profilo' | 'sicurezza' | 'permessi' | 'attivita'

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ReactElement }[] = [
  { id: 'profilo',   label: 'Profilo',   icon: <PersonOutlineIcon fontSize="small" /> },
  { id: 'sicurezza', label: 'Sicurezza', icon: <LockOutlinedIcon fontSize="small" /> },
  { id: 'permessi',  label: 'Permessi',  icon: <ShieldOutlinedIcon fontSize="small" /> },
  { id: 'attivita',  label: 'Attività',  icon: <HistoryIcon fontSize="small" /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
type CustomerOption = { id: number; label: string }

function buildCustomerLabel(c: unknown): string {
  if (!isRecord(c)) return ''
  const code    = typeof c['code']         === 'string' ? c['code']         : ''
  const name    = typeof c['name']         === 'string' ? c['name']         : ''
  const display = typeof c['display_name'] === 'string' ? c['display_name'] : ''
  const base    = display || name
  return code ? `${code} — ${base}` : base
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function summarizeChanges(changes: unknown): string {
  if (!isRecord(changes)) return ''
  const keys = Object.keys(changes)
  if (!keys.length) return ''
  const first = keys.slice(0, 3)
  const rest  = keys.length - first.length
  return rest > 0 ? `${first.join(', ')} +${rest}` : first.join(', ')
}

// ─── PasswordField ────────────────────────────────────────────────────────────
function PasswordField(props: {
  label: string; value: string; onChange: (v: string) => void
  error?: string | null; disabled?: boolean; autoComplete?: string; sx?: SxProps<Theme>
}) {
  const { label, value, onChange, error, disabled, autoComplete, sx } = props
  const [show, setShow] = React.useState(false)
  return (
    <TextField
      label={label} type={show ? 'text' : 'password'} value={value}
      onChange={(e) => onChange(e.target.value)} error={!!error} helperText={error || undefined}
      disabled={disabled} fullWidth autoComplete={autoComplete} size="small"
      sx={sx ? Array.isArray(sx) ? [COMPACT_TEXTFIELD_SX, ...sx] : [COMPACT_TEXTFIELD_SX, sx] : COMPACT_TEXTFIELD_SX}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" aria-label={show ? 'Nascondi' : 'Mostra'} onClick={() => setShow((s) => !s)} onMouseDown={(e) => e.preventDefault()} edge="end" tabIndex={-1}>
              {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEAL, whiteSpace: 'nowrap' }}>
        {children}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(15,118,110,0.25), transparent)' }} />
    </Box>
  )
}

// ─── SEZIONE: Profilo ─────────────────────────────────────────────────────────
function SezioneProfilo({ me, onSaved }: { me: NonNullable<ReturnType<typeof useAuth>['me']>; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [email, setEmail]         = React.useState(me.email      || '')
  const [firstName, setFirstName] = React.useState(me.first_name || '')
  const [lastName, setLastName]   = React.useState(me.last_name  || '')
  const [saving, setSaving]       = React.useState(false)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [custValue, setCustValue]   = React.useState<CustomerOption | null>(null)
  const [custInput, setCustInput]   = React.useState('')
  const [custOptions, setCustOptions] = React.useState<CustomerOption[]>([])
  const [custLoading, setCustLoading] = React.useState(false)

  React.useEffect(() => {
    setEmail(me.email || ''); setFirstName(me.first_name || ''); setLastName(me.last_name || '')
    const pcId = me.profile?.preferred_customer ?? null
    const pcName = me.profile?.preferred_customer_name ?? null
    setCustValue(pcId && pcName ? { id: pcId, label: pcName } : null)
  }, [me])

  React.useEffect(() => {
    let alive = true
    const t = window.setTimeout(async () => {
      setCustLoading(true)
      try {
        const res = await api.get('/customers/', { params: { search: custInput.trim() || undefined, page_size: 25 } })
        const payloadU: unknown = (res as unknown as { data: unknown }).data
        const results: unknown[] = Array.isArray(payloadU) ? payloadU : isRecord(payloadU) && Array.isArray(payloadU['results']) ? (payloadU['results'] as unknown[]) : []
        const opts: CustomerOption[] = results.map((c: unknown) => {
          if (!isRecord(c)) return null
          const id = Number(c['id'])
          if (!Number.isFinite(id)) return null
          return { id, label: buildCustomerLabel(c) || String(id) }
        }).filter((x: CustomerOption | null): x is CustomerOption => Boolean(x))
        if (!alive) return
        setCustOptions(custValue && !opts.some((o) => o.id === custValue.id) ? [custValue, ...opts] : opts)
      } catch { /* silenzioso */ } finally { if (alive) setCustLoading(false) }
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [custInput, custValue])

  const avatarSrc = me.profile?.avatar || undefined
  const initials  = ((me.first_name?.[0] || '') + (me.last_name?.[0] || '')).toUpperCase() || me.username?.[0]?.toUpperCase() || 'U'

  const onSave = async () => {
    setSaving(true)
    try {
      await api.patch('/me/', { email, first_name: firstName, last_name: lastName, preferred_customer: custValue?.id ?? null })
      await onSaved(); toast.success('Profilo aggiornato.')
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, mb: 2.5, borderRadius: 1, bgcolor: 'rgba(15,118,110,0.04)', border: '1px solid rgba(15,118,110,0.1)' }}>
        <Avatar src={avatarSrc} sx={{ width: 56, height: 56, bgcolor: TEAL, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{!avatarSrc && initials}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.25 }}>Foto profilo</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1 }}>JPG, PNG o WEBP · max 2 MB · 1024×1024 px</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" component="label" startIcon={<PhotoCameraOutlinedIcon />} disabled={saving || avatarUploading} sx={{ fontSize: '0.72rem' }}>
              {avatarUploading ? 'Caricamento…' : 'Carica foto'}
              <input hidden type="file" accept="image/*" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) onAvatarChange(f); e.currentTarget.value = '' }} />
            </Button>
            {me.profile?.avatar && (
              <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineIcon />} disabled={saving || avatarUploading} onClick={onRemoveAvatar} sx={{ fontSize: '0.72rem' }}>Rimuovi</Button>
            )}
          </Stack>
        </Box>
      </Box>
      <Stack spacing={2.5}>
        <TextField label="Username" value={me.username} disabled fullWidth size="small" helperText="Il nome utente non può essere modificato." sx={COMPACT_TEXTFIELD_SX} />
        <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth size="small" type="email" sx={COMPACT_TEXTFIELD_SX} />
        <Stack direction="row" spacing={1.5}>
          <TextField label="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth size="small" sx={COMPACT_TEXTFIELD_SX} />
          <TextField label="Cognome" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth size="small" sx={COMPACT_TEXTFIELD_SX} />
        </Stack>
        <Autocomplete
          value={custValue} onChange={(_, v) => setCustValue(v)} inputValue={custInput} onInputChange={(_, v) => setCustInput(v)}
          options={custOptions} loading={custLoading} isOptionEqualToValue={(a, b) => a.id === b.id} size="small"
          renderInput={(params) => (
            <TextField {...params} label="Customer preferito" placeholder="Cerca customer…" size="small" sx={COMPACT_TEXTFIELD_SX}
              InputProps={{ ...params.InputProps, endAdornment: <>{custLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</> }}
            />
          )}
        />
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
  const [fieldErrors, setFieldErrors]   = React.useState<Record<string, string>>({})
  const [successMsg, setSuccessMsg]     = React.useState<string | null>(null)

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
      <Box sx={{ p: 2, mb: 3, borderRadius: 1, bgcolor: 'rgba(15,118,110,0.04)', border: '1px solid rgba(15,118,110,0.1)' }}>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.7 }}>
          Scegli una password di almeno <strong>8 caratteri</strong>. Dopo il cambio non verrai disconnesso dalla sessione corrente.
        </Typography>
      </Box>
      {successMsg && <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
      <Stack spacing={2.5}>
        <PasswordField label="Password attuale" value={oldPwd} onChange={(v) => { setOldPwd(v); setFieldErrors((e) => ({ ...e, old_password: '' })); setSuccessMsg(null) }} error={fieldErrors.old_password} disabled={saving} autoComplete="current-password" />
        <PasswordField label="Nuova password" value={newPwd} onChange={(v) => { setNewPwd(v); setFieldErrors((e) => ({ ...e, new_password: '' })); setSuccessMsg(null) }} error={fieldErrors.new_password} disabled={saving} autoComplete="new-password" />
        <PasswordField label="Conferma nuova password" value={newPwd2} onChange={(v) => { setNewPwd2(v); setFieldErrors((e) => ({ ...e, new_password2: '' })); setSuccessMsg(null) }} error={fieldErrors.new_password2} disabled={saving} autoComplete="new-password" />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 1 }}>
          {hasValues && <Button variant="text" disabled={saving} onClick={() => { setOldPwd(''); setNewPwd(''); setNewPwd2(''); setFieldErrors({}); setSuccessMsg(null) }}>Annulla</Button>}
          <Button variant="contained" onClick={handleSubmit} disabled={saving || !hasValues} sx={{ minWidth: 180 }}>
            {saving ? <><CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />Aggiornamento…</> : 'Aggiorna password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

// ─── SEZIONE: Permessi & Gruppi ───────────────────────────────────────────────
function SezionePermessi({ me }: { me: NonNullable<ReturnType<typeof useAuth>['me']> }) {
  const [showAll, setShowAll] = React.useState(false)
  const perms = me.permissions ?? []; const groups = me.groups ?? []
  const visible = showAll ? perms : perms.slice(0, 12)

  return (
    <Box>
      <SectionTitle>Permessi & Gruppi</SectionTitle>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>Ruolo sistema</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {me.is_superuser && <Chip label="Superuser" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700, fontSize: '0.72rem' }} />}
          {me.is_staff    && <Chip label="Staff" size="small" sx={{ bgcolor: 'rgba(15,118,110,0.08)', color: TEAL, border: 'rgba(15,118,110,0.2)', fontWeight: 700, fontSize: '0.72rem' }} />}
          {!me.is_staff && !me.is_superuser && <Chip label="Utente standard" size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />}
        </Stack>
      </Box>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>Gruppi ({groups.length})</Typography>
        {groups.length === 0 ? (
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Nessun gruppo assegnato.</Typography>
        ) : (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {groups.map((g) => <Chip key={g} label={g} size="small" variant="outlined" sx={{ fontSize: '0.72rem', fontWeight: 600, borderColor: 'rgba(15,118,110,0.3)', color: TEAL }} />)}
          </Stack>
        )}
      </Box>
      <Divider sx={{ mb: 3 }} />
      <Box>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5 }}>Permessi ({perms.length})</Typography>
        {perms.length === 0 ? (
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Nessun permesso esplicito.</Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {visible.map((p) => {
                const [, ...rest] = p.split('.')
                return (
                  <Tooltip key={p} title={p} placement="top">
                    <Chip label={rest.join('.')} size="small" sx={{ fontSize: '0.7rem', fontWeight: 500, bgcolor: 'rgba(0,0,0,0.04)', color: 'text.secondary', border: '1px solid rgba(0,0,0,0.08)', '& .MuiChip-label': { px: 1 } }} />
                  </Tooltip>
                )
              })}
            </Box>
            {perms.length > 12 && <Button size="small" onClick={() => setShowAll((s) => !s)} sx={{ mt: 1.5, fontSize: '0.75rem' }}>{showAll ? 'Mostra meno' : `Mostra tutti i ${perms.length} permessi`}</Button>}
          </>
        )}
      </Box>
    </Box>
  )
}

// ─── SEZIONE: Attività recente ────────────────────────────────────────────────
function SezioneAttivita({ me }: { me: NonNullable<ReturnType<typeof useAuth>['me']> }) {
  const toast = useToast(); const navigate = useNavigate()
  const params = React.useMemo(() => buildDrfListParams({ page0: 0, pageSize: 10, ordering: '-created_at', extra: { actor: me.id } }), [me.id])
  const { rows, rowCount, loading } = useDrfList<AuditEventRow>('/audit-events/', params, (e: unknown) => toast.error(apiErrorToMessage(e)))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEAL }}>Attività recente</Typography>
          <Box sx={{ height: '1px', width: 60, background: 'linear-gradient(90deg, rgba(15,118,110,0.25), transparent)' }} />
        </Box>
        <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/audit?actor=${me.id}`)} sx={{ fontSize: '0.72rem' }}>Vedi tutto</Button>
      </Box>
      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 3 }}>
          <CircularProgress size={20} /><Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Caricamento…</Typography>
        </Stack>
      ) : rowCount === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <HistoryIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Nessuna attività registrata.</Typography>
        </Box>
      ) : (
        <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {rows.slice(0, 10).map((ev, idx) => {
            const model = ev.content_type_model || ''; const obj = ev.object_repr || ev.subject || ev.object_id || '—'
            const when = fmtDateTime(ev.created_at); const ch = summarizeChanges(ev.changes)
            const isLast = idx === Math.min(rows.length, 10) - 1
            return (
              <ListItem key={ev.id} divider={!isLast} sx={{ py: 1.25, px: 2, alignItems: 'flex-start', '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}>
                <Box sx={{ pt: 0.25, pr: 1.5, flexShrink: 0 }}><AuditActionChip action={ev.action} /></Box>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      {model && <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: TEAL }}>{model}</Typography>}
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} noWrap>{obj}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', ml: 'auto' }} noWrap>{when}</Typography>
                    </Stack>
                  }
                  secondary={ch ? <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }} noWrap>Campi: {ch}</Typography> : undefined}
                  primaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            )
          })}
        </List>
      )}
    </Box>
  )
}

// ─── Pagina standalone ────────────────────────────────────────────────────────
export default function Profile() {
  const { me, refreshMe } = useAuth()
  const [section, setSection] = React.useState<NavSection>('profilo')
  if (!me) return null
  return <ProfilePageContent me={me} refreshMe={refreshMe} section={section} setSection={setSection} />
}

// ─── ProfileDrawer (aperto dalla navbar) ─────────────────────────────────────
export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, refreshMe } = useAuth()
  const [section, setSection] = React.useState<NavSection>('profilo')
  if (!me) return null

  const fullName  = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username
  const tabIndex  = NAV_ITEMS.findIndex((item) => item.id === section)

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 440 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* ── Hero (identico a CustomerDrawer / InventoryDrawer) ── */}
      <Box
        sx={{
          background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
          px: 2.5,
          pt: 2.25,
          pb: 2.25,
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Cerchi decorativi */}
        <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Topbar: chip ruolo a sinistra, close a destra */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
          <Chip
            size="small"
            label={me.is_superuser ? '● Superuser' : me.is_staff ? '● Staff' : '● Utente'}
            sx={{ bgcolor: 'rgba(20,255,180,0.18)', color: '#a7f3d0', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(167,243,208,0.3)', height: 22 }}
          />
          <ActionIconButton
            label="Chiudi"
            icon={<CloseIcon fontSize="small" />}
            size="small"
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}
          />
        </Stack>

        {/* Nome + username */}
        <Box sx={{ position: 'relative', zIndex: 1, mb: 2 }}>
          <Typography sx={{ color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.1, mb: 0.5 }}>
            {fullName}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
            @{me.username}
            {me.groups.length > 0 && ` · ${me.groups.slice(0, 2).join(', ')}`}
          </Typography>
        </Box>
      </Box>

      {/* ── Tab bar (identica a CustomerDrawer) ── */}
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
        {section === 'permessi'  && <SezionePermessi  me={me} />}
        {section === 'attivita'  && <SezioneAttivita  me={me} />}
      </Box>
    </Drawer>
  )
}

// ─── Contenuto pagina standalone ─────────────────────────────────────────────
function ProfilePageContent({
  me, refreshMe, section, setSection,
}: {
  me: NonNullable<ReturnType<typeof useAuth>['me']>
  refreshMe: () => Promise<void>
  section: NavSection
  setSection: (s: NavSection) => void
}) {
  const initials  = ((me.first_name?.[0] || '') + (me.last_name?.[0] || '')).toUpperCase() || me.username?.[0]?.toUpperCase() || 'U'
  const fullName  = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username
  const avatarSrc = me.profile?.avatar || undefined

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Profilo</Typography>
      <Typography variant="body2" sx={{ opacity: 0.6, mb: 3 }}>Gestisci il tuo account, la sicurezza e visualizza la tua attività.</Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* ── SIDEBAR ── */}
        <Box sx={{ width: 210, flexShrink: 0, bgcolor: 'background.paper', borderRadius: 2.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden', boxShadow: '0 1px 6px rgba(15,23,42,0.06)' }}>
          <Box sx={{ background: `linear-gradient(155deg, ${TEAL_DARK} 0%, ${TEAL} 100%)`, px: 2, py: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: '24px solid rgba(255,255,255,0.06)', top: -50, right: -40, pointerEvents: 'none' }} />
            <Avatar src={avatarSrc} sx={{ width: 60, height: 60, fontSize: 20, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.25)', position: 'relative', zIndex: 1 }}>{!avatarSrc && initials}</Avatar>
            <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <Typography sx={{ fontSize: '0.825rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{fullName}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>@{me.username}</Typography>
            </Box>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="center" useFlexGap sx={{ position: 'relative', zIndex: 1 }}>
              {me.is_superuser && <Chip label="Superuser" size="small" sx={{ fontSize: '0.62rem', height: 18, bgcolor: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontWeight: 700 }} />}
              {me.is_staff    && <Chip label="Staff"     size="small" sx={{ fontSize: '0.62rem', height: 18, bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700 }} />}
              {me.groups.slice(0, 2).map((g) => <Chip key={g} label={g} size="small" sx={{ fontSize: '0.62rem', height: 18, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }} />)}
            </Stack>
          </Box>
          <Box sx={{ p: 0.75 }}>
            {NAV_ITEMS.map((item) => {
              const active = section === item.id
              return (
                <Box key={item.id} onClick={() => setSection(item.id)} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer', mb: 0.25, color: active ? TEAL : 'text.secondary', bgcolor: active ? 'rgba(15,118,110,0.08)' : 'transparent', fontWeight: active ? 700 : 500, fontSize: '0.8rem', transition: 'all 0.15s', '&:hover': { bgcolor: active ? 'rgba(15,118,110,0.08)' : 'rgba(0,0,0,0.04)' } }}>
                  <Box sx={{ color: active ? TEAL : 'text.disabled', display: 'flex', alignItems: 'center' }}>{item.icon}</Box>
                  {item.label}
                  {active && <Box sx={{ ml: 'auto', width: 4, height: 4, borderRadius: '50%', bgcolor: TEAL_LIGHT }} />}
                </Box>
              )
            })}
          </Box>
          <Divider />
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', lineHeight: 1.8 }}>
              {me.permissions.length} permessi · {me.groups.length} {me.groups.length === 1 ? 'gruppo' : 'gruppi'}
            </Typography>
          </Box>
        </Box>

        {/* ── MAIN ── */}
        <Box sx={{ flex: 1, minWidth: 0, bgcolor: 'background.paper', borderRadius: 2.5, border: '1px solid', borderColor: 'divider', p: { xs: 2, sm: 3 }, boxShadow: '0 1px 6px rgba(15,23,42,0.06)' }}>
          {section === 'profilo'   && <SezioneProfilo  me={me} onSaved={refreshMe} />}
          {section === 'sicurezza' && <SezioneSicurezza />}
          {section === 'permessi'  && <SezionePermessi  me={me} />}
          {section === 'attivita'  && <SezioneAttivita  me={me} />}
        </Box>
      </Box>
    </Box>
  )
}
