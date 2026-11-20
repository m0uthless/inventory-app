import * as React from 'react'
import { Box, Button, ButtonBase, InputBase, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useSearchParams } from 'react-router-dom'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

import { useAuth } from '../auth/AuthProvider'
import { PageHead } from '../ui/campo'
import { T2S_PENDING_KEY, isWaiting, t2sApi, type T2sFeedbackPayload, type T2sRequest } from '../features/text2sql/api'
import Text2SqlAnswer from '../features/text2sql/Text2SqlAnswer'
import Text2SqlReview from '../features/text2sql/Text2SqlReview'
import { KindBadge, StatusBadge } from '../features/text2sql/T2sBadges'
import { fmtWhen } from '../features/text2sql/time'

const MAX = 2000
const POLL_MS = 3000
const PENDING_MS = 20 * 60 * 1000
const card = { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px' } as const

const setPending = (on: boolean) => {
  try { if (on) localStorage.setItem(T2S_PENDING_KEY, String(Date.now() + PENDING_MS)); else localStorage.removeItem(T2S_PENDING_KEY) } catch { /* solo in memoria */ }
  window.dispatchEvent(new Event('notifications-changed'))
}

/** Segna come letta la notifica «Query SQL pronta» della domanda appena aperta. */
async function markNotificationRead(id: number) {
  try {
    const { data } = await api.get('/notifications/', { params: { page_size: 50 } })
    const rows: { id: number; link: string; is_read: boolean; notification_type: string }[] = data?.results ?? data ?? []
    const n = rows.find((r) => r.notification_type === 'text2sql_ready' && !r.is_read && r.link.endsWith(`apri=${id}`))
    if (n) { await api.post(`/notifications/${n.id}/mark_read/`); window.dispatchEvent(new Event('notifications-changed')) }
  } catch { /* la notifica resta da leggere: nessun danno */ }
}

/** Conoscenza › Generatore SQL (anteprima design-previews/sql-base.html, variante A · Elenco e risposta). */
export default function Text2Sql() {
  const toast = useToast()
  const { me } = useAuth()
  const isSu = Boolean(me?.is_superuser)
  const [params, setParams] = useSearchParams()
  const [view, setView] = React.useState<'mine' | 'review'>('mine')
  const [items, setItems] = React.useState<T2sRequest[] | null>(null)
  const [selId, setSelId] = React.useState<number | null>(() => (Number(params.get('apri')) || null))
  const [draft, setDraft] = React.useState('')
  const [sending, setSending] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const rows = await t2sApi.list()
      setItems(rows)
      if (!rows.some(isWaiting)) setPending(false)
      return rows
    } catch (e) { toast.error(apiErrorToMessage(e)); return null }
  }, [toast])
  React.useEffect(() => { void load() }, [load])

  // Mentre c'è una domanda in attesa si controlla ogni 3 secondi.
  const waiting = (items ?? []).filter(isWaiting).length
  React.useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => { void load() }, POLL_MS)
    return () => window.clearInterval(t)
  }, [waiting, load])

  // ?apri=<id> (dalla notifica): seleziona la domanda e toglie il parametro.
  React.useEffect(() => {
    const id = Number(params.get('apri'))
    if (!id) return
    setSelId(id); setView('mine')
    const next = new URLSearchParams(params); next.delete('apri'); setParams(next, { replace: true })
  }, [params, setParams])

  const selected = (items ?? []).find((x) => x.id === selId) ?? (items ?? [])[0] ?? null
  const selectedDoneId = selected && !isWaiting(selected) ? selected.id : null
  React.useEffect(() => { if (selectedDoneId) void markNotificationRead(selectedDoneId) }, [selectedDoneId])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || sending) return
    setSending(true)
    try {
      const created = await t2sApi.create(q)
      setItems((cur) => [created, ...(cur ?? [])]); setSelId(created.id); setDraft('')
      setPending(true)
      toast.success('Domanda in coda: ti arriva una notifica quando la query è pronta')
      return created
    } catch (e) { toast.error(apiErrorToMessage(e)); return null } finally { setSending(false) }
  }
  const feedback = async (id: number, p: T2sFeedbackPayload) => {
    try {
      const upd = await t2sApi.feedback(id, p)
      setItems((cur) => (cur ?? []).map((x) => (x.id === id ? upd : x)))
      toast.success('Giudizio salvato')
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  const remove = async (it: T2sRequest) => {
    try {
      await t2sApi.remove(it.id)
      setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id))
      if (selId === it.id) setSelId(null)
    } catch (e) { toast.error(apiErrorToMessage(e)) }
  }
  // «Riprova»: la stessa domanda torna in coda come domanda nuova; quella non riuscita sparisce.
  const retry = async (it: T2sRequest) => { if (await ask(it.question)) await remove(it) }

  const seg = isSu ? (
    <Box role="group" aria-label="Vista" sx={{ display: 'inline-flex', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'archie.surface2' }}>
      {([['mine', 'Le mie domande'], ['review', 'Revisione']] as const).map(([k, label]) => {
        const on = view === k
        return (
          <ButtonBase key={k} aria-pressed={on} onClick={() => setView(k)} sx={{
            height: 28, px: 1.25, borderRadius: '6px', fontSize: 13, fontWeight: 550, color: on ? 'text.primary' : 'text.secondary',
            bgcolor: on ? 'background.paper' : 'transparent', boxShadow: on ? (t) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` : 'none',
            '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
          }}>{label}</ButtonBase>
        )
      })}
    </Box>
  ) : undefined

  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <PageHead title="Generatore SQL" inline={seg}
        meta={<>Query Oracle per il PACS Philips Vue{view === 'mine' && waiting ? <> · <b>{waiting}</b> in attesa</> : null}</>} />

      {view === 'review' && isSu ? <Text2SqlReview /> : (
        <>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); void ask(draft) }} sx={{ ...card, p: 1.5, display: 'grid', gap: 1 }}>
            <InputBase multiline minRows={2} maxRows={10} value={draft} onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void ask(draft) } }}
              placeholder="Chiedi in italiano, es. «quanti studi CT sono stati archiviati ieri?»" inputProps={{ 'aria-label': 'Domanda', maxLength: MAX }}
              sx={{ px: 1.375, py: 1, fontSize: 14, lineHeight: 1.45, border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing } }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                La query non viene eseguita: la copi e la lanci tu sul PACS. <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Ctrl + Invio per inviare.</Box>
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography component="span" sx={{ fontSize: 11.5, color: 'archie.textFaint', fontVariantNumeric: 'tabular-nums' }}>{draft.length}/{MAX}</Typography>
              <Button type="submit" variant="contained" startIcon={<ArrowForwardRoundedIcon />} disabled={!draft.trim() || sending}>Genera</Button>
            </Box>
          </Box>

          {items && !items.length ? (
            <Box sx={{ ...card, p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
              Nessuna domanda ancora. Scrivi cosa vuoi sapere dal PACS: il generatore prepara la query Oracle da copiare.
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(280px, 340px) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
              <Box role="list" aria-label="Le tue domande" sx={{ ...card, display: 'grid', minWidth: 0, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                  <span>Le tue domande</span><span>{items?.length ?? ''}</span>
                </Box>
                {(items ?? []).map((x) => {
                  const on = selected?.id === x.id
                  return (
                    <ButtonBase key={x.id} role="listitem" aria-current={on || undefined} onClick={() => setSelId(x.id)} sx={{
                      display: 'grid', gap: '5px', justifyItems: 'stretch', textAlign: 'left', px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider',
                      bgcolor: on ? 'archie.field' : 'transparent', boxShadow: on ? (t) => `inset 2px 0 0 ${t.palette.archie.fieldLine}` : 'none',
                      '&:last-of-type': { borderBottom: 0 }, '&:hover': { bgcolor: on ? 'archie.field' : 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                    }}>
                      <Typography component="span" sx={{ fontSize: 13, fontWeight: 550, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.question}</Typography>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11.5, color: 'text.secondary' }}>
                        <StatusBadge status={x.status} /><KindBadge kind={x.kind} /><Box component="span" sx={{ flex: 1 }} />
                        {x.feedback ? (x.feedback === 'ok'
                          ? <CheckRoundedIcon titleAccess="Giudicata corretta" sx={{ fontSize: 15, color: 'success.main' }} />
                          : <CloseRoundedIcon titleAccess="Da correggere" sx={{ fontSize: 15, color: 'warning.main' }} />) : null}
                        {fmtWhen(x.created_at)}
                      </Box>
                    </ButtonBase>
                  )
                })}
              </Box>
              <Box sx={{ ...card, p: 2, minWidth: 0 }}>
                {selected ? <Text2SqlAnswer item={selected} onFeedback={feedback} onRetry={(it) => void retry(it)} onDelete={(it) => void remove(it)} /> : null}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
