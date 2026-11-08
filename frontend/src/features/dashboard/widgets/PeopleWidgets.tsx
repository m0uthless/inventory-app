import * as React from 'react'
import { Box, Typography } from '@mui/material'
import CakeRoundedIcon from '@mui/icons-material/CakeRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import { api } from '@shared/api/client'
import type { TintKey } from '../../../theme/palettes'
import WidgetShell, { WidgetNote } from './WidgetShell'
import { tintVeil, tintedBg } from './tints'

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()

function Ava({ name, src, tone, size = 28 }: { name: string; src?: string | null; tone: TintKey; size?: number }) {
  return (
    <Box component="span" aria-hidden sx={{
      display: 'inline-grid', placeItems: 'center', flex: 'none', width: size, height: size, borderRadius: '50%', overflow: 'hidden', fontSize: Math.round(size * 0.39), fontWeight: 700, lineHeight: 1,
      color: (t) => t.palette.archie.tints[tone].ink, bgcolor: (t) => `color-mix(in srgb, ${t.palette.archie.tints[tone].mid} 24%, ${t.palette.background.paper})`,
    }}>{src ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}</Box>
  )
}

/** Persone in elenco: una colonna, o due affiancate se il widget è basso e largo. */
function People({ rows, tone }: { rows: { key: string | number; name: string; sub: React.ReactNode; src?: string | null }[]; tone: TintKey }) {
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

// ── Compleanni ─────────────────────────────────────────────────────────────

type BirthdayPerson = { user_id: number; name: string; avatar: string | null }
export function BirthdaysWidget() {
  const [people, setPeople] = React.useState<BirthdayPerson[] | null>(null)
  React.useEffect(() => { api.get<{ people: BirthdayPerson[] }>('/birthdays/').then((r) => setPeople(r.data.people ?? [])).catch(() => setPeople([])) }, [])
  return (
    <WidgetShell tone="peach" icon={CakeRoundedIcon} title="Compleanni" bodySx={{ px: 2, pb: 1.5 }}>
      {!people ? <WidgetNote>Caricamento…</WidgetNote> : !people.length ? <WidgetNote>Nessun compleanno oggi.</WidgetNote> : (
        <People tone="peach" rows={people.map((p) => ({ key: p.user_id, name: p.name, src: p.avatar, sub: <Box component="em" sx={{ fontStyle: 'normal', fontWeight: 650, color: (t) => t.palette.archie.tints.peach.ink }}>compie gli anni oggi</Box> }))} />
      )}
    </WidgetShell>
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
    <WidgetShell tone="peach" icon={GroupsRoundedIcon} title="Il team oggi" link={denied ? undefined : { label: 'Piano ferie', to: '/piano-ferie' }} bodySx={{ px: 2, pb: 1.5 }}>
      {!rows ? <WidgetNote>Caricamento…</WidgetNote> : denied ? <WidgetNote>Visibile a chi è nel Piano ferie.</WidgetNote> : !rows.length ? <WidgetNote>Oggi ci sono tutti.</WidgetNote> : (
        <People tone="peach" rows={rows.map((r) => ({ key: r.user, name: r.name, sub: [r.reason, r.part || r.until].filter(Boolean).join(' · ') }))} />
      )}
    </WidgetShell>
  )
}

// ── Contributor del mese (come in dev: coriandoli, trofeo, anello dorato; in pastello) ──

export type ContributorData = { user_id: number; name: string; username: string; avatar: string | null; pages_created: number }
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  i, left: `${4 + ((i * 5.7) % 92)}%`, size: 5 + ((i * 3) % 5), delay: `${((i * 0.31) % 2.4).toFixed(2)}s`, dur: `${(2.4 + ((i * 0.17) % 1.6)).toFixed(2)}s`, rot: (i * 47) % 360, shape: i % 3,
  tone: (['rose', 'sky', 'butter', 'lilac', 'mint'] as TintKey[])[i % 5],
}))

export function ContributorWidget() {
  const [c, setC] = React.useState<ContributorData | null | undefined>(undefined)
  React.useEffect(() => { api.get<{ monthly_contributor: ContributorData | null }>('/wiki-stats/').then((r) => setC(r.data.monthly_contributor)).catch(() => setC(null)) }, [])
  const month = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return (
    <Box component="section" aria-label="Contributor del mese" sx={{
      position: 'relative', height: '100%', width: '100%', overflow: 'hidden', borderRadius: '14px', display: 'flex',
      background: (t) => `linear-gradient(160deg, ${tintedBg(t, 'lilac', 85)} 0%, ${tintedBg(t, 'sky', 80)} 55%, ${tintedBg(t, 'mint', 85)} 100%)`,
      '@keyframes ctbFall': { '0%': { transform: 'translateY(-20px) rotate(var(--r))', opacity: 1 }, '80%': { opacity: 0.8 }, '100%': { transform: 'translateY(260px) rotate(calc(var(--r) + 720deg))', opacity: 0 } },
    }}>
      {c ? CONFETTI.map((k) => (
        <Box key={k.i} aria-hidden style={{ ['--r' as string]: `${k.rot}deg` }} sx={{
          position: 'absolute', top: -10, left: k.left, width: k.shape === 2 ? k.size * 2 : k.size, height: k.size, borderRadius: k.shape === 1 ? '50%' : '1px', opacity: 0.85,
          bgcolor: (t) => t.palette.archie.tints[k.tone].mid, animation: `ctbFall ${k.dur} ${k.delay} infinite linear`, pointerEvents: 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', top: 'auto', bottom: k.size * 3 },
        }} />
      )) : null}
      <EmojiEventsRoundedIcon aria-hidden sx={{ position: 'absolute', right: -12, bottom: -14, fontSize: 130, color: (t) => t.palette.archie.tints.sand.mid, opacity: 0.2 }} />
      <Box sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25, p: 1.5, textAlign: 'center' }}>
        <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: (t) => t.palette.archie.tints.sand.ink }}>
          <EmojiEventsRoundedIcon sx={{ fontSize: 18, color: (t) => t.palette.archie.tints.sand.mid }} />Contributor del mese
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25 }}>{month}</Typography>
        {c === undefined ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Caricamento…</Typography> : c === null ? (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Nessuna pagina wiki<br />creata questo mese</Typography>
        ) : (
          <>
            <Box sx={{ position: 'relative', width: 84, height: 84, mb: 1 }}>
              <Box aria-hidden sx={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2.5px solid', borderColor: (t) => t.palette.archie.tints.sand.mid, boxShadow: (t) => `0 0 18px ${tintVeil(t, 'sand', 45)}` }} />
              <Box sx={{ width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 700, color: (t) => t.palette.archie.tints.lilac.ink, bgcolor: (t) => `color-mix(in srgb, ${t.palette.background.paper} 75%, transparent)` }}>
                {c.avatar ? <Box component="img" src={c.avatar} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.name[0]?.toUpperCase()}
              </Box>
              <Box aria-hidden sx={{ position: 'absolute', right: -6, bottom: -6, width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: (t) => t.palette.archie.tints.sand.mid, boxShadow: '0 2px 6px rgb(16 40 34 / .25)' }}>
                <EmojiEventsRoundedIcon sx={{ fontSize: 13 }} />
              </Box>
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{c.name}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{c.pages_created} {c.pages_created === 1 ? 'pagina creata' : 'pagine create'}</Typography>
          </>
        )}
      </Box>
    </Box>
  )
}
