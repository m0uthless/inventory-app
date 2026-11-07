import * as React from 'react'
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import { CampoIcon, DetailSection, FloatingDetail } from '../../ui/campo'
import { mono } from '../../ui/campo/ListRows'
import { daysLabel, dShort } from '../contracts/contractModel'
import { FileIcon } from '../drive/DriveIcons'
import type { EventRow } from '../../pages/maintenanceTypes'
import type { Result } from './mtModel'
import { ResultBadge } from './mtUi'

type Props = {
  ev: EventRow
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  canChange: boolean
  canReset: boolean
  canAddIssue: boolean
  pdfBusy: boolean
  onUploadPdf: (f: File) => void
  onDeletePdf: () => void
  onNotPlanned: () => void
  onReset: () => void
  onOpenIssue: () => void
}

const OUT: Record<Result, { title: string; tone: string; bg: string }> = {
  ok: { title: 'Eseguita, tutto regolare', tone: 'success.main', bg: 'success.light' },
  partial: { title: 'Eseguita in parte', tone: 'warning.main', bg: 'warning.light' },
  ko: { title: 'Problemi da risolvere', tone: 'error.main', bg: 'error.light' },
  not_planned: { title: 'Non prevista in questo ciclo', tone: 'text.primary', bg: 'archie.neutralBg' },
}
const dl = { m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontWeight: 550 } } as const

/** Scheda flottante del rapportino (anteprima design-previews/mt-base.html › Rapportini). */
export default function EventDetailCard(p: Props) {
  const e = p.ev
  const r = (e.result as Result) ?? 'ok'
  const o = OUT[r] ?? OUT.ok
  const np = r === 'not_planned'
  const fileRef = React.useRef<HTMLInputElement | null>(null)
  const pick = <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(x) => { const f = x.target.files?.[0]; x.target.value = ''; if (f) p.onUploadPdf(f) }} />

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio rapportino"
      idLabel={<Box component="span" sx={mono}>{dShort(e.performed_at)}</Box>}
      status={<ResultBadge result={r} onDark />}
      title={e.inventory_name ?? 'Rapportino'}
      subtitle={[e.customer_name, e.site_name, e.plan_title].filter(Boolean).join(' · ')}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={[
        ...(!np ? [{ label: 'Segna come non prevista', icon: <CampoIcon name="x" />, onClick: p.onNotPlanned, disabled: !p.canChange }] : []),
        { label: 'Elimina il rapportino', icon: <CampoIcon name="trash" />, onClick: p.onReset, danger: true, disabled: !p.canReset },
      ]}
      footer={(
        <>
          {p.canReset ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="trash" size={15} />} onClick={p.onReset}>Elimina</Button> : null}
          <Box sx={{ flex: 1 }} />
          {!np && p.canChange && !e.pdf_url ? <Button variant="contained" startIcon={<CampoIcon name="upload" size={15} />} onClick={() => fileRef.current?.click()} disabled={p.pdfBusy}>Carica il PDF</Button> : null}
        </>
      )}
    >
      <Box sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: o.bg }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: o.tone }}>{o.title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{e.notes || 'Nessuna nota.'}</Typography>
      </Box>

      <DetailSection title="Intervento">
        <Box component="dl" sx={dl}>
          <dt>Data</dt><dd>{dShort(e.performed_at)} · {daysLabel(e.performed_at)}</dd>
          <dt>Tecnico</dt><dd>{np ? '—' : e.tech_name || '—'}</dd>
          <dt>Inventario</dt><dd style={mono}>{e.inventory_knumber || e.inventory_hostname || '—'}</dd>
          <dt>Piano</dt><dd>{e.plan_title}</dd>
          <dt>Registrato da</dt><dd>{e.created_by_username || '—'}</dd>
        </Box>
      </DetailSection>

      {np ? null : (
        <DetailSection title="Rapportino firmato">
          {e.pdf_url ? (
            <>
              <Box sx={{ position: 'relative', height: 240, borderRadius: '8px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
                <Box component="iframe" src={`${e.pdf_url}#toolbar=0&view=FitH`} title="Anteprima del rapportino" sx={{ width: '100%', height: '100%', border: 0 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <FileIcon kind="pdf" size={24} />
                <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 550 }}>PDF del rapportino</Typography>
                <Tooltip title="Apri in una nuova scheda"><IconButton size="small" aria-label="Apri il PDF" onClick={() => window.open(e.pdf_url ?? '', '_blank', 'noopener')}><CampoIcon name="eye" size={16} /></IconButton></Tooltip>
                {p.canChange ? <Tooltip title="Sostituisci"><IconButton size="small" aria-label="Sostituisci il PDF" disabled={p.pdfBusy} onClick={() => fileRef.current?.click()}><CampoIcon name="upload" size={16} /></IconButton></Tooltip> : null}
                {p.canChange ? <Tooltip title="Rimuovi"><IconButton size="small" aria-label="Rimuovi il PDF" disabled={p.pdfBusy} onClick={p.onDeletePdf}>{p.pdfBusy ? <CircularProgress size={14} /> : <CampoIcon name="trash" size={16} />}</IconButton></Tooltip> : null}
              </Box>
            </>
          ) : p.canChange ? (
            <Box component="button" type="button" disabled={p.pdfBusy} onClick={() => fileRef.current?.click()}
              onDragOver={(x: React.DragEvent) => x.preventDefault()} onDrop={(x: React.DragEvent) => { x.preventDefault(); const f = x.dataTransfer.files?.[0]; if (f) p.onUploadPdf(f) }}
              sx={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 12px', borderRadius: '8px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
                border: '1px dashed', borderColor: 'archie.borderStrong', bgcolor: 'transparent', color: 'text.secondary',
                '&:hover': { borderColor: 'primary.main', color: 'primary.main' }, '&:focus-visible': { outline: 'none', boxShadow: (t) => t.palette.archie.focusRing },
              }}>
              {p.pdfBusy ? <CircularProgress size={16} /> : <CampoIcon name="upload" size={18} />}
              <Box><Box component="b" sx={{ display: 'block', fontSize: 13, color: 'text.primary', fontWeight: 600 }}>Carica il PDF firmato</Box><Box component="span" sx={{ fontSize: 12 }}>Trascinalo qui o sfoglia</Box></Box>
            </Box>
          ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Nessun PDF allegato.</Typography>}
          {pick}
        </DetailSection>
      )}

      {(r === 'ko' || r === 'partial') && p.canAddIssue ? (
        <DetailSection title="Seguito">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <CampoIcon name="alert" size={16} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Il ripasso va seguito</Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>Apri una issue collegata all'inventario per non perderlo.</Typography>
            </Box>
            <Button size="small" variant="outlined" color="inherit" startIcon={<CampoIcon name="plus" size={14} />} onClick={p.onOpenIssue}>Apri issue</Button>
          </Box>
        </DetailSection>
      ) : null}
    </FloatingDetail>
  )
}
