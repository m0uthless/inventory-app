import * as React from 'react'
import {
  Box, Button, Chip, Dialog, DialogContent, DialogTitle, Divider,
  IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../auth/AuthProvider'
import MarkdownLite from './MarkdownLite'

type ChangelogEntry = {
  id: number
  version: string
  title: string
  body: string
  date: string
  created_by_name: string | null
  created_at: string
}

function fmtDate(s: string) {
  // `date` è un campo DateField (YYYY-MM-DD): niente conversione timezone.
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function InlineForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<ChangelogEntry>
  onSave: (data: { version: string; title: string; body: string; date: string }) => Promise<void>
  onCancel: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [version, setVersion] = React.useState(initial?.version ?? '')
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [date, setDate] = React.useState(initial?.date ?? today)
  const [body, setBody] = React.useState(initial?.body ?? '')
  const [saving, setSaving] = React.useState(false)

  const handle = async () => {
    if (!title.trim()) return
    setSaving(true)
    try { await onSave({ version: version.trim(), title: title.trim(), body: body.trim(), date }) }
    finally { setSaving(false) }
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="Versione"
            placeholder="es. 1.4.0"
            value={version}
            onChange={e => setVersion(e.target.value)}
            sx={{ width: 140 }}
          />
          <TextField
            size="small"
            label="Data rilascio"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
          <TextField
            size="small"
            label="Titolo *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            sx={{ flex: 1 }}
            autoFocus
          />
        </Stack>
        <TextField
          size="small"
          multiline
          minRows={5}
          maxRows={14}
          label="Testo (Markdown)"
          placeholder={'## Novità\n- Voce 1\n- Voce 2\n\n**Fix**: descrizione del fix'}
          value={body}
          onChange={e => setBody(e.target.value)}
          sx={{ '& textarea': { fontSize: '0.82rem', fontFamily: 'monospace' } }}
        />
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button size="small" onClick={onCancel} disabled={saving}>Annulla</Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckRoundedIcon />}
            onClick={handle}
            disabled={saving || !title.trim()}
          >
            Salva
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

export default function ChangelogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useAuth()
  const isStaff = me?.is_staff || me?.is_superuser || false

  const [items, setItems] = React.useState<ChangelogEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [editId, setEditId] = React.useState<number | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const toast = useToast()

  const load = React.useCallback(() => {
    setLoading(true)
    api.get<{ results: ChangelogEntry[] }>('/changelog-entries/', { params: { page_size: 100 } })
      .then(r => setItems(r.data.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { if (open) load() }, [open, load])

  const handleCreate = async (data: { version: string; title: string; body: string; date: string }) => {
    try {
      await api.post('/changelog-entries/', data)
      setAdding(false)
      load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const handleUpdate = async (id: number, data: { version: string; title: string; body: string; date: string }) => {
    try {
      await api.patch(`/changelog-entries/${id}/`, data)
      setEditId(null)
      load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const confirmDelete = async () => {
    if (deleteId === null) return
    setDeleteBusy(true)
    try {
      await api.delete(`/changelog-entries/${deleteId}/`)
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HistoryRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
            <Typography variant="subtitle1" fontWeight={700}>Changelog</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {isStaff && !adding && (
              <Tooltip title="Nuova voce">
                <IconButton size="small" onClick={() => { setAdding(true); setEditId(null) }}>
                  <AddRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={onClose}>
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {isStaff && adding && (
            <InlineForm onSave={handleCreate} onCancel={() => setAdding(false)} />
          )}

          {loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Caricamento…
            </Typography>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Nessuna voce di changelog.
            </Typography>
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {items.map(item => (
                <Box key={item.id} sx={{ py: 1.75 }}>
                  {isStaff && editId === item.id ? (
                    <InlineForm
                      initial={item}
                      onSave={(data) => handleUpdate(item.id, data)}
                      onCancel={() => setEditId(null)}
                    />
                  ) : (
                    <>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {item.version && (
                            <Chip
                              label={`v${item.version}`}
                              size="small"
                              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                            />
                          )}
                          <Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            {fmtDate(item.date)}
                          </Typography>
                          {isStaff && (
                            <>
                              <IconButton size="small" onClick={() => { setEditId(item.id); setAdding(false) }}>
                                <EditRoundedIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                              <IconButton size="small" onClick={() => setDeleteId(item.id)}>
                                <DeleteRoundedIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </>
                          )}
                        </Stack>
                      </Stack>
                      <MarkdownLite text={item.body} />
                    </>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        title="Elimina voce changelog"
        description="Confermi l'eliminazione di questa voce di changelog? L'azione non è reversibile (nessun cestino per questo modello)."
      />
    </>
  )
}
