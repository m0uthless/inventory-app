import * as React from 'react'
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography, type Theme } from '@mui/material'
import type { CSSObject } from '@mui/material/styles'
import { BandChip, CampoIcon, RecordGrid, RecordModal, RecordSection, RecordValue, bandButtonSx, bandSolidSx } from '../../ui/campo'
import {
  PART_LABEL, REASON_LABEL, WD, covLevel, ddmm, ddmmyyyy, eachDay, gg, monthShort, parseIso, presentCount, rangeLabel, swatchKey,
  type HalfCell, type OffCalendar, type PfRequest,
} from './pfModel'
import type { RosterRow } from './pianoFerieShared'
import { Ava, StatusBadge, Swatch } from './pfUi'
import { covColors, offStripes } from './pfStyle'

type Props = {
  req: PfRequest | null
  areaLabel: string
  areaId: number | null
  areaPeople: RosterRow[]
  cells: Map<string, HalfCell>
  cal: OffCalendar
  canDecide: boolean
  canEdit: boolean
  isMine: boolean
  busy: boolean
  onClose: () => void
  onDecide: (status: 'validata' | 'rifiutata') => void
  onEdit: () => void
  onDelete: () => void
}

const when = (iso: string | null) => (iso ? ddmmyyyy(iso.slice(0, 10)).slice(0, 5) : '')
const BAND_STATUS = { proposta: 'Da validare', validata: 'Validata', rifiutata: 'Rifiutata' } as const

/*
 * Finestra della richiesta (anteprima design-previews/rst-base.html › Piano ferie): «Valida» / «Rifiuta» in testata
 * per il coordinatore, «Ritira la richiesta» per chi l'ha fatta; al centro la copertura dell'area giorno per giorno
 * e la nota, a lato la richiesta e l'attività. «Modifica» (⋯) apre il dialogo che c'è già (calendario e fasce).
 * Si apre dal calendario o dagli elenchi, quindi senza frecce.
 */
export default function PfDetail(p: Props) {
  return p.req ? <PfWindow {...p} req={p.req} /> : null
}

function PfWindow({ req, areaLabel, areaId, areaPeople, cells, cal, canDecide, canEdit, isMine, busy, onClose, onDecide, onEdit, onDelete }: Props & { req: PfRequest }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => setEl(null), [req.key])
  const k = swatchKey(req.reason, req.status)
  const total = areaPeople.length
  const days = [...eachDay(req.from, req.to)].slice(0, 62)
  const cov = days.map((d) => {
    const off = cal.isOff(d, areaId)
    const present = off ? 0 : presentCount(areaPeople, d, cells, req.user)
    return { d, off, present, level: covLevel(present, total) }
  })
  const low = req.status === 'proposta' ? cov.filter((c) => !c.off && c.level === 'low') : []
  const first = req.userName.split(' ')[0]
  const withdraw = isMine && req.status === 'proposta' && !canDecide
  const deleteLabel = withdraw ? 'Ritira la richiesta' : 'Elimina'
  const year = req.from.slice(0, 4) === req.to.slice(0, 4) ? ` ${req.to.slice(0, 4)}` : ''
  const chip = (txt: React.ReactNode, warn?: boolean) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const onBand = { ...bandButtonSx, color: '#fff', borderColor: 'rgb(255 255 255 / .4)', '&:hover': { borderColor: '#fff', bgcolor: 'rgb(255 255 255 / .1)' } }

  return (
    <RecordModal open onClose={onClose} ariaLabel={`Richiesta di ${req.userName}`} compact
      title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}><Swatch k={k} size={14} />{REASON_LABEL[req.reason]} · {req.userName}</Box>}
      status={<BandChip>{BAND_STATUS[req.status]}</BandChip>}
      subtitle={<>{rangeLabel(req.from, req.to)}{year} · {gg(req.days)} lavorativ{req.days === 1 ? 'o' : 'i'} · {PART_LABEL[req.part]}{req.hourly ? ` · ${req.hourly.from}–${req.hourly.to}` : ''}</>}
      tags={<>
        {chip(areaLabel)}
        {low.length ? chip(<>copertura bassa · <b>{low.length} {low.length === 1 ? 'giorno' : 'giorni'}</b></>, true) : null}
        {isMine && req.status === 'proposta' && !canDecide ? chip('in attesa del coordinatore') : null}
      </>}
      actions={<>
        {req.status === 'proposta' && canDecide ? <>
          <Button variant="outlined" disabled={busy} onClick={() => onDecide('validata')} startIcon={<CampoIcon name="task" size={15} />} sx={{ ...bandButtonSx, ...bandSolidSx }}>Valida</Button>
          <Button variant="outlined" disabled={busy} onClick={() => onDecide('rifiutata')} startIcon={<CampoIcon name="x" size={15} />} sx={onBand}>Rifiuta</Button>
        </> : withdraw ? <Button variant="outlined" disabled={busy} onClick={onDelete} startIcon={<CampoIcon name="trash" size={15} />} sx={onBand}>Ritira la richiesta</Button> : null}
        {canEdit ? <>
          <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setEl(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
          <Menu anchorEl={el} open={Boolean(el)} onClose={() => setEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem disabled={busy} onClick={() => { setEl(null); onEdit() }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica…</MenuItem>
            {withdraw ? null : <MenuItem disabled={busy} onClick={() => { setEl(null); onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>{deleteLabel}</MenuItem>}
          </Menu>
        </> : null}
      </>}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {low.length ? (
            <Box role="alert" sx={{ p: '10px 14px', borderRadius: '10px', bgcolor: 'warning.light' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'warning.main' }}>Copertura bassa in {areaLabel}</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                Resterebbe {low[0].present} su {total} il {low.map((c) => parseIso(c.d).getDate()).join(', ')} {monthShort(low[0].d)}. Il conteggio esclude {first} e tiene conto delle altre assenze già registrate.
              </Typography>
            </Box>
          ) : null}

          <RecordSection title={`Presenti in ${areaLabel} in quei giorni`}>
            <Box sx={miniSx}>
              {cov.map((c) => (
                <span key={c.d} className={c.off ? 'is-off' : `cov-${c.level}`} title={c.off ? cal.holiday(c.d) ?? 'Non lavorativo' : `${ddmm(c.d)} · ${c.present}/${total} presenti`}>
                  <small>{WD[parseIso(c.d).getDay()]}</small><b>{parseIso(c.d).getDate()}</b><em>{c.off ? (cal.holiday(c.d)?.split(' ')[0] ?? '—') : `${c.present}/${total}`}</em>
                </span>
              ))}
            </Box>
            <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>Su {total} persone dell'area, senza contare {first}.</Typography>
          </RecordSection>

          {req.note ? <RecordSection title="Nota"><Typography sx={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.note}</Typography></RecordSection> : null}
        </Box>

        <Box component="aside" aria-label="Richiesta" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Richiesta">
            <RecordGrid>
              <RecordValue label="Persona" wide><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}><Ava name={req.userName} size={20} />{req.userName}</Box></RecordValue>
              <RecordValue label="Area">{areaLabel}</RecordValue>
              <RecordValue label="Motivo"><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Swatch k={k} />{REASON_LABEL[req.reason]}</Box></RecordValue>
              <RecordValue label="Dal">{ddmmyyyy(req.from)}</RecordValue>
              <RecordValue label="Al">{ddmmyyyy(req.to)}</RecordValue>
              <RecordValue label="Fascia" wide>{PART_LABEL[req.part]}{req.hourly ? ` · ${req.hourly.from}–${req.hourly.to}` : ''}</RecordValue>
              <RecordValue label="Stato"><StatusBadge status={req.status} /></RecordValue>
            </RecordGrid>
          </RecordSection>
          <RecordSection title="Attività">
            <Box sx={{ display: 'grid', gap: 1, fontSize: 13, '& > div': { display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', gap: 1, alignItems: 'start' }, '& svg': { mt: '2px', color: 'text.secondary' }, '& time': { fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }, '& b': { fontWeight: 600 } }}>
              <div><CampoIcon name="plus" size={14} /><span><b>{req.userName}</b>: {REASON_LABEL[req.reason].toLowerCase()} {req.from === req.to ? `il ${ddmm(req.from)}` : `dal ${ddmm(req.from)} al ${ddmm(req.to)}`}</span><time>{when(req.createdAt)}</time></div>
              {req.status !== 'proposta' && req.validatedByName ? (
                <div><CampoIcon name={req.status === 'validata' ? 'task' : 'x'} size={14} /><span><b>{req.validatedByName}</b> ha {req.status === 'validata' ? 'validato' : 'rifiutato'} la richiesta</span><time>{when(req.validatedAt)}</time></div>
              ) : null}
            </Box>
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}

const miniSx = (t: Theme): CSSObject => {
  const v = (lv: 'ok' | 'mid' | 'low') => { const c = covColors(t, lv); return { '--cv': c.fg, '--cvb': c.bg } }
  return {
    display: 'flex', flexWrap: 'wrap', gap: '5px',
    '& > span': { display: 'grid', justifyItems: 'center', minWidth: 52, p: '7px 6px 6px', borderRadius: '8px', bgcolor: 'var(--cvb)', lineHeight: 1.2 },
    '& b': { fontSize: 17, fontWeight: 650 }, '& small': { fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' },
    '& em': { fontStyle: 'normal', fontSize: 11, fontWeight: 650, color: 'var(--cv)' },
    '& .cov-ok': { ...v('ok'), bgcolor: t.palette.archie.surface2 }, '& .cov-mid': v('mid'), '& .cov-low': v('low'),
    '& .is-off': { background: offStripes(t), color: t.palette.archie.textFaint, '& em': { color: t.palette.archie.textFaint, fontWeight: 500, fontSize: 10.5 } },
  }
}
