import * as React from 'react'
import { Autocomplete, Box, Button, ButtonBase, IconButton, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useToast } from '@shared/ui/toast'
import { CampoIcon, RecordModal, RecordSection, bandButtonSx } from '../../ui/campo'
import type { AdminGroupRow, AdminUserRow, ModuleRwd, PermissionModule, RwdLevel } from '../../types/adminUsers'
import { LEVEL_TO_RWD, rwdLevelIndex, rwdToLevel } from '../../types/adminUsers'
import { PermMatrix } from './PermMatrix'
import { LEVEL_LABEL, archieModules, fullName, portalModules } from './usersModel'
import { ExtraPermissions, LevelPicker, UserAvatar } from './usersUi'

const BAND_HEAT: Record<RwdLevel, string> = { none: 'rgb(255 255 255 / .14)', read: 'rgb(255 255 255 / .38)', read_write: 'rgb(255 255 255 / .62)', full: '#fff' }
const isAdmin = (u: AdminUserRow) => u.is_superuser || u.is_staff

/**
 * Finestra del gruppo (anteprima design-previews/gd-base.html): stessa RecordModal dell'utente.
 * Testata con nome, riepilogo e striscia dei livelli; al centro la matrice del gruppo con le
 * «Eccezioni» (membri che hanno di più a mano), permessi speciali e Portal; a lato i membri
 * (si aggiungono e si tolgono da qui) e il nome con Duplica ed Elimina. Un solo salvataggio, e la
 * barra dice su quante persone ricade.
 */
export default function GroupDetailModal({ group, modules, users, currentUserIsSuperuser, position, onPrev, onNext, onClose, onSaved, onDeleted, onDuplicate, onOpenUser }: {
  group: AdminGroupRow
  modules: PermissionModule[]
  users: AdminUserRow[]
  currentUserIsSuperuser: boolean
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onSaved: (g: AdminGroupRow) => void
  onDeleted: (id: number) => void
  onDuplicate: (g: AdminGroupRow) => void
  onOpenUser: (id: number) => void
}) {
  const toast = useToast()
  const initialMembers = React.useMemo(() => users.filter((u) => u.groups.some((g) => g.id === group.id)).map((u) => u.id), [users, group.id])
  const [name, setName] = React.useState(group.name)
  const [mods, setMods] = React.useState<Record<string, ModuleRwd>>(group.permissions_state.modules)
  const [extra, setExtra] = React.useState<Set<string>>(new Set(group.permissions_state.extra_permissions))
  const [members, setMembers] = React.useState<Set<number>>(new Set(initialMembers))
  const [q, setQ] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [del, setDel] = React.useState(false)

  const reset = React.useCallback(() => {
    setName(group.name); setMods(group.permissions_state.modules); setExtra(new Set(group.permissions_state.extra_permissions)); setMembers(new Set(initialMembers))
  }, [group, initialMembers])
  React.useEffect(() => { reset() }, [reset])

  const lv = (app: string) => rwdToLevel(mods[app])
  const archie = archieModules(modules)
  const portalMods = portalModules(modules)
  const hasPortal = modules.some((m) => m.app_label === 'portal')
  const allApps = [...archie, ...portalMods].map((m) => m.app_label).concat(hasPortal ? ['portal'] : [])
  const permChanged = (app: string) => lv(app) !== rwdToLevel(group.permissions_state.modules[app])

  const changes = (() => {
    const c: string[] = []
    if (name.trim() !== group.name) c.push('nome')
    allApps.forEach((a) => { if (permChanged(a)) c.push(`perm:${a}`) })
    const before = new Set(group.permissions_state.extra_permissions)
    if (extra.size !== before.size || [...extra].some((x) => !before.has(x))) c.push('speciali')
    members.forEach((id) => { if (!initialMembers.includes(id)) c.push(`+${id}`) })
    initialMembers.forEach((id) => { if (!members.has(id)) c.push(`-${id}`) })
    return c
  })()
  const membersChanged = changes.some((c) => c[0] === '+' || c[0] === '-')
  // Persone su cui ricade il salvataggio: tutti i membri se cambiano i permessi, più chi entra o esce.
  const impact = (() => {
    const permsChanged = changes.some((c) => c.startsWith('perm:') || c === 'speciali')
    const s = new Set<number>(permsChanged ? [...members, ...initialMembers] : [])
    changes.filter((c) => c[0] === '+' || c[0] === '-').forEach((c) => s.add(Number(c.slice(1))))
    return s.size
  })()

  const save = async () => {
    if (!name.trim()) { toast.error('Il nome del gruppo è obbligatorio.'); return }
    const ids = new Map<string, number>()
    modules.forEach((m) => m.extra_permissions.forEach((p) => ids.set(p.codename, p.id)))
    setBusy(true)
    try {
      const { data } = await api.patch<AdminGroupRow>(`/admin-groups/${group.id}/`, {
        name: name.trim(), module_permissions: mods,
        extra_permission_ids: [...extra].map((c) => ids.get(c)).filter((x): x is number => typeof x === 'number'),
        ...(membersChanged ? { user_ids: [...members] } : {}),
      })
      onSaved(data); toast.success('Gruppo salvato.')
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const doDelete = async () => {
    setBusy(true)
    try { await api.delete(`/admin-groups/${group.id}/`); toast.success('Gruppo eliminato.'); setDel(false); onDeleted(group.id) } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const byId = (id: number) => users.find((u) => u.id === id)
  const shown = [...new Set([...initialMembers, ...members])].map(byId).filter((u): u is AdminUserRow => Boolean(u))
  // Un account amministratore lo sposta solo un superuser; un utente Philips non sta in nessun gruppo.
  const movable = (u: AdminUserRow) => currentUserIsSuperuser || !isAdmin(u)
  const candidates = users.filter((u) => !members.has(u.id) && movable(u) && !u.profile.is_philips)
  const toggleMember = (id: number) => setMembers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const exceptions = (app: string) => [...members].map(byId).filter((u): u is AdminUserRow => Boolean(u))
    .filter((u) => rwdLevelIndex(rwdToLevel(u.direct_permissions.modules[app])) > rwdLevelIndex(lv(app)))
  const renderExceptions = (app: string) => {
    const ex = exceptions(app)
    if (!ex.length) return '—'
    return (
      <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{ex.map((u) => `${fullName(u)}: ${LEVEL_LABEL[rwdToLevel(u.direct_permissions.modules[app])]} a mano`).join('\n')}</Box>}>
        <Box component="span" tabIndex={0} sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.9, borderRadius: '5px', fontSize: 12, fontWeight: 550, bgcolor: (t) => t.palette.archie.tints.sand.bg, color: (t) => t.palette.archie.tints.sand.ink, cursor: 'help' }}>+{ex.length} a mano</Box>
      </Tooltip>
    )
  }

  const n = members.size
  const openCount = archie.filter((m) => lv(m.app_label) !== 'none').length
  const portalLevel = lv('portal')
  const help = { fontSize: 12, color: 'text.secondary' } as const

  return (
    <RecordModal open onClose={onClose} ariaLabel={`Gruppo ${group.name}`}
      avatar={<Box sx={{ width: 52, height: 52, borderRadius: '12px', display: 'grid', placeItems: 'center', flex: 'none', bgcolor: 'rgb(255 255 255 / .14)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .22)' }}><CampoIcon name="users" size={24} /></Box>}
      title={name.trim() || 'Senza nome'}
      subtitle={`${n} ${n === 1 ? 'utente' : 'utenti'} · ${openCount} moduli aperti · ${extra.size} ${extra.size === 1 ? 'permesso speciale' : 'permessi speciali'}${portalLevel !== 'none' ? ` · Portal in ${LEVEL_LABEL[portalLevel].toLowerCase()}` : ''}`}
      tags={<Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, archie.length)}, 1fr)`, gap: '3px', width: '100%', maxWidth: 360 }}>
        {archie.map((m) => <Box key={m.app_label} title={`${m.label}: ${LEVEL_LABEL[lv(m.app_label)]}`} sx={{ height: 8, borderRadius: '3px', bgcolor: BAND_HEAT[lv(m.app_label)] }} />)}
      </Box>}
      position={position} onPrev={onPrev} onNext={onNext}
      actions={<Button variant="outlined" disabled={busy} onClick={() => onDuplicate(group)} startIcon={<CampoIcon name="copy" size={15} />} sx={bandButtonSx}>Duplica</Button>}
      dirtyCount={changes.length} saving={busy} onSave={() => void save()} onDiscard={reset}
      dirtyNote={impact ? `riguarda ${impact} ${impact === 1 ? 'persona' : 'persone'}` : undefined}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Permessi in Archie" hint="Valgono per tutti i membri. «Eccezioni»: chi ha già di più a mano.">
            <PermMatrix modules={archie} get={(a) => ({ level: lv(a) })} onChange={(a, l) => setMods((m) => ({ ...m, [a]: LEVEL_TO_RWD[l] }))}
              sourceLabel="Eccezioni" renderSource={renderExceptions} changed={permChanged} />
          </RecordSection>
          <RecordSection title="Permessi speciali" hint="Accessi a dati riservati, oltre al livello del modulo.">
            <ExtraPermissions modules={archie} value={extra} onToggle={(c, on) => setExtra((s) => { const x = new Set(s); if (on) x.add(c); else x.delete(c); return x })} />
          </RecordSection>
          {hasPortal || portalMods.length ? (
            <RecordSection title="Portal clienti">
              {hasPortal ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: portalMods.length ? 2 : 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 550, flex: 1 }}>Accesso al Portal</Typography>
                  <LevelPicker label="Accesso al Portal" value={portalLevel} onChange={(l) => setMods((m) => ({ ...m, portal: LEVEL_TO_RWD[l] }))} />
                </Box>
              ) : null}
              {portalMods.length ? <PermMatrix modules={portalMods} get={(a) => ({ level: lv(a) })} onChange={(a, l) => setMods((m) => ({ ...m, [a]: LEVEL_TO_RWD[l] }))} showSource={false} changed={permChanged} /> : null}
              <Typography sx={{ ...help, mt: 1 }}>I clienti visibili si scelgono sul singolo utente.</Typography>
            </RecordSection>
          ) : null}
        </Box>

        <Box component="aside" aria-label="Gruppo" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title={<>Membri <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: 'text.secondary', ml: 0.5 }}>{n}</Box></>}>
            {shown.length ? (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '2px' }}>
                {shown.map((u) => {
                  const gone = !members.has(u.id)
                  const isNew = !initialMembers.includes(u.id)
                  const other = u.groups.filter((g) => g.id !== group.id).map((g) => g.name)
                  return (
                    <Box component="li" key={u.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '5px 4px 5px 6px', borderRadius: '8px', bgcolor: isNew ? 'archie.field' : undefined, opacity: gone ? 0.5 : 1, '&:hover': { bgcolor: isNew ? 'archie.field' : 'archie.surface2' }, '&:hover .rm, & .rm:focus-visible': { opacity: 1 } }}>
                      <UserAvatar u={u} size={30} />
                      <ButtonBase onClick={() => { if (changes.length) toast.error('Salva o annulla le modifiche prima di aprire un utente.'); else onOpenUser(u.id) }} sx={{ flex: 1, minWidth: 0, display: 'grid', justifyItems: 'start', justifyContent: 'stretch', textAlign: 'left', lineHeight: 1.3, '&:hover b': { color: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing, borderRadius: '4px' } }}>
                        <Typography component="b" noWrap sx={{ fontSize: 13, fontWeight: 550, maxWidth: '100%', textDecoration: gone ? 'line-through' : 'none' }}>{fullName(u)}</Typography>
                        <Typography component="span" noWrap sx={{ fontSize: 11.5, color: 'text.secondary', maxWidth: '100%' }}>
                          {isNew ? 'si aggiunge al salvataggio' : gone ? 'esce al salvataggio' : other.length ? `anche in ${other.join(', ')}` : u.email || `@${u.username}`}
                        </Typography>
                      </ButtonBase>
                      {movable(u) ? (
                        <Tooltip title={gone ? 'Rimetti' : 'Togli dal gruppo'}>
                          <IconButton className="rm" size="small" aria-label={`${gone ? 'Rimetti' : 'Togli'} ${fullName(u)}`} onClick={() => toggleMember(u.id)} sx={{ opacity: gone ? 1 : 0, '@media (hover: none)': { opacity: 1 } }}>
                            <CampoIcon name={gone ? 'restore' : 'x'} size={15} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Box>
                  )
                })}
              </Box>
            ) : <Typography sx={help}>Nessuno: aggiungi qui sotto le persone che devono avere questi permessi.</Typography>}
            <Autocomplete
              sx={{ mt: 1.25 }} size="small" forcePopupIcon={false} options={candidates} value={null} inputValue={q} onInputChange={(_, v, r) => { if (r !== 'reset') setQ(v) }}
              onChange={(_, u) => { if (u) { setMembers((s) => new Set(s).add(u.id)); setQ('') } }}
              getOptionLabel={(u) => fullName(u)} filterOptions={(opts, s) => { const t = s.inputValue.trim().toLowerCase(); return t ? opts.filter((u) => `${fullName(u)} ${u.username} ${u.email}`.toLowerCase().includes(t)).slice(0, 8) : [] }}
              noOptionsText={q.trim() ? 'Nessuno da aggiungere con questo nome.' : 'Scrivi un nome'} blurOnSelect={false} clearOnBlur
              renderOption={(props, u) => {
                const { key, ...rest } = props as typeof props & { key: React.Key }
                return (
                  <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1, fontSize: 12.5 }}>
                    <UserAvatar u={u} size={22} /><Box component="span" sx={{ flex: 1, minWidth: 0 }}>{fullName(u)}</Box>
                    <Box component="small" sx={{ color: 'text.secondary', fontSize: 11.5 }}>{u.groups.map((g) => g.name).join(', ') || 'nessun gruppo'}</Box>
                  </Box>
                )
              }}
              renderInput={(p) => <TextField {...p} placeholder="Aggiungi una persona…" slotProps={{ htmlInput: { ...p.inputProps, 'aria-label': 'Aggiungi una persona al gruppo' } }} />}
            />
          </RecordSection>

          <RecordSection title="Gruppo">
            <TextField fullWidth size="small" label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Box sx={{ display: 'flex', gap: 1, mt: 1.75, flexWrap: 'wrap' }}>
              <Button variant="outlined" disabled={busy} startIcon={<CampoIcon name="copy" size={15} />} onClick={() => onDuplicate(group)}>Duplica…</Button>
              <Button variant="outlined" color="error" disabled={busy} onClick={() => setDel(true)}>Elimina…</Button>
            </Box>
            <Typography sx={{ ...help, mt: 1.25 }}>{initialMembers.length ? `Eliminandolo, ${initialMembers.length} ${initialMembers.length === 1 ? 'persona perde' : 'persone perdono'} i permessi che arrivano da qui.` : 'Nessun membro: si può eliminare senza effetti.'}</Typography>
          </RecordSection>
        </Box>
      </Box>

      <ConfirmDeleteDialog open={del} busy={busy} title={`Eliminare il gruppo «${group.name}»?`}
        description={initialMembers.length ? `L'eliminazione è definitiva: ${initialMembers.length} ${initialMembers.length === 1 ? 'utente perde' : 'utenti perdono'} i permessi che arrivano da questo gruppo.` : "L'eliminazione è definitiva."}
        confirmText="Elimina" onClose={() => setDel(false)} onConfirm={() => void doDelete()} />
    </RecordModal>
  )
}
