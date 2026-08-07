import * as React from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'

// ─── Open-Meteo WMO weather code → condition ─────────────────────────────────
type WeatherCondition = 'clear' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'thunder'

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0)                        return 'clear'
  if (code <= 2)                         return 'partly_cloudy'
  if (code <= 3)                         return 'cloudy'
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return 'rain'
  if ([71,73,75,77,85,86].includes(code)) return 'snow'
  if ([95,96,99].includes(code))         return 'thunder'
  return 'cloudy'
}

// ─── Theme palette per condizione ────────────────────────────────────────────
// Gradiente cielo a 3 stop (più atmosferico) + colore "glow" dell'orizzonte
// (una fascia di luce calda/fredda molto tenue appena sopra le colline, che
// dà profondità alla scena senza appesantirla).
const THEMES: Record<
  WeatherCondition,
  {
    isDay: { sky: string[]; ground: string; horizonGlow: string }
    isNight: { sky: string[]; ground: string; horizonGlow: string }
  }
> = {
  clear: {
    isDay:   { sky: ['#5AA9E6', '#8FCBEE', '#CBEBFA'], ground: '#4a7c59', horizonGlow: '#FFE9B0' },
    isNight: { sky: ['#050b22', '#0f1f45', '#25406e'], ground: '#1c3327', horizonGlow: '#3a5a8c' },
  },
  partly_cloudy: {
    isDay:   { sky: ['#78B9E8', '#A9D6F0', '#DDF0FA'], ground: '#5a8a6a', horizonGlow: '#FFF3C4' },
    isNight: { sky: ['#0c1730', '#182b52', '#2e4877'], ground: '#1f3a2c', horizonGlow: '#3f5f8f' },
  },
  cloudy: {
    isDay:   { sky: ['#94A6AE', '#B7C4CA', '#DCE4E7'], ground: '#607d6a', horizonGlow: '#E8EEF0' },
    isNight: { sky: ['#1c262b', '#2a363c', '#3c4a51'], ground: '#20302a', horizonGlow: '#4a5a60' },
  },
  rain: {
    isDay:   { sky: ['#526B7A', '#6E8A99', '#93AAB6'], ground: '#3d5c4a', horizonGlow: '#B8C8CE' },
    isNight: { sky: ['#101820', '#1a2732', '#263844'], ground: '#182620', horizonGlow: '#33454e' },
  },
  snow: {
    isDay:   { sky: ['#B9D2E0', '#D3E6F0', '#F0F8FC'], ground: '#c8dce8', horizonGlow: '#FFFFFF' },
    isNight: { sky: ['#141f30', '#22344a', '#3a5068'], ground: '#5c7889', horizonGlow: '#7fa0b8' },
  },
  thunder: {
    isDay:   { sky: ['#333B47', '#4A5460', '#63707C'], ground: '#2e3d30', horizonGlow: '#8892a0' },
    isNight: { sky: ['#07090f', '#12151e', '#1e2330'], ground: '#141d18', horizonGlow: '#2a3040' },
  },
}

const CONDITION_ICON: Record<WeatherCondition, string> = {
  clear: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  thunder: '⛈️',
}

// ─── Keyframes condivise (namespacate per-istanza per evitare collisioni se
// più di un widget è montato contemporaneamente, es. anteprima dashboard) ───
function SceneStyle({ uid }: { uid: string }) {
  return (
    <style>{`
      @keyframes whc-spin-${uid}      { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes whc-pulse-${uid}     { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }
      @keyframes whc-twinkle-${uid}   { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
      @keyframes whc-driftA-${uid}    { 0%, 100% { transform: translateX(0px); } 50% { transform: translateX(16px); } }
      @keyframes whc-driftB-${uid}    { 0%, 100% { transform: translateX(0px); } 50% { transform: translateX(-12px); } }
      @keyframes whc-bob-${uid}       { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
      @keyframes whc-fall-${uid}      { 0% { transform: translateY(-24px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(230px); opacity: 0; } }
      @keyframes whc-snowfall-${uid}  { 0% { transform: translate(0px,-24px); opacity: 0; } 10% { opacity: 0.95; } 90% { opacity: 0.95; } 100% { transform: translate(10px,230px); opacity: 0; } }
      @keyframes whc-flash-${uid}     { 0%, 92%, 100% { opacity: 0; } 93% { opacity: 0.9; } 94% { opacity: 0.1; } 96% { opacity: 0.7; } 97% { opacity: 0; } }
      @keyframes whc-bolt-${uid}      { 0%, 92% { opacity: 0; } 93% { opacity: 1; } 96% { opacity: 1; } 97% { opacity: 0; } 100% { opacity: 0; } }
      @keyframes whc-fadein-${uid}    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  )
}

// ─── SVG Scene Components ─────────────────────────────────────────────────────

function SunSVG({ x, y, r = 40, uid }: { x: number; y: number; r?: number; uid: string }) {
  const rays = 10
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Alone luminoso */}
      <circle r={r * 2.6} fill={`url(#sunGlow-${uid})`} style={{ animation: `whc-pulse-${uid} 6s ease-in-out infinite` }} />
      {/* Raggi rotanti */}
      <g style={{ animation: `whc-spin-${uid} 50s linear infinite`, transformOrigin: '0px 0px' }}>
        {Array.from({ length: rays }, (_, i) => {
          const angle = (i * (360 / rays) * Math.PI) / 180
          return (
            <line
              key={i}
              x1={Math.cos(angle) * (r + 6)}
              y1={Math.sin(angle) * (r + 6)}
              x2={Math.cos(angle) * (r + 20)}
              y2={Math.sin(angle) * (r + 20)}
              stroke="#FFE082" strokeWidth="3" strokeLinecap="round" opacity={0.85}
            />
          )
        })}
      </g>
      {/* Corpo */}
      <circle r={r} fill={`url(#sunBody-${uid})`} />
    </g>
  )
}

function MoonSVG({ x, y, uid }: { x: number; y: number; uid: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={54} fill={`url(#moonGlow-${uid})`} style={{ animation: `whc-pulse-${uid} 7s ease-in-out infinite` }} />
      <path
        d="M 0 -30 A 30 30 0 1 0 24 18 A 22 22 0 1 1 0 -30"
        fill={`url(#moonBody-${uid})`}
      />
      {[{ cx: -8, cy: -8, r: 3 }, { cx: 10, cy: 10, r: 4 }, { cx: -2, cy: 18, r: 2 }].map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#c8b882" opacity={0.55} />
      ))}
    </g>
  )
}

function StarsSVG({ uid }: { uid: string }) {
  const stars = [
    { x: 40, y: 30, r: 1.4, d: 0 }, { x: 120, y: 20, r: 1, d: 0.6 }, { x: 200, y: 42, r: 1.8, d: 1.2 },
    { x: 320, y: 15, r: 1.4, d: 1.8 }, { x: 420, y: 36, r: 1, d: 0.3 }, { x: 500, y: 18, r: 1.8, d: 2.4 },
    { x: 580, y: 46, r: 1.4, d: 0.9 }, { x: 650, y: 26, r: 1, d: 1.5 }, { x: 720, y: 10, r: 1.8, d: 2.1 },
    { x: 802, y: 30, r: 1.4, d: 0.4 }, { x: 872, y: 18, r: 1, d: 1.1 }, { x: 70, y: 70, r: 1.2, d: 1.9 },
    { x: 260, y: 66, r: 1, d: 0.7 }, { x: 620, y: 70, r: 1.2, d: 1.4 },
  ]
  return (
    <g>
      {stars.map((s, i) => (
        <circle
          key={i} cx={s.x} cy={s.y} r={s.r} fill="white"
          style={{ animation: `whc-twinkle-${uid} ${3 + (i % 3)}s ease-in-out ${s.d}s infinite` }}
        />
      ))}
      {/* un paio di stelline a 4 punte più grandi, per un tocco scintillante */}
      {[{ x: 150, y: 45 }, { x: 760, y: 55 }].map((s, i) => (
        <path
          key={`sp-${i}`}
          d={`M ${s.x} ${s.y - 5} L ${s.x + 1.4} ${s.y - 1.4} L ${s.x + 5} ${s.y} L ${s.x + 1.4} ${s.y + 1.4} L ${s.x} ${s.y + 5} L ${s.x - 1.4} ${s.y + 1.4} L ${s.x - 5} ${s.y} L ${s.x - 1.4} ${s.y - 1.4} Z`}
          fill="white"
          style={{ animation: `whc-twinkle-${uid} ${4 + i}s ease-in-out ${i}s infinite` }}
        />
      ))}
    </g>
  )
}

function CloudSVG({
  x, y, scale = 1, opacity = 1, color = 'white', uid, drift = 'A', duration = 16,
}: {
  x: number; y: number; scale?: number; opacity?: number; color?: string
  uid: string; drift?: 'A' | 'B'; duration?: number
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Il drift usa `style.animation` (CSS transform): va su un <g> dedicato
          senza attributo `transform` proprio, altrimenti la keyframe CSS
          sovrascriverebbe lo scale sottostante invece di comporsi con esso. */}
      <g style={{ animation: `whc-drift${drift}-${uid} ${duration}s ease-in-out infinite` }}>
        <g transform={`scale(${scale})`} opacity={opacity} filter={`url(#cloudShadow-${uid})`}>
          <ellipse cx="0" cy="0" rx="55" ry="28" fill={color} />
          <ellipse cx="-30" cy="5" rx="35" ry="22" fill={color} />
          <ellipse cx="30" cy="5" rx="40" ry="24" fill={color} />
          <ellipse cx="0" cy="10" rx="60" ry="22" fill={color} />
        </g>
      </g>
    </g>
  )
}

function RainDropsSVG({ uid, count = 16 }: { uid: string; count?: number }) {
  const drops = Array.from({ length: count }, (_, i) => ({
    x: 150 + ((i * 53) % 700),
    delay: -(i * 0.37) % 1.6,
    duration: 1 + (i % 4) * 0.18,
  }))
  return (
    <g>
      {drops.map((d, i) => (
        <g key={i} transform={`translate(${d.x},0)`}>
          <line
            x1={0} y1={0} x2={-4} y2={16}
            stroke="#BEE3FF" strokeWidth="2.2" strokeLinecap="round" opacity={0.75}
            style={{ animation: `whc-fall-${uid} ${d.duration}s linear ${d.delay}s infinite` }}
          />
        </g>
      ))}
    </g>
  )
}

function SnowflakesSVG({ uid, count = 14 }: { uid: string; count?: number }) {
  const flakes = Array.from({ length: count }, (_, i) => ({
    x: 140 + ((i * 61) % 700),
    r: 2 + (i % 3),
    delay: -(i * 0.5) % 3,
    duration: 4 + (i % 5) * 0.6,
  }))
  return (
    <g fill="white">
      {flakes.map((f, i) => (
        <circle
          key={i} cx={f.x} cy={0} r={f.r} opacity={0.9}
          style={{ animation: `whc-snowfall-${uid} ${f.duration}s linear ${f.delay}s infinite` }}
        />
      ))}
    </g>
  )
}

function LightningBoltSVG({ x, y, uid, delay = 0 }: { x: number; y: number; uid: string; delay?: number }) {
  return (
    <polygon
      points={`${x},${y} ${x - 12},${y + 28} ${x + 2},${y + 28} ${x - 8},${y + 54} ${x + 18},${y + 18} ${x + 4},${y + 18}`}
      fill="#FFE9A8"
      style={{ animation: `whc-bolt-${uid} 4.5s ease-in-out ${delay}s infinite`, filter: 'drop-shadow(0 0 6px rgba(255,230,140,0.9))' }}
    />
  )
}

// ─── Hills / Ground ───────────────────────────────────────────────────────────
function GroundSVG({ groundColor, condition, isNight, uid }: { groundColor: string; condition: WeatherCondition; isNight: boolean; uid: string }) {
  const isSnow = condition === 'snow'
  const hillColor = isSnow ? '#d8edf7' : groundColor
  const hillDark  = isSnow ? '#b8cede' : (isNight ? '#122015' : '#3a6b47')
  const treeColor = isNight ? '#0d2218' : (isSnow ? '#4a6e5a' : '#2d5e3a')
  const treeDark  = isNight ? '#091a10' : '#1e3d25'

  return (
    <g>
      {/* Fascia di foschia sopra l'orizzonte, per dare profondità */}
      <rect x="0" y="188" width="960" height="40" fill={`url(#horizonFade-${uid})`} />

      {/* Back hill */}
      <ellipse cx="300" cy="240" rx="280" ry="80" fill={hillDark} opacity="0.6" />
      {/* Main ground */}
      <ellipse cx="480" cy="260" rx="420" ry="90" fill={`url(#groundGrad-${uid})`} />
      <rect x="60" y="255" width="860" height="90" fill={hillColor} />

      {/* Trees left */}
      {[
        { x: 95, y: 218, h: 55 }, { x: 130, y: 225, h: 45 }, { x: 68, y: 230, h: 40 },
      ].map((t, i) => (
        <g key={i}>
          <ellipse cx={t.x} cy={t.y + 2} rx={20} ry={5} fill="#000" opacity={0.12} />
          <polygon points={`${t.x},${t.y - t.h} ${t.x - 22},${t.y} ${t.x + 22},${t.y}`} fill={treeColor} />
          <polygon points={`${t.x},${t.y - t.h - 14} ${t.x - 16},${t.y - t.h + 18} ${t.x + 16},${t.y - t.h + 18}`} fill={treeDark} opacity="0.5" />
        </g>
      ))}

      {/* Trees right */}
      {[
        { x: 848, y: 220, h: 52 }, { x: 880, y: 230, h: 42 }, { x: 818, y: 228, h: 44 },
      ].map((t, i) => (
        <g key={i}>
          <ellipse cx={t.x} cy={t.y + 2} rx={20} ry={5} fill="#000" opacity={0.12} />
          <polygon points={`${t.x},${t.y - t.h} ${t.x - 22},${t.y} ${t.x + 22},${t.y}`} fill={treeColor} />
          <polygon points={`${t.x},${t.y - t.h - 14} ${t.x - 16},${t.y - t.h + 18} ${t.x + 16},${t.y - t.h + 18}`} fill={treeDark} opacity="0.5" />
        </g>
      ))}

      {/* Flowers / snow patches */}
      {isSnow ? (
        <>
          <ellipse cx="220" cy="262" rx="30" ry="8" fill="white" opacity="0.5" />
          <ellipse cx="600" cy="260" rx="25" ry="7" fill="white" opacity="0.5" />
          <ellipse cx="750" cy="265" rx="20" ry="6" fill="white" opacity="0.4" />
        </>
      ) : (
        <>
          {[[230, 255], [320, 260], [620, 255], [720, 258]].map(([fx, fy], i) => (
            <g key={i} style={{ animation: `whc-bob-${uid} ${3 + i}s ease-in-out ${i * 0.4}s infinite` }}>
              <circle cx={fx} cy={fy} r="3" fill={i % 2 === 0 ? '#ff8a80' : '#ffcc02'} />
              <line x1={fx} y1={fy} x2={fx} y2={fy + 8} stroke="#4caf50" strokeWidth="1.5" />
            </g>
          ))}
        </>
      )}
    </g>
  )
}

// ─── Full Scene ───────────────────────────────────────────────────────────────
function WeatherScene({ condition, isNight, uid }: { condition: WeatherCondition; isNight: boolean; uid: string }) {
  const theme = THEMES[condition]
  const { sky, ground, horizonGlow } = isNight ? theme.isNight : theme.isDay

  return (
    <svg viewBox="0 0 960 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }}>
      <SceneStyle uid={uid} />
      <defs>
        <linearGradient id={`skyGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={sky[0]} />
          <stop offset="55%" stopColor={sky[1]} />
          <stop offset="100%" stopColor={sky[2]} />
        </linearGradient>
        <linearGradient id={`horizonFade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={horizonGlow} stopOpacity="0" />
          <stop offset="100%" stopColor={horizonGlow} stopOpacity={isNight ? 0.35 : 0.55} />
        </linearGradient>
        <linearGradient id={`groundGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ground} stopOpacity="0.85" />
          <stop offset="100%" stopColor={ground} />
        </linearGradient>
        <radialGradient id={`sunGlow-${uid}`}>
          <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFE082" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFE082" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sunBody-${uid}`} cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFF6D6" />
          <stop offset="55%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#FFB300" />
        </radialGradient>
        <radialGradient id={`moonGlow-${uid}`}>
          <stop offset="0%" stopColor="#dce9ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#dce9ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`moonBody-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6efd2" />
          <stop offset="100%" stopColor="#d9c98f" />
        </linearGradient>
        <filter id={`cloudShadow-${uid}`} x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="960" height="300" fill={`url(#skyGrad-${uid})`} />

      {/* Stars (night only) */}
      {isNight && <StarsSVG uid={uid} />}

      {/* Sun / Moon */}
      {condition === 'clear' && !isNight && <SunSVG x={800} y={72} r={44} uid={uid} />}
      {condition === 'partly_cloudy' && !isNight && <SunSVG x={780} y={80} r={36} uid={uid} />}
      {isNight && condition !== 'thunder' && <MoonSVG x={800} y={80} uid={uid} />}

      {/* Clouds */}
      {condition === 'partly_cloudy' && (
        <>
          <CloudSVG x={700} y={68} scale={1.1} color={isNight ? '#cfd8e6' : 'white'} opacity={0.95} uid={uid} drift="A" duration={17} />
          <CloudSVG x={200} y={55} scale={0.8} color={isNight ? '#aebbd0' : 'white'} opacity={0.7} uid={uid} drift="B" duration={13} />
        </>
      )}
      {condition === 'cloudy' && (
        <>
          <CloudSVG x={680} y={55} scale={1.2} color={isNight ? '#455a64' : '#eceff1'} uid={uid} drift="A" duration={20} />
          <CloudSVG x={360} y={45} scale={1} color={isNight ? '#546e7a' : '#ffffff'} uid={uid} drift="B" duration={15} />
          <CloudSVG x={140} y={70} scale={0.85} color={isNight ? '#37474f' : '#cfd8dc'} uid={uid} drift="A" duration={18} />
        </>
      )}
      {condition === 'rain' && (
        <>
          <CloudSVG x={500} y={48} scale={1.3} color={isNight ? '#3d4f5a' : '#78909c'} uid={uid} drift="A" duration={16} />
          <CloudSVG x={260} y={42} scale={1.1} color={isNight ? '#4a5a66' : '#90a4ae'} uid={uid} drift="B" duration={19} />
          <CloudSVG x={740} y={52} scale={0.9} color={isNight ? '#384550' : '#607d8b'} uid={uid} drift="A" duration={14} />
          <RainDropsSVG uid={uid} count={18} />
        </>
      )}
      {condition === 'snow' && (
        <>
          <CloudSVG x={480} y={44} scale={1.3} color={isNight ? '#5b7186' : '#b0bec5'} uid={uid} drift="A" duration={22} />
          <CloudSVG x={240} y={38} scale={1} color={isNight ? '#68829a' : '#cfd8dc'} uid={uid} drift="B" duration={17} />
          <SnowflakesSVG uid={uid} count={16} />
        </>
      )}
      {condition === 'thunder' && (
        <>
          <CloudSVG x={500} y={40} scale={1.5} color={isNight ? '#232c34' : '#546e7a'} uid={uid} drift="A" duration={13} />
          <CloudSVG x={240} y={38} scale={1.2} color={isNight ? '#1c252c' : '#455a64'} uid={uid} drift="B" duration={11} />
          <CloudSVG x={760} y={44} scale={1.1} color={isNight ? '#1c252c' : '#455a64'} uid={uid} drift="A" duration={15} />
          <LightningBoltSVG x={490} y={110} uid={uid} delay={0} />
          <LightningBoltSVG x={640} y={100} uid={uid} delay={1.6} />
          <RainDropsSVG uid={uid} count={14} />
          {/* Flash a schermo intero, sincronizzato (a grandi linee) con i fulmini */}
          <rect x="0" y="0" width="960" height="300" fill="#fff" style={{ animation: `whc-flash-${uid} 4.5s ease-in-out infinite`, mixBlendMode: 'overlay' }} />
        </>
      )}

      {/* Ground */}
      <GroundSVG groundColor={ground} condition={condition} isNight={isNight} uid={uid} />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
type WeatherData = {
  temp: number
  condition: WeatherCondition
  isNight: boolean
  description: string
  windspeed: number
  humidity?: number
}

const CONDITION_LABELS: Record<WeatherCondition, string> = {
  clear: 'Sereno',
  partly_cloudy: 'Parzialmente nuvoloso',
  cloudy: 'Nuvoloso',
  rain: 'Pioggia',
  snow: 'Neve',
  thunder: 'Temporale',
}

type Props = {
  /** Se true, riempie l'altezza del contenitore (`height: 100%`) invece di
   * calcolarla da `aspectRatio` in base alla larghezza. Usato solo dalla
   * griglia dashboard dinamica, dove il contenitore ha un'altezza fissa
   * (righe della griglia) che l'aspect-ratio ignorerebbe. Le altre chiamate
   * (hero mobile, fallback statico) restano ad aspect-ratio, comportamento
   * invariato. */
  fillHeight?: boolean
}

export default function WeatherHeroCard({ fillHeight = false }: Props = {}) {
  const { me } = useAuth()
  const displayName = me
    ? (me.first_name?.trim() || me.username)
    : null
  const greeting = me?.profile?.gender === 'F' ? 'Bentornata,' : 'Bentornato,'

  // Suffisso univoco per id/keyframes SVG — evita collisioni se più istanze
  // del widget sono montate contemporaneamente (es. anteprima dashboard).
  const uid = 'w' + React.useId().replace(/[^a-zA-Z0-9]/g, '')

  const [weather, setWeather] = React.useState<WeatherData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    // Bologna coordinates
    const lat = 44.4949
    const lon = 11.3426
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weathercode,windspeed_10m,is_day,relativehumidity_2m` +
      `&timezone=Europe%2FRome`
    )
      .then(r => r.json())
      .then(data => {
        const c = data.current
        const code = c.weathercode as number
        setWeather({
          temp:        Math.round(c.temperature_2m),
          condition:   wmoToCondition(code),
          isNight:     c.is_day === 0,
          description: CONDITION_LABELS[wmoToCondition(code)],
          windspeed:   Math.round(c.windspeed_10m),
          humidity:    c.relativehumidity_2m,
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const cardBg = React.useMemo(() => {
    if (!weather) return ['#5AA9E6', '#CBEBFA']
    const t = THEMES[weather.condition]
    const s = weather.isNight ? t.isNight.sky : t.isDay.sky
    return [s[0], s[s.length - 1]]
  }, [weather])

  const textColor = React.useMemo(() => {
    if (!weather) return 'rgba(0,0,0,0.85)'
    return weather.isNight ? 'rgba(255,255,255,0.95)' : 'rgba(15,30,50,0.88)'
  }, [weather])

  const textMuted = React.useMemo(() => {
    if (!weather) return 'rgba(0,0,0,0.55)'
    return weather.isNight ? 'rgba(255,255,255,0.65)' : 'rgba(15,30,50,0.6)'
  }, [weather])

  const glassSx = React.useMemo(
    () => ({
      backgroundColor: weather?.isNight ? 'rgba(15,25,45,0.32)' : 'rgba(255,255,255,0.22)',
      backdropFilter: 'blur(10px) saturate(140%)',
      WebkitBackdropFilter: 'blur(10px) saturate(140%)',
      border: '1px solid',
      borderColor: weather?.isNight ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.45)',
      boxShadow: '0 4px 18px rgba(0,0,0,0.10)',
    }),
    [weather?.isNight],
  )

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        background: `linear-gradient(160deg, ${cardBg[0]} 0%, ${cardBg[1]} 100%)`,
        transition: 'background 0.8s ease',
        ...(fillHeight
          ? { height: '100%' }
          : { minHeight: 93, aspectRatio: '16/2.7' }),
      }}
    >
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={32} sx={{ color: 'rgba(255,255,255,0.7)' }} />
        </Box>
      )}

      {error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            Meteo non disponibile
          </Typography>
        </Box>
      )}

      {weather && (
        <>
          {/* Illustrazione SVG */}
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <WeatherScene condition={weather.condition} isNight={weather.isNight} uid={uid} />
          </Box>

          {/* Welcome text — bottom left */}
          {displayName && (
            <Box
              sx={{
                position: 'absolute', bottom: 20, left: 24, zIndex: 2,
                animation: `whc-fadein-${uid} 0.5s ease-out both`,
              }}
            >
              <Typography
                sx={{
                  fontSize: 'clamp(1.1rem, 3vw, 1.7rem)',
                  fontWeight: 900,
                  color: textColor,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  textShadow: weather?.isNight
                    ? '0 1px 8px rgba(0,0,0,0.4)'
                    : '0 1px 6px rgba(255,255,255,0.5)',
                }}
              >
                {greeting}
              </Typography>
              <Typography
                sx={{
                  fontSize: 'clamp(1.6rem, 4.5vw, 2.6rem)',
                  fontWeight: 900,
                  color: textColor,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  textShadow: weather?.isNight
                    ? '0 2px 12px rgba(0,0,0,0.5)'
                    : '0 1px 8px rgba(255,255,255,0.6)',
                }}
              >
                {displayName}
              </Typography>
            </Box>
          )}

          {/* Info meteo — top right, pannello "vetro smerigliato" */}
          <Box
            sx={{
              position: 'absolute',
              top: 14,
              right: 16,
              zIndex: 2,
              textAlign: 'right',
              borderRadius: '12px',
              px: 1.5,
              py: 1,
              animation: `whc-fadein-${uid} 0.5s ease-out 0.1s both`,
              ...glassSx,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, justifyContent: 'flex-end' }}>
              <Typography
                sx={{
                  fontSize: 'clamp(1.8rem, 4.6vw, 2.9rem)',
                  fontWeight: 800,
                  color: textColor,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {weather.temp}°
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: textColor, mb: 0.5 }}>C</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: textColor, letterSpacing: '0.04em' }}>
              Bologna
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: textMuted, mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
              <span aria-hidden style={{ fontSize: '0.85rem', lineHeight: 1 }}>{CONDITION_ICON[weather.condition]}</span>
              {weather.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.25, mt: 0.75, justifyContent: 'flex-end' }}>
              <Typography sx={{ fontSize: '0.66rem', color: textMuted }}>
                💨 {weather.windspeed} km/h
              </Typography>
              {weather.humidity != null && (
                <Typography sx={{ fontSize: '0.66rem', color: textMuted }}>
                  💧 {weather.humidity}%
                </Typography>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}
