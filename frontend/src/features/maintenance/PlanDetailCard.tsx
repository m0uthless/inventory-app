import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { buildQuery } from '@shared/utils/nav'
import {
  BandChip, CampoIcon, RecordEmpty, RecordGrid, RecordLink, RecordLoader, RecordModal, RecordRow, RecordRows, RecordSection, RecordValue,
  bandButtonSx, bandSolidSx, useList,
} from '../../ui/campo'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { daysLabel, dShort } from '../contracts/contractModel'
import type { EventRow, PlanRow, TodoRow } from '../../pages/maintenanceTypes'
import { dueStateOf, planStateOf, RESULT_LABEL, scheduleText, type Result } from './mtModel'
import { ResultBadge } from './mtUi'
import { fetchAll } from '../../api/fetchAll'

/*
 * Finestra del piano di manutenzione, anteprima design-previews/mtw-base.html › Piani: «Report PDF» come
 * azione principale; al centro l'avanzamento del ciclo, gli inventari coperti con il loro stato e lo
 * storico dei rapportini; a lato programmazione, note e attività. «Modifica» (⋯) apre il dialogo del piano.
 */

type Inv = { id: number; name: string; knumber?: string | null; hostname?: string | null; site_name?: string | null; type_label?: string | null }
type Props = {
  plan: PlanRow
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

const dIt = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '')
const PLAN_FIELDS: Record<string, string> = {
  title: 'il titolo', schedule_type: 'il tipo di cadenza', interval_value: "l'intervallo", interval_unit: "l'unità dell'intervallo", fixed_month: 'il mese', fixed_day: 'il giorno',
  next_due_date: 'la prossima scadenza', alert_days_before: "l'avviso", is_active: 'lo stato', notes: 'le note', inventory_types: 'i tipi coperti', customer: 'il cliente',
}

/** Inventari coperti dal piano (stessi tipi e cliente), come il report PDF. */
function useCovered(plan: PlanRow) {
  const [rows, setRows] = React.useState<Inv[] | null>(null)
  React.useEffect(() => {
    let alive = true
    setRows(null)
    Promise.all((plan.inventory_types ?? []).map((t) => fetchAll<Inv>('/inventories/', { customer: plan.customer, type: t, ordering: 'knumber' })))
      .then((all) => { if (alive) setRows(all.flat()) }).catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [plan.id, plan.customer, plan.inventory_types])
  return rows
}

export default function PlanDetailCard(p: Props) {
  const pl = p.plan
  const navigate = useNavigate()
  const deleted = Boolean(pl.deleted_at)
  const covered = pl.covered_count ?? 0
  const todoN = Math.min(pl.todo_count ?? 0, covered)
  const over = pl.overdue_count ?? 0
  const done = covered - todoN
  const state = planStateOf(pl)
  const todo = useList<TodoRow>('/maintenance-plans/todo/', { plan: pl.id, page_size: 500 }, p.reloadKey)
  const events = useList<EventRow>('/maintenance-events/', { plan: pl.id, ordering: '-performed_at', page_size: 100 }, p.reloadKey)
  const inventories = useCovered(pl)
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => { setMenu(null) }, [pl.id])
  const dueState = pl.next_due_date ? dueStateOf(pl.next_due_date) : 'ok'
  const warn = over > 0 || dueState === 'overdue'
  const scrollTo = (id: string) => document.getElementById(`plan-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const chip = (txt: React.ReactNode, w?: boolean, onClick?: () => void) => (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick} sx={{
      height: 20, px: 0.9, border: 0, font: 'inherit', borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
      bgcolor: w ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: w ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 },
      '&:hover': onClick ? { bgcolor: 'rgb(255 255 255 / .22)' } : undefined,
    }}>{txt}</Box>
  )
  const bar = (n: number, color: string) => (n ? <Box sx={{ flex: n, bgcolor: color, minWidth: 4 }} /> : null)
  const stateLabel = !pl.is_active ? 'Non attivo' : state === 'done' ? 'Ciclo completato' : over ? 'Con scadute' : dueState === 'next30' ? 'In scadenza' : 'Attivo'

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Piano ${pl.title}`} compact
      title={pl.title}
      status={<>
        <Box component="span" sx={{ fontSize: 11.5, fontWeight: 650, px: 1, py: '2px', borderRadius: '5px', ...(over ? { bgcolor: '#f2b8b0', color: '#5a1410' } : dueState === 'next30' && pl.is_active ? { bgcolor: '#e0a43a', color: '#2b1d00' } : { bgcolor: 'rgb(255 255 255 / .16)' }) }}>{stateLabel}</Box>
        {deleted ? <BandChip>Nel cestino</BandChip> : null}
      </>}
      subtitle={<>{pl.customer_name}{' · '}{scheduleText(pl)}{(pl.inventory_type_labels ?? []).length ? ` · ${(pl.inventory_type_labels ?? []).join(', ')}` : ''}</>}
      tags={<>
        {pl.next_due_date ? chip(<>prossima <b>{dIt(pl.next_due_date)}</b></>, warn) : null}
        {chip(<>ciclo <b>{done}/{covered}</b></>)}
        {over ? chip(<><b>{over}</b> {over === 1 ? 'scaduta' : 'scadute'}</>, true, () => scrollTo('inv')) : null}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {deleted ? (p.canChange ? <Button variant="outlined" onClick={p.onRestore} startIcon={<CampoIcon name="restore" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Ripristina</Button> : null)
          : <Button variant="outlined" startIcon={<CampoIcon name="download" size={15} />} onClick={p.onPdf} sx={{ ...bandButtonSx, ...bandSolidSx }}>Report PDF</Button>}
        {!deleted ? <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip> : null}
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!p.canChange} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica…</MenuItem>
          <MenuItem onClick={() => { setMenu(null); p.onTodo() }}><ListItemIcon><CampoIcon name="calendar" size={16} /></ListItemIcon>Vedi le scadenze</MenuItem>
          <MenuItem disabled={!p.canDelete} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Sposta nel cestino</MenuItem>
        </Menu>
      </>}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title={<>Avanzamento del ciclo<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{done} di {covered}</Box></>}>
            <Box aria-hidden sx={{ display: 'flex', gap: '2px', height: 10, borderRadius: '5px', overflow: 'hidden', bgcolor: 'archie.neutralBg' }}>
              {bar(done, 'success.main')}{bar(over, 'error.main')}{bar(todoN - over, 'archie.seq.0')}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1, fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
              {[['success.main', 'eseguite', done], ['error.main', 'scadute', over], ['archie.seq.0', 'da fare', todoN - over]].map(([c, l, n]) => (
                <Box key={l as string} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="i" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: c as string }} />{l} <b>{n}</b></Box>
              ))}
            </Box>
          </RecordSection>

          <Box id="plan-inv" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Inventari coperti<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{inventories?.length ?? ''}</Box></>}
              end={todoN ? <Button size="small" onClick={p.onTodo}>Vedi le scadenze</Button> : undefined}>
              {!inventories || !todo ? <RecordLoader /> : !inventories.length ? <RecordEmpty>Nessun inventario attivo di questi tipi per il cliente.</RecordEmpty> : (
                <RecordRows>
                  {inventories.map((inv) => {
                    const t = todo.find((r) => r.inventory_id === inv.id)
                    const last = events?.find((e) => e.inventory === inv.id)
                    const st = t ? (dueStateOf(t.next_due_date) === 'overdue' ? 'over' : 'todo') : 'done'
                    return (
                      <RecordRow key={inv.id}
                        lead={<Box sx={{
                          width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                          bgcolor: st === 'done' ? 'success.light' : st === 'over' ? 'error.light' : 'transparent', color: st === 'done' ? 'success.main' : 'error.main',
                          boxShadow: (th) => (st === 'todo' ? `inset 0 0 0 2px ${th.palette.archie.borderStrong}` : 'none'),
                        }}>{st === 'done' ? <CheckIcon sx={{ fontSize: 13 }} /> : st === 'over' ? '!' : null}</Box>}
                        leadWidth={22}
                        title={inv.name}
                        sub={[inv.site_name, inv.knumber].filter(Boolean).join(' · ') || undefined}
                        end={<Box component="span" sx={{ color: st === 'over' ? 'error.main' : 'text.secondary', fontWeight: st === 'over' ? 600 : 400 }}>
                          {st === 'done' ? (last ? <>fatta {dShort(last.performed_at)}{last.result !== 'ok' ? ` · ${RESULT_LABEL[last.result as Result]}` : ''}</> : 'fatta') : st === 'over' ? `scaduta ${daysLabel(t!.next_due_date)}` : `entro ${dShort(t!.next_due_date)}`}
                        </Box>}
                        onClick={() => { p.onClose(); navigate(`/inventory${buildQuery({ open: inv.id })}`) }} />
                    )
                  })}
                </RecordRows>
              )}
            </RecordSection>
          </Box>

          <RecordSection title={<>Storico rapportini<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{events?.length ?? ''}</Box></>}>
            {!events ? <RecordLoader /> : events.length ? (
              <RecordRows>
                {events.map((e) => (
                  <RecordRow key={e.id} leadWidth={48}
                    lead={<Box sx={{ display: 'grid', justifyItems: 'center', lineHeight: 1.1, py: 0.5, width: 44, borderRadius: '7px', bgcolor: 'archie.surface2', color: 'text.primary' }}>
                      <Box component="b" sx={{ fontSize: 13, fontWeight: 650 }}>{dIt(e.performed_at).slice(0, 5)}</Box>
                      <Box component="small" sx={{ fontSize: 10, color: 'text.secondary' }}>{e.performed_at.slice(0, 4)}</Box>
                    </Box>}
                    title={e.inventory_name || 'Inventario'}
                    sub={[e.tech_name || 'nessun tecnico', e.notes].filter(Boolean).join(' · ')}
                    end={<><ResultBadge result={e.result as Result} />{e.pdf_url ? <Tooltip title="Apri il PDF"><IconButton size="small" aria-label="Apri il PDF" onClick={() => window.open(e.pdf_url ?? '', '_blank', 'noopener')} sx={{ width: 28, height: 28 }}><CampoIcon name="file" size={14} /></IconButton></Tooltip> : null}</>} />
                ))}
              </RecordRows>
            ) : <RecordEmpty>Nessun rapportino per questo piano.</RecordEmpty>}
          </RecordSection>
        </Box>

        <Box component="aside" aria-label="Piano" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Programmazione">
            <RecordGrid>
              <RecordValue label="Cliente" wide><RecordLink onClick={() => { p.onClose(); navigate(`/customers${buildQuery({ open: pl.customer })}`) }}>{pl.customer_name}</RecordLink></RecordValue>
              <RecordValue label="Cadenza" wide>{scheduleText(pl)}</RecordValue>
              <RecordValue label="Prossima scadenza">{pl.next_due_date ? dIt(pl.next_due_date) : null}</RecordValue>
              <RecordValue label="Avviso">{pl.alert_days_before} giorni prima</RecordValue>
              <RecordValue label="Tipi coperti" wide>{(pl.inventory_type_labels ?? []).join(', ') || null}</RecordValue>
              <RecordValue label="Ultima esecuzione">{pl.last_done_date ? dIt(pl.last_done_date) : null}</RecordValue>
              <RecordValue label="Stato">{pl.is_active ? 'Attivo' : 'Non attivo'}</RecordValue>
            </RecordGrid>
          </RecordSection>
          <RecordSection title="Note">
            {pl.notes ? <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{pl.notes}</Typography> : <RecordEmpty>Nessuna nota.</RecordEmpty>}
          </RecordSection>
          <RecordSection title="Attività recente">
            <AuditFeedPanel appLabel="maintenance" model="maintenanceplan" objectId={pl.id} fields={PLAN_FIELDS} noun="il piano" limit={5} reloadKey={p.reloadKey} />
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}
