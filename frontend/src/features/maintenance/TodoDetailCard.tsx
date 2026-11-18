import { useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import * as React from 'react'
import CheckIcon from '@mui/icons-material/Check'
import { buildQuery } from '@shared/utils/nav'
import {
  CampoIcon, RecordEmpty, RecordGrid, RecordLink, RecordLoader, RecordModal, RecordRow, RecordRows, RecordSection, RecordValue,
  bandButtonSx, bandSolidSx, recordMono as mono, useList,
} from '../../ui/campo'
import { daysLabel, dShort } from '../contracts/contractModel'
import type { EventRow, TodoRow } from '../../pages/maintenanceTypes'
import { dueStateOf, nextDueAfter, RESULT_LABEL, scheduleText, type Result } from './mtModel'
import { ResultBadge } from './mtUi'

/*
 * Finestra di una scadenza (piano × inventario), anteprima design-previews/mtw-base.html › Scadenze:
 * «Registra rapportino» come azione principale; al centro lo stato della scadenza e gli interventi fatti
 * sull'inventario; a lato la scadenza, il piano e l'inventario. «Modifica la scadenza» (⋯) apre il dialogo
 * della data per questo inventario.
 */

type Props = {
  row: TodoRow
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  canRegister: boolean
  canEditDue: boolean
  onRegister: () => void
  onNotPlanned: () => void
  onEditDue: () => void
  onOpenPlan: () => void
  reloadKey?: unknown
}

const dIt = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '')

export default function TodoDetailCard(p: Props) {
  const r = p.row
  const navigate = useNavigate()
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const events = useList<EventRow>('/maintenance-events/', { inventory: r.inventory_id, ordering: '-performed_at', page_size: 50 }, p.reloadKey)
  const s = dueStateOf(r.next_due_date)
  const last = events?.[0] ?? null
  const tone = s === 'overdue' ? 'error' : s === 'next30' ? 'warning' : null
  const openInventory = () => { p.onClose(); navigate(`/inventory${buildQuery({ open: r.inventory_id })}`) }
  const chip = (txt: React.ReactNode, warn?: boolean, onClick?: () => void) => (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick} sx={{
      height: 20, px: 0.9, border: 0, font: 'inherit', borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 },
      '&:hover': onClick ? { bgcolor: 'rgb(255 255 255 / .22)' } : undefined,
    }}>{txt}</Box>
  )

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Scadenza ${r.inventory_name}`} compact
      title={r.inventory_name}
      status={<Box component="span" sx={{ fontSize: 11.5, fontWeight: 650, px: 1, py: '2px', borderRadius: '5px', ...(s === 'overdue' ? { bgcolor: '#f2b8b0', color: '#5a1410' } : s === 'next30' ? { bgcolor: '#e0a43a', color: '#2b1d00' } : { bgcolor: 'rgb(255 255 255 / .16)' }) }}>{s === 'overdue' ? 'Scaduta' : s === 'next30' ? 'In scadenza' : 'In regola'}</Box>}
      subtitle={<>{r.customer_name}{r.site_name ? ` · ${r.site_name}` : ''}{r.type_label ? ` · ${r.type_label}` : ''}{r.knumber ? <> · <Box component="span" sx={{ ...mono, fontSize: 12 }}>{r.knumber}</Box></> : null}</>}
      tags={<>
        {chip(<>{s === 'overdue' ? 'scaduta il' : 'entro il'} <b>{dIt(r.next_due_date)}</b></>, Boolean(tone))}
        {chip(<>piano <b>{r.plan_title}</b></>, false, p.onOpenPlan)}
        {events === null ? null : last ? chip(<>ultimo: <b>{(RESULT_LABEL[last.result as Result] ?? last.result).toLowerCase()}</b> il {dIt(last.performed_at)}</>, last.result === 'ko' || last.result === 'partial') : chip('mai registrata')}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {p.canRegister ? <Button variant="outlined" startIcon={<CheckIcon sx={{ fontSize: 16 }} />} onClick={p.onRegister} sx={{ ...bandButtonSx, ...bandSolidSx }}>Registra rapportino</Button> : null}
        <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!p.canEditDue} onClick={() => { setMenu(null); p.onEditDue() }}><ListItemIcon><CampoIcon name="calendar" size={16} /></ListItemIcon>Modifica la scadenza…</MenuItem>
          <MenuItem disabled={!p.canRegister} onClick={() => { setMenu(null); p.onNotPlanned() }}><ListItemIcon><CampoIcon name="x" size={16} /></ListItemIcon>Non prevista in questo ciclo</MenuItem>
          <MenuItem onClick={() => { setMenu(null); p.onOpenPlan() }}><ListItemIcon><CampoIcon name="wrench" size={16} /></ListItemIcon>Apri il piano</MenuItem>
          <MenuItem onClick={() => { setMenu(null); openInventory() }}><ListItemIcon><CampoIcon name="server" size={16} /></ListItemIcon>Apri l'inventario</MenuItem>
        </Menu>
      </>}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Box sx={{ p: '10px 14px', borderRadius: '10px', bgcolor: tone ? `${tone}.light` : 'archie.neutralBg' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tone ? `${tone}.main` : 'text.primary' }}>
              {s === 'overdue' ? `Scaduta il ${dShort(r.next_due_date)}` : `Da fare entro il ${dShort(r.next_due_date)}`} · {daysLabel(r.next_due_date)}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {r.due_date_override ? `Scadenza modificata per questo inventario: il piano dice ${dShort(r.plan_next_due_date)}.` : `Scadenza del piano «${r.plan_title}».`} Avviso {r.plan_alert_days_before} giorni prima.
            </Typography>
          </Box>

          <RecordSection title={<>Interventi su questo inventario<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{events?.length ?? ''}</Box></>}>
            {!events ? <RecordLoader /> : events.length ? (
              <RecordRows>
                {events.map((e) => (
                  <RecordRow key={e.id} leadWidth={48}
                    lead={<Box sx={{ display: 'grid', justifyItems: 'center', lineHeight: 1.1, py: 0.5, width: 44, borderRadius: '7px', bgcolor: 'archie.surface2', color: 'text.primary' }}>
                      <Box component="b" sx={{ fontSize: 13, fontWeight: 650 }}>{dIt(e.performed_at).slice(0, 5)}</Box>
                      <Box component="small" sx={{ fontSize: 10, color: 'text.secondary' }}>{e.performed_at.slice(0, 4)}</Box>
                    </Box>}
                    title={e.plan_title || 'Intervento'}
                    sub={[e.tech_name || 'nessun tecnico', e.notes].filter(Boolean).join(' · ')}
                    end={<><ResultBadge result={e.result as Result} />{e.pdf_url ? <Tooltip title="Apri il PDF"><IconButton size="small" aria-label="Apri il PDF" onClick={() => window.open(e.pdf_url ?? '', '_blank', 'noopener')} sx={{ width: 28, height: 28 }}><CampoIcon name="file" size={14} /></IconButton></Tooltip> : null}</>} />
                ))}
              </RecordRows>
            ) : <RecordEmpty>Nessun rapportino per questo inventario.</RecordEmpty>}
          </RecordSection>
        </Box>

        <Box component="aside" aria-label="Scadenza" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Scadenza">
            <RecordGrid>
              <RecordValue label="Data per questo inventario" wide>{dIt(r.next_due_date)}</RecordValue>
              <RecordValue label="Del piano">{dIt(r.plan_next_due_date || r.next_due_date)}</RecordValue>
              <RecordValue label="Dopo questa">{dIt(nextDueAfter(r, r.next_due_date))}</RecordValue>
            </RecordGrid>
          </RecordSection>
          <RecordSection title="Piano">
            <RecordGrid>
              <RecordValue label="Nome" wide><RecordLink onClick={p.onOpenPlan}>{r.plan_title}</RecordLink></RecordValue>
              <RecordValue label="Cadenza" wide>{scheduleText(r)}</RecordValue>
              <RecordValue label="Avviso">{r.plan_alert_days_before} giorni prima</RecordValue>
            </RecordGrid>
          </RecordSection>
          <RecordSection title="Inventario">
            <RecordGrid>
              <RecordValue label="Nome" wide><RecordLink onClick={openInventory}>{r.inventory_name}</RecordLink></RecordValue>
              <RecordValue label="Tipo">{r.type_label || null}</RecordValue>
              <RecordValue label="Sito">{r.site_name || null}</RecordValue>
              <RecordValue label="Hostname" mono>{r.hostname || null}</RecordValue>
              <RecordValue label="K-Number" mono>{r.knumber || null}</RecordValue>
            </RecordGrid>
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}

