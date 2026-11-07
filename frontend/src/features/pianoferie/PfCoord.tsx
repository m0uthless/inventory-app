import * as React from 'react'
import type { CSSObject } from '@mui/material/styles'
import { Box, Button, type Theme } from '@mui/material'
import { CampoIcon } from '../../ui/campo'
import type { AbsenceStatus } from './pianoFerieShared'
import {
  MONTHS, PART_LABEL, REASON_LABEL, STATUS_LABEL, WD, WD_FULL, absentOn, covLevel, ddmm, ddmmyyyy, gg, monthShort, parseIso,
  presentCount, rangeLabel, swatchKey, swatchOfKey,
  type CovLevel, type HalfCell, type OffCalendar, type PfRequest, type SwatchKey,
} from './pfModel'
import type { PfGroup } from './PfGrid'
import { Ava, NameSub, Swatch } from './pfUi'
import { covColors, offStripes, shortName } from './pfStyle'

export type CoverageDay = { day: string; present: number; total: number; level: CovLevel }

type Props = {
  days: string[]
  groups: PfGroup[]
  requests: PfRequest[]
  pending: PfRequest[]
  cells: Map<string, HalfCell>
  cal: OffCalendar
  today: string
  selDay: string
  onSelDay: (d: string) => void
  reasonFilter: SwatchKey | null
  selectedKey: string | null
  currentUserId: number | null
  areaLabelOf: (userId: number) => string
  coverageOf: (req: PfRequest) => CoverageDay[]
  busyKey: string | null
  onOpen: (req: PfRequest) => void
  onDecide: (req: PfRequest, status: Extract<AbsenceStatus, 'validata' | 'rifiutata'>) => void
}

/** Vista Coordinamento (solo per chi valida): timeline per persona per area, card del giorno e richieste da autorizzare. */
export default function PfCoord(props: Props) {
  const { days, groups, requests, pending, cells, cal, today, selDay, onSelDay, reasonFilter, selectedKey, currentUserId, onOpen } = props
  const first = days[0]; const last = days[days.length - 1]

  const byUser = React.useMemo(() => {
    const m = new Map<number, PfRequest[]>()
    for (const r of requests) {
      if (r.status === 'rifiutata' || r.to < first || r.from > last) continue
      m.set(r.user, [...(m.get(r.user) ?? []), r])
    }
    return m
  }, [requests, first, last])

  // Segmenti continui di una richiesta nel mese: i giorni non lavorativi non la spezzano.
  const segsOf = (r: PfRequest, areaId: number | null) => {
    const dates = new Set(r.rows.map((x) => x.date))
    const out: { s: number; e: number }[] = []
    let cur: { s: number; e: number } | null = null
    days.forEach((d, i) => {
      const on = dates.has(d)
      if (on && !cur) cur = { s: i, e: i }
      else if (on && cur) cur.e = i
      else if (!on && cur && !cal.isOff(d, areaId)) { out.push(cur); cur = null }
    })
    if (cur) out.push(cur)
    return out
  }

  const reqOfRow = (rowId: number | undefined) => (rowId == null ? undefined : requests.find((r) => r.ids.includes(rowId)))

  const head = (
    <div className="pf-tlr pf-tlr-hd">
      <span className="pf-tln" />
      {days.map((d, i) => {
        const dt = parseIso(d)
        const off = cal.isOff(d, null)
        return (
          <button key={d} type="button" className={`pf-tld${off ? ' is-off' : ''}${d === today ? ' is-today' : ''}${d === selDay ? ' is-sel' : ''}`}
            style={{ gridColumn: i + 2 }} disabled={off} onClick={() => onSelDay(d)} title={cal.holiday(d) ?? undefined}
            aria-label={`${WD_FULL[dt.getDay()]} ${dt.getDate()}`} aria-pressed={d === selDay}>
            <b>{dt.getDate()}</b><small>{WD[dt.getDay()][0]}</small>
          </button>
        )
      })}
    </div>
  )

  const cols = (areaId: number | null) => days.map((d, i) => (
    <span key={d} className={`pf-tlc${cal.isOff(d, areaId) ? ' is-off' : ''}${d === today ? ' is-today' : ''}${d === selDay ? ' is-sel' : ''}`} style={{ gridColumn: i + 2 }} />
  ))

  const timeline = (
    <Box className="pf-tl2" style={{ ['--n' as string]: days.length }}>
      {head}
      {groups.map((g) => (
        <div key={g.key} className="pf-tlg">
          <div className="pf-tlr pf-tlr-cov">
            <span className="pf-tln"><b>{g.label}</b><small>presenti</small></span>
            {days.map((d, i) => {
              if (cal.isOff(d, g.areaId)) return <span key={d} className="pf-tlc is-off" style={{ gridColumn: i + 2 }} />
              const pr = presentCount(g.people, d, cells)
              return (
                <button key={d} type="button" className={`pf-tlk cov-${covLevel(pr, g.people.length)}${d === selDay ? ' is-sel' : ''}`} style={{ gridColumn: i + 2 }}
                  onClick={() => onSelDay(d)} title={`${ddmm(d)} · ${pr} presenti su ${g.people.length}`}>{pr}</button>
              )
            })}
          </div>
          {g.people.map((p) => (
            <div key={p.id} className={`pf-tlr pf-tlr-p${p.id === currentUserId ? ' is-me' : ''}`}>
              <span className="pf-tln" title={p.name}><Ava name={p.name} size={22} /><span className="nm">{shortName(p.name)}</span></span>
              {cols(p.area_id)}
              {(byUser.get(p.id) ?? []).flatMap((r) => {
                const k = swatchKey(r.reason, r.status)
                const sw = swatchOfKey(k)
                const segs = segsOf(r, p.area_id)
                return segs.map((s, gi) => {
                  const len = s.e - s.s + 1
                  const cutL = gi > 0 || (s.s === 0 && r.from < first)
                  const cutR = gi < segs.length - 1 || (s.e === days.length - 1 && r.to > last)
                  const cls = ['pf-tlb', r.status === 'proposta' && 'is-prop', r.part === 'mat' && 'is-mat', r.part === 'pom' && 'is-pom',
                    reasonFilter && reasonFilter !== k && 'is-dim', r.key === selectedKey && 'is-sel', cutL && 'cut-l', cutR && 'cut-r'].filter(Boolean).join(' ')
                  return (
                    <button key={`${r.key}-${gi}`} type="button" className={cls}
                      style={{ gridColumn: `${s.s + 2} / ${s.e + 3}`, ['--bg' as string]: sw.bg, ['--fg' as string]: sw.fg }}
                      title={`${p.name} · ${REASON_LABEL[r.reason]} · ${rangeLabel(r.from, r.to)}${r.part !== 'all' ? ' · ' + PART_LABEL[r.part] : ''} · ${STATUS_LABEL[r.status]}`}
                      onClick={() => onOpen(r)}>
                      {r.status === 'proposta' ? <CampoIcon name="clock" size={12} /> : null}
                      {len >= 3 ? <span>{REASON_LABEL[r.reason]}{len >= 5 ? ` · ${gg(r.days)}` : ''}</span> : null}
                    </button>
                  )
                })
              })}
            </div>
          ))}
        </div>
      ))}
    </Box>
  )

  // ── Card del giorno ──
  const sdt = parseIso(selDay)
  const everyone = groups.flatMap((g) => g.people)
  const pres = presentCount(everyone, selDay, cells)
  const absent = everyone.filter((p) => absentOn(cells.get(`${p.id}|${selDay}`)))
  const dayCard = (
    <section className="pf-card">
      <div className="pf-card-h">
        <div><small>{WD_FULL[sdt.getDay()]}</small><h3>{sdt.getDate()} {MONTHS[sdt.getMonth()].toLowerCase()}</h3></div>
        <span className={`pf-big cov-${covLevel(pres, everyone.length)}`}><span><b>{pres}</b>/{everyone.length}</span><small>presenti</small></span>
      </div>
      {cal.holiday(selDay) ? <p className="pf-hol">{cal.holiday(selDay)}</p> : null}
      {groups.map((g) => {
        const pr = presentCount(g.people, selDay, cells)
        return (
          <div key={g.key} className="pf-dayarea">
            <span>{g.label}</span>
            <span className={`pf-meter cov-${covLevel(pr, g.people.length)}`}><i style={{ width: `${g.people.length ? (pr / g.people.length) * 100 : 0}%` }} /></span>
            <b>{pr}/{g.people.length}</b>
          </div>
        )
      })}
      {absent.length ? (
        <ul className="pf-who">
          {absent.map((p) => {
            const c = cells.get(`${p.id}|${selDay}`)
            const row = [c?.mat, c?.pom].find((x) => x && x.status !== 'rifiutata') ?? undefined
            const r = reqOfRow(row?.id)
            if (!row) return null
            const k = swatchKey(row.reason, row.status)
            const halfOnly = !(c?.mat && c?.pom && c.mat.status !== 'rifiutata' && c.pom.status !== 'rifiutata')
            return (
              <li key={p.id}>
                <button type="button" onClick={() => r && onOpen(r)} disabled={!r}>
                  <Swatch k={k} />
                  <NameSub name={p.name} sub={<>{REASON_LABEL[row.reason]}{r ? ` · ${rangeLabel(r.from, r.to)}` : ''}{halfOnly ? ` · ${row.day_part === 'mattina' ? 'mattina' : 'pomeriggio'}` : ''}</>} />
                  {row.status === 'proposta' ? <span className="pf-st">Proposta</span> : <span />}
                  <CampoIcon name="chevR" size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : <p className="pf-empty"><CampoIcon name="task" size={16} />{cal.isOff(selDay, null) ? 'Giorno non lavorativo.' : 'Tutti presenti.'}</p>}
    </section>
  )

  // ── Da autorizzare ──
  const auth = (
    <section>
      <div className="pf-side-h"><h3>Da autorizzare</h3><span className="r-cnt">{pending.length}</span></div>
      {!pending.length ? <p className="pf-empty"><CampoIcon name="task" size={16} />Nessuna richiesta da autorizzare.</p> : (
        <ul className="pf-auth">
          {pending.map((r) => {
            const k = swatchKey(r.reason, r.status)
            const cov = props.coverageOf(r)
            const low = cov.filter((c) => c.level === 'low')
            const area = props.areaLabelOf(r.user)
            const busy = props.busyKey === r.key
            return (
              <li key={r.key} className={`pf-ac${low.length ? ' has-warn' : ''}${r.key === selectedKey ? ' is-sel' : ''}`}>
                <button type="button" className="pf-ac-main" onClick={() => onOpen(r)}>
                  <Ava name={r.userName} size={30} />
                  <NameSub name={r.userName} sub={`${area}${r.createdAt ? ` · richiesta il ${ddmmyyyy(r.createdAt.slice(0, 10)).slice(0, 5)}` : ''}`} />
                  <CampoIcon name="chevR" size={14} />
                </button>
                <div className="pf-ac-what">
                  <Swatch k={k} /><b>{REASON_LABEL[r.reason]}</b>
                  <span>{rangeLabel(r.from, r.to)}{r.from.slice(0, 4) !== today.slice(0, 4) ? ` ${r.from.slice(0, 4)}` : ''} · {gg(r.days)}{r.part !== 'all' ? ` · ${PART_LABEL[r.part]}` : ''}</span>
                </div>
                {cov.length ? (
                  <div className="pf-ac-strip" aria-label={`Presenti in ${area} nei giorni richiesti`}>
                    {cov.slice(0, 7).map((c) => (
                      <span key={c.day} className={`cov-${c.level}`} title={`${ddmm(c.day)} · ${c.present}/${c.total} presenti`}><b>{parseIso(c.day).getDate()}</b><em>{c.present}/{c.total}</em></span>
                    ))}
                    {cov.length > 7 ? <span className="more">+{cov.length - 7}</span> : null}
                  </div>
                ) : null}
                {low.length ? (
                  <p className="pf-q-warn"><CampoIcon name="alert" size={13} />{area} resta con {low[0].present} su {low[0].total} il {low.map((c) => parseIso(c.day).getDate()).join(', ')} {monthShort(low[0].day)}</p>
                ) : null}
                <div className="pf-ac-act">
                  <Button size="small" variant="outlined" color="inherit" disabled={busy} startIcon={<CampoIcon name="x" size={14} />} onClick={() => props.onDecide(r, 'rifiutata')}>Rifiuta</Button>
                  <Button size="small" variant="contained" disabled={busy} startIcon={<CampoIcon name="task" size={14} />} onClick={() => props.onDecide(r, 'validata')}>Autorizza</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  return (
    <Box sx={coordSx}>
      <div className="pf-cal">{timeline}</div>
      <aside className="pf-side" aria-label="Giorno e richieste da autorizzare">{dayCard}{auth}</aside>
    </Box>
  )
}

const coordSx = (t: Theme): CSSObject => {
  const a = t.palette.archie
  const paper = t.palette.background.paper
  const cov = (lv: CovLevel) => { const c = covColors(t, lv); return { '--cv': c.fg, '--cvb': c.bg } }
  const dark = t.palette.mode === 'dark'
  return {
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', minHeight: 560,
    '& .cov-ok': cov('ok'), '& .cov-mid': cov('mid'), '& .cov-low': cov('low'),
    '& button': { font: 'inherit' },
    '& .pf-cal': { p: '10px 14px 16px', borderRight: '1px solid', borderColor: 'divider', minWidth: 0, overflowX: 'auto' },
    // timeline
    '& .pf-tl2': { minWidth: 640 },
    '& .pf-tlr': { display: 'grid', gridTemplateColumns: '132px repeat(var(--n), minmax(16px, 1fr))', alignItems: 'center' },
    '& .pf-tln': { gridColumn: 1, gridRow: 1, display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, pr: '8px', fontSize: 12 },
    '& .pf-tln .nm': { fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    '& .pf-tlr-hd': { position: 'sticky', top: 0, zIndex: 3, bgcolor: paper, pb: '4px' },
    '& .pf-tld': { gridRow: 1, display: 'grid', justifyItems: 'center', lineHeight: 1.1, py: '3px', border: 0, borderRadius: '5px', bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer' },
    '& .pf-tld b': { fontSize: 11.5, fontWeight: 650, fontVariantNumeric: 'tabular-nums' },
    '& .pf-tld small': { fontSize: 9, fontWeight: 600, color: a.textFaint },
    '& .pf-tld:hover:not(:disabled)': { bgcolor: a.surface2 },
    '& .pf-tld.is-off': { color: a.textFaint, cursor: 'default' },
    '& .pf-tld.is-off b': { fontWeight: 500 },
    '& .pf-tld.is-today': { bgcolor: 'primary.main', color: 'primary.contrastText' },
    '& .pf-tld.is-today small': { color: 'primary.contrastText' },
    '& .pf-tld.is-sel:not(.is-today)': { bgcolor: a.field, boxShadow: `inset 0 0 0 1px ${a.fieldLine}` },
    '& .pf-tld:focus-visible, & .pf-tlk:focus-visible, & .pf-tlb:focus-visible': { outline: 'none', boxShadow: a.focusRing },
    '& .pf-tlg': { border: '1px solid', borderColor: 'divider', borderRadius: '10px', overflow: 'hidden' },
    '& .pf-tlg + .pf-tlg': { mt: '10px' },
    '& .pf-tlr-cov': { minHeight: 30, bgcolor: a.surface2, borderBottom: '1px solid', borderColor: 'divider' },
    '& .pf-tlr-cov .pf-tln': { pl: '10px', gap: '6px' },
    '& .pf-tlr-cov .pf-tln b': { fontSize: 12, fontWeight: 650 },
    '& .pf-tlr-cov .pf-tln small': { fontSize: 11, color: 'text.secondary' },
    '& .pf-tlk': { gridRow: 1, height: 22, mx: '1px', border: 0, borderRadius: '4px', bgcolor: 'var(--cvb)', color: 'var(--cv)', fontSize: 11, fontWeight: 650, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', p: 0 },
    '& .pf-tlk.cov-ok': { bgcolor: 'transparent', color: 'text.secondary', fontWeight: 500 },
    '& .pf-tlk:hover': { boxShadow: `inset 0 0 0 1px ${a.borderStrong}` },
    '& .pf-tlk.is-sel': { boxShadow: `inset 0 0 0 1.5px ${a.fieldLine}` },
    '& .pf-tlr-p': { minHeight: 36 },
    '& .pf-tlr-p + .pf-tlr-p': { borderTop: '1px solid', borderColor: 'divider' },
    '& .pf-tlr-p .pf-tln': { pl: '10px' },
    '& .pf-tlr-p.is-me .nm': { color: 'primary.main' },
    '& .pf-tlc': { gridRow: 1, alignSelf: 'stretch', minHeight: 36, borderLeft: `1px solid ${t.palette.divider}` },
    '& .pf-tlr-cov .pf-tlc': { minHeight: 30, border: 0 },
    '& .pf-tlc.is-off': { background: offStripes(t) },
    '& .pf-tlc.is-today': { boxShadow: `inset 1px 0 0 ${t.palette.primary.main}, inset -1px 0 0 ${t.palette.primary.main}` },
    '& .pf-tlc.is-sel': { bgcolor: a.field },
    '& .pf-tlb': {
      gridRow: 1, zIndex: 1, height: 24, mx: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: 0, px: '6px',
      border: '1px solid var(--fg)', borderRadius: '6px', bgcolor: 'var(--bg)', color: dark ? t.palette.text.primary : 'var(--fg)',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'pointer',
    },
    '& .pf-tlb span': { overflow: 'hidden', textOverflow: 'ellipsis' },
    '& .pf-tlb svg': { flex: 'none' },
    '& .pf-tlb.is-prop': { borderStyle: 'dashed', background: `repeating-linear-gradient(135deg, var(--bg) 0 5px, ${dark ? 'transparent' : paper} 5px 9px)` },
    '& .pf-tlb.is-mat': { height: 13, alignSelf: 'start', mt: '4px', px: '2px' },
    '& .pf-tlb.is-pom': { height: 13, alignSelf: 'end', mb: '4px', px: '2px' },
    '& .pf-tlb.cut-l': { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, ml: 0 },
    '& .pf-tlb.cut-r': { borderTopRightRadius: 0, borderBottomRightRadius: 0, mr: 0 },
    '& .pf-tlb.is-dim': { opacity: 0.2 },
    '& .pf-tlb.is-sel': { boxShadow: `0 0 0 2px ${paper}, 0 0 0 3.5px var(--fg)` },
    // colonna destra
    '& .pf-side': { display: 'flex', flexDirection: 'column', gap: '14px', p: '12px 14px 16px', bgcolor: a.surface2 },
    '& .pf-card': { bgcolor: paper, border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: '14px' },
    '& .pf-card-h': { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', mb: '10px' },
    '& .pf-card-h small': { display: 'block', fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.06em' },
    '& .pf-card-h h3': { m: 0, fontSize: 20, fontWeight: 650, letterSpacing: '-.015em' },
    '& .pf-big': { display: 'grid', justifyItems: 'end', lineHeight: 1.05, fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' },
    '& .pf-big b': { fontSize: 26, fontWeight: 650, color: 'var(--cv)', letterSpacing: '-.02em' },
    '& .pf-big.cov-ok b': { color: 'text.primary' },
    '& .pf-big small': { fontSize: 11 },
    '& .pf-big > span': { whiteSpace: 'nowrap' },
    '& .pf-hol': { m: '0 0 6px', fontSize: 12, color: 'text.secondary' },
    '& .pf-dayarea': { display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr) 40px', gap: '8px', alignItems: 'center', fontSize: 12, color: 'text.secondary', py: '2px' },
    '& .pf-dayarea > span:first-of-type': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    '& .pf-dayarea b': { color: 'text.primary', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    '& .pf-meter': { height: 6, borderRadius: '3px', bgcolor: a.neutralBg, overflow: 'hidden' },
    '& .pf-meter i': { display: 'block', height: '100%', borderRadius: '3px', bgcolor: 'var(--cv)' },
    '& .pf-who': { listStyle: 'none', m: '8px 0 0', p: '4px 0 0', borderTop: '1px solid', borderColor: 'divider' },
    '& .pf-who button': { width: '100%', display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto 14px', gap: '10px', alignItems: 'center', minHeight: 44, p: '4px 6px', border: 0, borderRadius: '6px', bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer', textAlign: 'left' },
    '& .pf-who button:hover': { bgcolor: a.surface2 },
    '& .pf-who button > svg': { color: a.textFaint },
    '& .pf-st': { display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, bgcolor: 'warning.light', color: 'warning.main' },
    '& .pf-empty': { display: 'flex', alignItems: 'center', gap: '8px', my: '4px', fontSize: 13, color: 'text.secondary' },
    '& .pf-empty svg': { color: 'success.main' },
    '& .pf-side-h': { display: 'flex', alignItems: 'center', gap: '8px', mb: '8px', px: '2px' },
    '& .pf-side-h h3': { m: 0, fontSize: 14, fontWeight: 650 },
    '& .r-cnt': { fontSize: 11, fontWeight: 600, color: 'text.secondary', bgcolor: a.neutralBg, borderRadius: '5px', px: '6px' },
    '& .pf-auth': { listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '10px' },
    '& .pf-ac': { bgcolor: paper, border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: '10px 12px 12px', display: 'grid', gap: '8px' },
    '& .pf-ac.has-warn': { borderColor: t.palette.warning.main },
    '& .pf-ac.is-sel': { boxShadow: `inset 0 0 0 1px ${a.fieldLine}`, borderColor: a.fieldLine },
    '& .pf-ac-main': { display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr) 14px', gap: '10px', alignItems: 'center', p: '2px', m: '-2px', border: 0, borderRadius: '8px', bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer', textAlign: 'left' },
    '& .pf-ac-main:hover': { bgcolor: a.surface2 },
    '& .pf-ac-main > svg': { color: a.textFaint },
    '& .pf-ac-main:focus-visible, & .pf-who button:focus-visible': { outline: 'none', boxShadow: a.focusRing },
    '& .pf-ac-what': { display: 'flex', alignItems: 'center', gap: '7px', fontSize: 13, flexWrap: 'wrap' },
    '& .pf-ac-what b': { fontWeight: 650 },
    '& .pf-ac-what span:last-child': { color: 'text.secondary', fontSize: 12 },
    '& .pf-ac-strip': { display: 'flex', gap: '3px' },
    '& .pf-ac-strip > span': { flex: 1, minWidth: 0, display: 'grid', justifyItems: 'center', py: '3px', borderRadius: '6px', bgcolor: 'var(--cvb)', lineHeight: 1.15 },
    '& .pf-ac-strip > span.cov-ok': { bgcolor: a.surface2 },
    '& .pf-ac-strip b': { fontSize: 12, fontWeight: 650 },
    '& .pf-ac-strip em': { fontStyle: 'normal', fontSize: 10, fontWeight: 650, color: 'var(--cv)' },
    '& .pf-ac-strip .more': { flex: 'none', px: '6px', alignSelf: 'center', fontSize: 11, color: 'text.secondary', bgcolor: 'transparent' },
    '& .pf-q-warn': { display: 'flex', alignItems: 'center', gap: '6px', m: 0, p: '5px 8px', borderRadius: '6px', bgcolor: 'warning.light', color: 'warning.main', fontSize: 12, fontWeight: 550 },
    '& .pf-q-warn svg': { flex: 'none' },
    '& .pf-ac-act': { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '6px' },
    [t.breakpoints.down('lg')]: { gridTemplateColumns: '1fr', '& .pf-cal': { borderRight: 0, borderBottom: '1px solid', borderColor: 'divider' } },
  }
}
