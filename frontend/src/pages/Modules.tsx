import * as React from 'react'
import { Box, Button, ButtonBase, Switch, TextField, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

import { useAuth } from '../auth/AuthProvider'
import { ALWAYS_ON, MODULES, MODULE_BY_KEY, type ModuleDef, type ModuleKey } from '../modules/moduleRegistry'
import { CampoDialog, CampoIcon, DetailSection, FloatingDetail, PageHead, useUndoToast } from '../ui/campo'

/**
 * Moduli (solo superuser, anteprima design-previews/mo-base.html, variante A · Elenco):
 * accendere e spegnere i moduli per tutti. Backend: /api/admin/modules/ (core/modules_api.py).
 */

type HistoryRow = { at: string; actor: string | null; enabled: boolean; reason: string }
type ModuleState = {
  key: ModuleKey
  label: string
  enabled: boolean
  reason: string
  changed_by: string | null
  changed_at: string | null
  history: HistoryRow[]
}

const GROUPS: ModuleDef['group'][] = ['Operatività', 'Anagrafiche', 'Conoscenza', 'Amministrazione', 'Sistema']

const fmtDate = (iso: string | null, withTime = false) => {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return withTime ? `${date} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : date
}

function StateChip({ on, small = false }: { on: boolean; small?: boolean }) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: small ? 20 : 22, px: 1, borderRadius: '5px',
      fontSize: small ? 11.5 : 12, fontWeight: 550, whiteSpace: 'nowrap',
      bgcolor: (t) => alpha(on ? t.palette.success.main : t.palette.warning.main, 0.12),
      color: on ? 'success.main' : 'warning.main',
      '&::before': {
        content: '""', width: 7, height: 7, borderRadius: '50%',
        ...(on ? { bgcolor: 'currentColor' } : { boxShadow: 'inset 0 0 0 1.6px currentColor' }),
      },
    }}>{on ? 'Attivo' : 'Spento'}</Box>
  )
}

function ItemList({ items, tone }: { items: string[]; tone: 'off' | 'on' }) {
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}>
      {items.map((x) => (
        <Box component="li" key={x} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45 }}>
          <Box component="span" sx={{ color: tone === 'off' ? 'warning.main' : 'success.main', display: 'inline-flex', mt: '1px', flex: 'none' }}>
            <CampoIcon name={tone === 'off' ? 'eyeOff' : 'check'} size={15} />
          </Box>
          {x}
        </Box>
      ))}
    </Box>
  )
}

type Maintenance = { active: boolean; message: string; default_message: string; changed_by: string | null; changed_at: string | null }

/** Modalità manutenzione: Archie chiuso a chi non è superuser, Portal aperto (backend: /api/admin/maintenance/). */
function MaintenanceSection() {
  const toast = useToast()
  const { refreshMe } = useAuth()
  const [m, setM] = React.useState<Maintenance | null>(null)
  const [confirm, setConfirm] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    api.get<Maintenance>('/admin/maintenance/').then((r) => setM(r.data)).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [toast])

  const apply = async () => {
    if (!m) return
    setBusy(true)
    try {
      const { data } = await api.patch<Maintenance>('/admin/maintenance/', { active: !m.active, message: m.active ? m.message : message.trim() })
      setM(data)
      setConfirm(false)
      await refreshMe()
      toast.success(data.active ? 'Modalità manutenzione attivata.' : 'Modalità manutenzione disattivata: Archie è di nuovo aperto a tutti.')
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const on = Boolean(m?.active)
  return (
    <Box component="section" sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1.25, mb: 2.25, borderRadius: '10px', border: '1px solid',
      borderColor: on ? (t) => alpha(t.palette.warning.main, 0.35) : 'divider',
      bgcolor: on ? (t) => alpha(t.palette.warning.main, 0.1) : 'background.paper',
    }}>
      <Box sx={{ width: 30, height: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', flex: 'none', bgcolor: on ? (t) => alpha(t.palette.warning.main, 0.16) : 'archie.neutralBg', color: on ? 'warning.main' : 'text.secondary' }}>
        <CampoIcon name="lock" size={16} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="h2" sx={{ fontSize: 13, fontWeight: 600 }}>Modalità manutenzione</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {on
            ? `Attiva${m?.changed_at ? ` dal ${fmtDate(m.changed_at, true)}` : ''}: solo i superuser entrano in Archie. «${m?.message || m?.default_message}»`
            : 'Chiude Archie a tutti tranne i superuser: il login viene rifiutato e chi è dentro viene fatto uscire. Il Portal clienti resta aperto.'}
        </Typography>
      </Box>
      <Switch checked={on} disabled={!m} onChange={() => { setMessage(''); setConfirm(true) }} slotProps={{ input: { 'aria-label': on ? 'Disattiva la modalità manutenzione' : 'Attiva la modalità manutenzione' } }} />

      <CampoDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={busy}
        width={460}
        labelId="maintenance-confirm-title"
        title={on ? 'Riaprire Archie a tutti?' : 'Attivare la modalità manutenzione?'}
        sub={on ? 'Gli utenti potranno di nuovo accedere.' : 'Chi non è superuser non potrà accedere e chi è già dentro verrà fatto uscire alla prossima azione. Il Portal clienti resta aperto.'}
        footer={(
          <>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setConfirm(false)} disabled={busy}>Annulla</Button>
            <Button variant="contained" color={on ? 'primary' : 'warning'} onClick={() => void apply()} disabled={busy}>
              {on ? 'Riapri Archie' : 'Attiva la manutenzione'}
            </Button>
          </>
        )}
      >
        {!on ? (
          <TextField
            label="Messaggio per gli utenti (facoltativo)" placeholder={m?.default_message} size="small" fullWidth multiline minRows={2}
            value={message} onChange={(e) => setMessage(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} sx={{ mt: 0.75 }}
            helperText="Compare nella pagina di login. Se lo lasci vuoto usiamo il messaggio predefinito."
          />
        ) : null}
      </CampoDialog>
    </Box>
  )
}

export default function Modules() {
  const toast = useToast()
  const undo = useUndoToast()
  const { refreshMe } = useAuth()
  const [rows, setRows] = React.useState<Record<string, ModuleState> | null>(null)
  const [sel, setSel] = React.useState<ModuleKey | null>(null)
  const [confirm, setConfirm] = React.useState<ModuleKey | null>(null)
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const { data } = await api.get<ModuleState[]>('/admin/modules/')
      setRows(Object.fromEntries(data.map((m) => [m.key, m])))
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }, [toast])
  React.useEffect(() => { void load() }, [load])

  const save = React.useCallback(async (key: ModuleKey, enabled: boolean, why = '') => {
    const { data } = await api.patch<ModuleState>(`/admin/modules/${key}/`, { enabled, reason: why })
    setRows((r) => (r ? { ...r, [key]: data } : r))
    await refreshMe()
    return data
  }, [refreshMe])

  const apply = async () => {
    if (!confirm || !rows) return
    const key = confirm
    const before = rows[key]
    const enabled = !before.enabled
    setBusy(true)
    try {
      await save(key, enabled, reason.trim())
      setConfirm(null)
      undo.show(`${MODULE_BY_KEY[key].label} ${enabled ? 'acceso per tutti' : 'spento'}`, async () => {
        try { await save(key, before.enabled, before.reason) } catch (e) { toast.error(apiErrorToMessage(e)) }
      })
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const ask = (key: ModuleKey) => { setReason(''); setConfirm(key) }
  const offCount = rows ? Object.values(rows).filter((m) => !m.enabled).length : 0
  const selDef = sel ? MODULE_BY_KEY[sel] : null
  const selRow = sel && rows ? rows[sel] : null
  const confirmDef = confirm ? MODULE_BY_KEY[confirm] : null
  const confirmOff = confirm && rows ? rows[confirm].enabled : false

  return (
    <Box sx={{ maxWidth: 920, pb: 4 }}>
      <PageHead
        title="Moduli"
        meta={rows ? (offCount ? `${offCount} ${offCount === 1 ? 'modulo spento' : 'moduli spenti'} su ${MODULES.length}` : `tutti i ${MODULES.length} moduli sono accesi`) : undefined}
      />

      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', px: 1.75, py: 1.25, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
        <Box sx={{ color: 'primary.main', display: 'inline-flex', mt: '2px' }}><CampoIcon name="lock" size={16} /></Box>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.55 }}>
          Un modulo spento sparisce per tutti gli utenti: menu, pagine, ricerca, widget, email e job automatici. I dati restano
          e tornano visibili quando lo riaccendi. Tu, come superuser, continui a vederlo con l'etichetta «spento» per provarlo
          prima del rilascio.
        </Typography>
      </Box>

      <MaintenanceSection />

      {GROUPS.map((g) => {
        const mods = MODULES.filter((m) => m.group === g)
        if (!mods.length) return null
        return (
          <Box key={g} component="section" sx={{ mb: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper', overflow: 'hidden' }}>
            <Typography component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.25, fontSize: 12, fontWeight: 650, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>
              {g}
              <Box component="span" sx={{ fontSize: 11, bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.75, lineHeight: '18px' }}>{mods.length}</Box>
            </Typography>
            {mods.map((m, i) => {
              const st = rows?.[m.key]
              const on = st ? st.enabled : true
              return (
                <Box key={m.key} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1.1,
                  borderTop: i ? '1px solid' : 'none', borderColor: 'divider',
                  bgcolor: sel === m.key ? 'archie.field' : 'transparent',
                }}>
                  <ButtonBase onClick={() => setSel(m.key)} aria-label={`Dettagli di ${m.label}`} sx={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-start', textAlign: 'left', borderRadius: '6px',
                    '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                  }}>
                    <Box sx={{ width: 30, height: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', flex: 'none', bgcolor: on ? 'archie.field' : 'archie.neutralBg', color: on ? 'primary.main' : 'text.disabled' }}>
                      <CampoIcon name={m.icon} size={16} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: on ? 'text.primary' : 'text.secondary' }}>{m.label}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</Typography>
                    </Box>
                    {!on && st ? (
                      <Box component="span" sx={{ display: { xs: 'none', md: 'inline-flex' }, alignItems: 'center', gap: 0.75, fontSize: 12, color: 'warning.main', whiteSpace: 'nowrap' }}>
                        <CampoIcon name="clock" size={14} />{st.reason || 'Spento'} · dal {fmtDate(st.changed_at)}
                      </Box>
                    ) : null}
                  </ButtonBase>
                  <StateChip on={on} />
                  <Switch checked={on} disabled={!rows} onChange={() => ask(m.key)} slotProps={{ input: { 'aria-label': `${on ? 'Spegni' : 'Accendi'} ${m.label}` } }} />
                </Box>
              )
            })}
          </Box>
        )
      })}

      <Box component="section" sx={{ mt: 2.75 }}>
        <Typography component="h2" sx={{ fontSize: 12, fontWeight: 650, color: 'text.secondary' }}>Sempre accesi</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.25, mb: 1 }}>Il cuore di Archie: gli altri moduli dipendono da questi e non si possono spegnere.</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {ALWAYS_ON.map((x) => (
            <Box key={x.label} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 28, px: 1.25, borderRadius: '6px', border: '1px solid', borderColor: 'divider', color: 'text.secondary', fontSize: 12.5 }}>
              <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex' }}><CampoIcon name={x.icon} size={14} /></Box>{x.label}
            </Box>
          ))}
        </Box>
      </Box>

      <FloatingDetail
        open={!!selDef}
        onClose={() => setSel(null)}
        idLabel="Modulo"
        status={selRow ? <StateChip on={selRow.enabled} small /> : null}
        title={selDef?.label ?? ''}
        subtitle={selDef?.description}
        ariaLabel="Dettaglio del modulo"
        footer={selDef && selRow ? (
          <Box sx={{ display: 'flex', width: '100%', justifyContent: 'flex-end' }}>
            {selRow.enabled
              ? <Button variant="outlined" color="error" startIcon={<CampoIcon name="eyeOff" size={15} />} onClick={() => ask(selDef.key)}>Spegni</Button>
              : <Button variant="contained" startIcon={<CampoIcon name="eye" size={15} />} onClick={() => ask(selDef.key)}>Accendi per tutti</Button>}
          </Box>
        ) : undefined}
      >
        {selDef && selRow ? (
          <>
            {!selRow.enabled ? (
              <DetailSection>
                <Box sx={{ px: 1.5, py: 1.25, borderRadius: '8px', bgcolor: (t) => alpha(t.palette.warning.main, 0.12) }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'warning.main' }}>Spento dal {fmtDate(selRow.changed_at, true)}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {[selRow.changed_by, selRow.reason].filter(Boolean).join(' · ')}{selRow.changed_by || selRow.reason ? '. ' : ''}Gli utenti non lo vedono; tu sì.
                  </Typography>
                </Box>
              </DetailSection>
            ) : null}
            <DetailSection title={selRow.enabled ? 'Se lo spegni, sparisce' : 'Cosa è spento'}>
              <ItemList items={selDef.goes} tone="off" />
            </DetailSection>
            {selDef.stays.length ? (
              <DetailSection title="Resta acceso per gli altri moduli">
                <ItemList items={selDef.stays} tone="on" />
              </DetailSection>
            ) : null}
            <DetailSection title="I dati">
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.5 }}>
                Nessun dato viene cancellato: tornano visibili quando il modulo si riaccende.
              </Typography>
            </DetailSection>
            <DetailSection title="Storico">
              {selRow.history.length ? (
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
                  {selRow.history.map((h) => (
                    <Box component="li" key={h.at} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', fontSize: 12.5 }}>
                      <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex', mt: '1px' }}><CampoIcon name={h.enabled ? 'eye' : 'eyeOff'} size={15} /></Box>
                      <Box sx={{ flex: 1 }}>
                        {h.actor ?? 'Qualcuno'} {h.enabled ? 'ha acceso' : 'ha spento'} il modulo
                        {h.reason ? <Box component="i" sx={{ color: 'text.secondary' }}> · {h.reason}</Box> : null}
                      </Box>
                      <Box component="time" sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>{fmtDate(h.at, true)}</Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Sempre acceso dal rilascio.</Typography>
              )}
            </DetailSection>
          </>
        ) : null}
      </FloatingDetail>

      <CampoDialog
        open={!!confirmDef}
        onClose={() => setConfirm(null)}
        busy={busy}
        width={460}
        labelId="module-confirm-title"
        title={confirmDef ? `${confirmOff ? 'Spegnere' : 'Accendere'} ${confirmDef.label}?` : ''}
        sub={confirmOff
          ? 'Sparisce per tutti tranne i superuser. Nessun dato viene cancellato.'
          : 'Da subito tutti gli utenti con i permessi del modulo lo vedono nel menu e ricevono di nuovo le email.'}
        footer={(
          <>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setConfirm(null)} disabled={busy}>Annulla</Button>
            <Button variant="contained" color={confirmOff ? 'error' : 'primary'} onClick={() => void apply()} disabled={busy}>
              {confirmOff ? 'Spegni' : 'Accendi per tutti'}
            </Button>
          </>
        )}
      >
        {confirmDef && confirmOff ? (
          <>
            <Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: 'text.secondary', mb: 0.75 }}>Sparisce</Typography>
              <ItemList items={confirmDef.goes} tone="off" />
            </Box>
            {confirmDef.stays.length ? (
              <Box>
                <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: 'text.secondary', mb: 0.75 }}>Resta acceso</Typography>
                <ItemList items={confirmDef.stays} tone="on" />
              </Box>
            ) : null}
            <TextField
              label="Motivo (facoltativo)" placeholder="Es. in attesa del rilascio" size="small" fullWidth
              value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} sx={{ mt: 0.75 }}
            />
          </>
        ) : confirmDef ? (
          <Box>
            <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: 'text.secondary', mb: 0.75 }}>Torna visibile</Typography>
            <ItemList items={confirmDef.goes} tone="on" />
          </Box>
        ) : null}
      </CampoDialog>
    </Box>
  )
}
