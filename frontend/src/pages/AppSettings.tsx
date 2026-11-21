import * as React from 'react'
import { Box, Button, ButtonBase, Chip, CircularProgress, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { appSettingsApi, settingValues, type AppSettingsData, type SettingValue } from '../features/settings/appSettingsApi'
import { parseEmails } from '../features/settings/emails'
import { PageHead } from '../ui/campo'
import NotFound from './NotFound'

const EMAILS = 'contracts.reminder_emails'
const DEFAULT_DAYS = 'contracts.reminder_default_days'
const EVERY = 'contracts.reminder_every_days'
const M_EMAILS = 'maintenance.office_emails'
const EMAIL_KEYS = [EMAILS, M_EMAILS]
const navSx = { justifyContent: 'flex-start', gap: 1, height: 34, px: 1.25, borderRadius: '8px', fontSize: 13, fontWeight: 600, '&:hover': { bgcolor: 'archie.surface2' } } as const
const LEADS = [30, 60, 90, 180]
const card = { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px' } as const

/** Impostazioni di Archie (anteprima design-previews/ctr2-base.html, vista «Impostazioni»): configurazioni
 *  applicative, per sezione. Le vede il superuser e chi ha «Gestisce le impostazioni di Archie». */
export default function AppSettings() {
  const { hasPerm } = useAuth()
  if (!hasPerm(PERMS.core.manageAppSettings)) return <NotFound />
  return <AppSettingsPage />
}

function AppSettingsPage() {
  const toast = useToast()
  const [data, setData] = React.useState<AppSettingsData | null>(null)
  const [draft, setDraft] = React.useState<Record<string, SettingValue>>({})
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  React.useEffect(() => {
    appSettingsApi.get().then((d) => { setData(d); setDraft(settingValues(d)) }).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [toast])

  const saved = React.useMemo(() => (data ? settingValues(data) : {}), [data])
  const changed = Object.keys(draft).filter((k) => String(draft[k]) !== String(saved[k]))
  const emails = parseEmails(String(draft[EMAILS] ?? ''))
  const mEmails = parseEmails(String(draft[M_EMAILS] ?? ''))
  const savedEmails = parseEmails(String(saved[EMAILS] ?? '')).list
  const every = Number(draft[EVERY])
  const everyBad = !Number.isInteger(every) || every < 1 || every > 60
  const set = (k: string, v: SettingValue) => setDraft((d) => ({ ...d, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const body = Object.fromEntries(changed.map((k) => [k, EMAIL_KEYS.includes(k) ? String(draft[k]) : Number(draft[k])]))
      const d = await appSettingsApi.patch(body)
      setData(d); setDraft(settingValues(d))
      toast.success('Impostazioni salvate')
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setSaving(false) }
  }
  const sendTest = async () => {
    setTesting(true)
    try {
      const r = await appSettingsApi.testContractEmail()
      toast.success(`Email di prova inviata a ${r.sent_to.length} ${r.sent_to.length === 1 ? 'indirizzo' : 'indirizzi'}`)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setTesting(false) }
  }

  const help = { fontSize: 11.5, color: 'text.secondary' } as const
  const label = { fontSize: 12.5, fontWeight: 600 } as const

  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <PageHead title="Impostazioni di Archie" />
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: -1.5, display: 'flex', gap: 0.75, alignItems: 'center' }}>
        <LockOutlinedIcon sx={{ fontSize: 15 }} />Le vede il superuser e chi ha il permesso «Gestisce le impostazioni di Archie». Ogni modifica finisce nell'Audit.
      </Typography>

      {!data ? <CircularProgress size={22} /> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: '220px minmax(0, 720px)' }, gap: 2.5, alignItems: 'start' }}>
          <Box component="nav" aria-label="Sezioni" sx={{ display: 'grid', gap: 0.5 }}>
            <ButtonBase onClick={() => document.getElementById('set-contracts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} sx={navSx}>
              <DescriptionOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />Contratti
            </ButtonBase>
            <ButtonBase onClick={() => document.getElementById('set-maintenance')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} sx={navSx}>
              <BuildOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />Manutenzione
            </ButtonBase>
          </Box>

          <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Box component="section" aria-labelledby="set-contracts" sx={{ ...card, p: { xs: 2, sm: 2.5 }, display: 'grid', gap: 2.25, scrollMarginTop: 16 }}>
            <Box>
              <Typography id="set-contracts" component="h2" sx={{ fontSize: 16, fontWeight: 650 }}>Promemoria di rinnovo</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.5, mt: 0.5 }}>
                Per ogni contratto attivo, dalla data dell'avviso parte un'email per contratto al venditore e agli indirizzi qui sotto, poi una ogni {everyBad ? '…' : every} giorni finché il contratto non viene rinnovato o chiuso.
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.75 }}>
              <TextField label="Indirizzi dell'ufficio" multiline minRows={2} value={String(draft[EMAILS] ?? '')} onChange={(e) => set(EMAILS, e.target.value)}
                error={emails.invalid.length > 0} slotProps={{ htmlInput: { style: { fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12.5 } } }} />
              <Typography sx={help}>Uno o più indirizzi separati da «;». Ricevono ogni promemoria, anche dei contratti senza venditore.</Typography>
              {emails.list.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {emails.list.map((e) => <Chip key={e} size="small" icon={<MailOutlineRoundedIcon />} label={e} />)}
                </Box>
              ) : null}
              {emails.invalid.length ? (
                <Typography role="alert" sx={{ ...help, color: 'error.main', fontWeight: 600 }}>
                  {emails.invalid.length === 1 ? 'Questo indirizzo non è valido' : 'Questi indirizzi non sono validi'}: {emails.invalid.join(', ')}
                </Typography>
              ) : null}
            </Box>

            <Box sx={{ display: 'grid', gap: 0.75 }}>
              <Typography id="lbl-lead" sx={label}>Avviso predefinito per i nuovi contratti</Typography>
              <Box role="group" aria-labelledby="lbl-lead" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {LEADS.map((n) => {
                  const on = Number(draft[DEFAULT_DAYS]) === n
                  return (
                    <ButtonBase key={n} aria-pressed={on} onClick={() => set(DEFAULT_DAYS, n)} sx={{
                      height: 28, px: 1.25, borderRadius: 999, fontSize: 12.5, border: '1px solid', borderColor: on ? 'archie.fieldLine' : 'archie.borderStrong',
                      bgcolor: on ? 'archie.field' : 'background.paper', fontWeight: on ? 600 : 400, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                    }}>{n} giorni</ButtonBase>
                  )
                })}
              </Box>
              <Typography sx={help}>Proposto nel modulo «Nuovo contratto»; ogni contratto lo può cambiare.</Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.75, justifyItems: 'start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField label="Ripeti il promemoria ogni" type="number" size="small" value={draft[EVERY] ?? ''} onChange={(e) => set(EVERY, e.target.value)}
                  error={everyBad} sx={{ width: 220 }} slotProps={{ htmlInput: { min: 1, max: 60 } }} />
                <Typography sx={{ fontSize: 13 }}>giorni</Typography>
              </Box>
              <Typography sx={{ ...help, color: everyBad ? 'error.main' : 'text.secondary' }}>{everyBad ? 'Serve un numero tra 1 e 60.' : 'Fino alla data di fine del contratto compresa.'}</Typography>
            </Box>

            <Box sx={{ pt: 1.75, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button variant="outlined" startIcon={testing ? <CircularProgress size={14} /> : <MailOutlineRoundedIcon />} onClick={() => void sendTest()}
                disabled={testing || !savedEmails.length} title={savedEmails.length ? undefined : 'Salva prima gli indirizzi dell\'ufficio'}>
                Manda un'email di prova all'ufficio
              </Button>
            </Box>
          </Box>

          <Box component="section" aria-labelledby="set-maintenance" sx={{ ...card, p: { xs: 2, sm: 2.5 }, display: 'grid', gap: 2.25, scrollMarginTop: 16 }}>
            <Box>
              <Typography id="set-maintenance" component="h2" sx={{ fontSize: 16, fontWeight: 650 }}>Scadenze di manutenzione</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.5, mt: 0.5 }}>
                Alle 8:00, insieme al riepilogo giornaliero, gli indirizzi qui sotto ricevono un'email con le manutenzioni scadute e quelle dei prossimi 30 giorni — solo se c'è qualcosa di nuovo rispetto all'ultimo invio. Gli utenti vedono le scadenze nelle notifiche di Archie.
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              <TextField label="Indirizzi per le scadenze" multiline minRows={2} value={String(draft[M_EMAILS] ?? '')} onChange={(e) => set(M_EMAILS, e.target.value)}
                error={mEmails.invalid.length > 0} slotProps={{ htmlInput: { style: { fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12.5 } } }} />
              <Typography sx={help}>Uno o più indirizzi separati da «;». Vuoto: nessuna email sulle scadenze di manutenzione.</Typography>
              {mEmails.list.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {mEmails.list.map((e) => <Chip key={e} size="small" icon={<MailOutlineRoundedIcon />} label={e} />)}
                </Box>
              ) : null}
              {mEmails.invalid.length ? (
                <Typography role="alert" sx={{ ...help, color: 'error.main', fontWeight: 600 }}>
                  {mEmails.invalid.length === 1 ? 'Questo indirizzo non è valido' : 'Questi indirizzi non sono validi'}: {mEmails.invalid.join(', ')}
                </Typography>
              ) : null}
            </Box>
          </Box>
          </Box>
        </Box>
      )}

      {changed.length ? (
        <Box role="status" sx={{ ...card, position: 'sticky', bottom: 12, maxWidth: 960, display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', boxShadow: 3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{changed.length} {changed.length === 1 ? 'modifica da salvare' : 'modifiche da salvare'}</Typography>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setDraft(saved)} disabled={saving}>Annulla</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving || emails.invalid.length > 0 || mEmails.invalid.length > 0 || everyBad}>Salva</Button>
        </Box>
      ) : null}
    </Box>
  )
}
