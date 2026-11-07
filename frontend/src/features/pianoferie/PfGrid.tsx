import * as React from 'react'
import type { CSSObject } from '@mui/material/styles'
import { Box, type Theme } from '@mui/material'
import type { DayPart, RosterRow } from './pianoFerieShared'
import {
  REASON_LABEL, STATUS_LABEL, WD, covLevel, ddmm, parseIso, presentCount, swatchKey, swatchOfKey,
  type HalfCell, type OffCalendar, type PfPart, type PfRow, type SwatchKey,
} from './pfModel'
import { Ava } from './pfUi'
import { covColors, offStripes } from './pfStyle'

export type PfGroup = { key: string; label: string; areaId: number | null; people: RosterRow[] }

type Props = {
  days: string[]
  groups: PfGroup[]
  cells: Map<string, HalfCell>
  cal: OffCalendar
  today: string
  currentUserId: number | null
  reasonFilter: SwatchKey | null
  /** Id delle righe della richiesta aperta nel pannello. */
  selectedIds: Set<number>
  canEdit: (userId: number) => boolean
  onOpenRow: (row: PfRow) => void
  onCreate: (userId: number, from: string, to: string, part: PfPart) => void
}

type Drag = { person: number; from: string; to: string; parts: Set<DayPart> }

/** Vista Griglia (anteprima pf-base, A): persona × giorno, due mezze giornate per cella con la colonnina MAT/POM. */
export default function PfGrid({ days, groups, cells, cal, today, currentUserId, reasonFilter, selectedIds, canEdit, onOpenRow, onCreate }: Props) {
  const [drag, setDrag] = React.useState<Drag | null>(null)
  const dragRef = React.useRef<Drag | null>(null)
  const putDrag = (d: Drag | null) => { dragRef.current = d; setDrag(d) }

  React.useEffect(() => {
    const up = () => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      setDrag(null)
      const [lo, hi] = [d.from, d.to].sort()
      onCreate(d.person, lo, hi, d.parts.size === 2 ? 'all' : d.parts.has('mattina') ? 'mat' : 'pom')
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [onCreate])

  const partOfTarget = (el: Element): DayPart => (el.closest('.pf-pom') ? 'pomeriggio' : 'mattina')

  const onDown = (e: React.PointerEvent, person: number, day: string) => {
    if (e.button !== 0) return
    const target = e.target as Element
    if (target.closest('[data-row]')) return
    ;(target as HTMLElement).releasePointerCapture?.(e.pointerId)
    e.preventDefault()
    putDrag({ person, from: day, to: day, parts: new Set([partOfTarget(target)]) })
  }
  const onEnter = (e: React.PointerEvent, person: number, day: string) => {
    const d = dragRef.current
    if (!d || d.person !== person) return
    const part = partOfTarget(e.target as Element)
    if (d.to === day && d.parts.has(part)) return
    putDrag({ ...d, to: day, parts: new Set([...d.parts, part]) })
  }
  const inDrag = (person: number, day: string) => {
    if (!drag || drag.person !== person) return false
    const [lo, hi] = [drag.from, drag.to].sort()
    return day >= lo && day <= hi
  }

  const half = (r: PfRow | null, cls: string) => {
    if (!r) return <span className={`pf-h ${cls}`} />
    const k = swatchKey(r.reason, r.status)
    const sw = swatchOfKey(k)
    const dim = reasonFilter && reasonFilter !== k
    const hours = r.is_hourly && r.time_from && r.time_to ? ` · ${r.time_from.slice(0, 5)}–${r.time_to.slice(0, 5)}` : ''
    return (
      <span
        role="button" tabIndex={0} data-row={r.id}
        className={`pf-h ${cls} is-abs${r.status === 'proposta' ? ' is-prop' : ''}${r.status === 'rifiutata' ? ' is-rej' : ''}${dim ? ' is-dim' : ''}${selectedIds.has(r.id) ? ' is-sel' : ''}`}
        style={{ ['--bg' as string]: sw.bg, ['--fg' as string]: sw.fg }}
        title={`${r.user_name} · ${REASON_LABEL[r.reason]} · ${r.day_part === 'mattina' ? 'mattina' : 'pomeriggio'}${hours} · ${STATUS_LABEL[r.status]}`}
        onClick={() => onOpenRow(r)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenRow(r) } }}
      />
    )
  }

  return (
    <Box sx={gridSx} style={{ ['--n' as string]: days.length }} className={drag ? 'is-dragging' : undefined}>
      <div className="pf-row pf-hd">
        <span className="pf-name" />
        <span />
        {days.map((d) => {
          const hol = cal.holiday(d)
          const dt = parseIso(d)
          return (
            <span key={d} className={`pf-day${cal.isOff(d, null) || hol ? ' is-off' : ''}${d === today ? ' is-today' : ''}`} title={hol ?? undefined}>
              <b>{dt.getDate()}</b><small>{WD[dt.getDay()]}</small>
            </span>
          )
        })}
      </div>
      {groups.map((g) => (
        <div key={g.key} className="pf-grp">
          <div className="pf-row pf-covrow">
            <span className="pf-name"><b>{g.label}</b><small>presenti</small></span>
            <span />
            {days.map((d) => {
              if (cal.isOff(d, g.areaId)) return <span key={d} className="pf-c is-off" />
              const n = presentCount(g.people, d, cells)
              return <span key={d} className={`pf-c cov-${covLevel(n, g.people.length)}${d === today ? ' is-today' : ''}`} title={`${ddmm(d)} · ${n} presenti su ${g.people.length}`}>{n}</span>
            })}
          </div>
          {g.people.map((p) => {
            const editable = canEdit(p.id)
            return (
              <div key={p.id} className={`pf-row pf-person${p.id === currentUserId ? ' is-me' : ''}`}>
                <span className="pf-name"><Ava name={p.name} size={24} /><span className="nm">{p.name}</span></span>
                <span className="pf-parts" aria-hidden><i>MAT</i><i>POM</i></span>
                {days.map((d) => {
                  if (cal.isOff(d, p.area_id)) return <span key={d} className="pf-c is-off" title={cal.holiday(d) ?? undefined} />
                  const c = cells.get(`${p.id}|${d}`)
                  return (
                    <span key={d}
                      className={`pf-c${d === today ? ' is-today' : ''}${editable ? ' is-edit' : ''}${inDrag(p.id, d) ? ' is-drag' : ''}`}
                      onPointerDown={editable ? (e) => onDown(e, p.id, d) : undefined}
                      onPointerOver={editable ? (e) => onEnter(e, p.id, d) : undefined}
                    >
                      {half(c?.mat ?? null, 'pf-mat')}
                      {half(c?.pom ?? null, 'pf-pom')}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </Box>
  )
}

const gridSx = (t: Theme): CSSObject => {
  const a = t.palette.archie
  const cov = (lv: 'ok' | 'mid' | 'low') => { const c = covColors(t, lv); return { '--cv': c.fg, '--cvb': c.bg } }
  return {
    minWidth: 760, px: '14px', pt: '4px', pb: '14px', userSelect: 'none',
    '& .cov-ok': cov('ok'), '& .cov-mid': cov('mid'), '& .cov-low': cov('low'),
    '& .pf-row': { display: 'grid', gridTemplateColumns: '184px 30px repeat(var(--n), minmax(24px, 1fr))', gap: '2px', alignItems: 'stretch' },
    '& .pf-name': { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, pr: '8px', fontSize: 13 },
    '& .pf-name .nm': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 550 },
    '& .pf-hd': { position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', pt: '6px', pb: '4px' },
    '& .pf-day': { display: 'grid', justifyItems: 'center', lineHeight: 1.15, borderRadius: '5px', py: '2px' },
    '& .pf-day b': { fontSize: 12, fontWeight: 650, fontVariantNumeric: 'tabular-nums' },
    '& .pf-day small': { fontSize: 9, fontWeight: 600, color: a.textFaint, letterSpacing: '.03em' },
    '& .pf-day.is-off b, & .pf-day.is-off small': { color: a.textFaint, fontWeight: 500 },
    '& .pf-day.is-today': { bgcolor: 'primary.main' },
    '& .pf-day.is-today b, & .pf-day.is-today small': { color: 'primary.contrastText' },
    '& .pf-grp': { mt: '10px' },
    '& .pf-covrow': { height: 24 },
    '& .pf-covrow .pf-name': { fontSize: 12, gap: '6px' },
    '& .pf-covrow .pf-name b': { fontWeight: 650 },
    '& .pf-covrow .pf-name small': { color: 'text.secondary', fontSize: 11 },
    '& .pf-c': { position: 'relative', display: 'grid', gridTemplateRows: '1fr 1fr', gap: '2px', minHeight: 34, borderRadius: '5px' },
    '& .pf-covrow .pf-c': { minHeight: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: 'var(--cv)', bgcolor: 'var(--cvb)', borderRadius: '4px' },
    '& .pf-covrow .pf-c.cov-ok': { bgcolor: 'transparent', color: a.textFaint, fontWeight: 500 },
    '& .pf-c.is-off': { background: offStripes(t) },
    '& .pf-covrow .pf-c.is-off': { background: 'transparent' },
    '& .pf-person': { py: '2px' },
    '& .pf-person .pf-c:not(.is-off)': { boxShadow: `inset 0 0 0 1px ${t.palette.divider}`, bgcolor: 'background.paper' },
    '& .pf-person .pf-c.is-today:not(.is-off)': { boxShadow: `inset 0 0 0 1.5px ${t.palette.primary.main}` },
    '& .pf-person .pf-c.is-drag': { boxShadow: `inset 0 0 0 2px ${t.palette.primary.main}`, bgcolor: a.field },
    '& .pf-person.is-me .pf-name .nm::after': { content: '" · tu"', color: 'text.secondary', fontWeight: 400 },
    '& .pf-c.is-edit': { touchAction: 'none' },
    '& .pf-h': { display: 'block', borderRadius: '3px' },
    '& .pf-c.is-edit .pf-h': { cursor: 'cell' },
    '& .pf-c.is-edit .pf-h:not(.is-abs):hover': { bgcolor: a.field },
    '& .pf-h.is-abs': { bgcolor: 'var(--bg)', boxShadow: 'inset 0 0 0 1px var(--fg)', cursor: 'pointer' },
    '& .pf-h.is-prop': { background: `repeating-linear-gradient(135deg, var(--bg) 0 4px, transparent 4px 7px), ${t.palette.background.paper}` },
    '& .pf-h.is-rej': { boxShadow: 'none', opacity: 0.7, backgroundImage: 'linear-gradient(to bottom right, transparent calc(50% - .5px), var(--fg) calc(50% - .5px), var(--fg) calc(50% + .5px), transparent calc(50% + .5px))' },
    '& .pf-h.is-dim': { opacity: 0.2 },
    '& .pf-h.is-sel': { boxShadow: `inset 0 0 0 2px var(--fg), 0 0 0 2px ${t.palette.background.paper}, 0 0 0 3px var(--fg)` },
    '& .pf-h:focus-visible': { outline: 'none', boxShadow: a.focusRing },
    '& .pf-parts': { display: 'grid', gridTemplateRows: '1fr 1fr', gap: '2px', py: '2px' },
    '& .pf-parts i': { display: 'grid', placeItems: 'center', fontSize: 8.5, fontWeight: 650, letterSpacing: '.04em', fontStyle: 'normal', color: 'text.secondary', bgcolor: a.surface2, borderRadius: '3px' },
    [t.breakpoints.down('md')]: { '& .pf-row': { gridTemplateColumns: '120px 28px repeat(var(--n), 26px)' } },
  }
}
