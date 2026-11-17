import * as React from 'react'
import { Box, Button, Dialog, IconButton, Tooltip, Typography, useMediaQuery, type Theme } from '@mui/material'
import { CampoIcon } from './CampoIcon'
import { CampoDialog } from './CampoDialog'

/**
 * Finestra di un record (DESIGN.md › Record window, anteprima design-previews/ud-base.html,
 * variante D): sostituisce la scheda flottante su desktop. Larga e centrata sopra l'elenco
 * attenuato, testata Band con identità e azioni, corpo libero (di solito colonna principale +
 * colonna laterale), una sola barra «N modifiche da salvare». Esc, la × o un clic fuori la
 * chiudono; con modifiche in sospeso chiede prima conferma. A tutto schermo sul telefono.
 */
export type RecordModalProps = {
  open: boolean
  onClose: () => void
  /** Nome accessibile della finestra. */
  ariaLabel: string
  avatar?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Etichette sotto il sottotitolo (ruoli, stato…), già nello stile per la Band. */
  tags?: React.ReactNode
  /** Badge accanto al titolo (es. «Disattivato»). */
  status?: React.ReactNode
  /** "3 di 12" con precedente/successivo. */
  position?: string
  onPrev?: () => void
  onNext?: () => void
  /** Azioni nella testata (pulsanti con `bandButtonSx`). */
  actions?: React.ReactNode
  /** Numero di modifiche in sospeso: > 0 mostra la barra di salvataggio. */
  dirtyCount?: number
  /** Nota accanto al conteggio nella barra (es. «riguarda 6 persone»). */
  dirtyNote?: string
  saving?: boolean
  onSave?: () => void
  onDiscard?: () => void
  children: React.ReactNode
}

/** Etichetta nella testata Band. */
export function BandTag({ children }: { children: React.ReactNode }) {
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, bgcolor: 'rgb(255 255 255 / .12)', color: '#e6f2ee', whiteSpace: 'nowrap' }}>{children}</Box>
}

/** Riquadro di una sezione del corpo (colonna principale o laterale). */
export function RecordSection({ title, hint, end, children, sx }: { title?: React.ReactNode; hint?: React.ReactNode; end?: React.ReactNode; children: React.ReactNode; sx?: object }) {
  return (
    <Box component="section" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '16px 18px 18px', minWidth: 0, ...sx }}>
      {title || end ? (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
          {title ? <Typography component="h3" sx={{ fontSize: 14, fontWeight: 650 }}>{title}</Typography> : null}
          {hint ? <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>{hint}</Typography> : null}
          {end ? <Box sx={{ ml: 'auto' }}>{end}</Box> : null}
        </Box>
      ) : null}
      {children}
    </Box>
  )
}

export function RecordModal({
  open, onClose, ariaLabel, avatar, title, subtitle, tags, status, position, onPrev, onNext, actions,
  dirtyCount = 0, dirtyNote, saving, onSave, onDiscard, children,
}: RecordModalProps) {
  const phone = useMediaQuery((t: Theme) => t.breakpoints.down('md'))
  const [confirm, setConfirm] = React.useState<null | (() => void)>(null)
  // Uscire (chiudere o passare a un altro record) con modifiche in sospeso chiede conferma.
  const guard = (go: () => void) => () => { if (dirtyCount > 0 && !saving) setConfirm(() => go); else go() }
  const close = guard(onClose)
  const titleId = React.useId()

  return (
    <Dialog
      open={open} onClose={close} fullScreen={phone} scroll="body" aria-label={ariaLabel} aria-labelledby={titleId} maxWidth={false}
      slotProps={{
        backdrop: { sx: { bgcolor: 'rgb(10 20 18 / .38)' } },
        paper: { sx: { width: phone ? '100%' : 'min(1120px, calc(100vw - 48px))', maxWidth: 'none', m: phone ? 0 : '40px auto', p: phone ? 1.25 : 2, borderRadius: phone ? 0 : '16px', bgcolor: 'background.default', backgroundImage: 'none', boxShadow: '0 30px 80px -20px rgb(10 30 25 / .45), 0 4px 14px rgb(10 30 25 / .12)', overflow: 'visible' } },
      }}
    >
      {/* Testata Band */}
      <Box component="header" sx={{ position: 'relative', borderRadius: '12px', p: { xs: '16px 16px 18px', md: '18px 22px 20px' }, color: '#fff', background: (t) => `linear-gradient(160deg, ${t.palette.archie.band2}, ${t.palette.archie.band})` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' }, pr: 5 }}>
          {avatar}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h2" id={titleId} sx={{ fontSize: 20, lineHeight: 1.25, fontWeight: 650, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              {title}{status}
            </Typography>
            {subtitle ? <Typography sx={{ mt: 0.4, fontSize: 12.5, color: 'rgb(255 255 255 / .74)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { md: 'nowrap' } }}>{subtitle}</Typography> : null}
            {tags ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.1 }}>{tags}</Box> : null}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
            {position ? <Typography sx={{ fontSize: 12, color: 'rgb(255 255 255 / .7)', mr: 0.25, fontVariantNumeric: 'tabular-nums' }}>{position}</Typography> : null}
            {onPrev || onNext ? (
              <>
                <Tooltip title="Precedente"><span><IconButton aria-label="Precedente" disabled={!onPrev} onClick={onPrev ? guard(onPrev) : undefined} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' }, '&.Mui-disabled': { color: 'rgb(255 255 255 / .3)' } }}><CampoIcon name="chevL" /></IconButton></span></Tooltip>
                <Tooltip title="Successivo"><span><IconButton aria-label="Successivo" disabled={!onNext} onClick={onNext ? guard(onNext) : undefined} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' }, '&.Mui-disabled': { color: 'rgb(255 255 255 / .3)' } }}><CampoIcon name="chevR" /></IconButton></span></Tooltip>
              </>
            ) : null}
            {actions}
          </Box>
        </Box>
        <IconButton aria-label="Chiudi" onClick={close} sx={{ position: 'absolute', top: 10, right: 10, color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)', color: '#fff' } }}>
          <CampoIcon name="x" />
        </IconButton>
      </Box>

      <Box sx={{ mt: 2 }}>{children}</Box>

      {/* Barra di salvataggio: compare solo con modifiche in sospeso */}
      {dirtyCount > 0 ? (
        <Box role="status" sx={{
          position: 'sticky', bottom: { xs: 8, md: 12 }, zIndex: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 8px 8px 14px', borderRadius: '10px',
          bgcolor: 'text.primary', color: 'background.default', boxShadow: (t) => t.palette.archie.shadowFloat,
          '@keyframes rm-in': { from: { opacity: 0, transform: 'translateY(8px)' } }, animation: 'rm-in .22s cubic-bezier(.2,.8,.2,1)',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flex: 'none' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
            {dirtyCount} {dirtyCount === 1 ? 'modifica da salvare' : 'modifiche da salvare'}
            {dirtyNote ? <Box component="span" sx={{ fontWeight: 400, opacity: 0.72, display: { xs: 'none', sm: 'inline' } }}> · {dirtyNote}</Box> : null}
          </Typography>
          <Button size="small" onClick={onDiscard} disabled={saving} sx={{ color: 'inherit', border: '1px solid', borderColor: 'rgb(255 255 255 / .25)', '&:hover': { bgcolor: 'rgb(255 255 255 / .1)' } }}>Annulla</Button>
          <Button size="small" variant="contained" onClick={onSave} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva le modifiche'}</Button>
        </Box>
      ) : null}

      <CampoDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} labelId="record-leave-title" width={420}
        title="Ci sono modifiche non salvate" sub="Se esci adesso le perdi."
        footer={<><Box sx={{ flex: 1 }} /><Button onClick={() => setConfirm(null)}>Continua a modificare</Button><Button variant="contained" color="error" onClick={() => { const go = confirm; setConfirm(null); onDiscard?.(); go?.() }}>Esci senza salvare</Button></>}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Puoi tornare indietro e usare «Salva le modifiche» nella barra in basso.</Typography>
      </CampoDialog>
    </Dialog>
  )
}
