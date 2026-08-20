/**
 * LoginPage — pagina di login condivisa tra frontend Archie e frontend Portal.
 *
 * Sfondo (rotazione automatica):
 *   Copia una o più immagini in:
 *     frontend/public/login-bg-1.jpg, login-bg-2.jpg, ...
 *     frontend-portal/public/login-bg-1.jpg, login-bg-2.jpg, ...
 *   Il componente le cerca automaticamente in sequenza contigua a partire da
 *   login-bg-1.jpg (fino a un massimo di BG_ROTATION_MAX) e, se ne trova 2 o
 *   più, le fa ruotare con dissolvenza incrociata ogni BG_ROTATION_INTERVAL_MS
 *   (default 5s). Con una sola immagine numerata non c'è rotazione, resta
 *   fissa. Retrocompatibilità: se non esiste nessuna login-bg-N.jpg, ricade
 *   sulla singola immagine storica /login-bg.jpg. Se non esiste nulla, mostra
 *   il gradiente blu di fallback.
 */
import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputBase,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import DevEnvironmentBadge from './DevEnvironmentBadge'

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type Ambito = 'archie' | 'portal'

export interface AmbitoConfig {
  value: Ambito
  label: string
  color: string
  colorHover: string
  colorLight: string
}

export interface LoginPageProps {
  ambiti: AmbitoConfig[]
  defaultAmbito?: Ambito
  onLogin: (username: string, password: string, ambito: Ambito) => Promise<void>
  error?: string | null
  loading?: boolean
}

const BG_PHOTO = '/login-bg.jpg'

// ─── Rotazione sfondo login ─────────────────────────────────────────────────
// Convenzione: login-bg-1.jpg, login-bg-2.jpg, ... in public/ (per ciascun
// frontend). Vengono provate in parallelo fino al primo numero mancante
// (sequenza contigua a partire da 1). Se non ne esiste nessuna, si ricade
// sulla singola immagine storica /login-bg.jpg; se manca anche quella,
// gradiente di fallback. Con una sola immagine trovata non c'è rotazione.
const BG_ROTATION_MAX = 12
const BG_ROTATION_INTERVAL_MS = 5000
const BG_CROSSFADE_MS = 1400

function probeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

/** null = probing in corso, [] = nessuna immagine trovata, [...] = elenco pronto */
function useLoginBackgrounds(): string[] | null {
  const [images, setImages] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const candidates = Array.from(
      { length: BG_ROTATION_MAX },
      (_, i) => `/login-bg-${i + 1}.jpg`
    )
    Promise.all(candidates.map(probeImage)).then(async (results) => {
      if (cancelled) return
      const found: string[] = []
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) break
        found.push(candidates[i])
      }
      if (found.length > 0) {
        setImages(found)
        return
      }
      // Retrocompatibilità: nessuna immagine numerata, provo la singola storica
      const legacyOk = await probeImage(BG_PHOTO)
      if (!cancelled) setImages(legacyOk ? [BG_PHOTO] : [])
    })
    return () => { cancelled = true }
  }, [])

  return images
}

// ─── Field ────────────────────────────────────────────────────────────────────
// Fix accessibilità (audit 2026-07): label associata al campo tramite
// htmlFor/id — prima era un semplice Typography senza alcun legame
// semantico/ARIA con l'input, invisibile per screen reader e tecnologie
// assistive.

function Field({
  label, type = 'text', value, onChange, onKeyDown,
  placeholder, autoFocus, endAdornment, accentColor, accentLight,
  name, autoComplete,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  onKeyDown?: React.KeyboardEventHandler
  placeholder?: string
  autoFocus?: boolean
  endAdornment?: React.ReactNode
  accentColor: string
  accentLight: string
  name?: string
  autoComplete?: string
}) {
  const [focused, setFocused] = React.useState(false)
  const inputId = React.useId()
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={inputId}
        sx={{
          display: 'block',
          fontSize: 11.5, fontWeight: 600, color: '#4B5563',
          mb: 0.6, letterSpacing: '0.2px',
        }}
      >
        {label}
      </Typography>
      <Box sx={{
        display: 'flex', alignItems: 'center',
        border: `1px solid ${focused ? accentColor : '#DDE1E7'}`,
        borderRadius: '10px',
        px: 1.5,
        background: '#fff',
        boxShadow: focused ? `0 0 0 3px ${accentLight}` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <InputBase
          id={inputId}
          name={name}
          autoComplete={autoComplete}
          fullWidth
          autoFocus={autoFocus}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          sx={{ fontSize: 13.5, py: 1.0 }}
        />
        {endAdornment}
      </Box>
    </Box>
  )
}

// ─── AmbitoToggle ─────────────────────────────────────────────────────────────
// Fix accessibilità (audit 2026-07): prima erano due Box cliccabili senza
// ruolo, focus o gestione tastiera (Space/Enter). ToggleButtonGroup fornisce
// nativamente elementi <button> reali, focus visibile, Enter/Space e stato
// aria-pressed, mantenendo lo stesso aspetto tramite gli stessi valori sx.

function AmbitoToggle({
  ambiti, selected, onChange,
}: {
  ambiti: AmbitoConfig[]
  selected: Ambito
  onChange: (a: Ambito) => void
}) {
  const current = ambiti.find((a) => a.value === selected) ?? ambiti[0]
  return (
    <Box>
      <Typography
        component="span"
        id="ambito-toggle-label"
        sx={{
          display: 'block',
          fontSize: 11.5, fontWeight: 600, color: '#4B5563',
          mb: 0.6, letterSpacing: '0.2px',
        }}
      >
        Ambito
      </Typography>
      <ToggleButtonGroup
        value={selected}
        exclusive
        aria-labelledby="ambito-toggle-label"
        onChange={(_e, next: Ambito | null) => {
          if (next) onChange(next)
        }}
        sx={{
          display: 'flex',
          width: '100%',
          border: '1px solid #DDE1E7',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {ambiti.map((a, i) => {
          const active = selected === a.value
          return (
            <ToggleButton
              key={a.value}
              value={a.value}
              aria-label={a.label}
              sx={{
                flex: 1,
                py: 0.9,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                textTransform: 'none',
                color: active ? '#fff' : '#6B7280',
                background: active ? a.color : 'transparent',
                borderLeft: i > 0 ? '1px solid #DDE1E7' : 'none',
                borderRadius: 0,
                border: 'none',
                transition: 'background 0.18s, color 0.18s',
                '&:hover': {
                  background: active ? current.colorHover : 'rgba(0,0,0,0.03)',
                },
                '&.Mui-selected': {
                  color: '#fff',
                  background: a.color,
                  '&:hover': { background: a.colorHover },
                },
                '&.Mui-focusVisible': {
                  boxShadow: `inset 0 0 0 2px ${a.colorLight}`,
                },
              }}
            >
              {a.label}
            </ToggleButton>
          )
        })}
      </ToggleButtonGroup>
    </Box>
  )
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage({
  ambiti, defaultAmbito, onLogin, error, loading = false,
}: LoginPageProps) {
  const [ambito, setAmbito] = React.useState<Ambito>(
    defaultAmbito ?? ambiti[0]?.value ?? 'archie'
  )
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPwd, setShowPwd] = React.useState(false)
  const backgrounds = useLoginBackgrounds()
  const [bgIndex, setBgIndex] = React.useState(0)

  const current = ambiti.find((a) => a.value === ambito) ?? ambiti[0]

  React.useEffect(() => {
    if (!backgrounds || backgrounds.length < 2) return
    const id = window.setInterval(() => {
      setBgIndex((i) => (i + 1) % backgrounds.length)
    }, BG_ROTATION_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [backgrounds])

  const handleSubmit = () => {
    if (!username || !password) return
    onLogin(username, password, ambito)
  }

  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
    }}>
      <DevEnvironmentBadge />

      {/* ── Sfondo a tutto schermo (rotazione con dissolvenza incrociata) ── */}
      {backgrounds && backgrounds.length > 0 ? (
        <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {backgrounds.map((src, i) => {
            const isActive = i === bgIndex
            return (
              <Box
                key={src}
                component="img"
                src={src}
                alt=""
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  opacity: isActive ? 1 : 0,
                  transition: `opacity ${BG_CROSSFADE_MS}ms ease-in-out`,
                  willChange: 'opacity',
                }}
              />
            )
          })}
        </Box>
      ) : backgrounds === null ? (
        /* Probing in corso: gradiente come stato iniziale per evitare flash */
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg,#0B3D6B 0%,#1A6BB5 55%,#4A90D9 100%)',
        }} />
      ) : (
        /* Nessuna immagine trovata: fallback gradiente */
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg,#0B3D6B 0%,#1A6BB5 55%,#4A90D9 100%)',
        }} />
      )}

      {/* Overlay scuro per leggibilità */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.08) 100%)',
      }} />

      {/* ── Scritta in basso a sinistra ── */}
      {/* Fix responsive (audit 2026-07): nascosta sotto 'sm' per evitare
          sovrapposizione con la card login su schermi bassi/stretti
          (es. 320×568) — prima era sempre renderizzata in posizione assoluta
          indipendentemente dalla viewport. */}
      <Box sx={{
        display: { xs: 'none', sm: 'block' },
        position: 'absolute',
        bottom: 40,
        left: 48,
        zIndex: 2,
      }}>
        <Typography sx={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          mb: 0.75,
        }}>
          Gestionale clinico
        </Typography>
        <Typography sx={{
          fontSize: 36,
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          textShadow: '0 2px 12px rgba(0,0,0,0.35)',
        }}>
          ARCHIE
        </Typography>
        <Typography sx={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          mt: 0.75,
          lineHeight: 1.55,
        }}>
          Sistema integrato RIS/PACS<br />
          Area Metropolitana Bologna
        </Typography>
      </Box>

      {/* ── Card login — sovrapposta, spostata a destra ── */}
      <Box sx={{
        position: 'relative',
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: '100%',
        minHeight: '100vh',
        pr: { xs: 3, md: '7%' },
        pl: { xs: 3, md: 0 },
      }}>
        <Box sx={{
          width: '100%',
          maxWidth: 360,
          background: '#fff',
          borderRadius: '18px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
          p: { xs: 3, md: '36px 40px 32px' },
        }}>

          {/* Titolo */}
          <Box sx={{ mb: 3 }}>
            <Typography sx={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1A2332',
              letterSpacing: '-0.02em',
              mb: 0.4,
            }}>
              Bentornato
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#8A93A2' }}>
              Accedi con le tue credenziali
            </Typography>
          </Box>

          {/* Errore */}
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, fontSize: 12.5, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          {/* Campi */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Field
              label="Username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={setUsername}
              onKeyDown={onKeyDown}
              placeholder="mario.rossi"
              autoFocus
              accentColor={current.color}
              accentLight={current.colorLight}
            />
            <Field
              label="Password"
              name="password"
              autoComplete="current-password"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              onKeyDown={onKeyDown}
              placeholder="••••••••"
              accentColor={current.color}
              accentLight={current.colorLight}
              endAdornment={
                <IconButton
                  type="button"
                  size="small"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Nascondi password' : 'Mostra password'}
                  aria-pressed={showPwd}
                  sx={{
                    color: '#8A93A2', p: 0.5, ml: 0.5,
                  }}
                >
                  {showPwd
                    ? <VisibilityOffIcon sx={{ fontSize: 18 }} />
                    : <VisibilityIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              }
            />
            <AmbitoToggle
              ambiti={ambiti}
              selected={ambito}
              onChange={setAmbito}
            />
          </Box>

          {/* Bottone */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !username || !password}
            sx={{
              mt: 2.75,
              py: 1.25,
              background: current.color,
              fontWeight: 600,
              fontSize: 14,
              borderRadius: '10px',
              boxShadow: 'none',
              textTransform: 'none',
              '&:hover': { background: current.colorHover, boxShadow: 'none' },
              '&:disabled': { background: '#E5E7EB', color: '#9CA3AF' },
            }}
          >
            {loading
              ? <CircularProgress size={20} sx={{ color: '#fff' }} />
              : 'Accedi'}
          </Button>

          <Typography sx={{ mt: 2, textAlign: 'center', fontSize: 12, color: '#B0B8C4' }}>
            Problemi di accesso?{' '}
            <Box component="span" sx={{ color: current.color, cursor: 'default' }}>
              Contatta l'amministratore
            </Box>
          </Typography>

        </Box>
      </Box>

    </Box>
  )
}
