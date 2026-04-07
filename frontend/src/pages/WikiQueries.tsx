import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { useAuth } from '../auth/AuthProvider'
import { compactResetButtonSx } from '@shared/ui/toolbarStyles'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'

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

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
}

function LangChip({ label, color, textColor }: { label: string | null; color: string | null; textColor: string | null }) {
  if (!label) return null
  const bg = color ?? '#f1f5f9'
  const text = textColor ?? '#475569'
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 20,
        fontSize: '0.72rem',
        fontWeight: 700,
        borderRadius: 1,
        bgcolor: bg,
        color: text,
        border: `1px solid ${text}40`,
        letterSpacing: '0.03em',
        '& .MuiChip-label': { px: 0.85 },
      }}
    />
  )
}

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
        toast.success('Query aggiornata ✅')
      } else {
        await api.post('/wiki-queries/', payload)
        toast.success('Query creata ✅')
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

function QueryItem({ query, canEdit, onEdit, onDelete }: { query: QueryRow; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const toast = useToast()
  const [expanded, setExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = query.body
    let ok = false

    // Metodo 1: Clipboard API (HTTPS / localhost)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        ok = true
      } catch { /* fallback sotto */ }
    }

    // Metodo 2: execCommand (HTTP, browser vecchi, iframe)
    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* niente */ }
    }

    if (ok) {
      api.post(`/wiki-queries/${query.id}/use/`).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } else {
      toast.error('Impossibile copiare negli appunti')
    }
  }

  const tags = (query.tags ?? []).slice(0, 5)

  return (
    <Card variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s', borderColor: expanded ? 'primary.main' : 'divider', boxShadow: expanded ? (t) => `0 0 0 1px ${alpha(t.palette.primary.main, 0.15)}` : 'none' }}>
      <Box onClick={() => setExpanded((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
        <LangChip label={query.language_label} color={query.language_color} textColor={query.language_text_color} />
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', flex: 1, minWidth: 0, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{query.title}</Typography>
        {!!tags.length && (
          <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' }, flexShrink: 0 }}>
            {tags.map((t) => <Typography key={t} variant="caption" sx={{ fontSize: 10.5, fontWeight: 600, color: 'text.disabled', bgcolor: 'grey.50', px: 0.75, py: 0.25, borderRadius: 0.75, border: '1px solid', borderColor: 'divider' }}>{t}</Typography>)}
          </Stack>
        )}
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11, flexShrink: 0 }}>{query.use_count > 0 ? `${query.use_count}×` : ''}</Typography>
        <Tooltip title={copied ? 'Copiato!' : 'Copia query'} arrow>
          <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? 'success.main' : 'text.secondary', '&:hover': { color: 'primary.main' }, flexShrink: 0 }}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {canEdit && <>
          <Tooltip title="Modifica" arrow><IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit() }} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, flexShrink: 0 }}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Elimina" arrow><IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete() }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, flexShrink: 0 }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </>}
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }} sx={{ color: 'text.secondary', flexShrink: 0 }} aria-label={expanded ? 'Chiudi' : 'Espandi'}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        {query.description && <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5 }}><Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, lineHeight: 1.6 }}>{query.description}</Typography></Box>}
        <Box component="pre" sx={{ m: 0, mx: 1.5, mt: query.description ? 0.75 : 1.25, mb: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1.25, border: '1px solid', borderColor: 'divider', fontFamily: 'ui-monospace,"Cascadia Code","Fira Code","Courier New",monospace', fontSize: '0.8125rem', lineHeight: 1.7, color: 'text.primary', overflowX: 'auto', whiteSpace: 'pre' }}>{query.body}</Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, pb: 1, pt: 0.25, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>
            {query.updated_by_username ? `Aggiornato da @${query.updated_by_username}` : query.created_by_username ? `Creato da @${query.created_by_username}` : ''}
            {query.updated_at ? `  ·  ${fmtDate(query.updated_at)}` : ''}
          </Typography>
          <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: '14px !important' }} />} onClick={handleCopy} sx={{ fontSize: '0.75rem', color: copied ? 'success.main' : 'text.secondary', '&:hover': { color: 'primary.main' }, textTransform: 'none', py: 0.25 }}>
            {copied ? 'Copiato!' : 'Copia'}
          </Button>
        </Stack>
      </Collapse>
    </Card>
  )
}

export default function WikiQueries() {
  const toast = useToast()
  const { hasPerm } = useAuth()
  const canAdd    = hasPerm('wiki.add_wikiquery')
  const canChange = hasPerm('wiki.change_wikiquery')
  const canDelete = hasPerm('wiki.delete_wikiquery')

  const [queries, setQueries]       = React.useState<QueryRow[]>([])
  const [languages, setLanguages]   = React.useState<Language[]>([])
  const [loading, setLoading]       = React.useState(false)
  const [q, setQ]                   = React.useState('')
  const [langFilter, setLangFilter] = React.useState<number | ''>('')
  const [formOpen, setFormOpen]     = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<QueryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<QueryRow | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  const loadLanguages = React.useCallback(async () => {
    try {
      const res = await api.get<Language[] | ApiPage<Language>>('/wiki-query-languages/')
      const data = res.data
      setLanguages(Array.isArray(data) ? data : (data as ApiPage<Language>).results ?? [])
    } catch { /* silenzioso */ }
  }, [])

  React.useEffect(() => { loadLanguages() }, [loadLanguages])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page_size: 500, ordering: 'title' }
      if (q.trim()) params.search = q.trim()
      if (langFilter !== '') params.language = langFilter
      const res = await api.get<ApiPage<QueryRow>>('/wiki-queries/', { params })
      setQueries(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [q, langFilter, toast])

  React.useEffect(() => { load() }, [load])

  const reset = () => { setQ(''); setLangFilter('') }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await api.delete(`/wiki-queries/${deleteTarget.id}/`)
      toast.success('Query eliminata')
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  const hasFilters = !!q.trim() || langFilter !== ''

  const langCounts = React.useMemo(() => {
    const counts: Record<number, number> = {}
    for (const row of queries) {
      if (row.language !== null) counts[row.language] = (counts[row.language] ?? 0) + 1
    }
    return counts
  }, [queries])

  const selectedLangLabel = React.useMemo(
    () => languages.find((l) => l.id === langFilter)?.label ?? '',
    [languages, langFilter],
  )

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, p: 1.25 }}>
        <Stack spacing={1.15}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              size="small" placeholder="Cerca" value={q} onChange={(e) => setQ(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
              sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, '& .MuiInputBase-root': { height: 40, fontSize: '0.95rem', borderRadius: 1.5, bgcolor: 'transparent' }, '& .MuiInputBase-input': { py: 0 } }}
            />
            <FormControl size="small" sx={{ minWidth: 160, '& .MuiInputBase-root': { height: 40, borderRadius: 1.5 } }}>
              <InputLabel>Linguaggio</InputLabel>
              <Select label="Linguaggio" value={langFilter} onChange={(e) => setLangFilter(e.target.value as number | '')}>
                <MenuItem value="">Tutti</MenuItem>
                {languages.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" spacing={1}>
                      <span>{l.label}</span>
                      {(langCounts[l.id] ?? 0) > 0 && <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>{langCounts[l.id]}</Typography>}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1} flexShrink={0}>
              {hasFilters && (
                <Tooltip title="Reimposta" arrow>
                  <Button size="small" variant="contained" onClick={reset} aria-label="Reimposta" sx={compactResetButtonSx}><RestartAltIcon /></Button>
                </Tooltip>
              )}
              {canAdd && (
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditTarget(null); setFormOpen(true) }}
                  sx={{ height: 40, borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
                  Nuova query
                </Button>
              )}
            </Stack>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
            {queries.length} quer{queries.length === 1 ? 'y' : 'ies'}{selectedLangLabel ? ` · ${selectedLangLabel}` : ''}
          </Typography>
        </Stack>
      </Card>

      {loading ? (
        <Stack alignItems="center" py={6}><CircularProgress size={28} /></Stack>
      ) : queries.length === 0 ? (
        <Stack alignItems="center" py={8} spacing={1.5}>
          <TerminalOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography color="text.secondary">{hasFilters ? 'Nessuna query trovata.' : 'Nessuna query salvata.'}</Typography>
          {hasFilters && <Button size="small" onClick={reset}>Azzera filtri</Button>}
          {!hasFilters && canAdd && <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditTarget(null); setFormOpen(true) }}>Aggiungi la prima query</Button>}
        </Stack>
      ) : (
        <Stack spacing={0.75}>
          {queries.map((row) => <QueryItem key={row.id} query={row} canEdit={canChange || canDelete} onEdit={() => { setEditTarget(row); setFormOpen(true) }} onDelete={() => setDeleteTarget(row)} />)}
        </Stack>
      )}

      <QueryFormDialog open={formOpen} initial={editTarget} languages={languages} onClose={() => setFormOpen(false)} onSaved={load} />
      <ConfirmDeleteDialog
        open={!!deleteTarget} busy={deleteBusy} title="Elimina query"
        description={deleteTarget ? `Stai per eliminare "${deleteTarget.title}". L'operazione non è reversibile.` : ''}
        onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
      />
    </Stack>
  )
}
