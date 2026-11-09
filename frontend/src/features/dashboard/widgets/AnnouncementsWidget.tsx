import * as React from 'react'
import { Box, Button, IconButton, InputBase, MenuItem, Select, Tooltip, Typography } from '@mui/material'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../../../auth/AuthProvider'
import type { Theme } from '@mui/material'
import WidgetShell, { WidgetNote } from './WidgetShell'

type Category = 'news' | 'warning' | 'maintenance'
type Announcement = { id: number; title: string; body: string; category: Category; created_by_name: string | null; created_at: string }
// Etichette: News in acciaio, Manutenzione in salvia, Avviso nel colore di stato "errore" (è un avviso).
const CAT: Record<Category, { label: string; ink: (t: Theme) => string; bg: (t: Theme) => string }> = {
  news: { label: 'News', ink: (t) => t.palette.archie.dash.acciaio.ink, bg: (t) => t.palette.archie.dash.acciaio.bg },
  warning: { label: 'Avviso', ink: (t) => t.palette.error.main, bg: (t) => t.palette.error.light },
  maintenance: { label: 'Manutenzione', ink: (t) => t.palette.archie.dash.salvia.ink, bg: (t) => t.palette.archie.dash.salvia.bg },
}
const fmt = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const fieldSx = { width: '100%', fontSize: 13, px: 1, py: 0.5, borderRadius: '6px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', '&.Mui-focused': { borderColor: 'primary.main' } } as const

function Form({ initial, onSave, onCancel }: { initial?: Partial<Announcement>; onSave: (d: { title: string; body: string; category: Category }) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [body, setBody] = React.useState(initial?.body ?? '')
  const [category, setCategory] = React.useState<Category>(initial?.category ?? 'news')
  const [saving, setSaving] = React.useState(false)
  const save = async () => { if (!title.trim()) return; setSaving(true); try { await onSave({ title: title.trim(), body: body.trim(), category }) } finally { setSaving(false) } }
  return (
    <Box sx={{ display: 'grid', gap: 0.75, p: 1.25, borderRadius: '10px', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Select size="small" value={category} onChange={(e) => setCategory(e.target.value as Category)} sx={{ fontSize: 12.5, height: 30, minWidth: 128 }} inputProps={{ 'aria-label': 'Categoria' }}>
          {Object.entries(CAT).map(([k, v]) => <MenuItem key={k} value={k} sx={{ fontSize: 12.5 }}>{v.label}</MenuItem>)}
        </Select>
        <InputBase autoFocus placeholder="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ 'aria-label': 'Titolo' }} sx={fieldSx} />
      </Box>
      <InputBase multiline minRows={2} maxRows={4} placeholder="Testo della comunicazione" value={body} onChange={(e) => setBody(e.target.value)} inputProps={{ 'aria-label': 'Testo' }} sx={fieldSx} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
        <Button size="small" color="inherit" onClick={onCancel} disabled={saving}>Annulla</Button>
        <Button size="small" variant="contained" onClick={() => void save()} disabled={saving || !title.trim()}>Pubblica</Button>
      </Box>
    </Box>
  )
}

/** Comunicazioni: la più recente per intero, le altre su una riga; lo staff aggiunge, modifica, elimina. */
export default function AnnouncementsWidget() {
  const { me } = useAuth()
  const isStaff = Boolean(me?.is_staff || me?.is_superuser)
  const toast = useToast()
  const [items, setItems] = React.useState<Announcement[] | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [editId, setEditId] = React.useState<number | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const load = React.useCallback(() => {
    api.get<{ results: Announcement[] }>('/announcements/', { params: { page_size: 10 } }).then((r) => setItems(r.data.results)).catch(() => setItems([]))
  }, [])
  React.useEffect(() => { load() }, [load])
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); load(); return true } catch (e) { toast.error(apiErrorToMessage(e)); return false } }

  return (
    <WidgetShell tone="acciaio" icon={CampaignRoundedIcon} title="Comunicazioni"
      actions={isStaff && !adding ? <Tooltip title="Nuova comunicazione"><IconButton size="small" aria-label="Nuova comunicazione" onClick={() => setAdding(true)} sx={{ width: 26, height: 26, color: (t) => t.palette.archie.dash.acciaio.ink }}><AddRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip> : null}
      bodySx={{ px: 2, pb: 2, gap: 0.75, overflowY: 'auto' }}>
      {adding ? <Form onCancel={() => setAdding(false)} onSave={async (d) => { if (await run(() => api.post('/announcements/', d))) setAdding(false) }} /> : null}
      {!items ? <WidgetNote>Caricamento…</WidgetNote> : !items.length && !adding ? <WidgetNote>Nessuna comunicazione.</WidgetNote> : items.map((a, i) => (
        editId === a.id ? <Form key={a.id} initial={a} onCancel={() => setEditId(null)} onSave={async (d) => { if (await run(() => api.patch(`/announcements/${a.id}/`, d))) setEditId(null) }} /> : (
          <Box key={a.id} sx={{
            position: 'relative', display: i === 0 ? 'grid' : 'flex', alignItems: i === 0 ? undefined : 'center', gap: i === 0 ? 0.25 : 1, p: i === 0 ? '10px 12px' : '7px 12px', borderRadius: '10px', bgcolor: i === 0 ? 'background.paper' : 'archie.surface2',
            boxShadow: i === 0 ? (t) => `inset 0 0 0 1px ${t.palette.archie.borderStrong}` : 'none',
            '&:hover .ann-act, &:focus-within .ann-act': { opacity: 1 },
          }}>
            <Box component="span" sx={{ justifySelf: 'start', flex: 'none', fontSize: 10.5, fontWeight: 650, lineHeight: '17px', px: 0.75, borderRadius: '5px', color: (CAT[a.category] ?? CAT.news).ink, bgcolor: (CAT[a.category] ?? CAT.news).bg }}>{CAT[a.category]?.label ?? a.category}</Box>
            <Typography noWrap={i > 0} sx={{ flex: i === 0 ? undefined : 1, minWidth: 0, fontSize: i === 0 ? 13 : 12.5, fontWeight: 600 }}>{a.title}</Typography>
            {i === 0 && a.body ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.body}</Typography> : null}
            <Typography component="small" sx={{ flex: 'none', fontSize: 11, color: 'archie.textFaint' }}>{i === 0 && a.created_by_name ? `${a.created_by_name} · ` : ''}{fmt(a.created_at)}</Typography>
            {isStaff ? (
              <Box className="ann-act" sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', opacity: 0, transition: 'opacity .12s', bgcolor: 'background.paper', borderRadius: '6px' }}>
                <IconButton size="small" aria-label={`Modifica ${a.title}`} onClick={() => setEditId(a.id)} sx={{ width: 24, height: 24 }}><EditRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
                <IconButton size="small" aria-label={`Elimina ${a.title}`} onClick={() => setDeleteId(a.id)} sx={{ width: 24, height: 24, '&:hover': { color: 'error.main' } }}><DeleteRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
              </Box>
            ) : null}
          </Box>
        )
      ))}
      <ConfirmDeleteDialog open={deleteId !== null} onClose={() => setDeleteId(null)} busy={busy} title="Eliminare la comunicazione?" description="La comunicazione sparisce dalla Dashboard di tutti."
        onConfirm={async () => { if (deleteId === null) return; setBusy(true); if (await run(() => api.delete(`/announcements/${deleteId}/`))) setDeleteId(null); setBusy(false) }} />
    </WidgetShell>
  )
}
