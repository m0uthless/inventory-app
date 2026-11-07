import { Box, Button, Typography, type Theme } from '@mui/material'
import type { CSSObject } from '@mui/material/styles'
import { CampoIcon, DetailSection, FloatingDetail, type DetailMenuItem } from '../../ui/campo'
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

/** Pannello della richiesta: proprietà, copertura dell'area nei giorni richiesti, nota, attività, decisione. */
export default function PfDetail({ req, areaLabel, areaId, areaPeople, cells, cal, canDecide, canEdit, isMine, busy, onClose, onDecide, onEdit, onDelete }: Props) {
  if (!req) return null
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
  const deleteLabel = isMine && req.status === 'proposta' && !canDecide ? 'Ritira la richiesta' : 'Elimina'

  const menu: DetailMenuItem[] = []
  if (canEdit) {
    menu.push({ label: 'Modifica', icon: <CampoIcon name="wrench" size={16} />, onClick: onEdit })
    menu.push({ label: deleteLabel, icon: <CampoIcon name="trash" size={16} />, onClick: onDelete, danger: true })
  }

  const footer = req.status === 'proposta' && canDecide ? (
    <>
      <Button variant="outlined" color="inherit" disabled={busy} startIcon={<CampoIcon name="x" size={14} />} onClick={() => onDecide('rifiutata')}>Rifiuta</Button>
      <Box sx={{ flex: 1 }} />
      <Button variant="contained" disabled={busy} startIcon={<CampoIcon name="task" size={14} />} onClick={() => onDecide('validata')}>Valida</Button>
    </>
  ) : isMine && req.status === 'proposta' ? (
    <>
      <Button variant="outlined" color="inherit" disabled={busy} startIcon={<CampoIcon name="trash" size={14} />} onClick={onDelete}>Ritira la richiesta</Button>
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>In attesa del coordinatore</Typography>
    </>
  ) : canEdit ? (
    <>
      <Button variant="outlined" color="inherit" disabled={busy} startIcon={<CampoIcon name="wrench" size={14} />} onClick={onEdit}>Modifica</Button>
      <Box sx={{ flex: 1 }} />
      <StatusBadge status={req.status} />
    </>
  ) : null

  return (
    <FloatingDetail
      open
      onClose={onClose}
      ariaLabel="Dettaglio richiesta"
      idLabel="Richiesta"
      status={<StatusBadge status={req.status} />}
      title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><Swatch k={k} size={14} />{REASON_LABEL[req.reason]} · {req.userName}</Box>}
      subtitle={<>{rangeLabel(req.from, req.to)} {req.to.slice(0, 4)} · {gg(req.days)} lavorativ{req.days === 1 ? 'o' : 'i'} · {PART_LABEL[req.part]}{req.hourly ? ` · ${req.hourly.from}–${req.hourly.to}` : ''}</>}
      menu={menu.length ? menu : undefined}
      footer={footer}
    >
      {low.length ? (
        <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '9px 12px', borderRadius: '8px', border: '1px solid', borderColor: 'warning.main', bgcolor: 'warning.light', color: 'warning.main', fontSize: 13, fontWeight: 550 }}>
          <CampoIcon name="alert" size={16} />
          <span>Copertura bassa: {areaLabel} resterebbe con {low[0].present} su {total} il {low.map((c) => parseIso(c.d).getDate()).join(', ')} {monthShort(low[0].d)}.</span>
        </Box>
      ) : null}

      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 1.5, rowGap: 0.25, borderBottom: '1px solid', borderColor: 'divider', pb: 1.25,
        '& > div': { display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', alignItems: 'center', minHeight: 34, gap: 1 },
        '& dt': { fontSize: 12, color: 'text.secondary' }, '& dd': { m: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 } }}>
        <div><dt>Persona</dt><dd><Ava name={req.userName} size={20} />{req.userName}</dd></div>
        <div><dt>Area</dt><dd>{areaLabel}</dd></div>
        <div><dt>Motivo</dt><dd><Swatch k={k} />{REASON_LABEL[req.reason]}</dd></div>
        <div><dt>Fascia</dt><dd>{PART_LABEL[req.part]}{req.hourly ? ` · ${req.hourly.from}–${req.hourly.to}` : ''}</dd></div>
        <div><dt>Dal</dt><dd>{ddmmyyyy(req.from)}</dd></div>
        <div><dt>Al</dt><dd>{ddmmyyyy(req.to)}</dd></div>
      </Box>

      <DetailSection title={`Presenti in ${areaLabel} in quei giorni`}>
        <Box sx={miniSx}>
          {cov.map((c) => (
            <span key={c.d} className={c.off ? 'is-off' : `cov-${c.level}`} title={c.off ? cal.holiday(c.d) ?? 'Non lavorativo' : `${ddmm(c.d)} · ${c.present}/${total} presenti`}>
              <b>{parseIso(c.d).getDate()}</b><small>{WD[parseIso(c.d).getDay()]}</small>{c.off ? null : <em>{c.present}/{total}</em>}
            </span>
          ))}
        </Box>
        <Typography sx={{ mt: 0.75, fontSize: 12, color: 'text.secondary' }}>Conteggio senza {first}, con le altre assenze già registrate.</Typography>
      </DetailSection>

      {req.note ? <DetailSection title="Nota"><Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{req.note}</Typography></DetailSection> : null}

      <DetailSection title="Attività">
        <Box sx={{ display: 'grid', gap: 1, fontSize: 13, '& > div': { display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', gap: 1, alignItems: 'start' }, '& svg': { mt: '2px', color: 'text.secondary' }, '& time': { fontSize: 12, color: 'text.secondary' } }}>
          <div><CampoIcon name="plus" size={14} /><span><b>{req.userName}</b>: {REASON_LABEL[req.reason].toLowerCase()} {req.from === req.to ? `il ${ddmm(req.from)}` : `dal ${ddmm(req.from)} al ${ddmm(req.to)}`}</span><time>{when(req.createdAt)}</time></div>
          {req.status !== 'proposta' && req.validatedByName ? (
            <div><CampoIcon name={req.status === 'validata' ? 'task' : 'x'} size={14} /><span><b>{req.validatedByName}</b> ha {req.status === 'validata' ? 'validato' : 'rifiutato'} la richiesta</span><time>{when(req.validatedAt)}</time></div>
          ) : null}
        </Box>
      </DetailSection>
    </FloatingDetail>
  )
}

const miniSx = (t: Theme): CSSObject => {
  const v = (lv: 'ok' | 'mid' | 'low') => { const c = covColors(t, lv); return { '--cv': c.fg, '--cvb': c.bg } }
  return {
    display: 'flex', flexWrap: 'wrap', gap: '4px',
    '& > span': { display: 'grid', justifyItems: 'center', minWidth: 44, p: '4px 6px', borderRadius: '6px', bgcolor: 'var(--cvb)', lineHeight: 1.2 },
    '& b': { fontSize: 13 }, '& small': { fontSize: 9, color: 'text.secondary', fontWeight: 600 },
    '& em': { fontStyle: 'normal', fontSize: 11, fontWeight: 650, color: 'var(--cv)' },
    '& .cov-ok': { ...v('ok'), bgcolor: t.palette.archie.surface2 }, '& .cov-mid': v('mid'), '& .cov-low': v('low'),
    '& .is-off': { background: offStripes(t), color: t.palette.archie.textFaint },
  }
}
