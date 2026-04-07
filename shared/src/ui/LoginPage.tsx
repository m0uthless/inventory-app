/**
 * LoginPage — pagina di login condivisa tra frontend Archie e frontend AUSL BO.
 *
 * Fotografia di sfondo:
 *   Copia un file immagine in:
 *     frontend/public/login-bg.jpg
 *     frontend-auslbo/public/login-bg.jpg
 *   Il componente la cerca automaticamente a /login-bg.jpg.
 *   Se il file non esiste mostra il gradiente blu di fallback.
 */
import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputBase,
  Typography,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type Ambito = 'archie' | 'auslbo'

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

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label, type = 'text', value, onChange, onKeyDown,
  placeholder, autoFocus, endAdornment, accentColor, accentLight,
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
}) {
  const [focused, setFocused] = React.useState(false)
  return (
    <Box>
      <Typography sx={{
        fontSize: 11.5, fontWeight: 600, color: '#4B5563',
        mb: 0.6, letterSpacing: '0.2px',
      }}>
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

function AmbitoToggle({
  ambiti, selected, onChange,
}: {
  ambiti: AmbitoConfig[]
  selected: Ambito
  onChange: (a: Ambito) => void
}) {
  return (
    <Box>
      <Typography sx={{
        fontSize: 11.5, fontWeight: 600, color: '#4B5563',
        mb: 0.6, letterSpacing: '0.2px',
      }}>
        Ambito
      </Typography>
      <Box sx={{
        display: 'flex',
        border: '1px solid #DDE1E7',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        {ambiti.map((a, i) => {
          const active = selected === a.value
          return (
            <Box
              key={a.value}
              onClick={() => onChange(a.value)}
              sx={{
                flex: 1,
                py: 0.9,
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? '#fff' : '#6B7280',
                background: active ? a.color : 'transparent',
                borderLeft: i > 0 ? '1px solid #DDE1E7' : 'none',
                transition: 'background 0.18s, color 0.18s',
                userSelect: 'none',
              }}
            >
              {a.label}
            </Box>
          )
        })}
      </Box>
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
  const [photoBroken, setPhotoBroken] = React.useState(false)

  const current = ambiti.find((a) => a.value === ambito) ?? ambiti[0]

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

      {/* ── Sfondo a tutto schermo ── */}
      {!photoBroken ? (
        <Box
          component="img"
          src={BG_PHOTO}
          alt=""
          onError={() => setPhotoBroken(true)}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      ) : (
        /* Fallback gradiente */
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
      <Box sx={{
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
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              onKeyDown={onKeyDown}
              placeholder="••••••••"
              accentColor={current.color}
              accentLight={current.colorLight}
              endAdornment={
                <Box
                  component="span"
                  onClick={() => setShowPwd((v) => !v)}
                  sx={{
                    cursor: 'pointer', color: '#8A93A2',
                    display: 'flex', alignItems: 'center', pl: 0.5,
                  }}
                >
                  {showPwd
                    ? <VisibilityOffIcon sx={{ fontSize: 18 }} />
                    : <VisibilityIcon sx={{ fontSize: 18 }} />}
                </Box>
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
