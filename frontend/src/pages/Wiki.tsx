import { useTheme } from '@mui/material/styles'
import * as React from 'react'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon } from '../ui/campo'
import WikiCategoryManager from '../ui/WikiCategoryManager'
import {
  ArchiveRoot, FolderTabs, HeadAction, Mark, OpenFolder, PageCard, StarIcon, WikiHead,
} from '../features/wiki/archive/archiveUi'
import {
  NO_CAT, catColor, catIcon, cVars, dshort, matchesPage, r1, rel, snippetOf,
  type ApiList, type WikiCategory, type WikiPageRow,
} from '../features/wiki/archive/archiveModel'

type Sort = 'upd' | 'views' | 'title'
const SORTS: [Sort, string][] = [['upd', 'Aggiornate'], ['views', 'Più lette'], ['title', 'A–Z']]
const sortFn: Record<Sort, (a: WikiPageRow, b: WikiPageRow) => number> = {
  upd: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)),
  views: (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0),
  title: (a, b) => a.title.localeCompare(b.title, 'it'),
}
// Leggera rotazione dei fogli: sempre la stessa per posizione, non casuale.
const TILT = [-0.6, 0.4, -0.2, 0.7, -0.5, 0.2]
const IDX_TILT = [-1.2, 0.8, -0.4, 1.1, -0.9, 0.5]
const BOOK_H = [236, 250, 228, 244, 232, 240]

/** Wiki · Archivio (restyle "Campo sterile", anteprima design-previews/w-base.html, variante E). */
export default function Wiki() {
  const dark = useTheme().palette.mode === 'dark'
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { me, hasPerm } = useAuth()
  const [params, setParams] = useSearchParams()
  const catParam = params.get('cartella')
  const view = params.get('vista') === 'tutte' ? 'all' : 'folders'
  const canManageCategories = hasPerm('wiki.add_wikicategory') || hasPerm('wiki.change_wikicategory') || hasPerm('wiki.delete_wikicategory')
  const canAdd = hasPerm(PERMS.wiki.page.add)

  const [cats, setCats] = React.useState<WikiCategory[]>([])
  const [pages, setPages] = React.useState<WikiPageRow[] | null>(null)
  const [q, setQ] = React.useState('')
  const [sort, setSort] = React.useState<Sort>('upd')
  const [catManagerOpen, setCatManagerOpen] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    Promise.all([
      api.get<ApiList<WikiCategory>>('/wiki-categories/', { params: { ordering: 'sort_order,name', page_size: 200 } }),
      api.get<ApiList<WikiPageRow>>('/wiki-pages/', { params: { page_size: 500, ordering: '-updated_at' } }),
    ]).then(([c, p]) => { if (alive) { setCats(c.data.results ?? []); setPages(p.data.results ?? []) } })
      .catch((e) => toast.error(apiErrorToMessage(e)))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  // Apertura della gestione cartelle da altre pagine (es. Impostazioni).
  React.useEffect(() => {
    const state = location.state as { openCategoryManager?: boolean } | null
    if (canManageCategories && state?.openCategoryManager) {
      setCatManagerOpen(true)
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }, [canManageCategories, location.pathname, location.search, location.state, navigate])

  const all = React.useMemo(() => pages ?? [], [pages])
  // Cartelle nell'ordine dell'amministratore; "Senza cartella" solo se serve.
  const folders = React.useMemo(() => (all.some((p) => !p.category) ? [...cats, NO_CAT] : cats), [cats, all])
  const catOf = React.useCallback((p: WikiPageRow) => folders.find((c) => c.id === (p.category ?? 0)), [folders])
  const counts = React.useMemo(() => Object.fromEntries(folders.map((c) => [c.id, all.filter((p) => (p.category ?? 0) === c.id).length])), [folders, all])
  const openCat = catParam != null ? folders.find((c) => String(c.id) === catParam) ?? null : null

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
    setParams(next)
    setQ('')
  }
  const openPage = (p: WikiPageRow) => navigate(`/wiki/${p.id}`)
  const newPage = () => navigate(openCat && openCat.id ? `/wiki/new?cartella=${openCat.id}` : '/wiki/new')

  const term = q.trim()
  const search = (
    <label className="search w-search w-e-search">
      <CampoIcon name="search" size={16} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={openCat ? `Cerca in ${openCat.name}…` : 'Cerca in tutta la Wiki: titolo, testo, tag…'} aria-label="Cerca nella Wiki" />
    </label>
  )
  const sortSeg = (
    <div className="seg" role="group" aria-label="Ordina">
      {SORTS.map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
    </div>
  )
  const viewSwitch = (
    <div className="seg w-e-view" role="group" aria-label="Vista">
      <button type="button" aria-pressed={view === 'folders'} onClick={() => go({ vista: null })}><CampoIcon name="folder" size={14} />Cartelle</button>
      <button type="button" aria-pressed={view === 'all'} onClick={() => go({ vista: 'tutte' })}><CampoIcon name="columns" size={14} />Tutte le pagine</button>
    </div>
  )

  let body: React.ReactNode
  if (!pages) {
    body = <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={24} /></Box>
  } else if (openCat) {
    const inCat = all.filter((p) => (p.category ?? 0) === openCat.id)
    const list = inCat.filter((p) => !term || matchesPage(p, term)).sort(sortFn[sort])
    body = (
      <>
        <nav className="w-crumbs" aria-label="Percorso"><a href="/wiki" onClick={(e) => { e.preventDefault(); go({ cartella: null }) }}><CampoIcon name="chevL" size={14} />Archivio</a></nav>
        <OpenFolder color={catColor(openCat, dark)} label={openCat.name}
          tabs={<FolderTabs cats={folders} active={openCat.id} counts={counts} mode="nav" onPick={(id) => go({ cartella: String(id) })} />}>
          <div className="w-open-h">
            {openCat.description ? <p>{openCat.description}</p> : null}
            <div className="w-open-tools">{search}{sortSeg}</div>
          </div>
          {list.length ? (
            <ul className="w-papers">
              {list.map((p, i) => (
                <li key={p.id} style={{ ['--r' as string]: `${TILT[i % TILT.length]}deg` }}>
                  <a href={`/wiki/${p.id}`} className="w-paper" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPage(p) }}>
                    <span className="w-paper-top">
                      {p.kb_code ? <span className="w-mono-s">{p.kb_code}</span> : null}
                      {!p.is_published ? <span className="w-draft">Bozza</span> : null}
                      {p.is_favorite ? <span className="w-paper-fav" title="Nei preferiti"><StarIcon size={14} /></span> : null}
                    </span>
                    <span className="w-paper-t"><Mark text={p.title} term={term} /></span>
                    <span className="w-paper-s">{term ? <Mark text={snippetOf(p, term)} term={term} /> : p.summary}</span>
                    <span className="w-paper-f">
                      <span>{rel(p.updated_at)}{p.updated_by_username ? ` · ${p.updated_by_username}` : ''}</span>
                      <span><CampoIcon name="eye" size={13} />{p.view_count ?? 0}{p.rating_count ? <> <StarIcon />{r1(p.average_rating)}</> : null}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="w-d-none"><CampoIcon name="search" size={18} /><div><b>Nessuna pagina{term ? ` per «${term}»` : ''}</b>
              {canAdd ? <p><button type="button" className="link-btn" onClick={newPage}>Crea una pagina in {openCat.name}</button></p> : null}</div></div>
          )}
        </OpenFolder>
      </>
    )
  } else if (view === 'all' || term) {
    const list = all.filter((p) => !term || matchesPage(p, term)).sort(term ? sortFn.upd : sortFn[sort])
    body = (
      <>
        <div className="w-d-tools">{viewSwitch}{search}{view === 'all' ? sortSeg : null}</div>
        {term ? <div className="w-d-count">{list.length} {list.length === 1 ? 'pagina' : 'pagine'} per «{term}»</div> : null}
        {list.length ? <ul className="w-cards">{list.map((p) => <PageCard key={p.id} p={p} cat={catOf(p)} term={term} onOpen={() => openPage(p)} />)}</ul>
          : <div className="w-d-none"><CampoIcon name="search" size={18} /><div><b>Nessuna pagina{term ? ` per «${term}»` : ''}</b><p>Prova con un AE title, il nome del cliente o del sistema.</p></div></div>}
      </>
    )
  } else {
    const newest = [...all].filter((p) => p.is_published).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6)
    const favs = all.filter((p) => p.is_favorite).sort((a, b) => String(b.favorited_at).localeCompare(String(a.favorited_at)))
    const recent = [...all].filter((p) => p.is_published).sort(sortFn.upd).slice(0, 6)
    const drafts = all.filter((p) => !p.is_published && me && p.created_by === me.id)
    body = (
      <>
        <div className="w-d-tools">{viewSwitch}{search}</div>
        {folders.length ? (
          <ul className="w-folders" aria-label="Cartelle">
            {folders.map((c) => {
              const ps = all.filter((p) => (p.category ?? 0) === c.id)
              const top = [...ps].filter((p) => p.is_published).sort(sortFn.views).slice(0, 3)
              const last = [...ps].sort(sortFn.upd)[0]
              return (
                <li key={c.id}>
                  <button type="button" className="w-fold-btn" onClick={() => go({ cartella: String(c.id) })} aria-label={`Apri la cartella ${c.name}, ${ps.length} pagine`}>
                    <span className="w-fold" style={cVars(catColor(c, dark))}>
                      <span className="w-fold-tab"><span>{ps.length} {ps.length === 1 ? 'pagina' : 'pagine'}</span></span>
                      <span className="w-fold-back" />
                      <span className="w-fold-sheets" aria-hidden>{top.map((p, i) => <span key={p.id} className={`w-sheet s${i}`}><b>{p.title}</b><i /><i /></span>)}</span>
                      <span className="w-fold-front">
                        <span className="w-fold-ico"><CampoIcon name={catIcon(c.name)} size={17} /></span>
                        <span className="w-fold-name">{c.name}</span>
                        {c.description ? <span className="w-fold-desc">{c.description}</span> : null}
                        <span className="w-fold-foot">{last ? `aggiornata ${rel(last.updated_at)}` : 'ancora vuota'}</span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="w-d-none"><CampoIcon name="folder" size={18} /><div><b>Nessuna cartella</b><p>{canManageCategories ? <button type="button" className="link-btn" onClick={() => setCatManagerOpen(true)}>Crea la prima cartella</button> : 'Chiedi a un amministratore di creare le cartelle.'}</p></div></div>
        )}

        {newest.length ? (
          <section className="w-e-sec w-sec-new" aria-labelledby="h-new">
            <header><h2 id="h-new">Ultime create</h2><span>le schede appena entrate in archivio</span></header>
            <ul className="w-idx">
              {newest.map((p, i) => {
                const c = catOf(p) ?? NO_CAT
                return (
                  <li key={p.id} style={{ ...cVars(catColor(c, dark)), ['--r' as string]: `${IDX_TILT[i]}deg` }}>
                    <a href={`/wiki/${p.id}`} className="w-idx-card" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPage(p) }}>
                      <span className="w-idx-tab">{c.name}</span>
                      {p.kb_code ? <span className="w-idx-kb">{p.kb_code}</span> : null}
                      <span className="w-idx-t">{p.title}</span>
                      <span className="w-idx-f"><span className="w-stamp">{dshort(p.created_at)}</span>{p.created_by_username}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <div className="w-e-grid">
          <section className="w-e-sec w-sec-shelf" aria-labelledby="h-fav">
            <header><h2 id="h-fav"><StarIcon size={16} />I tuoi preferiti</h2><span>{favs.length ? `${favs.length} sullo scaffale` : ''}</span></header>
            <div className="w-shelf-wood">
              <ul className="w-books">
                {favs.map((p, i) => (
                  <li key={p.id}>
                    <a href={`/wiki/${p.id}`} className="w-book" title={p.title} style={{ ...cVars(catColor(catOf(p), dark)), ['--h' as string]: `${BOOK_H[i % BOOK_H.length]}px` }}
                      onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPage(p) }}>
                      <span className="w-book-band" /><span className="w-book-t">{p.title}</span><span className="w-book-kb">{p.kb_code?.slice(-3)}</span>
                    </a>
                  </li>
                ))}
                <li><span className="w-book is-ghost" style={{ ['--h' as string]: '170px' }}><span className="w-book-t">{favs.length ? 'Stella in un articolo per aggiungerne altri' : 'Premi la stella in un articolo per metterlo qui'}</span></span></li>
              </ul>
            </div>
          </section>

          <section className="w-e-sec w-sec-ledger" aria-labelledby="h-rec">
            <header><h2 id="h-rec">Registro delle modifiche</h2><span>aggiornate di recente</span></header>
            {recent.length ? (
              <ol className="w-ledger">
                {recent.map((p) => {
                  const d = p.updated_at ? new Date(p.updated_at) : null
                  const c = catOf(p) ?? NO_CAT
                  return (
                    <li key={p.id}>
                      <span className="w-led-d"><b>{d ? d.getDate() : ''}</b><small>{d ? d.toLocaleDateString('it-IT', { month: 'short' }) : ''}</small></span>
                      <a href={`/wiki/${p.id}`} className="w-led-e" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPage(p) }}>
                        <span className="w-led-t">{p.title}</span>
                        <span className="w-led-m"><span className="w-sw" style={cVars(catColor(c, dark))} />{c.name}{p.updated_by_username ? ` · ${p.updated_by_username}` : ''}</span>
                      </a>
                    </li>
                  )
                })}
              </ol>
            ) : <p className="w-rail-none">Ancora nessuna pagina.</p>}
          </section>

          <section className="w-e-sec w-sec-notes" aria-labelledby="h-dr">
            <header><h2 id="h-dr">Le tue bozze</h2><span>{drafts.length ? 'da finire e pubblicare' : ''}</span></header>
            <ul className="w-notes">
              {drafts.map((p, i) => (
                <li key={p.id} style={{ ['--r' as string]: `${i % 2 ? 1.6 : -1.8}deg` }}>
                  <a href={`/wiki/${p.id}`} className="w-note-p" onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPage(p) }}>
                    <span className="w-tape" /><b>{p.title}</b><small>modificata {rel(p.updated_at)}</small>
                  </a>
                </li>
              ))}
              {canAdd ? <li style={{ ['--r' as string]: '.8deg' }}><button type="button" className="w-note-p is-new" onClick={newPage}><CampoIcon name="plus" size={20} /><b>Nuova bozza</b></button></li> : null}
            </ul>
            {!drafts.length && !canAdd ? <p className="w-rail-none">Nessuna bozza.</p> : null}
          </section>
        </div>
      </>
    )
  }

  return (
    <Box>
      <WikiHead
        section="pages"
        canQueries={hasPerm(PERMS.wiki.query.view)}
        actions={
          <>
            {canManageCategories ? <Button color="inherit" startIcon={<CampoIcon name="folder" size={16} />} onClick={() => setCatManagerOpen(true)}>Cartelle</Button> : null}
            {canAdd ? <HeadAction label="Nuova pagina" onClick={newPage} /> : null}
          </>
        }
      />
      <ArchiveRoot>{body}</ArchiveRoot>
      {pages && !all.length ? <Typography sx={{ mt: 2, fontSize: 13, color: 'text.secondary' }}>La Wiki è vuota: crea la prima pagina.</Typography> : null}
      {canManageCategories ? (
        <WikiCategoryManager open={catManagerOpen} onClose={() => setCatManagerOpen(false)} onChanged={() => setReloadKey((k) => k + 1)} />
      ) : null}
    </Box>
  )
}
