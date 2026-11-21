/**
 * WikiPage — /wiki/:id e /wiki/new
 *
 * - Editor rich text (Quill) con upload immagini via allegati
 * - Clienti collegati (solo Customer, dropdown reale)
 * - Allegati con upload
 * - Tabs: Contenuto / Clienti collegati / Allegati
 */
import * as React from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RichEditor, { type QuillInstance } from '../ui/RichEditor'
import { type WikiLink } from '../features/wiki/WikiLinkedCustomersTab'
import { type WikiAttachment } from '../features/wiki/WikiAttachmentsTab'
import WikiRevisionsTab, { type WikiRevision } from '../features/wiki/WikiRevisionsTab'
import { useWidgetAccents } from '../theme/AppThemeProvider'
import { useTheme, alpha } from '@mui/material/styles'
import { CampoIcon } from '../ui/campo'
import { ArchiveRoot, FolderTabs, OpenFolder, StarIcon } from '../features/wiki/archive/archiveUi'
import { AttachmentsCard, LinksCard, ProseContent, TocList, type TocItem } from '../features/wiki/archive/ArticleParts'
import { NO_CAT, catColor, dshort, r1, rel, type WikiCategory } from '../features/wiki/archive/archiveModel'
import { fetchAll } from '../api/fetchAll'

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = WikiCategory

type Customer = { id: number; name: string }

type PageDetail = {
  id: number
  kb_code?: string | null
  title: string
  slug: string
  category?: number | null
  category_name?: string | null
  summary?: string | null
  tags?: string[] | null
  content_markdown: string
  is_published: boolean
  view_count?: number
  average_rating?: number | null
  rating_count?: number
  current_user_rating?: number | null
  is_favorite?: boolean
  pdf_template_key?: string
  created_by_username?: string | null
  updated_by_username?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type ApiPage<T> = { count: number; results: T[] }

// ── Helpers ───────────────────────────────────────────────────────────────────




function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function slugifyWikiTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ── WikiLinkDialog — cerca pagine wiki e inserisce link ───────────────────────

type PageRow = { id: number; kb_code?: string | null; title: string; slug: string }

function WikiLinkDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (page: PageRow) => void
}) {
  const [q, setQ] = React.useState('')
  const [results, setResults] = React.useState<PageRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const widgetAccents = useWidgetAccents()
  const theme = useTheme()

  React.useEffect(() => {
    if (!open) {
      setQ('')
      setResults([])
      return
    }
  }, [open])

  React.useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get<ApiPage<PageRow>>('/wiki-pages/', {
          params: { search: q, is_published: true, page_size: 10, ordering: 'title' },
        })
        setResults(res.data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={700}>Inserisci link a pagina Wiki</Typography>
        <Typography variant="caption" color="text.secondary">
          Cerca per titolo, codice KB o contenuto
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Cerca pagina…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ mb: 1.5 }}
        />
        {loading && <LinearProgress sx={{ borderRadius: 1, mb: 1 }} />}
        <Stack spacing={0.5}>
          {results.map((p) => (
            <Box
              key={p.id}
              onClick={() => {
                onSelect(p)
                onClose()
              }}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: 'pointer',
                border: '1px solid transparent',
                '&:hover': { bgcolor: widgetAccents.softTealBg, borderColor: alpha(theme.palette.primary.main, 0.25) },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {p.kb_code && (
                <Typography
                  variant="caption"
                  fontFamily="monospace"
                  fontWeight={800}
                  color="primary.main"
                  sx={{ flexShrink: 0 }}
                >
                  {p.kb_code}
                </Typography>
              )}
              <Typography variant="body2" fontWeight={500}>
                {p.title}
              </Typography>
            </Box>
          ))}
          {q.trim() && !loading && results.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
              Nessuna pagina trovata
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── AddCustomerDialog ─────────────────────────────────────────────────────────

function AddCustomerDialog({
  open,
  pageId,
  existingIds,
  onClose,
  onAdded,
}: {
  open: boolean
  pageId: number
  existingIds: number[]
  onClose: () => void
  onAdded: () => void
}) {
  const toast = useToast()
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [customerId, setCustomerId] = React.useState<string>('')
  const [notes, setNotes] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    fetchAll<Customer>('/customers/', { ordering: 'name' })
      .then(setCustomers)
      .catch(() => {})
  }, [open])

  const available = customers.filter((c) => !existingIds.includes(c.id))

  const handleSave = async () => {
    if (!customerId) {
      toast.error('Seleziona un cliente')
      return
    }
    setBusy(true)
    try {
      await api.post('/wiki-links/', {
        page: pageId,
        entity_type: 'customer',
        entity_id: Number(customerId),
        notes: notes || null,
      })
      toast.success('Cliente collegato')
      setCustomerId('')
      setNotes('')
      onAdded()
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Collega cliente</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Cliente</InputLabel>
            <Select
              label="Cliente"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <MenuItem value="">— Seleziona —</MenuItem>
              {available.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Note (opzionale)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="contained" onClick={handleSave} disabled={busy || !customerId}>
          {busy ? <CircularProgress size={16} /> : 'Collega'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Template di default per nuove pagine ─────────────────────────────────────

const DEFAULT_TEMPLATE = `<h1>Titolo della pagina</h1>
<h2>Descrizione</h2>
<p>Inserisci una descrizione sintetica dello scopo e del contenuto di questa pagina.</p>
<h2>Procedura</h2>
<ol>
<li><p>Primo step</p></li>
<li><p>Secondo step</p></li>
<li><p>Terzo step</p></li>
</ol>
`

// ── Main component ────────────────────────────────────────────────────────────

type Mode = 'view' | 'edit'

export default function WikiPage() {
  const catDark = useTheme().palette.mode === 'dark'
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const toast = useToast()

  const [mode, setMode] = React.useState<Mode>('view')
  const [detail, setDetail] = React.useState<PageDetail | null>(null)
  const [renderHtml, setRenderHtml] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [delDlgOpen, setDelDlgOpen] = React.useState(false)
  const [delBusy, setDelBusy] = React.useState(false)

  const [categories, setCategories] = React.useState<Category[]>([])
  const [links, setLinks] = React.useState<WikiLink[]>([])
  const [attachments, setAttachments] = React.useState<WikiAttachment[]>([])
  const [revisions, setRevisions] = React.useState<WikiRevision[]>([])
  const [restoring, setRestoring] = React.useState<number | null>(null)
  const [previewRev, setPreviewRev] = React.useState<WikiRevision | null>(null)
  const [previewRevHtml, setPreviewRevHtml] = React.useState('')
  const [previewRevLoading, setPreviewRevLoading] = React.useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = React.useState(false)
  const [wikiLinkOpen, setWikiLinkOpen] = React.useState(false)
  const quillInstanceRef = React.useRef<QuillInstance | null>(null)
  const [attachUploading, setAttachUploading] = React.useState(false)
  const [ratingBusy, setRatingBusy] = React.useState(false)

  const [revsOpen, setRevsOpen] = React.useState(false)
  const [toc, setToc] = React.useState<TocItem[]>([])
  const { hasPerm } = useAuth()
  const [searchParams] = useSearchParams()
  const attachInputRef = React.useRef<HTMLInputElement>(null)

  // form state
  const [form, setForm] = React.useState({
    title: '',
    slug: '',
    category: (isNew && Number(searchParams.get('cartella')) > 0 ? Number(searchParams.get('cartella')) : '') as number | '',
    summary: '',
    content_html: DEFAULT_TEMPLATE,
    is_published: true,
    tags: '',
  })

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadDetail = React.useCallback(
    async (pid: number) => {
      setLoading(true)
      try {
        const d = await api.get<PageDetail>(`/wiki-pages/${pid}/`)
        setDetail(d.data)
        const content = d.data.content_markdown || ''
        try {
          const r = await api.get<{ html: string }>(`/wiki-pages/${pid}/render/`)
          setRenderHtml(r.data?.html ?? '')
        } catch {
          setRenderHtml(`<pre>${escapeHtml(content)}</pre>`)
        }
        setForm({
          title: d.data.title,
          slug: d.data.slug,
          category: d.data.category ?? '',
          summary: d.data.summary ?? '',
          content_html: d.data.content_markdown,
          is_published: d.data.is_published,
          tags: (d.data.tags ?? []).join(', '),
        })
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  const loadLinks = React.useCallback(async (pid: number) => {
    try {
      const res = await api.get<ApiPage<WikiLink>>('/wiki-links/', {
        params: { page_id: pid, page_size: 100 },
      })
      const filtered = (res.data.results ?? []).filter((l) => l.entity_type === 'customer')
      setLinks(filtered)
    } catch {
      /* non bloccante */
    }
  }, [])

  const loadAttachments = React.useCallback(async (pid: number) => {
    try {
      const res = await api.get<ApiPage<WikiAttachment>>('/wiki-attachments/', {
        params: { page_id: pid, page_size: 100 },
      })
      setAttachments(res.data.results ?? [])
    } catch {
      /* non bloccante */
    }
  }, [])

  const loadRevisions = React.useCallback(async (pid: number) => {
    try {
      const res = await api.get<ApiPage<WikiRevision>>('/wiki-revisions/', {
        params: { page_id: pid, page_size: 50, ordering: '-revision_number' },
      })
      setRevisions(res.data.results ?? [])
    } catch {
      /* non bloccante */
    }
  }, [])

  const loadCategories = React.useCallback(async () => {
    try {
      const res = await api.get<ApiPage<Category>>('/wiki-categories/', {
        params: { ordering: 'sort_order,name', page_size: 200 },
      })
      setCategories(res.data.results ?? [])
    } catch {
      /* non bloccante */
    }
  }, [])

  React.useEffect(() => {
    loadCategories()
    if (isNew) {
      setMode('edit')
      setLoading(false)
    } else if (id) {
      setMode('view')
      setLoading(true)
      const pid = parseInt(id, 10)
      loadDetail(pid)
      loadLinks(pid)
      loadAttachments(pid)
      loadRevisions(pid)
      // Incrementa contatore visualizzazioni (fire & forget)
      api.post(`/wiki-pages/${pid}/view/`).catch(() => {})
    }
  }, [id, isNew, loadDetail, loadLinks, loadAttachments, loadRevisions, loadCategories])

  // ── Auto-slug da titolo (solo new) ───────────────────────────────────────

  React.useEffect(() => {
    if (!isNew) return
    const slug = slugifyWikiTitle(form.title)
    setForm((f) => ({ ...f, slug }))
  }, [form.title, isNew])

  // ── Autosave localStorage ────────────────────────────────────────────────

  // Per una pagina nuova non esiste ancora un id reale: usare solo 'new' come
  // chiave la condividerebbe tra tutte le tab con una pagina nuova aperta,
  // facendo sovrascrivere silenziosamente la bozza dell'una con quella
  // dell'altra. sessionStorage è isolato per tab (sopravvive al refresh della
  // stessa tab ma non è condiviso con altre tab/finestre), quindi lo usiamo
  // per generare e ricordare un id di istanza stabile solo per questa tab.
  const newPageInstanceId = React.useRef<string>('')
  if (isNew && !newPageInstanceId.current) {
    try {
      const existing = sessionStorage.getItem('wiki_autosave_new_instance_id')
      if (existing) {
        newPageInstanceId.current = existing
      } else {
        const generated =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`
        sessionStorage.setItem('wiki_autosave_new_instance_id', generated)
        newPageInstanceId.current = generated
      }
    } catch {
      // sessionStorage non disponibile: fallback a un id non persistito,
      // la bozza non sopravvive a un refresh ma non collide con altre tab
      newPageInstanceId.current = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
  }

  const AUTOSAVE_KEY = isNew
    ? `wiki_autosave_new_${newPageInstanceId.current}`
    : `wiki_autosave_${id}`

  // Ripristina bozza all'apertura (solo in edit mode)
  React.useEffect(() => {
    if (!isNew) return
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setForm((f) => ({ ...f, ...parsed }))
        toast.info('Bozza ripristinata dal salvataggio automatico')
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salva bozza ad ogni modifica (debounced 2s)
  React.useEffect(() => {
    if (!isNew && mode !== 'edit') return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            title: form.title,
            slug: form.slug,
            summary: form.summary,
            content_html: form.content_html,
            tags: form.tags,
          }),
        )
      } catch {
        /* ignore */
      }
    }, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.slug, form.summary, form.content_html, form.tags, isNew, mode])

  // ── Image upload (Quill) ─────────────────────────────────────────────────

  const handleImageUpload = React.useCallback(
    async (file: File): Promise<string> => {
      if (!id || isNew) {
        toast.error('Salva prima la pagina per caricare immagini')
        throw new Error('page not saved')
      }
      const formData = new FormData()
      formData.append('page', id)
      formData.append('file', file)
      try {
        const res = await api.post<WikiAttachment>('/wiki-attachments/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        // refresh attachments list
        loadAttachments(parseInt(id, 10))
        return res.data.preview_url ?? res.data.file_url ?? ''
      } catch (e) {
        toast.error(apiErrorToMessage(e))
        throw e
      }
    },
    [id, isNew, toast, loadAttachments],
  )

  // ── Generic attachment upload ────────────────────────────────────────────

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setAttachUploading(true)
    const formData = new FormData()
    formData.append('page', id)
    formData.append('file', file)
    try {
      await api.post('/wiki-attachments/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Allegato caricato')
      loadAttachments(parseInt(id, 10))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setAttachUploading(false)
      if (attachInputRef.current) attachInputRef.current.value = ''
    }
  }

  const handleRatePage = React.useCallback(
    async (value: number | null) => {
      if (!id || isNew || !value || ratingBusy || detail?.current_user_rating) return
      setRatingBusy(true)
      try {
        const res = await api.post<PageDetail>(`/wiki-pages/${id}/rate/`, { rating: value })
        setDetail(res.data)
        toast.success('Voto registrato')
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setRatingBusy(false)
      }
    },
    [id, isNew, ratingBusy, detail?.current_user_rating, toast],
  )

  const handleOpenRevisionPreview = React.useCallback(
    async (rev: WikiRevision) => {
      setPreviewRev(rev)
      setPreviewRevLoading(true)
      try {
        const res = await api.get<{ html: string }>(`/wiki-revisions/${rev.id}/render/`)
        setPreviewRevHtml(res.data?.html ?? '')
      } catch {
        setPreviewRevHtml(
          `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px">${escapeHtml(rev.content_markdown)}</pre>`,
        )
      } finally {
        setPreviewRevLoading(false)
      }
    },
    [],
  )

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Il titolo è obbligatorio')
      return
    }
    setSaving(true)

    let slug = slugifyWikiTitle(form.slug || form.title)
    if (!slug) {
      toast.error('Lo slug non può essere vuoto')
      setSaving(false)
      return
    }

    try {
      const availability = await api.get<{
        slug: string
        available: boolean
        suggested_slug: string
      }>('/wiki-pages/slug-availability/', {
        params: {
          slug,
          exclude_id: isNew ? undefined : id,
        },
      })
      slug = availability.data.suggested_slug || slug
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      setSaving(false)
      return
    }

    const payload = {
      title: form.title,
      slug,
      category: form.category === '' ? null : form.category,
      summary: form.summary || null,
      content_markdown: form.content_html,
      is_published: form.is_published,
      tags: form.tags
        ? form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    }
    try {
      if (isNew) {
        const res = await api.post<PageDetail>('/wiki-pages/', payload)
        toast.success('Pagina creata')
        try {
          localStorage.removeItem(AUTOSAVE_KEY)
        } catch {
          /* ignore */
        }
        navigate(`/wiki/${res.data.id}`, { replace: true })
      } else {
        await api.patch(`/wiki-pages/${id}/`, payload)
        toast.success('Salvato')
        try {
          localStorage.removeItem(AUTOSAVE_KEY)
        } catch {
          /* ignore */
        }
        setMode('view')
        loadDetail(parseInt(id!, 10))
        loadRevisions(parseInt(id!, 10))
      }
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!id) return
    setDelBusy(true)
    try {
      await api.delete(`/wiki-pages/${id}/`)
      toast.success('Pagina eliminata')
      navigate('/wiki', { replace: true })
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDelBusy(false)
      setDelDlgOpen(false)
    }
  }

  // ── Export PDF ───────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!id) return
    try {
      const res = await api.get(`/wiki-pages/${id}/export-pdf/`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${detail?.slug ?? `wiki-${id}`}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  // ── Remove customer link ─────────────────────────────────────────────────

  const handleRemoveLink = async (linkId: number) => {
    try {
      await api.delete(`/wiki-links/${linkId}/`)
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
      toast.success('Collegamento rimosso')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  // ── Delete attachment ────────────────────────────────────────────────────

  const handleDeleteAttachment = async (aid: number) => {
    try {
      await api.delete(`/wiki-attachments/${aid}/`)
      setAttachments((prev) => prev.filter((a) => a.id !== aid))
      toast.success('Allegato rimosso')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  // ── Insert wiki link ──────────────────────────────────────────────────────

  const handleInsertWikiLink = (page: PageRow) => {
    const q = quillInstanceRef.current
    if (!q) {
      // fallback: inserisce nel form HTML direttamente
      const link = `<a href="/wiki/${page.id}">${page.kb_code ? `${page.kb_code} — ` : ''}${page.title}</a>`
      setForm((f) => ({ ...f, content_html: f.content_html + link }))
      return
    }
    const range = q.getSelection(true) ?? { index: q.getLength(), length: 0 }
    const text = `${page.kb_code ? `${page.kb_code} — ` : ''}${page.title}`
    q.insertText(range.index, text, 'link', `/wiki/${page.id}`)
    q.setSelection(range.index + text.length)
  }

  // ── Restore revision ──────────────────────────────────────────────────────

  const handleRestore = async (rev: WikiRevision) => {
    setRestoring(rev.id)
    try {
      await api.post(`/wiki-revisions/${rev.id}/restore/`)
      toast.success(`Ripristinata revisione #${rev.revision_number}`)
      const pid = parseInt(id!, 10)
      await loadDetail(pid)
      await loadRevisions(pid)
      setPreviewRev(null)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRestoring(null)
    }
  }

  // ── Preferiti ──────────────────────────────────────────────────────────

  const handleToggleFavorite = async () => {
    if (!id || isNew || !detail) return
    const on = !detail.is_favorite
    try {
      if (on) await api.post(`/wiki-pages/${id}/favorite/`)
      else await api.delete(`/wiki-pages/${id}/favorite/`)
      setDetail({ ...detail, is_favorite: on })
      toast.success(on ? 'Aggiunta ai preferiti' : 'Tolta dai preferiti')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const copyKb = () => {
    if (!detail?.kb_code) return
    navigator.clipboard?.writeText(detail.kb_code).then(() => toast.success(`Copiato · ${detail.kb_code}`), () => {})
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 300 }}>
        <CircularProgress />
      </Stack>
    )
  }

  const numericId = id && id !== 'new' ? parseInt(id, 10) : null
  const folders: WikiCategory[] = [...categories, NO_CAT]
  const viewCat = folders.find((c) => c.id === (detail?.category ?? 0)) ?? NO_CAT
  const editCat = folders.find((c) => c.id === (form.category === '' ? 0 : form.category)) ?? NO_CAT
  const canChange = hasPerm(PERMS.wiki.page.change)
  const canDelete = hasPerm(PERMS.wiki.page.delete)
  const linksCard = <LinksCard links={links} canEdit={canChange} onAdd={() => setAddCustomerOpen(true)} onRemove={(lid) => void handleRemoveLink(lid)} />
  const attachCard = (
    <AttachmentsCard items={attachments} canEdit={canChange} uploading={attachUploading} inputRef={attachInputRef}
      onUpload={(e) => void handleAttachmentUpload(e)} onDelete={(aid) => void handleDeleteAttachment(aid)} />
  )

  const dialogs = (
    <>
      <WikiLinkDialog open={wikiLinkOpen} onClose={() => setWikiLinkOpen(false)} onSelect={handleInsertWikiLink} />
      <ConfirmDeleteDialog
        open={delDlgOpen}
        title="Elimina pagina wiki?"
        description="La pagina verrà spostata nel cestino e potrà essere ripristinata."
        busy={delBusy}
        onClose={() => setDelDlgOpen(false)}
        onConfirm={handleDelete}
      />
      {numericId !== null && (
        <AddCustomerDialog
          open={addCustomerOpen}
          pageId={numericId}
          existingIds={links.map((l) => l.entity_id)}
          onClose={() => setAddCustomerOpen(false)}
          onAdded={() => loadLinks(numericId)}
        />
      )}
      <Dialog open={revsOpen} onClose={() => setRevsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Cronologia{detail ? ` · ${detail.title}` : ''}</DialogTitle>
        <DialogContent>
          <WikiRevisionsTab
            revisions={revisions}
            restoring={restoring}
            onPreview={(rev) => void handleOpenRevisionPreview(rev)}
            onRestore={(rev) => void handleRestore(rev)}
            previewRev={previewRev}
            previewRevHtml={previewRevHtml}
            previewRevLoading={previewRevLoading}
            onClosePreview={() => { setPreviewRev(null); setPreviewRevHtml('') }}
          />
        </DialogContent>
        <DialogActions><Button onClick={() => setRevsOpen(false)}>Chiudi</Button></DialogActions>
      </Dialog>
    </>
  )

  // ── Modifica: il foglio su cui si scrive, dentro la cartella ──
  if (mode === 'edit') {
    const tagList = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    return (
      <ArchiveRoot>
        <div className="w-ed-head">
          <nav className="w-crumbs" aria-label="Percorso">
            <a href={isNew ? '/wiki' : `/wiki/${id}`} onClick={(e) => { e.preventDefault(); if (isNew) navigate('/wiki'); else setMode('view') }}>
              <CampoIcon name="chevL" size={14} />{isNew ? 'Archivio' : detail?.title}
            </a>
          </nav>
          <span className="w-ed-st">{isNew ? 'Nuova pagina' : <>Modifica{detail?.kb_code ? <> · <span className="w-mono-s">{detail.kb_code}</span></> : null}</>}</span>
          <div className="actions">
            <Button color="inherit" onClick={() => (isNew ? navigate('/wiki') : setMode('view'))} disabled={saving}>Annulla</Button>
            <Button variant="contained" onClick={() => void handleSave()} disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CampoIcon name="task" size={16} />}>
              {isNew ? 'Crea pagina' : 'Salva'}
            </Button>
          </div>
        </div>
        <OpenFolder className="w-ed-fold" color={catColor(editCat, catDark)} label="Pagina in modifica"
          tabs={<FolderTabs cats={folders} active={editCat.id} mode="edit" onPick={(cid) => setForm((f) => ({ ...f, category: cid === 0 ? '' : cid }))} />}>
          <div className="w-ed-b">
            <div className="w-ed-main">
              <textarea className="w-ed-title" rows={1} placeholder="Titolo della pagina" aria-label="Titolo" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value.replace(/\n/g, ' ') }))} />
              <textarea className="w-ed-lead" rows={2} placeholder="Riepilogo in una o due frasi: compare nelle schede e nella ricerca" aria-label="Riepilogo"
                value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
              {isNew ? <p className="w-ed-hint-p">Le immagini si possono caricare dopo aver creato la pagina.</p> : null}
              <div className="w-ed-editor">
                <RichEditor
                  value={form.content_html}
                  onChange={(html) => {
                    setForm((f) => ({ ...f, content_html: html }))
                    // [[ apre la scelta di una pagina della Wiki da collegare
                    const plainText = html.replace(/<[^>]+>/g, '')
                    if (plainText.endsWith('[[')) {
                      setWikiLinkOpen(true)
                      setForm((f) => ({ ...f, content_html: html.replace(/\[\[$/, '').replace(/\[\[<\/[^>]+>$/, '') }))
                    }
                  }}
                  onImageUpload={!isNew ? handleImageUpload : undefined}
                  onWikiLink={() => setWikiLinkOpen(true)}
                  quillRef={quillInstanceRef}
                  minHeight={440}
                  placeholder="Scrivi il contenuto della pagina…"
                />
              </div>
            </div>
            <aside className="w-ed-side" aria-label="Proprietà della pagina">
              <section className="w-rail-s">
                <h4>Pubblicazione</h4>
                <label className="w-switch">
                  <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
                  <span />Visibile a tutti
                </label>
                <p className="w-rail-none">{form.is_published ? 'Pubblicata: compare nell\'archivio e nella ricerca.' : 'Bozza: resta nelle tue bozze finché non la pubblichi.'}</p>
              </section>
              <section className="w-rail-s">
                <h4>Posizione</h4>
                <div className="w-f">
                  <label htmlFor="w-cat">Cartella</label>
                  <select id="w-cat" value={form.category === '' ? '' : String(form.category)}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">Senza cartella</option>
                    {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-f">
                  <label htmlFor="w-slug">Indirizzo</label>
                  <input id="w-slug" className="w-mono-in" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                </div>
              </section>
              <section className="w-rail-s">
                <h4>Tag</h4>
                <div className="w-tags">
                  {tagList.map((t) => (
                    <span key={t} className="w-tag">{t}
                      <button type="button" aria-label={`Togli ${t}`} onClick={() => setForm((f) => ({ ...f, tags: tagList.filter((x) => x !== t).join(', ') }))}><CampoIcon name="x" size={12} /></button>
                    </span>
                  ))}
                  <input placeholder="Aggiungi e premi Invio" aria-label="Aggiungi tag" onKeyDown={(e) => {
                    const v = e.currentTarget.value.trim().replace(/,$/, '')
                    if ((e.key === 'Enter' || e.key === ',') && v) {
                      e.preventDefault()
                      if (!tagList.includes(v)) setForm((f) => ({ ...f, tags: [...tagList, v].join(', ') }))
                      e.currentTarget.value = ''
                    } else if (e.key === 'Backspace' && !e.currentTarget.value && tagList.length) {
                      setForm((f) => ({ ...f, tags: tagList.slice(0, -1).join(', ') }))
                    }
                  }} />
                </div>
              </section>
              {!isNew ? linksCard : null}
              {!isNew ? attachCard : null}
              <p className="w-ed-note">{isNew ? 'Il codice KB viene assegnato alla creazione.' : `Salvando si crea la revisione ${revisions.length + 1}: la versione attuale resta nella cronologia.`}</p>
            </aside>
          </div>
        </OpenFolder>
        {dialogs}
      </ArchiveRoot>
    )
  }

  // ── Lettura: il foglio nella cartella ──
  if (!detail) {
    return (
      <ArchiveRoot>
        <div className="w-d-none"><CampoIcon name="alert" size={18} /><div><b>Pagina non trovata</b><p><button type="button" className="link-btn" onClick={() => navigate('/wiki')}>Torna all'archivio</button></p></div></div>
      </ArchiveRoot>
    )
  }
  const myVote = detail.current_user_rating ?? null
  return (
    <ArchiveRoot>
      <div className="w-page-e">
      <nav className="w-crumbs" aria-label="Percorso">
        <a href="/wiki" onClick={(e) => { e.preventDefault(); navigate('/wiki') }}><CampoIcon name="chevL" size={14} />Archivio</a>
        <span>/</span>
        <a href={`/wiki?cartella=${viewCat.id}`} onClick={(e) => { e.preventDefault(); navigate(`/wiki?cartella=${viewCat.id}`) }}>{viewCat.name}</a>
      </nav>
      <OpenFolder color={catColor(viewCat, catDark)} label={viewCat.name}
        tabs={<FolderTabs cats={folders.filter((c) => c.id !== 0 || viewCat.id === 0)} active={viewCat.id} mode="art" onPick={(cid) => navigate(`/wiki?cartella=${cid}`)} />}>
        <article className="w-art is-sheet">
          <header className="w-art-h">
            <div className="w-art-top">
              <div className="w-art-tt">
                <h1>{detail.title}{!detail.is_published ? <span className="w-draft">Bozza</span> : null}</h1>
                <div className="w-meta">
                  {detail.kb_code ? <button type="button" className="w-kbcode" onClick={copyKb} title="Copia il codice">{detail.kb_code}<CampoIcon name="copy" size={12} /></button> : null}
                  <span>Aggiornata {rel(detail.updated_at)}{detail.updated_by_username ? <> da <b>{detail.updated_by_username}</b></> : null}</span>
                  <span>{detail.view_count ?? 0} letture</span>
                  {detail.rating_count ? <span className="w-rate"><StarIcon />{r1(detail.average_rating)}<small>{detail.rating_count} vot{detail.rating_count === 1 ? 'o' : 'i'}</small></span> : null}
                  {(detail.tags ?? []).map((t) => <span key={t} className="w-tag">{t}</span>)}
                </div>
              </div>
              <div className="w-art-act">
                <Tooltip title="Esporta PDF"><IconButton aria-label="Esporta PDF" onClick={() => void handleExportPdf()}><CampoIcon name="download" size={18} /></IconButton></Tooltip>
                <Tooltip title={detail.is_favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}>
                  <IconButton aria-label={detail.is_favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} aria-pressed={Boolean(detail.is_favorite)} onClick={() => void handleToggleFavorite()}
                    sx={{ color: detail.is_favorite ? 'warning.main' : undefined }}>
                    <StarIcon on={Boolean(detail.is_favorite)} size={18} />
                  </IconButton>
                </Tooltip>
                {canDelete ? <Tooltip title="Elimina"><IconButton aria-label="Elimina la pagina" onClick={() => setDelDlgOpen(true)}><CampoIcon name="trash" size={18} /></IconButton></Tooltip> : null}
                {canChange ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="wrench" size={16} />} onClick={() => setMode('edit')}>Modifica</Button> : null}
              </div>
            </div>
            {detail.summary ? <p className="w-lead">{detail.summary}</p> : null}
          </header>
          <div className="w-art-b">
            <div className="w-prose" data-prose>
              {renderHtml ? <ProseContent html={renderHtml} onToc={setToc} /> : <p className="w-rail-none">Nessun contenuto.</p>}
              <div className="w-useful">
                <span>{myVote ? `Hai dato ${myVote} ${myVote === 1 ? 'stella' : 'stelle'} a questa pagina.` : ratingBusy ? 'Salvataggio del voto…' : 'Ti è stata utile?'}</span>
                <span className="w-stars" role="radiogroup" aria-label="Voto">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={myVote === n} aria-label={`${n} su 5`} disabled={Boolean(myVote) || ratingBusy}
                      onClick={() => void handleRatePage(n)}>
                      <StarIcon on={Boolean(myVote && n <= myVote)} size={18} />
                    </button>
                  ))}
                </span>
                {myVote ? <small>Si vota una sola volta.</small> : null}
              </div>
            </div>
            <aside className="w-rail" aria-label="Informazioni sulla pagina">
              {toc.length ? <section className="w-rail-s w-toc"><h4>In questa pagina</h4><TocList items={toc} /></section> : null}
              {linksCard}
              {attachCard}
              <section className="w-rail-s">
                <h4>Revisioni <span>{revisions.length}</span></h4>
                <p className="w-rail-none">Creata {dshort(detail.created_at)}{detail.created_by_username ? ` da ${detail.created_by_username}` : ''}.</p>
                <button type="button" className="link-btn" onClick={() => setRevsOpen(true)}><CampoIcon name="history" size={14} />Cronologia</button>
              </section>
            </aside>
          </div>
        </article>
      </OpenFolder>
      </div>
      {dialogs}
    </ArchiveRoot>
  )
}
