import * as React from 'react'
import {
  Box, Card, Chip, Divider, IconButton, Stack,
  TextField, Typography, Tooltip, MenuItem, Select,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'news' | 'warning' | 'maintenance'

type Announcement = {
  id: number
  title: string
  body: string
  category: Category
  created_by_name: string | null
  created_at: string
}

// ─── Category config ──────────────────────────────────────────────────────────
const CAT: Record<Category, { label: string; color: string; bg: string; chipColor: 'default' | 'warning' | 'info' }> = {
  news:        { label: 'News',         color: '#0284c7', bg: 'rgba(2,132,199,0.07)',   chipColor: 'info' },
  warning:     { label: 'Avviso',       color: '#ea580c', bg: 'rgba(234,88,12,0.07)',   chipColor: 'warning' },
  maintenance: { label: 'Manutenzione', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)', chipColor: 'default' },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Form inline ──────────────────────────────────────────────────────────────
function InlineForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Announcement>
  onSave: (data: { title: string; body: string; category: Category }) => Promise<void>
  onCancel: () => void
}) {
  const [title,    setTitle]    = React.useState(initial?.title    ?? '')
  const [body,     setBody]     = React.useState(initial?.body     ?? '')
  const [category, setCategory] = React.useState<Category>(initial?.category ?? 'news')
  const [saving,   setSaving]   = React.useState(false)

  const handle = async () => {
    if (!title.trim()) return
    setSaving(true)
    try { await onSave({ title: title.trim(), body: body.trim(), category }) }
    finally { setSaving(false) }
  }

  return (
    <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Select
            size="small"
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            sx={{ fontSize: '0.78rem', height: 30, minWidth: 130 }}
          >
            {Object.entries(CAT).map(([k, v]) => (
              <MenuItem key={k} value={k} sx={{ fontSize: '0.78rem' }}>{v.label}</MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            placeholder="Titolo *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            sx={{ flex: 1, '& input': { fontSize: '0.82rem', py: '5px' } }}
            autoFocus
          />
        </Stack>
        <TextField
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Testo della comunicazione..."
          value={body}
          onChange={e => setBody(e.target.value)}
          sx={{ '& textarea': { fontSize: '0.82rem' } }}
        />
        <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
          <IconButton size="small" onClick={onCancel} disabled={saving}>
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            onClick={handle}
            disabled={saving || !title.trim()}
          >
            <CheckRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AnnouncementsCard() {
  const { me } = useAuth()
  const isStaff = me?.is_staff || me?.is_superuser || false

  const [items,    setItems]    = React.useState<Announcement[]>([])
  const [loading,  setLoading]  = React.useState(true)
  const [adding,   setAdding]   = React.useState(false)
  const [editId,   setEditId]   = React.useState<number | null>(null)

  const load = React.useCallback(() => {
    api.get<{ results: Announcement[] }>('/announcements/', { params: { page_size: 10 } })
      .then(r => setItems(r.data.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const handleCreate = async (data: { title: string; body: string; category: Category }) => {
    await api.post('/announcements/', data)
    setAdding(false)
    load()
  }

  const handleUpdate = async (id: number, data: { title: string; body: string; category: Category }) => {
    await api.patch(`/announcements/${id}/`, data)
    setEditId(null)
    load()
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Eliminare questa comunicazione?')) return
    await api.delete(`/announcements/${id}/`)
    load()
  }

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CampaignRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>Comunicazioni</Typography>
        </Stack>
        {isStaff && !adding && (
          <Tooltip title="Nuova comunicazione">
            <IconButton size="small" onClick={() => { setAdding(true); setEditId(null) }}>
              <AddRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Form aggiunta */}
      {adding && (
        <InlineForm
          onSave={handleCreate}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Lista */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">Caricamento...</Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CampaignRoundedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
            <Typography variant="caption" color="text.disabled" display="block">
              Nessuna comunicazione
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {items.map(item => {
              const cat = CAT[item.category] ?? CAT.news
              const isEditing = editId === item.id

              if (isEditing) {
                return (
                  <InlineForm
                    key={item.id}
                    initial={item}
                    onSave={data => handleUpdate(item.id, data)}
                    onCancel={() => setEditId(null)}
                  />
                )
              }

              return (
                <Box
                  key={item.id}
                  sx={{
                    px: 2, py: 1.5,
                    borderLeft: `3px solid ${cat.color}`,
                    bgcolor: cat.bg,
                    '&:hover .ann-actions': { opacity: 1 },
                    position: 'relative',
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={cat.label}
                          color={cat.chipColor}
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                          {item.title}
                        </Typography>
                      </Stack>

                      {item.body && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: '0.78rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}
                        >
                          {item.body}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                        {item.created_by_name && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
                            {item.created_by_name}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
                          {fmtDate(item.created_at)}
                        </Typography>
                      </Stack>
                    </Stack>

                    {/* Azioni staff */}
                    {isStaff && (
                      <Stack
                        className="ann-actions"
                        direction="row"
                        spacing={0.25}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.15s',
                          flexShrink: 0,
                        }}
                      >
                        <Tooltip title="Modifica">
                          <IconButton
                            size="small"
                            onClick={() => { setEditId(item.id); setAdding(false) }}
                            sx={{ width: 24, height: 24 }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Elimina">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(item.id)}
                            sx={{ width: 24, height: 24 }}
                          >
                            <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              )
            })}
          </Stack>
        )}
      </Box>
    </Card>
  )
}
