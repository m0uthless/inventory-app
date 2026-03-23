import * as React from 'react'
import { Box, Card } from '@mui/material'
import phrasesRaw from '../assets/phrases.txt?raw'

const TZ = 'Europe/Rome'

function parsePhrases(raw: string): string[] {
  return raw.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('#'))
}

function getDayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`
}

function pickPhrase(dayKey: string, phrases: string[]): string {
  let h = 0
  for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) >>> 0
  return phrases[h % phrases.length]
}

function getDateParts() {
  const now = new Date()
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('it-IT', { timeZone: TZ, ...opts }).format(now)
  return {
    weekday: fmt({ weekday: 'long' }),
    day:     fmt({ day: 'numeric' }),
    month:   fmt({ month: 'long' }),
    year:    fmt({ year: 'numeric' }),
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SERIF = '"Playfair Display", "Georgia", "Times New Roman", serif'

export default function CalendarCard() {
  const phrases = React.useMemo(() => {
    const p = parsePhrases(phrasesRaw)
    return p.length ? p : ['Oggi scegli una cosa sola e falla bene.']
  }, [])

  const [dayKey, setDayKey] = React.useState(getDayKey)
  const [parts, setParts]   = React.useState(getDateParts)

  React.useEffect(() => {
    const t = setInterval(() => {
      const dk = getDayKey()
      if (dk !== dayKey) { setDayKey(dk); setParts(getDateParts()) }
    }, 30_000)
    return () => clearInterval(t)
  }, [dayKey])

  const phrase = React.useMemo(() => pickPhrase(dayKey, phrases), [dayKey, phrases])

  return (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Fascia rossa top */}
      <Box sx={{ height: 7, bgcolor: '#9b2020', flexShrink: 0 }} />

      {/* Header: Sabato ←→ Marzo / 2026 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        px: 3,
        pt: 2,
        pb: 0,
      }}>
        <Box component="span" sx={{
          fontFamily: SERIF,
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'text.primary',
        }}>
          {cap(parts.weekday)}
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Box component="div" sx={{
            fontFamily: SERIF,
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1.1,
          }}>
            {cap(parts.month)}
          </Box>
          <Box component="div" sx={{
            fontFamily: SERIF,
            fontSize: '1rem',
            fontWeight: 400,
            color: 'text.secondary',
            lineHeight: 1.2,
          }}>
            {parts.year}
          </Box>
        </Box>
      </Box>

      {/* Numero del giorno — enorme, centrato, bold serif */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pt: 1,
        pb: 0,
      }}>
        <Box component="span" sx={{
          fontFamily: SERIF,
          fontSize: '9rem',
          fontWeight: 900,
          lineHeight: 0.95,
          letterSpacing: '-0.04em',
          color: '#0d1b2e',
          fontVariantNumeric: 'oldstyle-nums',
          userSelect: 'none',
        }}>
          {parts.day}
        </Box>
      </Box>

      {/* Divisore */}
      <Box sx={{ mx: 3, mt: 1.5, borderBottom: '1.5px solid', borderColor: 'divider' }} />

      {/* Frase — italic serif, grande, centrata */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        pt: 3,
        pb: 3.5,
      }}>
        <Box component="p" sx={{
          m: 0,
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: '1.25rem',
          lineHeight: 1.6,
          color: 'text.primary',
          textAlign: 'center',
        }}>
          {phrase}
        </Box>
      </Box>
    </Card>
  )
}
