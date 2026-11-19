import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Autocomplete, Avatar, Box, Button, ButtonBase, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import { useAuth, type Me } from '../../auth/AuthProvider'
import {
  BandChip, BandEditing, CampoIcon, DetailSection, QuickField, RecordField, RecordGrid, RecordModal, RecordSection, RecordValue, bandButtonSx, bandSolidSx,
} from '../../ui/campo'
import { useList } from '../../ui/campo/ListRows'
import { THEME_REGISTRY, resolveColorModePref, resolveThemeKey, type ColorModePref, type ThemeKey } from '../../theme/themeRegistry'
import { actionMeta, entityIcon, entityLabel, objectTitle, whenLabel, type AuditEvent } from '../audit/auditModel'
import { agoLabel } from '../../utils/agoLabel'
import { SCORE_LABEL, deviceLabel, fullName, initialsOf, monthYear, passwordScore, summarizePermissions } from './profileModel'


const tag = { display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' } as const
const help = { fontSize: 11.5, color: 'text.secondary' } as const

// ── Dati ──────────────────────────────────────────────────────────────────
type CustomerOption = { id: number; label: string }
const customerLabel = (c: Record<string, unknown>) => {
  const code = typeof c.code === 'string' ? c.code : ''
  const base = (typeof c.display_name === 'string' && c.display_name) || (typeof c.name === 'string' ? c.name : '')
  return code ? `${code} — ${base}` : base
}

type DatiForm = ReturnType<typeof useDatiForm>
function useDatiForm(me: Me | null, onSaved: () => Promise<void>) {
  const toast = useToast()
  const initial = React.useCallback(() => ({
    email: me?.email || '', first: me?.first_name || '', last: me?.last_name || '',
    cust: me?.profile?.preferred_customer && me.profile.preferred_customer_name ? { id: me.profile.preferred_customer, label: me.profile.preferred_customer_name } as CustomerOption : null,
  }), [me])
  const [v, setV] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)
  const id = me?.id
  React.useEffect(() => { setV(initial()) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }))
  const dirty = !!me && (v.email !== (me.email || '') || v.first !== (me.first_name || '') || v.last !== (me.last_name || '') || (v.cust?.id ?? null) !== (me.profile?.preferred_customer ?? null))
  const save = async () => {
    setBusy(true)
    try { await api.patch('/me/', { email: v.email, first_name: v.first, last_name: v.last, preferred_customer: v.cust?.id ?? null }); await onSaved(); toast.success('Profilo aggiornato.'); return true }
    catch (e) { toast.error(apiErrorToMessage(e)); return false } finally { setBusy(false) }
  }
  return { v, set, dirty, busy, save, reset: () => setV(initial()) }
}

/** Dati personali nella colonna laterale: testo in lettura, campi dopo «Modifica i dati». */
function DatiRail({ me, form, editing }: { me: Me; form: DatiForm; editing: boolean }) {
  const { v, set } = form
  const [custQ, setCustQ] = React.useState('')
  const [opts, setOpts] = React.useState<CustomerOption[]>([])
  React.useEffect(() => {
    if (!editing) return
    let alive = true
    const t = window.setTimeout(() => {
      api.get('/customers/', { params: { search: custQ.trim() || undefined, page_size: 25 } }).then((r) => {
        const d: unknown = r.data
        const rows = Array.isArray(d) ? d : isRecord(d) && Array.isArray(d.results) ? d.results : []
        if (alive) setOpts(rows.filter(isRecord).map((c) => ({ id: Number(c.id), label: customerLabel(c) })).filter((o) => Number.isFinite(o.id)))
      }).catch(() => {})
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [custQ, editing])
  const custDirty = (v.cust?.id ?? null) !== (me.profile?.preferred_customer ?? null)
  return (
    <RecordSection title="Dati personali">
      <RecordGrid>
        <RecordField editing={editing} label="Nome" value={v.first} onChange={(x) => set('first', x)} dirty={v.first !== (me.first_name || '')} />
        <RecordField editing={editing} label="Cognome" value={v.last} onChange={(x) => set('last', x)} dirty={v.last !== (me.last_name || '')} />
        <RecordField editing={editing} label="Email" value={v.email} onChange={(x) => set('email', x)} dirty={v.email !== (me.email || '')} wide />
        <RecordValue label="Nome utente" wide mono>{`@${me.username}`}</RecordValue>
        {editing ? (
          <Box sx={{ gridColumn: '1 / -1', display: 'grid', gap: 0.5 }}>
            <Typography component="label" htmlFor="profile-preferred-customer" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>Cliente preferito</Typography>
            <Autocomplete id="profile-preferred-customer" size="small" value={v.cust} onChange={(_e, x) => set('cust', x)} inputValue={custQ} onInputChange={(_e, x) => setCustQ(x)}
              options={v.cust && !opts.some((o) => o.id === v.cust?.id) ? [v.cust, ...opts] : opts} filterOptions={(x) => x}
              isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={(o) => o.label} noOptionsText="Nessun cliente"
              renderInput={(p) => <TextField {...p} placeholder="Nessuno" sx={custDirty ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main', borderWidth: 2 } } : undefined} />} />
          </Box>
        ) : <RecordValue label="Cliente preferito" wide>{me.profile?.preferred_customer_name || null}</RecordValue>}
      </RecordGrid>
      <Typography sx={{ ...help, mt: 1.25 }}>{editing ? 'Il nome utente non si può cambiare.' : 'Il cliente preferito è proposto per primo quando crei issue, inventari e rapportini.'}</Typography>
    </RecordSection>
  )
}

// ── Aspetto ───────────────────────────────────────────────────────────────
function AspettoTab({ me, onSaved }: { me: Me; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [saving, setSaving] = React.useState<string | null>(null)
  const key = resolveThemeKey(me.profile?.theme)
  const mode = resolveColorModePref(me.profile?.color_mode)
  const save = async (field: 'theme' | 'color_mode', value: string) => {
    setSaving(`${field}:${value}`)
    try { await api.patch('/me/', { [field]: value }); await onSaved() } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setSaving(null) }
  }
  const palettes = (Object.entries(THEME_REGISTRY) as [ThemeKey, (typeof THEME_REGISTRY)[ThemeKey]][]).filter(([k, e]) => e.selectable || k === key)
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Typography sx={help}>Le preferenze valgono su tutti i dispositivi da cui accedi.</Typography>
      <DetailSection title="Modalità">
        <Box role="radiogroup" aria-label="Modalità" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '9px' }}>
          {([['light', 'Chiaro', 'sun'], ['dark', 'Scuro', 'moon'], ['system', 'Come il sistema', 'monitor']] as [ColorModePref, string, 'sun' | 'moon' | 'monitor'][]).map(([v, l, i]) => {
            const on = v === mode
            return (
              <ButtonBase key={v} role="radio" aria-checked={on} disabled={Boolean(saving)} onClick={() => { if (!on) void save('color_mode', v) }} sx={{
                gap: 0.75, height: 32, px: 1.5, borderRadius: '6px', fontSize: 13, color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent', fontWeight: on ? 600 : 400,
                '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>{saving === `color_mode:${v}` ? <CircularProgress size={13} /> : <CampoIcon name={i} size={15} />}{l}</ButtonBase>
            )
          })}
        </Box>
      </DetailSection>
      <DetailSection title="Palette">
        <Box role="radiogroup" aria-label="Palette" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
          {palettes.map(([k, entry]) => {
            const on = k === key
            const pal = entry.theme.palette
            return (
              <ButtonBase key={k} role="radio" aria-checked={on} disabled={Boolean(saving)} onClick={() => { if (!on) void save('theme', k) }} sx={{
                position: 'relative', display: 'grid', gap: 1, justifyItems: 'start', p: 1.25, textAlign: 'left', borderRadius: '10px', border: '1px solid',
                borderColor: on ? 'archie.fieldLine' : 'divider', boxShadow: on ? (t) => `inset 0 0 0 1px ${t.palette.archie.fieldLine}` : 'none',
              }}>
                <Box sx={{ display: 'flex', width: '100%', height: 34, borderRadius: '6px', overflow: 'hidden' }}>
                  <Box sx={{ flex: 1, bgcolor: pal.primary.main }} /><Box sx={{ flex: 1, bgcolor: pal.archie.field }} />
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{entry.label}</Typography>
                {saving === `theme:${k}` ? <CircularProgress size={14} sx={{ position: 'absolute', top: 8, right: 8 }} /> : on ? (
                  <Box component="span" sx={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>✓</Box>
                ) : null}
              </ButtonBase>
            )
          })}
        </Box>
      </DetailSection>
    </Box>
  )
}

// ── Sicurezza ─────────────────────────────────────────────────────────────
function SicurezzaTab() {
  const toast = useToast()
  const [oldP, setOldP] = React.useState('')
  const [newP, setNewP] = React.useState('')
  const [newP2, setNewP2] = React.useState('')
  const [err, setErr] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [pwOpen, setPwOpen] = React.useState(false)
  const logins = useList<{ created_at: string; ip: string | null; user_agent: string }>('/me/logins/', {})
  const score = passwordScore(newP)
  const submit = async () => {
    const e: Record<string, string> = {}
    if (!oldP) e.old_password = 'Scrivi la password attuale.'
    if (newP.length < 8) e.new_password = 'Almeno 8 caratteri.'
    else if (newP === oldP) e.new_password = 'Deve essere diversa da quella attuale.'
    if (newP2 !== newP) e.new_password2 = 'Le due password non coincidono.'
    setErr(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await api.post('/me/change-password/', { old_password: oldP, new_password: newP, new_password2: newP2 })
      setOldP(''); setNewP(''); setNewP2(''); setPwOpen(false); toast.success('Password cambiata. Resti collegato.')
    } catch (ex) {
      const d = isRecord(ex) && isRecord(ex.response) && isRecord(ex.response.data) ? ex.response.data : null
      const pick = (k: string) => { const v = d?.[k]; return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined }
      const m = Object.fromEntries(['old_password', 'new_password', 'new_password2'].map((k) => [k, pick(k)]).filter(([, v]) => v)) as Record<string, string>
      if (Object.keys(m).length) setErr(m); else toast.error(apiErrorToMessage(ex))
    } finally { setBusy(false) }
  }
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {!pwOpen ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary', width: 90 }}>Password</Typography>
          <Button size="small" variant="text" onClick={() => setPwOpen(true)} sx={{ px: 0.5 }}>Cambia la password</Button>
        </Box>
      ) : (
      <DetailSection title="Cambia password">
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <QuickField label="Password attuale" secret value={oldP} onChange={setOldP} error={err.old_password} autoComplete="current-password" />
          <Box>
            <QuickField label="Nuova password" secret value={newP} onChange={setNewP} error={err.new_password} autoComplete="new-password" />
            {newP ? (
              <Box sx={{ mt: 0.75 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>{[1, 2, 3, 4].map((i) => <Box key={i} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= score ? (score <= 1 ? 'error.main' : score === 2 ? 'warning.main' : 'success.main') : 'archie.neutralBg' }} />)}</Box>
                <Typography sx={{ ...help, mt: 0.5 }}>{SCORE_LABEL[score]}. Almeno 12 caratteri, meglio una frase.</Typography>
              </Box>
            ) : null}
          </Box>
          <QuickField label="Ripeti la nuova password" secret value={newP2} onChange={setNewP2} error={err.new_password2} autoComplete="new-password" />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="text" disabled={busy} onClick={() => { setPwOpen(false); setOldP(''); setNewP(''); setNewP2(''); setErr({}) }}>Annulla</Button>
            <Button variant="contained" disabled={busy || !oldP || !newP} onClick={() => void submit()}>Cambia la password</Button>
          </Box>
        </Box>
      </DetailSection>
      )}
      <DetailSection title="Accessi recenti">
        {!logins ? <Typography sx={help}>Caricamento…</Typography> : !logins.length ? <Typography sx={help}>Nessun accesso registrato.</Typography> : (
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {logins.map((l, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="key" size={15} /></Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'grid', lineHeight: 1.3 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{deviceLabel(l.user_agent)}</Typography>
                  <Typography noWrap component="span" sx={{ ...help, fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{l.ip || '—'}</Typography>
                </Box>
                <Typography component="time" sx={help}>{agoLabel(l.created_at)}</Typography>
              </Box>
            ))}
          </Box>
        )}
        <Typography sx={{ ...help, mt: 1 }}>La sessione si chiude da sola dopo un periodo di inattività.</Typography>
      </DetailSection>
    </Box>
  )
}

// ── Permessi ──────────────────────────────────────────────────────────────
function PermessiTab({ me }: { me: Me }) {
  const mods = summarizePermissions(me.permissions ?? [])
  const pill = (on: boolean, label: string) => (
    <Box component="span" sx={{ ...tag, height: 20, px: 0.75, fontSize: 11.5, fontWeight: on ? 600 : 400, bgcolor: on ? 'success.light' : 'transparent', color: on ? 'success.main' : 'text.disabled', border: '1px solid', borderColor: on ? 'transparent' : 'divider' }}>{label}</Box>
  )
  return (
    <Box sx={{ display: 'grid', gap: 2.25 }}>
      <Typography sx={help}>I permessi arrivano dai gruppi: per cambiarli chiedi a chi gestisce gli utenti.</Typography>
      <DetailSection>
        {!mods.length ? <Typography sx={help}>Nessun permesso.</Typography> : (
          <Box sx={{ display: 'grid' }}>
            {mods.map((m, i) => (
              <Box key={m.app} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.9, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13 }}>{m.label}</Typography>
                  {m.extra.length ? <Typography sx={{ ...help, fontSize: 11 }}>anche: {m.extra.map((x) => x.replace(/_/g, ' ')).join(', ')}</Typography> : null}
                </Box>
                {pill(m.r, 'Lettura')}{pill(m.w, 'Scrittura')}{pill(m.d, 'Eliminazione')}
              </Box>
            ))}
          </Box>
        )}
      </DetailSection>
    </Box>
  )
}

// ── Gruppi (colonna laterale) ───────────────────────────────────────────
function GruppiBlock({ me }: { me: Me }) {
  return (
    <RecordSection title="Gruppi">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {me.is_superuser ? <Box component="span" sx={{ ...tag, bgcolor: (t) => t.palette.archie.tints.sand.bg, color: (t) => t.palette.archie.tints.sand.ink }}>Superuser · accesso completo</Box> : null}
          {(me.groups ?? []).map((g) => <Box key={g} component="span" sx={{ ...tag, borderRadius: '11px', border: '1px solid', borderColor: 'divider', fontWeight: 550 }}>{g}</Box>)}
          {!me.is_superuser && !me.groups?.length ? <Typography sx={help}>Nessun gruppo.</Typography> : null}
        </Box>
    </RecordSection>
  )
}

// ── Attività ──────────────────────────────────────────────────────────────
function AttivitaTab({ me, onOpenAudit }: { me: Me; onOpenAudit: () => void }) {
  const events = useList<AuditEvent>('/audit-events/', { actor: me.id, page_size: 12, ordering: '-created_at' })
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {!events ? <Typography sx={help}>Caricamento…</Typography> : !events.length ? <Typography sx={help}>Nessuna attività registrata.</Typography> : events.map((e) => (
        <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 13 }}>
          <Box component="span" sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'archie.neutralBg', color: 'text.secondary', flex: 'none' }}><CampoIcon name={entityIcon(e)} size={13} /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 13 }}><Box component="span" sx={{ color: 'text.secondary' }}>{actionMeta(e.action).label} · {entityLabel(e)}</Box> <b style={{ fontWeight: 600 }}>{objectTitle(e)}</b></Typography>
          </Box>
          <Typography component="time" sx={{ ...help, whiteSpace: 'nowrap' }}>{whenLabel(e.created_at)}</Typography>
        </Box>
      ))}
      <Box><Button size="small" variant="text" onClick={onOpenAudit} endIcon={<CampoIcon name="arrowR" size={13} />} sx={{ px: 0 }}>Tutta la mia attività nell'Audit</Button></Box>
    </Box>
  )
}

/*
 * Profilo nella finestra dei record (anteprima design-previews/bfp-base.html › Profilo): una pagina sola al posto
 * delle cinque schede. Testata con la foto (si cambia dal pulsante sull'avatar), «Modifica i dati» come azione
 * principale; al centro aspetto, sicurezza, permessi e attività; a lato dati personali e gruppi.
 */
export default function ProfileCard({ onClose }: { onClose: () => void }) {
  const { me, refreshMe } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const form = useDatiForm(me, refreshMe)
  const [editing, setEditing] = React.useState(false)
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [uploading, setUploading] = React.useState(false)
  if (!me) return null
  const avatar = async (file: File | null) => {
    setUploading(true)
    try {
      if (file) { const fd = new FormData(); fd.append('avatar', file); await api.patch('/me/', fd) } else await api.patch('/me/', { avatar: '' })
      await refreshMe(); toast.success(file ? 'Foto aggiornata.' : 'Foto rimossa.')
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setUploading(false) }
  }
  const v = form.v
  const changed = [v.first !== (me.first_name || ''), v.last !== (me.last_name || ''), v.email !== (me.email || ''), (v.cust?.id ?? null) !== (me.profile?.preferred_customer ?? null)].filter(Boolean).length
  const role = me.is_superuser ? 'Superuser' : me.is_staff ? 'Staff' : null
  const chip = (txt: React.ReactNode) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', bgcolor: 'rgb(255 255 255 / .12)', color: '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const openAudit = () => { onClose(); navigate(`/audit?actor=${me.id}`) }
  return (
    <RecordModal open onClose={onClose} ariaLabel="Profilo"
      avatar={
        <Box sx={{ position: 'relative', flex: 'none' }}>
          <Avatar src={me.profile?.avatar || undefined} sx={{ width: 56, height: 56, fontSize: 19, fontWeight: 750, bgcolor: '#e9f3f0', color: 'archie.band' }}>{initialsOf(me)}</Avatar>
          <Tooltip title="Cambia la foto">
            <IconButton component="label" size="small" aria-label="Cambia la foto" disabled={uploading}
              sx={{ position: 'absolute', right: -6, bottom: -4, width: 24, height: 24, bgcolor: '#fff', color: 'archie.band', border: '2px solid', borderColor: 'archie.band', '&:hover': { bgcolor: '#fff' } }}>
              {uploading ? <CircularProgress size={11} /> : <CampoIcon name="upload" size={12} />}
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) void avatar(f); e.currentTarget.value = '' }} />
            </IconButton>
          </Tooltip>
        </Box>
      }
      title={fullName(me)}
      status={<>{role ? <BandChip>{role}</BandChip> : null}{editing ? <BandEditing /> : null}</>}
      subtitle={<><Box component="span" sx={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 12 }}>@{me.username}</Box>{me.email ? ` · ${me.email}` : ''}</>}
      tags={<>
        {(me.groups ?? []).map((g) => <React.Fragment key={g}>{chip(g)}</React.Fragment>)}
        {me.last_login ? chip(<>ultimo accesso <b>{agoLabel(me.last_login)}</b></>) : null}
        {me.date_joined ? chip(<>in Archie da <b>{monthYear(me.date_joined)}</b></>) : null}
        {me.profile?.leave_area_label ? chip(<>area ferie <b>{me.profile.leave_area_label}</b></>) : null}
      </>}
      actions={<>
        {!editing ? <Button variant="outlined" onClick={() => setEditing(true)} startIcon={<CampoIcon name="columns" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Modifica i dati</Button> : null}
        <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" disabled={editing} onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem onClick={() => { setMenu(null); openAudit() }}><ListItemIcon><CampoIcon name="history" size={16} /></ListItemIcon>Tutta la mia attività nell'Audit</MenuItem>
          {me.profile?.avatar ? <MenuItem disabled={uploading} onClick={() => { setMenu(null); void avatar(null) }}><ListItemIcon><CampoIcon name="x" size={16} /></ListItemIcon>Togli la foto</MenuItem> : null}
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed : 0} saving={form.busy}
      onSave={() => { void form.save().then((ok) => { if (ok) setEditing(false) }) }}
      onDiscard={() => { form.reset(); setEditing(false) }}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Aspetto"><AspettoTab me={me} onSaved={refreshMe} /></RecordSection>
          <RecordSection title="Sicurezza"><SicurezzaTab /></RecordSection>
          <RecordSection title="Cosa puoi fare"><PermessiTab me={me} /></RecordSection>
          <RecordSection title="Attività recente"><AttivitaTab me={me} onOpenAudit={openAudit} /></RecordSection>
        </Box>
        <Box component="aside" aria-label="Dati personali" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <DatiRail key={me.id} me={me} form={form} editing={editing} />
          <GruppiBlock me={me} />
        </Box>
      </Box>
    </RecordModal>
  )
}
