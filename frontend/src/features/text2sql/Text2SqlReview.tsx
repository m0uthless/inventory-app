import * as React from 'react'
import { Box, Button, Typography } from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'

import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { copyToClipboard } from '@shared/utils/clipboard'

import { t2sApi, type T2sReviewRow } from './api'
import SqlBlock from './SqlBlock'
import { KindBadge } from './T2sBadges'
import { fmtWhen } from './time'

type Filter = 'ko' | 'ok' | ''

/** Revisione del superuser: le risposte giudicate dai tecnici, prima quelle da correggere. */
export default function Text2SqlReview({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast()
  const [filter, setFilter] = React.useState<Filter>('ko')
  const [rows, setRows] = React.useState<T2sReviewRow[] | null>(null)
  const load = React.useCallback(() => { t2sApi.review(filter).then(setRows).catch((e) => toast.error(apiErrorToMessage(e))) }, [filter, toast])
  React.useEffect(() => { load() }, [load])

  const toggle = async (r: T2sReviewRow) => {
    try {
      const upd = await t2sApi.reviewed(r.id, !r.reviewed_at)
      setRows((cur) => (cur ?? []).map((x) => (x.id === r.id ? { ...x, reviewed_at: upd.reviewed_at } : x)))
      onChanged?.()
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  const pending = (rows ?? []).filter((r) => !r.reviewed_at).length
  const tab = (k: Filter, label: string) => (
    <Box component="button" type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} sx={{
      height: 28, px: 1.25, border: 0, borderRadius: '6px', font: 'inherit', fontSize: 13, fontWeight: 550, cursor: 'pointer',
      color: filter === k ? 'text.primary' : 'text.secondary', bgcolor: filter === k ? 'background.paper' : 'transparent',
      boxShadow: filter === k ? (t) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` : 'none',
    }}>{label}</Box>
  )

  return (
    <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Box role="group" aria-label="Filtra per giudizio" sx={{ display: 'inline-flex', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'archie.surface2' }}>
          {tab('ko', 'Da correggere')}{tab('ok', 'Corrette')}{tab('', 'Tutte')}
        </Box>
        <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          {rows ? `${pending} da rivedere.` : ''} «Copia come esempio» prepara il blocco per <code>esempi_query.md</code>.
        </Typography>
      </Box>
      {rows && !rows.length ? (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
          Nessuna risposta da rivedere con questo giudizio.
        </Box>
      ) : (rows ?? []).map((r) => (
        <Box component="article" key={r.id} sx={{ display: 'grid', gap: 1.25, p: '14px 16px', minWidth: 0, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', opacity: r.reviewed_at ? 0.62 : 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography component="h3" sx={{ m: 0, flex: 1, minWidth: 240, fontSize: 14, fontWeight: 650, lineHeight: 1.4 }}>{r.question}</Typography>
            <KindBadge kind={r.kind} />
            <Box component="span" sx={{ height: 20, px: '7px', borderRadius: '5px', fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
              bgcolor: r.feedback === 'ok' ? 'success.light' : 'error.light', color: r.feedback === 'ok' ? 'success.main' : 'error.main' }}>
              {r.feedback === 'ok' ? 'Corretta' : 'Da correggere'}
            </Box>
          </Box>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{r.user_full_name} · {fmtWhen(r.feedback_at ?? r.created_at)}{r.reviewed_at ? ' · rivista' : ''}</Typography>
          {r.corrected_sql ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 1.25 }}>
              <SqlBlock sql={r.sql} label="Generata" copyLabel="Copia la query generata" />
              <SqlBlock sql={r.corrected_sql} label="Corretta dal tecnico" tone="corrected" copyLabel="Copia la query corretta" />
            </Box>
          ) : <SqlBlock sql={r.sql} />}
          {r.feedback_note ? (
            <Box sx={{ p: '8px 10px', borderRadius: '8px', bgcolor: 'archie.surface2', fontSize: 13, lineHeight: 1.45 }}>
              <b>Nota:</b> <span>{r.feedback_note}</span>
            </Box>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="outlined" color="inherit" startIcon={<ContentCopyRoundedIcon />}
              onClick={async () => { await copyToClipboard(r.example_markdown); toast.success('Esempio copiato: incollalo in esempi_query.md') }}>Copia come esempio</Button>
            <Button variant={r.reviewed_at ? 'outlined' : 'contained'} color={r.reviewed_at ? 'inherit' : 'primary'} startIcon={r.reviewed_at ? <ReplayRoundedIcon /> : <CheckRoundedIcon />}
              onClick={() => void toggle(r)}>{r.reviewed_at ? 'Rimetti da rivedere' : 'Segna come rivista'}</Button>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
