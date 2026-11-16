import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, ButtonBase, CircularProgress, IconButton, InputBase, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon, PageHead } from '../ui/campo'
import { agoLabel } from '../utils/agoLabel'
import {
  GROUPS, groupOf, highlightParts, iconOf, pushRecent, readRecent, resultPath,
  type SearchGroup, type SearchResult,
} from '../features/search/searchModel'

const isCanceled = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'CanceledError'

function Hl({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightParts(text, q).map((p, i) => p.hit
        ? <Box key={i} component="mark" sx={{ bgcolor: (t) => t.palette.archie.tints.sand.bg, color: 'inherit', borderRadius: '3px', px: '1px', boxShadow: (t) => `inset 0 -2px 0 ${t.palette.archie.tints.sand.mid}99` }}>{p.t}</Box>
        : <React.Fragment key={i}>{p.t}</React.Fragment>)}
    </>
  )
}

/** Ricerca globale (anteprima mr-base, variante A · Per tipo). */
export default function Search() {
  const toast = useToast()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()

  // Compatibilità con il vecchio parametro ?q=
  React.useEffect(() => {
    const legacy = (sp.get('q') ?? '').trim()
    if (legacy && !sp.get('search')) { const n = new URLSearchParams(sp); n.set('search', legacy); n.delete('q'); setSp(n, { replace: true }) }
  }, [sp, setSp])

  const raw = sp.get('search') ?? ''
  const q = raw.trim()
  const tipo = (sp.get('tipo') ?? 'all') as SearchGroup | 'all'
  const setParam = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); if (k === 'search') n.delete('q'); return n }, { replace: true })

  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [recent, setRecent] = React.useState<string[]>(() => readRecent())
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      if (!q) { setResults([]); setLoading(false); return }
      setLoading(true)
      try {
        const { data } = await api.get<{ results?: SearchResult[] }>('/search/', { params: { q, limit: 100 }, signal: ctrl.signal })
        setResults(data.results ?? [])
      } catch (e) {
        if (!isCanceled(e)) toast.error(apiErrorToMessage(e))
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => { window.clearTimeout(t); ctrl.abort() }
  }, [q, toast])

  const counts = React.useMemo(() => {
    const c: Partial<Record<SearchGroup, number>> = {}
    results.forEach((r) => { const g = groupOf(r.kind); if (g) c[g] = (c[g] ?? 0) + 1 })
    return c
  }, [results])
  const visible = results.filter((r) => tipo === 'all' || groupOf(r.kind) === tipo)
  const groups = GROUPS.map((g) => ({ ...g, items: visible.filter((r) => groupOf(r.kind) === g.key) })).filter((g) => g.items.length)

  const open = (r: SearchResult) => {
    setRecent(pushRecent(q))
    const path = resultPath(r)
    if (path) navigate(path)
    else toast.error('Questo tipo di risultato non si può ancora aprire da qui.')
  }

  const rail = [{ key: 'all' as const, label: 'Tutto', icon: 'search' as const, n: results.length }, ...GROUPS.map((g) => ({ key: g.key, label: g.label, icon: g.icon, n: counts[g.key] ?? 0 }))].filter((x) => x.n || x.key === tipo)

  return (
    <Box>
      <PageHead title="Ricerca" />
      <Box component="form" role="search" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setRecent(pushRecent(q)) }} sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, height: 48, px: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: '12px',
        bgcolor: 'background.paper', color: 'text.secondary', boxShadow: '0 1px 2px rgb(16 30 50 / .04)',
        '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing },
      }}>
        <CampoIcon name="search" size={19} />
        <InputBase inputRef={inputRef} autoFocus value={raw} onChange={(e) => setParam('search', e.target.value)}
          placeholder="Cerca clienti, siti, contatti, inventari, wiki, file…" inputProps={{ 'aria-label': 'Cerca in Archie' }} sx={{ flex: 1, fontSize: 16 }} />
        {loading ? <CircularProgress size={16} /> : null}
        {raw ? <IconButton size="small" aria-label="Cancella la ricerca" onClick={() => { setParam('search', ''); inputRef.current?.focus() }}><CampoIcon name="x" size={15} /></IconButton> : null}
      </Box>

      {!q ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '14px 16px' }}>
            <Typography component="h2" sx={{ fontSize: 12.5, fontWeight: 650, color: 'text.secondary', mb: 1 }}>Ricerche recenti</Typography>
            {recent.length ? recent.map((t) => (
              <ButtonBase key={t} onClick={() => setParam('search', t)} sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.1, width: '100%', height: 34, px: 1, borderRadius: '6px', fontSize: 13, '&:hover': { bgcolor: 'archie.surface2' } }}>
                <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="history" size={15} /></Box>{t}
              </ButtonBase>
            )) : <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Qui trovi le ultime cose che hai cercato.</Typography>}
          </Box>
          <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '14px 16px' }}>
            <Typography component="h2" sx={{ fontSize: 12.5, fontWeight: 650, color: 'text.secondary', mb: 1 }}>Cosa puoi cercare</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 0.75, fontSize: 13, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
              <li><b>Clienti e siti</b> per nome, codice, città o partita IVA</li>
              <li><b>Inventari</b> per hostname, K-number, seriale o indirizzo IP</li>
              <li><b>Contatti</b> per nome, email o telefono</li>
              <li><b>Wiki e Drive</b> per titolo e contenuto</li>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '200px minmax(0, 1fr)' }, gap: { xs: 1.5, md: 2.25 }, mt: 2, alignItems: 'start' }}>
          <Box component="nav" aria-label="Tipo" sx={{ display: { xs: 'flex', md: 'grid' }, gap: '2px', overflowX: 'auto', position: { md: 'sticky' }, top: 0 }}>
            {rail.map((x) => {
              const on = tipo === x.key
              return (
                <ButtonBase key={x.key} aria-pressed={on} onClick={() => setParam('tipo', x.key === 'all' ? '' : x.key)} sx={{
                  flex: 'none', display: 'flex', justifyContent: 'flex-start', gap: 1.1, height: 34, px: 1.25, borderRadius: '7px', fontSize: 13,
                  color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent', fontWeight: on ? 600 : 400,
                  '&:hover': { bgcolor: on ? 'archie.field' : 'archie.surface2', color: on ? 'primary.main' : 'text.primary' },
                  '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                  <CampoIcon name={x.icon} size={16} />
                  <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{x.label}</Box>
                  <Box component="b" sx={{ fontSize: 11.5, fontWeight: 600, ml: 1 }}>{x.n}</Box>
                </ButtonBase>
              )
            })}
          </Box>
          <Box aria-live="polite">
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25, mt: 0.5 }}>
              {loading && !results.length ? 'Sto cercando…' : <><b>{visible.length}</b> {visible.length === 1 ? 'risultato' : 'risultati'} per «{q}»</>}
            </Typography>
            {!loading && !results.length ? (
              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 3, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>Nessun risultato</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>Prova con meno parole, un codice o un indirizzo IP.</Typography>
              </Box>
            ) : null}
            {groups.map((g) => (
              <Box component="section" key={g.key} aria-label={g.label} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', mb: 1.5, overflow: 'hidden' }}>
                <Typography component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.25, fontSize: 12.5, fontWeight: 650, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'archie.surface2' }}>
                  <CampoIcon name={g.icon} size={15} />{g.label}
                  <Box component="span" sx={{ fontSize: 11, bgcolor: 'archie.neutralBg', borderRadius: '5px', px: 0.75, lineHeight: '18px' }}>{g.items.length}</Box>
                </Typography>
                {g.items.map((r, i) => (
                  <ButtonBase key={`${r.kind}:${r.id}`} onClick={() => open(r)} sx={{
                    display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1.5, width: '100%', px: 1.75, py: 1.25, textAlign: 'left',
                    borderTop: i ? '1px solid' : 0, borderColor: 'divider', '&:hover': { bgcolor: 'archie.surface2' }, '&:hover .go, &.Mui-focusVisible .go': { opacity: 1 },
                    '&.Mui-focusVisible': { bgcolor: 'archie.field' },
                  }}>
                    <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex', flex: 'none' }}><CampoIcon name={iconOf(r.kind)} size={17} /></Box>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'grid', lineHeight: 1.35 }}>
                      <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 550 }}><Hl text={r.title} q={q} /></Typography>
                      {r.subtitle ? <Typography noWrap component="span" sx={{ fontSize: 12, color: 'text.secondary' }}><Hl text={r.subtitle} q={q} /></Typography> : null}
                    </Box>
                    {r.updated_at ? <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'inline' } }}>{agoLabel(r.updated_at)}</Typography> : null}
                    <Box className="go" component="span" sx={{ opacity: 0, color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="arrowR" size={15} /></Box>
                  </ButtonBase>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
