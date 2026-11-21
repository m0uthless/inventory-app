import { Box, ButtonBase, Tooltip } from '@mui/material'
import { KpiStrip, KpiTile } from '../../ui/campo'
import { formatEuro, type ExpenseReportRow } from './expensesShared'
import { MONTHS_LC, agoLabel, cap, filledItems, kmTotal, missingReceipts, monthTitle, rateLabel, toNum } from './nsModel'

const listSx = {
  display: 'grid', gap: '2px', mt: '2px', fontSize: 12,
  '& button': { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 1, px: 0.5, mx: -0.5, borderRadius: '4px', lineHeight: '19px', color: 'text.secondary', textAlign: 'left', fontSize: 12, '&:hover': { bgcolor: 'archie.surface2', color: 'text.primary' } },
  '& span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  '& b': { color: 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
} as const

/** Barre delle spese mese per mese, colorate per stato della nota. */
function MonthBars({ reports, year }: { reports: ExpenseReportRow[]; year: number }) {
  const byMonth = Array.from({ length: 12 }, (_, i) => reports.find((r) => r.year === year && r.month === i + 1) ?? null)
  const max = Math.max(1, ...byMonth.map((r) => (r ? toNum(r.total_expenses) : 0)))
  const color = (r: ExpenseReportRow) => (r.status === 'validata' ? 'archie.seq.2' : r.status === 'rifiutata' ? 'error.main' : r.status === 'inviata' ? 'info.main' : 'archie.borderStrong')
  return (
    <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px', alignItems: 'end', height: 50, mt: 0.5 }}>
      {byMonth.map((r, i) => (
        <Tooltip key={i} title={`${cap(MONTHS_LC[i + 1])}: ${r ? formatEuro(r.total_expenses) : 'nessuna nota'}`} placement="top">
          <Box sx={{ display: 'grid', justifyItems: 'center', alignContent: 'end', gap: '2px', height: '100%' }}>
            <Box sx={{ width: '100%', maxWidth: 16, height: r ? Math.max(3, (toNum(r.total_expenses) / max) * 34) : 2, borderRadius: '3px 3px 1px 1px', bgcolor: r ? color(r) : 'archie.neutralBg' }} />
            <Box component="small" sx={{ fontSize: 10, lineHeight: 1, color: 'text.disabled' }}>{MONTHS_LC[i + 1][0].toUpperCase()}</Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

export function TechKpis({ reports, rate, onOpen, onNew, onView, view }: {
  reports: ExpenseReportRow[]
  rate: string | null
  onOpen: (id: number) => void
  /** Assente senza il permesso di creare note. */
  onNew?: () => void
  onView: (v: string) => void
  view: string
}) {
  const now = new Date()
  const year = now.getFullYear()
  const cur = reports.find((r) => r.year === year && r.month === now.getMonth() + 1) ?? null
  const rejected = reports.filter((r) => r.status === 'rifiutata')
  const sent = reports.filter((r) => r.status === 'inviata')
  const validated = reports.filter((r) => r.status === 'validata' && r.year === year)
  const km = reports.filter((r) => r.year === year).reduce((s, r) => s + kmTotal(r), 0)
  const curMiss = cur ? missingReceipts(cur).length : 0
  return (
    <KpiStrip>
      {cur ? (
        <KpiTile label={`${cap(MONTHS_LC[cur.month])}, ${cur.status === 'bozza' ? 'in compilazione' : cur.status === 'inviata' ? 'inviata' : cur.status}`} value={formatEuro(cur.total_expenses)} onClick={() => onOpen(cur.id)}
          sub={<><b>{filledItems(cur).length}</b> voci · {curMiss ? <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>{curMiss} senza scontrino</Box> : 'scontrini a posto'}</>} />
      ) : (
        <KpiTile label={cap(MONTHS_LC[now.getMonth() + 1])} value="—" onClick={onNew} sub={onNew ? 'Nessuna nota per questo mese: creala' : 'Nessuna nota per questo mese'} />
      )}
      {rejected.length ? (
        <KpiTile label={rejected.length === 1 ? `${monthTitle(rejected[0])}, rifiutata` : `${rejected.length} note rifiutate`} value={formatEuro(rejected[0].total_due)} unit="da correggere"
          onClick={() => (rejected.length === 1 ? onOpen(rejected[0].id) : onView('open'))} sub={<Box component="span" title={rejected[0].rejection_reason}>{rejected[0].rejection_reason || 'Correggi e reinvia'}</Box>} />
      ) : (
        <KpiTile label="In attesa della segreteria" value={sent.length} unit={sent.length ? formatEuro(sent.reduce((s, r) => s + toNum(r.total_due), 0)) : undefined}
          onClick={sent.length ? () => onView('sent') : undefined} active={view === 'sent'} sub={sent.length ? <>inviata {agoLabel(sent[sent.length - 1].submitted_at ?? sent[sent.length - 1].updated_at)}</> : 'Niente in sospeso'} />
      )}
      <KpiTile label={`Rimborsato nel ${year}`} value={formatEuro(validated.reduce((s, r) => s + toNum(r.total_due), 0))}
        sub={<><b>{validated.length}</b> note validate · <b>{km.toLocaleString('it-IT')}</b> km</>} />
      <KpiTile wide label="Spese per mese">
        <Box sx={{ position: 'absolute', top: 10, right: 12, fontSize: 12, color: 'text.secondary' }}>{rateLabel(rate) ?? 'tariffa km non impostata'}</Box>
        <MonthBars reports={reports} year={year} />
      </KpiTile>
    </KpiStrip>
  )
}

export function SecKpis({ reports, view, onView, onOpen, onPerson }: {
  reports: ExpenseReportRow[]
  view: string
  onView: (v: string) => void
  onOpen: (id: number) => void
  onPerson: (userId: number) => void
}) {
  const now = new Date()
  const pending = reports.filter((r) => r.status === 'inviata')
  const oldest = [...pending].sort((a, b) => (a.submitted_at ?? a.updated_at).localeCompare(b.submitted_at ?? b.updated_at))[0]
  const miss = pending.filter((r) => missingReceipts(r).length)
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const valMonth = reports.filter((r) => r.status === 'validata' && r.validated_at?.slice(0, 7) === monthKey)
  const year = now.getFullYear()
  const people = new Map<number, { name: string; v: number }>()
  reports.filter((r) => r.status === 'validata' && r.year === year).forEach((r) => {
    const e = people.get(r.user) ?? { name: r.user_name, v: 0 }
    e.v += toNum(r.total_due); people.set(r.user, e)
  })
  const byPerson = [...people.entries()].sort((a, b) => b[1].v - a[1].v)
  return (
    <KpiStrip>
      <KpiTile label="Da validare" value={pending.length} unit={pending.length ? formatEuro(pending.reduce((s, r) => s + toNum(r.total_due), 0)) : undefined}
        onClick={() => onView('inviata')} active={view === 'inviata'}
        sub={oldest ? <>la più vecchia: <b>{oldest.user_name}</b> · {agoLabel(oldest.submitted_at ?? oldest.updated_at)}</> : 'Tutto in pari'} />
      <KpiTile label="Senza scontrino" value={miss.length} unit={miss.length === 1 ? 'nota da validare' : 'note da validare'}>
        <Box sx={listSx}>
          {miss.slice(0, 3).map((r) => (
            <ButtonBase key={r.id} onClick={() => onOpen(r.id)}><span>{r.user_name} · {MONTHS_LC[r.month]}</span><b>{missingReceipts(r).length} {missingReceipts(r).length === 1 ? 'voce' : 'voci'}</b></ButtonBase>
          ))}
        </Box>
      </KpiTile>
      <KpiTile label={`Validato a ${MONTHS_LC[now.getMonth() + 1]}`} value={formatEuro(valMonth.reduce((s, r) => s + toNum(r.total_due), 0))}
        sub={<><b>{valMonth.length}</b> {valMonth.length === 1 ? 'nota' : 'note'} · {new Set(valMonth.map((r) => r.user)).size} {new Set(valMonth.map((r) => r.user)).size === 1 ? 'dipendente' : 'dipendenti'}</>} />
      <KpiTile wide label={`Rimborsato nel ${now.getFullYear()} per persona`}>
        <Box sx={listSx}>
          {byPerson.slice(0, 4).map(([id, p]) => (
            <ButtonBase key={id} onClick={() => onPerson(id)}><span>{p.name}</span><b>{formatEuro(p.v)}</b></ButtonBase>
          ))}
          {!byPerson.length ? <Box component="span" sx={{ color: 'text.disabled' }}>Nessuna nota validata quest'anno.</Box> : null}
        </Box>
      </KpiTile>
    </KpiStrip>
  )
}
