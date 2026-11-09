import * as React from 'react'
import { Autocomplete, Box, Button, MenuItem, Switch, TextField, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import { CampoIcon, DetailSection, FloatingDetail } from '../../ui/campo'
import { useList } from '../../ui/campo/ListRows'
import { agoLabel } from '../../utils/agoLabel'
import { actionMeta, entityIcon, entityLabel, objectTitle, whenLabel, type AuditEvent } from '../audit/auditModel'
import type { AdminGroupRow, AdminUserRow, ModuleRwd, PermissionModule, ResetPasswordResponse, RwdLevel } from '../../types/adminUsers'
import { LEVEL_TO_RWD, rwdToLevel } from '../../types/adminUsers'
import { archieModules, fullName, levelSource, maxLevel, portalModules, roleTags, type LeaveAreaOption } from './usersModel'
import { ExtraPermissions, GroupTag, LevelPicker, ModuleLevels, ResetPasswordResultDialog, RoleChip } from './usersUi'

type Tab = 'perm' | 'ana' | 'act'
type CustomerOption = { id: number; label: string }
const help = { fontSize: 11.5, color: 'text.secondary' } as const

function Toggle({ label, help: h, checked, disabled, onChange }: { label: string; help: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', cursor: disabled ? 'default' : 'pointer', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, display: 'grid', lineHeight: 1.3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 550, color: disabled ? 'text.disabled' : 'text.primary' }}>{label}</Typography>
        <Typography sx={help}>{h}</Typography>
      </Box>
      <Switch size="small" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </Box>
  )
}

export type UserDetailCardProps = {
  user: AdminUserRow
  groups: AdminGroupRow[]
  modules: PermissionModule[]
  leaveAreas: LeaveAreaOption[]
  currentUserId?: number
  initialTab?: 'anagrafica' | 'permessi'
  /** Sezione Portal in cima (scheda aperta da Accesso Portal). */
  portalFirst?: boolean
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onSaved: (u: AdminUserRow) => void
  onDeleted: (id: number) => void
}

/** Scheda utente (anteprima up-base, variante A): Permessi, Anagrafica e ruoli, Attività. */
export default function UserDetailCard({ user, groups, modules, leaveAreas, currentUserId, initialTab, portalFirst, position, onPrev, onNext, onClose, onSaved, onDeleted }: UserDetailCardProps) {
  const toast = useToast()
  const [tab, setTab] = React.useState<Tab>(initialTab === 'anagrafica' ? 'ana' : 'perm')
  const [busy, setBusy] = React.useState(false)
  const [pw, setPw] = React.useState<ResetPasswordResponse | null>(null)
  const [del, setDel] = React.useState(false)

  // ── Stato modificabile ──
  const [first, setFirst] = React.useState('')
  const [last, setLast] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [groupIds, setGroupIds] = React.useState<number[]>([])
  const [prof, setProf] = React.useState(user.profile)
  const [direct, setDirect] = React.useState<Record<string, ModuleRwd>>({})
  const [extra, setExtra] = React.useState<Set<string>>(new Set())
  const [portalLevel, setPortalLevel] = React.useState<RwdLevel>('none')
  const [portalCustomers, setPortalCustomers] = React.useState<CustomerOption[]>([])
  const [portalDefault, setPortalDefault] = React.useState<number | null>(null)
  const [custQ, setCustQ] = React.useState('')
  const [custOpts, setCustOpts] = React.useState<CustomerOption[]>([])

  React.useEffect(() => {
    setFirst(user.first_name || ''); setLast(user.last_name || ''); setEmail(user.email || '')
    setGroupIds(user.groups.map((g) => g.id)); setProf(user.profile)
    setDirect(user.direct_permissions.modules); setExtra(new Set(user.direct_permissions.extra_permissions))
    setPortalLevel(rwdToLevel(user.direct_permissions.modules.portal))
    const pp = user.portal_profile
    const assigned = pp ? (pp.customers.length ? pp.customers.map((c) => ({ id: c.id, label: c.name })) : [{ id: pp.customer_id, label: pp.customer_name }]) : []
    setPortalCustomers(assigned); setPortalDefault(pp?.customer_id ?? null)
  }, [user])

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
  const setFlag = <K extends keyof typeof prof>(k: K, v: (typeof prof)[K]) => setProf((p) => ({ ...p, [k]: v }))
  // Philips: profilo limitato a ServiceNow (stesse regole del backend).
  const onPhilips = (on: boolean) => {
    setProf((p) => ({ ...p, is_philips: on, ...(on ? { is_servicenow_technician: true, is_leave_coordinator: false, is_expense_secretary: false, leave_area: null } : {}) }))
    if (on) { setGroupIds([]); setDirect({}); setExtra(new Set()); setPortalLevel('none'); setPortalCustomers([]); setPortalDefault(null) }
  }

  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try { const { data } = await api.patch<AdminUserRow>(`/admin-users/${user.id}/`, body); onSaved(data); toast.success(ok); return true }
    catch (e) { toast.error(apiErrorToMessage(e)); return false } finally { setBusy(false) }
  }
  const extraIds = () => {
    const map = new Map<string, number>()
    modules.forEach((m) => m.extra_permissions.forEach((p) => map.set(p.codename, p.id)))
    return [...extra].map((c) => map.get(c)).filter((x): x is number => typeof x === 'number')
  }
  const savePerms = () => {
    if (portalLevel !== 'none' && (!portalCustomers.length || !portalDefault)) { toast.error('Per il Portal scegli almeno un cliente e quello predefinito.'); return }
    void patch({ group_ids: groupIds, module_permissions: direct, extra_permission_ids: extraIds(), portal_access: { level: portalLevel, customer_id: portalDefault, customer_ids: portalCustomers.map((c) => c.id) } }, 'Permessi salvati.')
  }
  const saveAna = () => void patch({
    first_name: first, last_name: last, email, group_ids: groupIds,
    profile: { is_philips: prof.is_philips, is_servicenow_technician: prof.is_servicenow_technician, is_functional_account: prof.is_functional_account, is_leave_coordinator: prof.is_leave_coordinator, is_expense_secretary: prof.is_expense_secretary, leave_area: prof.leave_area, birth_date: prof.birth_date || null, gender: prof.gender || null },
  }, 'Anagrafica salvata.')
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

  // Il livello effettivo tiene conto dei gruppi scelti nel salvataggio precedente (quelli di `user`).
  const get = (app: string) => levelSource(user, groups, app, direct)
  const setLevel = (app: string, l: RwdLevel) => setDirect((d) => ({ ...d, [app]: LEVEL_TO_RWD[l] }))
  const hasDirect = Object.values(user.direct_permissions.modules).some((v) => v.r || v.w || v.d) || user.direct_permissions.extra_permissions.length > 0
  const canDelete = !user.is_superuser && user.id !== currentUserId
  const groupFloorPortal = rwdToLevel(user.group_permissions.modules.portal)
  const activity = useList<AuditEvent>('/audit-events/', tab === 'act' ? { actor: user.id, page_size: 15, ordering: '-created_at' } : null, user.id)

  const portalSection = (
          <DetailSection title="Portal">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, flex: 1 }}>Accesso al Portal</Typography>
        <LevelPicker label="Accesso al Portal" value={maxLevel(portalLevel, groupFloorPortal)} floor={groupFloorPortal} disabled={philips} onChange={setPortalLevel} />
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
          <ModuleLevels modules={portalModules(modules)} get={get} onChange={setLevel} />
        </Box>
      ) : null}
    </DetailSection>
  )

  return (
    <FloatingDetail open onClose={onClose} ariaLabel="Dettaglio utente"
      idLabel={<Box component="span" sx={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 12 }}>@{user.username}</Box>}
      status={user.is_active ? undefined : <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, bgcolor: 'rgba(255,255,255,.14)', color: '#fff' }}>Disattivato</Box>}
      title={fullName(user)} subtitle={[user.email, user.last_login ? `ultimo accesso ${agoLabel(user.last_login)}` : 'mai entrato'].filter(Boolean).join(' · ')}
      tabs={[{ key: 'perm', label: 'Permessi' }, { key: 'ana', label: 'Anagrafica e ruoli' }, { key: 'act', label: 'Attività' }]} tab={tab} onTab={(k) => setTab(k as Tab)}
      position={position} onPrev={onPrev} onNext={onNext}
      menu={canDelete ? [{ label: 'Elimina utente', danger: true, onClick: () => setDel(true) }] : undefined}
      footer={<>
        <Button variant="outlined" disabled={busy} onClick={() => void resetPassword()} startIcon={<CampoIcon name="key" size={15} />}>Reimposta password</Button>
        <Box sx={{ flex: 1 }} />
        {user.id !== currentUserId ? (user.is_active
          ? <Button variant="outlined" color="error" disabled={busy} onClick={() => void patch({ is_active: false }, 'Utente disattivato.')}>Disattiva</Button>
          : <Button variant="contained" disabled={busy} onClick={() => void patch({ is_active: true }, 'Utente riattivato.')}>Riattiva</Button>) : null}
      </>}>
      {!user.is_active ? (
        <Box sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: 'archie.neutralBg', mb: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Utente disattivato</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Non può accedere. I suoi dati e la sua storia restano.</Typography>
        </Box>
      ) : null}
      {roleTags(user).length ? <Box sx={{ mb: 2 }}>{roleTags(user).map((t) => <RoleChip key={t.label} tag={t} />)}</Box> : null}

      {tab === 'perm' ? (
        <Box sx={{ display: 'grid', gap: 2.25 }}>
          {philips ? <Typography sx={{ fontSize: 12.5, p: '8px 10px', borderRadius: '8px', bgcolor: 'info.light', color: 'info.main' }}>Profilo Philips: limitato a ServiceNow, senza gruppi né permessi Archie o Portal.</Typography> : null}
          {portalFirst ? portalSection : null}
          <DetailSection title="Gruppi">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              {groupIds.map((id) => <GroupTag key={id} name={groups.find((g) => g.id === id)?.name ?? `#${id}`} onRemove={philips ? undefined : () => setGroupIds((x) => x.filter((y) => y !== id))} />)}
              {!philips ? (
                <TextField select size="small" value="" label="Aggiungi a un gruppo" onChange={(e) => setGroupIds((x) => [...x, Number(e.target.value)])} sx={{ minWidth: 190, mt: 0.5 }}>
                  {groups.filter((g) => !groupIds.includes(g.id)).map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                </TextField>
              ) : null}
            </Box>
            {String(groupIds) !== String(user.groups.map((g) => g.id)) ? <Typography sx={{ ...help, mt: 0.75 }}>I livelli qui sotto si aggiornano dopo il salvataggio.</Typography> : null}
          </DetailSection>
          <DetailSection title="Archie" end={hasDirect ? <Button size="small" variant="text" disabled={busy} onClick={() => void resetToGroup()}>Riporta a quelli dei gruppi</Button> : undefined}>
            {user.is_superuser ? <Typography sx={help}>Superuser: ha accesso completo a tutto.</Typography> : <ModuleLevels modules={archieModules(modules)} get={get} onChange={setLevel} disabled={philips} />}
          </DetailSection>
          {!user.is_superuser ? (
            <DetailSection title="Permessi speciali">
              <ExtraPermissions modules={archieModules(modules)} fromGroup={new Set(user.group_permissions.extra_permissions)} value={extra} disabled={philips}
                onToggle={(c, on) => setExtra((s) => { const n = new Set(s); if (on) n.add(c); else n.delete(c); return n })} />
            </DetailSection>
          ) : null}
          {portalFirst ? null : portalSection}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" disabled={busy} onClick={savePerms}>Salva i permessi</Button></Box>
        </Box>
      ) : tab === 'ana' ? (
        <Box sx={{ display: 'grid', gap: 2.25 }}>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField label="Nome" value={first} onChange={(e) => setFirst(e.target.value)} />
              <TextField label="Cognome" value={last} onChange={(e) => setLast(e.target.value)} />
            </Box>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField type="date" label="Data di nascita" value={prof.birth_date ?? ''} onChange={(e) => setFlag('birth_date', e.target.value || null)} slotProps={{ inputLabel: { shrink: true } }} helperText="Per il widget Compleanni." />
              <TextField select label="Genere" value={prof.gender ?? ''} onChange={(e) => setFlag('gender', (e.target.value || null) as 'M' | 'F' | null)}>
                <MenuItem value="">Non indicato</MenuItem><MenuItem value="M">Uomo</MenuItem><MenuItem value="F">Donna</MenuItem>
              </TextField>
            </Box>
            <TextField select label="Area del piano ferie" value={prof.leave_area ?? ''} disabled={philips} onChange={(e) => setFlag('leave_area', e.target.value === '' ? null : Number(e.target.value))}>
              <MenuItem value="">Nessuna</MenuItem>
              {leaveAreas.map((a) => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
            </TextField>
          </Box>
          <DetailSection title="Ruoli">
            <Box>
              <Toggle label="Tecnico ServiceNow" help="Si può assegnare ai casi e compare nelle statistiche" checked={prof.is_servicenow_technician} disabled={philips} onChange={(v) => setFlag('is_servicenow_technician', v)} />
              <Toggle label="Philips" help="Tecnico Philips: vede solo ServiceNow" checked={prof.is_philips} onChange={onPhilips} />
              <Toggle label="Coordinatore ferie" help="Approva le richieste della sua area" checked={prof.is_leave_coordinator} disabled={philips} onChange={(v) => setFlag('is_leave_coordinator', v)} />
              <Toggle label="Segreteria spese" help="Vede e approva tutti i rimborsi" checked={prof.is_expense_secretary} disabled={philips} onChange={(v) => setFlag('is_expense_secretary', v)} />
              <Toggle label="Account funzionale" help="Usato da integrazioni o come assegnatario automatico, non da una persona" checked={prof.is_functional_account} onChange={(v) => setFlag('is_functional_account', v)} />
            </Box>
          </DetailSection>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" disabled={busy} onClick={saveAna}>Salva</Button></Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {!activity ? <Typography sx={help}>Caricamento…</Typography> : !activity.length ? <Typography sx={help}>Nessuna attività registrata.</Typography> : activity.map((e) => (
            <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box component="span" sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'archie.neutralBg', color: 'text.secondary', flex: 'none' }}><CampoIcon name={entityIcon(e)} size={13} /></Box>
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13 }}><Box component="span" sx={{ color: 'text.secondary' }}>{actionMeta(e.action).label} · {entityLabel(e)}</Box> <b style={{ fontWeight: 600 }}>{objectTitle(e)}</b></Typography>
              <Typography component="time" sx={{ ...help, whiteSpace: 'nowrap' }}>{whenLabel(e.created_at)}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <ResetPasswordResultDialog result={pw} onClose={() => setPw(null)} />
      <ConfirmDeleteDialog open={del} busy={busy} title={`Eliminare l'utente ${user.username}?`}
        description="L'eliminazione è definitiva: non finisce nel Cestino. Se vuoi solo togliergli l'accesso, disattivalo." confirmText="Elimina"
        onClose={() => setDel(false)} onConfirm={() => void doDelete()} />
    </FloatingDetail>
  )
}

