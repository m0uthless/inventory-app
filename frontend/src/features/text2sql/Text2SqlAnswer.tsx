import * as React from 'react'
import { Box, Button, IconButton, InputBase, LinearProgress, Tooltip, Typography } from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'

import type { T2sFeedbackPayload, T2sRequest } from './api'
import SqlBlock from './SqlBlock'
import { KindBadge, StatusBadge } from './T2sBadges'
import { fmtWhen } from './time'

type Props = {
  item: T2sRequest
  onFeedback: (id: number, p: T2sFeedbackPayload) => Promise<void>
  onRetry: (item: T2sRequest) => void
  onDelete: (item: T2sRequest) => void
}

const field = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 13, bgcolor: 'background.paper', border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px',
  '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (t: { palette: { archie: { focusRing: string } } }) => t.palette.archie.focusRing },
} as const

function Feedback({ item, onFeedback }: Pick<Props, 'item' | 'onFeedback'>) {
  const [open, setOpen] = React.useState(item.feedback === 'ko')
  const [fix, setFix] = React.useState(item.corrected_sql)
  const [note, setNote] = React.useState(item.feedback_note)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { setOpen(item.feedback === 'ko'); setFix(item.corrected_sql); setNote(item.feedback_note) }, [item.id, item.feedback, item.corrected_sql, item.feedback_note])
  const save = async (p: T2sFeedbackPayload) => { setBusy(true); try { await onFeedback(item.id, p) } finally { setBusy(false) } }
  const opt = (on: boolean, tone: 'success' | 'warning') => ({
    fontWeight: 550, borderColor: on ? `${tone}.main` : 'archie.borderStrong', color: on ? `${tone}.main` : 'text.primary', bgcolor: on ? `${tone}.light` : 'background.paper',
  })
  return (
    <Box sx={{ display: 'grid', gap: 1.25, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="span" sx={{ fontSize: 13, fontWeight: 550, mr: 0.5 }}>La query era giusta?</Typography>
        <Button variant="outlined" size="small" disabled={busy} aria-pressed={item.feedback === 'ok'} startIcon={<CheckRoundedIcon />} sx={opt(item.feedback === 'ok', 'success')}
          onClick={() => { setOpen(false); void save({ feedback: 'ok', corrected_sql: '', feedback_note: '' }) }}>Corretta</Button>
        <Button variant="outlined" size="small" disabled={busy} aria-pressed={open} startIcon={<CloseRoundedIcon />} sx={opt(open, 'warning')}
          onClick={() => setOpen(true)}>Da correggere</Button>
        {item.feedback && !open ? <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>Grazie: il giudizio aiuta a migliorare gli esempi.</Typography> : null}
      </Box>
      {open ? (
        <>
          <Box component="label" sx={{ display: 'grid', gap: 0.5 }}>
            <Typography component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary' }}>
              Query corretta <Box component="span" sx={{ fontWeight: 400, color: 'archie.textFaint' }}>· quella che hai usato davvero, facoltativa</Box>
            </Typography>
            <InputBase multiline minRows={4} maxRows={16} value={fix} onChange={(e) => setFix(e.target.value)} sx={{ ...field, fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}
              inputProps={{ 'aria-label': 'Query corretta' }} />
          </Box>
          <Box component="label" sx={{ display: 'grid', gap: 0.5 }}>
            <Typography component="span" sx={{ fontSize: 12, fontWeight: 550, color: 'text.secondary' }}>
              Cosa non andava <Box component="span" sx={{ fontWeight: 400, color: 'archie.textFaint' }}>· facoltativo</Box>
            </Typography>
            <InputBase multiline minRows={2} maxRows={6} value={note} onChange={(e) => setNote(e.target.value)} sx={field} inputProps={{ 'aria-label': 'Cosa non andava' }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" disabled={busy} onClick={() => void save({ feedback: 'ko', corrected_sql: fix.trim(), feedback_note: note.trim() })}>Salva il giudizio</Button>
          </Box>
        </>
      ) : null}
    </Box>
  )
}

/** Risposta del generatore: attesa, errore oppure query con tipo, avvisi e giudizio. */
export default function Text2SqlAnswer({ item, onFeedback, onRetry, onDelete }: Props) {
  return (
    <Box component="section" aria-label="Risposta" sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
      <Typography component="h2" sx={{ m: 0, fontSize: 16, fontWeight: 650, lineHeight: 1.35 }}>{item.question}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: 12, color: 'text.secondary' }}>
        <StatusBadge status={item.status} /><KindBadge kind={item.kind} />
        <span>{fmtWhen(item.created_at)}</span>{item.seconds != null ? <span>· {Math.round(item.seconds)} s</span> : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Togli dallo storico"><IconButton size="small" aria-label="Togli dallo storico" onClick={() => onDelete(item)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
      </Box>

      {item.status === 'queued' || item.status === 'running' ? (
        <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1, py: 4, px: 2, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
          <Typography component="b" sx={{ color: 'text.primary', fontSize: 14, fontWeight: 600 }}>{item.status === 'queued' ? 'In coda' : 'Sto scrivendo la query…'}</Typography>
          {item.status === 'running' ? <LinearProgress sx={{ width: 'min(260px, 80%)', height: 4, borderRadius: 2 }} /> : null}
          <span>{item.status === 'queued'
            ? "Parte appena il generatore è libero. Puoi lasciare la pagina: ti arriva una notifica quando la query è pronta."
            : 'Di solito ci vuole circa un minuto. Puoi lasciare la pagina: ti arriva una notifica quando è pronta.'}</span>
        </Box>
      ) : item.status === 'error' ? (
        <>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: '10px 12px', borderRadius: '8px', bgcolor: 'error.light', color: 'error.main', fontSize: 13 }}>
            <ErrorOutlineRoundedIcon sx={{ fontSize: 17, mt: '1px' }} /><span>{item.error}</span>
          </Box>
          <Box><Button variant="outlined" color="inherit" startIcon={<ReplayRoundedIcon />} onClick={() => onRetry(item)}>Riprova</Button></Box>
        </>
      ) : (
        <>
          <SqlBlock sql={item.sql} tone={item.kind === 'write' ? 'write' : undefined} />
          {item.warnings.length ? (
            <Box component="ul" sx={{ m: 0, p: '8px 10px', listStyle: 'none', display: 'grid', gap: 0.5, borderRadius: '8px', bgcolor: 'warning.light', color: 'warning.main', fontSize: 12.5 }}>
              {item.warnings.map((w) => <Box component="li" key={w} sx={{ display: 'flex', gap: 1 }}><ErrorOutlineRoundedIcon sx={{ fontSize: 15, mt: '2px', flex: 'none' }} /><span>{w}</span></Box>)}
            </Box>
          ) : null}
          {item.kind === 'impossible' ? null : <Feedback item={item} onFeedback={onFeedback} />}
        </>
      )}
    </Box>
  )
}
