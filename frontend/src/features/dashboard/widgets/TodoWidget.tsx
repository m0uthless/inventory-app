import * as React from 'react'
import { Box, ButtonBase, IconButton, InputBase, Typography } from '@mui/material'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import { api } from '@shared/api/client'
import WidgetShell, { CountPill, WidgetNote } from './WidgetShell'
import { tintVeil } from './tints'

type Task = { id: number; text: string; done: boolean; created_at: string }

/** Promemoria personali (stesse API di prima: /user-tasks/). */
export default function TodoWidget() {
  const [tasks, setTasks] = React.useState<Task[] | null>(null)
  const [input, setInput] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const load = React.useCallback(() => {
    api.get<{ results: Task[] }>('/user-tasks/', { params: { page_size: 50 } }).then((r) => setTasks(r.data.results)).catch(() => setTasks([]))
  }, [])
  React.useEffect(() => { load() }, [load])
  const add = async () => {
    const text = input.trim(); if (!text || saving) return
    setSaving(true)
    try { const r = await api.post<Task>('/user-tasks/', { text }); setTasks((p) => [r.data, ...(p ?? [])]); setInput(''); inputRef.current?.focus() } catch { /* resta il testo */ } finally { setSaving(false) }
  }
  const toggle = async (t: Task) => {
    setTasks((p) => p?.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) ?? p)
    try { await api.patch(`/user-tasks/${t.id}/`, { done: !t.done }) } catch { setTasks((p) => p?.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)) ?? p) }
  }
  const remove = async (id: number) => {
    setTasks((p) => p?.filter((x) => x.id !== id) ?? p)
    try { await api.delete(`/user-tasks/${id}/`) } catch { load() }
  }
  const list = tasks ? [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)] : null
  const open = tasks?.filter((t) => !t.done).length ?? 0

  return (
    <WidgetShell tone="mint" icon={ChecklistRoundedIcon} title="Da fare" extra={tasks && open ? <CountPill tone="mint">{open}</CountPill> : null} bodySx={{ px: 2, pb: 1.5, gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 32, px: 1.25, borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'transparent', '&:focus-within': { borderColor: 'primary.main' } }}>
        <InputBase inputRef={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          placeholder="Aggiungi un promemoria" inputProps={{ maxLength: 200, 'aria-label': 'Nuovo promemoria' }} sx={{ flex: 1, fontSize: 13 }} />
        <Box component="kbd" sx={{ font: '500 10px "Geist Mono", monospace', color: 'archie.textFaint' }}>Invio</Box>
      </Box>
      {!list ? <WidgetNote>Caricamento…</WidgetNote> : !list.length ? <WidgetNote>Niente da fare: aggiungi un promemoria qui sopra.</WidgetNote> : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '2px', overflowY: 'auto', minHeight: 0 }}>
          {list.map((t) => (
            <Box component="li" key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.1, px: 0.75, mx: -0.75, py: 0.4, borderRadius: '6px', '&:hover': { bgcolor: (th) => tintVeil(th, 'mint', 10) }, '&:hover .td-del, &:focus-within .td-del': { opacity: 1 } }}>
              <ButtonBase role="checkbox" aria-checked={t.done} aria-label={t.done ? `Riapri ${t.text}` : `Fatto: ${t.text}`} onClick={() => void toggle(t)} sx={{
                width: 18, height: 18, borderRadius: '6px', flex: 'none',
                border: '1.5px solid', borderColor: (th) => (t.done ? th.palette.archie.tints.mint.mid : `color-mix(in srgb, ${th.palette.archie.tints.mint.mid} 55%, ${th.palette.divider})`),
                bgcolor: (th) => (t.done ? th.palette.archie.tints.mint.mid : th.palette.background.paper), color: '#fff',
                '&.Mui-focusVisible': { boxShadow: (th) => th.palette.archie.focusRing },
              }}>{t.done ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : null}</ButtonBase>
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, color: t.done ? 'archie.textFaint' : 'text.primary', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</Typography>
              <IconButton className="td-del" size="small" aria-label={`Elimina ${t.text}`} onClick={() => void remove(t.id)} sx={{ width: 22, height: 22, opacity: 0, '&:hover': { color: 'error.main' } }}><DeleteRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
            </Box>
          ))}
        </Box>
      )}
    </WidgetShell>
  )
}
