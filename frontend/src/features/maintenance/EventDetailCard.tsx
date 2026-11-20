import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { buildQuery } from '@shared/utils/nav'
import { CampoIcon, RecordEmpty, RecordGrid, RecordLink, RecordModal, RecordSection, RecordValue, bandButtonSx, bandSolidSx } from '../../ui/campo'
import { daysLabel, dShort } from '../contracts/contractModel'
import { FileIcon } from '../drive/DriveIcons'
import type { EventRow } from '../../pages/maintenanceTypes'
import { RESULT_LABEL, type Result } from './mtModel'

/*
 * Finestra del rapportino, anteprima design-previews/mtw-base.html › Rapportini: esito con le note, PDF firmato
 * in anteprima e «Apri issue» quando l'esito non è regolare. L'azione principale cambia con il caso:
 * «Apri issue» (parziale o problemi), «Carica il PDF» (manca), nessuna se è tutto in ordine.
 */

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

const OUT: Record<Result, { title: string; tone: string; bg: string; band: object }> = {
  ok: { title: 'Eseguita, tutto regolare', tone: 'success.main', bg: 'success.light', band: { bgcolor: 'rgb(255 255 255 / .16)' } },
  partial: { title: 'Eseguita in parte', tone: 'warning.main', bg: 'warning.light', band: { bgcolor: '#e0a43a', color: '#2b1d00' } },
  ko: { title: 'Problemi da risolvere', tone: 'error.main', bg: 'error.light', band: { bgcolor: '#f2b8b0', color: '#5a1410' } },
  not_planned: { title: 'Non prevista in questo ciclo', tone: 'text.primary', bg: 'archie.neutralBg', band: { bgcolor: 'rgb(255 255 255 / .16)' } },
}
const LABEL: Record<Result, string> = { ...RESULT_LABEL, ok: 'Regolare', ko: 'Problemi' }
const dIt = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '')

export default function EventDetailCard(p: Props) {
  const e = p.ev
  const navigate = useNavigate()
  const r = (e.result as Result) ?? 'ok'
  const o = OUT[r] ?? OUT.ok
  const np = r === 'not_planned'
  const bad = r === 'ko' || r === 'partial'
  const fileRef = React.useRef<HTMLInputElement | null>(null)
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => { setMenu(null) }, [e.id])
  const pick = <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(x) => { const f = x.target.files?.[0]; x.target.value = ''; if (f) p.onUploadPdf(f) }} />
  const go = (path: string) => { p.onClose(); navigate(path) }
  const chip = (txt: React.ReactNode, warn?: boolean) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const primary = bad && p.canAddIssue
    ? <Button variant="outlined" startIcon={<CampoIcon name="alert" size={15} />} onClick={p.onOpenIssue} sx={{ ...bandButtonSx, ...bandSolidSx }}>Apri issue</Button>
    : !np && !e.pdf_url && p.canChange
      ? <Button variant="outlined" startIcon={<CampoIcon name="upload" size={15} />} disabled={p.pdfBusy} onClick={() => fileRef.current?.click()} sx={{ ...bandButtonSx, ...bandSolidSx }}>Carica il PDF</Button>
      : null

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Rapportino ${e.inventory_name ?? ''}`} compact
      title={e.inventory_name ?? 'Rapportino'}
      status={<Box component="span" sx={{ fontSize: 11.5, fontWeight: 650, px: 1, py: '2px', borderRadius: '5px', ...o.band }}>{LABEL[r]}</Box>}
      subtitle={<>{e.customer_name}{e.site_name ? ` · ${e.site_name}` : ''}{e.plan_title ? ` · ${e.plan_title}` : ''}</>}
      tags={<>
        {chip(<>del <b>{dIt(e.performed_at)}</b></>)}
        {e.tech_name && !np ? chip(<>tecnico <b>{e.tech_name}</b></>) : null}
        {np ? null : chip(e.pdf_url ? 'PDF firmato' : 'PDF mancante', !e.pdf_url)}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {primary}
        <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(x) => setMenu(x.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {!np ? <MenuItem disabled={!p.canChange} onClick={() => { setMenu(null); p.onNotPlanned() }}><ListItemIcon><CampoIcon name="x" size={16} /></ListItemIcon>Segna come non prevista</MenuItem> : null}
          <MenuItem onClick={() => { setMenu(null); go(`/inventory${buildQuery({ open: e.inventory })}`) }}><ListItemIcon><CampoIcon name="server" size={16} /></ListItemIcon>Apri l'inventario</MenuItem>
          <MenuItem onClick={() => { setMenu(null); go(`/maintenance/plans?apri=${e.plan}`) }}><ListItemIcon><CampoIcon name="wrench" size={16} /></ListItemIcon>Apri il piano</MenuItem>
          <MenuItem disabled={!p.canReset} onClick={() => { setMenu(null); p.onReset() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina il rapportino</MenuItem>
        </Menu>
      </>}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Box sx={{ p: '10px 14px', borderRadius: '10px', bgcolor: o.bg }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: o.tone }}>{o.title}</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{e.notes || 'Nessuna nota.'}</Typography>
          </Box>

          {np ? null : (
            <RecordSection title="Rapportino firmato">
              {e.pdf_url ? (
                <>
                  <Box sx={{ position: 'relative', height: 280, borderRadius: '8px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
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
                    width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, p: '12px 14px', borderRadius: '8px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    border: '1px dashed', borderColor: 'archie.borderStrong', bgcolor: 'transparent', color: 'text.secondary',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main' }, '&:focus-visible': { outline: 'none', boxShadow: (t) => t.palette.archie.focusRing },
                  }}>
                  {p.pdfBusy ? <CircularProgress size={16} /> : <CampoIcon name="upload" size={18} />}
                  <Box><Box component="b" sx={{ display: 'block', fontSize: 13, color: 'text.primary', fontWeight: 600 }}>Carica il PDF firmato</Box><Box component="span" sx={{ fontSize: 12 }}>Trascinalo qui o sfoglia</Box></Box>
                </Box>
              ) : <RecordEmpty>Nessun PDF allegato.</RecordEmpty>}
              {pick}
            </RecordSection>
          )}

          {bad && p.canAddIssue ? (
            <RecordSection title="Seguito">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 12px', border: '1px solid', borderColor: 'warning.main', bgcolor: 'warning.light', borderRadius: '8px' }}>
                <Box sx={{ color: 'warning.main', display: 'inline-flex' }}><CampoIcon name="alert" size={16} /></Box>
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13 }}><b>Il ripasso va seguito.</b> Apri una issue collegata all'inventario per non perderlo.</Typography>
                <Button size="small" variant="outlined" color="inherit" startIcon={<CampoIcon name="plus" size={14} />} onClick={p.onOpenIssue} sx={{ bgcolor: 'background.paper' }}>Apri issue</Button>
              </Box>
            </RecordSection>
          ) : null}
        </Box>

        <Box component="aside" aria-label="Intervento" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Intervento">
            <RecordGrid>
              <RecordValue label="Data">{dIt(e.performed_at)}</RecordValue>
              <RecordValue label="Esito">{LABEL[r]}</RecordValue>
              <RecordValue label="Quando" wide>{dShort(e.performed_at)} · {daysLabel(e.performed_at)}</RecordValue>
              <RecordValue label="Tecnico" wide>{np ? null : e.tech_name || null}</RecordValue>
              <RecordValue label="Inventario" wide><RecordLink onClick={() => go(`/inventory${buildQuery({ open: e.inventory })}`)}>{e.inventory_name || e.inventory_knumber || 'Inventario'}</RecordLink></RecordValue>
              <RecordValue label="Piano" wide><RecordLink onClick={() => go(`/maintenance/plans?apri=${e.plan}`)}>{e.plan_title || 'Piano'}</RecordLink></RecordValue>
              <RecordValue label="Registrato da">{e.created_by_username || null}</RecordValue>
            </RecordGrid>
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}
