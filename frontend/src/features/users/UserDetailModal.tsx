import * as React from 'react'
import { Autocomplete, Box, Button, ButtonBase, IconButton, InputBase, MenuItem, Switch, TextField, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import { BandTag, CampoIcon, RecordModal, RecordSection, bandButtonSx } from '../../ui/campo'
import { useList } from '../../ui/campo/ListRows'
import { agoLabel } from '../../utils/agoLabel'
import { actionMeta, entityIcon, entityLabel, objectTitle, whenLabel, type AuditEvent } from '../audit/auditModel'
import type { AdminGroupRow, AdminUserRow, ModuleRwd, PermissionModule, ResetPasswordResponse, RwdLevel } from '../../types/adminUsers'
import { LEVEL_TO_RWD, rwdToLevel } from '../../types/adminUsers'
import { archieModules, fullName, levelSource, maxLevel, portalModules, roleTags, type LeaveAreaOption } from './usersModel'
import { ExtraPermissions, GroupTag, LevelPicker, ResetPasswordResultDialog, UserAvatar } from './usersUi'
import { PermMatrix } from './PermMatrix'

type CustomerOption = { id: number; label: string }
type Profile = AdminUserRow['profile']
const help = { fontSize: 11.5, color: 'text.secondary' } as const
const label = { fontSize: 11.5, fontWeight: 550, color: 'text.secondary', mb: 0.6 } as const
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** «Compie 36 anni il 14 marzo, tra 117 giorni» (per il widget Compleanni). */
function birthdayNote(iso: string | null): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d)
  const days = Math.round((next.getTime() - today.getTime()) / 86400000)
  const age = next.getFullYear() - y
  return days === 0 ? `Compie ${age} anni oggi` : `Compie ${age} anni il ${d} ${MESI[m - 1]}, tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`
}

function Toggle({ label: l, help: h, checked, disabled, onChange }: { label: string; help: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', cursor: disabled ? 'default' : 'pointer', '&:last-of-type': { borderBottom: 0, pb: 0 } }}>
      <Box sx={{ flex: 1, display: 'grid', lineHeight: 1.3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 550, color: disabled ? 'text.disabled' : 'text.primary' }}>{l}</Typography>
        <Typography sx={help}>{h}</Typography>
      </Box>
      <Switch size="small" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </Box>
  )
}

const fieldSx = { '& .MuiInputBase-root': { height: 34, fontSize: 13 } } as const

export type UserDetailModalProps = {
  user: AdminUserRow
  groups: AdminGroupRow[]
  modules: PermissionModule[]
  leaveAreas: LeaveAreaOption[]
  /** Tutti gli utenti noti: servono a mostrare il coordinatore di ogni area ferie. */
  allUsers?: AdminUserRow[]
  currentUserId?: number
  /** L'utente corrente è superuser: solo lui può modificare account superuser o staff (B-10). */
  currentUserIsSuperuser?: boolean
  /** Sezione Portal in cima (finestra aperta da Accesso Portal). */
  portalFirst?: boolean
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onSaved: (u: AdminUserRow) => void
  onDeleted: (id: number) => void
}

/** Finestra dell'utente (anteprima ud-base, variante D): permessi al centro, persona a lato, un solo salvataggio. */
export default function UserDetailModal({ user, groups, modules, leaveAreas, allUsers, currentUserId, currentUserIsSuperuser, portalFirst, position, onPrev, onNext, onClose, onSaved, onDeleted }: UserDetailModalProps) {
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)
  const [pw, setPw] = React.useState<ResetPasswordResponse | null>(null)
  const [del, setDel] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // ── Stato modificabile (riparte dai dati dell'utente a ogni apertura o salvataggio) ──
  const [first, setFirst] = React.useState('')
  const [last, setLast] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [groupIds, setGroupIds] = React.useState<number[]>([])
  const [prof, setProf] = React.useState<Profile>(user.profile)
  const [direct, setDirect] = React.useState<Record<string, ModuleRwd>>({})
  const [extra, setExtra] = React.useState<Set<string>>(new Set())
  const [portalLevel, setPortalLevel] = React.useState<RwdLevel>('none')
  const [portalCustomers, setPortalCustomers] = React.useState<CustomerOption[]>([])
  const [portalDefault, setPortalDefault] = React.useState<number | null>(null)
  const [custQ, setCustQ] = React.useState('')
  const [custOpts, setCustOpts] = React.useState<CustomerOption[]>([])

  const initialPortal = React.useMemo(() => {
    const pp = user.portal_profile
    const customers = pp ? (pp.customers.length ? pp.customers.map((c) => ({ id: c.id, label: c.name })) : [{ id: pp.customer_id, label: pp.customer_name }]) : []
    return { level: rwdToLevel(user.direct_permissions.modules.portal), customers, def: pp?.customer_id ?? null }
  }, [user])

  const reset = React.useCallback(() => {
    setFirst(user.first_name || ''); setLast(user.last_name || ''); setEmail(user.email || '')
    setGroupIds(user.groups.map((g) => g.id)); setProf(user.profile)
    setDirect(user.direct_permissions.modules); setExtra(new Set(user.direct_permissions.extra_permissions))
    setPortalLevel(initialPortal.level); setPortalCustomers(initialPortal.customers); setPortalDefault(initialPortal.def)
  }, [user, initialPortal])
  React.useEffect(() => { reset() }, [reset])

  React.useEffect(() => {
    if (portalLevel === 'none') return
    let alive = true
    const t = window.setTimeout(() => {
      api.get('/customers/', { params: { search: custQ || undefined, page_size: 25 } }).then((r) => {
        const d: unknown = r.data
        const rows = Array.isArray(d) ? d : isRecord(d) && Array.isArray(d.results) ? d.results : []
        if (alive) setCustOpts(rows.filter(isRecord).map((c) => ({ id: Number(c.id), label: String(c.display_name || c.name || c.id) })).filter((o) => Number.isFinite(o.id)))
      }).catch(() => {})
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [custQ, portalLevel])

  const philips = prof.is_philips
  const setFlag = <K extends keyof Profile>(k: K, v: Profile[K]) => setProf((p) => ({ ...p, [k]: v }))
  // Philips: profilo limitato a ServiceNow (stesse regole del backend).
  const onPhilips = (on: boolean) => {
    setProf((p) => ({ ...p, is_philips: on, ...(on ? { is_servicenow_technician: true, is_leave_coordinator: false, is_expense_secretary: false, leave_area: null } : {}) }))
    if (on) { setGroupIds([]); setDirect({}); setExtra(new Set()); setPortalLevel('none'); setPortalCustomers([]); setPortalDefault(null) }
  }

  // ── Modifiche in sospeso (una voce per campo cambiato) ──
  const sameRwd = (a?: ModuleRwd, b?: ModuleRwd) => rwdToLevel(a) === rwdToLevel(b)
  const changes = React.useMemo(() => {
    const c: string[] = []
    if (first !== (user.first_name || '')) c.push('nome')
    if (last !== (user.last_name || '')) c.push('cognome')
    if (email !== (user.email || '')) c.push('email')
    if ([...groupIds].sort().join() !== user.groups.map((g) => g.id).sort().join()) c.push('gruppi')
    for (const k of ['is_philips', 'is_servicenow_technician', 'is_functional_account', 'is_leave_coordinator', 'is_expense_secretary', 'leave_area', 'birth_date', 'gender'] as const) {
      if ((prof[k] ?? null) !== (user.profile[k] ?? null)) c.push(k)
    }
    const apps = new Set([...Object.keys(direct), ...Object.keys(user.direct_permissions.modules)])
    apps.delete('portal')
    apps.forEach((a) => { if (!sameRwd(direct[a], user.direct_permissions.modules[a])) c.push(`perm:${a}`) })
    const before = new Set(user.direct_permissions.extra_permissions)
    if (extra.size !== before.size || [...extra].some((x) => !before.has(x))) c.push('speciali')
    if (portalLevel !== initialPortal.level || portalDefault !== initialPortal.def || portalCustomers.map((x) => x.id).join() !== initialPortal.customers.map((x) => x.id).join()) c.push('portal')
    return c
  }, [first, last, email, groupIds, prof, direct, extra, portalLevel, portalCustomers, portalDefault, user, initialPortal])

  const extraIds = () => {
    const map = new Map<string, number>()
    modules.forEach((m) => m.extra_permissions.forEach((p) => map.set(p.codename, p.id)))
    return [...extra].map((c) => map.get(c)).filter((x): x is number => typeof x === 'number')
  }
  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try { const { data } = await api.patch<AdminUserRow>(`/admin-users/${user.id}/`, body); onSaved(data); toast.success(ok); return true }
    catch (e) { toast.error(apiErrorToMessage(e)); return false } finally { setBusy(false) }
  }
  const saveAll = () => {
    if (portalLevel !== 'none' && (!portalCustomers.length || !portalDefault)) { toast.error('Per il Portal scegli almeno un cliente e quello predefinito.'); return }
    void patch({
      first_name: first, last_name: last, email, group_ids: groupIds,
      profile: { is_philips: prof.is_philips, is_servicenow_technician: prof.is_servicenow_technician, is_functional_account: prof.is_functional_account, is_leave_coordinator: prof.is_leave_coordinator, is_expense_secretary: prof.is_expense_secretary, leave_area: prof.leave_area, birth_date: prof.birth_date || null, gender: prof.gender || null },
      module_permissions: direct, extra_permission_ids: extraIds(),
      portal_access: { level: portalLevel, customer_id: portalDefault, customer_ids: portalCustomers.map((c) => c.id) },
    }, 'Modifiche salvate.')
  }
  const resetPassword = async () => {
    setBusy(true)
    try { const { data } = await api.post<ResetPasswordResponse>(`/admin-users/${user.id}/reset-password/`); setPw(data) } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const resetToGroup = async () => {
    setBusy(true)
    try { const { data } = await api.post<AdminUserRow>(`/admin-users/${user.id}/reset-permissions-to-group/`); onSaved(data); toast.success('Ora ha solo i permessi dei suoi gruppi.') } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const doDelete = async () => {
    setBusy(true)
    try { await api.delete(`/admin-users/${user.id}/`); toast.success('Utente eliminato.'); setDel(false); onDeleted(user.id) } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const copyEmail = () => { void navigator.clipboard?.writeText(email).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400) }).catch(() => {}) }

  // Il livello effettivo tiene conto dei gruppi salvati (quelli di `user`).
  const get = (app: string) => levelSource(user, groups, app, direct)
  const setLevel = (app: string, l: RwdLevel) => setDirect((d) => ({ ...d, [app]: LEVEL_TO_RWD[l] }))
  const hasDirect = Object.values(user.direct_permissions.modules).some((v) => v.r || v.w || v.d) || user.direct_permissions.extra_permissions.length > 0
  // B-10: un account superuser o staff lo modifica solo un superuser (il backend risponde 403).
  const locked = (user.is_superuser || user.is_staff) && !currentUserIsSuperuser
  const off = busy || locked
  const canDelete = !user.is_superuser && !locked && user.id !== currentUserId
  const groupFloorPortal = rwdToLevel(user.group_permissions.modules.portal)
  const activity = useList<AuditEvent>('/audit-events/', { actor: user.id, page_size: 6, ordering: '-created_at' }, user.id)
  const coordinatorOf = (areaId: number) => (allUsers ?? []).filter((u) => u.is_active && u.profile.is_leave_coordinator && u.profile.leave_area === areaId).map(fullName)
  const birthday = birthdayNote(prof.birth_date)

  const notice = (title: string, text: string) => (
    <Box sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: 'archie.neutralBg' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 650 }}>{title}</Typography>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{text}</Typography>
    </Box>
  )

  const portalSection = (
    <RecordSection title="Portal clienti">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, flex: 1 }}>Accesso al Portal</Typography>
        <LevelPicker label="Accesso al Portal" value={maxLevel(portalLevel, groupFloorPortal)} floor={groupFloorPortal} disabled={philips || locked} onChange={setPortalLevel} />
      </Box>
      {portalLevel !== 'none' ? (
        <Box sx={{ display: 'grid', gap: 1.5, mt: 1.5 }}>
          <Autocomplete multiple options={custOpts} filterOptions={(x) => x} inputValue={custQ} onInputChange={(_e, q) => setCustQ(q)}
            value={portalCustomers} getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_e, list) => { setPortalCustomers(list); if (!list.some((c) => c.id === portalDefault)) setPortalDefault(list[0]?.id ?? null) }}
            renderInput={(p) => <TextField {...p} label="Clienti che vede" required error={!portalCustomers.length} />} />
          {portalCustomers.length ? (
            <TextField select label="Cliente predefinito" value={portalDefault ?? ''} onChange={(e) => setPortalDefault(Number(e.target.value))} helperText="Quello che vede appena entra.">
              {portalCustomers.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
            </TextField>
          ) : null}
          <Typography sx={help}>Per fargli vedere device, inventari e VLAN assegna anche i moduli qui sotto.</Typography>
          <PermMatrix modules={portalModules(modules)} get={get} onChange={setLevel} disabled={locked} />
        </Box>
      ) : <Typography sx={{ ...help, mt: 1 }}>Nessun accesso al Portal.</Typography>}
    </RecordSection>
  )

  return (
    <RecordModal open onClose={onClose} ariaLabel={`Utente ${fullName(user)}`}
      avatar={<Box sx={{ borderRadius: '50%', boxShadow: '0 0 0 2px rgb(255 255 255 / .22)', flex: 'none' }}><UserAvatar u={user} size={52} /></Box>}
      title={fullName(user)}
      status={user.is_active ? undefined : <Box component="span" sx={{ fontSize: 11.5, fontWeight: 600, px: 1, py: '2px', borderRadius: '5px', bgcolor: 'rgb(255 255 255 / .16)' }}>Disattivato</Box>}
      subtitle={<><Box component="span" sx={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 12 }}>@{user.username}</Box>{user.email ? ` · ${user.email}` : ''} · {user.last_login ? `ultimo accesso ${agoLabel(user.last_login)}` : 'mai entrato'}</>}
      tags={roleTags(user).length ? roleTags(user).map((t) => <BandTag key={t.label}>{t.label}</BandTag>) : undefined}
      position={position} onPrev={onPrev} onNext={onNext}
      actions={<Button variant="outlined" disabled={off} onClick={() => void resetPassword()} startIcon={<CampoIcon name="key" size={15} />} sx={bandButtonSx}>Reimposta password</Button>}
      dirtyCount={locked ? 0 : changes.length} saving={busy} onSave={saveAll} onDiscard={reset}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale: gruppi e permessi ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {locked ? notice('Account amministratore', 'Solo un superuser può modificarlo, reimpostarne la password o disattivarlo.') : null}
          {!user.is_active ? notice('Utente disattivato', 'Non può accedere. I suoi dati e la sua storia restano.') : null}
          {philips ? <Typography sx={{ fontSize: 12.5, p: '8px 10px', borderRadius: '8px', bgcolor: 'info.light', color: 'info.main' }}>Profilo Philips: limitato a ServiceNow, senza gruppi né permessi Archie o Portal.</Typography> : null}
          {portalFirst ? portalSection : null}
          <RecordSection title="Gruppi" hint="I permessi arrivano dai gruppi; sotto puoi aggiungerne a mano.">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
              {groupIds.map((id) => <GroupTag key={id} name={groups.find((g) => g.id === id)?.name ?? `#${id}`} onRemove={philips || locked ? undefined : () => setGroupIds((x) => x.filter((y) => y !== id))} />)}
              {!philips && !locked ? (
                <TextField select size="small" value="" label="Aggiungi a un gruppo" onChange={(e) => setGroupIds((x) => [...x, Number(e.target.value)])} sx={{ minWidth: 200 }}>
                  {groups.filter((g) => !groupIds.includes(g.id)).map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                </TextField>
              ) : null}
            </Box>
            {changes.includes('gruppi') ? <Typography sx={{ ...help, mt: 0.75 }}>I livelli qui sotto si aggiornano dopo il salvataggio.</Typography> : null}
          </RecordSection>
          <RecordSection title="Permessi in Archie" end={hasDirect && !user.is_superuser ? <Button size="small" variant="text" disabled={off} onClick={() => void resetToGroup()}>Riporta a quelli dei gruppi</Button> : undefined}>
            {user.is_superuser ? <Typography sx={help}>Superuser: ha accesso completo a tutto.</Typography> : <PermMatrix modules={archieModules(modules)} get={get} onChange={setLevel} disabled={philips || locked} />}
          </RecordSection>
          {!user.is_superuser ? (
            <RecordSection title="Permessi speciali" hint="Accessi a dati riservati, oltre al livello del modulo.">
              <ExtraPermissions modules={archieModules(modules)} fromGroup={new Set(user.group_permissions.extra_permissions)} value={extra} disabled={philips || locked}
                onToggle={(c, on) => setExtra((s) => { const n = new Set(s); if (on) n.add(c); else n.delete(c); return n })} />
            </RecordSection>
          ) : null}
          {portalFirst ? null : portalSection}
        </Box>

        {/* ── Colonna della persona ── */}
        <Box component="aside" aria-label="Persona" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Anagrafica">
            <Box sx={{ display: 'grid', gap: 1.75 }}>
              <Box>
                <Typography sx={label}>Nome e cognome</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid', borderColor: 'divider', borderRadius: '6px', overflow: 'hidden', '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing } }}>
                  <InputBase value={first} disabled={locked} onChange={(e) => setFirst(e.target.value)} inputProps={{ 'aria-label': 'Nome' }} sx={{ height: 34, px: 1.25, fontSize: 13 }} />
                  <InputBase value={last} disabled={locked} onChange={(e) => setLast(e.target.value)} inputProps={{ 'aria-label': 'Cognome' }} sx={{ height: 34, px: 1.25, fontSize: 13, borderLeft: '1px solid', borderColor: 'divider' }} />
                </Box>
              </Box>
              <Box>
                <Typography sx={label}>Email</Typography>
                <TextField fullWidth type="email" value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} sx={fieldSx} slotProps={{ htmlInput: { 'aria-label': 'Email' }, input: { endAdornment: (
                  <Tooltip title={copied ? 'Copiata' : 'Copia'}><IconButton size="small" aria-label="Copia l'email" onClick={copyEmail} disabled={!email} sx={{ mr: -0.75, color: copied ? 'success.main' : undefined }}><CampoIcon name={copied ? 'check' : 'copy'} size={14} /></IconButton></Tooltip>
                ) } }} />
              </Box>
              <Box>
                <Typography sx={label}>Data di nascita</Typography>
                <TextField fullWidth type="date" value={prof.birth_date ?? ''} disabled={locked} onChange={(e) => setFlag('birth_date', e.target.value || null)} sx={fieldSx} slotProps={{ htmlInput: { 'aria-label': 'Data di nascita' } }} />
                <Typography sx={{ fontSize: 11.5, mt: 0.6, fontWeight: birthday ? 550 : 400, color: birthday ? 'primary.main' : 'text.secondary' }}>{birthday ?? 'Serve al widget Compleanni della Dashboard.'}</Typography>
              </Box>
              <Box>
                <Typography sx={label} id={`gender-${user.id}`}>Genere</Typography>
                <Box role="radiogroup" aria-labelledby={`gender-${user.id}`} sx={{ display: 'inline-flex', gap: 1 }}>
                  {([['M', '♂', 'Maschio', '#4a82c6'], ['F', '♀', 'Femmina', '#d4689b']] as const).map(([k, sym, name, c]) => {
                    const on = prof.gender === k
                    return (
                      <Tooltip key={k} title={name}>
                        <ButtonBase role="radio" aria-checked={on} aria-label={name} disabled={locked} onClick={() => setFlag('gender', k)} sx={{
                          width: 44, height: 36, borderRadius: '8px', border: '1px solid', fontSize: 21, fontWeight: 600, lineHeight: 1, color: c,
                          borderColor: on ? c : 'divider', bgcolor: on ? alpha(c, 0.14) : 'background.paper', boxShadow: on ? `inset 0 0 0 1px ${c}` : 'none', opacity: on ? 1 : 0.55,
                          transition: 'opacity .12s, background .12s, border-color .12s', '&:hover': { opacity: 1, borderColor: c }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                        }}>{sym}</ButtonBase>
                      </Tooltip>
                    )
                  })}
                </Box>
              </Box>
              <Box>
                <Typography sx={label}>Area del piano ferie</Typography>
                <TextField select fullWidth value={prof.leave_area ?? ''} disabled={philips || locked} onChange={(e) => setFlag('leave_area', e.target.value === '' ? null : Number(e.target.value))}
                  slotProps={{ htmlInput: { 'aria-label': 'Area del piano ferie' }, select: { renderValue: (v) => {
                    const a = leaveAreas.find((x) => x.id === v)
                    const coord = a ? coordinatorOf(a.id) : []
                    return (
                      <Box sx={{ display: 'grid', lineHeight: 1.3 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{a ? a.label : 'Nessuna area'}</Typography>
                        <Typography sx={help}>{a ? (coord.length ? `coordina ${coord.join(', ')}` : 'nessun coordinatore') : 'Non compare nel Piano ferie'}</Typography>
                      </Box>
                    )
                  }, displayEmpty: true } }}>
                  <MenuItem value="">Nessuna area</MenuItem>
                  {leaveAreas.map((a) => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
                </TextField>
              </Box>
            </Box>
          </RecordSection>

          <RecordSection title="Ruoli">
            <Toggle label="Tecnico ServiceNow" help="Si può assegnare ai casi e compare nelle statistiche" checked={prof.is_servicenow_technician} disabled={philips || locked} onChange={(v) => setFlag('is_servicenow_technician', v)} />
            <Toggle label="Philips" help="Tecnico Philips: vede solo ServiceNow" checked={prof.is_philips} disabled={locked} onChange={onPhilips} />
            <Toggle label="Coordinatore ferie" help="Approva le richieste della sua area" checked={prof.is_leave_coordinator} disabled={philips || locked} onChange={(v) => setFlag('is_leave_coordinator', v)} />
            <Toggle label="Segreteria spese" help="Vede e approva tutti i rimborsi" checked={prof.is_expense_secretary} disabled={philips || locked} onChange={(v) => setFlag('is_expense_secretary', v)} />
            <Toggle label="Account funzionale" help="Usato da integrazioni o come assegnatario automatico, non da una persona" checked={prof.is_functional_account} disabled={locked} onChange={(v) => setFlag('is_functional_account', v)} />
          </RecordSection>

          <RecordSection title="Attività recente">
            {!activity ? <Typography sx={help}>Caricamento…</Typography> : !activity.length ? <Typography sx={help}>Nessuna attività registrata.</Typography> : (
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1.25 }}>
                {activity.map((e) => (
                  <Box component="li" key={e.id} sx={{ display: 'grid', gridTemplateColumns: '16px 1fr', columnGap: 1, fontSize: 12.5, lineHeight: 1.4 }}>
                    <Box component="span" sx={{ color: 'text.disabled', mt: '1px' }}><CampoIcon name={entityIcon(e)} size={14} /></Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box component="span" sx={{ color: 'text.secondary' }}>{actionMeta(e.action).label} · {entityLabel(e)}</Box> <b style={{ fontWeight: 600 }}>{objectTitle(e)}</b>
                      <Typography component="time" sx={{ display: 'block', fontSize: 11.5, color: 'text.disabled' }}>{whenLabel(e.created_at)}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </RecordSection>

          {user.id !== currentUserId ? (
            <RecordSection title="Account">
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{user.is_active ? 'Disattivandolo non potrà più entrare; i suoi dati e la sua storia restano.' : "Non può accedere. Riattivalo per ridargli l'accesso."}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                {user.is_active
                  ? <Button variant="outlined" color="error" disabled={off} onClick={() => void patch({ is_active: false }, 'Utente disattivato.')}>Disattiva</Button>
                  : <Button variant="contained" disabled={off} onClick={() => void patch({ is_active: true }, 'Utente riattivato.')}>Riattiva</Button>}
                {canDelete ? <Button variant="outlined" disabled={off} onClick={() => setDel(true)}>Elimina…</Button> : null}
              </Box>
            </RecordSection>
          ) : null}
        </Box>
      </Box>

      <ResetPasswordResultDialog result={pw} onClose={() => setPw(null)} />
      <ConfirmDeleteDialog open={del} busy={busy} title={`Eliminare l'utente ${user.username}?`}
        description="L'eliminazione è definitiva: non finisce nel Cestino. Se vuoi solo togliergli l'accesso, disattivalo." confirmText="Elimina"
        onClose={() => setDel(false)} onConfirm={() => void doDelete()} />
    </RecordModal>
  )
}
