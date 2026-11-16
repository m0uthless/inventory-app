import * as React from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField,
} from '@mui/material'
import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../auth/AuthProvider'
import { CampoIcon } from '../ui/campo'
import { ArchiveRoot, HeadAction, Mark, OpenFolder, WikiHead } from '../features/wiki/archive/archiveUi'
import { cVars, rel } from '../features/wiki/archive/archiveModel'

type Language = {
  id: number
  key: string
  label: string
  color: string
  text_color: string
  sort_order: number
  is_active: boolean
}

type QueryRow = {
  id: number
  title: string
  language: number | null
  language_key: string | null
  language_label: string | null
  language_color: string | null
  language_text_color: string | null
  body: string
  description?: string | null
  tags?: string[] | null
  use_count: number
  created_by_username?: string | null
  updated_by_username?: string | null
  updated_at?: string | null
}

type ApiPage<T> = { count: number; results: T[] }


type FormState = { title: string; language: number | ''; body: string; description: string; tags: string }
const EMPTY_FORM: FormState = { title: '', language: '', body: '', description: '', tags: '' }

function QueryFormDialog({ open, initial, languages, onClose, onSaved }: {
  open: boolean; initial?: QueryRow | null; languages: Language[]; onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({})
  const isEdit = !!initial

  React.useEffect(() => {
    if (open) {
      if (initial) {
        setForm({ title: initial.title, language: initial.language ?? '', body: initial.body, description: initial.description ?? '', tags: (initial.tags ?? []).join(', ') })
      } else {
        const first = languages.find((l) => l.is_active)
        setForm({ ...EMPTY_FORM, language: first?.id ?? '' })
      }
      setErrors({})
    }
  }, [open, initial, languages])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const validate = () => {
    const errs: typeof errors = {}
    if (!form.title.trim()) errs.title = 'Titolo obbligatorio'
    if (!form.body.trim()) errs.body = 'Query obbligatoria'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setBusy(true)
    try {
      const payload = {
        title: form.title.trim(),
        language: form.language !== '' ? form.language : null,
        body: form.body,
        description: form.description.trim() || null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      if (isEdit) {
        await api.patch(`/wiki-queries/${initial!.id}/`, payload)
        toast.success('Query aggiornata')
      } else {
        await api.post('/wiki-queries/', payload)
        toast.success('Query creata')
      }
      onSaved(); onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>{isEdit ? 'Modifica query' : 'Nuova query'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField label="Titolo" value={form.title} onChange={set('title')} error={!!errors.title} helperText={errors.title} size="small" fullWidth autoFocus />
            <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
              <InputLabel>Linguaggio</InputLabel>
              <Select label="Linguaggio" value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as number | '' }))}>
                <MenuItem value="">— nessuno —</MenuItem>
                {languages.filter((l) => l.is_active).map((l) => <MenuItem key={l.id} value={l.id}>{l.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <TextField
            label="Query" value={form.body} onChange={set('body')} error={!!errors.body} helperText={errors.body}
            multiline minRows={6} maxRows={20} size="small" fullWidth
            inputProps={{ style: { fontFamily: 'ui-monospace,"Cascadia Code","Fira Code","Courier New",monospace', fontSize: '0.825rem', lineHeight: 1.65 } }}
          />
          <TextField label="Descrizione (opzionale)" value={form.description} onChange={set('description')} multiline minRows={2} maxRows={5} size="small" fullWidth />
          <TextField label="Tag (separati da virgola)" value={form.tags} onChange={set('tags')} size="small" fullWidth placeholder="es. clienti, audit, ris" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Annulla</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : isEdit ? 'Salva' : 'Crea'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}


// Copia negli appunti: Clipboard API (HTTPS/localhost) con ripiego su execCommand (HTTP, iframe).
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true } catch { /* ripiego sotto */ }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(ta); ta.focus(); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

// Evidenziazione leggera: commenti, testi tra apici, parole chiave più comuni.
const KW = /\b(SELECT|FROM|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|WHERE|GROUP|BY|ORDER|HAVING|AS|IS|NULL|IN|LIKE|BETWEEN|COUNT|MIN|MAX|SUM|AVG|DISTINCT|DESC|ASC|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CASE|WHEN|THEN|ELSE|END|UNION|ALL|LIMIT|TOP|WITH|import|from|def|return|for|in|if|else|function|param|foreach)\b/g
function CodeLine({ line }: { line: string }) {
  if (/^\s*(--|#|\/\/|REM\b)/i.test(line)) return <span className="w-cm">{line}</span>
  const parts: React.ReactNode[] = []
  const re = /('[^']*'|"[^"]*")/g
  let last = 0; let m: RegExpExecArray | null; let k = 0
  const pushCode = (txt: string) => {
    let l2 = 0; let m2: RegExpExecArray | null
    KW.lastIndex = 0
    while ((m2 = KW.exec(txt))) { parts.push(txt.slice(l2, m2.index)); parts.push(<b key={`k${k++}`}>{m2[0]}</b>); l2 = m2.index + m2[0].length }
    parts.push(txt.slice(l2))
  }
  while ((m = re.exec(line))) { pushCode(line.slice(last, m.index)); parts.push(<span key={`s${k++}`} className="w-str">{m[0]}</span>); last = m.index + m[0].length }
  pushCode(line.slice(last))
  return <>{parts}</>
}

type Sort = 'uses' | 'upd' | 'title'
const SORTS: [Sort, string][] = [['uses', 'Più usate'], ['upd', 'Aggiornate'], ['title', 'A–Z']]
const NEUTRAL = '#5b6b67'
const TILT = [-0.5, 0.4, -0.2, 0.6]
const okHex = (c?: string | null) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : NEUTRAL)

/** Query della Wiki come schedario: linguette per linguaggio, schede a sinistra, la query scelta su un foglio. */
export default function WikiQueries() {
  const toast = useToast()
  const { hasPerm } = useAuth()
  const canAdd = hasPerm('wiki.add_wikiquery')
  const canChange = hasPerm('wiki.change_wikiquery')
  const canDelete = hasPerm('wiki.delete_wikiquery')

  const [queries, setQueries] = React.useState<QueryRow[] | null>(null)
  const [languages, setLanguages] = React.useState<Language[]>([])
  const [lang, setLang] = React.useState<number | 'all' | 'none'>('all')
  const [q, setQ] = React.useState('')
  const [sort, setSort] = React.useState<Sort>('uses')
  const [selId, setSelId] = React.useState<number | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<QueryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<QueryRow | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const [l, r] = await Promise.all([
        api.get<Language[] | ApiPage<Language>>('/wiki-query-languages/'),
        api.get<ApiPage<QueryRow>>('/wiki-queries/', { params: { page_size: 500, ordering: 'title' } }),
      ])
      setLanguages(Array.isArray(l.data) ? l.data : l.data.results ?? [])
      setQueries(r.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      setQueries([])
    }
  }, [toast])
  React.useEffect(() => { void load() }, [load])

  const all = React.useMemo(() => queries ?? [], [queries])
  const tabs = React.useMemo(() => {
    const used = languages.filter((l) => l.is_active || all.some((x) => x.language === l.id))
    const t: { key: number | 'all' | 'none'; label: string; color: string; n: number }[] = [
      { key: 'all', label: 'Tutte', color: NEUTRAL, n: all.length },
      ...used.map((l) => ({ key: l.id, label: l.label, color: okHex(l.color), n: all.filter((x) => x.language === l.id).length })),
    ]
    const none = all.filter((x) => x.language == null).length
    if (none) t.push({ key: 'none', label: 'Senza linguaggio', color: NEUTRAL, n: none })
    return t
  }, [languages, all])
  const term = q.trim().toLowerCase()
  const list = all
    .filter((x) => (lang === 'all' ? true : lang === 'none' ? x.language == null : x.language === lang))
    .filter((x) => !term || [x.title, x.description, x.body, (x.tags ?? []).join(' ')].join(' ').toLowerCase().includes(term))
    .sort(sort === 'uses' ? (a, b) => b.use_count - a.use_count : sort === 'upd' ? (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) : (a, b) => a.title.localeCompare(b.title, 'it'))
  const sel = list.find((x) => x.id === selId) ?? list[0] ?? null
  const active = tabs.find((t) => t.key === lang) ?? tabs[0]

  const doCopy = async (x: QueryRow) => {
    if (!(await copyText(x.body))) { toast.error('Impossibile copiare negli appunti'); return }
    api.post(`/wiki-queries/${x.id}/use/`).catch(() => {})
    setQueries((prev) => prev?.map((y) => (y.id === x.id ? { ...y, use_count: y.use_count + 1 } : y)) ?? prev)
    toast.success(`Query copiata · usata ${x.use_count + 1} volte`)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await api.delete(`/wiki-queries/${deleteTarget.id}/`)
      toast.success('Query eliminata')
      setDeleteTarget(null)
      void load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  const colorOf = (x: QueryRow) => okHex(x.language_color)
  const lines = sel ? sel.body.split('\n') : []

  return (
    <Box>
      <WikiHead section="queries" actions={canAdd ? <HeadAction label="Nuova query" onClick={() => { setEditTarget(null); setFormOpen(true) }} /> : undefined} />
      <ArchiveRoot>
        {!queries ? <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={24} /></Box> : (
          <OpenFolder className="w-qfold" color={active.color} label="Schedario delle query"
            tabs={
              <div className="w-open-tabs" role="tablist" aria-label="Linguaggi">
                {tabs.map((t) => t.key === active.key ? (
                  <div key={String(t.key)} className="w-open-tab" role="tab" aria-selected="true" style={cVars(t.color)}>
                    <span className="w-fold-ico"><CampoIcon name={t.key === 'all' ? 'folder' : 'columns'} size={17} /></span><h2>{t.label}</h2><small>{t.n} query</small>
                  </div>
                ) : (
                  <button key={String(t.key)} type="button" role="tab" aria-selected="false" className="w-side-tab" style={cVars(t.color)} onClick={() => { setLang(t.key); setSelId(null) }}>
                    <span>{t.label}</span><small className="w-tab-n">{t.n}</small>
                  </button>
                ))}
              </div>
            }>
            <div className="w-open-tools">
              <label className="search w-search"><CampoIcon name="search" size={16} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca titolo, descrizione, testo della query…" aria-label="Cerca nelle query" />
              </label>
              <div className="seg" role="group" aria-label="Ordina">{SORTS.map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}</div>
            </div>
            {!list.length ? (
              <div className="w-d-none"><CampoIcon name="search" size={18} /><div><b>{all.length ? `Nessuna query${q ? ` per «${q}»` : ''}` : 'Ancora nessuna query'}</b>
                {canAdd ? <p><button type="button" className="link-btn" onClick={() => { setEditTarget(null); setFormOpen(true) }}>Aggiungine una</button></p> : null}</div></div>
            ) : (
              <div className="w-q">
                <ul className="w-qlist">
                  {list.map((x, i) => (
                    <li key={x.id} style={{ ...cVars(colorOf(x)), ['--r' as string]: `${TILT[i % TILT.length]}deg` }}>
                      <button type="button" className={`w-qcard${sel?.id === x.id ? ' is-on' : ''}`} aria-pressed={sel?.id === x.id} onClick={() => setSelId(x.id)}>
                        <span className="w-qcard-tab">{x.language_label ?? 'Senza linguaggio'}</span>
                        <span className="w-qcard-t"><Mark text={x.title} term={q} /></span>
                        {x.description ? <span className="w-qcard-d">{x.description}</span> : null}
                        <span className="w-qcard-f">
                          <span className="w-uses" title="Volte che è stata copiata"><CampoIcon name="copy" size={13} />{x.use_count}</span>
                          {(x.tags ?? []).slice(0, 3).map((t) => <span key={t} className="w-tag">{t}</span>)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {sel ? (
                  <article className="w-qdoc" style={cVars(colorOf(sel))} aria-label={sel.title}>
                    <header className="w-qdoc-h">
                      <span className="w-lang">{sel.language_label ?? 'Senza linguaggio'}</span>
                      <h2>{sel.title}</h2>
                      {sel.description ? <p>{sel.description}</p> : null}
                      <div className="w-qdoc-m">
                        <span>{sel.updated_by_username ?? sel.created_by_username ?? ''}{sel.updated_at ? ` · aggiornata ${rel(sel.updated_at)}` : ''}</span>
                        <span className="w-uses-big"><b>{sel.use_count}</b> volte copiata</span>
                      </div>
                    </header>
                    <div className="w-qcode">
                      <div className="w-qcode-bar"><span>{lines.length} {lines.length === 1 ? 'riga' : 'righe'}</span>
                        <Button size="small" variant="contained" startIcon={<CampoIcon name="copy" size={14} />} onClick={() => void doCopy(sel)} sx={{ ml: 'auto' }}>Copia la query</Button>
                      </div>
                      <pre><code>{lines.map((ln, i) => <span key={i} className="w-ln"><i>{i + 1}</i><CodeLine line={ln} /></span>)}</code></pre>
                    </div>
                    <footer className="w-qdoc-f">
                      {(sel.tags ?? []).map((t) => <span key={t} className="w-tag">{t}</span>)}
                      <span className="g-spacer" />
                      {canDelete ? <Button size="small" color="inherit" startIcon={<CampoIcon name="trash" size={14} />} onClick={() => setDeleteTarget(sel)}>Elimina</Button> : null}
                      {canChange ? <Button size="small" variant="outlined" color="inherit" startIcon={<CampoIcon name="wrench" size={14} />} onClick={() => { setEditTarget(sel); setFormOpen(true) }}>Modifica</Button> : null}
                    </footer>
                  </article>
                ) : null}
              </div>
            )}
          </OpenFolder>
        )}
      </ArchiveRoot>

      <QueryFormDialog open={formOpen} initial={editTarget} languages={languages} onClose={() => setFormOpen(false)} onSaved={() => void load()} />
      <ConfirmDeleteDialog
        open={!!deleteTarget} busy={deleteBusy} title="Elimina query"
        description={deleteTarget ? `Stai per eliminare "${deleteTarget.title}". L'operazione non è reversibile.` : ''}
        onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
      />
    </Box>
  )
}
