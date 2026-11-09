import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Checkbox, IconButton, InputBase, Link, Popover, Tooltip, Typography } from '@mui/material'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'

import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { DetailSection } from '../../ui/campo'

export type IssueWikiLink = {
  id: number
  page: number
  page_title: string
  page_slug: string
  kb_code: string
  page_available: boolean
  steps: { text: string; checked: boolean }[]
}

type PageOpt = { id: number; title: string; kb_code?: string; summary?: string | null }

/**
 * «Procedura» nella scheda della issue (anteprima h-base, scheda intervento): articoli Wiki
 * collegati, con i passi dell'articolo da spuntare. Le spunte restano sulla issue.
 * Nascosta a chi non può vedere la Wiki.
 */
export default function IssueProcedure({ issueId, canEdit, canViewWiki }: { issueId: number; canEdit: boolean; canViewWiki: boolean }) {
  const toast = useToast()
  const [links, setLinks] = React.useState<IssueWikiLink[] | null>(null)
  const [pickEl, setPickEl] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!canViewWiki) return
    let alive = true
    setLinks(null)
    api.get<IssueWikiLink[]>(`/issues/${issueId}/wiki/`)
      .then((r) => { if (alive) setLinks(r.data) })
      .catch(() => { if (alive) setLinks([]) })
    return () => { alive = false }
  }, [issueId, canViewWiki])

  if (!canViewWiki || links === null) return null

  const replace = (l: IssueWikiLink) => setLinks((ls) => (ls ?? []).map((x) => (x.id === l.id ? l : x)))

  const toggle = async (l: IssueWikiLink, text: string, checked: boolean) => {
    replace({ ...l, steps: l.steps.map((s) => (s.text === text ? { ...s, checked } : s)) })
    try {
      const r = await api.patch<IssueWikiLink>(`/issues/${issueId}/wiki/${l.id}/`, { step: text, checked })
      replace(r.data)
    } catch (e) {
      replace(l)
      toast.error(apiErrorToMessage(e))
    }
  }

  const link = async (pageId: number) => {
    setPickEl(null)
    try {
      const r = await api.post<IssueWikiLink>(`/issues/${issueId}/wiki/`, { page: pageId })
      setLinks((ls) => [...(ls ?? []).filter((x) => x.id !== r.data.id), r.data])
      toast.success(`Collegato «${r.data.page_title}»`)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const unlink = async (l: IssueWikiLink) => {
    setLinks((ls) => (ls ?? []).filter((x) => x.id !== l.id))
    try {
      await api.delete(`/issues/${issueId}/wiki/${l.id}/`)
      toast.success(`Scollegato «${l.page_title}»`)
    } catch (e) {
      setLinks((ls) => [...(ls ?? []), l])
      toast.error(apiErrorToMessage(e))
    }
  }

  const allSteps = links.flatMap((l) => l.steps)
  const done = allSteps.filter((s) => s.checked).length

  return (
    <DetailSection
      title="Procedura"
      end={allSteps.length ? <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 600, color: done === allSteps.length ? 'success.main' : 'text.secondary' }}>{done} di {allSteps.length}</Typography> : undefined}
    >
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {links.map((l) => (
          <Box key={l.id} sx={{ display: 'grid', gap: 0.25 }}>
            {l.steps.map((s) => (
              <Box key={s.text} component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, fontSize: 13, lineHeight: 1.45, cursor: canEdit ? 'pointer' : 'default' }}>
                <Checkbox size="small" checked={s.checked} disabled={!canEdit} onChange={(e) => void toggle(l, s.text, e.target.checked)}
                  sx={{ p: '2px', mt: '-1px' }} slotProps={{ input: { 'aria-label': s.text } }} />
                <Box component="span" sx={{ pt: '1px', color: s.checked ? 'text.secondary' : 'text.primary', textDecoration: s.checked ? 'line-through' : 'none' }}>{s.text}</Box>
              </Box>
            ))}
            {!l.steps.length ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>L'articolo non ha un elenco di passi da spuntare.</Typography>
            ) : null}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <MenuBookOutlinedIcon sx={{ fontSize: 15, color: 'primary.main' }} />
              {l.page_available ? (
                <Link component={RouterLink} to={`/wiki/${l.page}`} underline="hover" sx={{ fontSize: 12, fontWeight: 550 }}>Dalla Wiki: «{l.page_title}»</Link>
              ) : (
                <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>«{l.page_title}» (non più pubblicato)</Typography>
              )}
              {canEdit ? (
                <Tooltip title="Scollega l'articolo">
                  <IconButton size="small" aria-label={`Scollega ${l.page_title}`} onClick={() => void unlink(l)} sx={{ width: 22, height: 22, ml: 'auto', color: 'text.secondary' }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
          </Box>
        ))}
        {canEdit ? (
          <Box>
            <Button size="small" variant="text" startIcon={<SearchIcon />} onClick={(e) => setPickEl(e.currentTarget)} sx={{ ml: -0.75 }}>
              {links.length ? 'Collega un altro articolo' : 'Cerca nella Wiki'}
            </Button>
          </Box>
        ) : !links.length ? (
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>Nessun articolo Wiki collegato.</Typography>
        ) : null}
      </Box>
      <Popover open={Boolean(pickEl)} anchorEl={pickEl} onClose={() => setPickEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { width: 340, p: 1 } } }}>
        <WikiPagePicker exclude={links.map((l) => l.page)} onPick={(id) => void link(id)} />
      </Popover>
    </DetailSection>
  )
}

/** Ricerca tra gli articoli pubblicati della Wiki. */
function WikiPagePicker({ exclude, onPick }: { exclude: number[]; onPick: (id: number) => void }) {
  const [q, setQ] = React.useState('')
  const [list, setList] = React.useState<PageOpt[]>([])
  const [loading, setLoading] = React.useState(false)
  const [active, setActive] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      api.get('/wiki-pages/', { params: { search: q || undefined, is_published: true, page_size: 12, ordering: '-updated_at' } }).then((r) => {
        const d = r.data as { results?: PageOpt[] } | PageOpt[]
        const rows = (Array.isArray(d) ? d : d.results ?? []).filter((p) => !exclude.includes(p.id))
        if (alive) { setList(rows); setActive(0) }
      }).catch(() => { if (alive) setList([]) }).finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q, exclude])
  return (
    <Box>
      <InputBase autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un articolo…" inputProps={{ 'aria-label': 'Cerca un articolo della Wiki' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && list[active]) { e.preventDefault(); onPick(list[active].id) }
        }}
        sx={{ width: '100%', height: 32, px: 1, mb: 0.5, fontSize: 13, border: '1px solid', borderColor: 'divider', borderRadius: '6px', '&.Mui-focused': { borderColor: 'primary.main' } }} />
      <Box role="listbox" aria-label="Articoli della Wiki" sx={{ maxHeight: 300, overflowY: 'auto', display: 'grid' }}>
        {list.map((p, i) => (
          <Box key={p.id} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => onPick(p.id)}
            sx={{ display: 'grid', px: 1, py: 0.6, borderRadius: '5px', cursor: 'pointer', bgcolor: i === active ? 'archie.surface2' : 'transparent' }}>
            <Typography component="span" sx={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.kb_code ? <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, color: 'text.secondary', mr: 0.75 }}>{p.kb_code}</Box> : null}{p.title}
            </Typography>
            {p.summary ? <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.summary}</Typography> : null}
          </Box>
        ))}
        {!list.length ? <Box sx={{ p: 1, fontSize: 12, color: 'text.secondary' }}>{loading ? 'Ricerca…' : 'Nessun articolo trovato'}</Box> : null}
      </Box>
    </Box>
  )
}
