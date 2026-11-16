import * as React from 'react'
import { Box, Button, ButtonBase, CircularProgress, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { CampoIcon, KpiFlag, KpiStrip, KpiTile, PageHead, SegmentBar, ViewTabs, useUndoToast } from '../ui/campo'
import { type HolidayRow, type RosterResponse, type RosterRow, toISODate } from '../features/pianoferie/pianoFerieShared'
import {
  MONTHS, PART_LABEL, REASON_LABEL, STATUS_LABEL, SWATCH_KEYS, SWATCH_LABEL, absentOn, addDays, buildOffCalendar, covLevel, ddmm,
  ddmmyyyy, gg, groupRequests, indexCells, monthDays, presentCount, rangeLabel, requestCoverage, swatchKey, swatchOfKey,
  type PfPart, type PfRequest, type PfRow, type SwatchKey,
} from '../features/pianoferie/pfModel'
import PfGrid, { type PfGroup } from '../features/pianoferie/PfGrid'
import PfCoord from '../features/pianoferie/PfCoord'
import PfDetail from '../features/pianoferie/PfDetail'
import PfRequestDialog, { type PfDialogTarget } from '../features/pianoferie/PfRequestDialog'
import { Ava, NameSub, StatusBadge, Swatch } from '../features/pianoferie/pfUi'

type View = 'cal' | 'coord' | 'mine'
type Decision = 'validata' | 'rifiutata'

const fetchRows = (params: Record<string, string | number>) => api.get<PfRow[]>('/absences/', { params }).then((r) => r.data)

/** Piano ferie (restyle "Campo sterile", anteprima design-previews/pf-base.html). */
export default function PianoFerie() {
  const toast = useToast()
  const undoToast = useUndoToast()
  const today = toISODate(new Date())

  const [year, setYear] = React.useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = React.useState(() => Number(today.slice(5, 7)) - 1)
  const [view, setView] = React.useState<View>('cal')
  const [area, setArea] = React.useState<string | null>(null)
  const [reasonFilter, setReasonFilter] = React.useState<SwatchKey | null>(null)
  const [selDay, setSelDay] = React.useState(today)
  const [selectedRowId, setSelectedRowId] = React.useState<number | null>(null)
  const [dialog, setDialog] = React.useState<PfDialogTarget | null>(null)
  const [toDelete, setToDelete] = React.useState<PfRequest | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = React.useCallback(() => setReloadKey((k) => k + 1), [])

  // ── Roster ──
  const [rosterData, setRosterData] = React.useState<RosterResponse | null>(null)
  React.useEffect(() => {
    api.get<RosterResponse>('/absences/roster/').then((r) => setRosterData(r.data)).catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const roster = React.useMemo(() => rosterData?.rows ?? [], [rosterData])
  const canEditAll = Boolean(rosterData?.can_edit_all)
  const me = rosterData?.current_user_id ?? null
  const myAreaId = rosterData?.current_user_area_id ?? null
  const areaKey = area ?? (myAreaId != null && roster.some((p) => p.area_id === myAreaId) ? String(myAreaId) : 'all')

  // ── Festività (anno in vista ± 1) ──
  const [holidays, setHolidays] = React.useState<Record<number, HolidayRow[]>>({})
  React.useEffect(() => {
    const missing = [year - 1, year, year + 1].filter((y) => !(y in holidays))
    if (!missing.length) return
    Promise.all(missing.map((y) => api.get<HolidayRow[]>('/leave-holidays/', { params: { year: y } }).then((r) => [y, r.data] as const)))
      .then((res) => setHolidays((h) => ({ ...h, ...Object.fromEntries(res) })))
      .catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])
  const cal = React.useMemo(() => buildOffCalendar(Object.values(holidays).flat()), [holidays])

  // ── Assenze: mese in vista (con un mese di margine), oggi, le mie, le proposte da validare ──
  const days = React.useMemo(() => monthDays(year, month), [year, month])
  const [rowSets, setRowSets] = React.useState<{ month: PfRow[]; extra: PfRow[] } | null>(null)
  React.useEffect(() => {
    if (!rosterData) return
    let alive = true
    const from = addDays(days[0], -31); const to = addDays(days[days.length - 1], 31)
    const jobs: Promise<PfRow[]>[] = [
      fetchRows({ date_from: today, date_to: today }),
      fetchRows({ user: rosterData.current_user_id, date_from: addDays(today, -366) }),
    ]
    const pendingJob = canEditAll ? fetchRows({ status: 'proposta' }) : Promise.resolve([] as PfRow[])
    Promise.all([fetchRows({ date_from: from, date_to: to }), pendingJob, ...jobs])
      .then(async ([monthRows, pending, ...rest]) => {
        // Copertura delle proposte fuori dal mese: servono le assenze di tutti in quei giorni.
        let span: PfRow[] = []
        const out = pending.filter((r) => r.date < from || r.date > to).map((r) => r.date).sort()
        if (out.length) span = await fetchRows({ date_from: out[0], date_to: out[out.length - 1] })
        if (alive) setRowSets({ month: monthRows, extra: [...pending, ...span, ...rest.flat()] })
      })
      .catch((e) => toast.error(apiErrorToMessage(e)))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterData, canEditAll, days, reloadKey])

  const rows = React.useMemo(() => {
    if (!rowSets) return []
    const m = new Map<number, PfRow>()
    for (const r of [...rowSets.month, ...rowSets.extra]) m.set(r.id, r)
    return [...m.values()]
  }, [rowSets])
  const areaOfUser = React.useMemo(() => new Map(roster.map((p) => [p.id, p.area_id])), [roster])
  const cells = React.useMemo(() => indexCells(rows), [rows])
  const requests = React.useMemo(() => groupRequests(rows, (d, u) => cal.isOff(d, areaOfUser.get(u) ?? null)), [rows, cal, areaOfUser])

  // ── Aree e persone in vista ──
  const areas = React.useMemo(() => {
    const m = new Map<string, { id: number | null; label: string }>()
    for (const p of roster) { const k = p.area_id == null ? 'none' : String(p.area_id); if (!m.has(k)) m.set(k, { id: p.area_id, label: p.area_label ?? 'Senza area' }) }
    return [...m.entries()].map(([key, v]) => ({ key, ...v }))
  }, [roster])
  const groups: PfGroup[] = React.useMemo(() => areas
    .filter((a) => areaKey === 'all' || a.key === areaKey)
    .map((a) => ({ key: a.key, label: a.label, areaId: a.id, people: roster.filter((p) => (p.area_id == null ? 'none' : String(p.area_id)) === a.key) })), [areas, areaKey, roster])
  const people = React.useMemo(() => groups.flatMap((g) => g.people), [groups])
  const inView = React.useMemo(() => new Set(people.map((p) => p.id)), [people])
  const personOf = React.useCallback((id: number): RosterRow | undefined => roster.find((p) => p.id === id), [roster])
  const areaLabelOf = React.useCallback((id: number) => personOf(id)?.area_label ?? 'Senza area', [personOf])
  const areaPeopleOf = React.useCallback((id: number) => { const a = areaOfUser.get(id) ?? null; return roster.filter((p) => p.area_id === a) }, [roster, areaOfUser])

  const effView: View = view === 'coord' && !canEditAll ? 'cal' : view
  const pending = React.useMemo(() => requests.filter((r) => r.status === 'proposta' && (canEditAll ? inView.has(r.user) : r.user === me)), [requests, canEditAll, inView, me])
  const mine = React.useMemo(() => requests.filter((r) => r.user === me).sort((a, b) => b.from.localeCompare(a.from)), [requests, me])
  const selected = selectedRowId == null ? null : requests.find((r) => r.ids.includes(selectedRowId)) ?? null
  const selectedIds = React.useMemo(() => new Set(selected?.ids ?? []), [selected])

  React.useEffect(() => {
    if (selDay >= days[0] && selDay <= days[days.length - 1]) return
    setSelDay(days.includes(today) ? today : days.find((d) => !cal.isOff(d, null)) ?? days[0])
  }, [days, selDay, today, cal])

  const canEditUser = React.useCallback((userId: number) => canEditAll || userId === me, [canEditAll, me])
  const canEditReq = (r: PfRequest) => canEditAll || (r.user === me && r.status === 'proposta' && r.reason === 'ferie')
  const coverageOf = React.useCallback((r: PfRequest) => requestCoverage(r, areaPeopleOf(r.user), cells, areaOfUser.get(r.user) ?? null, cal), [areaPeopleOf, cells, areaOfUser, cal])

  // ── Azioni ──
  const decide = async (r: PfRequest, status: Decision) => {
    setBusyKey(r.key)
    try {
      const verb = status === 'validata' ? 'validate' : 'reject'
      if (r.requestGroup) await api.post(`/absences/${verb}-group/`, { request_group: r.requestGroup })
      else await Promise.all(r.ids.map((id) => api.post(`/absences/${id}/${verb}/`)))
      reload()
      undoToast.show(`${STATUS_LABEL[status]} · ${r.userName}, ${rangeLabel(r.from, r.to)}`, async () => {
        try { await Promise.all(r.ids.map((id) => api.patch(`/absences/${id}/`, { status: 'proposta' }))); reload() } catch (e) { toast.error(apiErrorToMessage(e)) }
      })
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  const remove = async () => {
    const r = toDelete
    if (!r) return
    setBusyKey(r.key)
    try {
      await Promise.all(r.ids.map((id) => api.delete(`/absences/${id}/`)))
      setToDelete(null); setSelectedRowId(null); reload()
      undoToast.show(r.user === me && r.status === 'proposta' ? 'Richiesta ritirata' : 'Richiesta eliminata')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  const openNew = React.useCallback((userId: number | null, from: string, to: string, part: PfPart) => setDialog({ kind: 'new', userId, from, to, part }), [])
  const openRow = React.useCallback((row: PfRow) => setSelectedRowId(row.id), [])
  const openReq = React.useCallback((r: PfRequest) => setSelectedRowId(r.ids[0]), [])

  const goMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }
  const goToday = () => { setYear(Number(today.slice(0, 4))); setMonth(Number(today.slice(5, 7)) - 1); setSelDay(today) }
  const goDay = (d: string) => { if (!canEditAll) return; setView('coord'); setSelDay(d); setYear(Number(d.slice(0, 4))); setMonth(Number(d.slice(5, 7)) - 1) }

  // ── Indicatori ──
  const kpis = React.useMemo(() => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const offToday = people.filter((p) => absentOn(cells.get(`${p.id}|${today}`)))
    const work = days.filter((d) => !cal.isOff(d, null))
    const worst = work.map((d) => [d, presentCount(people, d, cells)] as const).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
    const byKey = new Map<SwatchKey, number>()
    let ferieV = 0
    for (const r of rows) {
      if (!inView.has(r.user) || r.date.slice(0, 7) !== monthKey || r.status === 'rifiutata') continue
      const k = swatchKey(r.reason, r.status)
      byKey.set(k, (byKey.get(k) ?? 0) + 0.5)
      if (k === 'ferie_v') ferieV += 0.5
    }
    return { offToday, worst, byKey, ferieV }
  }, [people, cells, today, days, cal, rows, inView, year, month])
  const pendDays = pending.reduce((n, r) => n + r.days, 0)
  const oldest = pending.map((r) => r.createdAt).filter(Boolean).sort()[0]
  const reasonParts = SWATCH_KEYS.filter((k) => kpis.byKey.get(k)).map((k) => ({ key: k, label: SWATCH_LABEL[k], value: kpis.byKey.get(k)!, display: `${String(kpis.byKey.get(k)).replace('.', ',')} gg`, color: swatchOfKey(k).fg }))
  const totalAbs = reasonParts.reduce((n, p) => n + p.value, 0)

  const kpiStrip = (
    <KpiStrip label="Indicatori piano ferie">
      <KpiTile label="Assenti oggi" value={kpis.offToday.length} unit={`su ${people.length}`} onClick={canEditAll ? () => goDay(today) : undefined}
        sub={kpis.offToday.length ? (
          <Box component="span" sx={{ display: 'inline-flex', gap: '3px' }}>
            {kpis.offToday.slice(0, 8).map((p) => {
              const c = cells.get(`${p.id}|${today}`)
              const r = [c?.mat, c?.pom].find((x) => x && x.status !== 'rifiutata')!
              const sw = swatchOfKey(swatchKey(r.reason, r.status))
              return <Box key={p.id} component="span" title={`${p.name} · ${REASON_LABEL[r.reason]}`} sx={{ display: 'inline-flex' }}><Ava name={p.name} size={22} style={{ background: sw.bg, color: sw.fg }} /></Box>
            })}
            {kpis.offToday.length > 8 ? <span>+{kpis.offToday.length - 8}</span> : null}
          </Box>
        ) : 'nessuno'} />
      {canEditAll ? (
        <KpiTile label="Da validare" value={pending.length} unit={gg(pendDays)} active={effView === 'coord'} onClick={() => setView('coord')}
          sub={pending.length ? <>la più vecchia del&nbsp;<b>{oldest ? ddmmyyyy(oldest.slice(0, 10)).slice(0, 5) : '—'}</b></> : 'nessuna richiesta in attesa'} />
      ) : (
        <KpiTile label="Le tue richieste in attesa" value={pending.length} unit={gg(pendDays)} active={effView === 'mine'} onClick={() => setView('mine')}
          sub={pending.length ? <>prossima:&nbsp;<b>{rangeLabel(pending[0].from, pending[0].to)}</b></> : 'nessuna richiesta in attesa'} />
      )}
      <KpiTile label={`Ferie validate · ${MONTHS[month].toLowerCase()}`} value={String(kpis.ferieV).replace('.', ',')} unit="giorni"
        sub={<><b>{pending.filter((r) => r.reason === 'ferie').length}</b>&nbsp;richieste di ferie in attesa</>} />
      <KpiTile label="Giorno più scoperto" onClick={canEditAll && kpis.worst ? () => goDay(kpis.worst[0]) : undefined}
        value={kpis.worst ? <>{ddmm(kpis.worst[0])}{covLevel(kpis.worst[1], people.length) === 'low' ? <KpiFlag tone="warning">▲ copertura bassa</KpiFlag> : null}</> : '—'}
        sub={kpis.worst ? <><b>{kpis.worst[1]}</b>&nbsp;presenti su {people.length}</> : null} />
      <KpiTile label={`Assenze del mese per motivo · ${String(totalAbs).replace('.', ',')} gg`} wide>
        {reasonParts.length ? (
          <SegmentBar parts={reasonParts} onPick={(k) => setReasonFilter((f) => (f === k ? null : k as SwatchKey))}
            dimmed={reasonFilter ? new Set(reasonParts.map((p) => p.key).filter((k) => k !== reasonFilter)) : undefined} />
        ) : <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>Nessuna assenza nel mese.</Typography>}
      </KpiTile>
    </KpiStrip>
  )

  // ── Testata ──
  const monthStepper = (
    <Box role="group" aria-label="Mese" sx={{ display: 'inline-flex', alignItems: 'center', height: 30, border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper', px: '2px' }}>
      <IconButton size="small" aria-label="Mese precedente" onClick={() => goMonth(-1)} sx={{ width: 26, height: 26 }}><ChevronLeftIcon fontSize="small" /></IconButton>
      <Typography component="b" sx={{ minWidth: 128, textAlign: 'center', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{MONTHS[month]} {year}</Typography>
      <IconButton size="small" aria-label="Mese successivo" onClick={() => goMonth(1)} sx={{ width: 26, height: 26 }}><ChevronRightIcon fontSize="small" /></IconButton>
    </Box>
  )
  const areaSwitch = areas.length > 1 ? (
    <Box role="group" aria-label="Area" sx={{ display: 'inline-flex', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'archie.surface2', maxWidth: '100%', overflowX: 'auto' }}>
      {[...areas.map((a) => ({ key: a.key, label: a.label, mine: a.id != null && a.id === myAreaId })), { key: 'all', label: 'Tutte', mine: false }].map((o) => {
        const on = o.key === areaKey
        return (
          <ButtonBase key={o.key} aria-pressed={on} onClick={() => setArea(o.key)} sx={{
            height: 28, px: 1.25, gap: 0.75, borderRadius: '6px', fontSize: 13, fontWeight: 550, whiteSpace: 'nowrap', color: on ? 'text.primary' : 'text.secondary',
            bgcolor: on ? 'background.paper' : 'transparent', boxShadow: on ? (t) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` : 'none',
            '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>
            {o.label}
            {o.mine ? <Box component="small" sx={{ fontSize: 10, fontWeight: 600, color: 'primary.main', bgcolor: 'archie.field', borderRadius: '4px', px: 0.625 }}>la tua</Box> : null}
          </ButtonBase>
        )
      })}
    </Box>
  ) : null

  // ── Legenda che filtra ──
  const tools = effView === 'mine' ? null : (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
      <Box role="group" aria-label="Legenda e filtro per motivo" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 4px', flex: 1, minWidth: 0 }}>
        {SWATCH_KEYS.map((k) => {
          const on = reasonFilter === k
          return (
            <ButtonBase key={k} aria-pressed={on} onClick={() => setReasonFilter(on ? null : k)} sx={{
              gap: 0.75, height: 26, px: 1, border: '1px solid', borderColor: on ? 'archie.borderStrong' : 'transparent', borderRadius: '6px',
              fontSize: 12, fontWeight: on ? 550 : 400, color: on ? 'text.primary' : 'text.secondary', bgcolor: on ? 'background.paper' : 'transparent',
              opacity: reasonFilter && !on ? 0.5 : 1, '&:hover': { bgcolor: 'archie.surface2', color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
            }}><Swatch k={k} />{SWATCH_LABEL[k]}</ButtonBase>
          )
        })}
        {reasonFilter ? <ButtonBase onClick={() => setReasonFilter(null)} sx={{ px: 1, fontSize: 12, fontWeight: 550, color: 'primary.main' }}>Mostra tutti</ButtonBase> : null}
      </Box>
      <Typography component="span" sx={{ fontSize: 11, color: 'archie.textFaint', whiteSpace: 'nowrap' }}>
        {effView === 'cal' ? 'Clic = mezza giornata · trascina = più giorni' : 'Clic su un giorno per vedere chi manca · su una barra per la richiesta'}
      </Typography>
    </Box>
  )

  const mineList = (
    <Box sx={{ px: 1.75, pt: 0.5, pb: 1.75, maxWidth: 860 }}>
      {!mine.length ? <Typography sx={{ py: 2, fontSize: 13, color: 'text.secondary' }}>Nessuna richiesta negli ultimi 12 mesi.</Typography> : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {mine.map((r) => (
            <Box component="li" key={r.key} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}>
              <ButtonBase onClick={() => openReq(r)} sx={{
                width: '100%', justifyContent: 'flex-start', gap: 1.25, minHeight: 40, px: 0.5, borderRadius: '6px', textAlign: 'left',
                bgcolor: selected?.key === r.key ? 'archie.field' : 'transparent', '&:hover': { bgcolor: 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>
                <Swatch k={swatchKey(r.reason, r.status)} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <NameSub name={`${REASON_LABEL[r.reason]} · ${rangeLabel(r.from, r.to)}${r.from.slice(0, 4) !== today.slice(0, 4) ? ` ${r.from.slice(0, 4)}` : ''}`}
                    sub={`${gg(r.days)}${r.part !== 'all' ? ` · ${PART_LABEL[r.part]}` : ''}${r.createdAt ? ` · richiesta il ${ddmmyyyy(r.createdAt.slice(0, 10)).slice(0, 5)}` : ''}`} />
                </Box>
                <StatusBadge status={r.status} />
                <CampoIcon name="chevR" size={14} sx={{ color: 'archie.textFaint' }} />
              </ButtonBase>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )

  const tabs = [
    { key: 'cal', label: 'Griglia' },
    ...(canEditAll ? [{ key: 'coord', label: 'Coordinamento', count: pending.length }] : []),
    { key: 'mine', label: 'Le mie richieste', count: mine.length },
  ]

  const loading = !rosterData || !rowSets

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHead
        title="Piano ferie"
        inline={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {monthStepper}
            <Button size="small" color="inherit" onClick={goToday}>Oggi</Button>
            {areaSwitch}
          </Box>
        }
        actions={rosterData ? <Button startIcon={<AddIcon />} variant="contained" onClick={() => openNew(canEditAll ? null : me, today, today, 'all')}>Nuova richiesta</Button> : undefined}
      />
      {kpiStrip}
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
        <ViewTabs tabs={tabs} value={effView} onChange={(k) => setView(k as View)} />
        {tools}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={22} /></Box>
        ) : !roster.length ? (
          <Typography sx={{ p: 3, fontSize: 13, color: 'text.secondary' }}>Nessuna persona nel piano ferie.</Typography>
        ) : effView === 'mine' ? mineList : effView === 'coord' ? (
          <PfCoord days={days} groups={groups} requests={requests} pending={pending} cells={cells} cal={cal} today={today}
            selDay={selDay} onSelDay={setSelDay} reasonFilter={reasonFilter} selectedKey={selected?.key ?? null} currentUserId={me}
            areaLabelOf={areaLabelOf} coverageOf={coverageOf} busyKey={busyKey} onOpen={openReq} onDecide={(r, s) => void decide(r, s)} />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <PfGrid days={days} groups={groups} cells={cells} cal={cal} today={today} currentUserId={me} reasonFilter={reasonFilter}
              selectedIds={selectedIds} canEdit={canEditUser} onOpenRow={openRow} onCreate={openNew} />
          </Box>
        )}
      </Box>

      <PfDetail
        req={selected}
        areaLabel={selected ? areaLabelOf(selected.user) : ''}
        areaId={selected ? areaOfUser.get(selected.user) ?? null : null}
        areaPeople={selected ? areaPeopleOf(selected.user) : []}
        cells={cells} cal={cal}
        canDecide={canEditAll}
        canEdit={selected ? canEditReq(selected) : false}
        isMine={selected?.user === me}
        busy={selected ? busyKey === selected.key : false}
        onClose={() => setSelectedRowId(null)}
        onDecide={(s) => selected && void decide(selected, s)}
        onEdit={() => selected && setDialog({ kind: 'edit', req: selected })}
        onDelete={() => selected && setToDelete(selected)}
      />

      <PfRequestDialog target={dialog} roster={roster} canEditAll={canEditAll} currentUserId={me} cal={cal} cells={cells}
        onClose={() => setDialog(null)}
        onSaved={(msg) => { setDialog(null); reload(); undoToast.show(msg) }} />

      <ConfirmDeleteDialog
        open={Boolean(toDelete)}
        busy={Boolean(toDelete && busyKey === toDelete.key)}
        title={toDelete && toDelete.user === me && toDelete.status === 'proposta' && !canEditAll ? 'Ritirare la richiesta?' : 'Eliminare la richiesta?'}
        description={toDelete ? `${REASON_LABEL[toDelete.reason]} · ${toDelete.userName}, ${rangeLabel(toDelete.from, toDelete.to)} (${gg(toDelete.days)}).` : ''}
        confirmText={toDelete && toDelete.user === me && toDelete.status === 'proposta' && !canEditAll ? 'Ritira' : 'Elimina'}
        onClose={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </Box>
  )
}
