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
const THEMES: Record<WeatherCondition, { isDay: { sky: string[]; ground: string }; isNight: { sky: string[]; ground: string } }> = {
  clear: {
    isDay:   { sky: ['#87CEEB', '#b8e4f7'], ground: '#4a7c59' },
    isNight: { sky: ['#0d1b3e', '#1a3a5c'], ground: '#2d4a3e' },
  },
  partly_cloudy: {
    isDay:   { sky: ['#a8d8ea', '#cce7f5'], ground: '#5a8a6a' },
    isNight: { sky: ['#1a2744', '#2a3f6e'], ground: '#2d4a3e' },
  },
  cloudy: {
    isDay:   { sky: ['#b0bec5', '#cfd8dc'], ground: '#607d6a' },
    isNight: { sky: ['#263238', '#37474f'], ground: '#2d4030' },
  },
  rain: {
    isDay:   { sky: ['#6e8fa0', '#90a8b8'], ground: '#3d5c4a' },
    isNight: { sky: ['#1c2a36', '#263545'], ground: '#1e3028' },
  },
  snow: {
    isDay:   { sky: ['#d8eaf5', '#e8f4fc'], ground: '#c8dce8' },
    isNight: { sky: ['#1e2d44', '#2a3d5a'], ground: '#8ab0c8' },
  },
  thunder: {
    isDay:   { sky: ['#4a5260', '#5a6070'], ground: '#2e3d30' },
    isNight: { sky: ['#0e1218', '#1a2030'], ground: '#1a2420' },
  },
}

// ─── SVG Scene Components ─────────────────────────────────────────────────────

function SunSVG({ x, y, r = 38, rays = true }: { x: number; y: number; r?: number; rays?: boolean }) {
  return (
    <g>
      {rays && Array.from({ length: 8 }, (_, i) => {
        const angle = (i * 45 * Math.PI) / 180
        return (
          <line
            key={i}
            x1={x + Math.cos(angle) * (r + 4)}
            y1={y + Math.sin(angle) * (r + 4)}
            x2={x + Math.cos(angle) * (r + 16)}
            y2={y + Math.sin(angle) * (r + 16)}
            stroke="#FFE082" strokeWidth="3" strokeLinecap="round"
          />
        )
      })}
      <circle cx={x} cy={y} r={r} fill="#FFD54F" />
      <circle cx={x} cy={y} r={r - 4} fill="#FFE082" />
    </g>
  )
}

function MoonSVG({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M ${x} ${y - 30} A 30 30 0 1 0 ${x + 24} ${y + 18} A 22 22 0 1 1 ${x} ${y - 30}`}
        fill="#e8d5a3" />
      {[{ cx: x - 8, cy: y - 8, r: 3 }, { cx: x + 10, cy: y + 10, r: 4 }, { cx: x - 2, cy: y + 18, r: 2 }].map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#c8b882" />
      ))}
    </g>
  )
}

function StarsSVG() {
  const stars = [
    { x: 40, y: 30, r: 1.5 }, { x: 120, y: 20, r: 1 }, { x: 200, y: 40, r: 2 },
    { x: 320, y: 15, r: 1.5 }, { x: 420, y: 35, r: 1 }, { x: 500, y: 20, r: 2 },
    { x: 580, y: 45, r: 1.5 }, { x: 650, y: 25, r: 1 }, { x: 720, y: 10, r: 2 },
    { x: 800, y: 30, r: 1.5 }, { x: 870, y: 18, r: 1 },
  ]
  return (
    <g>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={0.8} />
      ))}
    </g>
  )
}

function CloudSVG({ x, y, scale = 1, opacity = 1, color = 'white' }: { x: number; y: number; scale?: number; opacity?: number; color?: string }) {
  const s = scale
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={opacity}>
      <ellipse cx="0" cy="0" rx="55" ry="28" fill={color} />
      <ellipse cx="-30" cy="5" rx="35" ry="22" fill={color} />
      <ellipse cx="30" cy="5" rx="40" ry="24" fill={color} />
      <ellipse cx="0" cy="10" rx="60" ry="22" fill={color} />
    </g>
  )
}

function RainDropsSVG({ count = 12 }: { count?: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = 180 + (i % 6) * 90 + (i > 5 ? 45 : 0)
        const y = 145 + Math.floor(i / 6) * 40 + (i % 3) * 15
        return (
          <ellipse key={i} cx={x} cy={y} rx="2" ry="7"
            fill="#90caf9" opacity="0.7"
            transform={`rotate(-10, ${x}, ${y})`} />
        )
      })}
    </g>
  )
}

function SnowflakesSVG() {
  const positions = [
    { x: 200, y: 140 }, { x: 280, y: 160 }, { x: 360, y: 130 },
    { x: 440, y: 155 }, { x: 520, y: 145 }, { x: 600, y: 135 },
    { x: 240, y: 190 }, { x: 400, y: 185 }, { x: 560, y: 180 },
  ]
  return (
    <g fill="white" opacity="0.85">
      {positions.map((p, i) => (
        <text key={i} x={p.x} y={p.y} fontSize="14" textAnchor="middle">❄</text>
      ))}
    </g>
  )
}

function LightningBoltSVG({ x, y }: { x: number; y: number }) {
  return (
    <polygon
      points={`${x},${y} ${x - 12},${y + 28} ${x + 2},${y + 28} ${x - 8},${y + 54} ${x + 18},${y + 18} ${x + 4},${y + 18}`}
      fill="#FFE082" opacity="0.95"
    />
  )
}

// ─── Hills / Ground ───────────────────────────────────────────────────────────
function GroundSVG({ groundColor, condition, isNight }: { groundColor: string; condition: WeatherCondition; isNight: boolean }) {
  const isSnow = condition === 'snow'
  const hillColor = isSnow ? '#d8edf7' : groundColor
  const hillDark  = isSnow ? '#b8cede' : (isNight ? '#1a2e1e' : '#3a6b47')
  const treeColor = isNight ? '#0d2218' : (isSnow ? '#4a6e5a' : '#2d5e3a')
  const treeDark  = isNight ? '#091a10' : '#1e3d25'

  return (
    <g>
      {/* Back hill */}
      <ellipse cx="300" cy="240" rx="280" ry="80" fill={hillDark} opacity="0.6" />
      {/* Main ground */}
      <ellipse cx="480" cy="260" rx="420" ry="90" fill={hillColor} />
      <rect x="60" y="255" width="860" height="90" fill={hillColor} />

      {/* Trees left */}
      {[
        { x: 95, y: 218, h: 55 }, { x: 130, y: 225, h: 45 }, { x: 68, y: 230, h: 40 },
      ].map((t, i) => (
        <g key={i}>
          <polygon points={`${t.x},${t.y - t.h} ${t.x - 22},${t.y} ${t.x + 22},${t.y}`} fill={treeColor} />
          <polygon points={`${t.x},${t.y - t.h - 14} ${t.x - 16},${t.y - t.h + 18} ${t.x + 16},${t.y - t.h + 18}`} fill={treeDark} opacity="0.5" />
        </g>
      ))}

      {/* Trees right */}
      {[
        { x: 848, y: 220, h: 52 }, { x: 880, y: 230, h: 42 }, { x: 818, y: 228, h: 44 },
      ].map((t, i) => (
        <g key={i}>
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
            <g key={i}>
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
function WeatherScene({ condition, isNight }: { condition: WeatherCondition; isNight: boolean }) {
  const theme = THEMES[condition]
  const { sky, ground } = isNight ? theme.isNight : theme.isDay

  return (
    <svg viewBox="0 0 960 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="100%" stopColor={sky[1]} />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="960" height="300" fill="url(#skyGrad)" />

      {/* Stars (night only) */}
      {isNight && <StarsSVG />}

      {/* Sun / Moon */}
      {condition === 'clear' && !isNight && <SunSVG x={800} y={72} r={44} />}
      {condition === 'partly_cloudy' && !isNight && <SunSVG x={780} y={80} r={36} />}
      {isNight && <MoonSVG x={800} y={80} />}

      {/* Clouds */}
      {condition === 'partly_cloudy' && (
        <>
          <CloudSVG x={700} y={68} scale={1.1} color="white" opacity={0.95} />
          <CloudSVG x={200} y={55} scale={0.8} color="white" opacity={0.7} />
        </>
      )}
      {condition === 'cloudy' && (
        <>
          <CloudSVG x={680} y={55} scale={1.2} color={isNight ? '#455a64' : '#eceff1'} />
          <CloudSVG x={360} y={45} scale={1} color={isNight ? '#546e7a' : '#ffffff'} />
          <CloudSVG x={140} y={70} scale={0.85} color={isNight ? '#37474f' : '#cfd8dc'} />
        </>
      )}
      {condition === 'rain' && (
        <>
          <CloudSVG x={500} y={48} scale={1.3} color={isNight ? '#3d4f5a' : '#78909c'} />
          <CloudSVG x={260} y={42} scale={1.1} color={isNight ? '#4a5a66' : '#90a4ae'} />
          <CloudSVG x={740} y={52} scale={0.9} color={isNight ? '#384550' : '#607d8b'} />
          <RainDropsSVG count={14} />
        </>
      )}
      {condition === 'snow' && (
        <>
          <CloudSVG x={480} y={44} scale={1.3} color={isNight ? '#3d4f5a' : '#b0bec5'} />
          <CloudSVG x={240} y={38} scale={1} color={isNight ? '#455a64' : '#cfd8dc'} />
          <SnowflakesSVG />
        </>
      )}
      {condition === 'thunder' && (
        <>
          <CloudSVG x={500} y={40} scale={1.5} color={isNight ? '#263238' : '#546e7a'} />
          <CloudSVG x={240} y={38} scale={1.2} color={isNight ? '#1e2f38' : '#455a64'} />
          <CloudSVG x={760} y={44} scale={1.1} color={isNight ? '#1e2f38' : '#455a64'} />
          <LightningBoltSVG x={490} y={110} />
          <LightningBoltSVG x={640} y={100} />
          <RainDropsSVG count={10} />
        </>
      )}

      {/* Ground */}
      <GroundSVG groundColor={ground} condition={condition} isNight={isNight} />
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

export default function WeatherHeroCard() {
  const { me } = useAuth()
  const displayName = me
    ? (me.first_name?.trim() || me.username)
    : null

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
    if (!weather) return ['#87CEEB', '#b8e4f7']
    const t = THEMES[weather.condition]
    return weather.isNight ? t.isNight.sky : t.isDay.sky
  }, [weather])

  const textColor = React.useMemo(() => {
    if (!weather) return 'rgba(0,0,0,0.85)'
    return weather.isNight ? 'rgba(255,255,255,0.95)' : 'rgba(15,30,50,0.85)'
  }, [weather])

  const textMuted = React.useMemo(() => {
    if (!weather) return 'rgba(0,0,0,0.55)'
    return weather.isNight ? 'rgba(255,255,255,0.6)' : 'rgba(15,30,50,0.55)'
  }, [weather])

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        background: `linear-gradient(160deg, ${cardBg[0]} 0%, ${cardBg[1]} 100%)`,
        transition: 'background 0.8s ease',
        minHeight: 93,
        aspectRatio: '16/2.7',
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
            <WeatherScene condition={weather.condition} isNight={weather.isNight} />
          </Box>

          {/* Welcome text — bottom left */}
          {displayName && (
            <Box sx={{ position: 'absolute', bottom: 20, left: 24, zIndex: 2 }}>
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
                Bentornato,
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

          {/* Info meteo — top right */}
          <Box
            sx={{
              position: 'absolute',
              top: 18,
              right: 22,
              zIndex: 2,
              textAlign: 'right',
              backdropFilter: 'blur(2px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, justifyContent: 'flex-end' }}>
              <Typography
                sx={{
                  fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                  fontWeight: 800,
                  color: textColor,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {weather.temp}°
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: textColor, mb: 0.5 }}>C</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: textColor, letterSpacing: '0.04em' }}>
              Bologna
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: textMuted, mt: 0.25 }}>
              {weather.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.75, justifyContent: 'flex-end' }}>
              <Typography sx={{ fontSize: '0.68rem', color: textMuted }}>
                💨 {weather.windspeed} km/h
              </Typography>
              {weather.humidity != null && (
                <Typography sx={{ fontSize: '0.68rem', color: textMuted }}>
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
