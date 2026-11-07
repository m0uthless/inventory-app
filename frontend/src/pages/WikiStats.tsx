import * as React from 'react'
import { Box, CircularProgress } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon } from '../ui/campo'
import type { ContributorData } from '../ui/ContributorCard'
import { ArchiveRoot, StarIcon, WikiHead } from '../features/wiki/archive/archiveUi'
import { cVars, r1, type ApiList, type WikiCategory } from '../features/wiki/archive/archiveModel'

type Totals = { total: number; published: number; drafts: number; total_views: number; rated_pages: number; unrated_pages: number; total_votes: number; average_rating: number }
type CategoryStat = { name: string; color: string; count: number }
type PageStat = { id: number; kb_code: string; title: string; view_count: number; is_published: boolean; avg_rating?: number | null; rating_count?: number }
type TopAuthor = { user_id: number; name: string; edits: number }
type TopQuery = { id: number; title: string; use_count: number; language: string | null; lang_color: string }
type Stats = {
  totals: Totals
  by_category: CategoryStat[]
  top_authors: TopAuthor[]
  low_rated_pages: PageStat[]
  unrated_pages: PageStat[]
  most_viewed_pages: PageStat[]
  rating_distribution: { stars: number; count: number }[]
  monthly_contributor: ContributorData | null
  top_queries: TopQuery[]
}

const MONTH = new Date().toLocaleDateString('it-IT', { month: 'long' })
const okHex = (c?: string | null) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#5b6b67')
const NOTE_TILT = [-1.4, 1, -0.6, 1.3, -1]

function Bar({ value, max, label, tone }: { value: number; max: number; label: string; tone?: 'warn' }) {
  return <span className={`w-bar${tone === 'warn' ? ' is-warn' : ''}`} role="img" aria-label={label}><i style={{ width: `${value > 0 ? Math.max(3, (value / (max || 1)) * 100) : 0}%` }} /></span>
}

/** Statistiche della Wiki come registro dell'archivio (anteprima w-base, variante E). */
export default function WikiStats() {
  const toast = useToast()
  const navigate = useNavigate()
  const { hasPerm } = useAuth()
  const [s, setS] = React.useState<Stats | null>(null)
  const [cats, setCats] = React.useState<WikiCategory[]>([])

  React.useEffect(() => {
    let alive = true
    Promise.all([
      api.get<Stats>('/wiki-stats/'),
      api.get<ApiList<WikiCategory>>('/wiki-categories/', { params: { page_size: 200 } }).catch(() => ({ data: { count: 0, results: [] as WikiCategory[] } })),
    ]).then(([st, c]) => { if (alive) { setS(st.data); setCats(c.data.results ?? []) } })
      .catch((e) => toast.error(apiErrorToMessage(e)))
    return () => { alive = false }
  }, [toast])

  const open = (id: number) => navigate(`/wiki/${id}`)
  const head = <WikiHead section="stats" canQueries={hasPerm(PERMS.wiki.query.view)} />
  if (!s) return <Box>{head}<Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={24} /></Box></Box>

  const t = s.totals
  const maxCat = Math.max(1, ...s.by_category.map((c) => c.count))
  const top = s.most_viewed_pages.slice(0, 6); const maxV = Math.max(1, ...top.map((p) => p.view_count))
  const dist = [...s.rating_distribution].sort((a, b) => b.stars - a.stars); const maxD = Math.max(1, ...dist.map((d) => d.count)); const nVotes = dist.reduce((n, d) => n + d.count, 0)
  const authors = s.top_authors.slice(0, 6); const maxA = Math.max(1, ...authors.map((a) => a.edits))
  const queries = s.top_queries.slice(0, 5); const maxQ = Math.max(1, ...queries.map((q) => q.use_count))
  const review = [...s.low_rated_pages.slice(0, 4), ...s.unrated_pages.slice(0, 4)]
  const mc = s.monthly_contributor

  return (
    <Box>
      {head}
      <ArchiveRoot>
        <div className="w-st">
          <ul className="w-st-tags" aria-label="Riepilogo">
            <li><span className="w-st-k">Pagine pubblicate</span><b>{t.published}</b><small>{t.drafts} {t.drafts === 1 ? 'bozza' : 'bozze'}</small></li>
            <li><span className="w-st-k">Letture totali</span><b>{t.total_views.toLocaleString('it-IT')}</b><small>{t.published ? `in media ${Math.round(t.total_views / t.published)} per pagina` : '—'}</small></li>
            <li><span className="w-st-k">Voto medio</span><b>{t.total_votes ? r1(t.average_rating) : '—'}</b><small>{t.total_votes} voti su {t.rated_pages} pagine</small></li>
            <li className="w-st-month">
              <span className="w-st-k">Collaboratore del mese</span>
              <b>{mc ? mc.name : 'Nessuno'}</b>
              <small>{mc ? `${mc.pages_created} ${mc.pages_created === 1 ? 'pagina creata' : 'pagine create'} a ${MONTH}` : `nessuna pagina creata a ${MONTH}`}</small>
              {mc ? <span className="w-rosette" aria-hidden><StarIcon size={20} /></span> : null}
            </li>
          </ul>

          <section className="w-st-card w-st-cats" aria-labelledby="st-cat">
            <header><h2 id="st-cat">Pagine per cartella</h2><span>{t.total} pagine in {s.by_category.length} cartelle</span></header>
            {s.by_category.length ? (
              <div className="w-cab" style={{ gridTemplateColumns: `repeat(${Math.min(8, s.by_category.length)}, minmax(0, 1fr))` }}>
                {s.by_category.map((c) => {
                  const cat = cats.find((x) => x.name === c.name)
                  return (
                    <button key={c.name} type="button" className="w-cab-f" title={`${c.name}: ${c.count} pagine`}
                      style={{ ...cVars(okHex(c.color)), ['--h' as string]: `${Math.round(40 + (c.count / maxCat) * 140)}px` }}
                      onClick={() => navigate(cat ? `/wiki?cartella=${cat.id}` : '/wiki')}>
                      <b>{c.count}</b><span className="w-cab-body"><span className="w-cab-tab" /></span><span className="w-cab-l">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : <p className="w-rail-none">Nessuna pagina archiviata.</p>}
          </section>

          <section className="w-st-card" aria-labelledby="st-top">
            <header><h2 id="st-top">Le più lette</h2><span>letture da sempre</span></header>
            <ol className="w-rank">
              {top.map((p, i) => (
                <li key={p.id}>
                  <span className="w-rank-n">{i + 1}</span>
                  <a href={`/wiki/${p.id}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); open(p.id) }}><span className="w-rank-t">{p.title}</span><span className="w-rank-c">{p.kb_code}</span></a>
                  <Bar value={p.view_count} max={maxV} label={`${p.view_count} letture`} />
                  <b className="w-num">{p.view_count}</b>
                </li>
              ))}
            </ol>
          </section>

          <section className="w-st-card" aria-labelledby="st-votes">
            <header><h2 id="st-votes">Come vengono votate</h2><span>{nVotes} voti</span></header>
            <ul className="w-dist">
              {dist.map((d) => (
                <li key={d.stars}>
                  <span className="w-dist-s" aria-label={`${d.stars} stelle`}>{[1, 2, 3, 4, 5].map((k) => <StarIcon key={k} on={k <= d.stars} size={14} />)}</span>
                  <Bar value={d.count} max={maxD} label={`${d.count} voti da ${d.stars} stelle`} tone="warn" />
                  <b className="w-num">{d.count}</b>
                </li>
              ))}
            </ul>
          </section>

          <section className="w-st-card" aria-labelledby="st-auth">
            <header><h2 id="st-auth">Chi scrive</h2><span>revisioni salvate</span></header>
            {authors.length ? (
              <ul className="w-sign">{authors.map((a) => <li key={a.user_id}><span className="w-sign-n">{a.name}</span><Bar value={a.edits} max={maxA} label={`${a.edits} revisioni`} /><b className="w-num">{a.edits}</b></li>)}</ul>
            ) : <p className="w-rail-none">Ancora nessuna revisione.</p>}
          </section>

          <section className="w-st-card" aria-labelledby="st-q">
            <header><h2 id="st-q">Query più copiate</h2>{hasPerm(PERMS.wiki.query.view) ? <button type="button" className="link-btn" onClick={() => navigate('/wiki/queries')}>Apri lo schedario <CampoIcon name="arrowR" size={14} /></button> : null}</header>
            {queries.length ? (
              <ul className="w-sign">
                {queries.map((q) => (
                  <li key={q.id}>
                    <span className="w-sign-n">{q.language ? <span className="w-lang-s" style={cVars(okHex(q.lang_color))}>{q.language}</span> : null}{q.title}</span>
                    <Bar value={q.use_count} max={maxQ} label={`${q.use_count} copie`} />
                    <b className="w-num">{q.use_count}</b>
                  </li>
                ))}
              </ul>
            ) : <p className="w-rail-none">Nessuna query ancora copiata.</p>}
          </section>

          <section className="w-st-card w-st-review" aria-labelledby="st-rev">
            <header><h2 id="st-rev">Da rivedere</h2><span>voto basso o ancora nessun voto</span></header>
            {review.length ? (
              <ul className="w-notes w-notes-sm">
                {review.map((p, i) => (
                  <li key={p.id} style={{ ['--r' as string]: `${NOTE_TILT[i % NOTE_TILT.length]}deg` }}>
                    <a href={`/wiki/${p.id}`} className="w-note-p" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); open(p.id) }}>
                      <span className="w-tape" /><b>{p.title}</b>
                      <small>{p.rating_count ? <><StarIcon size={12} /> {r1(p.avg_rating)} · {p.rating_count} voti</> : 'Nessun voto'} · {p.view_count} letture</small>
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="w-rail-none">Niente da rivedere: tutte le pagine hanno un buon voto.</p>}
          </section>
        </div>
      </ArchiveRoot>
    </Box>
  )
}
