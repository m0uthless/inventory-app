import * as React from 'react'
import { Box, Button, ButtonBase, Checkbox, IconButton, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon } from '../../ui/campo'
import { daysLabel } from '../contracts/contractModel'
import type { TodoRow } from '../../pages/maintenanceTypes'
import { dueStateOf, isoOf, parseIso, rowKey, todayIso, type DueState, type TodoStats } from './mtModel'
import { DueStateBadge } from './mtUi'
import { fetchAll } from '../../api/fetchAll'

type Props = {
  stats: TodoStats | null
  /** Filtri cliente / piano / tipo / ricerca, gli stessi dell'elenco. */
  params: Record<string, unknown>
  reloadKey: unknown
  checked: Set<string>
  onToggle: (r: TodoRow) => void
  onToggleMany: (rows: TodoRow[]) => void
  onRegister: (rows: TodoRow[]) => void
  onOpen: (r: TodoRow) => void
}

const TONE: Record<DueState, { bg: string; fg: string }> = {
  overdue: { bg: 'error.light', fg: 'error.main' },
  next30: { bg: 'warning.light', fg: 'warning.main' },
  later: { bg: 'archie.field', fg: 'primary.main' },
}
const DOW = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
const worstOf = (rows: TodoRow[]): DueState | null => (rows.some((r) => dueStateOf(r.next_due_date) === 'overdue') ? 'overdue' : rows.some((r) => dueStateOf(r.next_due_date) === 'next30') ? 'next30' : rows.length ? 'later' : null)

/** Scadenze sul calendario: carico dei 12 mesi, mese con i clienti giorno per giorno, pannello del giorno. */
export default function MaintenanceCalendar({ stats, params, reloadKey, checked, onToggle, onToggleMany, onRegister, onOpen }: Props) {
  const toast = useToast()
  const now = new Date()
  const [month, setMonth] = React.useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [day, setDay] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<TodoRow[]>([])
  const [overdue, setOverdue] = React.useState<TodoRow[]>([])
  const key = JSON.stringify(params)

  React.useEffect(() => {
    const from = isoOf(new Date(month.getFullYear(), month.getMonth(), 1))
    const to = isoOf(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    const base = JSON.parse(key)
    let alive = true
    Promise.all([
      fetchAll<TodoRow>('/maintenance-plans/todo/', { ...base, due_from: from, due_to: to }),
      fetchAll<TodoRow>('/maintenance-plans/todo/', { ...base, due: 'overdue' }),
    ]).then(([m, o]) => { if (alive) { setRows(m); setOverdue(o) } })
      .catch((e) => toast.error(apiErrorToMessage(e)))
    return () => { alive = false }
  }, [month, key, reloadKey, toast])

  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const today = todayIso()
  const onDay = (iso: string) => rows.filter((r) => r.next_due_date === iso)
  const side = day ? onDay(day) : overdue
  const groups = Object.entries(side.reduce<Record<string, TodoRow[]>>((a, r) => { (a[`${r.customer_name}${r.site_name ? ` · ${r.site_name}` : ''}`] ||= []).push(r); return a }, {}))
  const selected = [...rows, ...overdue].filter((r, i, a) => checked.has(rowKey(r)) && a.findIndex((x) => rowKey(x) === rowKey(r)) === i)

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 340px' }, bgcolor: 'archie.surface2' }}>
      <Box sx={{ p: '14px 16px 16px', minWidth: 0, borderRight: { lg: '1px solid' }, borderColor: { lg: 'divider' } }}>
        {/* Carico dei prossimi 12 mesi */}
        <Box role="group" aria-label="Carico dei prossimi 12 mesi" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(6, minmax(0,1fr))', md: 'repeat(12, minmax(0,1fr))' }, gap: 0.5, mb: 1.75 }}>
          {(stats?.months ?? []).map((m) => {
            const d = parseIso(`${m.month}-01`); const tot = m.overdue + m.next30 + m.later
            const tone: DueState | null = m.overdue ? 'overdue' : m.next30 ? 'next30' : tot ? 'later' : null
            const on = d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
            return (
              <ButtonBase key={m.month} onClick={() => { setMonth(d); setDay(null) }} aria-pressed={on}
                title={`${d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}: ${m.overdue} scadute, ${m.next30} entro 30 giorni, ${m.later} più avanti`}
                sx={{
                  display: 'grid', justifyItems: 'start', gap: 0.25, p: '6px 8px', borderRadius: '7px', textAlign: 'left', minWidth: 0,
                  bgcolor: tone ? TONE[tone].bg : 'background.paper', border: '1px solid', borderColor: tone ? 'transparent' : 'divider',
                  boxShadow: (t) => (on ? `0 0 0 2px ${t.palette.archie.surface2}, 0 0 0 3.5px ${t.palette.text.primary}` : 'none'),
                  '&:hover': { filter: 'brightness(0.97)' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'capitalize' }}>
                  {d.toLocaleDateString('it-IT', { month: 'short' })}{d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}
                </Box>
                <Box component="span" sx={{ fontSize: 17, fontWeight: 650, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: tone ? TONE[tone].fg : 'text.disabled' }}>{tot || '—'}</Box>
              </ButtonBase>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
          <IconButton size="small" aria-label="Mese precedente" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setDay(null) }}><CampoIcon name="chevL" size={16} /></IconButton>
          <Typography component="h3" sx={{ fontSize: 16, fontWeight: 650, minWidth: 150, textTransform: 'capitalize' }}>{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</Typography>
          <IconButton size="small" aria-label="Mese successivo" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setDay(null) }}><CampoIcon name="chevR" size={16} /></IconButton>
          <Button size="small" variant="outlined" color="inherit" onClick={() => { setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setDay(null) }}>Oggi</Button>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1.5, fontSize: 12, color: 'text.secondary' }}>
            {(['overdue', 'next30', 'later'] as DueState[]).map((k) => (
              <Box key={k} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <Box component="i" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TONE[k].fg }} />{k === 'overdue' ? 'scadute' : k === 'next30' ? 'entro 30 giorni' : 'più avanti'}
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: '1px', bgcolor: 'divider', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
          {DOW.map((d) => <Box key={d} sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', p: '6px 8px', bgcolor: 'archie.surface2' }}>{d}</Box>)}
          {days.map((d) => {
            const iso = isoOf(d); const its = onDay(iso); const out = d.getMonth() !== month.getMonth()
            const worst = worstOf(its); const past = iso < today; const on = day === iso
            const byCust = Object.entries(its.reduce<Record<string, TodoRow[]>>((a, r) => { (a[r.customer_name] ||= []).push(r); return a }, {}))
            return (
              <ButtonBase key={iso} onClick={() => setDay(on ? null : iso)} aria-pressed={on}
                aria-label={`${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}, ${its.length} manutenzioni`}
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '3px', minHeight: { xs: 54, md: 72 }, p: '5px 6px', minWidth: 0, textAlign: 'left',
                  bgcolor: worst && !out ? TONE[worst].bg : out ? 'archie.surface2' : 'background.paper',
                  opacity: out ? 0.55 : past && !worst ? 0.7 : 1,
                  boxShadow: (t) => (on ? `inset 0 0 0 2px ${t.palette.text.primary}` : 'none'),
                  '&:hover': { filter: 'brightness(0.97)' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                <Box component="span" sx={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: out ? 'text.disabled' : 'text.primary' }}>
                  {iso === today ? <Box component="b" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '5px', px: 0.625 }}>{d.getDate()}</Box> : d.getDate()}
                </Box>
                {byCust.slice(0, 2).map(([c, a]) => { const w = worstOf(a) ?? 'later'; return (
                  <Box key={c} component="span" sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.625, fontSize: 11, lineHeight: '18px', px: 0.625, borderRadius: '4px', bgcolor: 'background.paper', minWidth: 0, boxShadow: (t) => `inset 0 0 0 1px ${t.palette.divider}` }}>
                    <Box component="i" sx={{ width: 6, height: 6, borderRadius: '50%', flex: 'none', bgcolor: TONE[w].fg }} />
                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</Box>
                    <Box component="b" sx={{ ml: 'auto', fontWeight: 650, color: TONE[w].fg }}>{a.length}</Box>
                  </Box>
                ) })}
                {byCust.length > 2 ? <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, fontSize: 11, color: 'text.secondary', pl: 0.625 }}>+{byCust.length - 2} altri</Box> : null}
                {its.length ? <Box component="span" sx={{ display: { xs: 'block', md: 'none' }, fontSize: 11, fontWeight: 650, color: TONE[worst ?? 'later'].fg }}>{its.length}</Box> : null}
              </ButtonBase>
            )
          })}
        </Box>
      </Box>

      {/* Pannello del giorno o delle scadute */}
      <Box component="aside" aria-label="Manutenzioni del giorno" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.paper', borderTop: { xs: '1px solid', lg: 0 }, borderColor: 'divider' }}>
        <Box sx={{ p: '14px 16px 10px', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 650, textTransform: day ? 'capitalize' : 'none', color: day ? 'text.primary' : 'error.main' }}>
            {day ? parseIso(day).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Da recuperare'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {day ? `${side.length} manutenzioni in scadenza` : side.length ? `${side.length} manutenzioni scadute prima di oggi: pianificale per prime` : 'Nessuna manutenzione scaduta.'}
            {day ? <> · <Box component="button" type="button" onClick={() => setDay(null)} sx={{ border: 0, p: 0, bgcolor: 'transparent', font: 'inherit', color: 'primary.main', cursor: 'pointer', fontWeight: 550 }}>torna alle scadute</Box></> : null}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: { lg: 560 }, p: '8px 10px 12px', display: 'grid', gap: 0.75, alignContent: 'start', bgcolor: 'archie.surface2' }}>
          {groups.map(([g, its]) => (
            <React.Fragment key={g}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, px: 0.75, pt: 1, fontSize: 11.5, fontWeight: 650 }}>
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g}</Box>
                <Box component="button" type="button" onClick={() => onToggleMany(its)} sx={{ border: 0, p: 0, bgcolor: 'transparent', font: 'inherit', fontSize: 12, color: 'primary.main', cursor: 'pointer', fontWeight: 550, flex: 'none' }}>
                  {its.every((r) => checked.has(rowKey(r))) ? 'deseleziona' : 'seleziona'}
                </Box>
              </Box>
              {its.map((r) => (
                <Box key={rowKey(r)} sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 0.75, alignItems: 'center', bgcolor: 'background.paper', border: '1px solid', borderColor: checked.has(rowKey(r)) ? 'archie.fieldLine' : 'divider', borderRadius: '8px', p: '4px 10px 4px 2px' }}>
                  <Checkbox size="small" checked={checked.has(rowKey(r))} onChange={() => onToggle(r)} slotProps={{ input: { 'aria-label': `Seleziona ${r.inventory_name}` } }} />
                  <ButtonBase onClick={() => onOpen(r)} sx={{ display: 'block', textAlign: 'left', minWidth: 0, borderRadius: '4px' }}>
                    <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600 }}>{r.inventory_name}</Typography>
                    <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary' }}>{r.plan_title}{r.knumber ? ` · ${r.knumber}` : ''}</Typography>
                  </ButtonBase>
                  {day ? <DueStateBadge due={r.next_due_date} /> : <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'error.main', whiteSpace: 'nowrap' }}>{daysLabel(r.next_due_date)}</Typography>}
                </Box>
              ))}
            </React.Fragment>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '10px 12px', borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ flex: 1, fontSize: 12, color: 'text.secondary' }}>{selected.length ? <><b>{selected.length}</b> selezionate</> : 'Seleziona per registrare insieme'}</Typography>
          <Button size="small" variant="contained" disabled={!selected.length} startIcon={<CheckIcon />} onClick={() => onRegister(selected)}>Registra</Button>
        </Box>
      </Box>
    </Box>
  )
}
