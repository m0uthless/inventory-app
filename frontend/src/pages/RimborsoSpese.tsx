/**
 * RimborsoSpese — /rimborso-spese
 *
 * Elenco delle note spese (restyle "Campo sterile", anteprima
 * design-previews/ns-base.html). Il dipendente vede le sue note, una per
 * mese; la segreteria vede tutte le note, con le inviate da validare in testa.
 */
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, ButtonBase, CircularProgress } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon, FilterTokens, HeaderFilter, PageHead, ViewTabs } from '../ui/campo'
import { formatEuro, type ExpenseReportRow } from '../features/expenses/expensesShared'
import { LATE_DAYS, agoLabel, daysSince, dShort, filledItems, kmTotal, missingReceipts, monthTitle, reportNumber, toNum } from '../features/expenses/nsModel'
import { ExpenseStatusBadge } from '../features/expenses/nsUi'
import { SecKpis, TechKpis } from '../features/expenses/ExpenseKpis'
import { KmRatesDialog, NewReportDialog } from '../features/expenses/ExpenseDialogs'
import { Ava } from '../features/pianoferie/pfUi'

type Meta = { is_secretary: boolean; user_id: number; km_rate: string | null }
type Scope = 'mine' | 'all'
type View = { key: string; label: string; test: (r: ExpenseReportRow) => boolean; alert?: boolean }

const MINE_VIEWS: View[] = [
  { key: 'all', label: 'Tutte', test: () => true },
  { key: 'open', label: 'Da completare', test: (r) => r.status === 'bozza' || r.status === 'rifiutata', alert: true },
  { key: 'sent', label: 'Inviate', test: (r) => r.status === 'inviata' },
  { key: 'validata', label: 'Validate', test: (r) => r.status === 'validata' },
]
const SEC_VIEWS: View[] = [
  { key: 'inviata', label: 'Da validare', test: (r) => r.status === 'inviata' },
  { key: 'rifiutata', label: 'Rifiutate', test: (r) => r.status === 'rifiutata', alert: true },
  { key: 'validata', label: 'Validate', test: (r) => r.status === 'validata' },
  { key: 'bozza', label: 'In compilazione', test: (r) => r.status === 'bozza' },
  { key: 'all', label: 'Tutte', test: () => true },
]

const byMonthDesc = (a: ExpenseReportRow, b: ExpenseReportRow) => b.year - a.year || b.month - a.month || a.user_name.localeCompare(b.user_name)

function Receipts({ r }: { r: ExpenseReportRow }) {
  const n = filledItems(r).filter((i) => !i.is_km_category).length
  const m = missingReceipts(r).length
  if (!n) return <span className="none">—</span>
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, whiteSpace: 'nowrap', color: m ? 'warning.main' : 'text.secondary', fontWeight: m ? 550 : 400 }}>
      <CampoIcon name={m ? 'alert' : 'file'} size={13} />{m ? `${m} senza scontrino` : `${n}/${n} ${n === 1 ? 'voce' : 'voci'}`}
    </Box>
  )
}

function LastStep({ r, sec }: { r: ExpenseReportRow; sec: boolean }) {
  const sent = r.submitted_at ?? (r.status === 'inviata' ? r.updated_at : null)
  let main: string, sub: string, late = false
  if (sec) {
    if (!sent) return <span className="none">non inviata</span>
    main = dShort(sent)
    if (r.status === 'inviata') { const d = daysSince(sent); sub = d <= 0 ? 'inviata oggi' : `in attesa da ${d} ${d === 1 ? 'giorno' : 'giorni'}`; late = d > LATE_DAYS }
    else sub = r.validated_at ? `${r.status} il ${dShort(r.validated_at)}` : ''
  } else if (r.status === 'validata') { main = dShort(r.validated_at); sub = `validata${r.validated_by_name ? ` da ${r.validated_by_name}` : ''}` }
  else if (r.status === 'rifiutata') { main = dShort(r.validated_at); sub = `rifiutata${r.validated_by_name ? ` da ${r.validated_by_name}` : ''}`; late = true }
  else if (r.status === 'inviata') { main = dShort(sent); sub = 'inviata, in attesa' }
  else { main = dShort(r.updated_at); sub = `modificata ${agoLabel(r.updated_at)}` }
  return <span className="two"><b>{main}</b><small className={late ? 'late' : undefined}>{sub}</small></span>
}

export default function RimborsoSpese() {
  const toast = useToast()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()

  const [meta, setMeta] = React.useState<Meta | null>(null)
  const [rows, setRows] = React.useState<ExpenseReportRow[] | null>(null)
  const [newOpen, setNewOpen] = React.useState(false)
  const [ratesOpen, setRatesOpen] = React.useState(false)

  const secretary = Boolean(meta?.is_secretary)
  const scope: Scope = secretary && sp.get('ambito') !== 'mie' ? 'all' : 'mine'
  const views = scope === 'all' ? SEC_VIEWS : MINE_VIEWS
  const view = views.find((v) => v.key === sp.get('vista'))?.key ?? views[0].key
  const person = scope === 'all' && sp.get('dipendente') ? Number(sp.get('dipendente')) : null
  const setParam = (patch: Record<string, string | null>) => setSp((p) => {
    const n = new URLSearchParams(p)
    Object.entries(patch).forEach(([k, v]) => (v == null ? n.delete(k) : n.set(k, v)))
    return n
  }, { replace: true })

  React.useEffect(() => {
    api.get<Meta>('/expense-reports/meta/').then((r) => setMeta(r.data)).catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const load = React.useCallback(async () => {
    try {
      const res = await api.get<ExpenseReportRow[]>('/expense-reports/')
      setRows([...res.data].sort(byMonthDesc))
    } catch (e) { toast.error(apiErrorToMessage(e)); setRows([]) }
  }, [toast])
  React.useEffect(() => { if (meta) void load() }, [meta, load])

  const mine = React.useMemo(() => (rows ?? []).filter((r) => r.user === meta?.user_id), [rows, meta])
  const base = scope === 'all' ? rows ?? [] : mine
  const vdef = views.find((v) => v.key === view)!
  const shown = base.filter(vdef.test).filter((r) => person == null || r.user === person)
  const people = React.useMemo(() => {
    const m = new Map<number, { name: string; n: number }>()
    ;(rows ?? []).forEach((r) => { const e = m.get(r.user) ?? { name: r.user_name, n: 0 }; e.n++; m.set(r.user, e) })
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [rows])
  const sec = scope === 'all'
  const open = (id: number) => navigate(`/rimborso-spese/${id}`)

  return (
    <Box>
      <PageHead title="Rimborso spese"
        inline={secretary ? (
          <Box role="group" aria-label="Note da mostrare" sx={{ display: 'inline-flex', gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '9px', bgcolor: 'background.paper' }}>
            {([['all', 'Segreteria'], ['mine', 'Le mie note']] as const).map(([k, l]) => (
              <ButtonBase key={k} aria-pressed={scope === k} onClick={() => setParam({ ambito: k === 'mine' ? 'mie' : null, vista: null, dipendente: null })} sx={{
                height: 28, px: 1.25, borderRadius: '6px', fontSize: 13, fontWeight: 550, color: scope === k ? 'primary.main' : 'text.secondary', bgcolor: scope === k ? 'archie.field' : 'transparent',
                '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
              }}>{l}</ButtonBase>
            ))}
          </Box>
        ) : undefined}
        actions={<>
          {secretary ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="users" size={15} />} onClick={() => setRatesOpen(true)}>Tariffe km</Button> : null}
          <Button variant="contained" startIcon={<CampoIcon name="plus" size={15} />} onClick={() => setNewOpen(true)}>Nuova nota spese</Button>
        </>} />

      {rows == null ? <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box> : (
        <>
          {sec ? (
            <SecKpis reports={rows} view={view} onView={(v) => setParam({ vista: v, dipendente: null })} onOpen={open} onPerson={(u) => setParam({ vista: 'all', dipendente: String(u) })} />
          ) : (
            <TechKpis reports={mine} rate={meta?.km_rate ?? null} view={view} onOpen={open} onNew={() => setNewOpen(true)} onView={(v) => setParam({ vista: v })} />
          )}

          <Box component="section" aria-label="Note spese" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
            <ViewTabs value={view} onChange={(k) => setParam({ vista: k })}
              tabs={views.map((v) => ({ key: v.key, label: v.label, count: base.filter(v.test).length, tone: v.alert ? 'alert' : 'default' }))} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 49, px: '12px', py: '8px', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <FilterTokens filters={person != null ? [{ key: 'person', label: 'Dipendente', values: people.find(([id]) => id === person)?.[1].name ?? '' }] : []}
                  onRemove={() => setParam({ dipendente: null })} onClear={() => setParam({ dipendente: null })}
                  empty={sec ? "Nessun filtro. Usa l'imbuto accanto a Dipendente." : 'Le tue note spese, una per mese.'} />
              </Box>
            </Box>
            <Box sx={tableSx}>
              <table>
                <thead><tr>
                  {sec ? <th><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>Dipendente
                    <HeaderFilter label="Dipendente" single searchable options={people.map(([id, p]) => ({ value: String(id), label: p.name, count: p.n }))}
                      selected={person != null ? [String(person)] : []} onChange={(v) => setParam({ dipendente: v[0] ?? null })} /></Box></th> : null}
                  <th>Mese</th><th>Stato</th><th className="n">Spese</th><th className="n c-adv">Anticipi</th><th className="n">Da rendere</th><th className="n c-km">Km</th><th className="c-rc">Scontrini</th><th className="c-up">{sec ? 'Inviata' : 'Ultimo passaggio'}</th>
                </tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} tabIndex={0} onClick={() => open(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(r.id) }} aria-label={`${sec ? `${r.user_name}, ` : ''}${monthTitle(r)}`}>
                      {sec ? <td className="who"><span><Ava name={r.user_name} /><b>{r.user_name}</b></span></td> : null}
                      <td className="mon"><span className="two"><b>{monthTitle(r)}</b><small className="mono">N. {reportNumber(r)}</small></span></td>
                      <td className="st"><ExpenseStatusBadge status={r.status} secretary={sec} /></td>
                      <td className="n c-tot">{formatEuro(r.total_expenses)}</td>
                      <td className="n c-adv">{toNum(r.advances_total) ? `− ${formatEuro(r.advances_total)}` : <span className="none">—</span>}</td>
                      <td className="n c-due"><b>{formatEuro(r.total_due)}</b></td>
                      <td className="n c-km">{kmTotal(r) ? kmTotal(r).toLocaleString('it-IT') : <span className="none">—</span>}</td>
                      <td className="c-rc"><Receipts r={r} /></td>
                      <td className="c-up"><LastStep r={r} sec={sec} /></td>
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr className="empty"><td colSpan={sec ? 9 : 8}>
                      {view === 'inviata' ? 'Nessuna nota da validare: tutto in pari.' : !base.length && !sec ? 'Non hai ancora note spese. Crea quella del mese con «Nuova nota spese».' : 'Nessuna nota spese in questa vista.'}
                    </td></tr>
                  ) : null}
                </tbody>
              </table>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, px: 2, py: 1.25, fontSize: 12, color: 'text.secondary', bgcolor: 'archie.surface2', borderTop: '1px solid', borderColor: 'divider', '& b': { color: 'text.primary', fontWeight: 600 } }}>
              <span><b>{shown.length}</b> {shown.length === 1 ? 'nota' : 'note'} · da rendere <b>{formatEuro(shown.reduce((s, r) => s + toNum(r.total_due), 0))}</b></span>
            </Box>
          </Box>
        </>
      )}

      <NewReportDialog open={newOpen} onClose={() => setNewOpen(false)} mine={mine} onCreated={(id) => { setNewOpen(false); open(id) }} />
      {secretary ? <KmRatesDialog open={ratesOpen} onClose={() => setRatesOpen(false)} onSaved={() => { void load(); api.get<Meta>('/expense-reports/meta/').then((r) => setMeta(r.data)).catch(() => {}) }} /> : null}
    </Box>
  )
}

const tableSx = {
  overflowX: 'auto',
  '& table': { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 },
  '& th': { position: 'sticky', top: 0, zIndex: 1, bgcolor: 'archie.surface2', textAlign: 'left', fontWeight: 550, fontSize: 12, color: 'text.secondary', height: 34, px: '10px', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' },
  '& th:first-of-type, & td:first-of-type': { pl: 2 },
  '& th:last-of-type, & td:last-of-type': { pr: 2 },
  '& td': { height: 52, px: '10px', borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'middle' },
  '& tbody tr:not(.empty)': { cursor: 'pointer', '&:hover td': { bgcolor: 'archie.surface2' }, '&:focus-visible': { outline: 'none', '& td': { bgcolor: 'archie.field' } } },
  '& tr.empty td': { height: 110, textAlign: 'center', color: 'text.secondary' },
  '& .n': { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  '& td.n b': { fontWeight: 650 },
  '& .two': { display: 'grid', '& b': { fontWeight: 550, whiteSpace: 'nowrap' }, '& small': { fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap' }, '& small.late': { color: 'error.main' } },
  '& .mono': { fontFamily: '"Geist Mono", monospace', fontSize: '11px !important' },
  '& .who > span': { display: 'inline-flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap', '& b': { fontWeight: 550 } },
  '& .none': { color: 'archie.textFaint' },
  '@media (max-width: 1180px)': { '& .c-adv, & .c-km': { display: 'none' } },
  '@media (max-width: 760px)': {
    '& thead': { display: 'none' },
    '& table, & tbody': { display: 'block' },
    '& tbody tr:not(.empty)': { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gridAutoFlow: 'row dense', alignItems: 'center', gap: '6px 10px', p: '10px 14px', borderBottom: '1px solid', borderColor: 'divider' },
    '& tbody tr:not(.empty) td': { display: 'block', height: 'auto', p: '0 !important', border: 0 },
    '& tbody tr:not(.empty) td.c-tot, & tbody tr:not(.empty) td.c-adv, & tbody tr:not(.empty) td.c-km, & tbody tr:not(.empty) td.c-up': { display: 'none' },
    '& tbody tr:not(.empty) td.who': { gridColumn: '1 / -1' },
    '& tbody tr:not(.empty) td.st, & tbody tr:not(.empty) td.c-due': { gridColumn: 2, justifySelf: 'end' },
    '& tbody tr:not(.empty) td.c-rc': { gridColumn: 1 },
    '& tr.empty': { display: 'block' },
    '& tr.empty td': { display: 'block' },
  },
} as const
