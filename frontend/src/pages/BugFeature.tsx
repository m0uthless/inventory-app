import * as React from 'react'
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, Link, Stack, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { copyToClipboard } from '@shared/utils/clipboard'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon, PageHead } from '../ui/campo'
import { BOARD_TONES, type ReportRow } from '../features/bugfeature/bfModel'
import { BoardColumn, KindIcon, RejectDialog, ReportCard, ReportDetail, ReportDialog, type NewReport } from '../features/bugfeature/bfUi'

type ApiPage<T> = { count: number; results: T[] }
const RECENT_CLOSED = 10

/** Bug e feature come bacheca (anteprima "Bacheca"): bug aperti, funzionalità richieste, chiuse di recente. */
export default function BugFeaturePage() {
  const loc = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const canCreate = useAuth().hasPerm('feedback.add_reportrequest')
  const theme = useTheme()
  const [params, setParams] = useSearchParams()
  const closedPage = loc.pathname.startsWith('/bug-feature/resolved')

  const [open, setOpen] = React.useState<ReportRow[] | null>(null)
  const [closed, setClosed] = React.useState<ReportRow[] | null>(null)
  const [closedCount, setClosedCount] = React.useState(0)
  const [tick, setTick] = React.useState(0)
  const reload = () => setTick((t) => t + 1)
  const [busy, setBusy] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [rejecting, setRejecting] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    const get = (p: Record<string, unknown>) => api.get<ApiPage<ReportRow>>('/feedback-items/', { params: p }).then((r) => r.data)
    Promise.all([
      closedPage ? Promise.resolve(null) : get({ status: 'open', ordering: '-created_at', page_size: 200 }),
      get({ status: 'resolved,rejected', ordering: '-updated_at', page_size: closedPage ? 200 : RECENT_CLOSED }),
    ]).then(([o, c]) => {
      if (!alive) return
      setOpen(o?.results ?? [])
      setClosed(c.results ?? [])
      setClosedCount(c.count ?? 0)
    }).catch((e) => { if (alive) { toast.error(apiErrorToMessage(e)); setOpen([]); setClosed([]) } })
    return () => { alive = false }
  }, [closedPage, tick, toast])

  // Aperto da "Segnala" in altre parti dell'app (barra in basso, pulsante rapido).
  React.useEffect(() => {
    if ((loc.state as { openCreate?: boolean } | null)?.openCreate) {
      if (canCreate) setCreating(true)
      navigate(loc.pathname + loc.search, { replace: true, state: null })
    }
  }, [loc, navigate, canCreate])

  const columns = closedPage
    ? [
      { key: 'resolved', title: 'Risolte', tone: BOARD_TONES.done, icon: <DoneRoundedIcon sx={{ fontSize: 16 }} />, items: (closed ?? []).filter((r) => r.status === 'resolved') },
      { key: 'rejected', title: 'Rifiutate', tone: { bg: 'archie.neutralBg', fg: 'text.secondary' }, icon: <CloseRoundedIcon sx={{ fontSize: 16 }} />, items: (closed ?? []).filter((r) => r.status === 'rejected') },
    ]
    : [
      { key: 'bug', title: 'Bug aperti', tone: BOARD_TONES.bug, icon: <KindIcon kind="bug" />, items: (open ?? []).filter((r) => r.kind === 'bug') },
      { key: 'feature', title: 'Funzionalità richieste', tone: BOARD_TONES.feature, icon: <KindIcon kind="feature" />, items: (open ?? []).filter((r) => r.kind === 'feature') },
      { key: 'done', title: 'Chiuse di recente', tone: BOARD_TONES.done, icon: <DoneRoundedIcon sx={{ fontSize: 16 }} />, items: closed ?? [] },
    ]
  const openId = Number(params.get('open')) || null
  // ‹ › scorrono la colonna della segnalazione aperta.
  const col = columns.find((c) => c.items.some((r) => r.id === openId))?.items ?? []
  const idx = col.findIndex((r) => r.id === openId)
  const current = idx >= 0 ? col[idx] : null
  // Clic sulla scheda: la seleziona; doppio clic o Invio: la apre. Su mobile il tocco apre.
  const [focusId, setFocusId] = React.useState<number | null>(null)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const select = (id: number | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('open', String(id)); else n.delete('open'); return n }, { replace: true })

  // ── Azioni ──
  const patch = async (id: number, body: Record<string, unknown> | FormData, ok: string) => {
    setBusy(true)
    try {
      await api.patch(`/feedback-items/${id}/`, body, body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
      toast.success(ok)
      reload()
      return true
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  const create = async (v: NewReport) => {
    const body = new FormData()
    body.append('kind', v.kind); body.append('section', v.section); body.append('description', v.description.trim())
    if (v.screenshot) body.append('screenshot', v.screenshot)
    setBusy(true)
    try {
      const { data } = await api.post<ReportRow>('/feedback-items/', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Segnalazione inviata. Ti avvisiamo quando viene gestita.')
      setCreating(false)
      if (closedPage) navigate(`/bug-feature?open=${data.id}`)
      else { reload(); select(data.id) }
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const loading = open === null || closed === null
  return (
    <Stack spacing={0}>
      <PageHead title={closedPage ? 'Segnalazioni chiuse' : 'Bug e feature'} actions={
        canCreate ? <Button variant="contained" onClick={() => setCreating(true)} startIcon={<CampoIcon name="plus" size={15} />}>Segnala</Button> : null
      } />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${columns.length}, minmax(0, 1fr))` }, gap: 1.75, alignItems: 'start' }}>
        {columns.map((c) => (
          <BoardColumn key={c.key} title={c.title} tone={c.tone} icon={c.icon} count={c.key === 'done' ? closedCount : c.items.length}
            footer={c.key === 'done' && closedCount > RECENT_CLOSED ? (
              <Link component={RouterLink} to="/bug-feature/resolved" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.25, px: 0.5, fontSize: 12.5, fontWeight: 550 }}>
                Tutte le chiuse <CampoIcon name="arrowR" size={13} />
              </Link>
            ) : null}>
            {loading ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary', px: 0.5 }}>Caricamento…</Typography>
              : c.items.length ? c.items.map((r) => <ReportCard key={r.id} r={r} selected={r.id === (openId ?? focusId)} onSelect={() => (isMobile ? select(r.id) : setFocusId(r.id))} onOpen={() => { setFocusId(r.id); select(r.id) }} />)
                : <Typography sx={{ fontSize: 12.5, color: 'text.secondary', px: 0.5 }}>Niente qui.</Typography>}
          </BoardColumn>
        ))}
      </Box>

      {current ? (
        <ReportDetail r={current} busy={busy}
          position={`${idx + 1} di ${col.length}`}
          onPrev={idx > 0 ? () => { setFocusId(col[idx - 1].id); select(col[idx - 1].id) } : undefined}
          onNext={idx < col.length - 1 ? () => { setFocusId(col[idx + 1].id); select(col[idx + 1].id) } : undefined}
          onClose={() => select(null)}
          onCopyLink={() => { void copyToClipboard(`${window.location.origin}/bug-feature?open=${current.id}`).then(() => toast.success('Link copiato')) }}
          onResolve={() => void patch(current.id, { status: 'resolved' }, "Segnalazione risolta: chi l'ha aperta riceve la notifica.")}
          onReject={() => setRejecting(true)}
          onReopen={() => void patch(current.id, { status: 'open' }, 'Segnalazione riaperta.')}
          onUpload={(f) => { const b = new FormData(); b.append('screenshot', f); void patch(current.id, b, 'Screenshot aggiunto.') }}
        />
      ) : null}
      <ReportDialog open={creating} busy={busy} onClose={() => setCreating(false)} onSubmit={(v) => void create(v)} />
      <RejectDialog open={rejecting && current !== null} busy={busy} onClose={() => setRejecting(false)}
        onSubmit={async (reason) => { if (current && await patch(current.id, { status: 'rejected', rejection_reason: reason }, 'Segnalazione rifiutata.')) setRejecting(false) }} />
    </Stack>
  )
}
