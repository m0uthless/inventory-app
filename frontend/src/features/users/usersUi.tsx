import * as React from 'react'
import { Autocomplete, Avatar, Box, Button, ButtonBase, Checkbox, FormControlLabel, IconButton, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoDialog, CampoIcon } from '../../ui/campo'
import type { AdminGroupRow, AdminUserCreateResponse, PermissionModule, ResetPasswordResponse, RwdLevel } from '../../types/adminUsers'
import { rwdLevelIndex } from '../../types/adminUsers'
import { LEVELS, LEVEL_LABEL, initials, type RoleTag } from './usersModel'

const MONO = { fontFamily: '"Geist Mono", ui-monospace, monospace' } as const

export function UserAvatar({ u, size = 30 }: { u: { first_name?: string; last_name?: string; username: string; profile?: { avatar: string | null } }; size?: number }) {
  return (
    <Avatar src={u.profile?.avatar || undefined} sx={{ width: size, height: size, fontSize: Math.round(size * 0.38), fontWeight: 700, flex: 'none',
      bgcolor: (t) => t.palette.archie.tints.mint.bg, color: (t) => t.palette.archie.tints.mint.ink }}>{initials(u)}</Avatar>
  )
}

export function GroupTag({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: onRemove ? 28 : 22, pl: 1, pr: onRemove ? 0.5 : 1, mr: 0.5, mb: 0.25, borderRadius: '14px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap' }}>
      {name}
      {onRemove ? <IconButton size="small" aria-label={`Togli dal gruppo ${name}`} onClick={onRemove} sx={{ width: 20, height: 20 }}><CampoIcon name="x" size={11} /></IconButton> : null}
    </Box>
  )
}

export function RoleChip({ tag }: { tag: RoleTag }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.9, mr: 0.5, mb: 0.25, borderRadius: '5px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
      bgcolor: (t) => (tag.tint === 'neutral' ? t.palette.archie.neutralBg : t.palette.archie.tints[tag.tint].bg),
      color: (t) => (tag.tint === 'neutral' ? t.palette.text.secondary : t.palette.archie.tints[tag.tint].ink) }}>{tag.label}</Box>
  )
}

const LEVEL_TINT: Record<RwdLevel, 'sky' | 'mint' | 'sand' | null> = { none: null, read: 'sky', read_write: 'mint', full: 'sand' }

/** Selettore a 4 livelli; sotto la soglia del gruppo non si scende (i permessi diretti si sommano a quelli dei gruppi). */
export function LevelPicker({ value, floor = 'none', onChange, disabled, label }: { value: RwdLevel; floor?: RwdLevel; onChange: (l: RwdLevel) => void; disabled?: boolean; label: string }) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'inline-flex', gap: '2px', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '7px', flex: 'none' }}>
      {LEVELS.map((l) => {
        const on = l === value
        const below = rwdLevelIndex(l) < rwdLevelIndex(floor)
        const tint = LEVEL_TINT[l]
        return (
          <Tooltip key={l} title={below ? 'Concesso dal gruppo: non si può togliere qui' : ''}>
            <span>
              <ButtonBase role="radio" aria-checked={on} disabled={disabled || below} onClick={() => { if (!on) onChange(l) }} sx={{
                height: 24, px: 1, borderRadius: '5px', fontSize: 12,
                color: on ? (t) => (tint ? t.palette.archie.tints[tint].ink : t.palette.text.primary) : 'text.secondary',
                bgcolor: on ? (t) => (tint ? t.palette.archie.tints[tint].bg : t.palette.archie.neutralBg) : 'transparent', fontWeight: on ? 600 : 400,
                '&:hover': { color: 'text.primary' }, '&.Mui-disabled': { color: 'text.disabled' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>{LEVEL_LABEL[l]}</ButtonBase>
            </span>
          </Tooltip>
        )
      })}
    </Box>
  )
}

/** Righe modulo → livello, con l'origine sotto il nome. */
export function ModuleLevels({ modules, get, onChange, disabled }: {
  modules: PermissionModule[]
  get: (app: string) => { level: RwdLevel; floor?: RwdLevel; from?: string }
  onChange: (app: string, l: RwdLevel) => void
  disabled?: boolean
}) {
  return (
    <Box>
      {modules.map((m, i) => {
        const v = get(m.app_label)
        return (
          <Box key={m.app_label} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.9, borderTop: i ? '1px solid' : 0, borderColor: 'divider', flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 120 }}>
              <Typography sx={{ fontSize: 13, color: v.level === 'none' ? 'text.secondary' : 'text.primary' }}>{m.label}</Typography>
              {v.from ? (
                <Typography sx={{ fontSize: 11, color: v.from === 'assegnato a mano' ? (t) => t.palette.archie.tints.peach.ink : 'text.secondary', fontWeight: v.from === 'assegnato a mano' ? 600 : 400 }}>{v.from}</Typography>
              ) : null}
            </Box>
            <LevelPicker label={m.label} value={v.level} floor={v.floor} disabled={disabled} onChange={(l) => onChange(m.app_label, l)} />
          </Box>
        )
      })}
    </Box>
  )
}

/** Permessi speciali (es. vedere le password), uno per uno. */
export function ExtraPermissions({ modules, fromGroup, value, onToggle, disabled }: {
  modules: PermissionModule[]; fromGroup?: Set<string>; value: Set<string>; onToggle: (codename: string, on: boolean) => void; disabled?: boolean
}) {
  const withExtra = modules.filter((m) => m.extra_permissions.length)
  if (!withExtra.length) return null
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {withExtra.map((m) => (
        <Box key={m.app_label}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary' }}>{m.label}</Typography>
          {m.extra_permissions.map((p) => {
            const g = Boolean(fromGroup?.has(p.codename))
            return (
              <FormControlLabel key={p.codename} sx={{ display: 'flex', ml: 0, mr: 0 }}
                control={<Checkbox size="small" checked={g || value.has(p.codename)} disabled={g || disabled} onChange={(e) => onToggle(p.codename, e.target.checked)} sx={{ p: 0.5, mr: 0.75 }} />}
                label={<Typography sx={{ fontSize: 12.5 }}>{p.name}{g ? <Box component="span" sx={{ color: 'text.secondary' }}> · dal gruppo</Box> : null}</Typography>} />
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

function CopyField({ value }: { value: string }) {
  const toast = useToast()
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '8px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'archie.surface2' }}>
      <Typography sx={{ ...MONO, flex: 1, fontSize: 14, overflowWrap: 'anywhere' }}>{value}</Typography>
      <IconButton size="small" aria-label="Copia" onClick={() => { void navigator.clipboard?.writeText(value).then(() => toast.success('Copiata negli appunti.')).catch(() => {}) }}><CampoIcon name="copy" size={15} /></IconButton>
    </Box>
  )
}

export function ResetPasswordResultDialog({ result, onClose }: { result: ResetPasswordResponse | null; onClose: () => void }) {
  return (
    <CampoDialog open={Boolean(result)} onClose={onClose} labelId="pw-reset-title" title="Password reimpostata" width={440}
      sub="Si vede solo adesso: comunicala all'utente e chiedigli di cambiarla al primo accesso."
      footer={<><Box sx={{ flex: 1 }} /><Button variant="contained" onClick={onClose}>Fatto</Button></>}>
      {result ? <CopyField value={result.password} /> : null}
      {result ? (
        <Typography sx={{ fontSize: 12.5, color: result.email_sent ? 'success.main' : 'warning.main' }}>
          {result.email_sent ? "Inviata anche per email all'utente." : 'Email non inviata: comunicala a voce o in altro modo.'}
        </Typography>
      ) : null}
    </CampoDialog>
  )
}

export function CreateUserDialog({ open, groups, onClose, onCreated }: { open: boolean; groups: AdminGroupRow[]; onClose: () => void; onCreated: (u: AdminUserCreateResponse) => void }) {
  const toast = useToast()
  const [v, setV] = React.useState({ username: '', password: '', first: '', last: '', email: '', groupIds: [] as number[] })
  const [busy, setBusy] = React.useState(false)
  const [created, setCreated] = React.useState<AdminUserCreateResponse | null>(null)
  React.useEffect(() => { if (open) { setV({ username: '', password: '', first: '', last: '', email: '', groupIds: [] }); setCreated(null) } }, [open])
  const submit = async () => {
    setBusy(true)
    try {
      const { data } = await api.post<AdminUserCreateResponse>('/admin-users/', { username: v.username.trim(), password: v.password || undefined, first_name: v.first, last_name: v.last, email: v.email, is_active: true, group_ids: v.groupIds })
      toast.success('Utente creato.')
      if (data.generated_password) setCreated(data)
      else onCreated(data)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  if (created) {
    return (
      <CampoDialog open={open} onClose={() => onCreated(created)} labelId="user-new-title" title={`${created.username} è pronto`} width={440}
        sub="La password è stata generata e si vede solo adesso."
        footer={<><Box sx={{ flex: 1 }} /><Button variant="contained" onClick={() => onCreated(created)}>Configura i permessi</Button></>}>
        <CopyField value={created.generated_password ?? ''} />
      </CampoDialog>
    )
  }
  return (
    <CampoDialog open={open} onClose={onClose} busy={busy} labelId="user-new-title" title="Nuovo utente" width={480}
      footer={<><Box sx={{ flex: 1 }} /><Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button><Button variant="contained" disabled={busy || !v.username.trim()} onClick={() => void submit()}>Crea utente</Button></>}>
      <TextField label="Nome utente" required autoFocus value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} placeholder="nome.cognome" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField label="Nome" value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} />
        <TextField label="Cognome" value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} />
      </Box>
      <TextField label="Email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      <TextField label="Password" type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} helperText="Lasciala vuota per generarne una." />
      <Autocomplete multiple options={groups} getOptionLabel={(g) => g.name} isOptionEqualToValue={(a, b) => a.id === b.id}
        value={groups.filter((g) => v.groupIds.includes(g.id))} onChange={(_e, list) => setV({ ...v, groupIds: list.map((g) => g.id) })}
        renderInput={(p) => <TextField {...p} label="Gruppi" />} />
    </CampoDialog>
  )
}

export function CreateGroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (g: AdminGroupRow) => void }) {
  const toast = useToast()
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { if (open) setName('') }, [open])
  const submit = async () => {
    setBusy(true)
    try { const { data } = await api.post<AdminGroupRow>('/admin-groups/', { name: name.trim() }); toast.success('Gruppo creato.'); onCreated(data) }
    catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  return (
    <CampoDialog open={open} onClose={onClose} busy={busy} labelId="group-new-title" title="Nuovo gruppo" width={420} sub="Dopo averlo creato scegli i permessi per modulo."
      footer={<><Box sx={{ flex: 1 }} /><Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button><Button variant="contained" disabled={busy || !name.trim()} onClick={() => void submit()}>Crea gruppo</Button></>}>
      <TextField label="Nome del gruppo" required autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void submit() }} />
    </CampoDialog>
  )
}
