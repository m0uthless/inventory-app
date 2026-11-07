import { Box, Button, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { CampoIcon, DetailSection, FloatingDetail } from '../../ui/campo'
import { Empty, Loading, mono, useList } from '../../ui/campo/ListRows'
import { daysLabel, dShort } from '../contracts/contractModel'
import type { EventRow, TodoRow } from '../../pages/maintenanceTypes'
import { dueStateOf, nextDueAfter, scheduleText, type Result } from './mtModel'
import { DueStateBadge, ResultBadge } from './mtUi'

export type TodoTab = 'det' | 'his'
type Props = {
  row: TodoRow
  tab: TodoTab
  onTab: (t: TodoTab) => void
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

const dl = { m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontWeight: 550, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } } as const

/** Scheda flottante di una scadenza (piano × inventario), anteprima design-previews/mt-base.html. */
export default function TodoDetailCard(p: Props) {
  const r = p.row
  const events = useList<EventRow>('/maintenance-events/', { inventory: r.inventory_id, ordering: '-performed_at', page_size: 50 }, p.reloadKey)
  const s = dueStateOf(r.next_due_date)
  const last = events?.find((e) => e.plan === r.plan_id) ?? null

  const details = (
    <>
      <Box sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: s === 'overdue' ? 'error.light' : s === 'next30' ? 'warning.light' : 'archie.neutralBg' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: s === 'overdue' ? 'error.main' : s === 'next30' ? 'warning.main' : 'text.primary' }}>
          {s === 'overdue' ? `Scaduta il ${dShort(r.next_due_date)}` : `Da fare entro il ${dShort(r.next_due_date)}`} · {daysLabel(r.next_due_date)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {r.due_date_override ? `Scadenza modificata per questo inventario: il piano dice ${dShort(r.plan_next_due_date)}.` : `Scadenza del piano «${r.plan_title}».`} Avviso {r.plan_alert_days_before} giorni prima.
        </Typography>
      </Box>

      <DetailSection title="Piano" end={<Button size="small" onClick={p.onOpenPlan} sx={{ minWidth: 0, p: 0, fontSize: 12, fontWeight: 550 }}>Apri il piano</Button>}>
        <Box component="dl" sx={dl}>
          <dt>Nome</dt><dd>{r.plan_title}</dd>
          <dt>Cadenza</dt><dd>{scheduleText(r)}</dd>
          <dt>Dopo questa</dt><dd>{dShort(nextDueAfter(r, r.next_due_date))}</dd>
        </Box>
      </DetailSection>

      <DetailSection title="Inventario">
        <Box component="dl" sx={dl}>
          <dt>Tipo</dt><dd>{r.type_label || '—'}</dd>
          <dt>Hostname</dt><dd style={mono}>{r.hostname || '—'}</dd>
          <dt>KNumber</dt><dd style={mono}>{r.knumber || '—'}</dd>
          <dt>Sito</dt><dd>{r.site_name || '—'}</dd>
        </Box>
      </DetailSection>

      <DetailSection title="Ultimo intervento">
        {!events ? <Loading /> : last ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <ResultBadge result={last.result as Result} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{dShort(last.performed_at)}{last.tech_name ? ` · ${last.tech_name}` : ''}</Typography>
              <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary' }}>{last.notes || 'Nessuna nota'}</Typography>
            </Box>
            {last.pdf_url ? <Button size="small" variant="outlined" color="inherit" startIcon={<CampoIcon name="eye" size={14} />} onClick={() => window.open(last.pdf_url ?? '', '_blank', 'noopener')}>PDF</Button> : null}
          </Box>
        ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Mai registrato per questo piano.</Typography>}
      </DetailSection>
    </>
  )

  const history = !events ? <Loading /> : !events.length ? <Empty text="Nessun rapportino per questo inventario." /> : (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      {events.map((e) => (
        <Box key={e.id} sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
          <ResultBadge result={e.result as Result} />
          <Box sx={{ minWidth: 0 }}>
            <b>{e.tech_name || '—'}</b> · {e.plan_title}
            {e.notes ? <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes}</Box> : null}
          </Box>
          <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{dShort(e.performed_at)}</Box>
        </Box>
      ))}
    </Box>
  )

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio scadenza"
      idLabel={<Box component="span" sx={mono}>{r.knumber || `#${r.inventory_id}`}</Box>}
      status={<DueStateBadge due={r.next_due_date} onDark />}
      title={r.inventory_name}
      subtitle={[r.customer_name, r.site_name, r.type_label].filter(Boolean).join(' · ')}
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'his', label: 'Storico', count: events?.length ?? null }]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as TodoTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={[
        { label: 'Apri il piano', icon: <CampoIcon name="wrench" />, onClick: p.onOpenPlan },
        { label: 'Modifica scadenza', icon: <CampoIcon name="calendar" />, onClick: p.onEditDue, disabled: !p.canEditDue },
        { label: 'Non prevista in questo ciclo', icon: <CampoIcon name="x" />, onClick: p.onNotPlanned, disabled: !p.canRegister },
      ]}
      footer={p.tab === 'det' ? (
        <>
          {p.canEditDue ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="calendar" size={15} />} onClick={p.onEditDue}>Modifica scadenza</Button> : null}
          <Box sx={{ flex: 1 }} />
          {p.canRegister ? <Button variant="contained" startIcon={<CheckIcon />} onClick={p.onRegister}>Registra rapportino</Button> : null}
        </>
      ) : undefined}
    >
      {p.tab === 'det' ? details : history}
    </FloatingDetail>
  )
}
