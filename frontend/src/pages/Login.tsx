import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Box, Button, CircularProgress, InputBase, Typography, Link } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useAuth } from '../auth/AuthProvider'
import { isRecord } from '../utils/guards'

interface SystemStats {
  inventory_count: number
  uptime: string
  version: string
}

// ─── Costanti di stile non-tematizzate (solo per il layout specifico della login) ───
const BG = '#e8edeb'
const TEXT_DARK = '#1a2a28'
const TEXT_MUTED = '#5a7572'

// ─── Blob animato ─────────────────────────────────────────────────────────────
const blobKeyframes = `
  @keyframes loginBlobFloat {
    0%, 100% { transform: translateY(0) scale(1); }
    50%       { transform: translateY(-28px) scale(1.05); }
  }
  @keyframes loginSlideUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

function Blob({
  w,
  h,
  color,
  top,
  left,
  right,
  bottom,
  delay,
}: {
  w: number
  h: number
  color: string
  top?: number | string
  left?: number | string
  right?: number | string
  bottom?: number | string
  delay: number
}) {
  return (
    <Box
      sx={{
        position: 'absolute',
        width: w,
        height: h,
        borderRadius: '50%',
        background: color,
        filter: 'blur(72px)',
        opacity: 0.18,
        top,
        left,
        right,
        bottom,
        animation: `loginBlobFloat ${8 + delay}s ease-in-out ${delay}s infinite`,
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── Campo input custom (evita override MUI su sfondo bianco) ─────────────────
function Field({
  label,
  type = 'text',
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoFocus,
  endAdornment,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  onKeyDown?: React.KeyboardEventHandler
  placeholder?: string
  autoFocus?: boolean
  endAdornment?: React.ReactNode
}) {
  const [focused, setFocused] = React.useState(false)
  const theme = useTheme()
  const TEAL = theme.palette.primary.main

  return (
    <Box>
      <Typography
        component="label"
        sx={{
          display: 'block',
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: TEXT_MUTED,
          mb: 0.75,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          border: `1.5px solid ${focused ? TEAL : '#d4dbd9'}`,
          borderRadius: '8px',
          boxShadow: focused ? `0 0 0 4px rgba(15,118,110,0.1)` : 'none',
          transition: 'border-color 0.18s, box-shadow 0.18s',
          px: 2,
          py: 0,
        }}
      >
        <InputBase
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          sx={{
            flex: 1,
            py: '11px',
            fontSize: '0.9375rem',
            color: TEXT_DARK,
            fontFamily: 'inherit',
            '& input::placeholder': { color: '#a8b8b5', opacity: 1 },
          }}
        />
        {endAdornment}
      </Box>
    </Box>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const theme = useTheme()
  const TEAL = theme.palette.primary.main
  const TEAL_LIGHT = theme.palette.primary.light
  const TEAL_DARK = theme.palette.primary.dark

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [showPwd, setShowPwd] = React.useState(false)
  const [stats, setStats] = React.useState<SystemStats | null>(null)

  React.useEffect(() => {
    axios
      .get<SystemStats>('/api/system-stats/')
      .then((r) => setStats(r.data))
      .catch(() => {}) // silenzioso — la login funziona comunque
  }, [])

  const onSubmit = async () => {
    setErr(null)
    setBusy(true)
    try {
      await login(username, password)
      nav('/', { replace: true })
    } catch (e: unknown) {
      let msg = 'Credenziali non valide.'
      if (isRecord(e)) {
        const resp = e['response']
        if (isRecord(resp)) {
          const data = resp['data']
          if (isRecord(data) && typeof data['detail'] === 'string') {
            msg = data['detail']
          }
        }
      }
      setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Keyframes globali (iniettati una volta) */}
      <style>{blobKeyframes}</style>

      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          overflow: 'hidden',
          bgcolor: BG,
        }}
      >
        {/* ── PANNELLO SINISTRO ── */}
        <Box
          sx={{
            width: { xs: 0, md: '52%' },
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'flex-start',
            p: '52px 60px',
            background: TEAL_DARK,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Blob */}
          <Blob w={420} h={420} color="#31b2a6" top={-100} left={-80} delay={0} />
          <Blob w={280} h={280} color={TEAL_LIGHT} top="50%" right={-60} delay={-3} />
          <Blob w={200} h={200} color={TEAL} bottom={80} left="30%" delay={-5} />

          {/* Noise overlay (SVG inline data-uri) */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
              opacity: 0.35,
              pointerEvents: 'none',
            }}
          />

          {/* Contenuto */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* spacer che spinge tutto in basso */}
            <Box sx={{ flex: 1 }} />

            {/* ── ARCHIE IL GUFO ── allineato a sinistra col testo */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                mb: 3,
                opacity: 0.92,
                ml: '-8px',
              }}
            >
              <svg
                width="300"
                height="240"
                viewBox="0 0 420 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* SCHEDARIO SINISTRO */}
                <rect
                  x="18"
                  y="52"
                  width="88"
                  height="244"
                  rx="4"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  fill="none"
                />
                <rect
                  x="14"
                  y="44"
                  width="96"
                  height="14"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <rect
                  x="26"
                  y="68"
                  width="72"
                  height="52"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <rect
                  x="52"
                  y="91"
                  width="20"
                  height="6"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="26"
                  y="130"
                  width="72"
                  height="52"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <rect
                  x="52"
                  y="153"
                  width="20"
                  height="6"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="26"
                  y="192"
                  width="72"
                  height="52"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <rect
                  x="52"
                  y="215"
                  width="20"
                  height="6"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="22"
                  y="292"
                  width="80"
                  height="8"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="26"
                  y="298"
                  width="14"
                  height="8"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="84"
                  y="298"
                  width="14"
                  height="8"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />

                {/* LIBRERIA DESTRA */}
                <rect
                  x="314"
                  y="40"
                  width="92"
                  height="260"
                  rx="4"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  fill="none"
                />
                <rect
                  x="310"
                  y="32"
                  width="100"
                  height="14"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <line x1="314" y1="106" x2="406" y2="106" stroke="#e8edeb" strokeWidth="2.5" />
                <line x1="314" y1="186" x2="406" y2="186" stroke="#e8edeb" strokeWidth="2.5" />
                <line x1="314" y1="256" x2="406" y2="256" stroke="#e8edeb" strokeWidth="2.5" />
                {/* Top shelf: folder tabs */}
                <rect
                  x="322"
                  y="58"
                  width="16"
                  height="44"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="342"
                  y="52"
                  width="16"
                  height="50"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="362"
                  y="62"
                  width="16"
                  height="40"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="382"
                  y="56"
                  width="14"
                  height="46"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Mid shelf: books */}
                <rect
                  x="322"
                  y="118"
                  width="14"
                  height="64"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="340"
                  y="122"
                  width="12"
                  height="60"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="356"
                  y="114"
                  width="16"
                  height="68"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="376"
                  y="118"
                  width="10"
                  height="64"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="390"
                  y="122"
                  width="10"
                  height="60"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="329"
                  y1="118"
                  x2="329"
                  y2="182"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.4"
                />
                <line
                  x1="363"
                  y1="114"
                  x2="363"
                  y2="182"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.4"
                />
                {/* Lower shelf: binders */}
                <rect
                  x="322"
                  y="198"
                  width="20"
                  height="52"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="332"
                  y1="198"
                  x2="332"
                  y2="250"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.4"
                />
                <rect
                  x="348"
                  y="202"
                  width="16"
                  height="48"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <rect
                  x="370"
                  y="198"
                  width="28"
                  height="52"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="384"
                  y1="198"
                  x2="384"
                  y2="250"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.4"
                />

                {/* CORPO GUFO */}
                <ellipse
                  cx="210"
                  cy="218"
                  rx="68"
                  ry="80"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  fill="none"
                />
                <ellipse
                  cx="210"
                  cy="232"
                  rx="42"
                  ry="54"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.5"
                />
                <path
                  d="M188 206 Q210 200 232 206"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M182 222 Q210 215 238 222"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M184 238 Q210 231 236 238"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M188 254 Q210 247 232 254"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M192 268 Q210 263 228 268"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.4"
                />

                {/* TESTA */}
                <ellipse
                  cx="210"
                  cy="134"
                  rx="56"
                  ry="52"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  fill="none"
                />
                {/* Ciuffi auricolari */}
                <path
                  d="M170 100 Q158 72 172 84"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M174 96 Q165 70 178 80"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M250 100 Q262 72 248 84"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M246 96 Q255 70 242 80"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* OCCHIALI */}
                <line x1="192" y1="130" x2="228" y2="130" stroke="#e8edeb" strokeWidth="2.5" />
                <circle cx="182" cy="130" r="18" stroke="#e8edeb" strokeWidth="2.5" fill="none" />
                <circle cx="238" cy="130" r="18" stroke="#e8edeb" strokeWidth="2.5" fill="none" />
                <line
                  x1="164"
                  y1="126"
                  x2="152"
                  y2="122"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="256"
                  y1="126"
                  x2="268"
                  y2="122"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Occhi */}
                <circle cx="182" cy="130" r="9" fill="#e8edeb" />
                <circle cx="238" cy="130" r="9" fill="#e8edeb" />
                <circle cx="185" cy="128" r="3.5" fill="#0a4f4a" />
                <circle cx="241" cy="128" r="3.5" fill="#0a4f4a" />
                <circle cx="178" cy="125" r="2" fill="#0a4f4a" />
                <circle cx="234" cy="125" r="2" fill="#0a4f4a" />

                {/* Becco */}
                <path
                  d="M204 148 L210 158 L216 148 Z"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="#e8edeb"
                />

                {/* ALA SINISTRA con libro */}
                <path
                  d="M142 200 Q108 188 100 220 Q96 248 118 260 Q136 268 148 252 Q158 238 150 220 Z"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  d="M142 200 Q120 208 110 228"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                />
                <path
                  d="M145 212 Q126 220 118 242"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                />
                <rect
                  x="106"
                  y="224"
                  width="38"
                  height="46"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <line x1="116" y1="224" x2="116" y2="270" stroke="#e8edeb" strokeWidth="2" />
                <path
                  d="M116 228 Q132 225 144 228"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.6"
                />
                <line
                  x1="120"
                  y1="236"
                  x2="140"
                  y2="236"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <line
                  x1="120"
                  y1="242"
                  x2="140"
                  y2="242"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <line
                  x1="120"
                  y1="248"
                  x2="136"
                  y2="248"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <line
                  x1="120"
                  y1="254"
                  x2="140"
                  y2="254"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <line
                  x1="120"
                  y1="260"
                  x2="132"
                  y2="260"
                  stroke="#e8edeb"
                  strokeWidth="1"
                  opacity="0.6"
                />

                {/* ALA DESTRA con clipboard */}
                <path
                  d="M278 200 Q312 188 320 220 Q324 248 302 260 Q284 268 272 252 Q262 238 270 220 Z"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  d="M278 200 Q300 208 310 228"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                />
                <path
                  d="M275 212 Q294 220 302 242"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                />
                <rect
                  x="278"
                  y="218"
                  width="42"
                  height="56"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <rect
                  x="290"
                  y="210"
                  width="18"
                  height="12"
                  rx="3"
                  stroke="#e8edeb"
                  strokeWidth="2.5"
                  fill="none"
                />
                <rect
                  x="294"
                  y="208"
                  width="10"
                  height="6"
                  rx="2"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Checklist */}
                <rect
                  x="284"
                  y="230"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M285.5 233.5 L287 235.5 L290 231.5"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="295" y1="234" x2="315" y2="234" stroke="#e8edeb" strokeWidth="1.5" />
                <rect
                  x="284"
                  y="244"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M285.5 247.5 L287 249.5 L290 245.5"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="295" y1="248" x2="315" y2="248" stroke="#e8edeb" strokeWidth="1.5" />
                <rect
                  x="284"
                  y="258"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                />
                <line x1="295" y1="262" x2="315" y2="262" stroke="#e8edeb" strokeWidth="1.5" />
                <rect
                  x="284"
                  y="272"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="#e8edeb"
                  strokeWidth="1.5"
                  fill="none"
                />
                <line x1="295" y1="276" x2="310" y2="276" stroke="#e8edeb" strokeWidth="1.5" />

                {/* ZAMPE */}
                <path
                  d="M186 294 L178 310 M186 294 L186 312 M186 294 L194 310"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M234 294 L226 310 M234 294 L234 312 M234 294 L242 310"
                  stroke="#e8edeb"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Ground line */}
                <line
                  x1="140"
                  y1="316"
                  x2="280"
                  y2="316"
                  stroke="#e8edeb"
                  strokeWidth="2"
                  opacity="0.25"
                  strokeLinecap="round"
                />
              </svg>
            </Box>
            {/* Headline */}
            <Typography
              sx={{
                fontFamily: "'Playfair Display', 'Georgia', serif",
                fontSize: { md: '2.6rem', lg: '3rem' },
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.15,
                mb: 2.5,
              }}
            >
              <Box component="em" sx={{ fontStyle: 'italic', color: TEAL_LIGHT }}>
                Archie
              </Box>
              {', il tuo Repository, '}
              <Box component="em" sx={{ fontStyle: 'italic', color: TEAL_LIGHT }}>
                finalmente
              </Box>
              {' sotto controllo.'}
            </Typography>

            <Typography
              sx={{
                fontSize: '0.9375rem',
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 1.75,
                fontWeight: 300,
                whiteSpace: 'nowrap',
                mb: 4,
              }}
            >
              Gestisci inventario, clienti e knowledge base in un'unica piattaforma progettata per
              chi non ha tempo da perdere.
            </Typography>

            {/* Stat bar */}
            <Box
              sx={{
                display: 'flex',
                gap: 5,
                mt: 'auto',
                pt: 4,
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {[
                {
                  num: stats ? stats.inventory_count.toLocaleString('it-IT') : '…',
                  label: 'Inventory',
                },
                {
                  num: stats ? stats.uptime : '…',
                  label: 'Uptime',
                },
                {
                  num: stats ? stats.version : '…',
                  label: 'Versione',
                },
              ].map(({ num, label }) => (
                <Box key={label}>
                  <Typography
                    sx={{
                      fontFamily: "'Playfair Display', 'Georgia', serif",
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      color: '#fff',
                      lineHeight: 1,
                    }}
                  >
                    {num}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      color: 'rgba(255,255,255,0.38)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      mt: 0.5,
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* ── ARCO SVG divisore ── */}
        <Box
          component="svg"
          viewBox="0 0 80 900"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute',
            left: '52%',
            top: 0,
            height: '100%',
            width: 80,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <path d="M80,0 Q0,450 80,900 L0,900 L0,0 Z" fill={BG} />
        </Box>

        {/* ── PANNELLO DESTRO (form) ── */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 3, sm: 6 },
            py: 6,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 388,
              animation: 'loginSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            {/* Header form */}
            <Box sx={{ mb: 5 }}>
              {/* Su mobile mostra il logo */}
              <Box
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  alignItems: 'center',
                  gap: 1.5,
                  mb: 3,
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '8px',
                    bgcolor: TEAL,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  📦
                </Box>
                <Typography sx={{ fontWeight: 700, color: TEXT_DARK }}>Inventory</Typography>
              </Box>

              <Typography
                sx={{
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.13em',
                  color: TEAL,
                  fontWeight: 600,
                  mb: 1,
                }}
              >
                Site Repository
              </Typography>

              <Typography
                sx={{
                  fontFamily: "'Playfair Display', 'Georgia', serif",
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: TEXT_DARK,
                  lineHeight: 1.2,
                }}
              >
                Bentornato 👋
              </Typography>
            </Box>

            {/* Campi */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Field
                label="Utente"
                value={username}
                onChange={setUsername}
                placeholder="nome.cognome"
                autoFocus
              />

              <Box>
                <Field
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                  placeholder="••••••••"
                  endAdornment={
                    <Box
                      onClick={() => setShowPwd((p) => !p)}
                      aria-label={showPwd ? 'Nascondi password' : 'Mostra password'}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setShowPwd((p) => !p)}
                      sx={{
                        cursor: 'pointer',
                        color: TEXT_MUTED,
                        display: 'flex',
                        alignItems: 'center',
                        ml: 1,
                        opacity: 0.6,
                        '&:hover': { opacity: 1 },
                        '& .MuiSvgIcon-root': { fontSize: 18 },
                      }}
                    >
                      {showPwd ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </Box>
                  }
                />
              </Box>

              {/* Errore */}
              {err && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                    borderRadius: '8px',
                    bgcolor: 'rgba(220,38,38,0.07)',
                    border: '1px solid rgba(220,38,38,0.18)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.85rem', color: '#dc2626' }}>⚠ {err}</Typography>
                </Box>
              )}

              {/* Bottone */}
              <Button
                variant="contained"
                onClick={onSubmit}
                disabled={busy || !username || !password}
                fullWidth
                sx={{
                  mt: 0.5,
                  py: 1.6,
                  borderRadius: '8px',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  letterSpacing: '0.025em',
                  background: `linear-gradient(135deg, ${TEAL} 0%, #0ea5a4 100%)`,
                  boxShadow: `0 6px 20px rgba(15,118,110,0.3)`,
                  transition: 'transform 0.14s, box-shadow 0.2s',
                  '&:hover': {
                    background: `linear-gradient(135deg, #0d6560 0%, #0c9192 100%)`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 10px 28px rgba(15,118,110,0.38)`,
                  },
                  '&:active': { transform: 'translateY(0)' },
                  '&:disabled': {
                    background: '#c8d8d6',
                    color: '#fff',
                    boxShadow: 'none',
                  },
                }}
              >
                {busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Accedi →'}
              </Button>
            </Box>

            {/* Footer note */}
            <Typography
              sx={{
                textAlign: 'center',
                mt: 3.5,
                fontSize: '0.8125rem',
                color: TEXT_MUTED,
              }}
            >
              Problemi di accesso?{' '}
              <Link
                href="mailto:admin@example.com"
                underline="none"
                sx={{ color: TEAL, fontWeight: 600 }}
              >
                Contatta l'amministratore
              </Link>
            </Typography>
          </Box>

          {/* Version badge */}
          <Typography
            sx={{
              position: 'absolute',
              bottom: 20,
              right: 28,
              fontSize: '0.7rem',
              color: '#a8b8b5',
              letterSpacing: '0.06em',
            }}
          >
            {stats?.version ?? `v${import.meta.env.VITE_APP_VERSION ?? '0.5.0'}`}
          </Typography>
        </Box>
      </Box>
    </>
  )
}
