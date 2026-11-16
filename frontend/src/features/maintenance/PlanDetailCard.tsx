import * as React from 'react'
import { Box, Button, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { api } from '@shared/api/client'
import { CampoIcon, DetailSection, FloatingDetail } from '../../ui/campo'
import { Empty, Loading, mono, useList } from '../../ui/campo/ListRows'
import { daysLabel, dShort } from '../contracts/contractModel'
import type { EventRow, PlanRow, TodoRow } from '../../pages/maintenanceTypes'
import { dueStateOf, planStateOf, RESULT_LABEL, scheduleText, type Result } from './mtModel'
import { PlanStateBadge, ResultBadge } from './mtUi'

export type PlanTab = 'det' | 'inv' | 'his'
type Inv = { id: number; name: string; knumber?: string | null; hostname?: string | null; site_name?: string | null; type_label?: string | null }
type Props = {
  plan: PlanRow
  tab: PlanTab
  onTab: (t: PlanTab) => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  canChange: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onPdf: () => void
  onTodo: () => void
  reloadKey?: unknown
}

const dl = { m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontWeight: 550 } } as const

/** Inventari coperti dal piano (stessi tipi e cliente), come il report PDF. */
function useCovered(plan: PlanRow) {
  const [rows, setRows] = React.useState<Inv[] | null>(null)
  React.useEffect(() => {
    let alive = true
    setRows(null)
    Promise.all((plan.inventory_types ?? []).map((t) => api.get('/inventories/', { params: { customer: plan.customer, type: t, ordering: 'knumber', page_size: 500 } }).then((r) => (r.data.results ?? []) as Inv[])))
      .then((all) => { if (alive) setRows(all.flat()) }).catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [plan.id, plan.customer, plan.inventory_types])
  return rows
}

/** Scheda flottante del piano (anteprima design-previews/mt-base.html › Piani). */
export default function PlanDetailCard(p: Props) {
  const pl = p.plan
  const deleted = Boolean(pl.deleted_at)
  const covered = pl.covered_count ?? 0
  const todoN = Math.min(pl.todo_count ?? 0, covered)
  const over = pl.overdue_count ?? 0
  const done = covered - todoN
  const state = planStateOf(pl)
  const todo = useList<TodoRow>('/maintenance-plans/todo/', { plan: pl.id, page_size: 500 }, p.reloadKey)
  const events = useList<EventRow>('/maintenance-events/', { plan: pl.id, ordering: '-performed_at', page_size: 100 }, p.reloadKey)
  const inventories = useCovered(pl)

  const bar = (n: number, color: string) => (n ? <Box sx={{ flex: n, bgcolor: color, minWidth: 4 }} /> : null)
  const details = (
    <>
      <DetailSection title="Avanzamento del ciclo" end={<Typography component="b" sx={{ fontSize: 13, fontWeight: 650 }}>{done}/{covered}</Typography>}>
        <Box aria-hidden sx={{ display: 'flex', gap: '2px', height: 10, borderRadius: '5px', overflow: 'hidden', bgcolor: 'archie.neutralBg' }}>
          {bar(done, 'success.main')}{bar(over, 'error.main')}{bar(todoN - over, 'archie.seq.0')}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.75, fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
          {[['success.main', 'eseguite', done], ['error.main', 'scadute', over], ['archie.seq.0', 'da fare', todoN - over]].map(([c, l, n]) => (
            <Box key={l as string} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="i" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: c as string }} />{l} <b>{n}</b></Box>
          ))}
        </Box>
      </DetailSection>
      <DetailSection title="Programmazione">
        <Box component="dl" sx={dl}>
          <dt>Cadenza</dt><dd>{scheduleText(pl)}</dd>
          <dt>Prossima scadenza</dt><dd>{pl.next_due_date ? `${dShort(pl.next_due_date)} · ${daysLabel(pl.next_due_date)}` : '—'}</dd>
          <dt>Avviso</dt><dd>{pl.alert_days_before} giorni prima</dd>
          <dt>Tipi coperti</dt><dd>{(pl.inventory_type_labels ?? []).join(', ') || '—'}</dd>
          <dt>Ultima esecuzione</dt><dd>{pl.last_done_date ? dShort(pl.last_done_date) : '—'}</dd>
          <dt>Stato</dt><dd>{pl.is_active ? 'Attivo' : 'Non attivo'}</dd>
        </Box>
      </DetailSection>
      <DetailSection title="Note">
        {pl.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{pl.notes}</Typography> : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessuna nota.</Typography>}
      </DetailSection>
    </>
  )

  const invList = !inventories || !todo ? <Loading /> : !inventories.length ? <Empty text="Nessun inventario attivo di questi tipi per il cliente." /> : (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
      {inventories.map((inv) => {
        const t = todo.find((r) => r.inventory_id === inv.id)
        const last = events?.find((e) => e.inventory === inv.id)
        const st = t ? (dueStateOf(t.next_due_date) === 'overdue' ? 'over' : 'todo') : 'done'
        return (
          <Box component="li" key={inv.id} sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{
              width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
              bgcolor: st === 'done' ? 'success.light' : st === 'over' ? 'error.light' : 'transparent', color: st === 'done' ? 'success.main' : 'error.main',
              boxShadow: (th) => (st === 'todo' ? `inset 0 0 0 2px ${th.palette.archie.borderStrong}` : 'none'),
            }}>{st === 'done' ? <CheckIcon sx={{ fontSize: 13 }} /> : st === 'over' ? '!' : null}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{inv.name}</Typography>
              <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary' }}>{[inv.site_name, inv.knumber].filter(Boolean).join(' · ')}</Typography>
            </Box>
            <Box sx={{ fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap', color: st === 'over' ? 'error.main' : 'text.secondary', fontWeight: st === 'over' ? 600 : 400 }}>
              {st === 'done' ? (last ? <>fatta {dShort(last.performed_at)}{last.result !== 'ok' ? <Box component="b" sx={{ ml: 0.5, fontWeight: 600, color: last.result === 'ko' ? 'error.main' : last.result === 'partial' ? 'warning.main' : 'text.secondary' }}>· {RESULT_LABEL[last.result as Result]}</Box> : null}</> : 'fatta') : st === 'over' ? `scaduta ${daysLabel(t!.next_due_date)}` : `entro ${dShort(t!.next_due_date)}`}
            </Box>
          </Box>
        )
      })}
    </Box>
  )

  const history = !events ? <Loading /> : !events.length ? <Empty text="Nessun rapportino per questo piano." /> : (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      {events.map((e) => (
        <Box key={e.id} sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
          <ResultBadge result={e.result as Result} />
          <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{e.inventory_name}</b>{e.tech_name ? ` · ${e.tech_name}` : ''}</Box>
          <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{dShort(e.performed_at)}</Box>
        </Box>
      ))}
    </Box>
  )

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio piano"
      idLabel={<Box component="span" sx={mono}>Piano #{pl.id}</Box>}
      status={<PlanStateBadge state={state} onDark />}
      title={pl.title}
      subtitle={[pl.customer_name, scheduleText(pl)].filter(Boolean).join(' · ')}
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'inv', label: 'Inventari', count: covered }, { key: 'his', label: 'Storico', count: events?.length ?? null }]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as PlanTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={deleted ? undefined : [
        { label: 'Modifica', icon: <CampoIcon name="wrench" />, onClick: p.onEdit, disabled: !p.canChange },
        { label: 'Crea report PDF', icon: <CampoIcon name="download" />, onClick: p.onPdf },
        { label: 'Vedi le manutenzioni da fare', icon: <CampoIcon name="calendar" />, onClick: p.onTodo },
        { label: 'Sposta nel cestino', icon: <CampoIcon name="trash" />, onClick: p.onDelete, danger: true, disabled: !p.canDelete },
      ]}
      footer={p.tab === 'det' ? (deleted ? (
        <>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nel cestino</Typography>
          <Box sx={{ flex: 1 }} />
          {p.canChange ? <Button variant="contained" onClick={p.onRestore}>Ripristina</Button> : null}
        </>
      ) : (
        <>
          <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="download" size={15} />} onClick={p.onPdf}>Report PDF</Button>
          {todoN ? <Button variant="outlined" color="inherit" onClick={p.onTodo}>Vedi da fare</Button> : null}
          <Box sx={{ flex: 1 }} />
          {p.canChange ? <Button variant="contained" startIcon={<CampoIcon name="wrench" size={15} />} onClick={p.onEdit}>Modifica</Button> : null}
        </>
      )) : undefined}
    >
      {p.tab === 'det' ? details : p.tab === 'inv' ? invList : history}
    </FloatingDetail>
  )
}
