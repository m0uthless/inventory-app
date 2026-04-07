/**
 * WikiCategoryManager — gestione categorie wiki.
 * Visibile solo a is_staff / is_superuser.
 * Features: lista, crea, modifica, elimina, riordina (sort_order), emoji picker, color picker.
 */
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WikiCategory = {
  id: number
  name: string
  description?: string | null
  sort_order: number
  emoji: string
  color: string
}

type ApiPage<T> = { count: number; results: T[] }

// ── Palette colori predefiniti ────────────────────────────────────────────────

const PRESET_COLORS = [
  '#0f766e', // teal
  '#0284c7', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#dc2626', // red
  '#ea580c', // orange
  '#ca8a04', // yellow
  '#16a34a', // green
  '#0891b2', // cyan
  '#64748b', // slate
]

// ── Emoji veloci per categoria ────────────────────────────────────────────────

const QUICK_EMOJIS = [
  '📄',
  '📁',
  '📂',
  '🗂️',
  '📋',
  '📌',
  '📎',
  '🔖',
  '⚙️',
  '🔧',
  '🔩',
  '🛠️',
  '🖥️',
  '💻',
  '🖨️',
  '📡',
  '🔐',
  '🔑',
  '🛡️',
  '⚠️',
  '🚨',
  '✅',
  '❌',
  '🔴',
  '🏢',
  '🏭',
  '📍',
  '🌐',
  '🗺️',
  '📦',
  '🚚',
  '🏗️',
  '📊',
  '📈',
  '📉',
  '💡',
  '🧪',
  '🔬',
  '📚',
  '📖',
  '👤',
  '👥',
  '🧑‍💻',
  '👨‍🔧',
  '🤝',
  '📞',
  '📧',
  '💬',
]

// ── Color Picker ──────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        Colore
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {PRESET_COLORS.map((c) => (
          <Box
            key={c}
            onClick={() => onChange(c)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: c,
              cursor: 'pointer',
              border: '2px solid',
              borderColor: value === c ? 'text.primary' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s',
              '&:hover': { transform: 'scale(1.15)' },
            }}
          >
            {value === c && <CheckIcon sx={{ fontSize: 14, color: '#fff' }} />}
          </Box>
        ))}
        {/* Custom hex input */}
        <Tooltip title="Colore personalizzato (hex)">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              component="input"
              type="color"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: 'grey.300',
                cursor: 'pointer',
                padding: 0,
                background: 'none',
                '&::-webkit-color-swatch-wrapper': { padding: 0, borderRadius: '50%' },
                '&::-webkit-color-swatch': { borderRadius: '50%', border: 'none' },
              }}
            />
          </Box>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.disabled" fontFamily="monospace">
        {value}
      </Typography>
    </Stack>
  )
}

// ── Emoji Picker ──────────────────────────────────────────────────────────────

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [custom, setCustom] = React.useState('')

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        Emoji
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 0.25,
        }}
      >
        {QUICK_EMOJIS.map((e) => (
          <Box
            key={e}
            onClick={() => onChange(e)}
            sx={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: value === e ? 'primary.50' : 'transparent',
              border: '1.5px solid',
              borderColor: value === e ? 'primary.main' : 'transparent',
              transition: 'all 0.1s',
              '&:hover': { bgcolor: 'grey.100', transform: 'scale(1.1)' },
            }}
          >
            {e}
          </Box>
        ))}
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          placeholder="Emoji personalizzata"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          inputProps={{ maxLength: 4 }}
          sx={{ width: 160, '& input': { fontFamily: 'inherit', fontSize: 16 } }}
        />
        <Button
          size="small"
          variant="outlined"
          disabled={!custom.trim()}
          onClick={() => {
            onChange(custom.trim())
            setCustom('')
          }}
        >
          Usa
        </Button>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            border: '1.5px solid',
            borderColor: 'grey.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            bgcolor: value ? `${value}` : 'grey.50',
          }}
        >
          {value || '?'}
        </Box>
      </Stack>
    </Stack>
  )
}

// ── Category form (create / edit) ─────────────────────────────────────────────

type FormState = {
  name: string
  description: string
  sort_order: string
  emoji: string
  color: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  sort_order: '0',
  emoji: '📄',
  color: '#0f766e',
}

function CategoryFormDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean
  initial: WikiCategory | null // null = create
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name,
        description: initial.description ?? '',
        sort_order: String(initial.sort_order),
        emoji: initial.emoji || '📄',
        color: initial.color || '#0f766e',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, initial])

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Il nome è obbligatorio')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      sort_order: parseInt(form.sort_order, 10) || 0,
      emoji: form.emoji,
      color: form.color,
    }
    try {
      if (initial) {
        await api.patch(`/wiki-categories/${initial.id}/`, payload)
        toast.success('Categoria aggiornata')
      } else {
        await api.post('/wiki-categories/', payload)
        toast.success('Categoria creata')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={700}>
            {initial ? 'Modifica categoria' : 'Nuova categoria'}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {/* Preview */}
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: `${form.color}12`,
              border: '1.5px solid',
              borderColor: `${form.color}40`,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1,
                bgcolor: form.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {form.emoji}
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={15} color={form.color}>
                {form.name || 'Nome categoria'}
              </Typography>
              {form.description && (
                <Typography variant="caption" color="text.secondary">
                  {form.description}
                </Typography>
              )}
            </Box>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Nome *"
              size="small"
              fullWidth
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              autoFocus
            />
            <TextField
              label="Ordine"
              size="small"
              type="number"
              value={form.sort_order}
              onChange={(e) => set('sort_order')(e.target.value)}
              sx={{ width: 100, flexShrink: 0 }}
            />
          </Stack>

          <TextField
            label="Descrizione (opzionale)"
            size="small"
            fullWidth
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            multiline
            rows={2}
          />

          <Divider />

          <EmojiPicker value={form.emoji} onChange={set('emoji')} />

          <Divider />

          <ColorPicker value={form.color} onChange={set('color')} />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {initial ? 'Salva modifiche' : 'Crea categoria'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Category row ──────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: WikiCategory
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        px: 2,
        py: 1.25,
        '&:hover': { bgcolor: 'grey.50' },
        '&:hover .row-actions': { opacity: 1 },
        transition: 'background 0.1s',
      }}
    >
      <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />

      {/* Emoji badge */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          bgcolor: cat.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {cat.emoji || '📄'}
      </Box>

      {/* Name + description */}
      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {cat.name}
        </Typography>
        {cat.description && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {cat.description}
          </Typography>
        )}
      </Box>

      {/* Color swatch */}
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          bgcolor: cat.color,
          flexShrink: 0,
          border: '1.5px solid rgba(0,0,0,0.1)',
        }}
      />

      {/* Sort order */}
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ width: 28, textAlign: 'right', flexShrink: 0 }}
      >
        {cat.sort_order}
      </Typography>

      {/* Actions */}
      <Stack
        className="row-actions"
        direction="row"
        spacing={0.25}
        sx={{ opacity: 0, transition: 'opacity 0.1s', flexShrink: 0 }}
      >
        <Tooltip title="Modifica">
          <IconButton size="small" onClick={onEdit}>
            <EditOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Elimina">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  onChanged: () => void // callback per ricaricare la griglia
}

export default function WikiCategoryManager({ open, onClose, onChanged }: Props) {
  const toast = useToast()
  const [categories, setCategories] = React.useState<WikiCategory[]>([])
  const [loading, setLoading] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<WikiCategory | null>(null)
  const [deleting, setDeleting] = React.useState<WikiCategory | null>(null)
  const [delBusy, setDelBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ApiPage<WikiCategory>>('/wiki-categories/', {
        params: { ordering: 'sort_order,name', page_size: 200 },
      })
      setCategories(res.data.results ?? [])
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleSaved = () => {
    load()
    onChanged()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDelBusy(true)
    try {
      await api.delete(`/wiki-categories/${deleting.id}/`)
      toast.success(`"${deleting.name}" eliminata`)
      setDeleting(null)
      load()
      onChanged()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Gestione categorie
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {categories.length} categorie · solo admin
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Nuova
              </Button>
              <IconButton size="small" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress size={24} />
            </Stack>
          ) : categories.length === 0 ? (
            <Stack alignItems="center" py={5} spacing={1}>
              <Typography fontSize={32}>🗂️</Typography>
              <Typography color="text.secondary" fontSize={13}>
                Nessuna categoria. Creane una!
              </Typography>
            </Stack>
          ) : (
            <Card
              variant="outlined"
              sx={{ mx: 2, mb: 2, mt: 1, borderRadius: 1, overflow: 'hidden' }}
            >
              <Stack divider={<Divider />}>
                {categories.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    onEdit={() => {
                      setEditing(cat)
                      setFormOpen(true)
                    }}
                    onDelete={() => setDeleting(cat)}
                  />
                ))}
              </Stack>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {/* Form crea/modifica */}
      <CategoryFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      {/* Confirm delete */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Elimina categoria?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Stai eliminando <strong>{deleting?.name}</strong>. Le pagine associate non vengono
            eliminate, ma perderanno la categoria.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={delBusy}>
            Annulla
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={delBusy}>
            {delBusy ? <CircularProgress size={16} /> : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
