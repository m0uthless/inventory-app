import * as React from 'react'
import {
  alpha,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../auth/AuthProvider'

type Props = {
  open: boolean
  onUnlock: () => void
}

export default function LockScreen({ open, onUnlock }: Props) {
  const { me, login, logout } = useAuth()
  const [password, setPassword]   = React.useState('')
  const [showPwd, setShowPwd]     = React.useState(false)
  const [loading, setLoading]     = React.useState(false)
  const [error, setError]         = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Focus automatico all'apertura
  React.useEffect(() => {
    if (open) {
      setPassword('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open])

  const handleUnlock = async () => {
    if (!password.trim() || !me) return
    setLoading(true)
    setError(null)
    try {
      await login(me.username, password)
      setPassword('')
      onUnlock()
    } catch {
      setError('Password errata. Riprova.')
      setPassword('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await logout()
    } finally {
      window.location.assign('/login')
    }
  }

  if (!open) return null

  const displayName = me
    ? [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username
    : 'Utente'

  const initials = me
    ? ((me.first_name?.[0] ?? '') + (me.last_name?.[0] ?? '')).toUpperCase() || me.username[0].toUpperCase()
    : '?'

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a3d38 0%, #0f766e 50%, #134e4a 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Cerchi decorativi di sfondo */}
      <Box sx={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', top: -140, right: -100, bgcolor: alpha('#fff', 0.04), pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', bottom: -100, left: -80,  bgcolor: alpha('#fff', 0.04), pointerEvents: 'none' }} />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          width: '100%',
          maxWidth: 360,
          px: 3,
        }}
      >
        {/* Icona lock */}
        <Box
          sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: alpha('#fff', 0.12),
            border: `1px solid ${alpha('#fff', 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 0.5,
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 28, color: alpha('#fff', 0.9) }} />
        </Box>

        {/* Titolo */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Sessione bloccata
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.65) }}>
            Inserisci la password per continuare
          </Typography>
        </Box>

        {/* Avatar + nome utente */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={me?.profile?.avatar || undefined}
            sx={{
              width: 56, height: 56,
              bgcolor: alpha('#fff', 0.18),
              border: `2px solid ${alpha('#fff', 0.3)}`,
              fontSize: 20, fontWeight: 700, color: '#fff',
            }}
          >
            {initials}
          </Avatar>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: alpha('#fff', 0.55) }}>
            {me?.username}
          </Typography>
        </Box>

        {/* Campo password */}
        <TextField
          inputRef={inputRef}
          fullWidth
          type={showPwd ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') handleUnlock() }}
          error={Boolean(error)}
          helperText={error}
          disabled={loading}
          autoComplete="current-password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setShowPwd(v => !v)}
                  edge="end"
                  sx={{ color: alpha('#fff', 0.6), '&:hover': { color: '#fff' } }}
                >
                  {showPwd ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              bgcolor: alpha('#fff', 0.1),
              borderRadius: 1,
              '& fieldset': { borderColor: alpha('#fff', 0.25) },
              '&:hover fieldset': { borderColor: alpha('#fff', 0.45) },
              '&.Mui-focused fieldset': { borderColor: alpha('#fff', 0.7) },
            },
            '& .MuiInputBase-input::placeholder': { color: alpha('#fff', 0.45) },
            '& .MuiFormHelperText-root': { color: '#fca5a5', fontWeight: 600 },
          }}
        />

        {/* Bottone sblocca */}
        <Button
          fullWidth
          variant="contained"
          onClick={handleUnlock}
          disabled={loading || !password.trim()}
          sx={{
            py: 1.25,
            bgcolor: alpha('#fff', 0.18),
            color: '#fff',
            fontWeight: 700,
            borderRadius: 1,
            border: `1px solid ${alpha('#fff', 0.25)}`,
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: alpha('#fff', 0.28) },
            '&:disabled': { bgcolor: alpha('#fff', 0.08), color: alpha('#fff', 0.35) },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sblocca'}
        </Button>

        {/* Link logout */}
        <Button
          size="small"
          startIcon={<LogoutIcon fontSize="small" />}
          onClick={handleLogout}
          disabled={loading}
          sx={{
            color: alpha('#fff', 0.55),
            fontSize: '0.75rem',
            '&:hover': { color: alpha('#fff', 0.85), bgcolor: 'transparent' },
          }}
        >
          Esci e accedi con un altro account
        </Button>
      </Box>
    </Box>
  )
}
