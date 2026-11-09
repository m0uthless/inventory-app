import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon } from '../ui/campo'

const LoginBackground = React.lazy(() => import('../features/login/LoginBackground'))

// URL del Portale clienti (da variabile Vite, con ripiego).
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) ?? 'http://localhost:8081'
const VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev'
// Colore del Portale: è un prodotto distinto, con il suo blu (eccezione voluta al tema Archie).
const PORTAL = { light: '#1a6bb5', dark: '#6fa8e0', bgLight: '#e3eefa', bgDark: '#172a40' }

type Ambito = 'archie' | 'portal'

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function Field({ id, label, error, children }: { id: string; label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.6 }}>
      <Typography component="label" htmlFor={id} sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{
        display: 'flex', alignItems: 'center', height: 42, pl: 1.5, pr: 0.75, borderRadius: '9px', bgcolor: 'background.paper',
        border: '1px solid', borderColor: error ? 'error.main' : 'divider',
        '&:focus-within': { borderColor: error ? 'error.main' : 'primary.main', boxShadow: (t) => t.palette.archie.focusRing },
      }}>{children}</Box>
    </Box>
  )
}

/** Login di Archie (anteprima lg-base, variante D · Tinte animate). Il Portale clienti ha la sua login. */
export default function Login() {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [webgl] = React.useState(hasWebGL)
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/'

  const [ambito, setAmbito] = React.useState<Ambito>('archie')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [caps, setCaps] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const portal = ambito === 'portal'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password || loading) return
    setError(null)
    setLoading(true)
    try {
      await api.get('/auth/csrf/')
      await api.post('/auth/login/', { username: username.trim(), password, ...(portal ? { ambito: 'portal' } : {}) })
      if (portal) {
        window.location.assign(PORTAL_URL)
      } else {
        await refreshMe()
        navigate(from, { replace: true })
      }
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { detail?: string }; status?: number } })?.response
      const detail = resp?.data?.detail
      if (resp?.status === 401) setError('Nome utente o password non corretti.')
      else if (resp?.status === 403) setError(detail || 'Accesso non autorizzato.')
      else if (resp?.status === 429) setError('Troppi tentativi. Riprova tra qualche minuto.')
      else setError(detail || 'Il server non risponde. Controlla la connessione.')
    } finally {
      setLoading(false)
    }
  }
  const onKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false)

  const accent = portal ? (dark ? PORTAL.dark : PORTAL.light) : theme.palette.primary.main
  const segBtn = (on: boolean, isPortal: boolean) => ({
    height: 34, borderRadius: '7px', fontSize: 13, fontWeight: on ? 650 : 550,
    color: on ? (isPortal ? accent : 'primary.main') : 'text.secondary',
    bgcolor: on ? (isPortal ? (dark ? PORTAL.bgDark : PORTAL.bgLight) : 'archie.field') : 'transparent',
    '&.Mui-focusVisible': { boxShadow: (t: import('@mui/material').Theme) => t.palette.archie.focusRing },
  })

  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3, overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Sfondo: gradiente fisso subito, poi l'animazione (se il browser ha WebGL). */}
      <Box aria-hidden sx={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: dark ? 'linear-gradient(135deg, #1f5a4c, #173f37 55%, #2b4258)' : 'linear-gradient(135deg, #6fae9b, #c3e0d6 55%, #93acc4)',
        '& canvas': { display: 'block' },
      }}>
        {webgl ? <React.Suspense fallback={null}><LoginBackground dark={dark} still={still} /></React.Suspense> : null}
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, width: 'min(456px, 100%)' }}>
        <Box component="form" onSubmit={submit} aria-labelledby="login-title" sx={{
          p: { xs: '24px 20px 20px', sm: '30px 32px 26px' }, borderRadius: '16px',
          bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 88%, transparent)`,
          backdropFilter: 'blur(14px) saturate(1.1)', WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
          border: '1px solid', borderColor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 60%, transparent)`,
          boxShadow: '0 24px 60px -24px rgb(10 40 30 / .35), 0 2px 8px rgb(10 40 30 / .06)',
        }}>
          {/* Logo: sostituire /login-logo.svg con il logo definitivo. */}
          <Box component="img" src="/login-logo.svg" alt="Archie" sx={{ display: 'block', height: 48, width: 'auto', maxWidth: '100%', mb: 2.75 }} />
          <Typography component="h1" id="login-title" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>Accedi</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5, mb: 2.25 }}>Usa le credenziali aziendali.</Typography>

          <Box role="radiogroup" aria-label="Dove entri" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '10px', mb: 2 }}>
            <ButtonBase role="radio" aria-checked={!portal} onClick={() => setAmbito('archie')} sx={segBtn(!portal, false)}>Archie</ButtonBase>
            <ButtonBase role="radio" aria-checked={portal} onClick={() => setAmbito('portal')} sx={segBtn(portal, true)}>Portale clienti</ButtonBase>
          </Box>

          {error ? (
            <Box role="alert" sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: '9px 11px', borderRadius: '8px', bgcolor: 'error.light', color: 'error.main', fontSize: 12.5, mb: 1.75 }}>
              <CampoIcon name="alert" size={16} /><span>{error}</span>
            </Box>
          ) : null}

          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Field id="login-u" label="Nome utente" error={Boolean(error)}>
              <InputBase id="login-u" autoFocus autoComplete="username" placeholder="nome.cognome" value={username}
                onChange={(e) => setUsername(e.target.value)} onKeyUp={onKey} sx={{ flex: 1, fontSize: 14 }} />
            </Field>
            <Box>
              <Field id="login-p" label="Password" error={Boolean(error)}>
                <InputBase id="login-p" type={show ? 'text' : 'password'} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} onKeyUp={onKey} onKeyDown={onKey} sx={{ flex: 1, fontSize: 14 }} />
                <IconButton size="small" aria-label={show ? 'Nascondi la password' : 'Mostra la password'} aria-pressed={show} onClick={() => setShow(!show)} sx={{ width: 30, height: 30 }}>
                  <CampoIcon name={show ? 'eyeOff' : 'eye'} size={16} />
                </IconButton>
              </Field>
              {caps ? <Typography sx={{ fontSize: 11.5, color: 'warning.main', mt: 0.5 }}>⇪ Il blocco maiuscole è attivo</Typography> : null}
            </Box>
          </Box>

          <Button type="submit" variant="contained" fullWidth disabled={loading || !username.trim() || !password}
            endIcon={loading ? undefined : <CampoIcon name="arrowR" size={16} />}
            sx={{ mt: 2, height: 42, fontSize: 14, ...(portal ? { bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(.94)' } } : {}) }}>
            {loading ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Accesso in corso…</> : portal ? 'Entra nel Portale' : 'Entra'}
          </Button>

          <Typography sx={{ mt: 1.75, fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
            Problemi di accesso? Rivolgiti all'amministratore di Archie.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2.25, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', fontSize: 11.5, color: 'text.disabled' }}>
            <span>Biotron S.p.A.</span><span>v{VERSION}</span>
          </Box>
        </Box>
        <Typography sx={{ mt: 2.25, fontSize: 12, textAlign: 'center', color: dark ? 'rgba(255,255,255,.75)' : 'rgba(20,32,29,.75)' }}>
          Clienti, siti e sistemi dei clienti sanitari, in un solo posto.
        </Typography>
      </Box>
    </Box>
  )
}
