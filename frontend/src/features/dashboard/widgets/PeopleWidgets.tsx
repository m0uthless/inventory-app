import * as React from 'react'
import { Box, Typography, type Theme } from '@mui/material'
import CakeRoundedIcon from '@mui/icons-material/CakeRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import { api } from '@shared/api/client'
import type { DashTone } from '../../../theme/palettes'
import WidgetShell, { WidgetNote, WidgetOffChip } from './WidgetShell'
import { ANIM_CLASS } from './tints'

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()

function Ava({ name, src, tone, size = 28 }: { name: string; src?: string | null; tone: DashTone; size?: number }) {
  return (
    <Box component="span" aria-hidden sx={{
      display: 'inline-grid', placeItems: 'center', flex: 'none', width: size, height: size, borderRadius: '50%', overflow: 'hidden', fontSize: Math.round(size * 0.39), fontWeight: 700, lineHeight: 1,
      color: (t) => t.palette.archie.dash[tone].ink, bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 75%, transparent)`,
    }}>{src ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}</Box>
  )
}

/** Persone in elenco: una colonna, o due affiancate se il widget è basso e largo. */
function People({ rows, tone }: { rows: { key: string | number; name: string; sub: React.ReactNode; src?: string | null }[]; tone: DashTone }) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', overflow: 'hidden' }}>
      {rows.map((r) => (
        <Box component="li" key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
          <Ava name={r.name} src={r.src} tone={tone} />
          <Box sx={{ display: 'grid', minWidth: 0, lineHeight: 1.25 }}>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{r.name}</Typography>
            <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{r.sub}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/** Ritratto festeggiato (Contributor, Compleanno): anello nel verde, distintivo in basso a destra. Si adatta al riquadro. */
function Portrait({ name, src, badge, badgeBg, badgeInk, beat = false }: { name: string; src?: string | null; badge: React.ReactNode; badgeBg: (t: Theme) => string; badgeInk: (t: Theme) => string; beat?: boolean }) {
  return (
    <Box sx={{ position: 'relative', width: 'var(--av)', height: 'var(--av)', flex: 'none' }}>
      <Box aria-hidden className={beat ? ANIM_CLASS : undefined} sx={{
        position: 'absolute', inset: -5, borderRadius: '50%', border: '2px solid', borderColor: (t) => t.palette.archie.dash.verde.mid,
        boxShadow: (t) => `0 0 0 5px color-mix(in srgb, ${t.palette.archie.dash.verde.mid} 14%, transparent)`,
        ...(beat ? { animation: 'dashBeat 2.4s ease-in-out infinite', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } } : {}),
      }} />
      <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center', fontSize: 'calc(var(--av) * .36)', fontWeight: 700, bgcolor: 'background.paper', color: (t) => t.palette.archie.dash.verde.ink }}>
        {src ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
      </Box>
      <Box aria-hidden sx={{ position: 'absolute', right: -6, bottom: -4, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: badgeBg, color: badgeInk, boxShadow: '0 2px 6px rgb(16 40 34 / .2)', '& svg': { fontSize: 13 } }}>
        {badge}
      </Box>
    </Box>
  )
}

/** Riquadro festoso (Contributor, Compleanno): contenuto centrato, dimensioni che seguono il riquadro (1×2 o 2×2). */
const celebrationSx = {
  position: 'relative', height: '100%', width: '100%', overflow: 'hidden', borderRadius: '12px', display: 'flex', containerType: 'size',
  '--av': '58px', '@container (min-width: 300px) and (min-height: 220px)': { '--av': '80px' },
  '@keyframes dashBeat': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.06)' } },
} as const

// ── Compleanni: festeggia chi compie gli anni oggi (palloncini che salgono) ──

type BirthdayPerson = { user_id: number; name: string; avatar: string | null }
const BALLOONS = Array.from({ length: 7 }, (_, i) => ({
  i, left: `${6 + i * 14}%`, delay: `${((i * 0.9) % 4).toFixed(2)}s`, dur: `${(6 + ((i * 1.3) % 3)).toFixed(2)}s`, sway: i % 2 ? 6 : -6,
  tone: (['verde', 'postit', 'acciaio'] as const)[i % 3],
}))

export function BirthdaysWidget() {
  const [people, setPeople] = React.useState<BirthdayPerson[] | null>(null)
  React.useEffect(() => { api.get<{ people: BirthdayPerson[] }>('/birthdays/').then((r) => setPeople(r.data.people ?? [])).catch(() => setPeople([])) }, [])
  const first = people?.[0]
  if (!first) {
    return (
      <WidgetShell tone="salvia" look="tint" icon={CakeRoundedIcon} title="Compleanni" bodySx={{ px: 2, pb: 1.5 }}>
        <WidgetNote>{people ? 'Nessun compleanno oggi.' : 'Caricamento…'}</WidgetNote>
      </WidgetShell>
    )
  }
  const others = (people?.length ?? 1) - 1
  return (
    <Box component="section" aria-label="Compleanni di oggi" sx={{
      ...celebrationSx,
      background: (t) => `linear-gradient(165deg, color-mix(in srgb, ${t.palette.archie.dash.postit.bg} 75%, ${t.palette.background.paper}) 0%, ${t.palette.archie.dash.salvia.bg} 100%)`,
      '@keyframes dashBalloon': {
        '0%': { transform: 'translate(0, 0) rotate(-4deg)', opacity: 0 }, '12%': { opacity: 0.9 },
        '50%': { transform: 'translate(var(--sw), -130px) rotate(4deg)' }, '85%': { opacity: 0.9 },
        '100%': { transform: 'translate(0, -270px) rotate(-3deg)', opacity: 0 },
      },
    }}>
      {BALLOONS.map((b) => (
        <Box key={b.i} aria-hidden className={ANIM_CLASS} style={{ ['--sw' as string]: `${b.sway}px` }} sx={{
          position: 'absolute', bottom: -40, left: b.left, width: 16, height: 27, opacity: 0, pointerEvents: 'none',
          animation: `dashBalloon ${b.dur} ${b.delay} infinite cubic-bezier(.3, .1, .5, 1)`,
          color: (t) => t.palette.archie.dash[b.tone].mid,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.8, bottom: 8, display: b.i > 2 ? 'none' : 'block' },
        }}>
          <Box component="svg" viewBox="0 0 20 34" sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <ellipse cx="10" cy="10" rx="8" ry="10" fill="currentColor" />
            <path d="M10 20l-1.6 2.4h3.2z" fill="currentColor" />
            <path d="M10 22.5c-2 3 2 5 0 11" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".7" />
          </Box>
        </Box>
      ))}
      <Box sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 1.25, textAlign: 'center', minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1.5, color: (t) => t.palette.archie.dash.verde.ink }}>Buon compleanno!</Typography>
        <Portrait name={first.name} src={first.avatar} beat badge={<CakeRoundedIcon />} badgeBg={(t) => t.palette.archie.dash.postit.mid} badgeInk={(t) => t.palette.archie.dash.postit.ink} />
        <Typography sx={{ mt: 1.25, fontSize: 13, fontWeight: 700, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first.name}</Typography>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{others ? `e altri ${others} oggi` : 'compie gli anni oggi'}</Typography>
      </Box>
    </Box>
  )
}

// ── Il team oggi (assenze dal Piano ferie) ─────────────────────────────────

type Absence = { id: number; user: number; user_name: string; date: string; day_part: string; reason: string; reason_label: string; status: string }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function TeamWidget() {
  const [rows, setRows] = React.useState<{ user: number; name: string; reason: string; until: string; part: string }[] | null>(null)
  const [denied, setDenied] = React.useState(false)
  React.useEffect(() => {
    const today = new Date(); const end = new Date(); end.setDate(end.getDate() + 21)
    api.get<Absence[]>('/absences/', { params: { date_from: iso(today), date_to: iso(end) } })
      .then((r) => {
        const list = (Array.isArray(r.data) ? r.data : []).filter((a) => a.status !== 'rifiutata')
        const t = iso(today)
        const byUser = new Map<number, Absence[]>()
        list.forEach((a) => byUser.set(a.user, [...(byUser.get(a.user) ?? []), a]))
        const out: { user: number; name: string; reason: string; until: string; part: string }[] = []
        byUser.forEach((items) => {
          const todayItems = items.filter((a) => a.date === t)
          if (!todayItems.length) return
          // Fino a quando: giorni consecutivi (saltando sabato e domenica) a partire da oggi.
          const days = new Set(items.map((a) => a.date))
          const d = new Date(today); let last = new Date(today)
          for (let i = 0; i < 21; i++) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow === 0 || dow === 6) continue; if (days.has(iso(d))) last = new Date(d); else break }
          const part = todayItems.length === 1 ? (todayItems[0].day_part === 'mattina' ? 'solo mattina' : 'solo pomeriggio') : ''
          out.push({ user: todayItems[0].user, name: todayItems[0].user_name, reason: todayItems[0].reason_label, part, until: iso(last) === t ? '' : `fino a ${last.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}` })
        })
        setRows(out.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch((e) => { setRows([]); if (e?.response?.status === 403) setDenied(true) })
  }, [])
  return (
    <WidgetShell tone="acciaio" look="tint" icon={GroupsRoundedIcon} title="Il team oggi" link={denied ? undefined : { label: 'Piano ferie', to: '/piano-ferie' }} bodySx={{ px: 2, pb: 1.5 }}>
      {!rows ? <WidgetNote>Caricamento…</WidgetNote> : denied ? <WidgetNote>Visibile a chi è nel Piano ferie.</WidgetNote> : !rows.length ? <WidgetNote>Oggi ci sono tutti.</WidgetNote> : (
        <People tone="acciaio" rows={rows.map((r) => ({ key: r.user, name: r.name, sub: [r.reason, r.part || r.until].filter(Boolean).join(' · ') }))} />
      )}
    </WidgetShell>
  )
}

// ── Contributor del mese (coriandoli, trofeo, anello: nei verdi e nell'acciaio) ──

export type ContributorData = { user_id: number; name: string; username: string; avatar: string | null; pages_created: number }
const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  i, left: `${4 + ((i * 5.7) % 92)}%`, size: 5 + ((i * 3) % 4), delay: `${((i * 0.31) % 2.4).toFixed(2)}s`, dur: `${(2.6 + ((i * 0.17) % 1.6)).toFixed(2)}s`, rot: (i * 47) % 360, shape: i % 3,
  color: [(t: Theme) => t.palette.archie.dash.verde.mid, (t: Theme) => t.palette.archie.dash.acciaio.mid, (t: Theme) => t.palette.archie.dash.salvia.mid, (t: Theme) => t.palette.background.paper][i % 4],
}))

export function ContributorWidget() {
  const [c, setC] = React.useState<ContributorData | null | undefined>(undefined)
  React.useEffect(() => { api.get<{ monthly_contributor: ContributorData | null }>('/wiki-stats/').then((r) => setC(r.data.monthly_contributor)).catch(() => setC(null)) }, [])
  const month = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return (
    <Box component="section" aria-label="Contributor del mese" sx={{
      ...celebrationSx,
      background: (t) => `linear-gradient(165deg, ${t.palette.archie.dash.verde.bg} 0%, color-mix(in srgb, ${t.palette.archie.dash.acciaio.bg} 80%, ${t.palette.background.paper}) 100%)`,
      '@keyframes ctbFall': { '0%': { transform: 'translateY(-20px) rotate(var(--r))', opacity: 1 }, '80%': { opacity: 0.8 }, '100%': { transform: 'translateY(260px) rotate(calc(var(--r) + 720deg))', opacity: 0 } },
    }}>
      {c ? CONFETTI.map((k) => (
        <Box key={k.i} aria-hidden className={ANIM_CLASS} style={{ ['--r' as string]: `${k.rot}deg` }} sx={{
          position: 'absolute', top: -10, left: k.left, width: k.shape === 2 ? k.size * 2 : k.size, height: k.size, borderRadius: k.shape === 1 ? '50%' : '1px', opacity: 0.85,
          bgcolor: k.color, animation: `ctbFall ${k.dur} ${k.delay} infinite linear`, pointerEvents: 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', top: 'auto', bottom: k.size * 3 },
        }} />
      )) : null}
      <EmojiEventsRoundedIcon aria-hidden sx={{ position: 'absolute', right: -12, bottom: -12, fontSize: 'calc(var(--av) * 1.4)', color: (t) => t.palette.archie.dash.verde.mid, opacity: 0.12 }} />
      <Box sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 1.25, textAlign: 'center', minWidth: 0 }}>
        <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 700, color: (t) => t.palette.archie.dash.verde.ink }}>
          <EmojiEventsRoundedIcon sx={{ fontSize: 15, color: (t) => t.palette.archie.dash.verde.mid }} />Contributor del mese<WidgetOffChip />
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.5 }}>{month}</Typography>
        {c === undefined ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Caricamento…</Typography> : c === null ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna pagina wiki<br />creata questo mese</Typography>
        ) : (
          <>
            <Portrait name={c.name} src={c.avatar} badge={<EmojiEventsRoundedIcon />} badgeBg={(t) => t.palette.primary.main} badgeInk={(t) => t.palette.primary.contrastText} />
            <Typography sx={{ mt: 1.25, fontSize: 13, fontWeight: 700, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{c.pages_created} {c.pages_created === 1 ? 'pagina creata' : 'pagine create'}</Typography>
          </>
        )}
      </Box>
    </Box>
  )
}
