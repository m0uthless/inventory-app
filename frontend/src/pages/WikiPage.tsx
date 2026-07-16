/**
 * WikiPage — /wiki/:id e /wiki/new
 *
 * - Editor rich text (Tiptap) con upload immagini via allegati
 * - Clienti collegati (solo Customer, dropdown reale)
 * - Allegati con upload
 * - Tabs: Contenuto / Clienti collegati / Allegati
 */
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Rating,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { Can } from '../auth/Can'
import { PERMS } from '../auth/perms'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RichEditor, { type QuillInstance } from '../ui/RichEditor'
import WikiLinkedCustomersTab, { type WikiLink } from '../features/wiki/WikiLinkedCustomersTab'
import WikiAttachmentsTab, { type WikiAttachment } from '../features/wiki/WikiAttachmentsTab'
import WikiRevisionsTab, { type WikiRevision, PROSE_SX } from '../features/wiki/WikiRevisionsTab'

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = { id: number; name: string; emoji?: string; color?: string }

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
  pdf_template_key?: string
  created_by_username?: string | null
  updated_by_username?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type ApiPage<T> = { count: number; results: T[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtAverageRating(value?: number | null): string {
  if (typeof value !== 'number') return '—'
  return value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// Stile condiviso dai due componenti Rating (voto medio + voto utente)
const ratingIconSx = {
  '& .MuiRating-iconFilled': { color: 'warning.main' },
  '& .MuiRating-iconEmpty': { color: '#fcd34d' },
} as const

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
                '&:hover': { bgcolor: '#f0fdf9', borderColor: '#0f766e40' },
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
    api
      .get<ApiPage<Customer>>('/customers/', { params: { page_size: 500, ordering: 'name' } })
      .then((r) => setCustomers(r.data.results ?? []))
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

  const [tab, setTab] = React.useState(0)
  const attachInputRef = React.useRef<HTMLInputElement>(null)

  // form state
  const [form, setForm] = React.useState({
    title: '',
    slug: '',
    category: '' as number | '',
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

  const AUTOSAVE_KEY = `wiki_autosave_${id ?? 'new'}`

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

  // ── Image upload (Tiptap) ────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 300 }}>
        <CircularProgress />
      </Stack>
    )
  }

  const pageTitle = isNew ? 'Nuova pagina' : (detail?.title ?? `Pagina #${id}`)
  const numericId = id && id !== 'new' ? parseInt(id, 10) : null

  return (
    <Stack spacing={2}>
      {/* ── Topbar ── */}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Tooltip title="Torna alla Wiki">
          <IconButton aria-label="Torna alla Wiki" size="small" onClick={() => navigate('/wiki')}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              Wiki
            </Typography>
            <Typography variant="body2" color="text.disabled">
              ›
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {pageTitle}
            </Typography>
            {detail?.kb_code && (
              <Chip
                size="small"
                label={detail.kb_code}
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 800,
                  bgcolor: '#f0fdf9',
                  color: '#0f766e',
                  border: '1px solid #0f766e40',
                  fontFamily: 'monospace',
                }}
              />
            )}
            {detail && (
              <Chip
                size="small"
                label={detail.is_published ? 'Pubblicato' : 'Bozza'}
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: detail.is_published ? '#dcfce7' : '#fef9c3',
                  color: detail.is_published ? '#166534' : '#854d0e',
                }}
              />
            )}
            {detail?.view_count !== undefined && detail.view_count > 0 && (
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.25}
                sx={{ color: 'text.disabled' }}
              >
                <VisibilityIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" fontSize={11}>
                  {detail.view_count}
                </Typography>
              </Stack>
            )}
            {detail && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.disabled' }}>
                <Typography component="span" variant="caption" fontSize={11} sx={{ color: '#d97706' }}>
                  ★
                </Typography>
                <Typography variant="caption" fontSize={11}>
                  {detail.rating_count ? `${fmtAverageRating(detail.average_rating)} · ${detail.rating_count}` : 'Nessun voto'}
                </Typography>
              </Stack>
            )}
          </Stack>
          {detail?.category_name && (
            <Typography variant="caption" color="text.disabled">
              {detail.category_name}
              {detail.updated_at && ` · Aggiornato ${fmtDate(detail.updated_at)}`}
              {detail.updated_by_username && ` da ${detail.updated_by_username}`}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          {mode === 'view' && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdfOutlinedIcon />}
                onClick={handleExportPdf}
              >
                Export PDF
              </Button>
              <Can perm={PERMS.wiki.page.change}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setMode('edit')}
                >
                  Modifica
                </Button>
              </Can>
              <Can perm={PERMS.wiki.page.delete}>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => setDelDlgOpen(true)}
                >
                  Elimina
                </Button>
              </Can>
            </>
          )}
          {mode === 'edit' && (
            <>
              {!isNew && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={() => setMode('view')}
                >
                  Annulla
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                startIcon={
                  saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon />
                }
                onClick={handleSave}
                disabled={saving}
              >
                {isNew ? 'Crea pagina' : 'Salva'}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {saving && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* ── Tabs (solo pagina esistente) ── */}
      {!isNew && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Contenuto" sx={{ fontSize: 13 }} />
            <Tab
              label={`Clienti collegati${links.length ? ` (${links.length})` : ''}`}
              sx={{ fontSize: 13 }}
            />
            <Tab
              label={`Allegati${attachments.length ? ` (${attachments.length})` : ''}`}
              sx={{ fontSize: 13 }}
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <HistoryIcon sx={{ fontSize: 14 }} />
                  <span>Revisioni{revisions.length ? ` (${revisions.length})` : ''}</span>
                </Stack>
              }
              sx={{ fontSize: 13 }}
            />
          </Tabs>
        </Box>
      )}

      {/* ══════════════════════════════
          TAB 0 — CONTENUTO
      ══════════════════════════════ */}
      {(isNew || tab === 0) && (
        <Stack spacing={2}>
          {/* Metadati view */}
          {mode === 'view' && detail && (
            <Card variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
                <Box sx={{ minWidth: 140 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Categoria
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {detail.category_name ?? '—'}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 140 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Codice
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={800}
                    fontFamily="monospace"
                    color="primary.main"
                  >
                    {detail.kb_code || '—'}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 140 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Slug
                  </Typography>
                  <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={12}>
                    {detail.slug}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 100 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Visualizzazioni
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                    <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="body2" fontWeight={600}>
                      {detail.view_count ?? 0}
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ minWidth: 140 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Creato
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {fmtDate(detail.created_at)}
                  </Typography>
                  {detail.created_by_username && (
                    <Typography variant="caption" color="text.secondary">
                      da {detail.created_by_username}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ minWidth: 140 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Ultima modifica
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {fmtDate(detail.updated_at)}
                  </Typography>
                  {detail.updated_by_username && (
                    <Typography variant="caption" color="text.secondary">
                      da {detail.updated_by_username}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ minWidth: 220 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    Valutazione
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1} mt={0.25} flexWrap="wrap">
                    <Rating
                      value={detail.average_rating ?? 0}
                      precision={0.1}
                      readOnly
                      size="small"
                      sx={ratingIconSx}
                    />
                    <Typography variant="body2" fontWeight={600}>
                      {detail.rating_count ? fmtAverageRating(detail.average_rating) : '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {detail.rating_count ? `${detail.rating_count} vot${detail.rating_count === 1 ? 'o' : 'i'}` : 'Nessun voto'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1} mt={0.75} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      Il tuo voto
                    </Typography>
                    <Rating
                      value={detail.current_user_rating ?? null}
                      onChange={(_, value) => {
                        void handleRatePage(value)
                      }}
                      readOnly={Boolean(detail.current_user_rating) || ratingBusy}
                      size="small"
                      sx={ratingIconSx}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {detail.current_user_rating
                        ? `Hai votato ${detail.current_user_rating}/5`
                        : ratingBusy
                          ? 'Salvataggio voto…'
                          : 'Puoi votare una sola volta'}
                    </Typography>
                  </Stack>
                </Box>
                {(detail.tags ?? []).length > 0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      fontWeight={600}
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                    >
                      Tag
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" spacing={0.5} mt={0.5}>
                      {(detail.tags ?? []).map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
                {detail.summary && (
                  <Box sx={{ width: '100%' }}>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      fontWeight={600}
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                    >
                      Sommario
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, fontStyle: 'italic' }}
                    >
                      {detail.summary}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          )}

          {/* Form edit / new */}
          {mode === 'edit' && (
            <Card variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    size="small"
                    label="Titolo *"
                    required
                    fullWidth
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <TextField
                    size="small"
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    sx={{ width: { xs: '100%', md: 240 } }}
                    InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Categoria</InputLabel>
                    <Select
                      label="Categoria"
                      value={form.category === '' ? '' : String(form.category)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          category: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                    >
                      <MenuItem value="">Nessuna</MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={String(c.id)}>
                          {c.emoji ? `${c.emoji} ` : ''}
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Tag (separati da virgola)"
                    fullWidth
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_published}
                        onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                        size="small"
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {form.is_published ? 'Pubblicato' : 'Bozza'}
                      </Typography>
                    }
                    sx={{ ml: 0, flexShrink: 0 }}
                  />
                </Stack>
                <TextField
                  size="small"
                  label="Sommario"
                  fullWidth
                  multiline
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                />
              </Stack>
            </Card>
          )}

          {/* Editor / Reader */}
          {mode === 'edit' ? (
            <Box>
              {isNew && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 1, display: 'block' }}
                >
                  💡 Salva prima la pagina per abilitare l'upload di immagini tramite editor.
                </Typography>
              )}
              <RichEditor
                value={form.content_html}
                onChange={(html) => {
                  setForm((f) => ({ ...f, content_html: html }))
                  // Autocomplete [[: se l'ultimo testo contiene [[ apri il dialog
                  const plain = html.replace(/<[^>]+>/g, '')
                  if (plain.endsWith('[[')) {
                    setWikiLinkOpen(true)
                    // Rimuovi [[ dal contenuto
                    setForm((f) => ({
                      ...f,
                      content_html: html.replace(/\[\[$/, '').replace(/\[\[<\/[^>]+>$/, ''),
                    }))
                  }
                }}
                onImageUpload={!isNew ? handleImageUpload : undefined}
                onWikiLink={() => setWikiLinkOpen(true)}
                quillRef={quillInstanceRef}
                minHeight={440}
                placeholder="Scrivi il contenuto della pagina…"
              />
            </Box>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 1, p: 3 }}>
              {renderHtml ? (
                <Box dangerouslySetInnerHTML={{ __html: renderHtml }} sx={PROSE_SX} />
              ) : (
                <Typography color="text.disabled" fontSize={13} fontStyle="italic">
                  Nessun contenuto.
                </Typography>
              )}
            </Card>
          )}
        </Stack>
      )}

      {/* ══════════════════════════════
          TAB 1 — CLIENTI COLLEGATI
      ══════════════════════════════ */}
      {!isNew && tab === 1 && (
        <WikiLinkedCustomersTab
          links={links}
          onRemoveLink={handleRemoveLink}
          onAddCustomer={() => setAddCustomerOpen(true)}
        />
      )}

      {/* ══════════════════════════════
          TAB 2 — ALLEGATI
      ══════════════════════════════ */}
      {!isNew && tab === 2 && (
        <WikiAttachmentsTab
          attachments={attachments}
          attachUploading={attachUploading}
          attachInputRef={attachInputRef}
          onUpload={handleAttachmentUpload}
          onDelete={handleDeleteAttachment}
        />
      )}

      {/* ══════════════════════════════
          TAB 3 — REVISIONI
      ══════════════════════════════ */}
      {!isNew && tab === 3 && (
        <WikiRevisionsTab
          revisions={revisions}
          restoring={restoring}
          onPreview={(rev) => void handleOpenRevisionPreview(rev)}
          onRestore={(rev) => void handleRestore(rev)}
          previewRev={previewRev}
          previewRevHtml={previewRevHtml}
          previewRevLoading={previewRevLoading}
          onClosePreview={() => {
            setPreviewRev(null)
            setPreviewRevHtml('')
          }}
        />
      )}

      {/* ── Dialogs ── */}
      <WikiLinkDialog
        open={wikiLinkOpen}
        onClose={() => setWikiLinkOpen(false)}
        onSelect={handleInsertWikiLink}
      />
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
    </Stack>
  )
}


